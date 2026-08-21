---
name: ms-email
description: Send system emails using Microsoft 365 / Exchange Online SMTP (smtp.office365.com). Use when user wants to send emails from the system, add email notifications, implement email sending endpoints, or configure SMTP with a Microsoft sender.
---

# Microsoft 365 Email Sending

This skill sets up SMTP email sending via Microsoft 365 using the built-in `smtplib` and `email` Python libraries.

## Credentials

| Field     | Value                              |
| --------- | ---------------------------------- |
| SMTP Host | `smtp.office365.com`               |
| Port      | `587`                              |
| TLS       | Yes (STARTTLS)                     |
| Username  | `vibe.coder@asiaalliedgroup.com`   |
| Password  | Store in `.env` (see step 1 below) |

---

## Files to Create / Modify

### 1. Backend — Add SMTP config to `.env`

In **`backend/.env`**, add:

```env
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=vibe.coder@asiaalliedgroup.com
SMTP_PASSWORD=YudyeTtsd5##11##1
SMTP_FROM_EMAIL=vibe.coder@asiaalliedgroup.com
SMTP_FROM_NAME=Vibe Coder
```

> **Security note**: The `.env` file is **not** committed to git. If you need these in a production deployment, set them as environment variables in your orchestrator or CI/CD secrets manager — do **not** edit `devops/docker-compose.yml`.

---

### 2. Backend — Create email service

First, add the `email-validator` dependency (required by Pydantic `EmailStr`) and `aiosmtplib` (async SMTP client). Update **both** `backend/pyproject.toml` and `backend/requirements.txt` — local dev uses `uv` (pyproject), but the production Docker image (`devops/backend/Dockerfile`) installs from `requirements.txt`, so they must stay in sync.

**`backend/pyproject.toml`:**

```toml
dependencies = [
    # ...existing...
    "email-validator>=2.0.0",
    "aiosmtplib>=3.0.0",
]
```

**`backend/requirements.txt`:** append `email-validator` and `aiosmtplib` lines.

Then run:

**macOS/Linux / Windows (Command Prompt):**

```bash
cd backend && uv sync
```

**Windows (PowerShell):**

```powershell
Set-Location backend; uv sync
```

Make sure the package marker files exist so the `from services.email import ...` import resolves cleanly. Pick the snippet for your shell:

**macOS/Linux:**

```bash
mkdir -p backend/services backend/routers backend/templates/email
touch backend/services/__init__.py backend/routers/__init__.py
```

**Windows (Command Prompt):**

```bat
for %d in (services routers) do (
  if not exist backend\%d mkdir backend\%d
  if not exist backend\%d\__init__.py type nul > backend\%d\__init__.py
)
if not exist backend\templates\email mkdir backend\templates\email
```

**Windows (PowerShell):**

```powershell
"services","routers" | ForEach-Object {
  New-Item -ItemType Directory -Force -Path "backend\$_" | Out-Null
  New-Item -ItemType File -Force -Path "backend\$_\__init__.py" | Out-Null
}
New-Item -ItemType Directory -Force -Path "backend\templates\email" | Out-Null
```

Create **`backend/services/email.py`**:

```python
import os
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Optional

import aiosmtplib
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr

load_dotenv(Path(__file__).parent.parent / ".env", override=False)


class EmailConfig(BaseModel):
    server: str = "smtp.office365.com"
    port: int = 587
    username: str
    password: str
    from_email: str
    from_name: str = ""


class EmailMessage(BaseModel):
    to: List[EmailStr]
    subject: str
    html_body: str
    text_body: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None


def _get_config_from_env() -> EmailConfig:
    """Read SMTP config from backend/.env or process env."""
    return EmailConfig(
        server=os.getenv("SMTP_SERVER", "smtp.office365.com"),
        port=int(os.getenv("SMTP_PORT", "587")),
        username=os.getenv("SMTP_USERNAME", ""),
        password=os.getenv("SMTP_PASSWORD", ""),
        from_email=os.getenv("SMTP_FROM_EMAIL", ""),
        from_name=os.getenv("SMTP_FROM_NAME", ""),
    )


async def send_email(msg: EmailMessage, config: Optional[EmailConfig] = None) -> dict:
    """
    Send an email via Microsoft 365 SMTP (async, non-blocking).

    Returns {"success": True} or raises on failure.
    """
    cfg = config or _get_config_from_env()
    if not cfg.username or not cfg.password:
        raise RuntimeError("SMTP_USERNAME / SMTP_PASSWORD not set in backend/.env")

    mime = MIMEMultipart("alternative")
    mime["From"] = f"{cfg.from_name} <{cfg.from_email}>" if cfg.from_name else cfg.from_email
    mime["To"] = ", ".join(msg.to)
    mime["Subject"] = msg.subject
    if msg.cc:
        mime["Cc"] = ", ".join(msg.cc)

    text_body = msg.text_body or _strip_html(msg.html_body)
    mime.attach(MIMEText(text_body, "plain"))
    mime.attach(MIMEText(msg.html_body, "html"))

    recipients = list(msg.to) + list(msg.cc or []) + list(msg.bcc or [])

    await aiosmtplib.send(
        mime,
        hostname=cfg.server,
        port=cfg.port,
        start_tls=True,
        username=cfg.username,
        password=cfg.password,
        sender=cfg.from_email,
        recipients=recipients,
    )
    return {"success": True}


def _strip_html(html: str) -> str:
    """Naive HTML-to-text conversion for email fallback."""
    text = re.sub(r"<[^>]+>", "", html)
    text = re.sub(r"\n\s*\n", "\n\n", text)
    return text.strip()
```

