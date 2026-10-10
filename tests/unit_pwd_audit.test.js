// SENTINEL - Suite de Pruebas Unitarias: pwdAuditor.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseKAnonymityFeedback } = require('../src/public/js/pwdAuditor.js');

test('Password Auditor - parseKAnonymityFeedback formatea feedback para claves comprometidas', () => {
  const result = parseKAnonymityFeedback(true, 154200, 'Cambiar clave urgente');
  assert.strictEqual(result.cssClass, 'pwd-feedback-banner pwned');
  assert.match(result.title, /Comprometida/);
  assert.strictEqual(result.advice, 'Cambiar clave urgente');
  assert.match(result.details, /154\.200|154,200/);
});

test('Password Auditor - parseKAnonymityFeedback formatea feedback para claves no filtradas', () => {
  const result = parseKAnonymityFeedback(false, 0, null);
  assert.strictEqual(result.cssClass, 'pwd-feedback-banner safe');
  assert.match(result.title, /Segura/);
  assert.match(result.details, /HaveIBeenPwned con k-Anonymity/);
});
