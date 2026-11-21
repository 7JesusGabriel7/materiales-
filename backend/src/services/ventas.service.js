const { pool, conTransaccion } = require('../config/database');
const configuracionService = require('./configuracion.service');
const { AppError } = require('../middlewares/errorHandler');
const {
  parsearEnteroPositivo,
  parsearDecimalNoNegativo,
  parsearDecimalPositivo,
  requerirTexto,
  textoOpcional
} = require('../middlewares/validate');
const {
  redondearMoneda,
  redondearCantidad,
  generarFolio,
  esFechaIsoValida
} = require('../utils/formatters');
const { construirFiltroFechaVentas } = require('../utils/dateRanges');

function consolidarItemsVenta(itemsRaw) {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new AppError('Debe agregar al menos un producto para registrar la venta.', 400);
  }

  const mapa = new Map();
  for (const item of itemsRaw) {
    const productoId = parsearEnteroPositivo(item?.producto_id, 'producto_id');
    const cantidad = parsearDecimalPositivo(item?.cantidad, 'cantidad', 3);
    if (cantidad < 1) {
      throw new AppError('La cantidad minima por producto en una venta es 1.', 400);
    }
    const acumulado = mapa.get(productoId) || 0;
    mapa.set(productoId, redondearCantidad(acumulado + cantidad));
  }

  return Array.from(mapa.entries())
    .map(([producto_id, cantidad]) => ({ producto_id, cantidad }))
    .sort((a, b) => a.producto_id - b.producto_id);
}

