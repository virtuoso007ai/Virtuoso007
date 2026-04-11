import axios from "axios";
import { DEFAULT_ACP_API_URL, DEGEN_CLAW_PROVIDER } from "./constants.js";
export function createAcpClient(apiKey) {
    const baseURL = process.env.ACP_API_URL?.trim() || DEFAULT_ACP_API_URL;
    const h = { "x-api-key": apiKey };
    const bc = process.env.ACP_BUILDER_CODE?.trim();
    if (bc)
        h["x-builder-code"] = bc;
    return axios.create({
        baseURL,
        headers: h,
        timeout: 120_000,
    });
}
export async function jobPerpOpen(client, p) {
    const serviceRequirements = {
        action: "open",
        pair: p.pair.toUpperCase(),
        side: p.side,
        size: p.size,
        leverage: p.leverage,
    };
    if (p.stopLoss)
        serviceRequirements.stopLoss = p.stopLoss;
    if (p.takeProfit)
        serviceRequirements.takeProfit = p.takeProfit;
    if (p.orderType)
        serviceRequirements.orderType = p.orderType;
    if (p.limitPrice)
        serviceRequirements.limitPrice = p.limitPrice;
    const body = {
        providerWalletAddress: DEGEN_CLAW_PROVIDER,
        jobOfferingName: "perp_trade",
        serviceRequirements,
    };
    const { data } = await client.post("/acp/jobs", body);
    return data;
}
/** Signal-bot / ichimoku ile uyumlu: limit + TP + SL tek job’da (payload.degenClaw). */
export async function jobPerpTradeOpenFull(client, serviceRequirements) {
    const body = {
        providerWalletAddress: DEGEN_CLAW_PROVIDER,
        jobOfferingName: "perp_trade",
        serviceRequirements,
    };
    const { data } = await client.post("/acp/jobs", body);
    return data;
}
export async function jobPerpClose(client, pair) {
    const body = {
        providerWalletAddress: DEGEN_CLAW_PROVIDER,
        jobOfferingName: "perp_trade",
        serviceRequirements: {
            action: "close",
            pair: pair.toUpperCase(),
        },
    };
    const { data } = await client.post("/acp/jobs", body);
    return data;
}
export async function jobPerpModify(client, p) {
    const req = {
        pair: p.pair.toUpperCase(),
    };
    if (p.stopLoss != null && p.stopLoss !== "")
        req.stopLoss = p.stopLoss;
    if (p.takeProfit != null && p.takeProfit !== "")
        req.takeProfit = p.takeProfit;
    if (p.leverage != null)
        req.leverage = p.leverage;
    const body = {
        providerWalletAddress: DEGEN_CLAW_PROVIDER,
        jobOfferingName: "perp_modify",
        serviceRequirements: req,
    };
    const { data } = await client.post("/acp/jobs", body);
    return data;
}
/** Tek limit emri iptali — Degen `perp_trade` + `cancel_limit` + `oid`. */
export async function jobPerpCancelLimit(client, pair, oid) {
    const body = {
        providerWalletAddress: DEGEN_CLAW_PROVIDER,
        jobOfferingName: "perp_trade",
        serviceRequirements: {
            action: "cancel_limit",
            pair: pair.toUpperCase(),
            oid: String(oid),
        },
    };
    const { data } = await client.post("/acp/jobs", body);
    return data;
}
