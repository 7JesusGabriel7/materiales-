const presupuestosService = require('../services/presupuestos.service');
const pdfService = require('../services/pdf.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const crear = asyncHandler(async (req, res) => {
  const resultado = await presupuestosService.crearPresupuesto(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: `Presupuesto ${resultado.presupuesto.folio} guardado correctamente (no contabilizado como venta).`,
    ...resultado
  });
});

const listar = asyncHandler(async (req, res) => {
  const resultado = await presupuestosService.listarPresupuestos(req.query);
  res.json({ ok: true, ...resultado });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await presupuestosService.obtenerPresupuestoPorId(id);
  res.json({ ok: true, ...resultado });
});

const descargarPdf = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await presupuestosService.obtenerPresupuestoPorId(id);
  const buffer = await pdfService.generarPdfPresupuesto(resultado);
  const folioSeguro = String(resultado.presupuesto.folio || id).replace(
    /[^A-Za-z0-9_-]/g,
    ''
  );
  const disposicion = req.query.modo === 'ver' ? 'inline' : 'attachment';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposicion}; filename="Presupuesto-${folioSeguro}.pdf"`
  );
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await presupuestosService.cambiarEstadoPresupuesto(
    id,
    req.body?.estado
  );
  res.json({
    ok: true,
    mensaje: 'Estado del presupuesto actualizado correctamente.',
    ...resultado
  });
});

const eliminar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  await presupuestosService.eliminarPresupuesto(id);
  res.json({
    ok: true,
    mensaje: 'Presupuesto eliminado correctamente.'
  });
});

module.exports = {
  crear,
  listar,
  obtener,
  descargarPdf,
  cambiarEstado,
  eliminar
};

