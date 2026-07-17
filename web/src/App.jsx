// web/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { socket, api } from './api';
import {
  SplashScreen, HeyScreen, LoginScreen, RegisterScreen, SuccessScreen,
  WelcomeScreen, PasswordResetScreen,
  TermsScreen, PrivacyScreen,
  MyProfileScreen, ContactsScreen, ConversationsScreen,
  ChatScreen, CallsScreen, CallDetailScreen, SettingsScreen,
  GroupCreateScreen, GroupSettingsScreen,
  ForcePasswordModal, PublicProfileScreen, MomentPage,
  ToastContainer, GlobalUserCardMount,
} from './components/Screens';
import MomentsFeed from './components/moments/MomentsFeed';
import BottomNav from './components/BottomNav';
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./components/admin/AdminUsers'));
const AdminGroups = lazy(() => import('./components/admin/AdminGroups'));
const AdminGroupDetail = lazy(() => import('./components/admin/AdminGroupDetail'));
const AdminUserDetail = lazy(() => import('./components/admin/AdminUserDetail'));
const AdminMoments = lazy(() => import('./components/admin/AdminMoments'));
const AdminLogs = lazy(() => import('./components/admin/AdminLogs'));
const AdminSystem = lazy(() => import('./components/admin/AdminSystem'));
const AdminS3 = lazy(() => import('./components/admin/AdminS3'));
const AdminWaitlist = lazy(() => import('./components/admin/AdminWaitlist'));
const AdminReports = lazy(() => import('./components/admin/AdminReports'));
const AdminFeedbacks = lazy(() => import('./components/admin/AdminFeedbacks'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));
const AdminAwo = lazy(() => import('./components/admin/AdminAwo'));
const AdminAwoTenants = lazy(() => import('./components/admin/AdminAwoTenants'));
const AdminBusinessRequests = lazy(() => import('./components/admin/AdminBusinessRequests'));
const IntegrationsLayout = lazy(() => import('./components/IntegrationsLayout'));
const BusinessLanding = lazy(() => import('./components/BusinessLanding'));
const AdminTestUsers = lazy(() => import('./components/admin/AdminTestUsers'));
const AdminGuide = lazy(() => import('./components/admin/AdminGuide'));
import JoinScreen from './components/JoinScreen';
import PersonalInviteJoin from './components/contacts/PersonalInviteJoin';
import GroupJoinScreen from './components/GroupJoinScreen';
import UserGuide from './components/UserGuide';
import ServerStatusBanner from './components/ServerStatusBanner';
import { ensurePushIfGranted } from './lib/push';
import { installAndroidExternalLinkHandler } from './lib/openExternalUrl';
import { isConversationMuted, setConversationMuted, syncMutedConversations } from './lib/mutedConversations';
import {
  isConversationArchived,
  setConversationArchived,
  syncArchivedConversations,
  onArchivedConversationsChange,
} from './lib/archivedConversations';
import { PublicSettingsProvider } from './lib/publicSettings';
import { BootScreen } from './components/shared/BootMark';
import {
  isSystemChatEvent,
  messageConversationId,
  messagePreviewText,
} from './lib/messagePreview';

