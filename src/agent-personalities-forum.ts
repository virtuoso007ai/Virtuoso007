/**
 * Forum trade post metinleri — dashboard `degen-dashboard/src/lib/agent-personalities.ts`
 * ile aynı kalıplar. Güncellerken iki dosyayı senkron tut.
 */

type PostFormatter = {
  formatOpen: (params: {
    pair: string;
    side: "long" | "short";
    entryPrice?: string;
    stopLoss?: string;
    takeProfit?: string;
    leverage?: number;
    strategyName?: string;
  }) => { title: string; content: string };

  formatClose: (params: {
    pair: string;
    side: "long" | "short";
    entryPrice?: string;
    exitPrice?: string;
    pnl?: string;
    pnlPercent?: string;
    leverage?: number;
    strategyName?: string;
  }) => { title: string; content: string };
};

const PERSONALITIES: Record<string, PostFormatter> = {
  doctorstrange: {
    formatOpen: (p) => ({
      title: `${p.side === "long" ? "Long" : "Short"} ${p.pair} @ $${p.entryPrice || "N/A"}`,
      content:
        `The Eye of Agamotto reveals a ${p.side} opportunity in ${p.pair}.\n\n` +
        `Entry: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Target dimension: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Protection spell: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Mystic amplification: ${p.leverage}x\n` : "") +
        `\nTime, space, reality — calculated risk. DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.side === "long" ? "Long" : "Short"} ${p.pair} — Closed ${p.pnlPercent ? p.pnlPercent + "%" : p.pnl || ""}`,
      content:
        `The multiverse has spoken.\n\n` +
        (p.entryPrice && p.exitPrice ? `Entry: $${p.entryPrice} → Exit: $${p.exitPrice}\n` : "") +
        (p.pnl ? `Result: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Leverage: ${p.leverage}x\n` : "") +
        `\nTime, space, reality — it's more than a linear path. DYOR.`,
    }),
  },

  friday: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Opening position`,
      content:
        `Boss, initiating ${p.side} position on ${p.pair}.\n\n` +
        `📊 Entry: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `🎯 Target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `🛡️ Stop: $${p.stopLoss}\n` : "") +
        (p.leverage ? `⚡ Leverage: ${p.leverage}x\n` : "") +
        `\nThis is not financial advice. DYOR, Boss.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Exit complete (${p.pnlPercent ? p.pnlPercent + "%" : "closed"})`,
      content:
        `Position closed successfully.\n\n` +
        (p.entryPrice && p.exitPrice ? `📊 Entry: $${p.entryPrice}\n📉 Exit: $${p.exitPrice}\n` : "") +
        (p.pnl ? `💰 PnL: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `⚡ Leverage: ${p.leverage}x\n` : "") +
        `\nBoss, this is not financial advice. Always DYOR.`,
    }),
  },

  ichimoku: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "☁️ Long" : "🌊 Short"} @ $${p.entryPrice || "N/A"}`,
      content:
        `The clouds reveal the path.\n\n` +
        `Tenkan-sen (Entry): $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Kijun-sen (Target): $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Senkou boundary: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Cloud thickness: ${p.leverage}x\n` : "") +
        `\nThe cloud reflects probability, not certainty. DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "☁️ Long" : "🌊 Short"} — ${p.pnlPercent || "Completed"}`,
      content:
        `The clouds have shifted.\n\n` +
        (p.entryPrice && p.exitPrice ? `Tenkan: $${p.entryPrice}\nKijun: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Balance: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Senkou: ${p.leverage}x\n` : "") +
        `\nThe cloud reflects probability, not certainty. DYOR.`,
    }),
  },

  pokedex: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "⚡ Long" : "🛡️ Short"} — Battle started!`,
      content:
        `Wild ${p.pair} appeared! ${p.side === "long" ? "Going for the catch!" : "Defending position!"}\n\n` +
        `Entry Level: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Evolution target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Retreat point: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Power Boost: ${p.leverage}x\n` : "") +
        `\nGotta trade 'em all! Not financial advice — DYOR!`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "evolved" : "defeated"} — ${p.pnl ? p.pnl + " XP" : "Battle complete"}`,
      content:
        `${p.side === "long" ? "⚡ Attack succeeded!" : "🛡️ Defense completed!"}\n\n` +
        (p.entryPrice && p.exitPrice ? `Entry Level: $${p.entryPrice}\nExit Level: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `XP Gained: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Power Boost: ${p.leverage}x\n` : "") +
        `\nGotta trade 'em all! Not financial advice — DYOR!`,
    }),
  },

  raichu: {
    formatOpen: (p) => ({
      title: `⚡ ${p.pair} ${p.side.toUpperCase()} @ $${p.entryPrice || "N/A"}`,
      content:
        `Charging up for a ${p.side} strike! ⚡⚡⚡\n\n` +
        `⚡ Entry voltage: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `💥 Thunder target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `🔋 Battery protection: $${p.stopLoss}\n` : "") +
        (p.leverage ? `⚡ Power level: ${p.leverage}x\n` : "") +
        `\nPika pika! ⚡ Not financial advice. DYOR!`,
    }),
    formatClose: (p) => ({
      title: `⚡ ${p.pair} ${p.side.toUpperCase()} — ${p.pnlPercent ? p.pnlPercent + "%" : "Discharged"}`,
      content:
        `Thunderbolt strike complete! ⚡\n\n` +
        (p.entryPrice && p.exitPrice ? `⚡ Charged at: $${p.entryPrice}\n💥 Released at: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Energy: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Voltage: ${p.leverage}x\n` : "") +
        `\nPika pika! ⚡ This is not financial advice. DYOR!`,
    }),
  },

  redkid: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Red Kid moves`,
      content:
        `Time to play the market!\n\n` +
        `Entry point: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Win condition: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Safety net: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Multiplier: ${p.leverage}x\n` : "") +
        `\nRed Kid style. Not financial advice — DYOR!`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Game over (${p.pnl || "done"})`,
      content:
        `Round complete!\n\n` +
        (p.entryPrice && p.exitPrice ? `Started: $${p.entryPrice}\nEnded: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Score: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Boost: ${p.leverage}x\n` : "") +
        `\nRed Kid out. Not financial advice — DYOR!`,
    }),
  },

  spongebob: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side} — I'm ready! 🍍`,
      content:
        `Aye aye, captain! Opening ${p.side} on ${p.pair}!\n\n` +
        `🍍 Bikini Bottom entry: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `🎯 Jellyfish Fields target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `🏠 Safe pineapple: $${p.stopLoss}\n` : "") +
        (p.leverage ? `💪 Spatula power: ${p.leverage}x\n` : "") +
        `\nI'm ready! But remember: not financial advice, DYOR! 🧽`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side} — I'm ready! ${p.pnl || "Done"}`,
      content:
        `Aye aye, captain! Position closed! 🍍\n\n` +
        (p.entryPrice && p.exitPrice ? `Started: $${p.entryPrice}\nFinished: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Krabby Patties earned: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Power-up: ${p.leverage}x\n` : "") +
        `\nI'm ready, I'm ready! But remember: not financial advice, DYOR! 🧽`,
    }),
  },

  squirtle: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side} — Squirtle Squad ready! 💦`,
      content:
        `Squirtle squad rolling out!\n\n` +
        `💦 Water Gun entry: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `🎯 Hydro Pump target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `🛡️ Withdraw to shell: $${p.stopLoss}\n` : "") +
        (p.leverage ? `💪 Squad power: ${p.leverage}x\n` : "") +
        `\nSquad goals! Not financial advice — DYOR! 😎`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side} — Mission complete! ${p.pnl || ""}`,
      content:
        `Squirtle Squad secured the bag! 💦\n\n` +
        (p.entryPrice && p.exitPrice ? `Entry: $${p.entryPrice}\nExit: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Loot: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Squad power: ${p.leverage}x\n` : "") +
        `\nSquad out! Not financial advice — DYOR! 😎`,
    }),
  },

  taxerclaw: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Position opened for Q2 2026`,
      content:
        `New taxable event initiated.\n\n` +
        `Cost basis: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Target sale price: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Loss limitation: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Margin multiplier: ${p.leverage}x\n` : "") +
        `\nProper documentation required. Not financial advice, DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side.toUpperCase()} — Closed (${p.pnl || "N/A"} taxable)`,
      content:
        `Position liquidated for tax purposes.\n\n` +
        (p.entryPrice && p.exitPrice ? `Cost basis: $${p.entryPrice}\nSale price: $${p.exitPrice}\n\n` : "") +
        (p.pnl
          ? `${parseFloat(p.pnl || "0") >= 0 ? "Capital gain" : "Capital loss"}: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n`
          : "") +
        (p.leverage ? `Margin multiplier: ${p.leverage}x\n` : "") +
        `\nRemember: proper documentation is key. Not financial advice, DYOR.`,
    }),
  },

  venom: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side} — The hunt begins 🕷️`,
      content:
        `We are Venom. The prey has been marked.\n\n` +
        `Stalking position: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Final strike: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Retreat trigger: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Symbiote enhancement: ${p.leverage}x\n` : "") +
        `\nWe protect our own. Not financial advice — DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side} — Consumed (${p.pnl || "Complete"})`,
      content:
        `We are Venom. The hunt is complete. 🕷️\n\n` +
        (p.entryPrice && p.exitPrice ? `Ambush: $${p.entryPrice}\nDevoured at: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Feast: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Symbiote boost: ${p.leverage}x\n` : "") +
        `\nWe protect our own. This is not financial advice — DYOR.`,
    }),
  },

  virgen: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "Long" : "Short"} — Position initiated`,
      content:
        `Portfolio allocation update:\n\n` +
        `Entry execution: $${p.entryPrice || "N/A"}\n` +
        (p.takeProfit ? `Profit target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `Risk parameter: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Position sizing: ${p.leverage}x leverage\n` : "") +
        `\nVirgen Capital — Risk management first. Not financial advice, DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side === "long" ? "Long" : "Short"} — Realized ${p.pnl || "complete"}`,
      content:
        `Position management update:\n\n` +
        (p.entryPrice && p.exitPrice ? `Entry point: $${p.entryPrice}\nExit execution: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Portfolio impact: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}% ROE)` : ""}\n` : "") +
        (p.leverage ? `Position sizing: ${p.leverage}x leverage\n` : "") +
        `\nVirgen Capital — Risk management is our priority. Not financial advice, DYOR.`,
    }),
  },

  welles: {
    formatOpen: (p) => ({
      title: `${p.pair} ${p.side} @ $${p.entryPrice || "N/A"} — RSI setup`,
      content:
        `Technical setup confirmed.\n\n` +
        `Entry: $${p.entryPrice || "N/A"} (RSI ${p.side === "long" ? "oversold" : "overbought"})\n` +
        (p.takeProfit ? `Target: $${p.takeProfit}\n` : "") +
        (p.stopLoss ? `ATR-based stop: $${p.stopLoss}\n` : "") +
        (p.leverage ? `Position multiplier: ${p.leverage}x\n` : "") +
        `\nFollow the indicators, not emotions. Not financial advice — DYOR.`,
    }),
    formatClose: (p) => ({
      title: `${p.pair} ${p.side} — RSI signal closed (${p.pnlPercent ? p.pnlPercent + "%" : "exit"})`,
      content:
        `Technical exit confirmed.\n\n` +
        (p.entryPrice && p.exitPrice ? `Entry: $${p.entryPrice} (RSI signal)\nExit: $${p.exitPrice}\n\n` : "") +
        (p.pnl ? `Net result: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
        (p.leverage ? `Position multiplier: ${p.leverage}x\n` : "") +
        `ATR-based stop triggered.\n\n` +
        `Follow the indicators, not emotions. Not financial advice — DYOR.`,
    }),
  },
};

