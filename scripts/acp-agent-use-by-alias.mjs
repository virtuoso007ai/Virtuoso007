/**
 * agents.local.json alias -> acp-cli-v2 config.json icindeki wallet -> agent use
 *
 *   node scripts/acp-agent-use-by-alias.mjs pokedex
 *   node scripts/acp-agent-use-by-alias.mjs welles
 *
 * Not: Sadece bu makinede `acp-cli-v2/config.json` -> `agents` altinda kayitli
 * wallet'lar calisir. Baska Virtuals hesabina ait agent icin once o hesapla
 * `acp configure` (tercihen ayri bir acp-cli klasoru) gerekir.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const agentsPath = path.join(root, "telegram-degen-bot", "agents.local.json");
const acpDir = path.join(root, "acp-cli-v2");
const configPath = path.join(acpDir, "config.json");

function runAcp(args) {
  const tsx = path.join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
  const bin = path.join(acpDir, "bin", "acp.ts");
  const r = spawnSync(process.execPath, [tsx, bin, ...args], {
    cwd: acpDir,
    encoding: "utf-8",
    stdio: ["inherit", "inherit", "inherit"],
  });
  return r.status ?? 1;
}

function main() {
  const alias = (process.argv[2] || "").trim().toLowerCase().replace(/^@/, "");
  if (!alias) {
    console.error("Kullanim: node scripts/acp-agent-use-by-alias.mjs <alias>");
    process.exit(1);
  }
  if (!existsSync(agentsPath) || !existsSync(configPath)) {
    console.error("agents.local.json veya acp-cli-v2/config.json bulunamadi.");
    process.exit(1);
  }
  const agents = JSON.parse(readFileSync(agentsPath, "utf-8"));
  const row = agents.find(
    (r) => String(r?.alias ?? "").trim().toLowerCase() === alias
  );
  if (!row) {
    console.error(`Alias yok: ${alias}`);
    process.exit(1);
  }
  const master = String(row.walletAddress ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(master)) {
    console.error(`${alias}: gecersiz walletAddress`);
    process.exit(1);
  }

  const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
  const agentsMap = cfg.agents && typeof cfg.agents === "object" ? cfg.agents : {};
  let hitKey = null;
  let hitMeta = null;
  for (const [k, v] of Object.entries(agentsMap)) {
    if (String(k).toLowerCase() === master && v && typeof v === "object" && v.id) {
      hitKey = k;
      hitMeta = v;
      break;
    }
  }
  if (!hitMeta?.id) {
    const known = Object.keys(agentsMap).join("\n  ");
    console.error(
      `[${alias}] wallet ${row.walletAddress} bu acp-cli-v2 kurulumunda yok.\n\n` +
        `Ichimoku -> Welles gecisi calisti cunku ikisi de ayni config.json icindeydi.\n` +
        `Pokedex baska bir Virtuals kullanicisina ait; bu CLI'da kayitli cuzdanlar:\n  ${known || "(bos)"}\n\n` +
        `Yapman gerekenler:\n` +
        `  1) Pokedex sahibi Virtuals hesabiyla giris:  cd acp-cli-v2  &&  npx tsx bin/acp.ts configure\n` +
        `     (Bu mevcut FRIDAY/Raichu oturumunun ustune yazabilir — gerekirse acp-cli-v2'yi kopyala, ayri klasorde configure.)\n` +
        `  2) Sonra: npx tsx bin/acp.ts --json agent list  ile Pokedex gorunmeli.\n` +
        `  3) HL API wallet:  npm run hl:add-api-wallet:alias -- pokedex\n`
    );
    process.exit(1);
  }

  console.error(`[${alias}] agent use --agent-id ${hitMeta.id} (${hitKey})`);
  const st = runAcp(["agent", "use", "--agent-id", String(hitMeta.id)]);
  if (st !== 0) process.exit(st);
  const st2 = runAcp(["wallet", "address", "--json"]);
  process.exit(st2);
}

main();
