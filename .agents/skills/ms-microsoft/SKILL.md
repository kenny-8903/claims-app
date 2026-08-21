---
name: ms-microsoft
description: Implement Microsoft SSO (Single Sign-On) and Microsoft OneDrive/Excel file browsing. Use when user wants to add "Sign in with Microsoft", OneDrive file browser, or access Excel files from OneDrive. Includes the Azure App Registration client ID `543a4c83-793f-4a37-b7d0-4c30be94a9f2` for multi-tenant use.
---

# Microsoft SSO & OneDrive Integration

This skill implements Microsoft authentication (SSO) and OneDrive file browsing for this project (FastAPI + SQLAlchemy + SQLite backend, React frontend).

## Application ID

```
543a4c83-793f-4a37-b7d0-4c30be94a9f2
```

> **Note:** This is a multi-tenant app registration. Users from any Microsoft tenant can sign in. You must register this ID in your Azure portal under **App Registrations** → set up **Single-page Application** platform with redirect URI matching your frontend URL.
>
> The MSAL config below uses `redirectUri: window.location.origin`, so it adapts automatically to whatever port the frontend is running on. **But Azure AD still validates the redirect URI against the list registered in the portal** — if you change `FRONTEND_PORT` in `.env`, you must add the new `http://localhost:<port>` entry to your Azure App Registration's redirect URI list, otherwise sign-in will fail with `AADSTS50011`.

---

## Required API Permissions (Delegated)

| Permission   | Type      | Purpose                            |
| ------------ | --------- | ---------------------------------- |
| `User.Read`  | Delegated | Get user profile (name, email, ID) |
| `Files.Read` | Delegated | Browse and download OneDrive files |

> `User.Read` and `Files.Read` are **delegated** permissions — individual users can self-consent when they sign in. Admin consent is only required if the tenant administrator has disabled user consent globally (common in enterprise tenants). If sign-in fails with `AADSTS65001`, ask your tenant admin to grant consent.

---

## Prerequisites

Before running this skill, add the required backend and frontend dependencies.

**Backend** — run these commands from the repo root:

**macOS/Linux / Windows (Command Prompt):**
```bash
cd backend && uv add "httpx>=0.27.0" "python-jose[cryptography]>=3.3.0" "python-dotenv>=1.0.0"
```

**Windows (PowerShell):**
```powershell
Set-Location backend; uv add "httpx>=0.27.0" "python-jose[cryptography]>=3.3.0" "python-dotenv>=1.0.0"
```

Also append all three lines to `backend/requirements.txt` (used by the production Docker image):

```
httpx>=0.27.0
python-jose[cryptography]>=3.3.0
python-dotenv>=1.0.0
```

Also add `aiosqlite` (async SQLite driver) to the backend:

**macOS/Linux / Windows (Command Prompt):**
```bash
cd backend && uv add "aiosqlite>=0.20.0"
```
**Windows (PowerShell):**
```powershell
Set-Location backend; uv add "aiosqlite>=0.20.0"
```
Append to `backend/requirements.txt`:
```
aiosqlite>=0.20.0
```

**Frontend** — install all packages at once:

**macOS/Linux / Windows (Command Prompt):**
```bash
cd frontend && npm install @azure/msal-browser @azure/msal-react axios
```

**Windows (PowerShell):**
```powershell
Set-Location frontend; npm install @azure/msal-browser @azure/msal-react axios
```

> **Schema note:** This project uses `Base.metadata.create_all()` on startup, which only creates *missing* tables — it does **not** add columns to existing tables. If the `users` table already exists without `microsoft_id`, you must either delete the dev DB and let it auto-recreate, **or** manually add the column (non-destructive):
>
> **macOS/Linux — delete DB:**
> ```bash
> rm backend/db/pyworkflow.db
> ```
>
> **macOS/Linux — non-destructive ALTER:**
> ```bash
> sqlite3 backend/db/pyworkflow.db "ALTER TABLE users ADD COLUMN microsoft_id VARCHAR(255)"
> ```
>
> **Windows (Command Prompt) — delete DB:**
> ```bat
> del backend\db\pyworkflow.db
> ```
>
> **Windows (Command Prompt) — non-destructive ALTER:**
> ```bat
> sqlite3 backend\db\pyworkflow.db "ALTER TABLE users ADD COLUMN microsoft_id VARCHAR(255)"
> ```
>
> **Windows (PowerShell) — delete DB:**
> ```powershell
> Remove-Item backend\db\pyworkflow.db
> ```
>
> **Windows (PowerShell) — non-destructive ALTER:**
> ```powershell
> sqlite3 backend\db\pyworkflow.db "ALTER TABLE users ADD COLUMN microsoft_id VARCHAR(255)"
> ```
>
> For a real project, add Alembic before shipping.

