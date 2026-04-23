/**
 * Rehber §3 + §8: vendor/dgclaw-skill/.env icine ACP_CLI_DIR ve (istege bagli) forum ID'leri.
 * Kullanim:
 *   node scripts/dgclaw-ensure-env.mjs
 *   node scripts/dgclaw-ensure-env.mjs --alias ichimoku
 *   node scripts/dgclaw-ensure-env.mjs --alias taxerclaw
 *     (TaXerClaw: D:/wolfy-agent/virtuals-agent ACP varsa ACP_CLI_DIR otomatik; HL master agents.local.json)
 *   node scripts/dgclaw-ensure-env.mjs --alias raichu --acp-dir D:/path/to/acp-cli
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAcpCli } from "./lib/resolve-acp-dir.mjs";
import {
  mergeAcpCliDirIntoSkillEnv,
  mergeForumIdsIntoSkillEnv,
  mergeHlMasterFromAgentsLocal,
} from "./lib/merge-dgclaw-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const forumPath = path.join(__dirname, "dgclaw-forum-ids.json");
const forumMap = JSON.parse(readFileSync(forumPath, "utf-8"));

function parseArgs() {
  const a = process.argv.slice(2);
  let alias = process.env.DGCLAW_AGENT_ALIAS?.trim().toLowerCase() || "";
  let acpDirOverride = process.env.DGCLAW_ACP_CLI_DIR?.trim() || "";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--alias" && a[i + 1]) {
      alias = a[i + 1].trim().toLowerCase();
      i++;
    } else if (a[i] === "--acp-dir" && a[i + 1]) {
      acpDirOverride = a[i + 1].trim();
      i++;
    }
  }
  return { alias, acpDirOverride };
}

function main() {
  const { alias, acpDirOverride } = parseArgs();

  let acpDir = acpDirOverride;
  if (!acpDir && alias === "taxerclaw") {
    const wolfy = path.join("D:", "wolfy-agent", "virtuals-agent");
    if (existsSync(path.join(wolfy, "bin", "acp.ts"))) {
      acpDir = wolfy;
    }
  }
  const resolved = acpDir
    ? {
        acpDir: path.resolve(acpDir),
        acpBin: path.join(path.resolve(acpDir), "bin", "acp.ts"),
      }
    : resolveAcpCli(root);
  if (!resolved || !existsSync(resolved.acpBin)) {
    console.error(
      "acp-cli bulunamadi. --acp-dir <klasor> ver (TaXerClaw icin ornek: D:/wolfy-agent/virtuals-agent) veya repoda acp-cli-v2 kur."
    );
    process.exit(1);
  }

  const skillEnv = mergeAcpCliDirIntoSkillEnv(root, resolved.acpDir);
  console.error(`ACP_CLI_DIR -> ${skillEnv}`);

  if (alias) {
    const hlOut = mergeHlMasterFromAgentsLocal(root, alias);
    if (hlOut) {
      console.error(`HL_MASTER_ADDRESS (+ HL_SUBACCOUNT_ADDRESS) -> ${hlOut}`);
    }

    const out = mergeForumIdsIntoSkillEnv(root, forumMap, alias);
    if (out) {
      console.error(
        `Forum (--alias ${alias}): DGCLAW_FORUM_AGENT_ID + DGCLAW_FORUM_SIGNALS_THREAD_ID -> ${out}`
      );
    } else {
      console.error(
        `Uyari: --alias ${alias} scripts/dgclaw-forum-ids.json icinde yok.`
      );
    }
  }
}

main();
