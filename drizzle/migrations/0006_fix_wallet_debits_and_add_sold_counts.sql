CREATE OR REPLACE FUNCTION public._credit_balance(_user uuid, _amount numeric, _kind text, _note text, _order uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_balances
  SET balance_usd = balance_usd + _amount,
      updated_at = now()
  WHERE user_id = _user;

  IF NOT FOUND THEN
    IF _amount < 0 THEN
      RAISE EXCEPTION 'Not enough wallet balance. Top up your wallet first.';
    END IF;
    INSERT INTO public.user_balances (user_id, balance_usd)
    VALUES (_user, _amount);
  END IF;

  INSERT INTO public.balance_transactions (user_id, amount_usd, kind, note, order_id)
  VALUES (_user, _amount, _kind, _note, _order);
END
$function$;

CREATE OR REPLACE VIEW public.product_stock_counts AS
SELECT
  p.id AS product_id,
  count(s.id) FILTER (WHERE s.status = 'available'::public.stock_status) AS available,
  count(s.id) FILTER (WHERE s.status = 'sold'::public.stock_status) AS sold
FROM public.products p
LEFT JOIN public.stock_items s ON s.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id;

GRANT SELECT ON public.product_stock_counts TO anon, authenticated;
GRANT ALL ON public.product_stock_counts TO service_role;