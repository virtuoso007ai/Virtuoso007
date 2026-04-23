# Telegram Degen Claw bot (Virtuoso007 orkestra)

Birden fazla agent için Telegram’dan **Hyperliquid doğrudan** (HL v2) perp aç/kapa/modify/limit iptal. ACP `perp_trade` job kullanılmaz; `apiKey` yine `/positions` vb. için claw-api’de kullanılabilir.

## Proje analizi (bu workspace)

### ACP `config.json` yapısı (önemli)

`virtuals-protocol-acp` tek bir kök dosya kullanır: `virtuals-protocol-acp/config.json` (`src/lib/config.ts` → `CONFIG_JSON_PATH`). **Her agent için ayrı klasörde `config.json` yok**; çoklu agent, **`agents` JSON dizisinde** birden fazla obje olarak tanımlanır. Her objede `apiKey` (`acp-...`), `id`, `name`, `walletAddress`, isteğe bağlı `degenAgentId` bulunur.

Bu workspace’te `**/config.json` araması yalnızca **bu tek dosyayı** buldu; agent adlı alt projeler veya ek `config.json` yok.

### Birden fazla proje (D:\\ üzerinde)

Super Saiyan Raichu bu repoda (`super-saiyan-raichu/virtuals-protocol-acp/config.json`). Diğer agent’ların ACP anahtarları **ayrı klasörlerdeki** kendi `config.json` dosyalarında olabilir. `npm run sync:agents` şunları **otomatik** tarar (varsa):

| Proje klasörü (D:\\) | Config yolu |
| --- | --- |
| `super-saiyan-raichu` | `virtuals-protocol-acp/config.json` (birincil) |
| `degenswap` | `config.json` (repo kökü) |
| `ichimoku-kinko-hyo` | `virtuals-protocol-acp/config.json` |
| `pokedex` | `virtuals-protocol-acp/config.json` |
| `virgen-capital` | `virtuals-protocol-acp/config.json` |
| `welles-wilder` | `virtuals-protocol-acp/config.json` |
| `wolfy-agent` | `virtuals-agent/config.json` (TaXerClaw → alias `taxerclaw`) |

Başka sürücü veya farklı yol için: `ACP_CONFIG_PATHS` ortam değişkenine virgülle tam dosya yolları ver (bu durumda yalnızca birincil `ACP_CONFIG_PATH` + bu liste kullanılır; kardeş klasör taraması devre dışı kalır).

- **Lokal senkron:** `npm run sync:agents` → yukarıdaki dosyalar + varsa `agents.manual.json` → `agents.local.json`.
- **Railway / Vercel `AGENTS_JSON`:** `npm run railway:paste` → `agents.local.json` kaynaklı `AGENTS_JSON.paste.txt` (tek satır); içeriğinin tamamını Railway ve Degen dashboard env’ine yapıştır (dosya git’e girmez).
- **Doğrulama:** `npm run verify:agents` — her agent için `GET /acp/me` (anahtar + `walletAddress` uyumu). Deploy öncesi çalıştır.

Varsayılan orkestra alias eşlemesi (isimden otomatik):

| Alias | Açıklama |
| --- | --- |
| `raichu` | Super Saiyan Raichu |
| `taxerclaw` | Wolf Agent (Taxerclaw) |
| `pokedex` | Pokedex |
| `welles` | Welles Wilder |
| `ichimoku` | Ichimoku Kinko Hyo |
| `virgen` | Virgen Capital |
| `degenswap` | DegenSwap |

Her agent için Virtuals/ACP’den ayrı **LITE agent API key** (`acp-...`) gerekir; `agents.example.json` şablonunu kopyalayıp anahtarları doldur.

### Yeni agent eklemek

1. `agents.example.json` formatında yeni bir obje ekle: `alias` (kısa, komutta kullanılacak), `apiKey`, isteğe bağlı `label`.
2. Railway’de `AGENTS_JSON` değişkenini güncelle (veya `AGENTS_JSON_PATH` dosyasını) ve yeniden deploy et / servisi yeniden başlat.

## GitHub ([Virtuoso007](https://github.com/virtuoso007ai/Virtuoso007))

Boş repoya bu klasörü kök olarak göndermek için örnek:

```bash
cd telegram-degen-bot
git init
git add .
git commit -m "Initial Virtuoso007 telegram orchestrator"
git branch -M main
git remote add origin https://github.com/virtuoso007ai/Virtuoso007.git
git push -u origin main
```

Anahtarları ve `.env` asla commit etme; sadece `agents.example.json` (placeholder) repoda kalabilir.

## Railway ve Vercel (HL v2)

Güncel değişken listesi, `AGENTS_JSON` tek satır üretimi ve `HL_API_WALLET_KEY_<ALIAS>` açıklaması için **[DEPLOY_RAILWAY_VERCEL.md](./DEPLOY_RAILWAY_VERCEL.md)** dosyasına bak.

Kısa özet: **Root Directory** Railway’de `telegram-degen-bot`; Vercel’de `degen-dashboard`. İki yerde de aynı `AGENTS_JSON` ve aynı HL API wallet secret isimleri kullanılmalı.

## Lokal

```bash
cd telegram-degen-bot
cp .env.example .env
# .env düzenle
npm install
npm run dev
```

## Komutlar

| Komut | Örnek |
| --- | --- |
| `/open` | `/open raichu ETH long 50 10` |
| `/close` | `/close raichu SOL` |
| `/modify` | `/modify raichu ETH 2000 2200` |
| `/positions` veya `/poz` | `/positions raichu` veya `/positions all` — Degen [positions](https://dgclaw-app-production.up.railway.app/users/…/positions) |
| `/balance`, `/bakiye`, `/account` | `/balance raichu` veya `/balance all` — Degen [account](https://dgclaw-app-production.up.railway.app/users/…/account) (HL USDC) |
| `/agents` | Kayıtlı alias’lar |

VIRTUAL için `size` = **coin adedi** (USDC değil). `walletAddress` sync ile eklenebilir; eklenmezse yine de `/positions` çalışır (ACP `apiKey` → `/acp/me`).

## Güvenlik

- `ALLOWED_CHAT_IDS` üretimde mutlaka dolu olsun.
- API anahtarlarını repoya koyma; sadece Railway env veya güvenli secret store.
- Bot token’ı herhangi bir yerde paylaştıysan BotFather’da **`/revoke`** ile yeni token al ve eskisini geçersiz bırak.
