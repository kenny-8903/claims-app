#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Starting Backend (FastAPI)"
echo "========================================"
echo ""

echo "[1/4] Checking uv..."
if ! command -v uv &> /dev/null; then
    echo "uv is not installed. Installing via pip..."
    pip install uv || {
        echo "ERROR: Failed to install uv. Install it manually: pip install uv"
        exit 1
    }
fi
echo "uv is ready."

echo ""
echo "[2/4] Loading config from .env..."
BACKEND_PORT="${BACKEND_PORT:-8080}"
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi
BACKEND_PORT="${BACKEND_PORT:-8080}"
echo "Backend port: $BACKEND_PORT"

echo ""
echo "[3/4] Installing Python dependencies..."
cd "$ROOT_DIR/backend"
uv sync

echo ""
echo "[4/4] Starting FastAPI on port $BACKEND_PORT..."
echo "Open http://localhost:$BACKEND_PORT/health to verify."
echo "Press Ctrl+C to stop."
uv run uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
