# Telegram bot + Degen dashboard — otomatik akış

Repo içinde yapılacaklar script’lerle biter. Deploy platformlarına (Railway / Vercel) anahtarları **senin hesabından** yapıştırman gerekir; bu API ile otomatik yapılamaz.

## 1) Kaynak dosya

`telegram-degen-bot/agents.local.json` — tüm agent tanımları (gitignore).

## 2) Komutlar (sırayla)

```bash
cd telegram-degen-bot
npm run verify:agents   # claw-api /acp/me — tüm anahtarlar + cüzdan uyumu
npm run railway:paste   # AGENTS_JSON.paste.txt üretir (Railway + Vercel için aynı içerik)
```

- **`verify:agents`** başarısızsa: `walletAddress` ilgili agent’ta `/acp/me` ile çakışıyordur; script çıktısını düzelt.
- **`railway:paste`**: `virtuals-protocol-acp/config.json` artık kullanılmaz; doğrudan `agents.local.json` → tek satır.

## 3) Deploy’a yapıştır (tek işlem)

| Ortam | Değişken | Değer |
|-------|-----------|--------|
| Railway (bot) | `AGENTS_JSON` | `AGENTS_JSON.paste.txt` dosyasının **tamamı** |
| Vercel (dashboard) | `AGENTS_JSON` | **Aynı** tek satır |
| Vercel | `DASHBOARD_PASSWORD`, `DASHBOARD_SESSION_SECRET` | Panel için (`.env.example` bak) |

Deploy / redeploy sonrası bitti.

## 4) Bot env’i (Railway)

`TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_IDS` — önceki gibi; `AGENTS_JSON` yukarıdaki paste ile güncellenir.

---

**Özet:** Kod ve veri repoda hizalı; `verify:agents` yeşilse anahtarlar doğru; `railway:paste` çıktısı iki platforma aynen verilir.
