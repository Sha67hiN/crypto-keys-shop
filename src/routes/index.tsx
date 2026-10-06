import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getStorefront } from "@/lib/storefront.functions";
import { Pill, ProductMark } from "@/components/site/Pieces";
import { usd } from "@/lib/store-format";
import { ArrowRight, BadgeCheck, PackageCheck, ShoppingBag, Zap } from "lucide-react";

const storeQuery = queryOptions({ queryKey: ["storefront"], queryFn: () => getStorefront() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "515Store · Buy accounts with crypto, instant delivery" },
      { name: "description", content: "Browse accounts, pay with USDT, TRX or BNB and get your credentials instantly." },
      { property: "og:title", content: "515Store · Instant account delivery" },
      { property: "og:description", content: "Pay with crypto and receive your accounts the moment payment lands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storeQuery),
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <div className="py-20 text-center text-fog">
        <p>The store couldn't load.</p>
        <button className="mt-3 font-mono text-xs text-cyan" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
      </div>
    );
  },
  notFoundComponent: () => <p className="py-20 text-center text-fog">Not found.</p>,
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(storeQuery);
  const { products, settings } = data;
  const available = products.reduce((sum, product) => sum + product.stock, 0);
  const sold = products.reduce((sum, product) => sum + product.sold, 0);
  return (
    <div className="animate-reveal">
      <section className="grid gap-6 py-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="label-mono">Live account marketplace</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold text-snow sm:text-5xl">{settings.heading}</h1>
          <p className="mt-3 max-w-2xl text-fog">{settings.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-fog">
            <span className="inline-flex items-center gap-1.5"><Zap className="size-4 text-cyan" aria-hidden="true" /> Instant delivery</span>
            <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4 text-teal" aria-hidden="true" /> Secure checkout</span>
            <span className="inline-flex items-center gap-1.5"><PackageCheck className="size-4 text-amber" aria-hidden="true" /> {sold.toLocaleString()} accounts sold</span>
          </div>
        </div>
        <div className="panel-solid grid min-w-52 grid-cols-2 gap-px overflow-hidden rounded-lg p-px">
          <div className="bg-panel/80 p-3"><p className="label-mono">Available</p><p className="mt-1 text-xl font-semibold text-snow">{available.toLocaleString()}</p></div>
          <div className="bg-panel/80 p-3"><p className="label-mono">Sold</p><p className="mt-1 text-xl font-semibold text-cyan">{sold.toLocaleString()}</p></div>
        </div>
      </section>
      <div className="mb-4 flex items-end justify-between border-b border-snow/10 pb-3">
        <div><p className="label-mono">Catalog</p><h2 className="mt-1 text-xl font-semibold text-snow">Choose your account</h2></div>
        <span className="font-mono text-xs text-fog">{products.length} products</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.id}
            to="/p/$slug"
            params={{ slug: p.slug }}
            className="panel-frost group overflow-hidden rounded-lg p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-cyan/30"
          >
            {p.banner_url && (
              <img src={p.banner_url} alt={p.name} loading="lazy" className="-mx-5 -mt-5 mb-4 aspect-[16/7] w-[calc(100%+2.5rem)] max-w-none object-cover" />
            )}
            <div className="flex items-start justify-between gap-3">
              <ProductMark letter={p.icon_letter} accent={p.accent} />
              <Pill tone={p.stock > 0 ? "cyan" : "rose"} dot={p.stock > 0}>
                {p.stock > 0 ? `${p.stock} in stock` : "Sold out"}
              </Pill>
            </div>
            <h2 className="mt-4 font-semibold text-snow">{p.name}</h2>
            {p.subtitle && <p className="mt-1 text-sm text-fog">{p.subtitle}</p>}
            <div className="mt-4 flex items-end justify-between border-t border-snow/10 pt-4">
              <div><span className="block text-lg font-semibold text-snow">{usd(p.price_usd)}</span><span className="font-mono text-[10px] text-fog"><ShoppingBag className="mr-1 inline size-3" aria-hidden="true" />{p.sold.toLocaleString()} sold</span></div>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-cyan group-hover:text-snow">View <ArrowRight className="size-3.5" aria-hidden="true" /></span>
            </div>
          </Link>
        ))}
        {products.length === 0 && <p className="text-fog">No products yet.</p>}
      </div>
    </div>
  );
}
