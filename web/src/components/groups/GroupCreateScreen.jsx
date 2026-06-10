import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadGroupIcon } from '../../lib/uploadMedia';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AvatarCropperModal } from '../shared/AvatarPicker';
import Icon from '../Icon';
import TopBar from '../shared/TopBar';
import { GROUP_ICONS } from './groupConstants';

export function GroupCreateScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [name,     setName]     = useState('');
  const [icon,     setIcon]     = useState('👥');
  const [avatarUrl,setAvatarUrl]= useState(null);   // если загружена кастомная — приоритет над emoji
  const [uploading,setUploading]= useState(false);
  const [iconCropFile, setIconCropFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef();

  useEffect(() => { api.getContacts().then(setContacts).catch(console.error); }, []);

  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleAvatar(e) {
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
    // Открываем тот же crop-modal что и у user-аватарки: поворот, зум.
    setIconCropFile(file);
  }

  async function uploadCroppedAvatar(croppedFile) {
    setUploading(true);
    try {
      const url = await uploadGroupIcon(croppedFile, { getPresignUrl: api.getPresignUrl });
      setAvatarUrl(url);
    } catch(err) {
      heyToast(err.message || 'Не удалось загрузить аватар', 'error');
    }
    setUploading(false);
  }

  function removeAvatar() {
    setAvatarUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function create() {
    if (!name.trim()) { heyToast('Введите название группы', 'error'); return; }
    // Участников можно не добавлять сразу — пустую группу создаст
    // только создатель, а позже пригласит других через настройки.
    setSaving(true);
    try {
      // приоритет: кастомный аватар → emoji
      const groupIcon = avatarUrl || icon;
      const { id } = await api.createGroup({ name: name.trim(), icon: groupIcon, memberIds: [...selected] });
      nav(`/chat/${id}`, { replace: true });
    } catch(e) { heyToast(e.message, 'error'); setSaving(false); }
  }

  // ── Фильтрация контактов по поиску ──────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredContacts = q
    ? contacts.filter(c =>
        (c.nickname || c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    : contacts;

  return (
    <div className="screen">
      <TopBar title="Новая группа" onBack={() => nav(-1)}/>
      {/* Всё содержимое в едином 680 контейнере */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',flex:1,minHeight:0}}>

        {/* Шапка: аватарка + название */}
        <div style={{padding:'20px 24px 16px',display:'flex',flexDirection:'column',gap:18,flexShrink:0}}>
          {/* Большая круглая аватарка по центру */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{position:'relative',width:88,height:88}}>
              <div style={{
                width:88,height:88,borderRadius:'50%',
                background: avatarUrl ? '#0a0518' : 'rgba(95, 64, 128,.35)',
                display:'flex',alignItems:'center',justifyContent:'center',
                overflow:'hidden',fontSize:40,
                border: '2px solid rgba(249,240,240,.12)',
              }}>
                {uploading
                  ? <div style={{fontSize:24,animation:'spin 1s linear infinite'}}>⏳</div>
                  : avatarUrl
                    ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : icon}
              </div>
              {/* Кнопка камеры */}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{
                  position:'absolute',bottom:0,right:0,width:30,height:30,borderRadius:'50%',
                  background:'rgba(95, 64, 128,.95)',border:'2px solid var(--grad-bg-end,#1a0e36)',
                  color:'#F9F0F0',fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,.4)',
                }}>
                {avatarUrl ? '✎' : '📷'}
              </button>
              {avatarUrl && !uploading && (
                <button onClick={removeAvatar}
                  style={{
                    position:'absolute',top:-2,right:-2,width:24,height:24,borderRadius:'50%',
                    background:'rgba(0,0,0,.7)',border:'none',color:'#F9F0F0',fontSize:12,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>✕</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatar} style={{display:'none'}}/>
            <div style={{color:'rgba(249,240,240,.4)',fontSize:11}}>
              {avatarUrl ? 'Своя аватарка' : 'Выбери эмодзи ниже или загрузи фото'}
            </div>
            {iconCropFile && (
              <AvatarCropperModal
                file={iconCropFile}
                onCancel={() => setIconCropFile(null)}
                onDone={async (_url, croppedFile) => {
                  setIconCropFile(null);
                  await uploadCroppedAvatar(croppedFile);
                }}
              />
            )}
          </div>

          {/* Emoji-иконки (когда нет своей аватарки) */}
          {!avatarUrl && (
            <div>
              <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:8}}>Иконка группы</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'flex-start'}}>
                {GROUP_ICONS.map(e => (
                  <button key={e} onClick={()=>setIcon(e)}
                    style={{width:44,height:44,fontSize:24,border:'none',cursor:'pointer',borderRadius:12,
                      background: icon===e ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.12)',
                      transition:'background .15s'}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Название */}
          <div>
            <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:8}}>Название группы</div>
            <input className="glass-input" value={name} onChange={e=>setName(e.target.value)}
              placeholder="Например: Команда, Семья…" style={{width:'100%',boxSizing:'border-box'}}/>
          </div>

          {/* Поиск по контактам */}
          <div>
            <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:8,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Участники ({selected.size} выбрано)</span>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())}
                  style={{background:'none',border:'none',color:'rgba(180,140,220,.8)',
                    fontSize:12,cursor:'pointer',padding:0}}>
                  Сбросить
                </button>
              )}
            </div>
            <input className="glass-input" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Поиск по контактам" style={{width:'100%',boxSizing:'border-box'}}/>
          </div>
        </div>

        {/* Список контактов */}
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {filteredContacts.length === 0 && (
            <div style={{padding:'40px 24px',color:'rgba(249,240,240,.4)',
              textAlign:'center',fontSize:14}}>
              {q ? 'Никого не найдено' : 'У вас пока нет контактов'}
            </div>
          )}
          {filteredContacts.map(c => (
            <div key={c.id} onClick={()=>toggle(c.id)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 24px',
                cursor:'pointer',transition:'background .12s',
                background: selected.has(c.id) ? 'rgba(95, 64, 128,.2)' : 'transparent'}}
              onMouseEnter={e=>{ if(!selected.has(c.id)) e.currentTarget.style.background='rgba(249,240,240,.05)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = selected.has(c.id)?'rgba(95, 64, 128,.2)':'transparent'; }}>
              <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name} size={40} fontSize={16}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'#F9F0F0',fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nickname||c.name}</div>
                <div style={{color:'rgba(249,240,240,.4)',fontSize:12}}>{c.phone}</div>
              </div>
              <div style={{width:24,height:24,borderRadius:'50%',border:'2px solid rgba(180,140,220,.6)',
                background: selected.has(c.id) ? 'rgba(95, 64, 128,.8)' : 'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',
                color:'#F9F0F0',fontSize:14,transition:'background .15s',flexShrink:0}}>
                {selected.has(c.id) && '✓'}
              </div>
            </div>
          ))}
        </div>

        {/* Кнопка создания — доступна даже без выбранных участников
            (создатель может пригласить позже из настроек группы). */}
        <div style={{padding:'12px 24px 24px',flexShrink:0,
          background:'linear-gradient(0deg,rgba(20,12,42,.95),rgba(20,12,42,0))'}}>
          <button className="pill" onClick={create} disabled={saving || !name.trim()}
            style={{width:'100%',opacity:(saving || !name.trim())?.7:1}}>
            {saving
              ? 'Создание…'
              : selected.size > 0
                ? `Создать группу (${selected.size + 1} участников)`
                : 'Создать пустую группу'}
          </button>
        </div>
      </div>
    </div>
  );
}
