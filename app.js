// SENTINEL - Core Dashboard Orchestrator
// Orquestador del panel de soberanía, métricas en tiempo real y ciclo de vida de la aplicación

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

// Elementos del Modal de Planes en el Lobby
const planModal = document.getElementById('plan-modal');
const btnClosePlanModal = document.getElementById('btn-close-plan-modal');

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthAndBootstrap();
});

async function checkAuthAndBootstrap() {
  const session = getSession();

  if (!session) {
    showOnboardingModal();
    renderLoggedOutState();
    return;
  }

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
    updateUserHeader(session.user);
    hideOnboardingModal();
    loadDashboardData();
  }
}

function loadDashboardData() {
  loadExposureScore();
  loadIdentities();
  loadBreaches();
  loadPlatforms();
  loadRequests();
}

function renderLoggedOutState() {
  if (elUserBadge) elUserBadge.textContent = 'Sin autenticar';
  if (elUserPlanBadge) {
    elUserPlanBadge.textContent = 'BLOQUEADO';
    elUserPlanBadge.className = 'plan-pill plan-free';
  }

  if (elScore) elScore.textContent = '--';
  if (elRiskBadge) {
    elRiskBadge.textContent = 'Control de Acceso';
    elRiskBadge.style.color = '#94a3b8';
  }
  if (elRiskSummary) {
    elRiskSummary.textContent = 'Autentica tu identidad o clave para desbloquear la bóveda de soberanía.';
  }

  setSafeHtml(elIdentities, '<div class="skeleton-loader">Identidades bloqueadas. Autentícate para ver tus registros.</div>');
  const breachesWrapper = document.getElementById('breaches-list');
  if (breachesWrapper) {
    setSafeHtml(breachesWrapper, '<div class="skeleton-loader">Feed de incidentes bloqueado. Autentícate para ver tus registros.</div>');
  }
  setSafeHtml(elRequests, '<div class="skeleton-loader">Sin solicitudes visibles.</div>');
}

function updateUserHeader(user) {
  if (!user) return;
  if (elUserBadge) elUserBadge.textContent = user.display_name || user.email;

  const plan = (user.plan || 'free').toLowerCase();
  if (elUserPlanBadge) {
    elUserPlanBadge.textContent = plan.toUpperCase();
    elUserPlanBadge.className = `plan-pill plan-${plan}`;
    elUserPlanBadge.style.cursor = 'pointer';
    elUserPlanBadge.title = 'Haz clic para gestionar tu nivel de protección en el Lobby';
  }
}

async function loadExposureScore() {
  try {
    const res = await fetchAuth('/scan/exposure');
    if (!res.ok) return;
    const data = await res.json();

    if (elScore) elScore.textContent = data.score;
    if (elRiskBadge) {
      elRiskBadge.textContent = `Nivel de Riesgo: ${data.riskLevel}`;
      elRiskBadge.style.color = data.riskColor;
    }

    const gaugeRing = document.querySelector('.gauge-ring');
    if (gaugeRing) {
      gaugeRing.style.borderColor = data.riskColor;
      gaugeRing.style.boxShadow = `0 0 20px ${data.riskColor}40`;
    }

    if (data.recommendations && data.recommendations.length > 0 && elRiskSummary) {
      elRiskSummary.textContent = data.recommendations[0];
    }

    if (data.metrics) {
      if (elMetricIdentities) elMetricIdentities.textContent = data.metrics.monitoredIdentities;
      if (elMetricBreaches) elMetricBreaches.textContent = data.metrics.totalBreaches;
      if (elMetricDeletions) elMetricDeletions.textContent = data.metrics.completedDeletions;
    }
  } catch (err) {
    console.error('Error cargando exposure score:', err);
  }
}

function handleExportPdf() {
  const session = getSession();
  if (!session) {
    showOnboardingModal();
    return;
  }
  const token = encodeURIComponent(session.token);
  window.open(`${API_BASE}/reports/footprint-pdf?token=${token}`, '_blank');
}

function initAuthControls() {
  const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
  const groupAuthName = document.getElementById('group-auth-name');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const authIdentifier = document.getElementById('auth-identifier');
  const authName = document.getElementById('auth-name');
  const formAuth = document.getElementById('form-auth');
  const btnGoogleAuth = document.getElementById('btn-google-auth');
  const btnMasterAccess = document.getElementById('btn-master-access');

  if (btnToggleAuthMode) {
    btnToggleAuthMode.addEventListener('click', () => {
      clearAuthFeedback();
      const isLogin = currentAuthMode === 'login';
      currentAuthMode = isLogin ? 'register' : 'login';
      if (groupAuthName) groupAuthName.style.display = isLogin ? 'block' : 'none';
      if (btnAuthSubmit) btnAuthSubmit.textContent = isLogin ? '[ REGISTRAR BÓVEDA ]' : '[ INICIAR SESIÓN ]';
      btnToggleAuthMode.textContent = isLogin ? '¿Ya tienes identidad? Iniciar sesión' : '¿Primera vez? Crear nueva identidad';
      const targetFocus = isLogin ? authName : authIdentifier;
      if (targetFocus) targetFocus.focus();
    });
  }

  if (formAuth) formAuth.addEventListener('submit', handleAuthSubmit);
  if (btnGoogleAuth) btnGoogleAuth.addEventListener('click', handleGoogleAuth);
  if (btnMasterAccess) btnMasterAccess.addEventListener('click', handleMasterAccess);
  if (btnLogout) btnLogout.addEventListener('click', clearSession);
}

