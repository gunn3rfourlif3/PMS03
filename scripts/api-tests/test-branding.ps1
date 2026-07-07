# Verifies the public white-label endpoint + authenticated self-service edit.
# Mirrors what every app does at boot (GET /branding/:slug) and the web
# Settings page (GET/PUT /settings/branding).
. "$PSScriptRoot/_lib.ps1"

Write-Section 'Public branding (no auth) - what the apps fetch at startup'
Step 'GET /branding/demo'    { Invoke-Api GET '/branding/demo' } -Show    | Out-Null
Step 'GET /branding/rivonia' { Invoke-Api GET '/branding/rivonia' } -Show | Out-Null

Write-Section 'Self-service branding (owner) - what the web Settings page does'
$o = Require-Token -Role 'owner' -Destination 'owner@demo.test'
Step 'GET /settings/branding'  { Invoke-Api GET '/settings/branding' -Token $o }
$before = Invoke-Api GET '/settings/branding' -Token $o
Step 'PUT /settings/branding (tagline)' {
  Invoke-Api PUT '/settings/branding' -Token $o -Body @{ tagline = "Tested $(Get-Date -Format o)" }
} -Show | Out-Null
Step 'PUT /settings/branding (restore)' {
  Invoke-Api PUT '/settings/branding' -Token $o -Body @{ tagline = $before.tagline }
} | Out-Null
