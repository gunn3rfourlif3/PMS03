# Shared helpers for the API test scripts. Dot-source this from other scripts:
#   . "$PSScriptRoot/_lib.ps1"
#
# Base URL: override with  $env:PMS_API = 'http://host:3000/api'
$script:BaseUrl = if ($env:PMS_API) { $env:PMS_API } else { 'http://localhost:3000/api' }
$script:TokenDir = Join-Path $PSScriptRoot '.tokens'
New-Item -ItemType Directory -Force -Path $script:TokenDir | Out-Null

function Write-Section([string]$Title) {
  Write-Host ''
  Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Get-Token([string]$Role) {
  $f = Join-Path $script:TokenDir "$Role.jwt"
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() }
  return $null
}
function Save-Token([string]$Role, [string]$Token) {
  Set-Content -Path (Join-Path $script:TokenDir "$Role.jwt") -Value $Token -NoNewline
}

function Invoke-Api {
  param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    $Body,
    [string]$Token
  )
  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $params = @{
    Uri         = "$script:BaseUrl$Path"
    Method      = $Method
    Headers     = $headers
    ContentType = 'application/json'
  }
  if ($null -ne $Body) { $params['Body'] = ($Body | ConvertTo-Json -Depth 8) }
  try {
    return Invoke-RestMethod @params
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg) { $msg = $_.Exception.Message }
    throw "API $Method $Path failed: $msg"
  }
}

# Runs a labelled step; prints PASS/FAIL and (optionally) the JSON result.
function Step {
  param([string]$Name, [scriptblock]$Action, [switch]$Show)
  try {
    $result = & $Action
    Write-Host ("  [PASS] " + $Name) -ForegroundColor Green
    if ($Show -and $null -ne $result) {
      ($result | ConvertTo-Json -Depth 6) -split "`n" | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkGray }
    }
    return $result
  } catch {
    Write-Host ("  [FAIL] " + $Name + " -> " + $_.Exception.Message) -ForegroundColor Red
    return $null
  }
}

# Passwordless OTP login. Prompts for the code (it prints to the API console).
function Login-Otp {
  param([Parameter(Mandatory)][string]$Destination, [Parameter(Mandatory)][string]$Role)
  Invoke-Api -Method Post -Path '/auth/otp/request' -Body @{ destination = $Destination } | Out-Null
  Write-Host "OTP requested for $Destination - check the API server console for the code." -ForegroundColor Yellow
  $code = Read-Host 'Enter the OTP code'
  $resp = Invoke-Api -Method Post -Path '/auth/otp/verify' -Body @{ destination = $Destination; code = $code.Trim() }
  Save-Token -Role $Role -Token $resp.accessToken
  Write-Host "Logged in as $Destination (token cached as '$Role')." -ForegroundColor Green
  return $resp.accessToken
}

# Returns a cached token for the role, logging in if missing/forced.
function Require-Token {
  param([Parameter(Mandatory)][string]$Role, [Parameter(Mandatory)][string]$Destination, [switch]$Fresh)
  $t = if ($Fresh) { $null } else { Get-Token $Role }
  if (-not $t) { $t = Login-Otp -Destination $Destination -Role $Role }
  return $t
}

function Current-Period { (Get-Date).ToString('yyyy-MM') }
