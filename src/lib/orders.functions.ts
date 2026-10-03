import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyOrder = {
  id: string;
  order_code: string;
  product_name: string;
  quantity: number;
  total_usd: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  credentials: string[];
};

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrder[]> => {
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select("id,order_code,product_name,quantity,total_usd,status,created_at,expires_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await context.supabase.from("order_items").select("order_id,payload").in("order_id", ids)
      : { data: [] };

    const byOrder = new Map<string, string[]>();
    for (const item of items ?? []) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(item.payload);
      byOrder.set(item.order_id, list);
    }

    return (orders ?? []).map((o) => ({
      ...o,
      total_usd: Number(o.total_usd),
      credentials: byOrder.get(o.id) ?? [],
    }));
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;

    const [{ data: items }, { data: wallet }] = await Promise.all([
      context.supabase.from("order_items").select("payload").eq("order_id", order.id),
      order.payment_wallet_id
        ? context.supabase
            .from("payment_wallets")
            .select("label,chain,asset,address")
            .eq("id", order.payment_wallet_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      order: {
        ...order,
        total_usd: Number(order.total_usd),
        unit_price_usd: Number(order.unit_price_usd),
        expected_amount: order.expected_amount === null ? null : Number(order.expected_amount),
      },
      wallet,
      credentials: (items ?? []).map((i) => i.payload),
    };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; quantity: number; walletId: string }) => {
    const quantity = Math.floor(Number(data.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      throw new Error("Choose a quantity between 1 and 50.");
    }
    if (!data.productId || !data.walletId) throw new Error("Missing product or payment network.");
    return { productId: data.productId, quantity, walletId: data.walletId };
  })
  .handler(async ({ data, context }) => {
    const { getUsdPrice } = await import("./chain.server");
    const supabaseAdmin = context.supabase;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_blocked")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.is_blocked) throw new Error("This account cannot place orders.");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id,name,price_usd,is_active")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product || !product.is_active) throw new Error("That product is not available.");

    const { count: stock } = await supabaseAdmin
      .from("stock_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("status", "available");
    if ((stock ?? 0) < data.quantity) {
      throw new Error(`Only ${stock ?? 0} left in stock for ${product.name}.`);
    }

    const { data: wallet } = await supabaseAdmin
      .from("payment_wallets")
      .select("*")
      .eq("id", data.walletId)
      .eq("is_active", true)
      .maybeSingle();
    if (!wallet || !wallet.address) throw new Error("That payment network is not available.");

    const { data: settings } = await supabaseAdmin
      .from("site_settings")
      .select("payment_window_minutes")
      .maybeSingle();
    const windowMinutes = settings?.payment_window_minutes ?? 60;

    const unitPrice = Number(product.price_usd);
    const totalUsd = Number((unitPrice * data.quantity).toFixed(2));
    const price = await getUsdPrice(wallet.asset);

    // A tiny unique tail makes each pending payment individually identifiable
    // on-chain, so incoming transfers can be matched without any provider.
    const base = totalUsd / price;
    const tail = (Math.floor(Math.random() * 9000) + 1000) / 1e6;
    const expected = Number((base + tail).toFixed(6));

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        product_id: product.id,
        product_name: product.name,
        quantity: data.quantity,
        unit_price_usd: unitPrice,
        total_usd: totalUsd,
        payment_provider: "self-hosted",
        payment_wallet_id: wallet.id,
        pay_currency: wallet.asset,
        pay_amount: expected,
        expected_amount: expected,
        pay_address: wallet.address,
        expires_at: new Date(Date.now() + windowMinutes * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { orderId: order.id };
  });

export const checkOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const { fetchIncomingTransfers } = await import("./chain.server");
    const supabaseAdmin = context.supabase;

    const { data: order } = await context.supabase
      .from("orders")
      .select("id,status,expected_amount,payment_wallet_id,created_at,expires_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status === "delivered") return { status: "delivered" as const, matched: true };

    if (order.status === "pending" && order.expires_at && new Date(order.expires_at) < new Date()) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return { status: "failed" as const, matched: false };
    }

    if (order.status === "paid") {
      await supabaseAdmin.rpc("deliver_order", { _order_id: order.id });
      const { data: fresh } = await supabaseAdmin
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .maybeSingle();
      return { status: (fresh?.status ?? "paid") as string, matched: true };
    }

    if (!order.payment_wallet_id || order.expected_amount === null) {
      throw new Error("This order has no payment details.");
    }

    const { data: wallet } = await supabaseAdmin
      .from("payment_wallets")
      .select("chain,asset,contract_address,decimals,address")
      .eq("id", order.payment_wallet_id)
      .maybeSingle();
    if (!wallet) throw new Error("Payment network is no longer configured.");

    const sinceMs = new Date(order.created_at).getTime() - 10 * 60_000;
    const transfers = await fetchIncomingTransfers(wallet, sinceMs);

    await supabaseAdmin
      .from("orders")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", order.id);

    if (transfers.length === 0) return { status: "pending" as const, matched: false };

    const hashes = transfers.map((t) => t.hash);
    const { data: used } = await supabaseAdmin
      .from("orders")
      .select("tx_hash")
      .in("tx_hash", hashes);
    const usedSet = new Set((used ?? []).map((u) => u.tx_hash));

    const expected = Number(order.expected_amount);
    const match = transfers.find(
      (t) => !usedSet.has(t.hash) && t.amount >= expected * 0.999 && t.amount < expected * 1.5,
    );
    if (!match) return { status: "pending" as const, matched: false };

    const { error: claimError } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), tx_hash: match.hash })
      .eq("id", order.id)
      .eq("status", "pending");
    if (claimError) return { status: "pending" as const, matched: false };

    await supabaseAdmin.rpc("deliver_order", { _order_id: order.id });
    const { data: fresh } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .maybeSingle();

    return { status: (fresh?.status ?? "paid") as string, matched: true };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_admin");
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data) };
  });
