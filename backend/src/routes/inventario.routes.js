const express = require('express');
const inventarioController = require('../controllers/inventario.controller');

const router = express.Router();

router.get('/resumen', inventarioController.obtenerResumen);
router.get('/bajo-stock', inventarioController.listarBajoStock);
router.get('/movimientos', inventarioController.listarMovimientos);
router.post('/movimientos', inventarioController.registrarMovimiento);

module.exports = router;

