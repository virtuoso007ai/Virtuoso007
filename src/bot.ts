import axios from "axios";
import { Telegraf, type Context } from "telegraf";
import type { AgentEntry } from "./agents.js";
import { getAgent, getHlWallet } from "./agents.js";
import { degenAccountErrorHint, fetchDgAccount, formatAccountBlock } from "./account.js";
import { fetchDgPositions, formatPositionBlock } from "./positions.js";
import { resolveWalletAddress } from "./wallet-resolve.js";
import { createAcpClient, jobPerpClose, jobPerpModify, jobPerpOpen, jobPerpCancelLimit } from "./acp.js";
import { fetchHyperliquidOpenOrders } from "./openOrders.js";
import {
  buildLeaderboardHtml,
  defaultSeasonId,
  fetchLeaderboardAll,
  fetchLeaderboardTop,
  indexByWallet,
  normalizeWallet,
  type AgentLbMatch,
  type LbApiEntry,
} from "./leaderboard.js";
import { HELP } from "./help.js";
import {
  createStrategy,
  listStrategies,
  toggleStrategy,
  deleteStrategy,
  testStrategy,
  formatStrategyList,
} from "./strategy.js";

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

/** Paritedeki tüm açık limit emirleri — HL `openOrders` ile oid bulunup `cancel_limit` gönderilir. */
async function cancelLimitsOnPair(
  client: ReturnType<typeof createAcpClient>,
  pair: string,
  wallet: string
): Promise<string[]> {
  const p = pair.toUpperCase();
  const rows = await fetchHyperliquidOpenOrders(wallet);
  
  // HL coin format: "HYPE-USD", "BTC-USD", vb. — kullanıcı sadece "HYPE" yazınca "-USD" ekle
  const normalizedPair = p.includes("-") ? p : `${p}-USD`;
  
  const hits = rows.filter((r) => {
    const coin = String(r.coin).toUpperCase();
    return coin === normalizedPair || coin === p;
  });
  
  if (hits.length === 0) {
    return [`Bu paritede açık limit emri yok (HL: ${normalizedPair})`];
  }
  const out: string[] = [];
  for (const row of hits) {
    try {
      const data = await jobPerpCancelLimit(client, p, row.oid);
      out.push(`oid ${row.oid} → job ${data?.data?.jobId ?? "?"}`);
    } catch (e) {
      out.push(`oid ${row.oid} → ${errText(e).slice(0, 160)}`);
    }
  }
  return out;
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

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * HTML mesajları parça parça. Telegram HTML’de &lt;br&gt; yok — satır sonu \\n kullan.
 * Uzun mesajda \\n ile böl; tek satır limiti aşarsa zorla kes.
 */
async function replyChunkedHtml(ctx: Context, html: string): Promise<void> {
  const max = 3500;
  const text = html.replace(/\r\n/g, "\n");
  if (text.length <= max) {
    await ctx.reply(text, { parse_mode: "HTML" });
    return;
  }
  const lines = text.split("\n");
  let buf = "";
  for (const line of lines) {
    const next = buf === "" ? line : `${buf}\n${line}`;
    if (next.length <= max) {
      buf = next;
      continue;
    }
    if (buf !== "") {
      await ctx.reply(buf, { parse_mode: "HTML" });
    }
    if (line.length <= max) {
      buf = line;
    } else {
      let rest = line;
      while (rest.length > max) {
        await ctx.reply(rest.slice(0, max), { parse_mode: "HTML" });
        rest = rest.slice(max);
      }
      buf = rest;
    }
  }
  if (buf !== "") await ctx.reply(buf, { parse_mode: "HTML" });
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
      const sepBetweenAgents = "\n────────\n";
      for (const a of [...agents.values()].sort((x, y) => x.alias.localeCompare(y.alias))) {
        const w = await resolveWalletAddress(a);
        if (!w) {
          blocks.push(
            `<b>${escHtml(a.alias)}</b>\n<i>Cüzdan alınamadı</i> — <code>walletAddress</code> veya <code>/acp/me</code>`
          );
          continue;
        }
        try {
          const rows = await fetchDgPositions(w);
          blocks.push(formatPositionBlock(a.alias, a.label, rows));
        } catch (e) {
          const hint = degenAccountErrorHint(e);
          blocks.push(
            `<b>${escHtml(a.alias)}</b>\n<i>${escHtml(hint ?? errText(e).slice(0, 400))}</i>`
          );
        }
      }
      try {
        await replyChunkedHtml(ctx, blocks.join(sepBetweenAgents));
      } catch (e) {
        console.error("[positions all]", e);
        await ctx.reply(`Gönderim hatası: ${errText(e).slice(0, 800)}`);
      }
      return;
    }

    const agent = requireAgent(agents, sub);
    if (!agent) {
      await ctx.reply("Geçersiz alias. /agents");
      return;
    }

    const wallet = await resolveWalletAddress(agent);
    if (!wallet) {
      await ctx.reply(
        "<i>Cüzdan bulunamadı.</i> <code>apiKey</code> / <code>/acp/me</code> veya <code>walletAddress</code> kontrol et.",
        { parse_mode: "HTML" }
      );
      return;
    }

    await ctx.reply("Çekiliyor…");
    try {
      const rows = await fetchDgPositions(wallet);
      await replyChunkedHtml(ctx, formatPositionBlock(agent.alias, agent.label, rows));
    } catch (e) {
      const hint = degenAccountErrorHint(e);
      if (hint) {
        await ctx.reply(hint);
        return;
      }
      await ctx.reply(
        `<b>Hata</b>\n<pre>${escHtml(errText(e).slice(0, 3500))}</pre>`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.command(["balance", "bakiye", "account"], async (ctx) => {
    const parts = commandRest(ctx);
    const sub = parts[0]?.trim();

    if (!sub) {
      await ctx.reply(
        "Kullanım:\n• /balance raichu — tek agent HL bakiye\n• /balance all — hepsi\n(/bakiye /account aynı)"
      );
      return;
    }

    if (sub.toLowerCase() === "all") {
      await ctx.reply("HL hesap bilgisi çekiliyor…");
      const blocks: string[] = [];
      for (const a of [...agents.values()].sort((x, y) => x.alias.localeCompare(y.alias))) {
        const w = await resolveWalletAddress(a);
        if (!w) {
          blocks.push(
            `${a.alias} — cüzdan alınamadı (walletAddress veya /acp/me)`
          );
          continue;
        }
        try {
          const acc = await fetchDgAccount(w);
          blocks.push(formatAccountBlock(a.alias, a.label, acc));
        } catch (e) {
          const hint = degenAccountErrorHint(e);
          blocks.push(`${a.alias} — ${hint ?? errText(e).slice(0, 280)}`);
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

    const wallet = await resolveWalletAddress(agent);
    if (!wallet) {
      await ctx.reply(
        "Cüzdan bulunamadı. apiKey ile /acp/me veya AGENTS_JSON’da walletAddress."
      );
      return;
    }

    await ctx.reply("Çekiliyor…");
    try {
      const acc = await fetchDgAccount(wallet);
      await replyChunked(ctx, formatAccountBlock(agent.alias, agent.label, acc));
    } catch (e) {
      const hint = degenAccountErrorHint(e);
      await ctx.reply(hint ?? `Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  bot.command(["leaderboard", "lb"], async (ctx) => {
    const parts = commandRest(ctx);
    const mode = parts[0]?.toLowerCase();
    const seasonId = defaultSeasonId();

    const collectMatches = async (byW: Map<string, LbApiEntry>): Promise<AgentLbMatch[]> => {
      const out: AgentLbMatch[] = [];
      for (const a of [...agents.values()].sort((x, y) => x.alias.localeCompare(y.alias))) {
        const w = await resolveWalletAddress(a);
        if (!w) {
          out.push({ alias: a.alias, label: a.label, walletResolved: false, entry: null });
          continue;
        }
        const entry = byW.get(normalizeWallet(w)) ?? null;
        out.push({ alias: a.alias, label: a.label, walletResolved: true, entry });
      }
      return out;
    };

    try {
      if (mode === "top") {
        await ctx.reply("Leaderboard (ilk 20) çekiliyor…");
        const { rows, seasonName, total } = await fetchLeaderboardTop(seasonId, 20);
        const byW = indexByWallet(rows);
        const matches = await collectMatches(byW);
        await replyChunkedHtml(
          ctx,
          buildLeaderboardHtml({
            seasonName,
            total,
            matches,
            topRows: rows,
            previewOnly: true,
          })
        );
        return;
      }

      await ctx.reply("Leaderboard taranıyor (tüm sayfalar)…");
      const { rows, seasonName, total } = await fetchLeaderboardAll(seasonId);
      const byW = indexByWallet(rows);
      const matches = await collectMatches(byW);
      await replyChunkedHtml(
        ctx,
        buildLeaderboardHtml({
          seasonName,
          total,
          matches,
          topRows: rows.slice(0, 20),
          previewOnly: false,
        })
      );
    } catch (e) {
      await ctx.reply(
        `<b>Leaderboard hatası</b>\n<pre>${escHtml(errText(e).slice(0, 3500))}</pre>`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.command("open", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw, sideRaw, sizeRaw, levRaw, slRaw, tpRaw, orderTypeRaw, limitPriceRaw] = parts;
    const pair = pairRaw?.toUpperCase();
    const side = sideRaw?.toLowerCase() as "long" | "short" | undefined;

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias. /agents ile listele.");
      return;
    }
    if (!pair || (side !== "long" && side !== "short") || !sizeRaw) {
      await ctx.reply(
        "Kullanım: /open <alias> <PAIR> <long|short> <size> [kaldıraç] [SL] [TP] [orderType] [limitPrice]\nÖrnek: /open raichu ETH long 50 10\nLimit: /open raichu ETH long 50 10 2000 2200 limit 2100"
      );
      return;
    }
    const leverage = levRaw ? Number.parseInt(levRaw, 10) : 5;
    if (!Number.isFinite(leverage) || leverage < 1) {
      await ctx.reply("Kaldıraç geçersiz (varsayılan 5).");
      return;
    }

    const stopLoss = slRaw && slRaw !== "-" ? slRaw : undefined;
    const takeProfit = tpRaw && tpRaw !== "-" ? tpRaw : undefined;
    const orderType = orderTypeRaw === "limit" ? "limit" : "market";
    const limitPrice = orderType === "limit" && limitPriceRaw ? limitPriceRaw : undefined;

    let msg = `İşlem oluşturuluyor: ${agent.alias} → ${pair} ${side} ${sizeRaw} ${leverage}x`;
    if (stopLoss) msg += ` SL:${stopLoss}`;
    if (takeProfit) msg += ` TP:${takeProfit}`;
    if (orderType === "limit") msg += ` [Limit: ${limitPrice}]`;
    await ctx.reply(msg + "…");

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpOpen(client, {
        pair,
        side,
        size: sizeRaw,
        leverage,
        stopLoss,
        takeProfit,
        orderType,
        limitPrice,
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

  bot.command("cancel", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw, oidRaw] = parts;
    const pair = pairRaw?.toUpperCase();

    const agent = requireAgent(agents, alias);
    if (!agent) {
      await ctx.reply("Geçersiz alias.");
      return;
    }
    if (!pair) {
      await ctx.reply(
        "Kullanım: /cancel <alias> <PAIR> [oid]\n" +
          "Tek emir (oid): /cancel taxerclaw ENA 377198646148\n" +
          "Paritedeki tüm limitler (oid yok): /cancel taxerclaw ENA — HL açık emirler taranır."
      );
      return;
    }

    const oidStr = oidRaw?.trim();
    await ctx.reply(
      `Limit iptal: ${agent.alias} ${pair}${oidStr ? ` oid=${oidStr}` : " (tümü)"}…`
    );

    try {
      const client = createAcpClient(agent.apiKey);
      if (oidStr) {
        if (!/^\d+$/.test(oidStr)) {
          await ctx.reply("Hata: oid yalnızca rakam olmalı (örn. 377198646148).");
          return;
        }
        const data = await jobPerpCancelLimit(client, pair, oidStr);
        await ctx.reply(`✅ İptal:\n${JSON.stringify(data, null, 2)}`);
        return;
      }
      const wallet = getHlWallet(agent);
      if (!wallet) {
        await ctx.reply("Hata: HL cüzdanı yok (AGENTS_JSON hlWallet veya walletAddress).");
        return;
      }
      const lines = await cancelLimitsOnPair(client, pair, wallet);
      await ctx.reply(`✅ Sonuç:\n${lines.join("\n")}`);
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  bot.command("modify", async (ctx) => {
    const parts = commandRest(ctx);
    const [alias, pairRaw, slRaw, tpRaw, levRaw] = parts;
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
    const leverage = levRaw && !skipToken(levRaw) ? Number.parseInt(levRaw, 10) : undefined;

    if (!pair || (!stopLoss && !takeProfit && !leverage)) {
      await ctx.reply(
        "Kullanım:\n" +
          "• İkisi: /modify raichu ETH 2000 2200\n" +
          "• Sadece SL: /modify raichu ETH 2000 - -\n" +
          "• Sadece TP: /modify raichu ETH - 2200 -\n" +
          "• Leverage: /modify raichu ETH - - 15"
      );
      return;
    }

    const slLabel = stopLoss ?? "(yok)";
    const tpLabel = takeProfit ?? "(yok)";
    const levLabel = leverage ? `${leverage}x` : "(değişmiyor)";
    await ctx.reply(`perp_modify: ${agent.alias} ${pair} SL=${slLabel} TP=${tpLabel} Lev=${levLabel}…`);

    try {
      const client = createAcpClient(agent.apiKey);
      const data = await jobPerpModify(client, { pair, stopLoss, takeProfit, leverage });
      await ctx.reply(JSON.stringify(data, null, 2));
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  bot.command("liq", async (ctx) => {
    const parts = commandRest(ctx);
    const [aliasArg] = parts;

    if (!aliasArg) {
      await ctx.reply("Kullanım: /liq <alias> veya /liq all");
      return;
    }

    if (aliasArg.toLowerCase() === "all") {
      const rows: string[] = [];
      for (const [alias, agent] of agents) {
        const wallet = await resolveWalletAddress(agent);
        if (!wallet) {
          rows.push(`${alias}: wallet bulunamadı`);
          continue;
        }
        try {
          const positions = await fetchDgPositions(wallet);
          if (positions.length === 0) {
            rows.push(`${alias}: pozisyon yok`);
          } else {
            for (const pos of positions) {
              const pair = pos.pair ?? "?";
              const side = pos.side ?? "?";
              const liqPrice = pos.liquidationPrice ?? "N/A";
              const entry = pos.entryPrice ?? "?";
              const lev = pos.leverage ?? "?";
              rows.push(`${alias} | ${pair} ${side} | Entry: ${entry} | Liq: ${liqPrice} | Lev: ${lev}x`);
            }
          }
        } catch (e) {
          rows.push(`${alias}: ${errText(e).slice(0, 200)}`);
        }
      }
      await ctx.reply(rows.length > 0 ? rows.join("\n") : "Hiç pozisyon yok.");
      return;
    }

    const agent = requireAgent(agents, aliasArg);
    if (!agent) {
      await ctx.reply("Geçersiz alias. /agents ile listele.");
      return;
    }

    const wallet = await resolveWalletAddress(agent);
    if (!wallet) {
      await ctx.reply(`${agent.alias} için wallet adresi bulunamadı.`);
      return;
    }

    try {
      const positions = await fetchDgPositions(wallet);
      if (positions.length === 0) {
        await ctx.reply(`${agent.alias}: pozisyon yok.`);
        return;
      }
      const rows: string[] = positions.map((pos) => {
        const pair = pos.pair ?? "?";
        const side = pos.side ?? "?";
        const liqPrice = pos.liquidationPrice ?? "N/A";
        const entry = pos.entryPrice ?? "?";
        const mark = pos.markPrice ?? "?";
        const lev = pos.leverage ?? "?";
        const upnl = pos.unrealizedPnl ?? "?";
        return `${pair} ${side} | Entry: ${entry} | Mark: ${mark} | Liq: ${liqPrice} | Lev: ${lev}x | uPnL: ${upnl}`;
      });
      await ctx.reply(`${agent.alias} pozisyonlar:\n${rows.join("\n")}`);
    } catch (e) {
      await ctx.reply(`Hata: ${errText(e).slice(0, 3500)}`);
    }
  });

  // ================================================================
  // MULTI-AGENT KOMUTLAR
  // ================================================================

  bot.command(["openmulti", "openm"], async (ctx) => {
    const parts = commandRest(ctx);
    const [aliasesRaw, pairRaw, sideRaw, sizeRaw, levRaw, slRaw, tpRaw, orderTypeRaw, limitPriceRaw] = parts;
    
    if (!aliasesRaw || !pairRaw || !sideRaw || !sizeRaw) {
      await ctx.reply(
        "Kullanım: /openmulti <alias1,alias2,...> <PAIR> <long|short> <size> [kaldıraç] [SL] [TP] [orderType] [limitPrice]\n" +
        "Örnek: /openmulti raichu,friday,venom BTC long 50 10\n" +
        "TP/SL ile: /openmulti raichu,friday BTC long 50 10 40000 45000"
      );
      return;
    }

    const aliasesList = aliasesRaw.split(",").map(s => s.trim()).filter(Boolean);
    const pair = pairRaw.toUpperCase();
    const side = sideRaw.toLowerCase() as "long" | "short";
    if (side !== "long" && side !== "short") {
      await ctx.reply("Side 'long' veya 'short' olmalı.");
      return;
    }

    const leverage = levRaw ? Number.parseInt(levRaw, 10) : 5;
    if (!Number.isFinite(leverage) || leverage < 1) {
      await ctx.reply("Kaldıraç geçersiz (varsayılan 5).");
      return;
    }

    const stopLoss = slRaw && slRaw !== "-" ? slRaw : undefined;
    const takeProfit = tpRaw && tpRaw !== "-" ? tpRaw : undefined;
    const orderType = orderTypeRaw === "limit" ? "limit" : "market";
    const limitPrice = orderType === "limit" && limitPriceRaw ? limitPriceRaw : undefined;

    await ctx.reply(`🔄 ${aliasesList.length} agent için işlem başlatılıyor:\n${aliasesList.join(", ")}\n${pair} ${side} ${sizeRaw} ${leverage}x${stopLoss ? ` SL:${stopLoss}` : ""}${takeProfit ? ` TP:${takeProfit}` : ""}…`);

    const results: string[] = [];
    for (const alias of aliasesList) {
      const agent = agents.get(alias);
      if (!agent) {
        results.push(`❌ ${alias}: bulunamadı`);
        continue;
      }
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpOpen(client, {
          pair,
          side,
          size: sizeRaw,
          leverage,
          stopLoss,
          takeProfit,
          orderType,
          limitPrice,
        });
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command("openall", async (ctx) => {
    const parts = commandRest(ctx);
    const [pairRaw, sideRaw, sizeRaw, levRaw, slRaw, tpRaw, orderTypeRaw, limitPriceRaw] = parts;
    
    if (!pairRaw || !sideRaw || !sizeRaw) {
      await ctx.reply(
        "Kullanım: /openall <PAIR> <long|short> <size> [kaldıraç] [SL] [TP] [orderType] [limitPrice]\n" +
        "Örnek: /openall BTC long 50 10\n" +
        "Tüm agentlara aynı işlemi gönderir."
      );
      return;
    }

    const aliasesList = Array.from(agents.keys());
    const pair = pairRaw.toUpperCase();
    const side = sideRaw.toLowerCase() as "long" | "short";
    if (side !== "long" && side !== "short") {
      await ctx.reply("Side 'long' veya 'short' olmalı.");
      return;
    }

    const leverage = levRaw ? Number.parseInt(levRaw, 10) : 5;
    if (!Number.isFinite(leverage) || leverage < 1) {
      await ctx.reply("Kaldıraç geçersiz (varsayılan 5).");
      return;
    }

    const stopLoss = slRaw && slRaw !== "-" ? slRaw : undefined;
    const takeProfit = tpRaw && tpRaw !== "-" ? tpRaw : undefined;
    const orderType = orderTypeRaw === "limit" ? "limit" : "market";
    const limitPrice = orderType === "limit" && limitPriceRaw ? limitPriceRaw : undefined;

    await ctx.reply(`🔄 TÜM agentlara işlem (${aliasesList.length} agent):\n${pair} ${side} ${sizeRaw} ${leverage}x${stopLoss ? ` SL:${stopLoss}` : ""}${takeProfit ? ` TP:${takeProfit}` : ""}…`);

    const results: string[] = [];
    for (const [alias, agent] of agents) {
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpOpen(client, {
          pair,
          side,
          size: sizeRaw,
          leverage,
          stopLoss,
          takeProfit,
          orderType,
          limitPrice,
        });
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command(["closemulti", "closem"], async (ctx) => {
    const parts = commandRest(ctx);
    const [aliasesRaw, pairRaw] = parts;
    
    if (!aliasesRaw || !pairRaw) {
      await ctx.reply(
        "Kullanım: /closemulti <alias1,alias2,...> <PAIR>\n" +
        "Örnek: /closemulti raichu,friday,venom BTC"
      );
      return;
    }

    const aliasesList = aliasesRaw.split(",").map(s => s.trim()).filter(Boolean);
    const pair = pairRaw.toUpperCase();

    await ctx.reply(`🔄 ${aliasesList.length} agent için kapatma işlemi:\n${aliasesList.join(", ")} → ${pair}…`);

    const results: string[] = [];
    for (const alias of aliasesList) {
      const agent = agents.get(alias);
      if (!agent) {
        results.push(`❌ ${alias}: bulunamadı`);
        continue;
      }
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpClose(client, pair);
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command("closeall", async (ctx) => {
    const parts = commandRest(ctx);
    const [pairRaw] = parts;
    
    if (!pairRaw) {
      await ctx.reply("Kullanım: /closeall <PAIR>\nÖrnek: /closeall BTC\nTüm agentların bu paritedeki pozisyonlarını kapatır.");
      return;
    }

    const aliasesList = Array.from(agents.keys());
    const pair = pairRaw.toUpperCase();

    await ctx.reply(`🔄 TÜM agentlar için kapatma (${aliasesList.length} agent):\n${pair}…`);

    const results: string[] = [];
    for (const [alias, agent] of agents) {
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpClose(client, pair);
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command(["cancelmulti", "cancelm"], async (ctx) => {
    const parts = commandRest(ctx);
    const [aliasesRaw, pairRaw] = parts;

    if (!aliasesRaw || !pairRaw) {
      await ctx.reply(
        "Kullanım: /cancelmulti <alias1,alias2,...> <PAIR>\nÖrnek: /cancelmulti raichu,friday VIRTUAL\n(Her agent için paritedeki tüm limit emirleri HL üzerinden iptal edilir.)"
      );
      return;
    }

    const aliasesList = aliasesRaw.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const pair = pairRaw.toUpperCase();

    await ctx.reply(`🔄 ${aliasesList.length} agent için limit iptal:\n${pair}…`);

    const results: string[] = [];
    for (const alias of aliasesList) {
      const agent = agents.get(alias);
      if (!agent) {
        results.push(`❌ ${alias}: agent bulunamadı`);
        continue;
      }
      try {
        const client = createAcpClient(agent.apiKey);
        const wallet = await resolveWalletAddress(agent);
        if (!wallet) {
          results.push(`❌ ${alias}: cüzdan yok`);
          continue;
        }
        const lines = await cancelLimitsOnPair(client, pair, wallet);
        results.push(`✅ ${alias}: ${lines.join(" | ")}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command("cancelall", async (ctx) => {
    const parts = commandRest(ctx);
    const [pairRaw] = parts;
    
    if (!pairRaw) {
      await ctx.reply(
        "Kullanım: /cancelall <PAIR>\nÖrnek: /cancelall VIRTUAL\nTüm agentların bu paritedeki açık limit emirleri (HL oid ile) iptal edilir."
      );
      return;
    }

    const aliasesList = Array.from(agents.keys());
    const pair = pairRaw.toUpperCase();

    await ctx.reply(`🔄 TÜM agentlar için limit iptal (${aliasesList.length} agent):\n${pair}…`);

    const results: string[] = [];
    for (const [alias, agent] of agents) {
      try {
        const client = createAcpClient(agent.apiKey);
        const wallet = getHlWallet(agent);
        if (!wallet) {
          results.push(`❌ ${alias}: HL cüzdan yok`);
          continue;
        }
        const lines = await cancelLimitsOnPair(client, pair, wallet);
        results.push(`✅ ${alias}: ${lines.join(" | ")}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command(["modifymulti", "modifym"], async (ctx) => {
    const parts = commandRest(ctx);
    const [aliasesRaw, pairRaw, slRaw, tpRaw, levRaw] = parts;
    
    if (!aliasesRaw || !pairRaw) {
      await ctx.reply(
        "Kullanım: /modifymulti <alias1,alias2,...> <PAIR> [SL] [TP] [leverage]\n" +
        "Örnek: /modifymulti raichu,friday BTC 40000 45000\n" +
        "Leverage: /modifymulti raichu,friday BTC - - 15"
      );
      return;
    }

    const aliasesList = aliasesRaw.split(",").map(s => s.trim()).filter(Boolean);
    const pair = pairRaw.toUpperCase();

    const skipToken = (s: string | undefined): boolean =>
      s == null || /^[-_]$|^(skip|yok|none)$/i.test(String(s).trim());

    const stopLoss = skipToken(slRaw) ? undefined : slRaw;
    const takeProfit = skipToken(tpRaw) ? undefined : tpRaw;
    const leverage = levRaw && !skipToken(levRaw) ? Number.parseInt(levRaw, 10) : undefined;

    if (!stopLoss && !takeProfit && !leverage) {
      await ctx.reply("En az bir parametre (SL/TP/leverage) gerekli.");
      return;
    }

    const slLabel = stopLoss ?? "-";
    const tpLabel = takeProfit ?? "-";
    const levLabel = leverage ? `${leverage}x` : "-";
    await ctx.reply(`🔄 ${aliasesList.length} agent için modify:\n${aliasesList.join(", ")} → ${pair} SL=${slLabel} TP=${tpLabel} Lev=${levLabel}…`);

    const results: string[] = [];
    for (const alias of aliasesList) {
      const agent = agents.get(alias);
      if (!agent) {
        results.push(`❌ ${alias}: bulunamadı`);
        continue;
      }
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpModify(client, { pair, stopLoss, takeProfit, leverage });
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  bot.command("modifyall", async (ctx) => {
    const parts = commandRest(ctx);
    const [pairRaw, slRaw, tpRaw, levRaw] = parts;
    
    if (!pairRaw) {
      await ctx.reply(
        "Kullanım: /modifyall <PAIR> [SL] [TP] [leverage]\n" +
        "Örnek: /modifyall BTC 40000 45000\n" +
        "Tüm agentların bu paritedeki pozisyonlarını modify eder."
      );
      return;
    }

    const aliasesList = Array.from(agents.keys());
    const pair = pairRaw.toUpperCase();

    const skipToken = (s: string | undefined): boolean =>
      s == null || /^[-_]$|^(skip|yok|none)$/i.test(String(s).trim());

    const stopLoss = skipToken(slRaw) ? undefined : slRaw;
    const takeProfit = skipToken(tpRaw) ? undefined : tpRaw;
    const leverage = levRaw && !skipToken(levRaw) ? Number.parseInt(levRaw, 10) : undefined;

    if (!stopLoss && !takeProfit && !leverage) {
      await ctx.reply("En az bir parametre (SL/TP/leverage) gerekli.");
      return;
    }

    const slLabel = stopLoss ?? "-";
    const tpLabel = takeProfit ?? "-";
    const levLabel = leverage ? `${leverage}x` : "-";
    await ctx.reply(`🔄 TÜM agentlar için modify (${aliasesList.length} agent):\n${pair} SL=${slLabel} TP=${tpLabel} Lev=${levLabel}…`);

    const results: string[] = [];
    for (const [alias, agent] of agents) {
      try {
        const client = createAcpClient(agent.apiKey);
        const data = await jobPerpModify(client, { pair, stopLoss, takeProfit, leverage });
        const jobId = data?.data?.jobId;
        results.push(`✅ ${alias}: job ${jobId ?? "?"}`);
      } catch (e) {
        results.push(`❌ ${alias}: ${errText(e).slice(0, 200)}`);
      }
    }
    await ctx.reply(results.join("\n"));
  });

  // ==================== STRATEGY MANAGEMENT ====================

  bot.command("strategy", async (ctx) => {
    const args = commandRest(ctx);
    if (args.length === 0) {
      await ctx.reply(
        "Usage:\n" +
        "/strategy create <alias> <type> [size] [lev] [tp%] [sl%]\n" +
        "/strategy list [alias]\n" +
        "/strategy enable <strategyId>\n" +
        "/strategy disable <strategyId>\n" +
        "/strategy delete <strategyId> <alias>\n" +
        "/strategy test <strategyId>"
      );
      return;
    }

    const subcommand = args[0].toLowerCase();

    try {
      switch (subcommand) {
        case "create": {
          const [, alias, strategyType, size, lev, tp, sl] = args;
          if (!alias || !strategyType) {
            await ctx.reply("❌ Usage: /strategy create <alias> <type> [size] [lev] [tp%] [sl%]");
            return;
          }

          const result = await createStrategy({
            agentAlias: alias,
            strategyType,
            positionSizeUSD: size ? parseFloat(size) : 100,
            leverage: lev ? parseInt(lev) : 3,
            tpPercent: tp ? parseFloat(tp) : 3.5,
            slPercent: sl ? parseFloat(sl) : 3,
          });

          if (result.success && result.strategy) {
            await replyChunkedHtml(
              ctx,
              `✅ <b>Strategy Created</b>\n\n` +
              `Agent: <code>${result.strategy.agentAlias}</code>\n` +
              `Type: ${result.strategy.strategyType}\n` +
              `Size: $${result.strategy.positionSizeUSD} | Lev: ${result.strategy.leverage}x\n` +
              `TP: ${result.strategy.takeProfitPercent}% | SL: ${result.strategy.stopLossPercent}%\n` +
              `Status: ⏸️ DISABLED (use /strategy enable to activate)\n\n` +
              `ID: <code>${result.strategy.id}</code>`
            );
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        case "list": {
          const [, alias] = args;
          const result = await listStrategies(alias);

          if (result.success && result.strategies) {
            await replyChunkedHtml(ctx, formatStrategyList(result.strategies));
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        case "enable": {
          const [, strategyId] = args;
          if (!strategyId) {
            await ctx.reply("❌ Usage: /strategy enable <strategyId>");
            return;
          }

          // Extract agent alias from strategyId (format: alias_type_timestamp)
          const agentAlias = strategyId.split("_")[0];
          const result = await toggleStrategy(strategyId, agentAlias, true);

          if (result.success) {
            await ctx.reply(`✅ Strategy enabled: ${strategyId}`);
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        case "disable": {
          const [, strategyId] = args;
          if (!strategyId) {
            await ctx.reply("❌ Usage: /strategy disable <strategyId>");
            return;
          }

          const agentAlias = strategyId.split("_")[0];
          const result = await toggleStrategy(strategyId, agentAlias, false);

          if (result.success) {
            await ctx.reply(`✅ Strategy disabled: ${strategyId}`);
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        case "delete": {
          const [, strategyId, alias] = args;
          if (!strategyId || !alias) {
            await ctx.reply("❌ Usage: /strategy delete <strategyId> <alias>");
            return;
          }

          const result = await deleteStrategy(strategyId, alias);

          if (result.success) {
            await ctx.reply(`✅ Strategy deleted: ${strategyId}`);
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        case "test": {
          const [, strategyId] = args;
          if (!strategyId) {
            await ctx.reply("❌ Usage: /strategy test <strategyId>");
            return;
          }

          const result = await testStrategy(strategyId);

          if (result.success && result.signal) {
            const sig = result.signal.signal;
            await replyChunkedHtml(
              ctx,
              `📊 <b>Strategy Test Result</b>\n\n` +
              `Signal: <b>${sig.signal.toUpperCase()}</b>\n` +
              `Strength: ${sig.strength}%\n` +
              `Reason: ${sig.reason}\n` +
              `Price: $${result.signal.latestPrice}\n` +
              `Candles: ${result.signal.candleCount}`
            );
          } else {
            await ctx.reply(`❌ Failed: ${result.error}`);
          }
          break;
        }

        default:
          await ctx.reply(`❌ Unknown subcommand: ${subcommand}`);
      }
    } catch (error) {
      await ctx.reply(`❌ Error: ${errText(error)}`);
    }
  });
}
