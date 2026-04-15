import * as fs from "fs";
import * as path from "path";
import { applyHlTradeEnvToAgent } from "./hlAgentSecretsFromEnv.js";

export type AgentEntry = {
  /** Kısa ad: /open raichu ... */
  alias: string;
  /** ACP LITE agent API key (acp-...) — HL-only agentlarda opsiyonel; /acp/me ile cüzdan çözmek için */
  apiKey?: string;
  /** Opsiyonel görünen isim */
  label?: string;
  /** Degen Claw (HL) cüzdanı — /positions için */
  walletAddress?: string;
  /** Hyperliquid subaccount cüzdanı (açık limitler buradan sorgulanır; yoksa walletAddress kullanılır) */
  hlWallet?: string;
  /** `false` ise /webhook/signal oto-açmaz (signal-bot AGENTS_JSON ile uyumlu). */
  autoTrade?: boolean;
  /** Degen Claw forum API key (dgc_...) - dashboard için */
  forumApiKey?: string;
  /**
   * HL API cüzdan private key (0x + 64 hex) — perp open/close/modify/cancel doğrudan Hyperliquid.
   * Repoya koyma; Railway/Vercel secret veya volume dosyası.
   */
  hlApiWalletKey?: string;
};

function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

function parseAgentsJson(raw: string): Map<string, AgentEntry> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Agent JSON geçersiz");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Agent listesi boş veya dizi değil");
  }
  const map = new Map<string, AgentEntry>();
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const alias = normalizeAlias(String((row as { alias?: string }).alias ?? ""));
    const apiKey = String((row as { apiKey?: string }).apiKey ?? "").trim();
    if (!alias) continue;
    if (map.has(alias)) throw new Error(`Yinelenen alias: ${alias}`);
    const walletRaw = (row as { walletAddress?: string }).walletAddress?.trim();
    const hlWalletRaw = (row as { hlWallet?: string }).hlWallet?.trim();
    const autoRaw = (row as { autoTrade?: boolean }).autoTrade;
    const forumKeyRaw = (row as { forumApiKey?: string }).forumApiKey?.trim();
    const hlPkRaw = (row as { hlApiWalletKey?: string }).hlApiWalletKey?.trim();
    map.set(alias, {
      alias,
      apiKey: apiKey || undefined,
      label: (row as { label?: string }).label?.trim(),
      walletAddress: walletRaw || undefined,
      hlWallet: hlWalletRaw || undefined,
      autoTrade: typeof autoRaw === "boolean" ? autoRaw : undefined,
      forumApiKey: forumKeyRaw || undefined,
      hlApiWalletKey: hlPkRaw || undefined,
    });
  }
  if (map.size === 0) throw new Error("Geçerli agent yok");
  const sole = map.size === 1;
  for (const k of [...map.keys()]) {
    map.set(k, applyHlTradeEnvToAgent(map.get(k)!, sole));
  }
  return map;
}

/** Önce `AGENTS_JSON`, yoksa `AGENTS_JSON_PATH` dosyası (Railway / volume). */
export function loadAgents(): Map<string, AgentEntry> {
  const inline = process.env.AGENTS_JSON?.trim();
  if (inline) {
    return parseAgentsJson(inline);
  }
  const filePath = process.env.AGENTS_JSON_PATH?.trim();
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(abs)) {
      throw new Error(`AGENTS_JSON_PATH bulunamadı: ${abs}`);
    }
    return parseAgentsJson(fs.readFileSync(abs, "utf-8"));
  }
  throw new Error(
    "AGENTS_JSON veya AGENTS_JSON_PATH gerekli. Örnek: agents.example.json kopyala, anahtarları doldur."
  );
}

export function getAgent(map: Map<string, AgentEntry>, alias: string): AgentEntry | undefined {
  return map.get(normalizeAlias(alias));
}

/** HL subaccount cüzdanı — önce `hlWallet`, yoksa `walletAddress`. */
export function getHlWallet(agent: AgentEntry): string | undefined {
  return agent.hlWallet?.trim() || agent.walletAddress?.trim();
}
