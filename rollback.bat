@echo off

chcp 65001 >nul



set SERVER=root@45.153.71.162

set SSH_KEY=%USERPROFILE%\.ssh\id_ed25519

set APP_DIR=/opt/hey

set HEALTH_URL=http://127.0.0.1:3002/api/health



echo.

echo === HEY Rollback (только код, БД не трогаем) ===

echo.



echo [1/4] Читаем точку отката с сервера...

for /f "delims=" %%i in ('ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "test -f %APP_DIR%/.last_good_commit && cat %APP_DIR%/.last_good_commit || echo __MISSING__"') do set TARGET=%%i

if "%TARGET%"=="__MISSING__" (

    echo ERROR: файл %APP_DIR%/.last_good_commit не найден.

    echo Сначала сделайте деплой через deploy.bat — он сохраняет коммит перед обновлением.

    pause

    exit /b 1

)

echo Откат к коммиту: %TARGET%



echo.

echo [2/4] Текущая версия на сервере...

ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && echo HEAD: $(git rev-parse --short HEAD) && git log -1 --oneline && echo. && echo Rollback target: && git log -1 --oneline %TARGET% 2>/dev/null || echo (коммит не найден в локальном git)"



echo.

echo База данных hey.db и снимки hey_pre_*.db НЕ изменяются.

echo Пользовательские данные сохраняются.

echo.

set /p CONFIRM=Продолжить откат? (y/N): 

if /i not "%CONFIRM%"=="y" (

    echo Отменено.

    pause

    exit /b 0

)



echo.

echo [3/4] Откат кода и сборка фронтенда в Docker...

ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "docker start hey 2>/dev/null; cd %APP_DIR% && git fetch -q origin && git checkout -f feat/messaging-extras 2>/dev/null || git checkout -B feat/messaging-extras && git reset --hard %TARGET% && docker exec hey sh -c 'cd /app && npm install --silent && npm run build'"

if errorlevel 1 (

    echo ERROR: checkout or build failed

    pause

    exit /b 1

)

echo OK



echo.

echo [4/4] Перезапуск приложения...

ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "docker restart hey && sleep 2 && curl -sf %HEALTH_URL%"

if errorlevel 1 (

    echo ERROR: restart failed

    pause

    exit /b 1

)



echo.

echo === Rollback complete ===

echo Код: %TARGET%

echo БД: без изменений (%APP_DIR%/server/data/hey.db)

echo Сайт: https://hey-messenger.ru

echo.

echo Чтобы снова выкатить последнюю версию: deploy.bat

echo.

pause

exit /b 0

