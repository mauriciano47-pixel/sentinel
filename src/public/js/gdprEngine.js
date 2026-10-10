// SENTINEL - GDPR Deletion Engine & Orquestador de Supresión (Art. 17 RGPD)
// Trazabilidad de solicitudes con plazo legal perentorio de 30 días

let currentSelectedPlatform = null;

function generateGdprNotice(platformName, userName, userEmail) {
  const pName = (platformName || 'Plataforma').trim();
  const uName = (userName || '[Tu Nombre y Apellidos]').trim();
  const uEmail = (userEmail || '[Tu Correo Electrónico]').trim();

  return `A la atención del Delegado de Protección de Datos (DPO) / Responsable de Seguridad de ${pName}:

Por medio de la presente, yo, ${uName}, con correo electrónico asociado ${uEmail}, ejerciendo los derechos que me confiere el Reglamento General de Protección de Datos (RGPD - Reglamento UE 2016/679) en su Artículo 17 ("Derecho de Supresión" o "Derecho al Olvido"), y normativas aplicables de privacidad:

SOLICITO:
1. La supresión definitiva, total e irrevocable de todos los datos personales asociados a mi persona que obren en sus ficheros, bases de datos y sistemas de copias de seguridad de ${pName}.
2. La confirmación fehaciente por escrito de la efectiva eliminación en el plazo legal máximo de 30 días estipulado por la normativa.
3. La notificación de dicha supresión a cualquier tercero o encargado de tratamiento a quien hayan sido comunicados mis datos.

En caso de no recibir respuesta oportuna en el plazo estipulado, me reservo el derecho de elevar la correspondiente reclamación ante la Autoridad de Control de Protección de Datos competente.

Atentamente,
${uName}
${uEmail}`;
}

function calculateUrgency(daysRemaining, status) {
  if (status === 'completed') return 'completed';
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 5) return 'urgent';
  if (daysRemaining <= 10) return 'warning';
  return 'normal';
}

