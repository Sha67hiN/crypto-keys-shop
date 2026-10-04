import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createTopup, getMyWallet } from "@/lib/wallet.functions";
import { ActionButton, FieldLabel, Panel, TextField } from "@/components/site/Pieces";
import { CryptoLogo } from "@/components/site/CryptoLogo";
import { usd } from "@/lib/store-format";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "My Wallet · Keyvault" },
      { name: "description", content: "Top up your balance with crypto and pay instantly." },
      { property: "og:title", content: "My Wallet · Keyvault" },
      { property: "og:description", content: "Top up your balance with crypto and pay instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const kindLabel: Record<string, string> = { topup: "Top-up", purchase: "Purchase", refund: "Refund", adjustment: "Adjustment" };

function WalletPage() {
  const fetchWallet = useServerFn(getMyWallet);
  const topup = useServerFn(createTopup);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["my-wallet"], queryFn: () => fetchWallet() });
  const [amount, setAmount] = useState("10");
  const [walletId, setWalletId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <p className="py-10 text-fog">Loading…</p>;
  const selected = walletId || data.wallets[0]?.id || "";

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const n = Number(amount.replace(",", ".").replace(/[^0-9.]/g, ""));
      const res = await topup({ data: { amountUsd: n, walletId: selected } });
      navigate({ to: "/orders/$orderId", params: { orderId: res.orderId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start top-up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-reveal grid gap-6 py-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <Panel>
          <p className="label-mono">Wallet balance</p>
          <p className="mt-2 text-4xl font-semibold text-snow">{usd(data.balance)}</p>
          <p className="mt-1 text-sm text-fog">Use it to buy instantly. Refunds come back here.</p>
        </Panel>
        <Panel className="space-y-2">
          <p className="label-mono">History</p>
          {data.transactions.length === 0 && <p className="text-sm text-fog">No activity yet.</p>}
          {data.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-t border-snow/10 pt-2 text-sm">
              <div>
                <p className="text-snow">{kindLabel[t.kind] ?? t.kind}{t.note ? ` · ${t.note}` : ""}</p>
                <p className="font-mono text-[11px] text-fog">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <span className={t.amount_usd >= 0 ? "font-mono text-cyan" : "font-mono text-rose"}>
                {t.amount_usd >= 0 ? "+" : "−"}{usd(Math.abs(t.amount_usd))}
              </span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel className="h-fit space-y-4">
        <p className="font-semibold text-snow">Top up with crypto</p>
        <div>
          <FieldLabel>Amount (USD)</FieldLabel>
          <TextField value={amount} onChange={setAmount} />
        </div>
        <div>
          <FieldLabel>Pay with</FieldLabel>
          {data.wallets.length === 0 ? (
            <p className="text-sm text-amber">No payment options are set up yet.</p>
          ) : (
            <div className="grid gap-2">
              {data.wallets.map((w) => (
                <button key={w.id} onClick={() => setWalletId(w.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ring-1 ${selected === w.id ? "bg-cyan/10 text-snow ring-cyan/40" : "text-fog ring-snow/10"}`}>
                  <CryptoLogo asset={w.asset} chain={w.chain} size={24} />
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-rose">{error}</p>}
        <ActionButton className="w-full" onClick={start} disabled={busy || !selected}>
          {busy ? "Creating…" : "Continue to payment"}
        </ActionButton>
      </Panel>
    </div>
  );
}
