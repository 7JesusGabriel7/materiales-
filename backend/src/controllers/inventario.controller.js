const inventarioService = require('../services/inventario.service');
const { asyncHandler } = require('../middlewares/errorHandler');

const obtenerResumen = asyncHandler(async (req, res) => {
  const resumen = await inventarioService.obtenerResumenInventario();
  res.json({ ok: true, resumen });
});

const listarBajoStock = asyncHandler(async (req, res) => {
  const productos = await inventarioService.listarProductosBajoStock();
  res.json({ ok: true, productos });
});

const listarMovimientos = asyncHandler(async (req, res) => {
  const resultado = await inventarioService.listarMovimientos(req.query);
  res.json({ ok: true, ...resultado });
});

const registrarMovimiento = asyncHandler(async (req, res) => {
  const resultado = await inventarioService.registrarMovimiento(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: 'Movimiento de inventario registrado correctamente.',
    ...resultado
  });
});

module.exports = {
  obtenerResumen,
  listarBajoStock,
  listarMovimientos,
  registrarMovimiento
};

