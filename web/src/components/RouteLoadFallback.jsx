/** Спиннер для React.Suspense при lazy-роутах */
export default function RouteLoadFallback() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--grad)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>Загрузка…</div>
    </div>
  );
}
