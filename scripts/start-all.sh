#!/usr/bin/env bash
# Start the whole PMS 0.3 stack. Linux port of start-all.ps1.
#
#   ./scripts/start-all.sh                 start API + web (+ Expo apps)
#   ./scripts/start-all.sh --setup         first run / after a pull
#   ./scripts/start-all.sh --no-mobile     skip the two Expo apps
#   ./scripts/start-all.sh --no-kill       leave 3000/3001/8081/8082 alone
#
# WHAT IS DIFFERENT FROM THE WINDOWS SCRIPT. There is no window per service;
# tmux gives the same thing (a pane you can read and Ctrl+C) and survives the
# terminal closing. Without tmux the services run in the background and log to
# files, which is worse to watch but still works unattended.
#
# `Invoke-Native` has no equivalent here and needs none: that wrapper exists
# because PowerShell turns a native command's stderr into a terminating error.
# Bash does not, so exit codes are simply checked.
set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(dirname "$SCRIPT_DIR")
WEB="$ROOT/web-admin"; TEN="$ROOT/mobile-tenant"; LAND="$ROOT/mobile-landlord"
LIB="$SCRIPT_DIR/lib/envfile.sh"
# A hard stop, not a warning. Without the helpers every config check reads
# "unset" and the script confidently tells you to fix files that are correct.
[ -r "$LIB" ] || { printf 'Cannot read %s\n' "$LIB" >&2; exit 1; }
# shellcheck source=lib/envfile.sh
. "$LIB"

SETUP=0; NO_MOBILE=0; NO_KILL=0
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=1 ;;
    --no-mobile) NO_MOBILE=1 ;;
    --no-kill) NO_KILL=1 ;;
    *) printf "Unknown option '%s'. Use --setup, --no-mobile, --no-kill.\n" "$arg" >&2; exit 1 ;;
  esac
done

printf 'PMS 0.3 launcher\nroot: %s\n' "$ROOT"

# ── 1. Infra ───────────────────────────────────────────────────────────────
# Fail loudly rather than limping on: without Postgres and Redis the API
# retries forever and the real cause scrolls out of view.
printf '\nStarting Docker (Postgres :5433, Redis :6380)...\n'
if ! docker info >/dev/null 2>&1; then
  cat >&2 <<'MSG'

Docker is not available.
  systemd:  sudo systemctl start docker
  rootless: systemctl --user start docker
  Then check your user is in the docker group:  id -nG | grep -q docker
MSG
  exit 1
fi

if ! docker compose -f "$ROOT/docker-compose.yml" up -d; then
  printf "\n'docker compose up -d' failed - see the output above.\n" >&2
  exit 1
fi

# Postgres accepts TCP before it is ready for queries; wait for real readiness
# so migrations and the seed do not race the container.
printf 'Waiting for Postgres'
ready=0
for _ in $(seq 1 30); do
  if docker compose -f "$ROOT/docker-compose.yml" exec -T postgres pg_isready -U pms >/dev/null 2>&1; then
    ready=1; break
  fi
  printf '.'; sleep 1
done
if [ "$ready" -eq 1 ]; then printf ' ready\n'; else
  printf '\nPostgres did not become ready in 30s. Check: docker compose logs postgres\n' >&2
  exit 1
fi

# ── 2. Free ports ──────────────────────────────────────────────────────────
if [ "$NO_KILL" -eq 0 ]; then
  printf '\nFreeing ports...\n'
  free_port 3000; free_port 3001
  [ "$NO_MOBILE" -eq 0 ] && { free_port 8081; free_port 8082; }
fi

# ── 3. Setup ───────────────────────────────────────────────────────────────
if [ "$SETUP" -eq 1 ]; then
  printf '\nSetup: installing deps, migrating, seeding...\n'
  ( cd "$ROOT" && npm install ) || exit 1
  ( cd "$ROOT" && npm run migration:run ) || exit 1

  # The app connects as pms_app, which is a ROLE, not a table - migrations do
  # not create it, so `docker compose down -v` leaves a database the API cannot
  # log into, and the failure only surfaces at sign-in because the seeds
  # connect as the owner. Must run AFTER the migrations: it grants on tables
  # that have to exist. Safe to repeat.
  printf 'Ensuring the pms_app role...\n'
  if ! docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
        psql -U pms -d pms -v ON_ERROR_STOP=1 < "$ROOT/scripts/setup-app-role.sql"; then
    cat >&2 <<'MSG'

Could not create the pms_app role - sign-in will fail.
Run it by hand and read the error:
  docker compose exec -T postgres psql -U pms -d pms < scripts/setup-app-role.sql
MSG
    exit 1
  fi

  ( cd "$ROOT" && npm run seed ) || exit 1
  ( cd "$WEB" && npm install ) || exit 1
  if [ "$NO_MOBILE" -eq 0 ]; then
    for app in "$TEN" "$LAND"; do
      ( cd "$app" && npm install \
        && npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans ) || exit 1
    done
  fi
fi

# ── 4. Launch ──────────────────────────────────────────────────────────────
printf '\nLaunching apps...\n'
if command -v tmux >/dev/null 2>&1; then
  # An existing session would leave a second API fighting for 3000, so it goes.
  tmux has-session -t pms 2>/dev/null && {
    printf '  replacing the existing tmux session\n'; tmux kill-session -t pms; }
  tmux new-session  -d -s pms -n api -c "$ROOT" 'npm run start:dev'
  sleep 2
  tmux new-window   -t pms    -n web -c "$WEB"  'npm run dev'
  if [ "$NO_MOBILE" -eq 0 ]; then
    tmux new-window -t pms -n tenant   -c "$TEN"  'npx expo start --port 8081'
    tmux new-window -t pms -n landlord -c "$LAND" 'npx expo start --port 8082'
  fi
  LAUNCHED='tmux attach -t pms      (Ctrl+B then N to cycle windows)'
else
  LOGS="${TMPDIR:-/tmp}/pms-logs"; mkdir -p "$LOGS"
  ( cd "$ROOT" && nohup npm run start:dev >"$LOGS/api.log" 2>&1 & )
  sleep 2
  ( cd "$WEB"  && nohup npm run dev       >"$LOGS/web.log" 2>&1 & )
  if [ "$NO_MOBILE" -eq 0 ]; then
    ( cd "$TEN"  && nohup npx expo start --port 8081 >"$LOGS/tenant.log"   2>&1 & )
    ( cd "$LAND" && nohup npx expo start --port 8082 >"$LOGS/landlord.log" 2>&1 & )
  fi
  LAUNCHED="tmux not installed - logs in $LOGS (tail -f $LOGS/api.log)"
fi

cat <<MSG

Done.
  API      http://localhost:3000/api
  Web      http://localhost:3001
  $LAUNCHED

Logins (OTP prints in the api window unless OTP_CHANNEL=email):
  owner@demo.test         web console + landlord app
  thabo@demo.test         tenant app
  sipho@owner.demo.test   owner portal (/portal)
MSG
