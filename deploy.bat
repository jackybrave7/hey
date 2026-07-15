@echo off
cd /d "%~dp0"
if not exist "%~dp0deploy.ps1" (
  echo ERROR: deploy.ps1 not found in %~dp0
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
if errorlevel 1 pause
