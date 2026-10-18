import { Suspense } from 'react';
import LazyErrorBoundary from './LazyErrorBoundary';
import RouteLoadFallback from './RouteLoadFallback';

/** Обёртка для lazy-роутов: Suspense + обработка ошибки чанка. */
export default function LazyRoute({ children }) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<RouteLoadFallback />}>
        {children}
      </Suspense>
    </LazyErrorBoundary>
  );
}