function initPlanLobbyControls() {
  if (elUserPlanBadge) {
    elUserPlanBadge.addEventListener('click', () => planModal && planModal.classList.remove('hidden'));
  }
  if (btnClosePlanModal) {
    btnClosePlanModal.addEventListener('click', () => planModal && planModal.classList.add('hidden'));
  }
  document.querySelectorAll('.btn-select-lobby-plan').forEach(btn => {
    btn.addEventListener('click', e => changePlanFromLobby(e.target.getAttribute('data-plan')));
  });
}

function initScanAndAuditControls() {
  const btnRunScan = document.getElementById('btn-run-scan');
  if (btnRunScan) btnRunScan.addEventListener('click', runGlobalScan);

  const btnCheckPwd = document.getElementById('btn-check-pwd');
  const inputPwd = document.getElementById('input-pwd');
  const btnTogglePwd = document.getElementById('btn-toggle-pwd-vis');

  if (btnCheckPwd) btnCheckPwd.addEventListener('click', auditPassword);
  if (inputPwd) {
    inputPwd.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        auditPassword();
      }
    });
  }

  if (btnTogglePwd && inputPwd) {
    btnTogglePwd.addEventListener('click', () => {
      const isPass = inputPwd.type === 'password';
      inputPwd.type = isPass ? 'text' : 'password';
      btnTogglePwd.textContent = isPass ? '🔒' : '👁️';
      btnTogglePwd.title = isPass ? 'Ocultar contraseña' : 'Mostrar contraseña';
    });
  }

  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) btnExportPdf.addEventListener('click', handleExportPdf);
}

function initIdentityModalControls() {
  const idModal = document.getElementById('identity-modal');
  const idTypeSelect = document.getElementById('new-id-type');
  if (idTypeSelect) idTypeSelect.addEventListener('change', updateIdentityModalInputs);

  const btnOpenIdModal = document.getElementById('btn-open-identity-modal');
  if (btnOpenIdModal) {
    btnOpenIdModal.addEventListener('click', () => {
      updateIdentityModalInputs();
      if (idModal) {
        idModal.classList.remove('hidden');
        const inputVal = document.getElementById('new-id-value');
        if (inputVal) inputVal.focus();
      }
    });
  }

  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', () => idModal && idModal.classList.add('hidden'));

  const btnCancelId = document.getElementById('btn-cancel-id');
  if (btnCancelId) btnCancelId.addEventListener('click', () => idModal && idModal.classList.add('hidden'));

  const btnSaveId = document.getElementById('btn-save-id');
  if (btnSaveId) btnSaveId.addEventListener('click', saveNewIdentity);
}

function initGdprModalControls() {
  const gdprModal = document.getElementById('gdpr-modal');
  const btnCloseGdprModal = document.getElementById('btn-close-gdpr-modal');
  if (btnCloseGdprModal) btnCloseGdprModal.addEventListener('click', () => gdprModal && gdprModal.classList.add('hidden'));

  const btnCloseGdpr = document.getElementById('btn-close-gdpr');
  if (btnCloseGdpr) btnCloseGdpr.addEventListener('click', () => gdprModal && gdprModal.classList.add('hidden'));

  const btnMarkSent = document.getElementById('btn-mark-sent');
  if (btnMarkSent) btnMarkSent.addEventListener('click', markGdprRequestSent);

  const btnCopyGdpr = document.getElementById('btn-copy-gdpr');
  if (btnCopyGdpr) {
    btnCopyGdpr.addEventListener('click', () => {
      const templateArea = document.getElementById('gdpr-template-text');
      if (templateArea && templateArea.value) {
        navigator.clipboard.writeText(templateArea.value).then(() => {
          const original = btnCopyGdpr.textContent;
          btnCopyGdpr.textContent = '✓ ¡Copiado!';
          btnCopyGdpr.style.borderColor = 'var(--color-emerald)';
          btnCopyGdpr.style.color = 'var(--color-emerald)';
          setTimeout(() => {
            btnCopyGdpr.textContent = original;
            btnCopyGdpr.style.borderColor = '';
            btnCopyGdpr.style.color = '';
          }, 2000);
        }).catch(() => {
          templateArea.select();
          document.execCommand('copy');
          alert('Plantilla copiada al portapapeles.');
        });
      }
    });
  }
}

function initPlatformFilterControls() {
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

function setupEventListeners() {
  initAuthControls();
  initPlanLobbyControls();
  initScanAndAuditControls();
  initIdentityModalControls();
  initGdprModalControls();
  initPlatformFilterControls();
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.checkAuthAndBootstrap = checkAuthAndBootstrap;
  window.loadDashboardData = loadDashboardData;
  window.renderLoggedOutState = renderLoggedOutState;
  window.updateUserHeader = updateUserHeader;
  window.loadExposureScore = loadExposureScore;
  window.handleExportPdf = handleExportPdf;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkAuthAndBootstrap,
    loadDashboardData,
    renderLoggedOutState,
    updateUserHeader,
    loadExposureScore,
    handleExportPdf
  };
}
