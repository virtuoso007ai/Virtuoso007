export const HELP = `Degen Claw — komutlar (/agents ile alias dogrula)

Tek agent:
/open <alias> <PAIR> <long|short> <size> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/close <alias> <PAIR>
/cancel <alias> <PAIR> [oid]
/modify <alias> <PAIR> [SL] [TP] [leverage]

Multi-agent (virgülle ayrılmış alias veya "all"):
/openmulti <alias1,alias2,...> <PAIR> <long|short> <size> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/openall <PAIR> <long|short> <size> [kaldirac] [SL] [TP] [orderType] [limitPrice]
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
/open raichu ETH long 50 10 → market
/open raichu ETH long 50 10 2000 2200 → TP/SL
/open raichu ETH long 50 10 2000 2200 limit 2100 → limit
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
/ping — saglik`;

