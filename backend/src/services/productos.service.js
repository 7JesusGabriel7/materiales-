const env = require('../config/env');
const { pool, conTransaccion } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const {
  parsearEnteroPositivo,
  parsearDecimalNoNegativo,
  requerirTexto,
  textoOpcional
} = require('../middlewares/validate');
const { redondearCantidad } = require('../utils/formatters');

function validarUnidadMedida(unidad) {
  const limpia = typeof unidad === 'string' ? unidad.trim() : '';
  if (!env.UNIDADES_MEDIDA.includes(limpia)) {
    throw new AppError(
      `Unidad de medida no valida. Opciones permitidas: ${env.UNIDADES_MEDIDA.join(', ')}.`,
      400
    );
  }
  return limpia;
}

function generarCodigoInterno() {
  const tiempo = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRD-${tiempo}-${aleatorio}`;
}

function normalizarControlaStock(valor) {
  if (
    valor === false ||
    valor === 0 ||
    valor === '0' ||
    String(valor).trim().toLowerCase() === 'false'
  ) {
    return 0;
  }
  return 1;
}

function validarPayloadProducto(
  datos,
  { codigoPorDefecto = null, stockMinimoPorDefecto = 10, controlaStockPorDefecto = 1 } = {}
) {
  const codigoEnviado =
    datos.codigo !== undefined && datos.codigo !== null
      ? String(datos.codigo).trim()
      : '';
  const codigo = codigoEnviado
    ? requerirTexto(codigoEnviado, 'codigo', { min: 1, max: 50 })
    : codigoPorDefecto || generarCodigoInterno();
  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 150 });
  const categoriaId = parsearEnteroPositivo(datos.categoria_id, 'categoria_id');
  const descripcion = textoOpcional(datos.descripcion, 2000);
  const precioVenta = parsearDecimalNoNegativo(datos.precio_venta, 'precio_venta', 2);
  const controlaStock =
    datos.controla_stock !== undefined
      ? normalizarControlaStock(datos.controla_stock)
      : controlaStockPorDefecto;
  const existencias =
    controlaStock === 1
      ? parsearDecimalNoNegativo(datos.existencias ?? 0, 'existencias', 3)
      : 0;
  const stockMinimo =
    controlaStock === 1
      ? parsearDecimalNoNegativo(
          datos.stock_minimo ?? stockMinimoPorDefecto,
          'stock_minimo',
          3
        )
      : 0;
  const unidadMedida = validarUnidadMedida(datos.unidad_medida);

  return {
    codigo,
    nombre,
    categoriaId,
    descripcion,
    precioVenta,
    controlaStock,
    existencias,
    stockMinimo,
    unidadMedida
  };
}

async function obtenerProductoPorIdConConexion(conexion, id) {
  const [rows] = await conexion.query(
    `SELECT
      p.id,
      p.codigo,
      p.nombre,
      p.categoria_id,
      c.nombre AS categoria_nombre,
      p.descripcion,
      p.precio_venta,
      p.existencias,
      p.stock_minimo,
      p.controla_stock,
      p.unidad_medida,
      p.activo,
      p.fecha_registro,
      p.fecha_modificacion,
      (p.controla_stock = 1 AND p.existencias <= p.stock_minimo) AS bajo_stock
    FROM productos p
    INNER JOIN categorias c ON c.id = p.categoria_id
    WHERE p.id = ? AND p.activo = 1`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Producto no encontrado.', 404);
  }
  return rows[0];
}

async function listarProductos(filtros = {}) {
  const condiciones = ['p.activo = 1'];
  const params = [];

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
    params.push(termino, termino);
  }

  if (filtros.categoria_id !== undefined && filtros.categoria_id !== '') {
    const categoriaId = parsearEnteroPositivo(filtros.categoria_id, 'categoria_id');
    condiciones.push('p.categoria_id = ?');
    params.push(categoriaId);
  }

  if (filtros.solo_disponibles === 'true' || filtros.solo_disponibles === '1') {
    condiciones.push('(p.controla_stock = 0 OR p.existencias > 0)');
  }

  if (filtros.bajo_stock === 'true' || filtros.bajo_stock === '1') {
    condiciones.push('(p.controla_stock = 1 AND p.existencias <= p.stock_minimo)');
  }

  const [rows] = await pool.query(
    `SELECT
      p.id,
      p.codigo,
      p.nombre,
      p.categoria_id,
      c.nombre AS categoria_nombre,
      p.descripcion,
      p.precio_venta,
      p.existencias,
      p.stock_minimo,
      p.controla_stock,
      p.unidad_medida,
      p.activo,
      p.fecha_registro,
      p.fecha_modificacion,
      (p.controla_stock = 1 AND p.existencias <= p.stock_minimo) AS bajo_stock
    FROM productos p
    INNER JOIN categorias c ON c.id = p.categoria_id
    WHERE ${condiciones.join(' AND ')}
    ORDER BY p.nombre ASC`,
    params
  );

  return rows;
}

async function obtenerProductoPorId(id) {
  return obtenerProductoPorIdConConexion(pool, id);
}

async function crearProducto(datos) {
  const validado = validarPayloadProducto(datos, {
    codigoPorDefecto: null,
    stockMinimoPorDefecto: 10
  });

  return conTransaccion(async (conexion) => {
    const [categorias] = await conexion.query(
      'SELECT id FROM categorias WHERE id = ? LIMIT 1',
      [validado.categoriaId]
    );
    if (categorias.length === 0) {
      throw new AppError('La categoria seleccionada no existe.', 400);
    }

    const [duplicados] = await conexion.query(
      'SELECT id FROM productos WHERE LOWER(codigo) = LOWER(?) LIMIT 1',
      [validado.codigo]
    );
    if (duplicados.length > 0) {
      throw new AppError('Ya existe un producto con ese codigo o SKU.', 409);
    }

    const [resultado] = await conexion.query(
      `INSERT INTO productos (
        codigo,
        nombre,
        categoria_id,
        descripcion,
        precio_venta,
        existencias,
        stock_minimo,
        controla_stock,
        unidad_medida
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validado.codigo,
        validado.nombre,
        validado.categoriaId,
        validado.descripcion,
        validado.precioVenta,
        validado.existencias,
        validado.stockMinimo,
        validado.controlaStock,
        validado.unidadMedida
      ]
    );

    const productoId = resultado.insertId;

    if (validado.controlaStock === 1 && validado.existencias > 0) {
      await conexion.query(
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
        ) VALUES (?, ?, ?, NULL, 'ENTRADA', ?, 0.000, ?, ?)`,
        [
          productoId,
          validado.codigo,
          validado.nombre,
          validado.existencias,
          validado.existencias,
          'Registro inicial de producto'
        ]
      );
    }

    return obtenerProductoPorIdConConexion(conexion, productoId);
  });
}

async function actualizarProducto(id, datos) {
  return conTransaccion(async (conexion) => {
    const [filasActuales] = await conexion.query(
      'SELECT * FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
      [id]
    );
    if (filasActuales.length === 0) {
      throw new AppError('Producto no encontrado.', 404);
    }
    const actual = filasActuales[0];

    const validado = validarPayloadProducto(datos, {
      codigoPorDefecto: actual.codigo,
      stockMinimoPorDefecto: actual.stock_minimo,
      controlaStockPorDefecto: Number(actual.controla_stock) === 0 ? 0 : 1
    });

    const [categorias] = await conexion.query(
      'SELECT id FROM categorias WHERE id = ? LIMIT 1',
      [validado.categoriaId]
    );
    if (categorias.length === 0) {
      throw new AppError('La categoria seleccionada no existe.', 400);
    }

    const [duplicados] = await conexion.query(
      'SELECT id FROM productos WHERE LOWER(codigo) = LOWER(?) AND id <> ? LIMIT 1',
      [validado.codigo, id]
    );
    if (duplicados.length > 0) {
      throw new AppError('Ya existe otro producto con ese codigo o SKU.', 409);
    }

    await conexion.query(
      `UPDATE productos
      SET
        codigo = ?,
        nombre = ?,
        categoria_id = ?,
        descripcion = ?,
        precio_venta = ?,
        existencias = ?,
        stock_minimo = ?,
        controla_stock = ?,
        unidad_medida = ?
      WHERE id = ?`,
      [
        validado.codigo,
        validado.nombre,
        validado.categoriaId,
        validado.descripcion,
        validado.precioVenta,
        validado.existencias,
        validado.stockMinimo,
        validado.controlaStock,
        validado.unidadMedida,
        id
      ]
    );

    const stockAnterior = redondearCantidad(actual.existencias);
    const stockNuevo = redondearCantidad(validado.existencias);
    const diferencia = redondearCantidad(Math.abs(stockNuevo - stockAnterior));

    if (validado.controlaStock === 1 && diferencia > 0) {
      await conexion.query(
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
        ) VALUES (?, ?, ?, NULL, 'AJUSTE', ?, ?, ?, ?)`,
        [
          id,
          validado.codigo,
          validado.nombre,
          diferencia,
          stockAnterior,
          stockNuevo,
          'Actualizacion desde administracion de productos'
        ]
      );
    }

    return obtenerProductoPorIdConConexion(conexion, id);
  });
}

async function eliminarProducto(id) {
  return conTransaccion(async (conexion) => {
    const [filas] = await conexion.query(
      'SELECT id, codigo, nombre FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
      [id]
    );
    if (filas.length === 0) {
      throw new AppError('Producto no encontrado.', 404);
    }

    const [ventasAsociadas] = await conexion.query(
      'SELECT COUNT(*) AS total FROM detalle_ventas WHERE producto_id = ?',
      [id]
    );

    if (ventasAsociadas[0].total > 0) {
      await conexion.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
      return {
        id,
        eliminado: false,
        desactivado: true,
        mensaje:
          'Producto desactivado del catalogo. Se conserva su historial en ventas anteriores.'
      };
    }

    await conexion.query('DELETE FROM productos WHERE id = ?', [id]);
    return {
      id,
      eliminado: true,
      desactivado: false,
      mensaje: 'Producto eliminado permanentemente del catalogo.'
    };
  });
}

module.exports = {
  listarProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto
};

