#!/usr/bin/env bash
# Set, or report, the deployment mode. Linux port of demo-mode.ps1.
#
#   ./scripts/demo-mode.sh        report both files and whether they agree
#   ./scripts/demo-mode.sh a      sealed on-site back office
#   ./scripts/demo-mode.sh b|c    connected / private server
set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(dirname "$SCRIPT_DIR")
LIB="$SCRIPT_DIR/lib/envfile.sh"
# A hard stop, not a warning. Without the helpers every config check reads
# "unset" and the script confidently tells you to fix files that are correct.
[ -r "$LIB" ] || { printf 'Cannot read %s\n' "$LIB" >&2; exit 1; }
# shellcheck source=lib/envfile.sh
. "$LIB"

API_ENV="$ROOT/.env"
WEB_ENV="$ROOT/web-admin/.env.local"
MODE=${1:-}

if [ -z "$MODE" ]; then
  api=$(env_get "$API_ENV" DEPLOYMENT_PROFILE); api=${api:-'(unset -> private_server)'}
  web=$(env_get "$WEB_ENV" DEPLOYMENT_PROFILE); web=${web:-'(unset -> private_server)'}
  printf 'API  (.env)                 %s\n' "$api"
  printf 'Web  (web-admin/.env.local) %s\n' "$web"
  if [ "$api" != "$web" ]; then
    printf '\nThese disagree. The API wins on what is ALLOWED; the web decides what is SHOWN.\n'
    printf 'Run this script with a mode to put them back in step.\n'
  fi
  exit 0
fi

case "${MODE,,}" in
  a|onsite_backoffice) PROFILE=onsite_backoffice; LABEL='A - On-site, back office (sealed)' ;;
  b|onsite_connected)  PROFILE=onsite_connected;  LABEL='B - On-site, connected' ;;
  c|private_server)    PROFILE=private_server;    LABEL='C - Private server' ;;
  *) printf "Unknown mode '%s'. Use a, b or c.\n" "$MODE" >&2; exit 1 ;;
esac

env_set "$API_ENV" DEPLOYMENT_PROFILE "$PROFILE"
env_set "$WEB_ENV" DEPLOYMENT_PROFILE "$PROFILE"
env_set "$WEB_ENV" DEMO_CONSOLE 1

cat <<MSG

Mode set to: $LABEL

RESTART BOTH DEV PROCESSES for this to take effect.
  ts-node-dev watches source files, not .env, so the API will not pick this
  up on its own. In the tmux session: Ctrl+C in each window and re-run.
    api   npm run start:dev      (repo root)
    web   npm run dev            (in web-admin/)

The database is untouched - same agency, same 500 units, same history.
MSG

if [ "$PROFILE" = onsite_backoffice ]; then
  cat <<'MSG'

In this mode:
  Listings and Applications leave the menu
  Tenant and landlord sign-in are REFUSED by the API
  Public listings endpoints return 403
  Staff sign-in is unaffected
MSG
else
  printf '\nIn this mode: everything is served.\n'
fi
printf '\nDemo console: http://localhost:3001/demo\n'
