@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: 'git' is not installed or not on your PATH.
    pause
    exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: 'gh' is not installed or not on your PATH.
    pause
    exit /b 1
)

set "NONINTERACTIVE=0"
if not "%~1"=="" (
    set "REPONAME=%~1"
    set "NONINTERACTIVE=1"
) else (
    echo ⚡ Welcome to the Project Initializer ⚡
    echo ----------------------------------------
    set /p "REPONAME=👉 Enter the name for your new GitHub project: "
)

if "%REPONAME%"=="" (
    echo ❌ Error: You must provide a project name.
    pause
    exit /b 1
)

echo.
echo 🚀 Starting automation for: %REPONAME%...
echo ----------------------------------------

if exist .git (
    echo 📂 Removing old lesson history...
    rmdir /s /q .git
)

echo 📝 Creating a brand new Git history...
git init -b main
if errorlevel 1 ( echo ❌ git init failed. & pause & exit /b 1 )

git add .
if errorlevel 1 ( echo ❌ git add failed. & pause & exit /b 1 )

git commit -m "Initial commit from lesson template"
if errorlevel 1 ( echo ❌ git commit failed. & pause & exit /b 1 )

echo 🌐 Creating repository on GitHub and uploading...
gh repo create "%REPONAME%" --private --source=. --push
if errorlevel 1 ( echo ❌ gh repo create failed. & pause & exit /b 1 )

echo ----------------------------------------
echo ✅ All done! Your new project is live on GitHub.
if "%NONINTERACTIVE%"=="0" pause
