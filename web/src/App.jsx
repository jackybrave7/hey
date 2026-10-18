// web/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { socket, api } from './api';
import {
  SplashScreen, HeyScreen, LoginScreen, RegisterScreen, SuccessScreen,
  WelcomeScreen,
} from './components/screens/authScreens';
import { ToastContainer } from './components/screens/shared';
import { lazyScreen, lazyDefault } from './lazyScreen';
import LazyRoute from './components/LazyRoute';
import BottomNav from './components/BottomNav';

const MyProfileScreen = lazyScreen('MyProfileScreen');
const ContactsScreen = lazyScreen('ContactsScreen');
const ConversationsScreen = lazyScreen('ConversationsScreen');
const ChatScreen = lazyScreen('ChatScreen');
const CallsScreen = lazyScreen('CallsScreen');
const CallDetailScreen = lazyScreen('CallDetailScreen');
const SettingsScreen = lazyScreen('SettingsScreen');
const GroupCreateScreen = lazyScreen('GroupCreateScreen');
const GroupSettingsScreen = lazyScreen('GroupSettingsScreen');
const ForcePasswordModal = lazyScreen('ForcePasswordModal');
const PublicProfileScreen = lazyScreen('PublicProfileScreen');
const MomentPage = lazyScreen('MomentPage');

const MomentsFeed = lazyDefault(() => import('./components/moments/MomentsFeed'));
const JoinScreen = lazyDefault(() => import('./components/JoinScreen'));
const UserGuide = lazyDefault(() => import('./components/UserGuide'));

const AdminLayout = lazyDefault(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazyDefault(() => import('./components/admin/AdminDashboard'));
const AdminUsers = lazyDefault(() => import('./components/admin/AdminUsers'));
const AdminUserDetail = lazyDefault(() => import('./components/admin/AdminUserDetail'));
const AdminMoments = lazyDefault(() => import('./components/admin/AdminMoments'));
const AdminLogs = lazyDefault(() => import('./components/admin/AdminLogs'));
const AdminSystem = lazyDefault(() => import('./components/admin/AdminSystem'));
const AdminReports = lazyDefault(() => import('./components/admin/AdminReports'));
const AdminAwo = lazyDefault(() => import('./components/admin/AdminAwo'));

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
  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',
      alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'rgba(255,255,255,.5)',fontSize:16}}>Загрузка…</div>
    </div>
  );
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

function GlobalHandlers() {
  const { logout, user, setUser } = useAuth();
  const [showMustChangePwd, setShowMustChangePwd] = useState(false);
  const [blockedOverlay, setBlockedOverlay] = useState(false);
  const [sysToast, setSysToast] = useState('');

  useEffect(() => {
    if (user?.must_change_password) setShowMustChangePwd(true);
  }, [user?.must_change_password]);

  useEffect(() => {
    const onBlocked = () => {
      setBlockedOverlay(true);
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

  useEffect(() => {
    return socket.on('system:notification', ({ text, kind }) => {
      setSysToast(text);
      setTimeout(() => setSysToast(''), 5000);
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
        <LazyRoute>
          <ForcePasswordModal onDone={() => setShowMustChangePwd(false)} />
        </LazyRoute>
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

function L({ children }) {
  return <LazyRoute>{children}</LazyRoute>;
}

export default function App() {
  useNotifications();
  return (
    <AuthProvider>
      <BrowserRouter>
        <GlobalHandlers />
        <ToastContainer />
        <Routes>
          <Route path="/"         element={<SplashScreen/>}/>
          <Route path="/hey"      element={<HeyScreen/>}/>
          <Route path="/login"    element={<GuestOnly><LoginScreen/></GuestOnly>}/>
          <Route path="/register" element={<GuestOnly><RegisterScreen/></GuestOnly>}/>
          <Route path="/join"     element={<GuestOnly><L><JoinScreen/></L></GuestOnly>}/>
          <Route path="/success"  element={<SuccessScreen/>}/>
          <Route path="/welcome"  element={<WelcomeScreen/>}/>

          <Route path="/main" element={
            <Protected>
              <WithBottomNav>
                <L><MomentsScreen/></L>
              </WithBottomNav>
            </Protected>
          }/>
          <Route path="/moments" element={<Navigate to="/main" replace/>}/>

          <Route path="/chats" element={
            <Protected>
              <WithBottomNav>
                <L><ConversationsScreen/></L>
              </WithBottomNav>
            </Protected>
          }/>
          <Route path="/conversations" element={<Navigate to="/chats" replace/>}/>

          <Route path="/contacts" element={
            <Protected>
              <WithBottomNav>
                <L><ContactsScreen/></L>
              </WithBottomNav>
            </Protected>
          }/>

          <Route path="/me" element={
            <Protected>
              <WithBottomNav>
                <L><MyProfileScreen/></L>
              </WithBottomNav>
            </Protected>
          }/>
          <Route path="/profile/me" element={<Navigate to="/me" replace/>}/>

          <Route path="/moments/:id" element={<L><MomentPage/></L>}/>
          <Route path="/profile/:id" element={<Protected><L><PublicProfileScreen/></L></Protected>}/>
          <Route path="/chat/:convId" element={<Protected><L><ChatScreen/></L></Protected>}/>
          <Route path="/groups/new" element={<Protected><L><GroupCreateScreen/></L></Protected>}/>
          <Route path="/groups/:convId/settings" element={<Protected><L><GroupSettingsScreen/></L></Protected>}/>
          <Route path="/calls" element={<Protected><L><CallsScreen/></L></Protected>}/>
          <Route path="/calls/:callId" element={<Protected><L><CallDetailScreen/></L></Protected>}/>
          <Route path="/settings" element={<Protected><L><SettingsScreen/></L></Protected>}/>
          <Route path="/help" element={<Protected><L><UserGuide/></L></Protected>}/>

          <Route path="/admin" element={
            <RequireAdmin>
              <L><AdminLayout><AdminDashboard/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/users" element={
            <RequireAdmin>
              <L><AdminLayout><AdminUsers/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/users/:id" element={
            <RequireAdmin>
              <L><AdminLayout><AdminUserDetail/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/moments" element={
            <RequireAdmin>
              <L><AdminLayout><AdminMoments/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/logs" element={
            <RequireAdmin>
              <L><AdminLayout><AdminLogs/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/system" element={
            <RequireAdmin>
              <L><AdminLayout><AdminSystem/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/reports" element={
            <RequireAdmin>
              <L><AdminLayout><AdminReports/></AdminLayout></L>
            </RequireAdmin>
          }/>
          <Route path="/admin/awo" element={
            <RequireAdmin>
              <L><AdminLayout><AdminAwo/></AdminLayout></L>
            </RequireAdmin>
          }/>

          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
