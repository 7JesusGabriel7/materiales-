const { pool, conTransaccion } = require('../config/database');
const configuracionService = require('./configuracion.service');
const { AppError } = require('../middlewares/errorHandler');
const {
  parsearEnteroPositivo,
  parsearDecimalPositivo,
  textoOpcional
} = require('../middlewares/validate');
const {
  redondearMoneda,
  redondearCantidad,
  generarFolio,
  esFechaIsoValida
} = require('../utils/formatters');

const ESTADOS_PRESUPUESTO = ['VIGENTE', 'CONVERTIDO', 'CANCELADO'];

function consolidarItemsPresupuesto(itemsRaw) {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new AppError('Debe agregar al menos un producto para guardar el presupuesto.', 400);
  }

  const mapa = new Map();
  for (const item of itemsRaw) {
    const productoId = parsearEnteroPositivo(item?.producto_id, 'producto_id');
    const cantidad = parsearDecimalPositivo(item?.cantidad, 'cantidad', 3);
    if (cantidad < 1) {
      throw new AppError('La cantidad minima por producto en un presupuesto es 1.', 400);
    }
    const acumulado = mapa.get(productoId) || 0;
    mapa.set(productoId, redondearCantidad(acumulado + cantidad));
  }

  return Array.from(mapa.entries()).map(([producto_id, cantidad]) => ({
    producto_id,
    cantidad
  }));
}

