import { scrollPageToTop } from '../../lib/scrollPageToTop';

export function TabHeaderTitle({ children, onClick }) {
  function activate(e) {
    scrollPageToTop();
    onClick?.(e);
  }

  return (
    <div
      className="tab-header-title"
      role="button"
      tabIndex={0}
      title="Наверх"
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e);
        }
      }}
    >
      {children}
    </div>
  );
}
