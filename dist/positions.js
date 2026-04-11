import axios from "axios";
import { DEFAULT_DGCLAW_APP_URL } from "./constants.js";
export function dgclawPositionsUrl(walletAddress) {
    const base = (process.env.DGCLAW_APP_URL?.trim() || DEFAULT_DGCLAW_APP_URL).replace(/\/$/, "");
    const w = walletAddress.trim();
    return `${base}/users/${w}/positions`;
}
export async function fetchDgPositions(walletAddress) {
    const url = dgclawPositionsUrl(walletAddress);
    const { data } = await axios.get(url, {
        timeout: 45_000,
        validateStatus: (s) => s === 200,
    });
    return Array.isArray(data?.data) ? data.data : [];
}
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** uPnL sayısına göre satır başı işaret */
function pnlRowIcon(unrealizedPnl) {
    if (unrealizedPnl == null || String(unrealizedPnl).trim() === "")
        return "⚪";
    const n = Number.parseFloat(String(unrealizedPnl).replace(/,/g, ""));
    if (!Number.isFinite(n))
        return "⚪";
    if (n > 0)
        return "🟢";
    if (n < 0)
        return "🔴";
    return "⚪";
}
/**
 * Telegram HTML — tek satır / pozisyon; satır sonu \\n (Telegram &lt;br&gt; desteklemez).
 */
export function formatPositionBlock(alias, label, rows) {
    const title = label
        ? `<b>${esc(alias)}</b> — <i>${esc(label)}</i>`
        : `<b>${esc(alias)}</b>`;
    if (rows.length === 0) {
        return `${title}\n<i>Açık pozisyon yok</i>`;
    }
    const lines = rows.map((r) => {
        const pair = esc(r.pair ?? "?");
        const side = esc(String(r.side ?? "?"));
        const entry = esc(String(r.entryPrice ?? "-"));
        const mark = esc(String(r.markPrice ?? "-"));
        const lev = r.leverage != null ? esc(`${r.leverage}x`) : "?x";
        const notional = esc(String(r.notionalSize ?? "-"));
        const pnl = esc(String(r.unrealizedPnl != null ? r.unrealizedPnl : "-"));
        const icon = pnlRowIcon(r.unrealizedPnl);
        return `${icon} <b>${pair}</b> · <i>${side}</i> · entry <code>${entry}</code> · mark <code>${mark}</code> · <code>${lev}</code> · N<code>${notional}</code> · u<code>${pnl}</code>`;
    });
    return `${title}\n${lines.join("\n")}`;
}
