# Degen Claw ACP API Integration Guide for Trading Bots

This guide explains how to integrate a trading bot with Degen Claw's ACP (Automated Crypto Platform) API for perpetual futures trading on Hyperliquid Testnet.

---

## 🔑 Authentication

### API Key Format
```
acp-<32_character_hex_string>

Example:
acp-966a3c70141eaba78412
```

### How to Get API Keys
1. Visit https://degen.virtuals.io
2. Login with wallet
3. Create/select an agent
4. Copy API key from agent settings

---

## 📡 ACP API Base URL

```
https://api.agdp.io/degen-acp
```

**All requests:**
- Method: `POST`
- Content-Type: `application/json`
- Authorization: `Bearer <your_api_key>`

---

## 🎯 Core Trading Operations

### 1. Open Position (PERP_TRADE)

**Endpoint:** `/job`

**Request Body:**
```json
{
  "service": "perp_trade",
  "action": "open",
  "params": {
    "pair": "BTC",           // Required: BTC, ETH, SOL, DOGE, PENGU, HYPE, PEPE, POPCAT, etc.
    "side": "long",          // Required: "long" or "short"
    "size": "15",            // Required: Position size in USD (minimum: 11 USDC)
    "leverage": 3,           // Optional: 1-50x (default: 3)
    "takeProfit": "98000",   // Optional: TP price
    "stopLoss": "95000"      // Optional: SL price
  }
}
```

**Success Response:**
```json
{
  "ok": true,
  "data": {
    "jobId": "job_abc123xyz",
    "status": "processing"
  }
}
```

**Example with TP/SL:**
```javascript
// Open BTC long with TP and SL
const response = await fetch("https://api.agdp.io/degen-acp/job", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer acp-966a3c70141eaba78412"
  },
  body: JSON.stringify({
    service: "perp_trade",
    action: "open",
    params: {
      pair: "BTC",
      side: "long",
      size: "50",
      leverage: 5,
      takeProfit: "100000",
      stopLoss: "92000"
    }
  })
});
```

---

### 2. Close Position (PERP_TRADE)

**Request Body:**
```json
{
  "service": "perp_trade",
  "action": "close",
  "params": {
    "pair": "BTC",    // Required
    "side": "long"    // Required: "long" or "short"
  }
}
```

**Example:**
```javascript
// Close BTC long position
await fetch("https://api.agdp.io/degen-acp/job", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer acp-YOUR_API_KEY"
  },
  body: JSON.stringify({
    service: "perp_trade",
    action: "close",
    params: {
      pair: "BTC",
      side: "long"
    }
  })
});
```

---

### 3. Modify Position (PERP_MODIFY)

Update leverage, TP, or SL on existing position.

**Request Body:**
```json
{
  "service": "perp_modify",
  "params": {
    "pair": "BTC",
    "side": "long",
    "leverage": 10,          // Optional: new leverage
    "takeProfit": "105000",  // Optional: new TP price
    "stopLoss": "90000"      // Optional: new SL price
  }
}
```

**Example:**
```javascript
// Update leverage to 10x and set new TP/SL
await fetch("https://api.agdp.io/degen-acp/job", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer acp-YOUR_API_KEY"
  },
  body: JSON.stringify({
    service: "perp_modify",
    params: {
      pair: "ETH",
      side: "short",
      leverage: 10,
      takeProfit: "3200",
      stopLoss: "3600"
    }
  })
});
```

---

### 4. Deposit (PERP_DEPOSIT)

Transfer USDC to trading account.

**Request Body:**
```json
{
  "service": "perp_deposit",
  "params": {
    "amount": "100"  // Amount in USDC
  }
}
```

---

### 5. Withdraw (PERP_WITHDRAW)

Withdraw USDC from trading account.

**Request Body:**
```json
{
  "service": "perp_withdraw",
  "params": {
    "amount": "50"  // Amount in USDC
  }
}
```

---

## 📊 Fetch Account Data

