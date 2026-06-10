import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChatMenuIcon from './ChatMenuIcon';

/**
 * Общая плашка контекстного меню — 209×178, #F9F0F0, тень 3/3/3, пункты 13pt bold.
 * items: { label, iconName?, icon?, danger?, separatorBefore?, onClick?, hidden? }
 */
export function ContextMenuPanel({ items, style, menuRef, onItemClick }) {
  return (
    <div
      ref={menuRef}
      className="chat-context-menu"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item.hidden) return null;
        return (
          <div key={item.label + i} className="chat-context-menu-entry">
            {item.separatorBefore && <div className="chat-context-menu-sep" />}
            <button
              type="button"
              className={`chat-context-menu-item${item.danger ? ' is-danger' : ''}`}
              onClick={() => onItemClick?.(item)}
            >
              {(item.iconName || item.icon) && (
                <span className="chat-context-menu-icon">
                  {item.iconName
                    ? <ChatMenuIcon name={item.iconName} size={15} />
                    : item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Меню в фиксированной точке (ПКМ, long-press и т.п.) */
export function AnchoredContextMenu({ open, onClose, items, position }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onScroll = () => onClose?.();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const left = position?.left;
  const top = position?.top;
  const right = position?.right;

  return createPortal(
    <ContextMenuPanel
      menuRef={menuRef}
      items={items}
      style={{
        position: 'fixed',
        zIndex: 9999,
        ...(left != null ? { left: Math.max(8, left) } : {}),
        ...(top != null ? { top: Math.max(8, top) } : {}),
        ...(right != null ? { right: Math.max(12, right) } : {}),
      }}
      onItemClick={(item) => {
        onClose?.();
        item.onClick?.();
      }}
    />,
    document.body
  );
}

/** Меню с триггером (три точки в шапке и т.п.) */
export default function ChatContextMenu({ items, trigger, ariaLabel = 'Меню' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="chat-context-menu-trigger"
        onClick={toggle}
        aria-label={ariaLabel}
      >
        {trigger ?? <ChatMenuIcon name="menu" size={19} style={{ width: 4.75, height: 19 }} />}
      </button>
      {open && createPortal(
        <ContextMenuPanel
          menuRef={menuRef}
          items={items}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          onItemClick={(item) => {
            setOpen(false);
            item.onClick?.();
          }}
        />,
        document.body
      )}
    </>
  );
}
