#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Starting All Services"
echo "========================================"
echo ""

source "$ROOT_DIR/.env" 2>/dev/null || true
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# ── Backend ───────────────────────────────────────────────────────────────────
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo "Backend is already running on port $BACKEND_PORT - skipping start."
    BACKEND_PID="(already running)"
else
    echo ">>> Starting Backend..."
    bash "$SCRIPT_DIR/start-backend.sh" &
    BACKEND_PID=$!

    echo "Waiting for backend to be ready (timeout 60s)..."
    MAX_RETRIES=30
    RETRY=0
    while [ $RETRY -lt $MAX_RETRIES ]; do
        if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
            break
        fi
        if [ -n "${BACKEND_PID:-}" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo ""
            echo "ERROR: Backend process died unexpectedly (PID $BACKEND_PID)."
            echo "Check backend logs above for errors."
            exit 1
        fi
        RETRY=$((RETRY + 1))
        sleep 2
    done
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo ""
        echo "ERROR: Backend did not become healthy within ${MAX_RETRIES}s."
        exit 1
    fi
    echo "Backend is ready."
fi

echo ""

# ── Frontend ──────────────────────────────────────────────────────────────────
# Check if frontend port is already in use
if lsof -ti ":${FRONTEND_PORT}" > /dev/null 2>&1; then
    echo "Frontend is already running on port $FRONTEND_PORT - skipping start."
    FRONTEND_PID="(already running)"
else
    echo ">>> Starting Frontend..."
    bash "$SCRIPT_DIR/start-frontend.sh" &
    FRONTEND_PID=$!

    echo "Waiting for frontend to be ready (timeout 60s)..."
    MAX_RETRIES=30
    RETRY=0
    while [ $RETRY -lt $MAX_RETRIES ]; do
        if lsof -ti ":${FRONTEND_PORT}" > /dev/null 2>&1; then
            break
        fi
        if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo ""
            echo "ERROR: Frontend process died unexpectedly (PID $FRONTEND_PID)."
            echo "Check frontend logs above for errors."
            exit 1
        fi
        RETRY=$((RETRY + 1))
        sleep 2
    done
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo ""
        echo "ERROR: Frontend did not become ready within ${MAX_RETRIES}s."
        exit 1
    fi
    echo "Frontend is ready."
fi

echo ""
echo "========================================"
echo "  All services started!"
echo "  Frontend: http://localhost:${FRONTEND_PORT}"
echo "  Backend:  http://localhost:${BACKEND_PORT}/health"
echo "========================================"
echo ""
echo "PIDs: backend=${BACKEND_PID} frontend=${FRONTEND_PID}"
echo "Run scripts/stop-all.sh to stop everything."

wait
