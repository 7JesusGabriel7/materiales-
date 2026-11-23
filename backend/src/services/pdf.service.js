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

function normalizarEscalaLetra(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return 100;
  }
  const num = Number(valor);
  if (!Number.isFinite(num)) {
    return 100;
  }
  return Math.min(140, Math.max(75, Math.round(num)));
}

function escalar(base, factor = 1) {
  return Math.round(base * factor * 10) / 10;
}

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

function dibujarCamionVolteoSvgEnPdf(doc) {
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

  doc.roundedRect(10, 37, 121, 5, 1).fillColor(COLORES.negro).fill();

  [29, 49, 111].forEach((cx) => {
    doc.circle(cx, 46, 8).fillColor(COLORES.negro).fill();
    doc.circle(cx, 46, 3).fillColor(COLORES.blanco).fill();
  });
}

function dibujarCamionPlataformaPdf(doc) {
  // Tarima izquierda con blocks apilados
  doc.rect(16, 33, 30, 3).fillColor(COLORES.negro).fill();
  doc.rect(17, 15, 28, 17).lineWidth(1.8).fillAndStroke(COLORES.blanco, COLORES.negro);
  [21, 27].forEach((py) => {
    doc.moveTo(17, py).lineTo(45, py).lineWidth(1.4).strokeColor(COLORES.negro).stroke();
  });
  [
    [26, 15, 21],
    [35, 15, 21],
    [31, 21, 27],
    [26, 27, 33],
    [35, 27, 33]
  ].forEach(([px, y1, y2]) => {
    doc.moveTo(px, y1).lineTo(px, y2).lineWidth(1.2).strokeColor(COLORES.negro).stroke();
  });

  // Tarima derecha con bultos apilados
  doc.rect(50, 33, 28, 3).fillColor(COLORES.negro).fill();
  doc.roundedRect(51, 26, 26, 6, 2).lineWidth(1.5).fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.roundedRect(51, 19, 26, 6, 2).lineWidth(1.5).fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.roundedRect(54, 12, 20, 6, 2).lineWidth(1.5).fillAndStroke(COLORES.blanco, COLORES.negro);

  // Protector de cabina y cama plana
  doc.rect(82, 12, 4, 25).fillColor(COLORES.negro).fill();
  doc.rect(11, 36, 77, 4).fillColor(COLORES.negro).fill();

  // Cabina de carga
  doc.path('M89 20 L114 20 L126 29 L128 41 L89 41 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);

  doc.path('M94 23 L112 23 L120 29 L94 29 Z').fillColor(COLORES.negro).fill();
  doc.roundedRect(10, 38, 121, 4, 1).fillColor(COLORES.negro).fill();

  [28, 48, 110].forEach((cx) => {
    doc.circle(cx, 46, 8).fillColor(COLORES.negro).fill();
    doc.circle(cx, 46, 3).fillColor(COLORES.blanco).fill();
  });
}

function dibujarCamionRevolvedoraPdf(doc) {
  // Tolva y canalon trasero
  doc.path('M14 14 L26 14 L28 24 L18 27 Z').fillColor(COLORES.negro).fill();
  doc.path('M10 27 L20 24 L21 28 L11 31 Z').fillColor(COLORES.negro).fill();

  // Trompo mezclador inclinado
  doc.path('M22 25 L34 14 L64 9 L85 16 L85 32 L64 36 L27 33 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);

  [
    [38, 14, 46, 34],
    [53, 10, 62, 36],
    [70, 12, 76, 34]
  ].forEach(([x1, y1, x2, y2]) => {
    doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(1.8).strokeColor(COLORES.negro).stroke();
  });

  // Soportes y tanque auxiliar
  doc.path('M26 32 L34 32 L36 38 L24 38 Z').fillColor(COLORES.negro).fill();
  doc.rect(84, 15, 5, 22).fillColor(COLORES.negro).fill();
  doc.path('M72 34 L84 34 L84 38 L70 38 Z').fillColor(COLORES.negro).fill();

  // Cabina y chasis
  doc.path('M91 21 L114 21 L126 30 L128 42 L91 42 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.path('M96 24 L112 24 L120 30 L96 30 Z').fillColor(COLORES.negro).fill();
  doc.roundedRect(14, 37, 117, 5, 1).fillColor(COLORES.negro).fill();

  [31, 51, 111].forEach((cx) => {
    doc.circle(cx, 46, 8).fillColor(COLORES.negro).fill();
    doc.circle(cx, 46, 3).fillColor(COLORES.blanco).fill();
  });
}

function dibujarRetroexcavadoraPdf(doc) {
  // Estabilizador trasero y brazo retroexcavador izquierdo
  doc.path('M44 38 L39 50 L44 50 L48 39 Z').fillColor(COLORES.negro).fill();
  doc.path('M44 35 L33 10 L38 8 L49 32 Z').fillColor(COLORES.negro).fill();
  doc.path('M35 9 L19 25 L23 28 L38 13 Z')
    .lineWidth(1.8)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.path('M19 25 L10 30 L12 39 L23 36 L22 28 Z').fillColor(COLORES.negro).fill();

  // Chasis, cofre y escape
  doc.rect(46, 33, 48, 9).fillColor(COLORES.negro).fill();
  doc.path('M68 22 L92 24 L94 34 L68 34 Z')
    .lineWidth(1.8)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.rect(77, 17, 3, 6).fillColor(COLORES.negro).fill();

  // Cabina alta
  doc.path('M46 11 L68 11 L70 34 L44 34 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.path('M49 14 L65 14 L66 25 L48 25 Z').fillColor(COLORES.negro).fill();

  // Brazo cargador frontal y pala derecha
  doc.path('M66 27 L98 20 L108 38 L103 40 L95 25 L66 32 Z')
    .lineWidth(1.6)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.path('M107 34 L125 41 L127 48 L104 48 L104 37 Z').fillColor(COLORES.negro).fill();

  // Rueda trasera grande y delantera mediana
  doc.circle(54, 42, 11).fillColor(COLORES.negro).fill();
  doc.circle(54, 42, 4.5).fillColor(COLORES.blanco).fill();
  doc.circle(88, 45, 8).fillColor(COLORES.negro).fill();
  doc.circle(88, 45, 3).fillColor(COLORES.blanco).fill();
}

function dibujarExcavadoraOrugasPdf(doc) {
  // Tren de orugas
  doc.roundedRect(22, 40, 68, 13, 6).fillColor(COLORES.negro).fill();
  doc.roundedRect(26, 43, 60, 7, 3).fillColor(COLORES.blanco).fill();
  [31, 45, 59, 77].forEach((cx) => {
    doc.circle(cx, 46.5, 2.5).fillColor(COLORES.negro).fill();
  });

  // Base giratoria
  doc.rect(42, 36, 26, 5).fillColor(COLORES.negro).fill();

  // Contrapeso trasero y cabina
  doc.path('M24 21 L52 21 L52 36 L24 36 C20 36, 20 21, 24 21 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.rect(22, 23, 8, 12).fillColor(COLORES.negro).fill();

  doc.path('M52 13 L73 13 L77 36 L52 36 Z')
    .lineWidth(2)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.path('M55 16 L70 16 L73 27 L55 27 Z').fillColor(COLORES.negro).fill();

  // Pluma hidraulica, brazo y cucharon
  doc.path('M72 28 L93 8 L100 11 L77 34 Z')
    .lineWidth(1.8)
    .lineJoin('round')
    .fillAndStroke(COLORES.blanco, COLORES.negro);
  doc.moveTo(76, 22).lineTo(89, 14).lineWidth(1.6).strokeColor(COLORES.negro).stroke();
  doc.path('M95 9 L111 33 L105 35 L91 12 Z').fillColor(COLORES.negro).fill();
  doc.path('M107 34 L123 36 L126 46 L112 49 L104 42 Z').fillColor(COLORES.negro).fill();
}

function dibujarIlustracionDocumento(doc, icono, x, y, escala = 0.42) {
  if (!icono || icono === 'ninguno') {
    return;
  }

  doc.save();
  doc.translate(x, y);
  doc.scale(escala);

  switch (icono) {
    case 'camion_plataforma':
      dibujarCamionPlataformaPdf(doc);
      break;
    case 'camion_revolvedora':
      dibujarCamionRevolvedoraPdf(doc);
      break;
    case 'retroexcavadora':
      dibujarRetroexcavadoraPdf(doc);
      break;
    case 'excavadora_orugas':
      dibujarExcavadoraOrugasPdf(doc);
      break;
    case 'camion_volteo':
    default:
      dibujarCamionVolteoSvgEnPdf(doc);
      break;
  }

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

function dibujarEncabezadoDocumento(doc, { negocio, tituloDoc, folio, fechaStr, horaStr, estadoDoc, factor = 1 }) {
  dibujarFranjaSuperior(doc);

  const yInicio = 24;
  const iconoActivo =
    negocio.iconoTicket ||
    (negocio.mostrarCamionTicket === false ? 'ninguno' : 'camion_volteo');

  const cajaAncho = Math.round(194 + Math.max(0, factor - 1) * 45);
  const cajaX = MARGEN + ANCHO_CONTENIDO - cajaAncho;
  const cajaAlto = Math.max(76, Math.round(84 * Math.max(0.92, factor * 0.94)));

  let xTextoNegocio = MARGEN;
  let yFinIlustracion = yInicio;

  if (iconoActivo !== 'ninguno') {
    dibujarIlustracionDocumento(doc, iconoActivo, MARGEN, yInicio + 2, 0.42);
    xTextoNegocio = MARGEN + 68;
    yFinIlustracion = yInicio + 28;
  }

  const anchoTextoNegocio = Math.max(170, cajaX - xTextoNegocio - 12);
  const nombreNegocio = limpiarTexto(negocio.nombre) || 'Casa de Materiales';
  const direccionNegocio = limpiarTexto(negocio.direccion);
  const telefonoNegocio = limpiarTexto(negocio.telefono);
  const rfcNegocio = limpiarTexto(negocio.rfc);

  let yNeg = yInicio;
  doc.font('Helvetica-Bold').fontSize(escalar(15.5, factor)).fillColor(COLORES.negro);
  doc.text(nombreNegocio, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
  yNeg += doc.heightOfString(nombreNegocio, { width: anchoTextoNegocio }) + 4;

  doc.font('Helvetica').fontSize(escalar(10, factor)).fillColor(COLORES.texto);
  if (direccionNegocio) {
    doc.text(direccionNegocio, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
    yNeg += doc.heightOfString(direccionNegocio, { width: anchoTextoNegocio }) + 2;
  }
  const contacto = [telefonoNegocio, rfcNegocio].filter(Boolean).join('  |  ');
  if (contacto) {
    doc.text(contacto, xTextoNegocio, yNeg, { width: anchoTextoNegocio, lineBreak: true });
    yNeg += doc.heightOfString(contacto, { width: anchoTextoNegocio }) + 2;
  }

  const fBox = Math.min(factor, 1.15);
  doc.roundedRect(cajaX, yInicio, cajaAncho, cajaAlto, 5).fillColor(COLORES.negro).fill();
  doc.rect(cajaX, yInicio, cajaAncho, 4).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(escalar(9.5, fBox)).fillColor('#93c5fd');
  doc.text(tituloDoc, cajaX + 12, yInicio + 10, { width: cajaAncho - 24, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(escalar(13, fBox)).fillColor(COLORES.blanco);
  doc.text(limpiarTexto(folio) || '-', cajaX + 12, yInicio + Math.round(10 + 13 * fBox), {
    width: cajaAncho - 24,
    align: 'right'
  });

  doc.font('Helvetica').fontSize(escalar(9.5, fBox)).fillColor('#cbd5e1');
  doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, cajaX + 12, yInicio + Math.round(27 + 16 * fBox), {
    width: cajaAncho - 24,
    align: 'right'
  });

  if (estadoDoc) {
    doc.font('Helvetica-Bold').fontSize(escalar(9.5, fBox)).fillColor('#e2e8f0');
    doc.text(`Estado: ${limpiarTexto(estadoDoc)}`, cajaX + 12, yInicio + Math.round(41 + 18 * fBox), {
      width: cajaAncho - 24,
      align: 'right'
    });
  }

  const yBase = Math.max(yNeg, yFinIlustracion, yInicio + cajaAlto) + 12;
  doc.moveTo(MARGEN, yBase)
    .lineTo(MARGEN + ANCHO_CONTENIDO, yBase)
    .lineWidth(1)
    .strokeColor(COLORES.borde)
    .stroke();

  return yBase + 12;
}

function dibujarBloqueDatos(doc, yInicio, filas, factor = 1) {
  const filasValidas = filas.filter((f) => f && f.valor);
  if (filasValidas.length === 0) {
    return yInicio;
  }

  const anchoEtiq = Math.min(160, Math.round(116 * Math.max(1, factor)));
  const xValor = MARGEN + 14 + anchoEtiq + 6;
  const anchoTexto = ANCHO_CONTENIDO - (anchoEtiq + 34);
  const tamValor = escalar(10.5, factor);
  const tamEtiq = escalar(10, factor);
  const altoMinFila = Math.max(13, Math.round(16 * factor));

  doc.font('Helvetica').fontSize(tamValor);

  const medidas = filasValidas.map((fila) => {
    const etiqueta = `${limpiarTexto(fila.etiqueta)}:`;
    const valor = limpiarTexto(fila.valor);
    const alto = Math.max(altoMinFila, doc.heightOfString(valor, { width: anchoTexto }) + 3);
    return { etiqueta, valor, alto };
  });

  const altoTotal = medidas.reduce((acc, m) => acc + m.alto, 0) + 18;

  doc.roundedRect(MARGEN, yInicio, ANCHO_CONTENIDO, altoTotal, 5)
    .fillAndStroke(COLORES.fondoClaro, COLORES.borde);
  doc.rect(MARGEN, yInicio, 4, altoTotal).fillColor(COLORES.azul).fill();

  let cursorY = yInicio + 10;
  medidas.forEach((m) => {
    doc.font('Helvetica-Bold').fontSize(tamEtiq).fillColor(COLORES.textoSecundario);
    doc.text(m.etiqueta, MARGEN + 14, cursorY, { width: anchoEtiq, lineBreak: false });

    doc.font('Helvetica').fontSize(tamValor).fillColor(COLORES.texto);
    doc.text(m.valor, xValor, cursorY, { width: anchoTexto, lineBreak: true });

    cursorY += m.alto;
  });

  return yInicio + altoTotal + 10;
}

function dibujarBloqueNota(doc, yInicio, titulo, textoNota, factor = 1) {
  const notaLimpia = limpiarTexto(textoNota);
  if (!notaLimpia) {
    return yInicio;
  }

  const anchoTexto = ANCHO_CONTENIDO - 28;
  const tamTitulo = escalar(9.5, factor);
  const tamCuerpo = escalar(11, factor);
  doc.font('Helvetica').fontSize(tamCuerpo);
  const altoNota = doc.heightOfString(notaLimpia, { width: anchoTexto });
  const offsetCuerpo = Math.round(10 + 11 * factor + 2);
  const altoTotal = altoNota + Math.round(23 + 11 * factor);

  let y = yInicio;
  if (y + altoTotal > LIMITE_INFERIOR - 60) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  doc.roundedRect(MARGEN, y, ANCHO_CONTENIDO, altoTotal, 5)
    .fillAndStroke(COLORES.azulSuave, COLORES.azulBorde);
  doc.rect(MARGEN, y, 4, altoTotal).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(tamTitulo).fillColor(COLORES.azul);
  doc.text(titulo, MARGEN + 14, y + 8, { width: anchoTexto });

  doc.font('Helvetica').fontSize(tamCuerpo).fillColor(COLORES.texto);
  doc.text(notaLimpia, MARGEN + 14, y + offsetCuerpo, { width: anchoTexto, lineBreak: true });

  return y + altoTotal + 12;
}

function obtenerColumnasPartidas(factor = 1) {
  const wCant = Math.round(48 * Math.max(1, factor * 0.92));
  const wUnid = Math.round(68 * Math.max(1, factor * 0.92));
  const wPrec = Math.round(80 * Math.max(1, factor * 0.95));
  const wImp = Math.round(82 * Math.max(1, factor * 0.95));
  const xCant = MARGEN + 6;
  const xUnid = xCant + wCant + 6;
  const xDesc = xUnid + wUnid + 6;
  const wDesc = ANCHO_CONTENIDO - (6 + wCant + 6 + wUnid + 6 + 6 + wPrec + 6 + wImp + 6);
  const xPrec = xDesc + wDesc + 6;
  const xImp = xPrec + wPrec + 6;
  return { xCant, wCant, xUnid, wUnid, xDesc, wDesc, xPrec, wPrec, xImp, wImp };
}

function dibujarEncabezadoTabla(doc, y, factor = 1) {
  const altoHeader = Math.max(22, Math.round(26 * factor));
  const cols = obtenerColumnasPartidas(factor);
  const tamHeader = Math.min(12, escalar(9.5, factor));
  const headerY = y + Math.max(6, Math.round((altoHeader - tamHeader) / 2));

  doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoHeader).fillColor(COLORES.negro).fill();
  doc.rect(MARGEN, y + altoHeader - 2, ANCHO_CONTENIDO, 2).fillColor(COLORES.azul).fill();

  doc.font('Helvetica-Bold').fontSize(tamHeader).fillColor(COLORES.blanco);
  doc.text('CANT.', cols.xCant, headerY, { width: cols.wCant, align: 'right', lineBreak: false });
  doc.text('UNIDAD', cols.xUnid, headerY, { width: cols.wUnid, lineBreak: false });
  doc.text('MATERIAL / DESCRIPCION', cols.xDesc, headerY, { width: cols.wDesc, lineBreak: false });
  doc.text('P. UNITARIO', cols.xPrec, headerY, { width: cols.wPrec, align: 'right', lineBreak: false });
  doc.text('IMPORTE', cols.xImp, headerY, { width: cols.wImp, align: 'right', lineBreak: false });

  return y + altoHeader;
}

function dibujarTablaPartidas(doc, yInicio, detalle, factor = 1) {
  let y = yInicio;
  if (y + 54 > LIMITE_INFERIOR) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  y = dibujarEncabezadoTabla(doc, y, factor);
  const partidas = Array.isArray(detalle) ? detalle : [];
  const cols = obtenerColumnasPartidas(factor);
  const tamTexto = escalar(10.5, factor);
  const tamUnidad = escalar(10, factor);
  const altoMinFila = Math.max(22, Math.round(26 * factor));

  if (partidas.length === 0) {
    doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoMinFila)
      .fillAndStroke(COLORES.blanco, COLORES.bordeSuave);
    doc.font('Helvetica').fontSize(tamTexto).fillColor(COLORES.textoTenue);
    doc.text('Sin productos registrados.', MARGEN + 12, y + 7, {
      width: ANCHO_CONTENIDO - 24
    });
    return y + altoMinFila + 10;
  }

  partidas.forEach((item, indice) => {
    const nombreProd = limpiarTexto(item.producto_nombre) || 'Producto';
    const unidad = limpiarTexto(item.unidad_medida) || '-';
    const cantidadTxt = formatearCantidad(item.cantidad);
    const precioTxt = formatearMoneda(item.precio_unitario);
    const importeTxt = formatearMoneda(item.importe);

    doc.font('Helvetica-Bold').fontSize(tamTexto);
    const altoNombre = doc.heightOfString(nombreProd, { width: cols.wDesc });
    doc.font('Helvetica').fontSize(tamUnidad);
    const altoUnidad = doc.heightOfString(unidad, { width: cols.wUnid });
    const altoFila = Math.max(altoMinFila, Math.max(altoNombre, altoUnidad) + 12);

    if (y + altoFila > LIMITE_INFERIOR - 24) {
      doc.addPage();
      dibujarFranjaSuperior(doc);
      y = 30;
      y = dibujarEncabezadoTabla(doc, y, factor);
    }

    const fondoFila = indice % 2 === 1 ? COLORES.fondoClaro : COLORES.blanco;
    doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoFila).fillColor(fondoFila).fill();
    doc.moveTo(MARGEN, y + altoFila)
      .lineTo(MARGEN + ANCHO_CONTENIDO, y + altoFila)
      .lineWidth(0.5)
      .strokeColor(COLORES.bordeSuave)
      .stroke();

    const textoY = y + 7;
    doc.font('Helvetica-Bold').fontSize(tamTexto).fillColor(COLORES.texto);
    doc.text(cantidadTxt, cols.xCant, textoY, { width: cols.wCant, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(tamUnidad).fillColor(COLORES.textoSecundario);
    doc.text(unidad, cols.xUnid, textoY, { width: cols.wUnid, lineBreak: true });
    doc.font('Helvetica-Bold').fontSize(tamTexto).fillColor(COLORES.texto);
    doc.text(nombreProd, cols.xDesc, textoY, { width: cols.wDesc, lineBreak: true });
    doc.font('Helvetica').fontSize(tamTexto).fillColor(COLORES.textoSecundario);
    doc.text(precioTxt, cols.xPrec, textoY, { width: cols.wPrec, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(tamTexto).fillColor(COLORES.negro);
    doc.text(importeTxt, cols.xImp, textoY, { width: cols.wImp, align: 'right', lineBreak: false });

    y += altoFila;
  });

  doc.moveTo(MARGEN, y)
    .lineTo(MARGEN + ANCHO_CONTENIDO, y)
    .lineWidth(1)
    .strokeColor(COLORES.borde)
    .stroke();

  return y + 14;
}

function dibujarBloqueTotales(doc, yInicio, { filasSecundarias = [], etiquetaTotal, valorTotal, anchoCaja = 268, factor = 1 }) {
  const anchoFinal = Math.min(ANCHO_CONTENIDO, Math.round(anchoCaja * Math.max(1, factor * 0.95)));
  const pasoLinea = Math.max(17, Math.round(20 * factor));
  const altoBarraTotal = Math.max(26, Math.round(30 * factor));
  const altoBarraDest = Math.max(24, Math.round(28 * factor));
  const altoCalculado = altoBarraTotal + filasSecundarias.length * (pasoLinea + 6) + 24;

  let y = yInicio;

  if (y + altoCalculado > LIMITE_INFERIOR - 52) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  const x = MARGEN + ANCHO_CONTENIDO - anchoFinal;
  const anchoEtiq = Math.round(anchoFinal * 0.52);
  const xVal = x + anchoEtiq + 12;
  const anchoVal = anchoFinal - anchoEtiq - 20;
  const filasPrevias = filasSecundarias.filter((f) => f.antesDeTotal);
  const filasPosteriores = filasSecundarias.filter((f) => !f.antesDeTotal);

  const tamLinea = escalar(11, factor);
  const tamEtiqTotal = escalar(11.5, factor);
  const tamValTotal = escalar(13, factor);
  const tamDest = escalar(12.5, factor);

  let cursorY = y;

  filasPrevias.forEach((f) => {
    doc.font('Helvetica').fontSize(tamLinea).fillColor(COLORES.textoSecundario);
    doc.text(f.etiqueta, x + 8, cursorY, { width: anchoEtiq, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(tamLinea).fillColor(COLORES.texto);
    doc.text(f.valor, xVal, cursorY, { width: anchoVal, align: 'right', lineBreak: false });
    cursorY += pasoLinea;
  });

  doc.roundedRect(x, cursorY, anchoFinal, altoBarraTotal, 4).fillColor(COLORES.azul).fill();
  doc.font('Helvetica-Bold').fontSize(tamEtiqTotal).fillColor(COLORES.blanco);
  doc.text(etiquetaTotal, x + 10, cursorY + Math.round((altoBarraTotal - tamEtiqTotal) / 2), {
    width: anchoEtiq,
    lineBreak: false
  });
  doc.font('Helvetica-Bold').fontSize(tamValTotal).fillColor(COLORES.blanco);
  doc.text(valorTotal, xVal, cursorY + Math.round((altoBarraTotal - tamValTotal) / 2), {
    width: anchoVal,
    align: 'right',
    lineBreak: false
  });
  cursorY += altoBarraTotal + 6;

  filasPosteriores.forEach((f) => {
    const etiquetaFinal = f.etiqueta;
    if (f.destacado) {
      cursorY += 2;
      doc.roundedRect(x, cursorY, anchoFinal, altoBarraDest, 4).fillColor(f.colorFondo || COLORES.negro).fill();
      doc.font('Helvetica-Bold').fontSize(tamLinea).fillColor(COLORES.blanco);
      doc.text(etiquetaFinal, x + 10, cursorY + Math.round((altoBarraDest - tamLinea) / 2), {
        width: anchoEtiq,
        lineBreak: false
      });
      doc.font('Helvetica-Bold').fontSize(tamDest).fillColor(COLORES.blanco);
      doc.text(f.valor, xVal, cursorY + Math.round((altoBarraDest - tamDest) / 2), {
        width: anchoVal,
        align: 'right',
        lineBreak: false
      });
      cursorY += altoBarraDest + 6;
      return;
    }

    doc.font(f.negrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(tamLinea)
      .fillColor(COLORES.textoSecundario);
    doc.text(etiquetaFinal, x + 8, cursorY, { width: anchoEtiq, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(tamLinea).fillColor(COLORES.texto);
    doc.text(f.valor, xVal, cursorY, {
      width: anchoVal,
      align: 'right',
      lineBreak: false
    });
    cursorY += pasoLinea;
  });

  return cursorY + 8;
}

const ETIQUETAS_TIPO_PAGO_PDF = {
  ANTICIPO: 'Anticipo inicial',
  ABONO: 'Abono',
  LIQUIDACION: 'Liquidacion final'
};

function dibujarTablaPagosPdf(doc, yInicio, pagos, factor = 1) {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return yInicio;
  }

  let y = yInicio;
  if (y + 68 > LIMITE_INFERIOR - 30) {
    doc.addPage();
    dibujarFranjaSuperior(doc);
    y = 30;
  }

  const tamSec = escalar(10, factor);
  const tamHeader = Math.min(11, escalar(9, factor));
  const tamFila = escalar(9.5, factor);
  const altoHeader = Math.max(20, Math.round(24 * factor));
  const altoMinFila = Math.max(19, Math.round(22 * factor));

  const wFecha = Math.round(98 * Math.max(1, factor * 0.92));
  const wMov = Math.round(98 * Math.max(1, factor * 0.92));
  const wAbono = Math.round(78 * Math.max(1, factor * 0.95));
  const wSaldo = Math.round(80 * Math.max(1, factor * 0.95));
  const xFecha = MARGEN + 6;
  const xMov = xFecha + wFecha + 4;
  const xNota = xMov + wMov + 4;
  const wNota = ANCHO_CONTENIDO - (6 + wFecha + 4 + wMov + 4 + 4 + wAbono + 4 + wSaldo + 6);
  const xAbono = xNota + wNota + 4;
  const xSaldo = xAbono + wAbono + 4;

  doc.font('Helvetica-Bold').fontSize(tamSec).fillColor(COLORES.azul);
  doc.text('HISTORIAL DE PAGOS Y ABONOS', MARGEN, y, { width: ANCHO_CONTENIDO });
  y += Math.round(14 + 4 * factor);

  const dibujarHeaderPagos = (posY) => {
    const hY = posY + Math.max(5, Math.round((altoHeader - tamHeader) / 2));
    doc.rect(MARGEN, posY, ANCHO_CONTENIDO, altoHeader).fillColor(COLORES.negro).fill();
    doc.font('Helvetica-Bold').fontSize(tamHeader).fillColor(COLORES.blanco);
    doc.text('FECHA / HORA', xFecha, hY, { width: wFecha, lineBreak: false });
    doc.text('MOVIMIENTO', xMov, hY, { width: wMov, lineBreak: false });
    doc.text('NOTA', xNota, hY, { width: wNota, lineBreak: false });
    doc.text('ABONO', xAbono, hY, { width: wAbono, align: 'right', lineBreak: false });
    doc.text('SALDO REST.', xSaldo, hY, {
      width: wSaldo,
      align: 'right',
      lineBreak: false
    });
    return posY + altoHeader;
  };

  y = dibujarHeaderPagos(y);

  pagos.forEach((p, idx) => {
    const notaPago = limpiarTexto(p.nota) || '-';
    const fechaPagoTxt = `${convertirFechaIsoATexto(p.fecha_pago)} ${extraerHoraTexto(p.fecha_pago)}`.trim();
    const movTxt = ETIQUETAS_TIPO_PAGO_PDF[p.tipo] || limpiarTexto(p.tipo) || 'Pago';

    doc.font('Helvetica').fontSize(tamFila);
    const altoNota = doc.heightOfString(notaPago, { width: wNota });
    const altoFecha = doc.heightOfString(fechaPagoTxt, { width: wFecha });
    const altoFila = Math.max(altoMinFila, Math.max(altoNota, altoFecha) + 10);

    if (y + altoFila > LIMITE_INFERIOR - 24) {
      doc.addPage();
      dibujarFranjaSuperior(doc);
      y = 30;
      y = dibujarHeaderPagos(y);
    }

    const fondo = idx % 2 === 1 ? COLORES.fondoClaro : COLORES.blanco;
    doc.rect(MARGEN, y, ANCHO_CONTENIDO, altoFila).fillColor(fondo).fill();
    doc.moveTo(MARGEN, y + altoFila)
      .lineTo(MARGEN + ANCHO_CONTENIDO, y + altoFila)
      .lineWidth(0.5)
      .strokeColor(COLORES.bordeSuave)
      .stroke();

    doc.font('Helvetica').fontSize(tamFila).fillColor(COLORES.textoSecundario);
    doc.text(fechaPagoTxt, xFecha, y + 6, { width: wFecha, lineBreak: true });
    doc.font('Helvetica-Bold').fontSize(tamFila).fillColor(COLORES.texto);
    doc.text(movTxt, xMov, y + 6, { width: wMov, lineBreak: true });
    doc.font('Helvetica').fontSize(tamFila).fillColor(COLORES.textoSecundario);
    doc.text(notaPago, xNota, y + 6, { width: wNota, lineBreak: true });
    doc.font('Helvetica-Bold').fontSize(tamFila).fillColor(COLORES.negro);
    doc.text(formatearMoneda(p.monto), xAbono, y + 6, {
      width: wAbono,
      align: 'right',
      lineBreak: false
    });
    doc.font('Helvetica').fontSize(tamFila).fillColor(COLORES.texto);
    doc.text(formatearMoneda(p.saldo_nuevo), xSaldo, y + 6, {
      width: wSaldo,
      align: 'right',
      lineBreak: false
    });

    y += altoFila;
  });

  return y + 12;
}

function dibujarPieDocumento(doc, yInicio, { mensajePrincipal, referenciaFolio, lineaFirma = false, factor = 1 }) {
  const textoMsg = limpiarTexto(mensajePrincipal);
  const anchoMsg = ANCHO_CONTENIDO - 16;
  const tamMsg = escalar(10, factor);
  const tamFirma = escalar(9.5, factor);
  const tamPie = escalar(8.5, factor);

  doc.font('Helvetica').fontSize(tamMsg);
  const altoMsg = textoMsg ? doc.heightOfString(textoMsg, { width: anchoMsg }) : 0;
  const altoNecesario = (lineaFirma ? Math.round(46 * factor) : 0) + altoMsg + 36;

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
    doc.font('Helvetica').fontSize(tamFirma).fillColor(COLORES.textoTenue);
    doc.text('Nombre y firma de recibido conforme', MARGEN, y + 5, {
      width: ANCHO_CONTENIDO,
      align: 'center'
    });
    y += Math.round(16 + tamFirma);
  }

  y += 6;
  doc.moveTo(MARGEN, y)
    .lineTo(MARGEN + ANCHO_CONTENIDO, y)
    .lineWidth(0.8)
    .strokeColor(COLORES.bordeSuave)
    .stroke();
  y += 8;

  if (textoMsg) {
    doc.font('Helvetica').fontSize(tamMsg).fillColor(COLORES.textoSecundario);
    doc.text(textoMsg, MARGEN + 8, y, { width: anchoMsg, align: 'center', lineBreak: true });
    y += altoMsg + 6;
  }

  doc.font('Helvetica').fontSize(tamPie).fillColor(COLORES.textoTenue);
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

async function generarPdfNotaVenta({
  venta,
  detalle = [],
  entrega = null,
  pagos = [],
  negocio = {}
}) {
  return construirBufferPdf((doc) => {
    const factor =
      normalizarEscalaLetra(negocio.escalaLetraPdf ?? negocio.escala_letra_pdf) /
      100;
    const fechaStr = convertirFechaIsoATexto(venta.fecha_venta);
    const horaStr = extraerHoraTexto(venta.fecha_venta);
    const tipoTexto =
      venta.tipo_venta === 'CLIENTE' || entrega
        ? 'Con cliente / Entrega programada'
        : 'Venta general';

    const saldoPendiente = Number(venta.saldo_pendiente || 0);
    const esParcial =
      Boolean(Number(venta.es_pago_parcial)) ||
      venta.estado_pago === 'PENDIENTE' ||
      saldoPendiente > 0;
    const totalNum = Number(venta.total || 0);
    const montoPagado = esParcial
      ? Number(venta.monto_pagado || 0)
      : totalNum;

    const estadoDoc = esParcial
      ? saldoPendiente > 0
        ? 'SALDO PENDIENTE'
        : 'LIQUIDADA'
      : venta.estado;

    let y = dibujarEncabezadoDocumento(doc, {
      negocio,
      tituloDoc: 'NOTA DE VENTA',
      folio: venta.folio,
      fechaStr,
      horaStr,
      estadoDoc,
      factor
    });

    const clienteNombre = entrega?.cliente_nombre || venta.cliente_nombre || '';
    const nombreAsignado = venta.nombre_pendiente || '';
    const clienteTel = entrega?.cliente_telefono || venta.cliente_telefono || '';
    const clienteDir = entrega?.direccion_entrega || venta.cliente_direccion || '';
    const referencias = entrega?.referencias || '';

    const condicionPagoTexto = esParcial
      ? saldoPendiente > 0
        ? 'Pago parcial (con saldo pendiente)'
        : 'Pago parcial liquidado'
      : 'Pago completo de contado';

    const filasDatos = [
      { etiqueta: 'Tipo de venta', valor: tipoTexto },
      { etiqueta: 'Condicion de pago', valor: condicionPagoTexto },
      ...(nombreAsignado
        ? [{ etiqueta: 'Nombre asignado', valor: nombreAsignado }]
        : []),
      ...(clienteNombre && clienteNombre !== nombreAsignado
        ? [{ etiqueta: 'Cliente', valor: clienteNombre }]
        : []),
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

    y = dibujarBloqueDatos(doc, y, filasDatos, factor);

    const notaTexto = venta.nota_venta || entrega?.nota_entrega || '';
    if (limpiarTexto(notaTexto)) {
      y = dibujarBloqueNota(doc, y, 'NOTA DE LA VENTA', notaTexto, factor);
    }

    y = dibujarTablaPartidas(doc, y, detalle, factor);

    const filasTotalesSecundarias = [
      {
        etiqueta: 'Subtotal',
        valor: formatearMoneda(venta.subtotal),
        antesDeTotal: true
      }
    ];

    if (esParcial) {
      filasTotalesSecundarias.push({
        etiqueta: 'Pagado / Abonado',
        valor: formatearMoneda(montoPagado),
        antesDeTotal: false,
        negrita: true
      });
      filasTotalesSecundarias.push({
        etiqueta: saldoPendiente > 0 ? 'SALDO PENDIENTE' : 'SALDO LIQUIDADO',
        valor: formatearMoneda(saldoPendiente),
        antesDeTotal: false,
        destacado: true,
        colorFondo: saldoPendiente > 0 ? COLORES.negro : '#166534'
      });
    } else {
      filasTotalesSecundarias.push(
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
      );
    }

    y = dibujarBloqueTotales(doc, y, {
      etiquetaTotal: 'TOTAL',
      valorTotal: formatearMoneda(venta.total),
      anchoCaja: 274,
      factor,
      filasSecundarias: filasTotalesSecundarias
    });

    if (esParcial && Array.isArray(pagos) && pagos.length > 0) {
      y = dibujarTablaPagosPdf(doc, y, pagos, factor);
    }

    dibujarPieDocumento(doc, y, {
      mensajePrincipal:
        negocio.mensajePdf ||
        negocio.mensajeTicket ||
        'Gracias por su compra.',
      referenciaFolio: `Folio ${venta.folio}`,
      lineaFirma: Boolean(entrega),
      factor
    });
  });
}

async function generarPdfPresupuesto({ presupuesto, detalle = [], negocio = {} }) {
  return construirBufferPdf((doc) => {
    const factor =
      normalizarEscalaLetra(negocio.escalaLetraPdf ?? negocio.escala_letra_pdf) /
      100;
    const fechaStr = convertirFechaIsoATexto(presupuesto.fecha_presupuesto);
    const horaStr = extraerHoraTexto(presupuesto.fecha_presupuesto);

    let y = dibujarEncabezadoDocumento(doc, {
      negocio,
      tituloDoc: 'PRESUPUESTO',
      folio: presupuesto.folio,
      fechaStr,
      horaStr,
      estadoDoc: presupuesto.estado,
      factor
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

    y = dibujarBloqueDatos(doc, y, filasDatos, factor);

    if (limpiarTexto(presupuesto.notas)) {
      y = dibujarBloqueNota(doc, y, 'NOTAS DEL PRESUPUESTO', presupuesto.notas, factor);
    }

    y = dibujarTablaPartidas(doc, y, detalle, factor);

    y = dibujarBloqueTotales(doc, y, {
      etiquetaTotal: 'TOTAL ESTIMADO',
      valorTotal: formatearMoneda(presupuesto.total),
      factor,
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
        negocio.mensajePresupuesto ||
        'Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.',
      referenciaFolio: `Presupuesto ${presupuesto.folio}`,
      lineaFirma: false,
      factor
    });
  });
}

module.exports = {
  generarPdfNotaVenta,
  generarPdfPresupuesto
};

