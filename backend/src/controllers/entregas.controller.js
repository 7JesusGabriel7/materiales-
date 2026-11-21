const entregasService = require('../services/entregas.service');
const pdfService = require('../services/pdf.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const resumen = asyncHandler(async (req, res) => {
  const datos = await entregasService.obtenerResumenEntregas();
  res.json({ ok: true, resumen: datos });
});

const listar = asyncHandler(async (req, res) => {
  const resultado = await entregasService.listarEntregas(req.query);
  res.json({ ok: true, ...resultado });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await entregasService.obtenerEntregaPorId(id);
  res.json({ ok: true, ...resultado });
});

const descargarPdf = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await entregasService.obtenerEntregaPorId(id);
  const buffer = await pdfService.generarPdfNotaVenta(resultado);
  const folioSeguro = String(resultado.venta?.folio || id).replace(
    /[^A-Za-z0-9_-]/g,
    ''
  );
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

const actualizar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await entregasService.actualizarEntrega(id, req.body || {});
  res.json({
    ok: true,
    mensaje: 'Entrega programada y nota de venta actualizadas correctamente.',
    ...resultado
  });
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await entregasService.cambiarEstadoEntrega(id, req.body?.estado);
  res.json({
    ok: true,
    mensaje:
      resultado.entrega.estado === 'ENTREGADO'
        ? 'Entrega marcada como ENTREGADA.'
        : 'Entrega marcada nuevamente como PENDIENTE.',
    ...resultado
  });
});

module.exports = {
  resumen,
  listar,
  obtener,
  descargarPdf,
  actualizar,
  cambiarEstado
};

