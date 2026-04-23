# PROMPT: Integrate Degen Claw Trading with Your Bot

You are a trading bot that needs to integrate with **Degen Claw ACP API** for perpetual futures trading on Hyperliquid Testnet.

---

## Your Task

Read the attached `DEGEN_CLAW_BOT_INTEGRATION_GUIDE.md` file and implement the following trading functions:

### 1. Open Position Function

Create a function that opens a perpetual futures position with these parameters:
- **pair**: Trading pair (BTC, ETH, SOL, DOGE, PENGU, HYPE, PEPE, POPCAT)
- **side**: "long" or "short"
- **size**: Position size in USD (minimum 11 USDC, recommended 15+)
- **leverage**: 1-50x (default 3x)
- **tpPercent**: Take profit percentage (e.g., 3.5 = 3.5% profit target)
- **slPercent**: Stop loss percentage (e.g., 2 = 2% stop loss)
- **currentPrice**: Current market price (for calculating TP/SL prices)

**Requirements:**
- Calculate TP and SL prices from percentages before sending request
- Use POST request to `https://api.agdp.io/degen-acp/job`
- Include API key in Authorization header: `Bearer acp-YOUR_KEY`
- Request body format:
```json
{
  "service": "perp_trade",
  "action": "open",
  "params": {
    "pair": "BTC",
    "side": "long",
    "size": "50",
    "leverage": 5,
    "takeProfit": "100000",
    "stopLoss": "95000"
  }
}
```

### 2. Close Position Function

Create a function that closes an existing position:
- **pair**: Trading pair
- **side**: "long" or "short"

**Requirements:**
- Same endpoint and authentication as open
- Request body:
```json
{
  "service": "perp_trade",
  "action": "close",
  "params": {
    "pair": "BTC",
    "side": "long"
  }
}
```

### 3. Modify Position Function

Create a function that modifies leverage, TP, or SL on existing position:
- **pair**: Trading pair
- **side**: "long" or "short"
- **leverage**: New leverage (optional)
- **takeProfit**: New TP price (optional)
- **stopLoss**: New SL price (optional)

**Requirements:**
- Service: `perp_modify`
- Can update any combination of leverage/TP/SL

### 4. Calculate TP/SL Helper

Create a helper function:
```
calculateTPSL(entryPrice, tpPercent, slPercent, side) → { takeProfit, stopLoss }
```

**Logic:**
- If side = "long":
  - TP = entryPrice × (1 + tpPercent / 100)
  - SL = entryPrice × (1 - slPercent / 100)
- If side = "short":
  - TP = entryPrice × (1 - tpPercent / 100)
  - SL = entryPrice × (1 + slPercent / 100)
- Return prices as strings with 2 decimal places

### 5. Error Handling

Implement retry logic:
- Retry up to 3 times on failure
- Wait 2s, 4s, 6s between retries
- Handle common errors:
  - Insufficient balance
  - Position too small (< 11 USDC)
  - Invalid pair
  - Already has position

### 6. Logging

Log all operations:
- Trade requests (pair, side, size, leverage, TP, SL)
- API responses (success/failure, jobId)
- Errors with full details

---

## Environment Variables

You need:
- `DEGEN_API_KEY`: Your ACP API key (format: `acp-<32chars>`)
- Example: `acp-966a3c70141eaba78412`

---

## Testing Checklist

After implementation, test:
1. Open BTC long with TP/SL
2. Close BTC long
3. Open ETH short with TP/SL
4. Modify leverage on open position
5. Handle error cases (invalid pair, insufficient balance)

---

## Example Integration

Here's how your bot should call these functions:

```javascript
// 1. Open position
await openPosition({
  pair: "BTC",
  side: "long",
  size: 50,
  leverage: 5,
  tpPercent: 3.5,
  slPercent: 2,
  currentPrice: 97000
});
// Should calculate TP=100395, SL=95060 and open position

// 2. Close position
await closePosition("BTC", "long");

// 3. Modify position
await modifyPosition({
  pair: "BTC",
  side: "long",
  leverage: 10,
  takeProfit: "105000",
  stopLoss: "92000"
});
```

---

## Success Criteria

Your implementation is successful when:
- ✅ Can open positions with calculated TP/SL
- ✅ Can close positions
- ✅ Can modify existing positions
- ✅ Handles errors gracefully with retries
- ✅ Logs all operations
- ✅ Respects minimum position size (11 USDC)
- ✅ Works with all supported pairs (BTC, ETH, SOL, DOGE, etc.)

---

## Important Notes

1. **Minimum position size:** 11 USDC (recommended 15+ for safety)
2. **API endpoint:** `https://api.agdp.io/degen-acp/job`
3. **Authorization:** `Bearer acp-YOUR_API_KEY`
4. **Network:** Hyperliquid Testnet (Arbitrum)
5. **TP/SL:** Must be calculated as prices, not percentages
6. **Leverage:** 1-50x (start with 3x for testing)

---

## Next Steps

1. Read the full integration guide: `DEGEN_CLAW_BOT_INTEGRATION_GUIDE.md`
2. Implement the 4 core functions (open, close, modify, calculateTPSL)
3. Add error handling and retries
4. Test with small positions (15 USDC)
5. Deploy and monitor

---

**You now have everything needed to integrate Degen Claw trading into your bot. Implement the functions and start trading!** 🚀
