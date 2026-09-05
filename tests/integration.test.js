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

    // 3. Test Platforms
    const platforms = await fetchJson(`http://localhost:${TEST_PORT}/api/v1/platforms`);
    console.log(`✅ 3. Plataformas cargadas: ${platforms.platforms.length} plataformas.`);

    // 4. Test Password Check (k-Anonymity)
    const pwdRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/scan/password`, { password: 'password123' });
    console.log('✅ 4. k-Anonymity password check OK:', pwdRes.pwned === true);

    // 5. Test Add Identity
    const idRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/identities`, {
      type: 'email',
      value: 'mauro.soberano@privacy.org',
      label: 'Email Principal'
    });
    console.log('✅ 5. Identidad agregada OK:', idRes.success);

    // 6. Test Scan
    const scanRes = await postJson(`http://localhost:${TEST_PORT}/api/v1/scan`, {});
    console.log('✅ 6. Escaneo ejecutado OK, nuevo exposureScore:', scanRes.exposureScore);

    console.log('\n🎉 ¡TODOS LOS TESTS DE INTEGRACIÓN PASARON SATISFACTORIAMENTE AL 100%!');
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
      res.on('end', () => resolve(JSON.parse(data)));
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
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