async function loadPlatforms(category = '', search = '') {
  const elPlatforms = document.getElementById('platforms-grid');
  if (!elPlatforms) return;

  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const res = await fetchAuth(`/platforms?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.platforms || data.platforms.length === 0) {
      if (search) {
        setSafeHtml(elPlatforms, `
          <div style="grid-column: 1 / -1; background: rgba(30, 41, 59, 0.6); border: 1px dashed rgba(0, 229, 255, 0.3); border-radius: 12px; padding: 28px; text-align: center;">
            <p style="color: var(--text-dim); margin-bottom: 8px; font-size: 0.95rem;">
              No se encontró "<strong>${escapeHtml(search)}</strong>" en el catálogo estándar de plataformas.
            </p>
            <p style="color: var(--text-dim); margin-bottom: 18px; font-size: 0.85rem;">
              Puedes generar automáticamente una solicitud formal de supresión RGPD (Art. 17) personalizada para esta plataforma:
            </p>
            <button class="btn btn-primary" onclick="openCustomGdprModal('${escapeHtml(search)}')">
              📝 Redactar Solicitud RGPD para "${escapeHtml(search)}"
            </button>
          </div>
        `);
      } else {
        setSafeHtml(elPlatforms, '<div class="skeleton-loader">No se encontraron plataformas en esta categoría.</div>');
      }
      return;
    }

    setSafeHtml(elPlatforms, data.platforms.map(p => {
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
    }).join(''));
  } catch (err) {
    setSafeHtml(elPlatforms, '<div class="skeleton-loader">Error al cargar plataformas.</div>');
  }
}

function openCustomGdprModal(platformName) {
  const cleanName = (platformName || 'Plataforma').trim();
  currentSelectedPlatform = { id: null, name: cleanName };

  const session = getSession();
  const userName = session && session.user && session.user.display_name ? session.user.display_name : '[Tu Nombre y Apellidos]';
  const userEmail = session && session.user && session.user.email ? session.user.email : '[Tu Correo Electrónico]';

  const template = generateGdprNotice(cleanName, userName, userEmail);

  const titleEl = document.getElementById('gdpr-modal-title');
  const instEl = document.getElementById('gdpr-instructions');
  const textEl = document.getElementById('gdpr-template-text');
  const linksBox = document.getElementById('gdpr-action-links');
  const modalEl = document.getElementById('gdpr-modal');

  if (titleEl) titleEl.textContent = `Solicitud de Supresión RGPD — ${cleanName}`;
  if (instEl) instEl.textContent = `Esta plataforma no cuenta con un canal directo catalogado aún, pero puedes copiar esta solicitud formal o redactar el correo legal a su dirección de soporte / DPO.`;
  if (textEl) textEl.value = template;

  if (linksBox) {
    setSafeHtml(linksBox, '');
    const domainGuess = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const subject = encodeURIComponent(`Solicitud de Supresión de Datos Personales (Art. 17 RGPD) - ${cleanName}`);
    const body = encodeURIComponent(template);
    appendSafeHtml(linksBox, `<a href="mailto:privacy@${domainGuess}.com?subject=${subject}&body=${body}" class="btn btn-sm btn-secondary">Redactar Correo Legal al DPO</a>`);
  }

  if (modalEl) modalEl.classList.remove('hidden');
}

async function openGdprModal(platformId) {
  try {
    const res = await fetchAuth(`/platforms/${platformId}`);
    if (!res.ok) return;
    const data = await res.json();
    currentSelectedPlatform = data.platform;

    const titleEl = document.getElementById('gdpr-modal-title');
    const instEl = document.getElementById('gdpr-instructions');
    const textEl = document.getElementById('gdpr-template-text');
    const linksBox = document.getElementById('gdpr-action-links');
    const modalEl = document.getElementById('gdpr-modal');

    if (titleEl) titleEl.textContent = `Solicitud de Supresión RGPD — ${data.platform.name}`;
    if (instEl) instEl.textContent = data.platform.instructions || 'Sigue los pasos y envía la solicitud formal a la plataforma.';
    if (textEl) textEl.value = data.customizedGdprTemplate || '';

    if (linksBox) {
      setSafeHtml(linksBox, '');
      if (data.platform.deletion_url) {
        appendSafeHtml(linksBox, `<a href="${data.platform.deletion_url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">Abrir Portal de Eliminación Oficial</a> `);
      }
      if (data.platform.deletion_email) {
        const subject = encodeURIComponent(`Solicitud de Supresión de Datos Personales (Art. 17 RGPD)`);
        const body = encodeURIComponent(data.customizedGdprTemplate);
        appendSafeHtml(linksBox, `<a href="mailto:${data.platform.deletion_email}?subject=${subject}&body=${body}" class="btn btn-sm btn-secondary">Redactar Correo Legal al DPO</a>`);
      }
    }

    if (modalEl) modalEl.classList.remove('hidden');
  } catch (err) {
    alert('Error obteniendo datos de la plataforma');
  }
}

async function markGdprRequestSent() {
  if (!currentSelectedPlatform) return;

  try {
    const payload = {
      status: 'sent',
      notes: 'Solicitud formal de derecho al olvido enviada por el usuario.'
    };
    if (currentSelectedPlatform.id) {
      payload.platformId = currentSelectedPlatform.id;
    } else {
      payload.platformName = currentSelectedPlatform.name;
    }

    await fetchAuth('/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const modalEl = document.getElementById('gdpr-modal');
    if (modalEl) modalEl.classList.add('hidden');

    await loadPlatforms();
    await loadRequests();
    if (typeof loadExposureScore === 'function') await loadExposureScore();
  } catch (err) {
    alert('Error al registrar solicitud');
  }
}

async function loadRequests() {
  const elRequests = document.getElementById('requests-list');
  if (!elRequests) return;

  try {
    const res = await fetchAuth('/requests');
    if (!res.ok) return;
    const data = await res.json();

    if (!data.requests || data.requests.length === 0) {
      setSafeHtml(elRequests, '<div class="skeleton-loader">No hay solicitudes de borrado activas aún.</div>');
      return;
    }

    setSafeHtml(elRequests, data.requests.map(r => {
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
    }).join(''));
  } catch (err) {
    setSafeHtml(elRequests, '<div class="skeleton-loader">Error cargando solicitudes.</div>');
  }
}

async function completeRequest(requestId) {
  try {
    await fetchAuth(`/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    await loadRequests();
    await loadPlatforms();
    if (typeof loadExposureScore === 'function') await loadExposureScore();
  } catch (err) {
    alert('Error al actualizar estado.');
  }
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.generateGdprNotice = generateGdprNotice;
  window.calculateUrgency = calculateUrgency;
  window.loadPlatforms = loadPlatforms;
  window.openCustomGdprModal = openCustomGdprModal;
  window.openGdprModal = openGdprModal;
  window.markGdprRequestSent = markGdprRequestSent;
  window.loadRequests = loadRequests;
  window.completeRequest = completeRequest;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateGdprNotice,
    calculateUrgency,
    loadPlatforms,
    openCustomGdprModal,
    openGdprModal,
    markGdprRequestSent,
    loadRequests,
    completeRequest
  };
}
