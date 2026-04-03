export const HELP = `Degen Claw — komutlar (/agents ile alias dogrula)

Tek agent:
/open <alias> <PAIR> <long|short> <size> [kaldirac] [SL] [TP] [orderType] [limitPrice]
/close <alias> <PAIR>
/cancel <alias> <PAIR>
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

Ornek:
/open raichu ETH long 50 10 → market
/open raichu ETH long 50 10 2000 2200 → TP/SL
/open raichu ETH long 50 10 2000 2200 limit 2100 → limit
/cancel taxerclaw VIRTUAL → limit emri iptal
/openmulti raichu,friday,venom BTC long 50 10
/openall ETH short 30 5
/modify raichu ETH 2000 2200 15 → SL/TP/lev
/modify raichu ETH - - 15 → sadece leverage
(- = degistirme)

Liquidation: /liq <alias> | /liq all
Pozlar: /positions <alias> | /positions all (/poz)
Bakiye: /balance <alias> | /balance all (/bakiye)
Leaderboard: /leaderboard | /leaderboard top (/lb)
/ping — saglik`;
