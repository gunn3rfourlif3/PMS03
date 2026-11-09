<#
.SYNOPSIS
  Bring up the Midnight Masquerade demo in one command.

.DESCRIPTION
  Checks the demo configuration, frees the ports, starts everything, and prints
  where to go and who to sign in as.

  PORTS ARE THE REASON THIS EXISTS. Running `npm run dev` by hand against a
  back office that is already running fails with EADDRINUSE and a stack trace
  that says nothing about the real problem. start-all.ps1 already frees
  3000/3001 before it launches, so this delegates to it rather than keeping a
  second copy of that logic — if port handling changes, it changes in one file.

.PARAMETER Seed
  Reload the Midnight Masquerade world first. Needed after the profile changes
  (branding colours, the sign-in address) and otherwise not — it takes a few
  minutes. Idempotent on the slug, so it tops up rather than duplicating.

.PARAMETER Mode
  a | b | c. Sets the deployment mode before starting, so the restart the mode
  switch would otherwise force is already covered by this launch.

.EXAMPLE
  .\scripts\demo-up.ps1
.EXAMPLE
  .\scripts\demo-up.ps1 -Seed -Mode a
#>
param(
  [switch]$Seed,
  [ValidateSet('a', 'b', 'c')][string]$Mode
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

# Native commands write warnings to stderr, which PowerShell raises as a
# terminating error under 'Stop'. Same helper, same reason, as start-all.ps1.
function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Command)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Command } finally { $ErrorActionPreference = $prev }
}

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  $line = Select-String -Path $Path -Pattern "^$Key=" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $line) { return $null }
  return ($line.Line -replace "^$Key=", '').Trim()
}

Write-Host "`nMidnight Masquerade demo" -ForegroundColor Green

# ── 1. Configuration ───────────────────────────────────────────────────────
# Every one of these has cost an evening at least once. Checked rather than
# assumed, and reported together so one run tells you everything that is wrong.
$ApiEnv = Join-Path $Root '.env'
$WebEnv = Join-Path $Root 'web-admin\.env.local'
$problems = @()

$checks = @(
  @{ File = $ApiEnv; Path = '.env';                 Key = 'DEPLOYMENT_PROFILE'; Want = 'onsite_backoffice'; Why = 'the sealed on-site mode' },
  @{ File = $ApiEnv; Path = '.env';                 Key = 'OTP_CHANNEL';        Want = 'email';              Why = 'codes go to Mailpit, not the API log' },
  @{ File = $ApiEnv; Path = '.env';                 Key = 'SMTP_HOST';          Want = 'localhost';          Why = 'the Mailpit container' },
  @{ File = $WebEnv; Path = 'web-admin\.env.local'; Key = 'DEPLOYMENT_THEME';   Want = 'dark';               Why = 'the dark console theme' },
  @{ File = $WebEnv; Path = 'web-admin\.env.local'; Key = 'DEMO_CONSOLE';       Want = '1';                  Why = '/demo renders' },
  @{ File = $WebEnv; Path = 'web-admin\.env.local'; Key = 'NEXT_PUBLIC_VENDOR_SLUG'; Want = 'midnight-masquerade'; Why = 'localhost loads THEIR branding, not Locare''s' },
  @{ File = $WebEnv; Path = 'web-admin\.env.local'; Key = 'DEPLOYMENT_LOCALE';         Want = 'zh-Hans';              Why = 'the language switcher offers Mandarin; unset means English alone and it hides' }
)

foreach ($c in $checks) {
  $have = Get-EnvValue $c.File $c.Key
  if ($have -ne $c.Want) {
    $problems += "  $($c.Path): $($c.Key) is '$have', expected '$($c.Want)' — $($c.Why)"
  }
}

if ($problems.Count) {
  Write-Host "`nConfiguration is not demo-ready:" -ForegroundColor Red
  $problems | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
  Write-Host "`nFix those two files and run this again. Nothing has been started." -ForegroundColor Yellow
  exit 1
}
Write-Host "  configuration ok" -ForegroundColor DarkGray

# ── 2. Mode, before anything starts ────────────────────────────────────────
# Set first so the restart a mode change forces is this launch, not a second one.
if ($Mode) {
  & (Join-Path $PSScriptRoot 'demo-mode.ps1') $Mode
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# ── 3. Everything up ───────────────────────────────────────────────────────
# start-all frees 3000/3001, checks Docker, waits for Postgres to be ready for
# queries rather than merely listening, and opens a window per service.
& (Join-Path $PSScriptRoot 'start-all.ps1') -NoMobile
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nThe launcher stopped — see above." -ForegroundColor Red
  exit 1
}

# ── 4. The world ───────────────────────────────────────────────────────────
# After the stack is up, because the seeder needs Postgres and the API picks up
# the new rows on its next query. Branding is fetched per page load, so a
# browser refresh is enough to see new colours.
if ($Seed) {
  Write-Host "`nLoading the Midnight Masquerade world (a few minutes)..." -ForegroundColor Green
  Push-Location $Root
  Invoke-Native { npm run seed:prospect -- midnight-masquerade }
  $seedOk = ($LASTEXITCODE -eq 0)
  Pop-Location
  if (-not $seedOk) {
    Write-Host "`nThe seed failed — see above. The stack is running; the data may be incomplete." -ForegroundColor Red
    exit 1
  }
}

# ── 5. Where to go ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Ready." -ForegroundColor Green
Write-Host "  Back office    http://localhost:3001"
Write-Host "  Demo console   http://localhost:3001/demo"
Write-Host "  Inbox          http://localhost:8025   (sign-in codes arrive here)"
Write-Host ""
Write-Host "  Sign in as     yash@midnightmasquerade.demo" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Give the back office ~20s to compile on the first load." -ForegroundColor DarkGray
if (-not $Seed) {
  Write-Host "  Portfolio empty or the wrong colours? Re-run with -Seed." -ForegroundColor DarkGray
}
