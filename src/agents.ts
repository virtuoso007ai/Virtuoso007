import * as fs from "fs";
import * as path from "path";

export type AgentEntry = {
  /** Kısa ad: /open raichu ... */
  alias: string;
  /** ACP LITE agent API key (acp-...) */
  apiKey: string;
  /** Opsiyonel görünen isim */
  label?: string;
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
    if (!alias || !apiKey) continue;
    if (map.has(alias)) throw new Error(`Yinelenen alias: ${alias}`);
    map.set(alias, {
      alias,
      apiKey,
      label: (row as { label?: string }).label?.trim(),
    });
  }
  if (map.size === 0) throw new Error("Geçerli agent yok");
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
