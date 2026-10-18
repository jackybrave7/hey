import { lazy } from 'react';

/**
 * Lazy-экран из тяжёлого чанка Screens.jsx (именованный export → default для React.lazy).
 */
export function lazyScreen(exportName) {
  return lazy(() =>
    import('./components/Screens.jsx').then((mod) => {
      const Comp = mod[exportName];
      if (!Comp) {
        throw new Error(`Экран «${exportName}» не найден`);
      }
      return { default: Comp };
    })
  );
}

export function lazyDefault(importer) {
  return lazy(() => importer());
}
