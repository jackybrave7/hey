@echo off
title HEY Messenger
cd /d "%~dp0"

echo.
echo  ================================
echo   HEY Messenger - Запуск...
echo  ================================
echo.

:: Освобождаем порты 3001/5173/5174 (PowerShell — надёжнее netstat на русской Windows)
echo  Проверяем порты 3001, 5173, 5174...
for %%P in (3001 5173 5174) do (
  for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    if not "%%a"=="" (
      echo  Завершаем старый процесс PID %%a на порту %%P
      taskkill /F /PID %%a >nul 2>&1
    )
  )
)
timeout /t 2 /nobreak >nul

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  Сервер:  http://localhost:3001
echo  Фронт:   http://localhost:5173
echo  Сеть:    http://%IP%:5173
echo.
echo  Открой http://localhost:5173 в браузере.
echo  Чтобы остановить - закрой это окно или Ctrl+C.
echo.
echo  ================================
echo.

npm run dev
if errorlevel 1 (
  echo.
  echo ERROR: dev-сервер завершился с ошибкой.
  pause
)
