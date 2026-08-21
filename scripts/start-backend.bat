@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Starting Backend (FastAPI)
echo ========================================

echo.
echo [1/4] Checking uv...
uv --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo uv is not installed. Installing via pip...
    pip install uv
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install uv. Please install it manually: pip install uv
        exit /b 1
    )
)
echo uv is ready.

echo.
echo [2/4] Loading config from .env...
set "BACKEND_PORT=8080"
if exist "%~dp0..\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0..\.env") do (
        if "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
    )
)
echo Backend port: %BACKEND_PORT%

echo.
echo [3/4] Installing Python dependencies...
cd /d "%~dp0..\backend"
call uv sync
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies.
    exit /b 1
)

echo.
echo [4/4] Starting FastAPI on port %BACKEND_PORT%...
echo Open http://localhost:%BACKEND_PORT%/health to verify.
echo Press Ctrl+C to stop.
call uv run uvicorn main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload
