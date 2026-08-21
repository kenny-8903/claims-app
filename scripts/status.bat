@echo off
setlocal enabledelayedexpansion

set "FRONTEND_PORT=5173"
set "BACKEND_PORT=8080"
if exist "%~dp0..\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0..\.env") do (
        if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
        if "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
    )
)

echo ========================================
echo   Service Status
echo ========================================
echo.

echo --- Database ---
echo Status: SQLite ^(backend/db/pyworkflow.db^)

echo.
echo --- Backend (port %BACKEND_PORT%) ---
curl -s -o nul -w "%%{http_code}" http://localhost:%BACKEND_PORT%/health 2>nul | findstr "200" >nul
if %ERRORLEVEL% EQU 0 (
    echo Status: RUNNING ^(health OK^)
) else (
    echo Status: STOPPED or not responding
)

echo.
echo --- Frontend (port %FRONTEND_PORT%) ---
curl -s -o nul -w "%%{http_code}" http://localhost:%FRONTEND_PORT% 2>nul | findstr "200" >nul
if %ERRORLEVEL% EQU 0 (
    echo Status: RUNNING
) else (
    echo Status: STOPPED or not responding
)
