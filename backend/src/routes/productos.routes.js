const express = require('express');
const productosController = require('../controllers/productos.controller');

const router = express.Router();

router.get('/', productosController.listar);
router.get('/:id', productosController.obtener);
router.post('/', productosController.crear);
router.put('/:id', productosController.actualizar);
router.delete('/:id', productosController.eliminar);

module.exports = router;

