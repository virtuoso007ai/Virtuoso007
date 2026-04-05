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
    } else {
      console.warn("[webhook] SIGNAL_WEBHOOK_SECRET yok — /webhook/signal 503 döner");
    }
  });

bot.launch().then(() => {
  console.log("[telegram] bot çalışıyor (long polling)");
  
  // Start strategy scheduler (runs every 15 minutes)
  if (process.env.ENABLE_STRATEGY_SCHEDULER === "true") {
    startStrategyScheduler();
    console.log("[scheduler] ✅ Strategy monitor scheduler started");
  } else {
    console.log("[scheduler] ⏸️  Strategy scheduler disabled (set ENABLE_STRATEGY_SCHEDULER=true to enable)");
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
