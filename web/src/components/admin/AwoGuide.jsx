// AwoGuide.jsx — пошаговое руководство по настройке АВО-интеграции.
// Используется внутри /admin/awo/:tenantId и /integrations/awo/:tenantId.
import { useState } from 'react';

const cardStyle = {
  background: 'rgba(20,12,40,.65)',
  border: '1px solid rgba(249,240,240,.12)',
  borderRadius: 14,
  padding: '20px 22px',
  marginBottom: 18,
  backdropFilter: 'blur(8px)',
};
const codeStyle = {
  background: 'rgba(0,0,0,.45)', padding: '2px 6px', borderRadius: 4,
  color: 'rgba(200,220,255,1)', fontSize: 12,
  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
};
const blockCodeStyle = {
  background: 'rgba(0,0,0,.5)', padding: '10px 12px', borderRadius: 8,
  color: 'rgba(200,220,255,1)', fontSize: 12, lineHeight: 1.6,
  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  border: '1px solid rgba(249,240,240,.08)',
};

const SECTIONS = [
  {
    id: 'overview',
    title: '📖 Что это и для кого',
    content: () => (
      <>
        <p>HEY-АВО интеграция — это автоматический мост между твоим АвтоВебОфисом и групповыми чатами в HEY.
          После того как ученик оплатил курс в АВО:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>HEY ловит webhook → создаёт школьное приглашение по email</li>
          <li>Ученик получает /join-ссылку (через email от АВО) → регистрируется в HEY</li>
          <li>Автоматически добавляется в чат курса и в контакты к школьному аккаунту</li>
        </ul>
      </>
    ),
  },
  {
    id: 'step1',
    title: '🏫 Шаг 1: создание школы',
    content: () => (
      <>
        <p>На главной странице раздела нажми <strong style={{color:'#F9F0F0'}}>«+ Создать школу»</strong>,
          введи название (например «Театр-лаборатория LIBERTAD»). После создания ты попадёшь на страницу
          её настроек и увидишь сгенерированные:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li><strong>Webhook URL</strong> — куда АВО будет слать оплаты</li>
          <li><strong>Токен</strong> — встроен в URL, защищает от чужих запросов</li>
        </ul>
      </>
    ),
  },
  {
    id: 'step2',
    title: '⚙ Шаг 2: настройка АВО (webhook)',
    content: () => (
      <>
        <p>В АвтоВебОфисе зайди в раздел бизнес-процессов или вебхуков (точный путь зависит от тарифа).
          Создай новый сценарий:</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li><strong>Событие:</strong> «Изменился статус счёта»</li>
          <li><strong>Условие:</strong> статус = «Оплачен» (<span style={codeStyle}>id_account_status = 5</span>)</li>
          <li><strong>Действие:</strong> «Отправить HTTP запрос (webhook)»</li>
          <li><strong>Метод:</strong> POST</li>
          <li><strong>URL:</strong> вставь сюда Webhook URL из настроек школы (он целиком с токеном)</li>
          <li><strong>Формат:</strong> JSON всех полей счёта (нативный для АВО, ничего настраивать не нужно)</li>
        </ol>
        <p>Сохрани и активируй. Теперь каждая оплата автоматически уходит в HEY.</p>
      </>
    ),
  },
  {
    id: 'step3',
    title: '💬 Шаг 3: создать чат курса',
    content: () => (
      <>
        <p>В HEY на странице чатов нажми три точки → <strong style={{color:'#F9F0F0'}}>«Новая группа»</strong>.
          Назови чат именем курса (или короче — как удобно). Стань его админом (это происходит автоматически
          при создании).</p>
        <p style={{color:'rgba(225,220,245,.7)',fontSize:13}}>
          Для бизнес-пользователей: маппить можно только те чаты, где ты сам админ.
        </p>
      </>
    ),
  },
  {
    id: 'step4',
    title: '🔗 Шаг 4: маппинг курс ↔ чат',
    content: () => (
      <>
        <p>В настройках школы найди блок <strong style={{color:'#F9F0F0'}}>«Курс → групповой чат»</strong>:</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>В поле «Название курса в АВО» введи точное название товара/курса из АВО</li>
          <li>Выбери из выпадающего списка чат, в который надо добавлять учеников</li>
          <li>Жми «Добавить»</li>
        </ol>
        <p><strong style={{color:'#F9F0F0'}}>Подстрочный матч:</strong> можно указать ЧАСТЬ названия. Например:</p>
        <div style={blockCodeStyle}>Маппинг: «поток 5 (участник)»
Подходит под «Зум-актёрский курс — поток 5 (участник)»
И под «Театр-актёрский — поток 5 (участник)»</div>
        <p style={{marginTop:10}}>В одной школе может быть несколько маппингов — на каждый курс свой чат.</p>
      </>
    ),
  },
  {
    id: 'step5',
    title: '🎓 Шаг 5: официальный аккаунт школы',
    content: () => (
      <>
        <p>В блоке <strong style={{color:'#F9F0F0'}}>«Официальный аккаунт школы»</strong> привяжи себя
          (для бизнес-пользователей доступно только это):</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Введи в поиске свой телефон или часть имени</li>
          <li>Выбери себя из списка → подтверди</li>
        </ul>
        <p>Теперь:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Ты автоматически появляешься в контактах каждого нового ученика</li>
          <li>В чате курса от твоего имени появляется «🎓 X присоединился к курсу «Y»»</li>
        </ul>
      </>
    ),
  },
  {
    id: 'step6',
    title: '🚫 Шаг 6: стоп-слова для доступа к чату',
    content: () => (
      <>
        <p>В настройках школы есть поле <strong style={{color:'#F9F0F0'}}>«Стоп-слова»</strong> (по умолчанию:{' '}
          <span style={codeStyle}>слушатель, запись</span>). Если в названии купленного курса есть хоть одно
          из этих слов — ученик получит школьный инвайт и зарегистрируется в HEY, но в чат курса попадать
          не будет.</p>
        <p>Используй чтобы разделить тарифы: «Зум-курс участник» → в чат, «Зум-курс слушатель/запись» → без чата.</p>
      </>
    ),
  },
  {
    id: 'step7',
    title: '🧪 Шаг 7: тестирование',
    content: () => (
      <>
        <p>В блоке <strong style={{color:'#F9F0F0'}}>«Тестовый режим»</strong> можно ограничиться одним курсом,
          чтобы безопасно проверить интеграцию без риска для боевых учеников:</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Включи «Тестовый режим»</li>
          <li>Введи название тестового курса в АВО</li>
          <li>Сделай тестовый счёт в АВО (можно со скидкой 100%) и оплати</li>
          <li>Проверь в HEY блок «Последние webhook'ы» — должна появиться запись с результатом{' '}
            <span style={codeStyle}>invite_created</span> или <span style={codeStyle}>user_exists_added_to_chat</span></li>
          <li>Открой /join?email=… из лога — должна открыться форма регистрации</li>
        </ol>
        <p style={{color:'rgba(225,220,245,.7)',fontSize:13}}>
          После проверки — выключи тестовый режим, теперь все курсы обрабатываются.
        </p>
      </>
    ),
  },
  {
    id: 'step8',
    title: '✨ Шаг 8 (опционально): виджет в ЛК АВО',
    content: () => (
      <>
        <p>В личном кабинете АВО есть поле «Редактирование скриптов для кабинета ученика». Вставь туда
          сниппет для появления плавающего HEY-виджета (счётчик непрочитанных + клик переключает на HEY):</p>
        <div style={blockCodeStyle}>{`<script>window.HEY_USER_EMAIL = "{email}";</script>
<script src="https://hey-messenger.ru/widget.js"></script>`}</div>
        <p style={{marginTop:10}}>
          <code style={codeStyle}>{'{email}'}</code> — это плейсхолдер АВО, он автоматически подставит email
          конкретного ученика. Виджет показывает счётчик только если у ученика есть активная сессия в HEY
          в этом же браузере.
        </p>
      </>
    ),
  },
  {
    id: 'faq',
    title: '❓ Частые вопросы',
    content: () => (
      <>
        <p><strong style={{color:'#F9F0F0'}}>Что если ученик уже зарегистрирован в HEY?</strong><br/>
          При новой оплате он молча добавится в чат курса и получит сообщение «🎓 X присоединился к курсу».
          Дублирующего инвайта не будет — система находит его по email.</p>
        <p><strong style={{color:'#F9F0F0'}}>Можно ли использовать одну АВО для двух школ HEY?</strong><br/>
          Каждая школа имеет свой webhook URL. Если хочешь две — создай две школы, в АВО настрой два
          бизнес-процесса для разных вебхуков.</p>
        <p><strong style={{color:'#F9F0F0'}}>Webhook не приходит — что делать?</strong></p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Проверь блок «Последние webhook'ы» в настройках школы — есть ли вообще запись?</li>
          <li>Если нет — проверь логи бизнес-процесса в АВО (правильный ли URL? правильный ли токен в URL?)</li>
          <li>Если webhook пришёл, но статус <span style={codeStyle}>ignored_test_mode</span> — выключи
            тестовый режим или поменяй тестовый курс</li>
          <li>Если статус <span style={codeStyle}>no_chat_mapping</span> — не задан маппинг этого курса
            на чат</li>
        </ul>
        <p><strong style={{color:'#F9F0F0'}}>Как пересоздать токен (если утёк)?</strong><br/>
          В блоке «Webhook URL» под URL'ом есть ссылка «Пересоздать токен». Старый сразу перестаёт работать —
          не забудь обновить URL в АВО.</p>
        <p><strong style={{color:'#F9F0F0'}}>Ученик возвращает деньги — что делать?</strong><br/>
          Пока эту ветку обрабатываем только частично — статус «возврат» (id_account_status=6) логируется,
          но из чата не убираем автоматически. Удали вручную через настройки группы.</p>
      </>
    ),
  },
];