function useNotifications() {
  const nav = useNavigate();
  const location = useLocation();
  const { user: me } = useAuth();

  // Список заглушённых чатов — сразу при логине. Раньше sync жил только в
  // useUnreadCount внутри WithBottomNav, а /chat/:id рендерится без него —
  // после F5 mute в памяти терялся и inline-notification снова показывался.
  useEffect(() => {
    if (!me?.id) return;
    Promise.all([
      api.getConversations(),
      api.getArchivedConversations(),
    ])
      .then(([active, archived]) => {
        syncMutedConversations(active);
        syncArchivedConversations(archived);
      })
      .catch(() => {});
  }, [me?.id]);

  useEffect(() => {
    return socket.on('conversation:archived', ({ conversationId }) => {
      if (conversationId) setConversationArchived(conversationId, true);
    });
  }, []);

  useEffect(() => {
    return socket.on('conversation:unarchived', ({ conversationId }) => {
      if (conversationId) setConversationArchived(conversationId, false);
    });
  }, []);

  useEffect(() => {
    return socket.on('conversation:notifications_muted', ({ conversationId, muted }) => {
      if (conversationId) setConversationMuted(conversationId, !!muted);
    });
  }, []);

  // 1) Inline-Notification — только когда вкладка видна, но не в фокусе
  //    (другое окно поверх). Если вкладка скрыта/свёрнута — уведомление
  //    приходит через Web Push + Service Worker; второй new Notification()
  //    из WS давал дубль («Имя в группе» + «Имя»).
  useEffect(() => {
    return socket.on('message:new', ({ message }) => {
      if (Notification?.permission !== 'granted') return;
      // Сервер шлёт message:new ВСЕМ участникам чата (включая отправителя
      // — для синхронизации delivered/read). Не показываем нотификацию
      // на собственные сообщения.
      if (me?.id && message?.sender_id === me.id) return;
      // Системные события группы (выход/удаление) — не пушим как «сообщение».
      if (isSystemChatEvent(message)) return;
      const convId = messageConversationId(message);
      if (!convId) return;
      if (isConversationMuted(convId)) return;
      if (isConversationArchived(convId)) return;
      // Уже в этом чате — не дублируем системное уведомление.
      if (location.pathname === `/chat/${convId}`) return;
      const isVisible = document.visibilityState === 'visible';
      const isFocused = (typeof document.hasFocus === 'function')
        ? document.hasFocus() : true;
      if (!isVisible || isFocused) return;
      const n = new Notification(message.sender_name || 'HEY', {
        body: messagePreviewText(message) || 'Новое сообщение',
        tag: convId,
      });
      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        nav('/chat/' + convId + '?msg=' + message.id);
        n.close();
      };
    });
  }, [nav, me?.id, location.pathname]);

  // 2) Регистрируем SW ASAP — это критерий «installable» для Android Chrome
  //    (без зарегистрированного SW не появится prompt установки PWA). Раньше
  //    регистрация была лениво в push.js — только когда юзер подписывается
  //    на уведомления.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // updateViaCache:'none' — браузер тянет /sw.js без HTTP-кеша и в
    // отдельной вкладке тоже обновляется. Без этого Opera/Samsung держат
    // старую версию SW до 24ч → юзер не получает свежих fix'ов до push.
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => reg.update().catch(() => {}))
      .catch(e => console.warn('[sw] register failed:', e.message));
  }, []);

  // 3) Web-Push через Service Worker (вкладка закрыта / телефон в локе).
  //    SW шлёт postMessage `hey:navigate` с url. Принимаем и SPA-переходим
  //    — без перезагрузки.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onSwMsg = (e) => {
      const data = e.data;
      if (!data || data.type !== 'hey:navigate' || !data.url) return;
      // url с сервера приходит в виде /chat/:id — отдаём в SPA-роутер.
      try {
        const u = new URL(data.url, window.location.origin);
        nav(u.pathname + u.search + u.hash);
      } catch {
        nav(data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMsg);
  }, [nav]);
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  return user ? children : <Navigate to="/login" replace/>;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/main" replace/> : children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace/>;
  if (!user.is_admin) return <Navigate to="/main" replace/>;
  return children;
}

function LazyRoute({ children }) {
  return <Suspense fallback={<BootScreen />}>{children}</Suspense>;
}

function RequireSuperAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace/>;
  if (!user.is_admin) return <Navigate to="/main" replace/>;
  if (!user.is_super_admin) return <Navigate to="/admin" replace/>;
  return children;
}

