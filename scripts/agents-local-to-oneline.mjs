/**
 * agents.local.json → tek satır JSON (Railway / Vercel AGENTS_JSON alanı).
 * Kullanım: node scripts/agents-local-to-oneline.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "agents.local.json");

if (!fs.existsSync(src)) {
  console.error(`Bulunamadı: ${src}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(src, "utf8"));
if (!Array.isArray(data) || data.length === 0) {
  console.error("agents.local.json boş veya dizi değil.");
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(data)}\n`);
