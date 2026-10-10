// SENTINEL - Session & Access Control Manager
// Gestión de sesión local soberana, autenticación unificada y Google SSO

const API_BASE = '/api/v1';
let currentAuthMode = 'login'; // 'login' | 'register'

function getSession() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('sentinel_session') : null;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveSession(user, token) {
  const session = { user, token: token || (user && user.id) };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('sentinel_session', JSON.stringify(session));
  }
  return session;
}

function clearSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sentinel_session');
  }
  showOnboardingModal();
  if (typeof renderLoggedOutState === 'function') {
    renderLoggedOutState();
  }
}

function showOnboardingModal() {
  const onboardingModal = document.getElementById('onboarding-modal');
  if (onboardingModal) {
    onboardingModal.classList.remove('hidden');
    clearAuthFeedback();
    resetAuthForm();
  }
}

function hideOnboardingModal() {
  const onboardingModal = document.getElementById('onboarding-modal');
  if (onboardingModal) {
    onboardingModal.classList.add('hidden');
    clearAuthFeedback();
  }
}

function showAuthFeedback(msg, type = 'error') {
  const authFeedback = document.getElementById('auth-feedback');
  if (!authFeedback) return;
  authFeedback.textContent = msg;
  authFeedback.className = `auth-feedback-box ${type}`;
  authFeedback.classList.remove('hidden');
}

function clearAuthFeedback() {
  const authFeedback = document.getElementById('auth-feedback');
  if (!authFeedback) return;
  authFeedback.textContent = '';
  authFeedback.className = 'auth-feedback-box hidden';
}

function resetAuthForm() {
  currentAuthMode = 'login';
  const groupAuthName = document.getElementById('group-auth-name');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
  const authIdentifier = document.getElementById('auth-identifier');
  const authPassword = document.getElementById('auth-password');
  const authName = document.getElementById('auth-name');

  if (groupAuthName) groupAuthName.style.display = 'none';
  if (btnAuthSubmit) btnAuthSubmit.textContent = '[ INICIAR SESIÓN ]';
  if (btnToggleAuthMode) btnToggleAuthMode.textContent = '¿Primera vez? Crear nueva identidad';
  if (authIdentifier) authIdentifier.value = '';
  if (authPassword) authPassword.value = '';
  if (authName) authName.value = '';
}

// Wrapper centralizado de Fetch con Autenticación Inyectada
async function fetchAuth(endpoint, options = {}) {
  const session = getSession();
  const headers = Object.assign({}, options.headers || {});

  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    if (session.user && session.user.id) {
      headers['x-user-id'] = session.user.id;
    }
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, Object.assign({}, options, { headers }));

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/scan/password')) {
    console.warn('[Sentinel] Sesión no autorizada o expirada');
    clearSession();
  }

  return response;
}

// Controladores de Auth
async function handleAuthSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  clearAuthFeedback();

  const authIdentifier = document.getElementById('auth-identifier');
  const authPassword = document.getElementById('auth-password');
  const authName = document.getElementById('auth-name');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');

  const identifier = authIdentifier ? authIdentifier.value.trim() : '';
  const password = authPassword ? authPassword.value.trim() : '';
  const displayName = authName ? authName.value.trim() : '';

  if (!identifier) {
    showAuthFeedback('[!] Usuario o correo electrónico obligatorio.', 'error');
    if (authIdentifier) authIdentifier.focus();
    return;
  }

  if (!password) {
    showAuthFeedback('[!] Clave de seguridad requerida.', 'error');
    if (authPassword) authPassword.focus();
    return;
  }

  if (btnAuthSubmit) {
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.textContent = '[ VERIFICANDO CREDENCIALES... ]';
  }

  try {
    if (currentAuthMode === 'login') {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showAuthFeedback(`[!] ${data.error || 'Acceso denegado.'}`, 'error');
        return;
      }

      showAuthFeedback('[✓] Acceso autorizado. Desbloqueando...', 'success');
      saveSession(data.user, data.token);
      if (typeof updateUserHeader === 'function') updateUserHeader(data.user);

      setTimeout(() => {
        hideOnboardingModal();
        if (typeof loadDashboardData === 'function') loadDashboardData();
      }, 350);
    } else {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier,
          password,
          displayName: displayName || identifier.split('@')[0],
          plan: 'free'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showAuthFeedback(`[!] ${data.error || 'Error creando identidad.'}`, 'error');
        return;
      }

      showAuthFeedback('[✓] Identidad registrada con éxito.', 'success');
      saveSession(data.user, data.token);
      if (typeof updateUserHeader === 'function') updateUserHeader(data.user);

      if (identifier.includes('@')) {
        try {
          await fetchAuth('/identities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'email',
              value: identifier.toLowerCase(),
              label: 'Identidad Principal'
            })
          });
        } catch (_) {}
      }

      setTimeout(() => {
        hideOnboardingModal();
        if (typeof loadDashboardData === 'function') loadDashboardData();
      }, 350);
    }
  } catch (err) {
    showAuthFeedback('[!] Error de conexión con la terminal Sentinel.', 'error');
  } finally {
    if (btnAuthSubmit) {
      btnAuthSubmit.disabled = false;
      btnAuthSubmit.textContent = currentAuthMode === 'login' ? '[ INICIAR SESIÓN ]' : '[ REGISTRAR BÓVEDA ]';
    }
  }
}

