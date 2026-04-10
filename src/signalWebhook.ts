import type { AgentEntry } from "./agents.js";
import { createAcpClient, jobPerpTradeOpenFull } from "./acp.js";
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

function extractJobId(data: unknown): string | number {
  if (data && typeof data === "object") {
    const d = data as { data?: { jobId?: number }; jobId?: number };
    const id = d.data?.jobId ?? d.jobId;
    if (id != null) return id;
  }
  return "?";
}

/**
 * signal-bot `dispatchTradeSignal` JSON’u: `telegram.js` payload v2 + `degenClaw.serviceRequirements`.
 * Her uygun agent için ACP perp_trade (limit+TP+SL) — signal-bot’taki `runAutoTradeOnSignal` ile aynı mantık.
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
      lines.push(`[${agent.alias}] cüzdan yok — AGENTS_JSON walletAddress veya ACP key`);
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
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpTradeOpenFull(client, { ...req });
      const jobId = extractJobId(data);
      lastOpenByAgentPair.set(key, Date.now());
      const pair = String(req.pair ?? "?");
      const side = String(req.side ?? "?");
      lines.push(`[${agent.alias}] ${pair} ${side} job #${jobId}`);
    } catch (e) {
      lines.push(`[${agent.alias}] ACP hata: ${errMsg(e)}`);
    }
  }

  const ok = lines.some((l) => l.includes("job #"));
  return { ok, lines };
}
