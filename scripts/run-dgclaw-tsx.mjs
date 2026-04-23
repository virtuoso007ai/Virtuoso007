/**
 * dgclaw-skill TypeScript script'lerini doğru cwd ile çalıştırır (.env yüklenir).
 * Örn: node scripts/run-dgclaw-tsx.mjs scripts/trade.ts balance
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const skillRoot = path.join(projectRoot, "vendor", "dgclaw-skill");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Kullanım: node scripts/run-dgclaw-tsx.mjs scripts/trade.ts <args...>");
  process.exit(1);
}

const child = spawn("npx", ["--yes", "tsx", ...args], {
  cwd: skillRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 1));
