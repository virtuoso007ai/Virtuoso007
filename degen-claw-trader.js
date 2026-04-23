// DEGEN CLAW TRADING BOT - READY TO USE CODE

const DEGEN_API_KEY = process.env.DEGEN_API_KEY || "acp-YOUR_KEY_HERE";
const API_BASE = "https://api.agdp.io/degen-acp";

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

/**
 * Open a position on Degen Claw
 */
async function openPosition({ pair, side, size, leverage = 3, tpPercent, slPercent, currentPrice }) {
  // Calculate TP/SL if percentages provided
  let takeProfit, stopLoss;
  if (tpPercent && slPercent && currentPrice) {
    const calc = calculateTPSL(currentPrice, tpPercent, slPercent, side);
    takeProfit = calc.takeProfit;
    stopLoss = calc.stopLoss;
  }

  const payload = {
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
  };

  console.log(`[Degen] Opening ${side} ${pair} | Size: $${size} | Lev: ${leverage}x | TP: ${takeProfit} | SL: ${stopLoss}`);

  const response = await fetch(`${API_BASE}/job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEGEN_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  if (data.ok) {
    console.log(`[Degen] ✅ Position opened | JobID: ${data.data.jobId}`);
  } else {
    console.error(`[Degen] ❌ Failed to open position:`, data.error);
  }

  return data;
}

/**
 * Close a position on Degen Claw
 */
async function closePosition(pair, side) {
  const payload = {
    service: "perp_trade",
    action: "close",
    params: { pair, side }
  };

  console.log(`[Degen] Closing ${side} ${pair}...`);

  const response = await fetch(`${API_BASE}/job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEGEN_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  if (data.ok) {
    console.log(`[Degen] ✅ Position closed | JobID: ${data.data.jobId}`);
  } else {
    console.error(`[Degen] ❌ Failed to close position:`, data.error);
  }

  return data;
}

/**
 * Modify existing position (leverage, TP, SL)
 */
async function modifyPosition({ pair, side, leverage, takeProfit, stopLoss }) {
  const payload = {
    service: "perp_modify",
    params: {
      pair,
      side,
      ...(leverage && { leverage }),
      ...(takeProfit && { takeProfit }),
      ...(stopLoss && { stopLoss })
    }
  };

  console.log(`[Degen] Modifying ${side} ${pair}...`);

  const response = await fetch(`${API_BASE}/job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEGEN_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  if (data.ok) {
    console.log(`[Degen] ✅ Position modified | JobID: ${data.data.jobId}`);
  } else {
    console.error(`[Degen] ❌ Failed to modify position:`, data.error);
  }

  return data;
}

/**
 * Execute trade with retry logic
 */
async function executeTradeWithRetry(tradeFunction, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await tradeFunction();
      
      if (result.ok) {
        return result;
      }
      
      if (attempt < maxRetries) {
        const delay = 2000 * attempt;
        console.log(`[Degen] Retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err) {
      console.error(`[Degen] Attempt ${attempt} failed:`, err.message);
      
      if (attempt === maxRetries) {
        throw err;
      }
    }
  }
  
  throw new Error("Trade failed after max retries");
}

// ========================================
// USAGE EXAMPLES
// ========================================

async function exampleUsage() {
  // Example 1: Open BTC long with TP/SL
  await openPosition({
    pair: "BTC",
    side: "long",
    size: 50,
    leverage: 5,
    tpPercent: 3.5,
    slPercent: 2,
    currentPrice: 97000
  });
  // Output: Opening long BTC | Size: $50 | Lev: 5x | TP: 100395.00 | SL: 95060.00

  // Example 2: Open ETH short
  await openPosition({
    pair: "ETH",
    side: "short",
    size: 30,
    leverage: 3,
    tpPercent: 2.5,
    slPercent: 1.5,
    currentPrice: 3500
  });
  // Output: Opening short ETH | Size: $30 | Lev: 3x | TP: 3412.50 | SL: 3552.50

  // Example 3: Close BTC long
  await closePosition("BTC", "long");

  // Example 4: Modify position leverage
  await modifyPosition({
    pair: "BTC",
    side: "long",
    leverage: 10,
    takeProfit: "105000",
    stopLoss: "92000"
  });

  // Example 5: With retry logic
  await executeTradeWithRetry(() => 
    openPosition({
      pair: "SOL",
      side: "long",
      size: 25,
      leverage: 4,
      tpPercent: 4,
      slPercent: 2,
      currentPrice: 180
    })
  );
}

// ========================================
// EXPORT FOR YOUR BOT
// ========================================

module.exports = {
  openPosition,
  closePosition,
  modifyPosition,
  calculateTPSL,
  executeTradeWithRetry
};

// For ES modules:
// export { openPosition, closePosition, modifyPosition, calculateTPSL, executeTradeWithRetry };
