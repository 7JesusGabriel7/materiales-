import { api } from '../api/client.js';
import { escaparHtml, formatearFechaHora } from '../utils/format.js';
import { descargarPdfEjemploConfig } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import {
  CATALOGO_ILUSTRACIONES,
  generarHtmlTicket58mm,
  generarHtmlTicketPresupuesto58mm,
  obtenerSvgIlustracion
} from './ticket.js';

export function crearModuloConfiguracion({ onConfiguracionActualizada }) {
  const contenedor = document.getElementById('vista-configuracion');

  const estado = {
    negocio: {
      nombre: '',
      direccion: '',
      telefono: '',
      rfc: '',
      mensajeTicket: '',
      mensajePresupuesto: '',
      mensajePdf: '',
      mostrarCamionTicket: true,
      iconoTicket: 'camion_volteo',
      fecha_modificacion: null
    },
    iconosDisponibles: CATALOGO_ILUSTRACIONES,
    iconoSeleccionado: 'camion_volteo',
    pestanaPreview: 'venta',
    guardando: false,
    renderizadoBase: false
  };

  function leerFormulario() {
    const iconoTicket = estado.iconoSeleccionado || 'camion_volteo';
    return {
      nombre: contenedor.querySelector('#cfg-nombre')?.value.trim() || '',
      telefono: contenedor.querySelector('#cfg-telefono')?.value.trim() || '',
      direccion: contenedor.querySelector('#cfg-direccion')?.value.trim() || '',
      rfc: contenedor.querySelector('#cfg-rfc')?.value.trim() || '',
      mensajeTicket: contenedor.querySelector('#cfg-mensaje')?.value.trim() || '',
      mensajePresupuesto:
        contenedor.querySelector('#cfg-mensaje-presupuesto')?.value.trim() || '',
      mensajePdf: contenedor.querySelector('#cfg-mensaje-pdf')?.value.trim() || '',
      iconoTicket,
      mostrarCamionTicket: iconoTicket !== 'ninguno'
    };
  }

  function renderizarSelectorIconos() {
    const grid = contenedor.querySelector('#cfg-icon-picker');
    if (!grid) {
      return;
    }

    grid.innerHTML = estado.iconosDisponibles
      .map((item) => {
        const activo = estado.iconoSeleccionado === item.id;
        const miniatura =
          item.id === 'ninguno'
            ? '<span class="icon-picker-none-badge">Solo texto</span>'
            : obtenerSvgIlustracion(item.id, { envolver: false });

        return `
          <button
            type="button"
            class="icon-picker-card ${activo ? 'active' : ''}"
            data-icon-choice="${escaparHtml(item.id)}"
          >
            <div class="icon-picker-thumb">${miniatura}</div>
            <div class="icon-picker-name">${escaparHtml(item.nombre)}</div>
            <div class="icon-picker-cat">${escaparHtml(item.categoria)}</div>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-icon-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.iconoSeleccionado = btn.dataset.iconChoice;
        renderizarSelectorIconos();
        actualizarVistaPrevia();
      });
    });
  }

  function renderizarMiniaturaPdf(borrador) {
    const svgHtml =
      borrador.iconoTicket !== 'ninguno'
        ? obtenerSvgIlustracion(borrador.iconoTicket, { envolver: false })
        : '';
    const textoPiePdf =
      borrador.mensajePdf || borrador.mensajeTicket || 'Gracias por su compra.';

    return `
      <div class="pdf-preview-sheet">
        <div class="pdf-preview-stripe"></div>
        <div class="pdf-preview-body">
          <div class="pdf-preview-head">
            <div class="pdf-preview-biz">
              ${svgHtml}
              <div style="min-width:0;">
                <div style="font-weight:700;font-size:12px;line-height:1.25;">${escaparHtml(borrador.nombre || 'Casa de Materiales')}</div>
                ${borrador.direccion ? `<div class="text-secondary" style="font-size:10px;">${escaparHtml(borrador.direccion)}</div>` : ''}
                ${borrador.telefono || borrador.rfc ? `<div class="text-muted" style="font-size:9.5px;">${escaparHtml([borrador.telefono, borrador.rfc].filter(Boolean).join(' | '))}</div>` : ''}
              </div>
            </div>
            <div class="pdf-preview-folio-box">
              <div style="font-size:8.5px;color:#93c5fd;font-weight:700;">NOTA DE VENTA</div>
              <div style="font-weight:700;font-size:10.5px;">VTA-EJEMPLO-01</div>
            </div>
          </div>

          <div class="pdf-preview-note">
            <strong>Nota de la venta:</strong> Entregar en porton lateral y confirmar llegada.
          </div>

          <table class="pdf-preview-table">
            <thead>
              <tr>
                <th>Cant.</th>
                <th>Material</th>
                <th class="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">2 Bulto</td>
                <td>Cemento gris Portland 50 kg</td>
                <td class="text-right num">$490.00</td>
              </tr>
            </tbody>
          </table>

          <div class="pdf-preview-total">
            <span>TOTAL</span>
            <span class="num">$490.00</span>
          </div>

          <div class="pdf-preview-footer">${escaparHtml(textoPiePdf)}</div>
        </div>
      </div>
    `;
  }

  function actualizarVistaPrevia() {
    const previewEl = contenedor.querySelector('#cfg-doc-preview');
    if (!previewEl) {
      return;
    }

    contenedor.querySelectorAll('[data-cfg-preview-tab]').forEach((btn) => {
      btn.classList.toggle(
        'active',
        btn.dataset.cfgPreviewTab === estado.pestanaPreview
      );
    });

    const borrador = leerFormulario();
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fechaSql = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;

    const detalleEjemplo = [
      {
        producto_nombre: 'Cemento gris Portland 50 kg',
        unidad_medida: 'Bulto',
        cantidad: 2,
        precio_unitario: 245,
        importe: 490
      }
    ];

    if (estado.pestanaPreview === 'presupuesto') {
      previewEl.innerHTML = generarHtmlTicketPresupuesto58mm({
        presupuesto: {
          folio: 'PRE-EJEMPLO-000001',
          fecha_presupuesto: fechaSql,
          cliente_nombre: 'Cliente de ejemplo',
          subtotal: 490,
          total: 490
        },
        detalle: detalleEjemplo,
        negocio: borrador
      });
      return;
    }

    if (estado.pestanaPreview === 'pdf') {
      previewEl.innerHTML = renderizarMiniaturaPdf(borrador);
      return;
    }

    previewEl.innerHTML = generarHtmlTicket58mm({
      venta: {
        folio: 'VTA-EJEMPLO-000001',
        fecha_venta: fechaSql,
        subtotal: 490,
        total: 490,
        dinero_recibido: 500,
        cambio: 10
      },
      detalle: detalleEjemplo,
      negocio: borrador
    });
  }

  function llenarFormulario(negocio) {
    estado.negocio = {
      ...estado.negocio,
      ...negocio
    };
    estado.iconoSeleccionado =
      estado.negocio.iconoTicket ||
      (estado.negocio.mostrarCamionTicket === false ? 'ninguno' : 'camion_volteo');

    const setVal = (id, val) => {
      const el = contenedor.querySelector(id);
      if (el) {
        el.value = val || '';
      }
    };

    setVal('#cfg-nombre', estado.negocio.nombre);
    setVal('#cfg-telefono', estado.negocio.telefono);
    setVal('#cfg-direccion', estado.negocio.direccion);
    setVal('#cfg-rfc', estado.negocio.rfc);
    setVal('#cfg-mensaje', estado.negocio.mensajeTicket);
    setVal('#cfg-mensaje-presupuesto', estado.negocio.mensajePresupuesto);
    setVal('#cfg-mensaje-pdf', estado.negocio.mensajePdf);

    const metaEl = contenedor.querySelector('#cfg-ultima-modificacion');
    if (metaEl) {
      metaEl.textContent = estado.negocio.fecha_modificacion
        ? `Ultima actualizacion guardada: ${formatearFechaHora(estado.negocio.fecha_modificacion)}`
        : 'Cambios reflejados inmediatamente en tickets de 58 mm, presupuestos y notas PDF.';
    }

    renderizarSelectorIconos();
    actualizarVistaPrevia();
  }

  function renderizarBase() {
    if (estado.renderizadoBase) {
      return;
    }

    contenedor.innerHTML = `
      <div class="config-layout">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Datos y personalizacion de documentos</h2>
              <p class="card-subtitle">Configure datos del negocio, mensajes para ventas, presupuestos y PDF, e ilustracion del encabezado</p>
            </div>
          </div>

          <div class="card-body">
            <form id="form-configuracion-negocio" class="form-grid">
              <div class="field col-span-2">
                <label for="cfg-nombre">Nombre de la casa de materiales *</label>
                <input
                  type="text"
                  id="cfg-nombre"
                  class="input"
                  required
                  minlength="2"
                  maxlength="150"
                  placeholder="Ej. Casa de Materiales El Constructor"
                >
              </div>

              <div class="field">
                <label for="cfg-telefono">Numero de telefono</label>
                <input
                  type="text"
                  id="cfg-telefono"
                  class="input"
                  maxlength="60"
                  placeholder="Ej. Tel. 555-234-8910"
                >
              </div>

              <div class="field">
                <label for="cfg-rfc">RFC o dato fiscal</label>
                <input
                  type="text"
                  id="cfg-rfc"
                  class="input"
                  maxlength="60"
                  placeholder="Ej. RFC: CME240101AB1"
                >
              </div>

              <div class="field col-span-2">
                <label for="cfg-direccion">Direccion del establecimiento</label>
                <input
                  type="text"
                  id="cfg-direccion"
                  class="input"
                  maxlength="255"
                  placeholder="Ej. Av. Principal No. 145, Col. Centro"
                >
              </div>

              <div class="col-span-2 cfg-section-title">
                Notas y mensajes de documentos
                <div class="cfg-section-help">Edite por separado el pie de nota de ventas (58 mm), presupuestos y notas digitales en PDF</div>
              </div>

              <div class="field col-span-2">
                <label for="cfg-mensaje">Nota / mensaje al pie del ticket de venta (58 mm)</label>
                <textarea
                  id="cfg-mensaje"
                  class="textarea"
                  maxlength="500"
                  placeholder="Gracias por su compra. Conserve este comprobante para cualquier aclaracion."
                ></textarea>
              </div>

              <div class="field col-span-2">
                <label for="cfg-mensaje-presupuesto">Nota / mensaje en presupuestos (ticket 58 mm y PDF)</label>
                <textarea
                  id="cfg-mensaje-presupuesto"
                  class="textarea"
                  maxlength="500"
                  placeholder="Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso."
                ></textarea>
              </div>

              <div class="field col-span-2">
                <label for="cfg-mensaje-pdf">Nota / mensaje en nota de venta digital (PDF)</label>
                <textarea
                  id="cfg-mensaje-pdf"
                  class="textarea"
                  maxlength="500"
                  placeholder="Gracias por su compra. Documento digital emitido por el establecimiento para referencia y control del cliente."
                ></textarea>
              </div>

              <div class="col-span-2 cfg-section-title">
                Ilustracion para tickets y PDFs
                <div class="cfg-section-help">Elija entre 3 opciones de camiones, 2 maquinas de excavar o solo texto</div>
              </div>

              <div class="col-span-2">
                <div id="cfg-icon-picker" class="icon-picker-grid"></div>
              </div>

              <div class="col-span-2 info-box" id="cfg-ultima-modificacion"></div>

              <div class="col-span-2" style="display:flex;justify-content:flex-end;gap:10px;margin-top:4px;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary" id="cfg-btn-restaurar">
                  Recargar guardados
                </button>
                <button type="submit" class="btn btn-primary" id="cfg-btn-guardar">
                  Guardar configuracion
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Vista previa de documentos</h2>
              <p class="card-subtitle">Cambie de pestana para revisar cada formato en tiempo real</p>
            </div>
            <div class="pos-view-switch" role="tablist" aria-label="Vista previa de documentos">
              <button type="button" class="pos-view-btn active" data-cfg-preview-tab="venta">Ticket venta</button>
              <button type="button" class="pos-view-btn" data-cfg-preview-tab="presupuesto">Presupuesto</button>
              <button type="button" class="pos-view-btn" data-cfg-preview-tab="pdf">Nota PDF</button>
            </div>
          </div>
          <div class="card-body">
            <div id="cfg-doc-preview" class="ticket-preview-wrapper"></div>
            <div class="cfg-pdf-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="cfg-btn-pdf-venta">
                Descargar PDF de venta (prueba)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="cfg-btn-pdf-presupuesto">
                Descargar PDF de presupuesto (prueba)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const camposPreview = [
      '#cfg-nombre',
      '#cfg-telefono',
      '#cfg-direccion',
      '#cfg-rfc',
      '#cfg-mensaje',
      '#cfg-mensaje-presupuesto',
      '#cfg-mensaje-pdf'
    ];
    camposPreview.forEach((selector) => {
      const el = contenedor.querySelector(selector);
      el?.addEventListener('input', actualizarVistaPrevia);
      el?.addEventListener('change', actualizarVistaPrevia);
    });

    contenedor.querySelectorAll('[data-cfg-preview-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.pestanaPreview = btn.dataset.cfgPreviewTab;
        actualizarVistaPrevia();
      });
    });

    const btnPdfVenta = contenedor.querySelector('#cfg-btn-pdf-venta');
    btnPdfVenta?.addEventListener('click', () => {
      descargarPdfEjemploConfig({
        tipo: 'venta',
        negocio: leerFormulario(),
        boton: btnPdfVenta
      });
    });

    const btnPdfPresupuesto = contenedor.querySelector('#cfg-btn-pdf-presupuesto');
    btnPdfPresupuesto?.addEventListener('click', () => {
      descargarPdfEjemploConfig({
        tipo: 'presupuesto',
        negocio: leerFormulario(),
        boton: btnPdfPresupuesto
      });
    });

    contenedor.querySelector('#cfg-btn-restaurar')?.addEventListener('click', () => {
      cargarDatos();
    });

    contenedor
      .querySelector('#form-configuracion-negocio')
      ?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (estado.guardando) {
          return;
        }

        const btnGuardar = contenedor.querySelector('#cfg-btn-guardar');
        const payload = leerFormulario();
        if (payload.nombre.length < 2) {
          mostrarToast('El nombre de la casa de materiales debe tener al menos 2 caracteres.', 'error');
          return;
        }

        estado.guardando = true;
        if (btnGuardar) {
          btnGuardar.disabled = true;
          btnGuardar.textContent = 'Guardando...';
        }

        try {
          const resp = await api.put('/config', payload);
          llenarFormulario(resp.negocio);
          if (onConfiguracionActualizada) {
            onConfiguracionActualizada(resp.negocio);
          }
          mostrarToast(
            resp.mensaje || 'Datos del establecimiento actualizados correctamente.',
            'success'
          );
        } catch (error) {
          mostrarToast(error.message, 'error');
        } finally {
          estado.guardando = false;
          if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Guardar configuracion';
          }
        }
      });

    renderizarSelectorIconos();
    estado.renderizadoBase = true;
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const resp = await api.get('/config');
      if (Array.isArray(resp.iconos_ticket) && resp.iconos_ticket.length > 0) {
        estado.iconosDisponibles = resp.iconos_ticket;
      }
      if (resp.negocio) {
        llenarFormulario(resp.negocio);
        if (onConfiguracionActualizada) {
          onConfiguracionActualizada(resp.negocio);
        }
      }
    } catch (error) {
      mostrarToast(`Error al cargar la configuracion: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}
