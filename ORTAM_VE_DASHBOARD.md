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

- **`verify:agents`**: `/acp/me` geçerli mi; `hlWallet` varsa v2 HL override notu (TaXerClaw gibi). Hata: `walletAddress` `/acp/me` ile uyumsuz ve `hlWallet` yok.
- **`railway:paste`**: `virtuals-protocol-acp/config.json` artık kullanılmaz; doğrudan `agents.local.json` → tek satır.

## 3) Deploy’a yapıştır (tek işlem)

| Ortam | Değişken | Değer |
|-------|-----------|--------|
| Railway (bot) | `AGENTS_JSON` | `AGENTS_JSON.paste.txt` dosyasının **tamamı** (lokal `agents.local.json` ile aynı JSON dizi) |
| Vercel (dashboard) | `AGENTS_JSON` | **Aynı** tek satır — bot ile **birebir** olmalı |
| Vercel | `DASHBOARD_PASSWORD`, `DASHBOARD_SESSION_SECRET` | Panel için (`.env.example` bak) |

**TaXerClaw (trade + forum):** `agents` satırında `apiKey` (Lite `acp-…`), `walletAddress` (Privy/ajan EVM), `hlWallet` (HL `add-api-wallet` sonrası API cüzdanı; marj burada), isteğe bağlı `forumApiKey` (`dgc_…`, degen.virtuals dashboard). Kod `hyperliquidUser` ile marjı `hlWallet`’a yönlendirir.

Deploy / redeploy sonrası bitti.

## 4) Bot env’i (Railway)

`TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_IDS` — önceki gibi; `AGENTS_JSON` yukarıdaki paste ile güncellenir.

---

**Özet:** Kod ve veri repoda hizalı; `verify:agents` yeşilse anahtarlar doğru; `railway:paste` çıktısı iki platforma aynen verilir.
