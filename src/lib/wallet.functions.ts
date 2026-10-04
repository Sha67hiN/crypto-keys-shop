import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: bal }, { data: tx }, { data: wallets }] = await Promise.all([
      context.supabase.from("user_balances").select("balance_usd").eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("balance_transactions")
        .select("id,amount_usd,kind,note,created_at,order_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase.from("payment_wallets").select("id,label,chain,asset,address").eq("is_active", true).order("sort_order"),
    ]);
    return {
      balance: Number(bal?.balance_usd ?? 0),
      transactions: (tx ?? []).map((t) => ({ ...t, amount_usd: Number(t.amount_usd) })),
      wallets: (wallets ?? []).filter((w) => w.address.length > 0),
    };
  });

export const createTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amountUsd: number; walletId: string }) => {
    const amount = Math.round(Number(data.amountUsd) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) throw new Error("Top up between $1 and $10,000.");
    if (!data.walletId) throw new Error("Choose a payment network.");
    return { amountUsd: amount, walletId: data.walletId };
  })
  .handler(async ({ data, context }) => {
    const { getUsdPrice } = await import("./chain.server");
    const { serverKeyHash } = await import("./server-key.server");
    const { data: wallet } = await context.supabase
      .from("payment_wallets")
      .select("id,asset,address")
      .eq("id", data.walletId)
      .eq("is_active", true)
      .maybeSingle();
    if (!wallet || !wallet.address) throw new Error("That payment network is not available.");
    const { data: settings } = await context.supabase.from("site_settings").select("payment_window_minutes").maybeSingle();
    const price = await getUsdPrice(wallet.asset);
    const tail = (Math.floor(Math.random() * 9000) + 1000) / 1e6;
    const expected = Number((data.amountUsd / price + tail).toFixed(6));
    const { data: orderId, error } = await context.supabase.rpc("server_place_topup", {
      _key: serverKeyHash(),
      _amount_usd: data.amountUsd,
      _wallet_id: wallet.id,
      _expected: expected,
      _window_minutes: settings?.payment_window_minutes ?? 60,
    });
    if (error) throw new Error(error.message);
    return { orderId: orderId as string };
  });

export const payWithBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; quantity: number }) => ({
    productId: String(data.productId),
    quantity: Math.floor(Number(data.quantity)),
  }))
  .handler(async ({ data, context }) => {
    const { data: orderId, error } = await context.supabase.rpc("pay_with_balance", {
      _product_id: data.productId,
      _quantity: data.quantity,
    });
    if (error) throw new Error(error.message);
    return { orderId: orderId as string };
  });
