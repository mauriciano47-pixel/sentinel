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

module.exports = router;
