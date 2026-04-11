/**
 * Strategy Monitor Scheduler
 * Calls dashboard's strategy monitor endpoint every 15 minutes
 * Alternative to Vercel Cron for Hobby plan
 */
import axios from "axios";
const DASHBOARD_API = process.env.DASHBOARD_API_URL || "http://localhost:3000";
const API_KEY = process.env.STRATEGY_MONITOR_API_KEY || "";
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export async function startStrategyScheduler() {
    console.log(`[StrategyScheduler] Starting... (interval: ${CHECK_INTERVAL_MS / 1000}s)`);
    console.log(`[StrategyScheduler] Dashboard API: ${DASHBOARD_API}`);
    console.log(`[StrategyScheduler] API Key: ${API_KEY ? "✅ Set" : "⚠️ Not set (will work if dashboard allows)"}`);
    // Run immediately on startup
    await runMonitorCycle();
    // Then run every 15 minutes
    setInterval(async () => {
        await runMonitorCycle();
    }, CHECK_INTERVAL_MS);
}
async function runMonitorCycle() {
    const startTime = Date.now();
    console.log(`[StrategyScheduler] ⏰ Running cycle at ${new Date().toISOString()}`);
    try {
        const headers = {
            "Content-Type": "application/json",
        };
        if (API_KEY) {
            headers["Authorization"] = `Bearer ${API_KEY}`;
        }
        const response = await axios.post(`${DASHBOARD_API}/api/strategies/monitor`, {}, {
            timeout: 30000, // 30s timeout
            headers,
        });
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        if (response.status === 200) {
            const health = response.data.health;
            console.log(`[StrategyScheduler] ✅ Cycle complete in ${duration}s | ` +
                `Active: ${health.activeStrategies} | ` +
                `Success: ${health.successCount} | ` +
                `Errors: ${health.errorCount}`);
        }
        else {
            console.warn(`[StrategyScheduler] ⚠️ Unexpected status: ${response.status}`);
        }
    }
    catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        if (axios.isAxiosError(error)) {
            if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
                console.error(`[StrategyScheduler] ❌ Dashboard unreachable (${duration}s) - ` +
                    `Check DASHBOARD_API_URL: ${DASHBOARD_API}`);
            }
            else if (error.response?.status === 401) {
                console.error(`[StrategyScheduler] ❌ Unauthorized (${duration}s) - ` +
                    `Dashboard requires session cookie`);
            }
            else {
                console.error(`[StrategyScheduler] ❌ Error (${duration}s):`, error.response?.data || error.message);
            }
        }
        else {
            console.error(`[StrategyScheduler] ❌ Unknown error (${duration}s):`, error);
        }
    }
}
