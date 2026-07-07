# Runs the whole suite. Public branding needs no login; the tenant and landlord
# journeys each prompt for an OTP (printed to the API server console) unless a
# cached token is still valid.
. "$PSScriptRoot/_lib.ps1"
Write-Host "API base: $script:BaseUrl" -ForegroundColor Cyan
& "$PSScriptRoot/test-branding.ps1"
& "$PSScriptRoot/test-tenant.ps1"
& "$PSScriptRoot/test-landlord.ps1"
Write-Host ''
Write-Host 'All journeys done.' -ForegroundColor Green
