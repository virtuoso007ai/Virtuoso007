/**
 * dgclaw join_leaderboard — Windows/Git Bash'ta --legacy kaybini onler.
 * Cikti: vendor/dgclaw-skill/.env icine DGCLAW_API_KEY
 */
import {
  constants,
  createPrivateKey,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const acpDir = path.join(root, "vendor", "acp-cli");
const dgclawEnv = path.join(root, "vendor", "dgclaw-skill", ".env");
const tsxCli = path.join(acpDir, "node_modules", "tsx", "dist", "cli.mjs");
const acpBin = path.join(acpDir, "bin", "acp.ts");
const PROVIDER = "0xd478a8B40372db16cA8045F28C6FE07228F3781A";
const CHAIN = "8453";

function acpArgs(extra) {
  return [tsxCli, acpBin, ...extra];
}

function runAcp(extra, label) {
  const r = spawnSync(process.execPath, acpArgs(extra), {
    cwd: acpDir,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
    windowsHide: true,
  });
  const out = (r.stdout || "").trim();
  const err = (r.stderr || "").trim();
  if (r.status !== 0) {
    throw new Error(
      `${label} failed (${r.status}): ${err || out || "no output"}`
    );
  }
  return out;
}

function pemBody(pem) {
  return pem
    .split("\n")
    .filter((l) => !l.includes("-----"))
    .join("")
    .trim();
}

function decryptOaep(privatePem, encryptedB64) {
  const buf = Buffer.from(String(encryptedB64).replace(/\s/g, ""), "base64");
  const key = createPrivateKey(privatePem);
  for (const oaepHash of ["sha256", "sha1"]) {
    try {
      return privateDecrypt(
        {
          key,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash,
        },
        buf
      ).toString("utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("RSA decrypt failed (oaep sha256/sha1)");
}

function parseJsonLine(s) {
  const lines = s.split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{")) {
      try {
        return JSON.parse(line);
      } catch {
        /* continue */
      }
    }
  }
  return JSON.parse(s);
}

function appendDgclawApiKey(key) {
  let content = "";
  if (existsSync(dgclawEnv)) {
    content = readFileSync(dgclawEnv, "utf-8");
    content = content
      .split("\n")
      .filter((line) => !line.startsWith("DGCLAW_API_KEY="))
      .join("\n");
    if (content && !content.endsWith("\n")) content += "\n";
  }
  content += `DGCLAW_API_KEY=${key}\n`;
  writeFileSync(dgclawEnv, content, "utf-8");
}

function main() {
  if (!existsSync(tsxCli) || !existsSync(acpBin)) {
    console.error("vendor/acp-cli eksik veya npm install yapilmamis.");
    process.exit(1);
  }

  const backupDir = path.join(root, ".dgclaw-join-keys");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  console.error("ACP whoami...");
  const whoRaw = runAcp(["agent", "whoami", "--json"], "whoami");
  const who = parseJsonLine(whoRaw);
  const wallet = who.walletAddress;
  const token = who.chains?.[0]?.tokenAddress;
  if (!wallet) {
    console.error(whoRaw);
    throw new Error("walletAddress yok — agent use yap");
  }
  if (!token) {
    throw new Error("Agent token yok — once token launch gerekir");
  }
  console.error(`Agent: ${who.name || "?"}  wallet: ${wallet}`);
  console.error(`Token: ${token}`);

  console.error("RSA 2048 uretiliyor...");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const pubBody = pemBody(publicKey);
  const privPath = path.join(backupDir, `join_private_${ts}.pem`);
  writeFileSync(privPath, privateKey, { mode: 0o600 });
  console.error(`Ozel anahtar yedek: ${privPath}`);

  const requirements = JSON.stringify({
    agentAddress: wallet,
    publicKey: pubBody,
  });

  console.error("join_leaderboard job (legacy) olusturuluyor...");
  const createOut = runAcp(
    [
      "client",
      "create-job",
      "--legacy",
      "--provider",
      PROVIDER,
      "--offering-name",
      "join_leaderboard",
      "--requirements",
      requirements,
      "--chain-id",
      CHAIN,
      "--json",
    ],
    "create-job"
  );
  const created = parseJsonLine(createOut);
  const jobId = created.jobId ?? created.data?.jobId;
  if (!jobId) {
    console.error(createOut);
    throw new Error("jobId alinamadi");
  }
  console.error(`Job: ${jobId}`);

  console.error("Fund...");
  runAcp(
    [
      "client",
      "fund",
      "--job-id",
      String(jobId),
      "--amount",
      "0.02",
      "--chain-id",
      CHAIN,
      "--json",
    ],
    "fund"
  );

  console.error("Tamamlanmasi bekleniyor (5 dk timeout)... ");
  let encryptedB64 = "";
  const deadline = Date.now() + 5 * 60 * 1000;
  function sleepMs(ms) {
    const t = Date.now() + ms;
    while (Date.now() < t) {
      /* sync wait */
    }
  }
  while (Date.now() < deadline) {
    const histRaw = runAcp(
      [
        "job",
        "history",
        "--job-id",
        String(jobId),
        "--chain-id",
        CHAIN,
        "--json",
      ],
      "job history"
    );
    const hist = parseJsonLine(histRaw);
    let d = hist.deliverable;
    if (typeof d === "string") {
      try {
        d = JSON.parse(d);
      } catch {
        d = null;
      }
    }
    encryptedB64 = d?.encryptedApiKey || "";
    if (encryptedB64) break;
    const status = String(hist.status || hist.phase || "");
    if (/fail|reject/i.test(status)) {
      throw new Error(`Job basarisiz: ${JSON.stringify(hist).slice(0, 500)}`);
    }
    sleepMs(5000);
  }

  if (!encryptedB64) {
    throw new Error(
      "encryptedApiKey gelmedi — job history ciktisini kontrol et, biraz sonra tekrar dene"
    );
  }

  const apiKey = decryptOaep(privateKey, encryptedB64);
  appendDgclawApiKey(apiKey.trim());
  console.error(`\nTamam. DGCLAW_API_KEY yazildi: ${dgclawEnv}`);
  console.error("Forum/leaderboard API icin kullanilir.");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
