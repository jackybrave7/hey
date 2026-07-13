#!/usr/bin/env node
/**
 * Run all HEY tests (server + web unit).
 * Usage: npm test
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function run(label, args, cwd = root) {
  console.log(`\n=== ${label} ===\n`);
  const r = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

run('Server tests', ['--test', 'server/test/core.test.js'], root);
run('Web unit tests', ['--test', 'web/test/messagePreview.test.mjs'], root);

console.log('\n=== All tests passed ===\n');