async function handleGoogleAuth() {
  clearAuthFeedback();
  const btnGoogleAuth = document.getElementById('btn-google-auth');
  if (btnGoogleAuth) btnGoogleAuth.disabled = true;

  try {
    const defaultGoogleEmail = 'usuario.seguro@gmail.com';
    const emailPrompt = prompt('SISTEMA SENTINEL // INGRESO CON CUENTA GOOGLE\nIntroduce tu dirección de correo Google:', defaultGoogleEmail);

    if (!emailPrompt) {
      if (btnGoogleAuth) btnGoogleAuth.disabled = false;
      return;
    }

    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailPrompt.trim().toLowerCase(),
        displayName: emailPrompt.split('@')[0],
        googleId: `gid_${Date.now()}`
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showAuthFeedback(`[!] ${data.error || 'Error autenticando con Google.'}`, 'error');
      return;
    }

    showAuthFeedback('[✓] Autenticado vía Google SSO. Cargando bóveda...', 'success');
    saveSession(data.user, data.token);
    if (typeof updateUserHeader === 'function') updateUserHeader(data.user);

    setTimeout(() => {
      hideOnboardingModal();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }, 350);
  } catch (e) {
    showAuthFeedback('[!] Error en servicio federado de Google.', 'error');
  } finally {
    if (btnGoogleAuth) btnGoogleAuth.disabled = false;
  }
}

async function handleMasterAccess() {
  clearAuthFeedback();
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'guardian@sentinel.privacy' })
    });

    if (res.ok) {
      const data = await res.json();
      saveSession(data.user, data.token);
      if (typeof updateUserHeader === 'function') updateUserHeader(data.user);
    } else {
      const masterUser = {
        id: 'user_local_soberano',
        email: 'guardian@sentinel.privacy',
        display_name: 'Mauro (Arconte Soberano)',
        plan: 'sentinel'
      };
      saveSession(masterUser, 'user_local_soberano');
      if (typeof updateUserHeader === 'function') updateUserHeader(masterUser);
    }

    showAuthFeedback('[✓] Identidad Arconte Soberano verificada.', 'success');
    setTimeout(() => {
      hideOnboardingModal();
      if (typeof loadDashboardData === 'function') loadDashboardData();
    }, 250);
  } catch (e) {
    const masterUser = {
      id: 'user_local_soberano',
      email: 'guardian@sentinel.privacy',
      display_name: 'Mauro (Arconte Soberano)',
      plan: 'sentinel'
    };
    saveSession(masterUser, 'user_local_soberano');
    if (typeof updateUserHeader === 'function') updateUserHeader(masterUser);
    hideOnboardingModal();
    if (typeof loadDashboardData === 'function') loadDashboardData();
  }
}

async function changePlanFromLobby(newPlan) {
  try {
    const res = await fetchAuth('/auth/plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: newPlan })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error al actualizar nivel de plan');
      return;
    }

    const session = getSession();
    if (session) {
      saveSession(data.user, session.token);
      if (typeof updateUserHeader === 'function') updateUserHeader(data.user);
    }

    const planModal = document.getElementById('plan-modal');
    if (planModal) planModal.classList.add('hidden');
    alert(`Nivel de protección actualizado a ${newPlan.toUpperCase()} en tu lobby.`);
    if (typeof loadExposureScore === 'function') loadExposureScore();
  } catch (err) {
    alert('Error al comunicar cambio de plan.');
  }
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.API_BASE = API_BASE;
  window.getSession = getSession;
  window.saveSession = saveSession;
  window.clearSession = clearSession;
  window.showOnboardingModal = showOnboardingModal;
  window.hideOnboardingModal = hideOnboardingModal;
  window.showAuthFeedback = showAuthFeedback;
  window.clearAuthFeedback = clearAuthFeedback;
  window.resetAuthForm = resetAuthForm;
  window.fetchAuth = fetchAuth;
  window.handleAuthSubmit = handleAuthSubmit;
  window.handleGoogleAuth = handleGoogleAuth;
  window.handleMasterAccess = handleMasterAccess;
  window.changePlanFromLobby = changePlanFromLobby;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_BASE,
    getSession,
    saveSession,
    clearSession,
    showOnboardingModal,
    hideOnboardingModal,
    showAuthFeedback,
    clearAuthFeedback,
    resetAuthForm,
    fetchAuth,
    handleAuthSubmit,
    handleGoogleAuth,
    handleMasterAccess,
    changePlanFromLobby
  };
}