> Why async? FastAPI route handlers run on the event loop. Blocking `smtplib.SMTP` (TLS handshake + remote round-trips) freezes the entire process for every other in-flight request. `aiosmtplib` is API-compatible and event-loop friendly.

---

### 3. Backend — Create email sending endpoint

First add an API key to `backend/.env` so the endpoint is not exposed unauthenticated:

```env
EMAIL_API_KEY=replace-with-a-long-random-string
```

Create **`backend/routers/email.py`**:

```python
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr

from services.email import EmailMessage, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["email"])


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    expected = os.getenv("EMAIL_API_KEY")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="EMAIL_API_KEY not configured on server",
        )
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )


class SendEmailRequest(BaseModel):
    to: list[EmailStr]
    subject: str
    html_body: str
    text_body: Optional[str] = None
    cc: Optional[list[EmailStr]] = None


class SendEmailResponse(BaseModel):
    success: bool
    message: str


@router.post(
    "/send",
    response_model=SendEmailResponse,
    dependencies=[Depends(require_api_key)],
)
async def api_send_email(body: SendEmailRequest):
    """Send a system email. Requires X-API-Key header matching EMAIL_API_KEY."""
    try:
        msg = EmailMessage(
            to=body.to,
            subject=body.subject,
            html_body=body.html_body,
            text_body=body.text_body,
            cc=body.cc,
        )
        await send_email(msg)
        return SendEmailResponse(success=True, message="Email sent")
    except Exception as e:
        logger.exception("Failed to send email")
        raise HTTPException(status_code=500, detail=str(e))
```

> Without `X-API-Key` guard, anyone who can reach port 8080 (or your prod LB) can spray spam from your Microsoft 365 account and get the tenant blacklisted. Treat this key like a password and rotate if leaked.

---

### 4. Backend — Register router in `main.py`

In **`backend/main.py`**, add:

```python
from routers.email import router as email_router

# Add this alongside the existing router includes:
app.include_router(email_router)
```

---

### 5. Backend — HTML email templates

Create **`backend/templates/email/`** directory and add a base template.

> The renderer below uses Python's `string.Template` (`$var` syntax), **not** Jinja2 (`{{ var }}`). This keeps the dependency list small. Use `$$` if you ever need a literal dollar sign.

