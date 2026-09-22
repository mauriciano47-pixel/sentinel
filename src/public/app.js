// SENTINEL Dashboard Controller (Vanilla JS, Zero Bloat)
const API_BASE = '/api/v1';
let currentSelectedPlatform = null;

// Elementos del DOM del Dashboard
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

// Elementos de Usuario y Header
const elUserBadge = document.getElementById('user-badge');
const elUserPlanBadge = document.getElementById('user-plan-badge');
const btnLogout = document.getElementById('btn-logout');

// Elementos del Modal de Onboarding / Auth
const onboardingModal = document.getElementById('onboarding-modal');
const tabBtnRegister = document.getElementById('tab-btn-register');
const tabBtnLogin = document.getElementById('tab-btn-login');
const formRegister = document.getElementById('form-register');
const formLogin = document.getElementById('form-login');
const authFeedback = document.getElementById('auth-feedback');
const btnMasterAccess = document.getElementById('btn-master-access');

// ==========================================
// 1. GESTIÓN DE SESIÓN LOCAL SOBERANA
// ==========================================

function getSession() {
  try {
    const raw = localStorage.getItem('sentinel_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveSession(user, token) {
  const session = { user, token: token || user.id };
  localStorage.setItem('sentinel_session', JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem('sentinel_session');
  showOnboardingModal();
  renderLoggedOutState();
}

function showOnboardingModal() {
  if (onboardingModal) {
    onboardingModal.classList.remove('hidden');
    clearAuthFeedback();
  }
}

function hideOnboardingModal() {
  if (onboardingModal) {
    onboardingModal.classList.add('hidden');
    clearAuthFeedback();
  }
}

function showAuthFeedback(msg, type = 'error') {
  if (!authFeedback) return;
  authFeedback.textContent = msg;
  authFeedback.className = `auth-feedback-box ${type}`;
  authFeedback.classList.remove('hidden');
}

function clearAuthFeedback() {
  if (!authFeedback) return;
  authFeedback.textContent = '';
  authFeedback.className = 'auth-feedback-box hidden';
}

// Wrapper centralizado de Fetch con Autenticación Inyectada
async function fetchAuth(endpoint, options = {}) {
  const session = getSession();
  const headers = Object.assign({}, options.headers || {});

  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-user-id'] = session.user.id;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, Object.assign({}, options, { headers }));

  if (response.status === 401) {
    console.warn('[Sentinel] Sesión no autorizada o expirada');
    clearSession();
  }

  return response;
}

// ==========================================
// 2. INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthAndBootstrap();
});

async function checkAuthAndBootstrap() {
  const session = getSession();

  if (!session) {
    // Primera visita de un usuario: mostrar pantalla de bienvenida y registro
    showOnboardingModal();
    renderLoggedOutState();
    return;
  }

  // Si existe sesión previa en localStorage, verificar validez con el backend
  try {
    const res = await fetchAuth('/auth/me');
    if (!res.ok) {
      clearSession();
      return;
    }

    const data = await res.json();
    if (data.user) {
      saveSession(data.user, session.token);
      updateUserHeader(data.user);
      hideOnboardingModal();
      loadDashboardData();
    } else {
      clearSession();
    }
  } catch (err) {
    console.error('Error comprobando sesión:', err);
    // Modo offline resiliente: si hay sesión local, cargar UI
    updateUserHeader(session.user);
    hideOnboardingModal();
    loadDashboardData();
  }
}

function loadDashboardData() {
  loadExposureScore();
  loadIdentities();
  loadPlatforms();
  loadRequests();
}

function renderLoggedOutState() {
  elUserBadge.textContent = 'Sin registrar';
  elUserPlanBadge.textContent = 'INVITADO';
  elUserPlanBadge.className = 'plan-pill plan-free';

  elScore.textContent = '--';
  elRiskBadge.textContent = 'Esperando Registro';
  elRiskBadge.style.color = '#94a3b8';
  elRiskSummary.textContent = 'Regístrate o inicia sesión para activar el motor de privacidad.';

  elIdentities.innerHTML = '<div class="skeleton-loader">Debes registrarte para monitorear tus identidades.</div>';
  elRequests.innerHTML = '<div class="skeleton-loader">Sin solicitudes registradas.</div>';
}

function updateUserHeader(user) {
  if (!user) return;
  elUserBadge.textContent = user.display_name || user.email;

  const plan = (user.plan || 'free').toLowerCase();
  elUserPlanBadge.textContent = plan.toUpperCase();
  elUserPlanBadge.className = `plan-pill plan-${plan}`;
}

function setupEventListeners() {
  // --- Modales de Auth y Onboarding ---
  if (tabBtnRegister && tabBtnLogin) {
    tabBtnRegister.addEventListener('click', () => {
      tabBtnRegister.classList.add('active');
      tabBtnRegister.setAttribute('aria-selected', 'true');
      tabBtnLogin.classList.remove('active');
      tabBtnLogin.setAttribute('aria-selected', 'false');
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
      clearAuthFeedback();
    });

    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.classList.add('active');
      tabBtnLogin.setAttribute('aria-selected', 'true');
      tabBtnRegister.classList.remove('active');
      tabBtnRegister.setAttribute('aria-selected', 'false');
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
      clearAuthFeedback();
    });
  }

  // Selección de tarjetas de planes en el registro
  const planCards = document.querySelectorAll('.plan-card');
  planCards.forEach(card => {
    card.addEventListener('click', () => {
      planCards.forEach(c => c.classList.remove('active-plan'));
      card.classList.add('active-plan');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Envío Formulario Registro
  if (formRegister) {
    formRegister.addEventListener('submit', handleRegisterSubmit);
  }

  // Envío Formulario Login
  if (formLogin) {
    formLogin.addEventListener('submit', handleLoginSubmit);
  }

  // Botón Acceso Arconte Soberano (Mauro)
  if (btnMasterAccess) {
    btnMasterAccess.addEventListener('click', handleMasterAccess);
  }

  // Botón Cambiar Cuenta / Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      clearSession();
    });
  }

  // --- Funcionalidades del Dashboard ---

  // Escaneo Global HIBP
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

  // Exportar Reporte PDF
  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', handleExportPdf);
  }

  // Filtro de plataformas y buscador en tiempo real
  const filterCat = document.getElementById('filter-category');
  const filterSearch = document.getElementById('filter-search');

  function triggerFilter() {
    loadPlatforms(filterCat ? filterCat.value : '', filterSearch ? filterSearch.value.trim() : '');
  }

  if (filterCat) filterCat.addEventListener('change', triggerFilter);
  if (filterSearch) {
    let debounceTimer = null;
    filterSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(triggerFilter, 250);
    });
  }
}

