const ventasService = require('../services/ventas.service');
const pdfService = require('../services/pdf.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const crear = asyncHandler(async (req, res) => {
  const resultado = await ventasService.registrarVenta(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: `Venta ${resultado.venta.folio} registrada correctamente.`,
    ...resultado
  });
});

const resumen = asyncHandler(async (req, res) => {
  const datosResumen = await ventasService.obtenerResumenVentas();
  res.json({ ok: true, resumen: datosResumen });
});

const listar = asyncHandler(async (req, res) => {
  const resultado = await ventasService.listarVentas(req.query);
  res.json({ ok: true, ...resultado });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await ventasService.obtenerVentaPorId(id);
  res.json({ ok: true, ...resultado });
});

const resumenPorCobrar = asyncHandler(async (req, res) => {
  const resumenDatos = await ventasService.obtenerResumenPorCobrar();
  res.json({ ok: true, resumen: resumenDatos });
});

const listarPorCobrar = asyncHandler(async (req, res) => {
  const resultado = await ventasService.listarCuentasPorCobrar(req.query);
  res.json({ ok: true, ...resultado });
});

const asignarNombre = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await ventasService.asignarNombreVenta(id, req.body || {});
  res.json({
    ok: true,
    mensaje: `Nombre asignado correctamente a la nota ${resultado.venta.folio}.`,
    ...resultado
  });
});

const registrarAbono = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await ventasService.registrarAbonoVenta(id, req.body || {});
  const mensaje =
    resultado.venta.estado_pago === 'PAGADA'
      ? `Nota ${resultado.venta.folio} liquidada en su totalidad.`
      : `Abono registrado. Saldo pendiente: $${Number(resultado.venta.saldo_pendiente).toFixed(2)}.`;
  res.status(201).json({
    ok: true,
    mensaje,
    ...resultado
  });
});

const descargarPdf = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await ventasService.obtenerVentaPorId(id);
  const buffer = await pdfService.generarPdfNotaVenta(resultado);
  const folioSeguro = String(resultado.venta.folio || id).replace(/[^A-Za-z0-9_-]/g, '');
  const disposicion = req.query.modo === 'ver' ? 'inline' : 'attachment';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposicion}; filename="Nota-${folioSeguro}.pdf"`
  );
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

module.exports = {
  crear,
  resumen,
  listar,
  obtener,
  resumenPorCobrar,
  listarPorCobrar,
  asignarNombre,
  registrarAbono,
  descargarPdf
};

