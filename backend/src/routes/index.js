const express = require('express');
const configController = require('../controllers/config.controller');
const categoriasRoutes = require('./categorias.routes');
const productosRoutes = require('./productos.routes');
const inventarioRoutes = require('./inventario.routes');
const ventasRoutes = require('./ventas.routes');
const clientesRoutes = require('./clientes.routes');
const presupuestosRoutes = require('./presupuestos.routes');
const entregasRoutes = require('./entregas.routes');

const router = express.Router();

router.get('/health', configController.obtenerSalud);
router.get('/config', configController.obtenerConfiguracion);
router.put('/config', configController.actualizarConfiguracion);
router.post('/config/pdf-ejemplo', configController.generarPdfEjemplo);

router.use('/categorias', categoriasRoutes);
router.use('/productos', productosRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/ventas', ventasRoutes);
router.use('/clientes', clientesRoutes);
router.use('/presupuestos', presupuestosRoutes);
router.use('/entregas', entregasRoutes);

module.exports = router;
