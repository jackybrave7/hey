// AdminSettings.jsx — раздел «Настройки» админки.
// Сейчас содержит политику удаления (мягкое vs физическое).
import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  useEffect(() => {
    api.adminGetSettings()
      .then(setSettings)
      .catch(e => showToast('Ошибка: ' + e.message));
  }, []);

  async function update(patch) {
    setSaving(true);
    try {
      const next = await api.adminUpdateSettings(patch);
      // ответ — { ok, ...поля }, оставляем только настройки
      setSettings(s => ({ ...s, ...next, ok: undefined }));
      showToast('✓ Сохранено');
    } catch (e) { showToast('Ошибка: ' + e.message); }
    setSaving(false);
  }

  if (!settings) {
    return <div style={{ padding: 32, color: 'rgba(225,220,245,.75)' }}>Загрузка…</div>;
  }

  const card = {
    background:'rgba(20,12,40,.65)',
    border:'1px solid rgba(255,255,255,.14)',
    borderRadius:14, padding:'18px 20px',
    boxShadow:'0 4px 14px rgba(0,0,0,.15)',
  };
  const optionBase = {
    display:'flex', alignItems:'flex-start', gap:10,
    padding:'12px 14px', borderRadius:10, cursor:'pointer',
    border:'1px solid rgba(255,255,255,.12)',
    background:'rgba(255,255,255,.04)',
    transition:'background .15s, border-color .15s',
  };
  const selected = {
    background:'rgba(140,110,220,.18)',
    borderColor:'rgba(180,140,255,.5)',
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <h1 style={{ color:'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        ⚙ Настройки
      </h1>
      <p style={{ color:'rgba(225,220,245,.85)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Глобальные параметры админки. Действуют на всех админов.
      </p>

      {/* Политика удаления */}
      <div style={card}>
        <div style={{ color:'white', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          🗑 Политика удаления
        </div>
        <div style={{ color:'rgba(225,220,245,.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          Определяет, что происходит когда админ нажимает «удалить» в админке,
          не выбирая режим явно. В операциях удаления момента/пользователя
          можно всегда указать режим вручную — этот параметр только дефолт.
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
          <label style={{ ...optionBase, ...(settings.delete_policy === 'soft' ? selected : {}) }}>
            <input type="radio" name="delete_policy" value="soft"
              checked={settings.delete_policy === 'soft'}
              disabled={saving}
              onChange={() => update({ delete_policy: 'soft' })}
              style={{ marginTop: 3, accentColor:'#a884e0' }}/>
            <div>
              <div style={{ color:'white', fontWeight:600, fontSize: 14 }}>
                Мягкое (по умолчанию)
              </div>
              <div style={{ color:'rgba(225,220,245,.65)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
                Помечает в БД <code>status='deleted'</code> / <code>is_deleted=1</code>.
                Из ленты/чатов пропадает, но строка и медиа остаются.
                Удобно для возможного восстановления и расследований.
              </div>
            </div>
          </label>

          <label style={{ ...optionBase, ...(settings.delete_policy === 'hard' ? selected : {}) }}>
            <input type="radio" name="delete_policy" value="hard"
              checked={settings.delete_policy === 'hard'}
              disabled={saving}
              onChange={() => update({ delete_policy: 'hard' })}
              style={{ marginTop: 3, accentColor:'#a884e0' }}/>
            <div>
              <div style={{ color:'white', fontWeight:600, fontSize: 14 }}>
                Полное (физическое)
              </div>
              <div style={{ color:'rgba(225,220,245,.65)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
                Удаляет строку из БД и медиа из S3.
                Для пользователя — также все его моменты, аватарка, реакции, контакты;
                сообщения анонимизируются (чтобы не порвать чаты собеседников).
                <strong style={{ color:'rgba(255,160,160,.95)' }}>{' '}Действие необратимо.</strong>
              </div>
            </div>
          </label>
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)',
          background:'rgba(22,15,50,.97)', border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50, padding:'10px 20px', color:'white', fontSize:14, fontWeight:600,
          zIndex:1000, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
