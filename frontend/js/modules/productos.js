import { api, buildQuery } from '../api/client.js';
import {
  escaparHtml,
  formatearCantidad,
  formatearFechaHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal, cerrarModal, confirmarAccion } from '../utils/modal.js';
import { mostrarToast } from '../utils/toast.js';

export function crearModuloProductos({ obtenerUnidades, onCatalogoModificado }) {
  const contenedor = document.getElementById('vista-productos');

  const estado = {
    productos: [],
    categorias: [],
    buscar: '',
    categoriaId: '',
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
            <h2 class="card-title">Administracion de productos</h2>
            <p class="card-subtitle">Alta, edicion, precios, existencias y categorias del catalogo</p>
          </div>
          <div class="toolbar-actions">
            <button type="button" class="btn btn-secondary" id="prod-btn-categorias">
              Administrar categorias
            </button>
            <button type="button" class="btn btn-primary" id="prod-btn-nuevo">
              Nuevo producto
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="toolbar">
            <div class="toolbar-group">
              <div class="field field-grow">
                <label for="prod-buscar">Buscar producto por nombre</label>
                <input
                  type="text"
                  id="prod-buscar"
                  class="input"
                  placeholder="Ej. Cemento, Mortero, Varilla..."
                >
              </div>
            </div>
            <div class="toolbar-actions">
              <span id="prod-contador" class="text-secondary" style="font-size:13px;font-weight:600;"></span>
              <button type="button" class="btn btn-secondary" id="prod-btn-limpiar">
                Limpiar filtros
              </button>
            </div>
          </div>

          <div id="prod-categoria-chips" class="pos-category-chips" aria-label="Filtrar por categoria"></div>

          <div id="prod-cards-grid" class="catalog-admin-grid"></div>
        </div>
      </div>
    `;

    contenedor.querySelector('#prod-buscar').addEventListener('input', (event) => {
      estado.buscar = event.target.value;
      cargarProductos();
    });

    contenedor.querySelector('#prod-btn-limpiar').addEventListener('click', () => {
      estado.buscar = '';
      estado.categoriaId = '';
      contenedor.querySelector('#prod-buscar').value = '';
      renderizarChipsCategorias();
      cargarProductos();
    });

    contenedor.querySelector('#prod-btn-nuevo').addEventListener('click', () => {
      abrirModalProducto(null);
    });

    contenedor.querySelector('#prod-btn-categorias').addEventListener('click', () => {
      abrirModalCategorias();
    });

    estado.renderizadoBase = true;
  }

  function renderizarChipsCategorias() {
    const chipsWrap = contenedor.querySelector('#prod-categoria-chips');
    if (!chipsWrap) {
      return;
    }

    const botones = [
      `<button type="button" class="pos-chip ${estado.categoriaId === '' ? 'active' : ''}" data-prod-cat-chip="">Todas</button>`,
      ...estado.categorias.map(
        (cat) =>
          `<button type="button" class="pos-chip ${String(estado.categoriaId) === String(cat.id) ? 'active' : ''}" data-prod-cat-chip="${cat.id}">${escaparHtml(cat.nombre)}</button>`
      )
    ];

    chipsWrap.innerHTML = botones.join('');
    chipsWrap.querySelectorAll('[data-prod-cat-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.categoriaId = btn.dataset.prodCatChip;
        renderizarChipsCategorias();
        cargarProductos();
      });
    });
  }

  function renderizarTarjetas() {
    const grid = contenedor.querySelector('#prod-cards-grid');
    const contadorEl = contenedor.querySelector('#prod-contador');
    if (!grid) {
      return;
    }

    if (contadorEl) {
      const total = estado.productos.length;
      contadorEl.textContent = `${total} ${total === 1 ? 'producto' : 'productos'}`;
    }

    if (estado.productos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1 / -1;">
          No se encontraron productos registrados con los criterios actuales.
        </div>
      `;
      return;
    }

    grid.innerHTML = estado.productos
      .map((prod) => {
        const controlaStock = Number(prod.controla_stock) !== 0;
        const stock = Number(prod.existencias);
        const minimo = Number(prod.stock_minimo);
        let badgeEstado = 'badge-success';
        let textoEstado = 'Disponible';
        let textoExistencias = '';
        let subExistencias = '';

        if (!controlaStock) {
          badgeEstado = 'badge-neutral';
          textoEstado = 'Sin control de stock';
          textoExistencias = 'Libre';
          subExistencias = 'Venta sin limite';
        } else {
          if (stock <= 0) {
            badgeEstado = 'badge-danger';
            textoEstado = 'Agotado';
          } else if (stock <= minimo) {
            badgeEstado = 'badge-warning';
            textoEstado = 'Bajo stock';
          }
          textoExistencias = formatearCantidad(stock);
          subExistencias = `Minimo: ${formatearCantidad(minimo)}`;
        }

        return `
          <article class="catalog-admin-card">
            <div>
              <div class="catalog-admin-card-top">
                <span class="catalog-admin-category">${escaparHtml(prod.categoria_nombre)}</span>
                <span class="badge ${badgeEstado}">${textoEstado}</span>
              </div>
              <h3 class="catalog-admin-card-title">${escaparHtml(prod.nombre)}</h3>
              ${
                prod.descripcion
                  ? `<p class="catalog-admin-card-desc">${escaparHtml(prod.descripcion)}</p>`
                  : ''
              }
            </div>

            <div class="catalog-admin-metrics">
              <div>
                <div class="catalog-metric-label">Precio de venta</div>
                <div class="catalog-metric-value num">${formatearMoneda(prod.precio_venta)}</div>
                <div class="catalog-metric-sub">por ${escaparHtml(prod.unidad_medida)}</div>
              </div>
              <div>
                <div class="catalog-metric-label">Existencias</div>
                <div class="catalog-metric-value num">${textoExistencias}</div>
                <div class="catalog-metric-sub num">${subExistencias}</div>
              </div>
            </div>

            <div class="catalog-admin-card-footer">
              <span class="catalog-admin-date num">${formatearFechaHora(prod.fecha_modificacion)}</span>
              <div class="row-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-edit-id="${prod.id}">
                  Editar
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-del-id="${prod.id}">
                  Eliminar
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-edit-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prod = estado.productos.find((p) => p.id === Number(btn.dataset.editId));
        if (prod) {
          abrirModalProducto(prod);
        }
      });
    });

    grid.querySelectorAll('[data-del-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prod = estado.productos.find((p) => p.id === Number(btn.dataset.delId));
        if (prod) {
          eliminarProducto(prod);
        }
      });
    });
  }

  function abrirModalProducto(producto) {
    if (estado.categorias.length === 0) {
      mostrarToast('Debe existir al menos una categoria antes de crear un producto.', 'warning');
      return;
    }

    const esEdicion = Boolean(producto);
    const unidades = obtenerUnidades();
    const sinControlStockInicial = esEdicion && Number(producto.controla_stock) === 0;

    const opcionesCategorias = estado.categorias
      .map(
        (cat) =>
          `<option value="${cat.id}" ${producto && cat.id === producto.categoria_id ? 'selected' : ''}>${escaparHtml(cat.nombre)}</option>`
      )
      .join('');

    const opcionesUnidades = unidades
      .map(
        (unidad) =>
          `<option value="${escaparHtml(unidad)}" ${producto && unidad === producto.unidad_medida ? 'selected' : ''}>${escaparHtml(unidad)}</option>`
      )
      .join('');

    const fechasHtml = esEdicion
      ? `
        <div class="info-box col-span-2">
          <div><strong>Fecha de registro:</strong> ${formatearFechaHora(producto.fecha_registro)}</div>
          <div><strong>Ultima modificacion:</strong> ${formatearFechaHora(producto.fecha_modificacion)}</div>
        </div>
      `
      : '';

    const root = abrirModal({
      titulo: esEdicion ? `Editar producto: ${producto.nombre}` : 'Registrar nuevo producto',
      contenidoHtml: `
        <form id="form-producto" class="form-grid">
          <div class="field col-span-2">
            <label for="fp-nombre">Nombre del producto *</label>
            <input
              type="text"
              id="fp-nombre"
              class="input"
              required
              maxlength="150"
              value="${esEdicion ? escaparHtml(producto.nombre) : ''}"
              placeholder="Ej. Cemento blanco 25 kg"
            >
          </div>
          <div class="field">
            <label for="fp-categoria">Categoria *</label>
            <select id="fp-categoria" class="select" required>
              ${opcionesCategorias}
            </select>
          </div>
          <div class="field">
            <label for="fp-unidad">Unidad de medida *</label>
            <select id="fp-unidad" class="select" required>
              ${opcionesUnidades}
            </select>
          </div>
          <div class="field">
            <label for="fp-precio">Precio de venta ($) *</label>
            <input
              type="number"
              id="fp-precio"
              class="input num"
              required
              min="0"
              step="0.01"
              value="${esEdicion ? Number(producto.precio_venta).toFixed(2) : ''}"
              placeholder="0.00"
            >
          </div>
          <div class="field" style="justify-content:flex-end;">
            <label class="checkbox-row" for="fp-sin-stock">
              <input type="checkbox" id="fp-sin-stock" ${sinControlStockInicial ? 'checked' : ''}>
              <span>Producto sin control de stock (venta libre)</span>
            </label>
          </div>
          <div class="col-span-2 info-box ${sinControlStockInicial ? '' : 'hidden'}" id="fp-sin-stock-aviso">
            Este producto podra venderse sin limite de existencias y no generara alertas de inventario bajo.
          </div>
          <div class="field ${sinControlStockInicial ? 'hidden' : ''}" id="fp-wrap-existencias">
            <label for="fp-existencias">Existencias actuales *</label>
            <input
              type="number"
              id="fp-existencias"
              class="input num"
              ${sinControlStockInicial ? '' : 'required'}
              min="0"
              step="0.001"
              value="${esEdicion ? Number(producto.existencias) : '0'}"
            >
          </div>
          <div class="field ${sinControlStockInicial ? 'hidden' : ''}" id="fp-wrap-minimo">
            <label for="fp-minimo">Existencia minima de alerta *</label>
            <input
              type="number"
              id="fp-minimo"
              class="input num"
              ${sinControlStockInicial ? '' : 'required'}
              min="0"
              step="0.001"
              value="${esEdicion ? Number(producto.stock_minimo) : '10'}"
            >
          </div>
          <div class="field col-span-2">
            <label for="fp-descripcion">Descripcion</label>
            <textarea
              id="fp-descripcion"
              class="textarea"
              maxlength="1000"
              placeholder="Especificaciones, medidas o uso del material"
            >${esEdicion && producto.descripcion ? escaparHtml(producto.descripcion) : ''}</textarea>
          </div>
          ${fechasHtml}
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="form-producto" class="btn btn-primary" id="fp-submit">
          ${esEdicion ? 'Guardar cambios' : 'Registrar producto'}
        </button>
      `
    });

    const chkSinStock = root?.querySelector('#fp-sin-stock');
    const wrapExistencias = root?.querySelector('#fp-wrap-existencias');
    const wrapMinimo = root?.querySelector('#fp-wrap-minimo');
    const inputExistencias = root?.querySelector('#fp-existencias');
    const inputMinimo = root?.querySelector('#fp-minimo');
    const avisoSinStock = root?.querySelector('#fp-sin-stock-aviso');

    chkSinStock?.addEventListener('change', () => {
      const sinControl = chkSinStock.checked;
      wrapExistencias?.classList.toggle('hidden', sinControl);
      wrapMinimo?.classList.toggle('hidden', sinControl);
      avisoSinStock?.classList.toggle('hidden', !sinControl);
      if (inputExistencias) {
        inputExistencias.required = !sinControl;
      }
      if (inputMinimo) {
        inputMinimo.required = !sinControl;
      }
    });

    const form = root?.querySelector('#form-producto');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const btnSubmit = root.querySelector('#fp-submit');
      btnSubmit.disabled = true;

      const controlaStock = !(chkSinStock?.checked);
      const payload = {
        nombre: root.querySelector('#fp-nombre').value.trim(),
        categoria_id: Number(root.querySelector('#fp-categoria').value),
        unidad_medida: root.querySelector('#fp-unidad').value,
        precio_venta: Number(root.querySelector('#fp-precio').value),
        controla_stock: controlaStock,
        existencias: controlaStock ? Number(inputExistencias.value) : 0,
        stock_minimo: controlaStock ? Number(inputMinimo.value) : 0,
        descripcion: root.querySelector('#fp-descripcion').value.trim()
      };

      try {
        if (esEdicion) {
          const resp = await api.put(`/productos/${producto.id}`, payload);
          mostrarToast(resp.mensaje || 'Producto actualizado correctamente.', 'success');
        } else {
          const resp = await api.post('/productos', payload);
          mostrarToast(resp.mensaje || 'Producto registrado correctamente.', 'success');
        }
        cerrarModal();
        await cargarDatos();
        if (onCatalogoModificado) {
          onCatalogoModificado();
        }
      } catch (error) {
        mostrarToast(error.message, 'error');
        btnSubmit.disabled = false;
      }
    });
  }

  async function eliminarProducto(producto) {
    const ok = await confirmarAccion({
      titulo: 'Eliminar producto',
      mensaje: `Confirma eliminar "${producto.nombre}" del catalogo? Si el producto ya tiene ventas registradas, se desactivara para conservar el historial.`,
      textoConfirmar: 'Eliminar producto',
      tipoConfirmar: 'btn-danger'
    });
    if (!ok) {
      return;
    }

    try {
      const resp = await api.del(`/productos/${producto.id}`);
      mostrarToast(resp.mensaje, 'success');
      await cargarDatos();
      if (onCatalogoModificado) {
        onCatalogoModificado();
      }
    } catch (error) {
      mostrarToast(error.message, 'error');
    }
  }

  function abrirModalCategorias() {
    let editandoId = null;

    const root = abrirModal({
      titulo: 'Administrar categorias',
      size: 'lg',
      contenidoHtml: `
        <div class="stack-lg">
          <form id="form-categoria" class="form-grid">
            <div class="field">
              <label for="fc-nombre">Nombre de la categoria *</label>
              <input type="text" id="fc-nombre" class="input" required maxlength="100" placeholder="Ej. Impermeabilizantes">
            </div>
            <div class="field">
              <label for="fc-descripcion">Descripcion</label>
              <input type="text" id="fc-descripcion" class="input" maxlength="255" placeholder="Descripcion breve">
            </div>
            <div class="col-span-2" style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary hidden" id="fc-cancelar-edicion">Cancelar edicion</button>
              <button type="submit" class="btn btn-primary" id="fc-submit">Agregar categoria</button>
            </div>
          </form>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Descripcion</th>
                  <th class="text-right">Productos</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody id="fc-tbody"></tbody>
            </table>
          </div>
        </div>
      `,
      footerHtml: '<button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>'
    });

    if (!root) {
      return;
    }

    const inputNombre = root.querySelector('#fc-nombre');
    const inputDesc = root.querySelector('#fc-descripcion');
    const btnCancelarEdicion = root.querySelector('#fc-cancelar-edicion');
    const btnSubmit = root.querySelector('#fc-submit');
    const tbody = root.querySelector('#fc-tbody');

    function limpiarFormularioCategoria() {
      editandoId = null;
      inputNombre.value = '';
      inputDesc.value = '';
      btnSubmit.textContent = 'Agregar categoria';
      btnCancelarEdicion.classList.add('hidden');
    }

    function pintarTablaCategorias() {
      if (estado.categorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay categorias registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = estado.categorias
        .map(
          (cat) => `
          <tr>
            <td><strong>${escaparHtml(cat.nombre)}</strong></td>
            <td>${escaparHtml(cat.descripcion || '-')}</td>
            <td class="text-right num">${cat.total_productos}</td>
            <td class="text-center">
              <div class="row-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-cat-edit="${cat.id}">Editar</button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-cat-del="${cat.id}">Eliminar</button>
              </div>
            </td>
          </tr>
        `
        )
        .join('');

      tbody.querySelectorAll('[data-cat-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cat = estado.categorias.find((c) => c.id === Number(btn.dataset.catEdit));
          if (!cat) {
            return;
          }
          editandoId = cat.id;
          inputNombre.value = cat.nombre;
          inputDesc.value = cat.descripcion || '';
          btnSubmit.textContent = 'Guardar cambios';
          btnCancelarEdicion.classList.remove('hidden');
          inputNombre.focus();
        });
      });

      tbody.querySelectorAll('[data-cat-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.catDel);
          try {
            await api.del(`/categorias/${id}`);
            mostrarToast('Categoria eliminada correctamente.', 'success');
            await cargarCategorias();
            pintarTablaCategorias();
            renderizarChipsCategorias();
            if (editandoId === id) {
              limpiarFormularioCategoria();
            }
          } catch (error) {
            mostrarToast(error.message, 'error');
          }
        });
      });
    }

    btnCancelarEdicion.addEventListener('click', limpiarFormularioCategoria);

    root.querySelector('#form-categoria').addEventListener('submit', async (event) => {
      event.preventDefault();
      btnSubmit.disabled = true;
      const payload = {
        nombre: inputNombre.value.trim(),
        descripcion: inputDesc.value.trim()
      };
      try {
        if (editandoId) {
          await api.put(`/categorias/${editandoId}`, payload);
          mostrarToast('Categoria actualizada correctamente.', 'success');
        } else {
          await api.post('/categorias', payload);
          mostrarToast('Categoria agregada correctamente.', 'success');
        }
        limpiarFormularioCategoria();
        await cargarCategorias();
        await cargarProductos();
        pintarTablaCategorias();
        renderizarChipsCategorias();
      } catch (error) {
        mostrarToast(error.message, 'error');
      } finally {
        btnSubmit.disabled = false;
      }
    });

    pintarTablaCategorias();
  }

  async function cargarCategorias() {
    const resp = await api.get('/categorias');
    estado.categorias = resp.categorias || [];
  }

  async function cargarProductos() {
    const query = buildQuery({
      buscar: estado.buscar,
      categoria_id: estado.categoriaId
    });
    const resp = await api.get(`/productos${query}`);
    estado.productos = resp.productos || [];
    renderizarTarjetas();
  }

  async function cargarDatos() {
    renderizarBase();
    try {
      await Promise.all([cargarCategorias(), cargarProductos()]);
      renderizarChipsCategorias();
    } catch (error) {
      mostrarToast(`Error al cargar productos: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos
  };
}

