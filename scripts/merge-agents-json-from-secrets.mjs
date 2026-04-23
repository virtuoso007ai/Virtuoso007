/**
 * agents.local.json + secrets/hl-api-wallets.env (HL_API_WALLET_ADDRESS_*) → güncel hlWallet.
 * Private key ASLA AGENTS_JSON'a yazılmaz (HL_API_WALLET_KEY_* sadece env).
 *
 *   node scripts/merge-agents-json-from-secrets.mjs
 *   node scripts/merge-agents-json-from-secrets.mjs --out=AGENTS_JSON.paste.txt
 *   node scripts/merge-agents-json-from-secrets.mjs --write-local
 *
 * AGENTS_JSON.paste.txt ayrica: npm run hl:export-railway-vercel (hlWallet + secrets + hl-per-agent-env)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function resolveRoot() {
  const oneUp = path.join(__dirname, "..");
  if (fs.existsSync(path.join(oneUp, "agents.local.json"))) return oneUp;
  const twoUp = path.join(__dirname, "..", "..");
  if (fs.existsSync(path.join(twoUp, "agents.local.json"))) return twoUp;
  return oneUp;
}

const r = resolveRoot();
const agentsPath = path.join(r, "agents.local.json");
const secretsPath = path.join(r, "secrets", "hl-api-wallets.env");

function parseDotEnv(content) {
  const m = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    m[k] = v;
  }
  return m;
}

function sfx(alias) {
  return String(alias ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
}

function loadSecretsAddresses() {
  if (!fs.existsSync(secretsPath)) {
    console.error(`Bulunamadı: ${secretsPath}`);
    return {};
  }
  const map = parseDotEnv(fs.readFileSync(secretsPath, "utf-8"));
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith("HL_API_WALLET_ADDRESS_")) continue;
    const addr = String(v).trim();
    if (/^0x[0-9a-fA-F]{40}$/i.test(addr)) out[k] = addr;
  }
  return out;
}

const writeLocal = process.argv.includes("--write-local");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const outFile = outArg ? path.join(r, outArg.slice("--out=".length).trim()) : null;

if (!fs.existsSync(agentsPath)) {
  console.error(`Bulunamadı: ${agentsPath}`);
  process.exit(1);
}

const agents = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
if (!Array.isArray(agents)) {
  console.error("agents.local.json dizi değil.");
  process.exit(1);
}

const addrBySfx = loadSecretsAddresses();
let updated = 0;
for (const row of agents) {
  if (!row || typeof row !== "object") continue;
  const alias = String(row.alias ?? "").trim();
  if (!alias) continue;
  const key = `HL_API_WALLET_ADDRESS_${sfx(alias)}`;
  const addr = addrBySfx[key];
  if (addr) {
    const prev = String(row.hlWallet ?? "").trim().toLowerCase();
    if (prev !== addr.toLowerCase()) {
      row.hlWallet = addr;
      updated++;
    }
  }
  if (row.hlApiWalletKey != null) delete row.hlApiWalletKey;
}

if (writeLocal) {
  fs.writeFileSync(agentsPath, `${JSON.stringify(agents, null, 2)}\n`, "utf8");
  console.error(`Guncellendi: ${agentsPath} (hlWallet: ${updated} satir secrets ile esitlendi)`);
}

const line = `${JSON.stringify(agents)}\n`;
if (outFile) {
  fs.writeFileSync(outFile, line, "utf8");
  console.error(`Yazildi: ${outFile} (${line.length} byte)`);
} else {
  process.stdout.write(line);
}
