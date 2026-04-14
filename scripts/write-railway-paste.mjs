/**
 * Railway → AGENTS_JSON value: AGENTS_JSON.paste.txt oluşturur (gitignore).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const script = path.join(__dirname, "agents-local-to-oneline.mjs");
const outFile = path.join(root, "AGENTS_JSON.paste.txt");

const r = spawnSync(process.execPath, [script], {
  cwd: root,
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout || "sync başarısız");
  process.exit(r.status ?? 1);
}

fs.writeFileSync(outFile, `${r.stdout.trim()}\n`, "utf8");
console.log("Tamam.");
console.log("Dosya:", outFile);
console.log("Railway’de AGENTS_JSON value alanına bu dosyanın içeriğinin tamamını yapıştır.");
