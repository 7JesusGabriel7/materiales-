-- Script de inicializacion automatica para MySQL en Docker
-- Crea esquema e inserta catalogo inicial real para una casa de materiales.
-- No inserta ventas ficticias: el historial inicia limpio.

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS casa_materiales_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE casa_materiales_pos;

CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  escala_letra SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  escala_letra_pdf SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracion_negocio (
  id,
  nombre,
  direccion,
  telefono,
  rfc,
  mensaje_ticket,
  mensaje_presupuesto,
  mensaje_pdf,
  mostrar_camion_ticket,
  icono_ticket,
  escala_letra,
  escala_letra_pdf
) VALUES (
  1,
  'Casa de Materiales El Constructor',
  'Av. Principal No. 145, Col. Centro',
  'Tel. 555-234-8910',
  'RFC: CME240101AB1',
  'Gracias por su compra. Conserve este comprobante para cualquier aclaracion.',
  'Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.',
  'Gracias por su compra. Documento digital emitido por el establecimiento para referencia y control del cliente.',
  1,
  'camion_volteo',
  100,
  100
);

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

-- Datos iniciales de categorias
INSERT INTO categorias (id, nombre, descripcion) VALUES
  (1, 'Cementos y Morteros', 'Cementos grises, morteros de albanileria y cales'),
  (2, 'Agregados', 'Materiales petreos a granel como arena y grava'),
  (3, 'Mampostería', 'Blocks, tabiques y ladrillos para muros'),
  (4, 'Aceros y Alambres', 'Varillas corrugadas, alambron, alambre recocido y anillos'),
  (5, 'Prefabricados y Tuberia', 'Elementos prefabricados y conduccion basica');

-- Catalogo inicial representativo de una casa de materiales
INSERT INTO productos (codigo, nombre, categoria_id, descripcion, precio_venta, existencias, stock_minimo, unidad_medida) VALUES
  ('CEM-001', 'Cemento gris Portland 50 kg', 1, 'Bulto de cemento gris uso general para obra negra y cimentacion', 245.00, 120.000, 30.000, 'Bulto'),
  ('MOR-001', 'Mortero de albanileria 50 kg', 1, 'Bulto de mortero para pegado de block, tabique y aplanados', 195.00, 85.000, 25.000, 'Bulto'),
  ('CAL-001', 'Cal hidratada 25 kg', 1, 'Bulto de cal hidratada para mezclas y acabados', 98.00, 14.000, 20.000, 'Bulto'),
  ('AGR-001', 'Arena de rio lavada', 2, 'Arena limpia para concreto, mortero y aplanados', 420.00, 32.500, 10.000, 'Metro cúbico'),
  ('AGR-002', 'Grava triturada 3/4', 2, 'Grava seleccionada de 3/4 de pulgada para concreto estructural', 480.00, 28.000, 10.000, 'Metro cúbico'),
  ('AGR-003', 'Viaje de arena 7 m3', 2, 'Entrega por camion volteo completo de 7 metros cubicos', 2800.00, 6.000, 2.000, 'Viaje'),
  ('MAM-001', 'Block hueco 15x20x40', 3, 'Block de concreto prensado estandar para muro', 16.50, 1500.000, 300.000, 'Pieza'),
  ('MAM-002', 'Tabique rojo recocido', 3, 'Ladrillo de barro rojo recocido artesanal', 5.50, 2400.000, 500.000, 'Pieza'),
  ('ACE-001', 'Varilla corrugada 3/8 pulg x 12 m', 4, 'Pieza de acero corrugado grado 42 de 12 metros', 168.00, 95.000, 30.000, 'Pieza'),
  ('ACE-002', 'Varilla corrugada 3/8 por tonelada', 4, 'Atado comercial por tonelada metrica', 21800.00, 4.500, 1.500, 'Tonelada'),
  ('ACE-003', 'Alambre recocido cal. 16', 4, 'Alambre recocido flexible para amarre de acero', 34.00, 180.000, 40.000, 'Kilogramo'),
  ('ACE-004', 'Anillos de alambron 15x15', 4, 'Estribo cuadrado armado para castillos', 7.50, 18.000, 50.000, 'Pieza'),
  ('TUB-001', 'Manguera poliducto negro 1/2 pulg', 5, 'Manguera flexible para instalacion electrica por metro', 12.00, 300.000, 60.000, 'Metro');

-- Movimiento inicial de inventario para auditar existencias de apertura
INSERT INTO movimientos_inventario (producto_id, producto_codigo, producto_nombre, venta_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
SELECT
  id,
  codigo,
  nombre,
  NULL,
  'ENTRADA',
  existencias,
  0.000,
  existencias,
  'Inventario inicial de apertura del sistema'
FROM productos
WHERE existencias > 0;