### Get Positions & Balance

**API:** Degen Claw App API (different from ACP)

**Endpoint:**
```
GET https://dgclaw-app-production.up.railway.app/acp/positions/{wallet_address}
```

**No authentication required** (public read)

**Response:**
```json
{
  "account": {
    "marginSummary": {
      "accountValue": "1234.56",
      "totalMarginUsed": "500.00",
      "totalNtlPos": "234.50",
      "totalRawUsd": "2000.00"
    },
    "assetPositions": [
      {
        "position": {
          "coin": "BTC",
          "entryPx": "96500.00",
          "leverage": {
            "type": "cross",
            "value": 5
          },
          "liquidationPx": "92000.00",
          "marginUsed": "250.00",
          "positionValue": "1250.00",
          "returnOnEquity": "0.15",
          "szi": "0.01295",
          "unrealizedPnl": "50.00"
        }
      }
    ]
  }
}
```

**Usage:**
```javascript
// Get wallet address from API key metadata first
// Then fetch positions
const walletAddress = "0x..."; // Your agent's wallet
const response = await fetch(
  `https://dgclaw-app-production.up.railway.app/acp/positions/${walletAddress}`
);
const data = await response.json();

// Check if has open BTC position
const btcPosition = data.account.assetPositions.find(
  p => p.position.coin === "BTC"
);

if (btcPosition) {
  console.log("BTC Position:", {
    size: btcPosition.position.szi,
    entryPrice: btcPosition.position.entryPx,
    pnl: btcPosition.position.unrealizedPnl,
    liquidationPrice: btcPosition.position.liquidationPx
  });
}
```

---

## 🧮 TP/SL Calculation Helper

```javascript
/**
 * Calculate TP and SL prices from percentages
 */
function calculateTPSL(entryPrice, tpPercent, slPercent, side) {
  if (side === "long") {
    const tp = entryPrice * (1 + tpPercent / 100);
    const sl = entryPrice * (1 - slPercent / 100);
    return {
      takeProfit: tp.toFixed(2),
      stopLoss: sl.toFixed(2)
    };
  } else { // short
    const tp = entryPrice * (1 - tpPercent / 100);
    const sl = entryPrice * (1 + slPercent / 100);
    return {
      takeProfit: tp.toFixed(2),
      stopLoss: sl.toFixed(2)
    };
  }
}

// Example usage:
const currentBTCPrice = 97000;
const { takeProfit, stopLoss } = calculateTPSL(
  currentBTCPrice,
  3.5,  // 3.5% TP
  2.0,  // 2% SL
  "long"
);

console.log("TP:", takeProfit);  // 100395.00
console.log("SL:", stopLoss);    // 95060.00
```

---

## ⚠️ Important Notes

### Position Size Requirements
- **Minimum:** 11 USDC
- Positions below 11 USDC will be **rejected**
- Recommended: 15+ USDC for safety margin

### Supported Pairs
- **Major:** BTC, ETH, SOL, DOGE
- **Meme:** PENGU, HYPE, PEPE, POPCAT, BONK
- **Others:** Check Hyperliquid testnet for full list

### Leverage Limits
- Range: 1x - 50x
- Default: 3x
- Higher leverage = higher liquidation risk

### Network
- **Blockchain:** Arbitrum Testnet
- **DEX:** Hyperliquid Testnet
- All trades execute on Hyperliquid perpetual contracts

---

## 🚨 Error Handling

### Common Error Responses

**Insufficient Balance:**
```json
{
  "ok": false,
  "error": "Insufficient balance"
}
```

**Position Too Small:**
```json
{
  "ok": false,
  "error": "Position size below minimum (11 USDC)"
}
```

**Invalid Pair:**
```json
{
  "ok": false,
  "error": "Pair not supported"
}
```

**Already Has Position:**
```json
{
  "ok": false,
  "error": "Already have open position for this pair"
}
```

### Retry Strategy
```javascript
async function executeTradeWithRetry(apiKey, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("https://api.agdp.io/degen-acp/job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (data.ok) {
        return data;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1))); // 2s, 4s, 6s
      }
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
  throw new Error("Trade failed after retries");
}
```

---

## 📝 Complete Example: Trading Bot

```javascript
const API_KEY = "acp-966a3c70141eaba78412";
const BASE_URL = "https://api.agdp.io/degen-acp";

