@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Останавливаем HEY dev (порты 3001, 5173, 5174)...
for %%P in (3001 5173 5174) do (
  for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    if not "%%a"=="" (
      echo  PID %%a - порт %%P
      taskkill /F /PID %%a >nul 2>&1
    )
  )
)
echo Готово.
pause
