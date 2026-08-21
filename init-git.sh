#!/bin/bash
set -e

cd "$(dirname "$0")"

for cmd in git gh; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "❌ Error: '$cmd' is not installed or not on your PATH."
        echo "Press any key to exit..."
        read -n 1
        exit 1
    fi
done

if [ -n "${1:-}" ]; then
    REPONAME="$1"
    NONINTERACTIVE=1
else
    echo "⚡ Welcome to the Project Initializer ⚡"
    echo "----------------------------------------"
    printf "👉 Enter the name for your new GitHub project: "
    read -r REPONAME
    NONINTERACTIVE=0
fi

if [ -z "$REPONAME" ]; then
    echo "❌ Error: You must provide a project name."
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

echo ""
echo "🚀 Starting automation for: $REPONAME..."
echo "----------------------------------------"

if [ -d ".git" ]; then
    echo "📂 Removing old lesson history..."
    rm -rf .git
fi

echo "📝 Creating a brand new Git history..."
git init -b main
git add .
git commit -m "Initial commit from lesson template"

echo "🌐 Creating repository on GitHub and uploading..."
gh repo create "$REPONAME" --private --source=. --push

echo "----------------------------------------"
echo "✅ All done! Your new project is live on GitHub."
if [ "$NONINTERACTIVE" = "0" ]; then
    echo "Press any key to close this window..."
    read -n 1
fi
