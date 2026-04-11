import axios from "axios";
import { DEFAULT_DGCLAW_APP_URL } from "./constants.js";
export function dgclawAccountUrl(walletAddress) {
    const base = (process.env.DGCLAW_APP_URL?.trim() || DEFAULT_DGCLAW_APP_URL).replace(/\/$/, "");
    const w = walletAddress.trim();
    return `${base}/users/${w}/account`;
}
export async function fetchDgAccount(walletAddress) {
    const url = dgclawAccountUrl(walletAddress);
    const { data } = await axios.get(url, {
        timeout: 45_000,
        validateStatus: (s) => s === 200,
    });
    return data?.data ?? null;
}
/** Degen 404 / "Account not found" → kullanıcıya kısa açıklama */
export function degenAccountErrorHint(e) {
    if (!axios.isAxiosError(e))
        return undefined;
    const st = e.response?.status;
    const raw = e.response?.data;
    const txt = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
    if (st === 404 || /account not found/i.test(txt)) {
        return ("Degen Claw’da bu cüzdan için hesap yok (HL deposit / kayıt tamamlanmamış olabilir). " +
            "Virtuals agent cüzdanı ile eşleştiğinden emin ol; /balance tekrar dene.");
    }
    return undefined;
}
export function formatAccountBlock(alias, label, acc) {
    const head = label ? `${alias} — ${label}` : alias;
    if (!acc)
        return `${head}\n  (hesap verisi yok)`;
    const hl = acc.hlBalance ?? "-";
    const wd = acc.withdrawableBalance ?? "-";
    const hlAddr = acc.hlAddress ?? "-";
    const buyer = acc.buyerAddress ?? "-";
    return `${head}
  HL bakiye: ${hl} USDC
  Çekilebilir: ${wd} USDC
  HL adres: ${hlAddr}
  Buyer: ${buyer}`;
}
