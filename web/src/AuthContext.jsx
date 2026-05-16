// web/src/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api, socket } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hey_token');
    if (token) {
      api.getMe()
        .then(u => { setUser(u); socket.connect(token); })
        .catch(() => localStorage.removeItem('hey_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

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

  function login(token, userData) {
    localStorage.setItem('hey_token', token);
    setUser(userData);
    socket.connect(token);
  }

  function logout() {
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
