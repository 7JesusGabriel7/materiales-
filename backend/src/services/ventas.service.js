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

  const modalidadPago = String(datos.modalidad_pago || 'COMPLETO')
    .trim()
    .toUpperCase();
  if (!['COMPLETO', 'PARCIAL'].includes(modalidadPago)) {
    throw new AppError('La modalidad de pago debe ser COMPLETO o PARCIAL.', 400);
  }

  const tieneDineroRecibido =
    datos.dinero_recibido !== undefined &&
    datos.dinero_recibido !== null &&
    String(datos.dinero_recibido).trim() !== '';

  let dineroRecibidoIngresado = null;
  if (modalidadPago === 'COMPLETO') {
    dineroRecibidoIngresado = parsearDecimalNoNegativo(
      datos.dinero_recibido,
      'dinero_recibido',
      2
    );
  } else if (tieneDineroRecibido) {
    dineroRecibidoIngresado = parsearDecimalNoNegativo(
      datos.dinero_recibido,
      'dinero_recibido',
      2
    );
  }

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
  const nombrePendienteParam = textoOpcional(datos.nombre_pendiente, 150);
  const telefonoPendienteParam = textoOpcional(datos.telefono_pendiente, 60);

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

    let dineroRecibido = 0;
    let cambio = 0;
    let estadoPago = 'PAGADA';
    let esPagoParcial = 0;
    let porcentajeAnticipo = 100.0;
    let montoPagado = total;
    let saldoPendiente = 0;

    if (modalidadPago === 'PARCIAL') {
      if (total <= 0) {
        throw new AppError(
          'El total de la venta debe ser mayor a cero para registrar un pago parcial.',
          400
        );
      }

      const tieneMonto =
        datos.monto_anticipo !== undefined &&
        datos.monto_anticipo !== null &&
        String(datos.monto_anticipo).trim() !== '';
      const tienePorcentaje =
        datos.porcentaje_anticipo !== undefined &&
        datos.porcentaje_anticipo !== null &&
        String(datos.porcentaje_anticipo).trim() !== '';

      let montoAnticipo = 0;
      if (tieneMonto) {
        montoAnticipo = parsearDecimalPositivo(
          datos.monto_anticipo,
          'monto_anticipo',
          2
        );
      } else if (tienePorcentaje) {
        const pct = parsearDecimalPositivo(
          datos.porcentaje_anticipo,
          'porcentaje_anticipo',
          2
        );
        if (pct <= 0 || pct >= 100) {
          throw new AppError(
            'El porcentaje de anticipo debe ser mayor a 0 y menor a 100.',
            400
          );
        }
        montoAnticipo = redondearMoneda((total * pct) / 100);
      } else {
        throw new AppError(
          'Indique el porcentaje o monto de anticipo para el pago parcial.',
          400
        );
      }

      if (montoAnticipo <= 0) {
        throw new AppError('El monto de anticipo debe ser mayor a cero.', 400);
      }

      if (montoAnticipo >= total) {
        throw new AppError(
          'El anticipo cubre o supera el total. Para liquidar al 100%, seleccione pago completo.',
          400
        );
      }

      porcentajeAnticipo = Math.min(
        99.99,
        Math.max(0.01, redondearMoneda((montoAnticipo / total) * 100))
      );

      dineroRecibido =
        dineroRecibidoIngresado !== null ? dineroRecibidoIngresado : montoAnticipo;

      if (dineroRecibido < montoAnticipo) {
        const faltanteAnticipo = redondearMoneda(montoAnticipo - dineroRecibido);
        throw new AppError(
          `Efectivo insuficiente para cubrir el anticipo de $${montoAnticipo.toFixed(2)}. Faltan $${faltanteAnticipo.toFixed(2)}.`,
          400,
          {
            anticipo: montoAnticipo,
            dinero_recibido: dineroRecibido,
            faltante: faltanteAnticipo
          }
        );
      }

      cambio = redondearMoneda(dineroRecibido - montoAnticipo);
      montoPagado = montoAnticipo;
      saldoPendiente = redondearMoneda(total - montoAnticipo);
      estadoPago = 'PENDIENTE';
      esPagoParcial = 1;
    } else {
      dineroRecibido = dineroRecibidoIngresado;
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
      cambio = redondearMoneda(dineroRecibido - total);
    }

    let clienteId = null;
    let clienteNombre = null;
    let clienteTelefono = telefonoPendienteParam;
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

    const nombrePendienteFinal = nombrePendienteParam || clienteNombre || null;
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
        estado_pago,
        es_pago_parcial,
        porcentaje_anticipo,
        monto_pagado,
        saldo_pendiente,
        nombre_pendiente,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')`,
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
        cambio,
        estadoPago,
        esPagoParcial,
        porcentajeAnticipo,
        montoPagado,
        saldoPendiente,
        nombrePendienteFinal
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

    if (esPagoParcial === 1) {
      await conexion.query(
        `INSERT INTO pagos_venta (
          venta_id,
          tipo,
          monto,
          dinero_recibido,
          cambio,
          saldo_anterior,
          saldo_nuevo,
          nota
        ) VALUES (?, 'ANTICIPO', ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          montoPagado,
          dineroRecibido,
          cambio,
          total,
          saldoPendiente,
          'Anticipo inicial'
        ]
      );
    }

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
    const [pagosRows] = await conexion.query(
      'SELECT * FROM pagos_venta WHERE venta_id = ? ORDER BY fecha_pago ASC, id ASC',
      [ventaId]
    );
    const negocio = await configuracionService.obtenerConfiguracionNegocio();

    return {
      venta: ventaCompletaRows[0],
      detalle: detalleRows,
      entrega: entregaCreada,
      pagos: pagosRows,
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
      v.estado_pago,
      v.es_pago_parcial,
      v.porcentaje_anticipo,
      v.monto_pagado,
      v.saldo_pendiente,
      v.nombre_pendiente,
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
      importe,
      fecha_agregado
    FROM detalle_ventas
    WHERE venta_id = ?
    ORDER BY id ASC`,
    [id]
  );

  const [entregaRows] = await pool.query(
    'SELECT * FROM entregas_programadas WHERE venta_id = ? LIMIT 1',
    [id]
  );

  const [pagosRows] = await pool.query(
    'SELECT * FROM pagos_venta WHERE venta_id = ? ORDER BY fecha_pago ASC, id ASC',
    [id]
  );

  const negocio = await configuracionService.obtenerConfiguracionNegocio();

  return {
    venta: ventaRows[0],
    detalle: detalleRows,
    entrega: entregaRows.length > 0 ? entregaRows[0] : null,
    pagos: pagosRows,
    negocio
  };
}

