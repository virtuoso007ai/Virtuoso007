# Railway (Telegram bot) ve Vercel (Degen Dashboard) — HL v2 trade

Bu repoda **Hyperliquid v2** işlemleri doğrudan API wallet private key ile imzalanır. `AGENTS_JSON` içinde **`walletAddress`** (Privy master) zorunludur. **`hlApiWalletKey`** JSON’a koymak yerine ortam değişkenlerinde tutman önerilir.

## Ortak: `AGENTS_JSON` (tek satır)

1. Yerelde `telegram-degen-bot/agents.local.json` doldur (`alias`, `walletAddress`, isteğe bağlı `hlWallet`, `apiKey`, …). **`hlApiWalletKey` repoya yazma.**
2. Tek satır üret:
   ```bash
   cd telegram-degen-bot
   npm run agents:paste-file
   ```
3. Çıkan `AGENTS_JSON.paste.txt` içeriğini **hem Railway hem Vercel**de `AGENTS_JSON` değişkenine yapıştır. Başına/sonuna tırnak ekleme; değer `[` ile başlayan ham JSON olmalı.

## HL API wallet key (çoklu agent)

Her trade yapan agent için **ayrı** secret:

| Değişken | Örnek |
| --- | --- |
| `HL_API_WALLET_KEY_FRIDAY` | `0x` + 64 hex |
| `HL_API_WALLET_KEY_ICHIMOKU` | … |
| `HL_API_WALLET_KEY_WELLES` | … |

Alias büyük harf, `_` dışında özel karakter yok: `taxerclaw` → `HL_API_WALLET_KEY_TAXERCLAW`.

**Tek agent** deploy senaryosunda (nadir): `HL_API_WALLET_KEY` ve `HL_MASTER_ADDRESS` de kullanılabilir (kod `applyHlTradeEnvToAgent` ile birleştirir).

**JSON içinde** `hlApiWalletKey` alanı opsiyonel; tanımlıysa env ile aynı agent için env genelde yeterli (tercih: sadece env).

## Master adres (JSON’da yoksa)

`walletAddress` gövdede yoksa (önerilmez), agent başına:

`HL_MASTER_ADDRESS_<ALIAS>` — örn. `HL_MASTER_ADDRESS_FRIDAY`.

## Hyperliquid ağı

Varsayılan **mainnet** `https://api.hyperliquid.xyz`. Testnet için her iki serviste de aynı değeri ver:

```env
HYPERLIQUID_INFO_URL=https://api.hyperliquid-testnet.xyz/info
```

(`info` yolu verilirse kod kök API URL’ini türetir.)

---

## Railway — `telegram-degen-bot`

1. **Root Directory**: `telegram-degen-bot`
2. **Variables** (minimum):
   - `TELEGRAM_BOT_TOKEN`
   - `ALLOWED_CHAT_IDS` — üretimde dolu tut
   - `AGENTS_JSON` — yukarıdaki tek satır
   - Her HL trade agent için `HL_API_WALLET_KEY_<ALIAS>`
3. İsteğe bağlı: `ACP_API_URL`, `ACP_BUILDER_CODE`, `DGCLAW_APP_URL`, `HYPERLIQUID_INFO_URL`
4. Deploy: Dockerfile ile `npm run build` + `npm start`

Yerelde secret dosyası kullanıyorsan (`secrets/hl-api-wallets.env`) bunu Railway’e **dosya olarak bağlamıyorsan**, aynı anahtarları Railway **Variables** olarak tek tek ekle.

---

## Vercel — `degen-dashboard`

1. Proje kökü: **`degen-dashboard`** (monorepo ise Root Directory veya ayrı proje olarak bu klasörü bağla).
2. **Variables**:
   - `AGENTS_JSON` — bot ile **aynı** tek satır JSON
   - `HL_API_WALLET_KEY_*` — bot ile **aynı** isimler/değerler
   - `DASHBOARD_PASSWORD` — giriş şifresi
   - `DASHBOARD_SESSION_SECRET` — en az 32 karakter rastgele string
   - **Activity log** (trade geçmişi panelde):  
     `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`  
     Yoksa `/api/activity` ve işlem sonrası log yazımı hata verir; trade route’ları Redis olmadan da çalışabilir mi kontrol et — `appendActivity` Redis şartı var; **üretimde Redis önerilir**.
   - Strateji cron: Vercel’de scheduled job → `/api/cron/strategy-monitor`; header’da `Authorization: Bearer <CRON_SECRET>`. Ortamda `CRON_SECRET` tanımla (ayrıntı: `degen-dashboard/PRODUCTION_DEPLOYMENT.md`).
3. `HYPERLIQUID_INFO_URL` — bot ile aynı (mainnet/testnet).

Build: `npm run build` → `next start` (Vercel default).

---

## Deploy sonrası hızlı kontrol

- Telegram: `/agents` ve bir agent için `/balance` veya küçük notional `/open` (dikkatli).
- Dashboard: giriş → snapshot → trade sekmesi; **Açık limitler** üzerinden tek tek veya **“Tümünü iptal (alias · parite)”** ile toplu iptal.

## Güvenlik

- Private key ve `AGENTS_JSON.paste.txt` / `agents.local.json` **commit etme** (`.gitignore` buna göre).
- Eski anahtar sızdıysa Hyperliquid’te API wallet’ı devre dışı bırakıp yenisini üret.
