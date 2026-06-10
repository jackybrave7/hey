import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const screensPath = path.join(root, 'src/components/Screens.jsx');
const lines = fs.readFileSync(screensPath, 'utf8').split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// ── shared ───────────────────────────────────────────────────────────────────
write('src/components/shared/profileUi.jsx',
`import { useState } from 'react';
import { api } from '../../api';
import { heyToast } from './Toast';
import { trimUrlTail } from '../chat/chatRender';

${slice(44, 101)}

// Рендер «О себе» с автоопределением ссылок
function BioWithLinks({ text }) {
  if (!text) return null;
  const urlRe = /https?:\\/\\/[^\\s<>"']+/gi;
  const parts = [];
  let lastIdx = 0;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ t: text.slice(lastIdx, m.index), link: false });
    const cleanUrl = trimUrlTail(m[0]);
    const tail = m[0].slice(cleanUrl.length);
    parts.push({ t: cleanUrl, link: true });
    if (tail) parts.push({ t: tail, link: false });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ t: text.slice(lastIdx), link: false });
  return (
    <>
      {parts.map((p, i) => p.link ? (
        <a key={i} href={p.t} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color:'rgba(180,210,255,1)', textDecoration:'underline',
            textDecorationColor:'rgba(180,210,255,.55)',
            textUnderlineOffset:2, textDecorationThickness:1,
            fontWeight:600, wordBreak:'break-all',
          }}>
          {p.t.replace(/^https?:\\/\\//,'')}
        </a>
      ) : <span key={i}>{p.t}</span>)}
    </>
  );
}

export { FieldLine, EmailVerifyHint, BioWithLinks };
`);

write('src/components/shared/Highlight.jsx',
`${slice(1362, 1379)}

export default Highlight;
`);

// ── profile ──────────────────────────────────────────────────────────────────
write('src/components/profile/MyProfileScreen.jsx',
`import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadAvatar } from '../../lib/uploadMedia';
import { validatePhone, formatPhoneInput, caretAfterNthDigit } from '../../lib/phoneFormat';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarPicker } from '../shared/AvatarPicker';
import { FieldLine, EmailVerifyHint, BioWithLinks } from '../shared/profileUi';
import Icon from '../Icon';
import HeyLogo from '../HeyLogo';
import MoodEmoji from '../moments/MoodEmoji';
import SuperStatusCard from '../super/SuperStatusCard';
import AchievementBadges from '../super/AchievementBadges';
import OnboardingTour from '../OnboardingTour';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import MomentCard from '../moments/MomentCard';
import { useSalesPressure } from '../../lib/publicSettings';

${slice(140, 1316)}
`);

write('src/components/profile/PublicProfileScreen.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { BioWithLinks } from '../shared/profileUi';
import AchievementBadges from '../super/AchievementBadges';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import MomentCard from '../moments/MomentCard';
import Icon from '../Icon';
import HeyLogo from '../HeyLogo';

${slice(5338, 5599)}
`);

// ── nav ──────────────────────────────────────────────────────────────────────
write('src/components/nav/MainScreen.jsx',
`import { useNavigate } from 'react-router-dom';

${slice(1322, 1354)}
`);

// ── contacts ─────────────────────────────────────────────────────────────────
write('src/components/contacts/ContactCardModal.jsx',
`import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { BioWithLinks } from '../shared/profileUi';
import Icon from '../Icon';
import MomentCard from '../moments/MomentCard';

${slice(1542, 1915)}

export { ContactCardModal, RemoveContactButton };
`);

write('src/components/contacts/GlobalUserCardMount.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import { ContactCardModal } from './ContactCardModal';

${slice(1423, 1535)}
`);

write('src/components/contacts/ImportContactsModal.jsx',
`import { useState, useRef } from 'react';
import { api } from '../../api';
import { heyToast } from '../shared/Toast';

${slice(1921, 2138)}

export default ImportContactsModal;
`);

