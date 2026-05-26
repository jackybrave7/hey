// web/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { socket, api } from './api';
import {
  SplashScreen, HeyScreen, LoginScreen, RegisterScreen, SuccessScreen,
  WelcomeScreen,
  MyProfileScreen, ContactsScreen, ConversationsScreen,
  ChatScreen, CallsScreen, CallDetailScreen, SettingsScreen,
  GroupCreateScreen, GroupSettingsScreen,
  ForcePasswordModal, PublicProfileScreen, MomentPage,
  ToastContainer,
} from './components/Screens';
import MomentsFeed from './components/moments/MomentsFeed';
import BottomNav from './components/BottomNav';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminUserDetail from './components/admin/AdminUserDetail';
import AdminMoments from './components/admin/AdminMoments';
import AdminLogs from './components/admin/AdminLogs';
import AdminSystem from './components/admin/AdminSystem';
import AdminReports from './components/admin/AdminReports';
import AdminAwo from './components/admin/AdminAwo';
import AdminTestUsers from './components/admin/AdminTestUsers';
import JoinScreen from './components/JoinScreen';
import UserGuide from './components/UserGuide';
import { ensurePushIfGranted } from './lib/push';

function useNotifications() {
  useEffect(() => {
    return socket.on('message:new', ({ message }) => {
      if (Notification?.permission !== 'granted' || document.hasFocus()) return;
      new Notification(message.sender_name || 'HEY', {
        body: message.text || '📎 Изображение',
        tag: message.conversationId,
      });
    });
  }, []);
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',
      alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'rgba(255,255,255,.5)',fontSize:16}}>Загрузка…</div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace/>;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/main" replace/> : children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--grad)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>Загрузка…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace/>;
  if (!user.is_admin) return <Navigate to="/main" replace/>;
  return children;
}

// Global unread counter — counts across all conversations
function useUnreadCount() {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.getConversations()
      .then(convs => setUnread(convs.reduce((s, c) => s + (c.unread_count || 0), 0)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    return socket.on('message:new', ({ message }) => {
      if (message.sender_id === user?.id) return;
      if (location.pathname === '/chats') return;
      setUnread(n => n + 1);
    });
  }, [user?.id, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/chats') setUnread(0);
  }, [location.pathname]);

  return unread;
}

function WithBottomNav({ children }) {
  const { user } = useAuth();
  const unread   = useUnreadCount();
  return (
    <>
      {children}
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

  // System notifications: Super granted, badge awarded
  useEffect(() => {
    return socket.on('system:notification', ({ text, kind }) => {
      setSysToast(text);
      setTimeout(() => setSysToast(''), 5000);
      // Refresh user data so SuperStatusCard updates immediately
      if (kind === 'super_granted' || kind === 'badge_granted') {
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
          <div style={{color:'white', fontSize:22, fontWeight:800, letterSpacing:-.3}}>
            Аккаунт заблокирован
          </div>
          <div style={{color:'rgba(255,255,255,.5)', fontSize:14, textAlign:'center', maxWidth:320, lineHeight:1.6}}>
            Доступ ограничен администрацией.<br/>
            По вопросам — напишите в поддержку.
          </div>
          <button
            onClick={() => setBlockedOverlay(false)}
            style={{
              marginTop:6, padding:'11px 28px', borderRadius:12, border:'none',
              background:'rgba(140,110,220,.6)', color:'white',
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
          borderRadius:50, padding:'12px 22px', color:'white',
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

export default function App() {
  useNotifications();
  return (
    <AuthProvider>
      <BrowserRouter>
        <GlobalHandlers />
        <ToastContainer />
        <Routes>
          {/* Public */}
          <Route path="/"         element={<SplashScreen/>}/>
          <Route path="/hey"      element={<HeyScreen/>}/>
          <Route path="/login"    element={<GuestOnly><LoginScreen/></GuestOnly>}/>
          <Route path="/register" element={<GuestOnly><RegisterScreen/></GuestOnly>}/>
          <Route path="/join"     element={<GuestOnly><JoinScreen/></GuestOnly>}/>
          <Route path="/success"  element={<SuccessScreen/>}/>
          <Route path="/welcome"  element={<WelcomeScreen/>}/>

          {/* Protected — with bottom nav */}
          <Route path="/main" element={
            <Protected>
              <WithBottomNav>
                <MomentsScreen/>
              </WithBottomNav>
            </Protected>
          }/>
          <Route path="/moments" element={<Navigate to="/main" replace/>}/>

          <Route path="/chats" element={
            <Protected>
              <WithBottomNav>
                <ConversationsScreen/>
              </WithBottomNav>
            </Protected>
          }/>
          {/* Старый URL — редирект для совместимости */}
          <Route path="/conversations" element={<Navigate to="/chats" replace/>}/>

          <Route path="/contacts" element={
            <Protected>
              <WithBottomNav>
                <ContactsScreen/>
              </WithBottomNav>
            </Protected>
          }/>

          <Route path="/me" element={
            <Protected>
              <WithBottomNav>
                <MyProfileScreen/>
              </WithBottomNav>
            </Protected>
          }/>
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
              <AdminLayout><AdminDashboard/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/users" element={
            <RequireAdmin>
              <AdminLayout><AdminUsers/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/users/:id" element={
            <RequireAdmin>
              <AdminLayout><AdminUserDetail/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/moments" element={
            <RequireAdmin>
              <AdminLayout><AdminMoments/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/logs" element={
            <RequireAdmin>
              <AdminLayout><AdminLogs/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/system" element={
            <RequireAdmin>
              <AdminLayout><AdminSystem/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/reports" element={
            <RequireAdmin>
              <AdminLayout><AdminReports/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/awo" element={
            <RequireAdmin>
              <AdminLayout><AdminAwo/></AdminLayout>
            </RequireAdmin>
          }/>
          <Route path="/admin/test-users" element={
            <RequireAdmin>
              <AdminLayout><AdminTestUsers/></AdminLayout>
            </RequireAdmin>
          }/>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
