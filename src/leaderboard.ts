import axios from "axios";

/** [Degen leaderboard](https://degen.virtuals.io/#leaderboard) */
export const DEFAULT_DEGEN_LEADERBOARD_API =
  "https://degen.virtuals.io/api/leaderboard";

export type LbApiEntry = {
  id?: string;
  name?: string;
  agentAddress?: string;
  performance?: {
    rank?: number;
    compositeScore?: number;
    totalRealizedPnl?: number;
    qualified?: boolean;
  };
};

type LbApiResponse = {
  success?: boolean;
  data?: LbApiEntry[];
  season?: { id?: string; name?: string };
  pagination?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function normalizeWallet(w: string): string {
  return w.trim().toLowerCase();
}

function leaderboardBaseUrl(): string {
  return (process.env.DEGEN_LEADERBOARD_API?.trim() || DEFAULT_DEGEN_LEADERBOARD_API).replace(/\/$/, "");
}

export function defaultSeasonId(): string {
  return process.env.DEGEN_LEADERBOARD_SEASON_ID?.trim() || "2";
}

/** Tüm sayfaları toplar (hasMore bitene kadar). */
export async function fetchLeaderboardAll(seasonId: string): Promise<{
  rows: LbApiEntry[];
  seasonName: string;
  total: number;
}> {
  const base = leaderboardBaseUrl();
  const pageSize = 100;
  let offset = 0;
  const all: LbApiEntry[] = [];
  let total = 0;
  let seasonName = `Sezon ${seasonId}`;

  for (let page = 0; page < 200; page++) {
    const url = `${base}?limit=${pageSize}&offset=${offset}&seasonId=${encodeURIComponent(seasonId)}`;
    const { data } = await axios.get<LbApiResponse>(url, { timeout: 60_000 });
    const chunk = data?.data ?? [];
    all.push(...chunk);
    if (data?.season?.name) seasonName = data.season.name;
    if (data?.pagination?.total != null) total = data.pagination.total;
    const hasMore = data?.pagination?.hasMore === true;
    if (!hasMore || chunk.length === 0) break;
    offset += pageSize;
  }

  return { rows: all, seasonName, total: total || all.length };
}

/** Tek istek — sadece ilk N satır (hızlı önizleme). */
export async function fetchLeaderboardTop(
  seasonId: string,
  limit: number
): Promise<{ rows: LbApiEntry[]; seasonName: string; total: number }> {
  const base = leaderboardBaseUrl();
  const url = `${base}?limit=${limit}&offset=0&seasonId=${encodeURIComponent(seasonId)}`;
  const { data } = await axios.get<LbApiResponse>(url, { timeout: 45_000 });
  const rows = data?.data ?? [];
  const seasonName = data?.season?.name ?? `Sezon ${seasonId}`;
  const total = data?.pagination?.total ?? rows.length;
  return { rows, seasonName, total };
}

/** Cüzdan → leaderboard satırı */
export function indexByWallet(rows: LbApiEntry[]): Map<string, LbApiEntry> {
  const m = new Map<string, LbApiEntry>();
  for (const r of rows) {
    const a = r.agentAddress?.trim();
    if (!a) continue;
    const key = normalizeWallet(a);
    if (!m.has(key)) m.set(key, r);
  }
  return m;
}

function pnlIcon(pnl: number | undefined): string {
  if (pnl == null || !Number.isFinite(pnl)) return "⚪";
  if (pnl > 0) return "🟢";
  if (pnl < 0) return "🔴";
  return "⚪";
}

export function formatLbRowLine(entry: LbApiEntry): string {
  const name = esc(entry.name ?? "?");
  const rank = entry.performance?.rank ?? "?";
  const score = entry.performance?.compositeScore ?? "?";
  const pnl = entry.performance?.totalRealizedPnl;
  const pnlStr = pnl != null && Number.isFinite(pnl) ? pnl.toFixed(2) : "?";
  const icon = pnlIcon(pnl);
  return `${icon} ${name} · #<code>${rank}</code> · skor <code>${String(score)}</code> · PnL <code>${pnlStr}</code>`;
}

export type AgentLbMatch = {
  alias: string;
  label?: string;
  walletResolved: boolean;
  entry: LbApiEntry | null;
};

const LB_URL = "https://degen.virtuals.io/#leaderboard";

export function buildLeaderboardHtml(opts: {
  seasonName: string;
  total: number;
  matches: AgentLbMatch[];
  topRows: LbApiEntry[];
  /** true: sadece ilk N satırda eşleşme yapıldı */
  previewOnly: boolean;
}): string {
  const { seasonName, total, matches, topRows, previewOnly } = opts;

  const sorted = [...matches].sort((a, b) => {
    const ra = a.entry?.performance?.rank;
    const rb = b.entry?.performance?.rank;
    if (ra == null && rb == null) return a.alias.localeCompare(b.alias);
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra - rb;
  });

  const oursLines: string[] = [];
  for (const m of sorted) {
    const title = m.label
      ? `<b>${esc(m.alias)}</b> <i>(${esc(m.label)})</i>`
      : `<b>${esc(m.alias)}</b>`;
    if (!m.walletResolved) {
      oursLines.push(`${title}\n<i>Cüzdan alınamadı</i> — <code>walletAddress</code> veya <code>/acp/me</code>`);
      continue;
    }
    if (!m.entry) {
      oursLines.push(
        `${title}\n<i>Bu sezon listesinde yok</i>${previewOnly ? " <i>(yalnızca ilk satırlar tarandı)</i>" : ""}`
      );
      continue;
    }
    oursLines.push(`${title}\n${formatLbRowLine(m.entry)}`);
  }

  const topLines = topRows.map((r) => {
    const rank = r.performance?.rank ?? "?";
    const name = esc(r.name ?? "?");
    const sc = r.performance?.compositeScore ?? "?";
    return `${rank}. ${name} — <code>${String(sc)}</code>`;
  });

  const note = previewOnly
    ? `\n\n<i>Tam sıra ve tüm liste için: <code>/leaderboard</code> (tüm sayfalar çekilir).</i>`
    : "";

  return (
    `<b>Degen leaderboard</b> · <i>${esc(seasonName)}</i> · kayıt <code>${total}</code>\n` +
    `<a href="${LB_URL}">degen.virtuals.io</a>\n\n` +
    `<b>Orkestra agentları</b>\n` +
    (oursLines.length ? oursLines.join("\n\n") : "<i>Kayıtlı agent yok.</i>") +
    `\n\n<b>İlk ${topRows.length}</b> (özet)\n` +
    (topLines.length ? topLines.join("\n") : "<i>—</i>") +
    note
  );
}
