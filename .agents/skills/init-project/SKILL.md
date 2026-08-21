---
name: init-project
description: Set up the full development environment from scratch — local services with scripts, frontend scaffold, backend config. SQLite is auto-created on first start; no Docker needed for development. Use when the user says "set up the project", "initialize the project", "first time setup", "get started", "run the project", or after cloning the repo for the first time.
---

# Init Project

## When to use

The user wants to get the project running for the first time, such as:

- "Set up the project"
- "Initialize everything"
- "First time setup"
- "How do I run this?"
- "Get the development environment started"

## ⚠️ Immutable files — do NOT touch

The following files are part of the project contract and must **never** be modified or created by an AI:

| File                         | Reason                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env` (root)                | User port configuration — created once from `.env.example`, then **never modified**. Never change `FRONTEND_PORT`, `BACKEND_PORT`, or `VITE_BACKEND_URL` after creation. |
| `devops/docker-compose.yml`  | Production Docker Compose — SQLite volume mount.                                                                                                                         |
| `devops/backend/Dockerfile`  | Production backend Docker image.                                                                                                                                         |
| `devops/frontend/Dockerfile` | Production frontend Docker image.                                                                                                                                        |

If something seems missing or broken, explain the problem to the user and ask them to make the edit manually.

## Steps

### 1. Setup the frontend scaffold

Check if `frontend/` directory and all required scaffold files exist. If any are missing, create them using the `write` tool:

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/vite-env.d.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/index.ts`

