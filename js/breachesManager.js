// SENTINEL - Breaches & Tactical Remediation Manager
// Centro forense de incidentes, mitigación táctica y escaneo global contra HIBP

async function loadBreaches() {
  const breachesWrapper = document.getElementById('breaches-list');
  const badgeActive = document.getElementById('badge-active-breaches');
  const badgeMitigated = document.getElementById('badge-mitigated-breaches');

  if (!breachesWrapper) return;

  try {
    const res = await fetchAuth('/scan/breaches');
    if (!res.ok) return;
    const data = await res.json();
    const breaches = data.breaches || [];

    const activeCount = breaches.filter(b => !b.is_mitigated).length;
    const mitigatedCount = breaches.filter(b => b.is_mitigated).length;

    if (badgeActive) {
      badgeActive.textContent = `${activeCount} Crítica${activeCount !== 1 ? 's' : ''}`;
      badgeActive.style.display = activeCount > 0 ? 'inline-block' : 'none';
    }
    if (badgeMitigated) {
      badgeMitigated.textContent = `${mitigatedCount} Mitigada${mitigatedCount !== 1 ? 's' : ''}`;
      badgeMitigated.style.display = mitigatedCount > 0 ? 'inline-block' : 'none';
    }

    if (breaches.length === 0) {
      setSafeHtml(breachesWrapper, `
        <div class="empty-breaches-state">
          <div style="font-size: 2rem; margin-bottom: 8px;">🛡️</div>
          <h4 style="color: var(--color-emerald); margin-bottom: 6px;">Bóveda Segura — Sin Filtraciones Críticas Detectadas</h4>
          <p class="micro-text" style="color: var(--text-dim); max-width: 520px; margin: 0 auto;">
            Tus identidades monitoreadas no presentan brechas activas conocidas en bases de datos de incidentes públicos. Puedes ejecutar un escaneo global en cualquier momento.
          </p>
        </div>
      `);
      return;
    }

    setSafeHtml(breachesWrapper, breaches.map(b => {
      const isMitigated = !!b.is_mitigated;
      const dataClasses = Array.isArray(b.compromisedData) ? b.compromisedData : [];

      return `
        <div class="breach-item-card ${isMitigated ? 'is-mitigated' : 'is-critical'}" id="breach-card-${b.id}">
          <div class="breach-card-header">
            <div class="breach-title-area">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="breach-pulse ${isMitigated ? 'mitigated' : 'critical'}"></span>
                <h3 class="breach-platform-name">${escapeHtml(b.breach_title || b.breach_name)}</h3>
              </div>
              <div class="breach-meta-row">
                <span class="breach-meta-item">
                  <span class="meta-label">Fecha incidente:</span>
                  <strong>${escapeHtml(b.breach_date || 'Fecha histórica')}</strong>
                </span>
                <span class="breach-meta-item">
                  <span class="meta-label">Identidad:</span>
                  <strong class="font-mono text-electric">${escapeHtml(b.identity_value)}</strong>
                </span>
                <span class="breach-meta-item">
                  <span class="meta-label">Canal:</span>
                  <span class="type-tag" style="padding: 1px 6px; font-size: 0.65rem;">${escapeHtml(b.identity_type || 'cuenta')}</span>
                </span>
              </div>
            </div>
            <div>
              ${isMitigated
                ? `<span class="badge-tag" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1);">✓ Mitigada / Clave Cambiada</span>`
                : `<span class="badge-tag" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.12);">⚠️ Riesgo Crítico</span>`}
            </div>
          </div>

          <div class="breach-card-body">
            <p class="breach-desc">${escapeHtml(b.description || 'Filtración masiva expuesta en volcados de credenciales de la dark web.')}</p>

            <div class="breach-data-box">
              <span class="breach-data-label">Datos personales filtrados:</span>
              <div class="breach-data-tags">
                ${dataClasses.length > 0
                  ? dataClasses.map(dc => `<span class="breach-pill">${escapeHtml(dc)}</span>`).join('')
                  : '<span class="breach-pill">Credenciales / Correo</span>'}
              </div>
            </div>

            <!-- Centro Táctico de Remediación -->
            <div class="breach-action-panel">
              <div class="action-panel-header">
                <span>⚡ PROTOCOLO DE REMEDIACIÓN INMEDIATA:</span>
              </div>
              <ul class="action-steps-list">
                <li><strong>1. Cambiar contraseña:</strong> Cambia de inmediato la clave en ${escapeHtml(b.breach_title || b.breach_name)} y en cualquier otro servicio donde hayas reutilizado la misma (evita ataques por repetición).</li>
                <li><strong>2. Auditoría k-Anonymity:</strong> Comprueba si la contraseña que utilizabas ya figura en listas públicas con nuestro auditor seguro de claves.</li>
                <li><strong>3. Derecho al Olvido (RGPD):</strong> Si ya no utilizas esta plataforma, envía una solicitud legal formal para exigir la eliminación total de tus registros y cuenta.</li>
              </ul>

              <div class="action-buttons-toolbar">
                <button class="btn btn-sm btn-outline" onclick="goToPasswordAuditor()" title="Auditar contraseña antigua con k-Anonymity">
                  🔑 Auditar Clave en k-Anonymity
                </button>
                <button class="btn btn-sm btn-secondary" onclick="seekPlatformInCatalog('${escapeHtml(b.breach_name)}')" title="Buscar en catálogo de plataformas para solicitar borrado">
                  🗑️ Exigir Borrado en Plataforma
                </button>
                <button class="btn btn-sm ${isMitigated ? 'btn-secondary' : 'btn-primary'}" onclick="toggleBreachMitigation('${b.id}')">
                  ${isMitigated ? '↩ Marcar como Pendiente' : '✓ Ya cambié mi clave (Marcar Resuelta)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join(''));

  } catch (err) {
    console.error('Error cargando brechas:', err);
    setSafeHtml(breachesWrapper, '<div class="skeleton-loader">Error al consultar el feed de incidentes.</div>');
  }
}

function scrollToBreaches() {
  const section = document.getElementById('section-breaches');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.style.transition = 'box-shadow 0.4s';
    section.style.boxShadow = '0 0 35px rgba(239, 68, 68, 0.4)';
    setTimeout(() => {
      section.style.boxShadow = '';
    }, 2000);
  }
}

function goToPasswordAuditor() {
  const pwdInput = document.getElementById('input-pwd');
  const card = document.getElementById('pwd-audit-card') || pwdInput;

  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'box-shadow 0.4s ease-in-out';
    card.style.boxShadow = '0 0 35px rgba(0, 229, 255, 0.5)';
    setTimeout(() => {
      card.style.boxShadow = '';
    }, 2500);
  }

  if (pwdInput) {
    setTimeout(() => {
      pwdInput.focus();
      pwdInput.style.transition = 'border-color 0.3s, box-shadow 0.3s';
      pwdInput.style.borderColor = 'var(--color-electric-blue)';
      pwdInput.style.boxShadow = '0 0 20px rgba(0, 229, 255, 0.7)';
      setTimeout(() => {
        pwdInput.style.borderColor = '';
        pwdInput.style.boxShadow = '';
      }, 2500);
    }, 350);
  }
}

