import { createHash } from "crypto";
export function serverKeyHash(): string {
  const s = process.env["PAYMENT_SIGNING_SECRET"];
  if (!s) throw new Error("Checkout is not configured.");
  return createHash("sha256").update(s).digest("hex");
}
