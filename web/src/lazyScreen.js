import { lazy } from 'react';

/** Именованный export из модуля → default для React.lazy */
export function lazyNamed(importer, exportName) {
  return lazy(() => importer().then((mod) => {
    const Comp = mod[exportName];
    if (!Comp) throw new Error(`Экран «${exportName}» не найден`);
    return { default: Comp };
  }));
}

export function lazyDefault(importer) {
  return lazy(importer);
}
