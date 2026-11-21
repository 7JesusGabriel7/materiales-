const formatoMonedaMx = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatoNumeroMx = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

export function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export function redondearCantidad(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 1000) / 1000;
}

export function formatearMoneda(valor) {
  const num = Number(valor);
  return formatoMonedaMx.format(Number.isFinite(num) ? num : 0);
}

export function formatearCantidad(valor) {
  const num = Number(valor);
  if (!Number.isFinite(num)) {
    return '0';
  }
  return formatoNumeroMx.format(redondearCantidad(num));
}

export function formatearFecha(fechaSql) {
  if (!fechaSql) {
    return '-';
  }
  const soloFecha = String(fechaSql).slice(0, 10);
  const partes = soloFecha.split('-');
  if (partes.length !== 3) {
    return soloFecha;
  }
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function formatearHora(fechaSql) {
  if (!fechaSql || String(fechaSql).length < 19) {
    return '-';
  }
  return String(fechaSql).slice(11, 19);
}

export function formatearFechaHora(fechaSql) {
  if (!fechaSql) {
    return '-';
  }
  const hora = formatearHora(fechaSql);
  if (hora === '-') {
    return formatearFecha(fechaSql);
  }
  return `${formatearFecha(fechaSql)} ${hora}`;
}

export function escaparHtml(texto) {
  if (texto === undefined || texto === null) {
    return '';
  }
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Limpia cualquier caracter no numerico (letras o simbolos) dejando solo digitos y un punto decimal.
 */
export function sanitizarEntradaDecimal(valor, maxDecimales = 2) {
  const limpio = String(valor || '').replace(/[^0-9.]/g, '');
  const indicePunto = limpio.indexOf('.');
  if (indicePunto === -1) {
    return limpio;
  }
  const parteEntera = limpio.slice(0, indicePunto) || '0';
  const parteDecimal = limpio
    .slice(indicePunto + 1)
    .replace(/\./g, '')
    .slice(0, maxDecimales);
  return `${parteEntera}.${parteDecimal}`;
}

/**
 * Bloquea por completo teclas de letras y simbolos en entradas numericas de efectivo o cantidad.
 */
export function bloquearTeclasNoNumericas(event, { permitirDecimal = true } = {}) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const teclasPermitidas = [
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'Escape',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End'
  ];

  if (teclasPermitidas.includes(event.key)) {
    return;
  }

  if (/^[0-9]$/.test(event.key)) {
    return;
  }

  if (permitirDecimal && event.key === '.') {
    const valorActual = event.target?.value || '';
    if (!valorActual.includes('.')) {
      return;
    }
  }

  event.preventDefault();
}

