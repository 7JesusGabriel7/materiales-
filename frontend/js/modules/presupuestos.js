import { api, buildQuery } from '../api/client.js';
import {
  escaparHtml,
  formatearCantidad,
  formatearFechaHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal, cerrarModal, confirmarAccion } from '../utils/modal.js';
import { descargarPresupuestoPdf } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarModalTicketPresupuesto } from './ticket.js';

const BADGES_ESTADO_PRESUPUESTO = {
  VIGENTE: { texto: 'Vigente', clase: 'badge-warning' },
  CONVERTIDO: { texto: 'Convertido a venta', clase: 'badge-success' },
  CANCELADO: { texto: 'Cancelado', clase: 'badge-danger' }
};

export function crearModuloPresupuestos({ onCargarEnPos }) {
  const contenedor = document.getElementById('vista-presupuestos');

  const estado = {
    presupuestos: [],
    paginacion: { total: 0, pagina: 1, limite: 25, total_paginas: 1 },
    filtros: {
      estado: 'todos',
      buscar: '',
      fecha_inicio: '',
      fecha_fin: '',
      pagina: 1
    },
    renderizadoBase: false
  };

  function renderizarBase() {
    if (estado.renderizadoBase) {
      return;
    }

    contenedor.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Presupuestos y cotizaciones</h2>
            <p class="card-subtitle">No cuentan como venta ni descuentan existencias hasta concretarse en el modulo de ventas</p>
          </div>
        </div>

        <div class="card-body">
          <div class="toolbar">
            <div class="toolbar-group">
              <div class="field" style="min-width: 170px;">
                <label for="pres-estado">Estado</label>
                <select id="pres-estado" class="select">
                  <option value="todos">Todos</option>
                  <option value="VIGENTE">Vigentes</option>
                  <option value="CONVERTIDO">Convertidos</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </div>
              <div class="field field-grow">
                <label for="pres-buscar">Buscar por folio o cliente</label>
                <input
                  type="text"
                  id="pres-buscar"
                  class="input"
                  placeholder="Ej. PRE-, nombre o telefono del cliente..."
                >
              </div>
              <div class="field">
                <label for="pres-inicio">Desde</label>
                <input type="date" id="pres-inicio" class="input">
              </div>
              <div class="field">
                <label for="pres-fin">Hasta</label>
                <input type="date" id="pres-fin" class="input">
              </div>
            </div>
            <div class="toolbar-actions">
              <button type="button" class="btn btn-primary" id="pres-filtrar">Consultar</button>
              <button type="button" class="btn btn-secondary" id="pres-limpiar">Restablecer</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha y hora</th>
                  <th>Cliente / Referencia</th>
                  <th class="text-right">Productos</th>
                  <th class="text-right">Total estimado</th>
                  <th class="text-center">Estado</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody id="pres-tbody"></tbody>
            </table>
          </div>
        </div>

        <div id="pres-paginacion" class="pagination-bar"></div>
      </div>
    `;

    const aplicarConsulta = () => {
      estado.filtros.estado = contenedor.querySelector('#pres-estado').value;
      estado.filtros.buscar = contenedor.querySelector('#pres-buscar').value.trim();
      estado.filtros.fecha_inicio = contenedor.querySelector('#pres-inicio').value;
      estado.filtros.fecha_fin = contenedor.querySelector('#pres-fin').value;
      estado.filtros.pagina = 1;
      cargarLista();
    };

    contenedor.querySelector('#pres-estado').addEventListener('change', aplicarConsulta);
    contenedor.querySelector('#pres-filtrar').addEventListener('click', aplicarConsulta);
    contenedor.querySelector('#pres-buscar').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        aplicarConsulta();
      }
    });

    contenedor.querySelector('#pres-limpiar').addEventListener('click', () => {
      estado.filtros = {
        estado: 'todos',
        buscar: '',
        fecha_inicio: '',
        fecha_fin: '',
        pagina: 1
      };
      contenedor.querySelector('#pres-estado').value = 'todos';
      contenedor.querySelector('#pres-buscar').value = '';
      contenedor.querySelector('#pres-inicio').value = '';
      contenedor.querySelector('#pres-fin').value = '';
      cargarLista();
    });

    estado.renderizadoBase = true;
  }

  function renderizarTabla() {
    const tbody = contenedor.querySelector('#pres-tbody');
    const pagBar = contenedor.querySelector('#pres-paginacion');
    if (!tbody || !pagBar) {
      return;
    }

    if (estado.presupuestos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            No hay presupuestos guardados con los filtros actuales.
          </td>
        </tr>
      `;
      pagBar.innerHTML = '';
      return;
    }

    tbody.innerHTML = estado.presupuestos
      .map((p) => {
        const badge = BADGES_ESTADO_PRESUPUESTO[p.estado] || {
          texto: p.estado,
          clase: 'badge-neutral'
        };
        const clienteLabel = p.cliente_nombre
          ? `${escaparHtml(p.cliente_nombre)}${p.cliente_telefono ? ` (${escaparHtml(p.cliente_telefono)})` : ''}`
          : '<span class="text-muted">Publico general</span>';
        const ventaRef = p.venta_folio
          ? `<div class="text-muted num" style="font-size:11.5px;">Venta: ${escaparHtml(p.venta_folio)}</div>`
          : '';

        return `
          <tr>
            <td class="num"><strong>${escaparHtml(p.folio)}</strong></td>
            <td class="num" style="white-space:nowrap;">${formatearFechaHora(p.fecha_presupuesto)}</td>
            <td>
              <div>${clienteLabel}</div>
              ${p.notas ? `<div class="text-muted" style="font-size:12px;">${escaparHtml(p.notas)}</div>` : ''}
            </td>
            <td class="text-right num">${p.cantidad_productos}</td>
            <td class="text-right num"><strong>${formatearMoneda(p.total)}</strong></td>
            <td class="text-center">
              <span class="badge ${badge.clase}">${badge.texto}</span>
              ${ventaRef}
            </td>
            <td class="text-center">
              <div class="row-actions">
                ${
                  p.estado === 'VIGENTE'
                    ? `<button type="button" class="btn btn-primary btn-sm" data-pres-pos="${p.id}">Cargar en POS</button>`
                    : ''
                }
                <button type="button" class="btn btn-secondary btn-sm" data-pres-detalle="${p.id}">
                  Detalle
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-pres-imprimir="${p.id}">
                  Imprimir
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-pres-pdf="${p.id}"
                  data-pres-folio="${escaparHtml(p.folio)}"
                >
                  PDF
                </button>
                ${
                  p.estado !== 'CONVERTIDO'
                    ? `<button type="button" class="btn btn-outline-danger btn-sm" data-pres-eliminar="${p.id}">Eliminar</button>`
                    : ''
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-pres-pos]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cargarPresupuestoEnPos(Number(btn.dataset.presPos));
      });
    });

    tbody.querySelectorAll('[data-pres-detalle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirDetallePresupuesto(Number(btn.dataset.presDetalle));
      });
    });

    tbody.querySelectorAll('[data-pres-imprimir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        imprimirPresupuesto(Number(btn.dataset.presImprimir));
      });
    });

    tbody.querySelectorAll('[data-pres-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        descargarPresupuestoPdf(Number(btn.dataset.presPdf), btn.dataset.presFolio, btn);
      });
    });

    tbody.querySelectorAll('[data-pres-eliminar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pres = estado.presupuestos.find((x) => x.id === Number(btn.dataset.presEliminar));
        if (pres) {
          eliminarPresupuesto(pres);
        }
      });
    });

    const { pagina, total_paginas, total } = estado.paginacion;
    pagBar.innerHTML = `
      <span>Total de presupuestos: ${total} (Pagina ${pagina} de ${total_paginas})</span>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="pres-pag-prev" ${pagina <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="pres-pag-next" ${pagina >= total_paginas ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    `;

    pagBar.querySelector('#pres-pag-prev')?.addEventListener('click', () => {
      if (estado.filtros.pagina > 1) {
        estado.filtros.pagina -= 1;
        cargarLista();
      }
    });

    pagBar.querySelector('#pres-pag-next')?.addEventListener('click', () => {
      if (estado.filtros.pagina < total_paginas) {
        estado.filtros.pagina += 1;
        cargarLista();
      }
    });
  }

  async function cargarPresupuestoEnPos(presupuestoId) {
    try {
      const datos = await api.get(`/presupuestos/${presupuestoId}`);
      cerrarModal();
      if (onCargarEnPos) {
        await onCargarEnPos(datos);
      }
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function imprimirPresupuesto(presupuestoId) {
    try {
      const datos = await api.get(`/presupuestos/${presupuestoId}`);
      mostrarModalTicketPresupuesto({
        presupuesto: datos.presupuesto,
        detalle: datos.detalle,
        negocio: datos.negocio,
        titulo: `Presupuesto ${datos.presupuesto.folio}`
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function abrirDetallePresupuesto(presupuestoId) {
    try {
      const datos = await api.get(`/presupuestos/${presupuestoId}`);
      const { presupuesto, detalle, negocio } = datos;

      const filas = (detalle || [])
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

      const infoClienteHtml =
        presupuesto.cliente_nombre || presupuesto.cliente_telefono || presupuesto.cliente_direccion || presupuesto.notas
          ? `
            <div class="info-box">
              ${presupuesto.cliente_nombre ? `<div><strong>Cliente:</strong> ${escaparHtml(presupuesto.cliente_nombre)}</div>` : ''}
              ${presupuesto.cliente_telefono ? `<div><strong>Telefono:</strong> ${escaparHtml(presupuesto.cliente_telefono)}</div>` : ''}
              ${presupuesto.cliente_direccion ? `<div><strong>Direccion:</strong> ${escaparHtml(presupuesto.cliente_direccion)}</div>` : ''}
              ${presupuesto.notas ? `<div><strong>Notas:</strong> ${escaparHtml(presupuesto.notas)}</div>` : ''}
            </div>
          `
          : '';

      const botonPosHtml =
        presupuesto.estado === 'VIGENTE'
          ? '<button type="button" class="btn btn-primary" id="btn-pres-modal-pos">Cargar en POS</button>'
          : '';
      const botonEstadoHtml =
        presupuesto.estado !== 'CONVERTIDO'
          ? `<button type="button" class="btn btn-secondary" id="btn-pres-modal-estado">
              ${presupuesto.estado === 'VIGENTE' ? 'Marcar cancelado' : 'Reactivar'}
            </button>`
          : '';

      const root = abrirModal({
        titulo: `Detalle de presupuesto ${presupuesto.folio}`,
        size: 'lg',
        contenidoHtml: `
          <div class="stack-lg">
            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Folio</div>
                <strong class="num">${escaparHtml(presupuesto.folio)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Fecha y hora</div>
                <strong class="num">${formatearFechaHora(presupuesto.fecha_presupuesto)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Estado</div>
                <strong>${escaparHtml(presupuesto.estado)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Total estimado</div>
                <strong class="num">${formatearMoneda(presupuesto.total)}</strong>
              </div>
            </div>

            ${infoClienteHtml}

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
                <tbody>
                  ${filas}
                </tbody>
              </table>
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>
          ${botonEstadoHtml}
          <button type="button" class="btn btn-secondary" id="btn-pres-modal-pdf">Descargar PDF</button>
          <button type="button" class="btn btn-secondary" id="btn-pres-modal-imprimir">Imprimir (58 mm)</button>
          ${botonPosHtml}
        `
      });

      const btnPresPdf = root?.querySelector('#btn-pres-modal-pdf');
      btnPresPdf?.addEventListener('click', () => {
        descargarPresupuestoPdf(presupuesto.id, presupuesto.folio, btnPresPdf);
      });

      root?.querySelector('#btn-pres-modal-imprimir')?.addEventListener('click', () => {
        mostrarModalTicketPresupuesto({
          presupuesto,
          detalle,
          negocio,
          titulo: `Presupuesto ${presupuesto.folio}`
        });
      });

      root?.querySelector('#btn-pres-modal-pos')?.addEventListener('click', () => {
        cargarPresupuestoEnPos(presupuesto.id);
      });

      root?.querySelector('#btn-pres-modal-estado')?.addEventListener('click', async () => {
        const nuevoEstado = presupuesto.estado === 'VIGENTE' ? 'CANCELADO' : 'VIGENTE';
        try {
          await api.patch(`/presupuestos/${presupuesto.id}/estado`, {
            estado: nuevoEstado
          });
          mostrarToast(`Presupuesto marcado como ${nuevoEstado}.`, 'success');
          cerrarModal();
          await cargarLista();
        } catch (error) {
          mostrarToast(error.message, 'error');
        }
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function eliminarPresupuesto(presupuesto) {
    const ok = await confirmarAccion({
      titulo: 'Eliminar presupuesto',
      mensaje: `Confirma eliminar el presupuesto ${presupuesto.folio}?`,
      textoConfirmar: 'Eliminar presupuesto',
      tipoConfirmar: 'btn-danger'
    });
    if (!ok) {
      return;
    }

    try {
      await api.del(`/presupuestos/${presupuesto.id}`);
      mostrarToast('Presupuesto eliminado correctamente.', 'success');
      await cargarLista();
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function cargarLista() {
    try {
      const query = buildQuery({
        estado: estado.filtros.estado,
        buscar: estado.filtros.buscar,
        fecha_inicio: estado.filtros.fecha_inicio,
        fecha_fin: estado.filtros.fecha_fin,
        pagina: estado.filtros.pagina,
        limite: estado.paginacion.limite
      });
      const resp = await api.get(`/presupuestos${query}`);
      estado.presupuestos = resp.presupuestos || [];
      estado.paginacion = resp.paginacion || estado.paginacion;
      renderizarTabla();
    } catch (error) {
      mostrarToast(`Error al cargar presupuestos: ${error.message}`, 'error');
    }
  }

  async function cargarDatos() {
    renderizarBase();
    await cargarLista();
  }

  return {
    cargarDatos
  };
}

