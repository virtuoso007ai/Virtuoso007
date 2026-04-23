/**
 * dgclaw-skill `scripts/trade.ts` ile aynı kaynak: `HL_API_WALLET_KEY`, `HL_MASTER_ADDRESS`.
 * Çoklu agent: Railway'de JSON'a koymadan `HL_API_WALLET_KEY_<SUFFIX>` (örn. alias taxer-claw → TAXERCLAW).
 */
export function hlTradeEnvSuffix(aliasNormalized: string): string {
  const lc = aliasNormalized.trim().toLowerCase().replace(/^@/, "");
  return lc.replace(/[^a-z0-9]/g, "").toUpperCase();
}

export function hlApiWalletKeyFromEnv(aliasNormalized: string): string | undefined {
  const sfx = hlTradeEnvSuffix(aliasNormalized);
  const v = process.env[`HL_API_WALLET_KEY_${sfx}`]?.trim();
  if (v) return v;
  return undefined;
}

export function hlMasterAddressFromEnv(aliasNormalized: string): string | undefined {
  const sfx = hlTradeEnvSuffix(aliasNormalized);
  const v = process.env[`HL_MASTER_ADDRESS_${sfx}`]?.trim();
  if (v) return v;
  return undefined;
}

export function hlApiWalletAddressFromEnv(aliasNormalized: string): string | undefined {
  const sfx = hlTradeEnvSuffix(aliasNormalized);
  const v = process.env[`HL_API_WALLET_ADDRESS_${sfx}`]?.trim();
  if (v) return v;
  return undefined;
}

/**
 * hl-per-agent-env şablonundaki HL_SUBACCOUNT_ADDRESS → AGENTS_JSON `hlWallet` ile aynı rol.
 */
export function hlSubaccountAddressFromEnv(aliasNormalized: string): string | undefined {
  const sfx = hlTradeEnvSuffix(aliasNormalized);
  const v = process.env[`HL_SUBACCOUNT_ADDRESS_${sfx}`]?.trim();
  if (v) return v;
  return undefined;
}

export function applyHlTradeEnvToAgent<
  T extends { alias: string; walletAddress?: string; hlApiWalletKey?: string; hlWallet?: string },
>(agent: T, soleAgent: boolean): T {
  let hlApiWalletKey = agent.hlApiWalletKey?.trim() || hlApiWalletKeyFromEnv(agent.alias);
  let walletAddress = agent.walletAddress?.trim() || hlMasterAddressFromEnv(agent.alias);
  let hlWallet = agent.hlWallet?.trim() || hlSubaccountAddressFromEnv(agent.alias);
  if (soleAgent) {
    const gk = process.env.HL_API_WALLET_KEY?.trim();
    const gm = process.env.HL_MASTER_ADDRESS?.trim();
    const gs = process.env.HL_SUBACCOUNT_ADDRESS?.trim();
    if (!hlApiWalletKey && gk) hlApiWalletKey = gk;
    if (!walletAddress && gm) walletAddress = gm;
    if (!hlWallet && gs) hlWallet = gs;
  }
  return {
    ...agent,
    hlApiWalletKey: hlApiWalletKey || undefined,
    walletAddress: walletAddress || undefined,
    hlWallet: hlWallet || undefined,
  };
}
