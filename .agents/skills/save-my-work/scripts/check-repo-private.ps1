# Check that the GitHub remote is a PRIVATE repository.
# Exit 0: PRIVATE, or unable to determine (push step will catch auth failures)
# Exit 1: PUBLIC — refuse to proceed

$ErrorActionPreference = "Stop"

try {
    $null = git rev-parse --git-dir 2>$null
} catch {
    Write-Host "⚠️  No git repository found. Skipping visibility check."
    exit 0
}

$REMOTE_URL = git remote get-url origin 2>$null
if (-not $REMOTE_URL) {
    Write-Host "ℹ️  No remote 'origin' configured. Skipping visibility check."
    exit 0
}

if ($REMOTE_URL -notmatch "github.com") {
    Write-Host "ℹ️  Remote is not GitHub ($REMOTE_URL). Skipping visibility check."
    exit 0
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  GitHub CLI (gh) not installed. Cannot check visibility — proceeding anyway."
    exit 0
}

$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not authenticated with GitHub CLI. Cannot check visibility — proceeding anyway."
    exit 0
}

$REPO = $REMOTE_URL -replace '.*github.com[:/]([^/]+/[^/.]+)(\.git)?$', '$1'
$VISIBILITY = gh repo view $REPO --json visibility -q '.visibility' 2>$null

if ($VISIBILITY -eq "PUBLIC") {
    Write-Host ""
    Write-Host "⛔ SAFETY BLOCK: This repository is PUBLIC on GitHub."
    Write-Host "   save-my-work only pushes to PRIVATE repositories."
    Write-Host ""
    Write-Host "   Fix: gh repo edit --visibility private"
    Write-Host ""
    exit 1
}

Write-Host "✅ Repository is private ($VISIBILITY)."
exit 0
