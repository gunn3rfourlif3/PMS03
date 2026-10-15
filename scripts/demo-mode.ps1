<#
.SYNOPSIS
  Switch the LOCAL dev stack between the three on-site options.

.DESCRIPTION
  The demo stack in deploy/demo/ is for the VPS: it joins the production Docker
  network so the live Caddy can route to it, which does not exist on this
  machine. Locally the ordinary dev stack does the job — same code, same
  database, same Midnight Masquerade world.

  This writes DEPLOYMENT_PROFILE into the two files that feed it:
    .env                   -> the API (dotenv), which ENFORCES the mode
    web-admin/.env.local   -> the web, which only decides what to show

  Both, because the API and the back office read it separately. Setting one and
  not the other is the known way to get a menu entry the API refuses.

  It also sets DEMO_CONSOLE=1 in web-admin/.env.local so /demo renders here.

.PARAMETER Mode
  a | b | c  (or the full profile name). Omit to report the current mode.

.EXAMPLE
  .\scripts\demo-mode.ps1 a      # On-site, back office (sealed)
  .\scripts\demo-mode.ps1 c      # Private server (the default)
  .\scripts\demo-mode.ps1        # just report
#>
param([string]$Mode)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ApiEnv = Join-Path $Root '.env'
$WebEnv = Join-Path $Root 'web-admin\.env.local'

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  $line = Select-String -Path $Path -Pattern "^$Key=" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $line) { return $null }
  return ($line.Line -replace "^$Key=", '').Trim()
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
  if (-not (Test-Path $Path)) { New-Item -ItemType File -Path $Path -Force | Out-Null }
  $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
  if ($null -eq $content) { $content = '' }
  if ($content -match "(?m)^$Key=.*$") {
    # Replace the one line, leaving every other setting alone.
    $content = [regex]::Replace($content, "(?m)^$Key=.*$", "$Key=$Value")
  } else {
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $content += "`n" }
    $content += "$Key=$Value`n"
  }
  Set-Content -Path $Path -Value $content -NoNewline
}

if (-not $Mode) {
  $api = Get-EnvValue $ApiEnv 'DEPLOYMENT_PROFILE'
  $web = Get-EnvValue $WebEnv 'DEPLOYMENT_PROFILE'
  if (-not $api) { $api = '(unset -> private_server)' }
  if (-not $web) { $web = '(unset -> private_server)' }
  Write-Host "API  (.env)                 $api"
  Write-Host "Web  (web-admin/.env.local) $web"
  if ($api -ne $web) {
    Write-Host ""
    Write-Host "These disagree. The API wins on what is ALLOWED; the web decides what is SHOWN." -ForegroundColor Yellow
    Write-Host "Run this script with a mode to put them back in step." -ForegroundColor Yellow
  }
  exit 0
}

switch ($Mode.ToLower()) {
  'a'                 { $Profile = 'onsite_backoffice' }
  'onsite_backoffice' { $Profile = 'onsite_backoffice' }
  'b'                 { $Profile = 'onsite_connected' }
  'onsite_connected'  { $Profile = 'onsite_connected' }
  'c'                 { $Profile = 'private_server' }
  'private_server'    { $Profile = 'private_server' }
  default {
    Write-Host "Unknown mode '$Mode'. Use a, b or c." -ForegroundColor Red
    exit 1
  }
}

Set-EnvValue $ApiEnv 'DEPLOYMENT_PROFILE' $Profile
Set-EnvValue $WebEnv 'DEPLOYMENT_PROFILE' $Profile
Set-EnvValue $WebEnv 'DEMO_CONSOLE' '1'

$labels = @{
  'onsite_backoffice' = 'A - On-site, back office (sealed)'
  'onsite_connected'  = 'B - On-site, connected'
  'private_server'    = 'C - Private server'
}

Write-Host ""
Write-Host "Mode set to: $($labels[$Profile])" -ForegroundColor Green
Write-Host ""
Write-Host "RESTART BOTH DEV WINDOWS for this to take effect." -ForegroundColor Yellow
Write-Host "  ts-node-dev watches source files, not .env, so the API will not"
Write-Host "  pick this up on its own. Ctrl+C and re-run in each window:"
Write-Host "    PMS API (3000)   npm run start:dev      (repo root)"
Write-Host "    PMS Web (3001)   npm run dev            (in web-admin/)"
Write-Host ""
Write-Host "The database is untouched - same agency, same 500 units, same history."
Write-Host ""
if ($Profile -eq 'onsite_backoffice') {
  Write-Host "In this mode:"
  Write-Host "  Listings and Applications leave the menu"
  Write-Host "  Tenant and landlord sign-in are REFUSED by the API"
  Write-Host "  Public listings endpoints return 403"
  Write-Host "  Staff sign-in is unaffected"
} else {
  Write-Host "In this mode: everything is served."
}
Write-Host ""
Write-Host "Demo console: http://localhost:3001/demo"
