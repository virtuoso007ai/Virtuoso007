import "dotenv/config";
import crypto from "crypto";
import http from "http";
import { URL } from "url";
import { Telegraf } from "telegraf";
import { loadAgents } from "./agents.js";
import { registerBot } from "./bot.js";
import { executeSignalAutoTrade } from "./signalWebhook.js";
import { startStrategyScheduler } from "./strategy-scheduler.js";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN gerekli");
  process.exit(1);
}

const agents = loadAgents();
console.log("[agents] aliases:", [...agents.keys()].sort().join(", "));
const bot = new Telegraf(token);
registerBot(bot, agents);

const port = Number(process.env.PORT || 3000);
const webhookSecret = process.env.SIGNAL_WEBHOOK_SECRET?.trim();

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getBearer(req: http.IncomingMessage): string | undefined {
  const raw = req.headers.authorization?.trim();
  if (!raw?.toLowerCase().startsWith("bearer ")) return undefined;
  return raw.slice(7).trim();
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    if (req.method === "POST" && url.pathname === "/webhook/signal") {
      if (!webhookSecret) {
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "SIGNAL_WEBHOOK_SECRET tanımlı değil — webhook kapalı" }));
        return;
      }

      const headerSecret = req.headers["x-signal-secret"];
      const fromHeader = typeof headerSecret === "string" ? headerSecret.trim() : "";
      const fromBearer = getBearer(req) ?? "";
      const provided = fromHeader || fromBearer;
      if (!provided || !timingSafeEqual(provided, webhookSecret)) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "yetkisiz" }));
        return;
      }

      let body: string;
      try {
        body = await readBody(req);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "okuma hatası" }));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "geçersiz JSON" }));
        return;
      }

      try {
        const result = await executeSignalAutoTrade(agents, parsed);
        const text = result.lines.join("\n");
        console.log("[webhook/signal]\n" + text);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            ok: result.ok,
            lines: result.lines,
            summary: text,
          })
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[webhook/signal]", msg);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: msg.slice(0, 500) }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  })
  .listen(port, () => {
    console.log(`[health] http://0.0.0.0:${port}/`);
    if (webhookSecret) {
      console.log(`[webhook] POST http://0.0.0.0:${port}/webhook/signal (x-signal-secret veya Bearer)`);
    }
  });

// Start strategy scheduler INDEPENDENTLY of Telegram bot
if (process.env.ENABLE_STRATEGY_SCHEDULER === "true") {
  startStrategyScheduler();
  console.log("[scheduler] ✅ Strategy monitor scheduler started");
} else {
  console.log("[scheduler] ⏸️  Strategy scheduler disabled (set ENABLE_STRATEGY_SCHEDULER=true to enable)");
}

// Launch Telegram bot with startup delay + retry logic for 409 Conflict
async function launchBot() {
  // Wait 20s on startup for previous container's long-polling to expire
  // Railway doesn't gracefully kill old containers during redeploy
  console.log("[telegram] Waiting 20s for previous instance to release polling...");
  await new Promise(r => setTimeout(r, 20000));
  
  // Delete any stale webhook
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log("[telegram] Webhook cleared");
  } catch (e) {
    console.warn("[telegram] deleteWebhook failed (non-fatal):", e);
  }
  
  // Retry loop with increasing delays
  const delays = [0, 10000, 20000, 30000, 60000]; // 0s, 10s, 20s, 30s, 60s
  
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      console.log(`[telegram] Retry ${attempt}/${delays.length - 1}: waiting ${delays[attempt] / 1000}s...`);
      await new Promise(r => setTimeout(r, delays[attempt]));
    }
    
    try {
      console.log(`[telegram] Attempt ${attempt + 1}/${delays.length}: Starting long polling...`);
      await bot.launch({ dropPendingUpdates: true });
      console.log("[telegram] ✅ Bot çalışıyor (long polling)");
      return; // success!
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const is409 = errMsg.includes("409") || errMsg.includes("Conflict");
      
      if (is409 && attempt < delays.length - 1) {
        console.warn(`[telegram] ⚠️ 409 Conflict on attempt ${attempt + 1}. Will retry...`);
      } else {
        console.error(`[telegram] ❌ Failed after ${attempt + 1} attempts:`, errMsg);
        if (is409) {
          console.error("[telegram] 💡 Bot commands disabled. Strategy scheduler continues.");
        }
        return; // Don't crash
      }
    }
  }
}

launchBot();

process.once("SIGINT", () => {
  console.log("[shutdown] SIGINT received, stopping bot...");
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  console.log("[shutdown] SIGTERM received, stopping bot...");
  bot.stop("SIGTERM");
  // Give bot 3s to cleanly close the polling connection, then exit
  setTimeout(() => process.exit(0), 3000);
});
