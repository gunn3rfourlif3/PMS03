#!/usr/bin/env bash
# Can a first live subscription charge actually succeed? Read-only — this
# changes nothing, it only reports.
#
# Locare has never taken a real payment. The invoice → checkout → gateway →
# webhook → reconcile → accrual → payout chain is fully built and entirely
# untested against real money, and three separate features (commission accrual,
# the partner leaderboard, the payout run) all read a column that has never had
# a real row in it. This checks the preconditions before that changes.
#
#   ./deploy/money-path-preflight.sh
#
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f $DIR/compose.prod.yml --env-file $DIR/.env.prod"
ENV_FILE="$DIR/.env.prod"

q() { $COMPOSE exec -T postgres psql -U pms -d pms -tAc "$1" 2>/dev/null | tr -d '\r'; }
envv() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//' | xargs; }

FAIL=0; WARN=0
ok()   { printf "  \033[32m✓\033[0m %-42s %s\n" "$1" "${2:-}"; }
bad()  { printf "  \033[31m✗\033[0m %-42s %s\n" "$1" "${2:-}"; FAIL=1; }
warn() { printf "  \033[33m!\033[0m %-42s %s\n" "$1" "${2:-}"; WARN=1; }

echo
echo "── Gateway credentials ──────────────────────────────────"
# Only APP_ID and APP_SECRET gate the real API call: IkhokhaPaymentProvider
# .collect() returns the dev stub on `!appId || !secret` and nothing else.
# An earlier draft of this script marked a blank ENTITY_ID as blocking. It is
# not — it is free-text and falls back to the vendor id — and reporting a
# working configuration as BLOCKED is worse than not checking it at all.
for k in IKHOKHA_APP_ID IKHOKHA_APP_SECRET IKHOKHA_CALLBACK_URL; do
  v="$(envv "$k")"
  if [ -n "$v" ]; then
    case "$k" in
      *SECRET) ok "$k" "set (${#v} chars)" ;;
      *)       ok "$k" "$v" ;;
    esac
  else
    bad "$k" "EMPTY — collect() returns the dev stub and no money moves"
  fi
done

EID="$(envv IKHOKHA_ENTITY_ID)"
[ -n "$EID" ] && ok "IKHOKHA_ENTITY_ID" "$EID" \
  || warn "IKHOKHA_ENTITY_ID" "blank — falls back to the vendor id. Works, but the reference iKhokha shows you is a uuid rather than something you can read"

PROVIDER="$(envv PAYMENT_PROVIDER)"
[ "$PROVIDER" = "ikhokha" ] && ok "PAYMENT_PROVIDER" "$PROVIDER" \
  || warn "PAYMENT_PROVIDER" "$PROVIDER (expected ikhokha)"

MODE="$(envv IKHOKHA_VERIFY_CALLBACK)"
case "$MODE" in
  enforce|true) ok "IKHOKHA_VERIFY_CALLBACK" "$MODE — signatures rejected if invalid" ;;
  monitor)      warn "IKHOKHA_VERIFY_CALLBACK" "monitor — verifies and logs, still processes. Flip to 'enforce' after you see 'IK-SIGN verified' on a real callback" ;;
  *)            bad "IKHOKHA_VERIFY_CALLBACK" "'$MODE' — inbound callbacks are unverified, anyone who guesses a ref can mark an invoice paid" ;;
esac

# The callback must be reachable from outside; iKhokha signs over its path, so a
# mismatch here fails the signature even when the secret is right.
CB="$(envv IKHOKHA_CALLBACK_URL)"
if [ -n "$CB" ]; then
  # Wait for the API to finish booting before probing.
  #
  # `docker compose up -d` returns as soon as the container has STARTED, not
  # when Nest is listening — so running this straight after a recreate gets a
  # 502 from Caddy and reports a healthy deployment as broken. That happened
  # twice and cost real time chasing a fault that did not exist.
  HEALTH="$(echo "$CB" | sed 's#\(https\?://[^/]*\).*#\1#')/api/health"
  for _ in $(seq 1 20); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH")" = "200" ] && break
    sleep 2
  done

  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$CB" -H 'Content-Type: application/json' -d '{}' || echo 000)
  case "$CODE" in
    000) bad  "callback reachable"  "no response from $CB" ;;
    404) ok   "callback reachable"  "HTTP 404 — route is live and rejected an unknown ref, which is correct" ;;
    401) ok   "callback reachable"  "HTTP 401 — route is live and enforcing signatures" ;;
    *)   warn "callback reachable"  "HTTP $CODE (expected 404 or 401 for an empty body)" ;;
  esac
fi

