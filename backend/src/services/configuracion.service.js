const env = require('../config/env');
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { requerirTexto, textoOpcional } = require('../middlewares/validate');

function mapearConfiguracion(fila) {
  return {
    nombre: fila.nombre,
    direccion: fila.direccion || '',
    telefono: fila.telefono || '',
    rfc: fila.rfc || '',
    mensajeTicket: fila.mensaje_ticket || '',
    mostrarCamionTicket: Boolean(fila.mostrar_camion_ticket),
    fecha_modificacion: fila.fecha_modificacion
  };
}

/**
 * Crea la tabla configuracion_negocio si no existe e inserta el registro base (id = 1)
 * de forma idempotente para bases de datos ya inicializadas.
 */
async function asegurarTablaConfiguracion() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion_negocio (
      id TINYINT UNSIGNED NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      direccion VARCHAR(255) NULL,
      telefono VARCHAR(60) NULL,
      rfc VARCHAR(60) NULL,
      mensaje_ticket VARCHAR(255) NULL,
      mostrar_camion_ticket TINYINT(1) NOT NULL DEFAULT 1,
      fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(
    `INSERT IGNORE INTO configuracion_negocio (
      id,
      nombre,
      direccion,
      telefono,
      rfc,
      mensaje_ticket,
      mostrar_camion_ticket
    ) VALUES (1, ?, ?, ?, ?, ?, 1)`,
    [
      env.negocio.nombre,
      env.negocio.direccion,
      env.negocio.telefono,
      env.negocio.rfc,
      env.negocio.mensajeTicket
    ]
  );
}

async function obtenerConfiguracionNegocio() {
  const [rows] = await pool.query(
    `SELECT
      nombre,
      direccion,
      telefono,
      rfc,
      mensaje_ticket,
      mostrar_camion_ticket,
      fecha_modificacion
    FROM configuracion_negocio
    WHERE id = 1
    LIMIT 1`
  );

  if (rows.length === 0) {
    await asegurarTablaConfiguracion();
    const [retryRows] = await pool.query(
      `SELECT
        nombre,
        direccion,
        telefono,
        rfc,
        mensaje_ticket,
        mostrar_camion_ticket,
        fecha_modificacion
      FROM configuracion_negocio
      WHERE id = 1
      LIMIT 1`
    );
    return mapearConfiguracion(retryRows[0]);
  }

  return mapearConfiguracion(rows[0]);
}

async function actualizarConfiguracionNegocio(datos = {}) {
  const nombre = requerirTexto(datos.nombre, 'nombre', { min: 2, max: 150 });
  const direccion = textoOpcional(datos.direccion, 255);
  const telefono = textoOpcional(datos.telefono, 60);
  const rfc = textoOpcional(datos.rfc, 60);
  const mensajeRaw =
    datos.mensajeTicket !== undefined ? datos.mensajeTicket : datos.mensaje_ticket;
  const mensajeTicket = textoOpcional(mensajeRaw, 255);

  const camionRaw =
    datos.mostrarCamionTicket !== undefined
      ? datos.mostrarCamionTicket
      : datos.mostrar_camion_ticket;
  const mostrarCamionTicket =
    camionRaw === undefined ? 1 : camionRaw ? 1 : 0;

  await asegurarTablaConfiguracion();

  const [resultado] = await pool.query(
    `UPDATE configuracion_negocio
    SET
      nombre = ?,
      direccion = ?,
      telefono = ?,
      rfc = ?,
      mensaje_ticket = ?,
      mostrar_camion_ticket = ?
    WHERE id = 1`,
    [nombre, direccion, telefono, rfc, mensajeTicket, mostrarCamionTicket]
  );

  if (resultado.affectedRows === 0) {
    throw new AppError('No se encontro el registro de configuracion del negocio.', 404);
  }

  return obtenerConfiguracionNegocio();
}

module.exports = {
  asegurarTablaConfiguracion,
  obtenerConfiguracionNegocio,
  actualizarConfiguracionNegocio
};

