/**
 * Redondea un importe monetario a exactamente 2 decimales.
 */
function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondea una cantidad o existencia de inventario a exactamente 3 decimales.
 */
function redondearCantidad(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 1000) / 1000;
}

/**
 * Genera un folio unico legible a partir de la fecha y el identificador.
 * Ejemplo: VTA-20261121-000001 o PRE-20261121-000001
 */
function generarFolio(idRegistro, fechaSql, prefijo = 'VTA') {
  const fechaSolo = String(fechaSql || '').slice(0, 10).replace(/-/g, '');
  const fechaToken = /^\d{8}$/.test(fechaSolo)
    ? fechaSolo
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const consecutivo = String(idRegistro).padStart(6, '0');
  return `${prefijo}-${fechaToken}-${consecutivo}`;
}

/**
 * Valida si una cadena tiene formato YYYY-MM-DD y corresponde a una fecha real.
 */
function esFechaIsoValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

module.exports = {
  redondearMoneda,
  redondearCantidad,
  generarFolio,
  esFechaIsoValida
};

