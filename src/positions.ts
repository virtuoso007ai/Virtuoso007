import axios from "axios";
import { DEFAULT_DGCLAW_APP_URL } from "./constants.js";

export type DgPositionRow = {
  pair?: string;
  side?: string;
  entryPrice?: string;
  markPrice?: string;
  leverage?: number;
  margin?: string;
  notionalSize?: string;
  unrealizedPnl?: string;
  liquidationPrice?: string | null;
  createdAt?: string;
};

export function dgclawPositionsUrl(walletAddress: string): string {
  const base = (process.env.DGCLAW_APP_URL?.trim() || DEFAULT_DGCLAW_APP_URL).replace(/\/$/, "");
  const w = walletAddress.trim();
  return `${base}/users/${w}/positions`;
}

export async function fetchDgPositions(walletAddress: string): Promise<DgPositionRow[]> {
  const url = dgclawPositionsUrl(walletAddress);
  const { data } = await axios.get<{ data?: DgPositionRow[] }>(url, {
    timeout: 45_000,
    validateStatus: (s) => s === 200,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export function formatPositionBlock(alias: string, label: string | undefined, rows: DgPositionRow[]): string {
  const head = label ? `${alias} — ${label}` : alias;
  if (rows.length === 0) return `${head}\n  (açık pozisyon yok)`;

  const lines = rows.map((r) => {
    const pair = r.pair ?? "?";
    const side = r.side ?? "?";
    const entry = r.entryPrice ?? "-";
    const mark = r.markPrice ?? "-";
    const lev = r.leverage != null ? `${r.leverage}x` : "?x";
    const notional = r.notionalSize ?? "-";
    const pnl = r.unrealizedPnl != null ? r.unrealizedPnl : "-";
    return `  • ${pair} ${side} | entry ${entry} | mark ${mark} | ${lev} | notional ${notional} | uPnL ${pnl}`;
  });
  return `${head}\n${lines.join("\n")}`;
}
