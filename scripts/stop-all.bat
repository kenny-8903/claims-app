@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Stopping All Services
echo ========================================
echo.

set "FRONTEND_PORT=5173"
set "BACKEND_PORT=8080"
if exist "%~dp0..\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0..\.env") do (
        if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
        if "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
    )
)

echo Stopping frontend and backend processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1

taskkill /f /t /im uvicorn.exe >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq vite" >nul 2>&1

echo All services stopped.
