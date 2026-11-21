const express = require('express');
const categoriasController = require('../controllers/categorias.controller');

const router = express.Router();

router.get('/', categoriasController.listar);
router.get('/:id', categoriasController.obtener);
router.post('/', categoriasController.crear);
router.put('/:id', categoriasController.actualizar);
router.delete('/:id', categoriasController.eliminar);

module.exports = router;

