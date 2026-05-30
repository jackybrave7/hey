// MomentCreateSheet.jsx — шторка создания / редактирования Момента
import { useState, useRef, useEffect } from 'react';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadMedia, previewUrl } from '../../lib/uploadMedia';
import MoodEmoji from './MoodEmoji';
import { HEY_EMOJI, emojiLabel, emojiUrl } from '../../lib/heyEmoji';

// Набор настроений для ручного выбора (когда нет медиа)
const MOOD_OPTIONS = [
  { type: 'calm',       label: 'Спокойно' },
  { type: 'excited',    label: 'Радость'  },
  { type: 'dreamy',     label: 'Мечты'    },
  { type: 'starstruck', label: 'Поиск'    },
  { type: 'sleepy',     label: 'Усталость'},
];

const YT_RE        = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_RE     = /vimeo\.com\/(?:video\/)?(\d+)/;
const RUTUBE_RE    = /rutube\.ru\/video\/([a-f0-9]{32})/i;
const KINESCOPE_RE = /kinescope\.io\/(?:embed\/)?([a-zA-Z0-9]+)/;

function detectVideoUrl(text) {
  const urls = text.match(/https?:\/\/[^\s]+/g);
  if (!urls) return null;
  for (const u of urls) {
    if (YT_RE.test(u) || VIMEO_RE.test(u) || RUTUBE_RE.test(u) || KINESCOPE_RE.test(u)) return u;
  }
  return null;
}

function videoProviderName(url) {
  if (YT_RE.test(url))        return 'YouTube';
  if (VIMEO_RE.test(url))     return 'Vimeo';
  if (RUTUBE_RE.test(url))    return 'RuTube';
  if (KINESCOPE_RE.test(url)) return 'Kinescope';
  return 'Видео';
}

