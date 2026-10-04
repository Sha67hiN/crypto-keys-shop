ALTER TABLE public.products ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'product';

CREATE TABLE public.user_balances (
  user_id uuid PRIMARY KEY,
  balance_usd numeric NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_balances TO authenticated;
GRANT ALL ON public.user_balances TO service_role;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own balance read" ON public.user_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read balances" ON public.user_balances FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  kind text NOT NULL,
  note text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.balance_transactions TO authenticated;
GRANT ALL ON public.balance_transactions TO service_role;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx read" ON public.balance_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read tx" ON public.balance_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public._credit_balance(_user uuid, _amount numeric, _kind text, _note text, _order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_balances (user_id, balance_usd) VALUES (_user, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance_usd = user_balances.balance_usd + _amount, updated_at = now();
  INSERT INTO public.balance_transactions (user_id, amount_usd, kind, note, order_id) VALUES (_user, _amount, _kind, _note, _order);
END $$;
REVOKE ALL ON FUNCTION public._credit_balance(uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.server_place_topup(_key text, _amount_usd numeric, _wallet_id uuid, _expected numeric, _window_minutes integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _w public.payment_wallets; _id uuid;
BEGIN
  PERFORM public._check_server_key(_key);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _amount_usd < 1 OR _amount_usd > 10000 THEN RAISE EXCEPTION 'Top-up must be between $1 and $10,000'; END IF;
  SELECT * INTO _w FROM public.payment_wallets WHERE id = _wallet_id AND is_active;
  IF _w.id IS NULL THEN RAISE EXCEPTION 'Not available'; END IF;
  INSERT INTO public.orders (user_id, product_id, product_name, kind, quantity, unit_price_usd, total_usd, payment_provider, payment_wallet_id, pay_currency, pay_amount, expected_amount, pay_address, expires_at)
  VALUES (auth.uid(), NULL, 'Wallet top-up', 'topup', 1, _amount_usd, _amount_usd, 'self-hosted', _w.id, _w.asset, _expected, _expected, _w.address, now() + make_interval(mins => _window_minutes))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.server_order_update(_key text, _order_id uuid, _action text, _tx_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _s text; _o public.orders;
BEGIN
  PERFORM public._check_server_key(_key);
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) FOR UPDATE;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _action = 'expire' THEN
    UPDATE public.orders SET status = 'failed' WHERE id = _order_id AND status = 'pending';
  ELSIF _action = 'checked' THEN
    UPDATE public.orders SET last_checked_at = now() WHERE id = _order_id;
  ELSIF _action = 'paid' AND _o.status = 'pending' THEN
    UPDATE public.orders SET status = 'paid', paid_at = now(), tx_hash = NULLIF(_tx_hash,'') WHERE id = _order_id;
    IF _o.kind = 'topup' THEN
      PERFORM public._credit_balance(_o.user_id, _o.total_usd, 'topup', _o.order_code, _o.id);
      UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = _order_id;
    ELSE
      PERFORM public.deliver_order(_order_id);
    END IF;
  ELSIF _action = 'deliver' AND _o.status = 'paid' AND _o.kind <> 'topup' THEN
    PERFORM public.deliver_order(_order_id);
  END IF;
  SELECT status::text INTO _s FROM public.orders WHERE id = _order_id;
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.pay_with_balance(_product_id uuid, _quantity integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _p public.products; _total numeric; _bal numeric; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _quantity < 1 OR _quantity > 50 THEN RAISE EXCEPTION 'Choose a quantity between 1 and 50.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_blocked) THEN RAISE EXCEPTION 'This account cannot place orders.'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id AND is_active;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'That product is not available.'; END IF;
  IF public.available_stock(_p.id) < _quantity THEN RAISE EXCEPTION 'Not enough stock left.'; END IF;
  _total := round(_p.price_usd * _quantity, 2);
  SELECT balance_usd INTO _bal FROM public.user_balances WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal,0) < _total THEN RAISE EXCEPTION 'Not enough wallet balance. Top up your wallet first.'; END IF;
  INSERT INTO public.orders (user_id, product_id, product_name, kind, quantity, unit_price_usd, total_usd, status, payment_provider, paid_at)
  VALUES (_uid, _p.id, _p.name, 'product', _quantity, _p.price_usd, _total, 'paid', 'balance', now())
  RETURNING id INTO _id;
  PERFORM public._credit_balance(_uid, -_total, 'purchase', _p.name, _id);
  PERFORM public.deliver_order(_id);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_refund_order(_order_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _o public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status NOT IN ('paid','delivered') THEN RAISE EXCEPTION 'Only paid orders can be refunded.'; END IF;
  IF _o.kind = 'topup' THEN RAISE EXCEPTION 'Top-ups cannot be refunded to the wallet.'; END IF;
  UPDATE public.orders SET status = 'refunded' WHERE id = _order_id;
  PERFORM public._credit_balance(_o.user_id, _o.total_usd, 'refund', _o.order_code, _o.id);
  RETURN 'refunded';
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user uuid, _amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public._credit_balance(_user, _amount, 'adjustment', _note, NULL);
END $$;

CREATE POLICY "banners public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-banners');
CREATE POLICY "admins upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-banners' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-banners' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-banners' AND public.has_role(auth.uid(),'admin'));