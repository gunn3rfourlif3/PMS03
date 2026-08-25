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
for k in IKHOKHA_APP_ID IKHOKHA_APP_SECRET IKHOKHA_ENTITY_ID IKHOKHA_CALLBACK_URL; do
  v="$(envv "$k")"
  if [ -n "$v" ]; then
    case "$k" in
      *SECRET) ok "$k" "set (${#v} chars)" ;;
      *)       ok "$k" "$v" ;;
    esac
  else
    bad "$k" "EMPTY — checkout will fall back to the dev stub and no money moves"
  fi
done

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
