const PDFDocument = require('pdfkit');

const COLORES = {
  negro: '#0b0f17',
  azul: '#1d4ed8',
  azulSuave: '#eff6ff',
  azulBorde: '#93c5fd',
  texto: '#0b0f19',
  textoSecundario: '#334155',
  textoTenue: '#64748b',
  fondoClaro: '#f8fafc',
  fondoAlterno: '#f1f5f9',
  borde: '#cbd5e1',
  bordeSuave: '#e2e8f0',
  blanco: '#ffffff'
};

const MARGEN = 42;
const ANCHO_PAGINA = 612;
const ALTO_PAGINA = 792;
const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN * 2;
const LIMITE_INFERIOR = ALTO_PAGINA - 48;

function limpiarTexto(valor) {
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x20-\x7E\xA1-\xFF]/g, ' ')
    .trim();
}

function formatearMoneda(valor) {
  const num = Number(valor);
  const seguro = Number.isFinite(num) ? num : 0;
  const negativo = seguro < 0;
  const abs = Math.abs(seguro).toFixed(2);
  const [entero, decimal] = abs.split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}$${conMiles}.${decimal}`;
}

function formatearCantidad(valor) {
  const num = Number(valor);
  if (!Number.isFinite(num)) {
    return '0';
  }
  const redondeado = Math.round((num + Number.EPSILON) * 1000) / 1000;
  const texto = redondeado.toFixed(3).replace(/\.?0+$/, '');
  const partes = texto.split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return partes.join('.');
}

function convertirFechaIsoATexto(valor) {
  if (!valor) {
    return '-';
  }
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return '-';
    }
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const soloFecha = String(valor).slice(0, 10);
  const partes = soloFecha.split('-');
  if (partes.length === 3 && /^\d{4}$/.test(partes[0])) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return limpiarTexto(soloFecha) || '-';
}

function extraerHoraTexto(valor) {
  if (!valor) {
    return '-';
  }
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return '-';
    }
    const hh = String(valor.getHours()).padStart(2, '0');
    const mm = String(valor.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const texto = String(valor);
  const coincidencia = texto.match(/[T ](\d{2}:\d{2})/);
  return coincidencia ? coincidencia[1] : '-';
}

function dibujarCamionVolteo(doc, x, y, escala = 0.42) {
  doc.save();
  doc.translate(x, y);
  doc.scale(escala);

  doc.path('M16 18 C24 8, 42 7, 54 11 C65 7, 78 10, 86 18 Z')
    .fillColor(COLORES.negro)
    .fill();

  doc.path('M12 18 L92 18 L103 14 L103 18 L90 21 L88 37 L14 37 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);

  [28, 46, 64, 80].forEach((posX) => {
    doc.moveTo(posX, 20)
      .lineTo(posX, 36)
      .lineWidth(1.8)
      .strokeColor(COLORES.negro)
      .stroke();
  });

  doc.path('M91 21 L114 21 L126 30 L128 42 L91 42 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);

  doc.path('M96 24 L112 24 L120 30 L96 30 Z')
    .fillColor(COLORES.negro)
    .fill();

  doc.roundedRect(10, 37, 121, 5, 1)
    .fillColor(COLORES.negro)
    .fill();

  [29, 49, 111].forEach((cx) => {
    doc.circle(cx, 46, 8).fillColor(COLORES.negro).fill();
    doc.circle(cx, 46, 3).fillColor(COLORES.blanco).fill();
  });

  doc.moveTo(4, 55)
    .lineTo(136, 55)
    .lineWidth(1.8)
    .strokeColor(COLORES.azul)
    .stroke();

  doc.restore();
}

function dibujarFranjaSuperior(doc) {
  doc.rect(0, 0, ANCHO_PAGINA * 0.68, 6).fillColor(COLORES.negro).fill();
  doc.rect(ANCHO_PAGINA * 0.68, 0, ANCHO_PAGINA * 0.32, 6).fillColor(COLORES.azul).fill();
}

function dibujarEncabezadoDocumento(doc, { negocio, tituloDoc, folio, fechaStr, horaStr, estadoDoc }) {
  dibujarFranjaSuperior(doc);

  const yInicio = 24;
  const mostrarCamion = negocio.mostrarCamionTicket !== false;
  let xTextoNegocio = MARGEN;
  let anchoTextoNegocio = 334;
  let yFinCamion = yInicio;

  if (mostrarCamion) {
    dibujarCamionVolteo(doc, MARGEN, yInicio + 2, 0.42);
    xTextoNegocio = MARGEN + 68;
    anchoTextoNegocio = 266;
    yFinCamion = yInicio + 28;
  }

  const nombreNegocio = limpiarTexto(negocio.nombre) || 'Casa de Materiales';
  const direccionNegocio = limpiarTexto(negocio.direccion);
  const telefonoNegocio = limpiarTexto(negocio.telefono);
  const rfcNegocio = limpiarTexto(negocio.rfc);

  let yNeg = yInicio;
  doc.font('Helvetica-Bold').fontSize(13.5).fillColor(COLORES.negro);
  doc.text(nombreNegocio, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
  yNeg += doc.heightOfString(nombreNegocio, { width: anchoTextoNegocio }) + 3;

  doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.textoSecundario);
  if (direccionNegocio) {
    doc.text(direccionNegocio, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
    yNeg += doc.heightOfString(direccionNegocio, { width: anchoTextoNegocio }) + 2;
  }
  const contacto = [telefonoNegocio, rfcNegocio].filter(Boolean).join('  |  ');
  if (contacto) {
    doc.text(contacto, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
    yNeg += doc.heightOfString(contacto, { width: anchoTextoNegocio }) + 2;
  }

  const cajaX = 392;
  const cajaAncho = 178;
  const cajaAlto = 74;

  doc.roundedRect(cajaX, yInicio, cajaAncho, cajaAlto, 5).fillColor(COLORES.negro).fill();
  doc.rect(cajaX, yInicio, cajaAncho, 4).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#93c5fd');
  doc.text(tituloDoc, cajaX + 12, yInicio + 11, { width: cajaAncho - 24, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(COLORES.blanco);
  doc.text(limpiarTexto(folio) || '-', cajaX + 12, yInicio + 24, {
    width: cajaAncho - 24,
    align: 'right'
  });

  doc.font('Helvetica').fontSize(8.5).fillColor('#cbd5e1');
  doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, cajaX + 12, yInicio + 43, {
    width: cajaAncho - 24,
    align: 'right'
  });

  if (estadoDoc) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#e2e8f0');
    doc.text(`Estado: ${limpiarTexto(estadoDoc)}`, cajaX + 12, yInicio + 57, {
      width: cajaAncho - 24,
      align: 'right'
    });
  }

  const yBase = Math.max(yNeg, yFinCamion, yInicio + cajaAlto) + 12;
  doc.moveTo(MARGEN, yBase)
    .lineTo(MARGEN + ANCHO_CONTENIDO, yBase)
    .lineWidth(1)
    .strokeColor(COLORES.borde)
    .stroke();

  return yBase + 12;
}

function dibujarBloqueDatos(doc, yInicio, filas) {
  const filasValidas = filas.filter((f) => f && f.valor);
  if (filasValidas.length === 0) {
    return yInicio;
  }

  const anchoTexto = ANCHO_CONTENIDO - 118;
  doc.font('Helvetica').fontSize(9);

  const medidas = filasValidas.map((fila) => {
    const etiqueta = `${limpiarTexto(fila.etiqueta)}:`;
    const valor = limpiarTexto(fila.valor);
    const alto = Math.max(13, doc.heightOfString(valor, { width: anchoTexto }) + 2);
    return { etiqueta, valor, alto };
  });

  const altoTotal = medidas.reduce((acc, m) => acc + m.alto, 0) + 18;

  doc.roundedRect(MARGEN, yInicio, ANCHO_CONTENIDO, altoTotal, 5)
    .fillAndStroke(COLORES.fondoClaro, COLORES.borde);
  doc.rect(MARGEN, yInicio, 4, altoTotal).fillColor(COLORES.azul).fill();

  let cursorY = yInicio + 10;
  medidas.forEach((m) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORES.textoSecundario);
    doc.text(m.etiqueta, MARGEN + 14, cursorY, { width: 88, lineBreak: false });

    doc.font('Helvetica').fontSize(9).fillColor(COLORES.texto);
    doc.text(m.valor, MARGEN + 104, cursorY, { width: anchoTexto, lineBreak: true });

    cursorY += m.alto;
  });

  return yInicio + altoTotal + 10;
}

function dibujarBloqueNota(doc, yInicio, titulo, textoNota) {
  const notaLimpia = limpiarTexto(textoNota);
  if (!notaLimpia) {
    return yInicio;
  }

  const anchoTexto = ANCHO_CONTENIDO - 28;
  doc.font('Helvetica').fontSize(9.5);
  const altoNota = doc.heightOfString(notaLimpia, { width: anchoTexto });
  const altoTotal = altoNota + 30;

  let y = yInicio;
  if (y + altoTotal > LIMITE_INFERIOR - 60) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  doc.roundedRect(MARGEN, y, ANCHO_CONTENIDO, altoTotal, 5)
    .fillAndStroke(COLORES.azulSuave, COLORES.azulBorde);
  doc.rect(MARGEN, y, 4, altoTotal).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORES.azul);
  doc.text(titulo, MARGEN + 14, y + 8, { width: anchoTexto });

  doc.font('Helvetica').fontSize(9.5).fillColor(COLORES.texto);
  doc.text(notaLimpia, MARGEN + 14, y + 21, { width: anchoTexto, lineBreak: true });

  return y + altoTotal + 12;
}

function dibujarEncabezadoTabla(doc, y) {
  const altoHeader = 22;
  doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoHeader).fillColor(COLORES.negro).fill();
  doc.rect(MARGEN, y + altoHeader - 2, ANCHO_CONTENIDO, 2).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORES.blanco);
  doc.text('CANT.', MARGEN + 8, y + 7, { width: 46, align: 'right', lineBreak: false });
  doc.text('UNIDAD', MARGEN + 62, y + 7, { width: 64, lineBreak: false });
  doc.text('MATERIAL / DESCRIPCION', MARGEN + 132, y + 7, { width: 226, lineBreak: false });
  doc.text('P. UNITARIO', MARGEN + 364, y + 7, { width: 74, align: 'right', lineBreak: false });
  doc.text('IMPORTE', MARGEN + 444, y + 7, { width: 76, align: 'right', lineBreak: false });

  return y + altoHeader;
}

function dibujarTablaPartidas(doc, yInicio, detalle) {
  let y = yInicio;
  if (y + 54 > LIMITE_INFERIOR) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  y = dibujarEncabezadoTabla(doc, y);
  const partidas = Array.isArray(detalle) ? detalle : [];

  if (partidas.length === 0) {
    doc.rect(MARGEN, y, ANCHO_CONTENIDO, 24)
      .fillAndStroke(COLORES.blanco, COLORES.bordeSuave);
    doc.font('Helvetica').fontSize(9).fillColor(COLORES.textoTenue);
    doc.text('Sin productos registrados.', MARGEN + 12, y + 7, {
      width: ANCHO_CONTENIDO - 24
    });
    return y + 34;
  }

  partidas.forEach((item, indice) => {
    const nombreProd = limpiarTexto(item.producto_nombre) || 'Producto';
    const unidad = limpiarTexto(item.unidad_medida) || '-';
    const cantidadTxt = formatearCantidad(item.cantidad);
    const precioTxt = formatearMoneda(item.precio_unitario);
    const importeTxt = formatearMoneda(item.importe);

    doc.font('Helvetica-Bold').fontSize(9);
    const altoNombre = doc.heightOfString(nombreProd, { width: 226 });
    const altoFila = Math.max(22, altoNombre + 11);

    if (y + altoFila > LIMITE_INFERIOR - 24) {
      doc.addPage();
      dibujarFranjaSuperior(doc);
      y = 30;
      y = dibujarEncabezadoTabla(doc, y);
    }

    const fondoFila = indice % 2 === 1 ? COLORES.fondoClaro : COLORES.blanco;
    doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoFila).fillColor(fondoFila).fill();
    doc.moveTo(MARGEN, y + altoFila)
      .lineTo(MARGEN + ANCHO_CONTENIDO, y + altoFila)
      .lineWidth(0.5)
      .strokeColor(COLORES.bordeSuave)
      .stroke();

    const textoY = y + 6;
    doc.font('Helvetica').fontSize(9).fillColor(COLORES.texto);
    doc.text(cantidadTxt, MARGEN + 8, textoY, { width: 46, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.textoSecundario);
    doc.text(unidad, MARGEN + 62, textoY, { width: 64, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORES.texto);
    doc.text(nombreProd, MARGEN + 132, textoY, { width: 226, lineBreak: true });
    doc.font('Helvetica').fontSize(9).fillColor(COLORES.textoSecundario);
    doc.text(precioTxt, MARGEN + 364, textoY, { width: 74, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORES.negro);
    doc.text(importeTxt, MARGEN + 444, textoY, { width: 76, align: 'right', lineBreak: false });

    y += altoFila;
  });

  doc.moveTo(MARGEN, y)
    .lineTo(MARGEN + ANCHO_CONTENIDO, y)
    .lineWidth(1)
    .strokeColor(COLORES.borde)
    .stroke();

  return y + 14;
}

function dibujarBloqueTotales(doc, yInicio, { filasSecundarias = [], etiquetaTotal, valorTotal, anchoCaja = 228 }) {
  const altoCalculado = 30 + filasSecundarias.length * 18 + 20;
  let y = yInicio;

  if (y + altoCalculado > LIMITE_INFERIOR - 52) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  const x = MARGEN + ANCHO_CONTENIDO - anchoCaja;
  const filasPrevias = filasSecundarias.filter((f) => f.antesDeTotal);
  const filasPosteriores = filasSecundarias.filter((f) => !f.antesDeTotal);

  let cursorY = y;

  filasPrevias.forEach((f) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORES.textoSecundario);
    doc.text(f.etiqueta, x + 8, cursorY, { width: 112, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORES.texto);
    doc.text(f.valor, x + 120, cursorY, { width: anchoCaja - 128, align: 'right', lineBreak: false });
    cursorY += 17;
  });

  doc.roundedRect(x, cursorY, anchoCaja, 26, 4).fillColor(COLORES.azul).fill();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORES.blanco);
  doc.text(etiquetaTotal, x + 10, cursorY + 8, { width: 112, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORES.blanco);
  doc.text(valorTotal, x + 120, cursorY + 7, { width: anchoCaja - 128, align: 'right', lineBreak: false });
  cursorY += 32;

  filasPosteriores.forEach((f) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORES.textoSecundario);
    doc.text(f.etiqueta, x + 8, cursorY, { width: 112, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORES.texto);
    doc.text(f.valor, x + 120, cursorY, { width: anchoCaja - 128, align: 'right', lineBreak: false });
    cursorY += 17;
  });

  return cursorY + 8;
}

function dibujarPieDocumento(doc, yInicio, { mensajePrincipal, referenciaFolio, lineaFirma = false }) {
  const textoMsg = limpiarTexto(mensajePrincipal);
  const anchoMsg = ANCHO_CONTENIDO - 16;
  doc.font('Helvetica').fontSize(8.5);
  const altoMsg = textoMsg ? doc.heightOfString(textoMsg, { width: anchoMsg }) : 0;
  const altoNecesario = (lineaFirma ? 42 : 0) + altoMsg + 32;

  let y = yInicio;
  if (y + altoNecesario > LIMITE_INFERIOR) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  if (lineaFirma) {
    y += 14;
    doc.moveTo(MARGEN + 140, y)
      .lineTo(MARGEN + ANCHO_CONTENIDO - 140, y)
      .lineWidth(0.8)
      .strokeColor(COLORES.borde)
      .stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORES.textoTenue);
    doc.text('Nombre y firma de recibido conforme', MARGEN, y + 4, {
      width: ANCHO_CONTENIDO,
      align: 'center'
    });
    y += 22;
  }

  y += 6;
  doc.moveTo(MARGEN, y)
    .lineTo(MARGEN + ANCHO_CONTENIDO, y)
    .lineWidth(0.8)
    .strokeColor(COLORES.bordeSuave)
    .stroke();
  y += 8;

  if (textoMsg) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.textoSecundario);
    doc.text(textoMsg, MARGEN + 8, y, { width: anchoMsg, align: 'center', lineBreak: true });
    y += altoMsg + 5;
  }

  doc.font('Helvetica').fontSize(7.5).fillColor(COLORES.textoTenue);
  doc.text(`Documento digital generado por Sistema POS - ${limpiarTexto(referenciaFolio)}`, MARGEN, y, {
    width: ANCHO_CONTENIDO,
    align: 'center'
  });
}

function construirBufferPdf(construirContenidoFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGEN, bottom: 32, left: MARGEN, right: MARGEN },
      autoFirstPage: true
    });

    const fragmentos = [];
    doc.on('data', (chunk) => fragmentos.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(fragmentos)));
    doc.on('error', reject);

    try {
      construirContenidoFn(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function generarPdfNotaVenta({ venta, detalle = [], entrega = null, negocio = {} }) {
  return construirBufferPdf((doc) => {
    const fechaStr = convertirFechaIsoATexto(venta.fecha_venta);
    const horaStr = extraerHoraTexto(venta.fecha_venta);
    const tipoTexto =
      venta.tipo_venta === 'CLIENTE' || entrega
        ? 'Con cliente / Entrega programada'
        : 'Venta general';

    let y = dibujarEncabezadoDocumento(doc, {
      negocio,
      tituloDoc: 'NOTA DE VENTA',
      folio: venta.folio,
      fechaStr,
      horaStr,
      estadoDoc: venta.estado
    });

    const clienteNombre = entrega?.cliente_nombre || venta.cliente_nombre || '';
    const clienteTel = entrega?.cliente_telefono || venta.cliente_telefono || '';
    const clienteDir = entrega?.direccion_entrega || venta.cliente_direccion || '';
    const referencias = entrega?.referencias || '';

    const filasDatos = [
      { etiqueta: 'Tipo de venta', valor: tipoTexto },
      ...(clienteNombre ? [{ etiqueta: 'Cliente', valor: clienteNombre }] : []),
      ...(clienteTel ? [{ etiqueta: 'Telefono', valor: clienteTel }] : []),
      ...(clienteDir ? [{ etiqueta: 'Direccion', valor: clienteDir }] : []),
      ...(referencias ? [{ etiqueta: 'Referencias', valor: referencias }] : []),
      ...(entrega?.fecha_entrega
        ? [
            {
              etiqueta: 'Entrega',
              valor: `${convertirFechaIsoATexto(entrega.fecha_entrega)}${
                entrega.horario_entrega ? ` (${entrega.horario_entrega})` : ''
              } - ${entrega.estado}`
            }
          ]
        : [])
    ];

    y = dibujarBloqueDatos(doc, y, filasDatos);

    const notaTexto = venta.nota_venta || entrega?.nota_entrega || '';
    if (limpiarTexto(notaTexto)) {
      y = dibujarBloqueNota(doc, y, 'NOTA DE LA VENTA', notaTexto);
    }

    y = dibujarTablaPartidas(doc, y, detalle);

    y = dibujarBloqueTotales(doc, y, {
      etiquetaTotal: 'TOTAL',
      valorTotal: formatearMoneda(venta.total),
      filasSecundarias: [
        {
          etiqueta: 'Subtotal',
          valor: formatearMoneda(venta.subtotal),
          antesDeTotal: true
        },
        {
          etiqueta: 'Dinero recibido',
          valor: formatearMoneda(venta.dinero_recibido),
          antesDeTotal: false
        },
        {
          etiqueta: 'Cambio entregado',
          valor: formatearMoneda(venta.cambio),
          antesDeTotal: false
        }
      ]
    });

    dibujarPieDocumento(doc, y, {
      mensajePrincipal: negocio.mensajeTicket || 'Gracias por su compra.',
      referenciaFolio: `Folio ${venta.folio}`,
      lineaFirma: Boolean(entrega)
    });
  });
}

async function generarPdfPresupuesto({ presupuesto, detalle = [], negocio = {} }) {
  return construirBufferPdf((doc) => {
    const fechaStr = convertirFechaIsoATexto(presupuesto.fecha_presupuesto);
    const horaStr = extraerHoraTexto(presupuesto.fecha_presupuesto);

    let y = dibujarEncabezadoDocumento(doc, {
      negocio,
      tituloDoc: 'PRESUPUESTO',
      folio: presupuesto.folio,
      fechaStr,
      horaStr,
      estadoDoc: presupuesto.estado
    });

    const filasDatos = [
      {
        etiqueta: 'Cliente',
        valor: presupuesto.cliente_nombre || 'Publico general'
      },
      ...(presupuesto.cliente_telefono
        ? [{ etiqueta: 'Telefono', valor: presupuesto.cliente_telefono }]
        : []),
      ...(presupuesto.cliente_direccion
        ? [{ etiqueta: 'Direccion', valor: presupuesto.cliente_direccion }]
        : []),
      ...(presupuesto.venta_folio
        ? [{ etiqueta: 'Venta ligada', valor: presupuesto.venta_folio }]
        : [])
    ];

    y = dibujarBloqueDatos(doc, y, filasDatos);

    if (limpiarTexto(presupuesto.notas)) {
      y = dibujarBloqueNota(doc, y, 'NOTAS DEL PRESUPUESTO', presupuesto.notas);
    }

    y = dibujarTablaPartidas(doc, y, detalle);

    y = dibujarBloqueTotales(doc, y, {
      etiquetaTotal: 'TOTAL ESTIMADO',
      valorTotal: formatearMoneda(presupuesto.total),
      filasSecundarias: [
        {
          etiqueta: 'Subtotal',
          valor: formatearMoneda(presupuesto.subtotal),
          antesDeTotal: true
        }
      ]
    });

    dibujarPieDocumento(doc, y, {
      mensajePrincipal:
        'Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.',
      referenciaFolio: `Presupuesto ${presupuesto.folio}`,
      lineaFirma: false
    });
  });
}

module.exports = {
  generarPdfNotaVenta,
  generarPdfPresupuesto
};