// ==========================================
// 3. CONTROLADORES DE AUTH (REGISTRO & LOGIN)
// ==========================================

async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthFeedback();

  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const autoMonitorInput = document.getElementById('reg-auto-monitor');
  const selectedPlanRadio = document.querySelector('input[name="reg-plan"]:checked');

  const displayName = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const plan = selectedPlanRadio ? selectedPlanRadio.value : 'guard';

  if (!email || !email.includes('@') || !email.includes('.')) {
    showAuthFeedback('Por favor introduce un correo electrónico válido.', 'error');
    emailInput.focus();
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-register');
  btnSubmit.disabled = true;
  btnSubmit.textContent = '🛡️ Configurando Bóveda...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, plan })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.user) {
        // Usuario ya existe: iniciar sesión directamente con su token
        saveSession(data.user, data.token);
        updateUserHeader(data.user);
        hideOnboardingModal();
        loadDashboardData();
        return;
      }
      showAuthFeedback(data.error || 'Error al procesar el registro.', 'error');
      return;
    }

    // Registro exitoso
    saveSession(data.user, data.token);
    updateUserHeader(data.user);

    // Si marcó la opción de auto-monitorear su correo inicial
    if (autoMonitorInput && autoMonitorInput.checked) {
      try {
        await fetchAuth('/identities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'email',
            value: email,
            label: 'Identidad Principal'
          })
        });
      } catch (idErr) {
        console.warn('No se pudo vincular automáticamente la identidad inicial:', idErr);
      }
    }

    hideOnboardingModal();
    loadDashboardData();
  } catch (err) {
    showAuthFeedback('Error de conexión con el servidor de Sentinel.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = '🛡️ Activar Bóveda & Comenzar';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthFeedback();

  const emailInput = document.getElementById('login-email');
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    showAuthFeedback('Por favor introduce tu correo electrónico.', 'error');
    emailInput.focus();
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-login');
  btnSubmit.disabled = true;
  btnSubmit.textContent = '🔐 Autenticando...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthFeedback(data.error || 'No se pudo iniciar sesión.', 'error');
      return;
    }

    saveSession(data.user, data.token);
    updateUserHeader(data.user);
    hideOnboardingModal();
    loadDashboardData();
  } catch (err) {
    showAuthFeedback('Error de comunicación con el servidor.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = '🔐 Acceder a mi Bóveda';
  }
}

