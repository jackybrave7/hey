import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screensPath = path.join(__dirname, '../src/components/Screens.jsx');

let lines = fs.readFileSync(screensPath, 'utf8').split(/\r?\n/);

// Remove ranges bottom-up (1-indexed inclusive)
const removeRanges = [
  [5559, 8307],
  [4874, 5557],
  [3477, 4207],
];

for (const [start, end] of removeRanges) {
  lines.splice(start - 1, end - start + 1);
}

// Remove openUserCard definition (re-find after splices)
const content = lines.join('\n');
const openUserCardBlock = `// Helper: открыть карточку контакта из любого места приложения
export function openUserCard(userId) {
  if (!userId) return;
  window.dispatchEvent(new CustomEvent('hey:open-user-card', { detail: userId }));
}`;
if (!content.includes(openUserCardBlock)) {
  console.error('openUserCard block not found');
  process.exit(1);
}
lines = lines.join('\n').replace(openUserCardBlock, '').split(/\r?\n/);

// Add imports after existing imports block (after line with AuthScreens import)
let insertIdx = lines.findIndex(l => l.includes("from './auth/AuthScreens'"));
if (insertIdx < 0) {
  console.error('AuthScreens import not found');
  process.exit(1);
}
insertIdx += 1;
const newImports = [
  "import { openUserCard } from '../lib/openUserCard';",
  "import { renderPreviewWithEmoji } from './chat/chatRender';",
  "export { ChatScreen } from './chat/ChatScreen';",
];
lines.splice(insertIdx, 0, ...newImports);

// Re-export openUserCard at bottom with other re-exports
const reExportIdx = lines.findIndex(l => l.includes('// Re-exports for backward compatibility'));
if (reExportIdx >= 0) {
  lines.splice(reExportIdx, 0, "export { openUserCard } from '../lib/openUserCard';");
}

fs.writeFileSync(screensPath, lines.join('\n') + '\n');
console.log('Patched Screens.jsx — now', lines.length, 'lines');
