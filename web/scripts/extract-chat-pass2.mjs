import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screensPath = path.join(__dirname, '../src/components/Screens.jsx');
const chatDir = path.join(__dirname, '../src/components/chat');
const libDir = path.join(__dirname, '../src/lib');

const lines = fs.readFileSync(screensPath, 'utf8').split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}

fs.mkdirSync(chatDir, { recursive: true });

// openUserCard
fs.writeFileSync(
  path.join(libDir, 'openUserCard.js'),
  `// Dispatch event to open contact card from anywhere
export function openUserCard(userId) {
  if (!userId) return;
  window.dispatchEvent(new CustomEvent('hey:open-user-card', { detail: userId }));
}
`
);

// chatRender — body is 3483-3605 + 3608-3738 (skip mid-file import)
const chatRenderHeader = `import { useState } from 'react';
import { HEY_EMOJI as HEY_EMOJI_LIST, HEY_EMOJI_SET, emojiUrl } from '../../lib/heyEmoji';

const HEY_EMOJI = HEY_EMOJI_LIST;
const EMOJI_RE = new RegExp('\\\\[(' + HEY_EMOJI.map(n => n.replace(/[.*+?^$\{}()|[\\]\\\\]/g,'\\\\$&')).join('|') + ')\\\\]', 'g');

`;
const chatRenderFooter = `
export {
  URL_RE, isChatVideoUrl, getChatEmbed, getEmbedSrc, ChatVideoCard,
  renderPreviewWithEmoji, renderMarkdown, trimUrlTail, renderText,
};
`;
fs.writeFileSync(
  path.join(chatDir, 'chatRender.jsx'),
  chatRenderHeader + slice(3483, 3605) + '\n' + slice(3612, 3738) + chatRenderFooter
);

// chatDrafts
fs.writeFileSync(
  path.join(chatDir, 'chatDrafts.js'),
  slice(5404, 5405) + '\nexport { chatImgDrafts, chatFileDrafts };\n'
);

// ForwardModal
fs.writeFileSync(
  path.join(chatDir, 'ForwardModal.jsx'),
  `import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import Icon from '../Icon';
import { AvatarDisplay } from '../shared/AvatarDisplay';

` + slice(3741, 3898) + '\nexport default ForwardModal;\n'
);

// MediaViewerModal
fs.writeFileSync(
  path.join(chatDir, 'MediaViewerModal.jsx'),
  `import { useState, useEffect } from 'react';
import { api } from '../../api';
import { fmtDateTime } from '../../lib/formatTime';
import Icon from '../Icon';
import { AudioPlayer } from './AudioPlayer';
import { URL_RE } from './chatRender';

` + slice(3900, 4206) + '\nexport default MediaViewerModal;\n'
);

// GroupInvitePreview
fs.writeFileSync(
  path.join(chatDir, 'GroupInvitePreview.jsx'),
  `import { useNavigate } from 'react-router-dom';

` + slice(4879, 4931) + '\nexport default GroupInvitePreview;\n'
);

// MessageRow
fs.writeFileSync(
  path.join(chatDir, 'MessageRow.jsx'),
  `import { useState, memo } from 'react';
import Icon from '../Icon';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AudioPlayer } from './AudioPlayer';
import HeyLogo from '../HeyLogo';
import EmbeddedVideoPreview from '../moments/EmbeddedVideoPreview';
import { HEY_EMOJI_SET, emojiUrl } from '../../lib/heyEmoji';
import { openUserCard } from '../../lib/openUserCard';
import GroupInvitePreview from './GroupInvitePreview';
import { fmtTime } from '../../lib/formatTime';

` + slice(4937, 5388) + '\nexport default MessageRow;\n'
);

// Schedule
fs.writeFileSync(
  path.join(chatDir, 'Schedule.jsx'),
  `import { useState } from 'react';
import { createPortal } from 'react-dom';

` + slice(5410, 5557) + '\nexport { ScheduleModal, ScheduledList };\n'
);

// ChatScreen
fs.writeFileSync(
  path.join(chatDir, 'ChatScreen.jsx'),
  `import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { api, socket } from '../../api';
import { useAuth } from '../../AuthContext';
import { useSalesPressure } from '../../lib/publicSettings';
import Icon from '../Icon';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { useConfirm } from '../shared/Confirm';
import { heyToast } from '../shared/Toast';
import { uploadMedia, previewUrl, uploadAudioBlob, uploadFile } from '../../lib/uploadMedia';
import { fmtTime, fmtDate, fmtLastSeenShort } from '../../lib/formatTime';
import { HEY_EMOJI as HEY_EMOJI_LIST, emojiLabel, emojiUrl } from '../../lib/heyEmoji';
import { openUserCard } from '../../lib/openUserCard';
import ChatContextMenu, { AnchoredContextMenu } from './ChatContextMenu';
import EmojiInput from '../EmojiInput';
import HeyLogo from '../HeyLogo';
import SuperLimitPopup from '../super/SuperLimitPopup';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import ForwardModal from './ForwardModal';
import MediaViewerModal from './MediaViewerModal';
import MessageRow from './MessageRow';
import { chatImgDrafts, chatFileDrafts } from './chatDrafts';
import { ScheduleModal, ScheduledList } from './Schedule';
import { renderText, renderPreviewWithEmoji } from './chatRender';

const HEY_EMOJI = HEY_EMOJI_LIST;

` + slice(5559, 8307) + '\n'
);

console.log('Extracted chat modules from Screens.jsx (' + lines.length + ' lines)');
