const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  try {
    const user = req.user;
    const stats = {
      identitiesCount: db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1', [user.id]).c,
      breachesCount: db.get(`
        SELECT COUNT(*) as c FROM breaches b
        JOIN identities i ON b.identity_id = i.id
        WHERE i.user_id = ? AND i.active = 1
      `, [user.id]).c,
      deletionRequestsCount: db.get('SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ?', [user.id]).c,
      completedDeletionsCount: db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [user.id]).c
    };

    res.json({
      user,
      stats,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar perfil de usuario', details: err.message });
  }
});

const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const target = Buffer.from(hash, 'hex');
  return crypto.timingSafeEqual(candidate, target);
}

function sanitizeUser(user) {
  if (!user) return null;
  const copy = Object.assign({}, user);
  delete copy.password_hash;
  return copy;
}

// POST /api/v1/auth/register - Registro de identidad en Sentinel
router.post('/register', (req, res) => {
  try {
    const { email, username, password, displayName, plan } = req.body;
    const rawIdentifier = (email || username || '').trim();

    if (!rawIdentifier) {
      return res.status(400).json({ error: 'El usuario o correo electrónico es obligatorio' });
    }

    const normalizedEmail = rawIdentifier.includes('@')
      ? rawIdentifier.toLowerCase()
      : `${rawIdentifier.toLowerCase()}@sentinel.local`;

    const existing = db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      if (password && existing.password_hash) {
        if (verifyPassword(password, existing.password_hash)) {
          return res.json({
            success: true,
            message: 'Acceso autorizado a bóveda existente',
            user: sanitizeUser(existing),
            token: existing.id
          });
        }
      }
      return res.status(409).json({
        error: 'El usuario ya se encuentra registrado. Inicia sesión con tu clave.',
        user: sanitizeUser(existing),
        token: existing.id
      });
    }

    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const validPlan = ['free', 'guard', 'sentinel'].includes(plan) ? plan : 'free';
    const name = displayName ? String(displayName).trim() : rawIdentifier.split('@')[0];
    const passwordHash = password ? hashPassword(password) : null;
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, display_name, plan, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, normalizedEmail, name, validPlan, passwordHash, now, now]
    );

    const newUser = db.get('SELECT * FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      success: true,
      message: 'Identidad creada exitosamente en Sentinel',
      user: sanitizeUser(newUser),
      token: userId
    });
  } catch (err) {
    res.status(500).json({ error: 'Error registrando usuario', details: err.message });
  }
});

// POST /api/v1/auth/login - Autenticación con usuario/correo y clave
router.post('/login', (req, res) => {
  try {
    const { email, username, password } = req.body;
    const rawIdentifier = (email || username || '').trim();

    if (!rawIdentifier) {
      return res.status(400).json({ error: 'El identificador de usuario es obligatorio' });
    }

    const normalizedEmail = rawIdentifier.includes('@')
      ? rawIdentifier.toLowerCase()
      : `${rawIdentifier.toLowerCase()}@sentinel.local`;

    const user = db.get('SELECT * FROM users WHERE email = ? OR display_name = ?', [normalizedEmail, rawIdentifier]);

    if (!user) {
      return res.status(404).json({
        error: 'Identidad no encontrada en el sistema Sentinel.'
      });
    }

    // Si el usuario tiene clave configurada y se envió clave para autenticar
    if (user.password_hash && password) {
      const match = verifyPassword(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Clave de seguridad incorrecta. Acceso denegado.' });
      }
    }

    res.json({
      success: true,
      message: 'Acceso autorizado a Sentinel',
      user: sanitizeUser(user),
      token: user.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al autenticar usuario', details: err.message });
  }
});

// POST /api/v1/auth/google - Autenticación federada / Google SSO
router.post('/google', (req, res) => {
  try {
    const { email, displayName, googleId } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Correo de cuenta Google no recibido' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const name = displayName ? String(displayName).trim() : normalizedEmail.split('@')[0];
      const now = new Date().toISOString();

      db.run(
        'INSERT INTO users (id, firebase_uid, email, display_name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, googleId || `gid_${Date.now()}`, normalizedEmail, name, 'free', now, now]
      );
      user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    res.json({
      success: true,
      message: 'Autenticación con Google confirmada',
      user: sanitizeUser(user),
      token: user.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Error procesando autenticación Google', details: err.message });
  }
});

// PATCH /api/v1/auth/plan - Cambio de plan en el lobby de Sentinel
router.patch('/plan', authenticate, (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'guard', 'sentinel'].includes(plan)) {
      return res.status(400).json({ error: 'Plan no reconocido (válidos: free, guard, sentinel)' });
    }
    db.run('UPDATE users SET plan = ?, updated_at = ? WHERE id = ?', [plan, new Date().toISOString(), req.user.id]);
    const updated = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({
      success: true,
      message: `Plan actualizado exitosamente a ${plan.toUpperCase()}`,
      user: sanitizeUser(updated)
    });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando plan', details: err.message });
  }
});

module.exports = router;

