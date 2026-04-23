/**
 * Her agent icin sirayla:
 *   acp agent list (config senkron) -> acp agent switch --wallet <agents.local.json>
 *   -> dgclaw:ensure-env -> dgclaw:add-api-wallet -> hl-per-agent-env/<alias>.env
 *
 * GEREKSINIM: scripts/acp-cli-dirs.json (example). _default veya alias basina ACP kok.
 * Oturum / tarayici login / EIP imza hala sende; switch ve list terminalde otomatik.
 *
 *   npm run hl:add-api-wallet:all
 *   npm run hl:add-api-wallet:all -- --dry-run
 *   npm run hl:add-api-wallet:all -- --force
 *   npm run hl:add-api-wallet:all -- --no-switch   (switch atla — sadece deneme)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const MAP_PATH = path.join(__dirname, "acp-cli-dirs.json");
const EXAMPLE = path.join(__dirname, "acp-cli-dirs.example.json");
const AGENTS = path.join(root, "telegram-degen-bot", "agents.local.json");
const SKILL_ENV = path.join(root, "vendor", "dgclaw-skill", ".env");
const HL_DIR = path.join(root, "telegram-degen-bot", "hl-per-agent-env");

function parseArgs() {
  const a = process.argv.slice(2);
  return {
    dry: a.includes("--dry-run"),
    force: a.includes("--force"),
    noSwitch: a.includes("--no-switch"),
  };
}

function acpRunner(acpDirAbs) {
  const acpBin = path.join(acpDirAbs, "bin", "acp.ts");
  const tsxCli = path.join(acpDirAbs, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(acpBin)) {
    console.error(`bin/acp.ts yok: ${acpDirAbs}`);
    process.exit(1);
  }
  if (existsSync(tsxCli)) {
    return { cmd: process.execPath, argsBase: [tsxCli, acpBin] };
  }
  return { cmd: "npx", argsBase: ["--yes", "tsx", "bin/acp.ts"] };
}

/**
 * @param {{ autoYes?: boolean }} opts - seller durdur sorusuna otomatik y (stdin)
 */
function runAcp(acpDirAbs, acpArgs, opts = {}) {
  const { autoYes = false } = opts;
  const { cmd, argsBase } = acpRunner(acpDirAbs);
  const r = spawnSync(cmd, [...argsBase, ...acpArgs], {
    cwd: acpDirAbs,
    encoding: "utf-8",
    stdio: autoYes ? ["pipe", "inherit", "inherit"] : "inherit",
    input: autoYes ? "y\n" : undefined,
    shell: cmd === "npx",
    env: { ...process.env },
  });
  return { status: r.status ?? 1, stderr: r.stderr || "", stdout: r.stdout || "" };
}

/** Ayni ACP kokunda list bir kez (farkli alias klasorleri icin ayri). */
const acpListSyncedDirs = new Set();

function acpAgentListSync(acpDirAbs) {
  const key = path.resolve(acpDirAbs);
  if (acpListSyncedDirs.has(key)) return true;
  console.error(`\n--- acp agent list --json (${key}) ---`);
  const r = runAcp(acpDirAbs, ["--json", "agent", "list"]);
  if (r.status !== 0) {
    console.error("acp agent list basarisiz — oturum icin: acp login (bu ACP klasorunde)");
    return false;
  }
  acpListSyncedDirs.add(key);
  return true;
}

