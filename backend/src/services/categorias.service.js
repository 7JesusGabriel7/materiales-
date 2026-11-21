const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { requerirTexto, textoOpcional } = require('../middlewares/validate');

async function listarCategorias() {
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nombre,
      c.descripcion,
      c.fecha_creacion,
      COUNT(p.id) AS total_productos
    FROM categorias c
    LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
    GROUP BY c.id, c.nombre, c.descripcion, c.fecha_creacion
    ORDER BY c.nombre ASC`
  );
  return rows;
}

async function obtenerCategoriaPorId(id) {
  const [rows] = await pool.query(
    `SELECT
      c.id,
      c.nombre,
      c.descripcion,
      c.fecha_creacion,
      COUNT(p.id) AS total_productos
    FROM categorias c
    LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
    WHERE c.id = ?
    GROUP BY c.id, c.nombre, c.descripcion, c.fecha_creacion`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Categoria no encontrada.', 404);
  }
  return rows[0];
}

async function crearCategoria(datos) {
  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 100 });
  const descripcion = textoOpcional(datos.descripcion, 255);

  const [existentes] = await pool.query(
    'SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [nombre]
  );
  if (existentes.length > 0) {
    throw new AppError('Ya existe una categoria con ese nombre.', 409);
  }

  const [resultado] = await pool.query(
    'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
    [nombre, descripcion]
  );
  return obtenerCategoriaPorId(resultado.insertId);
}

async function actualizarCategoria(id, datos) {
  await obtenerCategoriaPorId(id);

  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 100 });
  const descripcion = textoOpcional(datos.descripcion, 255);

  const [duplicados] = await pool.query(
    'SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id <> ? LIMIT 1',
    [nombre, id]
  );
  if (duplicados.length > 0) {
    throw new AppError('Ya existe otra categoria con ese nombre.', 409);
  }

  await pool.query(
    'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?',
    [nombre, descripcion, id]
  );
  return obtenerCategoriaPorId(id);
}

async function eliminarCategoria(id) {
  await obtenerCategoriaPorId(id);

  const [asociados] = await pool.query(
    'SELECT COUNT(*) AS total FROM productos WHERE categoria_id = ?',
    [id]
  );
  if (asociados[0].total > 0) {
    throw new AppError(
      'No se puede eliminar la categoria porque tiene productos asociados.',
      409
    );
  }

  await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
  return { id, eliminada: true };
}

module.exports = {
  listarCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
};

