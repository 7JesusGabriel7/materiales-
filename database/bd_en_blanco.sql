-- Base de datos en blanco (solo estructura, 0 registros)
-- Sistema de Punto de Venta - Casa de Materiales
-- Motor: MySQL 8.0 (InnoDB, utf8mb4)

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS casa_materiales_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE casa_materiales_pos;

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: casa_materiales_pos
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencias` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clientes_nombre` (`nombre`),
  KEY `idx_clientes_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `configuracion_negocio`
--

DROP TABLE IF EXISTS `configuracion_negocio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracion_negocio` (
  `id` tinyint unsigned NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfc` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_ticket` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_presupuesto` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_pdf` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mostrar_camion_ticket` tinyint(1) NOT NULL DEFAULT '1',
  `icono_ticket` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'camion_volteo',
  `fecha_modificacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `detalle_presupuestos`
--

DROP TABLE IF EXISTS `detalle_presupuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalle_presupuestos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `presupuesto_id` int unsigned NOT NULL,
  `producto_id` int unsigned DEFAULT NULL,
  `producto_codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `producto_nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidad_medida` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` decimal(12,3) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `importe` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_det_presupuesto` (`presupuesto_id`),
  KEY `idx_det_pres_producto` (`producto_id`),
  CONSTRAINT `fk_det_pres_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_det_presupuesto` FOREIGN KEY (`presupuesto_id`) REFERENCES `presupuestos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_det_pres_valores` CHECK (((`cantidad` >= 1) and (`precio_unitario` >= 0) and (`importe` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `detalle_ventas`
--

DROP TABLE IF EXISTS `detalle_ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalle_ventas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `venta_id` int unsigned NOT NULL,
  `producto_id` int unsigned DEFAULT NULL,
  `producto_codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `producto_nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidad_medida` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` decimal(12,3) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `importe` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_detalle_venta` (`venta_id`),
  KEY `idx_detalle_producto` (`producto_id`),
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_detalle_valores` CHECK (((`cantidad` > 0) and (`precio_unitario` >= 0) and (`importe` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entregas_programadas`
--

DROP TABLE IF EXISTS `entregas_programadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entregas_programadas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `venta_id` int unsigned NOT NULL,
  `cliente_id` int unsigned DEFAULT NULL,
  `cliente_nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cliente_telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion_entrega` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referencias` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_entrega` date NOT NULL,
  `horario_entrega` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nota_entrega` text COLLATE utf8mb4_unicode_ci,
  `estado` enum('PENDIENTE','ENTREGADO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',
  `fecha_entregado` datetime DEFAULT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entregas_venta` (`venta_id`),
  KEY `idx_entregas_estado_fecha` (`estado`,`fecha_entrega`),
  KEY `idx_entregas_fecha` (`fecha_entrega`),
  KEY `idx_entregas_cliente` (`cliente_id`),
  CONSTRAINT `fk_entregas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_entregas_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `movimientos_inventario`
--

DROP TABLE IF EXISTS `movimientos_inventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_inventario` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` int unsigned DEFAULT NULL,
  `producto_codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `producto_nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `venta_id` int unsigned DEFAULT NULL,
  `tipo` enum('ENTRADA','SALIDA','SALIDA_VENTA','AJUSTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` decimal(12,3) NOT NULL,
  `stock_anterior` decimal(12,3) NOT NULL,
  `stock_nuevo` decimal(12,3) NOT NULL,
  `motivo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_movimiento` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mov_producto` (`producto_id`),
  KEY `idx_mov_venta` (`venta_id`),
  KEY `idx_mov_fecha` (`fecha_movimiento`),
  KEY `idx_mov_tipo` (`tipo`),
  CONSTRAINT `fk_mov_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_mov_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_mov_stock` CHECK (((`stock_anterior` >= 0) and (`stock_nuevo` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pagos_venta`
--

DROP TABLE IF EXISTS `pagos_venta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos_venta` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `venta_id` int unsigned NOT NULL,
  `tipo` enum('ANTICIPO','ABONO','LIQUIDACION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ABONO',
  `monto` decimal(12,2) NOT NULL,
  `dinero_recibido` decimal(12,2) NOT NULL,
  `cambio` decimal(12,2) NOT NULL DEFAULT '0.00',
  `saldo_anterior` decimal(12,2) NOT NULL,
  `saldo_nuevo` decimal(12,2) NOT NULL,
  `nota` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_pago` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pagos_venta` (`venta_id`),
  KEY `idx_pagos_fecha` (`fecha_pago`),
  CONSTRAINT `fk_pagos_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_pagos_montos` CHECK (((`monto` > 0) and (`dinero_recibido` >= `monto`) and (`cambio` >= 0) and (`saldo_anterior` >= 0) and (`saldo_nuevo` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `presupuestos`
--

DROP TABLE IF EXISTS `presupuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `presupuestos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_presupuesto` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cliente_id` int unsigned DEFAULT NULL,
  `cliente_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `cantidad_productos` int unsigned NOT NULL DEFAULT '0',
  `total_unidades` decimal(12,3) NOT NULL DEFAULT '0.000',
  `subtotal` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `estado` enum('VIGENTE','CONVERTIDO','CANCELADO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VIGENTE',
  `venta_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_presupuestos_folio` (`folio`),
  KEY `idx_presupuestos_fecha` (`fecha_presupuesto`),
  KEY `idx_presupuestos_estado` (`estado`),
  KEY `fk_presupuestos_cliente` (`cliente_id`),
  KEY `fk_presupuestos_venta` (`venta_id`),
  CONSTRAINT `fk_presupuestos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_presupuestos_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_presupuestos_montos` CHECK (((`subtotal` >= 0) and (`total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria_id` int unsigned NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `precio_venta` decimal(12,2) NOT NULL,
  `existencias` decimal(12,3) NOT NULL DEFAULT '0.000',
  `stock_minimo` decimal(12,3) NOT NULL DEFAULT '10.000',
  `controla_stock` tinyint(1) NOT NULL DEFAULT '1',
  `unidad_medida` enum('Pieza','Bulto','Kilogramo','Tonelada','Metro','Metro cúbico','Viaje') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pieza',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_productos_codigo` (`codigo`),
  KEY `idx_productos_nombre` (`nombre`),
  KEY `idx_productos_categoria` (`categoria_id`),
  KEY `idx_productos_activo_existencias` (`activo`,`existencias`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_productos_existencias` CHECK ((`existencias` >= 0)),
  CONSTRAINT `chk_productos_precio` CHECK ((`precio_venta` >= 0)),
  CONSTRAINT `chk_productos_stock_minimo` CHECK ((`stock_minimo` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ventas`
--

DROP TABLE IF EXISTS `ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ventas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_venta` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_venta` enum('GENERAL','CLIENTE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GENERAL',
  `cliente_id` int unsigned DEFAULT NULL,
  `cliente_nombre` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_telefono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cliente_direccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nota_venta` text COLLATE utf8mb4_unicode_ci,
  `cantidad_productos` int unsigned NOT NULL DEFAULT '0',
  `total_unidades` decimal(12,3) NOT NULL DEFAULT '0.000',
  `subtotal` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `dinero_recibido` decimal(12,2) NOT NULL,
  `cambio` decimal(12,2) NOT NULL,
  `estado_pago` enum('PAGADA','PENDIENTE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAGADA',
  `es_pago_parcial` tinyint(1) NOT NULL DEFAULT '0',
  `porcentaje_anticipo` decimal(5,2) NOT NULL DEFAULT '100.00',
  `monto_pagado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `saldo_pendiente` decimal(12,2) NOT NULL DEFAULT '0.00',
  `nombre_pendiente` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('COMPLETADA','CANCELADA') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COMPLETADA',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ventas_folio` (`folio`),
  KEY `idx_ventas_fecha` (`fecha_venta`),
  KEY `idx_ventas_estado_fecha` (`estado`,`fecha_venta`),
  KEY `idx_ventas_cliente` (`cliente_id`),
  KEY `idx_ventas_tipo` (`tipo_venta`),
  KEY `idx_ventas_estado_pago` (`estado_pago`,`fecha_venta`),
  KEY `idx_ventas_parcial` (`es_pago_parcial`,`estado_pago`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_ventas_montos` CHECK (((`subtotal` >= 0) and (`total` >= 0) and (`dinero_recibido` >= 0) and (`cambio` >= 0) and (`monto_pagado` >= 0) and (`saldo_pendiente` >= 0) and (`monto_pagado` <= `total`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'casa_materiales_pos'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
