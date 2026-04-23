/**
 * Virtuals UI veya başka yerden kopyalanan Lite `acp-...` key'ini doğrular (GET /acp/me),
 * telegram-degen-bot/agents.local.json içinde alias satırını günceller.
 *
 *   node scripts/set-agents-local-lite-key.mjs <alias> <acp-key>
 *   AGENTS_JSON_PATH=./path.json node scripts/set-agents-local-lite-key.mjs taxerclaw acp-...
 *
 * --strict: /acp/me wallet, json'daki hlWallet veya walletAddress ile aynı olmalı (wolfy set-lite-api-key gibi).
 * Varsayılan: key geçerliyse apiKey + walletAddress=/acp/me güncellenir; hlWallet varsa korunur (hyperliquidUser için).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const CLAW = process.env.ACP_API_URL?.trim() || "https://claw-api.virtuals.io";

function parseArgs() {
  const a = process.argv.slice(2).filter((x) => x !== "--strict");
  const strict = process.argv.includes("--strict");
  const alias = (a[0] || "").trim().toLowerCase();
  const key = (a[1] || "").trim();
  const fileArg = (a[2] || "").trim();
  return { alias, key, strict, fileArg };
}

async function fetchMe(apiKey) {
  const r = await fetch(`${CLAW}/acp/me`, {
    headers: { "x-api-key": apiKey },
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`/acp/me JSON değil (${r.status}): ${text.slice(0, 200)}`);
  }
  if (!r.ok) {
    throw new Error(`/acp/me ${r.status}: ${text.slice(0, 300)}`);
  }
  const w = data?.data?.walletAddress?.trim();
  if (!w) throw new Error(`/acp/me cevabında walletAddress yok: ${JSON.stringify(data)}`);
  return { walletAddress: w, raw: data };
}

async function main() {
  const { alias, key, strict, fileArg } = parseArgs();
  if (!alias || !key.startsWith("acp-")) {
    console.error(
      "Kullanım: node scripts/set-agents-local-lite-key.mjs <alias> <acp-key> [agents.json yolu] [--strict]"
    );
    process.exit(1);
  }

  const rel =
    fileArg ||
    process.env.AGENTS_JSON_PATH?.trim() ||
    path.join("telegram-degen-bot", "agents.local.json");
  const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);

  const raw = readFileSync(abs, "utf-8");
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error("agents dosyası dizi değil");

  const idx = list.findIndex((r) => String(r?.alias || "").toLowerCase() === alias);
  if (idx === -1) throw new Error(`Alias bulunamadı: ${alias}`);

  const { walletAddress } = await fetchMe(key);
  const row = list[idx];
  const prevHl = String(row.hlWallet || "").trim().toLowerCase();
  const prevW = String(row.walletAddress || "").trim().toLowerCase();
  const me = walletAddress.toLowerCase();

  if (strict) {
    const ok = me === prevHl || me === prevW;
    if (!ok) {
      throw new Error(
        `[--strict] /acp/me=${walletAddress} ama kayıtta walletAddress=${row.walletAddress || "?"} hlWallet=${row.hlWallet || "?"}`
      );
    }
  }

  row.apiKey = key;
  row.walletAddress = walletAddress;
  if (!row.hlWallet && prevHl) row.hlWallet = prevHl;
  writeFileSync(abs, JSON.stringify(list, null, 2) + "\n", "utf-8");
  console.log(`OK — ${abs}`);
  console.log(`  alias=${alias} apiKey güncellendi`);
  console.log(`  /acp/me walletAddress=${walletAddress}`);
  if (row.hlWallet && row.hlWallet.toLowerCase() !== me) {
    console.log(
      `  hlWallet=${row.hlWallet} (farklı; Telegram/dashboard perp job'larında hyperliquidUser olarak kullanılıyor)`
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
