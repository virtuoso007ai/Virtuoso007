/**
 * Strategy management functions for Telegram bot
 */

import axios from "axios";

const DASHBOARD_API = process.env.DASHBOARD_API_URL || "http://localhost:3000";

export interface StrategyConfig {
  id: string;
  agentAlias: string;
  strategyType: string;
  enabled: boolean;
  tickInterval: string;
  candleInterval: string;
  positionSizeUSD: number;
  leverage: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  parameters: Record<string, any>;
  createdAt: string;
  lastSignalAt?: string;
}

const STRATEGY_PRESETS: Record<string, { name: string; defaultParams: any }> = {
  rsi_reversal: {
    name: "RSI Reversal",
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
  },
  ema_cross: {
    name: "EMA Cross",
    defaultParams: { fastPeriod: 9, slowPeriod: 21 },
  },
  macd_histogram: {
    name: "MACD Histogram",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  },
  macd_crossover: {
    name: "MACD Crossover",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  },
  trendtrader_combined: {
    name: "TrendTrader Combined",
    defaultParams: {
      rsi: { period: 14, oversold: 30, overbought: 70 },
      ema: { fastPeriod: 9, slowPeriod: 21 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      requireAll: false,
    },
  },
  rsi_divergence: {
    name: "RSI Divergence",
    defaultParams: { period: 14, lookbackBars: 5 },
  },
};

export async function createStrategy(params: {
  agentAlias: string;
  strategyType: string;
  positionSizeUSD?: number;
  leverage?: number;
  tpPercent?: number;
  slPercent?: number;
}): Promise<{ success: boolean; strategy?: StrategyConfig; error?: string }> {
  try {
    const preset = STRATEGY_PRESETS[params.strategyType];
    if (!preset) {
      return { success: false, error: `Unknown strategy type: ${params.strategyType}` };
    }

    const response = await axios.post(`${DASHBOARD_API}/api/strategies`, {
      agentAlias: params.agentAlias,
      strategyType: params.strategyType,
      enabled: false, // Start disabled
      tickInterval: "15m",
      candleInterval: "15m",
      positionSizeUSD: params.positionSizeUSD || 100,
      leverage: params.leverage || 3,
      takeProfitPercent: params.tpPercent || 3.5,
      stopLossPercent: params.slPercent || 3,
      parameters: preset.defaultParams,
    });

    return { success: true, strategy: response.data };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : String(error),
    };
  }
}

export async function listStrategies(agentAlias?: string): Promise<{
  success: boolean;
  strategies?: StrategyConfig[];
  error?: string;
}> {
  try {
    const url = agentAlias
      ? `${DASHBOARD_API}/api/strategies?agent=${agentAlias}`
      : `${DASHBOARD_API}/api/strategies`;

    const response = await axios.get(url);
    return { success: true, strategies: response.data };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : String(error),
    };
  }
}

export async function toggleStrategy(
  strategyId: string,
  agentAlias: string,
  enable: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the strategy
    const getResponse = await axios.get(
      `${DASHBOARD_API}/api/strategies?agent=${agentAlias}`
    );
    const strategy = getResponse.data.find((s: StrategyConfig) => s.id === strategyId);

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    // Update it
    await axios.put(`${DASHBOARD_API}/api/strategies`, {
      ...strategy,
      enabled: enable,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : String(error),
    };
  }
}

export async function deleteStrategy(
  strategyId: string,
  agentAlias: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.delete(
      `${DASHBOARD_API}/api/strategies?id=${strategyId}&agent=${agentAlias}`
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : String(error),
    };
  }
}

export async function testStrategy(strategyId: string): Promise<{
  success: boolean;
  signal?: any;
  error?: string;
}> {
  try {
    const response = await axios.post(`${DASHBOARD_API}/api/strategies/test`, {
      strategyId,
      pair: "BTC",
    });

    return { success: true, signal: response.data };
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : String(error),
    };
  }
}

export function formatStrategyList(strategies: StrategyConfig[]): string {
  if (strategies.length === 0) {
    return "No strategies found.";
  }

  const strategyNames: Record<string, string> = {
    rsi_reversal: "RSI Reversal",
    ema_cross: "EMA Cross",
    macd_histogram: "MACD Histogram",
    macd_crossover: "MACD Crossover",
    trendtrader_combined: "TrendTrader Combined",
    rsi_divergence: "RSI Divergence",
  };

  let text = `📊 <b>Strategies (${strategies.length})</b>\n\n`;

  strategies.forEach((s, i) => {
    const status = s.enabled ? "✅ ACTIVE" : "⏸️ DISABLED";
    const strategyName = strategyNames[s.strategyType] || s.strategyType;

    text += `<b>${i + 1}. ${status}</b>\n`;
    text += `Agent: <code>${s.agentAlias}</code>\n`;
    text += `Strategy: ${strategyName}\n`;
    text += `Size: $${s.positionSizeUSD} | Leverage: ${s.leverage}x\n`;
    text += `TP: ${s.takeProfitPercent}% | SL: ${s.stopLossPercent}%\n`;
    text += `ID: <code>${s.id}</code>\n`;

    if (s.lastSignalAt) {
      text += `Last Signal: ${new Date(s.lastSignalAt).toLocaleString()}\n`;
    }

    text += "\n";
  });

  return text;
}
