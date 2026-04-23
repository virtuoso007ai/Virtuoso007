# Vercel Cron → Railway Scheduler Migration

## 🚨 Problem
Vercel **Hobby plan** Cron Job desteklemiyor. Sadece **Pro plan** ($20/ay) ile çalışıyor.

---

## ✅ Solution: Railway'den Schedule Etme

Railway'de zaten **Telegram bot** çalışıyor. Buraya 15 dakikalık bir scheduler ekledik.

### 📦 Architecture

```
Railway (Telegram Bot)
  ├─ Telegram commands (/open, /close, /strategy, ...)
  ├─ Signal webhook (POST /webhook/signal)
  └─ Strategy Scheduler (⏰ her 15 dakikada bir)
         ↓
         POST https://degen-dashboard.vercel.app/api/strategies/monitor
         Authorization: Bearer sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6
         ↓
Vercel (Dashboard)
  └─ /api/strategies/monitor
       ├─ Redis'ten enabled strategy'leri al
       ├─ Hyperliquid'den mum verileri çek
       ├─ Sinyal üret (RSI, EMA, MACD, ...)
       ├─ ACP API'ye trade aç
       └─ Forum'a post at
```

---

## 🔧 Changes Made

### 1. Dashboard: Session Auth → API Key Auth

**File:** `degen-dashboard/src/app/api/strategies/monitor/route.ts`

**Before:**
```typescript
const unauthorized = await requireSession(); // Session cookie gerekliydi
if (unauthorized) return unauthorized;
```

**After:**
```typescript
function verifyApiKey(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const apiKey = process.env.STRATEGY_MONITOR_API_KEY;
  
  if (!apiKey) return true; // backward compatibility
  
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === apiKey;
  }
  
  return false;
}
```

**Why:** Railway'den gelen HTTP request'te session cookie olamaz. API key ile koruma ekledik.

---

### 2. Telegram Bot: Scheduler Eklendi

**New File:** `telegram-degen-bot/src/strategy-scheduler.ts`

