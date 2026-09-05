const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

// GET /api/v1/identities
router.get('/', authenticate, (req, res) => {
  try {
    const identities = db.all(`
      SELECT i.*, 
        (SELECT COUNT(*) FROM breaches b WHERE b.identity_id = i.id) AS breach_count
      FROM identities i
      WHERE i.user_id = ? AND i.active = 1
      ORDER BY i.created_at DESC
    `, [req.user.id]);

    res.json({ identities });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo identidades', details: err.message });
  }
});

// POST /api/v1/identities
router.post('/', authenticate, (req, res) => {
  try {
    const { type, value, label } = req.body;

    if (!['email', 'phone', 'username'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de identidad inválido (debe ser email, phone o username)' });
    }

    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return res.status(400).json({ error: 'El valor de la identidad no puede estar vacío' });
    }

    const cleanValue = value.trim().toLowerCase();

    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanValue)) {
        return res.status(400).json({ error: 'Formato de correo electrónico inválido' });
      }
    }

    // Verificar si ya existe
    const existing = db.get(
      'SELECT id, active FROM identities WHERE user_id = ? AND type = ? AND value = ?',
      [req.user.id, type, cleanValue]
    );

    if (existing) {
      if (existing.active === 0) {
        // Reactivar
        db.run('UPDATE identities SET active = 1, label = ? WHERE id = ?', [label || null, existing.id]);
        return res.json({ success: true, message: 'Identidad reactivada con éxito', id: existing.id });
      }
      return res.status(409).json({ error: 'Esta identidad ya está registrada en tu cuenta' });
    }

    const newId = 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    db.run(`
      INSERT INTO identities (id, user_id, type, value, label)
      VALUES (?, ?, ?, ?, ?)
    `, [newId, req.user.id, type, cleanValue, label ? label.trim() : null]);

    const created = db.get('SELECT * FROM identities WHERE id = ?', [newId]);

    res.status(201).json({
      success: true,
      message: 'Identidad añadida para monitoreo continuo',
      identity: created
    });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando identidad', details: err.message });
  }
});

// DELETE /api/v1/identities/:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    const identity = db.get('SELECT id FROM identities WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!identity) {
      return res.status(404).json({ error: 'Identidad no encontrada' });
    }

    // Soft delete para mantener trazabilidad histórica
    db.run('UPDATE identities SET active = 0 WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Identidad removida del monitoreo' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando identidad', details: err.message });
  }
});

module.exports = router;
