import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as A from "@/lib/admin.functions";
import { claimAdmin } from "@/lib/orders.functions";
import { useSession } from "@/hooks/useSession";
import { ActionButton, FieldLabel, Panel, Pill, StatCard, TextField, statusTone } from "@/components/site/Pieces";
import { usd } from "@/lib/store-format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard · Keyvault" },
      { name: "description", content: "Manage products, stock, orders, users and settings." },
      { property: "og:title", content: "Dashboard · Keyvault" },
      { property: "og:description", content: "Store owner dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const tabs = ["Overview", "Products", "Users", "Payments", "Settings", "Support"] as const;
type Tab = (typeof tabs)[number];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function AdminPage() {
  const { isAdmin, loading, refreshRole } = useSession();
  const claim = useServerFn(claimAdmin);
  const [tab, setTab] = useState<Tab>("Overview");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  if (loading) return <p className="py-10 text-fog">Loading…</p>;
  if (!isAdmin)
    return (
      <Panel className="mx-auto mt-10 max-w-md space-y-3 text-center">
        <p className="text-snow">You're not the store owner.</p>
        <p className="text-sm text-fog">If nobody has claimed this store yet, the first person to click below becomes the owner.</p>
        <ActionButton
          onClick={async () => {
            const r = await claim();
            if (r.isAdmin) await refreshRole();
            else setClaimMsg("This store already has an owner.");
          }}
        >
          Claim owner access
        </ActionButton>
        {claimMsg && <p className="text-sm text-rose">{claimMsg}</p>}
      </Panel>
    );

  return (
    <div className="animate-reveal space-y-5 py-8">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("rounded-md px-3 py-1.5 text-sm", tab === t ? "bg-snow/10 text-snow ring-1 ring-snow/15" : "text-fog hover:text-snow")}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && <Overview />}
      {tab === "Products" && <Products />}
      {tab === "Users" && <Users />}
      {tab === "Payments" && <Payments />}
      {tab === "Settings" && <Settings />}
      {tab === "Support" && <Support />}
    </div>
  );
}

