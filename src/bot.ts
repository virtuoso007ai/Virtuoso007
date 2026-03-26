import axios from "axios";
import { Telegraf, type Context } from "telegraf";
import type { AgentEntry } from "./agents.js";
import { getAgent } from "./agents.js";
import { createAcpClient, jobPerpClose, jobPerpModify, jobPerpOpen } from "./acp.js";
import { fetchDgPositions, formatPositionBlock } from "./positions.js";

const HELP = `Degen Claw — komutlar (/agents ile alias doğrula)

Aç — size pariteye göre:
• ETH/BTC/SOL vb.: genelde USDC notional
• VIRTUAL: coin adedi (USDC değil)
/open <alias> <PAIR> <long|short> <size> [kaldıraç]
Örnek: /open raichu ETH long 50 10
VIRTUAL: /open raichu VIRTUAL long 49 5

Kapat: /close <alias> <PAIR>

TP/SL (ikisi birden):
/modify <alias> <PAIR> <SL> <TP>
Örnek: /modify raichu ETH 2000 2200

Sadece SL (TP yok): /modify <alias> <PAIR> <SL> -
Sadece TP (SL yok): /modify <alias> <PAIR> - <TP>
(- = bu tarafı gönderme; Degen reddederse mevcut TP/SL’yi yazıp ikisini birden güncelle)

Açık pozlar (Degen Claw / HL):
/positions <alias>   ör. /positions raichu
/positions all       tüm agentlar
(/poz aynı)

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

const TG_MAX = 3900;

async function replyChunked(ctx: Context, text: string): Promise<void> {
  if (text.length <= TG_MAX) {
    await ctx.reply(text);
    return;
  }
  for (let i = 0; i < text.length; i += TG_MAX) {
    await ctx.reply(text.slice(i, i + TG_MAX));
  }
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

  bot.command(["positions", "poz"], async (ctx) => {
    const parts = commandRest(ctx);
    const sub = parts[0]?.trim();

    if (!sub) {
      await ctx.reply(
        "Kullanım:\n• /positions raichu — tek agent\n• /positions all — hepsi\n(/poz aynı)"
      );
      return;
    }

    if (sub.toLowerCase() === "all") {
      await ctx.reply("Pozisyonlar çekiliyor…");
      const blocks: string[] = [];
      for (const a of [...agents.values()].sort((x, y) => x.alias.localeCompare(y.alias))) {
        if (!a.walletAddress?.trim()) {
          blocks.push(`${a.alias} — cüzdan yok (walletAddress)`);
          continue;
        }
        try {
          const rows = await fetchDgPositions(a.walletAddress);
          blocks.push(formatPositionBlock(a.alias, a.label, rows));
        } catch (e) {
          blocks.push(`${a.alias} — ${errText(e).slice(0, 280)}`);
        }
      }
      await replyChunked(ctx, blocks.join("\n\n"));
      return;
    }

    const agent = requireAgent(agents, sub);
    if (!agent) {
      await ctx.reply("Geçersiz alias. /agents");
      return;
    }
    if (!agent.walletAddress?.trim()) {
      await ctx.reply(
        "Bu agent için walletAddress yok. `npm run sync:agents` (config’te cüzdan) veya AGENTS_JSON’a ekle."
      );
      return;
    }

    await ctx.reply("Çekiliyor…");
    try {
      const rows = await fetchDgPositions(agent.walletAddress);
      await replyChunked(ctx, formatPositionBlock(agent.alias, agent.label, rows));
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
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
    const [alias, pairRaw, slRaw, tpRaw] = parts;
    const pair = pairRaw?.toUpperCase();

    const skipToken = (s: string | undefined): boolean =>
      s == null || /^[-_]$|^(skip|yok|none)$/i.test(String(s).trim());

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias.");
      return;
    }

    const stopLoss = skipToken(slRaw) ? undefined : slRaw;
    const takeProfit = skipToken(tpRaw) ? undefined : tpRaw;

    if (!pair || (!stopLoss && !takeProfit)) {
      await ctx.reply(
        "Kullanım:\n" +
          "• İkisi: /modify raichu ETH 2000 2200\n" +
          "• Sadece SL: /modify raichu ETH 2000 -\n" +
          "• Sadece TP: /modify raichu ETH - 2200"
      );
      return;
    }

    const slLabel = stopLoss ?? "(yok)";
    const tpLabel = takeProfit ?? "(yok)";
    await ctx.reply(`perp_modify: ${agent.alias} ${pair} SL=${slLabel} TP=${tpLabel}…`);

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpModify(client, { pair, stopLoss, takeProfit });
      await ctx.reply(JSON.stringify(data, null, 2));
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });
}
