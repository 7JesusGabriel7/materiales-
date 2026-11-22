-- Esquema de base de datos para Sistema POS de Casa de Materiales
-- Motor: MySQL 8.0 (InnoDB, utf8mb4)

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS casa_materiales_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE casa_materiales_pos;

-- 1. Categorias de productos
CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Catalogo de productos
CREATE TABLE IF NOT EXISTS productos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  descripcion TEXT NULL,
  precio_venta DECIMAL(12,2) NOT NULL,
  existencias DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 10.000,
  controla_stock TINYINT(1) NOT NULL DEFAULT 1,
  unidad_medida ENUM(
    'Pieza',
    'Bulto',
    'Kilogramo',
    'Tonelada',
    'Metro',
    'Metro cúbico',
    'Viaje'
  ) NOT NULL DEFAULT 'Pieza',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_codigo (codigo),
  KEY idx_productos_nombre (nombre),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_activo_existencias (activo, existencias),
  CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_productos_precio CHECK (precio_venta >= 0),
  CONSTRAINT chk_productos_existencias CHECK (existencias >= 0),
  CONSTRAINT chk_productos_stock_minimo CHECK (stock_minimo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2B. Directorio de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(60) NULL,
  direccion VARCHAR(255) NULL,
  referencias VARCHAR(255) NULL,
  notas TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clientes_nombre (nombre),
  KEY idx_clientes_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cabecera de ventas
CREATE TABLE IF NOT EXISTS ventas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(30) NOT NULL,
  fecha_venta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo_venta ENUM('GENERAL', 'CLIENTE') NOT NULL DEFAULT 'GENERAL',
  cliente_id INT UNSIGNED NULL,
  cliente_nombre VARCHAR(150) NULL,
  cliente_telefono VARCHAR(60) NULL,
  cliente_direccion VARCHAR(255) NULL,
  nota_venta TEXT NULL,
  cantidad_productos INT UNSIGNED NOT NULL DEFAULT 0,
  total_unidades DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  subtotal DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  dinero_recibido DECIMAL(12,2) NOT NULL,
  cambio DECIMAL(12,2) NOT NULL,
  estado_pago ENUM('PAGADA', 'PENDIENTE') NOT NULL DEFAULT 'PAGADA',
  es_pago_parcial TINYINT(1) NOT NULL DEFAULT 0,
  porcentaje_anticipo DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  monto_pagado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  saldo_pendiente DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  nombre_pendiente VARCHAR(150) NULL,
  estado ENUM('COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'COMPLETADA',
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_folio (folio),
  KEY idx_ventas_fecha (fecha_venta),
  KEY idx_ventas_estado_fecha (estado, fecha_venta),
  KEY idx_ventas_cliente (cliente_id),
  KEY idx_ventas_tipo (tipo_venta),
  KEY idx_ventas_estado_pago (estado_pago, fecha_venta),
  KEY idx_ventas_parcial (es_pago_parcial, estado_pago),
  CONSTRAINT fk_ventas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_ventas_montos CHECK (
    subtotal >= 0
    AND total >= 0
    AND dinero_recibido >= 0
    AND cambio >= 0
    AND monto_pagado >= 0
    AND saldo_pendiente >= 0
    AND monto_pagado <= total
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Detalle de ventas con copia historica del producto y precio aplicado
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NULL,
  producto_codigo VARCHAR(50) NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  unidad_medida VARCHAR(30) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  importe DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_detalle_venta (venta_id),
  KEY idx_detalle_producto (producto_id),
  CONSTRAINT fk_detalle_venta
    FOREIGN KEY (venta_id) REFERENCES ventas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_detalle_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_detalle_valores CHECK (
    cantidad > 0 AND precio_unitario >= 0 AND importe >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Historial de movimientos de inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED NULL,
  producto_codigo VARCHAR(50) NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  venta_id INT UNSIGNED NULL,
  tipo ENUM('ENTRADA', 'SALIDA', 'SALIDA_VENTA', 'AJUSTE') NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  stock_anterior DECIMAL(12,3) NOT NULL,
  stock_nuevo DECIMAL(12,3) NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  fecha_movimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_producto (producto_id),
  KEY idx_mov_venta (venta_id),
  KEY idx_mov_fecha (fecha_movimiento),
  KEY idx_mov_tipo (tipo),
  CONSTRAINT fk_mov_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_mov_venta
    FOREIGN KEY (venta_id) REFERENCES ventas (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_mov_stock CHECK (stock_anterior >= 0 AND stock_nuevo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Configuracion del establecimiento para encabezado, tickets y PDFs
CREATE TABLE IF NOT EXISTS configuracion_negocio (
  id TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NULL,
  telefono VARCHAR(60) NULL,
  rfc VARCHAR(60) NULL,
  mensaje_ticket VARCHAR(500) NULL,
  mensaje_presupuesto VARCHAR(500) NULL,
  mensaje_pdf VARCHAR(500) NULL,
  mostrar_camion_ticket TINYINT(1) NOT NULL DEFAULT 1,
  icono_ticket VARCHAR(40) NOT NULL DEFAULT 'camion_volteo',
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Entregas programadas para ventas asociadas a cliente
CREATE TABLE IF NOT EXISTS entregas_programadas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  cliente_id INT UNSIGNED NULL,
  cliente_nombre VARCHAR(150) NOT NULL,
  cliente_telefono VARCHAR(60) NULL,
  direccion_entrega VARCHAR(255) NULL,
  referencias VARCHAR(255) NULL,
  fecha_entrega DATE NOT NULL,
  horario_entrega VARCHAR(80) NULL,
  nota_entrega TEXT NULL,
  estado ENUM('PENDIENTE', 'ENTREGADO') NOT NULL DEFAULT 'PENDIENTE',
  fecha_entregado DATETIME NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entregas_venta (venta_id),
  KEY idx_entregas_estado_fecha (estado, fecha_entrega),
  KEY idx_entregas_fecha (fecha_entrega),
  KEY idx_entregas_cliente (cliente_id),
  CONSTRAINT fk_entregas_venta
    FOREIGN KEY (venta_id) REFERENCES ventas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_entregas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Presupuestos / cotizaciones (no afectan ventas ni inventario)
CREATE TABLE IF NOT EXISTS presupuestos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(30) NOT NULL,
  fecha_presupuesto DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cliente_id INT UNSIGNED NULL,
  cliente_nombre VARCHAR(150) NULL,
  cliente_telefono VARCHAR(60) NULL,
  cliente_direccion VARCHAR(255) NULL,
  notas TEXT NULL,
  cantidad_productos INT UNSIGNED NOT NULL DEFAULT 0,
  total_unidades DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  subtotal DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  estado ENUM('VIGENTE', 'CONVERTIDO', 'CANCELADO') NOT NULL DEFAULT 'VIGENTE',
  venta_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_presupuestos_folio (folio),
  KEY idx_presupuestos_fecha (fecha_presupuesto),
  KEY idx_presupuestos_estado (estado),
  CONSTRAINT fk_presupuestos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_presupuestos_venta
    FOREIGN KEY (venta_id) REFERENCES ventas (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_presupuestos_montos CHECK (subtotal >= 0 AND total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Detalle de partidas de presupuestos
CREATE TABLE IF NOT EXISTS detalle_presupuestos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  presupuesto_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NULL,
  producto_codigo VARCHAR(50) NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  unidad_medida VARCHAR(30) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  importe DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_det_presupuesto (presupuesto_id),
  KEY idx_det_pres_producto (producto_id),
  CONSTRAINT fk_det_presupuesto
    FOREIGN KEY (presupuesto_id) REFERENCES presupuestos (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_det_pres_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT chk_det_pres_valores CHECK (
    cantidad >= 1 AND precio_unitario >= 0 AND importe >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Historial de anticipos y abonos para notas con saldo pendiente
CREATE TABLE IF NOT EXISTS pagos_venta (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  tipo ENUM('ANTICIPO', 'ABONO', 'LIQUIDACION') NOT NULL DEFAULT 'ABONO',
  monto DECIMAL(12,2) NOT NULL,
  dinero_recibido DECIMAL(12,2) NOT NULL,
  cambio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  saldo_anterior DECIMAL(12,2) NOT NULL,
  saldo_nuevo DECIMAL(12,2) NOT NULL,
  nota VARCHAR(255) NULL,
  fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pagos_venta (venta_id),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT fk_pagos_venta
    FOREIGN KEY (venta_id) REFERENCES ventas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_pagos_montos CHECK (
    monto > 0
    AND dinero_recibido >= monto
    AND cambio >= 0
    AND saldo_anterior >= 0
    AND saldo_nuevo >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

