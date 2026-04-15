/**
 * HL exchange.cancel — master openOrders içinde pariteye uyan TÜM açık emirleri iptal.
 * dgclaw trade.ts modify içindeki cancel ile aynı API.
 *
 *   npx tsx scripts/cancel-agent-open-orders.ts friday VIRTUAL
 */
import "dotenv/config";
import { loadAgents, getAgent } from "../src/agents.js";
import { hlDirectCancelAllOpenOrdersForPair } from "../src/hlDirectTrade.js";

const alias = (process.argv[2] || "").trim().toLowerCase();
const pair = (process.argv[3] || "").trim();
if (!alias || !pair) {
  console.error("Kullanim: npx tsx scripts/cancel-agent-open-orders.ts <alias> <PAIR>");
  process.exit(1);
}

const agent = getAgent(loadAgents(), alias);
if (!agent) {
  console.error("Alias yok:", alias);
  process.exit(1);
}

hlDirectCancelAllOpenOrdersForPair(agent, pair)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    if (r.errors.length) process.exitCode = 1;
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
