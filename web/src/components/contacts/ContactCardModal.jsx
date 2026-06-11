import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { BioWithLinks } from '../shared/profileUi';
import Icon from '../Icon';
import MomentCard from '../moments/MomentCard';

function RemoveContactButton({ onClick }) {
  const [hover, setHover] = useState(false);
  const bg     = hover ? 'rgba(220,80,80,.35)'   : 'rgba(60,160,90,.32)';
  const border = hover ? 'rgba(240,140,140,.55)' : 'rgba(100,200,120,.45)';
  const color  = hover ? 'rgba(255,210,210,.98)' : 'rgba(170,240,190,.95)';
  const layer = {
    position:'absolute', inset:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:8, transition:'opacity .15s', pointerEvents:'none', lineHeight:1.2,
  };
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Нажми, чтобы убрать из контактов"
      style={{
        flex:1, padding:'12px 10px', borderRadius:14,
        background:bg, border:`1px solid ${border}`, color,
        fontSize:14, fontWeight:600, cursor:'pointer',
        transition:'background .15s, border-color .15s, color .15s',
        position:'relative', minHeight:46,
      }}>
      <span style={{ ...layer, opacity: hover ? 0 : 1 }}>
        <Icon name="check" size={16}/><span>В контактах</span>
      </span>
      <span style={{ ...layer, opacity: hover ? 1 : 0 }}>
        <span>Убрать из контактов</span>
      </span>
    </button>
  );
}

