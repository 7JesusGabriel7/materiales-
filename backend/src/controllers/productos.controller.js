const productosService = require('../services/productos.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const listar = asyncHandler(async (req, res) => {
  const productos = await productosService.listarProductos(req.query);
  res.json({ ok: true, productos });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const producto = await productosService.obtenerProductoPorId(id);
  res.json({ ok: true, producto });
});

const crear = asyncHandler(async (req, res) => {
  const producto = await productosService.crearProducto(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: 'Producto registrado correctamente.',
    producto
  });
});

const actualizar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const producto = await productosService.actualizarProducto(id, req.body || {});
  res.json({
    ok: true,
    mensaje: 'Producto actualizado correctamente.',
    producto
  });
});

const eliminar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await productosService.eliminarProducto(id);
  res.json({ ok: true, ...resultado });
});

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};

