import { useEffect, useState } from 'react';
import { api } from '../../api';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { fmtTime } from '../../lib/formatTime';

export default function MessageReadersModal({ convId, messageId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getMessageReaders(convId, messageId)
      .then(r => { if (!cancelled) setData(r); })
      .catch(e => { if (!cancelled) setError(e.message || 'Не удалось загрузить'); });
    return () => { cancelled = true; };
  }, [convId, messageId]);

  const readers = data?.readers || [];
  const total = data?.total_members ?? 0;
  const unread = Math.max(0, total - readers.length);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(94vw, 380px)', maxHeight: '70vh',
          background: 'rgba(45,36,80,.98)', borderRadius: 18,
          border: '1px solid rgba(249,240,240,.12)',
          boxShadow: '0 16px 48px rgba(0,0,0,.45)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 18px 12px', borderBottom: '1px solid rgba(249,240,240,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ color: '#F9F0F0', fontSize: 17, fontWeight: 700 }}>Кто прочитал</div>
            {data && (
              <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 13, marginTop: 4 }}>
                {readers.length} из {total}
                {unread > 0 ? ` · ${unread} ещё нет` : ''}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            style={{
              background: 'rgba(0,0,0,.35)', border: 'none', color: '#F9F0F0',
              width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16,
            }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '10px 12px 14px' }}>
          {error && (
            <div style={{ color: '#ff9b9b', fontSize: 14, padding: '12px 6px' }}>{error}</div>
          )}
          {!error && !data && (
            <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 14, padding: '12px 6px' }}>
              Загрузка…
            </div>
          )}
          {data && readers.length === 0 && (
            <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 14, padding: '12px 6px' }}>
              Пока никто не прочитал
            </div>
          )}
          {readers.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 8px', borderRadius: 12,
            }}>
              <AvatarDisplay user={r} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: '#F9F0F0', fontSize: 14, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.name || 'Участник'}
                </div>
                <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 12, marginTop: 2 }}>
                  {fmtTime(r.read_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