function ContactCardModal({ contact, isBlocked, isContact, onClose, onChat,
  onAddContact, onRemoveContact, onBlock, onUnblock, onNotesChange, onOpenMoment }) {
  const [notes, setNotes]         = useState(contact.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const notesDirty = useRef(false);
  const [avatarFull, setAvatarFull] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(contact.nickname || '');
  const [nickSaving, setNickSaving] = useState(false);
  // Защита от двойного тапа по «Добавить в контакты»: при первом клике
  // блокируем кнопку до завершения колбэка. Раньше юзер видел двойной
  // тост — успешный от первого запроса и «Already in contacts»
  // от второго, отправленного до того как модалка успела перерисоваться.
  const [adding, setAdding] = useState(false);
  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    try { await onAddContact?.(); }
    finally { setAdding(false); }
  }
  // Свежие данные профиля (аватар / bio / headline / active_moments) —
  // подтягиваем при открытии чтобы карточка не показывала устаревшие данные.
  const [fresh, setFresh] = useState(null);
  // is_contact с сервера — если проп isContact не передан, берём из fresh
  const saveTimer = useRef();

  useEffect(() => {
    setFresh(null);
    setNotes(contact.notes || '');
    setNickDraft(contact.nickname || '');
    setEditingNick(false);
    notesDirty.current = false;
  }, [contact?.id]);

  useEffect(() => {
    let alive = true;
    if (!contact?.id) return;
    api.getUserProfile(contact.id)
      .then(p => { if (alive) setFresh(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, [contact?.id]);

  // Объединяем: свежие данные имеют приоритет над contacts-кешем
  const merged = { ...contact, ...(fresh || {}) };
  merged.nickname = contact.nickname ?? fresh?.nickname ?? null;
  merged.notes    = contact.notes ?? fresh?.notes ?? null;

  useEffect(() => {
    if (!fresh || notesDirty.current) return;
    const resolved = contact.notes ?? fresh.notes ?? '';
    setNotes(resolved);
  }, [fresh, contact.notes]);
  // Определяем isContact: явный проп > свежий is_contact с сервера
  const resolvedIsContact = isContact !== undefined ? isContact : !!fresh?.is_contact;

  // Determine if avatar is a real image (not emoji/letter)
  const av = merged.avatar;
  const avatarIsImg = av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));

  function handleNotesChange(val) {
    notesDirty.current = true;
    setNotes(val);
    setNotesSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await api.updateContactNotes(contact.id, val).catch(console.error);
      onNotesChange?.(contact.id, val);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 1500);
    }, 700);
  }

  return (
    // z-index выше MomentDetailPopup (z:700) и ReactorsModal (z:10000) —
    // карточка контакта открывается из списка реакторов момента и должна
    // быть ПОВЕРХ всего стэка. Раньше z:500 ставил её под попапом момента.
    <div style={{position:'fixed',inset:0,zIndex:10500,background:'rgba(0,0,0,.55)',
      backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(92vw,380px)',
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(249,240,240,.13)',
        display:'flex',flexDirection:'column',overflow:'hidden'
      }}>
        {/* Avatar header */}
        <div style={{position:'relative',
          background:'linear-gradient(160deg,rgba(92,79,148,.8),rgba(140,90,160,.6))',
          padding:'32px 24px 24px',display:'flex',flexDirection:'column',alignItems:'center',gap:14
        }}>
          <div
            onClick={() => avatarIsImg && setAvatarFull(true)}
            style={{cursor: avatarIsImg ? 'zoom-in' : 'default', position:'relative'}}
            onMouseEnter={e => { if (avatarIsImg) e.currentTarget.querySelector('.av-zoom').style.opacity='1'; }}
            onMouseLeave={e => { if (avatarIsImg) e.currentTarget.querySelector('.av-zoom').style.opacity='0'; }}>
            <AvatarDisplay avatar={merged.avatar} name={merged.nickname||merged.name}
              size={96} fontSize={42}
              style={{boxShadow:'0 8px 24px rgba(0,0,0,.3)',border:'3px solid rgba(249,240,240,.25)'}}/>
            <div className="av-zoom" style={{
              position:'absolute',inset:0,borderRadius:'50%',opacity:0,transition:'opacity .2s',
              background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',
              pointerEvents:'none',color:'#F9F0F0',
            }}><Icon name="search" size={22}/></div>
          </div>
          <div style={{textAlign:'center', width:'100%'}}>
            {!editingNick ? (
              <div style={{color:'#F9F0F0',fontSize:20,fontWeight:700,display:'inline-flex',alignItems:'center',gap:6}}>
                {merged.nickname || merged.name}
                {isContact && !merged.is_system && !merged.is_deleted && (
                  <button onClick={() => { setNickDraft(merged.nickname || ''); setEditingNick(true); }}
                    title="Изменить прозвище"
                    style={{background:'none',border:'none',color:'rgba(249,240,240,.45)',
                      cursor:'pointer',padding:'2px 6px',fontSize:14,lineHeight:1,fontFamily:'inherit'}}>
                    ✎
                  </button>
                )}
              </div>
            ) : (
              <div style={{display:'flex',gap:6,justifyContent:'center',alignItems:'center'}}>
                <input value={nickDraft} onChange={e => setNickDraft(e.target.value)}
                  autoFocus placeholder={merged.name} maxLength={60}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { setEditingNick(false); }
                    if (e.key === 'Enter') {
                      setNickSaving(true);
                      try {
                        await api.updateContactNickname(contact.id, nickDraft.trim() || null);
                        merged.nickname = nickDraft.trim() || null;
                        contact.nickname = merged.nickname;
                      } catch {}
                      setNickSaving(false); setEditingNick(false);
                    }
                  }}
                  style={{background:'rgba(249,240,240,.1)',border:'1px solid rgba(249,240,240,.2)',
                    borderRadius:8,padding:'6px 10px',color:'#F9F0F0',fontSize:15,
                    fontFamily:'inherit',outline:'none',textAlign:'center',width:'70%'}}/>
                <button disabled={nickSaving} onClick={async () => {
                    setNickSaving(true);
                    try {
                      await api.updateContactNickname(contact.id, nickDraft.trim() || null);
                      merged.nickname = nickDraft.trim() || null;
                      contact.nickname = merged.nickname;
                    } catch {}
                    setNickSaving(false); setEditingNick(false);
                  }}
                  style={{background:'rgba(95, 64, 128,.7)',border:'none',color:'#F9F0F0',
                    borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                  ✓
                </button>
                <button onClick={() => setEditingNick(false)}
                  style={{background:'rgba(249,240,240,.08)',border:'none',color:'rgba(249,240,240,.7)',
                    borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                  ✕
                </button>
              </div>
            )}
            {merged.nickname && !editingNick && (
              <div style={{color:'rgba(249,240,240,.55)',fontSize:14,marginTop:2}}>{merged.name}</div>
            )}
            {merged.headline && (
              <div style={{color:'rgba(249,240,240,.75)',fontSize:13,marginTop:6,
                fontStyle:'italic',lineHeight:1.4}}>
                {merged.headline}
              </div>
            )}
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13,marginTop:4}}>{merged.phone}</div>
            {merged.bio && (
              <div style={{
                marginTop:12, padding:'10px 14px',
                background:'rgba(249,240,240,.1)', borderRadius:12,
                border:'1px solid rgba(249,240,240,.12)',
                color:'rgba(249,240,240,.88)', fontSize:13, lineHeight:1.5,
                textAlign:'left', whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>
                <BioWithLinks text={merged.bio}/>
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{position:'absolute',top:16,right:16,background:'none',border:'none',
              color:'rgba(249,240,240,.5)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        {/* Body */}
        <div style={{padding:'18px 22px 20px',display:'flex',flexDirection:'column',gap:14}}>
          {/* Active moments thumbnails */}
          {Array.isArray(merged.active_moments) && merged.active_moments.length > 0 && (
            <div>
              <div style={{color:'rgba(249,240,240,.5)',fontSize:11,fontWeight:700,
                textTransform:'uppercase',letterSpacing:.6,marginBottom:8}}>
                ✦ Сейчас в моментах · {merged.active_moments.length}
              </div>
              {/* Полноценные превью моментов как в общей ленте. Раньше тут
                  была горизонтальная карусель 140px-плиток — на 3 моментах
                  она уезжала за край карточки и приходилось скроллить.
                  Теперь — grid с фиксированным числом колонок (до 3),
                  все моменты гарантированно помещаются по ширине. */}
              {/* Сетка фиксированной формы: ВСЕГДА 3 колонки, чтобы плитка
                  имела одинаковый размер независимо от того, сколько у
                  пользователя моментов (1 / 2 / 3). Один момент займёт
                  левую треть, остальные слоты — пустые. Так визуально
                  не «прыгает» размер карточек между разными собеседниками. */}
              <div style={{
                display:'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
              }}>
                {merged.active_moments.slice(0, 3).map(m => (
                  <MomentCard key={m.id}
                    moment={{ ...m,
                      author_name: merged.name,
                      author_avatar: merged.avatar,
                      author_is_super: merged.is_super,
                    }}
                    isMine={false}
                    bare
                    onClick={() => onOpenMoment?.(m)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:12,marginBottom:6,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Личные заметки</span>
              {notesSaved && <span style={{color:'rgba(120,220,120,.8)',fontSize:11}}>Сохранено ✓</span>}
            </div>
            <textarea value={notes} onChange={e=>handleNotesChange(e.target.value)}
              placeholder="Заметки видны только вам…"
              rows={2}
              style={{
                width:'100%',boxSizing:'border-box',
                background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.15)',
                borderRadius:12,padding:'10px 13px',color:'#F9F0F0',fontSize:14,
                fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.5,
                height:62,minHeight:62,maxHeight:62,overflowY:'auto',
                transition:'border-color .15s'
              }}
              onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.15)'}/>
          </div>

          {/* Если юзер удалил аккаунт — действий нет, показываем плашку */}
          {merged.is_deleted ? (
            <div style={{
              padding:'14px 16px',borderRadius:14,
              background:'rgba(180,180,180,.08)',
              border:'1px solid rgba(249,240,240,.1)',
              color:'rgba(225,220,245,.75)',fontSize:13,lineHeight:1.5,textAlign:'center',
            }}>
              Этот пользователь удалил аккаунт.<br/>
              Написать и добавить в контакты нельзя.
            </div>
          ) : (
            <>
              {/* Primary actions: Написать + В контактах/Добавить */}
              <div style={{display:'flex',gap:10}}>
                <button onClick={onChat}
                  style={{flex:1,padding:'12px 0',background:'rgba(95, 64, 128,.85)',
                    border:'1px solid rgba(180,140,220,.5)',borderRadius:14,
                    color:'#F9F0F0',fontSize:14,fontWeight:700,cursor:'pointer',
                    transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.95)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(95, 64, 128,.85)'}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="chat" size={16}/> Написать</span>
                </button>
                {resolvedIsContact ? (
                  <RemoveContactButton onClick={onRemoveContact}/>
                ) : (
                  <button onClick={handleAdd} disabled={adding}
                    style={{flex:1,padding:'12px 10px',
                      background: adding ? 'rgba(249,240,240,.04)' : 'rgba(249,240,240,.08)',
                      border:'1px solid rgba(249,240,240,.18)',borderRadius:14,
                      color:'#F9F0F0',fontSize:14,fontWeight:600,
                      cursor: adding ? 'wait' : 'pointer',
                      transition:'background .15s',
                      display:'flex',alignItems:'center',justifyContent:'center',gap:8,lineHeight:1.2,
                      opacity: adding ? .6 : 1}}
                    onMouseEnter={e=>{ if (!adding) e.currentTarget.style.background='rgba(249,240,240,.14)'; }}
                    onMouseLeave={e=>{ if (!adding) e.currentTarget.style.background='rgba(249,240,240,.08)'; }}>
                    <Icon name="user-plus" size={16}/>
                    <span style={{textAlign:'left'}}>{adding ? 'Добавляю…' : 'Добавить в контакты'}</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Secondary: Block (de-emphasized — icon-button) */}
          <div style={{display:'flex',justifyContent:'center',marginTop:-4}}>
            {merged.is_deleted ? null : isBlocked ? (
              <button onClick={onUnblock}
                style={{
                  background:'none',border:'none',cursor:'pointer',
                  color:'rgba(160,220,180,.75)',fontSize:12,fontWeight:500,
                  padding:'6px 10px',borderRadius:8,fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.color='rgba(180,240,200,1)'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(160,220,180,.75)'}>
                ✓ Разблокировать
              </button>
            ) : (
              <button onClick={onBlock}
                style={{
                  background:'none',border:'none',cursor:'pointer',
                  color:'rgba(249,240,240,.4)',fontSize:12,fontWeight:500,
                  padding:'6px 10px',borderRadius:8,fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.color='rgba(255,160,160,.85)'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(249,240,240,.4)'}>
                Заблокировать
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Avatar fullscreen lightbox */}
      {avatarFull && (
        <div
          onClick={() => setAvatarFull(false)}
          style={{
            position:'fixed',inset:0,zIndex:600,
            background:'rgba(0,0,0,.88)',backdropFilter:'blur(18px)',
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'
          }}>
          <img
            src={merged.avatar}
            alt={merged.name}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth:'min(92vw,900px)',maxHeight:'88vh',
              objectFit:'contain',borderRadius:12,
              boxShadow:'0 32px 80px rgba(0,0,0,.7)',
              userSelect:'none'
            }}/>
          <button
            onClick={() => setAvatarFull(false)}
            style={{
              position:'absolute',top:20,right:20,
              background:'rgba(249,240,240,.12)',border:'1px solid rgba(249,240,240,.2)',
              borderRadius:'50%',width:44,height:44,fontSize:22,cursor:'pointer',
              color:'#F9F0F0',display:'flex',alignItems:'center',justifyContent:'center',
              backdropFilter:'blur(8px)',transition:'background .15s'
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.22)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(249,240,240,.12)'}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export { ContactCardModal, RemoveContactButton };
