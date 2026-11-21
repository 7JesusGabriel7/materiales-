import { api } from '../api/client.js';
import { escaparHtml, formatearFechaHora } from '../utils/format.js';
import { mostrarToast } from '../utils/toast.js';
import { generarHtmlTicket58mm } from './ticket.js';

export function crearModuloConfiguracion({ onConfiguracionActualizada }) {
  const contenedor = document.getElementById('vista-configuracion');

  const estado = {
    negocio: {
      nombre: '',
      direccion: '',
      telefono: '',
      rfc: '',
      mensajeTicket: '',
      mostrarCamionTicket: true,
      fecha_modificacion: null
    },
    guardando: false,
    renderizadoBase: false
  };

  function leerFormulario() {
    return {
      nombre: contenedor.querySelector('#cfg-nombre')?.value.trim() || '',
      telefono: contenedor.querySelector('#cfg-telefono')?.value.trim() || '',
      direccion: contenedor.querySelector('#cfg-direccion')?.value.trim() || '',
      rfc: contenedor.querySelector('#cfg-rfc')?.value.trim() || '',
      mensajeTicket: contenedor.querySelector('#cfg-mensaje')?.value.trim() || '',
      mostrarCamionTicket: Boolean(
        contenedor.querySelector('#cfg-mostrar-camion')?.checked
      )
    };
  }

  function actualizarVistaPreviaTicket() {
    const previewEl = contenedor.querySelector('#cfg-ticket-preview');
    if (!previewEl) {
      return;
    }

    const borrador = leerFormulario();
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fechaSql = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;

    const ventaEjemplo = {
      folio: 'VTA-EJEMPLO-000001',
      fecha_venta: fechaSql,
      subtotal: 490,
      total: 490,
      dinero_recibido: 500,
      cambio: 10
    };

    const detalleEjemplo = [
      {
        producto_nombre: 'Cemento gris Portland 50 kg',
        unidad_medida: 'Bulto',
        cantidad: 2,
        precio_unitario: 245,
        importe: 490
      }
    ];

    previewEl.innerHTML = generarHtmlTicket58mm({
      venta: ventaEjemplo,
      detalle: detalleEjemplo,
      negocio: borrador
    });
  }

  function llenarFormulario(negocio) {
    estado.negocio = {
      ...estado.negocio,
      ...negocio
    };

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

    const checkCamion = contenedor.querySelector('#cfg-mostrar-camion');
    if (checkCamion) {
      checkCamion.checked = estado.negocio.mostrarCamionTicket !== false;
    }

    const metaEl = contenedor.querySelector('#cfg-ultima-modificacion');
    if (metaEl) {
      metaEl.textContent = estado.negocio.fecha_modificacion
        ? `Ultima actualizacion guardada: ${formatearFechaHora(estado.negocio.fecha_modificacion)}`
        : 'Cambios reflejados inmediatamente en encabezados y tickets de 58 mm.';
    }

    actualizarVistaPreviaTicket();
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
              <h2 class="card-title">Datos de la casa de materiales</h2>
              <p class="card-subtitle">Edite la informacion que aparece en el sistema y en el ticket termico de 58 mm</p>
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

              <div class="field col-span-2">
                <label for="cfg-mensaje">Mensaje al pie del ticket</label>
                <textarea
                  id="cfg-mensaje"
                  class="textarea"
                  maxlength="255"
                  placeholder="Gracias por su compra. Conserve este comprobante."
                ></textarea>
              </div>

              <div class="col-span-2">
                <label class="checkbox-row" for="cfg-mostrar-camion">
                  <input type="checkbox" id="cfg-mostrar-camion" checked>
                  <span>Mostrar ilustracion de camion de volteo en el encabezado del ticket</span>
                </label>
              </div>

              <div class="col-span-2 info-box" id="cfg-ultima-modificacion"></div>

              <div class="col-span-2" style="display:flex;justify-content:flex-end;gap:10px;margin-top:4px;">
                <button type="button" class="btn btn-secondary" id="cfg-btn-restaurar">
                  Recargar guardados
                </button>
                <button type="submit" class="btn btn-primary" id="cfg-btn-guardar">
                  Guardar datos del negocio
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Vista previa del ticket (58 mm)</h2>
              <p class="card-subtitle">Actualizacion en tiempo real conforme edita el formulario</p>
            </div>
          </div>
          <div class="card-body">
            <div id="cfg-ticket-preview" class="ticket-preview-wrapper"></div>
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
      '#cfg-mostrar-camion'
    ];
    camposPreview.forEach((selector) => {
      const el = contenedor.querySelector(selector);
      el?.addEventListener('input', actualizarVistaPreviaTicket);
      el?.addEventListener('change', actualizarVistaPreviaTicket);
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
            btnGuardar.textContent = 'Guardar datos del negocio';
          }
        }
      });

    estado.renderizadoBase = true;
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const resp = await api.get('/config');
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

