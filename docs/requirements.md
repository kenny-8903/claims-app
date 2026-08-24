# Project Requirements

This document captures user stories, requirements, and their traceability to features during the vibe-coding process. It is continuously updated as the project evolves.

---

## 📖 User Stories

Each story is logged in the format:

**As a [role], I want [feature] so that [benefit].**

- As a **4-Tier organization**, I want **an amount-based dynamic approval workflow** so that **low-value claims skip senior approval while high-value claims get full executive scrutiny**.
- As a **Finance & Admin (Level 4)**, I want **a final approval/disbursement gate** so that **no claim is paid out until I have approved it**.
- As an **Operations Staff (Level 1)**, I want **to create and view only my own claims** so that **I have visibility over my submissions without accessing others' data**.
- As a **General Manager (Level 2)** and **CEO (Level 3)**, I want **to see exactly the claims queued at my approval tier** so that **I can process approvals efficiently**.
- As an **approver**, I want **to reject claims with a mandatory reason** so that **applicants know exactly what to fix**.
- As an **applicant**, I want **to resubmit a rejected claim with edited documents** so that **I can fix issues and re-enter the approval flow**.
- As an **applicant**, I want **receipt OCR to auto-fill date and amount** so that **I can submit claims faster and with fewer typos**.
- As a **developer**, I want **a Local-mock / Vercel-real-AI dual-mode OCR** so that **local demos stay offline while production gets real Gemini AI**.
- As a **developer**, I want **a Vercel Serverless OCR relay API** so that **Gemini is called from the server and the Hong Kong IP geo-restriction is bypassed**.

---

## 📝 Requirements

### User Story: 4-Tier Role Architecture + Dynamic Amount Routing

- **Functional Requirements**
  - FR-101: System provides four access levels (Level 1–4) with demo accounts Testing1–Testing4 (password `123456`).
  - FR-102: Testing1 (Level 1, Operations Staff) can only create and view their own claims.
  - FR-103: Testing2 (Level 2, General Manager / GM) is the first-tier approver.
  - FR-104: Testing3 (Level 3, CEO) is the second-tier senior approver.
  - FR-105: Testing4 (Level 4, Finance & Admin) is the final approver/disburser.
  - FR-106: Claims under $10,000 route: submit → GM (1st) → skip CEO → Finance (final).
  - FR-107: Claims at/above $10,000 route: submit → GM (1st) → CEO (2nd) → Finance (final).
  - FR-108: Permission Management table shows the four levels with 1st/2nd/3rd-tier approval toggles.
  - FR-109: Login page provides demo quick-login buttons including Testing4 (Level 4 Finance).

- **Non-Functional Requirements**
  - NFR-101: Approval routing is computed dynamically from the claim amount in real time.
  - NFR-102: UI reflects the current user's approval permissions only (least privilege).

- **Constraints**
  - C-101: All changes are local-only; no `git push`.
  - C-102: Existing immutable files (`.env`, docker/devops config) must not be changed.

### User Story: Reject with Reason & Resubmit Workflow

- **Functional Requirements**
  - FR-201: Sample data covers low/high amounts, different approval stages, and a rejected claim (CL-2026-001..004, all submitted by Testing1).
  - FR-202: Approvers (GM/CEO/Finance) clicking "駁回" open a modal requiring a rejection reason.
  - FR-203: Submitting a rejection sets the claim status to "已被駁回" and records reason, rejecter name, and timestamp.
  - FR-204: The applicant sees rejected claims in "我的申請紀錄" with rejection reason and rejecter, plus a "重新編輯 / 補交文件" button.
  - FR-205: Resubmitting pre-fills the claim form, allows editing content and appending/re-uploading documents.
  - FR-206: Resubmission resets status to "待 GM 審批", clears rejection info, keeps the claim id, and re-enters the approval flow.

- **Acceptance Criteria**
  - AC-201: Empty rejection reason cannot be submitted (inline error shown).
  - AC-202: After rejection, the claim disappears from the approver's queue and appears resubmittable in the applicant's My Claims.
  - AC-203: Resubmission restores the claim to the GM queue with `pending_1st` status.

### User Story: PaddleOCR Receipt Recognition Module

