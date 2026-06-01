// AdminGroupDetail.jsx — карточка одной группы: метаданные + список участников
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function AdminGroupDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [g, setG] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminGetGroup(id).then(setG).catch(e => setError(e.message));
  }, [id]);

  if (error) return (
    <div style={{ padding: '28px 32px' }}>
      <Link to="/admin/groups" style={{ color: 'rgba(180,140,255,.85)', fontSize: 13 }}>← К списку групп</Link>
      <div style={{ color: 'rgba(255,140,140,.95)', marginTop: 16 }}>Ошибка: {error}</div>
    </div>
  );

  if (!g) return (
    <div style={{ padding: '28px 32px', color: 'rgba(255,255,255,.35)' }}>Загрузка…</div>
  );

  const ic = g.icon || '';
  const isImg = ic && (ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:'));

  const card = {
    background:'rgba(20,12,40,.65)', border:'1px solid rgba(255,255,255,.14)',
    borderRadius:14, padding:'18px 20px', boxShadow:'0 4px 14px rgba(0,0,0,.15)',
  };

  const active  = g.members.filter(m => m.status === 'active');
  const pending = g.members.filter(m => m.status === 'pending');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920 }}>
      <Link to="/admin/groups" style={{ color: 'rgba(180,140,255,.85)', fontSize: 13 }}>← К списку групп</Link>

      <div style={{ display:'flex', alignItems:'center', gap: 18, margin: '16px 0 24px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 16,
          background: isImg ? '#0a0518' : 'rgba(120,90,200,.4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: 30, color:'white', fontWeight: 800,
          border:'1px solid rgba(255,255,255,.1)', overflow:'hidden', flexShrink:0,
        }}>
          {isImg
            ? <img src={ic} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
            : (ic || '👥')}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color:'white', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            {g.name || '— без названия —'}
          </h1>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize: 13 }}>
            Создана {fmtDate(g.created_at)} · ID {g.id.slice(0, 8)}…
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: .6, marginBottom: 6 }}>Участники</div>
          <div style={{ color:'white', fontSize: 28, fontWeight: 800 }}>{active.length}</div>
          {pending.length > 0 && (
            <div style={{ color:'rgba(255,200,120,.85)', fontSize: 12, marginTop: 4 }}>
              +{pending.length} ждут подтверждения
            </div>
          )}
        </div>
        <div style={card}>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: .6, marginBottom: 6 }}>Сообщений</div>
          <div style={{ color:'white', fontSize: 28, fontWeight: 800 }}>{g.messages_count}</div>
        </div>
        <div style={card}>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: .6, marginBottom: 6 }}>Последняя активность</div>
          <div style={{ color:'white', fontSize: 14, fontWeight: 700, marginTop: 6 }}>
            {fmtDate(g.last_message_at)}
          </div>
        </div>
        <div style={card}>
          <div style={{ color:'rgba(255,255,255,.5)', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: .6, marginBottom: 6 }}>Видимость истории</div>
          <div style={{ color:'white', fontSize: 14, fontWeight: 700, marginTop: 6 }}>
            {g.history_visibility === 'since_joined' ? '🔒 С момента вступления' : '👁 Вся история'}
          </div>
        </div>
      </div>

      <h2 style={{ color:'white', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Участники ({active.length + pending.length})
      </h2>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {g.members.map(m => {
          const av = m.avatar;
          const isImg = av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));
          return (
            <div key={m.id}
              onClick={() => nav(`/admin/users/${m.id}`)}
              style={{ display:'flex', alignItems:'center', gap: 12,
                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)',
                cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(120,90,200,.4)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'white', fontSize: 14, fontWeight: 700,
                overflow:'hidden', flexShrink: 0,
                border:'1px solid rgba(255,255,255,.1)',
              }}>
                {isImg
                  ? <img src={av} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                  : (m.name?.[0]?.toUpperCase() || '?')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color:'white', fontWeight: 600, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {m.name}
                  {m.id === g.admin_id && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,210,120,1)',
                      background: 'rgba(255,200,80,.15)', border: '1px solid rgba(255,200,80,.35)',
                      borderRadius: 6, padding: '2px 7px' }}>создатель</span>
                  )}
                  {m.id !== g.admin_id && m.is_admin && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(200,170,255,1)',
                      background: 'rgba(140,110,220,.18)', border: '1px solid rgba(180,140,220,.4)',
                      borderRadius: 6, padding: '2px 7px' }}>админ</span>
                  )}
                  {m.status === 'pending' && (
                    <span style={{ fontSize: 11, color:'rgba(255,200,120,.9)',
                      background:'rgba(255,200,120,.12)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                      🕓 ждёт подтверждения
                    </span>
                  )}
                  {m.is_blocked && (
                    <span style={{ fontSize: 11, color:'rgba(255,120,120,.9)',
                      background:'rgba(200,50,50,.18)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                      заблокирован
                    </span>
                  )}
                  {m.is_deleted && (
                    <span style={{ fontSize: 11, color:'rgba(255,255,255,.45)',
                      background:'rgba(255,255,255,.06)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                      удалён
                    </span>
                  )}
                </div>
                <div style={{ color:'rgba(255,255,255,.45)', fontSize: 12, marginTop: 2 }}>
                  Вступил {m.joined_at ? fmtDate(m.joined_at) : '—'}
                  {m.online && <span style={{ color:'rgba(110,235,150,.95)', marginLeft: 8 }}>● онлайн</span>}
                </div>
              </div>
              <span style={{ color:'rgba(255,255,255,.35)', fontSize: 18 }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
