# HEY deploy script (PowerShell). Called from deploy.bat or run directly:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy.ps1

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot

$SERVER     = 'root@45.153.71.162'
$SSH_KEY    = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
$APP_DIR    = '/opt/hey'
$HEALTH_URL = 'http://127.0.0.1:3002/api/health'
$SSH_OPTS   = @(
    '-i', $SSH_KEY,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=15',
    '-o', 'BatchMode=yes',
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=3'
)

function Invoke-Ssh([string]$RemoteCmd) {
    & ssh @SSH_OPTS $SERVER $RemoteCmd
    if ($LASTEXITCODE -ne 0) { throw "ssh failed ($LASTEXITCODE)" }
}

function Invoke-Scp([string]$LocalPath, [string]$RemotePath) {
    & scp @SSH_OPTS -r $LocalPath "${SERVER}:${RemotePath}"
    if ($LASTEXITCODE -ne 0) { throw "scp failed ($LASTEXITCODE)" }
}

function Invoke-GitPushRetry {
    $delays = @(0, 5, 15)
    foreach ($wait in $delays) {
        if ($wait -gt 0) {
            Write-Host "WARN: push failed, retry in ${wait}s..."
            Start-Sleep -Seconds $wait
        }
        git -c http.sslVerify=false push
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw 'git push failed after retries'
}

try {

Write-Host ''
Write-Host '=== HEY Deploy ==='
Write-Host ''

Write-Host '[1/5] Build frontend locally (not on server)...'
npm run build --workspace=web
if ($LASTEXITCODE -ne 0) { throw 'local build failed' }
Write-Host 'OK'

Write-Host ''
Write-Host '[2/5] Commit and push...'
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $ts = Get-Date -Format 'yyyy-MM-dd_HHmmss'
    git commit -m "deploy: $ts"
    if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
    Invoke-GitPushRetry
    Write-Host 'OK'
} else {
    Write-Host 'No source changes, skipping commit'
}

Write-Host ''
Write-Host "[3/5] Save rollback commit on server ($SERVER)..."
Invoke-Ssh "cd $APP_DIR && git rev-parse HEAD > server/data/.last_good_commit && echo last_good_commit: && cat server/data/.last_good_commit"
Write-Host 'OK'

Write-Host ''
Write-Host '[4/5] Update server code (git pull)...'
$pullCmd = "cd $APP_DIR && rm -f .last_good_commit && git checkout -- package-lock.json 2>/dev/null; git -c http.sslVerify=false pull"
try {
    Invoke-Ssh $pullCmd
} catch {
    Write-Host 'Retrying...'
    Invoke-Ssh $pullCmd
}
Write-Host 'OK'

Write-Host ''
Write-Host '[5/5] Upload dist, DB snapshot, restart...'
Invoke-Scp 'web\dist' "$APP_DIR/web/"
$restartCmd = @(
    "docker start hey 2>/dev/null",
    "cd $APP_DIR",
    "docker exec hey node server/scripts/predeploy-backup.js",
    "docker exec hey sh -c 'cd /app && (test -f .pkglock.md5 && md5sum -c .pkglock.md5 >/dev/null 2>&1) || (npm install --omit=dev --silent && md5sum package-lock.json > .pkglock.md5)'",
    "docker restart hey",
    "sleep 2",
    "curl -sf $HEALTH_URL"
) -join ' && '
Invoke-Ssh $restartCmd

Write-Host ''
Write-Host '=== Done! https://hey-messenger.ru ==='
Write-Host 'Rollback: rollback.bat'
Write-Host ''

} catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
