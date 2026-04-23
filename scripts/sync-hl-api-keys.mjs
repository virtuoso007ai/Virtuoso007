/**
 * secrets/hl-api-wallets.env + hl-per-agent-env/<alias>.env → telegram-degen-bot/.env
 *
 * --bootstrap: hl-per-agent-env içindeki tüm *.env dosyalarından topla ve
 *   secrets/hl-api-wallets.env dosyasını yaz/güncelle (HL_API_WALLET_KEY_<ALIAS>,
 *   varsa HL_API_WALLET_ADDRESS_<ALIAS>). Mevcut secrets içeriği korunur; aynı anahtar dosyadan ezilir.
 *
 *   npm run hl:sync-api-keys
 *   npm run hl:bootstrap-secrets
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Script .../telegram-degen-bot/scripts veya .../telegram-degen-bot/telegram-degen-bot/scripts altında olabilir. */
function resolveRoot() {
  const oneUp = path.join(__dirname, "..");
  if (fs.existsSync(path.join(oneUp, "hl-per-agent-env"))) return oneUp;
  const twoUp = path.join(__dirname, "..", "..");
  if (fs.existsSync(path.join(twoUp, "hl-per-agent-env"))) return twoUp;
  return oneUp;
}

const root = resolveRoot();
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

function aliasSuffix(alias) {
  return alias
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
}

function envKeyForAlias(alias) {
  return `HL_API_WALLET_KEY_${aliasSuffix(alias)}`;
}

function envAddressKeyForAlias(alias) {
  return `HL_API_WALLET_ADDRESS_${aliasSuffix(alias)}`;
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
    let raw;
    try {
      raw = fs.readFileSync(p, "utf-8");
    } catch {
      continue;
    }
    const map = parseDotEnv(raw);
    const pk = String(map.HL_API_WALLET_KEY ?? "").trim();
    if (/^0x[0-9a-fA-F]{64}$/i.test(pk)) {
      out[envKeyForAlias(alias)] = pk;
    }
    const addr = String(
      map.HL_API_WALLET_ADDRESS ?? map.HL_SUBACCOUNT_ADDRESS ?? ""
    ).trim();
    if (/^0x[0-9a-fA-F]{40}$/i.test(addr)) {
      out[envAddressKeyForAlias(alias)] = addr;
    }
  }
  return out;
}

function collectFromSecretsFile() {
  if (!fs.existsSync(secretsPath)) return {};
  const map = parseDotEnv(fs.readFileSync(secretsPath, "utf-8"));
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith("HL_API_WALLET_KEY_")) {
      const pk = String(v).trim();
      if (!/^0x[0-9a-fA-F]{64}$/i.test(pk)) continue;
      out[k] = pk;
      continue;
    }
    if (k.startsWith("HL_API_WALLET_ADDRESS_")) {
      const addr = String(v).trim();
      if (!/^0x[0-9a-fA-F]{40}$/i.test(addr)) continue;
      out[k] = addr;
    }
  }
  return out;
}

function bootstrapSecretsFile() {
  const fromFiles = collectFromPerAgentDir();
  const fromExisting = collectFromSecretsFile();
  /** Mevcut secrets satırları korunur; hl-per-agent-env aynı anahtarı günceller. */
  const merged = { ...fromExisting, ...fromFiles };
  const keys = Object.keys(merged).sort();
  if (keys.length === 0) {
    console.error(
      "hl-per-agent-env icinde gecerli HL_API_WALLET_KEY / ADDRESS yok.\n" +
        "Her agent icin: hl-per-agent-env/<alias>.env icinde HL_API_WALLET_KEY=0x...64hex"
    );
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
  const lines = [
    "# Hyperliquid — hl-per-agent-env/*.env → npm run hl:bootstrap-secrets ile uretildi",
    "# Private keys (0x + 64 hex) + isteğe bağlı HL_API_WALLET_ADDRESS_<ALIAS> (40 hex)",
    "# Railway / Vercel: aynı isimli Environment Variables",
    "",
  ];
  for (const k of keys) {
    lines.push(`${k}=${merged[k]}`);
  }
  lines.push("");
  fs.writeFileSync(secretsPath, lines.join("\n"), "utf-8");
  const pkCount = keys.filter((k) => k.startsWith("HL_API_WALLET_KEY_")).length;
  const addrCount = keys.filter((k) => k.startsWith("HL_API_WALLET_ADDRESS_")).length;
  console.error(
    `Yazildi: ${secretsPath} (${pkCount} HL_API_WALLET_KEY_*, ${addrCount} HL_API_WALLET_ADDRESS_*)`
  );
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
