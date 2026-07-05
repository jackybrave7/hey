@echo off
chcp 65001 >nul

set SERVER=root@45.153.71.162
set SSH_KEY=%USERPROFILE%\.ssh\id_ed25519
set APP_DIR=/opt/hey
set HEALTH_URL=http://127.0.0.1:3002/api/health

echo.
echo === HEY Deploy ===
echo.

REM Локальная сборка убрана: сервер собирает фронт сам (шаг 4), локальный
REM dist никуда не деплоился — только удваивал время. Если сборка на
REM сервере упадёт, docker restart не выполнится и продолжит работать
REM старая версия (плюс есть rollback.bat).

echo [1/4] Commit and push...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "deploy: %date% %time%"
    call :git_push_retry
    if errorlevel 1 (
        echo ERROR: git push failed after retries
        echo Check internet/DNS and run: git push
        pause
        exit /b 1
    )
    echo OK
) else (
    echo No changes, skipping commit
)

echo.
echo [2/4] Save rollback commit on server...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && git rev-parse HEAD > .last_good_commit && echo last_good_commit: $(cat .last_good_commit)"
if errorlevel 1 (
    echo ERROR: could not save rollback commit
    pause
    exit /b 1
)
echo OK

echo.
echo [3/4] Update server (git pull)...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && git checkout -- package-lock.json 2>/dev/null; git -c http.sslVerify=false pull"
if errorlevel 1 (
    echo Retrying...
    ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && git checkout -- package-lock.json 2>/dev/null; git -c http.sslVerify=false pull"
    if errorlevel 1 (
        echo ERROR: server update failed
        pause
        exit /b 1
    )
)
echo OK

echo.
echo [4/4] Database snapshot, build in Docker, restart...
REM npm install гоняем только если package-lock.json изменился с прошлого
REM деплоя (md5-страж .pkglock.md5) — экономит ~1-2 минуты на каждом деплое.
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "docker start hey 2>/dev/null; cd %APP_DIR% && docker exec hey node server/scripts/predeploy-backup.js && docker exec hey sh -c 'cd /app && (md5sum -c .pkglock.md5 >/dev/null 2>&1 || (npm install --silent && md5sum package-lock.json > .pkglock.md5)) && npm run build' && docker restart hey && sleep 2 && curl -sf %HEALTH_URL%"
if errorlevel 1 (
    echo ERROR: snapshot, build or restart failed
    pause
    exit /b 1
)

echo.
echo === Done! https://hey-messenger.ru ===
echo Rollback: rollback.bat
echo.
pause
exit /b 0

:git_push_retry
git -c http.sslVerify=false push
if not errorlevel 1 exit /b 0
echo WARN: push failed, retry in 5s...
timeout /t 5 /nobreak >nul
git -c http.sslVerify=false push
if not errorlevel 1 exit /b 0
echo WARN: push failed again, retry in 15s...
timeout /t 15 /nobreak >nul
git -c http.sslVerify=false push
exit /b %errorlevel%
