#!/usr/bin/env bash
set -euo pipefail

# Check that the GitHub remote is a PRIVATE repository.
# Exit 0: PRIVATE, or unable to determine (push step will catch auth failures)
# Exit 1: PUBLIC — refuse to proceed

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "⚠️  No git repository found. Skipping visibility check."
    exit 0
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo "ℹ️  No remote 'origin' configured. Skipping visibility check."
    exit 0
fi

if ! echo "$REMOTE_URL" | grep -q "github.com"; then
    echo "ℹ️  Remote is not GitHub ($REMOTE_URL). Skipping visibility check."
    exit 0
fi

if ! command -v gh &>/dev/null; then
    echo "⚠️  GitHub CLI (gh) not installed. Cannot check visibility — proceeding anyway."
    exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "⚠️  Not authenticated with GitHub CLI. Cannot check visibility — proceeding anyway."
    exit 0
fi

REPO=$(echo "$REMOTE_URL" | sed -E 's|.*github.com[:/]([^/]+/[^/.]+)(\.git)?$|\1|')
VISIBILITY=$(gh repo view "$REPO" --json visibility -q '.visibility' 2>/dev/null || echo "")

if [ "$VISIBILITY" = "PUBLIC" ]; then
    echo ""
    echo "⛔ SAFETY BLOCK: This repository is PUBLIC on GitHub."
    echo "   save-my-work only pushes to PRIVATE repositories."
    echo ""
    echo "   Fix: gh repo edit --visibility private"
    echo ""
    exit 1
fi

echo "✅ Repository is private ($VISIBILITY)."
exit 0
