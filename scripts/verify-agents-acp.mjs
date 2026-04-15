/**
 * Her agent için claw-api GET /acp/me — anahtar geçerli mi, cüzdan JSON ile uyumlu mu.
 * Kullanım: node scripts/verify-agents-acp.mjs
 * Kaynak: AGENTS_JSON | AGENTS_JSON_PATH (varsayılan ./agents.local.json)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const ACP_URL = (process.env.ACP_API_URL || "https://claw-api.virtuals.io").replace(/\/$/, "");

function loadAgents() {
  const inline = process.env.AGENTS_JSON?.trim();
  if (inline) {
    return JSON.parse(inline);
  }
  const p = process.env.AGENTS_JSON_PATH?.trim()
    ? path.resolve(process.cwd(), process.env.AGENTS_JSON_PATH.trim())
    : path.join(root, "agents.local.json");
  if (!fs.existsSync(p)) {
    console.error(`Dosya yok: ${p}\nAGENTS_JSON veya AGENTS_JSON_PATH ayarla.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sameAddr(a, b) {
  if (!a || !b) return true;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function warnHlV2Key(alias, row) {
  if (!String(row.hlApiWalletKey ?? "").trim()) {
    console.warn(
      `[${alias}] UYARI: hlApiWalletKey yok — Telegram /open /close (HL v2) bu agent için çalışmaz.`
    );
  }
}

async function main() {
  const list = loadAgents();
  if (!Array.isArray(list) || list.length === 0) {
    console.error("Agent listesi boş.");
    process.exit(1);
  }

  let errors = 0;
  for (const row of list) {
    const alias = String(row.alias ?? "").trim() || "?";
    const apiKey = String(row.apiKey ?? "").trim();
    const expectWallet = row.walletAddress?.trim();

    if (!apiKey) {
      console.error(`[${alias}] apiKey yok`);
      errors++;
      continue;
    }

    try {
      const res = await fetch(`${ACP_URL}/acp/me`, {
        headers: { "x-api-key": apiKey },
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`[${alias}] HTTP ${res.status} — JSON değil`);
        errors++;
        continue;
      }

      if (!res.ok) {
        console.error(`[${alias}] HTTP ${res.status}: ${text.slice(0, 200)}`);
        errors++;
        continue;
      }

      const w = data?.data?.walletAddress?.trim();
      if (!w) {
        console.error(`[${alias}] /acp/me cüzdan döndürmedi`);
        errors++;
        continue;
      }

      const expectHl = row.hlWallet?.trim();
      if (expectHl) {
        if (!sameAddr(w, expectHl)) {
          console.log(
            `[${alias}] OK  api=/acp/me:${w}  hlWallet:${expectHl} (bot Degen için hlWallet kullanır)`
          );
        } else {
          console.log(`[${alias}] OK  wallet=${w}`);
        }
        warnHlV2Key(alias, row);
        continue;
      }

      if (expectWallet && !sameAddr(w, expectWallet)) {
        console.error(
          `[${alias}] UYUMSUZLUK: /acp/me=${w} — AGENTS_JSON walletAddress=${expectWallet}\n` +
            `  → eşleştir veya v2 HL için "hlWallet" alanı ekle.`
        );
        errors++;
        continue;
      }

      console.log(`[${alias}] OK  wallet=${w}`);
      warnHlV2Key(alias, row);
    } catch (e) {
      console.error(`[${alias}] ${e instanceof Error ? e.message : e}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} hata — Railway/Vercel'e yapıştırmadan önce düzelt.`);
    process.exit(1);
  }
  console.log(`\nTümü geçti (${list.length} agent).`);
}

main();
