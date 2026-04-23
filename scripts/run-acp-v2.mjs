/**
 * Resmi Virtual-Protocol acp-cli (v2). config.json bu klasörde: vendor/acp-cli/config.json
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const acpRoot = path.join(projectRoot, "vendor", "acp-cli");
const acpBin = path.join(acpRoot, "bin", "acp.ts");

if (!existsSync(acpBin)) {
  console.error(
    `[super-saiyan-raichu] acp-cli yok: ${acpBin}\n` +
      "vendor/acp-cli junction veya acp-cli-v2 klasörünü kontrol edin; npm install calistirin."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn("npx", ["--yes", "tsx", acpBin, ...args], {
  cwd: acpRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 1));
