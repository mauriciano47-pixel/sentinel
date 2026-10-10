// SENTINEL - Suite de Pruebas Unitarias: identitiesManager.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateIdentityInput } = require('../src/public/js/identitiesManager.js');

test('Identities - validateIdentityInput valida y normaliza correos electrónicos', () => {
  const valid = validateIdentityInput('email', '  Usuario.Seguro@SENTINEL.dev  ');
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.value, 'usuario.seguro@sentinel.dev');

  const invalid = validateIdentityInput('email', 'correo_sin_arroba');
  assert.strictEqual(invalid.valid, false);
  assert.match(invalid.error, /inválido/);
});

test('Identities - validateIdentityInput valida y normaliza números telefónicos internacionales', () => {
  const validChile = validateIdentityInput('phone', '+56 9 5656 6699');
  assert.strictEqual(validChile.valid, true);
  assert.strictEqual(validChile.value, '+56956566699');

  const validSpain = validateIdentityInput('phone', '+34-612-345-678');
  assert.strictEqual(validSpain.valid, true);
  assert.strictEqual(validSpain.value, '+34612345678');

  const invalidPhone = validateIdentityInput('phone', '123');
  assert.strictEqual(invalidPhone.valid, false);
});

test('Identities - validateIdentityInput limpia alias y usernames con @ prefijo', () => {
  const user = validateIdentityInput('username', '@ciber_guardian');
  assert.strictEqual(user.valid, true);
  assert.strictEqual(user.value, 'ciber_guardian');

  const shortUser = validateIdentityInput('username', 'a');
  assert.strictEqual(shortUser.valid, false);
});
