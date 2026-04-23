/**
 * Degen Claw forum — trade aç/kapa sonrası SIGNALS gönderimi (dashboard ile aynı API).
 * Kimlik: agent.forumApiKey (dgc_…) veya ortam DGCLAW_API_KEY.
 */
import type { AgentEntry } from "./agents.js";
import type { DgPositionRow } from "./positions.js";
import { getAgentForumId, getAgentSignalsThreadId } from "./agent-forum-ids.js";
import {
  formatPersonalizedTradeClose,
  formatPersonalizedTradeOpen,
} from "./agent-personalities-forum.js";

const DGCLAW_API_BASE = "https://degen.virtuals.io";

function resolveForumApiKey(agent: AgentEntry): string | undefined {
  return agent.forumApiKey?.trim() || process.env.DGCLAW_API_KEY?.trim();
}

function normPair(p: string): string {
  return p.trim().toUpperCase().replace(/-USD$/i, "");
}

async function postToForum(params: {
  agentId: number;
  threadId: string;
  title: string;
  content: string;
  apiKey: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${DGCLAW_API_BASE}/api/forums/${params.agentId}/threads/${params.threadId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: params.title, content: params.content }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      return { success: false, error: t.slice(0, 800) };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function tryForumTradeOpen(
  agent: AgentEntry,
  p: {
    pair: string;
    side: "long" | "short";
    sizeUsd: number;
    leverage: number;
    stopLoss?: string;
    takeProfit?: string;
    orderType?: "market" | "limit";
    limitPrice?: string;
  }
): Promise<void> {
  const apiKey = resolveForumApiKey(agent);
  const agentId = getAgentForumId(agent.alias);
  const threadId = getAgentSignalsThreadId(agent.alias);
  if (!apiKey || !agentId || !threadId) return;

  const pair = normPair(p.pair);
  const entryPrice =
    p.orderType === "limit" && p.limitPrice?.trim() ? p.limitPrice.trim() : "Market";
  const { title, content } = formatPersonalizedTradeOpen({
    agentAlias: agent.alias,
    pair,
    side: p.side,
    entryPrice,
    stopLoss: p.stopLoss,
    takeProfit: p.takeProfit,
    leverage: p.leverage,
  });

  const r = await postToForum({
    agentId,
    threadId: String(threadId),
    title,
    content,
    apiKey,
  });
  if (!r.success) {
    console.error(`[degenForum] open ${agent.alias}:`, r.error);
  }
}

export async function tryForumTradeClose(
  agent: AgentEntry,
  pairRaw: string,
  pos: DgPositionRow | null
): Promise<void> {
  const apiKey = resolveForumApiKey(agent);
  const agentId = getAgentForumId(agent.alias);
  const threadId = getAgentSignalsThreadId(agent.alias);
  if (!apiKey || !agentId || !threadId) return;

  const pair = normPair(pairRaw);
  const sideRaw = (pos?.side || "long").toString().toLowerCase();
  const side: "long" | "short" = sideRaw === "short" ? "short" : "long";
  let pnlPercent: string | undefined;
  if (pos?.entryPrice && pos?.markPrice && pos.side) {
    const entry = parseFloat(String(pos.entryPrice));
    const exit = parseFloat(String(pos.markPrice));
    const lev = Number(pos.leverage) || 1;
    if (Number.isFinite(entry) && entry > 0 && Number.isFinite(exit)) {
      pnlPercent =
        side === "long"
          ? (((exit - entry) / entry) * 100 * lev).toFixed(2)
          : (((entry - exit) / entry) * 100 * lev).toFixed(2);
    }
  }

  const levN =
    pos?.leverage != null ? parseInt(String(pos.leverage), 10) : undefined;
  const leverage =
    levN != null && Number.isFinite(levN) && !Number.isNaN(levN) ? levN : undefined;

  const { title, content } = formatPersonalizedTradeClose({
    agentAlias: agent.alias,
    pair,
    side,
    entryPrice:
      pos?.entryPrice != null && String(pos.entryPrice).trim()
        ? String(pos.entryPrice)
        : undefined,
    exitPrice:
      pos?.markPrice != null && String(pos.markPrice).trim()
        ? String(pos.markPrice)
        : undefined,
    pnl:
      pos?.unrealizedPnl != null && String(pos.unrealizedPnl).trim()
        ? String(pos.unrealizedPnl)
        : undefined,
    pnlPercent,
    leverage,
  });

  const r = await postToForum({
    agentId,
    threadId: String(threadId),
    title,
    content,
    apiKey,
  });
  if (!r.success) {
    console.error(`[degenForum] close ${agent.alias}:`, r.error);
  }
}
