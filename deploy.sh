#!/bin/bash
set -e

echo "==> Установка зависимостей..."
npm install --workspace=server
npm install --workspace=web

echo "==> Сборка фронтенда..."
npm run build

echo "==> Перезапуск через PM2..."
pm2 startOrRestart ecosystem.config.js

echo "==> Сохранение PM2 (автозапуск после перезагрузки)..."
pm2 save

echo ""
echo "Готово. Приложение запущено на порту 3001."
echo "Статус: pm2 status"
echo "Логи:   pm2 logs hey"
