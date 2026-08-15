<#
.SYNOPSIS
  Make the Locare marketing video, start to finish, unattended.

.DESCRIPTION
  Brings up everything the recording needs, films it, assembles the cuts, then
  cleans up after itself:

    Docker (Postgres + Redis)  ->  migrate  ->  seed  ->  API + web + Expo
      ->  Playwright records each beat  ->  ffmpeg builds the cuts

  The one trick that makes it unattended: the API's stdout is tee'd to a log
  file, so the recorder can read the "[OTP] owner@demo.test -> 123456" line
  instead of asking you to type it. The code is only ever plaintext there —
  otp_challenges stores it hashed.

  Settings live in scripts/video/video.config.json.

.PARAMETER SkipRecord
  Bring the stack up but don't record. Useful for fixing selectors by hand.

.PARAMETER SkipAssemble
  Record the clips but don't run ffmpeg.

.PARAMETER KeepRunning
  Leave the API/web/Expo processes running afterwards.

.EXAMPLE
  .\scripts\video\make-video.ps1
#>
[CmdletBinding()]
param(
  [switch]$SkipRecord,
  [switch]$SkipAssemble,
  [switch]$KeepRunning
)

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Load config under 'Stop' so a missing/corrupt file fails immediately…
$ErrorActionPreference = 'Stop'
try {
  $Cfg = Get-Content (Join-Path $PSScriptRoot 'video.config.json') -Raw | ConvertFrom-Json
} catch {
  Write-Host "`nCouldn't read scripts/video/video.config.json — $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# …then drop back to 'Continue' for the rest. Under 'Stop', ANY native command
# that writes to stderr becomes a terminating error — `docker info` emitting a
# harmless "DOCKER_INSECURE_NO_IPTABLES_RAW is set" warning was enough to kill
# the whole run. Every native call below checks $LASTEXITCODE explicitly, which
# is the correct signal.
$ErrorActionPreference = 'Continue'

$LogDir = Join-Path $Root '.video'
$ApiLog = Join-Path $Root $Cfg.otpLog
$Started = @()

function Say([string]$m, [string]$c = 'Cyan') { Write-Host "`n$m" -ForegroundColor $c }
function Die([string]$m) { Write-Host "`n$m" -ForegroundColor Red; Cleanup; exit 1 }

# Start a background process, piping stdout+stderr to a log we can read later.
function Start-Logged([string]$Name, [string]$Dir, [string]$Exe, [string]$ArgLine, [string]$Log) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Log) | Out-Null
  if (Test-Path $Log) { Remove-Item $Log -Force }
  $p = Start-Process -FilePath $Exe -ArgumentList $ArgLine -WorkingDirectory $Dir `
        -RedirectStandardOutput $Log -RedirectStandardError "$Log.err" `
        -WindowStyle Hidden -PassThru
  $script:Started += [pscustomobject]@{ Name = $Name; Proc = $p }
  Write-Host "  started $Name (pid $($p.Id)) -> $Log"
  return $p
}

# Poll a URL until it answers. Next and Expo both take a while to compile.
function Wait-Url([string]$Name, [string]$Url, [int]$Seconds) {
  Write-Host "  waiting for $Name" -NoNewline
  for ($i = 0; $i -lt $Seconds; $i++) {
    try {
      Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop | Out-Null
      Write-Host " ok" -ForegroundColor Green; return $true
    } catch {
      # A 4xx still means something is listening, which is all we need.
      if ($_.Exception.Response) { Write-Host " ok" -ForegroundColor Green; return $true }
    }
    Start-Sleep -Seconds 1
    if ($i % 5 -eq 0) { Write-Host "." -NoNewline }
  }
  Write-Host " timed out" -ForegroundColor Red
  return $false
}

function Cleanup {
  if ($KeepRunning -or -not $Cfg.stopWhenDone) {
    if ($script:Started.Count) { Say "Left running: $($script:Started.Name -join ', ')" 'Yellow' }
    return
  }
  if ($script:Started.Count) {
    Say 'Stopping services...'
    foreach ($s in $script:Started) {
      try {
        # Kill the tree — npm spawns node as a child and only the child holds the port.
        & taskkill /PID $s.Proc.Id /T /F *> $null
        Write-Host "  stopped $($s.Name)"
      } catch { }
    }
  }
}

