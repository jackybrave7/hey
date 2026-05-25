// AdminReports.jsx — список жалоб от пользователей
import { useState, useEffect } from 'react';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
  });
}

const STATUS_LABELS = {
  open:      { l: 'Открыта',   color: 'rgba(255,200,100,.95)' },
  resolved:  { l: 'Решена',    color: 'rgba(100,220,140,.95)' },
  dismissed: { l: 'Отклонена', color: 'rgba(180,180,180,.85)' },
};
const TARGET_LABELS = {
  moment:  '✦ Момент',
  user:    '👤 Пользователь',
  message: '💬 Сообщение',
};

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [status, setStatus]   = useState('open');
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminGetReports(status);
      setReports(data);
    } catch (e) {
      showToast('Ошибка: ' + e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [status]);

  async function resolve(r, action) {
    const label = action === 'resolved' ? 'отметить как решённую' : 'отклонить';
    if (!confirm(`Действительно ${label} эту жалобу?`)) return;
    try {
      await api.adminResolveReport(r.id, action);
      showToast(action === 'resolved' ? '✓ Решена' : '✓ Отклонена');
      load();
    } catch (e) {
      showToast('Ошибка: ' + e.message);
    }
  }

  const TABS = [
    { v: 'open',      l: 'Открытые' },
    { v: 'resolved',  l: 'Решённые' },
    { v: 'dismissed', l: 'Отклонённые' },
    { v: 'all',       l: 'Все' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        🚩 Жалобы
      </h1>
      <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        Что прислали пользователи через «Пожаловаться» на моменты и юзеров
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setStatus(t.v)}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: status === t.v ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
              color: status === t.v ? 'white' : 'rgba(255,255,255,.6)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Загрузка…</div>
      ) : reports.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          background: 'rgba(255,255,255,.03)', borderRadius: 14,
          border: '1px dashed rgba(255,255,255,.1)',
          color: 'rgba(255,255,255,.4)', fontSize: 14,
        }}>
          {status === 'open' ? '✓ Открытых жалоб нет' : 'Пусто'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => {
            const st = STATUS_LABELS[r.status] || STATUS_LABELS.open;
            return (
              <div key={r.id} style={{
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 14, padding: 16,
              }}>
                {/* Meta */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    background: 'rgba(255,255,255,.08)', borderRadius: 6,
                    padding: '3px 9px', fontSize: 11, fontWeight: 700,
                    color: 'rgba(255,255,255,.85)',
                  }}>
                    {TARGET_LABELS[r.target_type] || r.target_type}
                  </span>
                  <span style={{
                    background: 'rgba(0,0,0,.25)', borderRadius: 6,
                    padding: '3px 9px', fontSize: 11, fontWeight: 700,
                    color: st.color,
                  }}>
                    {st.l}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
                    {fmtDate(r.created_at)}
                  </span>
                </div>

                {/* Reporter */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  color: 'rgba(255,255,255,.55)', fontSize: 13,
                }}>
                  <span style={{ color: 'rgba(255,255,255,.4)' }}>от</span>
                  <strong style={{ color: 'rgba(220,200,255,.95)', fontWeight: 600 }}>
                    {r.reporter_name || r.reporter_id?.slice(0, 8) || '—'}
                  </strong>
                  {r.target_user_name && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,.4)' }}>·  на</span>
                      <strong style={{ color: 'rgba(255,180,180,.95)', fontWeight: 600 }}>
                        {r.target_user_name}
                      </strong>
                    </>
                  )}
                </div>

                {/* Target ID */}
                <div style={{
                  color: 'rgba(255,255,255,.35)', fontSize: 11,
                  fontFamily: 'monospace', marginBottom: 12,
                }}>
                  {r.target_type} → <code>{r.target_id}</code>
                </div>

                {/* Reason */}
                <div style={{
                  background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '12px 14px',
                  color: 'rgba(255,255,255,.85)', fontSize: 14, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14,
                }}>
                  {r.reason}
                </div>

                {/* Actions */}
                {r.status === 'open' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => resolve(r, 'resolved')}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                        background: 'rgba(60,180,100,.25)', color: 'rgba(140,240,180,.95)',
                      }}>
                      ✓ Принять меры
                    </button>
                    <button onClick={() => resolve(r, 'dismissed')}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', border: '1px solid rgba(255,255,255,.15)',
                        background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.7)',
                        fontFamily: 'inherit',
                      }}>
                      Отклонить
                    </button>
                    {r.target_type === 'moment' && (
                      <a href={`/moments/${r.target_id}`} target="_blank" rel="noopener noreferrer"
                        style={{
                          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          textDecoration: 'none',
                          background: 'rgba(120,90,200,.25)', color: 'rgba(220,200,255,.95)',
                          border: '1px solid rgba(180,140,220,.3)',
                        }}>
                        → Открыть момент
                      </a>
                    )}
                    {r.target_user_id && (
                      <a href={`/admin/users/${r.target_user_id}`}
                        style={{
                          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          textDecoration: 'none',
                          background: 'rgba(120,90,200,.25)', color: 'rgba(220,200,255,.95)',
                          border: '1px solid rgba(180,140,220,.3)',
                        }}>
                        → Карточка юзера
                      </a>
                    )}
                  </div>
                )}
                {r.status !== 'open' && r.resolved_at && (
                  <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12,
                    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span>
                      {r.status === 'resolved' ? '✓ Приняты меры' : '◇ Отклонена'}
                    </span>
                    <span>·</span>
                    <span>{fmtDate(r.resolved_at)}</span>
                    {r.resolved_by_name && (
                      <>
                        <span>·</span>
                        <span>
                          администратор{' '}
                          <strong style={{color:'rgba(200,180,255,.95)', fontWeight:600}}>
                            {r.resolved_by_name}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
