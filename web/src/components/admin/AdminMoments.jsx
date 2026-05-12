// AdminMoments.jsx — all moments with moderation tools
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMoments() {
  const [moments, setMoments]   = useState([]);
  const [status, setStatus]     = useState('active');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');
  const [deleting, setDeleting] = useState(null);

  function showMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetMoments({ status: status === 'all' ? undefined : status });
      setMoments(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(moment) {
    const reason = prompt(`Причина удаления момента "${moment.text?.slice(0, 60)}…"?\n(оставь пустым если нет)`);
    if (reason === null) return; // cancelled
    try {
      await api.adminDeleteMoment(moment.id, reason || undefined);
      setMoments(prev => prev.filter(m => m.id !== moment.id));
      showMsg('Момент удалён');
    } catch (e) {
      showMsg('Ошибка: ' + e.message);
    }
  }

  const STATUSES = [
    { value: 'active', label: 'Активные' },
    { value: 'archived', label: 'Архив' },
    { value: 'all', label: 'Все' },
  ];

  const cell = { padding: '12px 16px', color: 'rgba(255,255,255,.8)', fontSize: 13,
    borderBottom: '1px solid rgba(255,255,255,.06)', verticalAlign: 'top' };
  const hcell = { ...cell, color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: .8, verticalAlign: 'middle' };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        ✦ Моменты
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setStatus(s.value)}
            style={{
              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: status === s.value ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
              color: status === s.value ? 'white' : 'rgba(255,255,255,.6)',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.9)', background: 'rgba(200,50,50,.12)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          Ошибка: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 14 }}>Загрузка…</div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={hcell}>Автор</th>
                <th style={hcell}>Текст</th>
                <th style={hcell}>Медиа</th>
                <th style={{ ...hcell, textAlign: 'center' }}>👁</th>
                <th style={{ ...hcell, textAlign: 'center' }}>Реакции</th>
                <th style={hcell}>Создан</th>
                <th style={hcell}>Статус</th>
                <th style={hcell}></th>
              </tr>
            </thead>
            <tbody>
              {moments.length === 0 && (
                <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  Пусто
                </td></tr>
              )}
              {moments.map(m => (
                <tr key={m.id}>
                  <td style={cell}>
                    <div style={{ color: 'white', fontWeight: 600 }}>{m.author_name}</div>
                    <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11 }}>{m.author_phone}</div>
                  </td>
                  <td style={{ ...cell, maxWidth: 260 }}>
                    <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {m.text}
                    </div>
                    {m.auto_tags?.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {m.auto_tags.map(t => (
                          <span key={t} style={{ fontSize: 10, color: 'rgba(180,140,255,.7)',
                            background: 'rgba(120,90,200,.15)', borderRadius: 4, padding: '1px 5px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={cell}>
                    {m.media_type ? (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)',
                        background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px' }}>
                        {m.media_type}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'center' }}>{m.views}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    <div style={{ fontSize: 11 }}>
                      {m.stats?.see || 0} 👁 · {m.stats?.resonate || 0} ✨ · {m.stats?.talk || 0} 🤝
                    </div>
                  </td>
                  <td style={cell}>{fmtDate(m.created_at)}</td>
                  <td style={cell}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px',
                      background: m.status === 'active' ? 'rgba(60,180,100,.12)' : 'rgba(255,255,255,.08)',
                      color: m.status === 'active' ? 'rgba(100,220,140,.8)' : 'rgba(255,255,255,.4)',
                    }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={cell}>
                    <button onClick={() => handleDelete(m)}
                      style={{ background: 'rgba(200,50,50,.3)', border: 'none', borderRadius: 8,
                        padding: '6px 10px', color: 'rgba(255,120,120,.9)', fontSize: 12,
                        cursor: 'pointer', fontWeight: 600 }}>
                      🗑 Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, marginTop: 12 }}>
        {moments.length} моментов
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
