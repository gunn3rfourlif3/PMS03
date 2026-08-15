<#
.SYNOPSIS
  Voiceover with the built-in Windows voice. No API key, no account, offline.

.DESCRIPTION
  A stand-in for tts.mjs. It writes the same docs/video/vo/<beat>.wav files, so
  assemble.sh picks them up with no changes and the cut is timed to the words.

  It sounds like Windows, because it is Windows. Use it to check pacing, mix and
  wording; regenerate with ElevenLabs before anyone outside sees the video:

      $env:ELEVENLABS_API_KEY="sk_..."
      $env:FORCE="1"                  # overwrite these placeholder files
      node scripts/video/tts.mjs

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/video/tts-windows.ps1
#>
[CmdletBinding()]
param(
  # SAPI "Desktop" voices (Hazel Desktop, Zira Desktop) are already slow and
  # flat, so the negative rate that suits a neural voice made them a dirge.
  # 1 is about right for these; drop to 0 if it clips your ear.
  [int]$Rate = 1,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Leaf | Out-Null
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$OutDir = Join-Path $Root 'docs\video\vo'
$Script = Join-Path $PSScriptRoot 'narration.json'

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = $Rate

# Prefer a female voice, and specifically NOT a "Desktop" one. The Desktop
# variants (Hazel Desktop, Zira Desktop) are the legacy low-sample-rate engines
# and sound noticeably more sluggish than their modern namesakes.
$installed = $synth.GetInstalledVoices() |
  Where-Object { $_.Enabled } |
  ForEach-Object { $_.VoiceInfo }
$female = $installed | Where-Object { $_.Gender -eq 'Female' }
$pick = ($female | Where-Object { $_.Name -notmatch 'Desktop' } | Select-Object -First 1)
if (-not $pick) { $pick = $female | Select-Object -First 1 }

if ($pick) {
  $synth.SelectVoice($pick.Name)
  if ($pick.Name -match 'Desktop') {
    Write-Host '  only a legacy "Desktop" voice is available — it will sound flat' -ForegroundColor Yellow
    Write-Host '  Settings > Time & language > Speech > Manage voices adds better ones' -ForegroundColor DarkGray
  }
} else {
  Write-Host '  no female voice installed — using the system default' -ForegroundColor Yellow
}
Write-Host ("`nSynthesising as {0} (rate {1})`n" -f $synth.Voice.Name, $Rate)

$lines = Get-Content $Script -Raw | ConvertFrom-Json

# Same phonetic respellings tts.mjs uses — audio only, captions untouched.
$say = @{}
if ($lines.PSObject.Properties.Name -contains '_pronounce') {
  foreach ($p in $lines._pronounce.PSObject.Properties) { $say[$p.Name] = [string]$p.Value }
}
function ConvertTo-Speakable([string]$t) {
  foreach ($k in $say.Keys) { $t = [regex]::Replace($t, "\b$k\b", $say[$k], 'IgnoreCase') }
  return $t
}
$hasFfmpeg = [bool](Get-Command ffmpeg -ErrorAction SilentlyContinue)
$count = 0

foreach ($p in $lines.PSObject.Properties) {
  if ($p.Name.StartsWith('_')) { continue }
  $text = [string]$p.Value
  if ([string]::IsNullOrWhiteSpace($text)) { continue }

  $wav = Join-Path $OutDir ($p.Name + '.wav')
  if ((Test-Path $wav) -and -not $Force) {
    Write-Host ("  = {0} (exists)" -f $p.Name)
    continue
  }

  # Render at the engine's OWN rate, not 48kHz.
  #
  # Asking SAPI for 48kHz doesn't make it synthesise at 48kHz — these voices are
  # natively 16kHz, so Windows upsamples with a cheap resampler and the mirrored
  # image of the voice folds back in as broadband hiss. Measured: a noise floor
  # of -38dB, with as much energy in the 8-16kHz band as in the speech band.
  # Letting ffmpeg do the rate conversion with soxr removes it.
  $raw = [System.IO.Path]::ChangeExtension($wav, '.raw.wav')
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)

  $synth.SetOutputToWaveFile($raw, $fmt)
  $synth.Speak((ConvertTo-Speakable $text))
  $synth.SetOutputToNull()

  if ($hasFfmpeg) {
    # soxr for the resample; the lowpass discards the empty band above the
    # engine's ceiling so nothing up there can ring.
    & ffmpeg -y -loglevel error -i $raw `
      -af 'aresample=resampler=soxr:precision=28:out_sample_rate=48000,lowpass=f=7600,highpass=f=80,dynaudnorm=p=0.9:m=6' `
      -ar 48000 -ac 1 -c:a pcm_s16le $wav
    Remove-Item $raw -ErrorAction SilentlyContinue
  } else {
    Move-Item $raw $wav -Force
    Write-Host '  ffmpeg not found — WAV left at 16kHz (assembler will resample)' -ForegroundColor Yellow
  }

  $secs = ''
  if ($hasFfmpeg) {
    $secs = (& ffprobe -v error -show_entries format=duration -of csv=p=0 $wav) -as [double]
    $secs = '{0:N1}s' -f $secs
  }
  $preview = if ($text.Length -gt 52) { $text.Substring(0, 52) + '…' } else { $text }
  Write-Host ("  + {0}  {1}  ""{2}""" -f $p.Name, $secs, $preview)
  $count++
}

$synth.Dispose()
Write-Host ("`n{0} lines written to docs\video\vo\" -f $count)
Write-Host "Now run: npm run video -- -SkipRecord`n"
