const { AppError } = require('../middlewares/errorHandler');
const { esFechaIsoValida } = require('./formatters');

/**
 * Construye de forma segura la condicion WHERE de fecha para consultas sobre ventas.
 */
function construirFiltroFechaVentas({ filtro, fecha, fechaInicio, fechaFin }, alias = 'v') {
  const tipo = String(filtro || 'todas').trim().toLowerCase();

  switch (tipo) {
    case 'todas':
    case '':
      return { sql: null, params: [] };
    case 'hoy':
      return { sql: `DATE(${alias}.fecha_venta) = CURDATE()`, params: [] };
    case 'ayer':
      return {
        sql: `DATE(${alias}.fecha_venta) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
        params: []
      };
    case 'semana':
      return {
        sql: `YEARWEEK(${alias}.fecha_venta, 1) = YEARWEEK(CURDATE(), 1)`,
        params: []
      };
    case 'mes':
      return {
        sql: `YEAR(${alias}.fecha_venta) = YEAR(CURDATE()) AND MONTH(${alias}.fecha_venta) = MONTH(CURDATE())`,
        params: []
      };
    case 'fecha': {
      if (!esFechaIsoValida(fecha)) {
        throw new AppError('Debe proporcionar una fecha valida con formato AAAA-MM-DD.', 400);
      }
      return { sql: `DATE(${alias}.fecha_venta) = ?`, params: [fecha] };
    }
    case 'rango': {
      if (!esFechaIsoValida(fechaInicio) || !esFechaIsoValida(fechaFin)) {
        throw new AppError(
          'Debe proporcionar fecha_inicio y fecha_fin validas con formato AAAA-MM-DD.',
          400
        );
      }
      if (fechaInicio > fechaFin) {
        throw new AppError(
          'La fecha inicial no puede ser posterior a la fecha final.',
          400
        );
      }
      return {
        sql: `DATE(${alias}.fecha_venta) BETWEEN ? AND ?`,
        params: [fechaInicio, fechaFin]
      };
    }
    default:
      throw new AppError(`Filtro de fecha no reconocido: ${filtro}`, 400);
  }
}

module.exports = {
  construirFiltroFechaVentas
};

