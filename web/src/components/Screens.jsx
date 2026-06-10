// web/src/components/Screens.jsx — re-exports barrel (screens live in subfolders)
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

