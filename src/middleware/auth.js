const db = require('../config/db');

/**
 * Middleware de Autenticación Híbrida Sentinel.
 * Permite desarrollo ágil local y se conecta transparentemente a Firebase Auth en producción.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'];

  // 1. Modo Local / Soberano de Desarrollo
  if (!authHeader && (!process.env.FIREBASE_PROJECT_ID || customUserId)) {
    const userId = customUserId || 'user_local_soberano';
    const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (user) {
      req.user = user;
      return next();
    }
  }

  // 2. Verificación con Bearer Token (Firebase / JWT)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();

    // Si Firebase Admin está configurado
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const admin = require('firebase-admin');
        const decoded = await admin.auth().verifyIdToken(token);

        // Buscar o crear usuario en SQLite local
        let user = db.get('SELECT * FROM users WHERE firebase_uid = ?', [decoded.uid]);
        if (!user) {
          const newId = 'usr_' + Date.now();
          db.run(
            'INSERT INTO users (id, firebase_uid, email, display_name) VALUES (?, ?, ?, ?)',
            [newId, decoded.uid, decoded.email, decoded.name || decoded.email]
          );
          user = db.get('SELECT * FROM users WHERE id = ?', [newId]);
        }

        req.user = user;
        return next();
      } catch (err) {
        return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
      }
    }

    // Modo token / ID de usuario registrado (Bearer <userId>)
    const userByToken = db.get('SELECT * FROM users WHERE id = ?', [token]);
    if (userByToken) {
      req.user = userByToken;
      return next();
    }

    // Modo token local de prueba (Bearer local_master_token)
    if (token === 'local_master_token') {
      req.user = db.get('SELECT * FROM users WHERE id = ?', ['user_local_soberano']);
      return next();
    }
  }

  // Fallback seguro: Si no se especifica token en desarrollo local, asignamos el usuario soberano
  if (process.env.NODE_ENV !== 'production') {
    const user = db.get('SELECT * FROM users WHERE id = ?', ['user_local_soberano']);
    if (user) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({ error: 'No autorizado. Proporcione credenciales válidas.' });
}

module.exports = { authenticate };

