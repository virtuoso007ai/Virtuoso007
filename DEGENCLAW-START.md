# DegenClaw’u başlatma (Super Saiyan Raichu workspace)

Bu klasörde artık **`dgclaw-skill`** klonlu. Özet akış:

## 1) ACP (zaten `virtuals-protocol-acp/`)

```powershell
cd d:\super-saiyan-raichu\virtuals-protocol-acp
.\run-acp.cmd setup
# veya mevcut config ile devam
```

## 2) `join_leaderboard` (forum / dgclaw API key)

```powershell
cd d:\super-saiyan-raichu\virtuals-protocol-acp
npm run degen:join:keys
npm run degen:join
.\run-acp.cmd job status <jobId>
# Ödeme onayla, COMPLETED olunca deliverable'daki encryptedApiKey'i coz:
npm run degen:join:decrypt -- ..\virtuals-protocol-acp\degen_join_private.pem "<BASE64>"
```

Çıkan düz metin API key → `d:\super-saiyan-raichu\dgclaw-skill\.env` içine:

```env
DGCLAW_API_KEY=buraya_yapistir
```

(`dgclaw-skill\.env.example` kopyala → `.env`)

## 3) Git Bash’te `acp` görünsün (dgclaw.sh için şart)

`dgclaw.sh` içinden `acp job status` çağrılıyor. **Git Bash** veya WSL’de:

```bash
export PATH="/d/super-saiyan-raichu/virtuals-protocol-acp:$PATH"
export ACP_USE_BASH_SHIM=1
# acp yerine dogrudan shim:
alias acp='bash /d/super-saiyan-raichu/virtuals-protocol-acp/acp.bash'
```

Kalıcı değilse her oturumda tekrarla; veya `virtuals-protocol-acp` içine `acp` adında uzantısız bir shell wrapper kopyala ve PATH’e ekle.

Windows’ta en kolayı: **`degenclaw-shell.cmd`** ile Git Bash açıp PATH set edilmiş oturum (aşağıda).

## 4) DegenClaw CLI

### Git Bash varsa (tam skill)

```bash
cd /d/super-saiyan-raichu/dgclaw-skill/scripts
./dgclaw.sh join
./dgclaw.sh leaderboard
```

Windows’tan kök dizinde: **`degenclaw.cmd leaderboard`** (Git Bash `PATH`’te olmalı).

### Git Bash yoksa — leaderboard önizleme (Node)

```powershell
cd d:\super-saiyan-raichu\virtuals-protocol-acp
# Opsiyonel: dgclaw-skill\.env icinde DGCLAW_API_KEY
npm run degen:claw:leaderboard
```

`join` zaten ACP ile yaptıysan, `dgclaw-skill\.env` içine API key yaz; forum / tam `dgclaw.sh` komutları için Git Bash önerilir.

## 5) Perp işlemleri (leaderboard sayılsın diye)

Aynı repo: `virtuals-protocol-acp` içindeki `npm run degen:perp:*` script’leri (Degen Claw provider).

## OpenClaw YAML

Örnek path’ler: **`openclaw-skills.example.yaml`** (düzenle ve OpenClaw config’ine yapıştır).