function Overview() {
  const fn = useServerFn(A.getAdminOverview);
  const upd = useServerFn(A.adminUpdateOrder);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });
  if (!data) return <p className="text-fog">Loading…</p>;
  async function act(id: string, action: "approve" | "reject" | "refund") {
    try {
      await upd({ data: { id, action } });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      alert(errMsg(e));
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Revenue" value={usd(data.revenue)} />
        <StatCard label="Orders" value={data.orderCount} hint="last 50" />
        <StatCard label="Products" value={data.productCount} />
        <StatCard label="Stock left" value={data.availableStock} />
        <StatCard label="Users" value={data.userCount} hint={`${data.unreadSupport} unread chats`} />
      </div>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="label-mono text-left">
            <tr><th className="p-3">Order</th><th>Product</th><th>Total</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} className="border-t border-snow/10 text-snow">
                <td className="p-3 font-mono text-xs">{o.order_code}<br /><span className="text-fog">{new Date(o.created_at).toLocaleString()}</span></td>
                <td>{o.product_name} × {o.quantity}</td>
                <td>{usd(o.total_usd)}</td>
                <td><Pill tone={statusTone(o.status)}>{o.status}</Pill></td>
                <td className="space-x-1 pr-3 text-right">
                  {(o.status === "pending" || o.status === "failed" || o.status === "paid") && (
                    <ActionButton onClick={() => act(o.id, "approve")}>Mark paid & deliver</ActionButton>
                  )}
                  {o.status === "pending" && <ActionButton variant="danger" onClick={() => act(o.id, "reject")}>Cancel</ActionButton>}
                  {o.status === "delivered" && <ActionButton variant="ghost" onClick={() => act(o.id, "refund")}>Refund</ActionButton>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

type ProductForm = { id?: string; name: string; slug: string; subtitle: string; description: string; category: string; price_usd: string; is_active: boolean };
const emptyProduct: ProductForm = { name: "", slug: "", subtitle: "", description: "", category: "", price_usd: "0", is_active: true };

function Products() {
  const list = useServerFn(A.adminListProducts);
  const save = useServerFn(A.adminSaveProduct);
  const del = useServerFn(A.adminDeleteProduct);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const [form, setForm] = useState<ProductForm | null>(null);
  const [stockFor, setStockFor] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-products"] });

  return (
    <div className="space-y-4">
      <ActionButton onClick={() => setForm(emptyProduct)}>+ New product</ActionButton>
      {form && (
        <Panel className="grid gap-3 sm:grid-cols-2">
          {(["name", "slug", "subtitle", "category", "price_usd"] as const).map((k) => (
            <div key={k}>
              <FieldLabel>{k === "price_usd" ? "Price (USD)" : k === "slug" ? "Link name" : k}</FieldLabel>
              <TextField value={form[k]} onChange={(v) => setForm({ ...form, [k]: v })} />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-snow">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible in store
          </label>
          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg bg-panel/60 p-3 text-sm text-snow ring-1 ring-snow/10" />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <ActionButton
              onClick={async () => {
                try {
                  const price = Number(form.price_usd.replace(",", ".").replace(/[^0-9.]/g, ""));
                  if (!Number.isFinite(price) || form.price_usd.trim() === "") throw new Error("Enter a price like 0.75 or 1.45");
                  await save({ data: { ...form, slug: form.slug || form.name, price_usd: Math.round(price * 100) / 100 } });
                  setForm(null);
                  refresh();
                } catch (e) { alert(errMsg(e)); }
              }}
            >Save</ActionButton>
            <ActionButton variant="ghost" onClick={() => setForm(null)}>Cancel</ActionButton>
          </div>
        </Panel>
      )}
      {data?.map((p) => (
        <Panel key={p.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-snow">{p.name} <span className="font-normal text-fog">· {usd(p.price_usd)}</span></p>
              <p className="font-mono text-xs text-fog">{p.available} available · {p.sold} sold {p.is_active ? "" : "· hidden"}</p>
            </div>
            <div className="flex gap-1">
              <ActionButton variant="ghost" onClick={() => setStockFor(stockFor === p.id ? null : p.id)}>Stock</ActionButton>
              <ActionButton variant="ghost" onClick={() => setForm({ id: p.id, name: p.name, slug: p.slug, subtitle: p.subtitle ?? "", description: p.description ?? "", category: p.category ?? "", price_usd: String(p.price_usd), is_active: p.is_active })}>Edit</ActionButton>
              <ActionButton variant="danger" onClick={async () => { if (confirm("Delete this product?")) { try { await del({ data: { id: p.id } }); refresh(); } catch (e) { alert(errMsg(e)); } } }}>Delete</ActionButton>
            </div>
          </div>
          {stockFor === p.id && <StockManager productId={p.id} onChange={refresh} />}
        </Panel>
      ))}
    </div>
  );
}

function csvToLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l, i) => !(i === 0 && /user|email|login/i.test(l) && /pass/i.test(l)))
    .map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "").trim()).filter(Boolean).join(":"))
    .join("\n");
}

