// web/src/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api, socket } from './api';
import { reportInstalledAppIfNeeded } from './lib/appClient';

const AuthCtx = createContext(null);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isAuthError(err) {
  return err?.status === 401 || err?.status === 403 || err?.code === 'BLOCKED';
}

async function bootstrapSession(setUser) {
  const stored = localStorage.getItem('hey_token');

  if (stored) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const u = await api.getMe();
        setUser(u);
        socket.connect(stored);
        return;
      } catch (e) {
        if (isAuthError(e)) {
          localStorage.removeItem('hey_token');
          break;
        }
        if (attempt < 2) await sleep(400 * (attempt + 1));
      }
    }
  }

  try {
    const session = await api.restoreSession();
    if (session?.token && session?.user) {
      localStorage.setItem('hey_token', session.token);
      setUser(session.user);
      socket.connect(session.token);
      return;
    }
  } catch (e) {
    if (isAuthError(e)) localStorage.removeItem('hey_token');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapSession(setUser).finally(() => setLoading(false));
  }, []);

  // Сообщаем серверу, если HEY открыт как установленное приложение (PWA / Android).
  useEffect(() => {
    if (!user?.id) return;
    reportInstalledAppIfNeeded(api);
  }, [user?.id]);

  // Force logout when server confirms account deletion
  useEffect(() => {
    const unsub = socket.on('account:deleted', () => {
      localStorage.removeItem('hey_token');
      socket.disconnect();
      setUser(null);
      window.location.href = '/login';
    });
    return unsub;
  }, []);

  // Бизнес-доступ: реагируем на одобрение/отклонение в реальном времени.
  // Сервер шлёт business:approved/rejected/revoked после действий админа.
  useEffect(() => {
    const fire = (msg, type) => {
      try { window.dispatchEvent(new CustomEvent('hey:toast', { detail: { message: msg, type } })); } catch {}
    };
    const u1 = socket.on('business:approved', () => {
      setUser(u => u ? { ...u, business_status: 'approved' } : u);
      fire('🎓 Бизнес-доступ одобрен! Раздел «Мои школы» доступен.', 'success');
    });
    const u2 = socket.on('business:rejected', () => {
      // Подтянем причину свежим запросом /me
      api.getMe().then(setUser).catch(() => {});
      fire('⚠ Заявка на бизнес-доступ отклонена.', 'error');
    });
    const u3 = socket.on('business:revoked', () => {
      api.getMe().then(setUser).catch(() => {});
      fire('⚠ Бизнес-доступ отозван админом.', 'error');
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  function login(token, userData) {
    localStorage.setItem('hey_token', token);
    setUser(userData);
    socket.connect(token);
  }

  function logout() {
    // Чистим cookie-сессию на сервере (для виджета HEY в ЛК АВО).
    // Игнорируем ошибки — основное обнуление состояния делаем локально.
    try { api.logout?.().catch(() => {}); } catch {}
    localStorage.removeItem('hey_token');
    socket.disconnect();
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
