# py-workflow-system — Agent Guide

## Project overview

`py-workflow-system` is a **vibe coding lesson starter project**. Users clone this repo and use it as a foundation to build their own workflow system. It's intentionally minimal — the scaffold provides the wiring (Docker Compose, service structure, database config) so learners can jump straight into building features without spending a session on boilerplate.

---

## 🔒 Immutable files

Do NOT modify these files under any circumstances. They define the fundamental infrastructure contract:

| File                         | Reason                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.env` (root)                | User port configuration — set once at machine setup. **Never change `FRONTEND_PORT`, `BACKEND_PORT`, or `VITE_BACKEND_URL`.** |
| `devops/docker-compose.yml`  | Production Docker Compose — SQLite volume mount.                                                                              |
| `devops/backend/Dockerfile`  | Production backend Docker image.                                                                                              |
| `devops/frontend/Dockerfile` | Production frontend Docker image.                                                                                             |

If you believe a change to these files is necessary, explain the problem to the user and ask them to make the edit manually.

---

## Tech stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Backend  | Python (FastAPI) — SQLAlchemy with SQLite |
| Frontend | React with TypeScript (Vite)              |
| Database | SQLite                                    |
| Infra    | Docker Compose (production only)          |

---

## Architecture

The system runs with **SQLite** (zero-config) and **frontend/backend locally on the host**:

```
┌──────────┐  /api + /auth  ┌──────────────┐
│  Browser │ ──(Vite proxy)─►│   Backend     │
│  :5173   │ ◄────────────── │   :8080       │
└──────────┘      HTTP      │  (SQLite DB)  │
                            └──────────────┘
```

> Ports shown are defaults. Configurable once per machine via `FRONTEND_PORT`, `BACKEND_PORT` in root `.env`.
>
> **🚫 Port conflict rule — READ THIS BEFORE TOUCHING ANY PORT:**
>
> - **NEVER edit `.env` to resolve a port conflict.** The `.env` file is immutable once created.
> - **NEVER use a different port (e.g. port+1) when the configured port is busy.** This includes Vite's auto-port-increment behaviour — do NOT accept it.
> - If a port is occupied, the **only** correct action is:
>   1. Run `scripts/stop-all.sh` (or `scripts\stop-all.bat` on Windows) to kill whatever is using the port.
>   2. Then restart with `scripts/start-all.sh` (or `scripts\start-all.bat`).
> - Do **not** pass a different port via CLI flags, environment overrides, `--port`, `--strictPort`, or any other mechanism that bypasses `.env`.
> - The only permitted reason to change `.env` ports is during the very first machine setup when the defaults permanently clash with other installed software — and only the **user** should make that edit, not the agent.

### Services

1. **database** — SQLite. File stored at `backend/db/pyworkflow.db`, auto-created on startup. No server needed.

2. **backend** — Python FastAPI server running locally. Uses `uv` for dependency management (`pyproject.toml`). Reads config from `backend/.env`. Default port 8080 (configurable via `BACKEND_PORT`).

3. **frontend** — React + TypeScript app with Vite, running locally. Reads `VITE_BACKEND_URL` from root `.env` via `loadEnv()`. Default port 5173 (configurable via `FRONTEND_PORT`).

### Developer machine requirements

- **Python 3.11+** with **uv** (`pip install uv`)
- **Node.js 20+**
- A code editor

### Directory layout

```
/
├── AGENTS.md                 # ← You are here
├── backend/                  # Python source (FastAPI)
│   ├── .env                  # DB connection configuration (DATABASE_URL)
│   ├── requirements.txt      # FastAPI, SQLAlchemy, pydantic
│   ├── main.py               # FastAPI app with /health endpoint
│   ├── database.py           # SQLite engine + session config
│   ├── db/                   # SQLite database file directory
│   └── ...
├── frontend/                 # React + TypeScript source (Vite)
│   └── ...
├── devops/                   # Production Docker config
│   ├── docker-compose.yml
│   ├── backend/Dockerfile
│   └── frontend/Dockerfile
└── .agents/
    └── skills/               # Installed agent skills
