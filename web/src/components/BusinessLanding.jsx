// BusinessLanding.jsx — презентация бизнес-возможностей HEY.
// Доступна всем залогиненным юзерам. Внизу — action area по статусу заявки.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { heyToast, useConfirm } from './Screens';

const card = {
  background: 'rgba(20,12,40,.65)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 16,
  padding: '20px 22px',
  marginBottom: 16,
  backdropFilter: 'blur(8px)',
};

const FEATURES = [
  {
    icon: '📨',
    title: 'Авто-инвайт ученику',
    text: 'После оплаты курса в АВО ученик получает ссылку. Регистрируется в HEY — и сразу оказывается в чате своего курса.',
  },
  {
    icon: '🏷',
    title: 'Маппинг курс → чат',
    text: 'Настраиваешь связь «курс из АВО» ↔ «групповой чат HEY». Дальше — автоматически.',
  },
  {
    icon: '🎓',
    title: 'Официальный аккаунт школы',
    text: 'Приветствия в чате и контакт у новых учеников идут от твоего имени.',
  },
  {
    icon: '✨',
    title: 'Виджет HEY в ЛК АВО',
    text: 'Маленькая иконка с числом непрочитанных в личном кабинете ученика — клик переключает на HEY.',
  },
  {
    icon: '📊',
    title: 'Лог входящих webhook’ов',
    text: 'Видишь все обработанные оплаты, причину если ученика не пустили в чат, можешь отладить.',
  },
  {
    icon: '🔐',
    title: 'Изолированные школы',
    text: 'У каждой школы свой webhook-токен, свой набор курсов и свой аккаунт. До 3 школ на один HEY-аккаунт.',
  },
];

const STEPS = [
  ['1', 'Подаёшь заявку', 'Откроется форма с короткой заметкой о себе. Админ HEY рассмотрит её.'],
  ['2', 'Админ одобряет', 'Обычно в течение суток. Получишь уведомление.'],
  ['3', 'Создаёшь школу', 'В разделе «Мои школы» → «+ Создать». Получаешь webhook URL и токен.'],
  ['4', 'Вставляешь URL в АВО', 'Бизнес-процесс «Отправить запрос на URL» по событию оплаты (id_account_status=5).'],
  ['5', 'Маппишь курсы на чаты', 'Создаёшь групповые чаты в HEY, мапишь их на названия курсов.'],
  ['6', 'Виджет (опционально)', 'Вставляешь snippet в редактор скриптов ЛК АВО — получаешь кнопку HEY в ЛК.'],
];

