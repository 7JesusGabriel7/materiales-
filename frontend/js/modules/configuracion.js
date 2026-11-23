import { api } from '../api/client.js';
import { escaparHtml, formatearFechaHora } from '../utils/format.js';
import { descargarPdfEjemploConfig } from '../utils/pdf.js';
import { mostrarToast } from '../utils/toast.js';
import {
  CATALOGO_ILUSTRACIONES,
  generarHtmlTicket58mm,
  generarHtmlTicketPresupuesto58mm,
  normalizarEscalaLetra,
  obtenerSvgIlustracion
} from './ticket.js';

function obtenerEtiquetaEscala(escala) {
  if (escala <= 85) return 'Chica';
  if (escala < 100) return 'Compacta';
  if (escala === 100) return 'Normal';
  if (escala <= 120) return 'Grande';
  return 'Extra grande';
}

function construirBloqueControlEscala({ idPrefijo, dataPreset, titulo }) {
  return `
    <div class="cfg-font-scale-box">
      <div style="font-size:12.5px;font-weight:700;color:var(--text-primary);">${escaparHtml(titulo)}</div>
      <div class="cfg-font-scale-controls">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="${idPrefijo}-menos"
          aria-label="Hacer letra mas chica"
        >
          A-
        </button>
        <input
          type="range"
          id="${idPrefijo}-letra"
          class="cfg-font-scale-slider"
          min="75"
          max="140"
          step="5"
          value="100"
          aria-label="${escaparHtml(titulo)}"
        >
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="${idPrefijo}-mas"
          aria-label="Hacer letra mas grande"
        >
          A+
        </button>
        <span class="badge badge-neutral num" id="${idPrefijo}-valor">100% - Normal</span>
      </div>
      <div class="cfg-font-scale-presets">
        <button type="button" class="btn btn-secondary btn-sm cfg-font-preset-btn" data-${dataPreset}="85">Chica (85%)</button>
        <button type="button" class="btn btn-secondary btn-sm cfg-font-preset-btn active" data-${dataPreset}="100">Normal (100%)</button>
        <button type="button" class="btn btn-secondary btn-sm cfg-font-preset-btn" data-${dataPreset}="115">Grande (115%)</button>
        <button type="button" class="btn btn-secondary btn-sm cfg-font-preset-btn" data-${dataPreset}="130">Extra grande (130%)</button>
      </div>
    </div>
  `;
}

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
      escalaLetra: 100,
      escalaLetraPdf: 100,
      fecha_modificacion: null
    },
    iconosDisponibles: CATALOGO_ILUSTRACIONES,
    iconoSeleccionado: 'camion_volteo',
    escalaLetra: 100,
    escalaLetraPdf: 100,
    pestanaConfig: 'negocio',
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
      escalaLetra: normalizarEscalaLetra(estado.escalaLetra),
      escalaLetraPdf: normalizarEscalaLetra(estado.escalaLetraPdf),
      mostrarCamionTicket: iconoTicket !== 'ninguno'
    };
  }

  function hayCambiosSinGuardar() {
    const actual = leerFormulario();
    const guardado = estado.negocio;
    const iconoGuardado =
      guardado.iconoTicket ||
      (guardado.mostrarCamionTicket === false ? 'ninguno' : 'camion_volteo');

    return (
      actual.nombre !== (guardado.nombre || '').trim() ||
      actual.telefono !== (guardado.telefono || '').trim() ||
      actual.direccion !== (guardado.direccion || '').trim() ||
      actual.rfc !== (guardado.rfc || '').trim() ||
      actual.mensajeTicket !== (guardado.mensajeTicket || '').trim() ||
      actual.mensajePresupuesto !== (guardado.mensajePresupuesto || '').trim() ||
      actual.mensajePdf !== (guardado.mensajePdf || '').trim() ||
      actual.iconoTicket !== iconoGuardado ||
      actual.escalaLetra !== normalizarEscalaLetra(guardado.escalaLetra) ||
      actual.escalaLetraPdf !== normalizarEscalaLetra(guardado.escalaLetraPdf)
    );
  }

  function actualizarEstadoGuardado() {
    const statusEl = contenedor.querySelector('#cfg-save-status');
    const btnRestaurar = contenedor.querySelector('#cfg-btn-restaurar');
    if (!statusEl) {
      return;
    }

    const sucio = hayCambiosSinGuardar();
    if (btnRestaurar) {
      btnRestaurar.disabled = !sucio || estado.guardando;
    }

    if (sucio) {
      statusEl.innerHTML =
        '<span class="badge badge-warning">Cambios sin guardar</span><span>Presione "Guardar cambios" para aplicarlos.</span>';
      return;
    }

    const fechaTxt = estado.negocio.fecha_modificacion
      ? `Actualizado: ${formatearFechaHora(estado.negocio.fecha_modificacion)}`
      : 'Sin cambios pendientes';
    statusEl.innerHTML = `<span class="badge badge-success">Todo guardado</span><span>${escaparHtml(fechaTxt)}</span>`;
  }

  function sincronizarUnControlEscala({ idPrefijo, dataAttr, valor }) {
    const escala = normalizarEscalaLetra(valor);
    const slider = contenedor.querySelector(`#${idPrefijo}-letra`);
    const badge = contenedor.querySelector(`#${idPrefijo}-valor`);
    const btnMenos = contenedor.querySelector(`#${idPrefijo}-menos`);
    const btnMas = contenedor.querySelector(`#${idPrefijo}-mas`);

    if (slider) {
      slider.value = String(escala);
    }
    if (badge) {
      badge.textContent = `${escala}% - ${obtenerEtiquetaEscala(escala)}`;
    }
    if (btnMenos) {
      btnMenos.disabled = escala <= 75;
    }
    if (btnMas) {
      btnMas.disabled = escala >= 140;
    }

    contenedor.querySelectorAll(`[${dataAttr}]`).forEach((btn) => {
      const valBtn = Number(btn.getAttribute(dataAttr));
      btn.classList.toggle('active', valBtn === escala);
    });
    return escala;
  }

  function actualizarControlEscala() {
    estado.escalaLetra = sincronizarUnControlEscala({
      idPrefijo: 'cfg-escala',
      dataAttr: 'data-escala-preset',
      valor: estado.escalaLetra
    });
    estado.escalaLetraPdf = sincronizarUnControlEscala({
      idPrefijo: 'cfg-escala-pdf',
      dataAttr: 'data-escala-pdf-preset',
      valor: estado.escalaLetraPdf
    });
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
    const escala = normalizarEscalaLetra(borrador.escalaLetraPdf) / 100;

    return `
      <div class="pdf-preview-sheet" style="--pdf-preview-scale:${escala};">
        <div class="pdf-preview-stripe"></div>
        <div class="pdf-preview-body">
          <div class="pdf-preview-head">
            <div class="pdf-preview-biz">
              ${svgHtml}
              <div style="min-width:0;">
                <div style="font-weight:700;font-size:calc(12px * var(--pdf-preview-scale, 1));line-height:1.25;">${escaparHtml(borrador.nombre || 'Casa de Materiales')}</div>
                ${borrador.direccion ? `<div class="text-secondary" style="font-size:calc(10px * var(--pdf-preview-scale, 1));">${escaparHtml(borrador.direccion)}</div>` : ''}
                ${borrador.telefono || borrador.rfc ? `<div class="text-muted" style="font-size:calc(9.5px * var(--pdf-preview-scale, 1));">${escaparHtml([borrador.telefono, borrador.rfc].filter(Boolean).join(' | '))}</div>` : ''}
              </div>
            </div>
            <div class="pdf-preview-folio-box">
              <div style="font-size:calc(8.5px * var(--pdf-preview-scale, 1));color:#93c5fd;font-weight:700;">NOTA DE VENTA</div>
              <div style="font-weight:700;font-size:calc(10.5px * var(--pdf-preview-scale, 1));">VTA-EJEMPLO-01</div>
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
    const captionEl = contenedor.querySelector('#cfg-preview-caption');
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
      if (captionEl) {
        captionEl.textContent = `Ticket 58 mm (presupuesto) - Letra al ${borrador.escalaLetra}% (${obtenerEtiquetaEscala(borrador.escalaLetra)})`;
      }
      actualizarEstadoGuardado();
      return;
    }

    if (estado.pestanaPreview === 'pdf') {
      previewEl.innerHTML = renderizarMiniaturaPdf(borrador);
      if (captionEl) {
        captionEl.textContent = `Nota PDF (hoja carta) - Letra al ${borrador.escalaLetraPdf}% (${obtenerEtiquetaEscala(borrador.escalaLetraPdf)})`;
      }
      actualizarEstadoGuardado();
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
    if (captionEl) {
      captionEl.textContent = `Ticket 58 mm (venta) - Letra al ${borrador.escalaLetra}% (${obtenerEtiquetaEscala(borrador.escalaLetra)})`;
    }
    actualizarEstadoGuardado();
  }

  function cambiarPestanaConfig(tabId, { sincronizarPreview = true } = {}) {
    estado.pestanaConfig = tabId;

    contenedor.querySelectorAll('[data-cfg-tab]').forEach((btn) => {
      const activo = btn.dataset.cfgTab === tabId;
      btn.classList.toggle('active', activo);
      btn.setAttribute('aria-selected', activo ? 'true' : 'false');
    });

    contenedor.querySelectorAll('[data-cfg-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.cfgPanel !== tabId);
    });

    if (sincronizarPreview) {
      if (tabId === 'ticket') {
        estado.pestanaPreview = 'venta';
      } else if (tabId === 'pdf') {
        estado.pestanaPreview = 'pdf';
      } else if (tabId === 'negocio' || tabId === 'dibujo') {
        if (estado.pestanaPreview === 'pdf') {
          estado.pestanaPreview = 'venta';
        }
      }
    }

    actualizarVistaPrevia();
  }

  function llenarFormulario(negocio) {
    estado.negocio = {
      ...estado.negocio,
      ...negocio
    };
    estado.iconoSeleccionado =
      estado.negocio.iconoTicket ||
      (estado.negocio.mostrarCamionTicket === false ? 'ninguno' : 'camion_volteo');
    estado.escalaLetra = normalizarEscalaLetra(estado.negocio.escalaLetra);
    estado.escalaLetraPdf = normalizarEscalaLetra(estado.negocio.escalaLetraPdf);

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

    actualizarControlEscala();
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
              <h2 class="card-title">Configuracion de notas</h2>
              <p class="card-subtitle">Elija una seccion para editar y revise el resultado a la derecha</p>
            </div>
          </div>

          <div class="cfg-tabs" role="tablist" aria-label="Secciones de configuracion">
            <button type="button" class="cfg-tab-btn active" data-cfg-tab="negocio" role="tab" aria-selected="true">1. Negocio</button>
            <button type="button" class="cfg-tab-btn" data-cfg-tab="ticket" role="tab" aria-selected="false">2. Ticket (58 mm)</button>
            <button type="button" class="cfg-tab-btn" data-cfg-tab="pdf" role="tab" aria-selected="false">3. Nota PDF</button>
            <button type="button" class="cfg-tab-btn" data-cfg-tab="dibujo" role="tab" aria-selected="false">4. Dibujo</button>
          </div>

          <form id="form-configuracion-negocio" novalidate>
            <div class="card-body">
              <div class="cfg-tab-panel" data-cfg-panel="negocio">
                <div class="cfg-panel-intro">
                  <h3 class="cfg-panel-intro-title">Datos del establecimiento</h3>
                  <p class="cfg-panel-intro-desc">Aparecen en el encabezado de todos los tickets y notas PDF.</p>
                </div>

                <div class="form-grid">
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
                </div>
              </div>

              <div class="cfg-tab-panel hidden" data-cfg-panel="ticket">
                <div class="cfg-panel-intro">
                  <h3 class="cfg-panel-intro-title">Impresion de ticket termico (58 mm)</h3>
                  <p class="cfg-panel-intro-desc">Ajuste la letra y los mensajes al pie para tickets de venta y presupuestos.</p>
                </div>

                ${construirBloqueControlEscala({
                  idPrefijo: 'cfg-escala',
                  dataPreset: 'escala-preset',
                  titulo: 'Tamano de letra del ticket (58 mm)'
                })}

                <div class="field">
                  <label for="cfg-mensaje">Mensaje al pie del ticket de venta</label>
                  <textarea
                    id="cfg-mensaje"
                    class="textarea"
                    maxlength="500"
                    placeholder="Gracias por su compra. Conserve este comprobante para cualquier aclaracion."
                  ></textarea>
                </div>

                <div class="field">
                  <label for="cfg-mensaje-presupuesto">Mensaje al pie de presupuestos (ticket 58 mm y PDF)</label>
                  <textarea
                    id="cfg-mensaje-presupuesto"
                    class="textarea"
                    maxlength="500"
                    placeholder="Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso."
                  ></textarea>
                </div>
              </div>

              <div class="cfg-tab-panel hidden" data-cfg-panel="pdf">
                <div class="cfg-panel-intro">
                  <h3 class="cfg-panel-intro-title">Notas digitales en PDF (hoja carta)</h3>
                  <p class="cfg-panel-intro-desc">Tamano de letra y mensaje exclusivo para los PDFs, independiente del ticket.</p>
                </div>

                ${construirBloqueControlEscala({
                  idPrefijo: 'cfg-escala-pdf',
                  dataPreset: 'escala-pdf-preset',
                  titulo: 'Tamano de letra de documentos PDF'
                })}

                <div class="field">
                  <label for="cfg-mensaje-pdf">Mensaje al pie de nota de venta digital (PDF)</label>
                  <textarea
                    id="cfg-mensaje-pdf"
                    class="textarea"
                    maxlength="500"
                    placeholder="Gracias por su compra. Documento digital emitido por el establecimiento para referencia y control del cliente."
                  ></textarea>
                </div>

                <div class="cfg-pdf-test-box">
                  <div style="font-size:12.5px;font-weight:700;color:var(--text-primary);">Probar descarga de PDF con estos ajustes</div>
                  <div class="cfg-pdf-test-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="cfg-btn-pdf-venta">
                      Descargar PDF de venta (prueba)
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" id="cfg-btn-pdf-presupuesto">
                      Descargar PDF de presupuesto (prueba)
                    </button>
                  </div>
                </div>
              </div>

              <div class="cfg-tab-panel hidden" data-cfg-panel="dibujo">
                <div class="cfg-panel-intro">
                  <h3 class="cfg-panel-intro-title">Dibujo del encabezado</h3>
                  <p class="cfg-panel-intro-desc">Seleccione un camion, una maquina de excavar o imprima solo texto.</p>
                </div>

                <div id="cfg-icon-picker" class="icon-picker-grid"></div>
              </div>
            </div>

            <div class="cfg-save-bar">
              <div id="cfg-save-status" class="cfg-save-status"></div>
              <div class="cfg-save-actions">
                <button type="button" class="btn btn-secondary" id="cfg-btn-restaurar" disabled>
                  Descartar
                </button>
                <button type="submit" class="btn btn-primary" id="cfg-btn-guardar">
                  Guardar cambios
                </button>
              </div>
            </div>
          </form>
        </div>

        <div class="card cfg-preview-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Vista previa en vivo</h2>
              <p class="card-subtitle">Cambie de pestana para revisar cada formato</p>
            </div>
            <div class="pos-view-switch" role="tablist" aria-label="Vista previa de documentos">
              <button type="button" class="pos-view-btn active" data-cfg-preview-tab="venta">Ticket venta</button>
              <button type="button" class="pos-view-btn" data-cfg-preview-tab="presupuesto">Presupuesto</button>
              <button type="button" class="pos-view-btn" data-cfg-preview-tab="pdf">Nota PDF</button>
            </div>
          </div>
          <div class="card-body">
            <div id="cfg-doc-preview" class="ticket-preview-wrapper"></div>
            <div id="cfg-preview-caption" class="cfg-preview-caption"></div>
          </div>
        </div>
      </div>
    `;

    contenedor.querySelectorAll('[data-cfg-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cambiarPestanaConfig(btn.dataset.cfgTab);
      });
    });

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

    contenedor.querySelector('#cfg-mensaje')?.addEventListener('focus', () => {
      if (estado.pestanaPreview !== 'venta') {
        estado.pestanaPreview = 'venta';
        actualizarVistaPrevia();
      }
    });

    contenedor.querySelector('#cfg-mensaje-presupuesto')?.addEventListener('focus', () => {
      if (estado.pestanaPreview !== 'presupuesto') {
        estado.pestanaPreview = 'presupuesto';
        actualizarVistaPrevia();
      }
    });

    const controlesEscala = [
      { idPrefijo: 'cfg-escala', dataAttr: 'data-escala-preset', campo: 'escalaLetra' },
      { idPrefijo: 'cfg-escala-pdf', dataAttr: 'data-escala-pdf-preset', campo: 'escalaLetraPdf' }
    ];

    controlesEscala.forEach(({ idPrefijo, dataAttr, campo }) => {
      const aplicar = (nuevoValor) => {
        estado[campo] = normalizarEscalaLetra(nuevoValor);
        actualizarControlEscala();
        actualizarVistaPrevia();
      };

      const slider = contenedor.querySelector(`#${idPrefijo}-letra`);
      slider?.addEventListener('input', (e) => {
        aplicar(e.target.value);
      });
      slider?.addEventListener('change', (e) => {
        aplicar(e.target.value);
      });
      contenedor.querySelector(`#${idPrefijo}-menos`)?.addEventListener('click', () => {
        aplicar(estado[campo] - 5);
      });
      contenedor.querySelector(`#${idPrefijo}-mas`)?.addEventListener('click', () => {
        aplicar(estado[campo] + 5);
      });
      contenedor.querySelectorAll(`[${dataAttr}]`).forEach((btn) => {
        btn.addEventListener('click', () => {
          aplicar(Number(btn.getAttribute(dataAttr)));
        });
      });
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
      llenarFormulario(estado.negocio);
      mostrarToast('Cambios descartados.', 'warning');
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
          cambiarPestanaConfig('negocio', { sincronizarPreview: false });
          contenedor.querySelector('#cfg-nombre')?.focus();
          mostrarToast('El nombre de la casa de materiales debe tener al menos 2 caracteres.', 'error');
          return;
        }

        estado.guardando = true;
        actualizarEstadoGuardado();
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
            btnGuardar.textContent = 'Guardar cambios';
          }
          actualizarEstadoGuardado();
        }
      });

    actualizarControlEscala();
    renderizarSelectorIconos();
    cambiarPestanaConfig(estado.pestanaConfig, { sincronizarPreview: false });
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