async function registrarVenta(datos = {}) {
  const itemsSolicitados = consolidarItemsVenta(datos.items);
  const dineroRecibido = parsearDecimalNoNegativo(
    datos.dinero_recibido,
    'dinero_recibido',
    2
  );

  const tipoVenta = String(datos.tipo_venta || 'GENERAL').trim().toUpperCase();
  if (!['GENERAL', 'CLIENTE'].includes(tipoVenta)) {
    throw new AppError('El tipo de venta debe ser GENERAL o CLIENTE.', 400);
  }

  const presupuestoId =
    datos.presupuesto_id !== undefined &&
    datos.presupuesto_id !== null &&
    datos.presupuesto_id !== ''
      ? parsearEnteroPositivo(datos.presupuesto_id, 'presupuesto_id')
      : null;

  const clienteInput = datos.cliente || {};
  const entregaInput = datos.entrega || {};

  let fechaEntrega = null;
  if (tipoVenta === 'CLIENTE') {
    const fechaRaw =
      entregaInput.fecha_entrega !== undefined
        ? String(entregaInput.fecha_entrega || '').trim()
        : '';
    if (fechaRaw !== '') {
      if (!esFechaIsoValida(fechaRaw)) {
        throw new AppError(
          'La fecha de entrega debe tener formato valido AAAA-MM-DD.',
          400
        );
      }
      fechaEntrega = fechaRaw;
    }
  }

  const notaVenta = textoOpcional(
    datos.nota_venta !== undefined ? datos.nota_venta : entregaInput.nota_entrega,
    2000
  );

  return conTransaccion(async (conexion) => {
    const idsProductos = itemsSolicitados.map((item) => item.producto_id);
    const marcadores = idsProductos.map(() => '?').join(', ');

    const [productosDb] = await conexion.query(
      `SELECT id, codigo, nombre, precio_venta, existencias, controla_stock, unidad_medida
      FROM productos
      WHERE id IN (${marcadores}) AND activo = 1
      ORDER BY id ASC
      FOR UPDATE`,
      idsProductos
    );

    const mapaProductos = new Map(productosDb.map((p) => [p.id, p]));

    for (const solicitado of itemsSolicitados) {
      if (!mapaProductos.has(solicitado.producto_id)) {
        throw new AppError(
          `El producto con ID ${solicitado.producto_id} no existe o fue dado de baja.`,
          404
        );
      }
    }

    const lineasVenta = [];
    let subtotal = 0;
    let totalUnidades = 0;

    for (const solicitado of itemsSolicitados) {
      const producto = mapaProductos.get(solicitado.producto_id);
      const controlaStock = Number(producto.controla_stock) !== 0;
      const stockDisponible = redondearCantidad(producto.existencias);

      if (controlaStock && solicitado.cantidad > stockDisponible) {
        throw new AppError(
          `Existencias insuficientes para "${producto.nombre}". Solicitado: ${solicitado.cantidad}, disponible: ${stockDisponible} (${producto.unidad_medida}).`,
          400
        );
      }

      const precioUnitario = redondearMoneda(producto.precio_venta);
      const importe = redondearMoneda(solicitado.cantidad * precioUnitario);
      subtotal = redondearMoneda(subtotal + importe);
      totalUnidades = redondearCantidad(totalUnidades + solicitado.cantidad);

      lineasVenta.push({
        producto_id: producto.id,
        producto_codigo: producto.codigo,
        producto_nombre: producto.nombre,
        unidad_medida: producto.unidad_medida,
        cantidad: solicitado.cantidad,
        precio_unitario: precioUnitario,
        importe,
        controla_stock: controlaStock,
        stock_anterior: stockDisponible,
        stock_nuevo: controlaStock
          ? redondearCantidad(stockDisponible - solicitado.cantidad)
          : stockDisponible
      });
    }

    const total = subtotal;

    if (dineroRecibido < total) {
      const faltante = redondearMoneda(total - dineroRecibido);
      throw new AppError(
        `Pago insuficiente. Faltan $${faltante.toFixed(2)} para completar el total de $${total.toFixed(2)}.`,
        400,
        {
          total,
          dinero_recibido: dineroRecibido,
          faltante
        }
      );
    }

    let clienteId = null;
    let clienteNombre = null;
    let clienteTelefono = null;
    let direccionEntrega = null;
    let referenciasEntrega = null;
    let horarioEntrega = null;
    let notaEntrega = null;

    if (tipoVenta === 'CLIENTE') {
      const clienteIdEnviado =
        clienteInput.cliente_id !== undefined &&
        clienteInput.cliente_id !== null &&
        clienteInput.cliente_id !== ''
          ? parsearEnteroPositivo(clienteInput.cliente_id, 'cliente.cliente_id')
          : null;

      if (clienteIdEnviado) {
        const [clientesDb] = await conexion.query(
          'SELECT * FROM clientes WHERE id = ? AND activo = 1 FOR UPDATE',
          [clienteIdEnviado]
        );
        if (clientesDb.length === 0) {
          throw new AppError('El cliente seleccionado no existe.', 404);
        }
        const clienteDb = clientesDb[0];
        clienteId = clienteDb.id;
        clienteNombre =
          textoOpcional(clienteInput.nombre, 150) || clienteDb.nombre;
        clienteTelefono =
          clienteInput.telefono !== undefined
            ? textoOpcional(clienteInput.telefono, 60)
            : clienteDb.telefono;
        direccionEntrega =
          entregaInput.direccion_entrega !== undefined
            ? textoOpcional(entregaInput.direccion_entrega, 255)
            : clienteInput.direccion !== undefined
              ? textoOpcional(clienteInput.direccion, 255)
              : clienteDb.direccion;
        referenciasEntrega =
          entregaInput.referencias !== undefined
            ? textoOpcional(entregaInput.referencias, 255)
            : clienteInput.referencias !== undefined
              ? textoOpcional(clienteInput.referencias, 255)
              : clienteDb.referencias;

        if (clienteInput.actualizar_cliente) {
          await conexion.query(
            `UPDATE clientes
            SET nombre = ?, telefono = ?, direccion = ?, referencias = ?
            WHERE id = ?`,
            [
              clienteNombre,
              clienteTelefono,
              direccionEntrega,
              referenciasEntrega,
              clienteId
            ]
          );
        }
      } else {
        clienteNombre = requerirTexto(clienteInput.nombre, 'cliente.nombre', {
          min: 2,
          max: 150
        });
        clienteTelefono = textoOpcional(clienteInput.telefono, 60);
        direccionEntrega = textoOpcional(
          entregaInput.direccion_entrega !== undefined
            ? entregaInput.direccion_entrega
            : clienteInput.direccion,
          255
        );
        referenciasEntrega = textoOpcional(
          entregaInput.referencias !== undefined
            ? entregaInput.referencias
            : clienteInput.referencias,
          255
        );

        const [insertCliente] = await conexion.query(
          `INSERT INTO clientes (nombre, telefono, direccion, referencias)
          VALUES (?, ?, ?, ?)`,
          [clienteNombre, clienteTelefono, direccionEntrega, referenciasEntrega]
        );
        clienteId = insertCliente.insertId;
      }

      horarioEntrega = textoOpcional(entregaInput.horario_entrega, 80);
      notaEntrega = textoOpcional(
        entregaInput.nota_entrega !== undefined ? entregaInput.nota_entrega : notaVenta,
        2000
      );

      if (!fechaEntrega) {
        const [hoyRows] = await conexion.query('SELECT CURDATE() AS hoy');
        fechaEntrega = hoyRows[0].hoy;
      }
    }

    const cambio = redondearMoneda(dineroRecibido - total);
    const folioTemporal = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [ventaInsert] = await conexion.query(
      `INSERT INTO ventas (
        folio,
        tipo_venta,
        cliente_id,
        cliente_nombre,
        cliente_telefono,
        cliente_direccion,
        nota_venta,
        cantidad_productos,
        total_unidades,
        subtotal,
        total,
        dinero_recibido,
        cambio,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')`,
      [
        folioTemporal,
        tipoVenta,
        clienteId,
        clienteNombre,
        clienteTelefono,
        direccionEntrega,
        notaVenta,
        lineasVenta.length,
        totalUnidades,
        subtotal,
        total,
        dineroRecibido,
        cambio
      ]
    );

    const ventaId = ventaInsert.insertId;
    const [ventaFechaRows] = await conexion.query(
      'SELECT fecha_venta FROM ventas WHERE id = ?',
      [ventaId]
    );
    const folioFinal = generarFolio(ventaId, ventaFechaRows[0].fecha_venta, 'VTA');

    await conexion.query('UPDATE ventas SET folio = ? WHERE id = ?', [
      folioFinal,
      ventaId
    ]);

    for (const linea of lineasVenta) {
      await conexion.query(
        `INSERT INTO detalle_ventas (
          venta_id,
          producto_id,
          producto_codigo,
          producto_nombre,
          unidad_medida,
          cantidad,
          precio_unitario,
          importe
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          linea.producto_id,
          linea.producto_codigo,
          linea.producto_nombre,
          linea.unidad_medida,
          linea.cantidad,
          linea.precio_unitario,
          linea.importe
        ]
      );

      if (linea.controla_stock) {
        await conexion.query('UPDATE productos SET existencias = ? WHERE id = ?', [
          linea.stock_nuevo,
          linea.producto_id
        ]);

        await conexion.query(
          `INSERT INTO movimientos_inventario (
            producto_id,
            producto_codigo,
            producto_nombre,
            venta_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            motivo
          ) VALUES (?, ?, ?, ?, 'SALIDA_VENTA', ?, ?, ?, ?)`,
          [
            linea.producto_id,
            linea.producto_codigo,
            linea.producto_nombre,
            ventaId,
            linea.cantidad,
            linea.stock_anterior,
            linea.stock_nuevo,
            `Venta ${folioFinal}`
          ]
        );
      }
    }

    let entregaCreada = null;
    if (tipoVenta === 'CLIENTE') {
      const [insertEntrega] = await conexion.query(
        `INSERT INTO entregas_programadas (
          venta_id,
          cliente_id,
          cliente_nombre,
          cliente_telefono,
          direccion_entrega,
          referencias,
          fecha_entrega,
          horario_entrega,
          nota_entrega,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
        [
          ventaId,
          clienteId,
          clienteNombre,
          clienteTelefono,
          direccionEntrega,
          referenciasEntrega,
          fechaEntrega,
          horarioEntrega,
          notaEntrega
        ]
      );

      const [entregaRows] = await conexion.query(
        'SELECT * FROM entregas_programadas WHERE id = ?',
        [insertEntrega.insertId]
      );
      entregaCreada = entregaRows[0];
    }

    if (presupuestoId) {
      await conexion.query(
        "UPDATE presupuestos SET estado = 'CONVERTIDO', venta_id = ? WHERE id = ? AND estado = 'VIGENTE'",
        [ventaId, presupuestoId]
      );
    }

    const [ventaCompletaRows] = await conexion.query(
      'SELECT * FROM ventas WHERE id = ?',
      [ventaId]
    );
    const [detalleRows] = await conexion.query(
      'SELECT * FROM detalle_ventas WHERE venta_id = ? ORDER BY id ASC',
      [ventaId]
    );
    const negocio = await configuracionService.obtenerConfiguracionNegocio();

    return {
      venta: ventaCompletaRows[0],
      detalle: detalleRows,
      entrega: entregaCreada,
      negocio
    };
  });
}

async function obtenerResumenVentas() {
  const [rows] = await pool.query(
    `SELECT
      ROUND(COALESCE(SUM(CASE WHEN DATE(fecha_venta) = CURDATE() THEN total ELSE 0 END), 0), 2) AS total_hoy,
      COALESCE(SUM(CASE WHEN DATE(fecha_venta) = CURDATE() THEN 1 ELSE 0 END), 0) AS ventas_hoy,
      ROUND(COALESCE(SUM(CASE WHEN DATE(fecha_venta) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN total ELSE 0 END), 0), 2) AS total_ayer,
      COALESCE(SUM(CASE WHEN DATE(fecha_venta) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0) AS ventas_ayer,
      ROUND(COALESCE(SUM(CASE WHEN YEARWEEK(fecha_venta, 1) = YEARWEEK(CURDATE(), 1) THEN total ELSE 0 END), 0), 2) AS total_semana,
      COALESCE(SUM(CASE WHEN YEARWEEK(fecha_venta, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END), 0) AS ventas_semana,
      ROUND(COALESCE(SUM(CASE WHEN YEAR(fecha_venta) = YEAR(CURDATE()) AND MONTH(fecha_venta) = MONTH(CURDATE()) THEN total ELSE 0 END), 0), 2) AS total_mes,
      COALESCE(SUM(CASE WHEN YEAR(fecha_venta) = YEAR(CURDATE()) AND MONTH(fecha_venta) = MONTH(CURDATE()) THEN 1 ELSE 0 END), 0) AS ventas_mes,
      ROUND(COALESCE(SUM(total), 0), 2) AS total_general,
      COUNT(*) AS ventas_generales
    FROM ventas
    WHERE estado = 'COMPLETADA'`
  );
  return rows[0];
}

async function listarVentas(filtros = {}) {
  const condiciones = ['1 = 1'];
  const params = [];

  const filtroFecha = construirFiltroFechaVentas(
    {
      filtro: filtros.filtro,
      fecha: filtros.fecha,
      fechaInicio: filtros.fecha_inicio,
      fechaFin: filtros.fecha_fin
    },
    'v'
  );

  if (filtroFecha.sql) {
    condiciones.push(filtroFecha.sql);
    params.push(...filtroFecha.params);
  }

  if (filtros.folio && String(filtros.folio).trim() !== '') {
    condiciones.push('v.folio LIKE ?');
    params.push(`%${String(filtros.folio).trim()}%`);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(200, Math.max(1, Number.parseInt(filtros.limite, 10) || 50));
  const offset = (pagina - 1) * limite;
  const whereSql = condiciones.join(' AND ');

  const [agregadosRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_registros,
      ROUND(COALESCE(SUM(CASE WHEN v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0), 2) AS monto_total
    FROM ventas v
    WHERE ${whereSql}`,
    params
  );

  const totalRegistros = agregadosRows[0].total_registros;
  const montoTotal = agregadosRows[0].monto_total;

  const [ventas] = await pool.query(
    `SELECT
      v.id,
      v.folio,
      v.fecha_venta,
      v.tipo_venta,
      v.cliente_id,
      v.cliente_nombre,
      v.cliente_telefono,
      v.cliente_direccion,
      v.nota_venta,
      v.cantidad_productos,
      v.total_unidades,
      v.subtotal,
      v.total,
      v.dinero_recibido,
      v.cambio,
      v.estado,
      e.id AS entrega_id,
      e.fecha_entrega AS entrega_fecha,
      e.estado AS entrega_estado
    FROM ventas v
    LEFT JOIN entregas_programadas e ON e.venta_id = v.id
    WHERE ${whereSql}
    ORDER BY v.fecha_venta DESC, v.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  return {
    ventas,
    totales_filtro: {
      cantidad_ventas: totalRegistros,
      monto_total: montoTotal
    },
    paginacion: {
      total: totalRegistros,
      pagina,
      limite,
      total_paginas: Math.max(1, Math.ceil(totalRegistros / limite))
    }
  };
}

async function obtenerVentaPorId(id) {
  const [ventaRows] = await pool.query('SELECT * FROM ventas WHERE id = ?', [id]);
  if (ventaRows.length === 0) {
    throw new AppError('Venta no encontrada.', 404);
  }

  const [detalleRows] = await pool.query(
    `SELECT
      id,
      venta_id,
      producto_id,
      producto_codigo,
      producto_nombre,
      unidad_medida,
      cantidad,
      precio_unitario,
      importe
    FROM detalle_ventas
    WHERE venta_id = ?
    ORDER BY id ASC`,
    [id]
  );

  const [entregaRows] = await pool.query(
    'SELECT * FROM entregas_programadas WHERE venta_id = ? LIMIT 1',
    [id]
  );

  const negocio = await configuracionService.obtenerConfiguracionNegocio();

  return {
    venta: ventaRows[0],
    detalle: detalleRows,
    entrega: entregaRows.length > 0 ? entregaRows[0] : null,
    negocio
  };
}

module.exports = {
  registrarVenta,
  obtenerResumenVentas,
  listarVentas,
  obtenerVentaPorId
};
