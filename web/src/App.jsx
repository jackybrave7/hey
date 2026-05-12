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
} from './components/Screens';
import MomentsFeed from './components/moments/MomentsFeed';
import BottomNav from './components/BottomNav';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminUserDetail from './components/admin/AdminUserDetail';
import AdminMoments from './components/admin/AdminMoments';
import AdminLogs from './components/admin/AdminLogs';

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
      if (location.pathname === '/conversations') return;
      setUnread(n => n + 1);
    });
  }, [user?.id, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/conversations') setUnread(0);
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
  const { logout, user } = useAuth();
  const [showMustChangePwd, setShowMustChangePwd] = useState(false);
  const [blockedOverlay, setBlockedOverlay] = useState(false);

  // Check on load — if user already has must_change_password flag
  useEffect(() => {
    if (user?.must_change_password) setShowMustChangePwd(true);
  }, [user?.must_change_password]);

  // Listen for runtime events from api.js
  useEffect(() => {
    const onBlocked = () => {
      setBlockedOverlay(true);
      setTimeout(() => { logout(); }, 2800);
    };
    const onMustChange = () => setShowMustChangePwd(true);
    window.addEventListener('hey:blocked', onBlocked);
    window.addEventListener('hey:must-change-password', onMustChange);
    return () => {
      window.removeEventListener('hey:blocked', onBlocked);
      window.removeEventListener('hey:must-change-password', onMustChange);
    };
  }, [logout]);

  return (
    <>
      {blockedOverlay && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(10,5,25,.97)', backdropFilter:'blur(24px)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:18, animation:'fadeIn .25s ease',
        }}>
          <div style={{fontSize:56}}>🚫</div>
          <div style={{color:'white', fontSize:22, fontWeight:800, letterSpacing:-.3}}>
            Аккаунт заблокирован
          </div>
          <div style={{color:'rgba(255,255,255,.45)', fontSize:14, textAlign:'center', maxWidth:260, lineHeight:1.6}}>
            Доступ к аккаунту ограничен администратором
          </div>
        </div>
      )}
      {showMustChangePwd && user && (
        <ForcePasswordModal onDone={() => setShowMustChangePwd(false)} />
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
        <Routes>
          {/* Public */}
          <Route path="/"         element={<SplashScreen/>}/>
          <Route path="/hey"      element={<HeyScreen/>}/>
          <Route path="/login"    element={<GuestOnly><LoginScreen/></GuestOnly>}/>
          <Route path="/register" element={<GuestOnly><RegisterScreen/></GuestOnly>}/>
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

          <Route path="/conversations" element={
            <Protected>
              <WithBottomNav>
                <ConversationsScreen/>
              </WithBottomNav>
            </Protected>
          }/>

          <Route path="/contacts" element={
            <Protected>
              <WithBottomNav>
                <ContactsScreen/>
              </WithBottomNav>
            </Protected>
          }/>

          <Route path="/profile/me" element={
            <Protected>
              <WithBottomNav>
                <MyProfileScreen/>
              </WithBottomNav>
            </Protected>
          }/>

          {/* Protected — without bottom nav */}
          <Route path="/moments/:id"             element={<Protected><MomentPage/></Protected>}/>
          <Route path="/profile/:id"             element={<Protected><PublicProfileScreen/></Protected>}/>
          <Route path="/chat/:convId"            element={<Protected><ChatScreen/></Protected>}/>
          <Route path="/groups/new"              element={<Protected><GroupCreateScreen/></Protected>}/>
          <Route path="/groups/:convId/settings" element={<Protected><GroupSettingsScreen/></Protected>}/>
          <Route path="/calls"                   element={<Protected><CallsScreen/></Protected>}/>
          <Route path="/calls/:callId"           element={<Protected><CallDetailScreen/></Protected>}/>
          <Route path="/settings"                element={<Protected><SettingsScreen/></Protected>}/>

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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
