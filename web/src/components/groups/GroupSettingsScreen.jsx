import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadGroupIcon } from '../../lib/uploadMedia';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AvatarCropperModal } from '../shared/AvatarPicker';
import { openUserCard } from '../../lib/openUserCard';
import Icon from '../Icon';
import TopBar from '../shared/TopBar';
import { GROUP_ICONS } from './groupConstants';

export function GroupSettingsScreen() {
  const nav = useNavigate();
  const { convId } = useParams();
  const { user } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();
  const [info,    setInfo]    = useState({ name:'', icon:'👥', admin_id: null, history_visibility: 'all' });
  const [members, setMembers] = useState([]);
  const [contacts,setContacts]= useState([]);
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState('');
  const [icon,    setIcon]    = useState('👥');           // emoji или URL
  const [uploading, setUploading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');    // поиск по контактам для добавления
  const avatarInputRef = useRef();
  // Загрузка иконки группы через тот же crop-modal, что и у user-аватарки:
  // поворот, зум, центровка. Раньше группа просто резалась и грузилась
  // как есть — пользователь жаловался на отсутствие контролей.
  const [iconCropFile, setIconCropFile] = useState(null);

  // Любой админ — создатель ИЛИ участник с is_admin=1
  const myMember = members.find(m => m.id === user?.id);
  const isAdmin = info.admin_id === user?.id || !!myMember?.is_admin;

  // Esc — назад в чат группы. Если режим редактирования инфо — сначала
  // выходим из него, чтобы не терять навигацию случайным нажатием.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (editing) { setEditing(false); setName(info.name || ''); setIcon(info.icon || '👥'); return; }
      nav('/chat/' + convId);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, info.name, info.icon, convId, nav]);
  const isUrl = (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('/'));

  useEffect(() => {
    api.getGroupInfo(convId).then(c => {
      if (c) { setInfo(c); setName(c.name || ''); setIcon(c.icon || '👥'); }
    }).catch(console.error);
    api.getGroupMembers(convId).then(setMembers);
    api.getContacts().then(setContacts);
  }, [convId]);

  async function toggleMemberAdmin(m) {
    const setTo = !m.is_admin;
    if (!await customConfirm(
      setTo
        ? `Назначить «${m.name}» админом группы? Сможет добавлять/удалять участников и менять настройки.`
        : `Снять админа с «${m.name}»?`
    )) return;
    try {
      await api.setGroupMemberAdmin(convId, m.id, setTo);
      const fresh = await api.getGroupMembers(convId);
      setMembers(fresh);
      heyToast(setTo ? 'Назначен админом' : 'Админ снят', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
  }

  async function changeHistoryVisibility(value) {
    try {
      await api.setGroupHistoryVisibility(convId, value);
      setInfo(prev => ({ ...prev, history_visibility: value }));
      heyToast(value === 'all'
        ? 'Новые участники увидят всю историю'
        : 'Новые участники увидят только сообщения после вступления',
        'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
  }

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      heyToast('Только изображение', 'warning');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      heyToast('Картинка больше 10 МБ', 'warning');
      return;
    }
    // Не грузим сразу — открываем crop-окно. Финальная заливка идёт в
    // onDone после того как пользователь повернул/обрезал.
    setIconCropFile(file);
  }

  async function uploadCroppedIcon(croppedFile) {
    setUploading(true);
    try {
      const url = await uploadGroupIcon(croppedFile, { getPresignUrl: api.getPresignUrl });
      setIcon(url);
    } catch (err) {
      heyToast('Не удалось загрузить: ' + (err.message || 'ошибка'), 'error');
    }
    setUploading(false);
  }

  async function saveInfo() {
    await api.updateGroup(convId, { name, icon });
    setInfo(p => ({ ...p, name, icon }));
    setEditing(false);
  }

  async function addMember(userId) {
    try {
      const r = await api.addGroupMember(convId, userId);
      api.getGroupMembers(convId).then(setMembers);
      if (r?.alreadyMember && r.status === 'pending') {
        heyToast('Приглашение уже отправлено — ждём ответа', 'info');
      } else if (r?.alreadyMember) {
        heyToast('Уже в группе', 'info');
      } else {
        heyToast('Приглашение отправлено — ждём подтверждения', 'success');
      }
    } catch (e) {
      heyToast('Не удалось пригласить: ' + (e.message || ''), 'error');
    }
  }

  async function removeMember(userId) {
    if (!await customConfirm('Удалить участника из группы?', { danger: true, requireWord: 'удалить' })) return;
    await api.removeGroupMember(convId, userId);
    setMembers(prev => prev.filter(m => m.id !== userId));
  }

  async function leaveGroup() {
    if (!await customConfirm('Покинуть группу? Вы потеряете доступ к переписке.')) return;
    await api.removeGroupMember(convId, user.id);
    nav('/chats', { replace: true });
  }

  const nonMembers = contacts.filter(c =>
    !members.find(m => m.id === c.id) &&
    // HEY-заведующий и прочие системные аккаунты — не добавляем в группы.
    !c.is_system &&
    !(typeof c.id === 'string' && c.id.startsWith('system_'))
  );
  const memberSearchQ = memberSearch.trim().toLowerCase();
  const filteredNonMembers = memberSearchQ
    ? nonMembers.filter(c =>
        (c.name     || '').toLowerCase().includes(memberSearchQ) ||
        (c.nickname || '').toLowerCase().includes(memberSearchQ) ||
        (c.phone    || '').includes(memberSearch.trim())
      )
    : nonMembers;

  return (
    <div className="screen">
      <TopBar title="Настройки группы" onBack={() => nav(-1)} right={<span/>}/>
      <div style={{flex:1,overflowY:'auto',maxWidth:680,margin:'0 auto',width:'100%',padding:'20px 24px'}}>
        {/* Group header */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
          <div style={{width:64,height:64,borderRadius:20,overflow:'hidden',
            background: isUrl(info.icon) ? '#0a0518' : 'rgba(95, 64, 128,.5)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,flexShrink:0}}>
            {isUrl(info.icon)
              ? <img src={info.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (info.icon || '👥')}
          </div>
          <div>
            <div style={{color:'#F9F0F0',fontSize:19,fontWeight:600}}>{info.name}</div>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:13}}>{members.length} участников</div>
          </div>
          {isAdmin && <button onClick={()=>setEditing(true)}
            style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(249,240,240,.5)',cursor:'pointer',display:'inline-flex',alignItems:'center'}}><Icon name="pencil" size={18}/></button>}
        </div>

        {/* Edit form */}
        {editing && isAdmin && (
          <div style={{background:'rgba(249,240,240,.08)',borderRadius:16,padding:16,marginBottom:20,display:'flex',flexDirection:'column',gap:12}}>
            {/* Превью текущего аватара + загрузка */}
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:64,height:64,borderRadius:20,overflow:'hidden',position:'relative',
                background: isUrl(icon) ? '#0a0518' : 'rgba(95, 64, 128,.5)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,
                cursor: uploading ? 'wait' : 'pointer',flexShrink:0}}
                onClick={() => !uploading && avatarInputRef.current?.click()}>
                {isUrl(icon)
                  ? <img src={icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : icon}
                {uploading && (
                  <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.5)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#F9F0F0',fontSize:11}}>…</div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <button onClick={() => avatarInputRef.current?.click()} disabled={uploading}
                  style={{background:'rgba(95, 64, 128,.5)',border:'none',borderRadius:10,
                    padding:'8px 14px',color:'#F9F0F0',fontSize:13,cursor: uploading ? 'wait' : 'pointer'}}>
                  {uploading ? 'Загрузка…' : (isUrl(icon) ? '✎ Сменить фото' : '📷 Загрузить фото')}
                </button>
                {isUrl(icon) && !uploading && (
                  <button onClick={() => setIcon('👥')}
                    style={{marginLeft:8,background:'none',border:'1px solid rgba(249,240,240,.15)',
                      borderRadius:10,padding:'7px 12px',color:'rgba(249,240,240,.7)',
                      fontSize:13,cursor:'pointer'}}>
                    ✕ Убрать
                  </button>
                )}
                <div style={{color:'rgba(249,240,240,.4)',fontSize:11,marginTop:6}}>
                  Или выбери эмодзи ниже
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{display:'none'}} onChange={handleAvatarSelect}/>
              {iconCropFile && (
                <AvatarCropperModal
                  file={iconCropFile}
                  onCancel={() => setIconCropFile(null)}
                  onDone={async (_url, croppedFile) => {
                    setIconCropFile(null);
                    await uploadCroppedIcon(croppedFile);
                  }}
                />
              )}
            </div>

            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {GROUP_ICONS.map(e => (
                <button key={e} onClick={()=>setIcon(e)}
                  style={{width:38,height:38,fontSize:20,border:'none',cursor:'pointer',borderRadius:10,
                    background: icon===e ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.1)'}}>
                  {e}
                </button>
              ))}
            </div>
            <input className="glass-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Название"/>
            <div style={{display:'flex',gap:8}}>
              <button className="pill" onClick={saveInfo} disabled={uploading} style={{flex:1,padding:'10px 0'}}>Сохранить</button>
              <button onClick={()=>{ setEditing(false); setIcon(info.icon || '👥'); }}
                style={{flex:1,padding:'10px 0',background:'rgba(249,240,240,.1)',border:'none',
                  borderRadius:24,color:'#F9F0F0',cursor:'pointer'}}>Отмена</button>
            </div>
          </div>
        )}

        {/* Visibility toggle — только для создателя.
            Раньше блок жил в самом низу под списком участников; перенесли
            наверх по просьбе пользователя — это критичная настройка
            приватности, она должна быть сразу видна. */}
        {info.admin_id === user?.id && (
          <div style={{marginBottom:18,padding:'14px 16px',borderRadius:14,
            background:'rgba(249,240,240,.05)',border:'1px solid rgba(249,240,240,.1)'}}>
            <div style={{color:'rgba(225,220,245,.85)',fontSize:12,fontWeight:700,
              textTransform:'uppercase',letterSpacing:.6,marginBottom:8,
              display:'flex',alignItems:'center',gap:6}}>
              <Icon name="eye" size={14}/> Что видят новые участники
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                { v:'all', t:'Всю историю чата', d:'По умолчанию. Видят сообщения, которые были до их вступления.' },
                { v:'since_joined', t:'Только с момента вступления', d:'Прошлые сообщения скрыты — закрытое сообщество.' },
              ].map(o => (
                <label key={o.v} style={{display:'flex',alignItems:'flex-start',gap:10,
                  padding:'10px 12px',borderRadius:10,cursor:'pointer',
                  background: info.history_visibility === o.v ? 'rgba(95, 64, 128,.18)' : 'rgba(249,240,240,.04)',
                  border:'1px solid ' + (info.history_visibility === o.v ? 'rgba(180,140,220,.4)' : 'rgba(249,240,240,.08)'),
                  transition:'all .12s',
                }}>
                  <input type="radio" name="hist-vis"
                    checked={info.history_visibility === o.v}
                    onChange={() => changeHistoryVisibility(o.v)}
                    style={{marginTop:3,accentColor:'rgb(180,140,255)'}}/>
                  <div style={{flex:1}}>
                    <div style={{color:'#F9F0F0',fontSize:13,fontWeight:600}}>{o.t}</div>
                    <div style={{color:'rgba(225,220,245,.65)',fontSize:11,marginTop:2,lineHeight:1.45}}>
                      {o.d}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div style={{color:'rgba(249,240,240,.5)',fontSize:13,marginBottom:10}}>Участники</div>
        {members.map(m => {
          const avatarIsImg = m.avatar && (m.avatar.startsWith('http') || m.avatar.startsWith('/') || m.avatar.startsWith('data:'));
          const isCreator = m.id === info.admin_id;
          const isMemberAdmin = isCreator || !!m.is_admin;
          return (
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
            borderBottom:'1px solid rgba(249,240,240,.07)'}}>
            <div
              onClick={() => m.id !== user?.id && openUserCard(m.id)}
              style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',
                background:'rgba(200,160,210,.45)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:18,color:'#F9F0F0',flexShrink:0,
                cursor: m.id !== user?.id ? 'pointer' : 'default',
                transition:'transform .12s'}}
              onMouseEnter={e => { if (m.id !== user?.id) e.currentTarget.style.transform='scale(1.05)'; }}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              {avatarIsImg
                ? <img src={m.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : (m.name?.[0] || '?').toUpperCase()}
            </div>
            <div
              onClick={() => m.id !== user?.id && openUserCard(m.id)}
              style={{flex:1,minWidth:0, cursor: m.id !== user?.id ? 'pointer' : 'default'}}>
              <div style={{color:'#F9F0F0',fontSize:14,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                {m.name}
                {isCreator && (
                  <span style={{fontSize:10,fontWeight:700,color:'rgba(255,210,120,1)',
                    background:'rgba(255,200,80,.15)',border:'1px solid rgba(255,200,80,.35)',
                    borderRadius:6,padding:'2px 7px'}}>создатель</span>
                )}
                {!isCreator && m.is_admin && (
                  <span style={{fontSize:10,fontWeight:700,color:'rgba(200,170,255,1)',
                    background:'rgba(140,110,220,.18)',border:'1px solid rgba(180,140,220,.4)',
                    borderRadius:6,padding:'2px 7px'}}>админ</span>
                )}
                {m.status === 'pending' && (
                  <span style={{fontSize:11,color:'rgba(255,200,120,.85)',
                    background:'rgba(255,200,120,.12)',borderRadius:6,padding:'2px 7px',fontWeight:600}}>
                    🕓 ждёт подтверждения
                  </span>
                )}
              </div>
            </div>
            {/* Promote/demote: только создатель может менять админство (и не себе) */}
            {info.admin_id === user?.id && m.id !== user.id && !isCreator && m.status === 'active' && (
              <button onClick={() => toggleMemberAdmin(m)}
                title={m.is_admin ? 'Снять админа' : 'Назначить админом'}
                style={{
                  background: m.is_admin ? 'rgba(255,200,80,.18)' : 'rgba(95, 64, 128,.18)',
                  border: '1px solid ' + (m.is_admin ? 'rgba(255,200,80,.4)' : 'rgba(180,140,220,.4)'),
                  color: m.is_admin ? 'rgba(255,210,120,1)' : 'rgba(200,170,255,1)',
                  borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {m.is_admin ? 'Снять админа' : '+ Админ'}
              </button>
            )}
            {isAdmin && m.id !== user.id && !isCreator && (
              <button onClick={()=>removeMember(m.id)}
                title={m.status === 'pending' ? 'Отозвать приглашение' : 'Удалить участника'}
                style={{
                  background:'rgba(200,60,60,.2)',border:'1px solid rgba(255,120,120,.45)',
                  color:'rgba(255,180,180,1)',
                  borderRadius:8,padding:'5px 10px',fontSize:14,cursor:'pointer',lineHeight:1,
                  fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(220,80,80,.3)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(200,60,60,.2)'}>✕</button>
            )}
          </div>
          );
        })}

        {/* Add members (admin only) */}
        {isAdmin && nonMembers.length > 0 && (
          <>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:13,margin:'16px 0 10px'}}>
              Добавить участников ({nonMembers.length})
            </div>
            {/* Поиск по контактам */}
            {nonMembers.length > 5 && (
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder="🔍 Поиск по имени или телефону…"
                style={{
                  width:'100%',boxSizing:'border-box',marginBottom:10,
                  background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.14)',
                  borderRadius:10,padding:'9px 14px',color:'#F9F0F0',fontSize:14,
                  fontFamily:'inherit',outline:'none',
                }}
                onFocus={e => e.target.style.borderColor='rgba(180,140,220,.6)'}
                onBlur={e => e.target.style.borderColor='rgba(249,240,240,.14)'}/>
            )}
            {filteredNonMembers.length === 0 && memberSearchQ && (
              <div style={{color:'rgba(249,240,240,.35)',fontSize:13,padding:'12px 0'}}>
                Никого не найдено по «{memberSearch}»
              </div>
            )}
            {filteredNonMembers.map(c => {
              const avatarIsImg = c.avatar && (c.avatar.startsWith('http') || c.avatar.startsWith('/') || c.avatar.startsWith('data:'));
              return (
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                  borderBottom:'1px solid rgba(249,240,240,.07)'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',
                    background:'rgba(200,160,210,.3)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#F9F0F0',flexShrink:0}}>
                    {avatarIsImg
                      ? <img src={c.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : (c.nickname||c.name)[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:'rgba(249,240,240,.85)',fontSize:14,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {c.nickname||c.name}
                    </div>
                    {c.phone && (
                      <div style={{color:'rgba(249,240,240,.4)',fontSize:11}}>{c.phone}</div>
                    )}
                  </div>
                  <button onClick={()=>addMember(c.id)}
                    style={{background:'rgba(95, 64, 128,.5)',border:'none',borderRadius:10,
                      padding:'6px 14px',color:'#F9F0F0',fontSize:13,cursor:'pointer'}}>+</button>
                </div>
              );
            })}
          </>
        )}

        {/* Leave — деструктивное действие. Полупрозрачные красные кнопки на
            фиолетовом фоне читались как «выключено»; делаем явный red-solid
            пузырь, чтобы было ясно что кнопка активна и опасна. */}
        <button onClick={leaveGroup}
          style={{marginTop:32,width:'100%',padding:'14px 0',
            background:'rgba(220,60,60,.85)',
            border:'1px solid rgba(255,120,120,.6)',
            borderRadius:16,color:'#F9F0F0',
            fontSize:15,fontWeight:700,cursor:'pointer',
            boxShadow:'0 4px 14px rgba(140,30,30,.35)',
            transition:'background .15s, transform .12s'}}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(235,80,80,.95)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(220,60,60,.85)'; }}>
          Покинуть группу
        </button>
      </div>
      {confirmModal}
    </div>
  );
}
