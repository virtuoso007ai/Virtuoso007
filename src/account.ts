import axios from "axios";
import { DEFAULT_DGCLAW_APP_URL } from "./constants.js";

export type DgAccountData = {
  id?: string;
  buyerAddress?: string;
  hlAddress?: string;
  hlBalance?: string;
  withdrawableBalance?: string;
  createdAt?: string;
};

export function dgclawAccountUrl(walletAddress: string): string {
  const base = (process.env.DGCLAW_APP_URL?.trim() || DEFAULT_DGCLAW_APP_URL).replace(/\/$/, "");
  const w = walletAddress.trim();
  return `${base}/users/${w}/account`;
}

export async function fetchDgAccount(walletAddress: string): Promise<DgAccountData | null> {
  const url = dgclawAccountUrl(walletAddress);
  const { data } = await axios.get<{ data?: DgAccountData }>(url, {
    timeout: 45_000,
    validateStatus: (s) => s === 200,
  });
  return data?.data ?? null;
}

export function formatAccountBlock(
  alias: string,
  label: string | undefined,
  acc: DgAccountData | null
): string {
  const head = label ? `${alias} — ${label}` : alias;
  if (!acc) return `${head}\n  (hesap verisi yok)`;

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
