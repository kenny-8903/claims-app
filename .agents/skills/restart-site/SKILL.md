---
name: restart-site
description: Restart the development environment when the site won't load or is unresponsive. Use when user reports the site is down, not loading, blank page, connection refused, or any loading problem.
---

# Restart Site

## When to use

The user reports a problem loading the site, such as:

- "The site won't load"
- "I'm getting a blank page"
- "Connection refused"
- "The frontend/backend is down"

## Steps

> **Windows users:** `.bat` scripts must run in **Command Prompt (cmd.exe)**, not PowerShell. If you're in PowerShell, prefix with `cmd /c`, e.g. `cmd /c "scripts\status.bat"`.

### 0. Check if the frontend scaffold exists

If `frontend/` directory or `frontend/package.json` does **not** exist, use the `init-project` skill instead:

```
use_skill: init-project
```

### 1. Check service status

Run the status script:

**macOS/Linux:**
```bash
bash scripts/status.sh
```

**Windows (Command Prompt):**
```bat
scripts\status.bat
```

If the output shows backend or frontend not running, proceed to restart them.

### 2. Restart everything

**macOS/Linux:**
```bash
bash scripts/stop-all.sh
bash scripts/start-all.sh
```

**Windows (Command Prompt):**
```bat
scripts\stop-all.bat
scripts\start-all.bat
```

### 3. Restart individual services

If only one service needs a restart, stop *all* first (the stop scripts read ports from `.env`, targeting only the right processes), then start the one needed:

**Backend only — macOS/Linux:**
```bash
bash scripts/stop-all.sh && bash scripts/start-backend.sh
```

**Backend only — Windows (Command Prompt):**
```bat
scripts\stop-all.bat && scripts\start-backend.bat
```

**Frontend only — macOS/Linux:**
```bash
bash scripts/stop-all.sh && bash scripts/start-frontend.sh
```

**Frontend only — Windows (Command Prompt):**
```bat
scripts\stop-all.bat && scripts\start-frontend.bat
```

> Do **not** run raw `lsof -ti :$BACKEND_PORT | xargs kill` here — if the user's current shell has not sourced `.env`, `$BACKEND_PORT` is empty and `lsof -ti :` matches *all* listening sockets, killing unrelated processes. Always go through `scripts/stop-all.*`.

### 4. Wait for services to become healthy

Poll both endpoints until they respond or 30 s elapse (15 attempts × 2 s). Run the appropriate block for the platform.

**macOS/Linux:**
```bash
set -a; source <(tr -d '\r' < .env); set +a
BACKEND_PORT=${BACKEND_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BACKEND_OK=0; FRONTEND_OK=0
for i in $(seq 1 15); do
  b=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/health" 2>/dev/null); b=${b:-000}
  f=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" 2>/dev/null); f=${f:-000}
  [ "$b" = "200" ] && BACKEND_OK=1
  [ "$f" = "200" ] && FRONTEND_OK=1
  [ $BACKEND_OK -eq 1 ] && [ $FRONTEND_OK -eq 1 ] && { echo "Both services ready"; break; }
  echo "Waiting... ($i/15)  backend=$b  frontend=$f"
  sleep 2
done
[ $BACKEND_OK -eq 0 ]  && echo "WARNING: backend did not become healthy"
[ $FRONTEND_OK -eq 0 ] && echo "WARNING: frontend did not become healthy"
```

**Windows (PowerShell — more reliable for polling than cmd.exe):**
```powershell
$envMap = @{}
Get-Content .env | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2
    $envMap[$k.Trim()] = $v.Trim()
}
$bp = if ($envMap["BACKEND_PORT"])  { $envMap["BACKEND_PORT"] }  else { "8080" }
$fp = if ($envMap["FRONTEND_PORT"]) { $envMap["FRONTEND_PORT"] } else { "5173" }

$backendOk = $false; $frontendOk = $false
for ($i = 1; $i -le 15; $i++) {
    $b = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$bp/health" 2>$null
    $f = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$fp"       2>$null
    if ($b -eq "200") { $backendOk  = $true }
    if ($f -eq "200") { $frontendOk = $true }
    if ($backendOk -and $frontendOk) { Write-Host "Both services ready"; break }
    Write-Host "Waiting... ($i/15)  backend=$b  frontend=$f"
    Start-Sleep -Seconds 2
}
if (-not $backendOk)  { Write-Warning "Backend did not become healthy" }
if (-not $frontendOk) { Write-Warning "Frontend did not become healthy" }
```

