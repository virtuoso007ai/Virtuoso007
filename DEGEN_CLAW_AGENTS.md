# DEGEN CLAW AGENTS - READY TO USE

Bu dosyayı diğer botunuza verin, mevcut 12 agentınızı tanısın.

---

## 📋 Agent List (12 Agents)

```json
[
  {
    "alias": "doctorstrange",
    "apiKey": "acp-966a3c70141eaba78412",
    "label": "Doctor Strange",
    "walletAddress": "0x9375E307DCBD3D85e7a0FA65F4325c2CD8A6756F"
  },
  {
    "alias": "friday",
    "apiKey": "acp-8bd06898e06459bc8d3e",
    "label": "FRIDAY",
    "walletAddress": "0x28544b7bfce18b2be91ec1c4260fe963cd4eae39"
  },
  {
    "alias": "ichimoku",
    "apiKey": "acp-82aac3d0b8a1bb73193f",
    "label": "Ichimoku Kinko Hyo",
    "walletAddress": "0x4DF5A7C7Da46b62F94FC7F7a23EBDb5723464c93"
  },
  {
    "alias": "pokedex",
    "apiKey": "acp-f001c6ea9953638e9d5b",
    "label": "Pokedex",
    "walletAddress": "0xD13f43f8ac575717bD627F03C19CCB9cC8De333F"
  },
  {
    "alias": "raichu",
    "apiKey": "acp-8fccbd4e63140922bbc2",
    "label": "Super Saiyan Raichu",
    "walletAddress": "0x09eE47977167eF955960761cAd68Bd0E3439C8F8"
  },
  {
    "alias": "redkid",
    "apiKey": "acp-de6af2115d8ccf6e75fd",
    "label": "Red Kid",
    "walletAddress": "0xb119A2153FBF7eD81d26dB69F935bBaEca1E033d"
  },
  {
    "alias": "spongebob",
    "apiKey": "acp-f70a078ce4806b18171f",
    "label": "Sponge Bob",
    "walletAddress": "0xf7643Ac4723c1Fca4Fa77c13beCC6dAcb1d0C194"
  },
  {
    "alias": "squirtle",
    "apiKey": "acp-7b2b024956edafaa39dc",
    "label": "SquirtleSquad",
    "walletAddress": "0x8e83c971AF1f3c7B88Db202F5425086ba494c7ca"
  },
  {
    "alias": "taxerclaw",
    "apiKey": "acp-cdeae3dce5fef2dbe4ec",
    "label": "TaXerClaw",
    "walletAddress": "0xCC4188F955B7594B272E7bAE0e082089A060CB31"
  },
  {
    "alias": "venom",
    "apiKey": "acp-9f328d39c4ac2947f00d",
    "label": "VENOM",
    "walletAddress": "0xf785C51B30D869757d3fB34f178591b6D33b6CbD"
  },
  {
    "alias": "virgen",
    "apiKey": "acp-5245b63ccf304d0b0176",
    "label": "Virgen Capital",
    "walletAddress": "0xA2c55E445A4b584e73d799E42431ec121A65edD0"
  },
  {
    "alias": "welles",
    "apiKey": "acp-76b5a4f3fb10464bd835",
    "label": "Welles Wilder",
    "walletAddress": "0x57e3a4877fa63d3803a15daeB2C7ac0fE30583cE"
  }
]
```

---

## 🎯 PROMPT FOR YOUR BOT

Diğer botunuza bu promptu verin:

```
I have 12 Degen Claw trading agents. I need you to integrate them into your trading bot.

Agent data (save this as agents.json or load from environment variable):
<paste the JSON above>

Requirements:
1. Load all 12 agents with their API keys
2. Implement Degen Claw ACP API integration (read DEGEN_CLAW_BOT_INTEGRATION_GUIDE.md)
3. Use the code examples from degen-claw-trader.js
4. Each agent can trade independently
5. Support commands like: "/open raichu BTC long 50 5x tp=3.5 sl=2"
6. Support closing positions: "/close venom ETH short"
7. Support checking balances: "/balance doctorstrange"

API Details:
- Base URL: https://api.agdp.io/degen-acp
- Method: POST /job
- Auth: Bearer <agent.apiKey>
- Services: perp_trade (open/close), perp_modify (update leverage/TP/SL)

TP/SL Calculation Logic:
- If LONG: TP = entry × (1 + tp%), SL = entry × (1 - sl%)
- If SHORT: TP = entry × (1 - tp%), SL = entry × (1 + sl%)
- Prices must be strings with 2 decimal places

Supported Pairs:
BTC, ETH, SOL, DOGE, PENGU, HYPE, PEPE, POPCAT

Position Size Requirements:
- Minimum: 11 USDC
- Recommended: 15+ USDC

Implement now!
```

---

## 📂 Diğer Botunuza Vermemiz Gereken Dosyalar

1. **`DEGEN_CLAW_BOT_INTEGRATION_GUIDE.md`** - Teknik döküman
2. **`degen-claw-trader.js`** - Hazır kod örnekleri
3. **`DEGEN_CLAW_AGENTS.md`** (bu dosya) - 12 agent bilgisi

---

## 🚀 Hızlı Başlangıç

Botunuza şunu söyleyin:

```
3 dosya verdim:
1. DEGEN_CLAW_BOT_INTEGRATION_GUIDE.md (API dokümantasyonu)
2. degen-claw-trader.js (kod örnekleri)
3. DEGEN_CLAW_AGENTS.md (12 agent bilgisi)

Bu 12 agentı kullanarak Degen Claw trading entegrasyonu yap.

Test:
- "raichu" ile BTC long aç (15 USDC, 3x leverage, TP 3%, SL 2%)
- Mevcut fiyat 97000
- TP ve SL otomatik hesapla
- Trade aç
```

---

**Dosyalar hazır! Botunuza verin, kendi agentlarınızla trade başlasın!** 🎯
