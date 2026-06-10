import { useState } from 'react';
import { api } from '../../api';
import Icon from '../Icon';

const FEEDBACK_TYPES = [
  { id: 'bug',       label: 'Ошибка', icon: 'alert' },
  { id: 'idea',      label: 'Идея',   icon: 'sparkle' },
  { id: 'complaint', label: 'Жалоба', icon: 'flag' },
  { id: 'other',     label: 'Другое', icon: 'mail' },
];

function FeedbackModal({ onClose }) {
  const [type,    setType]    = useState('idea');
  const [text,    setText]    = useState('');
  const [status,  setStatus]  = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  async function send() {
    if (!text.trim()) return;
    setStatus('sending');
    try {
      await api.sendFeedback({ type, text: text.trim() });
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
        {/* Header */}
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
            {/* Type selector */}
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

            {/* Text */}
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
                onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
                onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.14)'}
              />
              <div style={{color:'rgba(249,240,240,.25)',fontSize:11,marginTop:4,textAlign:'right'}}>
                {text.length} симв.
              </div>
            </div>

            {status === 'error' && (
              <div style={{color:'rgba(255,140,140,.8)',fontSize:13,
                background:'rgba(200,50,50,.12)',borderRadius:10,padding:'10px 14px'}}>
                Не удалось отправить. Проверьте соединение и попробуйте снова.
              </div>
            )}

            {/* Actions */}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingBottom:4}}>
              <button onClick={onClose}
                style={{padding:'11px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
                  background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.14)',
                  color:'rgba(249,240,240,.75)'}}>
                Отмена
              </button>
              <button onClick={send}
                disabled={!text.trim() || status==='sending'}
                style={{
                  padding:'11px 28px',borderRadius:14,fontSize:14,fontWeight:600,
                  cursor: text.trim() && status!=='sending' ? 'pointer' : 'not-allowed',
                  background: text.trim() && status!=='sending'
                    ? 'rgba(95, 64, 128,.8)' : 'rgba(249,240,240,.07)',
                  border:'none',
                  color: text.trim() && status!=='sending' ? '#F9F0F0' : 'rgba(249,240,240,.3)',
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