try {
  Say 'Locare video pipeline' 'Green'
  Write-Host "root: $Root"
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

  # ── 1. Infra ──────────────────────────────────────────────────────────────
  if ($Cfg.startDocker) {
    Say '1/6  Docker'
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Die 'Docker is not running. Start Docker Desktop and try again.' }
    # *> $null swallows the routine Docker warnings (obsolete `version` key,
    # iptables notices) that would otherwise clutter every run.
    Push-Location $Root; docker compose up -d *> $null; $ok = ($LASTEXITCODE -eq 0); Pop-Location
    if (-not $ok) { Die 'docker compose up failed.' }

    Write-Host '  waiting for Postgres' -NoNewline
    $ready = $false
    foreach ($i in 1..30) {
      docker compose -f (Join-Path $Root 'docker-compose.yml') exec -T postgres pg_isready -U pms *> $null
      if ($LASTEXITCODE -eq 0) { $ready = $true; break }
      Write-Host '.' -NoNewline; Start-Sleep -Seconds 1
    }
    if (-not $ready) { Die 'Postgres never became ready.' }
    Write-Host ' ok' -ForegroundColor Green
  }

  # ── 2. Schema + fictional data ────────────────────────────────────────────
  if ($Cfg.reseed) {
    Say '2/6  Migrate + seed'
    Push-Location $Root
    npm run migration:run *> (Join-Path $LogDir 'migrate.log')
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "Migrations failed — see .video\migrate.log" }
    npm run seed *> (Join-Path $LogDir 'seed.log')
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "Seed failed — see .video\seed.log" }
    # Pending proofs of payment — without these the /payments queue films empty,
    # and beat 05 has nothing to click.
    npx ts-node -r tsconfig-paths/register scripts/video/seed-video-extras.ts *>> (Join-Path $LogDir 'seed.log')
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "Video extras seed failed — see .video\seed.log" }
    Pop-Location
    Write-Host '  Demo Agency seeded' -ForegroundColor Green
  }

  # ── 3. Services ───────────────────────────────────────────────────────────
  Say '3/6  Services'
  if ($Cfg.startApi) {
    # OTP_CHANNEL=console is what puts the code in the log for the recorder.
    $env:OTP_CHANNEL = 'console'
    Start-Logged 'API'   $Root 'npm.cmd' 'run start:dev' $ApiLog | Out-Null
  }
  if ($Cfg.startWeb) {
    Start-Logged 'Web'   (Join-Path $Root 'web-admin') 'npm.cmd' 'run dev' (Join-Path $LogDir 'web.log') | Out-Null
  }
  if ($Cfg.startTenant) {
    # --web goes straight to the browser build; no interactive keypress needed.
    Start-Logged 'Tenant' (Join-Path $Root 'mobile-tenant') 'npx.cmd' 'expo start --web' (Join-Path $LogDir 'tenant.log') | Out-Null
  }
  if ($Cfg.startLandlord) {
    # Second Expo instance needs its own port, or it grabs 8081 and clashes.
    Start-Logged 'Landlord' (Join-Path $Root 'mobile-landlord') 'npx.cmd' 'expo start --web --port 8082' (Join-Path $LogDir 'landlord.log') | Out-Null
  }

  if ($Cfg.startApi -and -not (Wait-Url 'API' "$($Cfg.apiUrl)/health" $Cfg.waitApi)) { Die "API never came up — see $ApiLog" }
  if ($Cfg.startWeb -and -not (Wait-Url 'Web' $Cfg.baseUrl $Cfg.waitWeb)) { Die "Web never came up — see .video\web.log" }
  if ($Cfg.startTenant) {
    if (-not (Wait-Url 'Tenant' $Cfg.tenantUrl $Cfg.waitTenant)) {
      Write-Host '  tenant app unavailable — its beat will be skipped' -ForegroundColor Yellow
    }
  }
  if ($Cfg.startLandlord) {
    if (-not (Wait-Url 'Landlord' $Cfg.landlordUrl $Cfg.waitLandlord)) {
      Write-Host '  landlord app unavailable — its beats will be skipped' -ForegroundColor Yellow
    }
  }

  # ── 3b. Voiceover ─────────────────────────────────────────────────────────
  # BEFORE recording, not after. The recorder reads docs/video/vo/*.wav to decide
  # how long to hold each shot, so narration that arrives later means clips too
  # short for their own lines — which is exactly how the voice drifted out of
  # sync. Existing WAVs are reused, so a rerun costs nothing.
  if ($env:ELEVENLABS_API_KEY -or $env:ELEVEN_API_KEY) {
    Say '3b   Voiceover (ElevenLabs)'
    Push-Location $Root
    node scripts/video/tts.mjs
    if ($LASTEXITCODE -ne 0) {
      Write-Host '  voiceover failed — continuing without narration' -ForegroundColor Yellow
    }
    Pop-Location
  } elseif (Test-Path (Join-Path $Root 'docs\video\vo\01-dashboard.wav')) {
    Say '3b   Voiceover (using existing docs\video\vo)'
  } else {
    Write-Host '  no narration — cuts will be silent and use their fallback timings' -ForegroundColor Yellow
    Write-Host '    $env:ELEVENLABS_API_KEY="..."  or  scripts\video\tts-windows.ps1' -ForegroundColor DarkGray
  }

  # ── 4. Record ─────────────────────────────────────────────────────────────
  if (-not $SkipRecord) {
    Say '4/6  Recording'
    $env:BASE_URL    = $Cfg.baseUrl
    $env:TENANT_URL   = $Cfg.tenantUrl
    $env:LANDLORD_URL = $Cfg.landlordUrl
    $env:LOGIN_EMAIL = $Cfg.loginEmail
    $env:OTP_LOG     = $ApiLog
    Push-Location $Root
    node scripts/video/record.mjs
    $recOk = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $recOk) { Die 'Recording failed.' }
  } else {
    Say '4/6  Recording skipped' 'Yellow'
  }

  # ── 5. Assemble ───────────────────────────────────────────────────────────
  # Deliberately NOT gated on -SkipRecord: re-cutting existing clips (new
  # narration, new timings, new captions) is the common case and shouldn't
  # require re-filming. assemble.sh fails loudly if docs/video/raw is empty.
  if (-not $SkipAssemble) {
    Say '5/6  Assembling'
    Push-Location $Root
    bash scripts/video/assemble.sh
    $asmOk = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $asmOk) { Write-Host '  assembly failed — clips are still in docs/video/raw' -ForegroundColor Yellow }
  } else {
    Say '5/6  Assembly skipped' 'Yellow'
  }

  Say '6/6  Done' 'Green'
  $out = Join-Path $Root 'docs\video\out'
  if (Test-Path $out) { Get-ChildItem $out -Filter *.mp4 | ForEach-Object { Write-Host ("   {0}  {1:N1} MB" -f $_.Name, ($_.Length / 1MB)) } }
  Write-Host "`nWatch locare-15s.mp4 first — it's the one you publish." -ForegroundColor Cyan
  Write-Host "Pacing off? Adjust the wait values in scripts/video/beats.config.mjs and run again.`n"
}
finally {
  Cleanup
}
