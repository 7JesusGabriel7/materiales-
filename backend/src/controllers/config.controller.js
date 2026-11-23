const env = require('../config/env');
const { pool } = require('../config/database');
const configuracionService = require('../services/configuracion.service');
const pdfService = require('../services/pdf.service');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const { textoOpcional } = require('../middlewares/validate');

function obtenerFechaLocalSql() {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
}

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
    tipos_movimiento: env.TIPOS_MOVIMIENTO,
    iconos_ticket: configuracionService.ICONOS_DOCUMENTO
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

const generarPdfEjemplo = asyncHandler(async (req, res) => {
  const tipo = String(req.body?.tipo || 'venta').trim().toLowerCase();
  if (!['venta', 'presupuesto'].includes(tipo)) {
    throw new AppError('El tipo de PDF de ejemplo debe ser venta o presupuesto.', 400);
  }

  const guardada = await configuracionService.obtenerConfiguracionNegocio();
  const borrador = req.body?.negocio || {};

  let iconoTicket = guardada.iconoTicket;
  if (borrador.iconoTicket !== undefined) {
    const candidato = String(borrador.iconoTicket || '').trim();
    if (!configuracionService.ICONOS_PERMITIDOS.has(candidato)) {
      throw new AppError('La ilustracion seleccionada no es valida.', 400);
    }
    iconoTicket = candidato;
  } else if (borrador.mostrarCamionTicket === false) {
    iconoTicket = 'ninguno';
  }

  let escalaLetra = configuracionService.normalizarEscalaLetra(guardada.escalaLetra);
  const escalaRaw =
    borrador.escalaLetra !== undefined ? borrador.escalaLetra : borrador.escala_letra;
  if (escalaRaw !== undefined && escalaRaw !== null && String(escalaRaw).trim() !== '') {
    const num = Number(escalaRaw);
    if (
      !Number.isFinite(num) ||
      num < configuracionService.ESCALA_LETRA_MIN ||
      num > configuracionService.ESCALA_LETRA_MAX
    ) {
      throw new AppError(
        `El tamano de letra debe estar entre ${configuracionService.ESCALA_LETRA_MIN}% y ${configuracionService.ESCALA_LETRA_MAX}%.`,
        400
      );
    }
    escalaLetra = Math.round(num);
  }

  const negocioEjemplo = {
    nombre: textoOpcional(borrador.nombre, 150) || guardada.nombre,
    direccion:
      borrador.direccion !== undefined
        ? textoOpcional(borrador.direccion, 255) || ''
        : guardada.direccion,
    telefono:
      borrador.telefono !== undefined
        ? textoOpcional(borrador.telefono, 60) || ''
        : guardada.telefono,
    rfc:
      borrador.rfc !== undefined
        ? textoOpcional(borrador.rfc, 60) || ''
        : guardada.rfc,
    mensajeTicket:
      borrador.mensajeTicket !== undefined
        ? textoOpcional(borrador.mensajeTicket, 500) || ''
        : guardada.mensajeTicket,
    mensajePresupuesto:
      borrador.mensajePresupuesto !== undefined
        ? textoOpcional(borrador.mensajePresupuesto, 500) || ''
        : guardada.mensajePresupuesto,
    mensajePdf:
      borrador.mensajePdf !== undefined
        ? textoOpcional(borrador.mensajePdf, 500) || ''
        : guardada.mensajePdf,
    iconoTicket,
    escalaLetra,
    mostrarCamionTicket: iconoTicket !== 'ninguno'
  };

  const fechaActual = obtenerFechaLocalSql();
  const detalleEjemplo = [
    {
      producto_nombre: 'Cemento gris Portland 50 kg',
      unidad_medida: 'Bulto',
      cantidad: 5,
      precio_unitario: 245,
      importe: 1225
    },
    {
      producto_nombre: 'Block hueco 15x20x40',
      unidad_medida: 'Pieza',
      cantidad: 50,
      precio_unitario: 16.5,
      importe: 825
    }
  ];

  let buffer;
  let nombreArchivo;

  if (tipo === 'presupuesto') {
    buffer = await pdfService.generarPdfPresupuesto({
      presupuesto: {
        folio: 'PRE-EJEMPLO-000001',
        fecha_presupuesto: fechaActual,
        estado: 'VIGENTE',
        cliente_nombre: 'Constructora Demo S.A.',
        cliente_telefono: '555-123-4567',
        cliente_direccion: 'Obra Zona Norte No. 40',
        notas: 'Cotizacion de materiales para cimentacion.',
        subtotal: 2050,
        total: 2050
      },
      detalle: detalleEjemplo,
      negocio: negocioEjemplo
    });
    nombreArchivo = 'Ejemplo-Presupuesto.pdf';
  } else {
    buffer = await pdfService.generarPdfNotaVenta({
      venta: {
        folio: 'VTA-EJEMPLO-000001',
        fecha_venta: fechaActual,
        tipo_venta: 'CLIENTE',
        estado: 'COMPLETADA',
        cliente_nombre: 'Cliente de Ejemplo',
        cliente_telefono: '555-987-6543',
        cliente_direccion: 'Av. Reforma No. 210, Col. Centro',
        nota_venta: 'Entregar en porton lateral y llamar antes de descargar.',
        subtotal: 2050,
        total: 2050,
        dinero_recibido: 2500,
        cambio: 450
      },
      detalle: detalleEjemplo,
      entrega: {
        fecha_entrega: fechaActual.slice(0, 10),
        horario_entrega: '9:00 a 13:00 hrs',
        estado: 'PENDIENTE'
      },
      negocio: negocioEjemplo
    });
    nombreArchivo = 'Ejemplo-Nota-Venta.pdf';
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

module.exports = {
  obtenerSalud,
  obtenerConfiguracion,
  actualizarConfiguracion,
  generarPdfEjemplo
};
