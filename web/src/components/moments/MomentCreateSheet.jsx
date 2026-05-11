// MomentCreateSheet.jsx — шторка создания / редактирования Момента
import { useState, useRef, useEffect } from 'react';
import { api } from '../../api';

export default function MomentCreateSheet({ existing, onClose, onSaved, onConflict }) {
  const isEdit = !!existing;
  const [text,      setText]      = useState(existing?.text || '');
  const [isSearch,  setIsSearch]  = useState(existing?.is_search || false);
  const [mediaPreview, setMediaPreview] = useState(existing?.media_url || null);
  const [mediaType, setMediaType] = useState(existing?.media_type || null);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const fileRef = useRef();
  const textRef = useRef();

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80); }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = async ev => {
      const data = ev.target.result;
      try {
        const res = await api.uploadMomentMedia(data);
        setMediaPreview(res.url);
        setMediaType(res.mediaType);
      } catch(err) {
        setError(err.message || 'Ошибка загрузки файла');
      }
    };
    reader.readAsDataURL(file);
  }

  function removeMedia() {
    setMediaPreview(null);
    setMediaType(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    if (!text.trim()) { setError('Напишите что-нибудь'); return; }
    setSaving(true);
    setError('');
    const payload = { text: text.trim(), mediaUrl: mediaPreview, mediaType, isSearch };
    try {
      if (isEdit) {
        const result = await api.updateMoment(existing.id, payload);
        onSaved(result);
        onClose();
      } else {
        // Use raw fetch to catch 409 conflict
        const token = localStorage.getItem('hey_token');
        const res = await fetch('/api/moments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          setSaving(false);
          if (onConflict) {
            onConflict(payload, data.existing);
          }
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const result = await res.json();
        onSaved(result);
        onClose();
      }
    } catch(err) {
      setError(err.message || 'Ошибка сохранения');
    }
    setSaving(false);
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:600,
    background:'rgba(0,0,0,.6)',backdropFilter:'blur(10px)',
    display:'flex',alignItems:'center',justifyContent:'center',
    padding:'20px',
  };
  const sheet = {
    background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(100%,520px)',
    maxHeight:'90vh',display:'flex',flexDirection:'column',
    boxShadow:'0 8px 48px rgba(0,0,0,.6)',
    border:'1px solid rgba(255,255,255,.1)',
    overflow:'hidden',
  };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={sheet}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',padding:'12px 20px 14px',
          borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <span style={{color:'white',fontSize:17,fontWeight:700,flex:1}}>
            {isEdit ? '✎ Редактировать момент' : '✦ Новый момент'}
          </span>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'18px 20px',display:'flex',flexDirection:'column',gap:18}}>
          {/* Media zone */}
          <div>
            {mediaPreview ? (
              <div style={{position:'relative',borderRadius:16,overflow:'hidden',
                background:'#0a0518',maxHeight:200}}>
                {mediaType==='image' && <img src={mediaPreview} alt="" style={{width:'100%',maxHeight:200,objectFit:'cover'}}/>}
                {mediaType==='video' && <video src={mediaPreview} controls style={{width:'100%',maxHeight:200}}/>}
                {mediaType==='audio' && (
                  <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:8,
                    background:'linear-gradient(135deg,#1a0a38,#2a1858)'}}>
                    <div style={{fontSize:24,textAlign:'center'}}>🎵</div>
                    <audio src={mediaPreview} controls style={{width:'100%'}}/>
                  </div>
                )}
                <button onClick={removeMedia} style={{
                  position:'absolute',top:8,right:8,background:'rgba(0,0,0,.55)',
                  backdropFilter:'blur(6px)',border:'none',borderRadius:'50%',
                  width:30,height:30,color:'white',fontSize:16,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                style={{
                  width:'100%',padding:'20px',borderRadius:16,cursor:'pointer',
                  border:'2px dashed rgba(255,255,255,.18)',background:'rgba(255,255,255,.04)',
                  color:'rgba(255,255,255,.45)',fontSize:14,display:'flex',
                  flexDirection:'column',alignItems:'center',gap:8,transition:'all .15s'
                }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(180,140,220,.5)'; e.currentTarget.style.background='rgba(100,78,148,.08)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,.18)'; e.currentTarget.style.background='rgba(255,255,255,.04)'; }}>
                <span style={{fontSize:28}}>📎</span>
                <span>Добавить фото, видео или аудио</span>
                <span style={{fontSize:12,opacity:.6}}>JPG/PNG/WebP до 5 МБ · MP4 до 20 МБ · MP3 до 10 МБ</span>
              </button>
            )}
            <input ref={fileRef} type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/mp3,audio/ogg"
              onChange={handleFile} style={{display:'none'}}/>
          </div>

          {/* Text */}
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Расскажи как другу — что у тебя сейчас."
            maxLength={2000}
            rows={5}
            style={{
              width:'100%',boxSizing:'border-box',
              background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.14)',
              borderRadius:14,padding:'13px 15px',color:'white',fontSize:15,
              fontFamily:'inherit',resize:'vertical',outline:'none',lineHeight:1.7,
              minHeight:120,transition:'border-color .15s',whiteSpace:'pre-wrap'
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.14)'}
          />
          <div style={{display:'flex',justifyContent:'space-between',
            color:'rgba(255,255,255,.3)',fontSize:11,marginTop:-12}}>
            <span/>
            <span>{text.length}/2000</span>
          </div>

          {/* Search toggle */}
          <div style={{
            display:'flex',alignItems:'center',gap:14,
            background:'rgba(255,255,255,.06)',borderRadius:14,padding:'14px 16px',cursor:'pointer'
          }} onClick={() => setIsSearch(v => !v)}>
            <div style={{
              width:42,height:24,borderRadius:12,transition:'background .2s',position:'relative',flexShrink:0,
              background: isSearch ? 'rgba(100,78,148,.9)' : 'rgba(255,255,255,.15)',
            }}>
              <div style={{
                position:'absolute',top:3,left: isSearch ? 21 : 3,
                width:18,height:18,borderRadius:'50%',background:'white',transition:'left .2s',
                boxShadow:'0 1px 4px rgba(0,0,0,.3)'
              }}/>
            </div>
            <div>
              <div style={{color:'white',fontSize:14,fontWeight:600}}>🤝 Это поиск</div>
              <div style={{color:'rgba(255,255,255,.4)',fontSize:12,marginTop:2}}>
                Отметь если ищешь людей, идеи или возможности
              </div>
            </div>
          </div>

          {error && (
            <div style={{color:'rgba(255,140,140,.85)',fontSize:13,
              background:'rgba(200,50,50,.12)',borderRadius:10,padding:'10px 14px'}}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 20px 20px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
          <button onClick={save} disabled={saving || !text.trim()}
            style={{
              width:'100%',padding:'14px',borderRadius:50,fontSize:15,fontWeight:700,
              cursor: saving || !text.trim() ? 'not-allowed' : 'pointer',
              background: !text.trim() ? 'rgba(255,255,255,.08)' : 'rgba(120,90,200,.85)',
              border:'none',color: !text.trim() ? 'rgba(255,255,255,.3)' : 'white',
              transition:'all .2s',boxShadow: text.trim() ? '0 4px 20px rgba(120,80,200,.35)' : 'none'
            }}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}