function StockManager({ productId, onChange }: { productId: string; onChange: () => void }) {
  const list = useServerFn(A.adminListStock);
  const add = useServerFn(A.adminAddStock);
  const del = useServerFn(A.adminDeleteStock);
  const qc = useQueryClient();
  const key = ["admin-stock", productId];
  const { data } = useQuery({ queryKey: key, queryFn: () => list({ data: { productId } }) });
  const [raw, setRaw] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); onChange(); };

  async function submit(text: string) {
    if (!text.trim()) return;
    try { await add({ data: { productId, raw: text } }); setRaw(""); refresh(); } catch (e) { alert(errMsg(e)); }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Paste accounts — one per line (e.g. email:password)</FieldLabel>
      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={4} className="w-full rounded-lg bg-panel/60 p-3 font-mono text-xs text-snow ring-1 ring-snow/10" />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={() => submit(raw)}>Add accounts</ActionButton>
        <label className="cursor-pointer rounded-lg bg-snow/5 px-3 py-2 font-mono text-xs text-snow ring-1 ring-snow/15">
          Upload .csv / .txt
          <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const t = await f.text();
            await submit(f.name.endsWith(".csv") ? csvToLines(t) : t);
            e.target.value = "";
          }} />
        </label>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {data?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded bg-snow/5 px-2 py-1 font-mono text-xs">
            <span className={s.status === "sold" ? "text-fog line-through" : "text-snow"}>{s.payload}</span>
            {s.status === "available" && <button className="text-rose" onClick={async () => { await del({ data: { id: s.id } }); refresh(); }}>remove</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Users() {
  const list = useServerFn(A.adminListUsers);
  const upd = useServerFn(A.adminUpdateUser);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  async function act(userId: string, patch: { blocked?: boolean; makeAdmin?: boolean }) {
    try { await upd({ data: { userId, ...patch } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); } catch (e) { alert(errMsg(e)); }
  }
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="label-mono text-left"><tr><th className="p-3">User</th><th>Orders</th><th>Spent</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id} className="border-t border-snow/10 text-snow">
              <td className="p-3">{u.email}<br /><span className="font-mono text-[10px] text-fog">joined {new Date(u.created_at).toLocaleDateString()}</span></td>
              <td>{u.orders}</td>
              <td>{usd(u.spend)}</td>
              <td>{u.roles.includes("admin") ? <Pill tone="cyan">owner</Pill> : <Pill>customer</Pill>} {u.is_blocked && <Pill tone="rose">blocked</Pill>}</td>
              <td className="space-x-1 pr-3 text-right">
                <ActionButton variant={u.is_blocked ? "ghost" : "danger"} onClick={() => act(u.id, { blocked: !u.is_blocked })}>{u.is_blocked ? "Unblock" : "Block"}</ActionButton>
                <ActionButton variant="ghost" onClick={() => act(u.id, { makeAdmin: !u.roles.includes("admin") })}>{u.roles.includes("admin") ? "Remove owner" : "Make owner"}</ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

type Wallet = { id?: string; label: string; chain: string; asset: string; contract_address: string | null; decimals: number; address: string; is_active: boolean; sort_order: number };

function Payments() {
  const get = useServerFn(A.adminGetSettings);
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => get() });
  if (!data) return <p className="text-fog">Loading…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-fog">Paste your Trust Wallet receiving address for each network and switch it on. Payments are detected automatically.</p>
      {!data.explorerKeyPresent && <p className="text-sm text-amber">BNB-chain (BEP20) payments need a free block-explorer key before they can be detected automatically. TRON and Bitcoin work without one.</p>}
      {data.wallets.map((w) => <WalletRow key={w.id} wallet={w as Wallet} />)}
      <WalletRow wallet={{ label: "", chain: "tron", asset: "USDT", contract_address: "", decimals: 6, address: "", is_active: false, sort_order: 99 }} isNew />
    </div>
  );
}

function WalletRow({ wallet, isNew }: { wallet: Wallet; isNew?: boolean }) {
  const save = useServerFn(A.adminSaveWallet);
  const del = useServerFn(A.adminDeleteWallet);
  const qc = useQueryClient();
  const [w, setW] = useState(wallet);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-settings"] });
  return (
    <Panel className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <div>
        <FieldLabel>{isNew ? "New option name" : "Name"}</FieldLabel>
        <TextField value={w.label} onChange={(v) => setW({ ...w, label: v })} />
        {isNew && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TextField value={w.chain} onChange={(v) => setW({ ...w, chain: v })} placeholder="chain" />
            <TextField value={w.asset} onChange={(v) => setW({ ...w, asset: v })} placeholder="coin" />
          </div>
        )}
        {!isNew && <p className="mt-1 font-mono text-[10px] text-fog">{w.chain} · {w.asset}</p>}
      </div>
      <div>
        <FieldLabel>Your wallet address</FieldLabel>
        <TextField value={w.address} onChange={(v) => setW({ ...w, address: v })} placeholder="Paste address" />
        <label className="mt-2 flex items-center gap-2 text-sm text-snow">
          <input type="checkbox" checked={w.is_active} onChange={(e) => setW({ ...w, is_active: e.target.checked })} /> Accept payments
        </label>
      </div>
      <div className="flex items-end gap-1">
        <ActionButton onClick={async () => { try { await save({ data: { ...w, contract_address: w.contract_address ?? "" } }); refresh(); if (isNew) setW(wallet); } catch (e) { alert(errMsg(e)); } }}>{isNew ? "Add" : "Save"}</ActionButton>
        {!isNew && <ActionButton variant="danger" onClick={async () => { if (confirm("Remove this payment option?")) { await del({ data: { id: w.id! } }); refresh(); } }}>Remove</ActionButton>}
      </div>
    </Panel>
  );
}

