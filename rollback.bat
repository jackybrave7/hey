@echo off
chcp 65001 >nul
cd /d "%~dp0"

set SERVER=root@45.153.71.162
set SSH_KEY=%USERPROFILE%\.ssh\id_ed25519
set APP_DIR=/opt/hey
set HEALTH_URL=http://127.0.0.1:3002/api/health
set SSH_BASE=-i "%SSH_KEY%" -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=3

echo.
echo === HEY Rollback (только код, БД не трогаем) ===
echo.

echo [1/5] Читаем точку отката с сервера...
for /f "delims=" %%i in ('ssh %SSH_BASE% %SERVER% "test -f %APP_DIR%/server/data/.last_good_commit && cat %APP_DIR%/server/data/.last_good_commit || (test -f %APP_DIR%/.last_good_commit && cat %APP_DIR%/.last_good_commit) || echo __MISSING__"') do set TARGET=%%i
if "%TARGET%"=="__MISSING__" (
    echo ERROR: файл %APP_DIR%/server/data/.last_good_commit не найден.
    echo Сначала сделайте деплой через deploy.bat.
    pause
    exit /b 1
)
echo Откат к коммиту: %TARGET%

echo.
echo [2/5] Текущая версия на сервере...
ssh %SSH_BASE% %SERVER% "cd %APP_DIR% && echo HEAD: && git rev-parse --short HEAD && git log -1 --oneline"

echo.
echo База данных hey.db и снимки hey_pre_*.db НЕ изменяются.
echo.
set /p CONFIRM=Продолжить откат? (y/N): 
if /i not "%CONFIRM%"=="y" (
    echo Отменено.
    pause
    exit /b 0
)

echo.
echo [3/5] Откат кода на сервере...
ssh %SSH_BASE% %SERVER% "docker start hey 2>/dev/null; cd %APP_DIR% && git fetch -q origin && git checkout -f feat/messaging-extras 2>/dev/null || git checkout -B feat/messaging-extras && git reset --hard %TARGET%"
if errorlevel 1 (
    echo ERROR: git reset failed
    pause
    exit /b 1
)
echo OK

echo.
echo [4/5] Сборка фронта локально и загрузка на сервер...
git checkout %TARGET%
if errorlevel 1 (
    echo ERROR: local checkout %TARGET% failed
    pause
    exit /b 1
)
call npm run build --workspace=web
if errorlevel 1 (
    echo ERROR: local build failed
    pause
    exit /b 1
)
scp %SSH_BASE% -r "web\dist" %SERVER%:%APP_DIR%/web/
if errorlevel 1 (
    echo ERROR: could not upload web/dist
    pause
    exit /b 1
)
echo OK

echo.
echo [5/5] Перезапуск приложения...
ssh %SSH_BASE% %SERVER% "docker restart hey && sleep 2 && curl -sf %HEALTH_URL%"
if errorlevel 1 (
    echo ERROR: restart failed
    pause
    exit /b 1
)

echo.
echo === Rollback complete ===
echo Код: %TARGET%
echo Верните локальную ветку: git checkout feat/messaging-extras
echo.
pause
exit /b 0
