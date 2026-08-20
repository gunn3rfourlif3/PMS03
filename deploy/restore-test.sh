#!/usr/bin/env bash
# Prove a backup restores. Run monthly, and after any change to backup.sh.
#
# An untested backup is not a backup — it is a file that might be a backup. This
# restores the most recent dump into a THROWAWAY database alongside production,
# checks the data actually arrived, verifies RLS came back with it, and drops
# the copy. Production is never touched.
#
#   ./restore-test.sh                    # newest dump in ./backups
#   ./restore-test.sh path/to/dump.gz    # a specific one
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f $DIR/compose.prod.yml --env-file $DIR/.env.prod"
BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
TEST_DB="pms_restore_test_$(date +%s)"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP=$(ls -1t "$BACKUP_DIR"/pms-*.sql.gz 2>/dev/null | head -1 || true)
fi
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "FAIL: no backup found in $BACKUP_DIR"; exit 1; }

AGE_H=$(( ( $(date +%s) - $(date -r "$DUMP" +%s) ) / 3600 ))
SIZE=$(du -h "$DUMP" | cut -f1)
echo "Restoring: $DUMP  (${SIZE}, ${AGE_H}h old)"
[ "$AGE_H" -gt 48 ] && echo "  ⚠ WARNING: newest backup is over 48h old — is cron running?"

cleanup() {
  echo "Dropping $TEST_DB"
  $COMPOSE exec -T postgres psql -U pms -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating $TEST_DB"
$COMPOSE exec -T postgres psql -U pms -d postgres -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

echo "Loading dump..."
gunzip -c "$DUMP" | $COMPOSE exec -T postgres psql -U pms -d "$TEST_DB" -v ON_ERROR_STOP=1 -q >/dev/null

q() { $COMPOSE exec -T postgres psql -U pms -d "$TEST_DB" -tAc "$1" | tr -d '\r'; }
# Read-only, against LIVE production — used to compare the copy to the original.
qlive() { $COMPOSE exec -T postgres psql -U pms -d pms -tAc "$1" | tr -d '\r'; }

echo
echo "── Verification ─────────────────────────────────────────"

FAIL=0
check() { # name, actual, "gt N" | "eq X"
  local name="$1" actual="$2" op="$3" want="$4"
  local ok=1
  case "$op" in
    gt) [ "${actual:-0}" -gt "$want" ] || ok=0 ;;
    eq) [ "$actual" = "$want" ] || ok=0 ;;
  esac
  if [ "$ok" = 1 ]; then printf "  ✓ %-34s %s\n" "$name" "$actual"
  else printf "  ✗ %-34s %s (expected %s %s)\n" "$name" "$actual" "$op" "$want"; FAIL=1; fi
}

# 1. The schema arrived.
check "tables restored" "$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")" gt 20

# 2. Migrations arrived — a dump missing these restores a schema nobody can upgrade.
check "migrations recorded" "$(q "SELECT count(*) FROM migrations;")" gt 30

# 3. Real rows, not just an empty schema. This is the check that catches a
#    backup that "succeeded" against the wrong database.
check "vendors" "$(q "SELECT count(*) FROM vendors;")" gt 0
check "users" "$(q "SELECT count(*) FROM users;")" gt 0
check "leases" "$(q "SELECT count(*) FROM leases;")" gt 0
check "invoices" "$(q "SELECT count(*) FROM invoices;")" gt 0
check "ledger entries" "$(q "SELECT count(*) FROM ledger_entries;")" gt 0

# 4. RLS survived. pg_dump does restore policies, but a restore that silently
#    lost them would hand every agency everyone else's data — worth proving,
#    not assuming.
check "RLS enabled on leases" "$(q "SELECT rowsecurity FROM pg_tables WHERE tablename='leases';")" eq t
check "RLS enabled on invoices" "$(q "SELECT rowsecurity FROM pg_tables WHERE tablename='invoices';")" eq t
check "tenant isolation policies" "$(q "SELECT count(*) FROM pg_policies WHERE policyname LIKE '%tenant_isolation%';")" gt 5

# 5. SECURITY DEFINER functions survived. These carry the webhook vendor lookups
#    and the public rentals/branding reads, so losing them silently breaks
#    payments after a restore.
#
#    Compared against LIVE production rather than a hard-coded list. An earlier
#    draft asserted `count(...) > 2` over three names I had written from memory;
#    it failed on the first real run because one of those functions ships in a
#    migration production had not run yet. The test was wrong, not the backup.
#    A magic number here goes stale every time a migration adds a function —
#    "the copy matches the original" is the actual question, and it self-updates.
SECDEF="SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prosecdef;"
LIVE_SECDEF="$(qlive "$SECDEF")"
check "SECURITY DEFINER fns (live has $LIVE_SECDEF)" "$(q "$SECDEF")" eq "$LIVE_SECDEF"

# 6. The ledger still balances. If a restore truncated mid-write, this catches
#    it where a row count would not.
#
#    Deliberately NOT wrapped in `|| echo skip`: an earlier draft swallowed a
#    wrong column name and reported it as "schema differs", which is a check
#    that always passes. If this query cannot run, that is a failure.
UNBALANCED=$(q "SELECT count(*) FROM (
                  SELECT transaction_id FROM ledger_entries
                  GROUP BY transaction_id HAVING sum(debit) <> sum(credit)
                ) x;")
check "unbalanced ledger transactions" "$UNBALANCED" eq 0

echo "─────────────────────────────────────────────────────────"
if [ "$FAIL" = 0 ]; then
  echo "PASS — this backup restores cleanly."
  echo "Record the date. An untested backup is not a backup."
else
  echo "FAIL — this backup did NOT restore correctly. Investigate before relying on it."
  echo
  echo "One benign cause: if a migration ran AFTER this dump was taken, the copy"
  echo "legitimately has fewer objects than live. Check the dump's age above, and"
  echo "re-run after tonight's backup before treating it as a real failure."
  exit 1
fi