**`backend/templates/email/base.html`**:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background: #f4f4f4;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 24px;
      }
      .header {
        background: #0078d4;
        color: white;
        padding: 24px;
        border-radius: 8px 8px 0 0;
      }
      .header h1 {
        margin: 0;
        font-size: 20px;
      }
      .body {
        background: white;
        padding: 24px;
        border-radius: 0 0 8px 8px;
      }
      .footer {
        margin-top: 16px;
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      .button {
        display: inline-block;
        background: #0078d4;
        color: white;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 4px;
        margin: 16px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>$title</h1>
      </div>
      <div class="body">$content</div>
      <div class="footer">
        <p>Sent by Vibe Coder &mdash; asiaalliedgroup.com</p>
      </div>
    </div>
  </body>
</html>
```

> The `content` substitution is inserted as-is (no HTML escaping). Only pass HTML strings you trust; never interpolate raw user input here.

---

### 6. Backend — Template rendering helper

Add to **`backend/services/email.py`** or create **`backend/services/template.py`**:

```python
from pathlib import Path
from string import Template


def render_email_template(template_name: str, **kwargs) -> str:
    """Load an HTML email template and substitute variables."""
    template_path = Path(__file__).parent.parent / "templates" / "email" / template_name
    if not template_path.exists():
        raise FileNotFoundError(f"Email template not found: {template_path}")

    raw = template_path.read_text(encoding="utf-8")
    return Template(raw).safe_substitute(**kwargs)
```

---

## Usage example

```python
# In any async route or background task:
from services.email import send_email, EmailMessage
from services.template import render_email_template

html = render_email_template(
    "base.html",
    title="Welcome!",
    content="<p>Thank you for joining our platform.</p>",
)

await send_email(EmailMessage(
    to=["user@example.com"],
    subject="Welcome to Vibe Coder",
    html_body=html,
))
```

Or via the API — read the port from root `.env` and pass the API key via the `X-API-Key` header:

**macOS/Linux:**

```bash
source .env && curl -X POST "http://localhost:$BACKEND_PORT/email/send" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EMAIL_API_KEY" \
  -d '{
    "to": ["user@example.com"],
    "subject": "Welcome!",
    "html_body": "<h1>Hello!</h1><p>Welcome aboard.</p>"
  }'
```

**Windows (PowerShell):**

```powershell
$bp = (Select-String "^BACKEND_PORT=" .env).Line.Split("=")[1]
curl.exe -X POST "http://localhost:$bp/email/send" `
  -H "Content-Type: application/json" `
  -H "X-API-Key: $env:EMAIL_API_KEY" `
  -d '{\"to\":[\"user@example.com\"],\"subject\":\"Welcome!\",\"html_body\":\"<h1>Hello!</h1><p>Welcome aboard.</p>\"}'
```

---

## Testing

1. Restart backend:
   - **macOS/Linux:** `bash scripts/stop-all.sh && bash scripts/start-all.sh`
   - **Windows:** `scripts\stop-all.bat && scripts\start-all.bat` (or `cmd /c "scripts\stop-all.bat && scripts\start-all.bat"` in PowerShell)
2. Check logs in the backend terminal window
3. Send a test email via the API (see curl example above)
4. Or run a quick Python test locally (async — note the `asyncio.run` wrapper):

   **macOS/Linux:**

   ```bash
   cd backend && uv run python -c "
   import asyncio
   from services.email import EmailMessage, send_email
   asyncio.run(send_email(EmailMessage(
       to=['vibe.coder@asiaalliedgroup.com'],
       subject='Test from Vibe Coder',
       html_body='<h1>Test</h1><p>Email system works!</p>',
   )))
   print('Email sent successfully')
   "
   ```

   **Windows (PowerShell):**

   ```powershell
   @"
   import asyncio
   from services.email import EmailMessage, send_email
   asyncio.run(send_email(EmailMessage(
       to=['vibe.coder@asiaalliedgroup.com'],
       subject='Test from Vibe Coder',
       html_body='<h1>Test</h1><p>Email system works!</p>',
   )))
   print('Email sent successfully')
   "@ | Out-File -Encoding utf8 backend\test_email_tmp.py
   Set-Location backend; uv run python test_email_tmp.py
   Remove-Item backend\test_email_tmp.py
   ```

### Debugging

| Problem                 | Likely cause                                         | Fix                                                                                                   |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Authentication failed` | Wrong password or SMTP username                      | Check `.env` values                                                                                   |
| `Connection timed out`  | SMTP port blocked (e.g. firewall, corporate network) | Try port 25 as fallback                                                                               |
| `STARTTLS` error        | Server not supporting TLS on port 587                | Ensure `smtp.office365.com` is correct                                                                |
| Connection refused      | Backend not running                                  | Start backend: `bash scripts/start-backend.sh` (macOS/Linux) or `scripts\start-backend.bat` (Windows) |
| Emails going to spam    | No SPF/DKIM/DMARC for domain                         | Ask your admin to configure domain auth                                                               |

---

## Quick Reference

| Action             | File / Command                                                   |
| ------------------ | ---------------------------------------------------------------- |
| SMTP config        | `backend/.env` — `SMTP_SERVER`, `SMTP_USERNAME`, `SMTP_PASSWORD` |
| Email service      | `backend/services/email.py`                                      |
| Send endpoint      | `backend/routers/email.py` — `POST /email/send`                  |
| HTML templates     | `backend/templates/email/`                                       |
| Template renderer  | `backend/services/template.py`                                   |
| Test send (inline) | `cd backend && uv run python -c "..."`                           |
