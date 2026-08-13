@echo off
setlocal
title API Workbench
cd /d "%~dp0"

echo.
echo  API Workbench v1.1.3
echo  ====================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install the current Node.js LTS release from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

for %%F in ("src\App.jsx" "src\requestSettings.js" "src\requestDiagnostics.js" "src\version.js" "vite.config.js" "package.json") do (
  if not exist "%%~F" (
    echo ERROR: Required file is missing: %%~F
    echo Extract the complete API Workbench release into a new folder.
    pause
    exit /b 1
  )
)

echo Checking dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: Dependency installation failed.
  pause
  exit /b 1
)

echo.
echo Starting API Workbench...
echo Preferred address: http://localhost:5173
echo If port 5173 is occupied, the next available port will be selected.
echo Your default browser will open after the server is ready.
echo Press Ctrl+C to stop the server.
echo.

call npm run dev
set "API_WORKBENCH_EXIT=%ERRORLEVEL%"
if not "%API_WORKBENCH_EXIT%"=="0" (
  echo.
  echo API Workbench stopped with exit code %API_WORKBENCH_EXIT%.
  pause
)
exit /b %API_WORKBENCH_EXIT%
