// SENTINEL - Suite de Pruebas Unitarias: domUtils.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../src/public/js/domUtils.js');

test('DOM Utils - escapeHtml sanitiza caracteres peligrosos de inyección XSS', () => {
  const dirty = '<script>alert("XSS & pwned")</script>\'test\'';
  const clean = escapeHtml(dirty);

  assert.strictEqual(clean.includes('<script>'), false);
  assert.strictEqual(clean.includes('&lt;script&gt;'), true);
  assert.strictEqual(clean.includes('&amp;'), true);
  assert.strictEqual(clean.includes('&quot;'), true);
  assert.strictEqual(clean.includes('&#39;'), true);
});

test('DOM Utils - escapeHtml maneja valores nulos, undefined y números', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(12345), '12345');
  assert.strictEqual(escapeHtml(0), '0');
});

test('DOM Utils - escapeHtml preserva texto legítimo sin alterar', () => {
  const safeText = 'SENTINEL Privacy Guardian v1.4.0';
  assert.strictEqual(escapeHtml(safeText), safeText);
});
