import axios from "axios";

/** Açık limit emirleri — dashboard ile aynı varsayılan (testnet). `HYPERLIQUID_INFO_URL` ile mainnet geçilebilir. */
export const DEFAULT_HL_INFO_URL =
  process.env.HYPERLIQUID_INFO_URL?.trim() || "https://api.hyperliquid-testnet.xyz/info";

export type HlOpenOrderRow = {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
};

export async function fetchHyperliquidOpenOrders(
  wallet: string
): Promise<HlOpenOrderRow[]> {
  try {
    const { data } = await axios.post<HlOpenOrderRow[]>(
      DEFAULT_HL_INFO_URL,
      { type: "openOrders", user: wallet.trim() },
      { timeout: 30_000 }
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
