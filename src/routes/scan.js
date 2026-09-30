const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { scanLimiter } = require('../middleware/rateLimit');
const { checkEmail, checkPhone, checkUsername, checkPassword, calculateExposureScore } = require('../services/hibpService');
const db = require('../config/db');

// POST /api/v1/scan - Escanear identidades del usuario (emails, teléfonos y alias)
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
      targetIdentities = db.all("SELECT * FROM identities WHERE user_id = ? AND active = 1", [req.user.id]);
    }

    if (targetIdentities.length === 0) {
      return res.status(400).json({ error: 'No hay identidades activas (correos, teléfonos o alias) para auditar.' });
    }

    const scanResults = [];
    let totalNewBreaches = 0;

    for (const identity of targetIdentities) {
      let intelResult;
      if (identity.type === 'phone') {
        intelResult = await checkPhone(identity.value);
      } else if (identity.type === 'username') {
        intelResult = await checkUsername(identity.value);
      } else {
        intelResult = await checkEmail(identity.value);
      }

      let newBreachesCount = 0;
      if (intelResult.breached && Array.isArray(intelResult.breaches)) {
        for (const breach of intelResult.breaches) {
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
        breached: intelResult.breached,
        mode: intelResult.mode,
        totalBreachesDetected: intelResult.breaches?.length || 0,
        newBreachesSaved: newBreachesCount,
        breaches: intelResult.breaches || []
      });
    }

    // Calcular nuevo índice de exposición (considerando solo brechas no mitigadas)
    const unmitigatedCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1 AND (b.is_mitigated = 0 OR b.is_mitigated IS NULL)
    `, [req.user.id]).c;

    const platformsCount = db.get('SELECT COUNT(*) as c FROM platforms WHERE active = 1').c;
    const completedDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [req.user.id]).c;
    const verifiedIdentities = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1 AND verified = 1', [req.user.id]).c;

    const exposureScore = calculateExposureScore({
      breachCount: unmitigatedCount,
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
    const unmitigatedCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1 AND (b.is_mitigated = 0 OR b.is_mitigated IS NULL)
    `, [req.user.id]).c;

    const totalBreachesCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1
    `, [req.user.id]).c;

    const mitigatedCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1 AND b.is_mitigated = 1
    `, [req.user.id]).c;

    const identitiesCount = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1', [req.user.id]).c;
    const verifiedIdentities = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1 AND verified = 1', [req.user.id]).c;
    const pendingDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status != 'completed'", [req.user.id]).c;
    const completedDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [req.user.id]).c;

    const score = calculateExposureScore({
      breachCount: unmitigatedCount,
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

    let breachAdvice = 'No hay filtraciones críticas detectadas en este momento.';
    if (unmitigatedCount > 0) {
      breachAdvice = `Tienes ${unmitigatedCount} brecha(s) activa(s): cambia de inmediato tus contraseñas en los servicios comprometidos.`;
    } else if (mitigatedCount > 0 && unmitigatedCount === 0) {
      breachAdvice = '¡Excelente! Todas las filtraciones detectadas han sido marcadas como mitigadas con claves cambiadas.';
    }

    res.json({
      score,
      riskLevel,
      riskColor,
      metrics: {
        totalBreaches: totalBreachesCount,
        activeBreaches: unmitigatedCount,
        mitigatedBreaches: mitigatedCount,
        monitoredIdentities: identitiesCount,
        verifiedIdentities,
        pendingDeletions,
        completedDeletions
      },
      recommendations: [
        breachAdvice,
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
      ORDER BY COALESCE(b.is_mitigated, 0) ASC, b.detected_at DESC
    `, [req.user.id]);

    const formatted = breaches.map(b => ({
      ...b,
      is_mitigated: b.is_mitigated ? 1 : 0,
      compromisedData: b.compromised_data ? JSON.parse(b.compromised_data) : []
    }));

    res.json({ breaches: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Error consultando filtraciones', details: err.message });
  }
});

// PATCH /api/v1/scan/breaches/:id/mitigate - Marcar o desmarcar una brecha como mitigada
router.patch('/breaches/:id/mitigate', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const breach = db.get(`
      SELECT b.* FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE b.id = ? AND i.user_id = ?
    `, [id, req.user.id]);

    if (!breach) {
      return res.status(404).json({ error: 'Filtración no encontrada o no autorizada.' });
    }

    const newMitigated = breach.is_mitigated ? 0 : 1;
    const mitigatedAt = newMitigated ? new Date().toISOString() : null;

    db.run('UPDATE breaches SET is_mitigated = ?, mitigated_at = ? WHERE id = ?', [newMitigated, mitigatedAt, id]);

    // Recalcular índice de exposición en tiempo real
    const unmitigatedCount = db.get(`
      SELECT COUNT(*) as c FROM breaches b
      JOIN identities i ON b.identity_id = i.id
      WHERE i.user_id = ? AND i.active = 1 AND (b.is_mitigated = 0 OR b.is_mitigated IS NULL)
    `, [req.user.id]).c;

    const completedDeletions = db.get("SELECT COUNT(*) as c FROM deletion_requests WHERE user_id = ? AND status = 'completed'", [req.user.id]).c;
    const verifiedIdentities = db.get('SELECT COUNT(*) as c FROM identities WHERE user_id = ? AND active = 1 AND verified = 1', [req.user.id]).c;

    const exposureScore = calculateExposureScore({
      breachCount: unmitigatedCount,
      platformsCount: 8,
      completedDeletions,
      verifiedIdentities
    });

    res.json({
      success: true,
      breachId: id,
      is_mitigated: newMitigated,
      mitigated_at: mitigatedAt,
      exposureScore
    });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando remediación de brecha', details: err.message });
  }
});

module.exports = router;
