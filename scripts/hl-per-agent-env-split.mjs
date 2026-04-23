/**
 * Her agent icin ayri HL .env dosyasi (telegram-degen-bot/hl-per-agent-env/<alias>.env).
 * - taxerclaw: vendor/dgclaw-skill/.env icindeki HL_API_WALLET_KEY / HL_API_WALLET_ADDRESS kopyalanir (korunur).
 * - Digerleri: agents.local.json'dan HL_MASTER_ADDRESS + hlWallet; HL_API_WALLET_KEY bos + talimat.
 *
 * Gercek private key benzersizdir — script "uretmez"; diger agentlar icin npm run dgclaw:add-api-wallet
 * (o agentin ACP oturumu ile) calistirip ciktiyi ilgili dosyaya yapistirin.
 *
 * Kullanim: node scripts/hl-per-agent-env-split.mjs
 *          node scripts/hl-per-agent-env-split.mjs --agents D:/path/agents.local.json
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseArgs() {
  const a = process.argv.slice(2);
  let agentsRel = path.join("telegram-degen-bot", "agents.local.json");
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--agents" && a[i + 1]) {
      agentsRel = a[i + 1];
      i++;
    }
  }
  return { agentsAbs: path.isAbsolute(agentsRel) ? agentsRel : path.join(root, agentsRel) };
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

function escEnvValue(v) {
  if (/[\s#"'\\]/.test(v)) return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return v;
}

function main() {
  const { agentsAbs } = parseArgs();
  if (!existsSync(agentsAbs)) {
    console.error(`agents dosyasi yok: ${agentsAbs}`);
    process.exit(1);
  }

  const agents = JSON.parse(readFileSync(agentsAbs, "utf-8"));
  if (!Array.isArray(agents) || agents.length === 0) {
    console.error("agents JSON bos veya dizi degil.");
    process.exit(1);
  }

  const skillEnvPath = path.join(root, "vendor", "dgclaw-skill", ".env");
  let skillMap = {};
  if (existsSync(skillEnvPath)) {
    skillMap = parseDotEnv(readFileSync(skillEnvPath, "utf-8"));
  } else {
    console.error(`Uyari: ${skillEnvPath} yok — taxerclaw dosyasina HL_API_WALLET_KEY kopyalanamaz.`);
  }

  const outDir = path.join(root, "telegram-degen-bot", "hl-per-agent-env");
  mkdirSync(outDir, { recursive: true });

  const vaultDir = path.join(outDir, "_vault");
  mkdirSync(vaultDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  if (existsSync(skillEnvPath)) {
    const bak = path.join(vaultDir, `vendor-dgclaw-skill.env.${ts}.bak`);
    copyFileSync(skillEnvPath, bak);
    console.error(`Guvenlik yedegi: ${bak}`);
  }
  const prevTax = path.join(outDir, "taxerclaw.env");
  if (existsSync(prevTax)) {
    const bak = path.join(vaultDir, `taxerclaw.env.before-resplit.${ts}.bak`);
    copyFileSync(prevTax, bak);
    console.error(`Onceki taxerclaw.env yedegi: ${bak}`);
  }

  const readme = `# hl-per-agent-env (GITIGNORE — repoya commit ETME)

## TaXerClaw
- taxerclaw.env: vendor/dgclaw-skill/.env icindeki HL_API_WALLET_* kopyalanir.
- _vault/: Her calistirmada ham vendor .env ve eski taxerclaw.env zaman damgali yedeklenir.

## Diger agentlar — neden otomatik degil?
HL_API_WALLET_KEY, Hyperliquid'te "API wallet" yaratip master cuzdana baglamak icin zincir uzerinde
imza gerekir. Bunu uzaktan baska biri (AI) senin adina yapamaz; sadece senin ACP/cuzdan oturumunla
\`npm run dgclaw:add-api-wallet\` calisir.

## Ne yapmalisin (kisa)
1) scripts/acp-cli-dirs.example.json -> scripts/acp-cli-dirs.json kopyala; her agent icin ACP kokunu yaz.
2) Repo kokunden: npm run hl:add-api-wallet:all  (sirayla ensure-env + add-api-wallet + hl-per-agent-env kopya)
   Oncelik: npm run hl:add-api-wallet:all:dry  (ne calisacagini gosterir)
3) Ayni anda: npm run hl:per-agent-env  (yedek + sablon)
4) Railway: HL_API_WALLET_KEY_<ALIAS> veya AGENTS_JSON hlApiWalletKey.

## Teknik
- Railway: her agent icin HL_API_WALLET_KEY_<ALIAS> secret veya AGENTS_JSON hlApiWalletKey.
`;
  writeFileSync(path.join(outDir, "README.txt"), readme, "utf-8");

  for (const row of agents) {
    const alias = String(row?.alias ?? "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (!alias) continue;

    const master = String(row.walletAddress ?? "").trim();
    const hlSub = String(row.hlWallet ?? "").trim();

    if (alias === "taxerclaw") {
      const lines = [
        "# TaXerClaw — vendor/dgclaw-skill/.env ile senk (koruma)",
        master ? `HL_MASTER_ADDRESS=${escEnvValue(master)}` : "# HL_MASTER_ADDRESS= (agents.local.json walletAddress)",
        hlSub && /^0x[a-fA-F0-9]{40}$/i.test(hlSub)
          ? `HL_SUBACCOUNT_ADDRESS=${escEnvValue(hlSub)}`
          : "",
        skillMap.HL_API_WALLET_KEY
          ? `HL_API_WALLET_KEY=${escEnvValue(skillMap.HL_API_WALLET_KEY)}`
          : "# HL_API_WALLET_KEY= (vendor/dgclaw-skill/.env icinde yok)",
        skillMap.HL_API_WALLET_ADDRESS
          ? `HL_API_WALLET_ADDRESS=${escEnvValue(skillMap.HL_API_WALLET_ADDRESS)}`
          : "",
      ].filter(Boolean);
      const p = path.join(outDir, `${alias}.env`);
      writeFileSync(p, lines.join("\n") + "\n", "utf-8");
      console.error(`Yazildi: ${p}`);
      continue;
    }

    const lines = [
      `# ${alias} — HL v2 API wallet (doldur)`,
      master && /^0x[a-fA-F0-9]{40}$/i.test(master)
        ? `HL_MASTER_ADDRESS=${escEnvValue(master)}`
        : "# HL_MASTER_ADDRESS=0x...40hex (agents.local.json walletAddress)",
      hlSub && /^0x[a-fA-F0-9]{40}$/i.test(hlSub)
        ? `HL_SUBACCOUNT_ADDRESS=${escEnvValue(hlSub)}`
        : "",
      "# Asagiyi add-api-wallet ciktisi ile doldur (bu agentin ACP oturumu):",
      "HL_API_WALLET_KEY=",
      "# HL_API_WALLET_ADDRESS=0x...",
    ].filter((x) => x !== "");
    const p = path.join(outDir, `${alias}.env`);
    writeFileSync(p, lines.join("\n") + "\n", "utf-8");
    console.error(`Sablon: ${p}`);
  }

  console.error(`\nTamam: ${outDir} (README.txt + alias basina .env). Repoya commit ETME.`);
}

main();
