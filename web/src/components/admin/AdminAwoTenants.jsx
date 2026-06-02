// AdminAwoTenants.jsx — список школ (tenant'ов) AWO-интеграции
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useConfirm } from '../Screens';
import { useAuth } from '../../AuthContext';
import AwoGuide from './AwoGuide';

const cardStyle = {
  background: 'rgba(20,12,40,.65)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 14,
  padding: '16px 18px',
  marginBottom: 12,
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
  transition: 'background .12s',
};
const btn = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'rgba(140,110,220,.85)', color: 'white',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnGhost = {
  ...btn,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.18)',
  color: 'rgba(225,220,245,.9)',
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'2-digit', month:'short', year:'2-digit' });
}

export default function AdminAwoTenants() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  // Создавать школы могут только админы или approved-бизнес-юзеры.
  // Со-админ чужой школы — нет (он попадает сюда чтобы зайти в школу,
  // где его сделали соадмином).
  const canCreate = !!user?.is_admin || user?.business_status === 'approved';
  // Базовый путь: /admin/awo для админов, /integrations/awo для бизнес-юзеров
  const basePath = location.pathname.startsWith('/integrations') ? '/integrations/awo' : '/admin/awo';
  const [tenants, setTenants] = useState(null);
  const [error, setError]     = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [customConfirm, confirmModal] = useConfirm();

  async function load() {
    try { setTenants(await api.adminListAwoTenants()); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const t = await api.adminCreateAwoTenant(newName.trim());
      setNewName('');
      nav(basePath + '/' + t.id);
    } catch (e) { setError(e.message); }
    setCreating(false);
  }

  async function remove(t) {
    if (!await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:6}}>Удалить школу «{t.name}»?</div>
        <div style={{color:'rgba(225,220,245,.7)',fontSize:13,lineHeight:1.55}}>
          Webhook-токен и связанные маппинги перестанут работать.
          История инвайтов и обработанных счетов сохранится.
        </div>
      </>,
      { danger: true, requireWord: 'УДАЛИТЬ' }
    )) return;
    try {
      await api.adminDeleteAwoTenant(t.id);
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, margin: 0, flex: 1 }}>
          🎓 АВО / Школы
        </h1>
        <button onClick={() => setShowGuide(true)}
          style={{
            padding: '7px 14px', borderRadius: 10,
            background: 'rgba(120,90,200,.25)',
            border: '1px solid rgba(180,140,220,.4)',
            color: 'rgba(220,200,255,.95)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}>📖 Руководство</button>
      </div>
      <p style={{ color: 'rgba(225,220,245,.85)', fontSize: 14, marginBottom: 22, lineHeight: 1.55 }}>
        Каждая школа — отдельная интеграция с АвтоВебОфисом со своим webhook-токеном,
        набором курсов и официальным аккаунтом.
      </p>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.95)', background: 'rgba(200,50,50,.15)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {error} <button onClick={() => setError('')} style={{ ...btnGhost, marginLeft: 8, padding:'3px 10px', fontSize:11 }}>×</button>
        </div>
      )}

      {/* Create form — только для создателей школ */}
      {canCreate && (
        <div style={{
          background: 'rgba(20,12,40,.5)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 22,
          display:'flex', gap:8,
        }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Название новой школы"
            style={{
              flex:1, padding:'10px 12px', borderRadius:10,
              background:'rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.18)',
              color:'white', fontSize:14, outline:'none', fontFamily:'inherit',
            }}/>
          <button onClick={create} disabled={creating || !newName.trim()} style={btn}>
            {creating ? '…' : '+ Создать школу'}
          </button>
        </div>
      )}

      {tenants === null && (
        <div style={{ color: 'rgba(225,220,245,.7)', textAlign:'center', padding: 30 }}>Загрузка…</div>
      )}
      {tenants && tenants.length === 0 && (
        <div style={{ color: 'rgba(225,220,245,.7)', textAlign:'center', padding: 30 }}>
          Школ ещё нет.
        </div>
      )}
      {tenants && tenants.map(t => (
        <div key={t.id} style={cardStyle}
          onClick={() => nav(basePath + '/' + t.id)}
          onMouseEnter={e => e.currentTarget.style.background='rgba(30,18,55,.78)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(20,12,40,.65)'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,#6b46c1,#a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'white', fontWeight: 700,
            }}>🎓</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {t.name}
                {t.id === 'tnt_default' && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600,
                    color: 'rgba(255,210,120,1)',
                    background: 'rgba(255,200,80,.15)',
                    border: '1px solid rgba(255,200,80,.35)',
                    borderRadius: 6, padding: '2px 7px',
                  }}>основная</span>
                )}
              </div>
              <div style={{ color: 'rgba(225,220,245,.7)', fontSize: 12, marginTop: 3,
                fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }}>
                {t.id} · token …{t.awo_webhook_token.slice(-6)} · с {fmtDate(t.created_at)}
              </div>
            </div>
            {t.id !== 'tnt_default' && (
              <button onClick={e => { e.stopPropagation(); remove(t); }}
                title="Удалить"
                style={{
                  background:'rgba(200,60,60,.2)', border:'1px solid rgba(255,120,120,.45)',
                  color:'rgba(255,180,180,1)',
                  borderRadius:8, padding:'5px 10px', fontSize:14, cursor:'pointer',
                  fontFamily:'inherit', lineHeight:1,
                }}>✕</button>
            )}
          </div>
        </div>
      ))}
      {confirmModal}
      {showGuide && <AwoGuide onClose={() => setShowGuide(false)}/>}
    </div>
  );
}
