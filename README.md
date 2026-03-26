# Telegram Degen Claw bot (Virtuoso007 orkestra)

Birden fazla ACP agent’ı için Telegram’dan `perp_trade` (aç/kapa) ve `perp_modify` gönderir.

## Proje analizi (bu workspace)

### ACP `config.json` yapısı (önemli)

`virtuals-protocol-acp` tek bir kök dosya kullanır: `virtuals-protocol-acp/config.json` (`src/lib/config.ts` → `CONFIG_JSON_PATH`). **Her agent için ayrı klasörde `config.json` yok**; çoklu agent, **`agents` JSON dizisinde** birden fazla obje olarak tanımlanır. Her objede `apiKey` (`acp-...`), `id`, `name`, `walletAddress`, isteğe bağlı `degenAgentId` bulunur.

Bu workspace’te `**/config.json` araması yalnızca **bu tek dosyayı** buldu; agent adlı alt projeler veya ek `config.json` yok.

### Mevcut anahtarlar

`virtuals-protocol-acp/config.json` içinde **yalnızca bir** agent kaydı var: **Super Saiyan Raichu** (tek `acp-...` hem `LITE_AGENT_API_KEY` hem `agents[0].apiKey` için). Wolf (Taxerclaw), Pokedex, Welles Wilder ve Ichimoku için **bu dosyada ikinci/üçüncü `agents[]` girdisi yok** — anahtarlar başka ortamda veya henüz oluşturulmamış. Diğer agent’ları eklediğinde: aynı `config.json` içinde `agents` dizisine yeni objeler ekle; Telegram botu `npm run sync:agents` ile hepsini okur. Eksikleri geçici olarak `agents.manual.json` ile tamamlayabilirsin (git’e girmez).

- **Lokal senkron:** `npm run sync:agents` → `virtuals-protocol-acp/config.json` + varsa `agents.manual.json` → `agents.local.json`.
- **Railway tek satır env:** `npm run sync:agents:railway` çıktısını `AGENTS_JSON` olarak yapıştır (manuel anahtarlar `agents.manual.json` doldurulduktan sonra).

Varsayılan orkestra alias eşlemesi (isimden otomatik):

| Alias | Açıklama |
| --- | --- |
| `raichu` | Super Saiyan Raichu |
| `taxerclaw` | Wolf Agent (Taxerclaw) |
| `pokedex` | Pokedex |
| `welles` | Welles Wilder |
| `ichimoku` | Ichimoku Kinko Hyo |

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

## Railway

1. [railway.app](https://railway.app) → New Project → **Deploy from GitHub** → `Virtuoso007` repo.
2. **Root Directory**: Bu monorepo içindeyse `telegram-degen-bot` seç; tek repo sadece bot ise kök boş kalır.
3. **Variables**:
   - `TELEGRAM_BOT_TOKEN` — BotFather’dan ([Bot API](https://core.telegram.org/bots/api))
   - `ALLOWED_CHAT_IDS` — Telegram’daki sayısal sohbet/kullanıcı ID’n (virgülle birden fazla); boş bırakma (önerilmez)
   - `AGENTS_JSON` — tek satır JSON dizi, veya `AGENTS_JSON_PATH` ile dosya yolu
   - İsteğe bağlı: `ACP_BUILDER_CODE`, `ACP_API_URL`
4. **Deploy** — `Dockerfile` ile build alır; `PORT` Railway tarafından set edilir (health check).

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
| `/agents` | Kayıtlı alias’lar |

VIRTUAL için `size` = **coin adedi** (USDC değil).

## Güvenlik

- `ALLOWED_CHAT_IDS` üretimde mutlaka dolu olsun.
- API anahtarlarını repoya koyma; sadece Railway env veya güvenli secret store.
- Bot token’ı herhangi bir yerde paylaştıysan BotFather’da **`/revoke`** ile yeni token al ve eskisini geçersiz bırak.
