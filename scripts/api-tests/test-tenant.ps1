# Tenant app journey (default: thabo@demo.test on the 'demo' vendor).
# Exercises every endpoint the tenant screens call:
#   login -> profile -> invoices -> lease -> file maintenance ticket ->
#   my tickets -> initiate payment on the due invoice.
param([string]$Email = 'thabo@demo.test')
. "$PSScriptRoot/_lib.ps1"

$t = Require-Token -Role 'tenant' -Destination $Email

Write-Section 'Home / Profile'
Step 'GET /me/profile'  { Invoke-Api GET '/me/profile'  -Token $t } -Show | Out-Null

Write-Section 'Pay tab'
$invoices = Step 'GET /me/invoices' { Invoke-Api GET '/me/invoices' -Token $t }
$due = $invoices | Where-Object { $_.status -ne 'paid' -and $_.status -ne 'void' } | Select-Object -First 1
if ($due) {
  Step "POST /payments/invoices/$($due.id)/initiate" {
    Invoke-Api POST "/payments/invoices/$($due.id)/initiate" -Token $t -Body @{ method = 'eft' }
  } -Show | Out-Null
} else {
  Write-Host '  (no outstanding invoice to pay)' -ForegroundColor DarkGray
}

Write-Section 'Docs tab'
$lease = Step 'GET /me/lease' { Invoke-Api GET '/me/lease' -Token $t } -Show

Write-Section 'Maintenance (Log ticket)'
if ($lease -and $lease.unitId) {
  Step 'POST /maintenance/tickets' {
    Invoke-Api POST '/maintenance/tickets' -Token $t -Body @{
      unitId = $lease.unitId; category = 'plumbing'; description = 'Script test: leaking tap'; priority = 'high'
    }
  } -Show | Out-Null
} else {
  Write-Host '  (no active lease -> cannot file a ticket)' -ForegroundColor DarkGray
}
Step 'GET /maintenance/tickets/mine' { Invoke-Api GET '/maintenance/tickets/mine' -Token $t } -Show | Out-Null

Write-Host ''
Write-Host 'Tenant journey complete.' -ForegroundColor Green
