#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Stopping All Services"
echo "========================================"
echo ""

BACKEND_PORT=8080
FRONTEND_PORT=5173
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

echo "Stopping frontend and backend processes..."
lsof -ti ":${BACKEND_PORT}" | xargs kill -9 2>/dev/null || true
lsof -ti ":${FRONTEND_PORT}" | xargs kill -9 2>/dev/null || true

pkill -9 -f "uvicorn main:app" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true

echo "All services stopped."
