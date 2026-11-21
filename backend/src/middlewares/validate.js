const { AppError } = require('./errorHandler');
const { redondearMoneda, redondearCantidad } = require('../utils/formatters');

function parsearEnteroPositivo(valor, nombreCampo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new AppError(`El campo ${nombreCampo} debe ser un numero entero positivo.`, 400);
  }
  return numero;
}

function parsearDecimalNoNegativo(valor, nombreCampo, decimales = 2) {
  if (valor === undefined || valor === null || valor === '') {
    throw new AppError(`El campo ${nombreCampo} es obligatorio.`, 400);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new AppError(`El campo ${nombreCampo} debe ser un numero mayor o igual a cero.`, 400);
  }
  return decimales === 3 ? redondearCantidad(numero) : redondearMoneda(numero);
}

function parsearDecimalPositivo(valor, nombreCampo, decimales = 3) {
  if (valor === undefined || valor === null || valor === '') {
    throw new AppError(`El campo ${nombreCampo} es obligatorio.`, 400);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new AppError(`El campo ${nombreCampo} debe ser mayor a cero.`, 400);
  }
  const redondeado = decimales === 3 ? redondearCantidad(numero) : redondearMoneda(numero);
  if (redondeado <= 0) {
    throw new AppError(`El campo ${nombreCampo} debe ser mayor a cero.`, 400);
  }
  return redondeado;
}

function requerirTexto(valor, nombreCampo, { min = 1, max = 255 } = {}) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto.length < min) {
    throw new AppError(`El campo ${nombreCampo} es obligatorio.`, 400);
  }
  if (texto.length > max) {
    throw new AppError(
      `El campo ${nombreCampo} no puede exceder ${max} caracteres.`,
      400
    );
  }
  return texto;
}

function textoOpcional(valor, max = 1000) {
  if (valor === undefined || valor === null) {
    return null;
  }
  const texto = String(valor).trim();
  if (!texto) {
    return null;
  }
  if (texto.length > max) {
    throw new AppError(`El texto no puede exceder ${max} caracteres.`, 400);
  }
  return texto;
}

module.exports = {
  parsearEnteroPositivo,
  parsearDecimalNoNegativo,
  parsearDecimalPositivo,
  requerirTexto,
  textoOpcional
};

