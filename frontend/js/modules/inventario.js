import { api, buildQuery } from '../api/client.js';
import {
  escaparHtml,
  formatearCantidad,
  formatearFechaHora,
  redondearCantidad
} from '../utils/format.js';
import { abrirModal, cerrarModal } from '../utils/modal.js';
import { mostrarToast } from '../utils/toast.js';

const ETIQUETAS_TIPO_MOVIMIENTO = {
  ENTRADA: { texto: 'Entrada', clase: 'badge-success' },
  SALIDA: { texto: 'Salida manual', clase: 'badge-warning' },
  SALIDA_VENTA: { texto: 'Salida por venta', clase: 'badge-neutral' },
  AJUSTE: { texto: 'Ajuste', clase: 'badge-danger' }
};

export function crearModuloInventario({ onInventarioModificado }) {
  const contenedor = document.getElementById('vista-inventario');

  const estado = {
    resumen: null,
    bajoStock: [],
    movimientos: [],
    productosCatalogo: [],
    filtros: {
      buscar: '',
      tipo: '',
      fecha_inicio: '',
      fecha_fin: '',
      pagina: 1
    },
    paginacion: {
      total: 0,
      pagina: 1,
      limite: 25,
      total_paginas: 1
    },
    renderizadoBase: false
  };

  function renderizarBase() {
    if (estado.renderizadoBase) {
      return;
    }

    contenedor.innerHTML = `
      <div class="stack-lg">
        <div id="inv-kpi-grid" class="kpi-grid"></div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Productos con pocas existencias</h2>
              <p class="card-subtitle">Materiales con existencia menor o igual al minimo configurado</p>
            </div>
            <button type="button" class="btn btn-primary" id="inv-btn-nuevo-movimiento">
              Registrar movimiento manual
            </button>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoria</th>
                    <th>Unidad</th>
                    <th class="text-right">Existencias</th>
                    <th class="text-right">Minimo</th>
                    <th class="text-center">Estado</th>
                    <th class="text-center">Accion</th>
                  </tr>
                </thead>
                <tbody id="inv-bajo-stock-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Historial de movimientos de inventario</h2>
              <p class="card-subtitle">Registro completo de entradas, salidas por venta y ajustes</p>
            </div>
          </div>
          <div class="card-body">
            <div class="toolbar">
              <div class="toolbar-group">
                <div class="field field-grow">
                  <label for="inv-mov-buscar">Buscar producto, motivo o folio</label>
                  <input type="text" id="inv-mov-buscar" class="input" placeholder="Ej. Cemento, VTA-, Compra...">
                </div>
                <div class="field" style="min-width: 170px;">
                  <label for="inv-mov-tipo">Tipo de movimiento</label>
                  <select id="inv-mov-tipo" class="select">
                    <option value="">Todos</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida manual</option>
                    <option value="SALIDA_VENTA">Salida por venta</option>
                    <option value="AJUSTE">Ajuste</option>
                  </select>
                </div>
                <div class="field">
                  <label for="inv-mov-inicio">Desde</label>
                  <input type="date" id="inv-mov-inicio" class="input">
                </div>
                <div class="field">
                  <label for="inv-mov-fin">Hasta</label>
                  <input type="date" id="inv-mov-fin" class="input">
                </div>
              </div>
              <div class="toolbar-actions">
                <button type="button" class="btn btn-primary" id="inv-mov-filtrar">Consultar</button>
                <button type="button" class="btn btn-secondary" id="inv-mov-limpiar">Restablecer</button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Stock anterior</th>
                    <th class="text-right">Stock nuevo</th>
                    <th>Motivo / Referencia</th>
                  </tr>
                </thead>
                <tbody id="inv-mov-tbody"></tbody>
              </table>
            </div>
          </div>
          <div id="inv-mov-paginacion" class="pagination-bar"></div>
        </div>
      </div>
    `;

    contenedor.querySelector('#inv-btn-nuevo-movimiento').addEventListener('click', () => {
      abrirModalMovimiento(null, 'ENTRADA');
    });

    const aplicarFiltrosMovimientos = () => {
      estado.filtros.buscar = contenedor.querySelector('#inv-mov-buscar').value.trim();
      estado.filtros.tipo = contenedor.querySelector('#inv-mov-tipo').value;
      estado.filtros.fecha_inicio = contenedor.querySelector('#inv-mov-inicio').value;
      estado.filtros.fecha_fin = contenedor.querySelector('#inv-mov-fin').value;
      estado.filtros.pagina = 1;
      cargarMovimientos();
    };

    contenedor.querySelector('#inv-mov-filtrar').addEventListener('click', aplicarFiltrosMovimientos);
    contenedor.querySelector('#inv-mov-buscar').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        aplicarFiltrosMovimientos();
      }
    });

    contenedor.querySelector('#inv-mov-limpiar').addEventListener('click', () => {
      estado.filtros = { buscar: '', tipo: '', fecha_inicio: '', fecha_fin: '', pagina: 1 };
      contenedor.querySelector('#inv-mov-buscar').value = '';
      contenedor.querySelector('#inv-mov-tipo').value = '';
      contenedor.querySelector('#inv-mov-inicio').value = '';
      contenedor.querySelector('#inv-mov-fin').value = '';
      cargarMovimientos();
    });

    estado.renderizadoBase = true;
  }

  function renderizarKpis() {
    const grid = contenedor.querySelector('#inv-kpi-grid');
    if (!grid || !estado.resumen) {
      return;
    }

    const r = estado.resumen;
    const sinStockCtrl = Number(r.sin_control_stock || 0);
    const metaActivos =
      sinStockCtrl > 0
        ? `${r.con_control_stock} con inventario, ${sinStockCtrl} sin control`
        : 'Catalogo vigente';

    grid.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Productos activos</div>
        <div class="kpi-value">${r.total_productos}</div>
        <div class="kpi-meta">${metaActivos}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pocas existencias</div>
        <div class="kpi-value" style="color:${Number(r.bajo_stock) > 0 ? 'var(--warning-text)' : 'var(--text-primary)'};">
          ${r.bajo_stock}
        </div>
        <div class="kpi-meta">En o debajo del stock minimo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Agotados</div>
        <div class="kpi-value" style="color:${Number(r.agotados) > 0 ? 'var(--danger-text)' : 'var(--text-primary)'};">
          ${r.agotados}
        </div>
        <div class="kpi-meta">Con existencia en cero</div>
      </div>
    `;
  }

  function renderizarBajoStock() {
    const tbody = contenedor.querySelector('#inv-bajo-stock-tbody');
    if (!tbody) {
      return;
    }

    if (estado.bajoStock.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            Todos los productos activos cuentan con existencias por encima del minimo.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = estado.bajoStock
      .map((prod) => {
        const agotado = Number(prod.existencias) <= 0;
        return `
          <tr>
            <td><strong>${escaparHtml(prod.nombre)}</strong></td>
            <td>${escaparHtml(prod.categoria_nombre)}</td>
            <td>${escaparHtml(prod.unidad_medida)}</td>
            <td class="text-right num">${formatearCantidad(prod.existencias)}</td>
            <td class="text-right num">${formatearCantidad(prod.stock_minimo)}</td>
            <td class="text-center">
              <span class="badge ${agotado ? 'badge-danger' : 'badge-warning'}">
                ${agotado ? 'Agotado' : 'Bajo stock'}
              </span>
            </td>
            <td class="text-center">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                data-inv-reponer="${prod.id}"
              >
                Registrar entrada
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('[data-inv-reponer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        abrirModalMovimiento(Number(btn.dataset.invReponer), 'ENTRADA');
      });
    });
  }

  function renderizarMovimientos() {
    const tbody = contenedor.querySelector('#inv-mov-tbody');
    const pagBar = contenedor.querySelector('#inv-mov-paginacion');
    if (!tbody || !pagBar) {
      return;
    }

    if (estado.movimientos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            No se encontraron movimientos con los filtros seleccionados.
          </td>
        </tr>
      `;
      pagBar.innerHTML = '';
      return;
    }

    tbody.innerHTML = estado.movimientos
      .map((mov) => {
        const metaTipo = ETIQUETAS_TIPO_MOVIMIENTO[mov.tipo] || {
          texto: mov.tipo,
          clase: 'badge-neutral'
        };
        const unidad = mov.unidad_medida ? ` ${escaparHtml(mov.unidad_medida)}` : '';
        const referencia = mov.venta_folio
          ? `${escaparHtml(mov.motivo)} (${escaparHtml(mov.venta_folio)})`
          : escaparHtml(mov.motivo);

        return `
          <tr>
            <td class="num" style="white-space:nowrap;">${formatearFechaHora(mov.fecha_movimiento)}</td>
            <td><span class="badge ${metaTipo.clase}">${metaTipo.texto}</span></td>
            <td>
              <div style="font-weight:600;">${escaparHtml(mov.producto_nombre)}</div>
            </td>
            <td class="text-right num">${formatearCantidad(mov.cantidad)}${unidad}</td>
            <td class="text-right num">${formatearCantidad(mov.stock_anterior)}</td>
            <td class="text-right num"><strong>${formatearCantidad(mov.stock_nuevo)}</strong></td>
            <td>${referencia}</td>
          </tr>
        `;
      })
      .join('');

    const { pagina, total_paginas, total } = estado.paginacion;
    pagBar.innerHTML = `
      <span>Total de movimientos: ${total} (Pagina ${pagina} de ${total_paginas})</span>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" id="inv-pag-prev" ${pagina <= 1 ? 'disabled' : ''}>
          Anterior
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="inv-pag-next" ${pagina >= total_paginas ? 'disabled' : ''}>
          Siguiente
        </button>
      </div>
    `;

    pagBar.querySelector('#inv-pag-prev')?.addEventListener('click', () => {
      if (estado.filtros.pagina > 1) {
        estado.filtros.pagina -= 1;
        cargarMovimientos();
      }
    });

    pagBar.querySelector('#inv-pag-next')?.addEventListener('click', () => {
      if (estado.filtros.pagina < total_paginas) {
        estado.filtros.pagina += 1;
        cargarMovimientos();
      }
    });
  }

  function abrirModalMovimiento(productoIdInicial = null, tipoInicial = 'ENTRADA') {
    const productosConControl = estado.productosCatalogo.filter(
      (p) => Number(p.controla_stock) !== 0
    );
    if (productosConControl.length === 0) {
      mostrarToast('No hay productos con control de inventario para registrar movimientos.', 'warning');
      return;
    }

    const opcionesProductos = productosConControl
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === productoIdInicial ? 'selected' : ''}>${escaparHtml(p.nombre)} (Disp: ${formatearCantidad(p.existencias)} ${escaparHtml(p.unidad_medida)})</option>`
      )
      .join('');

    const root = abrirModal({
      titulo: 'Registrar movimiento de inventario',
      contenidoHtml: `
        <form id="form-movimiento" class="form-grid">
          <div class="field col-span-2">
            <label for="fm-producto">Producto *</label>
            <select id="fm-producto" class="select" required>
              ${opcionesProductos}
            </select>
          </div>
          <div class="field">
            <label for="fm-tipo">Tipo de movimiento *</label>
            <select id="fm-tipo" class="select" required>
              <option value="ENTRADA" ${tipoInicial === 'ENTRADA' ? 'selected' : ''}>Entrada de mercancia (+)</option>
              <option value="SALIDA" ${tipoInicial === 'SALIDA' ? 'selected' : ''}>Salida manual (-)</option>
              <option value="AJUSTE" ${tipoInicial === 'AJUSTE' ? 'selected' : ''}>Ajuste directo de inventario (=)</option>
            </select>
          </div>
          <div class="field">
            <label for="fm-cantidad" id="fm-cantidad-label">Cantidad *</label>
            <input
              type="number"
              id="fm-cantidad"
              class="input num"
              required
              min="0.001"
              step="0.001"
              placeholder="0"
            >
          </div>
          <div class="col-span-2 info-box" id="fm-preview-stock"></div>
          <div class="field col-span-2">
            <label for="fm-motivo">Motivo del movimiento *</label>
            <input
              type="text"
              id="fm-motivo"
              class="input"
              required
              minlength="3"
              maxlength="255"
              placeholder="Ej. Recepcion de proveedor factura 1024, conteo fisico"
            >
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="form-movimiento" class="btn btn-primary" id="fm-submit">
          Guardar movimiento
        </button>
      `
    });

    if (!root) {
      return;
    }

    const selectProducto = root.querySelector('#fm-producto');
    const selectTipo = root.querySelector('#fm-tipo');
    const inputCantidad = root.querySelector('#fm-cantidad');
    const labelCantidad = root.querySelector('#fm-cantidad-label');
    const previewBox = root.querySelector('#fm-preview-stock');

    function actualizarVistaPreviaStock() {
      const producto = estado.productosCatalogo.find(
        (p) => p.id === Number(selectProducto.value)
      );
      if (!producto) {
        return;
      }

      const tipo = selectTipo.value;
      const actual = redondearCantidad(producto.existencias);
      const valNum = Number(inputCantidad.value);

      if (tipo === 'ENTRADA') {
        labelCantidad.textContent = `Cantidad a ingresar (${producto.unidad_medida}) *`;
        inputCantidad.min = '0.001';
      } else if (tipo === 'SALIDA') {
        labelCantidad.textContent = `Cantidad a retirar (${producto.unidad_medida}) *`;
        inputCantidad.min = '0.001';
      } else {
        labelCantidad.textContent = `Nuevo inventario total (${producto.unidad_medida}) *`;
        inputCantidad.min = '0';
      }

      let resultanteTexto = '-';
      if (inputCantidad.value !== '' && Number.isFinite(valNum) && valNum >= 0) {
        if (tipo === 'ENTRADA') {
          resultanteTexto = formatearCantidad(actual + valNum);
        } else if (tipo === 'SALIDA') {
          const res = redondearCantidad(actual - valNum);
          resultanteTexto =
            res < 0 ? `${formatearCantidad(res)} (Excede existencias)` : formatearCantidad(res);
        } else {
          resultanteTexto = formatearCantidad(valNum);
        }
      }

      previewBox.innerHTML = `
        <strong>Existencias actuales:</strong> ${formatearCantidad(actual)} ${escaparHtml(producto.unidad_medida)}
        &nbsp;|&nbsp;
        <strong>Inventario resultante:</strong> ${resultanteTexto} ${escaparHtml(producto.unidad_medida)}
      `;
    }

    selectProducto.addEventListener('change', actualizarVistaPreviaStock);
    selectTipo.addEventListener('change', actualizarVistaPreviaStock);
    inputCantidad.addEventListener('input', actualizarVistaPreviaStock);
    actualizarVistaPreviaStock();

    root.querySelector('#form-movimiento').addEventListener('submit', async (event) => {
      event.preventDefault();
      const btnSubmit = root.querySelector('#fm-submit');
      btnSubmit.disabled = true;

      const tipo = selectTipo.value;
      const valor = Number(inputCantidad.value);
      const payload = {
        producto_id: Number(selectProducto.value),
        tipo,
        motivo: root.querySelector('#fm-motivo').value.trim()
      };

      if (tipo === 'AJUSTE') {
        payload.nuevo_stock = valor;
      } else {
        payload.cantidad = valor;
      }

      try {
        await api.post('/inventario/movimientos', payload);
        mostrarToast('Movimiento de inventario registrado correctamente.', 'success');
        cerrarModal();
        await cargarDatos();
        if (onInventarioModificado) {
          onInventarioModificado();
        }
      } catch (error) {
        mostrarToast(error.message, 'error');
        btnSubmit.disabled = false;
      }
    });
  }

  async function cargarMovimientos() {
    const query = buildQuery({
      buscar: estado.filtros.buscar,
      tipo: estado.filtros.tipo,
      fecha_inicio: estado.filtros.fecha_inicio,
      fecha_fin: estado.filtros.fecha_fin,
      pagina: estado.filtros.pagina,
      limite: estado.paginacion.limite
    });

    const resp = await api.get(`/inventario/movimientos${query}`);
    estado.movimientos = resp.movimientos || [];
    estado.paginacion = resp.paginacion || estado.paginacion;
    renderizarMovimientos();
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      const [resResumen, resBajoStock, resProductos] = await Promise.all([
        api.get('/inventario/resumen'),
        api.get('/inventario/bajo-stock'),
        api.get('/productos')
      ]);

      estado.resumen = resResumen.resumen;
      estado.bajoStock = resBajoStock.productos || [];
      estado.productosCatalogo = resProductos.productos || [];

      renderizarKpis();
      renderizarBajoStock();
      await cargarMovimientos();
    } catch (error) {
      mostrarToast(`Error al cargar inventario: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}

