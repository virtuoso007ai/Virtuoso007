export const HELP = `Degen Claw — HL v2 (Hyperliquid dogrudan; ACP perp_trade job YOK)
HL imza anahtari: AGENTS_JSON hlApiWalletKey VEYA env HL_API_WALLET_KEY_<ALIAS>. Master: walletAddress veya HL_MASTER_ADDRESS_*.
ACP apiKey (acp-...) opsiyonel — sadece /acp/me ile cüzdan çözmek için; HL islemi icin sart degil.
/open ... <USDC> = USDC notional (dgclaw trade.ts ile ayni; coin adedi DEGIL).

Tek agent:
/open <alias> <PAIR> <long|short> <USDC> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/close <alias> <PAIR>
/cancel <alias> <PAIR> [oid]
/modify <alias> <PAIR> [SL] [TP] [leverage]

Multi-agent (dashboard "Tüm agentlara aynı emir" ile ayni mantik; her agent kendi hlApiWalletKey ile imzalar):
/openmulti <alias1,alias2,...> <PAIR> <long|short> <USDC> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/openall <PAIR> <long|short> <USDC> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/closemulti <alias1,alias2,...> <PAIR>
/closeall <PAIR>
/cancelmulti <alias1,alias2,...> <PAIR>
/cancelall <PAIR>
/modifymulti <alias1,alias2,...> <PAIR> [SL] [TP] [leverage]
/modifyall <PAIR> [SL] [TP] [leverage]

Strategy (otomatik trading):
/strategy create <alias> <strategyType> [size] [lev] [tp%] [sl%]
/strategy list [alias]
/strategy enable <strategyId>
/strategy disable <strategyId>
/strategy delete <strategyId> <alias>
/strategy test <strategyId>

Strategy types:
- rsi_reversal
- ema_cross
- macd_histogram
- macd_crossover
- trendtrader_combined
- rsi_divergence

Ornek:
/open taxerclaw VIRTUAL long 25 5 → ~25 USDC notional, 5x
/open raichu ETH long 500 10 2000 2200 → TP/SL (fiyat seviyesi)
/open raichu ETH long 500 10 - - limit 2100 → limit (SL/TP yok: - -)
/cancel taxerclaw ENA 377198646148 → tek limit (oid)
/cancel taxerclaw ENA → paritedeki tüm limitler (HL taraması)
/openmulti raichu,friday,venom BTC long 50 10
/openall ETH short 30 5
/modify raichu ETH 2000 2200 15 → SL/TP/lev
/modify raichu ETH - - 15 → sadece leverage
(- = degistirme)

Strategy ornek:
/strategy create raichu rsi_reversal 100 3 3.5 3
/strategy list raichu
/strategy enable raichu_rsi_reversal_123

Liquidation: /liq <alias> | /liq all
Pozlar: /positions <alias> | /positions all (/poz)
Bakiye: /balance <alias> | /balance all (/bakiye)
Leaderboard: /leaderboard | /leaderboard top (/lb)
/ping — saglik
/myid — bu sohbetin Telegram ID'si (ALLOWED_CHAT_IDS ayari icin)`;

