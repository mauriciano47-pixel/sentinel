/**
 * SENTINEL — Guardián de Contratos en Tiempo de Ejecución (Zero-Trust Runtime I/O)
 * Valida y sanitiza esquemas de entrada/salida (Identidades, Solicitudes RGPD,
 * Contraseñas auditadas y Métricas de Exposición) en tiempo de ejecución.
 */

function sanitizeString(val, fallback = '', maxLength = 250) {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(val, fallback = 0, min = 0, max = 100) {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function validateContract(rawInput, validatorFn) {
  try {
    return validatorFn(rawInput);
  } catch (err) {
    return {
      valid: false,
      data: null,
      errors: [err instanceof Error ? err.message : 'Error desconocido de contrato en runtime']
    };
  }
}

function validateIdentityContract(rawInput) {
  const raw = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {});
  const errors = [];

  const type = String(raw.type || '').trim().toLowerCase();
  const validTypes = ['email', 'phone', 'alias'];
  if (!validTypes.includes(type)) {
    errors.push(`Tipo de identidad no admitido: "${type}". Tipos válidos: ${validTypes.join(', ')}`);
  }

  let value = sanitizeString(raw.value, '');
  if (!value) {
    errors.push('El valor de la identidad no puede estar vacío');
  } else if (type === 'email') {
    value = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push('Formato de correo electrónico inválido');
    }
  } else if (type === 'phone') {
    value = value.replace(/[^\d+]/g, '');
    if (value.length < 8) {
      errors.push('Número telefónico demasiado corto (mínimo 8 dígitos)');
    }
  }

  const label = sanitizeString(raw.label, type === 'phone' ? 'Móvil Personal' : 'Principal', 60);

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? { type, value, label } : null,
    errors
  };
}

function validateGdprRequestContract(rawInput) {
  const raw = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {});
  const errors = [];

  const platformId = Number(raw.platformId || raw.platform_id || 0);
  if (!Number.isFinite(platformId) || platformId < 0) {
    errors.push('Identificador de plataforma inválido');
  }

  const platformName = sanitizeString(raw.platformName || raw.platform_name, 'Plataforma', 100);
  const status = sanitizeString(raw.status, 'sent', 30);
  const notes = sanitizeString(raw.notes, 'Solicitud de borrado formal RGPD Art. 17', 500);

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? { platformId, platformName, status, notes } : null,
    errors
  };
}

function validatePasswordAuditContract(rawInput) {
  const errors = [];
  if (typeof rawInput !== 'string') {
    errors.push('La contraseña a auditar debe ser una cadena de texto');
  } else if (rawInput.length === 0) {
    errors.push('La contraseña no puede estar vacía');
  } else if (rawInput.length > 256) {
    errors.push('Longitud máxima de contraseña superada (256 caracteres)');
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? rawInput : null,
    errors
  };
}

function validateExposureMetricsContract(rawInput) {
  const raw = (typeof rawInput === 'object' && rawInput !== null ? rawInput : {});
  const score = clampNumber(raw.score, 15, 0, 100);

  let riskLevel = 'Bajo';
  let riskColor = '#10B981';
  if (score >= 65) {
    riskLevel = 'Crítico';
    riskColor = '#EF4444';
  } else if (score >= 35) {
    riskLevel = 'Moderado';
    riskColor = '#F59E0B';
  }

  return {
    valid: true,
    data: {
      score,
      riskLevel,
      riskColor,
      activeBreaches: clampNumber(raw.activeBreaches, 0, 0, 10000),
      monitoredIdentities: clampNumber(raw.monitoredIdentities, 0, 0, 10000)
    },
    errors: []
  };
}

// Exportación universal
if (typeof window !== 'undefined') {
  window.validateContract = validateContract;
  window.validateIdentityContract = validateIdentityContract;
  window.validateGdprRequestContract = validateGdprRequestContract;
  window.validatePasswordAuditContract = validatePasswordAuditContract;
  window.validateExposureMetricsContract = validateExposureMetricsContract;
  window.sanitizeString = sanitizeString;
  window.clampNumber = clampNumber;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateContract,
    validateIdentityContract,
    validateGdprRequestContract,
    validatePasswordAuditContract,
    validateExposureMetricsContract,
    sanitizeString,
    clampNumber
  };
}