- **Functional Requirements**
  - FR-301: `src/services/ocrService.js` exposes `processReceiptOCR(file)` returning `{ confidence, extractedDate, extractedAmount }`.
  - FR-302: Provides `USE_REAL_API` switch and a fetch interface (`POST /api/ocr/receipt`) for future backend integration.
  - FR-303: Uploading/dragging an image shows "✨ PaddleOCR v4 引擎分析中..." loading state.
  - FR-304: On completion, shows a "PaddleOCR Confidence: xx.x%" tag with the analyzed file name.
  - FR-305: Extracted date and amount are auto-filled into the expense date and reimbursement amount fields.
  - FR-306: Shows success hint "已由 PaddleOCR 自動帶入，可手動修正".

- **Non-Functional Requirements**
  - NFR-301: OCR simulation is self-contained (no external dependencies) and deployable on Vercel.
  - NFR-302: Real API path is toggleable without changing the UI contract.

- **Acceptance Criteria**
  - AC-301: `npm run build` passes with no syntax errors or missing packages.
  - AC-302: OCR fills date/amount and the fields remain manually editable.

### User Story: OCR Dual-Mode — Local Mock (HK) / Vercel Real Gemini AI

- **Functional Requirements**
  - FR-401: Auto environment detection — Gemini is used only in production (`import.meta.env.PROD`) when `VITE_GEMINI_API_KEY` exists.
  - FR-402: Gemini 1.5 Flash Vision extracts amount/date/merchant as JSON and falls back gracefully on HK region restriction (400/403 "User location not supported") or any API failure.
  - FR-403: Local Smart Mock maps filenames (`apollo`/default → HK$200 2018-12-24 APOLLO; `taxi` → HK$120; `mcdonald` → HK$45.5) and dynamically generates HK$150–1,500 for other images.
  - FR-404: UI shows engine-specific tags: "✨ Google Gemini AI 辨識成功" vs "✨ OCR 辨識成功 (Local Demo 模式)".
  - FR-405: `.env.local` holds `VITE_GEMINI_API_KEY` (git-ignored via `*.local`).

- **Non-Functional Requirements**
  - NFR-401: Graceful degradation — any Gemini error must never break the upload flow.
  - NFR-402: `VITE_GEMINI_API_KEY` must not be committed to git.

- **Acceptance Criteria**
  - AC-401: Uploading `apollo.jpg`/`taxi.jpg`/`mcdonald.jpg` in local dev fills the correct amounts and shows the Local Demo tag.
  - AC-402: Production build passes; Gemini path attempts real API and falls back on failure.

### User Story: Vercel Serverless OCR Relay API (Bypass HK IP Restriction)

- **Functional Requirements**
  - FR-501: `api/ocr.js` — a Vercel Node Serverless Function accepting a base64 image via POST.
  - FR-502: Server-side call to Gemini 1.5 Flash Vision using `process.env.GEMINI_API_KEY`, bypassing browser-side HK geo-restriction.
  - FR-503: Gemini prompt returns strict JSON `{"amount", "date", "merchant"}`; server validates and normalizes the response.
  - FR-504: Frontend `processReceiptOCR(file)` POSTs the base64 image to `/api/ocr` and fills the form on success.
  - FR-505: UI shows "✨ Google Gemini AI 辨識成功 (Vercel Serverless)" on server success, else falls back to "Local Demo 模式".
  - FR-506: `vercel.json` catch-all rewrite excludes `/api/*` so the Serverless Function is reachable.

- **Non-Functional Requirements**
  - NFR-501: Any `/api/ocr` failure (network, 4xx/5xx, missing key) falls back to the Local mock engine without breaking the upload flow.
  - NFR-502: Request body capped (~3MB image) to stay within Vercel's 4.5MB Node function body limit.

- **Acceptance Criteria**
  - AC-501: `api/ocr.js` passes `node --check` and returns 400/405/413/500 correctly on invalid inputs.
  - AC-502: Local dev (no `/api/ocr`) smoothly degrades to the mock engine with the Local Demo tag.

- **Acceptance Criteria**
  - AC-101: Logging in as Testing1 shows only own claims and no approval queue.
  - AC-102: A claim of $9,999 shows GM → Finance path (CEO skipped); $10,000 shows GM → CEO → Finance.
  - AC-103: Testing4 sees all `pending_3rd` claims and can approve them to "已核准放款".
  - AC-104: Permission Management is accessible only to Level 4 (Finance & Admin).
  - AC-105: The app builds (`npm run build`) and preview runs at the configured frontend port.

---

## 📊 Requirement Traceability Matrix (RTM)

