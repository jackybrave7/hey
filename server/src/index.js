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
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
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
