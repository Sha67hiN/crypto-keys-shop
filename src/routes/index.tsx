import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getStorefront } from "@/lib/storefront.functions";
import { Pill, ProductMark } from "@/components/site/Pieces";
import { usd } from "@/lib/store-format";

const storeQuery = queryOptions({ queryKey: ["storefront"], queryFn: () => getStorefront() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keyvault · Buy accounts with crypto, instant delivery" },
      { name: "description", content: "Browse accounts, pay with USDT, TRX or BNB and get your credentials instantly." },
      { property: "og:title", content: "Keyvault · Instant account delivery" },
      { property: "og:description", content: "Pay with crypto and receive your accounts the moment payment lands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storeQuery),
  errorComponent: () => <p className="py-20 text-center text-fog">The store couldn't load. Refresh to try again.</p>,
  notFoundComponent: () => <p className="py-20 text-center text-fog">Not found.</p>,
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(storeQuery);
  const { products, settings } = data;
  return (
    <div className="animate-reveal">
      <section className="py-12 text-center">
        <p className="label-mono">{settings.store_name}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-snow sm:text-5xl">{settings.heading}</h1>
        <p className="mx-auto mt-3 max-w-xl text-fog">{settings.tagline}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.id}
            to="/p/$slug"
            params={{ slug: p.slug }}
            className="panel-frost group rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <ProductMark letter={p.icon_letter} accent={p.accent} />
              <Pill tone={p.stock > 0 ? "cyan" : "rose"} dot={p.stock > 0}>
                {p.stock > 0 ? `${p.stock} in stock` : "Sold out"}
              </Pill>
            </div>
            <h2 className="mt-4 font-semibold text-snow">{p.name}</h2>
            {p.subtitle && <p className="mt-1 text-sm text-fog">{p.subtitle}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-snow">{usd(p.price_usd)}</span>
              <span className="font-mono text-xs text-cyan group-hover:text-snow">View →</span>
            </div>
          </Link>
        ))}
        {products.length === 0 && <p className="text-fog">No products yet.</p>}
      </div>
    </div>
  );
}
