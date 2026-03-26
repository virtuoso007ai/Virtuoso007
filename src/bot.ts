import axios from "axios";
import { Telegraf, type Context } from "telegraf";
import type { AgentEntry } from "./agents.js";
import { getAgent } from "./agents.js";
import { createAcpClient, jobPerpClose, jobPerpModify, jobPerpOpen } from "./acp.js";

const HELP = `Degen Claw — komutlar (/agents ile alias doğrula)

Aç — size pariteye göre:
• ETH/BTC/SOL vb.: genelde USDC notional
• VIRTUAL: coin adedi (USDC değil)
/open <alias> <PAIR> <long|short> <size> [kaldıraç]
Örnek: /open raichu ETH long 50 10
VIRTUAL: /open raichu VIRTUAL long 49 5

Kapat: /close <alias> <PAIR>

TP/SL: /modify <alias> <PAIR> <stopLoss> <takeProfit>

/ping — sağlık`;

/** /open@BotName arg1 arg2 → [arg1, arg2] */
function commandRest(ctx: Context): string[] {
  const t = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  if (!t) return [];
  return t.trim().split(/\s+/).slice(1);
}

function errText(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data != null) {
    return typeof e.response.data === "string"
      ? e.response.data
      : JSON.stringify(e.response.data);
  }
  return e instanceof Error ? e.message : String(e);
}

function parseAllowedChatIds(): Set<string> {
  const raw = process.env.ALLOWED_CHAT_IDS?.trim() || process.env.ALLOWED_CHAT_ID?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isAuthorized(chatId: number | undefined, allowed: Set<string>): boolean {
  if (!chatId) return false;
  if (allowed.size === 0) {
    console.warn(
      "[bot] ALLOWED_CHAT_IDS tanımlı değil — tüm sohbetlere açık (üretimde mutlaka kısıtla!)"
    );
    return true;
  }
  return allowed.has(String(chatId));
}

function requireAgent(
  agents: Map<string, AgentEntry>,
  alias: string | undefined
): AgentEntry | null {
  if (!alias) return null;
  return getAgent(agents, alias) ?? null;
}

export function registerBot(
  bot: Telegraf,
  agents: Map<string, AgentEntry>
): void {
  const allowed = parseAllowedChatIds();

  bot.use(async (ctx, next) => {
    const id = ctx.chat?.id;
    if (!isAuthorized(id, allowed)) {
      await ctx.reply("Bu bot bu sohbet için yetkili değil.");
      return;
    }
    return next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(HELP);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP);
  });

  bot.command("ping", async (ctx) => {
    await ctx.reply("pong");
  });

  bot.command("agents", async (ctx) => {
    const lines = [...agents.values()].map(
      (a) => `• ${a.alias}${a.label ? ` — ${a.label}` : ""}`
    );
    await ctx.reply(`Kayıtlı agentlar:\n${lines.join("\n")}`);
  });

  bot.command("open", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw, sideRaw, sizeRaw, levRaw] = parts;
    const pair = pairRaw?.toUpperCase();
    const side = sideRaw?.toLowerCase() as "long" | "short" | undefined;

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias. /agents ile listele.");
      return;
    }
    if (!pair || (side !== "long" && side !== "short") || !sizeRaw) {
      await ctx.reply(
        "Kullanım: /open <alias> <PAIR> <long|short> <size> [kaldıraç]\nÖrnek: /open raichu ETH long 50 10"
      );
      return;
    }
    const leverage = levRaw ? Number.parseInt(levRaw, 10) : 5;
    if (!Number.isFinite(leverage) || leverage < 1) {
      await ctx.reply("Kaldıraç geçersiz (varsayılan 5).");
      return;
    }

    await ctx.reply(`İşlem oluşturuluyor: ${agent.alias} → ${pair} ${side} ${sizeRaw} ${leverage}x…`);

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpOpen(client, {
        pair,
        side,
        size: sizeRaw,
        leverage,
      });
      await ctx.reply(`Tamam.\n${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  bot.command("close", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw] = parts;
    const pair = pairRaw?.toUpperCase();

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias.");
      return;
    }
    if (!pair) {
      await ctx.reply("Kullanım: /close <alias> <PAIR>\nÖrnek: /close raichu ETH");
      return;
    }

    await ctx.reply(`Kapatma job: ${agent.alias} ${pair}…`);

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpClose(client, pair);
      await ctx.reply(JSON.stringify(data, null, 2));
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  bot.command("modify", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw, sl, tp] = parts;
    const pair = pairRaw?.toUpperCase();

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias.");
      return;
    }
    if (!pair || !sl || !tp) {
      await ctx.reply(
        "Kullanım: /modify <alias> <PAIR> <stopLoss> <takeProfit>\nÖrnek: /modify raichu ETH 2000 2200"
      );
      return;
    }

    await ctx.reply(`perp_modify: ${agent.alias} ${pair} SL=${sl} TP=${tp}…`);

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpModify(client, { pair, stopLoss: sl, takeProfit: tp });
      await ctx.reply(JSON.stringify(data, null, 2));
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });
}
