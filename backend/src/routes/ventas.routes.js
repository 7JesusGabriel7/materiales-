const express = require('express');
const ventasController = require('../controllers/ventas.controller');

const router = express.Router();

router.get('/resumen', ventasController.resumen);
router.get('/por-cobrar/resumen', ventasController.resumenPorCobrar);
router.get('/por-cobrar', ventasController.listarPorCobrar);
router.get('/', ventasController.listar);
router.get('/:id/pdf', ventasController.descargarPdf);
router.patch('/:id/nombre', ventasController.asignarNombre);
router.post('/:id/abonos', ventasController.registrarAbono);
router.get('/:id', ventasController.obtener);
router.post('/', ventasController.crear);

module.exports = router;

