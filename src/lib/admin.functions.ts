import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orders, products, stock, users, unread] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id,order_code,product_name,quantity,total_usd,status,created_at,tx_hash")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("stock_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "available"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender", "user")
        .eq("read_by_admin", false),
    ]);

    const rows = (orders.data ?? []).map((o) => ({ ...o, total_usd: Number(o.total_usd) }));
    const revenue = rows
      .filter((o) => o.status === "delivered" || o.status === "paid")
      .reduce((sum, o) => sum + o.total_usd, 0);

    return {
      orders: rows,
      revenue,
      orderCount: rows.length,
      productCount: products.count ?? 0,
      availableStock: stock.count ?? 0,
      userCount: users.count ?? 0,
      unreadSupport: unread.count ?? 0,
    };
  });

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: products }, { data: stock }] = await Promise.all([
      supabaseAdmin.from("products").select("*").order("sort_order"),
      supabaseAdmin.from("stock_items").select("product_id,status"),
    ]);
    const counts = new Map<string, { available: number; sold: number }>();
    for (const s of stock ?? []) {
      const entry = counts.get(s.product_id) ?? { available: 0, sold: 0 };
      if (s.status === "available") entry.available += 1;
      else entry.sold += 1;
      counts.set(s.product_id, entry);
    }
    return (products ?? []).map((p) => ({
      ...p,
      price_usd: Number(p.price_usd),
      available: counts.get(p.id)?.available ?? 0,
      sold: counts.get(p.id)?.sold ?? 0,
    }));
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      name: string;
      slug: string;
      subtitle?: string;
      description?: string;
      category?: string;
      price_usd: number;
      icon_letter?: string;
      accent?: string;
      is_active?: boolean;
      sort_order?: number;
    }) => {
      if (!data.name?.trim()) throw new Error("Product name is required.");
      if (!data.slug?.trim()) throw new Error("Product link name is required.");
      if (!(Number(data.price_usd) >= 0)) throw new Error("Price must be zero or more.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      name: data.name.trim(),
      slug: data.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      subtitle: data.subtitle?.trim() || null,
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      price_usd: Number(data.price_usd),
      icon_letter: (data.icon_letter || data.name.trim()[0] || "A").slice(0, 1).toUpperCase(),
      accent: data.accent || "cyan",
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("products").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; raw: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lines = data.raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^(index|username|email)\s*[,:]/i.test(l));
    if (lines.length === 0) throw new Error("No account lines found.");
    const { error } = await supabaseAdmin
      .from("stock_items")
      .insert(lines.map((payload) => ({ product_id: data.productId, payload })));
    if (error) throw new Error(error.message);
    return { added: lines.length };
  });

export const adminListStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("stock_items")
      .select("id,payload,status,created_at,sold_at")
      .eq("product_id", data.productId)
      .order("created_at")
      .limit(500);
    return rows ?? [];
  });

export const adminDeleteStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("stock_items")
      .delete()
      .eq("id", data.id)
      .eq("status", "available");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; action: "approve" | "reject" | "refund" }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "approve") {
      await supabaseAdmin
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", data.id);
      await supabaseAdmin.rpc("deliver_order", { _order_id: data.id });
    } else {
      await supabaseAdmin
        .from("orders")
        .update({ status: data.action === "reject" ? "cancelled" : "refunded" })
        .eq("id", data.id);
    }
    const { data: fresh } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    return { status: fresh?.status ?? "unknown" };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: orders }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,display_name,is_blocked,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("orders").select("user_id,total_usd,status"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    const spendMap = new Map<string, { spend: number; orders: number }>();
    for (const o of orders ?? []) {
      const entry = spendMap.get(o.user_id) ?? { spend: 0, orders: 0 };
      entry.orders += 1;
      if (o.status === "delivered" || o.status === "paid") entry.spend += Number(o.total_usd);
      spendMap.set(o.user_id, entry);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      spend: spendMap.get(p.id)?.spend ?? 0,
      orders: spendMap.get(p.id)?.orders ?? 0,
    }));
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; blocked?: boolean; makeAdmin?: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (typeof data.blocked === "boolean") {
      await supabaseAdmin
        .from("profiles")
        .update({ is_blocked: data.blocked })
        .eq("id", data.userId);
    }
    if (typeof data.makeAdmin === "boolean") {
      if (data.makeAdmin) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        if (data.userId === context.userId) throw new Error("You cannot remove your own access.");
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
      }
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: wallets }] = await Promise.all([
      supabaseAdmin.from("site_settings").select("*").maybeSingle(),
      supabaseAdmin.from("payment_wallets").select("*").order("sort_order"),
    ]);
    const explorerKeyPresent = Boolean(process.env["ETHERSCAN_API_KEY"]);
    return { settings, wallets: wallets ?? [], explorerKeyPresent };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      store_name: string;
      heading: string;
      tagline: string;
      footer_note: string;
      support_email?: string;
      telegram_handle?: string;
      support_hours?: string;
      payment_window_minutes: number;
      auto_deliver: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({
        store_name: data.store_name,
        heading: data.heading,
        tagline: data.tagline,
        footer_note: data.footer_note,
        support_email: data.support_email || null,
        telegram_handle: data.telegram_handle?.replace(/^@/, "") || null,
        support_hours: data.support_hours || null,
        payment_window_minutes: Math.max(10, Math.min(1440, Number(data.payment_window_minutes))),
        auto_deliver: data.auto_deliver,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      label: string;
      chain: string;
      asset: string;
      contract_address?: string;
      decimals: number;
      address: string;
      is_active: boolean;
      sort_order?: number;
    }) => {
      if (!data.label?.trim()) throw new Error("Give this payment option a name.");
      if (data.is_active && !data.address?.trim()) {
        throw new Error("Add a wallet address before turning this option on.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      label: data.label.trim(),
      chain: data.chain.trim().toLowerCase(),
      asset: data.asset.trim().toUpperCase(),
      contract_address: data.contract_address?.trim() || null,
      decimals: Number(data.decimals) || 6,
      address: data.address.trim(),
      is_active: data.is_active,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("payment_wallets").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("payment_wallets")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const adminDeleteWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_wallets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListSupportThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: messages }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("support_messages")
        .select("id,user_id,sender,body,created_at,read_by_admin")
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("profiles").select("id,email,display_name"),
    ]);
    const nameMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name || p.email || "Customer"]),
    );
    const threads = new Map<
      string,
      { userId: string; name: string; unread: number; messages: typeof messages }
    >();
    for (const m of messages ?? []) {
      const t = threads.get(m.user_id) ?? {
        userId: m.user_id,
        name: nameMap.get(m.user_id) ?? "Customer",
        unread: 0,
        messages: [],
      };
      t.messages!.push(m);
      if (m.sender === "user" && !m.read_by_admin) t.unread += 1;
      threads.set(m.user_id, t);
    }
    return Array.from(threads.values());
  });

export const adminReplySupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; body: string }) => {
    if (!data.body?.trim()) throw new Error("Write a reply first.");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("support_messages")
      .insert({ user_id: data.userId, sender: "admin", body: data.body.trim(), read_by_admin: true });
    await supabaseAdmin
      .from("support_messages")
      .update({ read_by_admin: true })
      .eq("user_id", data.userId)
      .eq("sender", "user");
    return { ok: true };
  });
