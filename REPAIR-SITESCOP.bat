@echo off
title SiteScop V6 Repair
cd /d "%~dp0"

echo.
echo  SiteScop V6 - Repair launcher
echo  =============================
echo.
echo Stopping stuck SiteScop / dev server processes...
echo.

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Ending process on port 5173 ^(PID %%a^)
  taskkill /F /PID %%a >nul 2>&1
)

taskkill /F /IM electron.exe >nul 2>&1

echo.
echo Done. Now double-click START-SITESCOP.bat
echo.
pause
