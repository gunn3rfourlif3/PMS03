# Log in and cache a token.  Usage:
#   ./login.ps1 -Email owner@demo.test -Role owner
#   ./login.ps1 -Email thabo@demo.test -Role tenant
param(
  [Parameter(Mandatory)][string]$Email,
  [string]$Role = 'user'
)
. "$PSScriptRoot/_lib.ps1"
Login-Otp -Destination $Email -Role $Role | Out-Null
Write-Host "Done. Other scripts will reuse this token until it expires." -ForegroundColor Green
