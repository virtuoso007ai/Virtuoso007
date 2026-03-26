/**
 * Birden fazla ACP/virtuals config.json (D:\ üzerindeki kardeş projeler dahil)
 * → agents.local.json (gitignore). Railway: npm run sync:agents:railway
 *
 * ACP_CONFIG_PATH — birincil config (varsayılan: ../virtuals-protocol-acp/config.json)
 * ACP_CONFIG_PATHS — ekstra tam yollar, virgülle (opsiyonel; set edilirse kardeş tarama atlanır)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultAcpConfig = path.join(root, "..", "virtuals-protocol-acp", "config.json");

/** İsim → Telegram alias (sıra önemli: daha spesifik desenler önce) */
const NAME_TO_ALIAS = [
  [/super\s*saiyan\s*raichu/i, "raichu"],
  [/taxerclaw/i, "taxerclaw"],
  [/wolfy\s*agent/i, "taxerclaw"],
  [/wolf\s*agent/i, "taxerclaw"],
  [/pokedex/i, "pokedex"],
  [/welles\s*wilder/i, "welles"],
  [/ichimoku/i, "ichimoku"],
];

function aliasForName(name) {
  const n = String(name ?? "");
  for (const [re, a] of NAME_TO_ALIAS) {
    if (re.test(n)) return a;
  }
  return (
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Üst klasör (genelde D:\) — super-saiyan-raichu\telegram-degen-bot → iki üst */
function siblingRootDir() {
  return path.join(root, "..", "..");
}

/**
 * @returns {string[]}
 */
function resolveConfigPaths() {
  const primary = path.resolve(process.env.ACP_CONFIG_PATH || defaultAcpConfig);
  const paths = [];
  const seen = new Set();

  function add(p) {
    const abs = path.resolve(p);
    if (!seen.has(abs)) {
      seen.add(abs);
      paths.push(abs);
    }
  }

  add(primary);

  if (process.env.ACP_CONFIG_PATHS?.trim()) {
    for (const raw of process.env.ACP_CONFIG_PATHS.split(/[,;\n]+/)) {
      const t = raw.trim();
      if (t) add(t);
    }
    return paths;
  }

  const base = siblingRootDir();
  const optional = [
    path.join(base, "ichimoku-kinko-hyo", "virtuals-protocol-acp", "config.json"),
    path.join(base, "pokedex", "virtuals-protocol-acp", "config.json"),
    path.join(base, "welles-wilder", "virtuals-protocol-acp", "config.json"),
    path.join(base, "wolfy-agent", "virtuals-agent", "config.json"),
  ];
  for (const p of optional) {
    if (fs.existsSync(p)) add(p);
  }
  return paths;
}

/**
 * @param {string} configPath
 * @param {Map<string, { alias: string; apiKey: string; label?: string }>} map
 */
function ingestAgentsFromFile(configPath, map, quiet = false) {
  const cfg = loadJson(configPath);
  let n = 0;
  for (const a of cfg.agents ?? []) {
    if (!a?.apiKey) continue;
    const alias = aliasForName(a.name);
    if (map.has(alias)) {
      if (!quiet) console.warn(`[sync] Yinelenen alias atlandı (${alias}): ${configPath}`);
      continue;
    }
    map.set(alias, {
      alias,
      apiKey: String(a.apiKey).trim(),
      label: a.name || alias,
    });
    n += 1;
  }
  if (!quiet) console.log(`[sync] ${configPath} → ${n} agent (apiKey’li)`);
}

function main() {
  const oneLine = process.argv.includes("--one-line");
  const paths = resolveConfigPaths();
  if (!paths.length || !fs.existsSync(paths[0])) {
    console.error("Birincil ACP config bulunamadı:", paths[0] || defaultAcpConfig);
    process.exit(1);
  }

  /** @type {Map<string, { alias: string; apiKey: string; label?: string }>} */
  const map = new Map();

  if (!oneLine) console.log("[sync] Config dosyaları:");
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      if (!oneLine) console.warn("[sync] Atlandı (yok):", p);
      continue;
    }
    ingestAgentsFromFile(p, map, oneLine);
  }

  const manualPath = path.join(root, "agents.manual.json");
  if (fs.existsSync(manualPath)) {
    const manual = loadJson(manualPath);
    if (!Array.isArray(manual)) {
      console.error("agents.manual.json bir JSON dizi olmalı.");
      process.exit(1);
    }
    for (const m of manual) {
      if (!m?.alias || !m?.apiKey) continue;
      const alias = String(m.alias).trim().toLowerCase().replace(/^@/, "");
      const key = String(m.apiKey).trim();
      if (!alias || !key || key.includes("PASTE_")) continue;
      map.set(alias, {
        alias,
        apiKey: key,
        label: m.label?.trim() || alias,
      });
    }
    if (!oneLine) console.log("[sync] agents.manual.json birleştirildi");
  }

  const out = [...map.values()].sort((a, b) => a.alias.localeCompare(b.alias));
  if (out.length === 0) {
    console.error(
      "Hiç agent yok. D:\\ üzerindeki kardeş projelerde config.json yoksa ACP_CONFIG_PATHS ile yolları ver."
    );
    process.exit(1);
  }

  const outPath = path.join(root, "agents.local.json");
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  if (oneLine) {
    process.stdout.write(`${JSON.stringify(out)}\n`);
    process.exit(0);
  }

  console.log("Yazıldı:", outPath, "—", out.length, "agent");
  for (const x of out) console.log(" ", x.alias, "→", x.label);
}

main();
