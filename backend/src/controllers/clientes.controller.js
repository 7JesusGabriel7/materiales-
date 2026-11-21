const clientesService = require('../services/clientes.service');
const { asyncHandler } = require('../middlewares/errorHandler');
const { parsearEnteroPositivo } = require('../middlewares/validate');

const listar = asyncHandler(async (req, res) => {
  const clientes = await clientesService.listarClientes(req.query);
  res.json({ ok: true, clientes });
});

const obtener = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const cliente = await clientesService.obtenerClientePorId(id);
  res.json({ ok: true, cliente });
});

const crear = asyncHandler(async (req, res) => {
  const cliente = await clientesService.crearCliente(req.body || {});
  res.status(201).json({
    ok: true,
    mensaje: 'Cliente registrado correctamente.',
    cliente
  });
});

const actualizar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const cliente = await clientesService.actualizarCliente(id, req.body || {});
  res.json({
    ok: true,
    mensaje: 'Cliente actualizado correctamente.',
    cliente
  });
});

const eliminar = asyncHandler(async (req, res) => {
  const id = parsearEnteroPositivo(req.params.id, 'id');
  const resultado = await clientesService.eliminarCliente(id);
  res.json({ ok: true, ...resultado });
});

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};

