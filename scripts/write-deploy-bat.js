const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function writeCrlfBat(name, lines) {
  const body = lines.join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(root, name), body, 'ascii');
  const bytes = fs.readFileSync(path.join(root, name));
  const cr = [...bytes].filter(b => b === 0x0d).length;
  const lf = [...bytes].filter(b => b === 0x0a).length;
  console.log(`${name}: CR=${cr} LF=${lf}`);
}

writeCrlfBat('deploy.bat', [
  '@echo off',
  'cd /d "%~dp0"',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"',
  'if errorlevel 1 pause',
]);

writeCrlfBat('rollback.bat', [
  '@echo off',
  'cd /d "%~dp0"',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rollback.ps1"',
  'if errorlevel 1 pause',
]);
