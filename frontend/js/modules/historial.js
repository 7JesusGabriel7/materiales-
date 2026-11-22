import { api, buildQuery } from '../api/client.js';
import {
  escaparHtml,
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal } from '../utils/modal.js';
import { descargarNotaVentaPdf } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarModalTicket } from './ticket.js';

export function crearModuloHistorial() {
  const contenedor = document.getElementById('vista-historial');

  const estado = {
    resumen: null,
    ventas: [],
    totalesFiltro: { cantidad_ventas: 0, monto_total: 0 },
    paginacion: { total: 0, pagina: 1, limite: 25, total_paginas: 1 },
    filtros: {
      filtro: 'hoy',
      fecha: '',
      fecha_inicio: '',
      fecha_fin: '',
      folio: '',
      pagina: 1
    },
    renderizadoBase: false
  };

  function renderizarBase() {
    if (estado.renderizadoBase) {
      return;
    }

    contenedor.innerHTML = `
      <div class="stack-lg">
        <div id="hist-kpi-grid" class="kpi-grid"></div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Historial de ventas</h2>
              <p class="card-subtitle">Consulta de ventas del dia actual y dias anteriores con reimpresion de ticket y descarga en PDF</p>
            </div>
          </div>

          <div class="card-body">
            <div class="toolbar">
              <div class="toolbar-group">
                <div class="field" style="min-width: 190px;">
                  <label for="hist-filtro-periodo">Periodo de consulta</label>
                  <select id="hist-filtro-periodo" class="select">
                    <option value="hoy">Hoy</option>
                    <option value="ayer">Dia anterior</option>
                    <option value="semana">Semana actual</option>
                    <option value="mes">Mes actual</option>
                    <option value="todas">Todas las ventas</option>
                    <option value="fecha">Fecha especifica</option>
                    <option value="rango">Rango personalizado</option>
                  </select>
                </div>

                <div class="field hidden" id="hist-wrap-fecha">
                  <label for="hist-fecha">Fecha</label>
                  <input type="date" id="hist-fecha" class="input">
                </div>

                <div class="field hidden" id="hist-wrap-inicio">
                  <label for="hist-fecha-inicio">Fecha inicio</label>
                  <input type="date" id="hist-fecha-inicio" class="input">
                </div>

                <div class="field hidden" id="hist-wrap-fin">
                  <label for="hist-fecha-fin">Fecha fin</label>
                  <input type="date" id="hist-fecha-fin" class="input">
                </div>

                <div class="field field-grow">
                  <label for="hist-folio">Buscar por numero de folio</label>
                  <input type="text" id="hist-folio" class="input" placeholder="Ej. VTA-20261121-000001">
                </div>
              </div>

              <div class="toolbar-actions">
                <button type="button" class="btn btn-primary" id="hist-btn-consultar">Consultar</button>
                <button type="button" class="btn btn-secondary" id="hist-btn-restablecer">Restablecer</button>
              </div>
            </div>

            <div id="hist-resumen-filtro" class="filter-summary-strip"></div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Cliente / Tipo</th>
                    <th class="text-right">Productos</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Recibido</th>
                    <th class="text-right">Cambio</th>
                    <th class="text-center">Estado</th>
                    <th class="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody id="hist-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="hist-paginacion" class="pagination-bar"></div>
        </div>
      </div>
    `;

    const selectPeriodo = contenedor.querySelector('#hist-filtro-periodo');
    const wrapFecha = contenedor.querySelector('#hist-wrap-fecha');
    const wrapInicio = contenedor.querySelector('#hist-wrap-inicio');
    const wrapFin = contenedor.querySelector('#hist-wrap-fin');

    function sincronizarCamposFecha() {
      const val = selectPeriodo.value;
      wrapFecha.classList.toggle('hidden', val !== 'fecha');
      wrapInicio.classList.toggle('hidden', val !== 'rango');
      wrapFin.classList.toggle('hidden', val !== 'rango');
    }

    selectPeriodo.addEventListener('change', () => {
      sincronizarCamposFecha();
      if (selectPeriodo.value !== 'fecha' && selectPeriodo.value !== 'rango') {
        aplicarConsulta();
      }
    });

    const aplicarConsulta = () => {
      estado.filtros.filtro = selectPeriodo.value;
      estado.filtros.fecha = contenedor.querySelector('#hist-fecha').value;
      estado.filtros.fecha_inicio = contenedor.querySelector('#hist-fecha-inicio').value;
      estado.filtros.fecha_fin = contenedor.querySelector('#hist-fecha-fin').value;
      estado.filtros.folio = contenedor.querySelector('#hist-folio').value.trim();
      estado.filtros.pagina = 1;
      cargarListaVentas();
    };

    contenedor.querySelector('#hist-btn-consultar').addEventListener('click', aplicarConsulta);
    contenedor.querySelector('#hist-folio').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        aplicarConsulta();
      }
    });

    contenedor.querySelector('#hist-btn-restablecer').addEventListener('click', () => {
      estado.filtros = {
        filtro: 'hoy',
        fecha: '',
        fecha_inicio: '',
        fecha_fin: '',
        folio: '',
        pagina: 1
      };
      selectPeriodo.value = 'hoy';
      contenedor.querySelector('#hist-fecha').value = '';
      contenedor.querySelector('#hist-fecha-inicio').value = '';
      contenedor.querySelector('#hist-fecha-fin').value = '';
      contenedor.querySelector('#hist-folio').value = '';
      sincronizarCamposFecha();
      cargarListaVentas();
    });

    sincronizarCamposFecha();
    estado.renderizadoBase = true;
  }

  function renderizarResumen() {
    const grid = contenedor.querySelector('#hist-kpi-grid');
    if (!grid || !estado.resumen) {
      return;
    }

    const r = estado.resumen;
    grid.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Vendido hoy</div>
        <div class="kpi-value">${formatearMoneda(r.total_hoy)}</div>
        <div class="kpi-meta">${r.ventas_hoy} ${Number(r.ventas_hoy) === 1 ? 'venta' : 'ventas'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Dia anterior</div>
        <div class="kpi-value">${formatearMoneda(r.total_ayer)}</div>
        <div class="kpi-meta">${r.ventas_ayer} ${Number(r.ventas_ayer) === 1 ? 'venta' : 'ventas'}</div>
      </div>
    `;
  }

  function renderizarTabla() {
    const tbody = contenedor.querySelector('#hist-tbody');
    const strip = contenedor.querySelector('#hist-resumen-filtro');
    const pagBar = contenedor.querySelector('#hist-paginacion');
    if (!tbody || !strip || !pagBar) {
      return;
    }

    strip.innerHTML = `
      <span>
        Operaciones encontradas: <strong>${estado.totalesFiltro.cantidad_ventas}</strong>
      </span>
      <span>
        Total del periodo consultado: <strong class="num">${formatearMoneda(estado.totalesFiltro.monto_total)}</strong>
      </span>
    `;

    if (estado.ventas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state">
            No hay ventas registradas para el periodo o folio seleccionado.
          </td>
        </tr>
      `;
      pagBar.innerHTML = '';
      return;
    }

    tbody.innerHTML = estado.ventas
      .map((v) => {
        const esCliente = v.tipo_venta === 'CLIENTE' || Boolean(v.cliente_nombre);
        const nombreMostrar = v.cliente_nombre || v.nombre_pendiente || '';
        const esSaldoPendiente =
          v.estado_pago === 'PENDIENTE' && Number(v.saldo_pendiente) > 0;
        const esParcial = Boolean(Number(v.es_pago_parcial)) || esSaldoPendiente;

        const clienteTexto = esCliente || nombreMostrar
          ? `<div><strong>${escaparHtml(nombreMostrar || 'Cliente')}</strong></div>${
              v.entrega_estado
                ? `<div class="text-muted" style="font-size:11.5px;">Entrega (${formatearFecha(v.entrega_fecha)}): ${escaparHtml(v.entrega_estado)}</div>`
                : ''
            }`
          : '<span class="text-muted">Venta general</span>';

        const estadoPagoHtml = esSaldoPendiente
          ? `<div style="margin-top:4px;"><span class="badge badge-warning">Por cobrar: ${formatearMoneda(v.saldo_pendiente)}</span></div>`
          : esParcial
            ? '<div style="margin-top:4px;"><span class="badge badge-neutral">Liquidada</span></div>'
            : '';

        return `
        <tr>
          <td class="num"><strong>${escaparHtml(v.folio)}</strong></td>
          <td class="num">${formatearFecha(v.fecha_venta)}</td>
          <td class="num">${formatearHora(v.fecha_venta)}</td>
          <td>
            ${clienteTexto}
            ${v.nota_venta ? `<div class="text-muted" style="font-size:11.5px;">Nota: ${escaparHtml(v.nota_venta)}</div>` : ''}
          </td>
          <td class="text-right num">${v.cantidad_productos}</td>
          <td class="text-right num"><strong>${formatearMoneda(v.total)}</strong></td>
          <td class="text-right num">${formatearMoneda(esParcial ? v.monto_pagado : v.dinero_recibido)}</td>
          <td class="text-right num">${formatearMoneda(v.cambio)}</td>
          <td class="text-center">
            <span class="badge ${v.estado === 'COMPLETADA' ? 'badge-success' : 'badge-danger'}">
              ${escaparHtml(v.estado)}
            </span>
            ${estadoPagoHtml}
          </td>
          <td class="text-center">
            <div class="row-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-venta-detalle="${v.id}">
                Ver detalle
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-venta-pdf="${v.id}"
                data-venta-folio="${escaparHtml(v.folio)}"
              >
                PDF
              </button>
              <button type="button" class="btn btn-primary btn-sm" data-venta-reimprimir="${v.id}">
                Reimprimir
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    tbody.querySelectorAll('[data-venta-detalle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirDetalleVenta(Number(btn.dataset.ventaDetalle));
      });
    });

    tbody.querySelectorAll('[data-venta-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        descargarNotaVentaPdf(Number(btn.dataset.ventaPdf), btn.dataset.ventaFolio, btn);
      });
    });

    tbody.querySelectorAll('[data-venta-reimprimir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        reimprimirVenta(Number(btn.dataset.ventaReimprimir));
      });
    });

    const { pagina, total_paginas, total } = estado.paginacion;
    pagBar.innerHTML = `
      <span>Total de ventas: ${total} (Pagina ${pagina} de ${total_paginas})</span>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="hist-pag-prev" ${pagina <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="hist-pag-next" ${pagina >= total_paginas ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    `;

    pagBar.querySelector('#hist-pag-prev')?.addEventListener('click', () => {
      if (estado.filtros.pagina > 1) {
        estado.filtros.pagina -= 1;
        cargarListaVentas();
      }
    });

    pagBar.querySelector('#hist-pag-next')?.addEventListener('click', () => {
      if (estado.filtros.pagina < total_paginas) {
        estado.filtros.pagina += 1;
        cargarListaVentas();
      }
    });
  }

  async function abrirDetalleVenta(ventaId) {
    try {
      const datos = await api.get(`/ventas/${ventaId}`);
      const { venta, detalle, entrega, pagos, negocio } = datos;
      const saldoPendiente = Number(venta.saldo_pendiente || 0);
      const esParcial =
        Boolean(Number(venta.es_pago_parcial)) ||
        venta.estado_pago === 'PENDIENTE' ||
        saldoPendiente > 0;

      const filasDetalle = (detalle || [])
        .map(
          (item) => `
          <tr>
            <td><strong>${escaparHtml(item.producto_nombre)}</strong></td>
            <td>${escaparHtml(item.unidad_medida)}</td>
            <td class="text-right num">${formatearCantidad(item.cantidad)}</td>
            <td class="text-right num">${formatearMoneda(item.precio_unitario)}</td>
            <td class="text-right num"><strong>${formatearMoneda(item.importe)}</strong></td>
          </tr>
        `
        )
        .join('');

      const infoClienteNotaHtml =
        venta.tipo_venta === 'CLIENTE' ||
        venta.cliente_nombre ||
        venta.nombre_pendiente ||
        venta.nota_venta ||
        entrega ||
        esParcial
          ? `
            <div class="info-box">
              <div><strong>Tipo de venta:</strong> ${venta.tipo_venta === 'CLIENTE' ? 'Con cliente (Entrega programada)' : 'Venta general'}</div>
              ${venta.nombre_pendiente ? `<div><strong>Nombre asignado:</strong> ${escaparHtml(venta.nombre_pendiente)}</div>` : ''}
              ${venta.cliente_nombre && venta.cliente_nombre !== venta.nombre_pendiente ? `<div><strong>Cliente:</strong> ${escaparHtml(venta.cliente_nombre)}</div>` : ''}
              ${venta.cliente_telefono ? `<div><strong>Telefono:</strong> ${escaparHtml(venta.cliente_telefono)}</div>` : ''}
              ${venta.cliente_direccion ? `<div><strong>Direccion:</strong> ${escaparHtml(venta.cliente_direccion)}</div>` : ''}
              ${entrega ? `<div><strong>Entrega programada:</strong> ${formatearFecha(entrega.fecha_entrega)} (${escaparHtml(entrega.estado)})</div>` : ''}
              ${
                esParcial
                  ? `<div><strong>Pago parcial:</strong> Pagado ${formatearMoneda(venta.monto_pagado)} | Saldo pendiente: <strong style="color:${saldoPendiente > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${formatearMoneda(saldoPendiente)}</strong></div>`
                  : ''
              }
              ${venta.nota_venta ? `<div><strong>Nota de la venta:</strong> ${escaparHtml(venta.nota_venta)}</div>` : ''}
            </div>
          `
          : '';

      const bloquePagosHtml =
        esParcial && Array.isArray(pagos) && pagos.length > 0
          ? `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Fecha abono</th>
                    <th>Tipo</th>
                    <th>Nota</th>
                    <th class="text-right">Monto</th>
                    <th class="text-right">Saldo restante</th>
                  </tr>
                </thead>
                <tbody>
                  ${pagos
                    .map(
                      (p) => `
                      <tr>
                        <td class="num">${formatearFechaHora(p.fecha_pago)}</td>
                        <td>${escaparHtml(p.tipo)}</td>
                        <td>${escaparHtml(p.nota || '-')}</td>
                        <td class="text-right num"><strong>${formatearMoneda(p.monto)}</strong></td>
                        <td class="text-right num">${formatearMoneda(p.saldo_nuevo)}</td>
                      </tr>
                    `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '';

      const root = abrirModal({
        titulo: `Detalle de venta ${venta.folio}`,
        size: 'lg',
        contenidoHtml: `
          <div class="stack-lg">
            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Folio</div>
                <strong class="num">${escaparHtml(venta.folio)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Fecha y hora</div>
                <strong class="num">${formatearFechaHora(venta.fecha_venta)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Tipo</div>
                <strong>${venta.tipo_venta === 'CLIENTE' ? 'Con cliente' : 'Venta general'}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Estado</div>
                <strong>${escaparHtml(venta.estado)}</strong>
              </div>
            </div>

            ${infoClienteNotaHtml}

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Producto (historico)</th>
                    <th>Unidad</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Precio unitario</th>
                    <th class="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasDetalle}
                </tbody>
              </table>
            </div>

            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Subtotal</div>
                <strong class="num">${formatearMoneda(venta.subtotal)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Total</div>
                <strong class="num" style="font-size:16px;">${formatearMoneda(venta.total)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">${esParcial ? 'Pagado acumulado' : 'Dinero recibido'}</div>
                <strong class="num">${formatearMoneda(esParcial ? venta.monto_pagado : venta.dinero_recibido)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">${esParcial ? 'Saldo pendiente' : 'Cambio entregado'}</div>
                <strong class="num">${formatearMoneda(esParcial ? venta.saldo_pendiente : venta.cambio)}</strong>
              </div>
            </div>

            ${bloquePagosHtml}
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
          <button type="button" class="btn btn-secondary" id="btn-detalle-pdf">
            Descargar PDF
          </button>
          <button type="button" class="btn btn-primary" id="btn-detalle-reimprimir">
            Reimprimir ticket (58 mm)
          </button>
        `
      });

      const btnDetallePdf = root?.querySelector('#btn-detalle-pdf');
      btnDetallePdf?.addEventListener('click', () => {
        descargarNotaVentaPdf(venta.id, venta.folio, btnDetallePdf);
      });

      root?.querySelector('#btn-detalle-reimprimir')?.addEventListener('click', () => {
        mostrarModalTicket({
          venta,
          detalle,
          entrega,
          pagos: pagos || [],
          negocio,
          titulo: `Reimpresion de ticket ${venta.folio}`
        });
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function reimprimirVenta(ventaId) {
    try {
      const datos = await api.get(`/ventas/${ventaId}`);
      mostrarModalTicket({
        venta: datos.venta,
        detalle: datos.detalle,
        entrega: datos.entrega,
        pagos: datos.pagos || [],
        negocio: datos.negocio,
        titulo: `Reimpresion de ticket ${datos.venta.folio}`
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function cargarListaVentas() {
    try {
      const query = buildQuery({
        filtro: estado.filtros.filtro,
        fecha: estado.filtros.fecha,
        fecha_inicio: estado.filtros.fecha_inicio,
        fecha_fin: estado.filtros.fecha_fin,
        folio: estado.filtros.folio,
        pagina: estado.filtros.pagina,
        limite: estado.paginacion.limite
      });

      const resp = await api.get(`/ventas${query}`);
      estado.ventas = resp.ventas || [];
      estado.totalesFiltro = resp.totales_filtro || { cantidad_ventas: 0, monto_total: 0 };
      estado.paginacion = resp.paginacion || estado.paginacion;
      renderizarTabla();
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const respResumen = await api.get('/ventas/resumen');
      estado.resumen = respResumen.resumen;
      renderizarResumen();
      await cargarListaVentas();
    } catch (error) {
      mostrarToast(`Error al cargar el historial de ventas: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}

