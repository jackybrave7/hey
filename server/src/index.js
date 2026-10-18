// server/src/index.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
// db loads automatically
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/init');
const makeRouter = require('./routes');
const setupWS = require('./ws');

const app = express();
const PORT = process.env.PORT || 3001;

// In dev, reflect any origin (LAN access from other devices via Vite proxy still routes
// API/WS through the host's loopback, but the browser-side origin can be any LAN IP).
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' }));
// AWO webhook отправляет данные в формате application/x-www-form-urlencoded —
// добавляем парсер, чтобы req.body содержал поля
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// Health check
app.get('/health', (_, res) => res.json({ ok: true, time: new Date() }));

// Create HTTP server (shared with WebSocket)
const server = http.createServer(app);

// WebSocket — must come after server creation
const { broadcast } = setupWS(server, db);

// REST API
app.use('/api', makeRouter(db, broadcast));

// Serve built frontend in production (after API routes)
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../web/dist');
  const assetsDir = path.join(dist, 'assets');
  const ONE_YEAR = 31536000;

  // Hashed JS/CSS — длинный кеш (immutable)
  app.use('/assets', express.static(assetsDir, {
    maxAge: ONE_YEAR,
    immutable: true,
    etag: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
    },
  }));

  // Остальная статика (fonts, icons, manifest); index.html — без кеша
  app.use(express.static(dist, {
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      } else if (filePath.includes(`${path.sep}fonts${path.sep}`)) {
        res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
      }
    },
  }));

  app.get('*', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}


server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════╗
  ║  HEY Server running          ║
  ║  HTTP  → http://localhost:${PORT}  ║
  ║  WS    → ws://localhost:${PORT}/ws ║
  ╚══════════════════════════════╝
  `);
});