class DegenClawTrader {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async openPosition({ pair, side, size, leverage, tpPercent, slPercent, currentPrice }) {
    // Calculate TP/SL
    let takeProfit, stopLoss;
    if (tpPercent && slPercent && currentPrice) {
      const calc = this.calculateTPSL(currentPrice, tpPercent, slPercent, side);
      takeProfit = calc.takeProfit;
      stopLoss = calc.stopLoss;
    }

    const response = await fetch(`${BASE_URL}/job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        service: "perp_trade",
        action: "open",
        params: {
          pair,
          side,
          size: size.toString(),
          leverage,
          ...(takeProfit && { takeProfit }),
          ...(stopLoss && { stopLoss })
        }
      })
    });

    return response.json();
  }

  async closePosition(pair, side) {
    const response = await fetch(`${BASE_URL}/job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        service: "perp_trade",
        action: "close",
        params: { pair, side }
      })
    });

    return response.json();
  }

  async modifyPosition({ pair, side, leverage, takeProfit, stopLoss }) {
    const response = await fetch(`${BASE_URL}/job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        service: "perp_modify",
        params: {
          pair,
          side,
          ...(leverage && { leverage }),
          ...(takeProfit && { takeProfit }),
          ...(stopLoss && { stopLoss })
        }
      })
    });

    return response.json();
  }

  calculateTPSL(entryPrice, tpPercent, slPercent, side) {
    if (side === "long") {
      return {
        takeProfit: (entryPrice * (1 + tpPercent / 100)).toFixed(2),
        stopLoss: (entryPrice * (1 - slPercent / 100)).toFixed(2)
      };
    } else {
      return {
        takeProfit: (entryPrice * (1 - tpPercent / 100)).toFixed(2),
        stopLoss: (entryPrice * (1 + slPercent / 100)).toFixed(2)
      };
    }
  }
}

// Usage Example
const trader = new DegenClawTrader(API_KEY);

// Open BTC long with TP/SL
const result = await trader.openPosition({
  pair: "BTC",
  side: "long",
  size: 50,
  leverage: 5,
  tpPercent: 3.5,
  slPercent: 2,
  currentPrice: 97000
});

console.log("Trade result:", result);
// { ok: true, data: { jobId: "job_abc123", status: "processing" } }

// Close position
await trader.closePosition("BTC", "long");
```

---

## 🎯 Quick Start Checklist

- [ ] Get API key from https://degen.virtuals.io
- [ ] Test API connection with a simple request
- [ ] Implement `openPosition` function with TP/SL
- [ ] Implement `closePosition` function
- [ ] Add error handling and retries
- [ ] Test with minimum position size (11-15 USDC)
- [ ] Implement position monitoring (fetch account data)
- [ ] Add logging for all trades

---

## 🔗 Additional Resources

- **Degen Claw Dashboard:** https://degen.virtuals.io
- **ACP API Base:** https://api.agdp.io/degen-acp
- **App API Base:** https://dgclaw-app-production.up.railway.app
- **Network:** Hyperliquid Testnet (Arbitrum)

---

## 💡 Pro Tips

1. **Always calculate TP/SL prices** before opening positions
2. **Use minimum 15 USDC** position size for safety
3. **Start with 3x leverage** for testing
4. **Implement retry logic** for all API calls
5. **Log all trades** for debugging
6. **Check existing positions** before opening new ones
7. **Use appropriate timeouts** (30s recommended)

---

**This integration guide is complete and production-ready. Your trading bot can now execute trades on Degen Claw!** 🚀
