/**
 * vendor/dgclaw-skill/.env satirlarini birlestir (rehber §3, §8).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function stripKey(content, keyPrefix) {
  return content
    .split("\n")
    .filter((line) => !line.startsWith(keyPrefix))
    .join("\n");
}

function upsertLine(content, key, value) {
  let c = stripKey(content, `${key}=`);
  if (c && !c.endsWith("\n")) c += "\n";
  c += `${key}=${value}\n`;
  return c;
}

/**
 * @param {string} repoRoot
 * @param {string} acpDirAbs
 */
export function mergeAcpCliDirIntoSkillEnv(repoRoot, acpDirAbs) {
  const skillDir = path.join(repoRoot, "vendor", "dgclaw-skill");
  const skillEnv = path.join(skillDir, ".env");
  mkdirSync(skillDir, { recursive: true });
  const norm = acpDirAbs.replace(/\\/g, "/");
  let content = existsSync(skillEnv) ? readFileSync(skillEnv, "utf-8") : "";
  content = upsertLine(content, "ACP_CLI_DIR", norm);
  writeFileSync(skillEnv, content, "utf-8");
  return skillEnv;
}

/**
 * @param {string} repoRoot
 * @param {Record<string, { DGCLAW_FORUM_AGENT_ID: string; DGCLAW_FORUM_SIGNALS_THREAD_ID: string }>} forumMap
 * @param {string} alias lowercase
 */
/**
 * TaXerClaw vb. için HL_MASTER_ADDRESS = agents.local.json walletAddress (master / Privy).
 * @param {string} repoRoot
 * @param {string} alias lowercase
 * @param {string} [agentsPath] default telegram-degen-bot/agents.local.json
 * @returns {string|null} skill .env path or null if skipped
 */
export function mergeHlMasterFromAgentsLocal(repoRoot, alias, agentsPath) {
  const rel =
    agentsPath ||
    path.join("telegram-degen-bot", "agents.local.json");
  const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
  if (!existsSync(abs)) return null;
  let arr;
  try {
    arr = JSON.parse(readFileSync(abs, "utf-8"));
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const row = arr.find(
    (r) => String(r?.alias ?? "").trim().toLowerCase() === alias.toLowerCase()
  );
  if (!row) return null;
  const master = String(row.walletAddress ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(master)) return null;

  const skillDir = path.join(repoRoot, "vendor", "dgclaw-skill");
  const skillEnv = path.join(skillDir, ".env");
  mkdirSync(skillDir, { recursive: true });
  let content = existsSync(skillEnv) ? readFileSync(skillEnv, "utf-8") : "";
  content = upsertLine(content, "HL_MASTER_ADDRESS", master);
  const hlPub = String(row.hlWallet ?? "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(hlPub)) {
    content = upsertLine(content, "HL_SUBACCOUNT_ADDRESS", hlPub);
  }
  writeFileSync(skillEnv, content, "utf-8");
  return skillEnv;
}

export function mergeForumIdsIntoSkillEnv(repoRoot, forumMap, alias) {
  const f = forumMap[alias];
  if (!f) return null;
  const skillDir = path.join(repoRoot, "vendor", "dgclaw-skill");
  const skillEnv = path.join(skillDir, ".env");
  mkdirSync(skillDir, { recursive: true });
  let content = existsSync(skillEnv) ? readFileSync(skillEnv, "utf-8") : "";
  content = upsertLine(
    content,
    "DGCLAW_FORUM_AGENT_ID",
    String(f.DGCLAW_FORUM_AGENT_ID)
  );
  content = upsertLine(
    content,
    "DGCLAW_FORUM_SIGNALS_THREAD_ID",
    String(f.DGCLAW_FORUM_SIGNALS_THREAD_ID)
  );
  writeFileSync(skillEnv, content, "utf-8");
  return skillEnv;
}
