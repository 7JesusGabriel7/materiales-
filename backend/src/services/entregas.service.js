const { pool, conTransaccion } = require('../config/database');
const configuracionService = require('./configuracion.service');
const { AppError } = require('../middlewares/errorHandler');
const { requerirTexto, textoOpcional } = require('../middlewares/validate');
const { esFechaIsoValida } = require('../utils/formatters');

const ESTADOS_ENTREGA = ['PENDIENTE', 'ENTREGADO'];

function construirFiltroFechaEntregas({ filtroFecha, fecha, fechaInicio, fechaFin }) {
  const tipo = String(filtroFecha || 'todas').trim().toLowerCase();

  switch (tipo) {
    case 'todas':
    case '':
      return { sql: null, params: [] };
    case 'hoy':
      return { sql: 'e.fecha_entrega = CURDATE()', params: [] };
    case 'manana':
      return {
        sql: 'e.fecha_entrega = DATE_ADD(CURDATE(), INTERVAL 1 DAY)',
        params: []
      };
    case 'atrasadas':
      return {
        sql: "e.fecha_entrega < CURDATE() AND e.estado = 'PENDIENTE'",
        params: []
      };
    case 'semana':
      return {
        sql: 'YEARWEEK(e.fecha_entrega, 1) = YEARWEEK(CURDATE(), 1)',
        params: []
      };
    case 'fecha': {
      if (!esFechaIsoValida(fecha)) {
        throw new AppError('Debe indicar una fecha valida con formato AAAA-MM-DD.', 400);
      }
      return { sql: 'e.fecha_entrega = ?', params: [fecha] };
    }
    case 'rango': {
      if (!esFechaIsoValida(fechaInicio) || !esFechaIsoValida(fechaFin)) {
        throw new AppError(
          'Debe indicar fecha_inicio y fecha_fin validas con formato AAAA-MM-DD.',
          400
        );
      }
      if (fechaInicio > fechaFin) {
        throw new AppError(
          'La fecha inicial no puede ser posterior a la fecha final.',
          400
        );
      }
      return { sql: 'e.fecha_entrega BETWEEN ? AND ?', params: [fechaInicio, fechaFin] };
    }
    default:
      throw new AppError(`Filtro de fecha de entrega no valido: ${filtroFecha}`, 400);
  }
}

async function obtenerResumenEntregas() {
  const [rows] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' AND fecha_entrega = CURDATE() THEN 1 ELSE 0 END), 0) AS pendientes_hoy,
      COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' AND fecha_entrega < CURDATE() THEN 1 ELSE 0 END), 0) AS pendientes_atrasadas,
      COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END), 0) AS total_pendientes,
      COALESCE(SUM(CASE WHEN estado = 'ENTREGADO' AND DATE(fecha_entregado) = CURDATE() THEN 1 ELSE 0 END), 0) AS entregadas_hoy,
      COUNT(*) AS total_entregas
    FROM entregas_programadas`
  );
  return rows[0];
}

async function listarEntregas(filtros = {}) {
  const condiciones = ['1 = 1'];
  const params = [];

  if (filtros.estado && String(filtros.estado).trim() !== '' && filtros.estado !== 'todas') {
    const estado = String(filtros.estado).trim().toUpperCase();
    if (!ESTADOS_ENTREGA.includes(estado)) {
      throw new AppError(`Estado de entrega no valido: ${estado}`, 400);
    }
    condiciones.push('e.estado = ?');
    params.push(estado);
  }

  const filtroFecha = construirFiltroFechaEntregas({
    filtroFecha: filtros.filtro_fecha,
    fecha: filtros.fecha,
    fechaInicio: filtros.fecha_inicio,
    fechaFin: filtros.fecha_fin
  });

  if (filtroFecha.sql) {
    condiciones.push(filtroFecha.sql);
    params.push(...filtroFecha.params);
  }

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push(
      `(e.cliente_nombre LIKE ? OR COALESCE(e.cliente_telefono, '') LIKE ? OR COALESCE(e.direccion_entrega, '') LIKE ? OR COALESCE(e.referencias, '') LIKE ? OR COALESCE(e.nota_entrega, '') LIKE ? OR v.folio LIKE ?)`
    );
    params.push(termino, termino, termino, termino, termino, termino);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(200, Math.max(1, Number.parseInt(filtros.limite, 10) || 50));
  const offset = (pagina - 1) * limite;
  const whereSql = condiciones.join(' AND ');

  const [conteoRows] = await pool.query(
    `SELECT COUNT(*) AS total
    FROM entregas_programadas e
    INNER JOIN ventas v ON v.id = e.venta_id
    WHERE ${whereSql}`,
    params
  );
  const total = conteoRows[0].total;

  const [entregas] = await pool.query(
    `SELECT
      e.*,
      v.folio AS venta_folio,
      v.fecha_venta AS venta_fecha,
      v.total AS venta_total,
      v.cantidad_productos AS venta_cantidad_productos,
      v.dinero_recibido AS venta_dinero_recibido,
      v.cambio AS venta_cambio
    FROM entregas_programadas e
    INNER JOIN ventas v ON v.id = e.venta_id
    WHERE ${whereSql}
    ORDER BY (e.estado = 'PENDIENTE') DESC, e.fecha_entrega ASC, e.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  return {
    entregas,
    paginacion: {
      total,
      pagina,
      limite,
      total_paginas: Math.max(1, Math.ceil(total / limite))
    }
  };
}

