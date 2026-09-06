const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { calculateExposureScore } = require('./hibpService');

/**
 * Genera un Reporte Ejecutivo de Huella Digital y Soberanía de Datos en formato PDF.
 * Retorna un Stream legible listo para enviar en la respuesta HTTP.
 */
function generateFootprintPdf(userId) {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    info: {
      Title: 'Informe Ejecutivo de Huella Digital — SENTINEL',
      Author: 'SENTINEL Privacy Engine',
      Subject: 'Auditoría de Ciberseguridad Personal y Ejercicio del Derecho al Olvido'
    }
  });

  // Datos del usuario y métricas
  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]) || {
    display_name: 'Mauro (Arconte Soberano)',
    email: 'guardian@sentinel.privacy'
  };

  const identities = db.all(`
    SELECT i.*,
      (SELECT COUNT(*) FROM breaches b WHERE b.identity_id = i.id) AS breach_count
    FROM identities i
    WHERE i.user_id = ? AND i.active = 1
  `, [userId]);

  const breaches = db.all(`
    SELECT b.*, i.value as identity_value
    FROM breaches b
    JOIN identities i ON b.identity_id = i.id
    WHERE i.user_id = ? AND i.active = 1
    ORDER BY b.detected_at DESC
  `, [userId]);

  const rawRequests = db.all(`
    SELECT r.*, p.name as platform_name, p.category as platform_category, p.deletion_method
    FROM deletion_requests r
    JOIN platforms p ON r.platform_id = p.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `, [userId]);

  const requests = rawRequests.map(r => {
    const sentTime = r.sent_at ? new Date(r.sent_at).getTime() : new Date(r.created_at).getTime();
    const deadlineDate = new Date(sentTime + (30 * 24 * 60 * 60 * 1000));
    const daysRemaining = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      ...r,
      daysRemaining: r.status === 'completed' ? 0 : daysRemaining,
      isOverdue: r.status !== 'completed' && daysRemaining < 0
    };
  });

  const completedDeletions = requests.filter(r => r.status === 'completed').length;
  const verifiedIdentities = identities.filter(i => i.verified === 1).length;

  const exposureScore = calculateExposureScore({
    breachCount: breaches.length,
    platformsCount: Math.min(requests.length + 8, 15),
    completedDeletions,
    verifiedIdentities
  });

  // === ESTILOS Y COLORES (Cyber-Obsidian Theme) ===
  const primaryColor = '#2563EB'; // Royal Blue
  const darkBg = '#0B111E';
  const textDark = '#1E293B';
  const textMuted = '#64748B';
  const alertRed = '#EF4444';
  const successGreen = '#10B981';

  // 1. ENCABEZADO EJECUTIVO
  doc.rect(0, 0, doc.page.width, 100).fill(darkBg);

  doc.fillColor('#00E5FF')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('SENTINEL', 50, 30);

  doc.fillColor('#94A3B8')
    .fontSize(10)
    .font('Helvetica')
    .text('ORQUESTADOR DE PRIVACIDAD & SOBERANÍA DIGITAL', 50, 56);

  doc.fillColor('#F8FAFC')
    .fontSize(9)
    .font('Helvetica')
    .text(`EMISIÓN: ${new Date().toLocaleDateString('es-ES')} | CLASIFICACIÓN: CONFIDENCIAL`, doc.page.width - 320, 35, { align: 'right' });

  doc.fillColor('#38BDF8')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`TITULAR: ${user.display_name} (${user.email})`, doc.page.width - 320, 50, { align: 'right' });

  doc.moveDown(4);

  // 2. RESUMEN DEL ÍNDICE DE EXPOSICIÓN
  const startY = 120;
  doc.roundedRect(50, startY, doc.page.width - 100, 85, 8).fillAndStroke('#F1F5F9', '#CBD5E1');

  doc.fillColor(textDark)
    .fontSize(13)
    .font('Helvetica-Bold')
    .text('DIAGNÓSTICO DE EXPOSICIÓN CIBERNÉTICA', 70, startY + 16);

  let riskLabel = 'BAJO';
  let riskColor = successGreen;
  if (exposureScore >= 65) {
    riskLabel = 'CRÍTICO';
    riskColor = alertRed;
  } else if (exposureScore >= 35) {
    riskLabel = 'MODERADO';
    riskColor = '#F59E0B';
  }

  doc.fillColor(riskColor)
    .fontSize(28)
    .font('Helvetica-Bold')
    .text(`${exposureScore}`, 70, startY + 38);

  doc.fillColor(textMuted)
    .fontSize(11)
    .font('Helvetica')
    .text('/ 100', 125, startY + 50);

  doc.fillColor(riskColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`NIVEL DE RIESGO: ${riskLabel}`, 170, startY + 44);

  doc.fillColor(textMuted)
    .fontSize(9)
    .font('Helvetica')
    .text(`Identidades activas: ${identities.length}  |  Brechas públicas: ${breaches.length}  |  Borrados completados: ${completedDeletions}`, 170, startY + 60);

  // 3. IDENTIDADES MONITOREADAS
  let currentY = startY + 110;
  doc.fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('1. IDENTIDADES MONITOREADAS (SUPERFICIE DE CONTACTO)', 50, currentY);

  currentY += 20;
  if (identities.length === 0) {
    doc.fillColor(textMuted).fontSize(10).font('Helvetica').text('No se han registrado identidades adicionales.', 50, currentY);
    currentY += 20;
  } else {
    identities.forEach(id => {
      const statusText = id.breach_count > 0 ? `⚠️ ${id.breach_count} Brechas detectadas` : '✓ Protegido';
      doc.fillColor(textDark).fontSize(10).font('Helvetica-Bold').text(`• [${id.type.toUpperCase()}] ${id.value}`, 60, currentY);
      doc.fillColor(id.breach_count > 0 ? alertRed : successGreen).font('Helvetica').text(statusText, 380, currentY);
      currentY += 16;
    });
  }

  // 4. HISTORIAL DE FILTRACIONES
  currentY += 15;
  doc.fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('2. REGISTRO DE FILTRACIONES PÚBLICAS & STEALER LOGS', 50, currentY);

  currentY += 20;
  if (breaches.length === 0) {
    doc.fillColor(successGreen).fontSize(10).font('Helvetica').text('✓ Cero filtraciones detectadas en bases de datos públicas históricas.', 50, currentY);
    currentY += 20;
  } else {
    breaches.slice(0, 5).forEach(b => {
      doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold').text(`Incidente: ${b.breach_title || b.breach_name} (${b.breach_date || 'Fecha no especificada'})`, 60, currentY);
      doc.fillColor(textMuted).fontSize(8).font('Helvetica').text(`Identidad afectada: ${b.identity_value} | Datos expuestos: ${b.compromised_data || 'Credenciales'}`, 60, currentY + 12);
      currentY += 28;
    });
  }

  // 5. MOTOR DE ELIMINACIÓN RGPD (PLAZO LEGAL DE 30 DÍAS)
  currentY += 15;
  doc.fillColor(primaryColor)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('3. TRAZABILIDAD DE SOLICITUDES DE BORRADO (ART. 17 RGPD)', 50, currentY);

  currentY += 20;
  if (requests.length === 0) {
    doc.fillColor(textMuted).fontSize(10).font('Helvetica').text('No se han tramitado solicitudes de borrado aún.', 50, currentY);
    currentY += 20;
  } else {
    requests.forEach(r => {
      let deadlineMsg = '';
      let deadlineColor = successGreen;
      if (r.status === 'completed') {
        deadlineMsg = '✓ Supresión completada';
        deadlineColor = successGreen;
      } else if (r.isOverdue) {
        deadlineMsg = `🚨 Plazo vencido (${Math.abs(r.daysRemaining)}d excedidos - Art. 12 RGPD)`;
        deadlineColor = alertRed;
      } else {
        deadlineMsg = `⏳ ${r.daysRemaining} días restantes (Plazo 30d)`;
        deadlineColor = r.daysRemaining <= 5 ? alertRed : '#F59E0B';
      }

      doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold').text(`• ${r.platform_name} [${r.platform_category}]`, 60, currentY);
      doc.fillColor(deadlineColor).fontSize(9).font('Helvetica').text(deadlineMsg, 300, currentY);
      currentY += 16;
    });
  }

  // 6. PIE DE PÁGINA & RECOMENDACIONES
  currentY += 25;
  if (currentY > doc.page.height - 130) {
    doc.addPage();
    currentY = 60;
  }

  doc.roundedRect(50, currentY, doc.page.width - 100, 65, 6).fill('#F8FAFC');
  doc.fillColor(textDark)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('RECOMENDACIONES PREVENTIVAS DE SEGURIDAD', 65, currentY + 12);

  doc.fillColor(textMuted)
    .fontSize(8)
    .font('Helvetica')
    .text('1. Habilitar llaves de seguridad física o 2FA en los servicios críticos.', 65, currentY + 28)
    .text('2. Exigir confirmación legal por escrito a aquellas plataformas con plazo de 30 días vencido.', 65, currentY + 40);

  // Disclaimer legal
  doc.fillColor('#94A3B8')
    .fontSize(7)
    .font('Helvetica-Oblique')
    .text('Documento emitido de forma automatizada por SENTINEL Privacy Suite. Las solicitudes se amparan en el Reglamento General de Protección de Datos (UE 2016/679) y normativas homólogas de soberanía digital.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

  doc.end();
  return doc;
}

module.exports = { generateFootprintPdf };

