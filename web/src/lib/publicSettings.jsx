// publicSettings.js — глобальные публичные настройки приложения,
// которые задаёт админ через /admin/settings и должны влиять на UI
// у всех пользователей (не только админов).
//
// Сейчас тут один флаг: `sales_pressure_level`.
//   1 — мягкий (default). Промо СУПЕР показывается ТОЛЬКО в:
//       • развилке создания 2-го момента
//       • инфо-экране СУПЕР (по клику)
//     Прогресс-бар приглашений «N/3» появляется только начиная со 2/3.
//     Промо на счётчиках момента — НЕ показывается.
//     Промо при попытке голосового > 1 мин — НЕ показывается (стандартный лимит).
//
//   2 — жёсткий. Все промо-точки активны (старое поведение).
//
// Чтобы не делать N запросов на сетку, тянем настройки один раз при
// маунте AuthProvider'а и кешируем в module-scope. Меняется редко —
// перезагрузка страницы после правки в админке достаточна.

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const DEFAULTS = { sales_pressure_level: 1 };

const PublicSettingsContext = createContext(DEFAULTS);

export function PublicSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    let alive = true;
    api.getPublicSettings()
      .then(s => { if (alive) setSettings({ ...DEFAULTS, ...s }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}

// Удобный шорткат для частого использования.
export function useSalesPressure() {
  return usePublicSettings().sales_pressure_level || 1;
}
