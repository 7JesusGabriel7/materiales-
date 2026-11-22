const { pool } = require('./database');

async function obtenerColumnasTabla(tabla) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabla]
  );
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

async function obtenerIndicesTabla(tabla) {
  const [rows] = await pool.query(
    `SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabla]
  );
  return new Set(rows.map((r) => r.INDEX_NAME));
}

async function obtenerForaneasTabla(tabla) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tabla]
  );
  return new Set(rows.map((r) => r.CONSTRAINT_NAME));
}

async function obtenerChecksTabla(tabla) {
  const [rows] = await pool.query(
    `SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    INNER JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
     AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE()
      AND tc.TABLE_NAME = ?
      AND tc.CONSTRAINT_TYPE = 'CHECK'`,
    [tabla]
  );
  return new Map(rows.map((r) => [r.CONSTRAINT_NAME, String(r.CHECK_CLAUSE || '')]));
}

/**
 * Ejecuta migraciones idempotentes para bases de datos ya existentes sin perder informacion.
 */
async function ejecutarMigraciones() {
  const columnasProductos = await obtenerColumnasTabla('productos');
  if (!columnasProductos.has('controla_stock')) {
    await pool.query(
      'ALTER TABLE productos ADD COLUMN controla_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER stock_minimo'
    );
  }

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columnasVentas = await obtenerColumnasTabla('ventas');
  const columnasPendientes = [
    [
      'tipo_venta',
      "ADD COLUMN tipo_venta ENUM('GENERAL', 'CLIENTE') NOT NULL DEFAULT 'GENERAL' AFTER fecha_venta"
    ],
    [
      'cliente_id',
      'ADD COLUMN cliente_id INT UNSIGNED NULL AFTER tipo_venta'
    ],
    [
      'cliente_nombre',
      'ADD COLUMN cliente_nombre VARCHAR(150) NULL AFTER cliente_id'
    ],
    [
      'cliente_telefono',
      'ADD COLUMN cliente_telefono VARCHAR(60) NULL AFTER cliente_nombre'
    ],
    [
      'cliente_direccion',
      'ADD COLUMN cliente_direccion VARCHAR(255) NULL AFTER cliente_telefono'
    ],
    [
      'nota_venta',
      'ADD COLUMN nota_venta TEXT NULL AFTER cliente_direccion'
    ],
    [
      'estado_pago',
      "ADD COLUMN estado_pago ENUM('PAGADA', 'PENDIENTE') NOT NULL DEFAULT 'PAGADA' AFTER cambio"
    ],
    [
      'es_pago_parcial',
      'ADD COLUMN es_pago_parcial TINYINT(1) NOT NULL DEFAULT 0 AFTER estado_pago'
    ],
    [
      'porcentaje_anticipo',
      'ADD COLUMN porcentaje_anticipo DECIMAL(5,2) NOT NULL DEFAULT 100.00 AFTER es_pago_parcial'
    ],
    [
      'monto_pagado',
      'ADD COLUMN monto_pagado DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER porcentaje_anticipo'
    ],
    [
      'saldo_pendiente',
      'ADD COLUMN saldo_pendiente DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER monto_pagado'
    ],
    [
      'nombre_pendiente',
      'ADD COLUMN nombre_pendiente VARCHAR(150) NULL AFTER saldo_pendiente'
    ]
  ];

  for (const [nombreCol, clausulaAlter] of columnasPendientes) {
    if (!columnasVentas.has(nombreCol)) {
      await pool.query(`ALTER TABLE ventas ${clausulaAlter}`);
    }
  }

  await pool.query(
    `UPDATE ventas
    SET
      monto_pagado = total,
      saldo_pendiente = 0.00,
      porcentaje_anticipo = 100.00,
      estado_pago = 'PAGADA'
    WHERE es_pago_parcial = 0 AND monto_pagado = 0 AND saldo_pendiente = 0 AND total > 0`
  );

  const checksVentas = await obtenerChecksTabla('ventas');
  const clausulaCheck = checksVentas.get('chk_ventas_montos');
  if (!clausulaCheck || !clausulaCheck.includes('saldo_pendiente')) {
    if (clausulaCheck) {
      await pool.query('ALTER TABLE ventas DROP CHECK chk_ventas_montos');
    }
    await pool.query(`
      ALTER TABLE ventas
      ADD CONSTRAINT chk_ventas_montos CHECK (
        subtotal >= 0
        AND total >= 0
        AND dinero_recibido >= 0
        AND cambio >= 0
        AND monto_pagado >= 0
        AND saldo_pendiente >= 0
        AND monto_pagado <= total
      )
    `);
  }

  const indicesVentas = await obtenerIndicesTabla('ventas');
  if (!indicesVentas.has('idx_ventas_cliente')) {
    await pool.query('ALTER TABLE ventas ADD KEY idx_ventas_cliente (cliente_id)');
  }
  if (!indicesVentas.has('idx_ventas_tipo')) {
    await pool.query('ALTER TABLE ventas ADD KEY idx_ventas_tipo (tipo_venta)');
  }
  if (!indicesVentas.has('idx_ventas_estado_pago')) {
    await pool.query(
      'ALTER TABLE ventas ADD KEY idx_ventas_estado_pago (estado_pago, fecha_venta)'
    );
  }
  if (!indicesVentas.has('idx_ventas_parcial')) {
    await pool.query(
      'ALTER TABLE ventas ADD KEY idx_ventas_parcial (es_pago_parcial, estado_pago)'
    );
  }

  const foraneasVentas = await obtenerForaneasTabla('ventas');
  if (!foraneasVentas.has('fk_ventas_cliente')) {
    await pool.query(`
      ALTER TABLE ventas
      ADD CONSTRAINT fk_ventas_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    `);
  }

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = {
  ejecutarMigraciones
};