_(See [Frontend manual scaffold reference](#frontend-manual-scaffold-reference) below for the exact file contents.)_

> **Do NOT modify production Docker files in `devops/`.** They are pre-configured for deployment.
>
> The frontend and backend run locally on the host. `npm install` and `uv sync` are handled by the `scripts/start-*` scripts. SQLite auto-creates the database on first startup — no database setup needed.

### 2. Check prerequisites

Before starting services, verify the required tools are installed. Run each check and report results:

**Node.js** (for frontend):

```bash
node --version > /dev/null 2>&1 && echo "Node.js: $(node --version)" || echo "Node.js: NOT INSTALLED — install from https://nodejs.org (v20+)"
```

**uv** (for Python/backend):

```bash
uv --version > /dev/null 2>&1 && echo "uv: $(uv --version)" || echo "uv: NOT INSTALLED — run: pip install uv"
```

If any check fails, tell the user which tool is missing and how to install it. Do not proceed until all checks pass.

### 3. Create root `.env` from `.env.example`

**If `.env` already exists at the project root, do NOT overwrite it.** The user may have already customized their ports. Skip this step entirely.

If `.env` does **not** exist, create it from the template:

**macOS/Linux:**

```bash
cp .env.example .env
```

**Windows (Command Prompt):**

```bat
copy .env.example .env
```

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

This file controls the host port mappings. The defaults are:

| Variable           | Default                 | Purpose                                        |
| ------------------ | ----------------------- | ---------------------------------------------- |
| `FRONTEND_PORT`    | `5173`                  | React/Vite dev server                          |
| `BACKEND_PORT`     | `8080`                  | FastAPI backend                                |
| `VITE_BACKEND_URL` | `http://localhost:8080` | Backend proxy target (must match BACKEND_PORT) |

Tell the user they can override any value if the default port is already in use on their machine. If they change `BACKEND_PORT`, they must also update `VITE_BACKEND_URL` to match.

### 4. Setup the backend basic files

Verify that the following backend files exist. **If a file already exists, do NOT overwrite it** — the user may have customized values. Only create files that are missing.

| File                       | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `backend/database.py`      | SQLite database engine and session configuration |
| `backend/main.py`          | FastAPI application entry point                  |
| `backend/.env`             | Database connection configuration                |
| `backend/pyproject.toml`   | Python project config (uv)                       |
| `backend/requirements.txt` | Python dependencies (Docker compatibility)       |

_(See [Backend basic files reference](#backend-basic-files-reference) below for the exact file contents.)_

> **`backend/main.py` includes a `/health` endpoint** (`GET /health` → `{"status": "ok"}`). This is the endpoint the frontend will call to verify the backend is running. After the services start, the frontend App component will hit this endpoint and display the result.

> The production Docker config (`devops/`) is for deployment only — not needed for local development.

### 5. Create startup scripts

Check if the `scripts/` directory exists. If not, create it and all script files.

The `scripts/` directory should contain:

| Script                       | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `start-backend.bat` / `.sh`  | Install Python deps (uv) + start FastAPI |
| `start-frontend.bat` / `.sh` | Install Node deps (npm) + start Vite     |
| `start-all.bat` / `.sh`      | Start all services in order              |
| `stop-all.bat` / `.sh`       | Stop all services                        |
| `status.bat` / `.sh`         | Check health of all services             |

The script contents are maintained in the `scripts/` directory in the repo. Check if they already exist before creating.

### 6. Start services

Tell the user to run the startup scripts.

> **Windows users:** `.bat` scripts must run in **Command Prompt (cmd.exe)**, not PowerShell. If you're in PowerShell, prefix with `cmd /c`:
>
> ```powershell
> cmd /c "scripts\start-all.bat"
> ```

**Windows (Command Prompt):**

```bat
scripts\start-all.bat
```

**macOS/Linux:**

```bash
bash scripts/start-all.sh
```

Or start services individually:

**Windows (Command Prompt):**

```bat
scripts\start-backend.bat   # FastAPI only
scripts\start-frontend.bat  # Vite only
```

**macOS/Linux:**

```bash
bash scripts/start-backend.sh  # FastAPI only
bash scripts/start-frontend.sh # Vite only
```

### 7. Verify services

After ~30 seconds, check status:

**Windows:**

```bat
scripts\status.bat
```

**macOS/Linux:**

```bash
bash scripts/status.sh
```

Or manually verify:

**Windows (PowerShell):**

```powershell
$bp = (Select-String "^BACKEND_PORT=" .env).Line.Split("=")[1]
$fp = (Select-String "^FRONTEND_PORT=" .env).Line.Split("=")[1]
curl.exe -s "http://localhost:$bp/health"
curl.exe -s "http://localhost:$fp"
```

**macOS/Linux:**

```bash
source .env && curl http://localhost:$BACKEND_PORT/health     # Backend → {"status":"ok"}
source .env && curl -s http://localhost:$FRONTEND_PORT | head -5   # Frontend → first 5 lines of HTML
```

### 8. Open the frontend in the browser

After confirming both services are healthy, open the frontend in the default browser:

**macOS/Linux:**

```bash
source .env && open http://localhost:$FRONTEND_PORT
```

**Windows (Command Prompt):**

```bat
for /f "tokens=2 delims==" %i in ('findstr "^FRONTEND_PORT=" .env') do start http://localhost:%i
```

**Windows (PowerShell):**

```powershell
$fp = (Select-String "^FRONTEND_PORT=" .env).Line.Split("=")[1]; Start-Process "http://localhost:$fp"
```

### 9. Tell the user

The project is now running. Tell the user:

> ✅ The project is up and running!
>
> - **Frontend**: http://localhost:5173 (configurable via `FRONTEND_PORT` in `.env`)
> - **Backend API**: http://localhost:8080 (configurable via `BACKEND_PORT` in `.env`)
> - **Database**: SQLite at `backend/db/pyworkflow.db` (auto-created on startup)
>
> **Useful commands:**
>
> | What           | Windows (Command Prompt)     | macOS/Linux                      |
> | -------------- | ---------------------------- | -------------------------------- |
> | Start all      | `scripts\start-all.bat`      | `bash scripts/start-all.sh`      |
> | Start backend  | `scripts\start-backend.bat`  | `bash scripts/start-backend.sh`  |
> | Start frontend | `scripts\start-frontend.bat` | `bash scripts/start-frontend.sh` |
> | Stop all       | `scripts\stop-all.bat`       | `bash scripts/stop-all.sh`       |
> | Check status   | `scripts\status.bat`         | `bash scripts/status.sh`         |
>
> > **PowerShell users:** Prefix `.bat` scripts with `cmd /c`, e.g. `cmd /c "scripts\start-all.bat"`.
>
> **Production Docker mode:** Run `docker compose -f devops/docker-compose.yml up -d` to start the full stack with SQLite volume-mounted for persistence.

---

## Frontend manual scaffold reference

Use these exact file contents to create the frontend scaffold files manually.

The scaffold includes a pre-configured **API client** with Axios interceptors plus a Vite proxy that routes `/api` and `/auth` calls to the backend. The backend URL is read from `VITE_BACKEND_URL` in the root `.env` file via Vite's built-in `loadEnv()`.

> **Important:** Vite's `loadEnv()` reads `.env` files only — it does **not** pick up `process.env` exported by the shell. So changing `BACKEND_PORT` _only_ via the `start-frontend` script will not retarget the proxy. If you need a different backend URL, edit `VITE_BACKEND_URL` in the root `.env` file.

### `frontend/package.json`

```json
{
  "name": "frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.15.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.15.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.14",
    "globals": "^15.12.0",
    "typescript": "~5.6.2",
    "typescript-eslint": "^8.15.0",
    "vite": "^6.0.0"
  }
}
```

### `frontend/eslint.config.js`

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
```

> Without this config file and the matching devDependencies, `npm run lint` (and therefore the CI job) will fail with "ESLint couldn't find a configuration file".

### `frontend/vite.config.ts`

```typescript
import { defineConfig, loadEnv } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "VITE_");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080";

  return {
    plugins: [react()],
    server: {
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/auth": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
```

### `frontend/tsconfig.json`

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

### `frontend/tsconfig.app.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

### `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>py-workflow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/src/main.tsx`

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### `frontend/src/App.tsx`

```typescript
import { useEffect, useState } from 'react'
import './App.css'
import api from './api'

function App() {
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    api.get('/health')
      .then((res) => setMessage(res.data.status))
      .catch(() => setMessage('Backend unavailable'))
  }, [])

  return (
    <div>
      <h1>py-workflow</h1>
      <p>Backend status: {message}</p>
    </div>
  )
}

export default App
```

### `frontend/src/App.css`

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
```

### `frontend/src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

### `frontend/src/api/client.ts`

```typescript
import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach tokens, log requests, etc.
client.interceptors.request.use(
  (config) => {
    // Example: attach auth token if available
    // const token = localStorage.getItem('token')
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle errors globally (e.g. 401 → redirect to login)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("Unauthorized — redirecting to login");
      // window.location.href = '/login'
    }
    return Promise.reject(error);
  },
);

export default client;
```

### `frontend/src/api/index.ts`

```typescript
export { default } from "./client";
```

### `frontend/.vscode/settings.json`

```json
{
  "js/ts.tsdk.path": "node_modules/typescript/lib"
}
```

> This tells VSCode to use the workspace TypeScript version instead of its built-in one, preventing false-positive type errors.

---

## Backend basic files reference

### `backend/main.py`

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="py-workflow-system API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

> Uses the modern `lifespan` context manager (the older `@app.on_event("startup")` is deprecated in FastAPI ≥ 0.93).
> `allow_origins=["*"]` makes the dev experience friction-free. The CORS spec forbids combining `*` with `allow_credentials=True` (browsers silently drop the credentials header), so credentials are disabled. If you later need cookie-based auth, switch `allow_origins` to an explicit list (e.g. `["http://localhost:5173"]`) and flip credentials back on.

### `backend/.env`

> **Only create this file if it does not already exist.** If it exists, the user may have customized values. Do not overwrite.

```
DATABASE_URL=sqlite+aiosqlite:///./db/pyworkflow.db
```

### `backend/requirements.txt`

```
fastapi
uvicorn[standard]
sqlalchemy
aiosqlite
pydantic
python-dotenv
```

### `backend/pyproject.toml`

```toml
[project]
name = "py-workflow-system"
version = "0.1.0"
description = "Vibe coding lesson starter project"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy>=2.0.0",
    "aiosqlite>=0.20.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["."]
```

### `backend/database.py`

```python
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv(Path(__file__).parent / ".env", override=True)

DB_DIR = Path(__file__).parent / "db"
DB_PATH = DB_DIR / "pyworkflow.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    DB_DIR.mkdir(exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db
```

> aiosqlite already runs every connection in its own worker thread, so `check_same_thread=False` is unnecessary. `expire_on_commit=False` keeps ORM objects usable after `await db.commit()` in async handlers.
