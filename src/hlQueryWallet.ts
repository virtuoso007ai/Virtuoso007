/**
 * Degen / HL okumaları — dashboard `hlQueryWallet.ts` ile aynı öncelik.
 */
import { privateKeyToAccount } from "viem/accounts";
import type { AgentEntry } from "./agents.js";
import { hlApiWalletAddressFromEnv } from "./hlAgentSecretsFromEnv.js";

function normalizePk(raw: string): `0x${string}` | null {
  const s = raw.trim();
  const hex = s.startsWith("0x") ? s : `0x${s}`;
  if (!/^0x[0-9a-fA-F]{64}$/i.test(hex)) return null;
  return hex as `0x${string}`;
}

export function resolveHlApiMaterialAddress(agent: AgentEntry): string | undefined {
  const pk = agent.hlApiWalletKey?.trim();
  if (pk) {
    const hex = normalizePk(pk);
    if (hex) {
      try {
        return privateKeyToAccount(hex).address;
      } catch {
        /* */
      }
    }
  }
  const envAddr = hlApiWalletAddressFromEnv(agent.alias)?.trim();
  if (envAddr && /^0x[a-fA-F0-9]{40}$/i.test(envAddr)) {
    return envAddr;
  }
  return undefined;
}

export function resolveHlQueryWallet(agent: AgentEntry): string | undefined {
  return (
    resolveHlApiMaterialAddress(agent) ||
    agent.hlWallet?.trim() ||
    agent.walletAddress?.trim()
  );
}