async function obtenerEntregaPorId(id) {
  const [rows] = await pool.query(
    'SELECT * FROM entregas_programadas WHERE id = ?',
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Entrega programada no encontrada.', 404);
  }

  const entrega = rows[0];
  const [ventaRows] = await pool.query('SELECT * FROM ventas WHERE id = ?', [
    entrega.venta_id
  ]);
  const [detalleRows] = await pool.query(
    'SELECT * FROM detalle_ventas WHERE venta_id = ? ORDER BY id ASC',
    [entrega.venta_id]
  );
  const [pagosRows] = await pool.query(
    'SELECT * FROM pagos_venta WHERE venta_id = ? ORDER BY fecha_pago ASC, id ASC',
    [entrega.venta_id]
  );
  const negocio = await configuracionService.obtenerConfiguracionNegocio();

  return {
    entrega,
    venta: ventaRows[0],
    detalle: detalleRows,
    pagos: pagosRows,
    negocio
  };
}

async function actualizarEntrega(id, datos = {}) {
  const clienteNombre = requerirTexto(datos.cliente_nombre, 'cliente_nombre', {
    min: 2,
    max: 150
  });
  const fechaEntrega = String(datos.fecha_entrega || '').trim();
  if (!esFechaIsoValida(fechaEntrega)) {
    throw new AppError('Debe indicar una fecha de entrega valida (AAAA-MM-DD).', 400);
  }

  const clienteTelefono = textoOpcional(datos.cliente_telefono, 60);
  const direccionEntrega = textoOpcional(datos.direccion_entrega, 255);
  const referencias = textoOpcional(datos.referencias, 255);
  const horarioEntrega = textoOpcional(datos.horario_entrega, 80);
  const notaEntrega = textoOpcional(datos.nota_entrega, 2000);

  const estadoNuevo = datos.estado
    ? String(datos.estado).trim().toUpperCase()
    : null;
  if (estadoNuevo && !ESTADOS_ENTREGA.includes(estadoNuevo)) {
    throw new AppError('El estado de entrega debe ser PENDIENTE o ENTREGADO.', 400);
  }

  await conTransaccion(async (conexion) => {
    const [filas] = await conexion.query(
      'SELECT * FROM entregas_programadas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (filas.length === 0) {
      throw new AppError('Entrega programada no encontrada.', 404);
    }
    const actual = filas[0];
    const estadoFinal = estadoNuevo || actual.estado;

    let clausulaFechaEntregado = 'fecha_entregado = NULL';
    if (estadoFinal === 'ENTREGADO') {
      clausulaFechaEntregado =
        actual.estado === 'ENTREGADO' && actual.fecha_entregado
          ? 'fecha_entregado = fecha_entregado'
          : 'fecha_entregado = NOW()';
    }

    await conexion.query(
      `UPDATE entregas_programadas
      SET
        cliente_nombre = ?,
        cliente_telefono = ?,
        direccion_entrega = ?,
        referencias = ?,
        fecha_entrega = ?,
        horario_entrega = ?,
        nota_entrega = ?,
        estado = ?,
        ${clausulaFechaEntregado}
      WHERE id = ?`,
      [
        clienteNombre,
        clienteTelefono,
        direccionEntrega,
        referencias,
        fechaEntrega,
        horarioEntrega,
        notaEntrega,
        estadoFinal,
        id
      ]
    );

    await conexion.query(
      `UPDATE ventas
      SET
        cliente_nombre = ?,
        cliente_telefono = ?,
        cliente_direccion = ?,
        nota_venta = ?
      WHERE id = ?`,
      [clienteNombre, clienteTelefono, direccionEntrega, notaEntrega, actual.venta_id]
    );

    if (datos.actualizar_cliente && actual.cliente_id) {
      await conexion.query(
        `UPDATE clientes
        SET
          nombre = ?,
          telefono = ?,
          direccion = ?,
          referencias = ?
        WHERE id = ?`,
        [clienteNombre, clienteTelefono, direccionEntrega, referencias, actual.cliente_id]
      );
    }
  });

  return obtenerEntregaPorId(id);
}

async function cambiarEstadoEntrega(id, estadoRaw) {
  const estado = String(estadoRaw || '').trim().toUpperCase();
  if (!ESTADOS_ENTREGA.includes(estado)) {
    throw new AppError('El estado de entrega debe ser PENDIENTE o ENTREGADO.', 400);
  }

  const [filas] = await pool.query(
    'SELECT id FROM entregas_programadas WHERE id = ?',
    [id]
  );
  if (filas.length === 0) {
    throw new AppError('Entrega programada no encontrada.', 404);
  }

  if (estado === 'ENTREGADO') {
    await pool.query(
      "UPDATE entregas_programadas SET estado = 'ENTREGADO', fecha_entregado = NOW() WHERE id = ?",
      [id]
    );
  } else {
    await pool.query(
      "UPDATE entregas_programadas SET estado = 'PENDIENTE', fecha_entregado = NULL WHERE id = ?",
      [id]
    );
  }

  return obtenerEntregaPorId(id);
}

module.exports = {
  obtenerResumenEntregas,
  listarEntregas,
  obtenerEntregaPorId,
  actualizarEntrega,
  cambiarEstadoEntrega
};

