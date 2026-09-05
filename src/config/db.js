const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_FILE = process.env.DB_FILE || 'sentinel.sqlite3';
const dbPath = path.resolve(process.cwd(), DB_FILE);

// Instancia de base de datos SQLite integrada (Zero dependencies, Zero C++ errors)
const db = new DatabaseSync(dbPath);

// Habilitar claves foráneas y modo WAL para máxima concurrencia y velocidad
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
  db.exec(`
    -- 1. Tabla de Usuarios
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firebase_uid TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'guard', 'sentinel')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Tabla de Identidades (Emails, Teléfonos, Usernames)
    CREATE TABLE IF NOT EXISTS identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'username')),
      value TEXT NOT NULL,
      label TEXT,
      verified INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, type, value)
    );

    -- 3. Tabla de Plataformas Curadas
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      website TEXT,
      deletion_url TEXT,
      deletion_method TEXT NOT NULL CHECK (deletion_method IN ('email', 'form', 'api', 'manual')),
      deletion_email TEXT,
      gdpr_template TEXT,
      difficulty INTEGER DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
      instructions TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Solicitudes de Eliminación
    CREATE TABLE IF NOT EXISTS deletion_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform_id INTEGER NOT NULL,
      identity_id TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed', 'completed', 'failed', 'cancelled')),
      sent_at DATETIME,
      completed_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
      FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE SET NULL
    );

    -- 5. Filtraciones Detectadas (Breaches)
    CREATE TABLE IF NOT EXISTS breaches (
      id TEXT PRIMARY KEY,
      identity_id TEXT NOT NULL,
      breach_name TEXT NOT NULL,
      breach_title TEXT,
      breach_date TEXT,
      compromised_data TEXT,
      description TEXT,
      is_verified INTEGER DEFAULT 1,
      is_sensitive INTEGER DEFAULT 0,
      is_retired INTEGER DEFAULT 0,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_breaches_identity ON breaches(identity_id);
    CREATE INDEX IF NOT EXISTS idx_requests_user ON deletion_requests(user_id);
  `);

  // Sembrado de plataformas maestras si la tabla está vacía
  const countRow = db.prepare('SELECT COUNT(*) as count FROM platforms').get();
  if (countRow.count === 0) {
    seedPlatforms();
  }

  // Sembrado de usuario por defecto (Modo Soberano / Local)
  const defaultUser = db.prepare('SELECT id FROM users WHERE id = ?').get('user_local_soberano');
  if (!defaultUser) {
    db.prepare(`
      INSERT INTO users (id, firebase_uid, email, display_name, plan)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_local_soberano', 'uid_soberano_001', 'guardian@sentinel.privacy', 'Mauro (Arconte Soberano)', 'sentinel');
  }
}

function seedPlatforms() {
  const insertStmt = db.prepare(`
    INSERT INTO platforms (name, category, website, deletion_url, deletion_method, deletion_email, gdpr_template, difficulty, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialPlatforms = [
    [
      'Google', 'servicios', 'https://google.com',
      'https://myaccount.google.com/deleteaccount', 'form', null,
      'Solicito la eliminación completa y supresión permanente de todos mis datos personales asociados a mi cuenta Google conforme al Artículo 17 del RGPD.',
      2, '1. Inicia sesión en Google.\n2. Ve a Datos y Privacidad.\n3. Selecciona "Más opciones" > "Eliminar tu cuenta de Google".\n4. Confirma contraseña.'
    ],
    [
      'Facebook (Meta)', 'social', 'https://facebook.com',
      'https://www.facebook.com/help/delete_account', 'form', null,
      'Solicito la cancelación definitiva de mi cuenta de Facebook y el borrado de todo registro, historial de navegación y datos biométricos o asociados en sus servidores.',
      2, '1. Entra al Centro de Cuentas de Meta.\n2. Selecciona "Datos personales" > "Propiedad y control de la cuenta".\n3. Elige "Desactivación o eliminación" > "Eliminar cuenta permanentemente".'
    ],
    [
      'Instagram (Meta)', 'social', 'https://instagram.com',
      'https://www.instagram.com/accounts/remove/request/permanent/', 'form', null,
      'Solicito la supresión completa de mis publicaciones, mensajes directos, métricas y datos personales en Instagram bajo la normativa GDPR/CCPA.',
      2, '1. Abre la URL en el navegador web (no en la app).\n2. Elige el motivo de eliminación.\n3. Introduce tu contraseña y confirma.'
    ],
    [
      'X (Twitter)', 'social', 'https://x.com',
      'https://twitter.com/settings/deactivate', 'form', null,
      'Solicito el ejercicio de mi derecho de supresión y derecho al olvido sobre mi cuenta de X/Twitter y tweets indexados.',
      2, '1. Ve a Configuración y Privacidad > Tu Cuenta > Desactivar cuenta.\n2. Confirma la desactivación.\n3. Tras 30 días sin iniciar sesión, tus datos se purgan permanentemente.'
    ],
    [
      'LinkedIn', 'profesional', 'https://linkedin.com',
      'https://www.linkedin.com/mypreferences/d/close-account', 'form', null,
      'Solicito el cierre definitivo de mi perfil profesional y la eliminación de mis datos en LinkedIn y bases de datos asociadas de reclutamiento.',
      2, '1. Ve a Ajustes y Privacidad > Gestión de la cuenta > Cerrar cuenta.\n2. Selecciona el motivo y confirma tu contraseña.'
    ],
    [
      'Amazon', 'comercio', 'https://amazon.com',
      'https://www.amazon.com/privacy/data-deletion', 'form', 'privacy@amazon.com',
      'Solicito la eliminación definitiva de mi cuenta de cliente de Amazon y el borrado de historiales de compra y direcciones almacenadas conforme al RGPD.',
      3, '1. Visita la página oficial de Solicitud de Cierre de Cuenta de Amazon.\n2. Marca la casilla de confirmación y pulsa "Cerrar mi cuenta permanentemente".'
    ],
    [
      'Spotify', 'entretenimiento', 'https://spotify.com',
      'https://www.spotify.com/account/close-account/', 'form', 'privacy@spotify.com',
      'Solicito la eliminación total de mi cuenta de Spotify, listas guardadas e historial de escucha conforme al Art. 17 RGPD.',
      2, '1. Inicia sesión en la web de Spotify.\n2. Ve a Soporte > Cerrar cuenta permanentemente.\n3. Confirma el correo de verificación recibido.'
    ],
    [
      'Netflix', 'entretenimiento', 'https://netflix.com',
      null, 'email', 'privacy@netflix.com',
      'Solicito la supresión anticipada y definitiva de mis datos personales e historial de streaming en Netflix conforme al RGPD tras haber cancelado mi membresía.',
      3, '1. Cancela tu membresía activa en Cuenta.\n2. Envía un correo a privacy@netflix.com desde el email registrado solicitando la supresión anticipada (de lo contrario retienen 10 meses).'
    ],
    [
      'TikTok', 'social', 'https://tiktok.com',
      'https://support.tiktok.com/es/account-and-privacy/deleting-an-account', 'form', null,
      'Solicito la eliminación completa de mi cuenta de TikTok y la revocación de todo consentimiento sobre datos biométricos, comportamentales y de ubicación.',
      2, '1. En la app: Perfil > Ajustes y Privacidad > Administrar cuenta > Eliminar cuenta.\n2. Selecciona "Eliminar cuenta permanentemente".'
    ],
    [
      'Telegram', 'mensajeria', 'https://telegram.org',
      'https://my.telegram.org/auth?to=delete', 'form', null,
      'Solicito la eliminación inmediata de mi cuenta de Telegram y todos los chats en la nube asociados a mi número telefónico.',
      2, '1. Abre my.telegram.org en un navegador.\n2. Ingresa tu número telefónico en formato internacional.\n3. Introduce el código recibido en Telegram y pulsa "Delete My Account".'
    ],
    [
      'Discord', 'comunidad', 'https://discord.com',
      null, 'form', 'privacy@discord.com',
      'Solicito la supresión total de mi cuenta de Discord, mensajes y registros de voz/servidores conforme al Art. 17 RGPD.',
      2, '1. Abre Ajustes de Usuario > Mi Cuenta.\n2. Desplázate hasta el final y haz clic en "Eliminar cuenta".\n3. Ingresa tu contraseña y código 2FA si aplica.'
    ],
    [
      'Reddit', 'comunidad', 'https://reddit.com',
      'https://www.reddit.com/settings', 'form', null,
      'Solicito la eliminación irreversible de mi cuenta de Reddit y la desvinculación de mis publicaciones.',
      2, '1. Ve a Ajustes de Usuario.\n2. En la pestaña Cuenta, ve al fondo y pulsa "Eliminar cuenta".\n3. Confirma credenciales.'
    ]
  ];

  for (const p of initialPlatforms) {
    insertStmt.run(...p);
  }
}

// Inicializar al cargar
initDatabase();

module.exports = {
  db,
  // Helper para consultas tipo SELECT que devuelven múltiples filas
  all: (sql, params = []) => {
    return db.prepare(sql).all(...params);
  },
  // Helper para consultas tipo SELECT que devuelven 1 fila
  get: (sql, params = []) => {
    return db.prepare(sql).get(...params);
  },
  // Helper para INSERT, UPDATE, DELETE
  run: (sql, params = []) => {
    return db.prepare(sql).run(...params);
  },
  // Ejecución de SQL crudo
  exec: (sql) => {
    return db.exec(sql);
  }
};