type SettingsForm = { store_name: string; heading: string; tagline: string; footer_note: string; support_email: string; telegram_handle: string; support_hours: string; payment_window_minutes: string };

function Settings() {
  const get = useServerFn(A.adminGetSettings);
  const save = useServerFn(A.adminSaveSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => get() });
  const [f, setF] = useState<SettingsForm>({ store_name: "", heading: "", tagline: "", footer_note: "", support_email: "", telegram_handle: "", support_hours: "", payment_window_minutes: "60" });
  const [auto, setAuto] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    setF({
      store_name: s.store_name, heading: s.heading, tagline: s.tagline, footer_note: s.footer_note,
      support_email: s.support_email ?? "", telegram_handle: s.telegram_handle ?? "", support_hours: s.support_hours ?? "",
      payment_window_minutes: String(s.payment_window_minutes),
    });
    setAuto(s.auto_deliver);
  }, [data]);
  const labels: Record<keyof SettingsForm, string> = {
    store_name: "Store name", heading: "Homepage heading", tagline: "Homepage tagline", footer_note: "Footer note",
    support_email: "Support email", telegram_handle: "Telegram support ID (without @)", support_hours: "Support hours",
    payment_window_minutes: "Minutes customers have to pay",
  };
  return (
    <Panel className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(labels) as (keyof SettingsForm)[]).map((k) => (
        <div key={k}>
          <FieldLabel>{labels[k]}</FieldLabel>
          <TextField value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm text-snow">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Deliver accounts automatically after payment
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <ActionButton onClick={async () => {
          try {
            await save({ data: { store_name: f.store_name, heading: f.heading, tagline: f.tagline, footer_note: f.footer_note, support_email: f.support_email, telegram_handle: f.telegram_handle, support_hours: f.support_hours, payment_window_minutes: Number(f.payment_window_minutes) || 60, auto_deliver: auto } });
            qc.invalidateQueries();
            setMsg("Saved.");
          } catch (e) { setMsg(errMsg(e)); }
        }}>Save settings</ActionButton>
        {msg && <span className="text-sm text-fog">{msg}</span>}
      </div>
    </Panel>
  );
}

function Support() {
  const list = useServerFn(A.adminListSupportThreads);
  const reply = useServerFn(A.adminReplySupport);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-support"], queryFn: () => list(), refetchInterval: 8000 });
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const thread = data?.find((t) => t.userId === active);
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <Panel className="space-y-1 p-2">
        {data?.length === 0 && <p className="p-3 text-sm text-fog">No chats yet.</p>}
        {data?.map((t) => (
          <button key={t.userId} onClick={() => setActive(t.userId)} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm", active === t.userId ? "bg-snow/10 text-snow" : "text-fog hover:text-snow")}>
            <span className="truncate">{t.name}</span>
            {t.unread > 0 && <Pill tone="amber">{t.unread}</Pill>}
          </button>
        ))}
      </Panel>
      <Panel className="flex min-h-[24rem] flex-col">
        {!thread ? <p className="text-sm text-fog">Pick a conversation.</p> : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {thread.messages?.map((m) => (
                <div key={m.id} className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm text-snow", m.sender === "admin" ? "ml-auto bg-cyan/15" : "bg-snow/5")}>{m.body}</div>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim()) return;
              await reply({ data: { userId: thread.userId, body: text } });
              setText("");
              qc.invalidateQueries({ queryKey: ["admin-support"] });
            }}>
              <TextField value={text} onChange={setText} placeholder="Reply…" />
              <ActionButton type="submit">Send</ActionButton>
            </form>
          </>
        )}
      </Panel>
      <p className="font-mono text-[11px] text-fog md:col-span-2">Set your Telegram support ID in <Link to="/admin" className="text-cyan">Settings</Link>.</p>
    </div>
  );
}