export default function MomentCreateSheet({ existing, onClose, onSaved, onConflict }) {
  const isEdit = !!existing;
  const { user } = useAuth();
  const isSuper  = !!user?.is_super;
  const [text,      setText]      = useState(existing?.text || '');
  const [isSearch,  setIsSearch]  = useState(existing?.is_search || false);
  const [mediaPreview, setMediaPreview] = useState(existing?.media_url || null);
  const [mediaType, setMediaType] = useState(existing?.media_type || null);
  const [mediaPosition, setMediaPosition] = useState(existing?.media_position || '50% 50%'); // CSS object-position
  const [moodEmoji, setMoodEmoji] = useState(existing?.mood_emoji || null); // null = авто
  const [emojiOpen, setEmojiOpen] = useState(false); // пикер HEY-эмодзи под textarea
  const [moodOpen,  setMoodOpen]  = useState(false); // свёрнуто по умолчанию
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const [detectedVideoUrl, setDetectedVideoUrl] = useState(null);
  // Натуральные пропорции загруженной картинки (после onLoad)
  const [imgRatio, setImgRatio] = useState(null); // width / height
  const fileRef = useRef();
  const textRef = useRef();
  // Keep local object URL for preview; revoke on unmount / media removal
  const previewObjUrl = useRef(null);

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80); }, []);
  useEffect(() => () => { if (previewObjUrl.current) URL.revokeObjectURL(previewObjUrl.current); }, []);

  // Detect YouTube/Vimeo URL in text for feedback
  useEffect(() => {
    setDetectedVideoUrl(detectVideoUrl(text));
  }, [text]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    // Show instant local preview
    if (previewObjUrl.current) URL.revokeObjectURL(previewObjUrl.current);
    previewObjUrl.current = previewUrl(file);
    setMediaPreview(previewObjUrl.current);
    setMediaType(file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio');

    // Upload directly to S3 (or base64 fallback for local dev)
    setUploading(true);
    try {
      const category = file.type.startsWith('image/') ? 'moment-image'
                     : file.type.startsWith('video/') ? 'moment-video'
                     : 'moment-audio';
      const res = await uploadMedia(file, category, {
        getPresignUrl:     api.getPresignUrl,
        uploadMomentMedia: api.uploadMomentMedia,
      });
      setMediaPreview(res.url);   // replace local preview with final S3 URL
      setMediaType(res.mediaType);
    } catch(err) {
      setMediaPreview(null);
      setMediaType(null);
      setError(err.message || 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  }

  function removeMedia() {
    if (previewObjUrl.current) { URL.revokeObjectURL(previewObjUrl.current); previewObjUrl.current = null; }
    setMediaPreview(null);
    setMediaType(null);
    setImgRatio(null);
    setMediaPosition('50% 50%');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    if (uploading) { setError('Подождите, файл ещё загружается'); return; }
    if (!text.trim()) { setError('Напишите что-нибудь'); return; }
    setSaving(true);
    setError('');
    // When editing — текст/настрой/позиция меняются; медиа не трогаем
    const payload = isEdit
      ? { text: text.trim(), isSearch, moodEmoji: moodEmoji || null,
          mediaPosition: mediaPreview && mediaType==='image' ? mediaPosition : null }
      : { text: text.trim(), mediaUrl: mediaPreview, mediaType, isSearch,
          moodEmoji: (!mediaPreview && moodEmoji) ? moodEmoji : null,
          mediaPosition: mediaPreview && mediaType==='image' ? mediaPosition : null };
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

  // ── Drag-to-reposition image inside frame ──────────────────────────────
  // Хранит сырые проценты 0-100 для X/Y; конвертится в "X% Y%" CSS-строку
  const dragStateRef = useRef(null); // { startX, startY, baseX, baseY, rect }

  function onPosDragStart(e) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const [bx, by] = (mediaPosition || '50% 50%').replace(/%/g,'').split(' ').map(Number);
    dragStateRef.current = { startX: point.clientX, startY: point.clientY, baseX: bx, baseY: by, rect };
    window.addEventListener('mousemove', onPosDragMove);
    window.addEventListener('mouseup',   onPosDragEnd);
    window.addEventListener('touchmove', onPosDragMove, { passive: false });
    window.addEventListener('touchend',  onPosDragEnd);
  }
  function onPosDragMove(e) {
    if (!dragStateRef.current) return;
    e.preventDefault?.();
    const point = e.touches ? e.touches[0] : e;
    const { startX, startY, baseX, baseY, rect } = dragStateRef.current;
    // Сколько % шага по контейнеру
    const dx = ((point.clientX - startX) / rect.width)  * 100;
    const dy = ((point.clientY - startY) / rect.height) * 100;
    // Инверсия: тянем картинку вниз → object-position Y растёт меньше (видна верхняя часть)
    // Но привычнее: тянем вниз — фокус смещается вниз → object-position Y растёт
    const nx = Math.max(0, Math.min(100, baseX - dx));
    const ny = Math.max(0, Math.min(100, baseY - dy));
    setMediaPosition(`${nx.toFixed(0)}% ${ny.toFixed(0)}%`);
  }
  function onPosDragEnd() {
    dragStateRef.current = null;
    window.removeEventListener('mousemove', onPosDragMove);
    window.removeEventListener('mouseup',   onPosDragEnd);
    window.removeEventListener('touchmove', onPosDragMove);
    window.removeEventListener('touchend',  onPosDragEnd);
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
            {isEdit ? (
              /* Edit mode — media is read-only, cannot be changed */
              mediaPreview ? (
                <div style={{position:'relative',borderRadius:16,overflow:'hidden',
                  background:'#0a0518'}}>
                  {mediaType==='image' && (() => {
                    const isWide = imgRatio && imgRatio > 1.1;
                    const isTall = imgRatio && imgRatio < 0.9;
                    const isSquareish = !isWide && !isTall;
                    const dragHint = isWide ? '↔ Перетащи — выбери видимую часть'
                                   : isTall ? '↕ Перетащи — выбери видимую часть'
                                   : 'В ленте крупная карточка будет квадратной';
                    return (
                      <div
                        onMouseDown={!isSquareish ? onPosDragStart : undefined}
                        onTouchStart={!isSquareish ? onPosDragStart : undefined}
                        style={{
                          position:'relative',
                          width:'100%',
                          aspectRatio: isSquareish ? 'auto' : '1 / 1',
                          maxHeight: isSquareish ? 480 : undefined,
                          maxWidth: isSquareish ? '100%' : 480,
                          margin:'0 auto',
                          display:'flex',justifyContent:'center',alignItems:'center',
                          cursor: isSquareish ? 'default' : 'grab',
                          userSelect:'none',touchAction:'none',
                          overflow:'hidden',
                        }}>
                        <img src={mediaPreview} alt="" draggable={false}
                          onLoad={e => {
                            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                            if (w && h) setImgRatio(w / h);
                          }}
                          style={{
                            width: isSquareish ? 'auto' : '100%',
                            height: isSquareish ? 'auto' : '100%',
                            maxWidth: isSquareish ? '100%' : undefined,
                            maxHeight: isSquareish ? 480 : undefined,
                            objectFit: isSquareish ? 'contain' : 'cover',
                            objectPosition: mediaPosition,
                            display:'block', pointerEvents:'none',
                          }}/>
                        <div style={{
                          position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
                          background:'rgba(0,0,0,.65)',backdropFilter:'blur(6px)',
                          borderRadius:20,padding:'5px 14px',
                          color:'rgba(255,255,255,.95)',fontSize:11,fontWeight:600,whiteSpace:'nowrap',
                          pointerEvents:'none',
                        }}>{dragHint}</div>
                      </div>
                    );
                  })()}
                  {mediaType==='video' && <video src={mediaPreview} controls style={{width:'100%',maxHeight:200}}/>}
                  {mediaType==='audio' && (
                    <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:8,
                      background:'linear-gradient(135deg,#1a0a38,#2a1858)'}}>
                      <div style={{fontSize:24,textAlign:'center'}}>🎵</div>
                      <audio src={mediaPreview} controls style={{width:'100%'}}/>
                    </div>
                  )}
                </div>
              ) : null
            ) : (
              /* Create mode — full upload zone */
              mediaPreview ? (
                <div style={{position:'relative',borderRadius:16,overflow:'hidden',
                  background:'#0a0518'}}>
                  {mediaType==='image' && (() => {
                    const isWide = imgRatio && imgRatio > 1.1;   // горизонтальная
                    const isTall = imgRatio && imgRatio < 0.9;   // вертикальная
                    const isSquareish = !isWide && !isTall;
                    const dragHint = isWide ? '↔ Перетащи — выбери видимую часть'
                                   : isTall ? '↕ Перетащи — выбери видимую часть'
                                   : 'В ленте крупная карточка будет квадратной';
                    return (
                      <div
                        onMouseDown={!uploading && !isSquareish ? onPosDragStart : undefined}
                        onTouchStart={!uploading && !isSquareish ? onPosDragStart : undefined}
                        style={{
                          position:'relative',
                          // Для не-квадратных картинок принудительно показываем 1:1
                          // кроп с object-fit:cover, чтобы юзер сразу видел КАДР как
                          // в ленте и мог его подвинуть. Для квадратных — natural fit.
                          width: isSquareish ? '100%' : '100%',
                          aspectRatio: isSquareish ? 'auto' : '1 / 1',
                          maxHeight: isSquareish ? 480 : undefined,
                          maxWidth: isSquareish ? '100%' : 480,
                          margin: '0 auto',
                          display:'flex',justifyContent:'center',alignItems:'center',
                          cursor: uploading ? 'default' : (isSquareish ? 'default' : 'grab'),
                          userSelect:'none', touchAction:'none',
                          overflow:'hidden',
                        }}>
                        <img src={mediaPreview} alt="" draggable={false}
                          onLoad={e => {
                            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                            if (w && h) setImgRatio(w / h);
                          }}
                          style={{
                            width: isSquareish ? 'auto' : '100%',
                            height: isSquareish ? 'auto' : '100%',
                            maxWidth: isSquareish ? '100%' : undefined,
                            maxHeight: isSquareish ? 480 : undefined,
                            objectFit: isSquareish ? 'contain' : 'cover',
                            objectPosition: mediaPosition,
                            display: 'block', pointerEvents: 'none',
                          }}/>
                        {!uploading && (
                          <div style={{
                            position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',
                            background:'rgba(0,0,0,.65)',backdropFilter:'blur(6px)',
                            borderRadius:20,padding:'5px 14px',
                            color:'rgba(255,255,255,.95)',fontSize:11,fontWeight:600,whiteSpace:'nowrap',
                            pointerEvents:'none',
                          }}>{dragHint}</div>
                        )}
                      </div>
                    );
                  })()}
                  {mediaType==='video' && <video src={mediaPreview} controls style={{width:'100%',maxHeight:200}}/>}
                  {mediaType==='audio' && (
                    <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:8,
                      background:'linear-gradient(135deg,#1a0a38,#2a1858)'}}>
                      <div style={{fontSize:24,textAlign:'center'}}>🎵</div>
                      <audio src={mediaPreview} controls style={{width:'100%'}}/>
                    </div>
                  )}
                  {/* Upload progress overlay */}
                  {uploading && (
                    <div style={{
                      position:'absolute',inset:0,
                      background:'rgba(10,5,25,.65)',backdropFilter:'blur(4px)',
                      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      gap:8,color:'white',fontSize:13,fontWeight:600,
                    }}>
                      <div style={{fontSize:24,animation:'spin 1s linear infinite'}}>⏳</div>
                      Загрузка…
                    </div>
                  )}
                  {!uploading && (
                    <button onClick={removeMedia} style={{
                      position:'absolute',top:8,right:8,background:'rgba(0,0,0,.55)',
                      backdropFilter:'blur(6px)',border:'none',borderRadius:'50%',
                      width:30,height:30,color:'white',fontSize:16,cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  )}
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
                  <span>Добавить фото или аудио</span>
                  {isSuper ? (
                    <>
                      <span style={{fontSize:12,opacity:.6}}>
                        JPG/PNG/WebP до 15 МБ · MP3 до 30 МБ
                      </span>
                      <span style={{fontSize:11,color:'rgba(200,170,255,.75)',
                        background:'rgba(120,90,200,.18)',
                        border:'1px solid rgba(180,140,220,.3)',
                        borderRadius:10,padding:'3px 10px',marginTop:2}}>
                        ✦ Расширенные лимиты Super
                      </span>
                    </>
                  ) : (
                    <span style={{fontSize:12,opacity:.6}}>
                      JPG/PNG/WebP до 5 МБ · MP3 до 5 МБ
                    </span>
                  )}
                </button>
              )
            )}
            {!isEdit && (
              <input ref={fileRef} type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp3,audio/ogg"
                onChange={handleFile} style={{display:'none'}}/>
            )}
          </div>

          {/* Mood emoji picker — свёрнутая ссылка, раскрывается по клику */}
          {!mediaPreview && (
            <div>
              {/* Свёрнутый триггер */}
              <button onClick={() => setMoodOpen(o => !o)}
                style={{
                  width:'100%',background:'rgba(255,255,255,.04)',
                  border:'1px solid rgba(255,255,255,.08)',borderRadius:12,
                  padding:'10px 14px',cursor:'pointer',
                  display:'flex',alignItems:'center',gap:10,
                  color:'rgba(255,255,255,.6)',fontSize:13,fontFamily:'inherit',
                  transition:'background .15s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}>
                {/* Мини-превью текущего выбора, либо иконка-плейсхолдер */}
                {moodEmoji ? (
                  <div style={{width:28,height:28,borderRadius:8,overflow:'hidden',flexShrink:0}}>
                    <MoodEmoji type={moodEmoji} size={20}/>
                  </div>
                ) : (
                  <span style={{fontSize:18,flexShrink:0}}>🎨</span>
                )}
                <span style={{flex:1,textAlign:'left'}}>
                  {moodEmoji
                    ? `Настроение: ${MOOD_OPTIONS.find(o=>o.type===moodEmoji)?.label || moodEmoji}`
                    : 'Настроение карточки — авто'}
                </span>
                <span style={{
                  fontSize:11,color:'rgba(255,255,255,.4)',
                  transform: moodOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition:'transform .15s',
                }}>▾</span>
              </button>

              {/* Раскрытая панель */}
              {moodOpen && (
                <div style={{marginTop:10,paddingTop:4}}>
                  {/* Большое превью выбранного */}
                  {moodEmoji && (
                    <div style={{
                      height:120,borderRadius:14,overflow:'hidden',marginBottom:10,
                      border:'1px solid rgba(255,255,255,.1)',
                    }}>
                      <MoodEmoji type={moodEmoji} size={70}/>
                    </div>
                  )}
                  {/* Сетка вариантов */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
                    {MOOD_OPTIONS.map(opt => (
                      <button key={opt.type} onClick={()=>setMoodEmoji(opt.type)} title={opt.label}
                        style={{
                          aspectRatio:'1',borderRadius:12,cursor:'pointer',padding:0,
                          border: moodEmoji===opt.type
                            ? '2px solid rgba(180,140,220,.9)'
                            : '2px solid transparent',
                          background:'rgba(255,255,255,.05)',
                          overflow:'hidden',position:'relative',
                          transition:'border-color .15s, transform .12s',
                        }}
                        onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; }}>
                        <MoodEmoji type={opt.type} size={40}/>
                      </button>
                    ))}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    marginTop:8,color:'rgba(255,255,255,.35)',fontSize:11}}>
                    <span>{moodEmoji ? 'Сменить или сбросить →' : 'Или подберём автоматически по тексту'}</span>
                    {moodEmoji && (
                      <button onClick={()=>setMoodEmoji(null)}
                        style={{background:'none',border:'none',color:'rgba(180,140,220,.8)',
                          fontSize:11,cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                        Сбросить → авто
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            color:'rgba(255,255,255,.45)',fontSize:11,marginTop:-12}}>
            <button type="button"
              onClick={() => setEmojiOpen(o => !o)}
              title="HEY-эмодзи"
              style={{
                background: emojiOpen ? 'rgba(140,100,220,.4)' : 'rgba(255,255,255,.08)',
                border:'1px solid rgba(255,255,255,.14)',
                borderRadius:50, padding:'4px 10px 4px 6px',
                color:'white', cursor:'pointer', fontFamily:'inherit',
                display:'inline-flex', alignItems:'center', gap:6, fontSize:12,
              }}>
              <img src="/emoji/smiling.svg" alt=""
                style={{width:16,height:16,pointerEvents:'none',
                  filter:'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'}}/>
              <span>{emojiOpen ? 'Скрыть' : 'Эмодзи'}</span>
            </button>
            <span>{text.length}/2000</span>
          </div>

          {/* HEY-эмодзи пикер: вставляет [name] в позицию курсора textarea */}
          {emojiOpen && (
            <div style={{
              background:'rgba(48,38,78,.85)', borderRadius:12,
              padding:'8px 6px', display:'grid',
              gridTemplateColumns:'repeat(8, 1fr)', gap:2,
              border:'1px solid rgba(255,255,255,.08)',
            }}>
              {HEY_EMOJI.map(name => (
                <button key={name} type="button" title={emojiLabel(name)}
                  onClick={() => {
                    const ta = textRef.current;
                    const insertTok = `[${name}]`;
                    if (ta) {
                      const start = ta.selectionStart ?? text.length;
                      const end   = ta.selectionEnd   ?? text.length;
                      const next  = text.slice(0, start) + insertTok + text.slice(end);
                      setText(next.slice(0, 2000));
                      // Возвращаем курсор после вставленного токена
                      requestAnimationFrame(() => {
                        ta.focus();
                        const pos = start + insertTok.length;
                        try { ta.setSelectionRange(pos, pos); } catch {}
                      });
                    } else {
                      setText(t => (t + insertTok).slice(0, 2000));
                    }
                  }}
                  style={{
                    background:'none', border:'none', cursor:'pointer',
                    padding:5, borderRadius:8, transition:'background .12s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  <img src={emojiUrl(name)} alt={name}
                    style={{width:26,height:26,pointerEvents:'none',
                      filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
                </button>
              ))}
            </div>
          )}

          {/* Превью токенов как SVG — пользователь видит как момент будет
             выглядеть в ленте, эмодзи в textarea остаётся в форме [name]. */}
          {/[a-z][^\[\]]*\]/.test(text) && /\[/.test(text) && (() => {
            const re = /\[([a-z][a-z0-9 ]*?)\]/gi;
            const parts = [];
            let last = 0, m;
            while ((m = re.exec(text)) !== null) {
              if (m.index > last) parts.push({ kind:'t', v: text.slice(last, m.index) });
              parts.push({ kind:'e', v: m[1] });
              last = m.index + m[0].length;
            }
            if (last < text.length) parts.push({ kind:'t', v: text.slice(last) });
            const hasEmoji = parts.some(p => p.kind === 'e');
            if (!hasEmoji) return null;
            return (
              <div style={{
                background:'rgba(255,255,255,.04)', borderRadius:12,
                border:'1px dashed rgba(255,255,255,.15)',
                padding:'10px 14px', color:'rgba(255,255,255,.8)',
                fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap',
                display:'flex', flexWrap:'wrap', alignItems:'center', gap:2,
              }}>
                {parts.map((p, i) => p.kind === 't'
                  ? <span key={i}>{p.v}</span>
                  : <img key={i} src={emojiUrl(p.v)} alt={p.v}
                      title={emojiLabel(p.v)}
                      style={{width:22,height:22,display:'inline-block',verticalAlign:'middle',
                        filter:'drop-shadow(1px 2px 1px rgba(0,0,0,.5))'}}/>
                )}
              </div>
            );
          })()}

          {/* Video URL detected feedback */}
          {detectedVideoUrl && (
            <div style={{
              background:'rgba(20,10,50,.8)',
              border:'1px solid rgba(120,80,200,.35)',
              borderRadius:12,
              padding:'10px 14px',
              display:'flex',
              alignItems:'flex-start',
              gap:10,
            }}>
              <span style={{fontSize:18,flexShrink:0}}>🎬</span>
              <div>
                <div style={{color:'rgba(200,180,255,.9)',fontSize:13,fontWeight:600,marginBottom:3}}>
                  🎬 {videoProviderName(detectedVideoUrl)} распознан
                </div>
                <div style={{color:'rgba(255,255,255,.4)',fontSize:11,wordBreak:'break-all'}}>
                  {detectedVideoUrl}
                </div>
                <div style={{color:'rgba(255,255,255,.3)',fontSize:11,marginTop:3}}>
                  После публикации появится превью
                </div>
              </div>
            </div>
          )}

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
          <button onClick={save} disabled={saving || uploading || !text.trim()}
            style={{
              width:'100%',padding:'14px',borderRadius:50,fontSize:15,fontWeight:700,
              cursor: saving || uploading || !text.trim() ? 'not-allowed' : 'pointer',
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
