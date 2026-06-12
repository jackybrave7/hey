import { useRef, useState } from 'react';
import { api } from '../../api';
import Icon from '../Icon';
import { uploadFeedbackAttachment, previewUrl } from '../../lib/uploadMedia';
import { MediaImage } from '../shared/MediaImage';
import { fileTypeIcon } from '../../lib/fileTypeIcon';

const FEEDBACK_TYPES = [
  { id: 'bug',       label: 'Ошибка', icon: 'alert' },
  { id: 'idea',      label: 'Идея',   icon: 'sparkle' },
  { id: 'complaint', label: 'Жалоба', icon: 'flag' },
  { id: 'other',     label: 'Другое', icon: 'mail' },
];

const MAX_ATTACH_MB = 10;

function FeedbackModal({ onClose }) {
  const fileRef = useRef(null);
  const [type, setType] = useState('idea');
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null); // { file, previewUrl, name, mime, isImage }
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  function clearAttachment() {
    if (attachment?.previewUrl) {
      try { URL.revokeObjectURL(attachment.previewUrl); } catch {}
    }
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
      alert(`Файл слишком большой. Максимум ${MAX_ATTACH_MB} МБ`);
      e.target.value = '';
      return;
    }
    clearAttachment();
    const isImage = file.type.startsWith('image/');
    setAttachment({
      file,
      previewUrl: isImage ? previewUrl(file) : null,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      isImage,
    });
    e.target.value = '';
  }

  const canSend = (text.trim().length > 0 || attachment) && status !== 'sending';

  async function send() {
    if (!canSend) return;
    setStatus('sending');
    try {
      let attachment_url, attachment_name, attachment_mime;
      if (attachment?.file) {
        const up = await uploadFeedbackAttachment(attachment.file, {
          getPresignUrl: api.getPresignUrl,
          uploadImage: api.uploadImage,
        });
        attachment_url = up.url;
        attachment_name = up.name;
        attachment_mime = up.mime;
      }
      await api.sendFeedback({
        type,
        text: text.trim(),
        attachment_url,
        attachment_name,
        attachment_mime,
      });
      clearAttachment();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:600,
    background:'rgba(0,0,0,.6)',backdropFilter:'blur(12px)',
    display:'flex',alignItems:'center',justifyContent:'center'
  };
  const panel = {
    background:'rgba(30,22,58,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,440px)',
    boxShadow:'0 28px 72px rgba(0,0,0,.6)',
    border:'1px solid rgba(249,240,240,.11)',overflow:'hidden'
  };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={{display:'flex',alignItems:'center',gap:12,
          padding:'20px 22px 16px',borderBottom:'1px solid rgba(249,240,240,.09)'}}>
          <span style={{display:'inline-flex',color:'rgba(249,240,240,.85)'}}><Icon name="mail" size={20} /></span>
          <div style={{flex:1}}>
            <div style={{color:'#F9F0F0',fontSize:17,fontWeight:700}}>Написать разработчику</div>
            <div style={{color:'rgba(249,240,240,.38)',fontSize:12,marginTop:2}}>Жалобы и пожелания</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1,padding:4}}>✕</button>
        </div>

        {status === 'sent' ? (
          <div style={{padding:'48px 28px',display:'flex',flexDirection:'column',
            alignItems:'center',gap:16,textAlign:'center'}}>
            <div style={{fontSize:52}}>🎉</div>
            <div style={{color:'#F9F0F0',fontSize:17,fontWeight:600}}>Сообщение отправлено!</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13,lineHeight:1.6}}>
              Спасибо за обратную связь.<br/>Мы обязательно рассмотрим ваше сообщение.
            </div>
            <button onClick={onClose}
              style={{marginTop:8,padding:'12px 36px',borderRadius:50,
                background:'rgba(95, 64, 128,.75)',border:'none',
                color:'#F9F0F0',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Закрыть
            </button>
          </div>
        ) : (
          <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:18}}>
            <div>
              <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginBottom:10,
                textTransform:'uppercase',letterSpacing:.5}}>Тип обращения</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {FEEDBACK_TYPES.map(t => (
                  <button key={t.id} onClick={() => setType(t.id)}
                    style={{
                      padding:'8px 14px',borderRadius:20,fontSize:13,cursor:'pointer',
                      border:'1px solid ' + (type===t.id ? 'rgba(180,140,220,.6)' : 'rgba(249,240,240,.15)'),
                      background: type===t.id ? 'rgba(95, 64, 128,.55)' : 'rgba(249,240,240,.07)',
                      color: type===t.id ? '#F9F0F0' : 'rgba(249,240,240,.6)',
                      transition:'all .15s',fontWeight: type===t.id ? 600 : 400,
                      display:'inline-flex', alignItems:'center', gap:6,
                    }}>
                    <Icon name={t.icon} size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginBottom:8,
                textTransform:'uppercase',letterSpacing:.5}}>Сообщение</div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Опишите вашу идею, проблему или пожелание…"
                rows={5}
                style={{
                  width:'100%',boxSizing:'border-box',
                  background:'rgba(249,240,240,.07)',
                  border:'1px solid rgba(249,240,240,.14)',
                  borderRadius:14,padding:'12px 14px',
                  color:'#F9F0F0',fontSize:14,fontFamily:'inherit',
                  resize:'vertical',outline:'none',lineHeight:1.6,
                  transition:'border-color .15s',minHeight:100
                }}
                onFocus={e=>e.currentTarget.style.borderColor='rgba(180,140,220,.55)'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(249,240,240,.14)'}
              />
              <div style={{color:'rgba(249,240,240,.25)',fontSize:11,marginTop:4,textAlign:'right'}}>
                {text.length} симв.
              </div>
            </div>

            <div>
              <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginBottom:8,
                textTransform:'uppercase',letterSpacing:.5}}>Вложение</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                style={{ display: 'none' }}
                onChange={onPickFile}
              />
              {attachment ? (
                <div style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 12px', borderRadius:14,
                  background:'rgba(249,240,240,.06)',
                  border:'1px solid rgba(249,240,240,.12)',
                }}>
                  {attachment.isImage ? (
                    <MediaImage src={attachment.previewUrl} alt=""
                      style={{ width:56, height:56, borderRadius:10, objectFit:'cover', flexShrink:0 }}/>
                  ) : (
                    <span style={{ flexShrink:0, display:'inline-flex' }}>
                      {fileTypeIcon(attachment.name, attachment.mime, 32)}
                    </span>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#F9F0F0', fontSize:13, fontWeight:600,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {attachment.name}
                    </div>
                    <div style={{ color:'rgba(249,240,240,.4)', fontSize:11, marginTop:2 }}>
                      {(attachment.file.size / 1024).toFixed(0)} КБ
                    </div>
                  </div>
                  <button type="button" onClick={clearAttachment} title="Убрать"
                    style={{ background:'rgba(0,0,0,.35)', border:'none', color:'#F9F0F0',
                      width:28, height:28, borderRadius:'50%', cursor:'pointer', flexShrink:0 }}>
                    ✕
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{
                    width:'100%', padding:'12px 14px', borderRadius:14, cursor:'pointer',
                    background:'rgba(249,240,240,.06)',
                    border:'1px dashed rgba(249,240,240,.2)',
                    color:'rgba(249,240,240,.75)', fontSize:13, fontFamily:'inherit',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  }}>
                  <Icon name="attach" size={16}/>
                  Прикрепить файл или скриншот
                </button>
              )}
              <div style={{ color:'rgba(249,240,240,.28)', fontSize:11, marginTop:6 }}>
                JPG, PNG, PDF, DOC — до {MAX_ATTACH_MB} МБ
              </div>
            </div>

            {status === 'error' && (
              <div style={{color:'rgba(255,140,140,.8)',fontSize:13,
                background:'rgba(200,50,50,.12)',borderRadius:10,padding:'10px 14px'}}>
                Не удалось отправить. Проверьте соединение и попробуйте снова.
              </div>
            )}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingBottom:4}}>
              <button onClick={onClose}
                style={{padding:'11px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
                  background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.14)',
                  color:'rgba(249,240,240,.75)'}}>
                Отмена
              </button>
              <button onClick={send}
                disabled={!canSend}
                style={{
                  padding:'11px 28px',borderRadius:14,fontSize:14,fontWeight:600,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  background: canSend ? 'rgba(95, 64, 128,.8)' : 'rgba(249,240,240,.07)',
                  border:'none',
                  color: canSend ? '#F9F0F0' : 'rgba(249,240,240,.3)',
                  transition:'all .2s'
                }}>
                {status === 'sending' ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackModal;
