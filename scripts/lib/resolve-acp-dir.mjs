/**
 * Rehber + run-acp-v2 ile ayni: vendor/acp-cli yoksa acp-cli-v2.
 */
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * @param {string} repoRoot
 * @returns {{ acpDir: string; acpBin: string } | null}
 */
export function resolveAcpCli(repoRoot) {
  /** acp-cli-v2 once: bu repoda migrate / join akisi burada. */
  const candidates = [
    path.join(repoRoot, "acp-cli-v2"),
    path.join(repoRoot, "vendor", "acp-cli"),
  ];
  const acpDir = candidates.find((dir) =>
    existsSync(path.join(dir, "bin", "acp.ts"))
  );
  if (!acpDir) return null;
  return { acpDir, acpBin: path.join(acpDir, "bin", "acp.ts") };
}
