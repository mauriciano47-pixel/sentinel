const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateFootprintPdf } = require('../services/reportService');

// GET /api/v1/reports/footprint-pdf - Descargar Informe Ejecutivo de Huella Digital
router.get('/footprint-pdf', authenticate, (req, res) => {
  try {
    const filename = `sentinel-reporte-huella-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = generateFootprintPdf(req.user.id);
    doc.pipe(res);
  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).json({ error: 'Error al compilar reporte PDF', details: err.message });
  }
});

module.exports = router;