async function crearPresupuesto(datos = {}) {
  const itemsSolicitados = consolidarItemsPresupuesto(datos.items);
  const clienteId =
    datos.cliente_id !== undefined && datos.cliente_id !== null && datos.cliente_id !== ''
      ? parsearEnteroPositivo(datos.cliente_id, 'cliente_id')
      : null;

  let clienteNombre = textoOpcional(datos.cliente_nombre, 150);
  let clienteTelefono = textoOpcional(datos.cliente_telefono, 60);
  let clienteDireccion = textoOpcional(datos.cliente_direccion, 255);
  const notas = textoOpcional(datos.notas, 2000);

  return conTransaccion(async (conexion) => {
    if (clienteId) {
      const [clientes] = await conexion.query(
        'SELECT id, nombre, telefono, direccion FROM clientes WHERE id = ? AND activo = 1 LIMIT 1',
        [clienteId]
      );
      if (clientes.length === 0) {
        throw new AppError('El cliente seleccionado no existe.', 404);
      }
      if (!clienteNombre) {
        clienteNombre = clientes[0].nombre;
      }
      if (!clienteTelefono) {
        clienteTelefono = clientes[0].telefono;
      }
      if (!clienteDireccion) {
        clienteDireccion = clientes[0].direccion;
      }
    }

    const idsProductos = itemsSolicitados.map((item) => item.producto_id);
    const marcadores = idsProductos.map(() => '?').join(', ');

    const [productosDb] = await conexion.query(
      `SELECT id, codigo, nombre, precio_venta, unidad_medida
      FROM productos
      WHERE id IN (${marcadores}) AND activo = 1`,
      idsProductos
    );

    const mapaProductos = new Map(productosDb.map((p) => [p.id, p]));
    for (const solicitado of itemsSolicitados) {
      if (!mapaProductos.has(solicitado.producto_id)) {
        throw new AppError(
          `El producto con ID ${solicitado.producto_id} no existe o fue dado de baja.`,
          404
        );
      }
    }

    const lineas = [];
    let subtotal = 0;
    let totalUnidades = 0;

    for (const solicitado of itemsSolicitados) {
      const producto = mapaProductos.get(solicitado.producto_id);
      const precioUnitario = redondearMoneda(producto.precio_venta);
      const importe = redondearMoneda(solicitado.cantidad * precioUnitario);
      subtotal = redondearMoneda(subtotal + importe);
      totalUnidades = redondearCantidad(totalUnidades + solicitado.cantidad);

      lineas.push({
        producto_id: producto.id,
        producto_codigo: producto.codigo,
        producto_nombre: producto.nombre,
        unidad_medida: producto.unidad_medida,
        cantidad: solicitado.cantidad,
        precio_unitario: precioUnitario,
        importe
      });
    }

    const total = subtotal;
    const folioTemporal = `TMP-PRE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [insertRes] = await conexion.query(
      `INSERT INTO presupuestos (
        folio,
        cliente_id,
        cliente_nombre,
        cliente_telefono,
        cliente_direccion,
        notas,
        cantidad_productos,
        total_unidades,
        subtotal,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VIGENTE')`,
      [
        folioTemporal,
        clienteId,
        clienteNombre,
        clienteTelefono,
        clienteDireccion,
        notas,
        lineas.length,
        totalUnidades,
        subtotal,
        total
      ]
    );

    const presupuestoId = insertRes.insertId;
    const [fechaRows] = await conexion.query(
      'SELECT fecha_presupuesto FROM presupuestos WHERE id = ?',
      [presupuestoId]
    );
    const folioFinal = generarFolio(presupuestoId, fechaRows[0].fecha_presupuesto, 'PRE');

    await conexion.query('UPDATE presupuestos SET folio = ? WHERE id = ?', [
      folioFinal,
      presupuestoId
    ]);

    for (const linea of lineas) {
      await conexion.query(
        `INSERT INTO detalle_presupuestos (
          presupuesto_id,
          producto_id,
          producto_codigo,
          producto_nombre,
          unidad_medida,
          cantidad,
          precio_unitario,
          importe
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          presupuestoId,
          linea.producto_id,
          linea.producto_codigo,
          linea.producto_nombre,
          linea.unidad_medida,
          linea.cantidad,
          linea.precio_unitario,
          linea.importe
        ]
      );
    }

    const [presupuestoRows] = await conexion.query(
      'SELECT * FROM presupuestos WHERE id = ?',
      [presupuestoId]
    );
    const [detalleRows] = await conexion.query(
      'SELECT * FROM detalle_presupuestos WHERE presupuesto_id = ? ORDER BY id ASC',
      [presupuestoId]
    );
    const negocio = await configuracionService.obtenerConfiguracionNegocio();

    return {
      presupuesto: presupuestoRows[0],
      detalle: detalleRows,
      negocio
    };
  });
}

async function listarPresupuestos(filtros = {}) {
  const condiciones = ['1 = 1'];
  const params = [];

  if (filtros.estado && String(filtros.estado).trim() !== '' && filtros.estado !== 'todos') {
    const estado = String(filtros.estado).trim().toUpperCase();
    if (!ESTADOS_PRESUPUESTO.includes(estado)) {
      throw new AppError(`Estado de presupuesto no valido: ${estado}`, 400);
    }
    condiciones.push('p.estado = ?');
    params.push(estado);
  }

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push(
      '(p.folio LIKE ? OR COALESCE(p.cliente_nombre, \'\') LIKE ? OR COALESCE(p.cliente_telefono, \'\') LIKE ?)'
    );
    params.push(termino, termino, termino);
  }

  if (filtros.fecha_inicio && String(filtros.fecha_inicio).trim() !== '') {
    if (!esFechaIsoValida(filtros.fecha_inicio)) {
      throw new AppError('La fecha_inicio debe tener formato AAAA-MM-DD.', 400);
    }
    condiciones.push('DATE(p.fecha_presupuesto) >= ?');
    params.push(filtros.fecha_inicio);
  }

  if (filtros.fecha_fin && String(filtros.fecha_fin).trim() !== '') {
    if (!esFechaIsoValida(filtros.fecha_fin)) {
      throw new AppError('La fecha_fin debe tener formato AAAA-MM-DD.', 400);
    }
    condiciones.push('DATE(p.fecha_presupuesto) <= ?');
    params.push(filtros.fecha_fin);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(200, Math.max(1, Number.parseInt(filtros.limite, 10) || 50));
  const offset = (pagina - 1) * limite;
  const whereSql = condiciones.join(' AND ');

  const [conteoRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM presupuestos p WHERE ${whereSql}`,
    params
  );
  const total = conteoRows[0].total;

  const [presupuestos] = await pool.query(
    `SELECT
      p.id,
      p.folio,
      p.fecha_presupuesto,
      p.cliente_id,
      p.cliente_nombre,
      p.cliente_telefono,
      p.cliente_direccion,
      p.notas,
      p.cantidad_productos,
      p.total_unidades,
      p.subtotal,
      p.total,
      p.estado,
      p.venta_id,
      v.folio AS venta_folio
    FROM presupuestos p
    LEFT JOIN ventas v ON v.id = p.venta_id
    WHERE ${whereSql}
    ORDER BY p.fecha_presupuesto DESC, p.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  return {
    presupuestos,
    paginacion: {
      total,
      pagina,
      limite,
      total_paginas: Math.max(1, Math.ceil(total / limite))
    }
  };
}

async function obtenerPresupuestoPorId(id) {
  const [rows] = await pool.query(
    `SELECT
      p.*,
      v.folio AS venta_folio
    FROM presupuestos p
    LEFT JOIN ventas v ON v.id = p.venta_id
    WHERE p.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Presupuesto no encontrado.', 404);
  }

  const [detalle] = await pool.query(
    `SELECT
      d.*,
      pr.existencias AS stock_actual,
      pr.activo AS producto_activo
    FROM detalle_presupuestos d
    LEFT JOIN productos pr ON pr.id = d.producto_id
    WHERE d.presupuesto_id = ?
    ORDER BY d.id ASC`,
    [id]
  );

  const negocio = await configuracionService.obtenerConfiguracionNegocio();

  return {
    presupuesto: rows[0],
    detalle,
    negocio
  };
}

async function cambiarEstadoPresupuesto(id, estadoRaw) {
  const nuevoEstado = String(estadoRaw || '').trim().toUpperCase();
  if (!['VIGENTE', 'CANCELADO'].includes(nuevoEstado)) {
    throw new AppError('Solo puede cambiar el estado a VIGENTE o CANCELADO.', 400);
  }

  const [rows] = await pool.query('SELECT id, estado FROM presupuestos WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('Presupuesto no encontrado.', 404);
  }
  if (rows[0].estado === 'CONVERTIDO') {
    throw new AppError(
      'Este presupuesto ya fue convertido en una venta y no puede modificarse.',
      409
    );
  }

  await pool.query('UPDATE presupuestos SET estado = ? WHERE id = ?', [nuevoEstado, id]);
  return obtenerPresupuestoPorId(id);
}

async function eliminarPresupuesto(id) {
  const [rows] = await pool.query('SELECT id, estado FROM presupuestos WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new AppError('Presupuesto no encontrado.', 404);
  }
  if (rows[0].estado === 'CONVERTIDO') {
    throw new AppError(
      'No se puede eliminar un presupuesto que ya fue convertido en venta.',
      409
    );
  }

  await pool.query('DELETE FROM presupuestos WHERE id = ?', [id]);
  return { id, eliminado: true };
}

module.exports = {
  crearPresupuesto,
  listarPresupuestos,
  obtenerPresupuestoPorId,
  cambiarEstadoPresupuesto,
  eliminarPresupuesto
};