export default function AwoGuide({ onClose }) {
  const [openId, setOpenId] = useState('overview');

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:900,
        background:'rgba(0,0,0,.72)', backdropFilter:'blur(16px)',
        display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px',
        overflowY:'auto',
      }}>
      <div style={{
        width:'min(94vw, 720px)',
        background:'rgba(22,15,50,.98)',
        borderRadius:18, border:'1px solid rgba(249,240,240,.14)',
        margin:'40px 0 60px', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.55)',
      }}>
        {/* Header */}
        <div style={{
          padding:'18px 22px', borderBottom:'1px solid rgba(249,240,240,.1)',
          display:'flex', alignItems:'center', gap:12,
          position:'sticky', top:0, background:'rgba(22,15,50,.98)', borderTopLeftRadius:18, borderTopRightRadius:18,
        }}>
          <div style={{flex:1, color:'#F9F0F0', fontSize:17, fontWeight:800}}>
            📖 Руководство по интеграции с АВО
          </div>
          <button onClick={onClose}
            style={{ background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.18)',
              color:'rgba(225,220,245,.95)', borderRadius:10, padding:'6px 12px',
              fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Закрыть
          </button>
        </div>

        {/* Sections (accordion) */}
        <div style={{ padding:'18px 22px' }}>
          {SECTIONS.map(s => {
            const open = openId === s.id;
            return (
              <div key={s.id} style={{ ...cardStyle, marginBottom: 10 }}>
                <button onClick={() => setOpenId(open ? null : s.id)}
                  style={{
                    width:'100%', background:'none', border:'none',
                    display:'flex', alignItems:'center', gap:10,
                    color:'#F9F0F0', fontSize:14, fontWeight:700, padding:0,
                    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                  }}>
                  <span style={{flex:1}}>{s.title}</span>
                  <span style={{color:'rgba(225,220,245,.6)',fontSize:14}}>{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div style={{
                    marginTop:14, color:'rgba(225,220,245,.88)',
                    fontSize:13.5, lineHeight:1.65,
                  }}>
                    {s.content()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
