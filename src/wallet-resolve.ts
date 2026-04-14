import type { AgentEntry } from "./agents.js";
import { createAcpClient } from "./acp.js";

/** apiKey → wallet (process ömrü boyunca; /acp/me tekrarını azaltır) */
const cacheByApiKey = new Map<string, string>();

/**
 * Degen / leaderboard / pozisyon için cüzdan.
 * `hlWallet` varsa önce o (v2 / join-deposit sonrası gerçek HL adresi; /acp/me hâlâ legacy dönebilir).
 * Yoksa `GET /acp/me`, sonra `walletAddress`.
 */
export async function resolveWalletAddress(agent: AgentEntry): Promise<string | undefined> {
  const hlOverride = agent.hlWallet?.trim();
  if (hlOverride) {
    cacheByApiKey.set(agent.apiKey, hlOverride);
    return hlOverride;
  }

  const hit = cacheByApiKey.get(agent.apiKey);
  if (hit) return hit;

  try {
    const client = createAcpClient(agent.apiKey);
    const { data } = await client.get<{ data?: { walletAddress?: string } }>("/acp/me");
    const w = data?.data?.walletAddress?.trim();
    if (w) {
      cacheByApiKey.set(agent.apiKey, w);
      return w;
    }
  } catch {
    // ACP yanıt vermezse statik adrese düş
  }

  return agent.walletAddress?.trim();
}
