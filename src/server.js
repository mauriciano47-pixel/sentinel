require('dotenv').config();
const express = require('express');
const path = require('node:path');
const cors = require('cors');
const helmet = require('helmet');
const net = require('node:net');

const { generalLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const identitiesRoutes = require('./routes/identities');
const scanRoutes = require('./routes/scan');
const platformsRoutes = require('./routes/platforms');
const requestsRoutes = require('./routes/requests');

const app = express();

// 1. Seguridad y Middlewares Globales
app.use(helmet({
  contentSecurityPolicy: false // Permite estilos de Google Fonts y scripts locales sin bloqueos
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(generalLimiter);

// 2. Servir Interfaz Web Cyber-Obsidian Royal
app.use(express.static(path.join(__dirname, 'public')));

// 3. Rutas de la API REST v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/identities', identitiesRoutes);
app.use('/api/v1/scan', scanRoutes);
app.use('/api/v1/platforms', platformsRoutes);
app.use('/api/v1/requests', requestsRoutes);

// 4. Endpoint de Salud / Diagnóstico
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'SENTINEL',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 5. Fallback para SPA / Dashboard
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Función para verificar si un puerto está libre
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Búsqueda inteligente del siguiente puerto libre (evita puertos ocupados)
async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await checkPortAvailable(port))) {
    console.log(`[Sentinel] Puerto ${port} ocupado, verificando ${port + 1}...`);
    port++;
  }
  return port;
}

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3001;

async function startServer() {
  const port = await findAvailablePort(DEFAULT_PORT);

  app.listen(port, () => {
    console.log('\n======================================================');
    console.log('🛡️  SENTINEL — Guardián de Datos & Orquestador GDPR  🛡️');
    console.log('======================================================');
    console.log(`🚀 Servidor activo en:    http://localhost:${port}`);
    console.log(`🌐 Dashboard interactivo: http://localhost:${port}`);
    console.log(`🔍 Diagnóstico de salud:  http://localhost:${port}/health`);
    console.log(`⚡ Entorno:               ${process.env.NODE_ENV || 'development'}`);
    console.log('======================================================\n');
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Error fatal al iniciar Sentinel:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
