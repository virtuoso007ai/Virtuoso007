/**
 * Hyperliquid + Hypurrscan karisikligini gidermek icin tek ekranda durum.
 *
 *   node scripts/hl-diagnose-user.mjs 0x42aa...
 *   node scripts/hl-diagnose-user.mjs friday   (agents.local.json walletAddress)
 *
 * Not: Hypurrscan "TRANSACTIONS" = L1 deftere yazilmis GECMIS; satirlar "kapatilmaz".
 * Acik emir / pozisyon: app.hl.xyz Orders & Perps veya asagidaki openOrders / clearinghouse.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const agentsPath = path.join(root, "agents.local.json");

async function postInfo(body) {
  const r = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function main() {
  let addr = (process.argv[2] || "").trim();
  if (!addr) {
    console.error("Kullanim: node scripts/hl-diagnose-user.mjs <0x...|alias>");
    process.exit(1);
  }
  if (!addr.startsWith("0x")) {
    const raw = fs.readFileSync(agentsPath, "utf-8");
    const arr = JSON.parse(raw);
    const row = arr.find((r) => String(r.alias).toLowerCase() === addr.toLowerCase());
    if (!row?.walletAddress) {
      console.error("Alias veya agents.local.json yok:", addr);
      process.exit(1);
    }
    addr = String(row.walletAddress).trim();
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    console.error("Gecersiz adres");
    process.exit(1);
  }

  const u = addr;
  (async () => {
    const [ch, oo, fe, spot] = await Promise.all([
      postInfo({ type: "clearinghouseState", user: u }),
      postInfo({ type: "openOrders", user: u }),
      postInfo({ type: "frontendOpenOrders", user: u }),
      postInfo({ type: "spotClearinghouseState", user: u }),
    ]);

    const positions = ch?.assetPositions?.length ? ch.assetPositions : [];
    const perpVal = ch?.marginSummary?.accountValue ?? "?";

    console.log("=== adres", u, "===");
    console.log("Perp accountValue:", perpVal);
    console.log("Perp pozisyon sayisi:", positions.length);
    if (positions.length) {
      console.log(JSON.stringify(positions, null, 2).slice(0, 1200));
    }
    console.log("openOrders:", Array.isArray(oo) ? oo.length : oo);
    if (Array.isArray(oo) && oo.length) console.log(JSON.stringify(oo, null, 2).slice(0, 1500));
    console.log("frontendOpenOrders:", Array.isArray(fe) ? fe.length : fe);
    console.log("Spot balances:", JSON.stringify(spot?.balances ?? spot, null, 2));

    console.log("\n--- Hypurrscan ---");
    console.log(
      "TRANSACTIONS sekmesindeki 'order' satirlari = zincirde kayitli GECMIS; API ile silinemez.\n" +
        "Kapatilacak bir sey yoksa (openOrders bos, perp pozisyon yok) arayuzde de 'Orders' bos olmalidir."
    );
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