```

---

## Agent skills

Skills installed in `.agents/skills/` provide specialised workflows. Activate them with `use_skill` when the task matches their description.

| Skill                           | When to use                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `caveman`                       | Ultra-compressed communication (low-token mode)                                           |
| `diagnose`                      | Debugging hard bugs or performance regressions                                            |
| `grill-me`                      | Stress-test a plan or design before committing                                            |
| `grill-with-docs`               | Stress-test a plan against domain docs (creates CONTEXT.md)                               |
| `handoff`                       | Compact the conversation into a handoff document                                          |
| `improve-codebase-architecture` | Find refactoring opportunities, tighten coupling                                          |
| `init-project`                  | Set up the project from scratch (local services, scripts, frontend, backend)              |
| `ms-email`                      | Send system emails via Microsoft 365 SMTP                                                 |
| `ms-microsoft`                  | Add Microsoft SSO or OneDrive/Excel file browsing                                         |
| `prototype`                     | Build a throwaway prototype to explore a design                                           |
| `save-my-work`                  | Commit all work to git and push to GitHub                                                 |
| `restart-site`                  | Restart the development environment when the site won't load                              |
| `setup-matt-pocock-skills`      | Configure issue tracker, triage labels, and domain docs                                   |
| `tdd`                           | TDD with design focus: tracer-bullet slices, interface planning, deep modules             |
| `test-driven-development`       | Always-on TDD law: no production code without a failing test first (every feature/bugfix) |
| `to-issues`                     | Break a plan into independently-grabbable issues                                          |
| `to-prd`                        | Turn conversation context into a PRD                                                      |
| `triage`                        | Triage issues through a state machine                                                     |
| `write-a-skill`                 | Create new agent skills                                                                   |
| `zoom-out`                      | Get a high-level perspective on unfamiliar code                                           |

> **First-time setup**: Run the `setup-matt-pocock-skills` skill to configure the issue tracker, triage labels, and domain doc layout. This is needed before using `to-issues`, `to-prd`, `triage`, `diagnose`, `tdd`, `improve-codebase-architecture`, or `zoom-out`.

---

## 🚫 Never run services directly — always use scripts

When starting, stopping, or restarting backend or frontend, **you MUST use the scripts in `scripts/`**. Never invoke `uvicorn`, `vite`, `npm run dev`, or any equivalent command directly.

| ❌ Forbidden                                  | ✅ Correct                       |
| --------------------------------------------- | -------------------------------- |
| `uv run uvicorn main:app --port 8080`         | `bash scripts/start-backend.sh`  |
| `npx vite --port 5173`                        | `bash scripts/start-frontend.sh` |
| `uvicorn main:app --host 0.0.0.0 --port 8080` | `bash scripts/start-all.sh`      |

**Why:** The scripts read `FRONTEND_PORT` and `BACKEND_PORT` from root `.env`. Running commands directly tempts you to hardcode a port, which will break if the user has changed their `.env` defaults.

**If you need to know the current ports** (e.g. to health-check or curl), read them from `.env`:

```bash
# Correct way to get ports in a one-off command
source .env && echo $BACKEND_PORT $FRONTEND_PORT
```

Never guess or hardcode `8080` or `5173` in any command or script you write.

---

## Common workflows

> **Windows users:** `.bat` scripts must run in **Command Prompt (cmd.exe)**, not PowerShell. In PowerShell, prefix with `cmd /c`, e.g. `cmd /c "scripts\start-all.bat"`.

### Starting the development environment

**Windows:**

```bat
scripts\start-all.bat
```

**macOS/Linux:**

```bash
bash scripts/start-all.sh
```

### Restarting everything

**Windows:**

```bat
scripts\stop-all.bat
scripts\start-all.bat
```

**macOS/Linux:**

```bash
bash scripts/stop-all.sh
bash scripts/start-all.sh
```

### Checking service status

**Windows:**

```bat
scripts\status.bat
```

**macOS/Linux:**

```bash
bash scripts/status.sh
```

### Accessing the database

The SQLite database file is at `backend/db/pyworkflow.db`. Open it with any SQLite client (e.g., `sqlite3`, DB Browser for SQLite, or the SQLite VS Code extension).

### Production Docker mode

Production Docker configuration lives in `devops/`. Start with:

```bash
docker compose -f devops/docker-compose.yml up -d
```

The SQLite database file is persisted via volume mount at `backend/db/`.

---

## Domain language

This is an **empty starter project** — there is no domain language yet. As the project evolves, domain terms should be captured in `CONTEXT.md` and architectural decisions in `docs/adr/`. The `grill-with-docs` skill can help formalise this.

## System description

`SYSTEM.md` at the repo root is the living description of what this system actually does — features, domain model, key workflows, and out-of-scope items. It is maintained by the `update-system` skill. It does **not** exist until the first vibe-coding session produces real features. Run the `update-system` skill after any session that adds, changes, or removes features.

---

## Issue tracker

This repo uses the **local markdown** convention: issues live as files under `.scratch/<feature-slug>/`. See `.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md` for details.
