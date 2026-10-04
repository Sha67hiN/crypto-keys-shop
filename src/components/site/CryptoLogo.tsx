import { useState } from "react";
import { cn } from "@/lib/utils";

const ICON_BASE = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color";

function coinCode(asset: string) {
  const a = asset.toLowerCase();
  if (a.startsWith("usdt")) return "usdt";
  if (a.startsWith("usdc")) return "usdc";
  return a.replace(/[^a-z]/g, "");
}

function chainCode(chain: string) {
  const c = chain.toLowerCase();
  if (c.includes("bsc") || c.includes("bnb") || c.includes("bep")) return "bnb";
  if (c.includes("tron") || c.includes("trc") || c === "trx") return "trx";
  if (c.includes("eth") || c.includes("erc")) return "eth";
  if (c.includes("btc") || c.includes("bitcoin")) return "btc";
  if (c.includes("polygon") || c.includes("matic")) return "matic";
  return "";
}

/** Coin logo with a small network badge (e.g. USDT on BNB chain). */
export function CryptoLogo({ asset, chain, size = 28, className }: { asset: string; chain?: string; size?: number; className?: string }) {
  const coin = coinCode(asset);
  const net = chain ? chainCode(chain) : "";
  const [broken, setBroken] = useState(false);
  const badge = net && net !== coin ? net : "";
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {broken ? (
        <span className="grid size-full place-items-center rounded-full bg-cyan/15 font-mono text-[10px] text-cyan">{asset.slice(0, 3).toUpperCase()}</span>
      ) : (
        <img src={`${ICON_BASE}/${coin}.svg`} alt={asset} width={size} height={size} className="size-full" onError={() => setBroken(true)} />
      )}
      {badge && (
        <img
          src={`${ICON_BASE}/${badge}.svg`}
          alt={chain}
          className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-ink"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
      )}
    </span>
  );
}