**Windows (Command Prompt — fallback, single-shot check only; no retry loop):**
```bat
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="BACKEND_PORT"  set "BACKEND_PORT=%%b"
    if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
)
if not defined BACKEND_PORT  set "BACKEND_PORT=8080"
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"
echo Checking backend...
curl -s -o nul -w "%%{http_code}" "http://localhost:%BACKEND_PORT%/health" 2>nul | findstr /c:"200" >nul && echo Backend OK || echo Backend NOT ready
echo Checking frontend...
curl -s -o nul -w "%%{http_code}" "http://localhost:%FRONTEND_PORT%" 2>nul | findstr /c:"200" >nul && echo Frontend OK || echo Frontend NOT ready
```

> If services are not ready, wait a few seconds and re-run the block above until both report OK.

### 5. Open browser (only once both services are healthy)

**Only run this step if both health checks passed in step 4.** Read `FRONTEND_PORT` from `.env` — never hardcode it.

**macOS:**
```bash
set -a; source <(tr -d '\r' < .env); set +a
open "http://localhost:${FRONTEND_PORT:-5173}"
```

**Linux (requires desktop environment / display):**
```bash
set -a; source <(tr -d '\r' < .env); set +a
xdg-open "http://localhost:${FRONTEND_PORT:-5173}"
```

> On Linux, if `xdg-open` is unavailable or fails silently (headless/SSH/CI environment), skip the open command and just report the URL to the user instead.

**Windows (PowerShell):**
```powershell
$match = Select-String "^FRONTEND_PORT=" .env | Select-Object -First 1
$fp = if ($match) { $match.Line.Split("=")[1].Trim() } else { "5173" }
Start-Process "http://localhost:$fp"
```

**Windows (Command Prompt):**
```bat
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
)
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"
start "" "http://localhost:%FRONTEND_PORT%"
```

### 6. Tell the user

Report which services are running and on which ports (always read from `.env`, never hardcode). If the browser was opened, state the URL. If a service failed to start within the timeout, name which one and suggest the user check the terminal window where it was started for error output.

## Quick reference

| What you want | macOS/Linux | Windows (Command Prompt) |
| ------------- | ----------- | ------------------------ |
| Restart everything | `bash scripts/stop-all.sh && bash scripts/start-all.sh` | `scripts\stop-all.bat && scripts\start-all.bat` |
| Restart only frontend | `bash scripts/stop-all.sh && bash scripts/start-frontend.sh` | `scripts\stop-all.bat && scripts\start-frontend.bat` |
| Restart only backend | `bash scripts/stop-all.sh && bash scripts/start-backend.sh` | `scripts\stop-all.bat && scripts\start-backend.bat` |
| Check status | `bash scripts/status.sh` | `scripts\status.bat` |
| Find ports | `grep "_PORT=" .env` | `findstr "_PORT=" .env` |
| Open browser (macOS) | `source <(tr -d '\r' < .env) && open "http://localhost:${FRONTEND_PORT:-5173}"` | — |
| Open browser (Linux) | `source <(tr -d '\r' < .env) && xdg-open "http://localhost:${FRONTEND_PORT:-5173}"` | — |
| Open browser (Windows PS) | — | `$m=Select-String "^FRONTEND_PORT=" .env; $fp=if($m){$m.Line.Split("=")[1].Trim()}else{"5173"}; Start-Process "http://localhost:$fp"` |

> **PowerShell users:** Prefix `.bat` scripts with `cmd /c`, e.g. `cmd /c "scripts\status.bat"`.
