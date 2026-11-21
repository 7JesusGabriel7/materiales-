const env = require('../config/env');
const { pool } = require('../config/database');
const configuracionService = require('../services/configuracion.service');
const { asyncHandler } = require('../middlewares/errorHandler');

const obtenerSalud = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT NOW() AS hora_servidor, DATABASE() AS base_datos'
  );
  res.json({
    ok: true,
    estado: 'disponible',
    servicio: 'pos-casa-materiales-backend',
    hora_servidor: rows[0].hora_servidor,
    base_datos: rows[0].base_datos
  });
});

const obtenerConfiguracion = asyncHandler(async (req, res) => {
  const negocio = await configuracionService.obtenerConfiguracionNegocio();
  res.json({
    ok: true,
    negocio,
    unidades_medida: env.UNIDADES_MEDIDA,
    tipos_movimiento: env.TIPOS_MOVIMIENTO
  });
});

const actualizarConfiguracion = asyncHandler(async (req, res) => {
  const negocio = await configuracionService.actualizarConfiguracionNegocio(
    req.body || {}
  );
  res.json({
    ok: true,
    mensaje: 'Datos del establecimiento actualizados correctamente.',
    negocio
  });
});

module.exports = {
  obtenerSalud,
  obtenerConfiguracion,
  actualizarConfiguracion
};
