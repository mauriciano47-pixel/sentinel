const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

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

  // Sembrado o actualización del catálogo maestro a 50+ plataformas
  seedPlatforms();

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
    INSERT OR IGNORE INTO platforms (name, category, website, deletion_url, deletion_method, deletion_email, gdpr_template, difficulty, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const platformsData = [
    // === 1. REDES SOCIALES ===
    [
      'Google', 'bigtech', 'https://google.com',
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
      'TikTok', 'social', 'https://tiktok.com',
      'https://support.tiktok.com/es/account-and-privacy/deleting-an-account', 'form', null,
      'Solicito la eliminación completa de mi cuenta de TikTok y la revocación de todo consentimiento sobre datos biométricos, comportamentales y de ubicación.',
      2, '1. En la app: Perfil > Ajustes y Privacidad > Administrar cuenta > Eliminar cuenta.\n2. Selecciona "Eliminar cuenta permanentemente".'
    ],
    [
      'Snapchat', 'social', 'https://snapchat.com',
      'https://accounts.snapchat.com/accounts/delete_account', 'form', null,
      'Solicito la supresión definitiva de mi cuenta de Snapchat, recuerdos en la nube y registros asociados.',
      2, '1. Ingresa a accounts.snapchat.com con tus credenciales.\n2. Confirma la solicitud de borrado.\n3. Tu cuenta se desactiva y se purga en 30 días.'
    ],
    [
      'Pinterest', 'social', 'https://pinterest.com',
      'https://www.pinterest.com/settings/account-settings', 'form', 'privacy-support@pinterest.com',
      'Solicito el cierre de mi cuenta de Pinterest y la desindexación de mis tableros y datos analíticos personales.',
      2, '1. Ve a Ajustes > Gestión de cuenta.\n2. En la sección "Eliminar cuenta", pulsa en Cerrar cuenta.\n3. Confirma el correo de verificación recibido.'
    ],
    [
      'LinkedIn', 'social', 'https://linkedin.com',
      'https://www.linkedin.com/mypreferences/d/close-account', 'form', null,
      'Solicito el cierre definitivo de mi perfil profesional y la eliminación de mis datos en LinkedIn y bases de datos asociadas de reclutamiento.',
      2, '1. Ve a Ajustes y Privacidad > Gestión de la cuenta > Cerrar cuenta.\n2. Selecciona el motivo y confirma tu contraseña.'
    ],
    [
      'Threads', 'social', 'https://threads.net',
      'https://help.instagram.com/515230437301944', 'form', null,
      'Solicito la eliminación independiente de mi perfil y publicaciones en Threads conforme a las directivas de privacidad de Meta.',
      2, '1. En la app Threads: Perfil > Ajustes > Cuenta > Desactivar o eliminar perfil.\n2. Pulsa "Eliminar perfil de Threads".'
    ],
    [
      'BeReal', 'social', 'https://bereal.com',
      null, 'form', 'contact@bereal.com',
      'Solicito el borrado de mis fotos diarias BeReal y datos de localización asociados conforme al RGPD.',
      2, '1. En la app: Perfil > Ajustes > Ayuda > Contáctanos > Eliminar mi cuenta.\n2. Confirma la purga de datos.'
    ],
    [
      'Tumblr', 'social', 'https://tumblr.com',
      'https://www.tumblr.com/settings/account/delete', 'form', null,
      'Solicito la eliminación irreversible de mi blog y cuenta de usuario en Tumblr.',
      2, '1. Ve a Configuración de Cuenta.\n2. Desplázate hasta abajo y pulsa "Eliminar cuenta".'
    ],

    // === 2. APPS DE CITAS ===
    [
      'Tinder', 'citas', 'https://tinder.com',
      'https://tinder.com/app/settings', 'form', 'privacy@gotinder.com',
      'Solicito la supresión permanente de mi perfil en Tinder, historial de matches, fotos y geolocalización almacenada.',
      3, '1. Ve a Ajustes en la app o web.\n2. Al final, selecciona "Eliminar cuenta".\n3. Confirma el borrado definitivo (no pausar).'
    ],
    [
      'Bumble', 'citas', 'https://bumble.com',
      null, 'form', 'dpo@bumble.com',
      'Solicito la eliminación completa de mis datos en Bumble y la revocación de todo consentimiento de emparejamiento algorítmico.',
      2, '1. Ajustes > Desplázate al fondo > Eliminar cuenta.\n2. Escribe la palabra "eliminar" para confirmar.'
    ],
    [
      'Badoo', 'citas', 'https://badoo.com',
      'https://badoo.com/settings/', 'form', null,
      'Solicito la eliminación definitiva de mi cuenta y fotos en la red Badoo conforme al RGPD.',
      2, '1. Ve a Configuración > Cuenta.\n2. Haz clic en "Eliminar cuenta" y confirma con contraseña.'
    ],
    [
      'Grindr', 'citas', 'https://grindr.com',
      null, 'form', 'privacy@grindr.com',
      'Solicito la eliminación inmediata de mi cuenta y metadatos de ubicación precisos en Grindr en virtud del Art. 17 RGPD.',
      3, '1. En la app: Ajustes > Desactivar > Eliminar cuenta.\n2. Confirma credenciales.'
    ],
    [
      'Hinge', 'citas', 'https://hinge.co',
      null, 'form', 'privacy@hinge.co',
      'Solicito el borrado irrevocable de mis respuestas de perfil, fotos y preferencias en Hinge.',
      2, '1. Perfil > Ajustes > Eliminar cuenta.\n2. Confirma la eliminación total.'
    ],
    [
      'OkCupid', 'citas', 'https://okcupid.com',
      'https://www.okcupid.com/settings', 'form', null,
      'Solicito la supresión definitiva de mi perfil y respuestas del cuestionario psicológico en OkCupid.',
      2, '1. Ajustes de perfil > Cuenta.\n2. Pulsa "Eliminar tu cuenta" y confirma.'
    ],

    // === 3. BIG TECH & CLOUD ===
    [
      'Apple ID', 'bigtech', 'https://apple.com',
      'https://privacy.apple.com', 'form', null,
      'Solicito la eliminación de mi cuenta de Apple ID y todos los datos asociados en iCloud conforme al RGPD.',
      3, '1. Inicia sesión en privacy.apple.com.\n2. Ve a "Eliminar tu cuenta" > Solicitar eliminación.\n3. Recibirás un código de acceso único de confirmación.'
    ],
    [
      'Microsoft', 'bigtech', 'https://microsoft.com',
      'https://account.live.com/closeaccount.aspx', 'form', null,
      'Solicito el cierre de mi cuenta Microsoft y la supresión de mis correos Outlook y archivos de OneDrive.',
      2, '1. Entra a account.live.com/closeaccount.aspx.\n2. Elige el periodo de espera (30 o 60 días) y marca las casillas de confirmación.'
    ],
    [
      'Amazon', 'bigtech', 'https://amazon.com',
      'https://www.amazon.com/privacy/data-deletion', 'form', 'privacy@amazon.com',
      'Solicito la eliminación definitiva de mi cuenta de cliente de Amazon y el borrado de historiales de compra y direcciones almacenadas conforme al RGPD.',
      3, '1. Visita la página oficial de Solicitud de Cierre de Cuenta de Amazon.\n2. Marca la casilla de confirmación y pulsa "Cerrar mi cuenta permanentemente".'
    ],
    [
      'Yahoo', 'bigtech', 'https://yahoo.com',
      'https://login.yahoo.com/account/delete-user', 'form', null,
      'Solicito la cancelación y borrado permanente de mi cuenta de Yahoo Mail y servicios vinculados.',
      2, '1. Entra a login.yahoo.com/account/delete-user.\n2. Lee las condiciones y confirma "Continuar para eliminar".'
    ],
    [
      'Dropbox', 'bigtech', 'https://dropbox.com',
      'https://www.dropbox.com/account/delete', 'form', 'privacy@dropbox.com',
      'Solicito el borrado de mi cuenta de Dropbox y la eliminación irrevocable de mis archivos en la nube.',
      2, '1. Ve a Configuración de la cuenta.\n2. Haz clic en "Eliminar cuenta" al final de la página.\n3. Confirma tu contraseña.'
    ],
    [
      'GitHub', 'bigtech', 'https://github.com',
      'https://github.com/settings/admin', 'form', null,
      'Solicito la eliminación completa de mi cuenta personal de GitHub y repositorios privados.',
      2, '1. Settings > Account > Delete your account.\n2. Confirma escribiendo tu nombre de usuario y contraseña.'
    ],

    // === 4. STREAMING & ENTRETENIMIENTO ===
    [
      'Netflix', 'streaming', 'https://netflix.com',
      null, 'email', 'privacy@netflix.com',
      'Solicito la supresión anticipada y definitiva de mis datos personales e historial de streaming en Netflix conforme al RGPD tras haber cancelado mi membresía.',
      3, '1. Cancela tu membresía activa en Cuenta.\n2. Envía un correo a privacy@netflix.com desde el email registrado solicitando la supresión anticipada (de lo contrario retienen 10 meses).'
    ],
    [
      'Spotify', 'streaming', 'https://spotify.com',
      'https://www.spotify.com/account/close-account/', 'form', 'privacy@spotify.com',
      'Solicito la eliminación total de mi cuenta de Spotify, listas guardadas e historial de escucha conforme al Art. 17 RGPD.',
      2, '1. Inicia sesión en la web de Spotify.\n2. Ve a Soporte > Cerrar cuenta permanentemente.\n3. Confirma el correo de verificación recibido.'
    ],
    [
      'Disney+', 'streaming', 'https://disneyplus.com',
      'https://www.disneyplus.com/account', 'form', 'privacy@disney.com',
      'Solicito la eliminación de mi cuenta de Disney+ y del ecosistema The Walt Disney Company.',
      3, '1. Cuenta > Eliminar cuenta al fondo.\n2. Introduce el código de 6 dígitos enviado a tu correo.'
    ],
    [
      'Max (HBO)', 'streaming', 'https://max.com',
      'https://privacyportal.onetrust.com/webform/53e4b216-9213-4b67-92d1-24864f1dbde9/82438883-8a3c-449e-8c87-8d052cb77c38', 'form', 'privacy@max.com',
      'Solicito la supresión de mis registros de usuario en Warner Bros. Discovery / Max.',
      3, '1. Abre el portal de privacidad oficial de Warner Bros. Discovery.\n2. Selecciona "Right to Delete" e introduce tu correo registrado.'
    ],
    [
      'Twitch', 'streaming', 'https://twitch.tv',
      'https://www.twitch.tv/user/delete-account', 'form', null,
      'Solicito la eliminación irreversible de mi cuenta de Twitch y datos de chat asociados.',
      2, '1. Ve a twitch.tv/user/delete-account.\n2. Confirma con tu contraseña.'
    ],
    [
      'Steam (Valve)', 'streaming', 'https://store.steampowered.com',
      'https://help.steampowered.com/es/wizard/HelpDeleteAccount', 'form', null,
      'Solicito la eliminación permanente de mi cuenta de Steam y renuncia de licencias digitales conforme al RGPD.',
      4, '1. Visita la página de soporte de eliminación de cuenta de Steam.\n2. Verifica la propiedad de la cuenta y envía el ticket al equipo de soporte de Valve.'
    ],
    [
      'Epic Games', 'streaming', 'https://epicgames.com',
      'https://www.epicgames.com/account/personal', 'form', null,
      'Solicito la eliminación definitiva de mi cuenta de Epic Games Store y compras vinculadas.',
      2, '1. Ajustes de Cuenta > General.\n2. En la sección "Eliminar cuenta", pulsa "Solicitar eliminación de la cuenta".\n3. Introduce el código de seguridad recibido por email.'
    ],
    [
      'Deezer', 'streaming', 'https://deezer.com',
      'https://www.deezer.com/account/delete', 'form', 'privacy@deezer.com',
      'Solicito el borrado de mi suscripción y cuenta en Deezer conforme a la normativa europea de protección de datos.',
      2, '1. Mi Cuenta > Ajustes > Eliminar mi cuenta.\n2. Confirma contraseña.'
    ],

    // === 5. FINTECH & COMERCIO ===
    [
      'PayPal', 'fintech_comercio', 'https://paypal.com',
      'https://www.paypal.com/myaccount/settings', 'form', 'enquiry@paypal.com',
      'Solicito el cierre de mi cuenta PayPal y la eliminación de mis datos financieros tras la retención legal obligatoria de prevención de fraude.',
      3, '1. Inicia sesión > Ajustes (icono de engranaje).\n2. En la pestaña Cuenta, ve al fondo y haz clic en "Cerrar cuenta".\n3. Confirma que tu saldo esté en cero.'
    ],
    [
      'MercadoLibre', 'fintech_comercio', 'https://mercadolibre.com',
      'https://myaccount.mercadolibre.com/users/cancellation', 'form', null,
      'Solicito la cancelación definitiva de mi cuenta de MercadoLibre y MercadoPago y el borrado de registros de compra.',
      3, '1. Mi Cuenta > Seguridad > Cancelar cuenta.\n2. Asegúrate de no tener operaciones activas ni deuda pendiente.'
    ],
    [
      'eBay', 'fintech_comercio', 'https://ebay.com',
      'https://www.ebay.com/help/account/changing-account-settings/closing-account?id=4199', 'form', null,
      'Solicito el cierre de mi cuenta de eBay y la supresión de mis datos personales en sus bases de datos.',
      3, '1. Ve a "Cerrar tu cuenta de eBay".\n2. Selecciona el motivo y acepta las condiciones legales.'
    ],
    [
      'Uber / Uber Eats', 'fintech_comercio', 'https://uber.com',
      'https://myprivacy.uber.com/ext/privacy/home', 'form', null,
      'Solicito la eliminación de mi cuenta de Uber y el borrado de mi historial de viajes, ubicaciones y métodos de pago.',
      2, '1. Abre myprivacy.uber.com.\n2. Pulsa en "Eliminar mi cuenta de Uber".\n3. Tras 30 días se elimina de forma permanente.'
    ],
    [
      'Airbnb', 'fintech_comercio', 'https://airbnb.com',
      'https://www.airbnb.com/help/article/240', 'form', 'dpo@airbnb.com',
      'Solicito la eliminación de mi cuenta de huésped/anfitrión en Airbnb conforme al Art. 17 RGPD.',
      3, '1. Cuenta > Privacidad y uso compartido.\n2. Haz clic en "Solicitar la eliminación de tu cuenta".'
    ],
    [
      'AliExpress', 'fintech_comercio', 'https://aliexpress.com',
      'https://privacy.aliexpress.com', 'form', null,
      'Solicito la supresión definitiva de mi perfil en Alibaba/AliExpress conforme al RGPD.',
      3, '1. Mi Cuenta > Ajustes > Editar perfil > Eliminar cuenta.\n2. Confirma con código de verificación SMS/Email.'
    ],
    [
      'Rappi', 'fintech_comercio', 'https://rappi.com',
      null, 'email', 'habeasdata@rappi.com',
      'Solicito la eliminación de mi cuenta en Rappi y la supresión de mis direcciones y teléfonos registrados.',
      3, '1. Envía un correo a habeasdata@rappi.com solicitando la eliminación de tus datos personales.\n2. Adjunta documento identificativo si te lo solicitan.'
    ],
    [
      'Cabify', 'fintech_comercio', 'https://cabify.com',
      'https://help.cabify.com', 'form', 'datos.personales@cabify.com',
      'Solicito la baja de mi cuenta de usuario y eliminación de registros de movilidad en Cabify.',
      2, '1. En la app: Perfil > Mi cuenta > Eliminar cuenta.\n2. Confirma tu solicitud.'
    ],

    // === 6. MENSAJERÍA & COMUNIDAD ===
    [
      'Telegram', 'mensajeria_comunidad', 'https://telegram.org',
      'https://my.telegram.org/auth?to=delete', 'form', null,
      'Solicito la eliminación inmediata de mi cuenta de Telegram y todos los chats en la nube asociados a mi número telefónico.',
      2, '1. Abre my.telegram.org en un navegador.\n2. Ingresa tu número telefónico en formato internacional.\n3. Introduce el código recibido en Telegram y pulsa "Delete My Account".'
    ],
    [
      'Discord', 'mensajeria_comunidad', 'https://discord.com',
      null, 'form', 'privacy@discord.com',
      'Solicito la supresión total de mi cuenta de Discord, mensajes y registros de voz/servidores conforme al Art. 17 RGPD.',
      2, '1. Abre Ajustes de Usuario > Mi Cuenta.\n2. Desplázate hasta el final y haz clic en "Eliminar cuenta".\n3. Ingresa tu contraseña y código 2FA si aplica.'
    ],
    [
      'Reddit', 'mensajeria_comunidad', 'https://reddit.com',
      'https://www.reddit.com/settings', 'form', null,
      'Solicito la eliminación irreversible de mi cuenta de Reddit y la desvinculación de mis publicaciones.',
      2, '1. Ve a Ajustes de Usuario.\n2. En la pestaña Cuenta, ve al fondo y pulsa "Eliminar cuenta".\n3. Confirma credenciales.'
    ],
    [
      'Quora', 'mensajeria_comunidad', 'https://quora.com',
      'https://www.quora.com/settings/privacy', 'form', 'privacy@quora.com',
      'Solicito el borrado de mi perfil de Quora y la desindexación de mis respuestas conforme al RGPD.',
      2, '1. Ajustes > Privacidad.\n2. Al fondo, haz clic en "Eliminar cuenta" e introduce tu contraseña.'
    ],
    [
      'WhatsApp', 'mensajeria_comunidad', 'https://whatsapp.com',
      null, 'form', null,
      'Solicito la supresión definitiva de mi registro telefónico e historial de copias de seguridad en los servidores de WhatsApp/Meta.',
      1, '1. En la app: Ajustes > Cuenta > Eliminar cuenta.\n2. Introduce tu número de teléfono y pulsa "Eliminar mi cuenta".'
    ],
    [
      'Slack', 'mensajeria_comunidad', 'https://slack.com',
      'https://slack.com/account/settings', 'form', 'privacy@slack.com',
      'Solicito la desactivación de mi perfil en los espacios de trabajo de Slack y la eliminación de mis datos personales.',
      3, '1. Entra en tu espacio de trabajo > Perfil > Preferencias > Cuenta.\n2. Haz clic en "Desactivar cuenta".'
    ],
    [
      'Skype (Microsoft)', 'mensajeria_comunidad', 'https://skype.com',
      'https://support.skype.com/es/faq/fa142/como-puedo-cerrar-mi-cuenta-de-skype', 'form', null,
      'Solicito el cierre de mi perfil de Skype y borrado de directorio público de búsqueda.',
      2, '1. Sigue las instrucciones de cierre de cuenta Microsoft vinculada a tu Skype.'
    ],

    // === 7. DATA BROKERS (BROKERS DE DATOS & BUSCADORES DE PERSONAS) ===
    [
      'Whitepages', 'data_brokers', 'https://whitepages.com',
      'https://www.whitepages.com/suppression-requests', 'form', 'privacy@whitepages.com',
      'Solicito el opt-out inmediato y la eliminación completa de mis registros públicos, teléfonos y direcciones indexadas en Whitepages.',
      3, '1. Busca tu perfil en whitepages.com y copia la URL.\n2. Ve a whitepages.com/suppression-requests.\n3. Pega la URL y completa la verificación telefónica automatizada.'
    ],
    [
      'Spokeo', 'data_brokers', 'https://spokeo.com',
      'https://www.spokeo.com/optout', 'form', 'privacy@spokeo.com',
      'Solicito la supresión definitiva de mi perfil y registros agregados en el portal Spokeo conforme a la CCPA/RGPD.',
      3, '1. Busca tu registro en Spokeo y copia el enlace.\n2. Ingresa a spokeo.com/optout.\n3. Pega el enlace y confirma mediante el enlace recibido en tu correo.'
    ],
    [
      'Radaris', 'data_brokers', 'https://radaris.com',
      'https://radaris.com/control/privacy', 'form', 'customer-service@radaris.com',
      'Solicito la remoción permanente de mis datos personales del motor de búsqueda Radaris.',
      3, '1. Encuentra tu perfil en Radaris.\n2. Ve a radaris.com/control/privacy y solicita la eliminación de registros.'
    ],
    [
      'BeenVerified', 'data_brokers', 'https://beenverified.com',
      'https://www.beenverified.com/app/optout/search', 'form', 'privacy@beenverified.com',
      'Solicito el ejercicio de mi derecho de exclusión (opt-out) y borrado total de antecedentes en BeenVerified.',
      3, '1. Ingresa a beenverified.com/app/optout/search.\n2. Busca tu nombre y selecciona tu registro.\n3. Confirma el enlace recibido por email.'
    ],
    [
      'FastPeopleSearch', 'data_brokers', 'https://fastpeoplesearch.com',
      'https://www.fastpeoplesearch.com/removal', 'form', 'privacy@fastpeoplesearch.com',
      'Solicito la eliminación de mi registro de FastPeopleSearch y la purga de asociaciones familiares y domiciliarias.',
      2, '1. Visita fastpeoplesearch.com/removal.\n2. Acepta los términos y busca tu ficha.\n3. Haz clic en "Remove my record".'
    ]
  ];

  for (const p of platformsData) {
    insertStmt.run(...p);
  }
}

// Inicializar al cargar
initDatabase();

module.exports = {
  db,
  all: (sql, params = []) => db.prepare(sql).all(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params),
  run: (sql, params = []) => db.prepare(sql).run(...params),
  exec: (sql) => db.exec(sql)
};
