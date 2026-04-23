# Strategy Not Executing - Troubleshooting Checklist

## 🚨 Problem
Strategy is **ACTIVE** but hasn't opened any trades in 24 hours.

---

## ✅ Checklist

### 1️⃣ **Railway: Scheduler Çalışıyor mu?**

**Railway Dashboard → Virtuoso007 → Logs**

**Olması gereken:**
```
[telegram] bot çalışıyor (long polling)
[scheduler] ✅ Strategy monitor scheduler started
[StrategyScheduler] Starting... (interval: 900s)
[StrategyScheduler] ⏰ Running cycle at 2026-04-05T12:00:00.000Z
[StrategyScheduler] ✅ Cycle complete in 2.34s | Active: 1 | Success: 0 | Errors: 0
```

**Eğer şunu görüyorsanız → SORUN:**
```
TelegramError: 409: Conflict
```
→ Scheduler başlatılamadı, stratejiler çalışmıyor!

**Eğer şunu görüyorsanız → SORUN:**
```
[scheduler] ⏸️ Strategy scheduler disabled
```
→ `ENABLE_STRATEGY_SCHEDULER=true` Railway'de yok!

---

### 2️⃣ **Railway: Environment Variables Tam mı?**

**Railway → Virtuoso007 → Variables**

**Olması gerekenler:**
```
TELEGRAM_BOT_TOKEN=8648706617:AAEeMDU7BiAt9G27qNAyp6pX0YiSOfRljGA
ALLOWED_CHAT_IDS=750170873
AGENTS_JSON_PATH=./agents.local.json
DEGEN_LEADERBOARD_SEASON_ID=2
DASHBOARD_API_URL=https://degen-dashboard.vercel.app
ENABLE_STRATEGY_SCHEDULER=true
STRATEGY_MONITOR_API_KEY=sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6
AGENTS_JSON=[...uzun JSON...]
```

**Eksik varsa ekleyin!**

---

### 3️⃣ **Vercel: API Key Var mı?**

**Vercel Dashboard → degen-dashboard → Settings → Environment Variables**

**Olması gereken:**
```
STRATEGY_MONITOR_API_KEY=sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6
```

**Eğer YOK:**
1. Add → Key: `STRATEGY_MONITOR_API_KEY`
2. Value: `sm_f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6`
3. Apply to: Production, Preview, Development
4. Save → Redeploy

**Eğer yoksa → Railway'den gelen istekler 401 Unauthorized alıyor!**

---

### 4️⃣ **Test Strategy Signal**

Dashboard'da strateji kartında **"Test"** butonuna basın.

**Beklenen sonuç:**
```
Signal: LONG
Strength: 75%
Reason: RSI: 28.5, MACD bullish, EMA cross detected
Latest Price: $95,234.50
```

**Eğer şunu alırsanız → SORUN:**
```
Signal: NONE
Strength: 0%
Reason: No conditions met
```
→ Strateji parametreleri çok kısıtlayıcı, asla sinyal üretmiyor!

---

### 5️⃣ **TrendTrader Combined Parametrelerini Kontrol Edin**

TrendTrader Combined stratejisi **çok katı** kurallar kullanır:

- RSI < 30 veya > 70 olmalı
- EMA cross olmalı
- MACD cross olmalı
- Bollinger Bands dışında olmalı
- **HEPSİ AYNI ANDA!**

**Sonuç:** Çok nadir sinyal üretir.

**Çözüm:**
1. Stratejiyi **Delete** edin
2. **RSI Reversal** veya **EMA Cross** gibi daha basit bir strateji oluşturun
3. Parametreleri daha gevşek tutun (örn: RSI < 35 / > 65)

---

## 🔧 Hızlı Fix

### Option A: Railway Logs Kontrol

```
Railway → Virtuoso007 → Logs (sağ üstte)
```

**"[StrategyScheduler]" kelimesini arayın**

- Varsa → Scheduler çalışıyor ✅
- Yoksa → Scheduler başlamamış ❌

### Option B: Test Signal

```
Dashboard → Stratejiler → Test (mavi buton)
```

**Signal: NONE alıyorsanız:**
- Strateji parametreleri çok sıkı
- Yeni strateji oluşturun (RSI Reversal önerilir)

### Option C: Vercel API Key Kontrol

```
Vercel → Settings → Environment Variables
```

**`STRATEGY_MONITOR_API_KEY` VAR MI?**

- Yoksa → Ekleyin → Redeploy
- Varsa → Railway logs'ta `401 Unauthorized` var mı kontrol edin

---

## 📊 Expected Behavior

**Railway Logs (Her 15 Dakikada):**
```
[StrategyScheduler] ⏰ Running cycle at 2026-04-05T12:00:00.000Z
[StrategyScheduler] ✅ Cycle complete in 2.34s | Active: 1 | Success: 0 | Errors: 0
```

**Eğer sinyal bulursa:**
```
[StrategyScheduler] ✅ Cycle complete in 3.45s | Active: 1 | Success: 1 | Errors: 0
```

**Dashboard Activity Log:**
```
@doctorstrange opened LONG BTC (Strategy: TrendTrader Combined)
Entry: $95,234.50, TP: $98,091.54, SL: $92,377.47
```

---

## 🎯 Şimdi Ne Yapmalı?

1. **Railway logs kontrol edin** → `[StrategyScheduler]` var mı?
2. **Vercel environment variables** → `STRATEGY_MONITOR_API_KEY` var mı?
3. **Dashboard'da Test butonu** → Hangi signal veriyor?
4. **Sonuçları bana söyleyin!**

---

**En olası sorunlar:**
1. ✅ Railway 409 hatası → Scheduler başlatılamadı
2. ✅ Vercel API key yok → 401 Unauthorized
3. ✅ TrendTrader Combined çok kısıtlayıcı → Hiç sinyal üretmiyor
