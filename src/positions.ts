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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** uPnL sayısına göre satır başı işaret */
function pnlRowIcon(unrealizedPnl: string | undefined): string {
  if (unrealizedPnl == null || String(unrealizedPnl).trim() === "") return "⚪";
  const n = Number.parseFloat(String(unrealizedPnl).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "⚪";
  if (n > 0) return "🟢";
  if (n < 0) return "🔴";
  return "⚪";
}

const SECTION_RULE = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";

/**
 * Telegram HTML — göz yormaması için başlık kalın, rakamlar monospace, satırlar sade.
 */
export function formatPositionBlock(alias: string, label: string | undefined, rows: DgPositionRow[]): string {
  const title = label
    ? `<b>${esc(alias)}</b> — <i>${esc(label)}</i>`
    : `<b>${esc(alias)}</b>`;

  if (rows.length === 0) {
    return `${title}\n\n${SECTION_RULE}\n<i>Açık pozisyon yok</i>`;
  }

  const blocks = rows.map((r) => {
    const pair = esc(r.pair ?? "?");
    const side = esc(String(r.side ?? "?"));
    const entry = esc(String(r.entryPrice ?? "-"));
    const mark = esc(String(r.markPrice ?? "-"));
    const lev = r.leverage != null ? esc(`${r.leverage}x`) : "?x";
    const notional = esc(String(r.notionalSize ?? "-"));
    const pnl = esc(String(r.unrealizedPnl != null ? r.unrealizedPnl : "-"));
    const icon = pnlRowIcon(r.unrealizedPnl);

    return [
      `${icon} <b>${pair}</b> · <i>${side}</i>`,
      `   entry <code>${entry}</code> · mark <code>${mark}</code> · <code>${lev}</code>`,
      `   notional <code>${notional}</code> · uPnL <code>${pnl}</code>`,
    ].join("\n");
  });

  return `${title}\n\n${SECTION_RULE}\n\n${blocks.join("\n\n")}`;
}
