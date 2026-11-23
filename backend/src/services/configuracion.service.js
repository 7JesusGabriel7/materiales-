const env = require('../config/env');
const { pool } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { requerirTexto, textoOpcional } = require('../middlewares/validate');

const MENSAJE_PRESUPUESTO_DEFAULT =
  'Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.';

const MENSAJE_PDF_DEFAULT =
  'Gracias por su compra. Documento digital emitido por el establecimiento para referencia y control del cliente.';

const ICONOS_DOCUMENTO = Object.freeze([
  { id: 'camion_volteo', nombre: 'Camion de volteo', categoria: 'Camion' },
  { id: 'camion_plataforma', nombre: 'Camion plataforma', categoria: 'Camion' },
  { id: 'camion_revolvedora', nombre: 'Camion revolvedora', categoria: 'Camion' },
  { id: 'retroexcavadora', nombre: 'Retroexcavadora', categoria: 'Maquina de excavar' },
  { id: 'excavadora_orugas', nombre: 'Excavadora sobre orugas', categoria: 'Maquina de excavar' },
  { id: 'ninguno', nombre: 'Sin ilustracion', categoria: 'Solo texto' }
]);

const ICONOS_PERMITIDOS = new Set(ICONOS_DOCUMENTO.map((item) => item.id));

const ESCALA_LETRA_MIN = 75;
const ESCALA_LETRA_MAX = 140;
const ESCALA_LETRA_DEFAULT = 100;

function normalizarEscalaLetra(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return ESCALA_LETRA_DEFAULT;
  }
  const num = Number(valor);
  if (!Number.isFinite(num)) {
    return ESCALA_LETRA_DEFAULT;
  }
  return Math.min(ESCALA_LETRA_MAX, Math.max(ESCALA_LETRA_MIN, Math.round(num)));
}

function resolverIconoSeguro(iconoRaw, mostrarBandera = true) {
  if (iconoRaw && ICONOS_PERMITIDOS.has(String(iconoRaw).trim())) {
    return String(iconoRaw).trim();
  }
  return mostrarBandera ? 'camion_volteo' : 'ninguno';
}

function mapearConfiguracion(fila) {
  const iconoTicket = resolverIconoSeguro(
    fila.icono_ticket,
    Boolean(fila.mostrar_camion_ticket)
  );
  return {
    nombre: fila.nombre,
    direccion: fila.direccion || '',
    telefono: fila.telefono || '',
    rfc: fila.rfc || '',
    mensajeTicket: fila.mensaje_ticket || '',
    mensajePresupuesto: fila.mensaje_presupuesto || '',
    mensajePdf: fila.mensaje_pdf || '',
    mostrarCamionTicket: iconoTicket !== 'ninguno',
    iconoTicket,
    escalaLetra: normalizarEscalaLetra(fila.escala_letra),
    fecha_modificacion: fila.fecha_modificacion
  };
}

/**
 * Crea la tabla configuracion_negocio si no existe, aplica migraciones idempotentes
 * e inserta el registro base (id = 1).
 */
async function asegurarTablaConfiguracion() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion_negocio (
      id TINYINT UNSIGNED NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      direccion VARCHAR(255) NULL,
      telefono VARCHAR(60) NULL,
      rfc VARCHAR(60) NULL,
      mensaje_ticket VARCHAR(500) NULL,
      mensaje_presupuesto VARCHAR(500) NULL,
      mensaje_pdf VARCHAR(500) NULL,
      mostrar_camion_ticket TINYINT(1) NOT NULL DEFAULT 1,
      icono_ticket VARCHAR(40) NOT NULL DEFAULT 'camion_volteo',
      escala_letra SMALLINT UNSIGNED NOT NULL DEFAULT 100,
      fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_negocio'`
  );
  const mapaCols = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

  const colMsgTicket = mapaCols.get('mensaje_ticket');
  if (colMsgTicket && Number(colMsgTicket.CHARACTER_MAXIMUM_LENGTH || 0) < 500) {
    await pool.query(
      'ALTER TABLE configuracion_negocio MODIFY COLUMN mensaje_ticket VARCHAR(500) NULL'
    );
  }

  if (!mapaCols.has('mensaje_presupuesto')) {
    await pool.query(
      'ALTER TABLE configuracion_negocio ADD COLUMN mensaje_presupuesto VARCHAR(500) NULL AFTER mensaje_ticket'
    );
    await pool.query(
      'UPDATE configuracion_negocio SET mensaje_presupuesto = ? WHERE mensaje_presupuesto IS NULL',
      [MENSAJE_PRESUPUESTO_DEFAULT]
    );
  }

  if (!mapaCols.has('mensaje_pdf')) {
    await pool.query(
      'ALTER TABLE configuracion_negocio ADD COLUMN mensaje_pdf VARCHAR(500) NULL AFTER mensaje_presupuesto'
    );
    await pool.query(
      'UPDATE configuracion_negocio SET mensaje_pdf = ? WHERE mensaje_pdf IS NULL',
      [MENSAJE_PDF_DEFAULT]
    );
  }

  if (!mapaCols.has('icono_ticket')) {
    await pool.query(
      "ALTER TABLE configuracion_negocio ADD COLUMN icono_ticket VARCHAR(40) NOT NULL DEFAULT 'camion_volteo' AFTER mostrar_camion_ticket"
    );
    await pool.query(
      "UPDATE configuracion_negocio SET icono_ticket = 'ninguno' WHERE mostrar_camion_ticket = 0"
    );
  }

  if (!mapaCols.has('escala_letra')) {
    await pool.query(
      'ALTER TABLE configuracion_negocio ADD COLUMN escala_letra SMALLINT UNSIGNED NOT NULL DEFAULT 100 AFTER icono_ticket'
    );
  }

  await pool.query(
    `INSERT IGNORE INTO configuracion_negocio (
      id,
      nombre,
      direccion,
      telefono,
      rfc,
      mensaje_ticket,
      mensaje_presupuesto,
      mensaje_pdf,
      mostrar_camion_ticket,
      icono_ticket,
      escala_letra
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, 'camion_volteo', 100)`,
    [
      env.negocio.nombre,
      env.negocio.direccion,
      env.negocio.telefono,
      env.negocio.rfc,
      env.negocio.mensajeTicket,
      MENSAJE_PRESUPUESTO_DEFAULT,
      MENSAJE_PDF_DEFAULT
    ]
  );
}

