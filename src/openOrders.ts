import axios from "axios";

/** Açık limit emirleri — mainnet varsayılan. `HYPERLIQUID_INFO_URL` ile testnet geçilebilir. */
export const DEFAULT_HL_INFO_URL =
  process.env.HYPERLIQUID_INFO_URL?.trim() || "https://api.hyperliquid.xyz/info";

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
      { type: "openOrders", user: wallet },
      { timeout: 30_000 }
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
