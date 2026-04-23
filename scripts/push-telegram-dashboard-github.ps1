#Requires -Version 5.1
<#
  Monorepo kökünden (super-saiyan-raichu) Telegram bot ve Degen dashboard için
  ayrı GitHub repolarına subtree push.

  Önkoşul: GitHub’da iki BOŞ repo oluştur (README ekleme): örn. USER/telegram-degen-bot, USER/degen-dashboard
  Kimlik: git credential manager veya SSH (remote URL’yi ssh formunda ver)

  Varsayılan Virtuoso007 repoları:
    Telegram:  https://github.com/virtuoso007ai/Virtuoso007
    Dashboard: https://github.com/virtuoso007ai/degen-dashboard

  Kullanım:
    .\scripts\push-telegram-dashboard-github.ps1 `
      -TelegramRemote "https://github.com/virtuoso007ai/Virtuoso007.git" `
      -DashboardRemote "https://github.com/virtuoso007ai/degen-dashboard.git"
#>
param(
  [Parameter(Mandatory = $true)][string]$TelegramRemote,
  [Parameter(Mandatory = $true)][string]$DashboardRemote
)

$ErrorActionPreference = "Stop"
# scripts/ → repo kökü
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Push-Subtree {
  param([string]$Prefix, [string]$RemoteUrl, [string]$BranchName)
  Write-Host ">>> subtree split: $Prefix" -ForegroundColor Cyan
  git subtree split -P $Prefix -b $BranchName
  if ($LASTEXITCODE -ne 0) { throw "subtree split failed: $Prefix" }

  $name = "gh-$($Prefix -replace '[^a-z0-9]', '-')"
  git remote remove $name 2>$null
  git remote add $name $RemoteUrl
  Write-Host ">>> push $BranchName -> $RemoteUrl (main)" -ForegroundColor Cyan
  git push $name "${BranchName}:main" --force
  if ($LASTEXITCODE -ne 0) { throw "git push failed: $Prefix" }
  git branch -D $BranchName 2>$null
  git remote remove $name
}

Push-Subtree -Prefix "telegram-degen-bot" -RemoteUrl $TelegramRemote -BranchName "_split_telegram"
Push-Subtree -Prefix "degen-dashboard" -RemoteUrl $DashboardRemote -BranchName "_split_dashboard"

Write-Host "Tamam. İki repo main dalına gönderildi." -ForegroundColor Green