**What it does:**
- Her 15 dakikada bir `https://degen-dashboard.vercel.app/api/strategies/monitor` adresine POST request atar
- `Authorization: Bearer sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6` header ekler
- Dashboard'dan health status alır ve loglar
- Error handling var (retry yok ama bir sonraki 15dk'da tekrar dener)

**File:** `telegram-degen-bot/src/index.ts`

```typescript
import { startStrategyScheduler } from "./strategy-scheduler.js";

bot.launch().then(() => {
  console.log("[telegram] bot çalışıyor (long polling)");
  
  if (process.env.ENABLE_STRATEGY_SCHEDULER === "true") {
    startStrategyScheduler();
    console.log("[scheduler] ✅ Strategy monitor scheduler started");
  } else {
    console.log("[scheduler] ⏸️ Strategy scheduler disabled");
  }
});
```

---

### 3. Deleted Vercel Cron Config

**Deleted:** `degen-dashboard/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/strategy-monitor",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Why:** Hobby plan'da çalışmıyor. Railway scheduler kullanacağız.

**Note:** `/api/cron/strategy-monitor/route.ts` dosyasını **silMEdik**. İleride Pro plan'a geçerseniz tekrar kullanabilirsiniz.

---

## 📝 Environment Variables

### Dashboard (Vercel)

```env
STRATEGY_MONITOR_API_KEY=sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6
```

**Vercel Dashboard → Settings → Environment Variables → Add:**

- **Key:** `STRATEGY_MONITOR_API_KEY`
- **Value:** `sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6`
- **Apply to:** Production, Preview, Development

**Then:** Redeploy (veya git push ile auto-deploy)

---

### Telegram Bot (Railway)

```env
ENABLE_STRATEGY_SCHEDULER=true
STRATEGY_MONITOR_API_KEY=sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6
DASHBOARD_API_URL=https://degen-dashboard.vercel.app
```

**Railway Dashboard → telegram-degen-bot → Variables → Add:**

1. **ENABLE_STRATEGY_SCHEDULER**
   - Value: `true`
   
2. **STRATEGY_MONITOR_API_KEY**
   - Value: `sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6`
   
3. **DASHBOARD_API_URL** (zaten var, kontrol edin)
   - Value: `https://degen-dashboard.vercel.app`

**Then:** Railway otomatik redeploy yapar

---

## 🔍 Verification

### Railway Logs (telegram-degen-bot)

**Healthy startup:**
```
[telegram] bot çalışıyor (long polling)
[scheduler] ✅ Strategy monitor scheduler started
[StrategyScheduler] Starting... (interval: 900s)
[StrategyScheduler] Dashboard API: https://degen-dashboard.vercel.app
[StrategyScheduler] API Key: ✅ Set
[StrategyScheduler] ⏰ Running cycle at 2025-01-31T12:00:00.000Z
[StrategyScheduler] ✅ Cycle complete in 2.34s | Active: 3 | Success: 1 | Errors: 0
```

**15 minutes later:**
```
[StrategyScheduler] ⏰ Running cycle at 2025-01-31T12:15:00.000Z
[StrategyScheduler] ✅ Cycle complete in 1.87s | Active: 3 | Success: 2 | Errors: 0
```

---

### Vercel Logs (degen-dashboard)

**Healthy request:**
```
[POST /api/strategies/monitor] Manual trigger started
[StrategyMonitor] Starting cycle...
[StrategyMonitor] Found 3 enabled strategies
[StrategyMonitor] [doctorstrange/RSI_REVERSAL] Checking market...
[StrategyMonitor] [doctorstrange/RSI_REVERSAL] ✅ Trade opened (entry: 3250.50)
[StrategyMonitor] Cycle complete: 1 success, 0 errors
```

---

## 🚀 Testing Before Production

### 1. Local Test (Dashboard)

```bash
cd degen-dashboard
npm run dev
```

**In another terminal:**
```bash
curl -X POST http://localhost:3000/api/strategies/monitor \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6"
```

**Expected response:**
```json
{
  "message": "Monitor cycle completed",
  "health": {
    "activeStrategies": 3,
    "successCount": 1,
    "errorCount": 0,
    "lastRun": "2025-01-31T12:00:00.000Z"
  }
}
```

---

### 2. Local Test (Telegram Bot + Scheduler)

```bash
cd telegram-degen-bot
npm run dev
```

**Expected logs:**
```
[telegram] bot çalışıyor (long polling)
[scheduler] ✅ Strategy monitor scheduler started
[StrategyScheduler] Starting... (interval: 900s)
[StrategyScheduler] ⏰ Running cycle at ...
[StrategyScheduler] ✅ Cycle complete in 2.45s | Active: 3 | Success: 1 | Errors: 0
```

---

## 📊 Comparison: Vercel Cron vs Railway Scheduler

| Feature | Vercel Cron (Pro) | Railway Scheduler (Free) |
|---------|-------------------|-------------------------|
| **Cost** | $20/month | $0 (5$ usage credit/mo) |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ (Node.js process) |
| **Logs** | Vercel UI | Railway UI |
| **Min Interval** | 1 minute | Any (setInterval) |
| **Setup** | vercel.json | Code change |
| **Isolation** | Serverless function | Long-running process |

**Recommendation:** Railway scheduler is **good enough** for this use case. If you need 99.99% uptime → Vercel Pro.

---

## 🔄 Rollback Plan (Eğer Railway'de Sorun Olursa)

### Option A: Disable Scheduler
Railway variables:
```
ENABLE_STRATEGY_SCHEDULER=false
```

Redeploy → Scheduler kapanır, bot çalışmaya devam eder.

---

### Option B: Upgrade Vercel Pro
1. Vercel → Billing → Upgrade to Pro ($20/month)
2. Restore `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/strategy-monitor",
       "schedule": "*/15 * * * *"
     }]
   }
   ```
3. Railway variables:
   ```
   ENABLE_STRATEGY_SCHEDULER=false
   ```
4. Git push → Vercel cron active, Railway scheduler kapalı

---

## ✅ Deployment Checklist

### Dashboard (Vercel)
- [x] Code değişiklikleri yapıldı
- [ ] Git push yaptınız
- [ ] Vercel'de `STRATEGY_MONITOR_API_KEY` environment variable eklediniz
- [ ] Vercel redeploy tamamlandı
- [ ] Vercel logs'ta `/api/strategies/monitor` endpoint çalışıyor

### Telegram Bot (Railway)
- [x] Code değişiklikleri yapıldı
- [ ] Git push yaptınız
- [ ] Railway'de 3 environment variable eklediniz:
  - `ENABLE_STRATEGY_SCHEDULER=true`
  - `STRATEGY_MONITOR_API_KEY=sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6`
  - `DASHBOARD_API_URL=https://degen-dashboard.vercel.app`
- [ ] Railway redeploy tamamlandı
- [ ] Railway logs'ta `[scheduler] ✅ Strategy monitor scheduler started` görünüyor
- [ ] 15 dakika sonra `[StrategyScheduler] ✅ Cycle complete` görünüyor

---

## 🆘 Troubleshooting

### Error: `401 Unauthorized`
**Railway logs:**
```
[StrategyScheduler] ❌ Unauthorized (2.1s) - Dashboard requires session cookie
```

**Fix:**
1. Railway'de `STRATEGY_MONITOR_API_KEY` variable var mı kontrol edin
2. Vercel'de `STRATEGY_MONITOR_API_KEY` variable aynı değer mi kontrol edin
3. Her iki yerde de redeploy yapın

---

### Error: `Dashboard unreachable`
**Railway logs:**
```
[StrategyScheduler] ❌ Dashboard unreachable (30.0s) - Check DASHBOARD_API_URL
```

**Fix:**
1. Railway'de `DASHBOARD_API_URL=https://degen-dashboard.vercel.app` var mı kontrol edin
2. Vercel dashboard çalışıyor mu test edin: `https://degen-dashboard.vercel.app`
3. Vercel'de build error var mı kontrol edin

---

### Error: `Scheduler not starting`
**Railway logs:**
```
[scheduler] ⏸️ Strategy scheduler disabled
```

**Fix:**
1. Railway'de `ENABLE_STRATEGY_SCHEDULER=true` olduğundan emin olun
2. Redeploy yapın

---

## 🎯 Summary

**Before:**
- Vercel Cron (çalışmıyor - Hobby plan)
- ❌ Strategies never execute

**After:**
- Railway Scheduler (15 dakikada bir)
- ✅ Strategies execute automatically
- ✅ Forum posts automatically
- ✅ Activity logs to Redis
- ✅ $0/month (Railway free tier yeterli)

**Next steps:**
1. Vercel'e `STRATEGY_MONITOR_API_KEY` ekleyin
2. Railway'e 3 variable ekleyin
3. Git push yapın
4. 15 dakika bekleyin ve logs kontrol edin 🚀
