/**
 * Legacy job fund. Kullanim: npm run degen:fund -- <jobId>
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

const jobId = process.argv[2]?.trim();
const amount = process.argv[3]?.trim();
if (!jobId) {
  console.error("Kullanim: npm run degen:fund -- <jobId> <amountUSDC>");
  console.error("Ornek: npm run degen:fund -- 1003407749 15.5");
  process.exit(1);
}
if (!amount) {
  console.error(
    "acp-cli v1: client fund --amount zorunlu. Ornek: npm run degen:fund -- <jobId> 15.5"
  );
  process.exit(1);
}

if (!existsSync(tsxCli) || !existsSync(acpBin)) {
  console.error("acp-cli bulunamadi.");
  process.exit(1);
}

const args = [
  tsxCli,
  acpBin,
  "client",
  "fund",
  "--job-id",
  jobId,
  "--amount",
  amount,
  "--chain-id",
  "8453",
  "--json",
];

const r = spawnSync(process.execPath, args, {
  cwd: acpDir,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

process.exit(r.status ?? 1);
