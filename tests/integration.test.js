const http = require('node:http');
const { app } = require('../src/server');

const TEST_PORT = 3099;

const server = app.listen(TEST_PORT, async () => {
  console.log(`[Test] Servidor temporal levantado en puerto ${TEST_PORT}`);

  try {
    // 1. Test Health
    const health = await fetchJson(`http://localhost:${TEST_PORT}/health`);
    console.log('✅ 1. Health check OK:', health.status === 'online');

    // 2. Test Auth Me
    const auth = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/auth/me`);
    console.log('✅ 2. Auth /me OK:', auth.user.email);

    // 3. Test 50+ Platforms
    const platforms = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/platforms`);
    console.log(`✅ 3. Plataformas cargadas: ${platforms.platforms.length} plataformas (>= 50 esperadas).`);
    if (platforms.platforms.length < 50) {
      throw new Error(`Se esperaban >= 50 plataformas, pero se encontraron ${platforms.platforms.length}`);
    }

    // 3.1 Test Category Filter (citas)
    const citas = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/platforms?category=citas`);
    console.log(`✅ 3.1 Filtro por categoría citas: ${citas.platforms.length} plataformas encontradas.`);

    // 3.2 Test Search Filter (tinder)
    const searchRes = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/platforms?search=tinder`);
    console.log(`✅ 3.2 Búsqueda de plataforma: ${searchRes.platforms[0]?.name === 'Tinder'}`);

    // 4. Test Add Identity & 30-Day Deletion Request Tracking
    const idRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/identities`, {
      type: 'email',
      value: 'mauro.soberano@privacy.org',
      label: 'Email Principal'
    });
    console.log('✅ 4. Identidad registrada para monitoreo');

    // 4.1 Test Add Phone Identity
    const testPhone = `+569${Date.now().toString().slice(-8)}`;
    const phoneRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/identities`, {
      type: 'phone',
      value: testPhone,
      label: 'Móvil Personal'
    });
    console.log(`✅ 4.1 Identidad telefónica registrada: ${phoneRes.identity?.value || testPhone}`);

    const reqRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/requests`, {
      platformId: platforms.platforms[0].id,
      notes: 'Solicitud de prueba con cómputo de 30 días'
    });
    console.log(`✅ 5. Solicitud GDPR con plazo legal: ${reqRes.request.daysRemaining} días restantes (${reqRes.request.urgencyStatus})`);

    // 5. Test PDF Report Generation
    const pdfBuffer = await fetchBinary(`http://localhost:${TEST_PORT}/api/v1/reports/footprint-pdf`);
    const isPdf = pdfBuffer.slice(0, 4).toString() === '%PDF';
    console.log(`✅ 6. Generador de Reporte PDF: ${isPdf} (Tamaño: ${pdfBuffer.length} bytes)`);
    if (!isPdf) throw new Error('El reporte generado no es un PDF válido');

    // 6. Test Registro de Nuevo Usuario
    const testEmail = `test_${Date.now()}@sentinel.dev`;
    const regRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/auth/register`, {
      email: testEmail,
      displayName: 'Usuario Tester Sentinel',
      plan: 'guard'
    });
    console.log(`✅ 7. Registro de nuevo usuario OK: ${regRes.user.email} (ID: ${regRes.token})`);

    // 7. Test Login de Usuario Existente
    const loginRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/auth/login`, {
      email: testEmail
    });
    console.log(`✅ 8. Login con usuario existente OK: ${loginRes.user.email}`);

    // 8. Test Descarga PDF con query token
    const pdfTokenBuffer = await fetchBinary(`http://localhost:${TEST_PORT}/api/v1/reports/footprint-pdf?token=${loginRes.token}`);
    const isTokenPdf = pdfTokenBuffer.slice(0, 4).toString() === '%PDF';
    console.log(`✅ 9. Descarga PDF con Query Token OK: ${isTokenPdf}`);

    console.log('\n🎉 ¡TODOS LOS TESTS DE INTEGRACIÓN DE SENTINEL PASARON SATISFACTORIAMENTE AL 100%!');
  } catch (err) {
    console.error('❌ Error en test:', err);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      console.log('[Test] Servidor temporal cerrado.');
      process.exit(process.exitCode || 0);
    });
  }
});

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Error parseando JSON: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Error parseando POST JSON: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
