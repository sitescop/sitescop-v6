@echo off
title SiteScop V6 Launcher
cd /d "%~dp0"

echo.
echo  ============================================
echo   SiteScop V6 - Desktop App Launcher
echo  ============================================
echo.

if not exist "package.json" (
  echo ERROR: Wrong folder.
  echo Run: app to develop\sitescop-v6\START-SITESCOP.bat
  pause
  exit /b 1
)

findstr /C:"\"name\": \"sitescop-v6\"" package.json >nul 2>&1
if errorlevel 1 (
  echo ERROR: This is not the SiteScop V6 project folder.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Download from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies - first time only, may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting SiteScop V6...
echo  - First launch can take 30-60 seconds
echo  - Look for the desktop window titled SiteScop V6
echo  - DO NOT use Chrome or Edge - use the desktop app window
echo  - Keep THIS window open while SiteScop is running
echo.
echo If nothing opens, run REPAIR-SITESCOP.bat then try again.
echo.

call npm run dev
set EXITCODE=%ERRORLEVEL%

echo.
if not %EXITCODE%==0 (
  echo SiteScop stopped with an error ^(code %EXITCODE%^).
  echo Try REPAIR-SITESCOP.bat, then start again.
) else (
  echo SiteScop closed.
)
pause
exit /b %EXITCODE%
