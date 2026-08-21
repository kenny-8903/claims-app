@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

echo ========================================
echo   Starting All Services
echo ========================================
echo.

REM Load config
set "BACKEND_PORT=8080"
set "FRONTEND_PORT=5173"
if exist "%SCRIPT_DIR%..\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%SCRIPT_DIR%..\.env") do (
        if "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
        if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
    )
)

REM --- Backend ---
curl -s http://localhost:%BACKEND_PORT%/health >nul 2>&1
if not %ERRORLEVEL% EQU 0 goto do_start_backend
echo Backend is already running on port %BACKEND_PORT% - skipping start.
goto stfrt
:do_start_backend

echo ^>^>^> Starting Backend...
start "py-workflow-backend" /MIN cmd /c "%SCRIPT_DIR%start-backend.bat"

echo Waiting for backend to be ready (timeout 60s)...
set /a RETRY=0
:wbk
curl -s http://localhost:%BACKEND_PORT%/health >nul 2>&1
if %ERRORLEVEL% EQU 0 goto bkrdy
set /a RETRY+=1
if %RETRY% GEQ 30 (
    echo.
    echo ERROR: Backend did not become healthy within 60s.
    echo Check the backend window for errors.
    exit /b 1
)
timeout /t 2 >nul
goto wbk
:bkrdy
echo Backend is ready.

REM --- Frontend ---
:stfrt
echo.

REM Check if frontend port is already in use
netstat -ano | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
if not %ERRORLEVEL% EQU 0 goto do_start_frontend
echo Frontend is already running on port %FRONTEND_PORT% - skipping start.
goto allrdy
:do_start_frontend

echo ^>^>^> Starting Frontend...
start "py-workflow-frontend" /MIN cmd /c "%SCRIPT_DIR%start-frontend.bat"

echo Waiting for frontend to be ready (timeout 60s)...
set /a RETRY=0
:wfrt
netstat -ano | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto ftrdy
set /a RETRY+=1
if %RETRY% GEQ 30 (
    echo.
    echo ERROR: Frontend did not become ready within 60s.
    echo Check the frontend window for errors.
    exit /b 1
)
timeout /t 2 >nul
goto wfrt
:ftrdy
echo Frontend is ready.

:allrdy
echo.
echo ========================================
echo   All services started!
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo   Backend:  http://localhost:%BACKEND_PORT%/health
echo ========================================