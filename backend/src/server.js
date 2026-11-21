const env = require('./config/env');
const { pool, verificarConexion } = require('./config/database');
const configuracionService = require('./services/configuracion.service');
const { ejecutarMigraciones } = require('./config/migrations');
const app = require('./app');

let servidor = null;

async function iniciarServidor() {
  try {
    await verificarConexion();
    await configuracionService.asegurarTablaConfiguracion();
    await ejecutarMigraciones();
    servidor = app.listen(env.server.port, () => {
      console.log(
        `Servidor POS iniciado en el puerto ${env.server.port} (entorno: ${env.server.nodeEnv})`
      );
    });
  } catch (error) {
    console.error('No fue posible conectar con MySQL al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

async function apagarServidor(senal) {
  console.log(`Senal ${senal} recibida. Cerrando servidor y conexiones...`);
  if (servidor) {
    await new Promise((resolve) => servidor.close(resolve));
  }
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => apagarServidor('SIGTERM'));
process.on('SIGINT', () => apagarServidor('SIGINT'));

iniciarServidor();

