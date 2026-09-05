// SENTINEL Dashboard Controller (Vanilla JS, Zero Bloat)
const API_BASE = '/api/v1';
let currentSelectedPlatform = null;

// Elementos del DOM
const elScore = document.getElementById('score-number');
const elRiskBadge = document.getElementById('risk-badge');
const elRiskSummary = document.getElementById('risk-summary');
const elIdentities = document.getElementById('identities-list');
const elPlatforms = document.getElementById('platforms-grid');
const elRequests = document.getElementById('requests-list');
const elScanStatus = document.getElementById('scan-status');

// Métricas rápidas
const elMetricIdentities = document.getElementById('metric-identities');
const elMetricBreaches = document.getElementById('metric-breaches');
const elMetricDeletions = document.getElementById('metric-deletions');

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  loadUserProfile();
  loadExposureScore();
  loadIdentities();
  loadPlatforms();
  loadRequests();
  setupEventListeners();
});

function setupEventListeners() {
  // Escaneo Global
  document.getElementById('btn-run-scan').addEventListener('click', runGlobalScan);

  // Auditor de contraseñas k-Anonymity
  document.getElementById('btn-check-pwd').addEventListener('click', auditPassword);
  document.getElementById('input-pwd').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') auditPassword();
  });

  // Modal Identidad
  const idModal = document.getElementById('identity-modal');
  document.getElementById('btn-open-identity-modal').addEventListener('click', () => {
    idModal.classList.remove('hidden');
    document.getElementById('new-id-value').focus();
  });
  document.getElementById('btn-close-modal').addEventListener('click', () => idModal.classList.add('hidden'));
  document.getElementById('btn-cancel-id').addEventListener('click', () => idModal.classList.add('hidden'));
  document.getElementById('btn-save-id').addEventListener('click', saveNewIdentity);

  // Modal GDPR
  const gdprModal = document.getElementById('gdpr-modal');
  document.getElementById('btn-close-gdpr-modal').addEventListener('click', () => gdprModal.classList.add('hidden'));
  document.getElementById('btn-close-gdpr').addEventListener('click', () => gdprModal.classList.add('hidden'));
  document.getElementById('btn-mark-sent').addEventListener('click', markGdprRequestSent);

  // Filtro de plataformas
  document.getElementById('filter-category').addEventListener('change', (e) => {
    loadPlatforms(e.target.value);
  });
}

// 1. Cargar Perfil
async function loadUserProfile() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`);
    const data = await res.json();
    if (data.user) {
      document.getElementById('user-badge').textContent = data.user.display_name || data.user.email;
    }
  } catch (err) {
    console.warn('Modo soberano sin sesión remota');
  }
}

// 2. Cargar Índice de Exposición
async function loadExposureScore() {
  try {
    const res = await fetch(`${API_BASE}/scan/exposure`);
    const data = await res.json();

    elScore.textContent = data.score;
    elRiskBadge.textContent = `Nivel de Riesgo: ${data.riskLevel}`;
    elRiskBadge.style.color = data.riskColor;
    
    // Gauge ring border color
    document.querySelector('.gauge-ring').style.borderColor = data.riskColor;
    document.querySelector('.gauge-ring').style.boxShadow = `0 0 20px ${data.riskColor}40`;

    if (data.recommendations && data.recommendations.length > 0) {
      elRiskSummary.textContent = data.recommendations[0];
    }

    if (data.metrics) {
      elMetricIdentities.textContent = data.metrics.monitoredIdentities;
      elMetricBreaches.textContent = data.metrics.totalBreaches;
      elMetricDeletions.textContent = data.metrics.completedDeletions;
    }
  } catch (err) {
    console.error('Error cargando exposure score:', err);
  }
}

// 3. Cargar Identidades
async function loadIdentities() {
  try {
    const res = await fetch(`${API_BASE}/identities`);
    const data = await res.json();

    if (!data.identities || data.identities.length === 0) {
      elIdentities.innerHTML = `
        <div class="skeleton-loader">
          No tienes identidades registradas. Haz clic en <strong>+ Agregar Identidad</strong> para comenzar a monitorear tus correos y teléfonos.
        </div>
      `;
      return;
    }

    elIdentities.innerHTML = data.identities.map(id => `
      <div class="identity-row">
        <div class="identity-info">
          <span class="type-tag">${id.type}</span>
          <div>
            <div class="identity-val">${escapeHtml(id.value)}</div>
            <div class="identity-label">${escapeHtml(id.label || 'Identidad Principal')}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${id.breach_count > 0 
            ? `<span class="badge-tag" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">${id.breach_count} brechas detectadas</span>` 
            : `<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">Protegido</span>`}
          <button class="btn-icon" onclick="deleteIdentity('${id.id}')" title="Eliminar">&times;</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    elIdentities.innerHTML = '<div class="skeleton-loader">Error al conectar con la API de identidades.</div>';
  }
}

