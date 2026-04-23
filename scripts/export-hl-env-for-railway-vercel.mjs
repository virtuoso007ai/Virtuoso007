/**
 * hl-per-agent-env/<alias>.env → Railway / Vercel suffixed HL değişkenleri
 * + agents.local.json → AGENTS_JSON.paste.txt (npm run agents:json:merge ile aynı mantık;
 *   hlWallet: secrets/hl-api-wallets.env + hl-per-agent-env adresleri birleşir, hlApiWalletKey silinir).
 *
 *   npm run hl:export-railway-vercel
 *   npm run hl:export-railway-vercel -- --out=RAILWAY_VERCEL_HL_ENV.paste.txt
 *   npm run hl:export-railway-vercel -- --skip-agents-json   (AGENTS_JSON.paste.txt yazma)
 *
 * Çıktı: repoda tutma (gitignore).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveRoot() {
  const oneUp = path.join(__dirname, "..");
  if (fs.existsSync(path.join(oneUp, "hl-per-agent-env"))) return oneUp;
  const twoUp = path.join(__dirname, "..", "..");
  if (fs.existsSync(path.join(twoUp, "hl-per-agent-env"))) return twoUp;
  return oneUp;
}

const root = resolveRoot();
const hlDir = path.join(root, "hl-per-agent-env");
const agentsPath = path.join(root, "agents.local.json");
const secretsPath = path.join(root, "secrets", "hl-api-wallets.env");

function parseArgs() {
  const a = process.argv.slice(2);
  let outRel = "RAILWAY_VERCEL_HL_ENV.paste.txt";
  let skipAgentsJson = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--out" && a[i + 1]) {
      outRel = a[i + 1];
      i++;
    } else if (a[i]?.startsWith("--out=")) {
      outRel = a[i].slice("--out=".length).trim();
    } else if (a[i] === "--skip-agents-json") {
      skipAgentsJson = true;
    }
  }
  const outAbs = path.isAbsolute(outRel) ? outRel : path.join(root, outRel);
  return { outAbs, skipAgentsJson };
}

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

function aliasSuffix(alias) {
  return alias
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
}

function isAddr40(s) {
  return /^0x[0-9a-fA-F]{40}$/i.test(String(s).trim());
}

function isPk64(s) {
  return /^0x[0-9a-fA-F]{64}$/i.test(String(s).trim());
}

function collectFromPerAgentFiles() {
  /** @type {Record<string, string>} */
  const flat = {};
  /** @type {Record<string, { walletAddress?: string; hlApiWalletKey?: string; hlWallet?: string }>} */
  const secretsJson = {};

  if (!fs.existsSync(hlDir)) {
    console.error(`Klasör yok: ${hlDir}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(hlDir)
    .filter((f) => f.endsWith(".env") && !f.startsWith("_") && f.toLowerCase() !== "readme.env");

  if (files.length === 0) {
    console.error(`hl-per-agent-env icinde .env yok: ${hlDir}`);
    process.exit(1);
  }

  const warnings = [];

  for (const f of files) {
    const alias = f.replace(/\.env$/i, "").trim();
    if (!alias) continue;
    const sfx = aliasSuffix(alias);
    const p = path.join(hlDir, f);
    let map;
    try {
      map = parseDotEnv(fs.readFileSync(p, "utf-8"));
    } catch (e) {
      warnings.push(`${f}: okunamadi`);
      continue;
    }

    const master = String(map.HL_MASTER_ADDRESS ?? "").trim();
    const pk = String(map.HL_API_WALLET_KEY ?? "").trim();
    const sub = String(map.HL_SUBACCOUNT_ADDRESS ?? "").trim();
    const apiAddr = String(map.HL_API_WALLET_ADDRESS ?? "").trim();

    if (isAddr40(master)) flat[`HL_MASTER_ADDRESS_${sfx}`] = master;
    else if (master) warnings.push(`${alias}: HL_MASTER_ADDRESS gecersiz, atlandi`);

    if (isPk64(pk)) flat[`HL_API_WALLET_KEY_${sfx}`] = pk;
    else if (pk) warnings.push(`${alias}: HL_API_WALLET_KEY gecersiz (64 hex degil), atlandi`);
    else warnings.push(`${alias}: HL_API_WALLET_KEY bos — trade calismaz`);

    if (isAddr40(sub)) flat[`HL_SUBACCOUNT_ADDRESS_${sfx}`] = sub;
    if (isAddr40(apiAddr)) flat[`HL_API_WALLET_ADDRESS_${sfx}`] = apiAddr;
    else if (isAddr40(sub) && !flat[`HL_API_WALLET_ADDRESS_${sfx}`]) {
      flat[`HL_API_WALLET_ADDRESS_${sfx}`] = sub;
    }

    const block = {};
    if (isPk64(pk)) block.hlApiWalletKey = pk;
    if (isAddr40(master)) block.walletAddress = master;
    const hw = isAddr40(sub) ? sub : isAddr40(apiAddr) ? apiAddr : undefined;
    if (hw) block.hlWallet = hw;
    if (Object.keys(block).length) secretsJson[alias.toLowerCase()] = block;
  }

  for (const w of warnings) console.error(`Uyari: ${w}`);

  return { flat, secretsJson, fileCount: files.length };
}

/** merge-agents-json-from-secrets.mjs: secrets icindeki HL_API_WALLET_ADDRESS_* */
function loadSecretsHlAddresses() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(secretsPath)) return out;
  const map = parseDotEnv(fs.readFileSync(secretsPath, "utf-8"));
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith("HL_API_WALLET_ADDRESS_")) continue;
    const addr = String(v).trim();
    if (/^0x[0-9a-fA-F]{40}$/i.test(addr)) out[k] = addr;
  }
  return out;
}

/** hl-per-agent-env: HL_API_WALLET_ADDRESS veya HL_SUBACCOUNT_ADDRESS → HL_API_WALLET_ADDRESS_<SFX> */
function loadPerAgentHlAddresses() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(hlDir)) return out;
  for (const f of fs.readdirSync(hlDir)) {
    if (!f.endsWith(".env") || f.startsWith("_") || f.toLowerCase() === "readme.env") continue;
    const alias = f.replace(/\.env$/i, "").trim();
    if (!alias) continue;
    const sfx = aliasSuffix(alias);
    let map;
    try {
      map = parseDotEnv(fs.readFileSync(path.join(hlDir, f), "utf-8"));
    } catch {
      continue;
    }
    const apiAddr = String(map.HL_API_WALLET_ADDRESS ?? "").trim();
    const sub = String(map.HL_SUBACCOUNT_ADDRESS ?? "").trim();
    const addr = /^0x[0-9a-fA-F]{40}$/i.test(apiAddr)
      ? apiAddr
      : /^0x[0-9a-fA-F]{40}$/i.test(sub)
        ? sub
        : "";
    if (addr) out[`HL_API_WALLET_ADDRESS_${sfx}`] = addr;
  }
  return out;
}

/**
 * agents:json:merge ile aynı: hlWallet <- HL_API_WALLET_ADDRESS_* (secrets uzerine per-agent env),
 * hlApiWalletKey kaldirilir. Tek satir JSON.
 */
function buildMergedAgentsJsonLine() {
  if (!fs.existsSync(agentsPath)) return null;
  const agents = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
  if (!Array.isArray(agents)) throw new Error("agents.local.json dizi degil");
  const addrBySfx = { ...loadSecretsHlAddresses(), ...loadPerAgentHlAddresses() };
  for (const row of agents) {
    if (!row || typeof row !== "object") continue;
    const alias = String(row.alias ?? "").trim();
    if (!alias) continue;
    const key = `HL_API_WALLET_ADDRESS_${aliasSuffix(alias)}`;
    const addr = addrBySfx[key];
    if (addr && /^0x[0-9a-fA-F]{40}$/i.test(addr)) {
      row.hlWallet = addr;
    }
    if (row.hlApiWalletKey != null) delete row.hlApiWalletKey;
  }
  return JSON.stringify(agents);
}

function main() {
  const { outAbs, skipAgentsJson } = parseArgs();
  const { flat, secretsJson, fileCount } = collectFromPerAgentFiles();

  const keys = Object.keys(flat).sort();
  if (keys.length === 0) {
    console.error("Cikti yok: gecerli HL_MASTER / HL_API_WALLET_KEY bulunamadi.");
    process.exit(1);
  }

  const lines = [
    "# =============================================================================",
    "# Railway + Vercel (Degen Dashboard / Bot) — HL v2 ortam degiskenleri",
    "# hl-per-agent-env/*.env dosyalarindan uretildi — COMMIT ETME",
    `# Kaynak: ${fileCount} dosya, ${keys.length} satir`,
    "#",
    "# Railway: Variables sekmesinde toplu import / tek tek yapistir.",
    "# Vercel: Project Settings → Environment Variables → her KEY icin VALUE.",
    "#",
    "# NOT: AGENTS_JSON — agents.local.json + adres merge; ayrica AGENTS_JSON.paste.txt yazilir.",
    "# NOT: HL_TRADE_SECRETS_JSON tek secret alternatifi (dashboard); deger TEK SATIR.",
    "# =============================================================================",
    "",
    "# --- A) Suffixed HL (Railway / Vercel Environment Variables) ---",
    "",
  ];

  for (const k of keys) {
    lines.push(`${k}=${flat[k]}`);
  }

  const jsonLine = JSON.stringify(secretsJson);
  lines.push("");
  lines.push("# --- B) Isteg bagli: tek Vercel/Railway secret (Degen Dashboard HL_TRADE_SECRETS_JSON) ---");
  lines.push("# Degisken adi: HL_TRADE_SECRETS_JSON");
  lines.push("# Deger (asagidaki TEK satiri kopyala; bolum basliklarini DAHIL ETME):");
  lines.push(jsonLine);
  lines.push("");

  if (!skipAgentsJson) {
    try {
      const oneLine = buildMergedAgentsJsonLine();
      if (oneLine) {
        lines.push("# --- C) AGENTS_JSON (npm run agents:json:merge ile ayni mantik + per-agent env adres) ---");
        lines.push("# Degisken adi: AGENTS_JSON");
        lines.push("# Deger (tek satir, basinda/sonunda tirnak yok):");
        lines.push(oneLine);
        lines.push("");
        const agentsPastePath = path.join(root, "AGENTS_JSON.paste.txt");
        fs.writeFileSync(agentsPastePath, `${oneLine}\n`, "utf-8");
        console.error(`Yazildi: ${agentsPastePath} (${oneLine.length + 1} byte) — agents:json:merge`);
      } else {
        console.error(`Atlandi: ${agentsPath} yok (AGENTS_JSON)`);
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  fs.writeFileSync(outAbs, lines.join("\n") + "\n", "utf-8");
  console.error(`Yazildi: ${outAbs}`);
  console.error(`  HL satiri: ${keys.length}`);
  console.error(`  HL_TRADE_SECRETS_JSON: ${jsonLine.length} byte (tek satir)`);
  if (skipAgentsJson) console.error("  AGENTS_JSON: --skip-agents-json");
}

main();
