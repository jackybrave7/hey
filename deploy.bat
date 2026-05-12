@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════╗
echo ║       HEY — Деплой на сервер     ║
echo ╚══════════════════════════════════╝
echo.

:: ── Настройки ──────────────────────────────────────────
set SERVER=root@72.56.16.44
set SSH_KEY=%USERPROFILE%\.ssh\id_ed25519
set APP_DIR=/app
:: ────────────────────────────────────────────────────────

echo [1/4] Сборка фронтенда...
call npm run build --workspace=web
if errorlevel 1 ( echo ОШИБКА: сборка провалилась & pause & exit /b 1 )
echo       OK

echo.
echo [2/4] Коммит и пуш на GitHub...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "deploy: %date% %time%"
    git -c http.sslVerify=false push
    if errorlevel 1 ( echo ОШИБКА: git push провалился & pause & exit /b 1 )
    echo       OK
) else (
    echo       Нет изменений — пропускаем коммит
)

echo.
echo [3/4] Обновление сервера...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && git pull && npm install --silent && npm run build 2>&1 | tail -5"
if errorlevel 1 ( echo ОШИБКА: обновление сервера провалилось & pause & exit /b 1 )
echo       OK

echo.
echo [4/4] Перезапуск приложения...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "pm2 restart hey && sleep 1 && pm2 list | grep hey"
if errorlevel 1 ( echo ОШИБКА: перезапуск провалился & pause & exit /b 1 )

echo.
echo ╔══════════════════════════════════╗
echo ║   Готово!  http://72.56.16.44    ║
echo ╚══════════════════════════════════╝
echo.
pause
