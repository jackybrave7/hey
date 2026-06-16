import Icon from '../Icon';

const APK_URL = '/downloads/hey-messenger.apk';

export default function AndroidAppDownloadModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:900, background:'rgba(0,0,0,.72)',
      backdropFilter:'blur(16px)', display:'flex', alignItems:'center',
      justifyContent:'center', padding:'20px' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'rgba(22,15,50,.98)', backdropFilter:'blur(24px)',
        borderRadius:22, width:'min(100%,440px)',
        boxShadow:'0 8px 48px rgba(0,0,0,.6)', border:'1px solid rgba(249,240,240,.1)',
        overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', padding:'16px 20px',
          borderBottom:'1px solid rgba(249,240,240,.08)' }}>
          <span style={{ color:'#F9F0F0', fontSize:17, fontWeight:700, flex:1,
            display:'inline-flex', alignItems:'center', gap:8 }}>
            <Icon name="download" size={18} />
            HEY для Android
            <span style={{
              fontSize:10, fontWeight:700, letterSpacing:.4,
              textTransform:'uppercase', padding:'3px 8px', borderRadius:6,
              background:'rgba(255,200,80,.18)', color:'rgba(255,220,140,.95)',
              border:'1px solid rgba(255,200,80,.35)',
            }}>Бета</span>
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'rgba(249,240,240,.4)', fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          <p style={{ margin:0, color:'rgba(249,240,240,.88)', fontSize:14, lineHeight:1.65 }}>
            Приложение сейчас в <strong>бета-режиме</strong>. По функциям оно почти не отличается
            от веб-версии — те же чаты, контакты и моменты. Зато на смартфоне удобнее держать
            на главном экране, и <strong>уведомления работают стабильнее</strong>, чем в браузере.
          </p>

          <div style={{
            background:'rgba(249,240,240,.05)', borderRadius:14,
            border:'1px solid rgba(249,240,240,.1)', padding:'14px 16px',
          }}>
            <div style={{ color:'rgba(249,240,240,.7)', fontSize:12, fontWeight:700,
              textTransform:'uppercase', letterSpacing:.6, marginBottom:10 }}>
              Что будет дальше
            </div>
            <ol style={{ margin:0, paddingLeft:18, color:'rgba(249,240,240,.78)',
              fontSize:13, lineHeight:1.7 }}>
              <li>Скачается файл <code style={{ fontSize:12 }}>hey-messenger.apk</code></li>
              <li>Открой его в загрузках и запусти установку</li>
              <li>Подтверди установку из неизвестного источника — если Android спросит</li>
              <li>При желании можно прогнать проверку через Google Play Защиту</li>
            </ol>
          </div>

          <p style={{ margin:0, color:'rgba(249,240,240,.55)', fontSize:12, lineHeight:1.55 }}>
            APK пока не в Google Play — это тестовая сборка для ранних пользователей.
            Сообщай о багах через «Написать разработчику» в настройках.
          </p>
        </div>

        <div style={{ padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          <a href={APK_URL} download="hey-messenger.apk"
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              width:'100%', padding:'13px', borderRadius:50, fontSize:15, fontWeight:700,
              cursor:'pointer', border:'none', color:'#F9F0F0', textDecoration:'none',
              background:'rgba(95, 64, 128,.85)',
              boxShadow:'0 4px 20px rgba(95, 64, 128,.35)',
              fontFamily:'inherit',
            }}>
            <Icon name="download" size={18} />
            Скачать APK
          </a>
          <button onClick={onClose} style={{
            width:'100%', padding:'11px', borderRadius:50, fontSize:14, fontWeight:600,
            cursor:'pointer', border:'none', color:'rgba(249,240,240,.55)',
            background:'rgba(249,240,240,.06)', fontFamily:'inherit',
          }}>
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
