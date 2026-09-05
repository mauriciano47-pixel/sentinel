const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { scanLimiter } = require('../middleware/rateLimit');
const { checkEmail, checkPassword, calculateExposureScore } = require('../services/hibpService');
const db = require('../config/db');

// POST /api/v1/scan - Escanear identidades del usuario
router.post('/', authenticate, scanLimiter, async (req, res) => {
  try {
    const { identityId } = req.body;

    let targetIdentities = [];
    if (identityId) {
      const target = db.get('SELECT * FROM identities WHERE id = ? AND user_id = ? AND active = 1', [identityId, req.user.id]);
      if (!target) {
        return res.status(404).json({ error: 'Identidad no encontrada' });
      }
      targetIdentities = [target];
    } else {
      targetIdentities = db.all("SELECT * FROM identities WHERE user_id = ? AND type = 'email' AND active = 1", [req.user.id]);
    }

    if (targetIdentities.length === 0) {
      return res.status(400).json({ error: 'No hay identidades de tipo email activas para escanear.' });
    }

    const scanResults = [];
    let totalNewBreaches = 0;

    for (const identity of targetIdentities) {
      const hibpResult = await checkEmail(identity.value);

      let newBreachesCount = 0;
      if (hibpResult.breached && Array.isArray(hibpResult.breaches)) {
        for (const breach of hibpResult.breaches) {
          const exists = db.get('SELECT id FROM breaches WHERE identity_id = ? AND breach_name = ?', [identity.id, breach.name]);
          if (!exists) {
            const breachId = 'br_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            db.run(`
              INSERT INTO breaches (id, identity_id, breach_name, breach_title, breach_date, compromised_data, description, is_verified, is_sensitive, is_retired)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              breachId,
              identity.id,
              breach.name,
              breach.title || breach.name,
              breach.date || null,
              JSON.stringify(breach.compromisedData || []),
              breach.description || null,
              breach.isVerified || 1,
              breach.isSensitive || 0,
              breach.isRetired || 0
            ]);
            newBreachesCount++;
          }
        }
      }

      totalNewBreaches += newBreachesCount;
      scanResults.push({
        identity: identity.value,
        type: identity.type,
        breached: hibpResult.breached,
        mode: hibpResult.mode,
        totalBreachesDetected: hibpResult.breaches?.length || 0,
        newBreachesSaved: newBreachesCount,
        breaches: hibpResult.breaches || []
      });
    }

    // Calcular nuevo índice de exposición
    const breachCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1
    `, [req.user.id]).c;

    const platformsCount = db.get('SELECT COUNT(*) as c FROM platforms WHERE active = 1').c;
    const completedDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [req.user.id]).c;
    const verifiedIdentities = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1 AND verified = 1', [req.user.id]).c;

    const exposureScore = calculateExposureScore({
      breachCount,
      platformsCount: Math.min(platformsCount, 15),
      completedDeletions,
      verifiedIdentities
    });

    res.json({
      success: true,
      message: `Escaneo completado. ${totalNewBreaches} nuevas filtraciones registradas.`,
      totalNewBreaches,
      exposureScore,
      results: scanResults
    });

  } catch (err) {
    console.error('Error en escaneo:', err);
    res.status(500).json({ error: 'Error durante el proceso de escaneo', details: err.message });
  }
});

// GET /api/v1/scan/exposure - Obtener índice de exposición actual y métricas de seguridad
router.get('/exposure', authenticate, (req, res) => {
  try {
    const breachCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1
    `, [req.user.id]).c;

    const identitiesCount = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1', [req.user.id]).c;
    const verifiedIdentities = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1 AND verified = 1', [req.user.id]).c;
    const pendingDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status != 'completed'", [req.user.id]).c;
    const completedDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [req.user.id]).c;

    const score = calculateExposureScore({
      breachCount,
      platformsCount: 8,
      completedDeletions,
      verifiedIdentities
    });

    let riskLevel = 'Bajo';
    let riskColor = '#10B981'; // Emerald
    if (score >= 65) {
      riskLevel = 'Crítico';
      riskColor = '#EF4444'; // Red
    } else if (score >= 35) {
      riskLevel = 'Moderado';
      riskColor = '#F59E0B'; // Amber
    }

    res.json({
      score,
      riskLevel,
      riskColor,
      metrics: {
        totalBreaches: breachCount,
        monitoredIdentities: identitiesCount,
        verifiedIdentities,
        pendingDeletions,
        completedDeletions
      },
      recommendations: [
        breachCount > 0 ? 'Cambia las contraseñas en los servicios comprometidos detectados.' : 'No hay filtraciones críticas detectadas en este momento.',
        'Habilita la autenticación en dos factores (2FA / FIDO2) en tus correos principales.',
        'Envía solicitudes de derecho al olvido (Art. 17 RGPD) a las plataformas que ya no utilices.'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error calculando índice de exposición', details: err.message });
  }
});

// POST /api/v1/scan/password - Verificación k-Anonymity segura
router.post('/password', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Debe ingresar una contraseña a verificar' });
    }

    const check = await checkPassword(password);

    res.json({
      success: true,
      pwned: check.pwned,
      timesCompromised: check.count,
      advice: check.pwned
        ? `⚠️ Esta contraseña ha aparecido ${check.count.toLocaleString()} veces en brechas de datos. No la utilices.`
        : '🛡️ Esta contraseña no ha sido detectada en filtraciones públicas conocidas.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando contraseña', details: err.message });
  }
});

// GET /api/v1/scan/breaches - Listado de brechas históricas
router.get('/breaches', authenticate, (req, res) => {
  try {
    const breaches = db.all(`
      SELECT b.*, i.value as identity_value, i.type as identity_type
      FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1
      ORDER BY b.detected_at DESC
    `, [req.user.id]);

    const formatted = breaches.map(b => ({
      ...b,
      compromisedData: b.compromised_data ? JSON.parse(b.compromised_data) : []
    }));

    res.json({ breaches: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Error consultando filtraciones', details: err.message });
  }
});

module.exports = router;
