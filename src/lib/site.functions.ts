import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SiteChrome = {
  store_name: string;
  footer_note: string;
  support_email: string | null;
  telegram_handle: string | null;
  support_hours: string | null;
};

export const getSiteChrome = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteChrome> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

    const { data } = await supabase
      .from("site_settings")
      .select("store_name,footer_note,support_email,telegram_handle,support_hours")
      .maybeSingle();

    return (
      data ?? {
        store_name: "515Store",
        footer_note: "credentials released on payment confirmation",
        support_email: null,
        telegram_handle: null,
        support_hours: null,
      }
    );
  },
);
