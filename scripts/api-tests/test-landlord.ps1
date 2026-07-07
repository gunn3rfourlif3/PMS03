# Landlord/agency journey (default: owner@demo.test).
# Exercises the dashboard, approvals, maintenance lifecycle, and owner statements:
#   login -> rent-roll/arrears/collection/tickets -> assign+start+complete a
#   ticket -> applications -> generate + list an owner statement.
param([string]$Email = 'owner@demo.test', [string]$Period = (Get-Date).ToString('yyyy-MM'))
. "$PSScriptRoot/_lib.ps1"

$o = Require-Token -Role 'owner' -Destination $Email

Write-Section 'Dashboard'
Step 'GET /reporting/rent-roll'          { Invoke-Api GET '/reporting/rent-roll' -Token $o } -Show | Out-Null
Step 'GET /reporting/arrears'            { Invoke-Api GET '/reporting/arrears' -Token $o } -Show | Out-Null
Step "GET /reporting/collection/$Period" { Invoke-Api GET "/reporting/collection/$Period" -Token $o } -Show | Out-Null

Write-Section 'Maintenance lifecycle'
$tickets = Step 'GET /maintenance/tickets' { Invoke-Api GET '/maintenance/tickets' -Token $o }
$open = $tickets | Where-Object { $_.status -eq 'open' } | Select-Object -First 1
if ($open) {
  $wo = Step "POST /maintenance/tickets/$($open.id)/work-order (assign)" {
    Invoke-Api POST "/maintenance/tickets/$($open.id)/work-order" -Token $o -Body @{}
  }
  if ($wo) {
    Step "POST /maintenance/work-orders/$($wo.id)/progress (start)" {
      Invoke-Api POST "/maintenance/work-orders/$($wo.id)/progress" -Token $o
    } | Out-Null
    Step "POST /maintenance/work-orders/$($wo.id)/complete (cost 650)" {
      Invoke-Api POST "/maintenance/work-orders/$($wo.id)/complete" -Token $o -Body @{ cost = 650 }
    } -Show | Out-Null
  }
} else {
  Write-Host '  (no OPEN ticket - run ./test-tenant.ps1 first to create one)' -ForegroundColor DarkGray
}

Write-Section 'Approvals'
Step 'GET /listings/applications' { Invoke-Api GET '/listings/applications' -Token $o } | Out-Null

Write-Section 'Owner statements'
$owners = Step 'GET /owners' { Invoke-Api GET '/owners' -Token $o }
if ($owners -and $owners.Count -gt 0) {
  $ownerId = $owners[0].id
  Step "POST /owners/$ownerId/statements/$Period (generate)" {
    Invoke-Api POST "/owners/$ownerId/statements/$Period" -Token $o
  } -Show | Out-Null
  Step "GET /owners/$ownerId/statements (history)" {
    Invoke-Api GET "/owners/$ownerId/statements" -Token $o
  } -Show | Out-Null
} else {
  Write-Host '  (no owners yet - add one in the web back-office)' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'Landlord journey complete.' -ForegroundColor Green