async function obtenerConfiguracionNegocio() {
  const consulta = `SELECT
      nombre,
      direccion,
      telefono,
      rfc,
      mensaje_ticket,
      mensaje_presupuesto,
      mensaje_pdf,
      mostrar_camion_ticket,
      icono_ticket,
      escala_letra,
      fecha_modificacion
    FROM configuracion_negocio
    WHERE id = 1
    LIMIT 1`;

  let rows;
  try {
    [rows] = await pool.query(consulta);
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
      await asegurarTablaConfiguracion();
      [rows] = await pool.query(consulta);
    } else {
      throw error;
    }
  }

  if (rows.length === 0) {
    await asegurarTablaConfiguracion();
    [rows] = await pool.query(consulta);
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
  const mensajeTicket = textoOpcional(mensajeRaw, 500);

  const presupuestoRaw =
    datos.mensajePresupuesto !== undefined
      ? datos.mensajePresupuesto
      : datos.mensaje_presupuesto;
  const mensajePresupuesto = textoOpcional(presupuestoRaw, 500);

  const pdfRaw =
    datos.mensajePdf !== undefined ? datos.mensajePdf : datos.mensaje_pdf;
  const mensajePdf = textoOpcional(pdfRaw, 500);

  const iconoRaw =
    datos.iconoTicket !== undefined ? datos.iconoTicket : datos.icono_ticket;

  let iconoTicket;
  if (iconoRaw !== undefined && iconoRaw !== null && String(iconoRaw).trim() !== '') {
    const candidato = String(iconoRaw).trim();
    if (!ICONOS_PERMITIDOS.has(candidato)) {
      throw new AppError(
        `La ilustracion seleccionada (${candidato}) no es valida.`,
        400
      );
    }
    iconoTicket = candidato;
  } else {
    const camionRaw =
      datos.mostrarCamionTicket !== undefined
        ? datos.mostrarCamionTicket
        : datos.mostrar_camion_ticket;
    iconoTicket = camionRaw === false ? 'ninguno' : 'camion_volteo';
  }

  const mostrarCamionTicket = iconoTicket === 'ninguno' ? 0 : 1;

  await asegurarTablaConfiguracion();

  const escalaRaw =
    datos.escalaLetra !== undefined ? datos.escalaLetra : datos.escala_letra;
  let escalaLetra;
  if (escalaRaw !== undefined && escalaRaw !== null && String(escalaRaw).trim() !== '') {
    const num = Number(escalaRaw);
    if (!Number.isFinite(num) || num < ESCALA_LETRA_MIN || num > ESCALA_LETRA_MAX) {
      throw new AppError(
        `El tamano de letra debe estar entre ${ESCALA_LETRA_MIN}% y ${ESCALA_LETRA_MAX}%.`,
        400
      );
    }
    escalaLetra = Math.round(num);
  } else {
    const actual = await obtenerConfiguracionNegocio();
    escalaLetra = normalizarEscalaLetra(actual.escalaLetra);
  }

  const [resultado] = await pool.query(
    `UPDATE configuracion_negocio
    SET
      nombre = ?,
      direccion = ?,
      telefono = ?,
      rfc = ?,
      mensaje_ticket = ?,
      mensaje_presupuesto = ?,
      mensaje_pdf = ?,
      mostrar_camion_ticket = ?,
      icono_ticket = ?,
      escala_letra = ?
    WHERE id = 1`,
    [
      nombre,
      direccion,
      telefono,
      rfc,
      mensajeTicket,
      mensajePresupuesto,
      mensajePdf,
      mostrarCamionTicket,
      iconoTicket,
      escalaLetra
    ]
  );

  if (resultado.affectedRows === 0) {
    throw new AppError('No se encontro el registro de configuracion del negocio.', 404);
  }

  return obtenerConfiguracionNegocio();
}

module.exports = {
  ICONOS_DOCUMENTO,
  ICONOS_PERMITIDOS,
  MENSAJE_PRESUPUESTO_DEFAULT,
  MENSAJE_PDF_DEFAULT,
  ESCALA_LETRA_MIN,
  ESCALA_LETRA_MAX,
  ESCALA_LETRA_DEFAULT,
  normalizarEscalaLetra,
  asegurarTablaConfiguracion,
  obtenerConfiguracionNegocio,
  actualizarConfiguracionNegocio
};
