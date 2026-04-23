/**
 * Degen Claw legacy perp_deposit job olusturur. Sonra: npm run degen:fund -- <jobId>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const acpDir = path.join(root, "vendor", "acp-cli");
const tsxCli = path.join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
const acpBin = path.join(acpDir, "bin", "acp.ts");

const amount = process.argv[2]?.trim() || "30";
const requirements = JSON.stringify({ amount });

if (!existsSync(tsxCli) || !existsSync(acpBin)) {
  console.error("acp-cli veya tsx bulunamadi. vendor/acp-cli icinde npm install calistir.");
  process.exit(1);
}

const args = [
  tsxCli,
  acpBin,
  "client",
  "create-job",
  "--provider",
  "0xd478a8B40372db16cA8045F28C6FE07228F3781A",
  "--offering-name",
  "perp_deposit",
  "--requirements",
  requirements,
  "--chain-id",
  "8453",
  "--legacy",
  "--json",
];

console.error(`perp_deposit requirements: ${requirements} (Base chain 8453, legacy provider)\n`);

const r = spawnSync(process.execPath, args, {
  cwd: acpDir,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

process.exit(r.status ?? 1);
