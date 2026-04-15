/**
 * Hyperliquid perp — dgclaw-skill trade.ts ile aynı mantık (ACP perp_trade job yok).
 * Gerekli: AGENTS_JSON `hlApiWalletKey` (API cüzdan private key), `walletAddress` (master / Privy).
 * `size` = USDC notional (ör. 25 → ~25$ pozisyon).
 */
import { privateKeyToAccount } from "viem/accounts";
import { HttpTransport, ExchangeClient, InfoClient } from "@nktkas/hyperliquid";
import type { AgentEntry } from "./agents.js";

function hlApiBase(): string {
  const u = process.env.HYPERLIQUID_INFO_URL?.trim();
  if (u) {
    try {
      const x = new URL(u);
      return `${x.origin}`;
    } catch {
      /* fallthrough */
    }
  }
  return "https://api.hyperliquid.xyz";
}

function normalizePk(raw: string): `0x${string}` {
  const s = raw.trim();
  const hex = s.startsWith("0x") ? s : `0x${s}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("hlApiWalletKey geçersiz (64 hex, 0x ile).");
  }
  return hex as `0x${string}`;
}

function masterAddress(agent: AgentEntry): `0x${string}` {
  const m = agent.walletAddress?.trim();
  if (!m || !/^0x[0-9a-fA-F]{40}$/i.test(m)) {
    throw new Error(
      "HL v2: walletAddress (master Privy adresi) AGENTS_JSON'da zorunlu — /acp/me ile aynı olmalı."
    );
  }
  return m as `0x${string}`;
}

export function assertHlDirectAgent(agent: AgentEntry): void {
  if (!agent.hlApiWalletKey?.trim()) {
    throw new Error(
      "HL v2: bu agent için AGENTS_JSON içinde hlApiWalletKey yok (add-api-wallet çıktısı; repoya commit etme)."
    );
  }
  masterAddress(agent);
}

function createClients(agent: AgentEntry): {
  exchange: ExchangeClient;
  info: InfoClient;
  master: `0x${string}`;
} {
  assertHlDirectAgent(agent);
  const account = privateKeyToAccount(normalizePk(agent.hlApiWalletKey!));
  const transport = new HttpTransport({ apiUrl: hlApiBase() });
  const info = new InfoClient({ transport });
  const exchange = new ExchangeClient({ wallet: account, transport });
  return { exchange, info, master: masterAddress(agent) };
}

type AssetMeta = { name: string; szDecimals: number; maxLeverage: number };

async function getAssetIndex(
  info: InfoClient,
  pair: string
): Promise<{ index: number; meta: AssetMeta }> {
  const metaResponse = await info.meta();
  const universe = metaResponse.universe;
  const idx = universe.findIndex((a: { name: string }) => a.name.toUpperCase() === pair.toUpperCase());
  if (idx === -1) {
    throw new Error(`Bilinmeyen parite: ${pair}`);
  }
  return { index: idx, meta: universe[idx] as AssetMeta };
}

function formatPrice(price: number, significantFigures = 5): string {
  return price.toPrecision(significantFigures);
}

function formatSize(usdSize: number, price: number, szDecimals: number): string {
  return (usdSize / price).toFixed(szDecimals);
}

export type HlDirectOpenParams = {
  pair: string;
  side: "long" | "short";
  /** USDC notional */
  sizeUsd: number;
  leverage: number;
  stopLoss?: string;
  takeProfit?: string;
  orderType?: "market" | "limit";
  limitPrice?: string;
};

export async function hlDirectOpen(agent: AgentEntry, p: HlDirectOpenParams): Promise<unknown> {
  const { exchange, info } = createClients(agent);
  const pair = p.pair.toUpperCase();
  const { index: assetId, meta } = await getAssetIndex(info, pair);
  const isBuy = p.side === "long";
  const leverage = p.leverage >= 1 ? p.leverage : 1;

  await exchange.updateLeverage({
    asset: assetId,
    isCross: true,
    leverage,
  });

  const mids = await info.allMids();
  const midPrice = parseFloat(mids[pair] ?? "");
  if (!Number.isFinite(midPrice) || midPrice <= 0) {
    throw new Error(`${pair} için mid fiyat alınamadı`);
  }

  let orderPrice: string;
  let tif: "Ioc" | "Gtc";
  if (p.orderType === "limit" && p.limitPrice?.trim()) {
    orderPrice = p.limitPrice.trim();
    tif = "Gtc";
  } else {
    const slippage = isBuy ? 1.01 : 0.99;
    orderPrice = formatPrice(midPrice * slippage);
    tif = "Ioc";
  }

  const sz = formatSize(p.sizeUsd, midPrice, meta.szDecimals);
  const main = await exchange.order({
    orders: [
      {
        a: assetId,
        b: isBuy,
        r: false,
        p: orderPrice,
        s: sz,
        t: { limit: { tif } },
      },
    ],
    grouping: "na",
  });

  const out: Record<string, unknown> = { entry: main };
  if (p.takeProfit?.trim()) {
    out.takeProfit = await exchange.order({
      orders: [
        {
          a: assetId,
          b: !isBuy,
          r: true,
          p: p.takeProfit.trim(),
          s: sz,
          t: {
            trigger: {
              triggerPx: p.takeProfit.trim(),
              isMarket: true,
              tpsl: "tp",
            },
          },
        },
      ],
      grouping: "na",
    });
  }
  if (p.stopLoss?.trim()) {
    out.stopLoss = await exchange.order({
      orders: [
        {
          a: assetId,
          b: !isBuy,
          r: true,
          p: p.stopLoss.trim(),
          s: sz,
          t: {
            trigger: {
              triggerPx: p.stopLoss.trim(),
              isMarket: true,
              tpsl: "sl",
            },
          },
        },
      ],
      grouping: "na",
    });
  }
  return out;
}

export async function hlDirectClose(agent: AgentEntry, pairRaw: string): Promise<unknown> {
  const { exchange, info, master } = createClients(agent);
  const pair = pairRaw.toUpperCase();
  const { index: assetId } = await getAssetIndex(info, pair);

  const state = await info.clearinghouseState({ user: master });
  const position = state.assetPositions.find(
    (row: { position: { coin: string; szi: string } }) =>
      row.position.coin.toUpperCase() === pair
  );
  if (!position) {
    throw new Error(`${pair} için açık pozisyon yok`);
  }

  const posSize = parseFloat(position.position.szi);
  const isBuy = posSize < 0;
  const sz = Math.abs(posSize).toString();

  const mids = await info.allMids();
  const midPrice = parseFloat(mids[pair] ?? "");
  const slippage = isBuy ? 1.01 : 0.99;
  const orderPrice = formatPrice(midPrice * slippage);

  return exchange.order({
    orders: [
      {
        a: assetId,
        b: isBuy,
        r: true,
        p: orderPrice,
        s: sz,
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  });
}

export type HlDirectModifyParams = {
  pair: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage?: number;
};

export async function hlDirectModify(agent: AgentEntry, p: HlDirectModifyParams): Promise<unknown> {
  const { exchange, info, master } = createClients(agent);
  const pair = p.pair.toUpperCase();
  const { index: assetId } = await getAssetIndex(info, pair);

  if (!p.leverage && !p.stopLoss && !p.takeProfit) {
    throw new Error("modify: en az leverage, SL veya TP gerekli");
  }

  const state = await info.clearinghouseState({ user: master });
  const position = state.assetPositions.find(
    (row: { position: { coin: string; szi: string } }) =>
      row.position.coin.toUpperCase() === pair
  );
  if (!position) {
    throw new Error(`${pair} için açık pozisyon yok`);
  }

  const posSize = parseFloat(position.position.szi);
  const isLong = posSize > 0;
  const sz = Math.abs(posSize).toString();

  const out: Record<string, unknown> = {};

  if (p.leverage != null && Number.isFinite(p.leverage) && p.leverage >= 1) {
    out.leverage = await exchange.updateLeverage({
      asset: assetId,
      isCross: true,
      leverage: p.leverage,
    });
  }

  const openOrders = await info.openOrders({ user: master });
  const tpslOrders = openOrders.filter(
    (o: { coin?: string; orderType?: string }) =>
      o.coin?.toUpperCase() === pair && String(o.orderType ?? "").includes("trigger")
  );
  for (const order of tpslOrders) {
    try {
      await exchange.cancel({ cancels: [{ a: assetId, o: order.oid }] });
    } catch {
      /* yut */
    }
  }

  if (p.takeProfit?.trim()) {
    out.takeProfit = await exchange.order({
      orders: [
        {
          a: assetId,
          b: !isLong,
          r: true,
          p: p.takeProfit.trim(),
          s: sz,
          t: {
            trigger: {
              triggerPx: p.takeProfit.trim(),
              isMarket: true,
              tpsl: "tp",
            },
          },
        },
      ],
      grouping: "na",
    });
  }
  if (p.stopLoss?.trim()) {
    out.stopLoss = await exchange.order({
      orders: [
        {
          a: assetId,
          b: !isLong,
          r: true,
          p: p.stopLoss.trim(),
          s: sz,
          t: {
            trigger: {
              triggerPx: p.stopLoss.trim(),
              isMarket: true,
              tpsl: "sl",
            },
          },
        },
      ],
      grouping: "na",
    });
  }

  return out;
}

export async function hlDirectCancelLimit(
  agent: AgentEntry,
  pair: string,
  oid: number
): Promise<unknown> {
  const { exchange, info } = createClients(agent);
  const { index: assetId } = await getAssetIndex(info, pair.toUpperCase());
  return exchange.cancel({ cancels: [{ a: assetId, o: oid }] });
}
