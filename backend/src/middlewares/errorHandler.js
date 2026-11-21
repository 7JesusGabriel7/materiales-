class AppError extends Error {
  constructor(mensaje, statusCode = 400, detalle = null) {
    super(mensaje);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.detalle = detalle;
  }
}

/**
 * Envuelve controladores asincronos para delegar errores al middleware global.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: `Recurso no encontrado: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const cuerpo = { ok: false, error: err.message };
    if (err.detalle) {
      cuerpo.detalle = err.detalle;
    }
    return res.status(err.statusCode).json(cuerpo);
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      ok: false,
      error: 'El cuerpo de la solicitud no contiene un JSON valido.'
    });
  }

  if (err && err.code) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        error: 'Ya existe un registro con el mismo codigo o nombre unico.'
      });
    }
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        ok: false,
        error: 'No se puede eliminar el registro porque tiene movimientos o productos asociados.'
      });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        ok: false,
        error: 'La referencia seleccionada (categoria o producto) no existe.'
      });
    }
    if (err.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({
        ok: false,
        error: 'Uno de los campos excede la longitud maxima permitida.'
      });
    }
  }

  console.error('Error interno no controlado:', err);
  return res.status(500).json({
    ok: false,
    error: 'Ocurrio un error interno en el servidor. Intente nuevamente.'
  });
}

module.exports = {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler
};

