import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { fileTypeIcon, AttachmentPreview } from '../../lib/fileTypeIcon';

const HEY_EMOJI = HEY_EMOJI_LIST;

export function ChatScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const { convId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const salesPressure = useSalesPressure();

  const [messages,    setMessages]    = useState([]);
  // Чёрновики храним в localStorage по ключу draft_<convId>. Ленивый
  // инициализатор подтягивает сохранённое — чтобы при возврате в чат
  // незавершённое сообщение оставалось в инпуте без мигания пустого
  // поля. Дальнейшие смены convId обрабатывает useEffect ниже.
  const draftKey = (id) => 'hey_draft_' + id;
  const [text, setText] = useState(() => {
    try { return convId ? (localStorage.getItem(draftKey(convId)) || '') : ''; }
    catch { return ''; }
  });
  // Бэкап текущего черновика на время правки чужого сообщения, чтобы
  // отмена / отправка правки не затёрла то, что пользователь набирал.
  const savedDraftRef = useRef('');
  // Контекст-меню кнопки «Отправить» — правый клик/long-press открывает
  // вариант «📅 Отправить позже…». scheduleOpen — модалка с date-time.
  // scheduled — список запланированных сообщений для индикатора над инпутом.
  const [sendMenu, setSendMenu]         = useState(null); // { x, y } | null
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduled, setScheduled]       = useState([]);
  const longPressTimer = useRef(null);
  const [showEmoji,   setShowEmoji]   = useState(false);
  // Composer expand: при длинном тексте инпут можно вручную раскрыть на
  // почти всю высоту чата для удобного редактирования / просмотра вставленного.
  // Шевроны ↕ появляются только когда контент реально не помещается в
  // нормальный режим — чтобы не мозолить глаза при коротких сообщениях.
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerOverflow, setComposerOverflow] = useState(false);
  // Drag&drop из Проводника/Finder поверх экрана чата — пока курсор
  // волочёт файл, рисуем большой полупрозрачный оверлей-зону «отпусти».
  // Счётчик dragDepth нужен потому что dragenter/leave стреляют на
  // каждом дочернем элементе — простой boolean мигает.
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  const [typing,      setTyping]      = useState(null);
  const [partner,     setPartner]     = useState({ name:'Диалог', online:false, id:null, isGroup:false, icon:null, admin_id:null, avatar:null, isDeleted:false });
  const [editingMsg,  setEditingMsg]  = useState(null);
  const [msgMenu,     setMsgMenu]     = useState(null);
  const [replyTo,     setReplyTo]     = useState(null); // message object to reply to
  const [imgPreviews, setImgPreviews] = useState(() => convId ? (chatImgDrafts.get(convId)  || []) : []);   // [{dataUrl, file, uploading?}]
  const [filePreview, setFilePreview] = useState(() => convId ? (chatFileDrafts.get(convId) || null) : null); // { file, uploading?: bool }
  // momentRef — мини-карточка момента, прицепленная к черновику.
  // Прилетает через nav state, когда пользователь жмёт «Написать» в попапе момента.
  const [momentRef,   setMomentRef]   = useState(null);
  // Popup для открытия чужого момента из чата (когда тапаем по прицепленному моменту).
  const [momentChatPopup, setMomentChatPopup] = useState(null); // null | { moments:[m], idx:0 }
  const [momentChatLoading, setMomentChatLoading] = useState(false);
  const [lightbox,    setLightbox]    = useState(null); // null | { urls: string[], index: number }
  const [showMedia,   setShowMedia]   = useState(false);
  const [searchMode,  setSearchMode]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults,setSearchResults] = useState(null); // null = not searched
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  // Message request state
  const [requestLock,  setRequestLock]  = useState(null); // { requester: {id,name,avatar} } | null
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [groupInvite,  setGroupInvite]  = useState(null); // { conversation, invitedBy } | null
  const [accepting,    setAccepting]    = useState(false);
  const [declining,    setDeclining]    = useState(false);
  const [reactionPicker,setReactionPicker] = useState(null); // { msgId, x, y }
  const [flashMsgId,    setFlashMsgId]    = useState(null);  // id сообщения, которое подсвечивается
  const [customConfirm, confirmModal] = useConfirm();
  const [isContact,    setIsContact]    = useState(false); // is partner in my contacts?
  // Voice recording
  const [voiceState,   setVoiceState]   = useState(null); // null | 'recording' | 'preview'
  const [voiceBlob,    setVoiceBlob]    = useState(null);
  const [voiceObjUrl,  setVoiceObjUrl]  = useState(null); // object URL for preview player
  const [voiceDuration,setVoiceDuration]= useState(0);     // seconds
  const [recTime,      setRecTime]      = useState(0);     // seconds while recording
  const [showVoiceLimit, setShowVoiceLimit] = useState(false);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const recTimerRef       = useRef(null);
  const recStreamRef      = useRef(null);
  const analyserRef       = useRef(null);
  const waveCanvasRef     = useRef(null);
  const waveRafRef        = useRef(null);
  const [firstItemIndex, setFirstItemIndex] = useState(1_000_000); // Virtuoso prepend index
  const virtuosoRef        = useRef();
  const atBottomRef        = useRef(true);  // tracks whether list is scrolled to bottom
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [pinnedMessage, setPinnedMessage]   = useState(null); // {id, text, attachment, sender_name, ...}
  const [forwardModal,  setForwardModal]    = useState(null); // {messageId} | null
  const typingTimer        = useRef();
  const textareaRef        = useRef();
  const fileInputRef       = useRef();
  const searchRef          = useRef();
  const isInitialLoad      = useRef(true);  // true until first messages batch is rendered
  const forceScrollBottom  = useRef(false); // true after user sends a message
  const readDebounceTimer  = useRef(null);  // debounce read receipts

  // Подтянуть черновик при смене чата. Если в новом чате draft нет —
  // обнулим инпут (а не унаследуем текст предыдущего диалога).
  useEffect(() => {
    if (!convId) return;
    let saved = '';
    try { saved = localStorage.getItem(draftKey(convId)) || ''; } catch {}
    setText(saved);
    setImgPreviews(chatImgDrafts.get(convId)  || []);
    setFilePreview(chatFileDrafts.get(convId) || null);
    savedDraftRef.current = '';
    // Список запланированных сообщений в этом чате — для индикатора.
    api.listScheduledMessages(convId).then(setScheduled).catch(() => setScheduled([]));
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Уведомление от сервера, что один из запланированных уже отправлен —
  // убираем его из локального индикатора без перезапроса.
  useEffect(() => socket.on('scheduled:sent', ({ conversationId, scheduledId }) => {
    if (conversationId !== convId) return;
    setScheduled(prev => prev.filter(s => s.id !== scheduledId));
  }), [convId]);

  // Сохраняем картинки/файл в module Map при любом изменении. Это даёт
  // переживание ChatScreen unmount/remount при навигации.
  useEffect(() => {
    if (!convId) return;
    if (imgPreviews.length) chatImgDrafts.set(convId, imgPreviews);
    else                    chatImgDrafts.delete(convId);
  }, [imgPreviews, convId]);

  useEffect(() => {
    if (!convId) return;
    if (filePreview) chatFileDrafts.set(convId, filePreview);
    else             chatFileDrafts.delete(convId);
  }, [filePreview, convId]);

  // Авто-сохранение черновика (debounced). Во время правки чужого
  // сообщения не пишем — у нас уже есть бэкап исходного черновика
  // в savedDraftRef, и его восстанавливают cancelEdit / окончание правки.
  useEffect(() => {
    if (!convId || editingMsg) return;
    const t = setTimeout(() => {
      try {
        if (text) localStorage.setItem(draftKey(convId), text);
        else      localStorage.removeItem(draftKey(convId));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [text, convId, editingMsg]);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionPicker) return;
    const close = (e) => {
      if (!e.target.closest('[data-reaction-picker]')) setReactionPicker(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [reactionPicker]);

  // Close emoji keyboard on outside click (тап в любое место кроме самой
  // клавиатуры и кнопки "😊" в композере закрывает её — «передумал»).
  useEffect(() => {
    if (!showEmoji) return;
    const close = (e) => {
      if (e.target.closest('[data-emoji-kbd]')) return;       // тап по клавиатуре — игнор
      if (e.target.closest('[data-emoji-toggle]')) return;    // тап по кнопке toggle — она сама закроет
      setShowEmoji(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showEmoji]);


  // Debounced read receipt — sends only the LAST unread message ID (one DB query on server)
  function markVisibleAsRead(msgs) {
    if (!document.hasFocus()) return;
    // Find the latest incoming unread message
    const lastUnread = [...msgs].reverse().find(m => m.sender_id !== user?.id && m.status !== 'read');
    if (!lastUnread) return;
    clearTimeout(readDebounceTimer.current);
    readDebounceTimer.current = setTimeout(() => {
      socket.markRead(lastUnread.id, convId);
    }, 300);
  }

  // When tab regains focus — mark all loaded unread messages as read
  useEffect(() => {
    function onFocus() {
      setMessages(prev => { markVisibleAsRead(prev); return prev; });
    }
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); clearTimeout(readDebounceTimer.current); };
  }, [convId, user?.id]);

  // Load requester profile when request lock is set
  useEffect(() => {
    if (!requestLock?.requester?.id) { setRequesterProfile(null); return; }
    api.getUserProfile(requestLock.requester.id)
      .then(p => setRequesterProfile(p))
      .catch(() => setRequesterProfile(null));
  }, [requestLock?.requester?.id]);

  // momentRef: при заходе в чат из попапа момента подцепляем мини-карточку
  // к черновику. nav state одноразовый — снимаем сразу после чтения.
  useEffect(() => {
    if (location.state?.momentRef) {
      setMomentRef(location.state.momentRef);
      // Чистим state из history — чтобы при обновлении страницы не возвращалось
      try { window.history.replaceState({}, ''); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  // Load history + partner info
  useEffect(() => {
    isInitialLoad.current = true;
    setMessages([]);
    setHasMore(true);
    setLoadingMore(false);
    setFirstItemIndex(1_000_000); // reset Virtuoso prepend index on conv change
    setPinnedMessage(null);
    setGroupInvite(null);
    api.getMessages(convId).then(data => {
      if (data?.groupInvite) {
        setGroupInvite({ conversation: data.conversation, invitedBy: data.invitedBy });
        setHasMore(false);
        return;
      }
      if (data?.locked) {
        setRequestLock({ requester: data.requester });
        setHasMore(false);
        return;
      }
      setRequestLock(null);
      setMessages(data);
      if (data.length < 50) setHasMore(false);
      markVisibleAsRead(data);
    }).catch(console.error);
    // Закреплённое сообщение (если есть)
    api.getPinnedMessage(convId).then(pm => setPinnedMessage(pm)).catch(() => {});
    setIsContact(false);
    Promise.all([
      api.getConversations(),
      api.getArchivedConversations().catch(() => []), // архив тоже — чтобы показывать партнёра при открытии архивного чата
      api.getContacts(),
    ]).then(([convs, archived, contacts]) => {
      // Ищем в обоих списках; флаг isArchived используется в UI
      let c = convs.find(c => c.id === convId);
      let isArchived = false;
      if (!c) {
        c = archived.find(c => c.id === convId);
        isArchived = !!c;
      }
      if (!c) return;
      if (c.type === 'group') {
        setPartner({ name: c.name||'Группа', online:false, id:null,
          isGroup:true, icon:c.icon||'👥', admin_id:c.admin_id, isDeleted:false,
          // Создатель ИЛИ назначенный соадмин (members.is_admin=1).
          // Используется внутри ChatScreen для прав «копировать инвайт»,
          // «удалить чат», «пин сообщений» и т.д.
          myIsGroupAdmin: !!c.my_is_group_admin,
          isArchived });
      } else if (c.type === 'monolog') {
        setPartner({ name:'Монолог', online:false, id:null,
          isGroup:false, isMonolog:true, icon:'📝', avatar:null,
          isDeleted:false, isSuper:false, isSystem:false, isArchived });
      } else {
        setPartner(p => ({ ...p, name: c.name||'Диалог', id: c.partner_id||null,
          isGroup:false, avatar: c.avatar||null,
          isDeleted: !!c.partner_is_deleted,
          isBlocked: !!c.partner_is_blocked,
          isSuper:   !!c.partner_is_super,
          isSystem:  !!c.partner_is_system,
          online:    !!c.partner_online,
          lastSeen:  c.partner_last_seen || null,
          isArchived }));
        if (c.partner_id) {
          setIsContact(contacts.some(ct => ct.id === c.partner_id));
        }
      }
    }).catch(console.error);
  }, [convId]);

  // Load older messages (prepend) — Virtuoso handles scroll position via firstItemIndex
  async function loadOlder() {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const older = await api.getMessages(convId, messages[0].created_at);
      if (!Array.isArray(older) || !older.length) { setHasMore(false); return; }
      if (older.length < 50) setHasMore(false);
      // Считаем flat-items (msg + date-разделители) и сдвигаем
      // firstItemIndex на реальный прирост, иначе Virtuoso уезжает
      // на 1 за каждое новое появление дня.
      const flatBefore = (() => {
        let lastDay = null, n = 0;
        for (const m of messages) {
          const d = new Date(m.created_at * 1000).toDateString();
          if (d !== lastDay) { n++; lastDay = d; }
          n++;
        }
        return n;
      })();
      const merged = [...older, ...messages];
      const flatAfter = (() => {
        let lastDay = null, n = 0;
        for (const m of merged) {
          const d = new Date(m.created_at * 1000).toDateString();
          if (d !== lastDay) { n++; lastDay = d; }
          n++;
        }
        return n;
      })();
      setFirstItemIndex(prev => prev - (flatAfter - flatBefore));
      setMessages(merged);
    } catch {}
    finally { setLoadingMore(false); }
  }

  // ── Lightbox: стрелки ←/→ для навигации ───────────────────────────────
  useEffect(() => {
    if (!lightbox || lightbox.urls.length <= 1) return;
    function onKey(e) {
      if (e.key === 'ArrowLeft'  && lightbox.index > 0)
        setLightbox(l => l && ({ ...l, index: l.index - 1 }));
      if (e.key === 'ArrowRight' && lightbox.index < lightbox.urls.length - 1)
        setLightbox(l => l && ({ ...l, index: l.index + 1 }));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ── Esc — закрыть самый верхний попап чата ────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // Приоритет от самого «верхнего» к нижнему
      if (lightbox)              { setLightbox(null);            return; }
      if (showMedia)             { setShowMedia(false);          return; }
      if (msgMenu)               { setMsgMenu(null);             return; }
      if (reactionPicker)        { setReactionPicker(null);      return; }
      if (showEmoji)             { setShowEmoji(false);          return; }
      if (editingMsg)            { cancelEdit();                 return; }
      if (replyTo)               { setReplyTo(null);              return; }
      if (imgPreviews.length)    {
        imgPreviews.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
        setImgPreviews([]);
        return;
      }
      if (searchMode)            { setSearchMode(false); setSearchQuery(''); setSearchResults(null); return; }
      // Все попапы закрыты — Esc выходит на уровень выше, к списку чатов.
      // Игнорируем когда фокус в инпуте, чтобы не «терять» текст случайным
      // нажатием. Composer (contenteditable) обрабатываем отдельно — там
      // Esc уже отменяет правку выше по списку.
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (document.activeElement?.isContentEditable) return;
      nav('/chats');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, showMedia, msgMenu, reactionPicker, showEmoji, editingMsg, replyTo, imgPreviews, searchMode, nav]);

  // Scroll to bottom on initial load or after send — Virtuoso's followOutput handles the rest
  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      // Если в URL пришёл ?msg=<id> (открыли из push-уведомления) —
      // вместо скролла в конец, диспатчим scroll-to-msg на нужное
      // сообщение; existing listener умеет автоподгружать историю.
      const targetMsg = searchParams.get('msg');
      if (targetMsg) {
        // Чистим query чтобы при дальнейшей навигации в чате параметр
        // не реактивировался при ремаунте.
        try { nav(`/chat/${convId}`, { replace: true }); } catch {}
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: targetMsg }));
        }, 300);
        return;
      }
      // Несколько попыток: первая сразу, остальные после возможной загрузки картинок
      const scroll = () => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'instant' });
      requestAnimationFrame(scroll);
      setTimeout(scroll, 150);
      setTimeout(scroll, 500);
      setTimeout(scroll, 1200);
      return;
    }
    if (forceScrollBottom.current) {
      forceScrollBottom.current = false;
      const scroll = (smooth) => virtuosoRef.current?.scrollToIndex({
        index: 'LAST', behavior: smooth ? 'smooth' : 'auto'
      });
      scroll(true);
      // Повторные попытки — изображения и кастомные превью могут изменить высоту
      setTimeout(() => scroll(false), 150);
      setTimeout(() => scroll(false), 500);
      setTimeout(() => scroll(false), 1200);
    }
  }, [messages, typing]);

  // Real-time events
  useEffect(() => {
    const u1 = socket.on('message:new', ({ message }) => {
      if (message.conversationId !== convId) return;
      setMessages(prev => {
        // Replace optimistic temp message with real one
        if (message.tempId) {
          const idx = prev.findIndex(m => m.id === message.tempId);
          if (idx !== -1) return prev.map(m => m.id === message.tempId ? { ...message } : m);
        }
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Mark read only if tab is focused (user actually sees the message)
      if (message.sender_id !== user?.id && document.hasFocus()) {
        socket.markRead(message.id, convId);
      }
    });
    const u2 = socket.on('typing:start', msg => {
      if (msg.conversationId === convId) setTyping(msg.userName);
    });
    const u3 = socket.on('typing:stop', msg => {
      if (msg.conversationId === convId) setTyping(null);
    });
    const u4  = socket.on('message:status', ({ id, status }) => {
      setMessages(prev => prev.map(m => m.id===id ? { ...m, status } : m));
    });
    // Batch read receipts — server sends one event for N messages
    const u4b = socket.on('message:status_batch', ({ ids, status }) => {
      const idSet = new Set(ids);
      setMessages(prev => prev.map(m => idSet.has(m.id) ? { ...m, status } : m));
    });
    const u5 = socket.on('presence:change', ({ userId, online, lastSeen }) => {
      setPartner(p => p.id === userId
        ? { ...p, online: !!online, lastSeen: lastSeen ?? p.lastSeen ?? Math.floor(Date.now()/1000) }
        : p);
    });
    const u6 = socket.on('chat:cleared', ({ conversationId }) => {
      if (conversationId === convId) { setMessages([]); setPinnedMessage(null); }
    });
    const u6b = socket.on('conversation:deleted', ({ conversationId }) => {
      if (conversationId === convId) {
        heyToast('Чат удалён', 'info');
        nav('/chats');
      }
    });
    const u7 = socket.on('message:edited', ({ message }) => {
      if (message.conversation_id === convId)
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, text: message.text, edited_at: message.edited_at } : m));
    });
    const u8 = socket.on('message:deleted', ({ messageId, conversationId: cid }) => {
      if (cid === convId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessage(p => p && p.id === messageId ? null : p);
      }
    });
    const u9 = socket.on('reaction:update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      // Подсветка сообщения на секунду
      setFlashMsgId(messageId);
      setTimeout(() => setFlashMsgId(curr => curr === messageId ? null : curr), 1000);
    });
    // Асинхронное прибытие link-preview после первичного broadcast'а
    // сообщения (когда url не было в кеше). Просто врезаем поле в state.
    const u9b = socket.on('message:link-preview', ({ messageId, conversationId: cid, link_preview }) => {
      if (cid !== convId) return;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, link_preview } : m));
    });
    // На reconnect WS — могли пропустить message:new из-за оборвавшегося соединения
    // (типичный сценарий на мобильном с плохой сетью). Подтягиваем свежие сообщения.
    const u10 = socket.on('connected', () => {
      if (isInitialLoad.current) return; // первичная загрузка уже выкачает
      api.getMessages(convId).then(data => {
        if (!Array.isArray(data)) return;
        setMessages(prev => {
          // Сливаем: для каждого id берём более «свежую» (с реальным id или со статусом дальше)
          const byId = new Map();
          for (const m of prev) byId.set(m.id, m);
          for (const m of data) {
            const existing = byId.get(m.id);
            // Берём серверную версию (она канонична)
            byId.set(m.id, existing ? { ...existing, ...m } : m);
          }
          return Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
        });
      }).catch(() => {});
    });
    // Возврат во вкладку (мобильный «свернул-развернул») — тоже пересинхрон
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isInitialLoad.current) {
        api.getMessages(convId).then(data => {
          if (!Array.isArray(data)) return;
          setMessages(prev => {
            const byId = new Map();
            for (const m of prev) byId.set(m.id, m);
            for (const m of data) {
              const existing = byId.get(m.id);
              byId.set(m.id, existing ? { ...existing, ...m } : m);
            }
            return Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
          });
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const u11 = socket.on('message:pinned', ({ conversationId, message }) => {
      if (conversationId === convId) setPinnedMessage(message);
    });
    return () => {
      u1(); u2(); u3(); u4(); u4b(); u5(); u6(); u6b(); u7(); u8(); u9(); u9b(); u10(); u11();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [convId, user?.id]);

  function handleInput(e) {
    setText(e.target.value);
    socket.startTyping(convId);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.stopTyping(convId), 1500);
  }

  // Auto-grow + overflow detection. Замеряем scrollHeight после каждой
  // правки. В нормальном режиме textarea растёт до NORMAL_MAX (~140px),
  // дальше включается scroll и показываются шевроны раскрытия. В expanded
  // режиме высоту задаём отдельно из render-ветки (там min(60vh, 480px)).
  const NORMAL_MAX = 140;
  const composerLineCount = text ? text.split('\n').length : 1;
  const composerStacked = composerLineCount >= 3;
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (composerExpanded) {
      // В раскрытом режиме высоту задаёт inline-style ниже
      ta.style.height = '';
      // Всё равно меряем, чтобы знать что overflow=true и кнопка свернуть
      // должна быть видна.
      const sh = ta.scrollHeight;
      setComposerOverflow(sh > NORMAL_MAX);
      return;
    }
    // Сбрасываем, чтобы scrollHeight отразил реальный контент, а не предыдущую высоту
    ta.style.height = 'auto';
    const sh = ta.scrollHeight;
    ta.style.height = Math.min(sh, NORMAL_MAX) + 'px';
    setComposerOverflow(sh > NORMAL_MAX);
  }, [text, composerExpanded]);

  // ── Voice recording ────────────────────────────────────────────────────────

  const MAX_VOICE_SEC = user?.is_super ? 300 : 60; // 5 min Super, 1 min free

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')  ? 'audio/mp4'
        : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const objUrl = URL.createObjectURL(blob);
        setVoiceBlob(blob);
        setVoiceObjUrl(objUrl);
        setVoiceDuration(recTime);
        setVoiceState('preview');
        // Stop all tracks
        recStreamRef.current?.getTracks().forEach(t => t.stop());
        recStreamRef.current = null;
      };
      mr.start(200); // collect every 200ms

      // ── Web Audio: waveform analyser ──
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source   = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const draw = () => {
          waveRafRef.current = requestAnimationFrame(draw);
          const canvas = waveCanvasRef.current;
          if (!canvas) return;
          const ctx2d = canvas.getContext('2d');
          const W = canvas.width, H = canvas.height;
          const bufLen = analyser.frequencyBinCount;
          const data   = new Uint8Array(bufLen);
          analyser.getByteFrequencyData(data);

          ctx2d.clearRect(0, 0, W, H);

          const barCount = 28;
          const barW     = 3;
          const gap      = (W - barCount * barW) / (barCount + 1);
          for (let i = 0; i < barCount; i++) {
            // Sample from lower half of freq bins (voice range)
            const binIdx  = Math.floor((i / barCount) * (bufLen * 0.5));
            const raw     = data[binIdx] / 255;
            const minH    = 3;
            const barH    = Math.max(minH, raw * (H - 4));
            const x       = gap + i * (barW + gap);
            const y       = (H - barH) / 2;
            const alpha   = 0.4 + raw * 0.6;
            ctx2d.fillStyle = `rgba(220,180,255,${alpha})`;
            ctx2d.beginPath();
            ctx2d.roundRect(x, y, barW, barH, 2);
            ctx2d.fill();
          }
        };
        draw();
      } catch { /* Web Audio not available — graceful degradation */ }

      setVoiceState('recording');
      setRecTime(0);

      recTimerRef.current = setInterval(() => {
        setRecTime(t => {
          const next = t + 1;
          if (next >= MAX_VOICE_SEC) {
            stopRecording();
            if (!user?.is_super) {
              // L1 (мягкий): просто тост о лимите, без промо СУПЕР.
              // L2 (жёсткий): полноэкранный попап с призывом к СУПЕР.
              if (salesPressure >= 2) setShowVoiceLimit(true);
              else heyToast('Лимит голосового — 1 минута', 'info');
            }
          }
          return next;
        });
      }, 1000);
    } catch {
      heyToast('Нет доступа к микрофону', 'error');
    }
  }

  function stopWaveform() {
    cancelAnimationFrame(waveRafRef.current);
    waveRafRef.current  = null;
    analyserRef.current = null;
  }

  function stopRecording() {
    clearInterval(recTimerRef.current);
    stopWaveform();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }

  function cancelVoice() {
    clearInterval(recTimerRef.current);
    stopWaveform();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    recStreamRef.current?.getTracks().forEach(t => t.stop());
    recStreamRef.current = null;
    if (voiceObjUrl) URL.revokeObjectURL(voiceObjUrl);
    setVoiceState(null);
    setVoiceBlob(null);
    setVoiceObjUrl(null);
    setVoiceDuration(0);
    setRecTime(0);
  }

  async function sendVoice() {
    if (!voiceBlob) return;
    const blob = voiceBlob;
    const dur  = voiceDuration || recTime;
    const objUrl = voiceObjUrl;
    // Optimistic clear
    cancelVoice();
    let url;
    try {
      url = await uploadAudioBlob(blob, { getPresignUrl: api.getPresignUrl });
    } catch(e) {
      heyToast('Не удалось отправить голосовое: ' + e.message, 'error');
      return;
    }
    const attachment = { type: 'audio', url, duration: Math.round(dur) };
    const tempId = 'tmp-' + Date.now();
    forceScrollBottom.current = true;
    setMessages(prev => [...prev, {
      id: tempId, text: null, attachment,
      sender_id: user.id, sender_name: user.name,
      status: 'sent', created_at: Math.floor(Date.now() / 1000),
    }]);
    socket.sendMessage(convId, '', tempId, attachment);
    if (objUrl) URL.revokeObjectURL(objUrl);
  }

  function fmtRecTime(s) {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    await addFilesToComposer(files);
  }

  // Общий обработчик для input-выбора и drag&drop из Проводника/Finder.
  // Разделяет: изображения → в preview-бар (галерея до 10), прочие
  // (видео/аудио/документы) → в filePreview (один файл, одно сообщение).
  async function addFilesToComposer(files) {
    const images = files.filter(f => f.type.startsWith('image/'));
    const others = files.filter(f => !f.type.startsWith('image/'));

    if (images.length) {
      const MAX_TOTAL = 10;
      const remaining = MAX_TOTAL - imgPreviews.length;
      if (remaining <= 0) {
        heyToast(`Можно прикрепить максимум ${MAX_TOTAL} изображений`, 'warning');
      } else {
        const added = [];
        for (const file of images.slice(0, remaining)) {
          if (file.size > 10 * 1024 * 1024) {
            heyToast(`«${file.name}» слишком большой (макс. 10 МБ)`, 'warning');
            continue;
          }
          added.push({ dataUrl: previewUrl(file), file, uploading: false });
        }
        if (added.length) setImgPreviews(prev => [...prev, ...added]);
        if (images.length > remaining) {
          heyToast(`Лимит ${MAX_TOTAL} картинок — лишние не добавлены`, 'warning');
        }
      }
    }

    if (others.length) {
      if (filePreview) {
        heyToast('Файл уже выбран — отправь или удали его', 'warning');
        return;
      }
      const file = others[0];
      const maxMb = user?.is_super ? 50 : 25;
      if (file.size > maxMb * 1024 * 1024) {
        heyToast(`«${file.name}» слишком большой (макс. ${maxMb} МБ)`, 'warning');
        return;
      }
      if (others.length > 1) {
        heyToast('Можно прикрепить только один файл за раз', 'warning');
      }
      setFilePreview({ file, uploading: false });
    }
  }

  function fmtFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  // Загрузить текущие вложения композера (картинки или файл) и собрать
  // объект attachment, как у обычного сообщения. Используется и обычной
  // отправкой, и планированием — переиспользуем единый код заливки.
  // Возвращает: { attachment | null, kind: 'images'|'file'|null }
  async function uploadComposerAttachment() {
    if (imgPreviews.length > 0) {
      if (imgPreviews.some(p => p.uploading)) return { attachment: null, kind: null, busy: true };
      const captured = imgPreviews;
      const results = await Promise.all(captured.map(p =>
        uploadMedia(p.file, 'chat-image', {
          getPresignUrl: api.getPresignUrl,
          uploadImage:   api.uploadImage,
        })
      ));
      const urls = results.map(r => r.url);
      const attachment = urls.length === 1
        ? { type: 'image',  url:  urls[0] }
        : { type: 'images', urls };
      return { attachment, kind: 'images', captured };
    }
    if (filePreview) {
      const uploaded = await uploadFile(filePreview.file, { getPresignUrl: api.getPresignUrl });
      return {
        attachment: {
          type: 'file', url: uploaded.url, name: uploaded.name,
          size: uploaded.size, mime: uploaded.mime,
        },
        kind: 'file',
      };
    }
    return { attachment: null, kind: null };
  }

  async function send() {
    const t = text.trim();

    if (imgPreviews.length > 0) {
      if (imgPreviews.some(p => p.uploading)) return;
      const captured = imgPreviews;
      const capturedText = t;
      setImgPreviews(prev => prev.map(p => ({ ...p, uploading: true })));

      let urls = [];
      try {
        const results = await Promise.all(captured.map(p =>
          uploadMedia(p.file, 'chat-image', {
            getPresignUrl: api.getPresignUrl,
            uploadImage:   api.uploadImage,
          })
        ));
        urls = results.map(r => r.url);
      } catch (err) {
        heyToast(err.message || 'Не удалось загрузить изображения', 'error');
        setImgPreviews(prev => prev.map(p => ({ ...p, uploading: false })));
        return;
      }

      // Если только одна — оставляем старый формат для обратной совместимости
      const attachment = urls.length === 1
        ? { type: 'image',  url:  urls[0] }
        : { type: 'images', urls };

      const tempId = 'tmp-' + Date.now();
      const reply = replyTo ? makeReplySnippet(replyTo) : null;
      forceScrollBottom.current = true;
      setMessages(prev => [...prev, {
        id: tempId, text: capturedText || null, attachment, sender_id: user.id,
        sender_name: user.name, status: 'sent',
        created_at: Math.floor(Date.now() / 1000),
        reply_to_id: replyTo?.id || null, reply_to: reply,
      }]);
      socket.sendMessage(convId, capturedText || '', tempId, attachment, replyTo?.id);
      // Освобождаем object URLs
      captured.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
      setImgPreviews([]);
      setText('');
      setReplyTo(null);
      return;
    }

    // Отправка файла (PDF/DOC/архив и т.п.)
    if (filePreview) {
      const f = filePreview.file;
      setFilePreview(p => p ? { ...p, uploading: true } : p);
      let uploaded;
      try {
        uploaded = await uploadFile(f, { getPresignUrl: api.getPresignUrl });
      } catch (err) {
        heyToast(err.message || 'Не удалось загрузить файл', 'error');
        setFilePreview(p => p ? { ...p, uploading: false } : p);
        return;
      }
      const attachment = {
        type: 'file',
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size,
        mime: uploaded.mime,
      };
      const tempId = 'tmp-' + Date.now();
      const reply  = replyTo ? makeReplySnippet(replyTo) : null;
      forceScrollBottom.current = true;
      setMessages(prev => [...prev, {
        id: tempId, text: t || null, attachment, sender_id: user.id,
        sender_name: user.name, status:'sent',
        created_at: Math.floor(Date.now()/1000),
        reply_to_id: replyTo?.id || null, reply_to: reply,
      }]);
      socket.sendMessage(convId, t || '', tempId, attachment, replyTo?.id);
      setFilePreview(null);
      setText('');
      setReplyTo(null);
      return;
    }

    // Если момент прицеплен — можно отправить и пустым текстом.
    if (!t && !momentRef) return;

    if (editingMsg) {
      api.editMessage(convId, editingMsg.id, t)
        .then(updated => setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text, edited_at: updated.edited_at } : m)))
        .catch(e => heyToast(e.message, 'error'));
      setEditingMsg(null);
      // После завершения правки возвращаем тот черновик собеседнику,
      // который был до старта правки (а не очищаем безусловно).
      setText(savedDraftRef.current);
      savedDraftRef.current = '';
      return;
    }

    const tempId = 'tmp-' + Date.now();
    const reply  = replyTo ? makeReplySnippet(replyTo) : null;
    // Если к черновику прицеплен момент — кладём его как attachment.
    const attachment = momentRef ? { type: 'moment', moment: momentRef } : null;
    forceScrollBottom.current = true;
    setMessages(prev => [...prev, {
      id: tempId, text: t, sender_id: user.id,
      sender_name: user.name, status:'sent',
      created_at: Math.floor(Date.now()/1000),
      attachment,
      reply_to_id: replyTo?.id || null, reply_to: reply,
    }]);
    socket.sendMessage(convId, t, tempId, attachment, replyTo?.id);
    setText('');
    setReplyTo(null);
    setMomentRef(null);
    socket.stopTyping(convId);
  }

  // Открытие момента из чата по клику на прицепленную мини-карточку
  async function handleOpenMomentRef(momentId) {
    if (!momentId) return;
    setMomentChatLoading(true);
    try {
      const m = await api.getMoment(momentId);
      setMomentChatPopup({ moments: [m], idx: 0 });
    } catch (e) {
      heyToast('Момент недоступен: ' + (e.message || 'удалён'), 'error');
    }
    setMomentChatLoading(false);
  }

  // Локальный snippet для оптимистического показа цитаты (до прихода реального с сервера)
  function makeReplySnippet(m) {
    if (!m) return null;
    let attType = null;
    if (m.attachment?.type) attType = m.attachment.type;
    return {
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_id === user?.id ? (user?.name || 'Вы') : (m.sender_name || partner.name),
      text: m.text ? m.text.slice(0, 120) : null,
      attachment_type: attType,
    };
  }

  function startEdit(msg) {
    // Запоминаем текущий черновик чтобы вернуть после отмены/окончания правки.
    savedDraftRef.current = text;
    setEditingMsg(msg);
    setText(msg.text);
    setMsgMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingMsg(null);
    // Восстанавливаем то, что пользователь набирал собеседнику до правки.
    setText(savedDraftRef.current);
    savedDraftRef.current = '';
  }

  async function deleteMsg(msg) {
    setMsgMenu(null);
    await api.deleteMessage(convId, msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  }

  async function pinMsg(msg) {
    setMsgMenu(null);
    try {
      await api.pinMessage(convId, msg.id);
      // pinnedMessage обновится через WS-событие, но на всякий случай ставим оптимистически
      setPinnedMessage(msg);
    } catch (e) {
      heyToast('Не удалось закрепить: ' + (e.message || ''), 'error');
    }
  }

  async function unpinMsg() {
    setMsgMenu(null);
    try {
      await api.unpinMessage(convId);
      setPinnedMessage(null);
    } catch (e) {
      heyToast('Не удалось открепить: ' + (e.message || ''), 'error');
    }
  }

  function openForwardModal(msg) {
    setMsgMenu(null);
    setForwardModal({ messageId: msg.id });
  }

  function openMsgMenu(e, msg) {
    e.preventDefault();
    // Контекстное меню реально ~7 пунктов × ~44px + паддинги ≈ 320 px.
    // Раньше использовали MENU_H=100 — поэтому меню часто открывалось
    // под сообщением и нижние пункты («Удалить») уходили за край экрана.
    const MENU_W = 220, MENU_H = 320;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth)  x = Math.max(8, window.innerWidth  - MENU_W - 8);
    if (y + MENU_H > window.innerHeight) y = Math.max(8, window.innerHeight - MENU_H - 8);
    setMsgMenu({ x, y, msg });
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    if (e.key === 'Escape' && editingMsg) cancelEdit();
  }

  function insertEmoji(name) {
    setText(t => t + `[${name}]`);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  function toggleReaction(msgId, emoji) {
    socket.send('reaction:toggle', { messageId: msgId, conversationId: convId, emoji });
    setReactionPicker(null);
  }

  const statusIcon = (s) => {
    if (s === 'read')      return <span style={{opacity:1,color:'rgba(160,230,255,1)'}}>✓✓</span>;
    if (s === 'delivered') return <span style={{opacity:.55}}>✓</span>;
    return <span style={{opacity:.4}}>✓</span>;
  };

  async function handleClearChat() {
    if (!await customConfirm('Удалить всё содержимое чата? Это действие невозможно отменить.', {
      danger: true, requireWord: 'удалить'
    })) return;
    await api.clearMessages(convId);
    setMessages([]);
  }

  function handleExportChat() {
    const lines = messages.map(m => {
      const time = new Date(m.created_at * 1000).toLocaleString('ru');
      const name = m.sender_id === user.id ? 'Вы' : (partner.name || m.sender_name);
      return `[${time}] ${name}: ${m.text || ''}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${partner.name || convId}_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleDeleteConversation() {
    const isGroup = partner.isGroup;
    const title = isGroup
      ? <>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>
            Удалить группу «{partner.name}»?
          </div>
          <div style={{color:'rgba(249,240,240,.65)',fontSize:13,lineHeight:1.6}}>
            Группа исчезнет у всех участников. Все сообщения, реакции и медиа удалятся безвозвратно.
          </div>
        </>
      : <>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>
            Удалить чат с {partner.name}?
          </div>
          <div style={{color:'rgba(249,240,240,.65)',fontSize:13,lineHeight:1.6}}>
            Переписка удалится <strong>у обоих</strong>. Все сообщения, реакции и медиа — безвозвратно.
          </div>
        </>;
    const ok = await customConfirm(title, { requireWord: 'УДАЛИТЬ', danger: true });
    if (!ok) return;
    try {
      await api.deleteConversation(convId);
      // broadcast 'conversation:deleted' тоже придёт, но мы уже навигируемся
      nav('/chats');
    } catch (e) {
      heyToast('Не удалось удалить: ' + (e.message || 'ошибка'), 'error');
    }
  }

  async function handleLeaveGroup() {
    if (!await customConfirm(
      `Покинуть группу «${partner.name}»? Вы потеряете доступ к переписке.`,
      { danger: true, confirmLabel: 'Покинуть' }
    )) return;
    try {
      await api.removeGroupMember(convId, user.id);
      nav('/chats');
    } catch (e) {
      heyToast('Не удалось выйти: ' + (e.message || 'ошибка'), 'error');
    }
  }

  async function handleSearch(q) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const results = await api.searchMessages(convId, q).catch(() => []);
    setSearchResults(results);
  }

  function closeSearch() {
    setSearchMode(false);
    setSearchQuery('');
    setSearchResults(null);
  }

  async function handleAddContact() {
    if (!partner.id) return;
    try {
      await api.addContact({ userId: partner.id });
      setIsContact(true);
    } catch(e) {
      heyToast(e.message || 'Не удалось добавить в контакты', 'error');
    }
  }

  // В группе содержимое может чистить только админ; в direct/monolog — любой участник
  const isGroupAdmin = partner.isGroup && !!partner.myIsGroupAdmin;
  const canClearChat = !partner.isGroup || isGroupAdmin;
  // Админ группы не выходит через «выйти» — должен сначала передать админство
  // или удалить группу полностью
  const canLeaveGroup = partner.isGroup && !isGroupAdmin;
  // Полное удаление чата: direct — любой участник, group — только админ. Monolog нельзя.
  const canDeleteChat = !partner.isMonolog && (partner.isGroup ? isGroupAdmin : true);

  const chatMenuItems = [
    { label: 'Поиск',                   iconName: 'search',  onClick: () => { setSearchMode(true); setTimeout(()=>searchRef.current?.focus(),50); } },
    { label: 'Медиа и ссылки',          iconName: 'media',   onClick: () => setShowMedia(true) },
    ...(partner.isArchived ? [
      { label: 'Вернуть из архива',      iconName: 'archive', onClick: async () => {
        try {
          await api.unarchiveConversation(convId);
          heyToast('Чат восстановлен', 'success');
          setPartner(p => ({ ...p, isArchived: false }));
        } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
      } },
    ] : [
      { label: 'В архив',                iconName: 'archive', onClick: async () => {
        try {
          await api.archiveConversation(convId);
          heyToast('В архиве', 'success');
          nav('/chats');
        } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
      } },
    ]),
    ...(partner.isGroup ? [
      { label: 'Настройки группы',      icon: <Icon name="settings" size={15}/>, onClick: () => nav(`/groups/${convId}/settings`) },
      ...(isGroupAdmin ? [
        { label: 'Скопировать ссылку-приглашение', icon: <Icon name="link" size={15}/>, onClick: async () => {
          try {
            const { token } = await api.groupInviteLink(convId);
            const url = window.location.origin + '/gjoin/' + token;
            try { await navigator.clipboard.writeText(url); } catch {
              const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta);
              ta.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
            }
            heyToast('Ссылка скопирована — отправь её другу', 'success');
          } catch (e) { heyToast(e.message || 'Не удалось создать ссылку', 'error'); }
        } },
      ] : []),
    ] : [
      ...(!isContact && partner.id && !partner.isDeleted ? [
        { label: 'Добавить в контакты', icon: <Icon name="user-plus" size={15}/>, onClick: handleAddContact },
      ] : []),
      { label: 'Экспортировать чат',    iconName: 'export', onClick: handleExportChat },
    ]),
    ...(canClearChat ? [
      { label: 'Очистить историю', iconName: 'clear', danger: true, separatorBefore: true, onClick: handleClearChat },
    ] : []),
    ...(canLeaveGroup ? [
      { label: 'Выйти из группы', icon: <Icon name="logout" size={15}/>, danger: true,
        separatorBefore: !canClearChat, onClick: handleLeaveGroup },
    ] : []),
    ...(canDeleteChat ? [
      { label: partner.isGroup ? 'Удалить группу' : 'Удалить чат',
        iconName: 'delete', danger: true,
        separatorBefore: !canClearChat && !canLeaveGroup,
        onClick: handleDeleteConversation },
    ] : []),
  ];

  // Flat item list for Virtuoso: date separators interleaved with messages + typing
  const flatItems = useMemo(() => {
    const result = [];
    let lastDay = null;
    for (const m of messages) {
      const day = new Date(m.created_at * 1000).toDateString();
      if (day !== lastDay) {
        result.push({ type: 'date', id: 'date-' + day, day, label: fmtDate(m.created_at) });
        lastDay = day;
      }
      result.push({ type: 'msg', ...m });
    }
    if (typing) result.push({ type: 'typing', id: 'typing' });
    return result;
  }, [messages, typing]);

  // ── Scroll to specific message (клик на цитату / закреп) ──────────────
  // Двухстадийная схема:
  //  • Event handler делает загрузку (если сообщение не в буфере) и
  //    выставляет pendingScrollTarget — просто ID. Сам скролл откладываем.
  //  • Effect ниже срабатывает на изменение flatItems (т.е. когда
  //    React уже закоммитил новые messages в state и Virtuoso получил
  //    свежий data prop) и выполняет series of scrollToIndex.
  // Так мы избегаем гонки «scrollToIndex до commit-а нового data», когда
  // Virtuoso видит ещё старый виртуальный диапазон.
  const pendingScrollTargetRef = useRef(null);
  const [scrollTick, setScrollTick] = useState(0);

  useEffect(() => {
    async function onScrollTo(e) {
      const targetId = e.detail;
      if (!targetId) return;

      let curMessages = messages;
      let curHasMore  = hasMore;
      const findArrayIdx = () => curMessages.findIndex(m => m.id === targetId);
      function flatCount(arr) {
        let lastDay = null, n = 0;
        for (const m of arr) {
          const day = new Date(m.created_at * 1000).toDateString();
          if (day !== lastDay) { n++; lastDay = day; }
          n++;
        }
        return n;
      }
      if (findArrayIdx() < 0) {
        let attempts = 0;
        try { heyToast('Загружаем сообщения…', 'info'); } catch {}
        while (findArrayIdx() < 0 && curHasMore && attempts < 20) {
          attempts++;
          if (!curMessages.length) break;
          let older;
          try { older = await api.getMessages(convId, curMessages[0].created_at); }
          catch { older = null; }
          if (!Array.isArray(older) || !older.length) {
            setHasMore(false); curHasMore = false; break;
          }
          if (older.length < 50) curHasMore = false;
          const newMessages = [...older, ...curMessages];
          const flatGrown   = flatCount(newMessages) - flatCount(curMessages);
          curMessages = newMessages;
          setFirstItemIndex(prev => prev - flatGrown);
          setMessages(curMessages);
          if (!curHasMore) setHasMore(false);
        }
      }

      if (findArrayIdx() < 0) {
        heyToast('Сообщение не найдено в истории', 'error');
        return;
      }
      // Просим скролл-эффект ниже сделать прокрутку — он сам найдёт
      // актуальный индекс в свежем flatItems после React commit.
      pendingScrollTargetRef.current = { id: targetId, attempts: 0 };
      setScrollTick(x => x + 1);
    }
    window.addEventListener('hey:scroll-to-msg', onScrollTo);
    return () => window.removeEventListener('hey:scroll-to-msg', onScrollTo);
  }, [messages, hasMore, convId]);

  // Эффект-скролл: запускается при изменении flatItems или явном
  // scrollTick. react-virtuoso v4: scrollToIndex({ index }) интерпретирует
  // index как ПОЗИЦИЮ В МАССИВЕ data (а не «виртуальный» индекс с
  // учётом firstItemIndex). Поэтому передаём чистый idx — раньше мы
  // прибавляли firstItemIndex и получали либо out-of-range клампинг,
  // либо промах на длину prepend-сдвига.
  useEffect(() => {
    const target = pendingScrollTargetRef.current;
    if (!target) return;
    const idx = flatItems.findIndex(it => it.type === 'msg' && it.id === target.id);
    if (idx < 0) return; // не подгружено — следующий тик доберёт
    const targetId = target.id;
    pendingScrollTargetRef.current = null;

    setFlashMsgId(targetId);
    setTimeout(() => setFlashMsgId(curr => curr === targetId ? null : curr), 1500);

    const scroll = (opts) => virtuosoRef.current?.scrollToIndex({ index: idx, ...opts });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Сразу — instant, чтобы Virtuoso смонтировал нужные ряды и
      // начал измерять их высоту.
      scroll({ align: 'center', behavior: 'auto' });
      // Серия дозиров — картинки/embed-видео отрисовываются с
      // задержкой и меняют layout, попутно «уезжая» от исходной
      // позиции. Подстраиваемся.
      setTimeout(() => scroll({ align: 'center', behavior: 'auto' }), 120);
      setTimeout(() => scroll({ align: 'center', behavior: 'auto' }), 350);
      setTimeout(() => scroll({ align: 'center', behavior: 'auto' }), 800);
      setTimeout(() => scroll({ align: 'center', behavior: 'auto' }), 1500);
    }));
  }, [flatItems, scrollTick]);

  // Stable callbacks for MessageRow (avoid re-renders from parent re-binding)
  const handleOpenMenu  = useCallback((e, m) => openMsgMenu(e, m), []);
  const handleLightbox  = useCallback((src, urls) => {
    if (Array.isArray(urls) && urls.length > 1) {
      const idx = Math.max(0, urls.indexOf(src));
      setLightbox({ urls, index: idx });
    } else {
      setLightbox({ urls: [src], index: 0 });
    }
  }, []);
  const handleToggleRxn = useCallback((msgId, emoji) => {
    socket.send('reaction:toggle', { messageId: msgId, conversationId: convId, emoji });
    setReactionPicker(null);
  }, [convId]);
  const handleSetRxnPicker = useCallback((fn) => setReactionPicker(fn), []);

  // Drag&drop файлов из Проводника/Finder в чат. Используем счётчик
  // dragDepth — браузер триггерит dragenter/leave на каждом дочернем
  // узле, поэтому простой boolean мигал бы.
  function onDragEnter(e) {
    // Принимаем только реальные файлы (не внутренний drag по странице,
    // например при перетягивании моментов).
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDragOver(true);
  }
  function onDragOverChat(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeaveChat(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }
  function onDropChat(e) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) addFilesToComposer(files);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOverChat}
      onDragLeave={onDragLeaveChat}
      onDrop={onDropChat}
      style={{
      // 100dvw/dvh учитывают мобильную клавиатуру и адресную полоску;
      // overflow:hidden + maxWidth:100vw — последняя страховка, чтобы
      // длинная цитата в reply-banner не могла породить горизонтальный
      // скролл всего экрана.
      position:'fixed', top:0, left:0, right:0, bottom:0,
      width:'100dvw', maxWidth:'100vw',
      display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--grad)', boxSizing:'border-box',
    }}>
      {isDragOver && (
        <div style={{
          position:'absolute', inset: 16, zIndex: 9000,
          background:'rgba(95, 64, 128,.28)', backdropFilter:'blur(6px)',
          border:'2px dashed rgba(220,200,255,.85)',
          borderRadius: 22, pointerEvents:'none',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap: 14,
          color:'#F9F0F0', fontSize: 18, fontWeight: 700,
          textShadow:'0 2px 6px rgba(0,0,0,.4)',
        }}>
          <Icon name="upload" size={56} stroke={1.5}/>
          <div>Отпусти, чтобы прикрепить</div>
          <div style={{ fontSize: 13, fontWeight: 500, opacity:.85 }}>
            картинки, видео, аудио или документ
          </div>
        </div>
      )}
      {/* TopBar — клик на аватар/имя собеседника открывает его профиль */}
      <div className="topbar">
        <div className="topbar-inner">
          <button className="back-btn" onClick={() => {
            if (window.history.length > 1 && location.key !== 'default') nav(-1);
            else nav('/chats');
          }}>‹</button>
          {partner.isMonolog ? (
            <div style={{width:36,height:36,borderRadius:'12px',flexShrink:0,
              background:'linear-gradient(135deg,#5F4080,#8060c0)',
              display:'flex',alignItems:'center',justifyContent:'center',color:'#F9F0F0'}}>
              <Icon name="edit" size={18}/>
            </div>
          ) : partner.isGroup ? (() => {
            const ic = partner.icon || '';
            const isImg = ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:');
            return (
              <div onClick={() => nav(`/groups/${convId}/settings`)}
                style={{width:36,height:36,borderRadius:'12px',flexShrink:0,cursor:'pointer',overflow:'hidden',
                  background: isImg ? '#0a0518' : 'rgba(95, 64, 128,.5)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transition:'transform .15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                {isImg
                  ? <img src={ic} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (ic || '👥')}
              </div>
            );
          })() : (
            <div onClick={() => partner.id && openUserCard(partner.id)}
              style={{cursor: partner.id ? 'pointer' : 'default',transition:'transform .15s',
                position:'relative',width:36,height:36,flexShrink:0}}
              onMouseEnter={e=>{ if(partner.id) e.currentTarget.style.transform='scale(1.05)'; }}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <AvatarDisplay avatar={partner.avatar} name={partner.name} size={36}/>
              {partner.isSuper && (
                <div style={{
                  position:'absolute',bottom:-1,right:-1,
                  width:14,height:14,borderRadius:'50%',
                  background:'linear-gradient(135deg,#c8a8ff,#5F4080)',
                  border:'2px solid rgba(95, 64, 128,.95)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  pointerEvents:'none',
                }}>
                  <HeyLogo size={8}/>
                </div>
              )}
            </div>
          )}
          <div onClick={() => {
              if (partner.isGroup) nav(`/groups/${convId}/settings`);
              else if (partner.id) openUserCard(partner.id);
            }}
            style={{flex:1,marginLeft:8,minWidth:0,
              cursor: (partner.isGroup || partner.id) ? 'pointer' : 'default'}}>
            <div className="topbar-title" style={{flex:'unset',display:'flex',alignItems:'center',gap:8}}>
              <span>{partner.name}</span>
              {!!partner.online && !partner.isGroup && !partner.isMonolog && !partner.isSystem && (
                <span style={{
                  width:9, height:9, borderRadius:'50%',
                  background:'rgba(110,235,150,1)',
                  boxShadow:'0 0 0 2px rgba(40,30,80,.5), 0 0 6px rgba(110,235,150,.5)',
                  flexShrink:0,
                }}/>
              )}
            </div>
            {partner.isGroup && <div style={{fontSize:11,color:'rgba(249,240,240,.5)'}}>группа</div>}
            {!partner.isGroup && !partner.isMonolog && !partner.isSystem
             && !!partner.id && !!user?.is_super
             && !partner.online && !!partner.lastSeen && (
              <div style={{fontSize:11,color:'rgba(249,240,240,.55)'}}>
                был {fmtLastSeenShort(partner.lastSeen)}
              </div>
            )}
          </div>
          <ChatContextMenu
            items={chatMenuItems}
            trigger={
              <div className="topbar-dots">
                {[0,1,2].map(i => <div key={i} className="topbar-dot"/>)}
              </div>
            }
          />
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && !searchMode && (() => {
        const canUnpin = partner.isGroup ? !!partner.myIsGroupAdmin : true;
        const pinnedText = pinnedMessage.text || '';
        const pinnedAtt = !pinnedText && pinnedMessage.attachment ? pinnedMessage.attachment : null;
        return (
          <div style={{
            background:'rgba(50,38,90,.85)', backdropFilter:'blur(12px)',
            borderBottom:'1px solid rgba(180,140,220,.18)',
            flexShrink:0,
          }}>
            <div style={{maxWidth: 540, margin:'0 auto',
              display:'flex',alignItems:'center',gap:10,padding:'8px 14px'}}>
              <span style={{flexShrink:0,color:'rgba(230,200,255,.95)',display:'inline-flex'}}>
                <Icon name="pin" size={16}/>
              </span>
              <div onClick={() => {
                  window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: pinnedMessage.id }));
                }}
                style={{flex:1,minWidth:0,cursor:'pointer'}}>
                <div style={{color:'rgba(249,240,240,.92)',fontSize:13,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {pinnedText
                    ? renderPreviewWithEmoji(pinnedText.slice(0, 200))
                    : pinnedAtt
                      ? <AttachmentPreview type={pinnedAtt.type} name={pinnedAtt.name} size={12} />
                      : 'Вложение'}
                </div>
              </div>
              {canUnpin && (
                <button onClick={unpinMsg} title="Открепить"
                  style={{background:'rgba(249,240,240,.08)',border:'none',
                    color:'rgba(249,240,240,.6)',fontSize:14,cursor:'pointer',
                    width:28,height:28,borderRadius:'50%',flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.18)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(249,240,240,.08)'}>
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Search bar */}
      {searchMode && (
        <div style={{ background:'rgba(60,45,90,.8)', flexShrink:0 }}>
          <div style={{maxWidth:680,margin:'0 auto',display:'flex',alignItems:'center',gap:8,padding:'8px 14px'}}>
            <input ref={searchRef} value={searchQuery}
              onChange={e=>handleSearch(e.target.value)}
              placeholder="Поиск в переписке…"
              style={{flex:1,background:'rgba(249,240,240,.15)',border:'none',outline:'none',
                borderRadius:20,padding:'8px 14px',color:'#F9F0F0',fontSize:14,fontFamily:'inherit'}}/>
            <button onClick={closeSearch}
              style={{background:'none',border:'none',color:'rgba(249,240,240,.6)',fontSize:20,cursor:'pointer'}}>✕</button>
          </div>
        </div>
      )}

      {/* Search results */}
      {searchMode && searchResults !== null && (
        <div style={{flex:1,overflowY:'auto'}}>
          <div style={{maxWidth:680,margin:'0 auto',padding:'8px 16px',
            display:'flex',flexDirection:'column',gap:6}}>
          {searchResults.length === 0
            ? <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',marginTop:40}}>Ничего не найдено</div>
            : searchResults.map(m => (
                <div
                  key={m.id}
                  onClick={() => {
                    // Закрываем поиск и переходим к сообщению в чате
                    setSearchMode(false);
                    setSearchQuery('');
                    setSearchResults(null);
                    // Даём Virtuoso перерисоваться, потом скроллим
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: m.id }));
                    }, 50);
                  }}
                  style={{background:'rgba(249,240,240,.08)',borderRadius:12,padding:'10px 14px',
                    cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(249,240,240,.13)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(249,240,240,.08)'}
                >
                  <div style={{color:'rgba(249,240,240,.5)',fontSize:11,marginBottom:4}}>
                    {m.sender_name} · {fmtTime(m.created_at)}
                  </div>
                  <div style={{color:'#F9F0F0',fontSize:14}}
                    dangerouslySetInnerHTML={{__html: m.text?.replace(
                      new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),
                      s=>`<mark style="background:rgba(200,160,80,.5);border-radius:3px">${s}</mark>`
                    )}}/>
                </div>
              ))
          }
          </div>
        </div>
      )}

      {/* Пустой «Монолог» — показываем подсказку про что это за чат */}
      {!requestLock && !groupInvite && !(searchMode && searchResults !== null) &&
       partner.isMonolog && messages.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 24px', overflowY: 'auto',
        }}>
          <div style={{
            maxWidth: 460, width: '100%',
            background: 'rgba(20,12,40,.55)',
            border: '1px solid rgba(249,240,240,.12)',
            borderRadius: 18, padding: '26px 24px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 12px 36px rgba(0,0,0,.25)',
          }}>
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'center',
              width:56,height:56,borderRadius:'50%',color:'#F9F0F0',
              background:'linear-gradient(135deg,#7c4ddc,#a78bfa)',
              margin:'0 auto 14px',
              boxShadow:'0 6px 18px rgba(124,77,220,.4)',
            }}><Icon name="edit" size={26}/></div>
            <h2 style={{
              margin:0,color:'#F9F0F0',fontSize:18,fontWeight:800,
              textAlign:'center',marginBottom:8,
            }}>Это твой Монолог</h2>
            <p style={{
              margin:0,color:'rgba(230,225,250,.85)',fontSize:14,
              lineHeight:1.55,textAlign:'center',marginBottom:18,
            }}>
              Личный чат с самим собой. Видишь только ты — остальные сюда не попадут.
            </p>
            <div style={{
              background:'rgba(249,240,240,.05)',
              borderRadius:12,padding:'12px 14px',
              color:'rgba(230,225,250,.85)',fontSize:13,lineHeight:1.7,
            }}>
              <div style={{
                color:'rgba(200,170,255,1)',fontWeight:700,fontSize:11,
                textTransform:'uppercase',letterSpacing:.6,marginBottom:6,
              }}>Для чего пригодится</div>
              <div>💡 Заметки, мысли, цитаты — на лету</div>
              <div>🔗 Сохранить ссылку, чтобы не потерять</div>
              <div>📎 Прикрепить файл, фото, голосовое — себе</div>
              <div>✏️ Черновики сообщений и идей</div>
              <div>🔍 Всё найдётся через поиск по чату</div>
            </div>
            <p style={{
              margin:'14px 0 0',color:'rgba(230,225,250,.6)',
              fontSize:12,lineHeight:1.5,textAlign:'center',
            }}>
              Начни прямо снизу — напиши что-нибудь себе ↓
            </p>
          </div>
        </div>
      )}

      {/* Messages — virtualized list, DOM nodes fixed at ~50 regardless of history size */}
      {!requestLock && !groupInvite && !(searchMode && searchResults !== null) &&
       !(partner.isMonolog && messages.length === 0) && (
        <Virtuoso
          ref={virtuosoRef}
          style={{ flex: 1, overscrollBehavior: 'contain' }}
          firstItemIndex={firstItemIndex}
          data={flatItems}
          initialTopMostItemIndex={Math.max(0, flatItems.length - 1)}
          startReached={loadOlder}
          atBottomStateChange={bottom => { atBottomRef.current = bottom; setShowScrollDown(!bottom); }}
          followOutput={(atBottom) => {
            if (forceScrollBottom.current) return 'smooth';
            return atBottom ? 'smooth' : false;
          }}
          components={{
            Header: () => loadingMore ? (
              <div style={{textAlign:'center',padding:'8px 0',color:'rgba(249,240,240,.4)',fontSize:13}}>
                Загрузка…
              </div>
            ) : null,
            // Хвостовой отступ — чтобы последнее сообщение / индикатор «печатает»
            // не подъезжали под инпут-бар
            Footer: () => <div style={{ height: 12 }} />,
          }}
          itemContent={(_index, item) => {
            if (item.type === 'date') return (
              <div style={{display:'flex',justifyContent:'center',margin:'8px 16px'}}>
                <div style={{background:'rgba(100,72,140,.38)',borderRadius:14,padding:'4px 14px',
                  color:'rgba(249,240,240,.7)',fontSize:13,fontWeight:600}}>
                  {item.label}
                </div>
              </div>
            );
            if (item.type === 'typing') return (
              // Та же ширина и центрирование что и у пузырьков — иначе
              // на широких экранах индикатор уходит в левый край, а на
              // мобиле подползает прямо под имя последнего сообщения.
              <div style={{maxWidth:680,margin:'0 auto',padding:'4px 24px 12px'}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <div style={{color:'rgba(249,240,240,.6)',fontSize:13,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {typing} печатает
                  </div>
                  <div style={{display:'flex',gap:3,flexShrink:0}}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{width:6,height:6,borderRadius:'50%',
                        background:'rgba(249,240,240,.5)',animation:`typing 1.2s ${i*.2}s infinite`}}/>
                    ))}
                  </div>
                </div>
              </div>
            );
            // Системные плашки группы: и явные system_event (вход/выход/
            // удаление), и любые сообщения от системного аккаунта
            // (`system_*`) — это «X присоединился к курсу», «👋 X
            // присоединился по приглашению» и т.п. Раньше последние
            // рендерились как обычные пузыри с подписью «HEY-заведующий»
            // — пользователь просил оформить иначе, как событие, по
            // центру и без имени отправителя.
            const sysEvent = item.attachment?.system_event;
            const isSystemSender = typeof item.sender_id === 'string' &&
              item.sender_id.startsWith('system_') && partner.isGroup;
            if (sysEvent || isSystemSender) {
              let label = '';
              if (sysEvent?.type === 'member_left') {
                label = `${sysEvent.userName || 'Участник'} покинул(а) группу`;
              } else if (sysEvent?.type === 'member_removed') {
                label = sysEvent.byUserName
                  ? `${sysEvent.byUserName} удалил(а) ${sysEvent.userName || 'участника'} из группы`
                  : `${sysEvent.userName || 'Участник'} удалён(а) из группы`;
              } else if (sysEvent) {
                label = sysEvent.text || 'Системное событие';
              } else {
                label = item.text || 'Системное событие';
              }
              return (
                <div style={{display:'flex',justifyContent:'center',margin:'6px 16px'}}>
                  <div style={{background:'rgba(100,72,140,.28)',borderRadius:14,padding:'4px 14px',
                    color:'rgba(249,240,240,.75)',fontSize:12,fontWeight:500,
                    maxWidth:520,textAlign:'center',lineHeight:1.45,
                    wordBreak:'break-word'}}>
                    {label}
                  </div>
                </div>
              );
            }
            // Regular message
            const isOut = item.sender_id === user?.id;
            return (
              // width:100% + boxSizing — критично: иначе Virtuoso-item
              // не передаёт детям полную ширину контейнера, и `margin:0 auto`
              // не центрирует, а «уходит» вправо на широких экранах.
              <div style={{maxWidth:680, width:'100%', margin:'0 auto',
                padding:'0 16px', boxSizing:'border-box'}}>
                <MessageRow
                  m={item}
                  isOut={isOut}
                  isGroup={partner.isGroup}
                  editingMsgId={editingMsg?.id}
                  reactionPickerMsgId={reactionPicker?.msgId}
                  currentUserId={user?.id}
                  isFlashing={flashMsgId === item.id}
                  onOpenMenu={handleOpenMenu}
                  onLightbox={handleLightbox}
                  onToggleReaction={handleToggleRxn}
                  onSetReactionPicker={handleSetRxnPicker}
                  onOpenMomentRef={handleOpenMomentRef}
                  statusIcon={statusIcon}
                  renderText={renderText}
                />
              </div>
            );
          }}
        />
      )}

      {/* Scroll-to-bottom floating button */}
      {showScrollDown && flatItems.length > 5 && !(searchMode && searchResults !== null) && (
        <button
          onClick={() => {
            forceScrollBottom.current = true;
            virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
            setTimeout(() => { forceScrollBottom.current = false; }, 500);
          }}
          aria-label="К последним сообщениям"
          style={{
            position: 'absolute',
            right: 18,
            bottom: imgPreviews.length > 0 ? 180 : 90,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(60,40,90,.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(249,240,240,.12)',
            color:'#F9F0F0', fontSize: 20, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 50,
            boxShadow: '0 4px 14px rgba(0,0,0,.35)',
            transition: 'background .15s, transform .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(80,55,120,.95)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,40,90,.85)'; }}
        >
          ↓
        </button>
      )}

      {/* Moment-ref pill — мини-карточка момента, прицепленная к черновику
          (зацепка общения после «Написать» из попапа момента) */}
      {momentRef && (
        <div style={{background:'rgba(95, 64, 128,.2)',flexShrink:0,
          borderTop:'1px solid rgba(180,140,220,.18)'}}>
          <div style={{padding:'10px 14px',maxWidth:680,margin:'0 auto',
            display:'flex',alignItems:'center',gap:12}}>
            <div style={{flexShrink:0,width:44,height:44,borderRadius:10,
              overflow:'hidden',background:'#1a0a30',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              {momentRef.media_url && momentRef.media_type === 'image' ? (
                <img src={momentRef.media_url} alt="" draggable={false}
                  style={{width:'100%',height:'100%',objectFit:'cover',
                    objectPosition: momentRef.media_position || '50% 50%'}}/>
              ) : (
                <HeyLogo size={22} color="rgba(220,200,255,.85)" />
              )}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'rgba(220,200,255,.85)',fontSize:11,fontWeight:600,
                textTransform:'uppercase',letterSpacing:.6}}>
                ✦ Момент {momentRef.author_name ? `· ${momentRef.author_name}` : ''}
              </div>
              <div style={{color:'#F9F0F0',fontSize:13,marginTop:2,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {momentRef.text || '— без описания —'}
              </div>
            </div>
            <button onClick={() => setMomentRef(null)}
              title="Открепить момент"
              style={{background:'rgba(0,0,0,.4)',border:'none',color:'#F9F0F0',
                fontSize:14,cursor:'pointer',
                width:28,height:28,borderRadius:'50%',
                display:'flex',alignItems:'center',justifyContent:'center',
                flexShrink:0,lineHeight:1}}>✕</button>
          </div>
        </div>
      )}

      {/* File preview bar — один файл с именем/размером */}
      {filePreview && (
        <div style={{background:'rgba(95, 64, 128,.45)',flexShrink:0}}>
          <div style={{padding:'10px 14px',maxWidth:680,margin:'0 auto',
            display:'flex',alignItems:'center',gap:12}}>
            <span style={{flexShrink:0,display:'inline-flex'}}>
              {fileTypeIcon(filePreview.file.name, filePreview.file.type, 28)}
            </span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'#F9F0F0',fontSize:14,fontWeight:600,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {filePreview.file.name}
              </div>
              <div style={{color:'rgba(249,240,240,.55)',fontSize:12,marginTop:2}}>
                {fmtFileSize(filePreview.file.size)}
                {filePreview.uploading && ' · отправка…'}
              </div>
            </div>
            <button onClick={() => setFilePreview(null)}
              disabled={filePreview.uploading}
              style={{background:'rgba(0,0,0,.4)',border:'none',color:'#F9F0F0',
                fontSize:14,cursor: filePreview.uploading ? 'wait' : 'pointer',
                width:28,height:28,borderRadius:'50%',
                display:'flex',alignItems:'center',justifyContent:'center',
                flexShrink:0,lineHeight:1}}>✕</button>
          </div>
        </div>
      )}

      {/* Image previews bar — до 10 миниатюр в ряд */}
      {imgPreviews.length > 0 && (
        <div style={{background:'rgba(95, 64, 128,.45)',flexShrink:0}}>
          <div style={{padding:'10px 14px',maxWidth:680,margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{color:'rgba(249,240,240,.85)',fontSize:13,fontWeight:600,flex:1}}>
                {imgPreviews.some(p => p.uploading)
                  ? 'Отправка…'
                  : `${imgPreviews.length} ${imgPreviews.length === 1 ? 'картинка' : 'картинки'} · добавь подпись или нажми ➤`}
              </span>
              <button onClick={() => {
                  imgPreviews.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
                  setImgPreviews([]);
                }}
                disabled={imgPreviews.some(p => p.uploading)}
                style={{background:'none',border:'none',color:'rgba(249,240,240,.7)',
                  fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                Сбросить
              </button>
            </div>
            <div style={{display:'flex',gap:6,overflowX:'auto',padding:'2px 0'}}>
              {imgPreviews.map((p, idx) => (
                <div key={idx} style={{position:'relative',flexShrink:0}}>
                  <img src={p.dataUrl} alt=""
                    style={{height:56,width:56,objectFit:'cover',borderRadius:8,
                      opacity: p.uploading ? .5 : 1, transition:'opacity .2s',
                      border:'1px solid rgba(249,240,240,.15)'}}/>
                  {!p.uploading && (
                    <button onClick={() => {
                        try { URL.revokeObjectURL(p.dataUrl); } catch {}
                        setImgPreviews(prev => prev.filter((_, i) => i !== idx));
                      }}
                      style={{
                        position:'absolute',top:-4,right:-4,width:18,height:18,
                        borderRadius:'50%',background:'rgba(0,0,0,.85)',
                        border:'none',color:'#F9F0F0',fontSize:12,cursor:'pointer',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        padding:0,lineHeight:1,
                      }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reply banner */}
      {replyTo && !editingMsg && (() => {
        const isOwnReply = replyTo.sender_id === user?.id;
        const att = replyTo.attachment;
        let preview = (replyTo.text || '').slice(0, 120);
        let thumbUrl = null;
        if (att?.type === 'image')  thumbUrl = att.url;
        if (att?.type === 'images') thumbUrl = (att.urls && att.urls[0]) || null;
        const attType = !preview ? att?.type : null;
        return (
          // overflow:hidden — критично для мобилок: длинное имя отправителя
          // или длинный URL в превью не должен распирать чат и вызывать
          // горизонтальный скролл всего экрана.
          <div style={{background:'rgba(95, 64, 128,.5)',flexShrink:0,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
              // Совпадает с максимальной шириной пузыря сообщения
              // (min(80%, 540px) от родителя ~680px ≈ 540px), чтобы
              // ответ в композере не «выходил» за границы колонки чата
              // на широких экранах.
              maxWidth: 540, margin:'0 auto', minWidth:0}}>
              <div style={{
                width:3,alignSelf:'stretch',minHeight:38,
                background:'rgba(180,140,255,.85)',borderRadius:2,flexShrink:0,
              }}/>
              {thumbUrl && (
                <img src={thumbUrl} alt=""
                  style={{width:40,height:40,objectFit:'cover',borderRadius:6,flexShrink:0}}/>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'rgba(200,170,255,.95)',fontSize:12,fontWeight:700,
                  display:'flex',alignItems:'center',gap:6,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  <span style={{flexShrink:0}}>↩</span>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>
                    В ответ {isOwnReply ? 'себе' : (replyTo.sender_name || partner.name)}
                  </span>
                </div>
                <div style={{color:'rgba(249,240,240,.7)',fontSize:13,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2,
                  wordBreak:'break-all'}}>
                  {preview
                    ? renderPreviewWithEmoji(preview)
                    : attType
                      ? <AttachmentPreview type={attType} name={att?.name} size={12} />
                      : '…'}
                </div>
              </div>
              <button onClick={() => setReplyTo(null)}
                style={{background:'none',border:'none',color:'rgba(249,240,240,.6)',
                  fontSize:22,cursor:'pointer',lineHeight:1,padding:'0 4px',flexShrink:0}}>✕</button>
            </div>
          </div>
        );
      })()}

      {/* Edit banner */}
      {editingMsg && (
        <div style={{background:'rgba(95, 64, 128,.5)',flexShrink:0,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',
            // Та же ширина что и у reply-banner / пузырей — в одну сетку.
            maxWidth: 540, margin:'0 auto', minWidth:0}}>
            <span style={{color:'rgba(249,240,240,.85)',display:'inline-flex',flexShrink:0}}><Icon name="pencil" size={15}/></span>
            <span style={{flex:1,minWidth:0,color:'rgba(249,240,240,.8)',fontSize:13,
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {editingMsg.text}
            </span>
            <button onClick={cancelEdit}
              style={{background:'none',border:'none',color:'rgba(249,240,240,.6)',
                fontSize:20,cursor:'pointer',lineHeight:1,flexShrink:0}}>✕</button>
          </div>
        </div>
      )}

      {/* Emoji keyboard. data-emoji-kbd используется в click-outside handler
          ниже — клик в любую область вне клавиатуры (и не по кнопке "😊")
          закрывает её. */}
      {showEmoji && (
        <div data-emoji-kbd style={{background:'rgba(95, 64, 128,.78)',flexShrink:0}}>
          <div style={{maxWidth:680,margin:'0 auto',padding:'10px 12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
            {HEY_EMOJI.map(name => (
              <button key={name} onClick={() => insertEmoji(name)} title={emojiLabel(name)}
                style={{background:'none',border:'none',cursor:'pointer',
                  padding:6,borderRadius:10,transition:'background .1s',
                  display:'flex',alignItems:'center',justifyContent:'center'}}
                onMouseEnter={ev=>ev.currentTarget.style.background='rgba(249,240,240,.15)'}
                onMouseLeave={ev=>ev.currentTarget.style.background='none'}>
                <img src={emojiUrl(name)} alt={name}
                  style={{width:32,height:32,pointerEvents:'none',
                    filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
              </button>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* ── Group invite overlay ─────────────────────────────────────── */}
      {groupInvite && (
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'28px 24px', gap:18,
        }}>
          {(() => {
            const ic = groupInvite.conversation?.icon || '';
            const isImg = ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:');
            return (
              <div style={{
                width:96, height:96, borderRadius:'50%', overflow:'hidden',
                background: isImg ? '#0a0518' : 'rgba(95, 64, 128,.5)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:46, color:'#F9F0F0',
                border:'3px solid rgba(249,240,240,.25)',
                boxShadow:'0 4px 24px rgba(95, 64, 128,.35)',
              }}>
                {isImg
                  ? <img src={ic} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (ic || '👥')}
              </div>
            );
          })()}
          <div style={{textAlign:'center'}}>
            <div style={{
              background:'rgba(80,50,140,.55)',
              border:'1px solid rgba(180,140,220,.5)',
              color:'#F9F0F0', fontSize:11, fontWeight:700,
              letterSpacing:.9, textTransform:'uppercase',
              padding:'4px 12px', borderRadius:50, marginBottom:10,
              display:'inline-flex',alignItems:'center',gap:6,
            }}>
              <Icon name="mail" size={12}/> Приглашение в группу
            </div>
            <div style={{color:'#F9F0F0', fontSize:22, fontWeight:800, marginBottom:8,
              textShadow:'0 2px 8px rgba(0,0,0,.25)'}}>
              {groupInvite.conversation?.name || 'Группа'}
            </div>
            {groupInvite.invitedBy?.name && (
              <div style={{color:'rgba(249,240,240,.85)', fontSize:14, lineHeight:1.5,
                textShadow:'0 1px 4px rgba(0,0,0,.2)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
                <AvatarDisplay
                  avatar={groupInvite.invitedBy.avatar}
                  name={groupInvite.invitedBy.name}
                  size={26} fontSize={12}/>
                <span>{groupInvite.invitedBy.name} приглашает тебя в группу</span>
              </div>
            )}
          </div>

          <div style={{display:'flex', gap:12, width:'100%', maxWidth:340, marginTop:8}}>
            <button
              disabled={declining}
              onClick={async () => {
                setDeclining(true);
                try { await api.declineGroupInvite(convId); nav('/chats'); }
                catch (e) { heyToast('Ошибка: ' + (e.message || ''), 'error'); }
                setDeclining(false);
              }}
              style={{
                flex:1, padding:'13px', borderRadius:14, fontSize:14, fontWeight:600,
                background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.6)',
                color:'rgba(255,225,225,1)', cursor:'pointer', opacity: declining ? .6 : 1,
                fontFamily:'inherit',
              }}>
              {declining ? '…' : 'Отклонить'}
            </button>
            <button
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                try {
                  await api.acceptGroupInvite(convId);
                  setGroupInvite(null);
                  const msgs = await api.getMessages(convId);
                  setMessages(Array.isArray(msgs) ? msgs : []);
                  heyToast('✓ Вы вступили в группу', 'success');
                } catch (e) {
                  heyToast('Ошибка: ' + (e.message || ''), 'error');
                }
                setAccepting(false);
              }}
              style={{
                flex:2, padding:'13px', borderRadius:14, fontSize:14, fontWeight:700,
                background:'rgba(95, 64, 128,.85)', border:'1px solid rgba(180,140,220,.5)',
                color:'#F9F0F0', cursor:'pointer', opacity: accepting ? .6 : 1,
                fontFamily:'inherit',
                boxShadow:'0 2px 12px rgba(95, 64, 128,.4)',
              }}>
              {accepting ? '…' : '✓ Принять'}
            </button>
          </div>
        </div>
      )}

      {/* ── Request lock overlay ─────────────────────────────────────── */}
      {requestLock && (
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'28px 24px', gap:20,
        }}>
          {/* Avatar */}
          <div style={{
            width:80, height:80, borderRadius:'50%',
            background:'rgba(180,140,220,.35)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:34, color:'#F9F0F0', fontWeight:700, overflow:'hidden',
            boxShadow:'0 4px 20px rgba(95, 64, 128,.3)',
          }}>
            {requestLock.requester?.avatar
              ? <img src={requestLock.requester.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (requestLock.requester?.name?.[0] || '?')}
          </div>

          {/* Name + hint */}
          <div style={{textAlign:'center'}}>
            <div style={{color:'#F9F0F0', fontSize:20, fontWeight:700, marginBottom:6}}>
              {requestLock.requester?.name || 'Пользователь'}
            </div>
            <div style={{color:'rgba(249,240,240,.45)', fontSize:14, lineHeight:1.6}}>
              хочет начать с вами переписку.<br/>
              Добавьте в контакты, чтобы видеть сообщения.
            </div>
          </div>

          {/* Bio */}
          {requesterProfile?.bio && (
            <div style={{
              background:'rgba(249,240,240,.07)', border:'1px solid rgba(249,240,240,.1)',
              borderRadius:12, padding:'10px 14px',
              color:'rgba(249,240,240,.75)', fontSize:14, lineHeight:1.5,
              maxWidth:300, textAlign:'center',
            }}>
              {requesterProfile.bio}
            </div>
          )}

          {/* Profile link */}
          {requestLock.requester?.id && (
            <button onClick={() => nav(`/profile/${requestLock.requester.id}`)}
              style={{
                background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.15)',
                borderRadius:50, padding:'7px 18px', color:'rgba(249,240,240,.7)',
                fontSize:13, cursor:'pointer',
              }}>
              Посмотреть профиль →
            </button>
          )}

          {/* Actions */}
          <div style={{display:'flex', gap:12, width:'100%', maxWidth:320}}>
            <button
              disabled={declining}
              onClick={async () => {
                setDeclining(true);
                try { await api.declineRequest(convId); nav('/chats'); } catch {}
                setDeclining(false);
              }}
              style={{
                flex:1, padding:'13px', borderRadius:14, fontSize:14, fontWeight:600,
                background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.6)',
                color:'rgba(255,225,225,1)', cursor:'pointer', opacity: declining ? .6 : 1,
              }}>
              {declining ? '…' : 'Удалить'}
            </button>
            <button
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                try {
                  await api.acceptRequest(convId);
                  setRequestLock(null);
                  const msgs = await api.getMessages(convId);
                  setMessages(Array.isArray(msgs) ? msgs : []);
                } catch {}
                setAccepting(false);
              }}
              style={{
                flex:2, padding:'13px', borderRadius:14, fontSize:14, fontWeight:700,
                background:'rgba(95, 64, 128,.8)', border:'1px solid rgba(180,140,220,.4)',
                color:'#F9F0F0', cursor:'pointer', opacity: accepting ? .6 : 1,
                boxShadow:'0 2px 12px rgba(95, 64, 128,.35)',
              }}>
              {accepting ? '…' : '✓ Добавить в контакты'}
            </button>
          </div>
        </div>
      )}

      {/* Deleted user banner */}
      {partner.isDeleted && (
        <div style={{
          flexShrink:0, padding:'12px 20px',
          background:'rgba(249,240,240,.05)',
          borderTop:'1px solid rgba(249,240,240,.08)',
          textAlign:'center',
          color:'rgba(249,240,240,.45)', fontSize:13,
        }}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <Icon name="ban" size={14} /> Этот пользователь удалил аккаунт
          </span>
        </div>
      )}

      {/* Blocked-by-admin user banner */}
      {partner.isBlocked && !partner.isDeleted && (
        <div style={{
          flexShrink:0, padding:'12px 20px',
          background:'rgba(200,80,80,.12)',
          borderTop:'1px solid rgba(255,120,120,.2)',
          textAlign:'center',
          color:'rgba(255,180,180,.85)', fontSize:13, lineHeight:1.5,
        }}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <Icon name="ban" size={14} /> Пользователь заблокирован администрацией
          </span><br/>
          <span style={{color:'rgba(255,180,180,.5)',fontSize:12}}>
            Отправка сообщений недоступна
          </span>
        </div>
      )}

      {/* Input bar */}
      {!requestLock && !groupInvite && !partner.isDeleted && !partner.isBlocked && <div style={{flexShrink:0}}>

        {/* ── Voice: recording bar ── */}
        {voiceState === 'recording' && (
          <div style={{padding:'8px 14px 10px',maxWidth:680,margin:'0 auto'}}>
            <div style={{
              display:'flex',alignItems:'center',gap:10,
              borderRadius:26,padding:'8px 10px 8px 14px',
              backgroundImage:'url(/input-bg.jpg)',backgroundSize:'cover',backgroundPosition:'center',
              border:'1px solid rgba(249,240,240,0.5)',
              boxShadow:'inset 0 1px 0 rgba(249,240,240,0.7), 0 4px 18px rgba(0,0,0,0.15)',
            }}>
              {/* Red dot */}
              <span style={{width:9,height:9,borderRadius:'50%',background:'#e74c3c',flexShrink:0,
                animation:'pulse 1s ease-in-out infinite',boxShadow:'0 0 6px #e74c3c'}}/>
              {/* Timer */}
              <span style={{color:'rgba(249,240,240,.9)',fontSize:14,fontWeight:600,
                fontVariantNumeric:'tabular-nums',flexShrink:0}}>
                {fmtRecTime(recTime)}
              </span>
              {/* Waveform canvas */}
              <canvas ref={waveCanvasRef} width={160} height={36}
                style={{flex:1,minWidth:0,height:36,display:'block'}}/>
              {/* Remaining time for free users */}
              {!user?.is_super && (
                <span style={{color:'rgba(255,200,100,.65)',fontSize:11,flexShrink:0}}>
                  {MAX_VOICE_SEC - recTime}с
                </span>
              )}
              {/* Cancel */}
              <button onClick={cancelVoice} title="Отменить"
                style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                  background:'rgba(200,60,60,.45)',border:'1px solid rgba(255,140,140,.55)',
                  color:'rgba(255,180,180,.85)',fontSize:14,cursor:'pointer',lineHeight:1,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              {/* Stop → preview */}
              <button onClick={stopRecording} title="Остановить"
                style={{width:36,height:36,borderRadius:18,flexShrink:0,
                  background:'rgba(95, 64, 128,.85)',border:'none',
                  color:'#F9F0F0',fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>■</button>
            </div>
          </div>
        )}

        {/* ── Voice: preview bar ── */}
        {voiceState === 'preview' && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',
            maxWidth:680,margin:'0 auto'}}>
            <button onClick={cancelVoice} title="Удалить"
              style={{width:36,height:36,borderRadius:'50%',flexShrink:0,
                background:'rgba(255,80,80,.15)',border:'1px solid rgba(255,120,120,.35)',
                color:'rgba(255,180,180,.9)',cursor:'pointer',lineHeight:1,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={16}/></button>
            <div style={{flex:1,background:'rgba(249,240,240,.07)',borderRadius:26,
              padding:'8px 14px',border:'1px solid rgba(249,240,240,.12)'}}>
              <AudioPlayer url={voiceObjUrl} duration={voiceDuration} isOut={true}/>
            </div>
            <button onClick={sendVoice} title="Отправить"
              style={{width:44,height:44,background:'rgba(95, 64, 128,.85)',border:'none',
                borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',
                justifyContent:'center',flexShrink:0,fontSize:20,color:'#F9F0F0'}}>
              ➤
            </button>
          </div>
        )}

        {/* ── Системный пользователь: показываем плашку вместо инпута ── */}
        {partner.isSystem && (
          <div style={{padding:'14px 20px 20px',maxWidth:680,margin:'0 auto'}}>
            <div style={{
              background:'rgba(95, 64, 128,.1)',
              border:'1px solid rgba(180,140,220,.2)',
              borderRadius:14, padding:'12px 16px',
              display:'flex', alignItems:'center', gap:10,
              color:'rgba(249,240,240,.5)', fontSize:13,
            }}>
              <span style={{fontSize:18}}>💬</span>
              <span>Это сервисный аккаунт. Ответить здесь нельзя.</span>
            </div>
          </div>
        )}

        {/* ── Normal text input bar (hidden while recording/preview/system) ── */}
        {!voiceState && !partner.isSystem && (() => {
          const hasContent = text.trim() || imgPreviews.length > 0 || filePreview;
          return (
        <div style={{padding:'6px 12px 14px',maxWidth:680,margin:'0 auto',
          minWidth:0,boxSizing:'border-box',width:'100%'}}>
          {/* Индикатор запланированных сообщений: показываем количество,
              по клику открываем список с возможностью отменить каждое. */}
          {scheduled.length > 0 && (
            <ScheduledList
              items={scheduled}
              onCancel={async (id) => {
                try {
                  await api.cancelScheduledMessage(id);
                  setScheduled(prev => prev.filter(s => s.id !== id));
                  heyToast('Запланированное сообщение отменено', 'info');
                } catch (e) { heyToast('Не удалось отменить', 'error'); }
              }}
            />
          )}
          {/* Внешний layout: [pill с textarea] [emoji] [attach] [mic | send].
              Раньше всё было внутри пилюли с тиснёным фоном — по макету
              кнопки выносим в отдельный ряд, фон пилюли чистый-полупрозрачный. */}
          <div style={{
            display:'flex',
            alignItems: composerExpanded ? 'stretch' : 'flex-end',
            gap: 8,
            minWidth:0,
          }}>
            {/* Pill: только textarea + chevron */}
            <div style={{
              flex:1, minWidth:0,
              display:'flex',
              alignItems: composerExpanded ? 'stretch' : 'center',
              padding: composerExpanded ? '10px 12px 10px 18px' : '4px 10px 4px 18px',
              gap: 6,
              borderRadius: composerExpanded ? 18 : 24,
              background: 'rgba(249,240,240,.10)',
              border: '1px solid rgba(249,240,240,.18)',
              backdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 1px 0 rgba(249,240,240,.08)',
            }}>
              <EmojiInput ref={textareaRef} value={text} onChange={handleInput} onKeyDown={handleKey}
                placeholder="Написать сообщение..."
                style={{flex:1,minWidth:0,background:'none',border:'none',outline:'none',color:'#F9F0F0',
                  fontFamily:'inherit',fontSize:15,lineHeight:'1.4',
                  paddingTop: composerExpanded ? 0 : 8,
                  paddingBottom: composerExpanded ? 0 : 8,
                  ...(composerExpanded
                    ? { height:'min(60vh, 480px)', overflow:'auto' }
                    : { maxHeight: NORMAL_MAX, overflow:'auto' }),
                }}/>
              {(composerOverflow || composerExpanded) && (
                <button onClick={() => setComposerExpanded(v => !v)}
                  title={composerExpanded ? 'Свернуть поле' : 'Раскрыть поле'}
                  style={{
                    background: 'rgba(0,0,0,.18)', border: 'none',
                    borderRadius: 10, padding: '4px 8px',
                    cursor:'pointer', flexShrink:0, alignSelf: composerExpanded ? 'flex-start' : 'center',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#F9F0F0', lineHeight: 1,
                  }}>
                  <span style={{fontSize:14, fontWeight:700, opacity:.75,
                    transform: composerExpanded ? 'none' : 'rotate(180deg)',
                    display:'inline-block'}}>⌃</span>
                </button>
              )}
            </div>

            {/* Внешний ряд кнопок — при 3+ строках вертикально */}
            <div style={{
              display:'flex',
              flexDirection: composerStacked ? 'column' : 'row',
              alignItems:'center',
              gap: composerStacked ? 6 : 10,
              flexShrink:0,
              paddingBottom: composerStacked ? 2 : 4,
            }}>
              <button data-emoji-toggle onClick={() => setShowEmoji(s=>!s)} title="Смайлики"
                style={{background:'none',border:'none',cursor:'pointer',padding:2,
                  opacity: showEmoji ? 1 : 0.78, transition:'opacity .15s'}}>
                <Icon name="smile" size={26} color="rgba(249,240,240,.9)" />
              </button>
              <button onClick={() => fileInputRef.current?.click()} title="Прикрепить файл или картинку"
                style={{background:'none',border:'none',cursor:'pointer',padding:2,
                  opacity:.85, transition:'opacity .15s'}}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                onMouseLeave={e=>e.currentTarget.style.opacity='.85'}>
                <Icon name="attach" size={26} color="rgba(249,240,240,.9)" />
              </button>
              <input ref={fileInputRef} type="file" multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                style={{display:'none'}} onChange={handleFileSelect}/>
              {hasContent ? (
                <button onClick={send}
                  title="Отправить (правый клик / долгое нажатие — отправить позже)"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    setSendMenu({ x: r.right - 220, y: r.top - 60 });
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse') return; // правый клик уже обрабатываем
                    const r = e.currentTarget.getBoundingClientRect();
                    longPressTimer.current = setTimeout(() => {
                      setSendMenu({ x: r.right - 220, y: r.top - 60 });
                    }, 550);
                  }}
                  onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  style={{background:'none',border:'none',cursor:'pointer',padding:2,
                    color:'#F9F0F0', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="send" size={24}/>
                </button>
              ) : (
                <button onClick={startRecording} title="Голосовое сообщение"
                  style={{background:'none',border:'none',cursor:'pointer',padding:2,
                    color:'#F9F0F0', opacity:.9, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="mic" size={24}/>
                </button>
              )}
            </div>
          </div>
        </div>
          );
        })()}

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>}{/* end input bar outer (hidden when requestLock) */}

      {/* SuperLimitPopup — free user hit 60s */}
      {showVoiceLimit && (
        <SuperLimitPopup
          onClose={() => setShowVoiceLimit(false)}
          onInvite={() => { setShowVoiceLimit(false); nav('/me'); }}
        />
      )}

      {/* Reaction emoji picker — горизонтальная пилюля по умолчанию, ⌄
          разворачивает в сетку чтобы видеть все эмодзи разом. */}
      {reactionPicker && (() => {
        const expanded = !!reactionPicker.expanded;
        // Высота в expanded ≈ 4 ряда по 40px + padding'и; в pill — 52px.
        const PICKER_H = expanded ? 220 : 52;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const PICKER_W = Math.min(vw - 16, 420);
        // x: центрируем picker по точке клика, но клампим по краям viewport.
        const x = Math.min(Math.max(reactionPicker.x - PICKER_W / 2, 8), vw - PICKER_W - 8);
        // y: ставим picker НАД smile-кнопкой если влезает (rect.top - PICKER_H - 8),
        // иначе ПОД (rect.top + 32). reactionPicker.y = rect.top.
        const above = reactionPicker.y - PICKER_H - 8;
        const below = reactionPicker.y + 36;
        const y = above >= 8
          ? above
          : Math.min(below, vh - PICKER_H - 8);
        const pickerMsg = messages.find(m => m.id === reactionPicker.msgId);
        const myReaction = pickerMsg?.reactions
          ? Object.entries(pickerMsg.reactions).find(([, list]) =>
              (list || []).some(r => (typeof r === 'string' ? r : r.id) === user?.id))?.[0]
          : null;

        const Item = (name) => {
          const isActive = myReaction === name;
          return (
            <button key={name} onClick={() => toggleReaction(reactionPicker.msgId, name)}
              title={emojiLabel(name)}
              style={{
                background: isActive ? 'rgba(95, 64, 128,.55)' : 'none',
                border: isActive ? '1px solid rgba(180,140,230,.7)' : '1px solid transparent',
                cursor:'pointer', padding:5, borderRadius:'50%', transition:'background .1s',
                display:'flex', alignItems:'center', justifyContent:'center',
                width: 40, height: 40, flexShrink: 0,
              }}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='rgba(249,240,240,.18)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = isActive ? 'rgba(95, 64, 128,.55)' : 'none'; }}>
              <img src={emojiUrl(name)} alt={name}
                style={{width:28, height:28, pointerEvents:'none',
                  filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
            </button>
          );
        };

        return (
          <div data-reaction-picker
            style={{position:'fixed', left:x, top:y, zIndex:300,
              width: PICKER_W,
              background:'rgba(48,38,78,.97)', backdropFilter:'blur(16px)',
              borderRadius: expanded ? 18 : 50, padding:'6px 6px',
              boxShadow:'0 8px 32px rgba(0,0,0,.5)',
              border:'1px solid rgba(249,240,240,.08)',
              display:'flex', alignItems: expanded ? 'flex-start' : 'center', gap: 2}}>
            {expanded ? (
              <div style={{
                flex:1, minWidth:0,
                display:'grid',
                gridTemplateColumns:'repeat(7, 1fr)',
                gap: 2,
                padding: '2px',
              }}>
                {HEY_EMOJI.map(Item)}
              </div>
            ) : (
              <div style={{
                flex:1, minWidth:0, display:'flex', gap: 2,
                overflowX: 'auto', overflowY: 'hidden',
                scrollbarWidth:'none', msOverflowStyle:'none',
              }}>
                {HEY_EMOJI.map(Item)}
              </div>
            )}
            <button
              onClick={() => setReactionPicker(p => p ? { ...p, expanded: !p.expanded } : null)}
              title={expanded ? 'Свернуть' : 'Все эмодзи'}
              style={{
                flexShrink:0, width: 36, height: 36, borderRadius:'50%',
                background: 'rgba(0,0,0,.25)', border: 'none', cursor:'pointer',
                color: 'rgba(249,240,240,.85)', display:'flex',
                alignItems:'center', justifyContent:'center',
                fontSize: 14, fontWeight: 700,
                alignSelf: expanded ? 'flex-start' : 'center',
              }}>
              <span style={{
                transform: expanded ? 'none' : 'rotate(180deg)',
                display:'inline-block', lineHeight:1
              }}>⌃</span>
            </button>
          </div>
        );
      })()}

      {msgMenu && (() => {
        const isOwn   = msgMenu.msg.sender_id === user?.id;
        const canEdit = isOwn && (Date.now()/1000 - msgMenu.msg.created_at) < 3*60*60 && !!msgMenu.msg.text;
        const canPin  = partner.isGroup ? !!partner.myIsGroupAdmin : true;
        const isPinned = pinnedMessage && pinnedMessage.id === msgMenu.msg.id;
        const canCopy = !!msgMenu.msg.text;
        const copyText = () => {
          try { navigator.clipboard.writeText(msgMenu.msg.text || ''); heyToast('Скопировано', 'success'); }
          catch { heyToast('Не удалось скопировать', 'error'); }
        };
        const iconEl = (name) => <Icon name={name} size={15}/>;
        const items = [
          { label:'Ответить', icon: iconEl('reply'), onClick: () => { setReplyTo(msgMenu.msg); textareaRef.current?.focus(); } },
          canCopy && { label:'Копировать', iconName:'copy', onClick: copyText },
          { label:'Переслать', icon: iconEl('forward'), onClick: () => openForwardModal(msgMenu.msg) },
          canPin && !isPinned && { label:'Закрепить', icon: iconEl('pin'), onClick: () => pinMsg(msgMenu.msg) },
          canPin &&  isPinned && { label:'Открепить', icon: iconEl('unpin'), onClick: () => unpinMsg() },
          canEdit && { label:'Редактировать', icon: iconEl('pencil'), onClick: () => startEdit(msgMenu.msg) },
          isOwn && { label:'Удалить', iconName:'delete', danger:true, separatorBefore:true, onClick: () => deleteMsg(msgMenu.msg) },
        ].filter(Boolean);
        return (
          <AnchoredContextMenu
            open
            onClose={() => setMsgMenu(null)}
            position={{ left: msgMenu.x, top: msgMenu.y }}
            items={items}
          />
        );
      })()}

      {/* Media viewer */}
      {showMedia && (
        <MediaViewerModal convId={convId} onClose={()=>setShowMedia(false)}/>
      )}

      {/* Forward modal */}
      {forwardModal && (
        <ForwardModal
          messageId={forwardModal.messageId}
          onClose={() => setForwardModal(null)}
          onDone={(count) => heyToast(`Переслано в ${count} ${count === 1 ? 'чат' : 'чатов'}`, 'success')}
        />
      )}

      {/* Moment popup — открывается из чата при тапе по прицепленному моменту */}
      {momentChatPopup && (
        <MomentDetailPopup
          moments={momentChatPopup.moments}
          initialIndex={momentChatPopup.idx}
          currentUser={user}
          onClose={() => setMomentChatPopup(null)}
        />
      )}

      {sendMenu && (
        <AnchoredContextMenu
          open
          onClose={() => setSendMenu(null)}
          position={{ left: sendMenu.x, top: sendMenu.y }}
          items={[{
            label: 'Отправить позже…',
            icon: <span style={{ display:'inline-flex', lineHeight: 1 }}><Icon name="calendar" size={15} /></span>,
            onClick: () => setScheduleOpen(true),
          }]}
        />
      )}

      {/* Schedule date-time modal */}
      {scheduleOpen && (() => {
        // Дефолт — через час от текущего времени, округлённый до 5 минут.
        const def = new Date(Date.now() + 60 * 60 * 1000);
        def.setSeconds(0, 0);
        const pad = (n) => String(n).padStart(2, '0');
        const defStr = `${def.getFullYear()}-${pad(def.getMonth()+1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`;
        return (
          <ScheduleModal
            defaultValue={defStr}
            onCancel={() => setScheduleOpen(false)}
            onSubmit={async (localStr) => {
              const at = new Date(localStr);
              const sendAt = Math.floor(at.getTime() / 1000);
              if (!Number.isFinite(sendAt) || sendAt < Math.floor(Date.now() / 1000) + 30) {
                heyToast('Выбери время хотя бы через минуту', 'warning'); return;
              }
              try {
                const t = text.trim();
                // Заранее загружаем вложения (картинки/файл) в S3 —
                // запланированному сообщению нужна постоянная ссылка,
                // blob:/File живут только в текущей сессии. После
                // успешной заливки чистим из composer'а; на ошибке
                // оставляем как есть.
                let attachment = null;
                let capturedImgs = null;
                if (imgPreviews.length > 0 || filePreview) {
                  if (imgPreviews.some(p => p.uploading)) {
                    heyToast('Дождись загрузки', 'warning'); return;
                  }
                  setImgPreviews(prev => prev.map(p => ({ ...p, uploading: true })));
                  setFilePreview(p => p ? { ...p, uploading: true } : p);
                  let up;
                  try { up = await uploadComposerAttachment(); }
                  catch (err) {
                    heyToast(err.message || 'Не удалось загрузить вложение', 'error');
                    setImgPreviews(prev => prev.map(p => ({ ...p, uploading: false })));
                    setFilePreview(p => p ? { ...p, uploading: false } : p);
                    return;
                  }
                  attachment   = up.attachment;
                  capturedImgs = up.captured;
                }
                if (!t && !attachment) { heyToast('Пустое сообщение', 'warning'); return; }
                const sched = await api.scheduleMessage(convId, {
                  text: t || null,
                  attachment,
                  reply_to_id: replyTo?.id || null,
                  send_at: sendAt,
                });
                setScheduled(prev => [...prev, sched].sort((a, b) => a.send_at - b.send_at));
                setText('');
                setReplyTo(null);
                setImgPreviews([]);
                setFilePreview(null);
                if (capturedImgs) {
                  capturedImgs.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
                }
                setScheduleOpen(false);
                heyToast(`📅 Запланировано на ${at.toLocaleString('ru')}`, 'success');
              } catch (e) {
                heyToast('Ошибка: ' + (e.message || ''), 'error');
              }
            }}
          />
        );
      })()}

      {/* Lightbox */}
      {lightbox && (() => {
        const urls    = lightbox.urls || [];
        const idx     = lightbox.index || 0;
        const total   = urls.length;
        const current = urls[idx];
        const canPrev = idx > 0;
        const canNext = idx < total - 1;
        // Touch-swipe для перелистывания галереи на мобильном.
        // Порог 50px по горизонтали + игнор если вертикальное движение
        // больше — пользователь скроллит, а не свайпает.
        let touchStart = null;
        const onTouchStart = (e) => {
          if (e.touches.length !== 1 || total <= 1) return;
          const t = e.touches[0];
          touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
        };
        const onTouchEnd = (e) => {
          if (!touchStart) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - touchStart.x;
          const dy = t.clientY - touchStart.y;
          const dt = Date.now() - touchStart.t;
          touchStart = null;
          if (dt > 600) return;                // слишком медленно — не свайп
          if (Math.abs(dy) > Math.abs(dx)) return; // вертикальное — игнор
          if (Math.abs(dx) < 50) return;       // короткий тап
          if (dx < 0 && canNext) setLightbox({ urls, index: idx + 1 });
          else if (dx > 0 && canPrev) setLightbox({ urls, index: idx - 1 });
        };
        return (
          <div onClick={() => setLightbox(null)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.92)',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              backdropFilter:'blur(8px)', touchAction: 'pan-y'}}>
            {/* Стрелки навигации (если в галерее больше одной) */}
            {canPrev && (
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ urls, index: idx - 1 }); }}
                style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',zIndex:2,
                  width:48,height:48,borderRadius:'50%',
                  background:'rgba(249,240,240,.12)',backdropFilter:'blur(8px)',
                  border:'1px solid rgba(249,240,240,.18)',color:'#F9F0F0',
                  fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ‹
              </button>
            )}
            {canNext && (
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ urls, index: idx + 1 }); }}
                style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)',zIndex:2,
                  width:48,height:48,borderRadius:'50%',
                  background:'rgba(249,240,240,.12)',backdropFilter:'blur(8px)',
                  border:'1px solid rgba(249,240,240,.18)',color:'#F9F0F0',
                  fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ›
              </button>
            )}

            <img src={current} alt=""
              onClick={e => e.stopPropagation()}
              style={{maxWidth:'90vw',maxHeight:'80vh',borderRadius:14,
                boxShadow:'0 8px 48px rgba(0,0,0,.6)',objectFit:'contain'}}/>

            <div style={{display:'flex',gap:12,marginTop:20,alignItems:'center'}}
              onClick={e=>e.stopPropagation()}>
              {total > 1 && (
                <div style={{
                  background:'rgba(249,240,240,.12)',borderRadius:50,padding:'8px 14px',
                  color:'rgba(249,240,240,.85)',fontSize:13,fontWeight:600,
                }}>
                  {idx + 1} / {total}
                </div>
              )}
              <a href={current} download
                style={{background:'rgba(249,240,240,.15)',backdropFilter:'blur(6px)',
                  borderRadius:12,padding:'10px 24px',color:'#F9F0F0',fontSize:14,
                  textDecoration:'none',border:'1px solid rgba(249,240,240,.2)'}}>
                ⬇ Скачать
              </a>
              <button onClick={() => setLightbox(null)}
                style={{background:'rgba(249,240,240,.1)',border:'1px solid rgba(249,240,240,.2)',
                  borderRadius:12,padding:'10px 24px',color:'#F9F0F0',fontSize:14,cursor:'pointer'}}>
                Закрыть
              </button>
            </div>

          </div>
        );
      })()}

<style>{`@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
      {confirmModal}
    </div>
  );
}
