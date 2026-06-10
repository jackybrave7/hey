import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import Icon from '../Icon';

export function ForcePasswordModal({ onDone }) {
  const [newPwd,  setNewPwd]  = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [err,     setErr]     = useState('');
  const [saving,  setSaving]  = useState(false);
  const [show1,   setShow1]   = useState(false);
  const [show2,   setShow2]   = useState(false);
  const { setUser } = useAuth();

  async function handleChange() {
    setErr('');
    if (!newPwd || !newPwd2) { setErr('Заполните оба поля'); return; }
    if (newPwd !== newPwd2)  { setErr('Пароли не совпадают'); return; }
    if (newPwd.length < 8)   { setErr('Минимум 8 символов'); return; }
    setSaving(true);
    try {
      // Use a known placeholder for old password — admin already reset it
      await api.changePassword('__admin_reset__', newPwd);
      // Refresh user to clear must_change_password flag
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      onDone();
    } catch(e) {
      setErr(e.message || 'Ошибка');
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(10,5,25,.92)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: 'rgba(38,28,68,.98)', borderRadius: 22,
        width: '100%', maxWidth: 380, padding: '28px 26px 24px',
        boxShadow: '0 30px 80px rgba(0,0,0,.7)',
        border: '1px solid rgba(249,240,240,.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 12, color: 'rgba(249,240,240,.85)' }}>
          <Icon name="lock" size={36} />
        </div>
        <div style={{ color:'#F9F0F0', fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Смените пароль
        </div>
        <div style={{ color: 'rgba(249,240,240,.6)', fontSize: 13, textAlign: 'center', marginBottom: 22, lineHeight: 1.5 }}>
          Администратор выдал вам временный пароль. Придумайте новый, чтобы продолжить.
        </div>

        {/* New password */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={show1 ? 'text' : 'password'}
            placeholder="Новый пароль"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            style={{
              width: '100%', background: 'rgba(249,240,240,.1)',
              border: '1px solid rgba(249,240,240,.2)', borderRadius: 14,
              padding: '13px 46px 13px 16px', color:'#F9F0F0', fontSize: 15,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(180,140,220,.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(249,240,240,.2)'}
          />
          <button type="button" onClick={() => setShow1(s => !s)} style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(249,240,240,.5)',
            cursor: 'pointer', fontSize: 17, fontFamily: 'inherit'
          }}><Icon name={show1 ? 'eye-off' : 'eye'} size={18}/></button>
        </div>

        {/* Confirm password */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type={show2 ? 'text' : 'password'}
            placeholder="Повторите пароль"
            value={newPwd2}
            onChange={e => setNewPwd2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChange()}
            style={{
              width: '100%', background: 'rgba(249,240,240,.1)',
              border: '1px solid rgba(249,240,240,.2)', borderRadius: 14,
              padding: '13px 46px 13px 16px', color:'#F9F0F0', fontSize: 15,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(180,140,220,.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(249,240,240,.2)'}
          />
          <button type="button" onClick={() => setShow2(s => !s)} style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(249,240,240,.5)',
            cursor: 'pointer', fontSize: 17, fontFamily: 'inherit'
          }}><Icon name={show2 ? 'eye-off' : 'eye'} size={18}/></button>
        </div>

        {err && (
          <div style={{
            background: 'rgba(220,60,60,.18)', border: '1px solid rgba(255,120,120,.35)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14,
            color:'#F9F0F0', fontSize: 13, textAlign: 'center'
          }}>{err}</div>
        )}

        <button
          onClick={handleChange}
          disabled={saving}
          className="auth-btn-primary"
        >
          {saving ? 'Сохраняем…' : 'Установить новый пароль'}
        </button>
      </div>
    </div>
  );
}
