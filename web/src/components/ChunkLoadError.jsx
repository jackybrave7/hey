/** Экран при сбое динамического import() (обновление деплоя, обрыв сети). */
export default function ChunkLoadError({ error, onRetry }) {
  const isChunk = /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i
    .test(String(error?.message || error));

  return (
    <div style={{
      minHeight: '100vh', padding: '32px 20px', boxSizing: 'border-box',
      background: 'linear-gradient(180deg, #5F4080 0%, #D0A8A8 66%, #5F4080 100%)',
      color: '#F9F0F0', fontFamily: 'system-ui,sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>✦</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
          {isChunk ? 'Не удалось загрузить часть приложения' : 'Что-то пошло не так'}
        </h1>
        <p style={{
          fontSize: 14, lineHeight: 1.55, color: 'rgba(249,240,240,.65)', margin: '0 0 20px',
        }}>
          {isChunk
            ? 'Часто помогает обновление страницы — особенно после выхода новой версии или при нестабильном интернете.'
            : (error?.message || 'Попробуйте обновить страницу.')}
        </p>
        <button
          type="button"
          onClick={onRetry || (() => window.location.reload())}
          style={{
            padding: '12px 28px', borderRadius: 50, border: 'none',
            background: 'rgba(95,64,128,.9)', color: '#F9F0F0',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
