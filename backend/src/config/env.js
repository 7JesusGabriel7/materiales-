const dotenv = require('dotenv');

dotenv.config();

const UNIDADES_MEDIDA = Object.freeze([
  'Pieza',
  'Bulto',
  'Kilogramo',
  'Tonelada',
  'Metro',
  'Metro cúbico',
  'Viaje'
]);

const TIPOS_MOVIMIENTO = Object.freeze([
  'ENTRADA',
  'SALIDA',
  'SALIDA_VENTA',
  'AJUSTE'
]);

module.exports = {
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'casa_materiales_pos',
    user: process.env.DB_USER || 'pos_usuario',
    password: process.env.DB_PASSWORD || ''
  },
  negocio: {
    nombre: process.env.NEGOCIO_NOMBRE || 'Casa de Materiales El Constructor',
    direccion: process.env.NEGOCIO_DIRECCION || 'Av. Principal No. 145, Col. Centro',
    telefono: process.env.NEGOCIO_TELEFONO || 'Tel. 555-234-8910',
    rfc: process.env.NEGOCIO_RFC || 'RFC: CME240101AB1',
    mensajeTicket:
      process.env.NEGOCIO_MENSAJE_TICKET ||
      'Gracias por su compra. Conserve este comprobante para cualquier aclaracion.'
  },
  UNIDADES_MEDIDA,
  TIPOS_MOVIMIENTO
};

