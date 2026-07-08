<#
.SYNOPSIS
  Start the whole PMS 0.3 stack, each in its own window.

.DESCRIPTION
  Frees the ports it needs, makes sure Docker (Postgres + Redis) is up, then
  launches the API, the web back-office, and (optionally) the two Expo apps —
  each in a separate PowerShell window so you can read their logs and Ctrl+C
  them individually.

.PARAMETER Setup
  First-time / after-a-pull: runs `npm install` where needed, applies DB
  migrations, and reseeds the demo data before starting anything.

.PARAMETER NoMobile
  Start only the API + web back-office (skip the two Expo apps).

.PARAMETER NoKill
  Do NOT free the ports first (by default any process already listening on
  3000/3001/8081/8082 is stopped so this stack can take them).

.EXAMPLE
  .\scripts\start-all.ps1
.EXAMPLE
  .\scripts\start-all.ps1 -Setup          # first run / after new migrations
.EXAMPLE
  .\scripts\start-all.ps1 -NoMobile
#>
param(
  [switch]$Setup,
  [switch]$NoMobile,
  [switch]$NoKill
)

$ErrorActionPreference = 'Stop'

# Repo root = parent of this script's folder, regardless of where it's run from.
$Root = Split-Path -Parent $PSScriptRoot
$Web  = Join-Path $Root 'web-admin'
$Ten  = Join-Path $Root 'mobile-tenant'
$Land = Join-Path $Root 'mobile-landlord'

function Free-Port([int]$Port) {
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -Expand OwningProcess -Unique
    foreach ($processId in $pids) {
      Write-Host "  freeing port $Port (PID $processId)" -ForegroundColor Yellow
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  } catch {
    # Fallback for machines without Get-NetTCPConnection
    netstat -ano | Select-String ":$Port\s.*LISTENING" | ForEach-Object {
      $procId = ($_ -split '\s+')[-1]
      if ($procId -match '^\d+$') { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
  }
}

# Open a new PowerShell window that cd's into $dir and runs $cmd.
function Start-Window([string]$Title, [string]$Dir, [string]$Cmd) {
  Write-Host "  -> $Title" -ForegroundColor Cyan
  $inner = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$Dir'; $Cmd"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $inner | Out-Null
}

Write-Host "PMS 0.3 launcher" -ForegroundColor Green
Write-Host "root: $Root"

# 1. Infra
Write-Host "`nStarting Docker (Postgres :5433, Redis :6380)..." -ForegroundColor Green
Push-Location $Root
docker compose up -d
Pop-Location

# 2. Free ports
if (-not $NoKill) {
  Write-Host "`nFreeing ports..." -ForegroundColor Green
  Free-Port 3000
  Free-Port 3001
  if (-not $NoMobile) { Free-Port 8081; Free-Port 8082 }
}

# 3. First-time / after-a-pull setup
if ($Setup) {
  Write-Host "`nSetup: installing deps, migrating, seeding..." -ForegroundColor Green
  Push-Location $Root
  npm install
  npm run migration:run
  npm run seed
  Pop-Location

  Push-Location $Web;  npm install; Pop-Location
  if (-not $NoMobile) {
    Push-Location $Ten
    npm install
    npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans
    Pop-Location
    Push-Location $Land
    npm install
    npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans
    Pop-Location
  }
}

# 4. Launch everything, each in its own window
Write-Host "`nLaunching apps..." -ForegroundColor Green
Start-Window 'PMS API (3000)'        $Root 'npm run start:dev'
Start-Sleep -Seconds 2
Start-Window 'PMS Web (3001)'        $Web  'npm run dev'

if (-not $NoMobile) {
  Start-Window 'PMS Tenant (Expo 8081)'   $Ten  'npx expo start --port 8081'
  Start-Window 'PMS Landlord (Expo 8082)' $Land 'npx expo start --port 8082'
}

Write-Host "`nDone. Windows opened:" -ForegroundColor Green
Write-Host "  API      http://localhost:3000/api"
Write-Host "  Web      http://localhost:3001"
if (-not $NoMobile) {
  Write-Host "  Tenant   Expo on :8081 (press w for web)"
  Write-Host "  Landlord Expo on :8082 (press w for web)"
}
Write-Host "`nLogins (OTP prints in the API window):" -ForegroundColor Green
Write-Host "  owner@demo.test         web console + landlord app"
Write-Host "  thabo@demo.test         tenant app"
Write-Host "  sipho@owner.demo.test   owner portal (/portal)"
