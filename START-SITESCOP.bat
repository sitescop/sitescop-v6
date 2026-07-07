@echo off
title SiteScop V6 Launcher
cd /d "%~dp0"

echo.
echo  ============================================
echo   SiteScop V6 - Desktop App Launcher
echo  ============================================
echo.
echo  DO NOT open Chrome or Edge.
echo  This script opens the real desktop app.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Download from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies first...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Building app files...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Starting SiteScop V6 desktop window...
echo Look for: "SiteScop V6 - Desktop App"
echo Press F12 in THAT window for developer tools.
echo.

call npm run dev

echo.
echo SiteScop closed.
pause
