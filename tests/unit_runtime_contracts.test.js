// SENTINEL - Suite de Pruebas Unitarias: runtimeContracts.js (Zero-Trust Runtime I/O)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContract,
  validateIdentityContract,
  validateGdprRequestContract,
  validatePasswordAuditContract,
  validateExposureMetricsContract,
  sanitizeString,
  clampNumber
} = require('../js/runtimeContracts.js');

test('Runtime Contracts - sanitizeString limpia y trunca texto defensivamente', () => {
  assert.strictEqual(sanitizeString('  hola mundo  '), 'hola mundo');
  assert.strictEqual(sanitizeString(null, 'default'), 'default');
  assert.strictEqual(sanitizeString(undefined, 'default'), 'default');
  assert.strictEqual(sanitizeString('1234567890', '', 5), '12345');
});

test('Runtime Contracts - clampNumber restringe valores al rango min/max', () => {
  assert.strictEqual(clampNumber(150, 0, 0, 100), 100);
  assert.strictEqual(clampNumber(-20, 0, 0, 100), 0);
  assert.strictEqual(clampNumber(45.7, 0, 0, 100), 46);
  assert.strictEqual(clampNumber('invalido', 15, 0, 100), 15);
});

test('Runtime Contracts - validateIdentityContract valida y rechaza identidades defectuosas', () => {
  const validEmail = validateIdentityContract({ type: 'email', value: 'guardian@sentinel.dev' });
  assert.strictEqual(validEmail.valid, true);
  assert.strictEqual(validEmail.data.type, 'email');
  assert.strictEqual(validEmail.data.value, 'guardian@sentinel.dev');

  const invalidEmail = validateIdentityContract({ type: 'email', value: 'no-es-correo' });
  assert.strictEqual(invalidEmail.valid, false);
  assert.strictEqual(invalidEmail.errors.length > 0, true);

  const invalidType = validateIdentityContract({ type: 'tipo_falso', value: 'test' });
  assert.strictEqual(invalidType.valid, false);
});

test('Runtime Contracts - validateGdprRequestContract valida esquemas de eliminación formal', () => {
  const validReq = validateGdprRequestContract({
    platformId: 12,
    platformName: 'Google',
    status: 'sent',
    notes: 'Borrado total'
  });
  assert.strictEqual(validReq.valid, true);
  assert.strictEqual(validReq.data.platformId, 12);
  assert.strictEqual(validReq.data.platformName, 'Google');

  const invalidReq = validateGdprRequestContract({ platformId: -5 });
  assert.strictEqual(invalidReq.valid, false);
});

test('Runtime Contracts - validatePasswordAuditContract valida cadenas de contraseñas para k-Anonymity', () => {
  const validPass = validatePasswordAuditContract('claveUltraSecreta2026!');
  assert.strictEqual(validPass.valid, true);
  assert.strictEqual(validPass.data, 'claveUltraSecreta2026!');

  const emptyPass = validatePasswordAuditContract('');
  assert.strictEqual(emptyPass.valid, false);

  const nonString = validatePasswordAuditContract(123456);
  assert.strictEqual(nonString.valid, false);
});

test('Runtime Contracts - validateExposureMetricsContract normaliza y clasifica semáforo de riesgo', () => {
  const critical = validateExposureMetricsContract({ score: 85, activeBreaches: 4 });
  assert.strictEqual(critical.valid, true);
  assert.strictEqual(critical.data.riskLevel, 'Crítico');
  assert.strictEqual(critical.data.riskColor, '#EF4444');

  const safe = validateExposureMetricsContract({ score: 10, activeBreaches: 0 });
  assert.strictEqual(safe.valid, true);
  assert.strictEqual(safe.data.riskLevel, 'Bajo');
  assert.strictEqual(safe.data.riskColor, '#10B981');
});
