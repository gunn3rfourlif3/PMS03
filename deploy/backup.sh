#!/usr/bin/env bash
# Nightly Postgres backup. Add to cron:  0 2 * * *  /path/to/deploy/backup.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${BACKUP_DIR:-$DIR/backups}"; mkdir -p "$OUT"
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f "$DIR/compose.prod.yml" --env-file "$DIR/.env.prod" \
  exec -T postgres pg_dump -U pms pms | gzip > "$OUT/pms-$STAMP.sql.gz"
# keep 14 days
find "$OUT" -name 'pms-*.sql.gz' -mtime +14 -delete
echo "backup -> $OUT/pms-$STAMP.sql.gz"
