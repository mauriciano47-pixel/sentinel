// SENTINEL - Password Auditor (k-Anonymity Cloudflare & HIBP)
// Auditoría Zero-Knowledge de claves comprometidas

function parseKAnonymityFeedback(pwned, count, advice) {
  if (pwned) {
    const countFormatted = Number(count || 0).toLocaleString();
    return {
      cssClass: 'pwd-feedback-banner pwned',
      title: '⚠️ Contraseña Comprometida en Filtraciones Públicas',
      advice: advice || 'Esta contraseña ha sido expuesta en filtraciones masivas.',
      details: `Detectada en ${countFormatted} registros públicos de incidentes. Si la usas activamente, cámbiala de inmediato.`
    };
  } else {
    return {
      cssClass: 'pwd-feedback-banner safe',
      title: '✓ Contraseña Segura (Sin Filtración Detectada)',
      advice: advice || 'No se encontró registro de filtración pública.',
      details: 'Tu contraseña no figura en los catálogos públicos analizados por HaveIBeenPwned con k-Anonymity.'
    };
  }
}

async function auditPassword() {
  const pwdInput = document.getElementById('input-pwd');
  const pwdFeedback = document.getElementById('pwd-result');
  const btnCheck = document.getElementById('btn-check-pwd');
  const val = pwdInput ? pwdInput.value : '';

  if (!pwdFeedback) return;

  if (!val) {
    setSafeHtml(pwdFeedback, `
      <div class="pwd-feedback-banner info" style="border-color: rgba(245, 158, 11, 0.4); color: #f59e0b;">
        ⚠️ Por favor, ingresa una contraseña para auditar con k-Anonymity.
      </div>
    `);
    if (pwdInput) pwdInput.focus();
    return;
  }

  if (btnCheck) {
    btnCheck.disabled = true;
    btnCheck.textContent = 'Auditando...';
  }

  setSafeHtml(pwdFeedback, `
    <div class="pwd-feedback-banner info">
      🔒 Calculando SHA-1 local y consultando prefijo de 5 caracteres con Cloudflare k-Anonymity...
    </div>
  `);

  try {
    const session = typeof getSession === 'function' ? getSession() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      if (session.user && session.user.id) {
        headers['x-user-id'] = session.user.id;
      }
    }

    const res = await fetch(`${API_BASE}/scan/password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password: val })
    });

    const data = await res.json();

    if (!res.ok) {
      setSafeHtml(pwdFeedback, `
        <div class="pwd-feedback-banner pwned">
          <div style="font-weight: 700;">⚠️ ${escapeHtml(data.error || 'Error al auditar contraseña')}</div>
          <div style="font-size: 0.82rem; margin-top: 4px;">No se pudo completar la verificación con el servidor de incidentes.</div>
        </div>
      `);
      return;
    }

    const info = parseKAnonymityFeedback(data.pwned, data.count, data.advice);
    setSafeHtml(pwdFeedback, `
      <div class="${info.cssClass}">
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;">${escapeHtml(info.title)}</div>
        <div style="font-size: 0.85rem; line-height: 1.4;">${escapeHtml(info.advice)}</div>
        <div style="margin-top: 6px; font-size: 0.78rem; opacity: 0.9;">
          ${escapeHtml(info.details)}
        </div>
      </div>
    `);
  } catch (err) {
    console.error('Error al verificar contraseña:', err);
    setSafeHtml(pwdFeedback, `
      <div class="pwd-feedback-banner pwned">
        <div style="font-weight: 700;">⚠️ Error de Conexión</div>
        <div style="font-size: 0.82rem; margin-top: 4px;">No se pudo conectar con el servicio k-Anonymity. Comprueba tu conexión a internet o intenta más tarde.</div>
      </div>
    `);
  } finally {
    if (btnCheck) {
      btnCheck.disabled = false;
      btnCheck.textContent = 'Auditar';
    }
  }
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.parseKAnonymityFeedback = parseKAnonymityFeedback;
  window.auditPassword = auditPassword;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseKAnonymityFeedback,
    auditPassword
  };
}