write('src/components/contacts/InviteModal.jsx',
`import { useState, useEffect } from 'react';
import { api } from '../../api';

${slice(2144, 2278)}

export default InviteModal;
`);

write('src/components/contacts/InviteByPhoneModal.jsx',
`import { useState } from 'react';
import { useAuth } from '../../AuthContext';

${slice(2284, 2367)}

export default InviteByPhoneModal;
`);

write('src/components/contacts/ContactsScreen.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { validatePhone } from '../../lib/phoneFormat';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import ChatContextMenu from '../chat/ChatContextMenu';
import { openUserCard } from '../../lib/openUserCard';
import { ContactCardModal } from './ContactCardModal';
import ImportContactsModal from './ImportContactsModal';
import InviteModal from './InviteModal';
import InviteByPhoneModal from './InviteByPhoneModal';
import Icon from '../Icon';

${slice(2373, 2670)}
`);

// ── chats ────────────────────────────────────────────────────────────────────
write('src/components/chats/ConversationsScreen.jsx',
`import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, socket } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import ChatContextMenu from '../chat/ChatContextMenu';
import { renderPreviewWithEmoji } from '../chat/chatRender';
import Highlight from '../shared/Highlight';
import Icon from '../Icon';
import { fmtTime } from '../../lib/formatTime';

${slice(2676, 3336)}

${slice(3339, 3474)}
`);

// ── groups ───────────────────────────────────────────────────────────────────
write('src/components/groups/groupConstants.js',
`${slice(3480, 3480)}

export { GROUP_ICONS };
`);

write('src/components/groups/GroupCreateScreen.jsx',
`import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadGroupIcon } from '../../lib/uploadMedia';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AvatarCropperModal } from '../shared/AvatarPicker';
import Icon from '../Icon';
import TopBar from '../shared/TopBar';
import { GROUP_ICONS } from './groupConstants';

${slice(3482, 3705)}
`);

write('src/components/groups/GroupSettingsScreen.jsx',
`import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadGroupIcon } from '../../lib/uploadMedia';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AvatarCropperModal } from '../shared/AvatarPicker';
import { openUserCard } from '../../lib/openUserCard';
import Icon from '../Icon';
import TopBar from '../shared/TopBar';
import { GROUP_ICONS } from './groupConstants';

${slice(3711, 4139)}
`);

// ── settings ─────────────────────────────────────────────────────────────────
write('src/components/settings/CallsScreen.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import TopBar from '../shared/TopBar';
import { fmtTime, fmtDate } from '../../lib/formatTime';

${slice(4148, 4196)}
`);

write('src/components/settings/CallDetailScreen.jsx',
`import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import TopBar from '../shared/TopBar';
import { fmtTime, fmtDate } from '../../lib/formatTime';

${slice(4202, 4268)}
`);

write('src/components/settings/FeedbackModal.jsx',
`import { useState } from 'react';
import { api } from '../../api';

${slice(4274, 4279)}

${slice(4281, 4421)}

export default FeedbackModal;
`);

write('src/components/settings/BlacklistModal.jsx',
`import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';

${slice(4427, 4516)}

export default BlacklistModal;
`);

write('src/components/settings/SettingsScreen.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../lib/push';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import TopBar from '../shared/TopBar';
import Icon from '../Icon';
import FeedbackModal from './FeedbackModal';
import BlacklistModal from './BlacklistModal';

${slice(4522, 5034)}
`);

// ── moments page ─────────────────────────────────────────────────────────────
write('src/components/moments/MomentPage.jsx',
`import { useState, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import HeyLogo from '../HeyLogo';
import MoodEmoji from './MoodEmoji';
import Icon from '../Icon';

${slice(5044, 5060)}

${slice(5064, 5332)}
`);

// ── auth ─────────────────────────────────────────────────────────────────────
write('src/components/auth/ForcePasswordModal.jsx',
`import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import Icon from '../Icon';

${slice(5606, 5719)}
`);

console.log('Pass 3 extraction done from', lines.length, 'lines');
