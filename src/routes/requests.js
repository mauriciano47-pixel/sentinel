const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

// GET /api/v1/requests - Listar solicitudes del usuario
router.get('/', authenticate, (req, res) => {
  try {
    const requests = db.all(`
      SELECT r.*, p.name as platform_name, p.category as platform_category, 
             p.deletion_url, p.deletion_method, p.deletion_email,
             i.value as identity_value
      FROM deletion_requests r
      JOIN platforms p ON r.platform_id = p.id
      LEFT JOIN identities i ON r.identity_id = i.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.id]);

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo solicitudes de eliminación', details: err.message });
  }
});

// POST /api/v1/requests - Crear o registrar solicitud de eliminación
router.post('/', authenticate, (req, res) => {
  try {
    const { platformId, identityId, notes, status } = req.body;

    if (!platformId) {
      return res.status(400).json({ error: 'platformId es obligatorio' });
    }

    const platform = db.get('SELECT id, name FROM platforms WHERE id = ?', [platformId]);
    if (!platform) {
      return res.status(404).json({ error: 'Plataforma no encontrada' });
    }

    // Verificar si ya existe una solicitud abierta para esta plataforma
    const existing = db.get(
      'SELECT id, status FROM deletion_requests WHERE user_id = ? AND platform_id = ?',
      [req.user.id, platformId]
    );

    const initialStatus = status || 'sent';
    const now = new Date().toISOString();

    if (existing) {
      db.run(`
        UPDATE deletion_requests
        SET status = ?, sent_at = ?, notes = ?
        WHERE id = ?
      `, [initialStatus, now, notes || null, existing.id]);

      const updated = db.get('SELECT * FROM deletion_requests WHERE id = ?', [existing.id]);
      return res.json({
        success: true,
        message: `Solicitud para ${platform.name} actualizada`,
        request: updated
      });
    }

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    db.run(`
      INSERT INTO deletion_requests (id, user_id, platform_id, identity_id, status, sent_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [requestId, req.user.id, platformId, identityId || null, initialStatus, now, notes || null]);

    const created = db.get('SELECT * FROM deletion_requests WHERE id = ?', [requestId]);

    res.status(201).json({
      success: true,
      message: `Solicitud de eliminación para ${platform.name} registrada`,
      request: created
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creando solicitud de borrado', details: err.message });
  }
});

// PATCH /api/v1/requests/:id - Actualizar estado de la solicitud
router.patch('/:id', authenticate, (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'sent', 'confirmed', 'completed', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const request = db.get('SELECT * FROM deletion_requests WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const completedAt = status === 'completed' ? new Date().toISOString() : request.completed_at;

    db.run(`
      UPDATE deletion_requests
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          completed_at = ?
      WHERE id = ?
    `, [status, notes, completedAt, req.params.id]);

    const updated = db.get('SELECT * FROM deletion_requests WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Estado de solicitud actualizado',
      request: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando solicitud', details: err.message });
  }
});

module.exports = router;
