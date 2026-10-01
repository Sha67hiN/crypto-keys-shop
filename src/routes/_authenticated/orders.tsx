import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/orders.functions";
import { Panel, Pill, statusTone } from "@/components/site/Pieces";
import { Credentials } from "@/components/site/Credentials";
import { usd } from "@/lib/store-format";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My Orders · Keyvault" },
      { name: "description", content: "Your orders and delivered accounts." },
      { property: "og:title", content: "My Orders · Keyvault" },
      { property: "og:description", content: "Your orders and delivered accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const match = useMatchRoute();
  const fetchOrders = useServerFn(listMyOrders);
  const { data: orders, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders() });
  if (match({ to: "/orders/$orderId" })) return <Outlet />;

  return (
    <div className="animate-reveal space-y-4 py-8">
      <h1 className="text-2xl font-semibold text-snow">My Orders</h1>
      {isLoading && <p className="text-fog">Loading…</p>}
      {orders?.length === 0 && <p className="text-fog">No orders yet. <Link to="/" className="text-cyan">Browse the store</Link>.</p>}
      {orders?.map((o) => (
        <Panel key={o.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-snow">{o.product_name} × {o.quantity}</p>
              <p className="font-mono text-xs text-fog">{o.order_code} · {new Date(o.created_at).toLocaleString()} · {usd(o.total_usd)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={statusTone(o.status)} dot={o.status === "pending"}>{o.status}</Pill>
              <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-cyan">Open →</Link>
            </div>
          </div>
          <Credentials lines={o.credentials} name={`${o.product_name}-${o.order_code}`} />
        </Panel>
      ))}
    </div>
  );
}
