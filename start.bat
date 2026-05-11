@echo off
title HEY Messenger
cd /d "%~dp0"

echo.
echo  ================================
echo   HEY Messenger - Запуск...
echo  ================================
echo.

:: Получаем локальный IP
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
echo  Открой нужную ссылку в браузере.
echo  Чтобы остановить - закрой это окно.
echo.
echo  ================================
echo.

npm run dev
