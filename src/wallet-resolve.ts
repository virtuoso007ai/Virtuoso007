import type { AgentEntry } from "./agents.js";
import { createAcpClient } from "./acp.js";
import { resolveHlApiMaterialAddress } from "./hlQueryWallet.js";

/** alias → cüzdan (process ömrü boyunca; /acp/me tekrarını azaltır) */
const cacheByAlias = new Map<string, string>();

/**
 * Degen / leaderboard / pozisyon için cüzdan.
 * Öncelik: HL_API_WALLET_KEY → adres, HL_API_WALLET_ADDRESS_* → hlWallet → /acp/me → master.
 */
export async function resolveWalletAddress(agent: AgentEntry): Promise<string | undefined> {
  const mat = resolveHlApiMaterialAddress(agent);
  if (mat) {
    cacheByAlias.set(agent.alias, mat);
    return mat;
  }

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
