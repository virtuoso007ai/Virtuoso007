import "dotenv/config";
import http from "http";
import { Telegraf } from "telegraf";
import { loadAgents } from "./agents.js";
import { registerBot } from "./bot.js";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN gerekli");
  process.exit(1);
}

const agents = loadAgents();
const bot = new Telegraf(token);
registerBot(bot, agents);

const port = Number(process.env.PORT || 3000);
http
  .createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
  })
  .listen(port, () => {
    console.log(`[health] http://0.0.0.0:${port}/`);
  });

bot.launch().then(() => {
  console.log("[telegram] bot çalışıyor (long polling)");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
