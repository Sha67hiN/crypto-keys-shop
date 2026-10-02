CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS private.server_key (id int PRIMARY KEY DEFAULT 1, key_hash text NOT NULL);

CREATE OR REPLACE FUNCTION public.set_server_key_hash(_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO private.server_key (id, key_hash) VALUES (1, _hash)
  ON CONFLICT (id) DO UPDATE SET key_hash = EXCLUDED.key_hash;
END $$;

CREATE OR REPLACE FUNCTION public._check_server_key(_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.server_key WHERE id = 1 AND key_hash = _hash) THEN
    RAISE EXCEPTION 'Checkout is not ready yet. The store owner needs to open the dashboard once.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.available_stock(_product_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.stock_items WHERE product_id = _product_id AND status = 'available'
$$;

CREATE OR REPLACE FUNCTION public.server_place_order(_key text, _product_id uuid, _quantity int, _wallet_id uuid, _total_usd numeric, _unit_price numeric, _expected numeric, _window_minutes int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.products; _w public.payment_wallets; _id uuid;
BEGIN
  PERFORM public._check_server_key(_key);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  SELECT * INTO _w FROM public.payment_wallets WHERE id = _wallet_id AND is_active;
  IF _p.id IS NULL OR _w.id IS NULL THEN RAISE EXCEPTION 'Not available'; END IF;
  INSERT INTO public.orders (user_id, product_id, product_name, quantity, unit_price_usd, total_usd, payment_provider, payment_wallet_id, pay_currency, pay_amount, expected_amount, pay_address, expires_at)
  VALUES (auth.uid(), _p.id, _p.name, _quantity, _unit_price, _total_usd, 'self-hosted', _w.id, _w.asset, _expected, _expected, _w.address, now() + make_interval(mins => _window_minutes))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.server_order_update(_key text, _order_id uuid, _action text, _tx_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  PERFORM public._check_server_key(_key);
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _action = 'expire' THEN
    UPDATE public.orders SET status = 'failed' WHERE id = _order_id AND status = 'pending';
  ELSIF _action = 'checked' THEN
    UPDATE public.orders SET last_checked_at = now() WHERE id = _order_id;
  ELSIF _action = 'paid' THEN
    UPDATE public.orders SET status = 'paid', paid_at = now(), tx_hash = _tx_hash WHERE id = _order_id AND status = 'pending';
    PERFORM public.deliver_order(_order_id);
  ELSIF _action = 'deliver' THEN
    PERFORM public.deliver_order(_order_id) FROM public.orders WHERE id = _order_id AND status = 'paid';
  END IF;
  SELECT status::text INTO _s FROM public.orders WHERE id = _order_id;
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.tx_hash_used(_hashes text[]) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(tx_hash), '{}') FROM public.orders WHERE tx_hash = ANY(_hashes)
$$;

REVOKE EXECUTE ON FUNCTION public.deliver_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._check_server_key(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_server_key_hash(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.server_place_order(text,uuid,int,uuid,numeric,numeric,numeric,int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.server_order_update(text,uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_hash_used(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.available_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_server_key_hash(text), public.server_place_order(text,uuid,int,uuid,numeric,numeric,numeric,int), public.server_order_update(text,uuid,text,text), public.tx_hash_used(text[]), public.available_stock(uuid) TO authenticated;