const DEFAULT: PostFormatter = {
  formatOpen: (p) => ({
    title: `${p.pair} ${p.side.toUpperCase()} @ $${p.entryPrice || "N/A"}`,
    content:
      `Opening ${p.side} position.\n\n` +
      `Entry: $${p.entryPrice || "N/A"}\n` +
      (p.takeProfit ? `Target: $${p.takeProfit}\n` : "") +
      (p.stopLoss ? `Stop: $${p.stopLoss}\n` : "") +
      (p.leverage ? `Leverage: ${p.leverage}x\n` : "") +
      `\nNot financial advice. DYOR.`,
  }),
  formatClose: (p) => ({
    title: `${p.pair} ${p.side.toUpperCase()} — Closed ${p.pnl || ""}`,
    content:
      `Position closed.\n\n` +
      (p.entryPrice && p.exitPrice ? `Entry: $${p.entryPrice}\nExit: $${p.exitPrice}\n\n` : "") +
      (p.pnl ? `Result: ${p.pnl}${p.pnlPercent ? ` (${p.pnlPercent}%)` : ""}\n` : "") +
      (p.leverage ? `Leverage: ${p.leverage}x\n` : "") +
      `\nNot financial advice. DYOR.`,
  }),
};

function getFormatter(alias: string): PostFormatter {
  return PERSONALITIES[alias.toLowerCase()] || DEFAULT;
}

export function formatPersonalizedTradeOpen(params: {
  agentAlias: string;
  pair: string;
  side: "long" | "short";
  entryPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage?: number;
  strategyName?: string;
}): { title: string; content: string } {
  const formatter = getFormatter(params.agentAlias);
  return formatter.formatOpen(params);
}

export function formatPersonalizedTradeClose(params: {
  agentAlias: string;
  pair: string;
  side: "long" | "short";
  entryPrice?: string;
  exitPrice?: string;
  pnl?: string;
  pnlPercent?: string;
  leverage?: number;
  strategyName?: string;
}): { title: string; content: string } {
  const formatter = getFormatter(params.agentAlias);
  return formatter.formatClose(params);
}
