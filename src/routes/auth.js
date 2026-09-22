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

// POST /api/v1/auth/register - Registro de nuevo usuario en Sentinel
router.post('/register', (req, res) => {
  try {
    const { email, displayName, plan } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      return res.status(400).json({ error: 'Formato de correo electrónico inválido' });
    }

    const existing = db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({
        error: 'El usuario ya se encuentra registrado',
        user: existing,
        token: existing.id
      });
    }

    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const validPlan = ['free', 'guard', 'sentinel'].includes(plan) ? plan : 'free';
    const name = displayName ? String(displayName).trim() : normalizedEmail.split('@')[0];
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, display_name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, normalizedEmail, name, validPlan, now, now]
    );

    const newUser = db.get('SELECT * FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente en Sentinel',
      user: newUser,
      token: userId
    });
  } catch (err) {
    res.status(500).json({ error: 'Error registrando usuario', details: err.message });
  }
});

module.exports = router;

