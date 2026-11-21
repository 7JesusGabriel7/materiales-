const { pool, conTransaccion } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const {
  parsearEnteroPositivo,
  parsearDecimalNoNegativo,
  parsearDecimalPositivo,
  requerirTexto
} = require('../middlewares/validate');
const { redondearCantidad, esFechaIsoValida } = require('../utils/formatters');

const TIPOS_AJUSTE_MANUAL = ['ENTRADA', 'SALIDA', 'AJUSTE'];
const TODOS_TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'SALIDA_VENTA', 'AJUSTE'];

async function obtenerResumenInventario() {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total_productos,
      COALESCE(SUM(CASE WHEN controla_stock = 1 THEN 1 ELSE 0 END), 0) AS con_control_stock,
      COALESCE(SUM(CASE WHEN controla_stock = 0 THEN 1 ELSE 0 END), 0) AS sin_control_stock,
      COALESCE(SUM(CASE WHEN controla_stock = 1 AND existencias <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo_stock,
      COALESCE(SUM(CASE WHEN controla_stock = 1 AND existencias <= 0 THEN 1 ELSE 0 END), 0) AS agotados,
      ROUND(COALESCE(SUM(CASE WHEN controla_stock = 1 THEN existencias * precio_venta ELSE 0 END), 0), 2) AS valor_inventario
    FROM productos
    WHERE activo = 1`
  );
  return rows[0];
}

async function listarProductosBajoStock() {
  const [rows] = await pool.query(
    `SELECT
      p.id,
      p.codigo,
      p.nombre,
      p.categoria_id,
      c.nombre AS categoria_nombre,
      p.precio_venta,
      p.existencias,
      p.stock_minimo,
      p.unidad_medida,
      p.fecha_modificacion
    FROM productos p
    INNER JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1 AND p.controla_stock = 1 AND p.existencias <= p.stock_minimo
    ORDER BY (p.existencias <= 0) DESC, (p.existencias - p.stock_minimo) ASC, p.nombre ASC`
  );
  return rows;
}

async function listarMovimientos(filtros = {}) {
  const condiciones = ['1 = 1'];
  const params = [];

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push(
      '(m.producto_nombre LIKE ? OR m.producto_codigo LIKE ? OR m.motivo LIKE ? OR COALESCE(v.folio, \'\') LIKE ?)'
    );
    params.push(termino, termino, termino, termino);
  }

  if (filtros.producto_id !== undefined && filtros.producto_id !== '') {
    const productoId = parsearEnteroPositivo(filtros.producto_id, 'producto_id');
    condiciones.push('m.producto_id = ?');
    params.push(productoId);
  }

  if (filtros.tipo && String(filtros.tipo).trim() !== '') {
    const tipo = String(filtros.tipo).trim().toUpperCase();
    if (!TODOS_TIPOS_MOVIMIENTO.includes(tipo)) {
      throw new AppError(`Tipo de movimiento no valido: ${tipo}`, 400);
    }
    condiciones.push('m.tipo = ?');
    params.push(tipo);
  }

  if (filtros.fecha_inicio && String(filtros.fecha_inicio).trim() !== '') {
    if (!esFechaIsoValida(filtros.fecha_inicio)) {
      throw new AppError('La fecha_inicio debe tener formato AAAA-MM-DD.', 400);
    }
    condiciones.push('DATE(m.fecha_movimiento) >= ?');
    params.push(filtros.fecha_inicio);
  }

  if (filtros.fecha_fin && String(filtros.fecha_fin).trim() !== '') {
    if (!esFechaIsoValida(filtros.fecha_fin)) {
      throw new AppError('La fecha_fin debe tener formato AAAA-MM-DD.', 400);
    }
    condiciones.push('DATE(m.fecha_movimiento) <= ?');
    params.push(filtros.fecha_fin);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(200, Math.max(1, Number.parseInt(filtros.limite, 10) || 50));
  const offset = (pagina - 1) * limite;
  const whereSql = condiciones.join(' AND ');

  const [conteoRows] = await pool.query(
    `SELECT COUNT(*) AS total
    FROM movimientos_inventario m
    LEFT JOIN ventas v ON v.id = m.venta_id
    WHERE ${whereSql}`,
    params
  );
  const total = conteoRows[0].total;

  const [rows] = await pool.query(
    `SELECT
      m.id,
      m.producto_id,
      m.producto_codigo,
      m.producto_nombre,
      m.venta_id,
      v.folio AS venta_folio,
      m.tipo,
      m.cantidad,
      m.stock_anterior,
      m.stock_nuevo,
      m.motivo,
      m.fecha_movimiento,
      p.unidad_medida
    FROM movimientos_inventario m
    LEFT JOIN ventas v ON v.id = m.venta_id
    LEFT JOIN productos p ON p.id = m.producto_id
    WHERE ${whereSql}
    ORDER BY m.fecha_movimiento DESC, m.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  return {
    movimientos: rows,
    paginacion: {
      total,
      pagina,
      limite,
      total_paginas: Math.max(1, Math.ceil(total / limite))
    }
  };
}

async function registrarMovimiento(datos) {
  const productoId = parsearEnteroPositivo(datos.producto_id, 'producto_id');
  const tipo = String(datos.tipo || '').trim().toUpperCase();
  if (!TIPOS_AJUSTE_MANUAL.includes(tipo)) {
    throw new AppError(
      'El tipo de movimiento manual debe ser ENTRADA, SALIDA o AJUSTE.',
      400
    );
  }
  const motivo = requerirTexto(datos.motivo, 'motivo', { min: 3, max: 255 });

  return conTransaccion(async (conexion) => {
    const [productos] = await conexion.query(
      'SELECT id, codigo, nombre, existencias, controla_stock, unidad_medida FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
      [productoId]
    );
    if (productos.length === 0) {
      throw new AppError('Producto no encontrado o inactivo.', 404);
    }

    const producto = productos[0];
    if (Number(producto.controla_stock) === 0) {
      throw new AppError(
        'Este producto esta configurado sin control de stock. Active el control de inventario en Productos para registrar movimientos.',
        400
      );
    }
    const stockAnterior = redondearCantidad(producto.existencias);
    let stockNuevo = stockAnterior;
    let cantidadMovimiento = 0;

    if (tipo === 'ENTRADA') {
      cantidadMovimiento = parsearDecimalPositivo(datos.cantidad, 'cantidad', 3);
      stockNuevo = redondearCantidad(stockAnterior + cantidadMovimiento);
    } else if (tipo === 'SALIDA') {
      cantidadMovimiento = parsearDecimalPositivo(datos.cantidad, 'cantidad', 3);
      if (cantidadMovimiento > stockAnterior) {
        throw new AppError(
          `La salida solicitada (${cantidadMovimiento}) supera las existencias actuales (${stockAnterior}).`,
          400
        );
      }
      stockNuevo = redondearCantidad(stockAnterior - cantidadMovimiento);
    } else {
      const valorAjuste = datos.nuevo_stock !== undefined ? datos.nuevo_stock : datos.cantidad;
      stockNuevo = parsearDecimalNoNegativo(valorAjuste, 'nuevo_stock', 3);
      cantidadMovimiento = redondearCantidad(Math.abs(stockNuevo - stockAnterior));
      if (cantidadMovimiento === 0) {
        throw new AppError(
          'El nuevo inventario indicado es igual a las existencias actuales.',
          400
        );
      }
    }

    await conexion.query('UPDATE productos SET existencias = ? WHERE id = ?', [
      stockNuevo,
      productoId
    ]);

    const [insertResult] = await conexion.query(
      `INSERT INTO movimientos_inventario (
        producto_id,
        producto_codigo,
        producto_nombre,
        venta_id,
        tipo,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      [
        producto.id,
        producto.codigo,
        producto.nombre,
        tipo,
        cantidadMovimiento,
        stockAnterior,
        stockNuevo,
        motivo
      ]
    );

    const [movRows] = await conexion.query(
      'SELECT * FROM movimientos_inventario WHERE id = ?',
      [insertResult.insertId]
    );

    return {
      movimiento: movRows[0],
      producto: {
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        unidad_medida: producto.unidad_medida,
        existencias: stockNuevo
      }
    };
  });
}

module.exports = {
  obtenerResumenInventario,
  listarProductosBajoStock,
  listarMovimientos,
  registrarMovimiento
};

