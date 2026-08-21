#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

FRONTEND_PORT=5173
BACKEND_PORT=8080
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

echo "========================================"
echo "  Service Status"
echo "========================================"
echo ""

echo "--- Database ---"
echo "Status: SQLite (backend/db/pyworkflow.db)"

echo ""
echo "--- Backend (port ${BACKEND_PORT:-8080}) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT:-8080}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "Status: RUNNING (health OK)"
else
    echo "Status: STOPPED or not responding"
fi

echo ""
echo "--- Frontend (port ${FRONTEND_PORT:-5173}) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT:-5173}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "Status: RUNNING"
else
    echo "Status: STOPPED or not responding"
fi
