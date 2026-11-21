const express = require('express');
const presupuestosController = require('../controllers/presupuestos.controller');

const router = express.Router();

router.get('/', presupuestosController.listar);
router.get('/:id/pdf', presupuestosController.descargarPdf);
router.get('/:id', presupuestosController.obtener);
router.post('/', presupuestosController.crear);
router.patch('/:id/estado', presupuestosController.cambiarEstado);
router.delete('/:id', presupuestosController.eliminar);

module.exports = router;