// 4. Guardar Identidad
async function saveNewIdentity() {
  const type = document.getElementById('new-id-type').value;
  const value = document.getElementById('new-id-value').value.trim();
  const label = document.getElementById('new-id-label').value.trim();

  if (!value) {
    alert('Por favor ingrese un correo o teléfono.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, label })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error registrando identidad');
      return;
    }

    document.getElementById('identity-modal').classList.add('hidden');
    document.getElementById('new-id-value').value = '';
    document.getElementById('new-id-label').value = '';

    loadIdentities();
    loadExposureScore();
  } catch (err) {
    alert('Error de conexión al guardar identidad.');
  }
}

// 5. Borrar Identidad
window.deleteIdentity = async function(id) {
  if (!confirm('¿Deseas desvincular esta identidad del monitoreo?')) return;
  try {
    await fetch(`${API_BASE}/identities/${id}`, { method: 'DELETE' });
    loadIdentities();
    loadExposureScore();
  } catch (err) {
    alert('Error al eliminar identidad.');
  }
};

// 6. Ejecutar Escaneo
async function runGlobalScan() {
  const btn = document.getElementById('btn-run-scan');
  btn.disabled = true;
  elScanStatus.textContent = 'Auditoría en curso contra catálogos HIBP...';

  try {
    const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      elScanStatus.textContent = data.error || 'Error al ejecutar escaneo';
      return;
    }

    elScanStatus.textContent = `Escaneo finalizado: ${data.totalNewBreaches} filtraciones añadidas.`;
    loadExposureScore();
    loadIdentities();
  } catch (err) {
    elScanStatus.textContent = 'Fallo de red en escaneo.';
  } finally {
    btn.disabled = false;
  }
}

// 7. Cargar Catálogo de Plataformas
async function loadPlatforms(category = '') {
  try {
    const url = category ? `${API_BASE}/platforms?category=${category}` : `${API_BASE}/platforms`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.platforms || data.platforms.length === 0) {
      elPlatforms.innerHTML = '<div class="skeleton-loader">No hay plataformas en esta categoría.</div>';
      return;
    }

    elPlatforms.innerHTML = data.platforms.map(p => {
      const isCompleted = p.userStatus === 'completed';
      const isSent = p.userStatus === 'sent';

      let statusBadge = '';
      if (isCompleted) {
        statusBadge = '<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">✓ Eliminada</span>';
      } else if (isSent) {
        statusBadge = '<span class="badge-tag" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);">Enviada</span>';
      }

      return `
        <div class="platform-card">
          <div>
            <div class="platform-top">
              <div>
                <h4 class="platform-name">${escapeHtml(p.name)}</h4>
                <span class="platform-cat">${escapeHtml(p.category)}</span>
              </div>
              ${statusBadge}
            </div>
            <div class="diff-pills" title="Dificultad de borrado: ${p.difficulty}/5">
              ${[1,2,3,4,5].map(d => `<div class="diff-dot ${d <= p.difficulty ? 'active' : ''}"></div>`).join('')}
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="openGdprModal(${p.id})">
              ${isCompleted ? 'Ver Detalles' : 'Iniciar Borrado'}
            </button>
            ${p.deletion_url ? `<a href="${p.deletion_url}" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" title="Abrir URL oficial de borrado">🔗</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    elPlatforms.innerHTML = '<div class="skeleton-loader">Error al cargar plataformas.</div>';
  }
}

// 8. Abrir Modal GDPR
window.openGdprModal = async function(platformId) {
  try {
    const res = await fetch(`${API_BASE}/platforms/${platformId}`);
    const data = await res.json();
    currentSelectedPlatform = data.platform;

    document.getElementById('gdpr-modal-title').textContent = `Solicitud de Supresión RGPD — ${data.platform.name}`;
    document.getElementById('gdpr-instructions').textContent = data.platform.instructions || 'Sigue los pasos y envía la solicitud formal a la plataforma.';
    document.getElementById('gdpr-template-text').value = data.customizedGdprTemplate || '';

    const linksBox = document.getElementById('gdpr-action-links');
    linksBox.innerHTML = '';

    if (data.platform.deletion_url) {
      linksBox.innerHTML += `<a href="${data.platform.deletion_url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">Abrir Portal de Eliminación Oficial</a> `;
    }

    if (data.platform.deletion_email) {
      const subject = encodeURIComponent(`Solicitud de Supresión de Datos Personales (Art. 17 RGPD)`);
      const body = encodeURIComponent(data.customizedGdprTemplate);
      linksBox.innerHTML += `<a href="mailto:${data.platform.deletion_email}?subject=${subject}&body=${body}" class="btn btn-sm btn-secondary">Redactar Correo Legal al DPO</a>`;
    }

    document.getElementById('gdpr-modal').classList.remove('hidden');
  } catch (err) {
    alert('Error obteniendo datos de la plataforma');
  }
};

// 9. Marcar Solicitud como Enviada
async function markGdprRequestSent() {
  if (!currentSelectedPlatform) return;

  try {
    await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformId: currentSelectedPlatform.id,
        status: 'sent',
        notes: 'Solicitud formal de derecho al olvido enviada por el usuario.'
      })
    });

    document.getElementById('gdpr-modal').classList.add('hidden');
    loadPlatforms();
    loadRequests();
    loadExposureScore();
  } catch (err) {
    alert('Error al registrar solicitud');
  }
}

