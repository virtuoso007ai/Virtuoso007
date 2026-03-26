import type { AgentEntry } from "./agents.js";
import { createAcpClient } from "./acp.js";

/** apiKey → wallet (process ömrü boyunca; /acp/me tekrarını azaltır) */
const cacheByApiKey = new Map<string, string>();

/**
 * Önce `agent.walletAddress`, yoksa `GET /acp/me` (aynı ACP API anahtarı).
 * Railway’de AGENTS_JSON’a cüzdan yazmak zorunlu değil.
 */
export async function resolveWalletAddress(agent: AgentEntry): Promise<string | undefined> {
  const manual = agent.walletAddress?.trim();
  if (manual) return manual;

  const hit = cacheByApiKey.get(agent.apiKey);
  if (hit) return hit;

  try {
    const client = createAcpClient(agent.apiKey);
    const { data } = await client.get<{ data?: { walletAddress?: string } }>("/acp/me");
    const w = data?.data?.walletAddress?.trim();
    if (w) cacheByApiKey.set(agent.apiKey, w);
    return w;
  } catch {
    return undefined;
  }
}
