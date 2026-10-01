import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProductBySlug } from "@/lib/storefront.functions";
import { createOrder } from "@/lib/orders.functions";
import { useSession } from "@/hooks/useSession";
import { ActionButton, FieldLabel, Panel, Pill, ProductMark, TextField } from "@/components/site/Pieces";
import { usd } from "@/lib/store-format";

const productQuery = (slug: string) =>
  queryOptions({ queryKey: ["product", slug], queryFn: () => getProductBySlug({ data: { slug } }) });

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.product.name, subtitle: data.product.subtitle };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Product"} · Keyvault` },
      { name: "description", content: loaderData?.subtitle ?? "Buy with crypto, instant delivery." },
      { property: "og:title", content: `${loaderData?.name ?? "Product"} · Keyvault` },
      { property: "og:description", content: loaderData?.subtitle ?? "Buy with crypto, instant delivery." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <p className="py-20 text-center text-fog">This product couldn't load.</p>,
  notFoundComponent: () => <p className="py-20 text-center text-fog">Product not found.</p>,
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const { user } = useSession();
  const navigate = useNavigate();
  const create = useServerFn(createOrder);
  const [qty, setQty] = useState("1");
  const [walletId, setWalletId] = useState(data?.wallets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;
  const { product, wallets } = data;
  const q = Math.max(1, Math.floor(Number(qty) || 1));

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await create({ data: { productId: product.id, quantity: q, walletId } });
      navigate({ to: "/orders/$orderId", params: { orderId: res.orderId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-reveal grid gap-6 py-8 lg:grid-cols-[1fr_22rem]">
      <Panel>
        <div className="flex items-center gap-3">
          <ProductMark letter={product.icon_letter} accent={product.accent} />
          <div>
            <h1 className="text-2xl font-semibold text-snow">{product.name}</h1>
            {product.subtitle && <p className="text-sm text-fog">{product.subtitle}</p>}
          </div>
        </div>
        {product.description && <p className="mt-5 whitespace-pre-line text-sm text-fog">{product.description}</p>}
        <div className="mt-5 flex gap-2">
          <Pill tone={product.stock > 0 ? "cyan" : "rose"}>{product.stock} in stock</Pill>
          {product.category && <Pill>{product.category}</Pill>}
        </div>
      </Panel>
      <Panel className="space-y-4">
        <p className="text-2xl font-semibold text-snow">{usd(product.price_usd)} <span className="text-sm text-fog">/ account</span></p>
        <div>
          <FieldLabel>Quantity</FieldLabel>
          <TextField type="number" value={qty} onChange={setQty} />
        </div>
        <div>
          <FieldLabel>Pay with</FieldLabel>
          {wallets.length === 0 ? (
            <p className="text-sm text-amber">No payment options are set up yet.</p>
          ) : (
            <div className="grid gap-2">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWalletId(w.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm ring-1 ${walletId === w.id ? "bg-cyan/10 text-snow ring-cyan/40" : "text-fog ring-snow/10"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="font-mono text-xs text-fog">Total: <span className="text-snow">{usd(product.price_usd * q)}</span></p>
        {error && <p className="text-sm text-rose">{error}</p>}
        {user ? (
          <ActionButton className="w-full" onClick={buy} disabled={busy || !walletId || product.stock < 1}>
            {busy ? "Creating order…" : "Buy now"}
          </ActionButton>
        ) : (
          <Link to="/auth" className="block rounded-lg bg-cyan py-2 text-center font-mono text-xs text-ink">
            Sign in to buy
          </Link>
        )}
      </Panel>
    </div>
  );
}
