const { pool, conTransaccion } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { requerirTexto, textoOpcional } = require('../middlewares/validate');

async function listarClientes(filtros = {}) {
  const condiciones = ['c.activo = 1'];
  const params = [];

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push('(c.nombre LIKE ? OR COALESCE(c.telefono, \'\') LIKE ? OR COALESCE(c.direccion, \'\') LIKE ?)');
    params.push(termino, termino, termino);
  }

  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nombre,
      c.telefono,
      c.direccion,
      c.referencias,
      c.notas,
      c.fecha_registro,
      c.fecha_modificacion,
      (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id) AS total_ventas,
      (SELECT MAX(v.fecha_venta) FROM ventas v WHERE v.cliente_id = c.id) AS ultima_venta,
      (SELECT COUNT(*) FROM entregas_programadas e WHERE e.cliente_id = c.id AND e.estado = 'PENDIENTE') AS entregas_pendientes
    FROM clientes c
    WHERE ${condiciones.join(' AND ')}
    ORDER BY c.nombre ASC`,
    params
  );

  return rows;
}

async function obtenerClientePorId(id) {
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nombre,
      c.telefono,
      c.direccion,
      c.referencias,
      c.notas,
      c.activo,
      c.fecha_registro,
      c.fecha_modificacion
    FROM clientes c
    WHERE c.id = ? AND c.activo = 1`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Cliente no encontrado.', 404);
  }
  return rows[0];
}

async function crearCliente(datos = {}) {
  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 150 });
  const telefono = textoOpcional(datos.telefono, 60);
  const direccion = textoOpcional(datos.direccion, 255);
  const referencias = textoOpcional(datos.referencias, 255);
  const notas = textoOpcional(datos.notas, 1000);

  const [resultado] = await pool.query(
    `INSERT INTO clientes (nombre, telefono, direccion, referencias, notas)
    VALUES (?, ?, ?, ?, ?)`,
    [nombre, telefono, direccion, referencias, notas]
  );

  return obtenerClientePorId(resultado.insertId);
}

async function actualizarCliente(id, datos = {}) {
  await obtenerClientePorId(id);

  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 150 });
  const telefono = textoOpcional(datos.telefono, 60);
  const direccion = textoOpcional(datos.direccion, 255);
  const referencias = textoOpcional(datos.referencias, 255);
  const notas = textoOpcional(datos.notas, 1000);

  await pool.query(
    `UPDATE clientes
    SET
      nombre = ?,
      telefono = ?,
      direccion = ?,
      referencias = ?,
      notas = ?
    WHERE id = ?`,
    [nombre, telefono, direccion, referencias, notas, id]
  );

  return obtenerClientePorId(id);
}

async function eliminarCliente(id) {
  return conTransaccion(async (conexion) => {
    const [filas] = await conexion.query(
      'SELECT id FROM clientes WHERE id = ? AND activo = 1 FOR UPDATE',
      [id]
    );
    if (filas.length === 0) {
      throw new AppError('Cliente no encontrado.', 404);
    }

    const [refVentas] = await conexion.query(
      'SELECT COUNT(*) AS total FROM ventas WHERE cliente_id = ?',
      [id]
    );
    const [refEntregas] = await conexion.query(
      'SELECT COUNT(*) AS total FROM entregas_programadas WHERE cliente_id = ?',
      [id]
    );
    const [refPresupuestos] = await conexion.query(
      'SELECT COUNT(*) AS total FROM presupuestos WHERE cliente_id = ?',
      [id]
    );

    const totalReferencias =
      refVentas[0].total + refEntregas[0].total + refPresupuestos[0].total;

    if (totalReferencias > 0) {
      await conexion.query('UPDATE clientes SET activo = 0 WHERE id = ?', [id]);
      return {
        id,
        eliminado: false,
        desactivado: true,
        mensaje:
          'Cliente desactivado del directorio. Se conserva su historial en ventas y entregas.'
      };
    }

    await conexion.query('DELETE FROM clientes WHERE id = ?', [id]);
    return {
      id,
      eliminado: true,
      desactivado: false,
      mensaje: 'Cliente eliminado permanentemente.'
    };
  });
}

module.exports = {
  listarClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};

