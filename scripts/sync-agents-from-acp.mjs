/**
 * virtuals-protocol-acp/config.json içindeki agents[] + opsiyonel agents.manual.json
 * → agents.local.json (gitignore). Railway için: npm run sync:agents:railway
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultAcpConfig = path.join(root, "..", "virtuals-protocol-acp", "config.json");

const NAME_TO_ALIAS = [
  [/super\s*saiyan\s*raichu/i, "raichu"],
  [/taxerclaw|wolf\s*agent/i, "taxerclaw"],
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

function main() {
  const configPath = path.resolve(process.env.ACP_CONFIG_PATH || defaultAcpConfig);
  if (!fs.existsSync(configPath)) {
    console.error("ACP config bulunamadı:", configPath);
    console.error("ACP_CONFIG_PATH ile dosya yolunu ver veya virtuals-protocol-acp/config.json ekle.");
    process.exit(1);
  }
  const cfg = loadJson(configPath);
  /** @type {Map<string, { alias: string; apiKey: string; label?: string }>} */
  const map = new Map();

  for (const a of cfg.agents ?? []) {
    if (!a?.apiKey) continue;
    const alias = aliasForName(a.name);
    map.set(alias, {
      alias,
      apiKey: String(a.apiKey).trim(),
      label: a.name || alias,
    });
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
  }

  const out = [...map.values()];
  if (out.length === 0) {
    console.error(
      "Hiç agent yok. virtuals-protocol-acp içinde agents[].apiKey tanımlı olmalı ve/veya agents.manual.json (örnek: agents.manual.example.json)."
    );
    process.exit(1);
  }

  const outPath = path.join(root, "agents.local.json");
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log("Yazıldı:", outPath, "—", out.length, "agent");
  for (const x of out) console.log(" ", x.alias, "→", x.label);

  if (process.argv.includes("--one-line")) {
    process.stdout.write(`${JSON.stringify(out)}\n`);
  }
}

main();