// 10. Cargar Trazabilidad de Solicitudes
async function loadRequests() {
  try {
    const res = await fetch(`${API_BASE}/requests`);
    const data = await res.json();

    if (!data.requests || data.requests.length === 0) {
      elRequests.innerHTML = '<div class="skeleton-loader">No hay solicitudes de borrado activas aún.</div>';
      return;
    }

    elRequests.innerHTML = data.requests.map(r => `
      <div class="identity-row">
        <div>
          <strong>${escapeHtml(r.platform_name)}</strong>
          <span class="type-tag" style="margin-left: 8px;">${r.status}</span>
          <div class="identity-label">Enviada: ${new Date(r.sent_at || r.created_at).toLocaleDateString()}</div>
        </div>
        <div>
          ${r.status !== 'completed' 
            ? `<button class="btn btn-sm btn-outline" onclick="completeRequest('${r.id}')">Marcar Confirmada</button>`
            : '<span style="color: #10b981; font-weight: 700; font-size: 0.85rem;">✓ Datos Purgados</span>'}
        </div>
      </div>
    `).join('');
  } catch (err) {
    elRequests.innerHTML = '<div class="skeleton-loader">Error cargando solicitudes.</div>';
  }
}

// 11. Marcar como completada
window.completeRequest = async function(requestId) {
  try {
    await fetch(`${API_BASE}/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    loadRequests();
    loadPlatforms();
    loadExposureScore();
  } catch (err) {
    alert('Error al actualizar estado.');
  }
};

// 12. Auditor de Contraseña k-Anonymity
async function auditPassword() {
  const pwdInput = document.getElementById('input-pwd');
  const pwdFeedback = document.getElementById('pwd-result');
  const val = pwdInput.value;

  if (!val) {
    pwdFeedback.textContent = 'Ingresa una contraseña para probar.';
    pwdFeedback.style.color = '#f59e0b';
    return;
  }

  pwdFeedback.textContent = 'Consultando prefijo hash SHA-1 de 5 caracteres...';
  pwdFeedback.style.color = '#94a3b8';

  try {
    const res = await fetch(`${API_BASE}/scan/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: val })
    });

    const data = await res.json();
    pwdFeedback.textContent = data.advice;
    pwdFeedback.style.color = data.pwned ? '#ef4444' : '#10b981';
  } catch (err) {
    pwdFeedback.textContent = 'Error al verificar contraseña';
    pwdFeedback.style.color = '#ef4444';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
