import { useState, useEffect } from 'react';
import { api } from '../../api';
import { fmtDateTime } from '../../lib/formatTime';
import Icon from '../Icon';
import { mediaUrl } from '../../lib/mediaUrl';
import { fileTypeIcon } from '../../lib/fileTypeIcon';
import { AudioPlayer } from './AudioPlayer';
import { URL_RE } from './chatRender';

function MediaViewerModal({ convId, onClose }) {
  const [tab,    setTab]    = useState('images');
  const [images, setImages] = useState([]);
  const [files,  setFiles]  = useState([]);
  const [audios, setAudios] = useState([]);
  const [links,  setLinks]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [light,  setLight]  = useState(null); // null | { urls: string[], index: number, msgIds: string[] }

  // Закрыть модалку и проскроллить чат к нужному сообщению
  function goToMessage(msgId) {
    if (!msgId) return;
    onClose();
    // Дать модалке размонтироваться, потом дёрнуть скролл — ChatScreen ловит событие
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: msgId }));
    }, 50);
  }

  useEffect(() => {
    api.getMedia(convId).then(msgs => {
      // Распределяем вложения по категориям
      const imgs = [], fls = [], auds = [];
      for (const m of msgs) {
        const a = m.attachment;
        if (!a) continue;
        if (a.type === 'image' && a.url) imgs.push({ ...m, attachment: a, message_id: m.id });
        else if (a.type === 'images' && Array.isArray(a.urls)) {
          a.urls.forEach((u, i) => imgs.push({
            ...m, id: m.id + '_' + i, message_id: m.id,
            attachment: { type:'image', url:u },
          }));
        }
        else if (a.type === 'file') fls.push({ ...m, attachment: a });
        else if (a.type === 'audio') auds.push({ ...m, attachment: a });
      }
      setImages(imgs);
      setFiles(fls);
      setAudios(auds);
      setLoading(false);
    }).catch(console.error);
    api.searchMessages(convId, 'http').then(msgs => {
      const found = [];
      msgs.forEach(m => {
        const urls = m.text?.match(URL_RE) || [];
        urls.forEach(url => found.push({ url, sender: m.sender_name, time: m.created_at, message_id: m.id }));
      });
      setLinks(found);
    }).catch(console.error);
  }, [convId]);

  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
  const overlay = { position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const modal = { width:'min(94vw,480px)',maxHeight:'80vh',background:'rgba(45,36,80,.97)',
    borderRadius:20,display:'flex',flexDirection:'column',overflow:'hidden',
    boxShadow:'0 16px 48px rgba(0,0,0,.5)' };

  const TABS = [
    ['images', 'image', 'Фото',   images.length],
    ['files',  'attach','Файлы',  files.length],
    ['audios', 'mic',   'Аудио',  audios.length],
    ['links',  'link',  'Ссылки', links.length],
  ];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',padding:'16px 20px 0'}}>
          <span style={{flex:1,color:'#F9F0F0',fontSize:17,fontWeight:600}}>Медиа и ссылки</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(249,240,240,.6)',cursor:'pointer',display:'inline-flex',alignItems:'center'}}><Icon name="close" size={20}/></button>
        </div>
        <div style={{display:'flex',gap:0,padding:'10px 8px 0',borderBottom:'1px solid rgba(249,240,240,.1)'}}>
          {TABS.map(([id,icon,label,count])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1, background:'none',border:'none',padding:'8px 4px',cursor:'pointer',
              fontFamily:'inherit',
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              color: tab===id ? '#F9F0F0' : 'rgba(249,240,240,.5)',
              borderBottom: tab===id ? '2px solid rgba(180,140,220,.9)' : '2px solid transparent',
              marginBottom:-1,transition:'color .15s',
              fontWeight: tab===id ? 600 : 500,
              minWidth:0,
            }}>
              <span style={{lineHeight:1,display:'inline-flex',alignItems:'center',justifyContent:'center',height:20}}><Icon name={icon} size={18}/></span>
              <span style={{fontSize:11,whiteSpace:'nowrap',
                overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%'}}>
                {label}{count > 0 ? ` · ${count}` : ''}
              </span>
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {loading && <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Загрузка…</div>}

          {!loading && tab==='images' && (
            images.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет фото</div>
              : (() => {
                  const valid = images.filter(m => m.attachment?.url);
                  const urls   = valid.map(m => m.attachment.url);
                  const msgIds = valid.map(m => m.message_id || m.id);
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                      {valid.map((m, i) => (
                        <img key={i} src={mediaUrl(m.attachment.url)} alt=""
                          onClick={()=>setLight({ urls, index: i, msgIds })}
                          style={{width:'100%',aspectRatio:'1',objectFit:'cover',
                            borderRadius:8,cursor:'zoom-in'}}/>
                      ))}
                    </div>
                  );
                })()
          )}

          {!loading && tab==='files' && (
            files.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет файлов</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {files.map(m => {
                    const a = m.attachment;
                    return (
                      <div key={m.id} onClick={() => goToMessage(m.message_id || m.id)}
                        title="Перейти к сообщению"
                        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',
                          borderRadius:10, background:'rgba(249,240,240,.06)',
                          border:'1px solid rgba(249,240,240,.08)',cursor:'pointer',
                          transition:'background .15s'}}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(249,240,240,.12)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(249,240,240,.06)'}>
                        <span style={{flexShrink:0,lineHeight:1,display:'inline-flex'}}>
                          {fileTypeIcon(a.name, a.mime, 24)}
                        </span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:'#F9F0F0',fontSize:13,fontWeight:600,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {a.name || 'Файл'}
                          </div>
                          <div style={{color:'rgba(225,220,245,.7)',fontSize:11,marginTop:2}}>
                            {fmtSize(a.size)}{m.sender_name ? ` · ${m.sender_name}` : ''} · {fmtDateTime(m.created_at)}
                          </div>
                        </div>
                        <a href={a.url} target="_blank" rel="noreferrer" download={a.name}
                          onClick={e => e.stopPropagation()}
                          title="Скачать"
                          style={{color:'rgba(225,220,245,.85)',fontSize:16,padding:'6px 10px',
                            borderRadius:8,textDecoration:'none',
                            background:'rgba(249,240,240,.08)'}}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(249,240,240,.18)'; e.currentTarget.style.color='#F9F0F0'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(249,240,240,.08)'; e.currentTarget.style.color='rgba(225,220,245,.85)'; }}>
                          ⬇
                        </a>
                      </div>
                    );
                  })}
                </div>
          )}

          {!loading && tab==='audios' && (
            audios.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет голосовых</div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {audios.map(m => (
                    <div key={m.id} style={{padding:'12px 14px',borderRadius:12,
                      background:'rgba(249,240,240,.06)',border:'1px solid rgba(249,240,240,.1)'}}>
                      <AudioPlayer url={m.attachment.url} duration={m.attachment.duration} isOut={false} wide/>
                      <div style={{display:'flex',alignItems:'center',marginTop:8,gap:8}}>
                        <div style={{flex:1,color:'rgba(225,220,245,.7)',fontSize:12}}>
                          {m.sender_name || ''} · {fmtDateTime(m.created_at)}
                        </div>
                        <button onClick={() => goToMessage(m.message_id || m.id)}
                          title="Перейти к сообщению"
                          style={{background:'rgba(140,110,220,.25)',border:'none',
                            color:'rgba(220,200,255,.95)',fontSize:11,fontWeight:600,
                            padding:'4px 10px',borderRadius:14,cursor:'pointer',
                            fontFamily:'inherit'}}>
                          💬 К сообщению
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {!loading && tab==='links' && (
            links.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет ссылок</div>
              : links.map((l,i)=>(
                  <div key={i} style={{padding:'10px 0',borderBottom:'1px solid rgba(249,240,240,.08)'}}>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      style={{color:'rgba(160,130,220,.95)',fontSize:13,wordBreak:'break-all',textDecoration:'none',fontWeight:500}}>
                      {l.url}
                    </a>
                    <div style={{display:'flex',alignItems:'center',marginTop:4,gap:8}}>
                      <div style={{flex:1,color:'rgba(225,220,245,.7)',fontSize:12}}>
                        {l.sender} · {fmtDateTime(l.time)}
                      </div>
                      {l.message_id && (
                        <button onClick={() => goToMessage(l.message_id)}
                          title="Перейти к сообщению"
                          style={{background:'rgba(140,110,220,.25)',border:'none',
                            color:'rgba(220,200,255,.95)',fontSize:11,fontWeight:600,
                            padding:'4px 10px',borderRadius:14,cursor:'pointer',
                            fontFamily:'inherit'}}>
                          💬 К сообщению
                        </button>
                      )}
                    </div>
                  </div>
                ))
          )}
        </div>
      </div>
      {light && (() => {
        const { urls, index } = light;
        const total = urls.length;
        const curUrl = urls[index];
        const prev = () => setLight({ urls, index: (index - 1 + total) % total });
        const next = () => setLight({ urls, index: (index + 1) % total });
        return (
          <div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,.94)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
            onClick={(e) => {
              // Стопим всплытие, чтобы не сработал onClose родительского
              // overlay'я модалки «Медиа и ссылки» — пользователь должен
              // вернуться в каталог, а не выйти полностью.
              e.stopPropagation();
              setLight(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setLight(null);
              if (e.key === 'ArrowLeft')  prev();
              if (e.key === 'ArrowRight') next();
            }}
            tabIndex={0}
            ref={el => el?.focus()}>
            {/* Close */}
            <button onClick={e => { e.stopPropagation(); setLight(null); }}
              style={{position:'absolute',top:16,right:16,
                background:'rgba(249,240,240,.12)',border:'none',color:'#F9F0F0',
                width:40,height:40,borderRadius:'50%',cursor:'pointer',
                fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            {/* Counter */}
            {total > 1 && (
              <div style={{position:'absolute',top:24,left:'50%',transform:'translateX(-50%)',
                color:'rgba(249,240,240,.85)',fontSize:14,fontWeight:600,
                background:'rgba(0,0,0,.4)',padding:'5px 14px',borderRadius:20}}>
                {index + 1} / {total}
              </div>
            )}
            {/* Prev */}
            {total > 1 && (
              <button onClick={e => { e.stopPropagation(); prev(); }}
                style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',
                  background:'rgba(249,240,240,.12)',border:'none',color:'#F9F0F0',
                  width:48,height:48,borderRadius:'50%',cursor:'pointer',
                  fontSize:24,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            )}
            {/* Image */}
            <img src={curUrl} alt="" onClick={e=>e.stopPropagation()}
              style={{maxWidth:'90vw',maxHeight:'78vh',borderRadius:12,objectFit:'contain'}}/>
            {/* Next */}
            {total > 1 && (
              <button onClick={e => { e.stopPropagation(); next(); }}
                style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',
                  background:'rgba(249,240,240,.12)',border:'none',color:'#F9F0F0',
                  width:48,height:48,borderRadius:'50%',cursor:'pointer',
                  fontSize:24,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            )}
            {/* Actions */}
            <div style={{marginTop:16,display:'flex',gap:8}}>
              {light.msgIds?.[index] && (
                <button onClick={e => { e.stopPropagation(); goToMessage(light.msgIds[index]); }}
                  style={{background:'rgba(140,110,220,.7)',border:'none',borderRadius:10,
                    padding:'8px 18px',color:'#F9F0F0',fontSize:14,cursor:'pointer',
                    fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:6}}>
                  💬 К сообщению
                </button>
              )}
              <a href={curUrl} download onClick={e=>e.stopPropagation()}
                style={{background:'rgba(249,240,240,.15)',borderRadius:10,
                  padding:'8px 18px',color:'#F9F0F0',textDecoration:'none',fontSize:14}}>
                ⬇ Скачать
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
export default MediaViewerModal;
