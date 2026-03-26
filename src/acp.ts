import axios, { type AxiosInstance } from "axios";
import { DEFAULT_ACP_API_URL, DEGEN_CLAW_PROVIDER } from "./constants.js";

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
};

export async function jobPerpOpen(client: AxiosInstance, p: PerpOpenParams) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "open",
      pair: p.pair.toUpperCase(),
      side: p.side,
      size: p.size,
      leverage: p.leverage,
    },
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

export async function jobPerpClose(client: AxiosInstance, pair: string) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_trade",
    serviceRequirements: {
      action: "close",
      pair: pair.toUpperCase(),
    },
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}

export type PerpModifyParams = {
  pair: string;
  stopLoss: string;
  takeProfit: string;
};

export async function jobPerpModify(client: AxiosInstance, p: PerpModifyParams) {
  const body = {
    providerWalletAddress: DEGEN_CLAW_PROVIDER,
    jobOfferingName: "perp_modify",
    serviceRequirements: {
      pair: p.pair.toUpperCase(),
      stopLoss: p.stopLoss,
      takeProfit: p.takeProfit,
    },
  };
  const { data } = await client.post<{ data?: { jobId?: number }; message?: string }>(
    "/acp/jobs",
    body
  );
  return data;
}
