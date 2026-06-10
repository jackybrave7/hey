import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screensPath = path.join(__dirname, '../src/components/Screens.jsx');

let lines = fs.readFileSync(screensPath, 'utf8').split(/\r?\n/);

// Remove ranges bottom-up (1-indexed inclusive)
const removeRanges = [
  [5606, 5719],
  [5338, 5599],
  [5044, 5332],
  [4522, 5034],
  [4427, 4516],
  [4274, 4421],
  [4202, 4268],
  [4148, 4196],
  [3711, 4139],
  [3480, 3705],
  [3339, 3474],
  [2676, 3336],
  [2373, 2670],
  [2284, 2367],
  [2144, 2278],
  [1921, 2138],
  [1542, 1915],
  [1423, 1535],
  [1362, 1416],
  [1322, 1354],
  [140, 1316],
  [44, 101],
];

for (const [start, end] of removeRanges) {
  lines.splice(start - 1, end - start + 1);
}

// Strip now-unused imports — keep minimal barrel file
const barrel = `// web/src/components/Screens.jsx — re-exports barrel (screens live in subfolders)
export { ChatScreen } from './chat/ChatScreen';
export { openUserCard } from '../lib/openUserCard';

export { MyProfileScreen } from './profile/MyProfileScreen';
export { PublicProfileScreen } from './profile/PublicProfileScreen';
export { MainScreen } from './nav/MainScreen';

export { GlobalUserCardMount } from './contacts/GlobalUserCardMount';
export { ContactsScreen } from './contacts/ContactsScreen';

export { ConversationsScreen } from './chats/ConversationsScreen';

export { GroupCreateScreen } from './groups/GroupCreateScreen';
export { GroupSettingsScreen } from './groups/GroupSettingsScreen';

export { CallsScreen } from './settings/CallsScreen';
export { CallDetailScreen } from './settings/CallDetailScreen';
export { SettingsScreen } from './settings/SettingsScreen';

export { MomentPage } from './moments/MomentPage';
export { ForcePasswordModal } from './auth/ForcePasswordModal';

// Re-exports for backward compatibility (admin, moments, etc.)
export { heyToast, ToastContainer } from './shared/Toast';
export { ConfirmModal, useConfirm } from './shared/Confirm';
export { AudioPlayer } from './chat/AudioPlayer';
export {
  SplashScreen, HeyScreen, LoginScreen, RegisterScreen,
  PasswordResetScreen, SuccessScreen, WelcomeScreen,
} from './auth/AuthScreens';
`;

fs.writeFileSync(screensPath, barrel + '\n');
console.log('Screens.jsx replaced with barrel file');
