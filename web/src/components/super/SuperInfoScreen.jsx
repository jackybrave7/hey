// SuperInfoScreen.jsx — полноэкранный попап с информацией о HEY СУПЕР
import { useAuth } from '../../AuthContext';
import { api } from '../../api';
import { personalInviteUrl } from '../../lib/inviteLink';
import { heyToast } from '../shared/Toast';
import HeyLogo from '../HeyLogo';
import Icon from '../Icon';

const LIMIT_ROWS = [
  { icon: '✦', label: 'Активные моменты', regular: '1', super: '3' },
  { icon: 'mic', label: 'Голосовые', regular: 'до 1 мин', super: 'до 5 мин' },
  { icon: '🖼', label: 'Картинки в чате', regular: 'до 8 МБ', super: 'до 15 МБ' },
  { icon: '🎬', label: 'Видео в чате', regular: 'до 10 МБ', super: 'до 20 МБ' },
  { icon: '📎', label: 'Файлы в чате', regular: 'до 25 МБ', super: 'до 50 МБ' },
  { icon: '✍️', label: 'Ссылки в био', regular: '1', super: '5' },
  { icon: '📌', label: 'Закреплённые чаты', regular: 'до 5', super: 'до 15' },
  { icon: '👥', label: 'Размер группы', regular: 'до 100', super: 'до 500' },
];

const SUPER_ONLY = [
  { icon: '🟢', label: 'Онлайн-статус контактов', super: 'видишь, когда был онлайн' },
  { icon: '📊', label: 'Аналитика моментов', super: 'кто видел и кто резонирует' },
];

function LimitCompareRow({ icon, label, regular, super: superVal }) {
  return (
    <div style={{
      background: 'rgba(249,240,240,.05)',
      borderRadius: 14, padding: '12px 14px',
      border: '1px solid rgba(249,240,240,.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 18, flexShrink: 0, display: 'inline-flex', color: 'rgba(249,240,240,.88)' }}>
          {icon === 'mic' ? <Icon name="mic" size={18} /> : icon}
        </span>
        <span style={{ color: '#F9F0F0', fontSize: 14, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
        <div style={{
          textAlign: 'center', padding: '8px 6px', borderRadius: 10,
          background: 'rgba(249,240,240,.06)', border: '1px solid rgba(249,240,240,.1)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(249,240,240,.55)', marginBottom: 3, fontWeight: 600 }}>
            Без Super
          </div>
          <div style={{ fontSize: 13, color: 'rgba(249,240,240,.78)', fontWeight: 600 }}>{regular}</div>
        </div>
        <span style={{ color: 'rgba(200,170,255,.7)', fontSize: 16, fontWeight: 700 }}>→</span>
        <div style={{
          textAlign: 'center', padding: '8px 6px', borderRadius: 10,
          background: 'rgba(95, 64, 128,.28)', border: '1px solid rgba(180,140,255,.35)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(220,200,255,.85)', marginBottom: 3, fontWeight: 700 }}>
            ✦ Super
          </div>
          <div style={{ fontSize: 13, color: '#F9F0F0', fontWeight: 700 }}>{superVal}</div>
        </div>
      </div>
    </div>
  );
}

function SuperOnlyRow({ icon, label, super: superVal }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: 'rgba(95, 64, 128,.18)',
      borderRadius: 14, padding: '12px 14px',
      border: '1px solid rgba(180,140,255,.28)',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ color: '#F9F0F0', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'rgba(249,240,240,.72)', lineHeight: 1.45 }}>
          Без Super — нет · ✦ Super — {superVal}
        </div>
      </div>
    </div>
  );
}

export default function SuperInfoScreen({ onClose, onInvite }) {
  const { user } = useAuth();

  async function copyInviteLink() {
    if (!user?.id) {
      heyToast('Нужно войти в аккаунт', 'error');
      return;
    }
    let code = user.invite_code;
    if (!code) {
      try {
        const r = await api.getInvite();
        code = r.code;
      } catch {
        heyToast('Не удалось получить ссылку', 'error');
        return;
      }
    }
    const link = personalInviteUrl(code);
    try {
      await navigator.clipboard.writeText(link);
      heyToast('✓ Ссылка скопирована — поделись с друзьями', 'success');
    } catch {
      heyToast('Не удалось скопировать. Скопируй вручную: ' + link, 'error');
    }
    onClose?.();
    onInvite?.();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(22,15,50,.98)', backdropFilter: 'blur(24px)',
        borderRadius: 24, width: 'min(100%, 480px)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 48px rgba(0,0,0,.6)',
        border: '1px solid rgba(249,240,240,.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '28px 24px 20px',
          background: 'linear-gradient(160deg, rgba(95, 64, 128,.35) 0%, rgba(80,40,140,.2) 100%)',
          borderBottom: '1px solid rgba(249,240,240,.08)',
          textAlign: 'center',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(249,240,240,.1)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, color:'#F9F0F0', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>

          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c8a8ff 0%, #5F4080 100%)',
            marginBottom: 14,
            boxShadow: '0 4px 20px rgba(95, 64, 128,.5)',
          }}>
            <HeyLogo size={34} color="#F9F0F0" />
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, marginBottom: 6,
            background: 'linear-gradient(135deg, #c8a8ff, #a078e0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            HEY СУПЕР
          </div>
          <div style={{ color: 'rgba(249,240,240,.72)', fontSize: 14 }}>
            Сравнение лимитов с обычным аккаунтом
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {LIMIT_ROWS.map((row) => (
              <LimitCompareRow key={row.label} {...row} />
            ))}
          </div>

          <div style={{
            color: 'rgba(249,240,240,.65)', fontSize: 12, fontWeight: 600,
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4,
          }}>
            Только в ✦ Super
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {SUPER_ONLY.map((row) => (
              <SuperOnlyRow key={row.label} {...row} />
            ))}
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(95, 64, 128,.3), rgba(80,40,140,.2))',
            border: '1px solid rgba(180,140,255,.25)',
            borderRadius: 18, padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎁</div>
            <div style={{ color:'#F9F0F0', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              Пригласи 3 друзей — получи 3 месяца СУПЕР
            </div>
            <div style={{ color: 'rgba(249,240,240,.75)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Разовая акция для новых пользователей.<br/>
              Друг засчитывается, когда зарегистрируется по твоей ссылке
              и напишет хотя бы одно сообщение.
            </div>
            <button onClick={copyInviteLink} style={{
              width: '100%', padding: '13px', borderRadius: 14,
              background: 'rgba(95, 64, 128,.85)', border: '1px solid rgba(180,140,255,.4)',
              color:'#F9F0F0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              transition: 'all .18s',
            }}>
              🔗 Скопировать пригласительную ссылку
            </button>
            <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 11, marginTop: 12 }}>
              Прямая покупка появится позже
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
