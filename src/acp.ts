import axios, { type AxiosInstance } from "axios";
import { DEFAULT_ACP_API_URL, DEGEN_CLAW_PROVIDER } from "./constants.js";

/**
 * Bazı agent'larda `/acp/me` ile `hlWallet` (v2 HL) farklı; perp job'ları yalnızca API key'e
 * bağlı hesapta çalışınca "Insufficient margin" görülür. Degen claw bu alanı destekliyorsa
 * emri belirtilen HL adresinde açar. Destek yoksa alan yok sayılır — o zaman Virtuals'ta
 * yeni Lite key veya HL eşlemesi gerekir.
 * Kapatmak: `ACP_PERP_HL_USER_IN_REQUIREMENTS=0`
 */
export function attachHyperliquidUserToPerpRequirements(
  serviceRequirements: Record<string, unknown>,
  hl?: string
): void {
  const off = process.env.ACP_PERP_HL_USER_IN_REQUIREMENTS?.trim().toLowerCase();
  if (off === "0" || off === "false" || off === "off") return;
  const a = hl?.trim();
  if (!a) return;
  serviceRequirements.hyperliquidUser = a;
}

export function createAcpClient(apiKey: string): AxiosInstance {
  const baseURL = process.env.ACP_API_URL?.trim() || DEFAULT_ACP_API_URL;
  const h: Record<string, string> = { "x-api-key": apiKey };
  const bc = process.env.ACP_BUILDER_CODE?.trim();
  if (bc) h["x-builder-code"] = bc;
  return axios.create({
    baseURL,
    headers: h,
    timeout: 120_000,
  });
}

export type PerpOpenParams = {
  pair: string;
  side: "long" | "short";
  size: string;
  leverage: number;
  stopLoss?: string;
  takeProfit?: string;
  orderType?: "market" | "limit";
  limitPrice?: string;
  /** HL marjın çekileceği adres (ör. Taxerclaw: Lite /acp/me ≠ fon cüzdanı). */
  hyperliquidUser?: string;
};

export async function jobPerpOpen(client: AxiosInstance, p: PerpOpenParams) {
  const serviceRequirements: Record<string, unknown> = {
    action: "open",
    pair: p.pair.toUpperCase(),
    side: p.side,
    size: p.size,
    leverage: p.leverage,
  };
  if (p.stopLoss) serviceRequirements.stopLoss = p.stopLoss;
  if (p.takeProfit) serviceRequirements.takeProfit = p.takeProfit;
  if (p.orderType) serviceRequirements.orderType = p.orderType;
  if (p.limitPrice) serviceRequirements.limitPrice = p.limitPrice;
  attachHyperliquidUserToPerpRequirements(serviceRequirements, p.hyperliquidUser);

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements,
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

/** Signal-bot / ichimoku ile uyumlu: limit + TP + SL tek job’da (payload.degenClaw). */
export async function jobPerpTradeOpenFull(
  client: AxiosInstance,
  serviceRequirements: Record<string, unknown>,
  hyperliquidUser?: string
) {
  const req = { ...serviceRequirements };
  attachHyperliquidUserToPerpRequirements(req, hyperliquidUser);
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: req,
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

export async function jobPerpClose(
  client: AxiosInstance,
  pair: string,
  hyperliquidUser?: string
) {
  const serviceRequirements: Record<string, unknown> = {
    action: "close",
    pair: pair.toUpperCase(),
  };
  attachHyperliquidUserToPerpRequirements(serviceRequirements, hyperliquidUser);
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements,
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

export type PerpModifyParams = {
  pair: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage?: number;
};

export async function jobPerpModify(
  client: AxiosInstance,
  p: PerpModifyParams,
  hyperliquidUser?: string
) {
  const req: Record<string, unknown> = {
    pair: p.pair.toUpperCase(),
  };
  if (p.stopLoss != null && p.stopLoss !== "") req.stopLoss = p.stopLoss;
  if (p.takeProfit != null && p.takeProfit !== "") req.takeProfit = p.takeProfit;
  if (p.leverage != null) req.leverage = p.leverage;
  attachHyperliquidUserToPerpRequirements(req, hyperliquidUser);

  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_modify",
    serviceRequirements: req,
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

/** Tek limit emri iptali — Degen `perp_trade` + `cancel_limit` + `oid`. */
export async function jobPerpCancelLimit(
  client: AxiosInstance,
  pair: string,
  oid: string | number,
  hyperliquidUser?: string
) {
  const serviceRequirements: Record<string, unknown> = {
    action: "cancel_limit",
    pair: pair.toUpperCase(),
    oid: String(oid),
  };
  attachHyperliquidUserToPerpRequirements(serviceRequirements, hyperliquidUser);
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements,
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}
