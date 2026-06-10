import { useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';

function ScheduleModal({ defaultValue, onCancel, onSubmit }) {
  const [val, setVal] = useState(defaultValue);
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position:'fixed', inset:0, zIndex:10000,
        background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{
        background:'rgba(22,15,50,.98)', borderRadius:18, padding:'22px 22px 18px',
        width:'min(94vw, 380px)', boxShadow:'0 20px 60px rgba(0,0,0,.55)',
        border:'1px solid rgba(249,240,240,.1)',
      }}>
        <div style={{ color:'#F9F0F0', fontSize: 17, fontWeight: 700, marginBottom: 6,
          display:'flex', alignItems:'center', gap: 8 }}>
          <Icon name="calendar" size={18} /> Отправить позже
        </div>
        <div style={{ color:'rgba(249,240,240,.55)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          Сообщение уйдёт в этот чат автоматически в выбранное время.
          Минимум — через минуту от сейчас.
        </div>
        <input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)}
          style={{
            width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius: 10,
            background:'rgba(0,0,0,.4)', border:'1px solid rgba(249,240,240,.18)',
            color:'#F9F0F0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            marginBottom: 16, colorScheme: 'dark',
          }}/>
        <div style={{ display:'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding:'11px', borderRadius: 12,
              background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.14)',
              color:'rgba(249,240,240,.7)', fontSize: 14, fontWeight: 600,
              cursor:'pointer', fontFamily: 'inherit' }}>
            Отмена
          </button>
          <button onClick={() => onSubmit(val)}
            style={{ flex: 2, padding:'11px', borderRadius: 12,
              background:'rgba(140,110,220,.9)', border:'1px solid rgba(180,140,220,.4)',
              color:'#F9F0F0', fontSize: 14, fontWeight: 700,
              cursor:'pointer', fontFamily: 'inherit' }}>
            Запланировать
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function toLocalInputValue(ts) {
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduledEditModal({ item, onCancel, onSubmit }) {
  const [text, setText] = useState(item.text || '');
  const [sendAt, setSendAt] = useState(toLocalInputValue(item.send_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hasAttachment = !!item.attachment;
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit({ text, sendAt });
    } catch (e) {
      setError(e.message === 'bad time' ? 'Выбери время хотя бы через минуту' : (e.message || 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position:'fixed', inset:0, zIndex:10000,
        background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{
        background:'rgba(22,15,50,.98)', borderRadius:18, padding:'22px 22px 18px',
        width:'min(94vw, 420px)', boxShadow:'0 20px 60px rgba(0,0,0,.55)',
        border:'1px solid rgba(249,240,240,.1)',
      }}>
        <div style={{ color:'#F9F0F0', fontSize: 17, fontWeight: 700, marginBottom: 6,
          display:'flex', alignItems:'center', gap: 8 }}>
          <Icon name="edit" size={18} /> Редактировать отложенное
        </div>
        <div style={{ color:'rgba(249,240,240,.55)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          Можно изменить текст и время отправки. Вложение останется прежним.
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={hasAttachment ? 'Подпись к вложению' : 'Текст сообщения'}
          rows={4}
          style={{
            width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius: 10,
            background:'rgba(0,0,0,.4)', border:'1px solid rgba(249,240,240,.18)',
            color:'#F9F0F0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            marginBottom: 10, resize:'vertical',
          }}/>
        <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)}
          style={{
            width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius: 10,
            background:'rgba(0,0,0,.4)', border:'1px solid rgba(249,240,240,.18)',
            color:'#F9F0F0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            marginBottom: 16, colorScheme: 'dark',
          }}/>
        {error && (
          <div style={{ color:'rgba(255,170,170,.95)', fontSize: 12, margin:'-6px 0 12px' }}>
            {error}
          </div>
        )}
        <div style={{ display:'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ flex: 1, padding:'11px', borderRadius: 12,
              background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.14)',
              color:'rgba(249,240,240,.7)', fontSize: 14, fontWeight: 600,
              cursor:'pointer', fontFamily: 'inherit' }}>
            Отмена
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding:'11px', borderRadius: 12,
              background:'rgba(140,110,220,.9)', border:'1px solid rgba(180,140,220,.4)',
              color:'#F9F0F0', fontSize: 14, fontWeight: 700,
              cursor:'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Индикатор + раскрывающийся список запланированных сообщений в чате.
// Закрытый — одна тонкая строка над композером. Открытый — карточка с
// каждой записью и кнопкой «отменить».
function ScheduledList({ items, onCancel, onEdit }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const n = items.length;
  if (!n) return null;
  return (
    <div style={{
      margin:'0 4px 6px', borderRadius: 12,
      background:'rgba(140,110,220,.10)',
      border:'1px solid rgba(180,140,220,.22)',
    }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width:'100%', padding:'8px 12px', background:'transparent',
          border:'none', cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', gap: 8,
          color:'rgba(220,200,255,.95)', fontSize: 12, textAlign:'left' }}>
        <span style={{display:'inline-flex'}}><Icon name="calendar" size={14} /></span>
        <span style={{ flex: 1 }}>
          {n === 1 ? 'Одно запланированное сообщение' : `Запланировано: ${n}`}
        </span>
        <span style={{ opacity: .6, transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}>⌃</span>
      </button>
      {open && (
        <div style={{
          padding:'4px 8px 8px', display:'flex', flexDirection:'column', gap: 6,
          maxHeight: 220, overflowY:'auto',
        }}>
          {items.map(s => {
            const at = new Date(s.send_at * 1000);
            const att = s.attachment;
            // Превью миниатюры вложения: одиночное фото, первое из галереи,
            // эмодзи-иконка для файла. Для аудио — иконка нот.
            let thumb = null, badge = null, badgeIcon = null;
            if (att?.type === 'image' && att.url) {
              thumb = att.url;
            } else if (att?.type === 'images' && Array.isArray(att.urls) && att.urls[0]) {
              thumb = att.urls[0];
              badge = `+${att.urls.length - 1}`;
            } else if (att?.type === 'file') {
              badgeIcon = 'attach';
            } else if (att?.type === 'audio') {
              badgeIcon = 'mic';
            }
            return (
              <div key={s.id} style={{
                display:'flex', alignItems:'flex-start', gap: 10,
                padding:'8px 10px', borderRadius: 10,
                background:'rgba(249,240,240,.05)',
                border:'1px solid rgba(249,240,240,.08)',
              }}>
                {(thumb || badge || badgeIcon) && (
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: thumb ? '#0a0518' : 'rgba(95, 64, 128,.25)',
                    overflow: 'hidden', position: 'relative',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'rgba(220,200,255,.9)',
                  }}>
                    {thumb
                      ? <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : badgeIcon
                        ? <Icon name={badgeIcon} size={20} />
                        : <span style={{ fontSize: 20 }}>{badge}</span>}
                    {thumb && badge && (
                      <span style={{ position:'absolute', right: 2, bottom: 2,
                        background:'rgba(0,0,0,.65)', color:'#F9F0F0',
                        fontSize: 10, fontWeight: 700, padding:'1px 5px', borderRadius: 6 }}>
                        {badge}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color:'rgba(220,200,255,.75)', fontSize: 11, marginBottom: 3 }}>
                    {at.toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ color:'#F9F0F0', fontSize: 13, lineHeight: 1.4,
                    overflow:'hidden', display:'-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient:'vertical' }}>
                    {s.text || (att?.type === 'file' ? (att.name || 'файл')
                              : att?.type === 'audio' ? 'голосовое'
                              : att?.type ? 'изображение' : '(пусто)')}
                  </div>
                </div>
                <div style={{ display:'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setEditing(s)}
                    title="Редактировать"
                    style={{ background:'rgba(249,240,240,.08)',
                      border:'1px solid rgba(249,240,240,.16)',
                      color:'rgba(220,200,255,.95)',
                      borderRadius: 8, padding:'5px 7px',
                      cursor:'pointer', fontFamily:'inherit', display:'inline-flex' }}>
                    <Icon name="edit" size={13}/>
                  </button>
                  <button onClick={() => onCancel(s.id)}
                    title="Отменить"
                    style={{ background:'rgba(200,60,60,.18)',
                      border:'1px solid rgba(255,120,120,.35)',
                      color:'rgba(255,180,180,.95)',
                      borderRadius: 8, padding:'4px 8px', fontSize: 12,
                      cursor:'pointer', fontFamily:'inherit', flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <ScheduledEditModal
          item={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (data) => {
            await onEdit(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
export { ScheduleModal, ScheduledList };
