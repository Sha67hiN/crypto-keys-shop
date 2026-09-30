/**
 * Self-hosted on-chain payment watching.
 * Reads public block explorers to find an incoming transfer that matches an
 * order's unique expected amount. No payment provider involved.
 */

export type WalletRow = {
  chain: string;
  asset: string;
  contract_address: string | null;
  decimals: number;
  address: string;
};

export type IncomingTransfer = {
  hash: string;
  amount: number;
  timestamp: number;
  from: string;
};

const COINGECKO_IDS: Record<string, string> = {
  USDT: "tether",
  TRX: "tron",
  BNB: "binancecoin",
  ETH: "ethereum",
  BTC: "bitcoin",
  MATIC: "matic-network",
  POL: "matic-network",
  BUSD: "binance-usd",
  USDC: "usd-coin",
};

const STABLE = new Set(["USDT", "USDC", "BUSD", "DAI"]);

/** USD price of one unit of `asset`. */
export async function getUsdPrice(asset: string): Promise<number> {
  const symbol = asset.toUpperCase();
  if (STABLE.has(symbol)) return 1;
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error(`No price feed configured for ${symbol}`);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Price lookup failed (${res.status})`);
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const price = json[id]?.usd;
  if (!price || price <= 0) throw new Error(`No USD price returned for ${symbol}`);
  return price;
}

function scale(raw: string, decimals: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / Math.pow(10, decimals);
}

async function tronTransfers(wallet: WalletRow, sinceMs: number): Promise<IncomingTransfer[]> {
  const base = "https://api.trongrid.io/v1/accounts";
  const common = `only_to=true&limit=100&min_timestamp=${sinceMs}`;

  if (wallet.asset.toUpperCase() === "TRX") {
    const res = await fetch(`${base}/${wallet.address}/transactions?${common}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`TRON lookup failed (${res.status})`);
    const json = (await res.json()) as { data?: unknown[] };
    return (json.data ?? []).flatMap((entry) => {
      const tx = entry as {
        txID?: string;
        block_timestamp?: number;
        ret?: { contractRet?: string }[];
        raw_data?: {
          contract?: {
            type?: string;
            parameter?: { value?: { amount?: number; to_address?: string; owner_address?: string } };
          }[];
        };
      };
      const contract = tx.raw_data?.contract?.[0];
      if (contract?.type !== "TransferContract") return [];
      if (tx.ret?.[0]?.contractRet && tx.ret[0].contractRet !== "SUCCESS") return [];
      const amount = contract.parameter?.value?.amount;
      if (!tx.txID || !amount) return [];
      return [
        {
          hash: tx.txID,
          amount: amount / 1e6,
          timestamp: tx.block_timestamp ?? 0,
          from: contract.parameter?.value?.owner_address ?? "",
        },
      ];
    });
  }

  const res = await fetch(`${base}/${wallet.address}/transactions/trc20?${common}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TRON token lookup failed (${res.status})`);
  const json = (await res.json()) as { data?: unknown[] };
  const contract = (wallet.contract_address ?? "").toLowerCase();
  return (json.data ?? []).flatMap((entry) => {
    const tx = entry as {
      transaction_id?: string;
      value?: string;
      block_timestamp?: number;
      from?: string;
      to?: string;
      token_info?: { address?: string; decimals?: number };
    };
    if (!tx.transaction_id || !tx.value) return [];
    if (contract && (tx.token_info?.address ?? "").toLowerCase() !== contract) return [];
    if ((tx.to ?? "").toLowerCase() !== wallet.address.toLowerCase()) return [];
    return [
      {
        hash: tx.transaction_id,
        amount: scale(tx.value, tx.token_info?.decimals ?? wallet.decimals),
        timestamp: tx.block_timestamp ?? 0,
        from: tx.from ?? "",
      },
    ];
  });
}

const EVM_CHAIN_IDS: Record<string, number> = {
  bsc: 56,
  ethereum: 1,
  eth: 1,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
};

async function evmTransfers(wallet: WalletRow, sinceMs: number): Promise<IncomingTransfer[]> {
  const apiKey = process.env["ETHERSCAN_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "Missing block-explorer key for this network. Add the explorer API key in settings to watch this chain.",
    );
  }
  const chainId = EVM_CHAIN_IDS[wallet.chain.toLowerCase()];
  if (!chainId) throw new Error(`Unsupported chain: ${wallet.chain}`);

  const isToken = Boolean(wallet.contract_address);
  const params = new URLSearchParams({
    chainid: String(chainId),
    module: "account",
    action: isToken ? "tokentx" : "txlist",
    address: wallet.address,
    page: "1",
    offset: "100",
    sort: "desc",
    apikey: apiKey,
  });
  if (isToken) params.set("contractaddress", wallet.contract_address!);

  const res = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Explorer lookup failed (${res.status})`);
  const json = (await res.json()) as { status?: string; message?: string; result?: unknown };
  if (!Array.isArray(json.result)) return [];

  return (json.result as unknown[]).flatMap((entry) => {
    const tx = entry as {
      hash?: string;
      value?: string;
      timeStamp?: string;
      to?: string;
      from?: string;
      isError?: string;
      tokenDecimal?: string;
    };
    if (!tx.hash || !tx.value) return [];
    if (tx.isError === "1") return [];
    if ((tx.to ?? "").toLowerCase() !== wallet.address.toLowerCase()) return [];
    const ts = Number(tx.timeStamp ?? 0) * 1000;
    if (ts < sinceMs) return [];
    const decimals = tx.tokenDecimal ? Number(tx.tokenDecimal) : wallet.decimals;
    return [
      { hash: tx.hash, amount: scale(tx.value, decimals), timestamp: ts, from: tx.from ?? "" },
    ];
  });
}

async function bitcoinTransfers(wallet: WalletRow, sinceMs: number): Promise<IncomingTransfer[]> {
  const res = await fetch(`https://blockstream.info/api/address/${wallet.address}/txs`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Bitcoin lookup failed (${res.status})`);
  const json = (await res.json()) as unknown[];
  return json.flatMap((entry) => {
    const tx = entry as {
      txid?: string;
      status?: { block_time?: number };
      vout?: { scriptpubkey_address?: string; value?: number }[];
    };
    if (!tx.txid) return [];
    const ts = (tx.status?.block_time ?? Math.floor(Date.now() / 1000)) * 1000;
    if (ts < sinceMs) return [];
    const received = (tx.vout ?? [])
      .filter((o) => o.scriptpubkey_address === wallet.address)
      .reduce((sum, o) => sum + (o.value ?? 0), 0);
    if (received <= 0) return [];
    return [{ hash: tx.txid, amount: received / 1e8, timestamp: ts, from: "" }];
  });
}

export async function fetchIncomingTransfers(
  wallet: WalletRow,
  sinceMs: number,
): Promise<IncomingTransfer[]> {
  const chain = wallet.chain.toLowerCase();
  if (!wallet.address) throw new Error("This payment network has no wallet address configured yet.");
  if (chain === "tron") return tronTransfers(wallet, sinceMs);
  if (chain === "bitcoin" || chain === "btc") return bitcoinTransfers(wallet, sinceMs);
  return evmTransfers(wallet, sinceMs);
}
