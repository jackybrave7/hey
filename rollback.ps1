# HEY rollback script (PowerShell). Called from rollback.bat or run directly.

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
    '-o', 'BatchMode=yes'
)

function Invoke-Ssh([string]$RemoteCmd) {
    & ssh @SSH_OPTS $SERVER $RemoteCmd
    if ($LASTEXITCODE -ne 0) { throw "ssh failed ($LASTEXITCODE)" }
}

function Invoke-Scp([string]$LocalPath, [string]$RemotePath) {
    & scp @SSH_OPTS -r $LocalPath "${SERVER}:${RemotePath}"
    if ($LASTEXITCODE -ne 0) { throw "scp failed ($LASTEXITCODE)" }
}

try {

Write-Host ''
Write-Host '=== HEY Rollback (code only, DB untouched) ==='
Write-Host ''

Write-Host '[1/5] Read rollback commit from server...'
$readCmd = "test -f $APP_DIR/server/data/.last_good_commit && cat $APP_DIR/server/data/.last_good_commit || (test -f $APP_DIR/.last_good_commit && cat $APP_DIR/.last_good_commit) || echo __MISSING__"
$TARGET = (& ssh @SSH_OPTS $SERVER $readCmd | Select-Object -First 1).Trim()
if ($TARGET -eq '__MISSING__' -or [string]::IsNullOrWhiteSpace($TARGET)) {
    throw "rollback file not found on server ($APP_DIR/server/data/.last_good_commit). Run deploy.bat first."
}
Write-Host "Rollback target: $TARGET"

Write-Host ''
Write-Host '[2/5] Current server version...'
Invoke-Ssh "cd $APP_DIR && echo HEAD: && git rev-parse --short HEAD && git log -1 --oneline"

Write-Host ''
Write-Host 'hey.db and hey_pre_*.db snapshots are NOT changed.'
Write-Host ''
$confirm = Read-Host 'Continue rollback? (y/N)'
if ($confirm -notmatch '^[yY]$') {
    Write-Host 'Cancelled.'
    exit 0
}

Write-Host ''
Write-Host '[3/5] Roll back code on server...'
$resetCmd = "docker start hey 2>/dev/null; cd $APP_DIR && git fetch -q origin && git checkout -f feat/messaging-extras 2>/dev/null || git checkout -B feat/messaging-extras && git reset --hard $TARGET"
Invoke-Ssh $resetCmd
Write-Host 'OK'

Write-Host ''
Write-Host '[4/5] Local build and upload dist...'
git checkout $TARGET
if ($LASTEXITCODE -ne 0) { throw "local checkout $TARGET failed" }
npm run build --workspace=web
if ($LASTEXITCODE -ne 0) { throw 'local build failed' }
Invoke-Scp 'web\dist' "$APP_DIR/web/"
Write-Host 'OK'

Write-Host ''
Write-Host '[5/5] Restart app...'
Invoke-Ssh "docker restart hey && sleep 2 && curl -sf $HEALTH_URL"
Write-Host 'OK'

Write-Host ''
Write-Host '=== Rollback complete ==='
Write-Host "Code: $TARGET"
Write-Host 'Restore local branch: git checkout feat/messaging-extras'
Write-Host ''

} catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
