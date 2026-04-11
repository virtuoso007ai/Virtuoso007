import { createAcpClient } from "./acp.js";
/** apiKey → wallet (process ömrü boyunca; /acp/me tekrarını azaltır) */
const cacheByApiKey = new Map();
/**
 * Degen / leaderboard / pozisyon için cüzdan: önce `GET /acp/me` (Virtuals kaynaklı),
 * yoksa `agent.walletAddress`. Böylece AGENTS_JSON’daki eski adres Degen’i bozmaz.
 */
export async function resolveWalletAddress(agent) {
    const hit = cacheByApiKey.get(agent.apiKey);
    if (hit)
        return hit;
    try {
        const client = createAcpClient(agent.apiKey);
        const { data } = await client.get("/acp/me");
        const w = data?.data?.walletAddress?.trim();
        if (w) {
            cacheByApiKey.set(agent.apiKey, w);
            return w;
        }
    }
    catch {
        // ACP yanıt vermezse statik adrese düş
    }
    return agent.walletAddress?.trim();
}
