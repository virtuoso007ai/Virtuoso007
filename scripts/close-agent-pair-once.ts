/**
 * Tek sefer: agent alias + parite — perp pozisyon kapat (dgclaw trade.ts close ile ayni mantik)
 * + acik perp limitleri iptal.
 *
 *   npx tsx scripts/close-agent-pair-once.ts friday VIRTUAL
 *   npm run hl:diagnose -- friday   (Hypurrscan TRANSACTIONS != acik emir; once bunu calistir)
 */
import "dotenv/config";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { loadAgents, getAgent } from "../src/agents.js";
import { hlDirectClose, hlDirectCancelLimit } from "../src/hlDirectTrade.js";
import { fetchHyperliquidOpenOrders } from "../src/openOrders.js";

const alias = (process.argv[2] || "").trim().toLowerCase();
const pair = (process.argv[3] || "VIRTUAL").trim().toUpperCase();
if (!alias) {
  console.error("Kullanim: npx tsx scripts/close-agent-pair-once.ts <alias> [PAIR]");
  process.exit(1);
}

const agent = getAgent(loadAgents(), alias);
if (!agent) {
  console.error(`Alias yok: ${alias}`);
  process.exit(1);
}
const master = agent.walletAddress?.trim();
if (!master) {
  console.error("walletAddress yok");
  process.exit(1);
}

const normalizedPair = pair.includes("-") ? pair : `${pair}-USD`;

async function openOrdersForUser(user: string) {
  const t = new HttpTransport({});
  const info = new InfoClient({ transport: t });
  return info.openOrders({ user: user as `0x${string}` });
}

async function cancelOpenLimits(): Promise<void> {
  const wallets = [master, agent.hlWallet?.trim()].filter(
    (w, i, a): w is string => !!w && a.indexOf(w) === i
  );
  let rows: Awaited<ReturnType<typeof fetchHyperliquidOpenOrders>> = [];
  for (const w of wallets) {
    const part = await fetchHyperliquidOpenOrders(w);
    if (part.length) console.error(`[HL openOrders REST] ${w.slice(0, 12)}... count=${part.length}`);
    rows = rows.concat(part);
  }
  if (rows.length === 0) {
    for (const w of wallets) {
      try {
        const raw = await openOrdersForUser(w);
        if (Array.isArray(raw) && raw.length) {
          console.error(`[HL openOrders SDK] ${w.slice(0, 12)}... count=${raw.length}`);
          for (const o of raw as { coin?: string; oid?: number }[]) {
            rows.push({
              coin: String(o.coin ?? ""),
              side: "",
              limitPx: "",
              sz: "",
              oid: Number(o.oid),
              timestamp: 0,
              origSz: "",
            });
          }
        }
      } catch {
        /* */
      }
    }
  }
  const hits = rows.filter((r) => {
    const coin = String(r.coin).toUpperCase();
    return coin === normalizedPair || coin === pair;
  });
  if (hits.length === 0) {
    console.error(`Limit yok (${normalizedPair}) — bakilan: ${wallets.join(", ")}`);
    return;
  }
  for (const row of hits) {
    const oidNum =
      typeof row.oid === "number"
        ? row.oid
        : parseInt(String(row.oid), row.oid.toString().startsWith("0x") ? 16 : 10);
    const basePair = String(row.coin).split("-")[0].toUpperCase();
    try {
      const data = await hlDirectCancelLimit(agent, basePair, oidNum);
      console.error(`iptal oid ${row.coin} ${row.oid} -> ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e) {
      console.error(`iptal hata oid ${row.oid}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function main() {
  const t = new HttpTransport({});
  const info = new InfoClient({ transport: t });
  for (const w of [master, agent.hlWallet?.trim()].filter(Boolean) as string[]) {
    try {
      const st = await info.clearinghouseState({ user: w as `0x${string}` });
      const pos = st.assetPositions?.filter((row: { position: { coin: string } }) =>
        row.position.coin.toUpperCase().includes(pair)
      );
      if (pos?.length) {
        console.error(`pozisyon ${w.slice(0, 10)}:`, JSON.stringify(pos).slice(0, 300));
      }
    } catch {
      /* */
    }
  }
  try {
    const close = await hlDirectClose(agent, pair);
    console.error("kapat:", JSON.stringify(close).slice(0, 500));
  } catch (e) {
    console.error("kapat (pozisyon yok olabilir):", e instanceof Error ? e.message : e);
  }
  await cancelOpenLimits();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