async function obtenerResumenPorCobrar() {
  const [ventasRows] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN estado = 'COMPLETADA' AND estado_pago = 'PENDIENTE' AND saldo_pendiente > 0 THEN 1 ELSE 0 END), 0) AS notas_pendientes,
      ROUND(COALESCE(SUM(CASE WHEN estado = 'COMPLETADA' AND estado_pago = 'PENDIENTE' AND saldo_pendiente > 0 THEN saldo_pendiente ELSE 0 END), 0), 2) AS saldo_total_pendiente,
      COALESCE(SUM(CASE WHEN estado = 'COMPLETADA' AND es_pago_parcial = 1 AND estado_pago = 'PAGADA' THEN 1 ELSE 0 END), 0) AS notas_liquidadas
    FROM ventas`
  );

  const [pagosRows] = await pool.query(
    `SELECT
      ROUND(COALESCE(SUM(p.monto), 0), 2) AS cobrado_hoy_abonos
    FROM pagos_venta p
    INNER JOIN ventas v ON v.id = p.venta_id
    WHERE v.estado = 'COMPLETADA' AND DATE(p.fecha_pago) = CURDATE()`
  );

  return {
    ...ventasRows[0],
    cobrado_hoy_abonos: pagosRows[0]?.cobrado_hoy_abonos || 0
  };
}

async function listarCuentasPorCobrar(filtros = {}) {
  const condiciones = ["v.estado = 'COMPLETADA'"];
  const params = [];

  const estadoFiltro = String(filtros.estado_pago || 'PENDIENTE')
    .trim()
    .toUpperCase();
  if (estadoFiltro === 'PENDIENTE') {
    condiciones.push("v.estado_pago = 'PENDIENTE' AND v.saldo_pendiente > 0");
  } else if (estadoFiltro === 'PAGADA') {
    condiciones.push("v.es_pago_parcial = 1 AND v.estado_pago = 'PAGADA'");
  } else if (estadoFiltro === 'TODAS') {
    condiciones.push("(v.es_pago_parcial = 1 OR v.estado_pago = 'PENDIENTE')");
  } else {
    throw new AppError(
      'El filtro estado_pago debe ser PENDIENTE, PAGADA o TODAS.',
      400
    );
  }

  if (filtros.buscar && String(filtros.buscar).trim() !== '') {
    const termino = `%${String(filtros.buscar).trim()}%`;
    condiciones.push(
      `(v.folio LIKE ? OR COALESCE(v.nombre_pendiente, '') LIKE ? OR COALESCE(v.cliente_nombre, '') LIKE ? OR COALESCE(v.cliente_telefono, '') LIKE ? OR COALESCE(v.nota_venta, '') LIKE ?)`
    );
    params.push(termino, termino, termino, termino, termino);
  }

  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(200, Math.max(1, Number.parseInt(filtros.limite, 10) || 25));
  const offset = (pagina - 1) * limite;
  const whereSql = condiciones.join(' AND ');

  const [agregadosRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_registros,
      ROUND(COALESCE(SUM(v.saldo_pendiente), 0), 2) AS saldo_filtro
    FROM ventas v
    WHERE ${whereSql}`,
    params
  );

  const totalRegistros = agregadosRows[0].total_registros;
  const saldoFiltro = agregadosRows[0].saldo_filtro;

  const [notas] = await pool.query(
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
      v.estado_pago,
      v.es_pago_parcial,
      v.porcentaje_anticipo,
      v.monto_pagado,
      v.saldo_pendiente,
      v.nombre_pendiente,
      e.id AS entrega_id,
      e.fecha_entrega AS entrega_fecha,
      e.estado AS entrega_estado,
      (SELECT COUNT(*) FROM pagos_venta p WHERE p.venta_id = v.id) AS total_abonos
    FROM ventas v
    LEFT JOIN entregas_programadas e ON e.venta_id = v.id
    WHERE ${whereSql}
    ORDER BY (v.estado_pago = 'PENDIENTE') DESC, v.fecha_venta DESC, v.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );

  return {
    notas,
    totales_filtro: {
      cantidad_notas: totalRegistros,
      saldo_filtro: saldoFiltro
    },
    paginacion: {
      total: totalRegistros,
      pagina,
      limite,
      total_paginas: Math.max(1, Math.ceil(totalRegistros / limite))
    }
  };
}

