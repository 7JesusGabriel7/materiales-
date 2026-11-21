const express = require('express');
const entregasController = require('../controllers/entregas.controller');

const router = express.Router();

router.get('/resumen', entregasController.resumen);
router.get('/', entregasController.listar);
router.get('/:id/pdf', entregasController.descargarPdf);
router.get('/:id', entregasController.obtener);
router.put('/:id', entregasController.actualizar);
router.patch('/:id/estado', entregasController.cambiarEstado);

module.exports = router;

