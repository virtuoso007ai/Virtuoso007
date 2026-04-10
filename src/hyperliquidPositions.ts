/** HL clearinghouse — signal-bot autoTrade ile aynı kaynak. */

const HL_INFO = "https://api.hyperliquid.xyz/info";

export async function fetchOpenHlCoins(wallet: string): Promise<Set<string>> {
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "webData2", user: wallet }),
  });
  if (!res.ok) {
    throw new Error(`HL webData2 HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    clearinghouseState?: { assetPositions?: Array<{ position?: { szi?: string; coin?: string } }> };
  };
  const coins = new Set<string>();
  for (const p of data?.clearinghouseState?.assetPositions ?? []) {
    const pos = p.position ?? {};
    const szi = parseFloat(String(pos.szi ?? "0"));
    if (Math.abs(szi) > 0 && pos.coin) {
      coins.add(String(pos.coin));
    }
  }
  return coins;
}
