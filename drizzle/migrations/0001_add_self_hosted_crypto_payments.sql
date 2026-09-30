CREATE TABLE public.payment_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  chain text NOT NULL,
  asset text NOT NULL,
  contract_address text,
  decimals int NOT NULL DEFAULT 6,
  address text NOT NULL,
  min_confirmations int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_wallets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_wallets TO authenticated;
GRANT ALL ON public.payment_wallets TO service_role;
ALTER TABLE public.payment_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active wallets public" ON public.payment_wallets FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "admins manage wallets" ON public.payment_wallets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD COLUMN payment_wallet_id uuid REFERENCES public.payment_wallets(id) ON DELETE SET NULL,
  ADD COLUMN expected_amount numeric(24,8),
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN tx_hash text,
  ADD COLUMN last_checked_at timestamptz;

ALTER TABLE public.orders ALTER COLUMN payment_provider SET DEFAULT 'self-hosted';
CREATE UNIQUE INDEX orders_tx_hash_uniq ON public.orders (tx_hash) WHERE tx_hash IS NOT NULL;

ALTER TABLE public.site_settings
  ADD COLUMN payment_window_minutes int NOT NULL DEFAULT 60;

INSERT INTO public.payment_wallets (label, chain, asset, contract_address, decimals, address, sort_order, is_active) VALUES
('USDT · BNB Smart Chain (BEP20)', 'bsc', 'USDT', '0x55d398326f99059ff775485246999027b3197955', 18, '', 1, false),
('USDT · TRON (TRC20)', 'tron', 'USDT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, '', 2, false),
('TRX · TRON', 'tron', 'TRX', NULL, 6, '', 3, false),
('BNB · BNB Smart Chain', 'bsc', 'BNB', NULL, 18, '', 4, false);
