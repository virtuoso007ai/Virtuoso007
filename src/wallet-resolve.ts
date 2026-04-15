import type { AgentEntry } from "./agents.js";
import { createAcpClient } from "./acp.js";

/** alias → cüzdan (process ömrü boyunca; /acp/me tekrarını azaltır) */
const cacheByAlias = new Map<string, string>();

/**
 * Degen / leaderboard / pozisyon için cüzdan.
 * `hlWallet` varsa önce o (v2 / join-deposit sonrası gerçek HL adresi; /acp/me hâlâ legacy dönebilir).
 * Yoksa `GET /acp/me` (apiKey varsa), sonra `walletAddress`.
 */
export async function resolveWalletAddress(agent: AgentEntry): Promise<string | undefined> {
  const hlOverride = agent.hlWallet?.trim();
  if (hlOverride) {
    cacheByAlias.set(agent.alias, hlOverride);
    return hlOverride;
  }

  const hit = cacheByAlias.get(agent.alias);
  if (hit) return hit;

  const ak = agent.apiKey?.trim();
  if (ak) {
    try {
      const client = createAcpClient(ak);
      const { data } = await client.get<{ data?: { walletAddress?: string } }>("/acp/me");
      const w = data?.data?.walletAddress?.trim();
      if (w) {
        cacheByAlias.set(agent.alias, w);
        return w;
      }
    } catch {
      // ACP yanıt vermezse statik adrese düş
    }
  }

  return agent.walletAddress?.trim();
}
