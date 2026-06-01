// bulk.jsx — общий механизм пакетной обработки для админских таблиц/списков.
//
// useBulkSelection() — хук, который держит Set выбранных id и даёт удобные
//   действия (toggle, selectAll, clear, has, count).
// <Checkbox/> — квадратный чекбокс под тёмную админ-палитру.
// <BulkActionBar/> — плавающая нижняя плашка «N выбрано · [Действие …]
//   · Снять выделение». Появляется только если есть выбранные id.
//
// Все три объединены здесь, чтобы не плодить файлы под мелкие штуки —
// и таблицы (Users / Moments / Reports) импортируют только то, что им
// нужно, без повторения логики.
import { useCallback, useMemo, useState } from 'react';

export function useBulkSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((ids) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(() => ({
    selected,
    count: selected.size,
    has:   (id) => selected.has(id),
    toggle,
    selectAll: (ids) => setAll(ids),
    clear,
    ids:   () => [...selected],
  }), [selected, toggle, setAll, clear]);
}

// Кнопка-чекбокс под тёмную палитру. Раньше тут был <label> с вложенным
// hidden <input type="checkbox"> — но label автоматически проксирует клик
// на input, чей onChange не обновлял внешний state (мы используем onClick).
// Из-за этого таблица «Пользователи» вела себя так, будто выделение
// мгновенно сбрасывалось. Заменили на обычный <button>.
export function Checkbox({ checked, indeterminate, title, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      title={title}
      aria-pressed={!!checked}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 5, padding: 0,
        border: `1.5px solid ${checked || indeterminate ? 'rgba(180,140,255,.85)' : 'rgba(255,255,255,.25)'}`,
        background: checked
          ? 'rgba(140,110,220,.9)'
          : indeterminate
            ? 'rgba(140,110,220,.4)'
            : 'transparent',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background .12s, border-color .12s',
      }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <div style={{ width: 9, height: 2, borderRadius: 1, background: 'white' }}/>
      )}
    </button>
  );
}

// actions — массив { key, label, danger?, accent?, confirm?, requireReason? }
// onAction — async (key, reason?) => void
export function BulkActionBar({ count, onClear, actions, onAction, busy }) {
  if (!count) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1100,
      background: 'rgba(22,15,50,.97)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(180,140,255,.35)',
      borderRadius: 50, padding: '8px 8px 8px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 18px 50px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset',
      maxWidth: 'calc(100vw - 32px)', flexWrap: 'wrap',
    }}>
      <span style={{ color:'white', fontSize: 13, fontWeight: 700 }}>
        Выбрано: {count}
      </span>
      <div style={{ display:'flex', gap: 6, flexWrap: 'wrap' }}>
        {actions.map(a => {
          const palette = a.danger
            ? { bg: 'rgba(220,60,60,.85)',   border: 'rgba(255,160,160,.5)'  }
            : a.accent
              ? { bg: 'rgba(140,110,220,.9)', border: 'rgba(200,160,255,.45)' }
              : { bg: 'rgba(255,255,255,.10)', border: 'rgba(255,255,255,.18)' };
          return (
            <button key={a.key} onClick={() => onAction(a)} disabled={busy}
              style={{
                padding: '8px 14px', borderRadius: 50,
                fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit', color: 'white',
                background: palette.bg, border: `1px solid ${palette.border}`,
                opacity: busy ? .6 : 1,
              }}>
              {a.label}
            </button>
          );
        })}
      </div>
      <button onClick={onClear} disabled={busy}
        style={{
          padding: '8px 12px', borderRadius: 50, border: 'none',
          background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.6)',
          fontSize: 12, cursor: busy ? 'wait' : 'pointer', fontFamily:'inherit',
        }}>
        ✕ Сбросить
      </button>
    </div>
  );
}
