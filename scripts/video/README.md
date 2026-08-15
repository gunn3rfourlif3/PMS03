# Automated video pipeline

Records the Locare marketing video from the real product and assembles three
cuts. Rerun it whenever the UI changes so the video never drifts out of date —
that staleness is the main reason hand-captured product videos quietly become
lies within a few months.

```
scripts/video/
  make-video.ps1     orchestrator — stack up, record, assemble, tear down
  video.config.json  environment: URLs, login, which services to start
  beats.config.mjs   what to film — clicks, captions, timings  ← edit this
  narration.json     the voiceover script, one line per beat    ← edit this
  record.mjs         Playwright: drives the product, records 1080p clips
  tts.mjs            ElevenLabs: turns narration.json into docs/video/vo/*.wav
  assemble.sh        ffmpeg: normalise, burn captions, build cuts + crops
docs/video/
  brand-cards.html   animated intro/outro (recorded automatically)
  raw/               per-beat clips
  out/               finished files
  vo/                voiceover WAVs, one per beat (written by tts.mjs)
  music.mp3          optional; laid under at -18dB if present
.video/              service logs (api.log holds the OTP) — gitignored
```

## Once

```powershell
npm i -D playwright
npx playwright install chromium
winget install Gyan.FFmpeg      # then reopen the terminal so ffmpeg is on PATH
```

Docker Desktop must be running. That's the only thing the pipeline can't start
for you.

## Voiceover

Optional, but it changes the video from a screen recording into something that
sells. Write the script in `narration.json`, then:

```powershell
$env:ELEVENLABS_API_KEY="..."
node scripts/video/tts.mjs --voices     # pick one
$env:VOICE="Alice"
node scripts/video/tts.mjs
```

Each line's **spoken length becomes that beat's duration** in the edit. So you
retime the video by rewriting sentences, not by editing numbers — and picture
and voice cannot drift apart. Music ducks to -18dB underneath.

Delete a line from `narration.json` and that beat falls back to the duration in
the cut list, so you can voice part of the video and leave the rest silent.

None of the ElevenLabs premade voices are South African. Search the Voice
Library for one and set `VOICE` to its name or ID — worth doing before this goes
in front of SA agencies.

## Every time

```powershell
npm run video
```

That's it. The orchestrator brings up Docker, waits for Postgres, migrates,
seeds the Demo Agency, starts the API, web and Expo, waits for each to answer,
records every beat, assembles the cuts, and shuts down what it started.

Roughly four minutes cold, most of it Next and Expo compiling.

**Why it's unattended:** the API's stdout is tee'd to `.video/api.log`, so the
recorder reads the `[OTP] owner@demo.test -> 123456` line itself instead of
asking you. The code is only ever plaintext in that log — `otp_challenges`
stores it hashed — so this is the only way to automate a passwordless login
without weakening auth.

Flags for when something needs a human:

```powershell
npm run video -- -SkipRecord      # bring the stack up, leave it, fix selectors by hand
npm run video -- -SkipAssemble    # record clips only
npm run video -- -KeepRunning     # don't shut the services down afterwards
```

## Running the pieces separately

```powershell
.\scripts\start-all.ps1 -Setup    # stack in visible windows
node scripts/video/record.mjs     # prompts for the OTP if no log is configured
bash scripts/video/assemble.sh
```

Output lands in `docs/video/out/`: 90s sales cut, 45s hero cut, 15s social cut,
plus 1:1 and 9:16 crops of the social cut.

## Environment

| Var | Default | Notes |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | Back-office origin |
| `TENANT_URL` | `http://localhost:8081` | Tenant app, for the phone beat |
| `LOGIN_EMAIL` | `owner@demo.test` | From the seed |
| `OTP` | — | Skip the prompt entirely |
| `OTP_CMD` | — | Command printing a log containing `[OTP] … -> code` |
| `DEBUG=1` | off | Reports selectors it couldn't find |

**Never point this at production.** It logs in, clicks around and films whatever
is on screen — against live data that means real tenant names and banking
details in a public marketing asset.

## Login

The product is passwordless and `otp_challenges` stores the code **hashed**, so
the only plaintext copy is the line the API prints when `OTP_CHANNEL=console`:

```
[OTP] owner@demo.test -> 482913
```

Locally that scrolls past in the API's own terminal window, which the recorder
can't read — so it pauses and asks you to type the code. One prompt per run.

To skip the prompt (CI, or a stack whose logs you can pipe):

```powershell
$env:OTP="482913"; node scripts/video/record.mjs
# or, if the API logs to a file or container:
$env:OTP_CMD="docker compose logs --tail=80 api"; node scripts/video/record.mjs
```

## When a beat breaks

Selectors are the fragile part, which is why they all live in
`beats.config.mjs`. A missing selector doesn't crash the run — the recorder
warns, skips the click and carries on, so you get a usable clip with one dead
beat rather than nothing.

```bash
DEBUG=1 node scripts/video/record.mjs
```

Fix the selector in the config and rerun. Prefer Playwright's `text=` engine
over CSS class chains; it survives restyling.

## Tuning the pacing

The first run will feel slightly off — it always does. Adjust the `wait` values
in `beats.config.mjs` and rerun; each cycle is about two minutes. Watch
`locare-15s.mp4` first, since it's the one you actually publish, and judge it
muted on a phone rather than full screen on a monitor.

`05-reconcile` is deliberately the longest beat. The payment landing and posting
itself to the ledger is the one thing no spreadsheet competitor can show — let
it breathe.

## Per-prospect demo videos

`BRANDS` in the config drives the white-label beat. Because branding resolves
from the host, you can point a beat at any agency's subdomain and generate a
demo video showing **their** logo and colours running on Locare. Sending a
prospect thirty seconds of their own brand on the product is a materially
stronger pitch than a generic reel, and it costs one command.

## What stays manual

Music selection and licensing, the final taste pass, and voiceover if you want
one. Everything else is in the two commands above.
