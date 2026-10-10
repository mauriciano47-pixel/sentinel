// SENTINEL - Suite de Pruebas Unitarias: gdprEngine.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateGdprNotice, calculateUrgency } = require('../src/public/js/gdprEngine.js');

test('GDPR Engine - generateGdprNotice redacta notificación formal conforme al Art. 17 RGPD', () => {
  const notice = generateGdprNotice('DataBroker Inc', 'Mauricio Uribe', 'mauricio@seguridad.cl');

  assert.match(notice, /Delegado de Protección de Datos \(DPO\) \/ Responsable de Seguridad de DataBroker Inc/);
  assert.match(notice, /yo, Mauricio Uribe/);
  assert.match(notice, /mauricio@seguridad\.cl/);
  assert.match(notice, /Artículo 17 \("Derecho de Supresión" o "Derecho al Olvido"\)/);
  assert.match(notice, /plazo legal máximo de 30 días/);
  assert.match(notice, /Autoridad de Control de Protección de Datos/);
});

test('GDPR Engine - generateGdprNotice utiliza placeholders defensivos ante entradas vacías', () => {
  const fallbackNotice = generateGdprNotice('', '', '');

  assert.match(fallbackNotice, /Responsable de Seguridad de Plataforma/);
  assert.match(fallbackNotice, /\[Tu Nombre y Apellidos\]/);
  assert.match(fallbackNotice, /\[Tu Correo Electrónico\]/);
});

test('GDPR Engine - calculateUrgency clasifica correctamente los niveles de plazo legal de 30 días', () => {
  assert.strictEqual(calculateUrgency(15, 'completed'), 'completed');
  assert.strictEqual(calculateUrgency(-2, 'sent'), 'overdue');
  assert.strictEqual(calculateUrgency(0, 'sent'), 'urgent');
  assert.strictEqual(calculateUrgency(3, 'sent'), 'urgent');
  assert.strictEqual(calculateUrgency(8, 'sent'), 'warning');
  assert.strictEqual(calculateUrgency(10, 'sent'), 'warning');
  assert.strictEqual(calculateUrgency(25, 'sent'), 'normal');
});