echo
echo "── Who would be billed ──────────────────────────────────"
PERIOD=$(date +%Y-%m)
ROWS=$(q "SELECT vendor_name(vendor_id)||' | '||tier||' | units='||unit_count||' | list='||mrr||' | override='||COALESCE(price_override::text,'-')||' | until='||COALESCE(price_override_until::text,'-')||' | '||status
            FROM vendor_subscriptions ORDER BY 1;")
if [ -z "$ROWS" ]; then
  bad "vendor_subscriptions" "no rows — nothing would be invoiced"
else
  echo "$ROWS" | sed 's/^/      /'
fi

BILLABLE=$(q "SELECT count(*) FROM vendor_subscriptions
               WHERE status='active'
                 AND (mrr > 0 OR price_override IS NOT NULL);")
[ "${BILLABLE:-0}" -gt 0 ] && ok "billable agencies" "$BILLABLE" \
  || bad "billable agencies" "0 — generate() would produce nothing"

# Grandfathering (§7.2). An agency whose live price equals the ladder price is
# either genuinely on list, or has lost an override nobody noticed.
OVERRIDES=$(q "SELECT count(*) FROM vendor_subscriptions WHERE price_override IS NOT NULL;")
if [ "${OVERRIDES:-0}" -gt 0 ]; then
  ok "negotiated prices on file" "$OVERRIDES"
  q "SELECT '      '||vendor_name(vendor_id)||' pays '||price_override||' (list '||mrr||') — '||COALESCE(price_override_reason,'NO REASON RECORDED')
       FROM vendor_subscriptions WHERE price_override IS NOT NULL;"
else
  warn "negotiated prices on file" "none — check Dantalan is meant to be on list price (commission structure §7.2 grandfathers them at R925)"
fi

# Band cliffs. Pricing is flat per band, so crossing 12→13 units takes an
# agency from R925 to R2,660 — a 188% rise, applied automatically by the next
# unit anyone adds. That is a conversation to have before the invoice, not
# after, so surface anyone sitting within two units of a boundary.
NEAR=$(q "SELECT vendor_name(vendor_id)||' is on '||unit_count||' units ('||tier||', '||mrr||') — '||
                 CASE WHEN unit_count BETWEEN 11 AND 12 THEN 'unit 13 moves them to Growth at 2660'
                      WHEN unit_count BETWEEN 363 AND 364 THEN 'unit 365 moves them to Scale at 6014'
                 END
            FROM vendor_subscriptions
           WHERE unit_count BETWEEN 11 AND 12 OR unit_count BETWEEN 363 AND 364;")
if [ -n "$NEAR" ]; then
  echo
  echo "── Approaching a price band ─────────────────────────────"
  echo "$NEAR" | while read -r l; do warn "band cliff" "$l"; done
fi

echo
echo "── This period ──────────────────────────────────────────"
EXISTING=$(q "SELECT count(*) FROM subscription_invoices WHERE period = '$PERIOD';")
ok "invoices for $PERIOD" "${EXISTING:-0}"
q "SELECT '      '||vendor_name(vendor_id)||' | '||amount||' | '||status||' | ref='||COALESCE(gateway_ref,'-')
     FROM subscription_invoices WHERE period = '$PERIOD';"

EVERPAID=$(q "SELECT count(*) FROM subscription_invoices WHERE status='paid' AND paid_at IS NOT NULL;")
if [ "${EVERPAID:-0}" -gt 0 ]; then
  ok "subscription invoices ever paid" "$EVERPAID"
else
  warn "subscription invoices ever paid" "0 — commission accrual, the leaderboard and the payout run have never seen real data"
fi

echo
echo "── Downstream readers ───────────────────────────────────"
for fn in partner_leaderboard payment_vendor_by_ref vendor_name; do
  n=$(q "SELECT count(*) FROM pg_proc WHERE proname='$fn';")
  [ "${n:-0}" -gt 0 ] && ok "$fn()" "present" || bad "$fn()" "MISSING — migrations not run?"
done
V=$(q "SELECT count(*) FROM pg_views WHERE viewname='partner_collected_monthly';")
[ "${V:-0}" -gt 0 ] && ok "partner_collected_monthly view" "present" || bad "partner_collected_monthly view" "MISSING"

PENDING=$(q "SELECT count(*) FROM migrations;")
ok "migrations applied" "${PENDING:-?}"

echo
echo "─────────────────────────────────────────────────────────"
if [ "$FAIL" = 1 ]; then
  echo "BLOCKED — fix the ✗ items before attempting a live charge."
  exit 1
elif [ "$WARN" = 1 ]; then
  echo "READY, with warnings. Read the ! lines before you proceed."
else
  echo "READY."
fi
