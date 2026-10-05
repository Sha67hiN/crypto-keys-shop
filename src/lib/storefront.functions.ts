import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  price_usd: number;
  icon_letter: string;
  accent: string;
  banner_url: string | null;
  stock: number;
};

async function signBanners<T extends { banner_url: string | null }>(supabase: ReturnType<typeof publicClient>, rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.banner_url).filter((p): p is string => !!p && !p.startsWith("http"));
  if (paths.length === 0) return rows;
  const { data } = await supabase.storage.from("product-banners").createSignedUrls(paths, 60 * 60 * 24 * 7);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => (r.banner_url && map.has(r.banner_url) ? { ...r, banner_url: map.get(r.banner_url)! } : r));
}

export type StoreSettings = {
  store_name: string;
  tagline: string;
  heading: string;
  footer_note: string;
  support_email: string | null;
};

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [{ data: products }, { data: counts }, { data: settings }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,slug,subtitle,description,category,price_usd,icon_letter,accent,banner_url")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("product_stock_counts").select("product_id,available"),
    supabase
      .from("site_settings")
      .select("store_name,tagline,heading,footer_note,support_email")
      .maybeSingle(),
  ]);

  const stockMap = new Map((counts ?? []).map((c) => [c.product_id, Number(c.available ?? 0)]));

  const list: StoreProduct[] = (products ?? []).map((p) => ({
    ...p,
    price_usd: Number(p.price_usd),
    stock: stockMap.get(p.id) ?? 0,
  }));

  const site: StoreSettings = settings ?? {
    store_name: "Keyvault",
    tagline: "Instant digital-credential delivery.",
    heading: "Fresh keys, ready to ship",
    footer_note: "credentials released on payment confirmation",
    support_email: null,
  };

  return { products: await signBanners(supabase, list), settings: site };
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: product } = await supabase
      .from("products")
      .select("id,name,slug,subtitle,description,category,price_usd,icon_letter,accent,banner_url")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!product) return null;

    const [{ data: count }, { data: wallets }, { data: settings }] = await Promise.all([
      supabase
        .from("product_stock_counts")
        .select("available")
        .eq("product_id", product.id)
        .maybeSingle(),
      supabase
        .from("payment_wallets")
        .select("id,label,chain,asset,address")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("site_settings").select("store_name,payment_window_minutes").maybeSingle(),
    ]);

    const signed = (await signBanners(supabase, [product]))[0] ?? product;
    return {
      product: {
        ...signed,
        price_usd: Number(product.price_usd),
        stock: Number(count?.available ?? 0),
      },
      wallets: (wallets ?? []).filter((w) => w.address.length > 0),
      storeName: settings?.store_name ?? "Keyvault",
      windowMinutes: settings?.payment_window_minutes ?? 60,
    };
  });
