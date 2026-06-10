import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import Icon from '../Icon';
import { AvatarDisplay } from '../shared/AvatarDisplay';

function ForwardModal({ messageId, onClose, onDone }) {
  const [convs, setConvs] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getConversations().then(setConvs).catch(e => setError(e.message));
  }, []);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await api.forwardMessage(messageId, Array.from(selected));
      onDone?.(selected.size);
      onClose();
    } catch (e) {
      setError(e.message || 'Не удалось переслать');
    }
    setSending(false);
  }

  const q = search.trim().toLowerCase();
  const filtered = (convs || [])
    .filter(c => !c.is_request)
    .filter(c => !c.partner_is_system && !c.partner_is_blocked && !c.partner_is_deleted)
    .filter(c => !q || (c.name || '').toLowerCase().includes(q));

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
        backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{
        width:'min(94vw,440px)',maxHeight:'80vh',background:'rgba(38,28,68,.97)',
        backdropFilter:'blur(24px)',borderRadius:18,
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(249,240,240,.12)',
        display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'18px 20px 12px',display:'flex',alignItems:'center',gap:10,
          borderBottom:'1px solid rgba(249,240,240,.08)'}}>
          <span style={{display:'inline-flex',color:'rgba(249,240,240,.85)'}}><Icon name="forward" size={20} /></span>
          <div style={{flex:1,color:'#F9F0F0',fontSize:16,fontWeight:700}}>Переслать в чат</div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(249,240,240,.5)',
              fontSize:22,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
        </div>

        <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(249,240,240,.06)'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} autoFocus
            placeholder="🔍 Поиск по чатам…"
            style={{width:'100%',boxSizing:'border-box',
              background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.12)',
              borderRadius:10,padding:'9px 13px',color:'#F9F0F0',fontSize:14,
              fontFamily:'inherit',outline:'none'}}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
            onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.12)'}/>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
          {convs === null && (
            <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',padding:30,fontSize:14}}>
              Загрузка…
            </div>
          )}
          {convs !== null && filtered.length === 0 && (
            <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',padding:30,fontSize:14}}>
              {q ? 'Никого не найдено' : 'Чатов нет'}
            </div>
          )}
          {filtered.map(c => {
            const isSel = selected.has(c.id);
            // Иконка: для группы — выбранный эмодзи/фото или дефолтный
            // <Icon users>; для монолога — <Icon edit>.
            const groupIcon = c.icon || null;
            const iconIsImg = typeof groupIcon === 'string' &&
              (groupIcon.startsWith('http') || groupIcon.startsWith('/') || groupIcon.startsWith('data:'));
            return (
              <div key={c.id} onClick={() => toggle(c.id)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',cursor:'pointer',
                  background: isSel ? 'rgba(95, 64, 128,.18)' : 'transparent',
                  transition:'background .12s'}}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='rgba(249,240,240,.05)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                <div style={{width:38,height:38,borderRadius: c.type==='group' ? 12 : '50%',
                  overflow:'hidden',flexShrink:0,color:'#F9F0F0',
                  background: iconIsImg ? '#0a0518' : 'rgba(95, 64, 128,.4)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                  {c.type === 'direct'
                    ? <AvatarDisplay avatar={c.avatar} name={c.name} size={38}/>
                    : c.type === 'monolog'
                      ? <Icon name="edit" size={18}/>
                      : iconIsImg
                        ? <img src={groupIcon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : (groupIcon || <Icon name="users" size={18}/>)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:'#F9F0F0',fontSize:14,fontWeight:600,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {c.name}
                  </div>
                  <div style={{color:'rgba(249,240,240,.4)',fontSize:11}}>
                    {c.type === 'group' ? 'группа' : c.type === 'monolog' ? 'монолог' : 'личный'}
                  </div>
                </div>
                <div style={{width:22,height:22,borderRadius:'50%',
                  border: isSel ? '2px solid rgba(180,140,220,.95)' : '2px solid rgba(249,240,240,.25)',
                  background: isSel ? 'rgba(180,140,220,.95)' : 'transparent',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  flexShrink:0,transition:'all .15s',
                  color:'#F9F0F0',fontSize:13,fontWeight:700}}>
                  {isSel ? '✓' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{padding:'8px 18px',color:'rgba(255,140,140,.95)',fontSize:13}}>
            {error}
          </div>
        )}

        <div style={{padding:'14px 18px',display:'flex',gap:10,
          borderTop:'1px solid rgba(249,240,240,.08)'}}>
          <button onClick={onClose}
            style={{flex:1,padding:'11px 0',background:'rgba(249,240,240,.08)',
              border:'1px solid rgba(249,240,240,.12)',borderRadius:12,color:'rgba(249,240,240,.85)',
              fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            Отмена
          </button>
          <button onClick={send} disabled={sending || selected.size === 0}
            style={{flex:1.4,padding:'11px 0',
              background: selected.size === 0 ? 'rgba(249,240,240,.07)' : 'rgba(95, 64, 128,.85)',
              border:'none',borderRadius:12,
              color: selected.size === 0 ? 'rgba(249,240,240,.3)' : '#F9F0F0',
              fontSize:14,fontWeight:700,cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              fontFamily:'inherit',transition:'background .15s'}}>
            {sending ? 'Отправка…' : selected.size === 0
              ? 'Выбери чат'
              : `Переслать в ${selected.size}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
export default ForwardModal;