export default function BusinessLanding() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customConfirm, confirmModal] = useConfirm();
  const status = user?.business_status || 'none';
  const isApproved = user?.is_admin || status === 'approved';

  async function submitRequest() {
    setSubmitting(true);
    try {
      await api.requestBusinessAccess(note || null);
      setUser(u => ({ ...u, business_status: 'pending' }));
      setShowForm(false);
      setNote('');
      heyToast('Заявка отправлена. Админ её рассмотрит.', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
    setSubmitting(false);
  }
  async function cancelRequest() {
    if (!await customConfirm('Отозвать заявку?')) return;
    try {
      await api.cancelBusinessRequest();
      setUser(u => ({ ...u, business_status: 'none' }));
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad, #0e0820)', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'rgba(14,8,32,.95)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{ maxWidth:780, margin:'0 auto', padding:'14px 24px',
          display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => nav('/me')}
            style={{
              background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)',
              color:'rgba(225,220,245,.95)', borderRadius:10, padding:'6px 12px',
              fontSize:13, cursor:'pointer', fontFamily:'inherit',
            }}>‹ К профилю</button>
          <div style={{ color:'white', fontSize:16, fontWeight:700 }}>HEY для бизнеса</div>
        </div>
      </div>

      <div style={{ maxWidth:780, margin:'0 auto', padding:'28px 24px' }}>

        {/* Hero */}
        <div style={{ marginBottom:28, textAlign:'center' }}>
          <div style={{ fontSize:46, marginBottom:8 }}>🎓</div>
          <h1 style={{ color:'white', fontSize:30, fontWeight:800, margin:'0 0 10px', letterSpacing:-.4 }}>
            Подключи свою школу к HEY
          </h1>
          <p style={{ color:'rgba(225,220,245,.85)', fontSize:15, lineHeight:1.6, margin:0 }}>
            HEY — мессенджер, где ученики и преподаватели общаются в реальном времени. Если ты ведёшь
            онлайн-школу, мастер-классы или курсы и пользуешься АвтоВебОфисом — мы автоматизируем доступ
            учеников в твои чаты после каждой оплаты.
          </p>
        </div>

        {/* Features grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12, marginBottom:24 }}>
          {FEATURES.map((f,i) => (
            <div key={i} style={card}>
              <div style={{ fontSize:26, marginBottom:6 }}>{f.icon}</div>
              <div style={{ color:'white', fontSize:15, fontWeight:700, marginBottom:5 }}>{f.title}</div>
              <div style={{ color:'rgba(225,220,245,.78)', fontSize:13, lineHeight:1.5 }}>{f.text}</div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={card}>
          <div style={{ color:'rgba(225,220,245,.7)', fontSize:11, fontWeight:700,
            textTransform:'uppercase', letterSpacing:.6, marginBottom:14 }}>
            Как это работает
          </div>
          {STEPS.map(([n,t,d]) => (
            <div key={n} style={{ display:'flex', gap:14, marginBottom:14 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg,#6b46c1,#a78bfa)',
                color:'white', fontSize:14, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{n}</div>
              <div style={{ flex:1 }}>
                <div style={{ color:'white', fontSize:14, fontWeight:700, marginBottom:2 }}>{t}</div>
                <div style={{ color:'rgba(225,220,245,.78)', fontSize:13, lineHeight:1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Limits */}
        <div style={{
          background:'rgba(120,90,200,.12)', border:'1px solid rgba(180,140,220,.3)',
          borderRadius:14, padding:'14px 18px', marginBottom:24,
          color:'rgba(225,220,245,.85)', fontSize:13, lineHeight:1.6,
        }}>
          <strong style={{ color:'white' }}>Ограничения для бизнес-пользователей:</strong>
          <ul style={{ margin:'8px 0 0', paddingLeft:20 }}>
            <li>До 3 школ на один HEY-аккаунт</li>
            <li>В качестве официального аккаунта школы можно привязать только себя</li>
            <li>Маппить курсы можно только на групповые чаты, где ты сам админ группы</li>
          </ul>
        </div>

        {/* Action area по статусу */}
        {isApproved ? (
          <div style={{
            background:'linear-gradient(135deg,rgba(60,180,100,.25),rgba(110,235,150,.15))',
            border:'1px solid rgba(110,235,150,.4)',
            borderRadius:14, padding:'18px 22px', textAlign:'center',
          }}>
            <div style={{ color:'rgba(140,240,180,1)', fontSize:14, fontWeight:700, marginBottom:8 }}>
              ✓ Доступ открыт
            </div>
            <button onClick={() => nav('/integrations/awo')}
              style={{
                padding:'12px 26px', borderRadius:12, border:'none',
                background:'rgba(140,110,220,.9)', color:'white',
                fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                boxShadow:'0 4px 14px rgba(120,90,200,.35)',
              }}>
              Открыть «Мои школы» →
            </button>
          </div>
        ) : status === 'pending' ? (
          <div style={{
            background:'rgba(255,200,120,.12)', border:'1px solid rgba(255,200,120,.35)',
            borderRadius:14, padding:'16px 18px', textAlign:'center',
          }}>
            <div style={{ color:'rgba(255,210,140,1)', fontSize:14, fontWeight:700, marginBottom:8 }}>
              🕓 Заявка на рассмотрении
            </div>
            <div style={{ color:'rgba(225,220,245,.85)', fontSize:13, lineHeight:1.5, marginBottom:12 }}>
              Админ скоро её посмотрит. Можешь отозвать если передумал.
            </div>
            <button onClick={cancelRequest}
              style={{
                padding:'8px 18px', borderRadius:10,
                background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.18)',
                color:'rgba(225,220,245,.9)', fontSize:13, fontWeight:600, cursor:'pointer',
                fontFamily:'inherit',
              }}>Отозвать заявку</button>
          </div>
        ) : status === 'rejected' ? (
          <div style={{
            background:'rgba(200,80,80,.15)', border:'1px solid rgba(255,140,140,.35)',
            borderRadius:14, padding:'16px 18px',
          }}>
            <div style={{ color:'rgba(255,180,180,1)', fontSize:14, fontWeight:700, marginBottom:6 }}>
              ⚠ Предыдущая заявка отклонена
            </div>
            {user?.business_reject_reason && (
              <div style={{ color:'rgba(225,220,245,.85)', fontSize:13, lineHeight:1.5, marginBottom:12 }}>
                Причина: {user.business_reject_reason}
              </div>
            )}
            <button onClick={() => setShowForm(true)}
              style={{
                padding:'10px 22px', borderRadius:12, border:'none',
                background:'rgba(140,110,220,.85)', color:'white',
                fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>Подать заявку заново</button>
          </div>
        ) : (
          <div style={{ textAlign:'center' }}>
            <button onClick={() => setShowForm(true)}
              style={{
                padding:'14px 36px', borderRadius:14, border:'none',
                background:'rgba(140,110,220,.9)', color:'white',
                fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                boxShadow:'0 6px 20px rgba(120,90,200,.4)',
              }}>
              Подать заявку на бизнес-доступ
            </button>
          </div>
        )}
      </div>

      {/* Заявочная форма */}
      {showForm && (
        <div style={{
          position:'fixed', inset:0, zIndex:900,
          background:'rgba(0,0,0,.72)', backdropFilter:'blur(16px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{
            background:'rgba(22,15,50,.98)', borderRadius:18,
            border:'1px solid rgba(255,255,255,.14)',
            width:'min(94vw, 460px)', padding:'24px 26px',
            boxShadow:'0 20px 60px rgba(0,0,0,.55)',
          }}>
            <h2 style={{ margin:0, color:'white', fontSize:18, fontWeight:800, marginBottom:12 }}>
              🎓 Заявка на бизнес-доступ
            </h2>
            <p style={{ color:'rgba(225,220,245,.85)', fontSize:13, lineHeight:1.55, marginTop:0, marginBottom:14 }}>
              Расскажи коротко о своей школе или проекте — это поможет админу быстрее одобрить.
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value.slice(0,500))}
              placeholder="Например: онлайн-школа театра LIBERTAD, 200 учеников, продажи через АвтоВебОфис"
              rows={4} style={{
                width:'100%', boxSizing:'border-box',
                background:'rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.18)',
                borderRadius:10, padding:'10px 12px', color:'white', fontSize:13,
                fontFamily:'inherit', outline:'none', resize:'vertical', lineHeight:1.5,
              }}/>
            <div style={{ color:'rgba(225,220,245,.55)', fontSize:11, marginTop:4, textAlign:'right' }}>
              {note.length}/500
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => setShowForm(false)} disabled={submitting}
                style={{
                  flex:1, padding:'11px', borderRadius:12,
                  border:'1px solid rgba(255,255,255,.18)',
                  background:'rgba(255,255,255,.06)', color:'rgba(225,220,245,.9)',
                  fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                }}>Отмена</button>
              <button onClick={submitRequest} disabled={submitting}
                style={{
                  flex:1, padding:'11px', borderRadius:12, border:'none',
                  background:'rgba(140,110,220,.9)', color:'white',
                  fontSize:14, fontWeight:700, cursor: submitting ? 'wait' : 'pointer',
                  fontFamily:'inherit', boxShadow:'0 4px 14px rgba(120,90,200,.35)',
                }}>{submitting ? '…' : 'Отправить'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal}
    </div>
  );
}
