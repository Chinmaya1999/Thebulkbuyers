#!/usr/bin/env bash
# Project-local PostgreSQL for development (no password, listens on localhost:5433 only).
# Usage: scripts/localdb.sh start|stop|status      — data lives in ./.pgdata (safe to delete to reset)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"; [ -x "$BIN/pg_ctl" ] || BIN="$(dirname "$(command -v pg_ctl)")"
DATA="$PWD/.pgdata"; PORT=54329; SOCK="/tmp/bulkbuyers-pg"
mkdir -p "$SOCK"
case "${1:-start}" in
  start)
    [ -d "$DATA" ] || "$BIN/initdb" -D "$DATA" -U bulkbuyers --auth=trust -E UTF8 >/dev/null
    "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1 || "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1" -l "$DATA/server.log" -w start >/dev/null
    "$BIN/psql" -h 127.0.0.1 -p $PORT -U bulkbuyers -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='bulkbuyers'" | grep -q 1 || "$BIN/createdb" -h 127.0.0.1 -p $PORT -U bulkbuyers bulkbuyers
    echo "Local database ready → postgres://bulkbuyers@127.0.0.1:$PORT/bulkbuyers" ;;
  stop) "$BIN/pg_ctl" -D "$DATA" stop ;;
  status) "$BIN/pg_ctl" -D "$DATA" status ;;
esac
