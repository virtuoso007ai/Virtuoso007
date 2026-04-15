/**
 * Hyperliquid API wallet private key'leri tek dosyada:
 *   telegram-degen-bot/secrets/hl-api-wallets.env  (gitignore — repoya girmez)
 *
 * Bu script, o dosyadaki HL_API_WALLET_KEY_<ALIAS> satırlarını telegram-degen-bot/.env içine yazar
 * (bot + loadAgents / applyHlTradeEnvToAgent ile uyumlu).
 *
 * Öncelik: secrets/hl-api-wallets.env
 * Yoksa: hl-per-agent-env/<alias>.env içindeki HL_API_WALLET_KEY (geriye dönük)
 *
 * İlk kurulum / dağınık dosyalardan toplamak için:
 *   node scripts/sync-hl-api-keys.mjs --bootstrap
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const secretsPath = path.join(root, "secrets", "hl-api-wallets.env");
const hlDir = path.join(root, "hl-per-agent-env");
const envPath = path.join(root, ".env");

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

function envKeyForAlias(alias) {
  const sfx = alias
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
  return `HL_API_WALLET_KEY_${sfx}`;
}

function upsertEnvKey(content, key, value) {
  const lines = content.length ? content.split("\n") : [];
  const prefix = `${key}=`;
  let i = lines.findIndex((l) => l.startsWith(prefix));
  const line = `${key}=${value}`;
  if (i >= 0) lines[i] = line;
  else {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push("# HL API keys (secrets/hl-api-wallets.env — repoya commit etme)");
    lines.push(line);
  }
  let out = lines.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

function collectFromPerAgentDir() {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(hlDir)) return out;
  const files = fs.readdirSync(hlDir).filter((f) => f.endsWith(".env") && !f.startsWith("_"));
  for (const f of files) {
    const alias = f.replace(/\.env$/i, "");
    if (!alias || alias === "README") continue;
    const p = path.join(hlDir, f);
    const map = parseDotEnv(fs.readFileSync(p, "utf-8"));
    const pk = String(map.HL_API_WALLET_KEY ?? "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/i.test(pk)) continue;
    out[envKeyForAlias(alias)] = pk;
  }
  return out;
}

function collectFromSecretsFile() {
  if (!fs.existsSync(secretsPath)) return {};
  const map = parseDotEnv(fs.readFileSync(secretsPath, "utf-8"));
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith("HL_API_WALLET_KEY_")) continue;
    const pk = String(v).trim();
    if (!/^0x[0-9a-fA-F]{64}$/i.test(pk)) continue;
    out[k] = pk;
  }
  return out;
}

function bootstrapSecretsFile() {
  const merged = collectFromPerAgentDir();
  const keys = Object.keys(merged).sort();
  if (keys.length === 0) {
    console.error("hl-per-agent-env icinde gecerli HL_API_WALLET_KEY yok.");
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
  const lines = [
    "# Hyperliquid API wallet private keys (0x + 64 hex). Bu dosya .gitignore — commit etme.",
    "# Railway / Vercel: ayni isimli Environment Variables (HL_API_WALLET_KEY_RAICHU vb.)",
    "",
  ];
  for (const k of keys) {
    lines.push(`${k}=${merged[k]}`);
  }
  lines.push("");
  fs.writeFileSync(secretsPath, lines.join("\n"), "utf-8");
  console.error(`Olusturuldu: ${secretsPath} (${keys.length} anahtar)`);
}

function syncToDotEnv() {
  /** Once secrets, uzerine hl-per-agent-env (yeni agent / add-api-wallet sonrasi). */
  const fromSecrets = collectFromSecretsFile();
  const fromPerAgent = collectFromPerAgentDir();
  const merged = { ...fromSecrets, ...fromPerAgent };
  let source = "secrets/hl-api-wallets.env";
  if (Object.keys(fromPerAgent).length > 0) {
    source += " + hl-per-agent-env/*.env";
  }
  if (Object.keys(merged).length === 0) {
    console.error(
      "HL anahtari bulunamadi. Olustur: node scripts/sync-hl-api-keys.mjs --bootstrap\n" +
        "veya secrets/hl-api-wallets.env dosyasina HL_API_WALLET_KEY_<ALIAS>=0x... ekleyin."
    );
    process.exit(1);
  }
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  for (const [k, v] of Object.entries(merged)) {
    envContent = upsertEnvKey(envContent, k, v);
  }
  fs.writeFileSync(envPath, envContent, "utf-8");
  console.error(`Guncellendi: ${envPath} <- ${source} (${Object.keys(merged).length} anahtar)`);
  for (const k of Object.keys(merged).sort()) {
    console.error(`  ${k}`);
  }
}

const bootstrap = process.argv.includes("--bootstrap");
if (bootstrap) {
  bootstrapSecretsFile();
} else {
  syncToDotEnv();
}
