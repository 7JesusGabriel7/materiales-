const express = require('express');
const ventasController = require('../controllers/ventas.controller');

const router = express.Router();

router.get('/resumen', ventasController.resumen);
router.get('/', ventasController.listar);
router.get('/:id/pdf', ventasController.descargarPdf);
router.get('/:id', ventasController.obtener);
router.post('/', ventasController.crear);

module.exports = router;

