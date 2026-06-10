// AdminBusinessRequests.jsx — обработка заявок на бизнес-доступ
import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConfirm } from '../shared/Confirm';

const cardStyle = {
  background: 'rgba(20,12,40,.65)',
  border: '1px solid rgba(249,240,240,.12)',
  borderRadius: 14,
  padding: '16px 18px',
  marginBottom: 12,
  backdropFilter: 'blur(8px)',
};
const btn = {
  padding: '7px 14px', borderRadius: 10, border: 'none',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
  });
}

const TABS = [
  { v: 'pending',  l: 'Новые' },
  { v: 'approved', l: 'Одобренные' },
  { v: 'rejected', l: 'Отклонённые' },
];

export default function AdminBusinessRequests() {
  const [status, setStatus] = useState('pending');
  const [list,   setList]   = useState(null);
  const [error,  setError]  = useState('');
  const [toast,  setToast]  = useState('');
  const [customConfirm, confirmModal] = useConfirm();

  async function load() {
    try { setList(await api.adminListBusinessRequests(status)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [status]);

  function notify(m) { setToast(m); setTimeout(() => setToast(''), 2200); }

  async function approve(u) {
    if (!await customConfirm(
      `Одобрить заявку «${u.name}»? Откроется раздел «Мои школы».`,
      { confirmLabel: 'Одобрить' }
    )) return;
    try { await api.adminApproveBusiness(u.id); load(); notify('Одобрено'); }
    catch (e) { setError(e.message); }
  }
  async function reject(u) {
    const reason = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:6}}>Отклонить заявку «{u.name}»?</div>
        <div style={{color:'rgba(225,220,245,.7)',fontSize:13,lineHeight:1.5}}>
          Укажи причину — пользователь её увидит.
        </div>
      </>,
      { promptInput: true, promptPlaceholder: 'Например: укажи юр. лицо и контакт', danger: true, confirmLabel: 'Отклонить' }
    );
    if (reason === null) return;
    try { await api.adminRejectBusiness(u.id, reason); load(); notify('Отклонено'); }
    catch (e) { setError(e.message); }
  }
  async function revoke(u) {
    const reason = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:6}}>Отозвать бизнес-доступ у «{u.name}»?</div>
        <div style={{color:'rgba(225,220,245,.7)',fontSize:13,lineHeight:1.5}}>
          Юзер потеряет доступ к разделу «Мои школы». Школы и маппинги останутся,
          но управлять ими он больше не сможет.
        </div>
      </>,
      { promptInput: true, promptPlaceholder: 'Причина отзыва', danger: true, confirmLabel: 'Отозвать' }
    );
    if (reason === null) return;
    try { await api.adminRevokeBusiness(u.id, reason || 'отозван'); load(); notify('Отозвано'); }
    catch (e) { setError(e.message); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <h1 style={{ color:'#F9F0F0', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        💼 Бизнес-заявки
      </h1>
      <p style={{ color: 'rgba(225,220,245,.85)', fontSize: 14, marginBottom: 20, lineHeight: 1.55 }}>
        Заявки пользователей на доступ к разделу «Мои школы» (АВО-интеграции).
      </p>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.95)', background: 'rgba(200,50,50,.15)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {error}
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(60,170,110,.95)',
          color:'#F9F0F0', padding: '10px 16px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setStatus(t.v)}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: status === t.v ? 'rgba(140,110,220,.85)' : 'rgba(20,12,40,.5)',
              border: status === t.v ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(249,240,240,.12)',
              color: status === t.v ? '#F9F0F0' : 'rgba(225,220,245,.85)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {list === null && <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:30}}>Загрузка…</div>}
      {list && list.length === 0 && (
        <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Пусто.</div>
      )}
      {list && list.map(u => (
        <div key={u.id} style={cardStyle}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:'50%',
              background:'rgba(95, 64, 128,.4)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:18,color:'#F9F0F0',fontWeight:700,overflow:'hidden',flexShrink:0}}>
              {u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith('/') || u.avatar.startsWith('data:'))
                ? <img src={u.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : (u.name?.[0]?.toUpperCase() || '?')}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'#F9F0F0',fontSize:15,fontWeight:700}}>{u.name}</div>
              <div style={{color:'rgba(225,220,245,.7)',fontSize:12,marginTop:2}}>
                {u.phone} · {status === 'pending'
                  ? 'запросил ' + fmtDate(u.business_requested_at)
                  : (status === 'approved'
                      ? 'одобрен ' + fmtDate(u.business_approved_at)
                      : 'отклонён ' + fmtDate(u.business_approved_at))}
              </div>
            </div>
          </div>
          {u.business_request_note && (
            <div style={{padding:'10px 12px',borderRadius:10,
              background:'rgba(0,0,0,.25)',color:'rgba(240,235,255,.95)',
              fontSize:13,lineHeight:1.5,marginBottom:12,whiteSpace:'pre-wrap'}}>
              {u.business_request_note}
            </div>
          )}
          {u.business_reject_reason && status === 'rejected' && (
            <div style={{padding:'8px 12px',borderRadius:10,
              background:'rgba(200,50,50,.15)',color:'rgba(255,180,180,.95)',
              fontSize:12,lineHeight:1.4,marginBottom:12}}>
              Причина: {u.business_reject_reason}
            </div>
          )}

          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {status === 'pending' && (
              <>
                <button onClick={() => approve(u)} style={{
                  ...btn, background:'rgba(60,180,100,.25)', color:'rgba(140,240,180,.95)',
                }}>✓ Одобрить</button>
                <button onClick={() => reject(u)} style={{
                  ...btn, background:'rgba(249,240,240,.08)',
                  border:'1px solid rgba(249,240,240,.18)', color:'rgba(225,220,245,.9)',
                }}>Отклонить</button>
              </>
            )}
            {status === 'approved' && (
              <button onClick={() => revoke(u)} style={{
                ...btn, background:'rgba(200,60,60,.2)',
                border:'1px solid rgba(255,120,120,.45)', color:'rgba(255,180,180,1)',
              }}>Отозвать доступ</button>
            )}
            {status === 'rejected' && (
              <button onClick={() => approve(u)} style={{
                ...btn, background:'rgba(60,180,100,.25)', color:'rgba(140,240,180,.95)',
              }}>✓ Одобрить заново</button>
            )}
            <a href={`/admin/users/${u.id}`} style={{
              ...btn, background:'rgba(95, 64, 128,.18)',
              border:'1px solid rgba(180,140,220,.3)', color:'rgba(220,200,255,.95)',
              textDecoration:'none',
            }}>Профиль →</a>
          </div>
        </div>
      ))}

      {confirmModal}
    </div>
  );
}
