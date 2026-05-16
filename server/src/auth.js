// server/src/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hey-secret-change-in-production';

// DB reference — injected once at startup via init()
let _db = null;
function init(db) { _db = db; }

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = verifyToken(header.slice(7));

    if (_db) {
      const user = _db.findUserById(decoded.id);
      if (!user) return res.status(401).json({ error: 'User not found' });

      // Admin block check
      if (user.is_blocked) {
        return res.status(403).json({ error: 'Аккаунт заблокирован', code: 'BLOCKED' });
      }

      // Token issued before block — invalidate
      if (user.blocked_at && decoded.iat && decoded.iat < Math.floor(user.blocked_at / 1000)) {
        return res.status(401).json({ error: 'Session expired', code: 'BLOCKED' });
      }

      req.user = {
        ...decoded,
        is_admin: !!user.is_admin,
        is_super: !!user.is_super,
        must_change_password: !!user.must_change_password,
      };
    } else {
      req.user = decoded;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// WebSocket auth — token passed as ?token=... query param
function wsAuth(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return null;
    const decoded = verifyToken(token);

    if (_db) {
      const user = _db.findUserById(decoded.id);
      if (!user || user.is_blocked) return null;
      if (user.blocked_at && decoded.iat && decoded.iat < Math.floor(user.blocked_at / 1000)) return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// Optional auth — sets req.user if token valid, never blocks the request
function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) req.user = verifyToken(header.slice(7));
  } catch {}
  next();
}

module.exports = { init, signToken, verifyToken, requireAuth, optionalAuth, wsAuth };