async function handleMasterAccess() {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'guardian@sentinel.privacy' })
    });

    if (res.ok) {
      const data = await res.json();
      saveSession(data.user, data.token);
      updateUserHeader(data.user);
    } else {
      // Fallback local soberano
      const masterUser = {
        id: 'user_local_soberano',
        email: 'guardian@sentinel.privacy',
        display_name: 'Mauro (Arconte Soberano)',
        plan: 'sentinel'
      };
      saveSession(masterUser, 'user_local_soberano');
      updateUserHeader(masterUser);
    }

    hideOnboardingModal();
    loadDashboardData();
  } catch (e) {
    const masterUser = {
      id: 'user_local_soberano',
      email: 'guardian@sentinel.privacy',
      display_name: 'Mauro (Arconte Soberano)',
      plan: 'sentinel'
    };
    saveSession(masterUser, 'user_local_soberano');
    updateUserHeader(masterUser);
    hideOnboardingModal();
    loadDashboardData();
  }
}

// ==========================================
// 4. CONTROLADORES DE DATOS Y DASHBOARD
// ==========================================

// Descarga de Reporte PDF Autenticado
function handleExportPdf() {
  const session = getSession();
  if (!session) {
    showOnboardingModal();
    return;
  }
  const token = encodeURIComponent(session.token);
  window.location.href = `${API_BASE}/reports/footprint-pdf?token=${token}`;
}

