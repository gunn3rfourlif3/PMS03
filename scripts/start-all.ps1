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

<#
  WHY NATIVE COMMANDS ARE WRAPPED.

  PowerShell turns ANY stderr output from a native command into a
  NativeCommandError record, and under ErrorActionPreference = 'Stop' that is a
  terminating error — so a command that SUCCEEDED kills this script. Redirecting
  with `*> $null` does not prevent it.

  It is not hypothetical: `docker info` prints a warning when
  DOCKER_INSECURE_NO_IPTABLES_RAW is set, and `npm install` writes every `npm
  warn` line to stderr. Both would abort the launcher before the exit-code check
  three lines below them ever ran.

  Exit codes are what this script actually tests, so native calls run with
  'Continue' and $LASTEXITCODE decides. Cmdlets keep 'Stop'.
#>
function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Command)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Command } finally { $ErrorActionPreference = $prev }
}

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
# Fail loudly here rather than limping on: without Postgres and Redis the API
# just retries connections forever and the real cause scrolls out of view.
Write-Host "`nStarting Docker (Postgres :5433, Redis :6380)..." -ForegroundColor Green

Invoke-Native { docker info *> $null }
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Docker isn't running." -ForegroundColor Red
  Write-Host "Start Docker Desktop, wait for the whale icon to stop animating, then run this again." -ForegroundColor Yellow
  exit 1
}

Push-Location $Root
Invoke-Native { docker compose up -d }
$composeOk = ($LASTEXITCODE -eq 0)
Pop-Location
if (-not $composeOk) {
  Write-Host "`n'docker compose up -d' failed — see the output above." -ForegroundColor Red
  exit 1
}

# Postgres accepts TCP before it's ready for queries; wait for real readiness so
# migrations and the seed don't race the container.
Write-Host "Waiting for Postgres..." -NoNewline
$ready = $false
foreach ($i in 1..30) {
  Invoke-Native { docker compose -f "$Root\docker-compose.yml" exec -T postgres pg_isready -U pms *> $null }
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Write-Host "." -NoNewline
  Start-Sleep -Seconds 1
}
if ($ready) { Write-Host " ready" -ForegroundColor Green }
else {
  Write-Host ""
  Write-Host "Postgres did not become ready in 30s. Check: docker compose logs postgres" -ForegroundColor Red
  exit 1
}

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
  Invoke-Native { npm install }
  Invoke-Native { npm run migration:run }

  # The app connects as pms_app, which is a ROLE, not a table — migrations do
  # not create it, so `docker compose down -v` leaves a database the API cannot
  # log into ("password authentication failed for user pms_app"), and the
  # failure only surfaces at sign-in because the seeds connect as the owner.
  # Must run AFTER the migrations: it grants on tables that have to exist. Safe
  # to repeat — the role is guarded by IF NOT EXISTS and the grants are
  # idempotent.
  Write-Host "Ensuring the pms_app role..." -ForegroundColor Green
  Invoke-Native {
    Get-Content (Join-Path $Root 'scripts\setup-app-role.sql') |
      docker compose -f "$Root\docker-compose.yml" exec -T postgres psql -U pms -d pms -v ON_ERROR_STOP=1
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nCould not create the pms_app role — sign-in will fail." -ForegroundColor Red
    Write-Host "Run it by hand and read the error:" -ForegroundColor Yellow
    Write-Host "  Get-Content scripts/setup-app-role.sql | docker compose exec -T postgres psql -U pms -d pms"
    exit 1
  }

  Invoke-Native { npm run seed }
  Pop-Location

  Push-Location $Web;  Invoke-Native { npm install }; Pop-Location
  if (-not $NoMobile) {
    Push-Location $Ten
    Invoke-Native { npm install }
    Invoke-Native { npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans }
    Pop-Location
    Push-Location $Land
    Invoke-Native { npm install }
    Invoke-Native { npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans }
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
