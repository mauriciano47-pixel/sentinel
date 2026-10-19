// SENTINEL - Identities Manager
// Gestión y rastreo de identidades protegidas (Email, Teléfono, Username)

function validateIdentityInput(type, value) {
  if (!value || typeof value !== 'string') return { valid: false, error: 'Valor vacío' };
  const val = value.trim();
  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { valid: emailRegex.test(val), value: val.toLowerCase(), error: 'Formato de correo electrónico inválido' };
  } else if (type === 'phone') {
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    return { valid: phoneRegex.test(cleaned), value: cleaned, error: 'Formato de teléfono internacional inválido (ej: +56912345678)' };
  } else if (type === 'username') {
    const cleanUser = val.replace(/^@/, '');
    return { valid: cleanUser.length >= 2, value: cleanUser, error: 'Nombre de usuario debe tener al menos 2 caracteres' };
  }
  return { valid: true, value: val };
}

function updateIdentityModalInputs() {
  const idTypeSelect = document.getElementById('new-id-type');
  const idValueInput = document.getElementById('new-id-value');
  const idValueLabel = document.getElementById('label-new-id-value');
  const idHelpText = document.getElementById('help-new-id-value');

  if (!idTypeSelect || !idValueInput) return;
  const selectedType = idTypeSelect.value;
  if (selectedType === 'phone') {
    if (idValueLabel) idValueLabel.textContent = 'Número Telefónico (con código de país)';
    idValueInput.type = 'tel';
    idValueInput.placeholder = '+56 9 1234 5678 o +34 612 345 678';
    if (idHelpText) idHelpText.textContent = '// RASTREO DE FILTRACIONES TELEFÓNICAS (WHATSAPP, FACEBOOK LEAKS) //';
  } else if (selectedType === 'username') {
    if (idValueLabel) idValueLabel.textContent = 'Nombre de Usuario o Alias';
    idValueInput.type = 'text';
    idValueInput.placeholder = '@usuario o tu_alias';
    if (idHelpText) idHelpText.textContent = '// RASTREO EN FOROS, BASES DE GAMING Y COMUNIDADES //';
  } else {
    if (idValueLabel) idValueLabel.textContent = 'Correo Electrónico a Monitorear';
    idValueInput.type = 'email';
    idValueInput.placeholder = 'ejemplo@correo.com';
    if (idHelpText) idHelpText.textContent = '// RASTREO EN BRECHAS MASIVAS HIBP Y COMBOS GLOBALES //';
  }
}

async function loadIdentities() {
  const elIdentities = document.getElementById('identities-list');
  if (!elIdentities) return;

  try {
    const res = await fetchAuth('/identities');
    if (!res.ok) return;
    const data = await res.json();

    if (!data.identities || data.identities.length === 0) {
      setSafeHtml(elIdentities, `
        <div class="skeleton-loader">
          No tienes identidades registradas. Haz clic en <strong>+ Agregar Identidad</strong> para comenzar a monitorear tus correos y teléfonos.
        </div>
      `);
      return;
    }

    setSafeHtml(elIdentities, data.identities.map(id => `
      <div class="identity-row">
        <div class="identity-info">
          <span class="type-tag">${escapeHtml(id.type)}</span>
          <div>
            <div class="identity-val">${escapeHtml(id.value)}</div>
            <div class="identity-label">${escapeHtml(id.label || 'Identidad Principal')}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${id.breach_count > 0
            ? `<button class="badge-tag btn-breach-jump" onclick="scrollToBreaches()" style="cursor: pointer; color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.12);" title="Ver detalle forense y plan de remediación táctico">${id.breach_count} brechas detectadas ↓</button>`
            : `<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">Protegido</span>`}
          <button class="btn-icon" onclick="deleteIdentity('${id.id}')" title="Eliminar" aria-label="Eliminar identidad">&times;</button>
        </div>
      </div>
    `).join(''));
  } catch (err) {
    setSafeHtml(elIdentities, '<div class="skeleton-loader">Error al conectar con la API de identidades.</div>');
  }
}

async function saveNewIdentity() {
  const typeSelect = document.getElementById('new-id-type');
  const valueInput = document.getElementById('new-id-value');
  const labelInput = document.getElementById('new-id-label');
  const idModal = document.getElementById('identity-modal');

  const type = typeSelect ? typeSelect.value : 'email';
  const rawValue = valueInput ? valueInput.value.trim() : '';
  const label = labelInput ? labelInput.value.trim() : '';

  const validation = validateIdentityInput(type, rawValue);
  if (!validation.valid) {
    alert(validation.error || 'Por favor ingresa un identificador válido.');
    if (valueInput) valueInput.focus();
    return;
  }

  try {
    const res = await fetchAuth('/identities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value: validation.value, label })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error registrando identidad');
      return;
    }

    if (idModal) idModal.classList.add('hidden');
    if (valueInput) valueInput.value = '';
    if (labelInput) labelInput.value = '';

    await loadIdentities();
    if (typeof loadExposureScore === 'function') await loadExposureScore();
  } catch (err) {
    alert('Error de conexión al guardar identidad.');
  }
}

async function deleteIdentity(id) {
  if (!confirm('¿Deseas desvincular esta identidad del monitoreo?')) return;
  try {
    await fetchAuth(`/identities/${id}`, { method: 'DELETE' });
    await loadIdentities();
    if (typeof loadExposureScore === 'function') await loadExposureScore();
    if (typeof loadBreaches === 'function') await loadBreaches();
  } catch (err) {
    alert('Error al eliminar identidad.');
  }
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.validateIdentityInput = validateIdentityInput;
  window.updateIdentityModalInputs = updateIdentityModalInputs;
  window.loadIdentities = loadIdentities;
  window.saveNewIdentity = saveNewIdentity;
  window.deleteIdentity = deleteIdentity;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateIdentityInput,
    updateIdentityModalInputs,
    loadIdentities,
    saveNewIdentity,
    deleteIdentity
  };
}