// Cargar Índice de Exposición
async function loadExposureScore() {
  try {
    const res = await fetchAuth('/scan/exposure');
    if (!res.ok) return;
    const data = await res.json();

    elScore.textContent = data.score;
    elRiskBadge.textContent = `Nivel de Riesgo: ${data.riskLevel}`;
    elRiskBadge.style.color = data.riskColor;

    // Gauge ring border color
    const gaugeRing = document.querySelector('.gauge-ring');
    if (gaugeRing) {
      gaugeRing.style.borderColor = data.riskColor;
      gaugeRing.style.boxShadow = `0 0 20px ${data.riskColor}40`;
    }

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

// Cargar Identidades
async function loadIdentities() {
  try {
    const res = await fetchAuth('/identities');
    if (!res.ok) return;
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
          <span class="type-tag">${escapeHtml(id.type)}</span>
          <div>
            <div class="identity-val">${escapeHtml(id.value)}</div>
            <div class="identity-label">${escapeHtml(id.label || 'Identidad Principal')}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${id.breach_count > 0
        ? `<span class="badge-tag" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">${id.breach_count} brechas detectadas</span>`
        : `<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">Protegido</span>`}
          <button class="btn-icon" onclick="deleteIdentity('${id.id}')" title="Eliminar" aria-label="Eliminar identidad">&times;</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    elIdentities.innerHTML = '<div class="skeleton-loader">Error al conectar con la API de identidades.</div>';
  }
}

// Guardar Identidad
async function saveNewIdentity() {
  const type = document.getElementById('new-id-type').value;
  const value = document.getElementById('new-id-value').value.trim();
  const label = document.getElementById('new-id-label').value.trim();

  if (!value) {
    alert('Por favor ingrese un correo o teléfono.');
    return;
  }

  try {
    const res = await fetchAuth('/identities', {
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

// Borrar Identidad
window.deleteIdentity = async function (id) {
  if (!confirm('¿Deseas desvincular esta identidad del monitoreo?')) return;
  try {
    await fetchAuth(`/identities/${id}`, { method: 'DELETE' });
    loadIdentities();
    loadExposureScore();
  } catch (err) {
    alert('Error al eliminar identidad.');
  }
};

// Ejecutar Escaneo Global HIBP
async function runGlobalScan() {
  const session = getSession();
  if (!session) {
    showOnboardingModal();
    return;
  }

  const btn = document.getElementById('btn-run-scan');
  btn.disabled = true;
  elScanStatus.textContent = 'Auditoría en curso contra catálogos HIBP...';

  try {
    const res = await fetchAuth('/scan', { method: 'POST' });
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

// Cargar Catálogo de Plataformas (50+ servicios con filtros)
async function loadPlatforms(category = '', search = '') {
  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const res = await fetchAuth(`/platforms?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.platforms || data.platforms.length === 0) {
      elPlatforms.innerHTML = '<div class="skeleton-loader">No se encontraron plataformas que coincidan con la búsqueda.</div>';
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
              ${[1, 2, 3, 4, 5].map(d => `<div class="diff-dot ${d <= p.difficulty ? 'active' : ''}"></div>`).join('')}
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="openGdprModal(${p.id})">
              ${isCompleted ? 'Ver Detalles' : 'Iniciar Borrado'}
            </button>
            ${p.deletion_url ? `<a href="${p.deletion_url}" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" title="Abrir URL oficial de borrado" aria-label="Abrir enlace oficial">🔗</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    elPlatforms.innerHTML = '<div class="skeleton-loader">Error al cargar plataformas.</div>';
  }
}

// Abrir Modal GDPR
window.openGdprModal = async function (platformId) {
  try {
    const res = await fetchAuth(`/platforms/${platformId}`);
    if (!res.ok) return;
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

// Marcar Solicitud como Enviada
async function markGdprRequestSent() {
  if (!currentSelectedPlatform) return;

  try {
    await fetchAuth('/requests', {
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

// Cargar Trazabilidad de Solicitudes con Plazo de 30 Días
async function loadRequests() {
  try {
    const res = await fetchAuth('/requests');
    if (!res.ok) return;
    const data = await res.json();

    if (!data.requests || data.requests.length === 0) {
      elRequests.innerHTML = '<div class="skeleton-loader">No hay solicitudes de borrado activas aún.</div>';
      return;
    }

    elRequests.innerHTML = data.requests.map(r => {
      let deadlineBadge = '';
      if (r.status === 'completed') {
        deadlineBadge = '<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">✓ Datos Purgados</span>';
      } else if (r.urgencyStatus === 'overdue') {
        deadlineBadge = `<span class="badge-tag" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.6); background: rgba(239, 68, 68, 0.15);">🚨 Vencido (${Math.abs(r.daysRemaining)}d de retraso - Art. 12 RGPD)</span>`;
      } else if (r.urgencyStatus === 'urgent') {
        deadlineBadge = `<span class="badge-tag" style="color: #f97316; border-color: rgba(249, 115, 22, 0.5);">⚠️ ${r.daysRemaining} días restantes</span>`;
      } else if (r.urgencyStatus === 'warning') {
        deadlineBadge = `<span class="badge-tag" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.5);">⏳ ${r.daysRemaining} días restantes</span>`;
      } else {
        deadlineBadge = `<span class="badge-tag" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);">⏳ ${r.daysRemaining} días restantes (Plazo 30d)</span>`;
      }

      return `
        <div class="identity-row">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <strong>${escapeHtml(r.platform_name)}</strong>
              <span class="type-tag">${escapeHtml(r.platform_category)}</span>
              ${deadlineBadge}
            </div>
            <div class="identity-label">
              Enviada: ${new Date(r.sent_at || r.created_at).toLocaleDateString()} | Límite legal: ${new Date(r.deadlineDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            ${r.status !== 'completed'
          ? `<button class="btn btn-sm btn-outline" onclick="completeRequest('${r.id}')">Confirmar Supresión</button>`
          : '<span style="color: #10b981; font-weight: 700; font-size: 0.85rem;">Completada</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    elRequests.innerHTML = '<div class="skeleton-loader">Error cargando solicitudes.</div>';
  }
}

// Marcar Solicitud como completada
window.completeRequest = async function (requestId) {
  try {
    await fetchAuth(`/requests/${requestId}`, {
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

// Auditor de Contraseña k-Anonymity
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
    const res = await fetchAuth('/scan/password', {
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