// Бизнес-юзер ИЛИ админ. Используется для /integrations/*
function RequireBusinessOrAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace/>;
  // Доступ к /integrations/awo: системный админ, бизнес-юзер с
  // approved-статусом ИЛИ со-админ хоть какой-то школы (см. /me →
  // tenants_accessible). Иначе кидаем обратно в профиль.
  const hasTenantAccess = (user.tenants_accessible || 0) > 0;
  if (!user.is_admin && user.business_status !== 'approved' && !hasTenantAccess) {
    return <Navigate to="/me" replace/>;
  }
  return children;
}

// Global unread counter — counts across all conversations
function useUnreadCount() {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      Promise.all([
        api.getConversations(),
        api.getArchivedConversations(),
      ])
        .then(([active, archived]) => {
          syncMutedConversations(active);
          syncArchivedConversations(archived);
          setUnread(active.reduce((s, c) => s + (c.unread_count || 0), 0));
        })
        .catch(() => {});
    };
    refresh();
    return onArchivedConversationsChange(refresh);
  }, [user]);

  useEffect(() => {
    return socket.on('message:new', ({ message }) => {
      if (message.sender_id === user?.id) return;
      if (location.pathname === '/chats') return;
      const convId = messageConversationId(message);
      if (convId && isConversationArchived(convId)) return;
      setUnread(n => n + 1);
    });
  }, [user?.id, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/chats') setUnread(0);
  }, [location.pathname]);

  return unread;
}

function tabFromPath(pathname) {
  if (pathname === '/chats') return 'chats';
  if (pathname === '/contacts') return 'contacts';
  if (pathname === '/me') return 'me';
  return 'main';
}

