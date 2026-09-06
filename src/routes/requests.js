const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

const LEGAL_DEADLINE_DAYS = 30; // Plazo estipulado por Art. 12 y 17 RGPD

// Función auxiliar para calcular métricas de plazo legal
function enrichWithDeadline(reqRow) {
  const sentTime = reqRow.sent_at ? new Date(reqRow.sent_at).getTime() : new Date(reqRow.created_at).getTime();
  const deadlineDate = new Date(sentTime + (LEGAL_DEADLINE_DAYS * 24 * 60 * 60 * 1000));
  const now = Date.now();
  const diffMs = deadlineDate.getTime() - now;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgencyStatus = 'normal';
  if (reqRow.status === 'completed') {
    urgencyStatus = 'completed';
  } else if (daysRemaining < 0) {
    urgencyStatus = 'overdue'; // Plazo legal vencido
  } else if (daysRemaining <= 5) {
    urgencyStatus = 'urgent'; // Menos de 5 días
  } else if (daysRemaining <= 15) {
    urgencyStatus = 'warning'; // Menos de 15 días
  }

  return {
    ...reqRow,
    legalDeadlineDays: LEGAL_DEADLINE_DAYS,
    deadlineDate: deadlineDate.toISOString(),
    daysRemaining: reqRow.status === 'completed' ? 0 : daysRemaining,
    urgencyStatus,
    isOverdue: reqRow.status !== 'completed' && daysRemaining < 0
  };
}

// GET /api/v1/requests - Listar solicitudes con seguimiento de 30 días
router.get('/', authenticate, (req, res) => {
  try {
    const rawRequests = db.all(`
      SELECT r.*, p.name as platform_name, p.category as platform_category,
             p.deletion_url, p.deletion_method, p.deletion_email,
             i.value as identity_value
      FROM deletion_requests r
      JOIN platforms p ON r.platform_id = p.id
      LEFT JOIN identities i ON r.identity_id = i.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.id]);

    const enrichedRequests = rawRequests.map(enrichWithDeadline);

    const summary = {
      total: enrichedRequests.length,
      completed: enrichedRequests.filter(r => r.status === 'completed').length,
      pending: enrichedRequests.filter(r => r.status !== 'completed').length,
      urgent: enrichedRequests.filter(r => r.urgencyStatus === 'urgent').length,
      overdue: enrichedRequests.filter(r => r.urgencyStatus === 'overdue').length
    };

    res.json({
      summary,
      requests: enrichedRequests
    });
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
        message: `Solicitud para ${platform.name} actualizada con nuevo plazo de 30 días`,
        request: enrichWithDeadline(updated)
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
      message: `Solicitud de eliminación para ${platform.name} registrada (Plazo legal de 30 días iniciado)`,
      request: enrichWithDeadline(created)
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
      request: enrichWithDeadline(updated)
    });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando solicitud', details: err.message });
  }
});

module.exports = router;
