#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Starting Frontend (Vite + React)"
echo "========================================"
echo ""

echo "[1/4] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi
echo "Node.js is ready."

echo ""
echo "[2/4] Loading config from .env..."
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
echo "Frontend port: $FRONTEND_PORT"
echo "Backend port: $BACKEND_PORT"

echo ""
echo "[3/4] Installing Node dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo ""
echo "[4/4] Starting Vite dev server on port $FRONTEND_PORT..."
export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
echo "VITE_BACKEND_URL=$VITE_BACKEND_URL"
echo "Open http://localhost:$FRONTEND_PORT in your browser."
echo "Press Ctrl+C to stop."
npx vite --port "$FRONTEND_PORT" --host --strictPort
