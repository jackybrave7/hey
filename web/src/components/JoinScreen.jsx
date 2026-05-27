// JoinScreen.jsx — точка входа для учеников BL School (приходят по /join-ссылке от АВО)
// Проверяет подпись через бэк, если ОК — отправляет на /register с предзаполненным email.
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function JoinScreen() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState('loading'); // loading | ok | invalid | already
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  const email  = params.get('email') || '';
  const course = params.get('course') || '';
  const sig    = params.get('sig') || '';

  useEffect(() => {
    if (!email) {
      setState('invalid');
      setError('Ссылка неполная — нет email');
      return;
    }
    api.joinValidate(email, course, sig)
      .then(r => {
        setInfo(r);
        if (r.alreadyRegistered) setState('already');
        else setState('ok');
      })
      .catch(e => {
        setState('invalid');
        setError(e.message);
      });
  }, [email, course, sig]);

  const wrap = {
    minHeight: '100vh', background: 'var(--grad, linear-gradient(135deg,#1a0d3a,#0e0820))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  // Тёмная подложка — фон страницы в светлой части градиента иначе «съедает»
  // полупрозрачно-белую карточку и опускает контраст текста.
  const card = {
    maxWidth: 440, width: '100%', background: 'rgba(20,12,40,.72)',
    border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: '32px 28px',
    color: 'white', textAlign: 'center', backdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  };
  const mutedText = { color: 'rgba(230,225,250,.85)' };
  const hintText  = { color: 'rgba(230,225,250,.65)' };

  function continueToRegister() {
    // Передаём данные через sessionStorage (sig и email — чтобы register знал, какой school invite использовать)
    sessionStorage.setItem('hey_school_invite', JSON.stringify({
      code: info.schoolInviteCode,
      email: info.email,
      course: info.course,
      schoolName: info.schoolName,
    }));
    nav('/register');
  }

  if (state === 'loading') {
    return <div style={wrap}><div style={card}><div style={{ fontSize: 20, opacity: .7 }}>Проверяем приглашение…</div></div></div>;
  }

  if (state === 'invalid') {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Ссылка недействительна</h1>
          <p style={{ ...mutedText, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            {error || 'Похоже, ссылка устарела или была изменена. Свяжись со школой за новой ссылкой.'}
          </p>
          <Link to="/" style={{ color: 'rgba(200,170,255,1)', fontSize: 14, fontWeight: 600 }}>← На главную</Link>
        </div>
      </div>
    );
  }

  if (state === 'already') {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Ты уже в HEY</h1>
          <p style={{ ...mutedText, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            Аккаунт с email <strong style={{color:'white'}}>{email}</strong> уже зарегистрирован.<br/>
            Просто войди — школа и курс уже привязаны.
          </p>
          <button onClick={() => nav('/login')} style={{
            padding: '12px 24px', borderRadius: 12, border: 'none',
            background: 'rgba(140,110,220,.6)', color: 'white', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}>Войти в HEY</button>
        </div>
      </div>
    );
  }

  // state === 'ok'
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          {info.schoolName} приглашает тебя в HEY
        </h1>
        {info.course && (
          <p style={{ color: 'rgba(200,170,255,1)', fontSize: 14, marginBottom: 14, fontWeight: 700 }}>
            Курс «{info.course}»
          </p>
        )}
        <p style={{ ...mutedText, fontSize: 14, marginBottom: 22, lineHeight: 1.55 }}>
          HEY — мессенджер где собирается сообщество учеников.<br/>
          Регистрация займёт минуту — email <strong style={{color:'white'}}>{email}</strong> уже подставлен.
        </p>
        <button onClick={continueToRegister} style={{
          padding: '14px 28px', borderRadius: 12, border: 'none',
          background: 'rgba(140,110,220,.9)', color: 'white', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', width: '100%',
          boxShadow: '0 6px 18px rgba(120,90,200,.4)',
        }}>
          Продолжить регистрацию →
        </button>
        <div style={{ marginTop: 14, ...hintText, fontSize: 13 }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: 'rgba(200,170,255,1)', fontWeight: 600 }}>Войти</Link>
        </div>
      </div>
    </div>
  );
}