/** @returns {"ok"|"skip"|"fail"} */
function acpAgentSwitchWallet(acpDirAbs, wallet, alias) {
  const w = String(wallet || "").trim();
  if (!w || !/^0x[a-fA-F0-9]{40}$/i.test(w)) {
    console.error(`[${alias}] gecerli walletAddress yok — bu agent atlaniyor.`);
    return "skip";
  }
  console.error(`\n--- acp agent switch --wallet ... (${alias}) ---`);
  const r = runAcp(acpDirAbs, ["agent", "switch", "--wallet", w], { autoYes: true });
  if (r.status !== 0) {
    console.error(
      `[${alias}] switch basarisiz. Bu adres acp config.json'da olmali — \`acp agent list\` bu klasorde calisti mi? Cuzdan: ${w}`
    );
    return "fail";
  }
  return "ok";
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

function hasHlKeyInPerAgentEnv(alias) {
  const p = path.join(HL_DIR, `${alias}.env`);
  if (!existsSync(p)) return false;
  const m = parseDotEnv(readFileSync(p, "utf-8"));
  const pk = String(m.HL_API_WALLET_KEY ?? "").trim();
  return /^0x[0-9a-fA-F]{64}$/i.test(pk);
}

function flushSkillEnvToAgent(alias, row) {
  if (!existsSync(SKILL_ENV)) {
    console.error(`[${alias}] vendor/dgclaw-skill/.env yok, kopyalanamadi.`);
    return;
  }
  const skill = parseDotEnv(readFileSync(SKILL_ENV, "utf-8"));
  const master = String(row.walletAddress ?? "").trim();
  const hlSub = String(row.hlWallet ?? "").trim();
  const lines = [
    `# ${alias} — add-api-wallet sonrasi otomatik kopya ${new Date().toISOString()}`,
    master && /^0x[a-fA-F0-9]{40}$/i.test(master)
      ? `HL_MASTER_ADDRESS=${escEnvValue(master)}`
      : "",
    hlSub && /^0x[a-fA-F0-9]{40}$/i.test(hlSub)
      ? `HL_SUBACCOUNT_ADDRESS=${escEnvValue(hlSub)}`
      : "",
    skill.HL_API_WALLET_KEY
      ? `HL_API_WALLET_KEY=${escEnvValue(skill.HL_API_WALLET_KEY)}`
      : "# HL_API_WALLET_KEY eksik",
    skill.HL_API_WALLET_ADDRESS
      ? `HL_API_WALLET_ADDRESS=${escEnvValue(skill.HL_API_WALLET_ADDRESS)}`
      : "",
  ].filter(Boolean);
  mkdirSync(HL_DIR, { recursive: true });
  const out = path.join(HL_DIR, `${alias}.env`);
  writeFileSync(out, lines.join("\n") + "\n", "utf-8");
  console.error(`[${alias}] -> ${out}`);
}

function run(cmd, args, label) {
  console.error(`\n--- ${label} ---\n${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.error(`Hata (${r.status}): ${label}`);
    process.exit(r.status ?? 1);
  }
}

function main() {
  const { dry, force, noSwitch } = parseArgs();

  if (!existsSync(MAP_PATH)) {
    console.error(
      `Eksik: ${MAP_PATH}\nKopyala: ${EXAMPLE} -> acp-cli-dirs.json ve her agent icin ACP kokunu doldur.`
    );
    process.exit(1);
  }

  const dirMap = JSON.parse(readFileSync(MAP_PATH, "utf-8"));
  if (!existsSync(AGENTS)) {
    console.error(`agents yok: ${AGENTS}`);
    process.exit(1);
  }

  const agents = JSON.parse(readFileSync(AGENTS, "utf-8"));
  if (!Array.isArray(agents)) {
    console.error("agents JSON dizi degil.");
    process.exit(1);
  }

  const varsayilan = String(dirMap._default ?? "").trim();
  console.error(
    "\n--- HL API anahtari (sirayla) ---\n" +
      (varsayilan
        ? `ACP klasoru (bos aliaslar): ${varsayilan}\n`
        : "Uyari: _default yok; her alias icin acp-cli-dirs.json doldur.\n") +
      (noSwitch
        ? "(--no-switch) acp agent switch atlaniyor.\n"
        : "Her agent: acp agent list (ilk adimda) + acp agent switch --wallet (agents.local.json).\n") +
      "Oturum yoksa veya imza gerekiyorsa terminal/browser sende.\n"
  );

  for (const row of agents) {
    const alias = String(row?.alias ?? "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (!alias) continue;

    const acpDirRaw =
      String(dirMap[alias] ?? "").trim() || varsayilan;
    if (!acpDirRaw) {
      console.error(
        `[${alias}] atlandi — ne ozel yol ne _default yok (acp-cli-dirs.json).`
      );
      continue;
    }
    const acpDirAbs = path.isAbsolute(acpDirRaw)
      ? acpDirRaw
      : path.join(root, acpDirRaw);

    if (!force && hasHlKeyInPerAgentEnv(alias)) {
      console.error(
        `[${alias}] zaten anahtar var (hl-per-agent-env/${alias}.env) — atlandi. Yenilemek: --force`
      );
      continue;
    }

    if (dry) {
      console.error(
        `[dry-run] ${alias}: list+switch+ensure-env+add-api-wallet+kopyala | ACP=${acpDirAbs}`
      );
      continue;
    }

    if (!noSwitch) {
      if (!acpAgentListSync(acpDirAbs)) process.exit(1);
      const sw = acpAgentSwitchWallet(acpDirAbs, row.walletAddress, alias);
      if (sw === "skip") continue;
      if (sw === "fail") process.exit(1);
    }

    run("npm", ["run", "dgclaw:ensure-env", "--", "--alias", alias, "--acp-dir", acpDirAbs], `ensure-env ${alias}`);
    run("npm", ["run", "dgclaw:add-api-wallet"], `add-api-wallet ${alias}`);
    flushSkillEnvToAgent(alias, row);
  }

  console.error("\nBitti. Sonra: npm run hl:per-agent-env (yedek) veya AGENTS_JSON / Railway HL_API_WALLET_KEY_<ALIAS>.");
}

main();
