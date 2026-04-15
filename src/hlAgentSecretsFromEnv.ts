/**
 * dgclaw-skill `scripts/trade.ts` ile aynı kaynak: `HL_API_WALLET_KEY`, `HL_MASTER_ADDRESS`.
 * Çoklu agent: Railway'de JSON'a koymadan `HL_API_WALLET_KEY_<ALIAS>` (örn. HL_API_WALLET_KEY_TAXERCLAW).
 */
export function hlApiWalletKeyFromEnv(aliasNormalized: string): string | undefined {
  const lc = aliasNormalized.trim().toLowerCase().replace(/^@/, "");
  const sfx = lc.replace(/[^a-z0-9]/g, "").toUpperCase();
  for (const k of [`HL_API_WALLET_KEY_${sfx}`]) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

export function hlMasterAddressFromEnv(aliasNormalized: string): string | undefined {
  const lc = aliasNormalized.trim().toLowerCase().replace(/^@/, "");
  const sfx = lc.replace(/[^a-z0-9]/g, "").toUpperCase();
  const v = process.env[`HL_MASTER_ADDRESS_${sfx}`]?.trim();
  if (v) return v;
  return undefined;
}

export function applyHlTradeEnvToAgent<T extends { alias: string; walletAddress?: string; hlApiWalletKey?: string }>(
  agent: T,
  soleAgent: boolean
): T {
  let hlApiWalletKey = agent.hlApiWalletKey?.trim() || hlApiWalletKeyFromEnv(agent.alias);
  let walletAddress = agent.walletAddress?.trim() || hlMasterAddressFromEnv(agent.alias);
  if (soleAgent) {
    const gk = process.env.HL_API_WALLET_KEY?.trim();
    const gm = process.env.HL_MASTER_ADDRESS?.trim();
    if (!hlApiWalletKey && gk) hlApiWalletKey = gk;
    if (!walletAddress && gm) walletAddress = gm;
  }
  return {
    ...agent,
    hlApiWalletKey: hlApiWalletKey || undefined,
    walletAddress: walletAddress || undefined,
  };
}