function seekPlatformInCatalog(breachName) {
  if (!breachName) return;
  const cleanName = breachName.split('-')[0].split(' ')[0].trim();
  const searchInput = document.getElementById('filter-search');
  const catSelect = document.getElementById('filter-category');

  if (catSelect) catSelect.value = '';
  if (searchInput) {
    searchInput.value = cleanName;
    if (typeof loadPlatforms === 'function') {
      loadPlatforms('', cleanName);
    }
    const platformsSection = document.getElementById('platforms-grid');
    if (platformsSection) {
      platformsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

async function toggleBreachMitigation(breachId) {
  try {
    const res = await fetchAuth(`/scan/breaches/${breachId}/mitigate`, {
      method: 'PATCH'
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Error actualizando estado de mitigación.');
      return;
    }

    await loadBreaches();
    if (typeof loadExposureScore === 'function') await loadExposureScore();
    if (typeof loadIdentities === 'function') await loadIdentities();
  } catch (err) {
    alert('Error al comunicar la mitigación de la filtración.');
  }
}

async function runGlobalScan() {
  const session = getSession();
  if (!session) {
    if (typeof showOnboardingModal === 'function') showOnboardingModal();
    return;
  }

  const btn = document.getElementById('btn-run-scan');
  const elScanStatus = document.getElementById('scan-status');
  if (btn) btn.disabled = true;
  if (elScanStatus) elScanStatus.textContent = 'Auditoría en curso contra catálogos HIBP...';

  try {
    const res = await fetchAuth('/scan', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      if (elScanStatus) elScanStatus.textContent = data.error || 'Error al ejecutar escaneo';
      return;
    }

    if (elScanStatus) elScanStatus.textContent = `Escaneo finalizado: ${data.totalNewBreaches} filtraciones añadidas.`;
    if (typeof loadExposureScore === 'function') await loadExposureScore();
    if (typeof loadIdentities === 'function') await loadIdentities();
    await loadBreaches();
  } catch (err) {
    if (elScanStatus) elScanStatus.textContent = 'Fallo de red en escaneo.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.loadBreaches = loadBreaches;
  window.scrollToBreaches = scrollToBreaches;
  window.goToPasswordAuditor = goToPasswordAuditor;
  window.seekPlatformInCatalog = seekPlatformInCatalog;
  window.toggleBreachMitigation = toggleBreachMitigation;
  window.runGlobalScan = runGlobalScan;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadBreaches,
    scrollToBreaches,
    goToPasswordAuditor,
    seekPlatformInCatalog,
    toggleBreachMitigation,
    runGlobalScan
  };
}
