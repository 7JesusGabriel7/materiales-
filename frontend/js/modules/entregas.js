import { api, buildQuery } from '../api/client.js';
import {
  escaparHtml,
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal, cerrarModal, confirmarAccion } from '../utils/modal.js';
import { descargarNotaVentaPdf } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarModalTicket } from './ticket.js';

function obtenerFechaHoyIso() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function crearModuloEntregas({ onEntregasModificadas }) {
  const contenedor = document.getElementById('vista-entregas');

  const estado = {
    resumen: null,
    entregas: [],
    clientes: [],
    paginacion: { total: 0, pagina: 1, limite: 25, total_paginas: 1 },
    filtros: {
      estado: 'todas',
      filtro_fecha: 'todas',
      fecha: '',
      fecha_inicio: '',
      fecha_fin: '',
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
        <div id="ent-kpi-grid" class="kpi-grid"></div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Entregas programadas</h2>
              <p class="card-subtitle">Gestione fechas de entrega, direcciones, notas de venta y estado de entrega por cliente</p>
            </div>
            <button type="button" class="btn btn-secondary" id="ent-btn-clientes">
              Directorio de clientes
            </button>
          </div>

          <div class="card-body">
            <div class="toolbar">
              <div class="toolbar-group">
                <div class="field" style="min-width: 165px;">
                  <label for="ent-estado">Estado</label>
                  <select id="ent-estado" class="select">
                    <option value="todas">Todas</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="ENTREGADO">Entregadas</option>
                  </select>
                </div>

                <div class="field" style="min-width: 185px;">
                  <label for="ent-filtro-fecha">Dia de entrega</label>
                  <select id="ent-filtro-fecha" class="select">
                    <option value="todas">Todas las fechas</option>
                    <option value="hoy">Hoy</option>
                    <option value="manana">Manana</option>
                    <option value="atrasadas">Atrasadas pendientes</option>
                    <option value="semana">Semana actual</option>
                    <option value="fecha">Fecha especifica</option>
                    <option value="rango">Rango personalizado</option>
                  </select>
                </div>

                <div class="field hidden" id="ent-wrap-fecha">
                  <label for="ent-fecha">Fecha</label>
                  <input type="date" id="ent-fecha" class="input">
                </div>

                <div class="field hidden" id="ent-wrap-inicio">
                  <label for="ent-fecha-inicio">Desde</label>
                  <input type="date" id="ent-fecha-inicio" class="input">
                </div>

                <div class="field hidden" id="ent-wrap-fin">
                  <label for="ent-fecha-fin">Hasta</label>
                  <input type="date" id="ent-fecha-fin" class="input">
                </div>

                <div class="field field-grow">
                  <label for="ent-buscar">Buscar cliente, telefono, direccion, nota o folio</label>
                  <input
                    type="text"
                    id="ent-buscar"
                    class="input"
                    placeholder="Ej. Juan Perez, Col. Centro, VTA-..."
                  >
                </div>
              </div>

              <div class="toolbar-actions">
                <button type="button" class="btn btn-primary" id="ent-btn-consultar">Consultar</button>
                <button type="button" class="btn btn-secondary" id="ent-btn-restablecer">Restablecer</button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Dia de entrega</th>
                    <th>Cliente y telefono</th>
                    <th>Direccion y referencias</th>
                    <th>Nota de venta</th>
                    <th>Venta</th>
                    <th class="text-center">Estado</th>
                    <th class="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody id="ent-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="ent-paginacion" class="pagination-bar"></div>
        </div>
      </div>
    `;

    const selectFecha = contenedor.querySelector('#ent-filtro-fecha');
    const wrapFecha = contenedor.querySelector('#ent-wrap-fecha');
    const wrapInicio = contenedor.querySelector('#ent-wrap-inicio');
    const wrapFin = contenedor.querySelector('#ent-wrap-fin');

    function sincronizarCamposFecha() {
      const val = selectFecha.value;
      wrapFecha.classList.toggle('hidden', val !== 'fecha');
      wrapInicio.classList.toggle('hidden', val !== 'rango');
      wrapFin.classList.toggle('hidden', val !== 'rango');
    }

    const aplicarConsulta = () => {
      estado.filtros.estado = contenedor.querySelector('#ent-estado').value;
      estado.filtros.filtro_fecha = selectFecha.value;
      estado.filtros.fecha = contenedor.querySelector('#ent-fecha').value;
      estado.filtros.fecha_inicio = contenedor.querySelector('#ent-fecha-inicio').value;
      estado.filtros.fecha_fin = contenedor.querySelector('#ent-fecha-fin').value;
      estado.filtros.buscar = contenedor.querySelector('#ent-buscar').value.trim();
      estado.filtros.pagina = 1;
      cargarLista();
    };

    contenedor.querySelector('#ent-estado').addEventListener('change', aplicarConsulta);
    selectFecha.addEventListener('change', () => {
      sincronizarCamposFecha();
      if (selectFecha.value !== 'fecha' && selectFecha.value !== 'rango') {
        aplicarConsulta();
      }
    });
    contenedor.querySelector('#ent-btn-consultar').addEventListener('click', aplicarConsulta);
    contenedor.querySelector('#ent-buscar').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        aplicarConsulta();
      }
    });

    contenedor.querySelector('#ent-btn-restablecer').addEventListener('click', () => {
      estado.filtros = {
        estado: 'todas',
        filtro_fecha: 'todas',
        fecha: '',
        fecha_inicio: '',
        fecha_fin: '',
        buscar: '',
        pagina: 1
      };
      contenedor.querySelector('#ent-estado').value = 'todas';
      selectFecha.value = 'todas';
      contenedor.querySelector('#ent-fecha').value = '';
      contenedor.querySelector('#ent-fecha-inicio').value = '';
      contenedor.querySelector('#ent-fecha-fin').value = '';
      contenedor.querySelector('#ent-buscar').value = '';
      sincronizarCamposFecha();
      cargarLista();
    });

    contenedor.querySelector('#ent-btn-clientes').addEventListener('click', () => {
      abrirModalDirectorioClientes();
    });

    sincronizarCamposFecha();
    estado.renderizadoBase = true;
  }

  function renderizarKpis() {
    const grid = contenedor.querySelector('#ent-kpi-grid');
    if (!grid || !estado.resumen) {
      return;
    }

    const r = estado.resumen;
    grid.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Pendientes hoy</div>
        <div class="kpi-value">${r.pendientes_hoy}</div>
        <div class="kpi-meta">Programadas para el dia de hoy</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Entregas atrasadas</div>
        <div class="kpi-value" style="color:${Number(r.pendientes_atrasadas) > 0 ? 'var(--danger-text)' : 'var(--text-primary)'};">
          ${r.pendientes_atrasadas}
        </div>
        <div class="kpi-meta">Fechas anteriores sin entregar</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total pendientes</div>
        <div class="kpi-value" style="color:${Number(r.total_pendientes) > 0 ? 'var(--warning-text)' : 'var(--text-primary)'};">
          ${r.total_pendientes}
        </div>
        <div class="kpi-meta">Por entregar al cliente</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Entregadas hoy</div>
        <div class="kpi-value" style="color:var(--success-text);">${r.entregadas_hoy}</div>
        <div class="kpi-meta">Total historico: ${r.total_entregas}</div>
      </div>
    `;
  }

  function renderizarTabla() {
    const tbody = contenedor.querySelector('#ent-tbody');
    const pagBar = contenedor.querySelector('#ent-paginacion');
    if (!tbody || !pagBar) {
      return;
    }

    if (estado.entregas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            No hay entregas programadas con los criterios seleccionados.
          </td>
        </tr>
      `;
      pagBar.innerHTML = '';
      return;
    }

    const hoyIso = obtenerFechaHoyIso();

    tbody.innerHTML = estado.entregas
      .map((ent) => {
        const pendiente = ent.estado === 'PENDIENTE';
        const fechaEntregaStr = String(ent.fecha_entrega || '').slice(0, 10);
        let etiquetaFecha = '';
        if (pendiente && fechaEntregaStr < hoyIso) {
          etiquetaFecha = '<span class="badge badge-danger">Atrasada</span>';
        } else if (pendiente && fechaEntregaStr === hoyIso) {
          etiquetaFecha = '<span class="badge badge-warning">Hoy</span>';
        }

        const estadoBadge = pendiente
          ? '<span class="badge badge-warning">PENDIENTE</span>'
          : `<span class="badge badge-success">ENTREGADO</span>${
              ent.fecha_entregado
                ? `<div class="text-muted num" style="font-size:11px;margin-top:3px;">${formatearFechaHora(ent.fecha_entregado)}</div>`
                : ''
            }`;

        return `
          <tr>
            <td style="white-space:nowrap;">
              <div class="num"><strong>${formatearFecha(ent.fecha_entrega)}</strong></div>
              ${ent.horario_entrega ? `<div class="text-muted" style="font-size:12px;">${escaparHtml(ent.horario_entrega)}</div>` : ''}
              <div style="margin-top:3px;">${etiquetaFecha}</div>
            </td>
            <td>
              <div><strong>${escaparHtml(ent.cliente_nombre)}</strong></div>
              <div class="text-muted num" style="font-size:12px;">${escaparHtml(ent.cliente_telefono || 'Sin telefono')}</div>
            </td>
            <td>
              <div>${escaparHtml(ent.direccion_entrega || 'Sin direccion')}</div>
              ${ent.referencias ? `<div class="text-muted" style="font-size:12px;">Ref: ${escaparHtml(ent.referencias)}</div>` : ''}
            </td>
            <td style="max-width:220px;">
              <div style="font-size:12.5px;">${escaparHtml(ent.nota_entrega || '-')}</div>
            </td>
            <td style="white-space:nowrap;">
              <div class="num"><strong>${escaparHtml(ent.venta_folio)}</strong></div>
              <div class="num text-secondary" style="font-size:12px;">${formatearMoneda(ent.venta_total)}</div>
            </td>
            <td class="text-center">${estadoBadge}</td>
            <td class="text-center">
              <div class="row-actions">
                <button
                  type="button"
                  class="btn ${pendiente ? 'btn-primary' : 'btn-secondary'} btn-sm"
                  data-ent-toggle="${ent.id}"
                  data-next-state="${pendiente ? 'ENTREGADO' : 'PENDIENTE'}"
                >
                  ${pendiente ? 'Marcar entregado' : 'Marcar pendiente'}
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-ent-editar="${ent.id}">
                  Editar
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-ent-venta="${ent.id}">
                  Ver nota
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-ent-pdf="${ent.venta_id}"
                  data-ent-folio="${escaparHtml(ent.venta_folio)}"
                >
                  PDF
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-ent-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cambiarEstadoRapido(Number(btn.dataset.entToggle), btn.dataset.nextState);
      });
    });

    tbody.querySelectorAll('[data-ent-editar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entrega = estado.entregas.find((e) => e.id === Number(btn.dataset.entEditar));
        if (entrega) {
          abrirModalEditarEntrega(entrega);
        }
      });
    });

    tbody.querySelectorAll('[data-ent-venta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirModalNotaVenta(Number(btn.dataset.entVenta));
      });
    });

    tbody.querySelectorAll('[data-ent-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => {
        descargarNotaVentaPdf(Number(btn.dataset.entPdf), btn.dataset.entFolio, btn);
      });
    });

    const { pagina, total_paginas, total } = estado.paginacion;
    pagBar.innerHTML = `
      <span>Total de entregas: ${total} (Pagina ${pagina} de ${total_paginas})</span>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="ent-pag-prev" ${pagina <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="ent-pag-next" ${pagina >= total_paginas ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    `;

    pagBar.querySelector('#ent-pag-prev')?.addEventListener('click', () => {
      if (estado.filtros.pagina > 1) {
        estado.filtros.pagina -= 1;
        cargarLista();
      }
    });

    pagBar.querySelector('#ent-pag-next')?.addEventListener('click', () => {
      if (estado.filtros.pagina < total_paginas) {
        estado.filtros.pagina += 1;
        cargarLista();
      }
    });
  }

  async function cambiarEstadoRapido(entregaId, nuevoEstado) {
    try {
      const resp = await api.patch(`/entregas/${entregaId}/estado`, {
        estado: nuevoEstado
      });
      mostrarToast(resp.mensaje, 'success');
      await cargarDatos();
      if (onEntregasModificadas) {
        onEntregasModificadas();
      }
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  function abrirModalEditarEntrega(entrega) {
    const fechaIso = String(entrega.fecha_entrega || '').slice(0, 10);
    const checkClienteHtml = entrega.cliente_id
      ? `
        <label class="checkbox-row col-span-2" for="fe-act-cliente">
          <input type="checkbox" id="fe-act-cliente" checked>
          <span>Guardar cambios de nombre, telefono y direccion tambien en la ficha del cliente</span>
        </label>
      `
      : '';

    const root = abrirModal({
      titulo: `Editar entrega - ${entrega.venta_folio}`,
      contenidoHtml: `
        <form id="form-editar-entrega" class="form-grid">
          <div class="field">
            <label for="fe-fecha">Dia de entrega *</label>
            <input type="date" id="fe-fecha" class="input" required value="${escaparHtml(fechaIso)}">
          </div>
          <div class="field">
            <label for="fe-estado">Estado de entrega *</label>
            <select id="fe-estado" class="select" required>
              <option value="PENDIENTE" ${entrega.estado === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
              <option value="ENTREGADO" ${entrega.estado === 'ENTREGADO' ? 'selected' : ''}>ENTREGADO</option>
            </select>
          </div>
          <div class="field">
            <label for="fe-nombre">Nombre del cliente *</label>
            <input type="text" id="fe-nombre" class="input" required maxlength="150" value="${escaparHtml(entrega.cliente_nombre)}">
          </div>
          <div class="field">
            <label for="fe-telefono">Telefono</label>
            <input type="text" id="fe-telefono" class="input" maxlength="60" value="${escaparHtml(entrega.cliente_telefono || '')}">
          </div>
          <div class="field col-span-2">
            <label for="fe-horario">Horario estimado</label>
            <input type="text" id="fe-horario" class="input" maxlength="80" value="${escaparHtml(entrega.horario_entrega || '')}" placeholder="Ej. 9:00 a 12:00 hrs">
          </div>
          <div class="field col-span-2">
            <label for="fe-direccion">Direccion de entrega</label>
            <input type="text" id="fe-direccion" class="input" maxlength="255" value="${escaparHtml(entrega.direccion_entrega || '')}">
          </div>
          <div class="field col-span-2">
            <label for="fe-referencias">Referencias</label>
            <input type="text" id="fe-referencias" class="input" maxlength="255" value="${escaparHtml(entrega.referencias || '')}">
          </div>
          <div class="field col-span-2">
            <label for="fe-nota">Nota de la venta y entrega</label>
            <textarea id="fe-nota" class="textarea" maxlength="2000">${escaparHtml(entrega.nota_entrega || '')}</textarea>
          </div>
          ${checkClienteHtml}
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="form-editar-entrega" class="btn btn-primary" id="fe-submit">
          Guardar cambios
        </button>
      `
    });

    root?.querySelector('#form-editar-entrega')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const btnSubmit = root.querySelector('#fe-submit');
      btnSubmit.disabled = true;

      const payload = {
        fecha_entrega: root.querySelector('#fe-fecha').value,
        estado: root.querySelector('#fe-estado').value,
        cliente_nombre: root.querySelector('#fe-nombre').value.trim(),
        cliente_telefono: root.querySelector('#fe-telefono').value.trim(),
        horario_entrega: root.querySelector('#fe-horario').value.trim(),
        direccion_entrega: root.querySelector('#fe-direccion').value.trim(),
        referencias: root.querySelector('#fe-referencias').value.trim(),
        nota_entrega: root.querySelector('#fe-nota').value.trim(),
        actualizar_cliente: Boolean(root.querySelector('#fe-act-cliente')?.checked)
      };

      try {
        const resp = await api.put(`/entregas/${entrega.id}`, payload);
        mostrarToast(resp.mensaje || 'Entrega actualizada correctamente.', 'success');
        cerrarModal();
        await cargarDatos();
        if (onEntregasModificadas) {
          onEntregasModificadas();
        }
      } catch (error) {
        mostrarToast(error.message, 'error');
        btnSubmit.disabled = false;
      }
    });
  }

  async function abrirModalNotaVenta(entregaId) {
    try {
      const datos = await api.get(`/entregas/${entregaId}`);
      const { entrega, venta, detalle, negocio } = datos;

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

      const root = abrirModal({
        titulo: `Nota de venta y entrega - ${venta.folio}`,
        size: 'lg',
        contenidoHtml: `
          <div class="stack-lg">
            <div class="info-box" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
              <div>
                <div class="text-muted" style="font-size:12px;">Folio de venta</div>
                <strong class="num">${escaparHtml(venta.folio)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Dia de entrega</div>
                <strong class="num">${formatearFecha(entrega.fecha_entrega)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Estado entrega</div>
                <strong>${escaparHtml(entrega.estado)}</strong>
              </div>
              <div>
                <div class="text-muted" style="font-size:12px;">Total de venta</div>
                <strong class="num">${formatearMoneda(venta.total)}</strong>
              </div>
            </div>

            <div class="info-box">
              <div><strong>Cliente:</strong> ${escaparHtml(entrega.cliente_nombre)}</div>
              <div><strong>Telefono:</strong> ${escaparHtml(entrega.cliente_telefono || '-')}</div>
              <div><strong>Direccion:</strong> ${escaparHtml(entrega.direccion_entrega || '-')}</div>
              ${entrega.referencias ? `<div><strong>Referencias:</strong> ${escaparHtml(entrega.referencias)}</div>` : ''}
              ${entrega.horario_entrega ? `<div><strong>Horario:</strong> ${escaparHtml(entrega.horario_entrega)}</div>` : ''}
              <div><strong>Nota de la venta:</strong> ${escaparHtml(entrega.nota_entrega || venta.nota_venta || 'Sin notas')}</div>
            </div>

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
          <button type="button" class="btn btn-secondary" id="btn-ent-pdf">
            Descargar PDF
          </button>
          <button type="button" class="btn btn-primary" id="btn-ent-reimprimir">
            Reimprimir ticket (58 mm)
          </button>
        `
      });

      const btnEntPdf = root?.querySelector('#btn-ent-pdf');
      btnEntPdf?.addEventListener('click', () => {
        descargarNotaVentaPdf(venta.id, venta.folio, btnEntPdf);
      });

      root?.querySelector('#btn-ent-reimprimir')?.addEventListener('click', () => {
        mostrarModalTicket({
          venta,
          detalle,
          entrega,
          negocio,
          titulo: `Reimpresion de ticket ${venta.folio}`
        });
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  async function abrirModalDirectorioClientes() {
    try {
      const resp = await api.get('/clientes');
      estado.clientes = resp.clientes || [];
    } catch (error) {
      mostrarToast(error.message, 'error');
      return;
    }

    let editandoId = null;

    const root = abrirModal({
      titulo: 'Directorio de clientes',
      size: 'lg',
      contenidoHtml: `
        <div class="stack-lg">
          <form id="form-cliente-dir" class="form-grid">
            <div class="field">
              <label for="cd-nombre">Nombre del cliente *</label>
              <input type="text" id="cd-nombre" class="input" required maxlength="150" placeholder="Nombre o empresa">
            </div>
            <div class="field">
              <label for="cd-telefono">Telefono</label>
              <input type="text" id="cd-telefono" class="input" maxlength="60" placeholder="555-000-0000">
            </div>
            <div class="field col-span-2">
              <label for="cd-direccion">Direccion</label>
              <input type="text" id="cd-direccion" class="input" maxlength="255" placeholder="Calle, numero, colonia">
            </div>
            <div class="field col-span-2">
              <label for="cd-referencias">Referencias / notas del cliente</label>
              <input type="text" id="cd-referencias" class="input" maxlength="255" placeholder="Indicaciones de ubicacion o contacto">
            </div>
            <div class="col-span-2" style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary hidden" id="cd-cancelar">Cancelar edicion</button>
              <button type="submit" class="btn btn-primary" id="cd-submit">Registrar cliente</button>
            </div>
          </form>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Direccion y referencias</th>
                  <th class="text-right">Ventas</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody id="cd-tbody"></tbody>
            </table>
          </div>
        </div>
      `,
      footerHtml: '<button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>'
    });

    if (!root) {
      return;
    }

    const inputNombre = root.querySelector('#cd-nombre');
    const inputTel = root.querySelector('#cd-telefono');
    const inputDir = root.querySelector('#cd-direccion');
    const inputRef = root.querySelector('#cd-referencias');
    const btnCancelar = root.querySelector('#cd-cancelar');
    const btnSubmit = root.querySelector('#cd-submit');
    const tbody = root.querySelector('#cd-tbody');

    function limpiarForm() {
      editandoId = null;
      inputNombre.value = '';
      inputTel.value = '';
      inputDir.value = '';
      inputRef.value = '';
      btnSubmit.textContent = 'Registrar cliente';
      btnCancelar.classList.add('hidden');
    }

    function pintarTabla() {
      if (estado.clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay clientes registrados.</td></tr>';
        return;
      }

      tbody.innerHTML = estado.clientes
        .map(
          (c) => `
          <tr>
            <td><strong>${escaparHtml(c.nombre)}</strong></td>
            <td class="num">${escaparHtml(c.telefono || '-')}</td>
            <td>
              <div>${escaparHtml(c.direccion || '-')}</div>
              ${c.referencias ? `<div class="text-muted" style="font-size:12px;">${escaparHtml(c.referencias)}</div>` : ''}
            </td>
            <td class="text-right num">${c.total_ventas || 0}</td>
            <td class="text-center">
              <div class="row-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-cd-edit="${c.id}">Editar</button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-cd-del="${c.id}">Eliminar</button>
              </div>
            </td>
          </tr>
        `
        )
        .join('');

      tbody.querySelectorAll('[data-cd-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = estado.clientes.find((x) => x.id === Number(btn.dataset.cdEdit));
          if (!c) {
            return;
          }
          editandoId = c.id;
          inputNombre.value = c.nombre;
          inputTel.value = c.telefono || '';
          inputDir.value = c.direccion || '';
          inputRef.value = c.referencias || '';
          btnSubmit.textContent = 'Guardar cambios';
          btnCancelar.classList.remove('hidden');
          inputNombre.focus();
        });
      });

      tbody.querySelectorAll('[data-cd-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.cdDel);
          try {
            const respDel = await api.del(`/clientes/${id}`);
            mostrarToast(respDel.mensaje || 'Cliente eliminado.', 'success');
            const recarga = await api.get('/clientes');
            estado.clientes = recarga.clientes || [];
            pintarTabla();
            if (editandoId === id) {
              limpiarForm();
            }
          } catch (error) {
            mostrarToast(error.message, 'error');
          }
        });
      });
    }

    btnCancelar.addEventListener('click', limpiarForm);

    root.querySelector('#form-cliente-dir').addEventListener('submit', async (event) => {
      event.preventDefault();
      btnSubmit.disabled = true;
      const payload = {
        nombre: inputNombre.value.trim(),
        telefono: inputTel.value.trim(),
        direccion: inputDir.value.trim(),
        referencias: inputRef.value.trim()
      };
      try {
        if (editandoId) {
          await api.put(`/clientes/${editandoId}`, payload);
          mostrarToast('Cliente actualizado correctamente.', 'success');
        } else {
          await api.post('/clientes', payload);
          mostrarToast('Cliente registrado correctamente.', 'success');
        }
        limpiarForm();
        const recarga = await api.get('/clientes');
        estado.clientes = recarga.clientes || [];
        pintarTabla();
      } catch (error) {
        mostrarToast(error.message, 'error');
      } finally {
        btnSubmit.disabled = false;
      }
    });

    pintarTabla();
  }

  async function cargarLista() {
    try {
      const query = buildQuery({
        estado: estado.filtros.estado,
        filtro_fecha: estado.filtros.filtro_fecha,
        fecha: estado.filtros.fecha,
        fecha_inicio: estado.filtros.fecha_inicio,
        fecha_fin: estado.filtros.fecha_fin,
        buscar: estado.filtros.buscar,
        pagina: estado.filtros.pagina,
        limite: estado.paginacion.limite
      });
      const resp = await api.get(`/entregas${query}`);
      estado.entregas = resp.entregas || [];
      estado.paginacion = resp.paginacion || estado.paginacion;
      renderizarTabla();
    } catch (error) {
      mostrarToast(`Error al cargar entregas programadas: ${error.message}`, 'error');
    }
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const respResumen = await api.get('/entregas/resumen');
      estado.resumen = respResumen.resumen;
      renderizarKpis();
      await cargarLista();
    } catch (error) {
      mostrarToast(`Error al cargar entregas programadas: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}

