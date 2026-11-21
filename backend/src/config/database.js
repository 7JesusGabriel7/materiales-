const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Verifica que la conexion a MySQL este disponible, con reintentos para arranque en contenedores.
 */
async function verificarConexion(reintentos = 10, esperaMs = 3000) {
  let ultimoError = null;
  for (let intento = 1; intento <= reintentos; intento += 1) {
    try {
      const conexion = await pool.getConnection();
      await conexion.query('SELECT 1');
      conexion.release();
      return;
    } catch (error) {
      ultimoError = error;
      console.warn(
        `Intento ${intento}/${reintentos} de conexion a MySQL fallido: ${error.message}`
      );
      if (intento < reintentos) {
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      }
    }
  }
  throw ultimoError;
}

/**
 * Ejecuta una operacion completa dentro de una transaccion SQL.
 */
async function conTransaccion(callback) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await callback(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    try {
      await conexion.rollback();
    } catch (rollbackError) {
      console.error('Error al revertir la transaccion SQL:', rollbackError.message);
    }
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = {
  pool,
  verificarConexion,
  conTransaccion
};

