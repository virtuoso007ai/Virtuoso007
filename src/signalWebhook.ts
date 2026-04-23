import type { AgentEntry } from "./agents.js";
import { tryForumTradeOpen } from "./degenForum.js";
import { hlDirectOpen } from "./hlDirectTrade.js";
import { fetchOpenHlCoins } from "./hyperliquidPositions.js";
import { resolveWalletAddress } from "./wallet-resolve.js";

const COOLDOWN_MS = Number.parseInt(process.env.AUTO_TRADE_COOLDOWN_MS ?? "", 10) || 5 * 60 * 1000;

const lastOpenByAgentPair = new Map<string, number>();

function isAgentAutoTradeEnabled(agent: AgentEntry): boolean {
  return agent.autoTrade !== false;
}

type SignalPayloadV2 = {
  v?: number;
  hlCoin?: string;
  degenClaw?: {
    serviceRequirements?: Record<string, unknown>;
  };
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function extractSummary(data: unknown): string {
  const s = JSON.stringify(data);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

/**
 * signal-bot `dispatchTradeSignal` JSON’u: `telegram.js` payload v2 + `degenClaw.serviceRequirements`.
 * HL v2: doğrudan Hyperliquid (ACP job yok). `size` = USDC notional (sayı).
 */
export async function executeSignalAutoTrade(
  agents: Map<string, AgentEntry>,
  raw: unknown
): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  const payload = raw as SignalPayloadV2;

  const req = payload.degenClaw?.serviceRequirements;
  if (!req || typeof req !== "object") {
    return { ok: false, lines: ["degenClaw.serviceRequirements yok"] };
  }
  if (req.action !== "open") {
    return { ok: false, lines: [`action=${String(req.action)} desteklenmiyor (yalnızca open)`] };
  }

  const hlCoin = typeof payload.hlCoin === "string" && payload.hlCoin ? payload.hlCoin : "";
  if (!hlCoin) {
    return { ok: false, lines: ["hlCoin zorunlu"] };
  }

  const side = req.side === "short" ? "short" : "long";
  const sizeUsd = Number.parseFloat(String(req.size ?? ""));
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) {
    return { ok: false, lines: ["serviceRequirements.size USDC notional olmalı (pozitif sayı)"] };
  }
  const leverage = Number.parseInt(String(req.leverage ?? "5"), 10);
  const lev = Number.isFinite(leverage) && leverage >= 1 ? leverage : 5;
  const pair = String(req.pair ?? hlCoin).toUpperCase();
  const stopLoss = req.stopLoss != null ? String(req.stopLoss).trim() : undefined;
  const takeProfit = req.takeProfit != null ? String(req.takeProfit).trim() : undefined;
  const orderType = req.orderType === "limit" ? "limit" : "market";
  const limitPrice =
    orderType === "limit" && req.limitPrice != null ? String(req.limitPrice).trim() : undefined;

  for (const agent of agents.values()) {
    if (!isAgentAutoTradeEnabled(agent)) {
      lines.push(`[${agent.alias}] oto-trade kapalı (AGENTS_JSON autoTrade:false)`);
      continue;
    }

    const key = `${agent.alias}:${hlCoin}`;
    const last = lastOpenByAgentPair.get(key) ?? 0;
    if (Date.now() - last < COOLDOWN_MS) {
      lines.push(`[${agent.alias}] ${hlCoin}: cooldown, atlandı`);
      continue;
    }

    let wallet: string | undefined;
    try {
      wallet = await resolveWalletAddress(agent);
    } catch (e) {
      lines.push(`[${agent.alias}] cüzdan çözülemedi: ${errMsg(e)}`);
      continue;
    }
    if (!wallet) {
      lines.push(`[${agent.alias}] cüzdan yok — hlWallet / walletAddress veya apiKey (/acp/me)`);
      continue;
    }

    let openCoins: Set<string>;
    try {
      openCoins = await fetchOpenHlCoins(wallet);
    } catch (e) {
      lines.push(`[${agent.alias}] HL pozisyon okunamadı: ${errMsg(e)}`);
      continue;
    }

    if (openCoins.has(hlCoin)) {
      lines.push(`[${agent.alias}] ${hlCoin}: zaten açık pozisyon, atlandı`);
      continue;
    }

    try {
      const data = await hlDirectOpen(agent, {
        pair,
        side,
        sizeUsd,
        leverage: lev,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        orderType,
        limitPrice,
      });
      lastOpenByAgentPair.set(key, Date.now());
      void tryForumTradeOpen(agent, {
        pair,
        side,
        sizeUsd,
        leverage: lev,
        stopLoss,
        takeProfit,
        orderType,
        limitPrice,
      }).catch((err) => console.error("[forum] signal", err));
      lines.push(`[${agent.alias}] ${pair} ${side} HL v2: ${extractSummary(data)}`);
    } catch (e) {
      lines.push(`[${agent.alias}] HL v2 hata: ${errMsg(e)}`);
    }
  }

  const ok = lines.some((l) => l.includes("HL v2:"));
  return { ok, lines };
}