---

## Files to Create / Modify

### 1. Backend — database.py: ensure `get_db` exists

The router depends on `from database import get_db`. Check **`backend/database.py`** and add `get_db` if it is not already present:

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./db/pyworkflow.db")

engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session
```

> If your `database.py` already exists, only add the `get_db` function — do not replace the file.

---

### 2. Backend — SQLAlchemy User Model

In **`backend/models/user.py`** (or wherever your User model lives), add the `microsoft_id` field:

```python
from sqlalchemy import Column, Integer, String, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    microsoft_id = Column(String(255), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
```

---

### 3. Backend — SQLAlchemy CRUD / Repository

In **`backend/repositories/user_repo.py`** (or similar), add Microsoft-related queries:

```python
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User


async def get_user_by_microsoft_id(db: AsyncSession, microsoft_id: str) -> User | None:
    result = await db.execute(select(User).where(User.microsoft_id == microsoft_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def update_microsoft_id(db: AsyncSession, user_id: int, microsoft_id: str) -> None:
    await db.execute(update(User).where(User.id == user_id).values(microsoft_id=microsoft_id))
    await db.commit()


async def create_user_with_microsoft(
    db: AsyncSession, email: str, name: str, microsoft_id: str
) -> User:
    user = User(email=email, name=name, microsoft_id=microsoft_id, is_active=True)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

---

### 4. Backend — Microsoft Login Endpoint

Make sure these `__init__.py` files exist so the imports resolve. Pick the command for your shell:

**macOS/Linux:**
```bash
mkdir -p backend/repositories backend/routers backend/services backend/models
touch backend/repositories/__init__.py backend/routers/__init__.py backend/services/__init__.py backend/models/__init__.py
```

**Windows (Command Prompt):**
```bat
for %d in (repositories routers services models) do (
  if not exist backend\%d mkdir backend\%d
  if not exist backend\%d\__init__.py type nul > backend\%d\__init__.py
)
```

**Windows (PowerShell):**
```powershell
"repositories","routers","services","models" | ForEach-Object {
  New-Item -ItemType Directory -Force -Path "backend\$_" | Out-Null
  New-Item -ItemType File   -Force -Path "backend\$_\__init__.py" | Out-Null
}
```

#### `backend/services/auth.py` — JWT helper

Create this file before adding the router. It signs app-level JWTs that the frontend sends on subsequent requests.

```python
import os
from datetime import datetime, timedelta, timezone
from jose import jwt

_secret = os.environ.get("SECRET_KEY", "")
if not _secret:
    raise RuntimeError("SECRET_KEY environment variable is not set. Add it to backend/.env")
SECRET_KEY = _secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    """Returns user_id (int) or raises jose.JWTError on failure."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return int(payload["sub"])
```

Add `SECRET_KEY` to **`backend/.env`**:

```
SECRET_KEY=replace-with-a-long-random-string
```

> **Important:** The guard above rejects empty strings only — it will NOT catch a copy-pasted placeholder. Generate a real secret before running:
> - **macOS/Linux:** `python3 -c "import secrets; print(secrets.token_hex(32))"`
> - **Windows (PowerShell):** `python -c "import secrets; print(secrets.token_hex(32))"`

---

Then in **`backend/routers/auth.py`**, add the Microsoft login endpoint:

```python
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import get_db
from repositories.user_repo import (
    get_user_by_microsoft_id,
    get_user_by_email,
    update_microsoft_id,
    create_user_with_microsoft,
)
from services.auth import create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class MicrosoftLoginRequest(BaseModel):
    access_token: str


@router.post("/microsoft")
async def microsoft_login(body: MicrosoftLoginRequest, db: AsyncSession = Depends(get_db)):
    # Call Microsoft Graph API to get user profile
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {body.access_token}"},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Microsoft token validation failed",
        )

    ms_profile = resp.json()
    microsoft_id: str = ms_profile.get("id", "")
    email: str = ms_profile.get("mail") or ms_profile.get("userPrincipalName", "")
    name: str = ms_profile.get("displayName", "Unknown")

    if not microsoft_id or not email:
        raise HTTPException(status_code=400, detail="Microsoft profile missing required fields")

    # Try to find user by microsoft_id first
    user = await get_user_by_microsoft_id(db, microsoft_id)
    if not user:
        # Try by email
        user = await get_user_by_email(db, email)
        if user:
            # Link microsoft_id to existing user
            await update_microsoft_id(db, user.id, microsoft_id)
        else:
            # Create new user
            user = await create_user_with_microsoft(db, email, name, microsoft_id)

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive")

    token = create_token(user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}
```

---

### 5. Backend — Register Router in main.py

Edit **`backend/main.py`** — do not replace it entirely. Apply these two changes:

1. Add `load_dotenv()` as the very first two lines of the file (before any other imports).
2. Add `app.include_router(auth_router)` alongside any existing routers.

The result should look like:

```python
from dotenv import load_dotenv
load_dotenv()  # must be first — before any import that reads os.environ

from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import engine, Base
from routers.auth import router as auth_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="py-workflow-system API", lifespan=lifespan)

app.include_router(auth_router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

> `load_dotenv()` must be the first two lines — before any other import reads `os.environ` — so `SECRET_KEY` is available when `services/auth.py` is first imported.
> The `lifespan` handler ensures all SQLAlchemy tables (including `users`) are created on startup. If your `main.py` already has a lifespan or `create_all` call, merge rather than replace.

> **Only add the `/auth` proxy entry to your existing `vite.config.ts`** — do not replace the file, as your existing config already handles `VITE_BACKEND_URL` loading correctly. Find the `proxy` block and add one line:
>
> ```ts
> proxy: {
>   "/api":  { target: env.VITE_BACKEND_URL, changeOrigin: true }, // already exists
>   "/auth": { target: env.VITE_BACKEND_URL, changeOrigin: true }, // ADD THIS
> },
> ```
>
> If `vite.config.ts` does not yet have a proxy block at all, add the full `server.proxy` section without changing how `env` / `loadEnv` is called.

---

### 6. Frontend — Install Packages

All frontend packages are installed during Prerequisites above. If you skipped that step:

**macOS/Linux / Windows (Command Prompt):**
```bash
cd frontend && npm install @azure/msal-browser @azure/msal-react axios
```

**Windows (PowerShell):**
```powershell
Set-Location frontend; npm install @azure/msal-browser @azure/msal-react axios
```

---

### 7. Frontend — MSAL Config

Create **`frontend/src/config/msalConfig.ts`**:

```ts
import {
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-browser";

const msalConfig: Configuration = {
  auth: {
    clientId: "543a4c83-793f-4a37-b7d0-4c30be94a9f2",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
  scopes: ["User.Read", "Files.Read"],
};
```

---

### 8. Frontend — Initialize MSAL in main.tsx

Replace `frontend/src/main.tsx` with the following. This wraps `createRoot` so it only runs **after** MSAL has finished `handleRedirectPromise`, preventing a race condition where React renders before the redirect response is processed:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { msalInstance, loginRequest } from "./config/msalConfig";

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .then(async (response) => {
    if (response?.account) {
      try {
        const tokenResult = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: response.account,
        });
        const msAccessToken = tokenResult.accessToken;

        const res = await fetch("/auth/microsoft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: msAccessToken }),
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("msToken", msAccessToken);
        } else {
          console.error("Backend Microsoft login failed:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Microsoft token acquisition error:", err);
      }
      // Clean up any MSAL-appended hash/query params from the URL
      history.replaceState(null, "", window.location.pathname);
    }
  })
  .catch((err) => console.error("handleRedirectPromise error:", err))
  .finally(renderApp);
```

---

### 9. Frontend — Wrap App with MsalProvider

Wrap the root of your app with `<MsalProvider>`. The minimal version below works with the scaffold as-is. The `client` import is only needed once you have created `frontend/src/api/client.ts` in Section 11.

Minimal version (no dependencies beyond MSAL):

```tsx
import { MsalProvider } from "@azure/msal-react";
import "./App.css";
import { msalInstance } from "./config/msalConfig";

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <h1>py-workflow</h1>
    </MsalProvider>
  );
}
```

Full version with routing (only if your project already has React Router + AuthContext + React Query installed):

```tsx
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./config/msalConfig";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </MsalProvider>
  );
}
```

Add the OneDrive route:

```tsx
import OneDrivePage from "./pages/OneDrivePage";

// Inside the Routes:
<Route path="/onedrive" element={<PrivateRoute><OneDrivePage /></PrivateRoute>} />
```

---

### 10. Frontend — AuthContext

Create **`frontend/src/context/AuthContext.tsx`** first — it defines the `User` type that subsequent files import.

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { msalInstance } from "../config/msalConfig";

export interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  msToken: string | null;
  loginWithMs: (token: string, user: User, msAccessToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [msToken, setMsToken] = useState<string | null>(() =>
    localStorage.getItem("msToken"),
  );

  const loginWithMs = useCallback(
    (newToken: string, newUser: User, msAccessToken: string) => {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      localStorage.setItem("msToken", msAccessToken);
      setToken(newToken);
      setUser(newUser);
      setMsToken(msAccessToken);
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("msToken");
    setToken(null);
    setUser(null);
    setMsToken(null);
    // Clear the MSAL session so the next sign-in prompts the user rather than auto-authenticating
    msalInstance.logoutRedirect({ onRedirectNavigate: () => false }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, msToken, loginWithMs, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
```

---

### 11. Frontend — HTTP Client

Create **`frontend/src/api/client.ts`** (axios wrapper used by all API modules):

```ts
import axios from "axios";

const client = axios.create({
  baseURL: "/",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
```

---

### 12. Frontend — Auth API

In **`frontend/src/api/auth.ts`**:

```ts
import client from "./client";
import type { User } from "../context/AuthContext";

export type { User };

export const microsoftLogin = (access_token: string) =>
  client.post<{ token: string; user: User }>("/auth/microsoft", {
    access_token,
  });
```

> `User` is defined once in `AuthContext.tsx` and re-exported here so callers that import from `./api/auth` still get the type without duplication.

---

### 13. Frontend — Login Page with Microsoft Button

**`frontend/src/pages/LoginPage.tsx`**:

Use `useMsal()` to call `instance.loginRedirect(loginRequest)`:

```tsx
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/msalConfig";

export default function LoginPage() {
  const { instance } = useMsal();

  const handleMicrosoftLogin = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Microsoft login error:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem" }}>
      <h1>Sign in</h1>
      <button
        onClick={handleMicrosoftLogin}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", cursor: "pointer" }}
      >
        <svg width="20" height="20" viewBox="0 0 21 21">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        Sign in with Microsoft
      </button>
    </div>
  );
}
```

---

### 14. Frontend — OneDrive Page

Create **`frontend/src/pages/OneDrivePage.tsx`**:

```tsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime: string;
  folder?: object;
  file?: object;
  webUrl?: string;
  parentReference?: { id: string };
}

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

function formatSize(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function OneDrivePage() {
  const { msToken } = useAuth();
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([
    { id: null, name: "My Drive" },
  ]);

  const currentFolder = breadcrumb[breadcrumb.length - 1];

  useEffect(() => {
    if (!msToken) {
      setError("No Microsoft token found. Please sign in with Microsoft.");
      return;
    }

    const url =
      currentFolder.id === null
        ? `${GRAPH_ROOT}/me/drive/root/children`
        : `${GRAPH_ROOT}/me/drive/items/${currentFolder.id}/children`;

    setLoading(true);
    setError(null);

    fetch(url, { headers: { Authorization: `Bearer ${msToken}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`Graph API error: ${res.status}`);
        return res.json();
      })
      .then((data: { value: DriveItem[] }) => setItems(data.value))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [msToken, currentFolder.id]);

  const openFolder = (item: DriveItem) => {
    setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }]);
  };

  const navigateTo = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  if (!msToken) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <div style={{ padding: "1rem" }}>
      <h2>OneDrive</h2>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: "1rem" }}>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id ?? "root"}>
            {i < breadcrumb.length - 1 ? (
              <>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "blue", padding: 0 }}
                  onClick={() => navigateTo(i)}
                >
                  {crumb.name}
                </button>
                {" / "}
              </>
            ) : (
              <strong>{crumb.name}</strong>
            )}
          </span>
        ))}
      </nav>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Name</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Size</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Modified</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderTop: "1px solid #ddd" }}>
                <td style={{ padding: "0.4rem" }}>
                  {item.folder ? (
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", color: "blue", padding: 0 }}
                      onClick={() => openFolder(item)}
                    >
                      📁 {item.name}
                    </button>
                  ) : (
                    <span>📄 {item.name}</span>
                  )}
                </td>
                <td style={{ padding: "0.4rem" }}>{formatSize(item.size)}</td>
                <td style={{ padding: "0.4rem" }}>
                  {new Date(item.lastModifiedDateTime).toLocaleDateString()}
                </td>
                <td style={{ padding: "0.4rem" }}>
                  {item.webUrl && (
                    <a href={item.webUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "0.4rem", color: "gray" }}>
                  Empty folder
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

### 15. Frontend — Nav Link

In **`frontend/src/components/Layout.tsx`**, add nav item:

```ts
{ to: "/onedrive", label: "OneDrive", icon: "☁️" },
```

---

## Testing

1. Start services (tables are auto-created on startup):
   - **macOS/Linux:** `bash scripts/start-all.sh`
   - **Windows:** `scripts\start-all.bat` (or `cmd /c "scripts\start-all.bat"` in PowerShell)
2. Open the frontend URL — read the port from root `.env`:
   - **macOS/Linux:** `source .env && echo "http://localhost:$FRONTEND_PORT"`
   - **Windows (PowerShell):** `(Select-String "^FRONTEND_PORT=" .env).Line.Split("=")[1]` then open `http://localhost:<port>`
3. Click **"Sign in with Microsoft"**
4. Sign in with your Microsoft account
5. Navigate to the **OneDrive** page from the sidebar
6. Browse folders and download files

### Debugging

| Problem                                   | Likely Cause                                                |
| ----------------------------------------- | ----------------------------------------------------------- |
| Popup opens then blank page               | Popup blocked by browser — use redirect flow (see main.tsx) |
| Redirect back to site but nothing happens | `handleRedirectPromise()` not called before React renders   |
| "Microsoft token invalid" error           | Azure AD redirect URI not matching frontend URL             |
| OneDrive shows "no msToken"               | User logged in with email/password, not Microsoft SSO       |

---

## Quick Reference

| Action                | Command / File                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| App Registration ID   | `543a4c83-793f-4a37-b7d0-4c30be94a9f2`                                           |
| Install MSAL + axios  | `cd frontend && npm install @azure/msal-browser @azure/msal-react axios`         |
| MSAL config file      | `frontend/src/config/msalConfig.ts`                                              |
| HTTP client           | `frontend/src/api/client.ts`                                                     |
| Auth context          | `frontend/src/context/AuthContext.tsx`                                           |
| JWT helper            | `backend/services/auth.py`                                                       |
| Login page            | `frontend/src/pages/LoginPage.tsx`                                               |
| OneDrive page         | `frontend/src/pages/OneDrivePage.tsx`                                            |
| Backend endpoint      | `backend/routers/auth.py` → `POST /auth/microsoft`                               |
| User model            | `backend/models/user.py`                                                         |
| User repository       | `backend/repositories/user_repo.py`                                              |
