-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  category text,
  price_usd numeric(12,2) NOT NULL DEFAULT 0,
  icon_letter text NOT NULL DEFAULT 'A',
  accent text NOT NULL DEFAULT 'cyan',
  credential_format text NOT NULL DEFAULT 'email:password',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active products public" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "admins read all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- STOCK
CREATE TYPE public.stock_status AS ENUM ('available', 'sold');

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payload text NOT NULL,
  status public.stock_status NOT NULL DEFAULT 'available',
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz
);
CREATE INDEX stock_items_pick_idx ON public.stock_items (product_id, status, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage stock" ON public.stock_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- public stock counts without exposing payloads
CREATE OR REPLACE VIEW public.product_stock_counts
WITH (security_invoker = off) AS
SELECT p.id AS product_id, count(s.id) FILTER (WHERE s.status = 'available') AS available
FROM public.products p
LEFT JOIN public.stock_items s ON s.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id;
GRANT SELECT ON public.product_stock_counts TO anon, authenticated;

-- ORDERS
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'delivered', 'cancelled', 'refunded', 'failed');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE DEFAULT 'KR-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 100000))::text, 5, '0'),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_usd numeric(12,2) NOT NULL,
  total_usd numeric(12,2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_provider text NOT NULL DEFAULT 'nowpayments',
  payment_id text,
  pay_currency text,
  pay_amount numeric(24,8),
  pay_address text,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  delivered_at timestamptz
);
CREATE INDEX orders_user_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX orders_payment_idx ON public.orders (payment_id);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payload text NOT NULL,
  stock_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items read" ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "admins read order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SITE SETTINGS
CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  store_name text NOT NULL DEFAULT 'Keyvault',
  tagline text NOT NULL DEFAULT 'Instant digital-credential delivery. USD pricing, paid over crypto rails.',
  heading text NOT NULL DEFAULT 'Fresh keys, ready to ship',
  footer_note text NOT NULL DEFAULT 'credentials released on payment confirmation · no resale',
  support_email text,
  accepted_coins text NOT NULL DEFAULT 'btc,eth,usdttrc20,usdterc20,ltc',
  auto_deliver boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_settings (id) VALUES (true);

-- DELIVERY
CREATE OR REPLACE FUNCTION public.deliver_order(_order_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o public.orders;
  _picked uuid[];
  _count int;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _o.id IS NULL THEN RETURN 0; END IF;
  IF _o.status = 'delivered' THEN RETURN 0; END IF;

  SELECT array_agg(id) INTO _picked FROM (
    SELECT id FROM public.stock_items
    WHERE product_id = _o.product_id AND status = 'available'
    ORDER BY created_at
    LIMIT _o.quantity
    FOR UPDATE SKIP LOCKED
  ) q;

  _count := COALESCE(array_length(_picked, 1), 0);
  IF _count = 0 THEN
    UPDATE public.orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = _order_id;
    RETURN 0;
  END IF;

  INSERT INTO public.order_items (order_id, payload, stock_item_id)
  SELECT _order_id, s.payload, s.id FROM public.stock_items s WHERE s.id = ANY(_picked);

  UPDATE public.stock_items SET status = 'sold', order_id = _order_id, sold_at = now() WHERE id = ANY(_picked);

  IF _count >= _o.quantity THEN
    UPDATE public.orders SET status = 'delivered', paid_at = COALESCE(paid_at, now()), delivered_at = now() WHERE id = _order_id;
  ELSE
    UPDATE public.orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = _order_id;
  END IF;

  RETURN _count;
END;
$$;

-- SEED PRODUCTS
INSERT INTO public.products (name, slug, subtitle, description, category, price_usd, icon_letter, accent, sort_order) VALUES
('GitHub Pro', 'github-pro', 'github.com · annual', 'Private repos, Copilot access and advanced insights for one year.', 'Developer', 165.00, 'G', 'cyan', 1),
('Figma Professional', 'figma-professional', 'figma.com · 1 year', 'Unlimited files, shared libraries and dev mode for a full year.', 'Design', 144.00, 'F', 'teal', 2),
('Notion Plus', 'notion-plus', 'notion.so · annual', 'Unlimited blocks, guests and version history on a Plus seat.', 'Productivity', 96.00, 'N', 'amber', 3),
('Adobe Creative Cloud', 'adobe-creative-cloud', 'all apps · 12 mo', 'Full Creative Cloud suite with 100GB storage for twelve months.', 'Design', 594.00, 'A', 'teal', 4),
('Docker Desktop Pro', 'docker-desktop-pro', 'docker.com · team seat', 'Pro seat with unlimited pulls and Scout analysis.', 'Developer', 216.00, 'D', 'cyan', 5),
('JetBrains All Products', 'jetbrains-all-products', 'jetbrains.com · 13 mo', 'Every JetBrains IDE on one key for thirteen months.', 'Developer', 139.00, 'J', 'cyan', 6);

INSERT INTO public.stock_items (product_id, payload)
SELECT p.id, p.slug || '_' || lpad(g::text, 3, '0') || '@mail.example:Vlt!' || upper(substr(md5(random()::text), 1, 8))
FROM public.products p
CROSS JOIN generate_series(1, 12) g
WHERE p.slug <> 'jetbrains-all-products';