/** Общий layout нижних вкладок: один BottomNav, keep-alive экранов. */
function MainTabsLayout() {
  const { user } = useAuth();
  const unread = useUnreadCount();
  const tab = tabFromPath(useLocation().pathname);
  const [visited, setVisited] = useState(() => new Set([tab]));

  useEffect(() => {
    setVisited(prev => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  const pane = (name, child) => visited.has(name) ? (
    <div key={name} style={{ display: tab === name ? 'block' : 'none' }} aria-hidden={tab !== name}>
      {child}
    </div>
  ) : null;

  return (
    <>
      {pane('main', <MomentsScreen />)}
      {pane('chats', <ConversationsScreen />)}
      {pane('contacts', <ContactsScreen />)}
      {pane('me', <MyProfileScreen />)}
      <Outlet />
      <BottomNav user={user} unread={unread} />
    </>
  );
}

function MomentsScreen() {
  const { user } = useAuth();
  return <MomentsFeed currentUser={user} />;
}

// ── Global security event handlers ───────────────────────────────────────────
function GlobalHandlers() {
  const { logout, user, setUser } = useAuth();
  const [showMustChangePwd, setShowMustChangePwd] = useState(false);
  const [blockedOverlay, setBlockedOverlay] = useState(false);
  const [sysToast, setSysToast] = useState('');

  // Check on load — if user already has must_change_password flag
  useEffect(() => {
    if (user?.must_change_password) setShowMustChangePwd(true);
  }, [user?.must_change_password]);

  // При логине — если permission на push уже granted, пере-подписываем (для
  // случая переустановки браузера / обновления SW).
  useEffect(() => {
    if (user?.id) ensurePushIfGranted();
  }, [user?.id]);

  // Android TWA: внешние ссылки — в системный браузер, не в Custom Tabs.
  useEffect(() => installAndroidExternalLinkHandler(), []);

  // Слушаем сообщение от service worker — клик по push-уведомлению должен
  // привести нас на нужный URL в SPA.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e) => {
      if (e.data?.type === 'hey:navigate' && e.data.url) {
        window.location.href = e.data.url;
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  // Listen for runtime events from api.js
  useEffect(() => {
    const onBlocked = () => {
      setBlockedOverlay(true);
      // Если был залогинен — выкидываем; на /login (когда токена нет) — оставляем
      // оверлей, пока пользователь сам не нажмёт «Понятно».
      if (localStorage.getItem('hey_token')) {
        setTimeout(() => { logout(); }, 2800);
      }
    };
    const onMustChange = () => setShowMustChangePwd(true);
    window.addEventListener('hey:blocked', onBlocked);
    window.addEventListener('hey:must-change-password', onMustChange);
    return () => {
      window.removeEventListener('hey:blocked', onBlocked);
      window.removeEventListener('hey:must-change-password', onMustChange);
    };
  }, [logout]);

  // System notifications: Super granted
  useEffect(() => {
    return socket.on('system:notification', ({ text, kind }) => {
      setSysToast(text);
      setTimeout(() => setSysToast(''), 5000);
      if (kind === 'super_granted') {
        api.getMe().then(u => setUser && setUser(u)).catch(() => {});
      }
    });
  }, [setUser]);

  return (
    <>
      {blockedOverlay && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(10,5,25,.97)', backdropFilter:'blur(24px)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:18, animation:'fadeIn .25s ease', padding:24,
        }}>
          <div style={{fontSize:56}}>🚫</div>
          <div style={{color:'#F9F0F0', fontSize:22, fontWeight:800, letterSpacing:-.3}}>
            Аккаунт заблокирован
          </div>
          <div style={{color:'rgba(249,240,240,.5)', fontSize:14, textAlign:'center', maxWidth:320, lineHeight:1.6}}>
            Доступ ограничен администрацией.<br/>
            По вопросам — напишите в поддержку.
          </div>
          <button
            onClick={() => setBlockedOverlay(false)}
            style={{
              marginTop:6, padding:'11px 28px', borderRadius:12, border:'none',
              background:'rgba(140,110,220,.6)', color:'#F9F0F0',
              fontSize:14, fontWeight:600, cursor:'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(160,130,240,.75)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(140,110,220,.6)'}>
            Понятно
          </button>
        </div>
      )}
      {showMustChangePwd && user && (
        <ForcePasswordModal onDone={() => setShowMustChangePwd(false)} />
      )}
      {sysToast && (
        <div style={{
          position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
          background:'linear-gradient(135deg,rgba(100,60,180,.97),rgba(60,20,120,.97))',
          backdropFilter:'blur(20px)', border:'1px solid rgba(200,160,255,.3)',
          borderRadius:50, padding:'12px 22px', color:'#F9F0F0',
          fontSize:14, fontWeight:600, zIndex:9998,
          whiteSpace:'nowrap', maxWidth:'90vw', textAlign:'center',
          boxShadow:'0 8px 32px rgba(80,40,160,.5)',
          animation:'fadeIn .3s ease',
        }}>
          {sysToast}
        </div>
      )}
    </>
  );
}

// useNotifications вызывает useNavigate, поэтому должен жить ВНУТРИ Router'а.
// Inline-компонент-обёртка под это.
function NotificationBridge() {
  useNotifications();
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PublicSettingsProvider>
      <BrowserRouter>
        <NotificationBridge />
        <GlobalHandlers />
        <ServerStatusBanner />
        <ToastContainer />
        <GlobalUserCardMount />
        <Routes>
          {/* Public */}
          <Route path="/"         element={<SplashScreen/>}/>
          <Route path="/hey"      element={<HeyScreen/>}/>
          <Route path="/login"    element={<GuestOnly><LoginScreen/></GuestOnly>}/>
          <Route path="/register" element={<GuestOnly><RegisterScreen/></GuestOnly>}/>
          <Route path="/password-reset" element={<PasswordResetScreen/>}/>
          <Route path="/terms"    element={<TermsScreen/>}/>
          <Route path="/privacy"  element={<PrivacyScreen/>}/>
          <Route path="/join/:code" element={<GuestOnly><PersonalInviteJoin/></GuestOnly>}/>
          <Route path="/join"     element={<GuestOnly><JoinScreen/></GuestOnly>}/>
          <Route path="/gjoin/:token" element={<GroupJoinScreen/>}/>
          <Route path="/success"  element={<SuccessScreen/>}/>
          <Route path="/welcome"  element={<WelcomeScreen/>}/>

          {/* Protected — bottom tabs (shared layout, keep-alive) */}
          <Route element={<Protected><MainTabsLayout /></Protected>}>
            <Route path="main" element={null} />
            <Route path="chats" element={null} />
            <Route path="contacts" element={null} />
            <Route path="me" element={null} />
          </Route>
          <Route path="/moments" element={<Navigate to="/main" replace/>}/>
          {/* Старый URL — редирект для совместимости */}
          <Route path="/conversations" element={<Navigate to="/chats" replace/>}/>
          {/* Старый URL — редирект для обратной совместимости */}
          <Route path="/profile/me" element={<Navigate to="/me" replace/>}/>

          {/* Protected — without bottom nav */}
          {/* Публичный шар-линк момента — доступен без логина */}
          <Route path="/moments/:id"             element={<MomentPage/>}/>
          <Route path="/profile/:id"             element={<Protected><PublicProfileScreen/></Protected>}/>
          <Route path="/chat/:convId"            element={<Protected><ChatScreen/></Protected>}/>
          <Route path="/groups/new"              element={<Protected><GroupCreateScreen/></Protected>}/>
          <Route path="/groups/:convId/settings" element={<Protected><GroupSettingsScreen/></Protected>}/>
          <Route path="/calls"                   element={<Protected><CallsScreen/></Protected>}/>
          <Route path="/calls/:callId"           element={<Protected><CallDetailScreen/></Protected>}/>
          <Route path="/settings"                element={<Protected><SettingsScreen/></Protected>}/>
          <Route path="/help"                    element={<Protected><UserGuide/></Protected>}/>

          {/* Admin panel */}
          <Route path="/admin" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminDashboard/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/users" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminUsers/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/users/:id" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminUserDetail/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/groups" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminGroups/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/groups/:id" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminGroupDetail/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/moments" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminMoments/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/logs" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminLogs/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/system" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminSystem/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/s3" element={
            <RequireSuperAdmin>
              <LazyRoute><AdminLayout><AdminS3/></AdminLayout></LazyRoute>
            </RequireSuperAdmin>
          }/>
          <Route path="/admin/waitlist" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminWaitlist/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/reports" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminReports/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/feedbacks" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminFeedbacks/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/settings" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminSettings/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/awo" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminAwoTenants/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/awo/tenants" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminAwoTenants/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/awo/:tenantId" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminAwo/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/business-requests" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminBusinessRequests/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          {/* Презентация бизнес-возможностей — доступна всем залогиненным */}
          <Route path="/business" element={
            <Protected><LazyRoute><BusinessLanding/></LazyRoute></Protected>
          }/>
          {/* Бизнес-пользователи (НЕ admin) — свой layout */}
          <Route path="/integrations/awo" element={
            <RequireBusinessOrAdmin>
              <LazyRoute>
                <IntegrationsLayout title="🎓 Мои школы (АВО)">
                  <AdminAwoTenants/>
                </IntegrationsLayout>
              </LazyRoute>
            </RequireBusinessOrAdmin>
          }/>
          <Route path="/integrations/awo/:tenantId" element={
            <RequireBusinessOrAdmin>
              <LazyRoute>
                <IntegrationsLayout title="🎓 Настройки школы">
                  <AdminAwo/>
                </IntegrationsLayout>
              </LazyRoute>
            </RequireBusinessOrAdmin>
          }/>
          <Route path="/admin/test-users" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminTestUsers/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>
          <Route path="/admin/guide" element={
            <RequireAdmin>
              <LazyRoute><AdminLayout><AdminGuide/></AdminLayout></LazyRoute>
            </RequireAdmin>
          }/>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
      </PublicSettingsProvider>
    </AuthProvider>
  );
}
