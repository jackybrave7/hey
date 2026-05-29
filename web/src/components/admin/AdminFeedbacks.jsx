// AdminFeedbacks.jsx — обращения пользователей через «Написать разработчику».
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
  });
}

const STATUS_LABELS = {
  open:      { l: 'Новое',     color: 'rgba(255,200,100,.95)' },
  done:      { l: 'Обработано', color: 'rgba(100,220,140,.95)' },
  dismissed: { l: 'Отклонено',  color: 'rgba(180,180,180,.85)' },
};

const TYPE_LABELS = {
  bug:    '🐛 Баг',
  idea:   '💡 Идея',
  thanks: '🙏 Спасибо',
  question: '❓ Вопрос',
  other:  '✉ Общее',
};

const TABS = [
  { v: 'open',      l: 'Новые' },
  { v: 'done',      l: 'Обработано' },
  { v: 'dismissed', l: 'Отклонённые' },
  { v: 'all',       l: 'Все' },
];

export default function AdminFeedbacks() {
  const [list, setList]       = useState([]);
  const [status, setStatus]   = useState('open');
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');
  const [customConfirm, confirmModal, customPrompt] = useConfirm();

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function load() {
    setLoading(true);
    try { setList(await api.adminGetFeedbacks(status)); }
    catch (e) { showToast('Ошибка: ' + e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [status]);

  async function resolve(f, action) {
    const isReopen = action === 'open';
    const labelMap = { done: 'обработано', dismissed: 'отклонено', open: 'снова открыто' };
    let note = null;
    if (action !== 'open') {
      note = await customPrompt(
        <>
          <div style={{fontWeight:600,marginBottom:8}}>
            Пометить как «{labelMap[action]}»?
          </div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:4}}>
            «{(f.text || '').slice(0, 120)}{(f.text || '').length > 120 ? '…' : ''}»
          </div>
        </>,
        { promptPlaceholder: 'Внутренний комментарий (необязательно)', confirmLabel: 'OK', danger: action === 'dismissed' }
      );
      if (note === null) return;
    } else {
      if (!await customConfirm('Снова открыть это обращение?', { confirmLabel: 'Открыть' })) return;
    }
    try {
      await api.adminResolveFeedback(f.id, action, note || undefined);
      showToast(isReopen ? '↩ Открыто' : '✓ ' + labelMap[action]);
      load();
    } catch (e) { showToast('Ошибка: ' + e.message); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <h1 style={{ color:'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        ✉ Обращения пользователей
      </h1>
      <p style={{ color:'rgba(225,220,245,.85)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Что прислали пользователи через «Написать разработчику» — баги, идеи, вопросы.
      </p>

      <div style={{ display:'flex', gap: 8, marginBottom: 20, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setStatus(t.v)}
            style={{
              padding:'9px 16px', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit',
              background: status === t.v ? 'rgba(140,110,220,.85)' : 'rgba(20,12,40,.5)',
              border:   status === t.v ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(255,255,255,.12)',
              color:    status === t.v ? 'white' : 'rgba(225,220,245,.85)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:'rgba(225,220,245,.75)', fontSize:14 }}>Загрузка…</div>
      ) : list.length === 0 ? (
        <div style={{ padding:'40px 20px', textAlign:'center',
          background:'rgba(20,12,40,.5)', borderRadius:14,
          border:'1px dashed rgba(255,255,255,.15)',
          color:'rgba(225,220,245,.85)', fontSize:14 }}>
          {status === 'open' ? '✓ Новых обращений нет' : 'Пусто'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          {list.map(f => {
            const st = STATUS_LABELS[f.status] || STATUS_LABELS.open;
            const isAnonymous = !f.user_id;
            return (
              <div key={f.id} style={{
                background:'rgba(20,12,40,.65)',
                border:'1px solid rgba(255,255,255,.14)',
                borderRadius: 14, padding: 16,
                boxShadow:'0 4px 14px rgba(0,0,0,.15)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                  <span style={{
                    background:'rgba(255,255,255,.08)', borderRadius:6,
                    padding:'3px 9px', fontSize:11, fontWeight:700,
                    color:'rgba(240,235,255,.95)',
                  }}>{TYPE_LABELS[f.type] || ('✉ ' + (f.type || 'общее'))}</span>
                  <span style={{
                    background:'rgba(0,0,0,.25)', borderRadius:6,
                    padding:'3px 9px', fontSize:11, fontWeight:700,
                    color: st.color,
                  }}>{st.l}</span>
                  <span style={{ color:'rgba(225,220,245,.75)', fontSize:12 }}>
                    {fmtDate(f.created_at)}
                  </span>
                </div>

                {/* Автор */}
                <div style={{
                  display:'flex', alignItems:'center', gap:8, marginBottom:8,
                  color:'rgba(225,220,245,.85)', fontSize:13, flexWrap:'wrap',
                }}>
                  <span style={{ color:'rgba(225,220,245,.75)' }}>от</span>
                  {isAnonymous ? (
                    <strong style={{ color:'rgba(200,200,210,.85)', fontWeight:600, fontStyle:'italic' }}>
                      Аноним
                    </strong>
                  ) : (
                    <>
                      <strong style={{ color:'rgba(220,200,255,.95)', fontWeight:600 }}>
                        {f.current_name || f.name || '—'}
                        {f.user_is_deleted ? ' (удалён)' : ''}
                      </strong>
                      <span style={{ color:'rgba(225,220,245,.55)' }}>
                        {f.current_phone || f.phone || ''}
                      </span>
                    </>
                  )}
                </div>

                {/* Текст */}
                <div style={{
                  background:'rgba(0,0,0,.25)', borderRadius:10, padding:'12px 14px',
                  color:'rgba(240,235,255,.95)', fontSize:14, lineHeight:1.55,
                  whiteSpace:'pre-wrap', wordBreak:'break-word', marginBottom:14,
                }}>{f.text}</div>

                {f.admin_note && (
                  <div style={{
                    background:'rgba(120,90,200,.10)', borderRadius:10, padding:'10px 14px',
                    color:'rgba(220,200,255,.85)', fontSize:13, lineHeight:1.5,
                    border:'1px solid rgba(140,110,220,.25)',
                    whiteSpace:'pre-wrap', wordBreak:'break-word', marginBottom:14,
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, opacity:.7, marginBottom:4 }}>
                      Заметка администратора
                    </div>
                    {f.admin_note}
                  </div>
                )}

                {/* Действия */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {f.status === 'open' && (
                    <>
                      <button onClick={() => resolve(f, 'done')}
                        style={{
                          padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600,
                          cursor:'pointer', border:'none', fontFamily:'inherit',
                          background:'rgba(60,180,100,.25)', color:'rgba(140,240,180,.95)',
                        }}>
                        ✓ Обработано
                      </button>
                      <button onClick={() => resolve(f, 'dismissed')}
                        style={{
                          padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600,
                          cursor:'pointer', border:'1px solid rgba(255,255,255,.15)',
                          background:'rgba(255,255,255,.08)', color:'rgba(240,235,255,.95)',
                          fontFamily:'inherit',
                        }}>
                        Отклонить
                      </button>
                    </>
                  )}
                  {f.status !== 'open' && (
                    <button onClick={() => resolve(f, 'open')}
                      style={{
                        padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600,
                        cursor:'pointer', border:'1px solid rgba(255,255,255,.15)',
                        background:'rgba(255,255,255,.08)', color:'rgba(240,235,255,.95)',
                        fontFamily:'inherit',
                      }}>
                      ↩ Снова открыть
                    </button>
                  )}
                  {f.user_id && (
                    <a href={`/admin/users/${f.user_id}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600,
                        textDecoration:'none',
                        background:'rgba(120,90,200,.25)', color:'rgba(220,200,255,.95)',
                        border:'1px solid rgba(180,140,220,.3)',
                      }}>
                      → Карточка юзера ↗
                    </a>
                  )}
                </div>

                {f.status !== 'open' && f.handled_at && (
                  <div style={{ color:'rgba(225,220,245,.8)', fontSize:12, marginTop:10,
                    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span>{f.status === 'done' ? '✓ Обработано' : '◇ Отклонено'}</span>
                    <span>·</span>
                    <span>{fmtDate(f.handled_at)}</span>
                    {f.handled_by_name && (
                      <>
                        <span>·</span>
                        <span>администратор{' '}
                          <strong style={{ color:'rgba(200,180,255,.95)', fontWeight:600 }}>
                            {f.handled_by_name}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)',
          background:'rgba(22,15,50,.97)', border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50, padding:'10px 20px', color:'white', fontSize:14, fontWeight:600,
          zIndex:1000, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
      {confirmModal}
    </div>
  );
}
