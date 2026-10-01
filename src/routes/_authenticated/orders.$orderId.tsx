import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkOrderPayment, getOrder } from "@/lib/orders.functions";
import { ActionButton, Panel, Pill, statusTone } from "@/components/site/Pieces";
import { Credentials } from "@/components/site/Credentials";
import { usd } from "@/lib/store-format";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order · Keyvault" },
      { name: "description", content: "Pay for your order and receive your accounts." },
      { property: "og:title", content: "Order · Keyvault" },
      { property: "og:description", content: "Pay for your order and receive your accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const fetchOrder = useServerFn(getOrder);
  const check = useServerFn(checkOrderPayment);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: () => fetchOrder({ data: { orderId } }) });
  const status = data?.order.status;

  useEffect(() => {
    if (status !== "pending" && status !== "paid") return;
    const run = async () => {
      try {
        const r = await check({ data: { orderId } });
        if (r.status !== "pending") qc.invalidateQueries({ queryKey: ["order", orderId] });
      } catch {
        /* keep polling */
      }
    };
    void run();
    const t = setInterval(run, 20000);
    return () => clearInterval(t);
  }, [status, orderId, check, qc]);

  if (isLoading) return <p className="py-10 text-fog">Loading…</p>;
  if (!data) return <p className="py-10 text-fog">Order not found.</p>;
  const { order, wallet, credentials } = data;

  return (
    <div className="animate-reveal space-y-4 py-8">
      <Link to="/orders" className="font-mono text-xs text-fog hover:text-snow">← My Orders</Link>
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-snow">{order.product_name} × {order.quantity}</h1>
            <p className="font-mono text-xs text-fog">{order.order_code} · {usd(order.total_usd)}</p>
          </div>
          <Pill tone={statusTone(order.status)} dot={order.status === "pending"}>{order.status}</Pill>
        </div>

        {order.status === "pending" && wallet && (
          <div className="panel-solid space-y-3 rounded-lg p-4">
            <p className="text-sm text-fog">Send <b className="text-snow">exactly</b> this amount on <b className="text-snow">{wallet.label}</b>:</p>
            <p className="font-mono text-2xl text-cyan">{order.expected_amount} {wallet.asset}</p>
            <p className="label-mono">To address</p>
            <p className="break-all font-mono text-sm text-snow">{wallet.address}</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="ghost" onClick={() => navigator.clipboard.writeText(String(order.expected_amount))}>Copy amount</ActionButton>
              <ActionButton variant="ghost" onClick={() => navigator.clipboard.writeText(wallet.address)}>Copy address</ActionButton>
            </div>
            <p className="font-mono text-[11px] text-fog">
              We check the blockchain automatically every 20 seconds.
              {order.expires_at && ` Pay before ${new Date(order.expires_at).toLocaleTimeString()}.`}
            </p>
          </div>
        )}
        {order.status === "paid" && <p className="text-sm text-amber">Payment received — your accounts are being released. If stock ran short, support will complete it.</p>}
        {order.status === "failed" && <p className="text-sm text-rose">This order expired without payment. Contact support if you already paid.</p>}
        {credentials.length > 0 && (
          <div>
            <p className="label-mono mb-2">Your accounts</p>
            <Credentials lines={credentials} name={`${order.product_name}-${order.order_code}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