| Requirement ID | Requirement Description                          | Feature/Module            | User Story Reference                           | Status      |
|----------------|--------------------------------------------------|---------------------------|-----------------------------------------------|-------------|
| FR-101         | Four access levels with demo accounts Testing1–4 | Auth & Role Config        | 4-Tier organization wants role architecture   | Complete    |
| FR-102         | Level 1 creates/views only own claims            | Claim Permissions         | Operations Staff wants own-claims visibility  | Complete    |
| FR-103         | Level 2 GM is 1st-tier approver                  | Approval Workflow         | GM wants tiered approval                      | Complete    |
| FR-104         | Level 3 CEO is 2nd-tier approver                 | Approval Workflow         | CEO wants senior approval stage               | Complete    |
| FR-105         | Level 4 Finance is final approver/disburser      | Approval Workflow         | Finance & Admin wants final gate              | Complete    |
| FR-106         | < $10,000 skips CEO                              | Amount-Based Routing      | Organization wants dynamic amount routing     | Complete    |
| FR-107         | >= $10,000 adds CEO stage                        | Amount-Based Routing      | Organization wants dynamic amount routing     | Complete    |
| FR-108         | Permission table with 3 approval-tier toggles    | Permission Management UI  | Organization wants configurable approvers     | Complete    |
| FR-109         | Login demo buttons include Testing4              | Login UI                  | User wants one-click demo access              | Complete    |
| NFR-101        | Real-time dynamic routing from amount            | Amount-Based Routing      | Organization wants dynamic amount routing     | Complete    |
| NFR-102        | Least-privilege UI per role                      | Permissions Layer         | Organization wants least privilege            | Complete    |
| C-101          | Local-only changes, no git push                  | Delivery Constraint       | User wants local-only edits                   | Verified    |
| C-102          | Immutable config files untouched                 | Infrastructure            | User wants no infra changes                   | Verified    |
| AC-101         | Testing1 sees only own claims                    | Claim Permissions         | Operations Staff wants own-claims visibility  | Verified    |
| AC-102         | $9,999 vs $10,000 routing boundary               | Amount-Based Routing      | Organization wants dynamic amount routing     | Verified    |
| AC-103         | Testing4 final approval to disbursed             | Approval Workflow         | Finance & Admin wants final gate              | Verified    |
| AC-104         | Permission mgmt only for Level 4                 | Permission Management UI  | User wants admin-only controls                | Verified    |
| AC-105         | Build + preview succeed                          | Delivery Validation       | User wants a runnable preview                 | Verified    |
| FR-201         | Sample data: amounts/stages/rejected claim       | Sample Data               | Approver wants realistic demo data            | Complete    |
| FR-202         | Reject opens modal with mandatory reason         | Reject & Resubmit         | Approver wants reason-based rejection         | Complete    |
| FR-203         | Rejection records reason/rejecter/timestamp      | Reject & Resubmit         | Applicant wants clear rejection feedback      | Complete    |
| FR-204         | My Claims shows rejection info + resubmit button | Reject & Resubmit         | Applicant wants to fix and resubmit           | Complete    |
| FR-205         | Resubmit pre-fills form & appends documents      | Reject & Resubmit         | Applicant wants document re-upload            | Complete    |
| FR-206         | Resubmission resets to pending_1st               | Reject & Resubmit         | Applicant wants to re-enter approval flow     | Complete    |
| AC-201         | Empty rejection reason blocked                   | Reject & Resubmit         | Approver wants mandatory reason               | Verified    |
| AC-202         | Rejected claim returns to applicant's My Claims  | Reject & Resubmit         | Applicant wants resubmission path             | Verified    |
| AC-203         | Resubmit restores GM queue (pending_1st)         | Reject & Resubmit         | Applicant wants to re-enter approval flow     | Verified    |
| FR-301         | processReceiptOCR returns extracted fields       | OCR Service               | Applicant wants OCR auto-fill                 | Complete    |
| FR-302         | USE_REAL_API switch + fetch interface            | OCR Service               | Developer wants backend integration path      | Complete    |
| FR-303         | Loading state "PaddleOCR v4 引擎分析中"          | OCR UI (Upload)           | Applicant wants OCR feedback                  | Complete    |
| FR-304         | Confidence tag after analysis                    | OCR UI (Upload)           | Applicant wants OCR transparency              | Complete    |
| FR-305         | Auto-fill extracted date & amount                | OCR UI (Form)             | Applicant wants faster claim entry            | Complete    |
| FR-306         | Success hint "已由 PaddleOCR 自動帶入"           | OCR UI (Upload)           | Applicant wants confirmation                  | Complete    |
| NFR-301        | Self-contained, Vercel-compatible                | OCR Service               | Developer wants zero-config deployment        | Complete    |
| NFR-302        | Real API toggleable via USE_REAL_API             | OCR Service               | Developer wants future backend hook           | Complete    |
| AC-301         | npm run build passes                             | Delivery Validation       | Developer wants buildable code                | Verified    |
| AC-302         | Auto-filled fields remain editable               | OCR UI (Form)             | Applicant wants manual correction             | Verified    |
| FR-401         | Auto env detection (PROD + API key → Gemini)     | OCR Service (Dual-mode)   | Developer wants Vercel real AI on production  | Complete    |
| FR-402         | Gemini JSON extraction + graceful fallback       | OCR Service (Gemini)      | Developer wants real AI with HK fallback      | Complete    |
| FR-403         | Local Smart Mock filename rules (HK)             | OCR Service (Mock)        | Developer wants offline local demo            | Complete    |
| FR-404         | Engine-specific success tags in UI               | OCR UI (Upload)           | User wants to know which engine was used      | Complete    |
| FR-405         | VITE_GEMINI_API_KEY in .env.local                | Env Config                | Developer wants key configuration             | Complete    |
| NFR-401        | Graceful degradation never breaks upload         | OCR Service (Dual-mode)   | Developer wants robust upload flow            | Complete    |
| NFR-402        | API key not committed to git                     | Env Config                | Developer wants key secrecy                   | Verified    |
| AC-401         | Mock filename rules verified in local dev        | OCR Service (Mock)        | Developer wants predictable local demo        | Verified    |
| AC-402         | Production build passes + Gemini fallback path   | OCR Service (Dual-mode)   | Developer wants safe production behavior      | Verified    |
| FR-501         | api/ocr.js Serverless Function (base64 POST)     | Vercel Serverless API     | Developer wants server-side OCR relay         | Complete    |
| FR-502         | Server-side Gemini call via GEMINI_API_KEY       | Vercel Serverless API     | Developer wants HK geo-restriction bypass     | Complete    |
| FR-503         | Strict JSON extraction + server validation       | Vercel Serverless API     | Developer wants reliable OCR data             | Complete    |
| FR-504         | Frontend POST /api/ocr + auto-fill               | OCR Service (Frontend)    | User wants Gemini results in the form         | Complete    |
| FR-505         | "(Vercel Serverless)" tag + mock fallback        | OCR UI (Upload)           | User wants engine clarity                     | Complete    |
| FR-506         | vercel.json excludes /api from catch-all rewrite | Vercel Config             | Developer wants reachable API endpoint        | Complete    |
| NFR-501        | Any /api/ocr failure falls back to mock          | OCR Service (Dual-mode)   | Developer wants robust upload flow            | Complete    |
| NFR-502        | Body size cap within Vercel 4.5MB limit          | Vercel Serverless API     | Developer wants no platform 413s              | Complete    |
| AC-501         | api/ocr.js validated (400/405/413/500 paths)     | Vercel Serverless API     | Developer wants correct error handling        | Verified    |
| AC-502         | Local dev degrades to Local Demo tag             | OCR Service (Dual-mode)   | Developer wants offline demo                  | Verified    |

---

## 🔄 Interaction Flow

During vibe-coding sessions:
1. **Capture intent**: Note the user’s immediate goal or problem.
2. **Translate to story**: Frame the intent as a user story.
3. **Extract requirements**: Identify functional, non-functional, constraints, and acceptance criteria.
4. **Validate with user**: Confirm understanding before implementation.
5. **Map to RTM**: Assign unique requirement IDs and link each requirement to its corresponding feature/module and user story in the Requirement Traceability Matrix.
6. **Iterate**: Update stories, requirements, and RTM entries as the vibe evolves.
7. **Log to file**: Append the captured story, requirements, and RTM updates into `docs/requirements.md`.

---

## ✅ Best Practices

- Keep stories **short and user-focused**.
- Avoid technical jargon in the story itself.
- Use requirements to capture details, not the story.
- Continuously refine stories as user needs evolve.
- Link related stories for traceability.
- Always log finalized stories and requirements into `docs/requirements.md`.

---

## 📌 Instruction for Logging

When a user story and its requirements are finalized, cline must **keep updating** the requirements file:

