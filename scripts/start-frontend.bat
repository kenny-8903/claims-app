@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Starting Frontend (Vite + React)
echo ========================================

echo.
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 20+ from https://nodejs.org
    exit /b 1
)
echo Node.js is ready.

echo.
echo [2/4] Loading config from .env...
set "FRONTEND_PORT=5173"
set "BACKEND_PORT=8080"
if exist "%~dp0..\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0..\.env") do (
        if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
        if "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
    )
)
echo Frontend port: %FRONTEND_PORT%
echo Backend port: %BACKEND_PORT%

echo.
echo [3/4] Installing Node dependencies...
cd /d "%~dp0..\frontend"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install frontend dependencies.
    exit /b 1
)

echo.
echo [4/4] Starting Vite dev server on port %FRONTEND_PORT%...
set "VITE_BACKEND_URL=http://localhost:%BACKEND_PORT%"
echo VITE_BACKEND_URL=%VITE_BACKEND_URL%
echo Open http://localhost:%FRONTEND_PORT% in your browser.
echo Press Ctrl+C to stop.
call npx vite --port %FRONTEND_PORT% --host --strictPort
