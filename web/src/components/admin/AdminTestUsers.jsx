// AdminTestUsers.jsx — управление режимом тестовых пользователей.
// Когда включено: админ видит 100 фейковых юзеров с моментами в ленте
// и поиске, для удобства тестирования интерфейса.
import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 14,
  padding: '20px 22px',
  marginBottom: 18,
};
const btnPrimary = {
  padding: '10px 18px', borderRadius: 12, border: 'none',
  background: 'rgba(120,90,200,.85)', color: 'white',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnGhost = {
  ...btnPrimary,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.14)',
  color: 'rgba(255,255,255,.85)',
};
const btnDanger = {
  ...btnPrimary,
  background: 'rgba(200,60,60,.45)',
  border: '1px solid rgba(255,140,140,.55)',
  color: 'rgba(255,225,225,1)',
};

export default function AdminTestUsers() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [customConfirm, confirmModal] = useConfirm();

  function notify(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function reload() {
    try {
      const s = await api.adminTestUsersStatus();
      setStatus(s);
    } catch (e) { notify('Ошибка: ' + e.message); }
  }
  useEffect(() => { reload(); }, []);

  async function toggle(enabled) {
    setBusy(true);
    try {
      const s = await api.adminTestUsersToggle(enabled);
      setStatus(s);
      notify(enabled
        ? `✓ Включено. Тестовых юзеров: ${s.count}`
        : '○ Выключено — тестовые юзеры скрыты');
    } catch (e) { notify('Ошибка: ' + e.message); }
    setBusy(false);
  }

  async function reseed() {
    if (!await customConfirm(
      'Пересоздать всех 100 тестовых пользователей? Существующие моменты будут перезаписаны.',
      { confirmLabel: 'Пересоздать' }
    )) return;
    setBusy(true);
    try {
      const r = await api.adminTestUsersReseed();
      notify(`✓ Создано/обновлено: ${r.total}`);
      reload();
    } catch (e) { notify('Ошибка: ' + e.message); }
    setBusy(false);
  }

  async function clearAll() {
    if (!await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:8}}>Удалить всех тестовых пользователей?</div>
        <div style={{color:'rgba(255,255,255,.65)',fontSize:13,lineHeight:1.55}}>
          Будут удалены 100 фейковых юзеров и все их моменты. Реальные пользователи
          не затрагиваются. Действие необратимо — но можно пересоздать заново.
        </div>
      </>,
      { danger: true, requireWord: 'УДАЛИТЬ' }
    )) return;
    setBusy(true);
    try {
      const r = await api.adminTestUsersClear();
      notify(`Удалено: ${r.deleted}`);
      reload();
    } catch (e) { notify('Ошибка: ' + e.message); }
    setBusy(false);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        🧪 Тестовые пользователи
      </h1>
      <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 14, marginTop: 0, marginBottom: 24, lineHeight: 1.55 }}>
        Режим для удобства тестирования интерфейса. Когда включён — в ленте моментов
        у админов появляются 100 фейковых пользователей с разными именами, аватарами,
        био и моментами. Имена помечены «(тестовый)». Реальные пользователи их не видят.
      </p>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20,
          background: 'rgba(60,170,110,.95)', color: 'white',
          padding: '10px 16px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      {/* Status */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: status?.enabled ? 'rgba(80,220,120,.9)' : 'rgba(200,200,200,.3)',
            boxShadow: status?.enabled ? '0 0 12px rgba(80,220,120,.6)' : 'none',
          }}/>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>
              {status?.enabled ? 'Режим включён' : 'Режим выключен'}
            </div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginTop: 2 }}>
              {status === null ? 'Загрузка…' :
                status.count > 0
                  ? `В базе ${status.count} тестовых пользователей`
                  : 'Тестовые пользователи ещё не созданы'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!status?.enabled ? (
            <button onClick={() => toggle(true)} disabled={busy} style={btnPrimary}>
              {busy ? '…' : '▶ Включить (создаст автоматически, если нужно)'}
            </button>
          ) : (
            <button onClick={() => toggle(false)} disabled={busy} style={btnGhost}>
              {busy ? '…' : '⏸ Выключить (скрыть)'}
            </button>
          )}
          {status?.count > 0 && (
            <>
              <button onClick={reseed} disabled={busy} style={btnGhost}>
                🔄 Пересоздать с теми же ID
              </button>
              <button onClick={clearAll} disabled={busy} style={btnDanger}>
                🗑 Удалить всех
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
          Что попадает в ленту
        </div>
        <ul style={{ color: 'rgba(255,255,255,.78)', fontSize: 13, lineHeight: 1.7,
          margin: 0, paddingLeft: 20 }}>
          <li>Имена: 65% русские, 35% иностранные (с фамилиями)</li>
          <li>Аватары: реальные портреты с randomuser.me (детерминированно по id)</li>
          <li>Профессии: художник, музыкант, режиссёр, актёр, поэт, фотограф, танцор, писатель, скульптор, дизайнер</li>
          <li>Био: подобрано под профессию (3-4 варианта на каждую)</li>
          <li>Моменты: 1-2 на пользователя, тематические по профессии</li>
          <li>40% юзеров со статусом ✦ Super (для отображения badge'ов)</li>
          <li>Последний онлайн: случайно за последний месяц</li>
        </ul>
      </div>

      {confirmModal}
    </div>
  );
}
