#!/usr/bin/env bash
# Bring up the Midnight Masquerade demo in one command. Linux port of demo-up.ps1.
#
#   ./scripts/demo-up.sh
#   ./scripts/demo-up.sh --seed --mode a
#
# PORTS ARE THE REASON THIS EXISTS. Running `npm run dev` by hand against a
# back office that is already running fails with EADDRINUSE and a stack trace
# that says nothing about the real problem. start-all.sh already frees
# 3000/3001, so this delegates rather than keeping a second copy of that logic.
set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(dirname "$SCRIPT_DIR")
LIB="$SCRIPT_DIR/lib/envfile.sh"
# A hard stop, not a warning. Without the helpers every config check reads
# "unset" and the script confidently tells you to fix files that are correct.
[ -r "$LIB" ] || { printf 'Cannot read %s\n' "$LIB" >&2; exit 1; }
# shellcheck source=lib/envfile.sh
. "$LIB"

SEED=0; MODE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --seed) SEED=1; shift ;;
    --mode) MODE=${2:-}; shift 2 ;;
    --mode=*) MODE=${1#*=}; shift ;;
    *) printf "Unknown option '%s'. Use --seed, --mode a|b|c.\n" "$1" >&2; exit 1 ;;
  esac
done

API_ENV="$ROOT/.env"
WEB_ENV="$ROOT/web-admin/.env.local"

printf '\nMidnight Masquerade demo\n'

# ── 1. Configuration ───────────────────────────────────────────────────────
# Every one of these has cost an evening at least once. Checked rather than
# assumed, and reported together so one run tells you everything that is wrong.
# A string, not an array: `${#arr[@]}` under `set -u` is an unbound-variable
# error on bash 4.2 (RHEL 7, and some appliance images), and this script is
# meant to run on whatever Linux a client puts in a cupboard.
problems=''
check() { # check FILE DISPLAY KEY WANT WHY
  local have; have=$(env_get "$1" "$3")
  [ "$have" = "$4" ] || problems="$problems  $2: $3 is '${have:-unset}', expected '$4' — $5\n"
}

check "$API_ENV" '.env'                  DEPLOYMENT_PROFILE      onsite_backoffice     'the sealed on-site mode'
check "$API_ENV" '.env'                  OTP_CHANNEL             email                 'codes go to Mailpit, not the API log'
check "$API_ENV" '.env'                  SMTP_HOST               localhost             'the Mailpit container'
check "$WEB_ENV" 'web-admin/.env.local'  DEPLOYMENT_THEME        dark                  'the dark console theme'
check "$WEB_ENV" 'web-admin/.env.local'  DEMO_CONSOLE            1                     '/demo renders'
check "$WEB_ENV" 'web-admin/.env.local'  NEXT_PUBLIC_VENDOR_SLUG midnight-masquerade   "localhost loads THEIR branding, not Locare's"
check "$WEB_ENV" 'web-admin/.env.local'  DEPLOYMENT_LOCALE       zh-Hans               'the language switcher offers Mandarin; unset means English alone and it hides'

if [ -n "$problems" ]; then
  printf '\nConfiguration is not demo-ready:\n'
  printf '%b' "$problems"
  printf '\nFix those two files and run this again. Nothing has been started.\n'
  exit 1
fi
printf '  configuration ok\n'

# ── 2. Mode, before anything starts ────────────────────────────────────────
if [ -n "$MODE" ]; then
  "$SCRIPT_DIR/demo-mode.sh" "$MODE" || exit 1
fi

# ── 3. Everything up ───────────────────────────────────────────────────────
if ! "$SCRIPT_DIR/start-all.sh" --no-mobile; then
  printf '\nThe launcher stopped - see above.\n' >&2
  exit 1
fi

# ── 4. The world ───────────────────────────────────────────────────────────
# After the stack is up: the seeder needs Postgres, and the API picks up the
# new rows on its next query. Branding is fetched per page load, so a browser
# refresh is enough to see new colours.
if [ "$SEED" -eq 1 ]; then
  printf '\nLoading the Midnight Masquerade world (a few minutes)...\n'
  if ! ( cd "$ROOT" && npm run seed:prospect -- midnight-masquerade ); then
    printf '\nThe seed failed - see above. The stack is running; the data may be incomplete.\n' >&2
    exit 1
  fi
fi

# ── 5. Where to go ─────────────────────────────────────────────────────────
cat <<'MSG'

Ready.
  Back office    http://localhost:3001
  Demo console   http://localhost:3001/demo
  Inbox          http://localhost:8025   (sign-in codes arrive here)

  Sign in as     yash@midnightmasquerade.demo

  Give the back office ~20s to compile on the first load.
MSG
[ "$SEED" -eq 0 ] && printf '  Portfolio empty or the wrong colours? Re-run with --seed.\n'
exit 0
