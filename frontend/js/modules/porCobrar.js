import { api, buildQuery } from '../api/client.js';
import {
  bloquearTeclasNoNumericas,
  escaparHtml,
  formatearCantidad,
  formatearFechaHora,
  formatearMoneda,
  redondearMoneda,
  sanitizarEntradaDecimal
} from '../utils/format.js';
import { abrirModal, cerrarModal } from '../utils/modal.js';
import { descargarNotaVentaPdf } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarModalTicket } from './ticket.js';

const ETIQUETAS_TIPO_PAGO = {
  ANTICIPO: { texto: 'Anticipo inicial', clase: 'badge-warning' },
  ABONO: { texto: 'Abono', clase: 'badge-neutral' },
  LIQUIDACION: { texto: 'Liquidacion', clase: 'badge-success' }
};

export function crearModuloPorCobrar({ onCuentasModificadas }) {
  const contenedor = document.getElementById('vista-por-cobrar');

  const estado = {
    resumen: null,
    notas: [],
    totalesFiltro: { cantidad_notas: 0, saldo_filtro: 0 },
    paginacion: { total: 0, pagina: 1, limite: 25, total_paginas: 1 },
    filtros: {
      estado_pago: 'PENDIENTE',
      buscar: '',
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
        <div id="pc-kpi-grid" class="kpi-grid"></div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Notas por cobrar (pagos parciales)</h2>
              <p class="card-subtitle">Consulte notas con saldo pendiente, asigne o edite un nombre y registre abonos hasta liquidar</p>
            </div>
          </div>

          <div class="card-body">
            <div class="toolbar">
              <div class="toolbar-group">
                <div class="field" style="min-width: 195px;">
                  <label for="pc-estado">Estado de pago</label>
                  <select id="pc-estado" class="select">
                    <option value="PENDIENTE">Pendientes por cobrar</option>
                    <option value="PAGADA">Liquidadas</option>
                    <option value="TODAS">Todas las parciales</option>
                  </select>
                </div>

                <div class="field field-grow">
                  <label for="pc-buscar">Buscar por nombre asignado, folio, telefono o nota</label>
                  <input
                    type="text"
                    id="pc-buscar"
                    class="input"
                    placeholder="Ej. Juan Perez, VTA-..., 555-..."
                  >
                </div>
              </div>

              <div class="toolbar-actions">
                <button type="button" class="btn btn-primary" id="pc-btn-consultar">Consultar</button>
                <button type="button" class="btn btn-secondary" id="pc-btn-restablecer">Restablecer</button>
              </div>
            </div>

            <div id="pc-resumen-filtro" class="filter-summary-strip"></div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha y hora</th>
                    <th>Nombre asignado / Contacto</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Pagado</th>
                    <th class="text-right">Saldo pendiente</th>
                    <th class="text-center">Estado pago</th>
                    <th class="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody id="pc-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="pc-paginacion" class="pagination-bar"></div>
        </div>
      </div>
    `;

    const aplicarConsulta = () => {
      estado.filtros.estado_pago = contenedor.querySelector('#pc-estado').value;
      estado.filtros.buscar = contenedor.querySelector('#pc-buscar').value.trim();
      estado.filtros.pagina = 1;
      cargarLista();
    };

    contenedor.querySelector('#pc-estado').addEventListener('change', aplicarConsulta);
    contenedor.querySelector('#pc-btn-consultar').addEventListener('click', aplicarConsulta);
    contenedor.querySelector('#pc-buscar').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        aplicarConsulta();
      }
    });

    contenedor.querySelector('#pc-btn-restablecer').addEventListener('click', () => {
      estado.filtros = { estado_pago: 'PENDIENTE', buscar: '', pagina: 1 };
      contenedor.querySelector('#pc-estado').value = 'PENDIENTE';
      contenedor.querySelector('#pc-buscar').value = '';
      cargarLista();
    });

    estado.renderizadoBase = true;
  }

  function renderizarKpis() {
    const grid = contenedor.querySelector('#pc-kpi-grid');
    if (!grid || !estado.resumen) {
      return;
    }

    const r = estado.resumen;
    grid.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Notas por cobrar</div>
        <div class="kpi-value" style="color:${Number(r.notas_pendientes) > 0 ? 'var(--warning-text)' : 'var(--text-primary)'};">
          ${r.notas_pendientes}
        </div>
        <div class="kpi-meta">${r.notas_liquidadas} liquidadas en historial</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Saldo total pendiente</div>
        <div class="kpi-value num">${formatearMoneda(r.saldo_total_pendiente)}</div>
        <div class="kpi-meta">Dinero restante por cobrar</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Abonos cobrados hoy</div>
        <div class="kpi-value num">${formatearMoneda(r.cobrado_hoy_abonos)}</div>
        <div class="kpi-meta">Anticipos y abonos recibidos en el dia</div>
      </div>
    `;
  }

  function renderizarTabla() {
    const tbody = contenedor.querySelector('#pc-tbody');
    const strip = contenedor.querySelector('#pc-resumen-filtro');
    const pagBar = contenedor.querySelector('#pc-paginacion');
    if (!tbody || !strip || !pagBar) {
      return;
    }

    strip.innerHTML = `
      <span>
        Notas encontradas: <strong>${estado.totalesFiltro.cantidad_notas}</strong>
      </span>
      <span>
        Saldo pendiente en consulta: <strong class="num">${formatearMoneda(estado.totalesFiltro.saldo_filtro)}</strong>
      </span>
    `;

    if (estado.notas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            No hay notas registradas con los filtros seleccionados.
          </td>
        </tr>
      `;
      pagBar.innerHTML = '';
      return;
    }

    tbody.innerHTML = estado.notas
      .map((n) => {
        const pendiente = n.estado_pago === 'PENDIENTE' && Number(n.saldo_pendiente) > 0;
        const pagadoNum = Number(n.monto_pagado || 0);
        const nombreMostrar = n.nombre_pendiente || n.cliente_nombre || '';

        const nombreHtml = nombreMostrar
          ? `<div><strong>${escaparHtml(nombreMostrar)}</strong></div>`
          : '<div><span class="text-muted">Sin nombre asignado</span></div>';

        const metaContacto = [
          n.cliente_telefono ? `Tel: ${n.cliente_telefono}` : '',
          n.nota_venta ? `Nota: ${n.nota_venta}` : ''
        ]
          .filter(Boolean)
          .join(' | ');

        return `
          <tr>
            <td class="num"><strong>${escaparHtml(n.folio)}</strong></td>
            <td class="num" style="white-space:nowrap;">${formatearFechaHora(n.fecha_venta)}</td>
            <td>
              ${nombreHtml}
              ${metaContacto ? `<div class="text-muted" style="font-size:11.5px;">${escaparHtml(metaContacto)}</div>` : ''}
            </td>
            <td class="text-right num">${formatearMoneda(n.total)}</td>
            <td class="text-right num">${formatearMoneda(pagadoNum)}</td>
            <td class="text-right num">
              <strong style="color:${pendiente ? 'var(--warning-text)' : 'var(--success-text)'};">
                ${formatearMoneda(n.saldo_pendiente)}
              </strong>
            </td>
            <td class="text-center">
              <span class="badge ${pendiente ? 'badge-warning' : 'badge-success'}">
                ${pendiente ? 'PENDIENTE' : 'LIQUIDADA'}
              </span>
            </td>
            <td class="text-center">
              <div class="row-actions">
                ${
                  pendiente
                    ? `<button type="button" class="btn btn-primary btn-sm" data-pc-abonar="${n.id}">Abonar / Liquidar</button>`
                    : ''
                }
                <button type="button" class="btn btn-secondary btn-sm" data-pc-nombre="${n.id}">
                  ${n.nombre_pendiente ? 'Editar nombre' : 'Asignar nombre'}
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-pc-detalle="${n.id}">
                  Detalle
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-pc-pdf="${n.id}"
                  data-pc-folio="${escaparHtml(n.folio)}"
                >
                  PDF
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-pc-abonar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirModalAbonar(Number(btn.dataset.pcAbonar));
      });
    });

    tbody.querySelectorAll('[data-pc-nombre]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirModalAsignarNombre(Number(btn.dataset.pcNombre));
      });
    });

    tbody.querySelectorAll('[data-pc-detalle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirDetalleNota(Number(btn.dataset.pcDetalle));
      });
    });

    tbody.querySelectorAll('[data-pc-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        descargarNotaVentaPdf(Number(btn.dataset.pcPdf), btn.dataset.pcFolio, btn);
      });
    });

    const { pagina, total_paginas, total } = estado.paginacion;
    pagBar.innerHTML = `
      <span>Total de notas: ${total} (Pagina ${pagina} de ${total_paginas})</span>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="pc-pag-prev" ${pagina <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="pc-pag-next" ${pagina >= total_paginas ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    `;

    pagBar.querySelector('#pc-pag-prev')?.addEventListener('click', () => {
      if (estado.filtros.pagina > 1) {
        estado.filtros.pagina -= 1;
        cargarLista();
      }
    });

    pagBar.querySelector('#pc-pag-next')?.addEventListener('click', () => {
      if (estado.filtros.pagina < total_paginas) {
        estado.filtros.pagina += 1;
        cargarLista();
      }
    });
  }

  async function abrirModalAsignarNombre(ventaId) {
    try {
      const datos = await api.get(`/ventas/${ventaId}`);
      const { venta } = datos;
      const nombreInicial = venta.nombre_pendiente || venta.cliente_nombre || '';

      const root = abrirModal({
        titulo: `Asignar nombre - ${venta.folio}`,
        size: 'sm',
        contenidoHtml: `
          <form id="form-pc-nombre" class="form-grid">
            <div class="col-span-2 info-box">
              <div><strong>Folio:</strong> <span class="num">${escaparHtml(venta.folio)}</span></div>
              <div><strong>Total:</strong> <span class="num">${formatearMoneda(venta.total)}</span> | <strong>Saldo pendiente:</strong> <span class="num">${formatearMoneda(venta.saldo_pendiente)}</span></div>
            </div>
            <div class="field col-span-2">
              <label for="pcn-nombre">Nombre para identificar la nota *</label>
              <input
                type="text"
                id="pcn-nombre"
                class="input"
                required
                minlength="2"
                maxlength="150"
                value="${escaparHtml(nombreInicial)}"
                placeholder="Ej. Juan Perez - Obra Norte"
              >
            </div>
            <div class="field col-span-2">
              <label for="pcn-telefono">Telefono de contacto (opcional)</label>
              <input
                type="text"
                id="pcn-telefono"
                class="input"
                maxlength="60"
                value="${escaparHtml(venta.cliente_telefono || '')}"
                placeholder="555-000-0000"
              >
            </div>
            <div class="field col-span-2">
              <label for="pcn-nota">Nota de la venta (opcional)</label>
              <textarea
                id="pcn-nota"
                class="textarea"
                maxlength="2000"
                placeholder="Referencias o acuerdos de pago..."
              >${escaparHtml(venta.nota_venta || '')}</textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="submit" form="form-pc-nombre" class="btn btn-primary" id="pcn-submit">
            Guardar nombre
          </button>
        `
      });

      if (!root) {
        return;
      }

      root.querySelector('#pcn-nombre')?.focus();

      root.querySelector('#form-pc-nombre')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const btnSubmit = root.querySelector('#pcn-submit');
        btnSubmit.disabled = true;

        const payload = {
          nombre_pendiente: root.querySelector('#pcn-nombre').value.trim(),
          telefono: root.querySelector('#pcn-telefono').value.trim(),
          nota_venta: root.querySelector('#pcn-nota').value.trim()
        };

        try {
          const resp = await api.patch(`/ventas/${ventaId}/nombre`, payload);
          mostrarToast(resp.mensaje || 'Nombre asignado correctamente.', 'success');
          cerrarModal();
          await cargarDatos();
          if (onCuentasModificadas) {
            onCuentasModificadas();
          }
        } catch (error) {
          mostrarToast(error.message, 'error');
          btnSubmit.disabled = false;
        }
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function abrirModalAbonar(ventaId) {
    try {
      const datos = await api.get(`/ventas/${ventaId}`);
      const { venta } = datos;
      const saldoActual = redondearMoneda(venta.saldo_pendiente);

      if (saldoActual <= 0) {
        mostrarToast('Esta nota ya esta liquidada.', 'warning');
        await cargarDatos();
        return;
      }

      const nombreMostrar =
        venta.nombre_pendiente || venta.cliente_nombre || 'Sin nombre asignado';

      const root = abrirModal({
        titulo: `Registrar abono - ${venta.folio}`,
        contenidoHtml: `
          <div class="stack-lg">
            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">A nombre de</div>
                <strong>${escaparHtml(nombreMostrar)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Total de la nota</div>
                <strong class="num">${formatearMoneda(venta.total)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Ya pagado</div>
                <strong class="num">${formatearMoneda(venta.monto_pagado)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Saldo pendiente</div>
                <strong class="num" style="color:var(--warning-text);font-size:15.5px;">${formatearMoneda(saldoActual)}</strong>
              </div>
            </div>

            <div class="form-grid">
              <div class="field col-span-2">
                <label for="pca-monto">Monto que abona hoy ($) *</label>
                <div class="pos-payment-input-row">
                  <input
                    type="text"
                    id="pca-monto"
                    class="input num"
                    inputmode="decimal"
                    autocomplete="off"
                    value="${saldoActual.toFixed(2)}"
                  >
                  <button type="button" class="btn btn-secondary" id="pca-liquidar-todo">
                    Liquidar todo
                  </button>
                </div>
              </div>
              <div class="field col-span-2">
                <label for="pca-nota">Nota del abono (opcional)</label>
                <input
                  type="text"
                  id="pca-nota"
                  class="input"
                  maxlength="255"
                  placeholder="Ej. Segundo pago en efectivo, liquidacion en mostrador..."
                >
              </div>
            </div>

            <div id="pca-estado" class="pos-payment-status pos-payment-ok"></div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary" id="pca-confirmar">
            Confirmar abono
          </button>
        `
      });

      if (!root) {
        return;
      }

      const inputMonto = root.querySelector('#pca-monto');
      const inputNota = root.querySelector('#pca-nota');
      const estadoEl = root.querySelector('#pca-estado');
      const btnConfirmar = root.querySelector('#pca-confirmar');

      function actualizarEstadoAbono() {
        const montoNum = Number(inputMonto.value);

        const montoValido =
          inputMonto.value.trim() !== '' &&
          Number.isFinite(montoNum) &&
          montoNum > 0 &&
          montoNum <= saldoActual;

        if (!montoValido) {
          estadoEl.className = 'pos-payment-status pos-payment-insufficient';
          estadoEl.innerHTML = `
            <span>Monto invalido</span>
            <span class="num">Debe ser entre $0.01 y ${formatearMoneda(saldoActual)}</span>
          `;
          btnConfirmar.disabled = true;
          return;
        }

        const montoAbono = redondearMoneda(montoNum);
        const saldoNuevo = redondearMoneda(Math.max(0, saldoActual - montoAbono));
        const liquidada = saldoNuevo <= 0;

        estadoEl.className = liquidada
          ? 'pos-payment-status pos-payment-ok'
          : 'pos-payment-status pos-payment-pending';
        estadoEl.innerHTML = `
          <div class="pos-payment-pending-row">
            <span>${liquidada ? 'La nota quedara LIQUIDADA ($0.00 pendiente)' : 'Queda pendiente por cobrar'}</span>
            <span class="num">${formatearMoneda(saldoNuevo)}</span>
          </div>
        `;
        btnConfirmar.textContent = liquidada ? 'Liquidar nota' : 'Registrar abono';
        btnConfirmar.disabled = false;
      }

      root.querySelector('#pca-liquidar-todo')?.addEventListener('click', () => {
        inputMonto.value = saldoActual.toFixed(2);
        actualizarEstadoAbono();
      });

      inputMonto.addEventListener('keydown', (e) => {
        bloquearTeclasNoNumericas(e, { permitirDecimal: true });
      });
      inputMonto.addEventListener('input', (e) => {
        const limpio = sanitizarEntradaDecimal(e.target.value, 2);
        if (e.target.value !== limpio) {
          e.target.value = limpio;
        }
        actualizarEstadoAbono();
      });

      btnConfirmar.addEventListener('click', async () => {
        const montoAbono = redondearMoneda(Number(inputMonto.value));
        btnConfirmar.disabled = true;
        try {
          const resp = await api.post(`/ventas/${ventaId}/abonos`, {
            monto: montoAbono,
            dinero_recibido: montoAbono,
            nota: inputNota.value.trim() || null
          });
          mostrarToast(resp.mensaje || 'Abono registrado correctamente.', 'success');
          cerrarModal();
          await cargarDatos();
          if (onCuentasModificadas) {
            onCuentasModificadas();
          }
          mostrarModalTicket({
            venta: resp.venta,
            detalle: resp.detalle,
            entrega: resp.entrega,
            pagos: resp.pagos || [],
            negocio: resp.negocio,
            titulo: `Comprobante actualizado ${resp.venta.folio}`
          });
        } catch (error) {
          mostrarToast(error.message, 'error');
          btnConfirmar.disabled = false;
        }
      });

      actualizarEstadoAbono();
      inputMonto.focus();
      inputMonto.select();
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function abrirDetalleNota(ventaId) {
    try {
      const datos = await api.get(`/ventas/${ventaId}`);
      const { venta, detalle, entrega, pagos, negocio } = datos;
      const pendiente = venta.estado_pago === 'PENDIENTE' && Number(venta.saldo_pendiente) > 0;
      const nombreMostrar =
        venta.nombre_pendiente || venta.cliente_nombre || 'Sin nombre asignado';

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

      const filasPagos = (pagos || [])
        .map((p) => {
          const meta = ETIQUETAS_TIPO_PAGO[p.tipo] || {
            texto: p.tipo,
            clase: 'badge-neutral'
          };
          return `
            <tr>
              <td class="num" style="white-space:nowrap;">${formatearFechaHora(p.fecha_pago)}</td>
              <td><span class="badge ${meta.clase}">${meta.texto}</span></td>
              <td>${escaparHtml(p.nota || '-')}</td>
              <td class="text-right num"><strong>${formatearMoneda(p.monto)}</strong></td>
              <td class="text-right num">${formatearMoneda(p.saldo_nuevo)}</td>
            </tr>
          `;
        })
        .join('');

      const root = abrirModal({
        titulo: `Cuenta por cobrar - ${venta.folio}`,
        size: 'lg',
        contenidoHtml: `
          <div class="stack-lg">
            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Folio</div>
                <strong class="num">${escaparHtml(venta.folio)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Nombre asignado</div>
                <strong>${escaparHtml(nombreMostrar)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Fecha de nota</div>
                <strong class="num">${formatearFechaHora(venta.fecha_venta)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Estado pago</div>
                <span class="badge ${pendiente ? 'badge-warning' : 'badge-success'}">
                  ${pendiente ? 'PENDIENTE' : 'LIQUIDADA'}
                </span>
              </div>
            </div>

            ${
              venta.cliente_telefono || venta.cliente_direccion || venta.nota_venta
                ? `<div class="info-box">
                    ${venta.cliente_telefono ? `<div><strong>Telefono:</strong> ${escaparHtml(venta.cliente_telefono)}</div>` : ''}
                    ${venta.cliente_direccion ? `<div><strong>Direccion:</strong> ${escaparHtml(venta.cliente_direccion)}</div>` : ''}
                    ${venta.nota_venta ? `<div><strong>Nota de la venta:</strong> ${escaparHtml(venta.nota_venta)}</div>` : ''}
                  </div>`
                : ''
            }

            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Total de la nota</div>
                <strong class="num" style="font-size:16px;">${formatearMoneda(venta.total)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Total abonado</div>
                <strong class="num" style="color:var(--success-text);font-size:16px;">${formatearMoneda(venta.monto_pagado)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Saldo pendiente</div>
                <strong class="num" style="color:${pendiente ? 'var(--warning-text)' : 'var(--success-text)'};font-size:16px;">${formatearMoneda(venta.saldo_pendiente)}</strong>
              </div>
            </div>

            <div>
              <div class="checkout-section-label">Historial de pagos y abonos</div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Movimiento</th>
                      <th>Nota</th>
                      <th class="text-right">Monto abonado</th>
                      <th class="text-right">Saldo restante</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      filasPagos ||
                      '<tr><td colspan="5" class="empty-state">Sin pagos registrados.</td></tr>'
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div class="checkout-section-label">Materiales de la nota</div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidad</th>
                      <th class="text-right">Cantidad</th>
                      <th class="text-right">Precio unitario</th>
                      <th class="text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>${filasDetalle}</tbody>
                </table>
              </div>
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
          <button type="button" class="btn btn-secondary" id="btn-pcd-nombre">
            ${venta.nombre_pendiente ? 'Editar nombre' : 'Asignar nombre'}
          </button>
          <button type="button" class="btn btn-secondary" id="btn-pcd-pdf">Descargar PDF</button>
          <button type="button" class="btn btn-secondary" id="btn-pcd-ticket">Ticket (58 mm)</button>
          ${
            pendiente
              ? '<button type="button" class="btn btn-primary" id="btn-pcd-abonar">Abonar / Liquidar</button>'
              : ''
          }
        `
      });

      if (!root) {
        return;
      }

      root.querySelector('#btn-pcd-nombre')?.addEventListener('click', () => {
        abrirModalAsignarNombre(venta.id);
      });
      const btnPdf = root.querySelector('#btn-pcd-pdf');
      btnPdf?.addEventListener('click', () => {
        descargarNotaVentaPdf(venta.id, venta.folio, btnPdf);
      });
      root.querySelector('#btn-pcd-ticket')?.addEventListener('click', () => {
        mostrarModalTicket({
          venta,
          detalle,
          entrega,
          pagos: pagos || [],
          negocio,
          titulo: `Comprobante ${venta.folio}`
        });
      });
      root.querySelector('#btn-pcd-abonar')?.addEventListener('click', () => {
        abrirModalAbonar(venta.id);
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function cargarLista() {
    try {
      const query = buildQuery({
        estado_pago: estado.filtros.estado_pago,
        buscar: estado.filtros.buscar,
        pagina: estado.filtros.pagina,
        limite: estado.paginacion.limite
      });
      const resp = await api.get(`/ventas/por-cobrar${query}`);
      estado.notas = resp.notas || [];
      estado.totalesFiltro = resp.totales_filtro || { cantidad_notas: 0, saldo_filtro: 0 };
      estado.paginacion = resp.paginacion || estado.paginacion;
      renderizarTabla();
    } catch (error) {
      mostrarToast(`Error al cargar cuentas por cobrar: ${error.message}`, 'error');
    }
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const respResumen = await api.get('/ventas/por-cobrar/resumen');
      estado.resumen = respResumen.resumen;
      renderizarKpis();
      await cargarLista();
    } catch (error) {
      mostrarToast(`Error al cargar cuentas por cobrar: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}

