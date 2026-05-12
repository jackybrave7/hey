@echo off
chcp 65001 >nul

set SERVER=root@72.56.16.44
set SSH_KEY=%USERPROFILE%\.ssh\id_ed25519
set APP_DIR=/app

echo.
echo === HEY Deploy ===
echo.

echo [1/4] Build frontend...
call npm run build --workspace=web
if errorlevel 1 ( echo ERROR: build failed & pause & exit /b 1 )
echo OK

echo.
echo [2/4] Commit and push...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "deploy: %date% %time%"
    git -c http.sslVerify=false push
    if errorlevel 1 ( echo ERROR: git push failed & pause & exit /b 1 )
    echo OK
) else (
    echo No changes, skipping commit
)

echo.
echo [3/4] Update server...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "cd %APP_DIR% && git pull && npm install --silent && npm run build 2>&1 | tail -5"
if errorlevel 1 ( echo ERROR: server update failed & pause & exit /b 1 )
echo OK

echo.
echo [4/4] Restart app...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %SERVER% "pm2 restart hey && sleep 1 && pm2 list | grep hey"
if errorlevel 1 ( echo ERROR: restart failed & pause & exit /b 1 )

echo.
echo === Done! http://72.56.16.44 ===
echo.
pause
