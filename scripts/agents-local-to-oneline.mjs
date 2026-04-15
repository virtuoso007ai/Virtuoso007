/**
 * agents.local.json → tek satır JSON (Railway / Vercel AGENTS_JSON alanı).
 * Kullanım:
 *   node scripts/agents-local-to-oneline.mjs
 *   node scripts/agents-local-to-oneline.mjs --out=AGENTS_JSON.paste.txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "agents.local.json");

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = outArg ? path.join(root, outArg.slice("--out=".length).trim()) : null;

if (!fs.existsSync(src)) {
  console.error(`Bulunamadı: ${src}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(src, "utf8"));
if (!Array.isArray(data) || data.length === 0) {
  console.error("agents.local.json boş veya dizi değil.");
  process.exit(1);
}

function aliasesMissingHlApiWalletKey(rows) {
  const missing = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const alias = String(row.alias ?? "").trim();
    const pk = String(row.hlApiWalletKey ?? "").trim();
    if (!alias) continue;
    if (!pk) missing.push(alias);
  }
  return missing;
}

const line = `${JSON.stringify(data)}\n`;
if (outPath) {
  const missing = aliasesMissingHlApiWalletKey(data);
  if (missing.length > 0) {
    console.error(
      "UYARI: JSON'da hlApiWalletKey eksik alias(lar): " +
        missing.join(", ") +
        "\n→ Ya agents.local.json'a ekleyin ya da Railway'de HL_API_WALLET_KEY_<ALIAS> (dgclaw trade.ts .env ile aynı mantık).\n"
    );
  }
  fs.writeFileSync(outPath, line, "utf8");
  console.error(`Yazıldı: ${outPath} (${line.length} byte) — Railway AGENTS_JSON + ayrıca HL_API_WALLET_KEY_* secret'ları.`);
} else {
  const missing = aliasesMissingHlApiWalletKey(data);
  for (const a of missing) {
    console.warn(`[${a}] hlApiWalletKey yok — HL v2 /open bu agentta çalışmaz.`);
  }
  process.stdout.write(line);
}
