/**
 * agents.local.json'daki alias icin HL add-api-wallet (acp-cli-v2 + dgclaw-skill script).
 * ACP oturumunda bu master wallet'a sahip agent listelenmeli (acp agent list --json).
 *
 *   node scripts/hl-add-api-wallet-for-alias.mjs pokedex
 *   node scripts/hl-add-api-wallet-for-alias.mjs welles
 *
 * Sonra: cd telegram-degen-bot && npm run hl:sync-api-keys
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const agentsPath = path.join(root, "telegram-degen-bot", "agents.local.json");
const acpDir = path.join(root, "acp-cli-v2");
const skillDir = path.join(root, "vendor", "dgclaw-skill");
const skillEnv = path.join(skillDir, ".env");
const hlPerAgentDir = path.join(root, "telegram-degen-bot", "hl-per-agent-env");
const acpConfigPath = path.join(acpDir, "config.json");

/** API `agent list` bazen tek kayit dondurur; yerel config.json'da wallet -> id vardir. */
function agentIdFromAcpConfig(masterLower) {
  if (!existsSync(acpConfigPath)) return null;
  try {
    const cfg = JSON.parse(readFileSync(acpConfigPath, "utf-8"));
    const agentsMap = cfg.agents && typeof cfg.agents === "object" ? cfg.agents : {};
    for (const [k, v] of Object.entries(agentsMap)) {
      if (String(k).toLowerCase() === masterLower && v && typeof v === "object" && v.id) {
        return String(v.id);
      }
    }
  } catch {
    /* */
  }
  return null;
}

function runAcp(args) {
  const tsx = path.join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
  const bin = path.join(acpDir, "bin", "acp.ts");
  if (!existsSync(tsx) || !existsSync(bin)) {
    console.error(`acp-cli-v2 eksik: ${acpDir}`);
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [tsx, bin, ...args], {
    cwd: acpDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: String(r.stdout ?? ""),
    stderr: String(r.stderr ?? ""),
  };
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
  const alias = (process.argv[2] || "").trim().toLowerCase().replace(/^@/, "");
  if (!alias) {
    console.error("Kullanim: node scripts/hl-add-api-wallet-for-alias.mjs <alias>");
    process.exit(1);
  }

  if (!existsSync(agentsPath)) {
    console.error(`Yok: ${agentsPath}`);
    process.exit(1);
  }
  const agents = JSON.parse(readFileSync(agentsPath, "utf-8"));
  if (!Array.isArray(agents)) {
    console.error("agents.local.json dizi degil.");
    process.exit(1);
  }
  const row = agents.find(
    (r) => String(r?.alias ?? "").trim().toLowerCase() === alias
  );
  if (!row) {
    console.error(`Alias yok: ${alias}`);
    process.exit(1);
  }
  const master = String(row.walletAddress ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(master)) {
    console.error(`${alias}: gecersiz walletAddress`);
    process.exit(1);
  }

  const list = runAcp(["--json", "agent", "list", "--page", "1", "--page-size", "100"]);
  if (list.status !== 0) {
    console.error(list.stderr || list.stdout);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(list.stdout.trim());
  } catch {
    console.error("agent list JSON parse edilemedi:", list.stdout.slice(0, 400));
    process.exit(1);
  }
  const rows = Array.isArray(data?.data) ? data.data : [];
  let hit = rows.find(
    (a) =>
      String(a.walletAddress ?? "").toLowerCase() === master.toLowerCase()
  );
  if (!hit?.id) {
    const fromCfg = agentIdFromAcpConfig(master.toLowerCase());
    if (fromCfg) {
      hit = {
        id: fromCfg,
        name: alias,
        walletAddress: master,
      };
      console.error(`[ok] agent list'te yok; acp-cli-v2/config.json -> id ${fromCfg}`);
    } else {
      console.error(
        `[${alias}] Bu ACP oturumunda wallet ${master} ile agent yok.\n` +
          `→ Virtuals hesabiyla: cd acp-cli-v2 && npx tsx bin/acp.ts configure\n` +
          `→ Sonra: npx tsx bin/acp.ts --json agent list\n` +
          `Mevcut oturumda listelenen wallet'lar: ${rows.map((a) => a.walletAddress).join(", ") || "(bos)"}`
      );
      process.exit(1);
    }
  }

  const use = runAcp(["agent", "use", "--agent-id", String(hit.id)]);
  if (use.status !== 0) {
    console.error(use.stderr || use.stdout);
    process.exit(1);
  }
  console.error(`[ok] Aktif agent: ${hit.name ?? "?"} (${hit.id})`);

  const backup = skillEnv + ".before-add-api-wallet." + alias + "." + Date.now();
  if (existsSync(skillEnv)) {
    copyFileSync(skillEnv, backup);
    console.error(`[ok] Yedek: ${backup}`);
  }

  const addEnv = {
    ...process.env,
    ACP_CLI_DIR: acpDir.replace(/\\/g, "/"),
  };
  const add = spawnSync(
    "npx",
    ["--yes", "tsx", "scripts/add-api-wallet.ts", "--name", `${alias}-hl-api`],
    {
      cwd: skillDir,
      encoding: "utf-8",
      shell: true,
      env: addEnv,
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  const addOut = (add.stdout || "") + (add.stderr || "");
  process.stderr.write(addOut);
  if (add.status !== 0) {
    console.error("\nadd-api-wallet basarisiz.");
    process.exit(add.status ?? 1);
  }

  if (!existsSync(skillEnv)) {
    console.error(".env olusmadi.");
    process.exit(1);
  }
  const after = parseDotEnv(readFileSync(skillEnv, "utf-8"));
  const pk = String(after.HL_API_WALLET_KEY ?? "").trim();
  const apiAddr = String(after.HL_API_WALLET_ADDRESS ?? "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/i.test(pk) || !/^0x[a-fA-F0-9]{40}$/i.test(apiAddr)) {
    console.error("HL_API_WALLET_KEY / ADDRESS .env'de okunamadi.");
    process.exit(1);
  }

  mkdirSync(hlPerAgentDir, { recursive: true });
  const perPath = path.join(hlPerAgentDir, `${alias}.env`);
  const perLines = [
    `# ${alias} — HL v2 API wallet (add-api-wallet ${new Date().toISOString().slice(0, 10)})`,
    `HL_MASTER_ADDRESS=${escEnvValue(master)}`,
    `HL_SUBACCOUNT_ADDRESS=${escEnvValue(apiAddr)}`,
    `HL_API_WALLET_KEY=${escEnvValue(pk)}`,
    `HL_API_WALLET_ADDRESS=${escEnvValue(apiAddr)}`,
    "",
  ];
  writeFileSync(perPath, perLines.join("\n"), "utf-8");
  console.error(`[ok] Yazildi: ${perPath}`);

  row.hlWallet = apiAddr;
  writeFileSync(agentsPath, JSON.stringify(agents, null, 2) + "\n", "utf-8");
  console.error(`[ok] agents.local.json hlWallet guncellendi`);

  if (existsSync(backup)) {
    copyFileSync(backup, skillEnv);
    console.error(`[ok] vendor/dgclaw-skill/.env geri yuklendi (yedekten)`);
  }

  console.error("\nSon adim: cd telegram-degen-bot && npm run hl:sync-api-keys");
}

main();
