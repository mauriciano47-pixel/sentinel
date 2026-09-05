const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

// GET /api/v1/platforms
router.get('/', authenticate, (req, res) => {
  try {
    const { category, search, difficulty } = req.query;

    let sql = 'SELECT * FROM platforms WHERE active = 1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category.toLowerCase());
    }

    if (difficulty) {
      sql += ' AND difficulty <= ?';
      params.push(parseInt(difficulty, 10));
    }

    if (search) {
      sql += ' AND (name LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY difficulty ASC, name ASC';

    const platforms = db.all(sql, params);

    // Adjuntar estado de solicitud si el usuario ya la ha solicitado
    const userRequests = db.all('SELECT platform_id, status, id FROM deletion_requests WHERE user_id = ?', [req.user.id]);
    const requestMap = new Map(userRequests.map(r => [r.platform_id, { status: r.status, requestId: r.id }]));

    const enriched = platforms.map(p => ({
      ...p,
      userStatus: requestMap.get(p.id)?.status || 'not_started',
      requestId: requestMap.get(p.id)?.requestId || null
    }));

    res.json({
      total: enriched.length,
      platforms: enriched
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar plataformas', details: err.message });
  }
});

// GET /api/v1/platforms/:id
router.get('/:id', authenticate, (req, res) => {
  try {
    const platform = db.get('SELECT * FROM platforms WHERE id = ? AND active = 1', [req.params.id]);
    if (!platform) {
      return res.status(404).json({ error: 'Plataforma no encontrada' });
    }

    // Personalizar plantilla GDPR con los datos del usuario
    const user = req.user;
    let template = platform.gdpr_template || '';
    template = template
      .replace(/\[NOMBRE_PLATAFORMA\]/g, platform.name)
      .replace(/\[NOMBRE_USUARIO\]/g, user.display_name || user.email)
      .replace(/\[EMAIL_USUARIO\]/g, user.email);

    res.json({
      platform,
      customizedGdprTemplate: template
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo detalle de plataforma', details: err.message });
  }
});

module.exports = router;