async function asignarNombreVenta(id, datos = {}) {
  const nombre = requerirTexto(
    datos.nombre_pendiente !== undefined ? datos.nombre_pendiente : datos.nombre,
    'nombre',
    { min: 2, max: 150 }
  );

  const [filas] = await pool.query(
    'SELECT id, cliente_telefono, nota_venta FROM ventas WHERE id = ? LIMIT 1',
    [id]
  );
  if (filas.length === 0) {
    throw new AppError('Nota de venta no encontrada.', 404);
  }
  const actual = filas[0];

  const telefonoFinal =
    datos.telefono !== undefined
      ? textoOpcional(datos.telefono, 60)
      : actual.cliente_telefono;
  const notaFinal =
    datos.nota_venta !== undefined
      ? textoOpcional(datos.nota_venta, 2000)
      : actual.nota_venta;

  await pool.query(
    `UPDATE ventas
    SET nombre_pendiente = ?, cliente_telefono = ?, nota_venta = ?
    WHERE id = ?`,
    [nombre, telefonoFinal, notaFinal, id]
  );

  return obtenerVentaPorId(id);
}

async function registrarAbonoVenta(id, datos = {}) {
  const monto = parsearDecimalPositivo(datos.monto, 'monto', 2);
  const nota = textoOpcional(datos.nota, 255);
  const tieneRecibido =
    datos.dinero_recibido !== undefined &&
    datos.dinero_recibido !== null &&
    String(datos.dinero_recibido).trim() !== '';
  const dineroRecibidoInput = tieneRecibido
    ? parsearDecimalNoNegativo(datos.dinero_recibido, 'dinero_recibido', 2)
    : monto;

  if (dineroRecibidoInput < monto) {
    const faltante = redondearMoneda(monto - dineroRecibidoInput);
    throw new AppError(
      `Efectivo insuficiente para cubrir el abono de $${monto.toFixed(2)}. Faltan $${faltante.toFixed(2)}.`,
      400
    );
  }

  let pagoInsertId = null;

  await conTransaccion(async (conexion) => {
    const [ventaRows] = await conexion.query(
      'SELECT * FROM ventas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (ventaRows.length === 0) {
      throw new AppError('Nota de venta no encontrada.', 404);
    }

    const venta = ventaRows[0];
    if (venta.estado !== 'COMPLETADA') {
      throw new AppError('No es posible registrar abonos sobre una venta cancelada.', 409);
    }

    const saldoActual = redondearMoneda(venta.saldo_pendiente);
    if (venta.estado_pago !== 'PENDIENTE' || saldoActual <= 0) {
      throw new AppError('Esta nota ya esta liquidada y no tiene saldo pendiente.', 409);
    }

    if (monto > saldoActual) {
      throw new AppError(
        `El abono ($${monto.toFixed(2)}) no puede exceder el saldo pendiente ($${saldoActual.toFixed(2)}).`,
        400
      );
    }

    const cambio = redondearMoneda(dineroRecibidoInput - monto);
    const saldoNuevo = redondearMoneda(Math.max(0, saldoActual - monto));
    const nuevoPagado = redondearMoneda(Number(venta.total) - saldoNuevo);
    const liquidada = saldoNuevo <= 0;
    const tipoPago = liquidada ? 'LIQUIDACION' : 'ABONO';
    const nuevoEstadoPago = liquidada ? 'PAGADA' : 'PENDIENTE';

    await conexion.query(
      `UPDATE ventas
      SET
        monto_pagado = ?,
        saldo_pendiente = ?,
        estado_pago = ?,
        es_pago_parcial = 1
      WHERE id = ?`,
      [nuevoPagado, saldoNuevo, nuevoEstadoPago, id]
    );

    const [insertPago] = await conexion.query(
      `INSERT INTO pagos_venta (
        venta_id,
        tipo,
        monto,
        dinero_recibido,
        cambio,
        saldo_anterior,
        saldo_nuevo,
        nota
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tipoPago,
        monto,
        dineroRecibidoInput,
        cambio,
        saldoActual,
        saldoNuevo,
        nota || (liquidada ? 'Liquidacion final de nota' : 'Abono a cuenta pendiente')
      ]
    );
    pagoInsertId = insertPago.insertId;
  });

  const detalleCompleto = await obtenerVentaPorId(id);
  const [pagoRows] = await pool.query('SELECT * FROM pagos_venta WHERE id = ?', [
    pagoInsertId
  ]);

  return {
    ...detalleCompleto,
    ultimo_pago: pagoRows[0] || null
  };
}

async function agregarItemsAVentaPendiente(id, datos = {}) {
  const itemsSolicitados = consolidarItemsVenta(datos.items);
  const tieneAbono =
    datos.abono_adicional !== undefined &&
    datos.abono_adicional !== null &&
    String(datos.abono_adicional).trim() !== '';
  const abonoAdicional = tieneAbono
    ? parsearDecimalNoNegativo(datos.abono_adicional, 'abono_adicional', 2)
    : 0;
  const notaAbono = textoOpcional(datos.nota, 255);

  let subtotalExtra = 0;
  let unidadesExtra = 0;
  let partidasAgregadas = 0;

  await conTransaccion(async (conexion) => {
    const [ventaRows] = await conexion.query(
      'SELECT * FROM ventas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (ventaRows.length === 0) {
      throw new AppError('Nota de venta no encontrada.', 404);
    }

    const venta = ventaRows[0];
    if (venta.estado !== 'COMPLETADA') {
      throw new AppError(
        'No se puede agregar material a una venta cancelada.',
        409
      );
    }

    const saldoAnterior = redondearMoneda(venta.saldo_pendiente);
    if (venta.estado_pago !== 'PENDIENTE' || saldoAnterior <= 0) {
      throw new AppError(
        'Solo se puede agregar material a notas con saldo pendiente.',
        409
      );
    }

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

    const lineasNuevas = [];
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
      subtotalExtra = redondearMoneda(subtotalExtra + importe);
      unidadesExtra = redondearCantidad(unidadesExtra + solicitado.cantidad);

      lineasNuevas.push({
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

    partidasAgregadas = lineasNuevas.length;

    const nuevoSubtotal = redondearMoneda(Number(venta.subtotal) + subtotalExtra);
    const nuevoTotal = redondearMoneda(Number(venta.total) + subtotalExtra);
    const nuevasUnidades = redondearCantidad(
      Number(venta.total_unidades) + unidadesExtra
    );
    const nuevasPartidasTotal =
      Number(venta.cantidad_productos || 0) + partidasAgregadas;
    const saldoConAmpliacion = redondearMoneda(saldoAnterior + subtotalExtra);

    if (abonoAdicional > saldoConAmpliacion) {
      throw new AppError(
        `El abono ($${abonoAdicional.toFixed(2)}) no puede ser mayor al nuevo saldo ($${saldoConAmpliacion.toFixed(2)}).`,
        400
      );
    }

    const saldoFinal =
      abonoAdicional > 0
        ? redondearMoneda(Math.max(0, saldoConAmpliacion - abonoAdicional))
        : saldoConAmpliacion;
    const pagadoFinal =
      abonoAdicional > 0
        ? redondearMoneda(nuevoTotal - saldoFinal)
        : redondearMoneda(venta.monto_pagado);
    const liquidada = saldoFinal <= 0;
    const estadoPagoFinal = liquidada ? 'PAGADA' : 'PENDIENTE';

    for (const linea of lineasNuevas) {
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
          id,
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
            id,
            linea.cantidad,
            linea.stock_anterior,
            linea.stock_nuevo,
            `Ampliacion nota ${venta.folio}`
          ]
        );
      }
    }

    await conexion.query(
      `UPDATE ventas
      SET
        cantidad_productos = ?,
        total_unidades = ?,
        subtotal = ?,
        total = ?,
        monto_pagado = ?,
        saldo_pendiente = ?,
        estado_pago = ?,
        es_pago_parcial = 1
      WHERE id = ?`,
      [
        nuevasPartidasTotal,
        nuevasUnidades,
        nuevoSubtotal,
        nuevoTotal,
        pagadoFinal,
        saldoFinal,
        estadoPagoFinal,
        id
      ]
    );

    if (abonoAdicional > 0) {
      await conexion.query(
        `INSERT INTO pagos_venta (
          venta_id,
          tipo,
          monto,
          dinero_recibido,
          cambio,
          saldo_anterior,
          saldo_nuevo,
          nota
        ) VALUES (?, ?, ?, ?, 0.00, ?, ?, ?)`,
        [
          id,
          liquidada ? 'LIQUIDACION' : 'ABONO',
          abonoAdicional,
          abonoAdicional,
          saldoConAmpliacion,
          saldoFinal,
          notaAbono || 'Abono al agregar material'
        ]
      );
    }
  });

  const detalleCompleto = await obtenerVentaPorId(id);
  return {
    ...detalleCompleto,
    agregado: {
      partidas: partidasAgregadas,
      subtotal_agregado: subtotalExtra,
      abono_adicional: abonoAdicional
    }
  };
}

module.exports = {
  registrarVenta,
  obtenerResumenVentas,
  listarVentas,
  obtenerVentaPorId,
  obtenerResumenPorCobrar,
  listarCuentasPorCobrar,
  asignarNombreVenta,
  registrarAbonoVenta,
  agregarItemsAVentaPendiente
};
