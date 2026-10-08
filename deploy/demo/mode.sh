#!/usr/bin/env bash
# Switch the demo stack between the three on-site options.
#
#   ./deploy/demo/mode.sh a      # On-site, back office  (sealed)
#   ./deploy/demo/mode.sh b      # On-site, connected
#   ./deploy/demo/mode.sh c      # Private server        (the default)
#   ./deploy/demo/mode.sh        # report the live mode and stop
#
# SWITCHING DOES NOT RESEED. Only demo-api and demo-web are recreated, with
# --no-deps, so demo-postgres is never touched and the Midnight Masquerade world
# — twelve months of invoices, the arrears, the story records — survives every
# switch. Reseeding mid-demo would be slow and would reset the dates the room
# just looked at.
#
# No rebuild either: the mode is read at request time, not baked into the image
# (web-admin's root layout is already force-dynamic), so one built image serves
# all three. A switch is a container restart, a few seconds.
set -euo pipefail

cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -p demo -f deploy/demo/compose.demo.yml --env-file deploy/demo/.env.demo)
ENV_FILE=deploy/demo/.env.demo

case "${1:-}" in
  a|A|onsite_backoffice) PROFILE=onsite_backoffice ;;
  b|B|onsite_connected)  PROFILE=onsite_connected ;;
  c|C|private_server)    PROFILE=private_server ;;
  "")
    echo "Live mode:"
    "${COMPOSE[@]}" exec -T demo-api printenv DEPLOYMENT_PROFILE 2>/dev/null \
      || echo "  (stack not running)"
    exit 0
    ;;
  *)
    echo "Unknown mode '$1'. Use a, b or c." >&2
    exit 1
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE. Copy .env.demo.example and fill it in first." >&2
  exit 1
fi

# Rewrite the one line, leaving every other secret alone.
if grep -q '^DEPLOYMENT_PROFILE=' "$ENV_FILE"; then
  sed -i "s/^DEPLOYMENT_PROFILE=.*/DEPLOYMENT_PROFILE=$PROFILE/" "$ENV_FILE"
else
  printf '\nDEPLOYMENT_PROFILE=%s\n' "$PROFILE" >> "$ENV_FILE"
fi

echo "Switching the demo stack to $PROFILE…"
# --no-deps is the whole safety of this script: without it compose would also
# recreate demo-postgres, and the demo's data is in that container's volume.
"${COMPOSE[@]}" up -d --no-deps demo-api demo-web

echo
echo "Now running: $PROFILE"
echo "  app.demo.locare.co.za        back office (all modes)"
case "$PROFILE" in
  onsite_backoffice)
    echo "  tenant.demo.locare.co.za     served, but sign-in is REFUSED by the API"
    echo "  landlord.demo.locare.co.za   served, but sign-in is REFUSED by the API"
    echo "  public listings              refused"
    ;;
  *)
    echo "  tenant.demo.locare.co.za     tenant app"
    echo "  landlord.demo.locare.co.za   landlord app"
    echo "  public listings              served"
    ;;
esac
echo "  mail.demo.locare.co.za       Mailpit — every message this stack sends"
echo
echo "The demo console is at /demo on the back office."
