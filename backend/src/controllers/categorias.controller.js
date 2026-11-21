const categoriasService = require('../services/categorias.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const listar = asyncHandler(async (req, res) => {
  const categorias = await categoriasService.listarCategorias();
  res.json({ ok: true, categorias });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const categoria = await categoriasService.obtenerCategoriaPorId(id);
  res.json({ ok: true, categoria });
});

const crear = asyncHandler(async (req, res) => {
  const categoria = await categoriasService.crearCategoria(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: 'Categoria registrada correctamente.',
    categoria
  });
});

const actualizar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const categoria = await categoriasService.actualizarCategoria(id, req.body || {});
  res.json({
    ok: true,
    mensaje: 'Categoria actualizada correctamente.',
    categoria
  });
});

const eliminar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  await categoriasService.eliminarCategoria(id);
  res.json({
    ok: true,
    mensaje: 'Categoria eliminada correctamente.'
  });
});

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};

