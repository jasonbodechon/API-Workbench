@echo off
setlocal
title API Workbench
cd /d "%~dp0"

echo.
echo  API Workbench v1.4.0
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

for %%F in ("src\App.jsx" "src\urlEncoding.js" "src\responseFormatting.js" "src\requestSettings.js" "src\requestHistory.js" "src\requestDiagnostics.js" "src\version.js" "src\curlCommand.js" "src\secrets.js" "server\localRelay.js" "vite.config.js" "package.json" "package-lock.json") do (
  if not exist "%%~F" (
    echo ERROR: Required file is missing: %%~F
    echo Extract the complete API Workbench release into a new folder.
    pause
    exit /b 1
  )
)

rem Install the exact versions recorded in package-lock.json. npm ci never
rem upgrades packages, and it only runs when the lockfile has changed since
rem the last successful install.
set "LOCK_STAMP=node_modules\.api-workbench-lock"
set "NEEDS_INSTALL=1"
if exist "%LOCK_STAMP%" (
  fc /b "package-lock.json" "%LOCK_STAMP%" >nul 2>nul && set "NEEDS_INSTALL=0"
)
if "%NEEDS_INSTALL%"=="1" (
  echo Installing locked dependencies...
  call npm ci
  if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed.
    pause
    exit /b 1
  )
  copy /y "package-lock.json" "%LOCK_STAMP%" >nul
) else (
  echo Dependencies are up to date.
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
