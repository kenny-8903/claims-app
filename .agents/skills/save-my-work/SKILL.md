---
name: save-my-work
description: Use when the user says "save my work", "checkpoint", "commit my changes", "push changes", "save progress", or wants to preserve the current state of the codebase.
---

# Save My Work

Saves the current project state as a git checkpoint and pushes to GitHub. Only pushes to private repos.

## Steps

### 0. Check if git repository exists

```bash
git rev-parse --git-dir 2>&1
```

- **Succeeds** → skip to **Step 0c**.
- **Fails** → run **Step 0b**.

#### 0b. Initialise (no repo found)

Ask the user for the GitHub project name, then run the init-git script with the name as argument. The script creates a **private** repo.

**Windows (PowerShell / AVD):** `cmd /c "init-git.bat <name>"`
**macOS / Linux:** `bash init-git.sh <name>`

After the script finishes, validate with `git rev-parse --git-dir`. If it fails, stop. Otherwise → **Step 0c**.

#### 0c. Verify repository is private

**Windows (PowerShell / AVD):** `! .\.agents\skills\save-my-work\scripts\check-repo-private.ps1`
**macOS / Linux:** `bash .agents/skills/save-my-work/scripts/check-repo-private.sh`

⛔ **Exit code 1 → STOP.** The script already printed the reason (public repo). Exit code 0 → **Step 1**.

### 1. Stage changes

```bash
git add -A
```

⚠️ `-A` stages everything. Check for sensitive files (`.env`, credentials) first. Prefer `git add <file>` if unsure. Any error → stop.

### 2. Commit

```bash
git commit -m "checkpoint: <brief description>"
```

First commit? `git branch -M main` first. Commit fails → stop, show error.

### 3. Push

```bash
git push
```

First push? `git push -u origin main`

⛔ **Push fails for ANY reason** → **STOP.** Show exact error. Ask user. Never auto-recover.

### 4. Confirm

```bash
git log --oneline -3
```

Tell the user: commit hash, branch, files changed.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `git add -A` staged secrets (`.env`, tokens) | `git reset` → `git add <file>` selectively |
| Pushing to a public repo | Rerun Step 0c script manually to check |
| "please tell me who you are" | `git config user.name` / `git config user.email` |
| "no upstream branch" | `git push -u origin <branch>` |
| `gh` not installed / not logged in | Step 0c skips gracefully; push step still catches auth errors |

---

## ⛔ Failure boundaries

Any step fails → **STOP, report error, wait for user.**

### Forbidden actions

`git push --force`, `--force-with-lease`, `git rebase`, `git reset --hard`, `git commit --amend`, `git merge`, `git stash drop`

### Stop conditions

| Step | Stop when |
|------|-----------|
| 0b | Init script fails or `.git` still missing |
| 0c | Repository is `PUBLIC` |
| 1 | `git add` fails |
| 2 | Commit fails |
| 3 | Push fails |
