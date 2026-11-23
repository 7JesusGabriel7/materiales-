import { api, buildQuery } from '../api/client.js';
import {
  bloquearTeclasNoNumericas,
  escaparHtml,
  formatearCantidad,
  formatearFecha,
  formatearMoneda,
  redondearCantidad,
  redondearMoneda,
  sanitizarEntradaDecimal
} from '../utils/format.js';
import { abrirModal, cerrarModal, confirmarAccion } from '../utils/modal.js';
import { mostrarToast } from '../utils/toast.js';
import { mostrarModalTicket, mostrarModalTicketPresupuesto } from './ticket.js';

const STORAGE_VISTA_CATALOGO = 'pos_vista_catalogo';

function obtenerFechaIsoConDesfase(dias = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function leerPreferenciaVistaCatalogo() {
  try {
    const val = window.localStorage.getItem(STORAGE_VISTA_CATALOGO);
    return val === 'lista' ? 'lista' : 'tarjetas';
  } catch {
    return 'tarjetas';
  }
}

function guardarPreferenciaVistaCatalogo(vista) {
  try {
    window.localStorage.setItem(STORAGE_VISTA_CATALOGO, vista);
  } catch {
    // Se ignora si el navegador bloquea almacenamiento local
  }
}

export function crearModuloPos({ onVentaCompletada, onPresupuestoGuardado }) {
  const contenedor = document.getElementById('vista-pos');

  const estado = {
    productos: [],
    categorias: [],
    clientes: [],
    carrito: [],
    buscar: '',
    categoriaId: '',
    vistaCatalogo: leerPreferenciaVistaCatalogo(),
    dineroRecibidoTexto: '',
    modalidadPago: 'COMPLETO',
    nombrePendiente: '',
    telefonoPendiente: '',
    tipoVenta: 'GENERAL',
    busquedaCliente: '',
    clienteSeleccionado: null,
    subvistaClienteModal: 'buscar', // 'buscar' | 'form' | 'seleccionado'
    clienteEditando: null,
    usarOtraDireccion: false,
    entregaDireccionOtra: '',
    entregaReferenciasOtra: '',
    fechaEntrega: obtenerFechaIsoConDesfase(0),
    horarioEntrega: '',
    notaVenta: '',
    presClienteSelectId: '',
    presClienteNombre: '',
    presClienteTelefono: '',
    presNotas: '',
    presupuestoOrigen: null,
    procesando: false,
    renderizadoBase: false
  };

  function obtenerProductosFiltrados() {
    const termino = estado.buscar.trim().toLowerCase();
    return estado.productos.filter((prod) => {
      if (estado.categoriaId && String(prod.categoria_id) !== String(estado.categoriaId)) {
        return false;
      }
      if (termino) {
        return prod.nombre.toLowerCase().includes(termino);
      }
      return true;
    });
  }

  function calcularTotalesCarrito() {
    let subtotal = 0;
    let totalUnidades = 0;

    for (const item of estado.carrito) {
      const importe = redondearMoneda(item.cantidad * item.precio_venta);
      subtotal = redondearMoneda(subtotal + importe);
      totalUnidades = redondearCantidad(totalUnidades + item.cantidad);
    }

    const total = subtotal;
    const esParcial = estado.modalidadPago === 'PARCIAL';
    const recibidoNum = Number(estado.dineroRecibidoTexto);
    const recibidoValido =
      estado.dineroRecibidoTexto.trim() !== '' &&
      Number.isFinite(recibidoNum) &&
      recibidoNum >= 0;
    const dineroRecibido = recibidoValido ? redondearMoneda(recibidoNum) : 0;

    const excedeTotalParcial = esParcial && recibidoValido && dineroRecibido >= total;
    const anticipoValido =
      esParcial && recibidoValido && dineroRecibido >= 0 && dineroRecibido < total;
    const montoAnticipo = anticipoValido ? dineroRecibido : 0;
    const saldoPendiente =
      esParcial && anticipoValido ? redondearMoneda(total - montoAnticipo) : 0;

    const diferencia = redondearMoneda(dineroRecibido - total);

    return {
      subtotal,
      total,
      totalUnidades,
      esParcial,
      excedeTotalParcial,
      anticipoValido,
      montoAnticipo,
      saldoPendiente,
      recibidoValido,
      dineroRecibido,
      cambio: !esParcial && diferencia >= 0 ? diferencia : 0,
      faltante: !esParcial && diferencia < 0 ? Math.abs(diferencia) : 0
    };
  }

  function limpiarDatosOperacion() {
    estado.carrito = [];
    estado.dineroRecibidoTexto = '';
    estado.modalidadPago = 'COMPLETO';
    estado.nombrePendiente = '';
    estado.telefonoPendiente = '';
    estado.tipoVenta = 'GENERAL';
    estado.busquedaCliente = '';
    estado.clienteSeleccionado = null;
    estado.subvistaClienteModal = 'buscar';
    estado.clienteEditando = null;
    estado.usarOtraDireccion = false;
    estado.entregaDireccionOtra = '';
    estado.entregaReferenciasOtra = '';
    estado.fechaEntrega = obtenerFechaIsoConDesfase(0);
    estado.horarioEntrega = '';
    estado.notaVenta = '';
    estado.presClienteSelectId = '';
    estado.presClienteNombre = '';
    estado.presClienteTelefono = '';
    estado.presNotas = '';
    estado.presupuestoOrigen = null;
    actualizarBannerPresupuesto();
  }

  function actualizarSelectorVistaCatalogo() {
    const btnTarjetas = contenedor.querySelector('#pos-vista-btn-tarjetas');
    const btnLista = contenedor.querySelector('#pos-vista-btn-lista');
    const wrapTarjetas = contenedor.querySelector('#pos-vista-tarjetas');
    const wrapLista = contenedor.querySelector('#pos-vista-lista');

    const esTarjetas = estado.vistaCatalogo !== 'lista';
    btnTarjetas?.classList.toggle('active', esTarjetas);
    btnLista?.classList.toggle('active', !esTarjetas);
    wrapTarjetas?.classList.toggle('hidden', !esTarjetas);
    wrapLista?.classList.toggle('hidden', esTarjetas);
  }

  function actualizarBannerPresupuesto() {
    const banner = contenedor.querySelector('#pos-budget-banner');
    const folioEl = contenedor.querySelector('#pos-budget-banner-folio');
    if (!banner || !folioEl) {
      return;
    }
    if (estado.presupuestoOrigen) {
      folioEl.textContent = estado.presupuestoOrigen.folio;
      banner.classList.remove('hidden');
    } else {
      folioEl.textContent = '';
      banner.classList.add('hidden');
    }
  }

  function agregarAlCarrito(productoId, cantidadAgregar = 1) {
    const producto = estado.productos.find((p) => p.id === productoId);
    if (!producto) {
      return;
    }

    const controlaStock = Number(producto.controla_stock) !== 0;
    const stockDisponible = redondearCantidad(producto.existencias);

    if (controlaStock && stockDisponible < 1) {
      mostrarToast(
        `El producto "${producto.nombre}" no cuenta con al menos 1 unidad disponible.`,
        'warning'
      );
      return;
    }

    const existente = estado.carrito.find((item) => item.producto_id === productoId);
    if (existente) {
      const nuevaCantidad = redondearCantidad(existente.cantidad + cantidadAgregar);
      if (controlaStock && nuevaCantidad > stockDisponible) {
        mostrarToast(
          `Solo hay ${formatearCantidad(stockDisponible)} ${producto.unidad_medida} disponibles de "${producto.nombre}".`,
          'warning'
        );
        return;
      }
      existente.cantidad = nuevaCantidad;
      existente.existencias = stockDisponible;
      existente.controla_stock = controlaStock;
    } else {
      const inicial = Math.max(1, redondearCantidad(cantidadAgregar));
      if (controlaStock && inicial > stockDisponible) {
        mostrarToast(
          `Solo hay ${formatearCantidad(stockDisponible)} ${producto.unidad_medida} disponibles de "${producto.nombre}".`,
          'warning'
        );
        return;
      }
      estado.carrito.push({
        producto_id: producto.id,
        nombre: producto.nombre,
        unidad_medida: producto.unidad_medida,
        precio_venta: redondearMoneda(producto.precio_venta),
        controla_stock: controlaStock,
        existencias: stockDisponible,
        cantidad: inicial
      });
    }

    renderizarCarrito();
    renderizarCatalogo();
  }

  function actualizarCantidadItem(productoId, nuevaCantidadRaw, { reRenderCarrito = true } = {}) {
    const item = estado.carrito.find((i) => i.producto_id === productoId);
    if (!item) {
      return;
    }

    const num = Number(nuevaCantidadRaw);
    if (!Number.isFinite(num) || num < 1) {
      if (reRenderCarrito) {
        item.cantidad = 1;
        mostrarToast('La cantidad minima por producto es 1.', 'warning');
        renderizarCarrito();
        renderizarCatalogo();
      }
      return;
    }

    let cantidad = redondearCantidad(num);
    if (item.controla_stock && cantidad > item.existencias) {
      cantidad = item.existencias;
      mostrarToast(
        `Cantidad ajustada al maximo disponible (${formatearCantidad(item.existencias)} ${item.unidad_medida}).`,
        'warning'
      );
    }

    item.cantidad = cantidad;

    if (reRenderCarrito) {
      renderizarCarrito();
      renderizarCatalogo();
    } else {
      const filaEl = contenedor.querySelector(`[data-cart-item="${productoId}"]`);
      const subtotalItemEl = filaEl?.querySelector('[data-item-importe]');
      const btnDec = filaEl?.querySelector(`[data-dec-id="${productoId}"]`);
      if (subtotalItemEl) {
        subtotalItemEl.textContent = formatearMoneda(
          redondearMoneda(item.cantidad * item.precio_venta)
        );
      }
      if (btnDec) {
        btnDec.disabled = item.cantidad <= 1;
      }
      actualizarResumenCarrito();
      renderizarCatalogo();
    }
  }

  function eliminarDelCarrito(productoId) {
    estado.carrito = estado.carrito.filter((item) => item.producto_id !== productoId);
    renderizarCarrito();
    renderizarCatalogo();
  }

  async function limpiarCarritoConConfirmacion() {
    if (estado.carrito.length === 0) {
      return;
    }
    const ok = await confirmarAccion({
      titulo: 'Limpiar carrito',
      mensaje: 'Se eliminaran todos los productos agregados al carrito actual. Desea continuar?',
      textoConfirmar: 'Limpiar carrito',
      tipoConfirmar: 'btn-danger'
    });
    if (!ok) {
      return;
    }
    limpiarDatosOperacion();
    renderizarCarrito();
    renderizarCatalogo();
  }

  function renderizarEstructuraBase() {
    if (estado.renderizadoBase) {
      return;
    }

    contenedor.innerHTML = `
      <div class="pos-layout">
        <div class="card pos-catalog-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Catalogo de materiales</h2>
              <p class="card-subtitle">Seleccione un material por tarjeta o en lista para agregarlo al carrito</p>
            </div>
            <div class="pos-header-controls">
              <div class="pos-view-switch" role="group" aria-label="Vista del catalogo">
                <button type="button" id="pos-vista-btn-tarjetas" class="pos-view-btn active">
                  Tarjetas
                </button>
                <button type="button" id="pos-vista-btn-lista" class="pos-view-btn">
                  Lista
                </button>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="pos-recargar-catalogo">
                Actualizar lista
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="pos-search-bar">
              <input
                type="text"
                id="pos-buscar"
                class="input"
                placeholder="Buscar producto por nombre (Enter para agregar)..."
                autocomplete="off"
              >
              <button type="button" id="pos-limpiar-filtro" class="btn btn-secondary">
                Limpiar
              </button>
            </div>

            <div id="pos-categoria-chips" class="pos-category-chips" aria-label="Filtrar por categoria"></div>

            <div id="pos-vista-tarjetas" class="pos-catalog-cards-wrap">
              <div id="pos-cards-grid" class="pos-cards-grid"></div>
            </div>

            <div id="pos-vista-lista" class="pos-catalog-table-wrap hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th class="text-right">Precio</th>
                    <th class="text-right">Existencias</th>
                    <th class="text-center">Accion</th>
                  </tr>
                </thead>
                <tbody id="pos-tabla-catalogo"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card pos-cart-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Carrito</h2>
              <p class="card-subtitle" id="pos-carrito-contador">0 productos en carrito</p>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm" id="pos-limpiar-carrito">
              Limpiar
            </button>
          </div>

          <div class="card-body">
            <div id="pos-budget-banner" class="pos-budget-banner hidden" style="margin-bottom:10px;">
              <span>Cargado desde presupuesto <strong id="pos-budget-banner-folio"></strong></span>
              <button type="button" class="btn btn-secondary btn-sm" id="pos-desvincular-presupuesto">
                Desvincular
              </button>
            </div>

            <div id="pos-carrito-lista" class="pos-cart-list"></div>

            <div class="pos-summary">
              <div class="pos-summary-row">
                <span>Subtotal</span>
                <strong id="pos-subtotal" class="num">$0.00</strong>
              </div>
              <div class="pos-summary-row pos-summary-total">
                <span>Total</span>
                <span id="pos-total" class="num">$0.00</span>
              </div>

              <div class="pos-cart-actions">
                <button
                  type="button"
                  id="pos-btn-abrir-cobro"
                  class="btn btn-primary btn-lg btn-block"
                  disabled
                >
                  Cobrar venta
                </button>
                <div class="pos-actions-divider">o cotizar sin vender</div>
                <button
                  type="button"
                  id="pos-btn-abrir-presupuesto"
                  class="btn btn-secondary btn-block"
                  disabled
                >
                  Crear presupuesto
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const inputBuscar = contenedor.querySelector('#pos-buscar');
    const btnLimpiarFiltro = contenedor.querySelector('#pos-limpiar-filtro');
    const btnRecargar = contenedor.querySelector('#pos-recargar-catalogo');
    const btnVistaTarjetas = contenedor.querySelector('#pos-vista-btn-tarjetas');
    const btnVistaLista = contenedor.querySelector('#pos-vista-btn-lista');
    const btnLimpiarCarrito = contenedor.querySelector('#pos-limpiar-carrito');
    const btnDesvincularPres = contenedor.querySelector('#pos-desvincular-presupuesto');
    const btnAbrirCobro = contenedor.querySelector('#pos-btn-abrir-cobro');
    const btnAbrirPresupuesto = contenedor.querySelector('#pos-btn-abrir-presupuesto');

    btnVistaTarjetas.addEventListener('click', () => {
      estado.vistaCatalogo = 'tarjetas';
      guardarPreferenciaVistaCatalogo('tarjetas');
      actualizarSelectorVistaCatalogo();
      renderizarCatalogo();
    });

    btnVistaLista.addEventListener('click', () => {
      estado.vistaCatalogo = 'lista';
      guardarPreferenciaVistaCatalogo('lista');
      actualizarSelectorVistaCatalogo();
      renderizarCatalogo();
    });

    inputBuscar.addEventListener('input', (event) => {
      estado.buscar = event.target.value;
      renderizarCatalogo();
    });

    inputBuscar.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      const termino = estado.buscar.trim().toLowerCase();
      if (!termino) {
        return;
      }
      const filtrados = obtenerProductosFiltrados();
      const coincidenciaExacta = filtrados.find(
        (p) => p.nombre.toLowerCase() === termino
      );
      const objetivo =
        coincidenciaExacta || (filtrados.length === 1 ? filtrados[0] : null);
      if (objetivo) {
        agregarAlCarrito(objetivo.id, 1);
      }
    });

    btnLimpiarFiltro.addEventListener('click', () => {
      estado.buscar = '';
      estado.categoriaId = '';
      inputBuscar.value = '';
      renderizarChipsCategorias();
      renderizarCatalogo();
      inputBuscar.focus();
    });

    btnRecargar.addEventListener('click', () => cargarDatos());
    btnLimpiarCarrito.addEventListener('click', limpiarCarritoConConfirmacion);

    btnDesvincularPres.addEventListener('click', () => {
      estado.presupuestoOrigen = null;
      actualizarBannerPresupuesto();
    });

    btnAbrirCobro.addEventListener('click', abrirModalCobro);
    btnAbrirPresupuesto.addEventListener('click', abrirModalPresupuesto);

    actualizarSelectorVistaCatalogo();
    estado.renderizadoBase = true;
  }

  function renderizarChipsCategorias() {
    const chipsWrap = contenedor.querySelector('#pos-categoria-chips');
    if (!chipsWrap) {
      return;
    }

    const botones = [
      `<button type="button" class="pos-chip ${estado.categoriaId === '' ? 'active' : ''}" data-cat-chip="">Todas</button>`,
      ...estado.categorias.map(
        (cat) =>
          `<button type="button" class="pos-chip ${String(estado.categoriaId) === String(cat.id) ? 'active' : ''}" data-cat-chip="${cat.id}">${escaparHtml(cat.nombre)}</button>`
      )
    ];

    chipsWrap.innerHTML = botones.join('');
    chipsWrap.querySelectorAll('[data-cat-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.categoriaId = btn.dataset.catChip;
        renderizarChipsCategorias();
        renderizarCatalogo();
      });
    });
  }

  function obtenerMetaStockProducto(prod) {
    const controlaStock = Number(prod.controla_stock) !== 0;
    const stock = redondearCantidad(prod.existencias);

    if (!controlaStock) {
      return {
        disponible: true,
        claseBadge: 'badge-neutral',
        textoStock: 'Sin control de stock',
        textoStockCorto: 'Libre'
      };
    }

    const disponible = stock >= 1;
    const bajoStock = stock >= 1 && stock <= Number(prod.stock_minimo);
    const claseBadge =
      stock < 1
        ? 'badge-danger'
        : bajoStock
          ? 'badge-warning'
          : 'badge-success';

    return {
      disponible,
      claseBadge,
      textoStock: formatearCantidad(stock),
      textoStockCorto: stock < 1 ? 'Sin stock' : `Disp: ${formatearCantidad(stock)}`
    };
  }

  function renderizarTarjetasCatalogo(productos, mapaCarrito) {
    const grid = contenedor.querySelector('#pos-cards-grid');
    if (!grid) {
      return;
    }

    if (productos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1 / -1;">
          No se encontraron productos que coincidan con la busqueda.
        </div>
      `;
      return;
    }

    grid.innerHTML = productos
      .map((prod) => {
        const meta = obtenerMetaStockProducto(prod);
        const enCarrito = mapaCarrito.get(prod.id);
        const tagCarrito = enCarrito
          ? `<span class="pos-card-cart-tag num">En carrito: ${formatearCantidad(enCarrito.cantidad)}</span>`
          : '';

        return `
          <button
            type="button"
            class="pos-product-card ${enCarrito ? 'in-cart' : ''}"
            data-card-add-id="${prod.id}"
            ${!meta.disponible ? 'disabled' : ''}
          >
            <div>
              <div class="pos-card-top">
                <span class="pos-card-category">${escaparHtml(prod.categoria_nombre)}</span>
                <span class="badge ${meta.claseBadge} num">${meta.textoStockCorto}</span>
              </div>
              <div class="pos-card-title" style="margin-top:6px;">${escaparHtml(prod.nombre)}</div>
            </div>
            ${tagCarrito}
            <div class="pos-card-bottom">
              <span class="pos-card-price num">${formatearMoneda(prod.precio_venta)}</span>
              <span class="pos-card-unit">/ ${escaparHtml(prod.unidad_medida)}</span>
            </div>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-card-add-id]').forEach((card) => {
      card.addEventListener('click', () => {
        agregarAlCarrito(Number(card.dataset.cardAddId), 1);
      });
    });
  }

  function renderizarTablaCatalogo(productos, mapaCarrito) {
    const tbody = contenedor.querySelector('#pos-tabla-catalogo');
    if (!tbody) {
      return;
    }

    if (productos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            No se encontraron productos que coincidan con la busqueda.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = productos
      .map((prod) => {
        const meta = obtenerMetaStockProducto(prod);
        const enCarrito = mapaCarrito.get(prod.id);

        return `
          <tr
            class="${meta.disponible ? 'pos-row-clickable' : ''}"
            ${meta.disponible ? `data-row-add-id="${prod.id}"` : ''}
          >
            <td>
              <div class="pos-product-name">${escaparHtml(prod.nombre)}</div>
              <div class="pos-product-meta">
                ${escaparHtml(prod.categoria_nombre)}${enCarrito ? ` | En carrito: ${formatearCantidad(enCarrito.cantidad)}` : ''}
              </div>
            </td>
            <td>${escaparHtml(prod.unidad_medida)}</td>
            <td class="text-right num">${formatearMoneda(prod.precio_venta)}</td>
            <td class="text-right">
              <span class="badge ${meta.claseBadge} num">${meta.textoStock}</span>
            </td>
            <td class="text-center">
              <button
                type="button"
                class="btn ${!meta.disponible ? 'btn-secondary' : 'btn-primary'} btn-sm"
                ${!meta.disponible ? 'disabled' : ''}
              >
                ${!meta.disponible ? 'Sin stock' : 'Agregar'}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('tr[data-row-add-id]').forEach((fila) => {
      fila.addEventListener('click', () => {
        agregarAlCarrito(Number(fila.dataset.rowAddId), 1);
      });
    });
  }

  function renderizarCatalogo() {
    const productos = obtenerProductosFiltrados();
    const mapaCarrito = new Map(estado.carrito.map((item) => [item.producto_id, item]));

    if (estado.vistaCatalogo === 'lista') {
      renderizarTablaCatalogo(productos, mapaCarrito);
    } else {
      renderizarTarjetasCatalogo(productos, mapaCarrito);
    }
  }

  function renderizarCarrito() {
    const lista = contenedor.querySelector('#pos-carrito-lista');
    const contador = contenedor.querySelector('#pos-carrito-contador');
    const btnLimpiar = contenedor.querySelector('#pos-limpiar-carrito');

    if (!lista || !contador) {
      return;
    }

    const totalLineas = estado.carrito.length;
    contador.textContent = `${totalLineas} ${totalLineas === 1 ? 'producto' : 'productos'} en carrito`;
    if (btnLimpiar) {
      btnLimpiar.disabled = totalLineas === 0 || estado.procesando;
    }

    if (totalLineas === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          El carrito esta vacio. Seleccione productos del catalogo para vender o presupuestar.
        </div>
      `;
      actualizarResumenCarrito();
      return;
    }

    lista.innerHTML = estado.carrito
      .map((item) => {
        const importe = redondearMoneda(item.cantidad * item.precio_venta);
        const textoDisp = item.controla_stock
          ? `Disp: ${formatearCantidad(item.existencias)}`
          : 'Sin control de stock';

        return `
          <div class="pos-cart-item" data-cart-item="${item.producto_id}">
            <div class="pos-cart-item-top">
              <div>
                <div class="pos-cart-item-title">${escaparHtml(item.nombre)}</div>
                <div class="pos-cart-item-sub">
                  ${formatearMoneda(item.precio_venta)} / ${escaparHtml(item.unidad_medida)} | ${textoDisp}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-outline-danger btn-sm"
                data-remove-id="${item.producto_id}"
              >
                Quitar
              </button>
            </div>
            <div class="pos-cart-item-controls">
              <div class="qty-control">
                <button
                  type="button"
                  class="qty-btn"
                  data-dec-id="${item.producto_id}"
                  aria-label="Disminuir cantidad"
                  ${item.cantidad <= 1 ? 'disabled' : ''}
                >-</button>
                <input
                  type="text"
                  class="qty-input"
                  inputmode="decimal"
                  autocomplete="off"
                  value="${item.cantidad}"
                  data-qty-input="${item.producto_id}"
                >
                <button
                  type="button"
                  class="qty-btn"
                  data-inc-id="${item.producto_id}"
                  aria-label="Incrementar cantidad"
                >+</button>
              </div>
              <div class="pos-cart-subtotal num" data-item-importe>
                ${formatearMoneda(importe)}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    lista.querySelectorAll('[data-remove-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        eliminarDelCarrito(Number(btn.dataset.removeId));
      });
    });

    lista.querySelectorAll('[data-dec-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.decId);
        const item = estado.carrito.find((i) => i.producto_id === id);
        if (!item || item.cantidad <= 1) {
          return;
        }
        const nueva = Math.max(1, redondearCantidad(item.cantidad - 1));
        actualizarCantidadItem(id, nueva);
      });
    });

    lista.querySelectorAll('[data-inc-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.incId);
        const item = estado.carrito.find((i) => i.producto_id === id);
        if (!item) {
          return;
        }
        actualizarCantidadItem(id, redondearCantidad(item.cantidad + 1));
      });
    });

    lista.querySelectorAll('[data-qty-input]').forEach((input) => {
      input.addEventListener('keydown', (event) => {
        bloquearTeclasNoNumericas(event, { permitirDecimal: true });
      });

      input.addEventListener('input', (event) => {
        const id = Number(input.dataset.qtyInput);
        const limpio = sanitizarEntradaDecimal(event.target.value, 3);
        if (event.target.value !== limpio) {
          event.target.value = limpio;
        }
        if (limpio === '' || limpio.endsWith('.')) {
          return;
        }
        const num = Number(limpio);
        if (!Number.isFinite(num) || num < 1) {
          return;
        }
        actualizarCantidadItem(id, limpio, { reRenderCarrito: false });
      });

      input.addEventListener('change', (event) => {
        const id = Number(input.dataset.qtyInput);
        actualizarCantidadItem(id, event.target.value, { reRenderCarrito: true });
      });
    });

    actualizarResumenCarrito();
  }

  function actualizarResumenCarrito() {
    const subtotalEl = contenedor.querySelector('#pos-subtotal');
    const totalEl = contenedor.querySelector('#pos-total');
    const btnCobrar = contenedor.querySelector('#pos-btn-abrir-cobro');
    const btnPresupuesto = contenedor.querySelector('#pos-btn-abrir-presupuesto');

    if (!subtotalEl || !totalEl) {
      return;
    }

    const { subtotal, total } = calcularTotalesCarrito();
    subtotalEl.textContent = formatearMoneda(subtotal);
    totalEl.textContent = formatearMoneda(total);

    const hayItems = estado.carrito.length > 0;
    const cantidadInvalida = estado.carrito.some(
      (item) => !Number.isFinite(item.cantidad) || item.cantidad < 1
    );
    const deshabilitado = !hayItems || cantidadInvalida || estado.procesando;

    if (btnCobrar) {
      btnCobrar.disabled = deshabilitado;
    }
    if (btnPresupuesto) {
      btnPresupuesto.disabled = deshabilitado;
    }
  }

  function abrirModalCobro() {
    if (estado.carrito.length === 0) {
      return;
    }

    if (estado.clienteSeleccionado) {
      estado.subvistaClienteModal = 'seleccionado';
    } else if (estado.subvistaClienteModal !== 'form') {
      estado.subvistaClienteModal = 'buscar';
    }

    const { subtotal, total } = calcularTotalesCarrito();
    const totalItems = estado.carrito.length;

    const root = abrirModal({
      titulo: 'Cobrar venta',
      size: 'xl',
      contenidoHtml: `
        <div class="checkout-grid">
          <div class="checkout-col-main">
            <div>
              <div class="checkout-section-label">1. A quien se vende</div>
              <div class="dest-choice-grid" role="group" aria-label="A quien se vende">
                <button type="button" id="chk-dest-general" class="dest-choice-card">
                  <span class="dest-choice-title">Mostrador</span>
                  <span class="dest-choice-desc">Venta rapida sin envio</span>
                </button>
                <button type="button" id="chk-dest-cliente" class="dest-choice-card">
                  <span class="dest-choice-title">Cliente y entrega</span>
                  <span class="dest-choice-desc">Guardar cliente y fecha de entrega</span>
                </button>
              </div>
            </div>

            <div id="chk-panel-general">
              <div id="chk-panel-general-info" class="info-box">
                Venta directa de mostrador (sin envio programado).
              </div>
              <div id="chk-panel-nombre-parcial" class="chk-partial-box hidden">
                <div class="field">
                  <label for="chk-nombre-pendiente">Nombre para esta nota pendiente (opcional)</label>
                  <input
                    type="text"
                    id="chk-nombre-pendiente"
                    class="input"
                    maxlength="150"
                    value="${escaparHtml(estado.nombrePendiente)}"
                    placeholder="Ej. Juan Perez - Obra Norte"
                  >
                </div>
                <div class="field">
                  <label for="chk-tel-pendiente">Telefono (opcional)</label>
                  <input
                    type="text"
                    id="chk-tel-pendiente"
                    class="input"
                    maxlength="60"
                    value="${escaparHtml(estado.telefonoPendiente)}"
                    placeholder="555-000-0000"
                  >
                </div>
                <div class="text-muted" style="font-size:12px;">
                  Si lo deja vacio, podra asignarlo despues en "Por cobrar".
                </div>
              </div>
            </div>

            <div id="chk-panel-cliente" class="hidden" style="display:flex;flex-direction:column;gap:12px;">
              <div id="chk-cliente-dinamico"></div>
            </div>

            <div class="field">
              <label for="chk-nota-venta">Nota de la venta (opcional)</label>
              <textarea
                id="chk-nota-venta"
                class="textarea"
                style="min-height:58px;"
                maxlength="2000"
                placeholder="Indicaciones de descarga, material o nota para el ticket..."
              >${escaparHtml(estado.notaVenta)}</textarea>
            </div>
          </div>

          <div class="checkout-pay-panel">
            <div class="checkout-section-label">2. Cobro</div>

            <div class="pos-summary-row pos-summary-total">
              <div>
                <div>Total a cobrar</div>
                <div style="font-size:11.5px;font-weight:500;opacity:0.85;">
                  ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'} en nota
                </div>
              </div>
              <span class="num">${formatearMoneda(total)}</span>
            </div>

            <div class="chk-pay-tabs" role="group" aria-label="Como paga el cliente">
              <button type="button" id="chk-mod-completo" class="chk-pay-tab">
                Pago completo
              </button>
              <button type="button" id="chk-mod-parcial" class="chk-pay-tab">
                Anticipo / Pendiente
              </button>
            </div>

            <div class="field" style="margin-top:4px;">
              <label for="chk-dinero-recibido" id="chk-label-recibido">Efectivo que entrega el cliente ($)</label>
              <div class="pos-payment-input-row">
                <input
                  type="text"
                  id="chk-dinero-recibido"
                  class="input num"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="0.00"
                  value="${escaparHtml(estado.dineroRecibidoTexto)}"
                >
                <button type="button" id="chk-pago-exacto" class="btn btn-secondary">
                  Exacto
                </button>
                <button type="button" id="chk-sin-anticipo" class="btn btn-secondary hidden">
                  Sin anticipo ($0)
                </button>
              </div>
            </div>

            <div id="chk-estado-pago" class="pos-payment-status pos-payment-neutral"></div>
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Volver al carrito</button>
        <button type="button" class="btn btn-primary btn-lg" id="chk-confirmar-venta" disabled>
          Confirmar venta
        </button>
      `
    });

    if (!root) {
      return;
    }

    const btnGeneral = root.querySelector('#chk-dest-general');
    const btnCliente = root.querySelector('#chk-dest-cliente');
    const panelGeneral = root.querySelector('#chk-panel-general');
    const panelGeneralInfo = root.querySelector('#chk-panel-general-info');
    const panelNombreParcial = root.querySelector('#chk-panel-nombre-parcial');
    const panelCliente = root.querySelector('#chk-panel-cliente');
    const clienteDinamico = root.querySelector('#chk-cliente-dinamico');
    const inputNota = root.querySelector('#chk-nota-venta');
    const btnModCompleto = root.querySelector('#chk-mod-completo');
    const btnModParcial = root.querySelector('#chk-mod-parcial');
    const inputNombrePendiente = root.querySelector('#chk-nombre-pendiente');
    const inputTelPendiente = root.querySelector('#chk-tel-pendiente');
    const labelRecibido = root.querySelector('#chk-label-recibido');
    const inputPago = root.querySelector('#chk-dinero-recibido');
    const btnExacto = root.querySelector('#chk-pago-exacto');
    const btnSinAnticipo = root.querySelector('#chk-sin-anticipo');
    const estadoPagoEl = root.querySelector('#chk-estado-pago');
    const btnConfirmar = root.querySelector('#chk-confirmar-venta');

    function actualizarEstadoPagoModal() {
      const {
        total: tot,
        esParcial,
        excedeTotalParcial,
        anticipoValido,
        montoAnticipo,
        saldoPendiente,
        recibidoValido,
        dineroRecibido,
        cambio,
        faltante
      } = calcularTotalesCarrito();

      const clienteListo =
        estado.tipoVenta === 'GENERAL' ||
        (Boolean(estado.clienteSeleccionado) &&
          estado.subvistaClienteModal === 'seleccionado' &&
          Boolean(estado.fechaEntrega));

      if (esParcial) {
        if (!recibidoValido || dineroRecibido < 0) {
          estadoPagoEl.className = 'pos-payment-status pos-payment-neutral';
          estadoPagoEl.innerHTML = `
            <span>Escriba cuanto deja hoy (o 0 sin anticipo)</span>
            <span class="num">${formatearMoneda(tot)} pendiente</span>
          `;
          btnConfirmar.disabled = true;
          return;
        }

        if (excedeTotalParcial || !anticipoValido) {
          estadoPagoEl.className = 'pos-payment-status pos-payment-insufficient';
          estadoPagoEl.innerHTML = `
            <span>Cubre el total. Use "Pago completo".</span>
            <span class="num">${formatearMoneda(tot)}</span>
          `;
          btnConfirmar.disabled = true;
          return;
        }

        estadoPagoEl.className = 'pos-payment-status pos-payment-pending';
        estadoPagoEl.innerHTML = `
          <div class="pos-payment-pending-row">
            <span>Queda pendiente por cobrar</span>
            <span class="num">${formatearMoneda(saldoPendiente)}</span>
          </div>
          <div class="pos-payment-pending-row" style="font-size:12.5px;font-weight:500;">
            <span>${montoAnticipo === 0 ? 'Paga hoy (sin anticipo)' : 'Paga hoy (anticipo)'}</span>
            <span class="num">${formatearMoneda(montoAnticipo)}</span>
          </div>
        `;
        btnConfirmar.disabled = estado.procesando || !clienteListo;
        return;
      }

      if (!recibidoValido) {
        estadoPagoEl.className = 'pos-payment-status pos-payment-neutral';
        estadoPagoEl.innerHTML = `
          <span>Ingrese el efectivo recibido</span>
          <span class="num">${formatearMoneda(tot)}</span>
        `;
        btnConfirmar.disabled = true;
        return;
      }

      if (dineroRecibido < tot) {
        estadoPagoEl.className = 'pos-payment-status pos-payment-insufficient';
        estadoPagoEl.innerHTML = `
          <span>Falta dinero</span>
          <span class="num">${formatearMoneda(faltante)}</span>
        `;
        btnConfirmar.disabled = true;
        return;
      }

      estadoPagoEl.className = 'pos-payment-status pos-payment-ok';
      estadoPagoEl.innerHTML = `
        <span>Cambio a entregar</span>
        <span class="num">${formatearMoneda(cambio)}</span>
      `;
      btnConfirmar.disabled = estado.procesando || !clienteListo;
    }

    function sincronizarModalidadPagoModal() {
      const esParcial = estado.modalidadPago === 'PARCIAL';
      const esGeneral = estado.tipoVenta === 'GENERAL';
      btnModCompleto?.classList.toggle('active', !esParcial);
      btnModParcial?.classList.toggle('active', esParcial);

      panelGeneralInfo?.classList.toggle('hidden', esGeneral && esParcial);
      panelNombreParcial?.classList.toggle('hidden', !(esGeneral && esParcial));

      if (esParcial) {
        if (labelRecibido) {
          labelRecibido.textContent = 'Anticipo que paga hoy ($)';
        }
        btnExacto?.classList.add('hidden');
        btnSinAnticipo?.classList.remove('hidden');
        if (btnConfirmar) {
          btnConfirmar.textContent = 'Guardar nota con saldo pendiente';
        }
      } else {
        if (labelRecibido) {
          labelRecibido.textContent = 'Efectivo que entrega el cliente ($)';
        }
        btnExacto?.classList.remove('hidden');
        btnSinAnticipo?.classList.add('hidden');
        if (btnConfirmar) {
          btnConfirmar.textContent = 'Confirmar venta';
        }
      }

      actualizarEstadoPagoModal();
    }

    function pintarSubvistaClienteModal() {
      if (!clienteDinamico) {
        return;
      }

      if (estado.subvistaClienteModal === 'form') {
        const edit = estado.clienteEditando;
        const esEdicion = Boolean(edit);
        const nombreInicial = esEdicion
          ? edit.nombre
          : estado.busquedaCliente.trim();

        clienteDinamico.innerHTML = `
          <div class="checkout-inline-client-form">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <strong>${esEdicion ? `Editar cliente: ${escaparHtml(edit.nombre)}` : 'Registrar nuevo cliente'}</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="chk-cli-form-cancelar">
                Cancelar
              </button>
            </div>

            <div class="form-grid">
              <div class="field">
                <label for="chk-cf-nombre">Nombre del cliente *</label>
                <input
                  type="text"
                  id="chk-cf-nombre"
                  class="input"
                  maxlength="150"
                  value="${escaparHtml(nombreInicial)}"
                  placeholder="Nombre completo o empresa"
                >
              </div>
              <div class="field">
                <label for="chk-cf-telefono">Telefono</label>
                <input
                  type="text"
                  id="chk-cf-telefono"
                  class="input"
                  maxlength="60"
                  value="${escaparHtml(esEdicion ? edit.telefono || '' : '')}"
                  placeholder="555-000-0000"
                >
              </div>
              <div class="field col-span-2">
                <label for="chk-cf-direccion">Direccion habitual</label>
                <input
                  type="text"
                  id="chk-cf-direccion"
                  class="input"
                  maxlength="255"
                  value="${escaparHtml(esEdicion ? edit.direccion || '' : '')}"
                  placeholder="Calle, numero, colonia y municipio"
                >
              </div>
              <div class="field col-span-2">
                <label for="chk-cf-referencias">Referencias del domicilio</label>
                <input
                  type="text"
                  id="chk-cf-referencias"
                  class="input"
                  maxlength="255"
                  value="${escaparHtml(esEdicion ? edit.referencias || '' : '')}"
                  placeholder="Fachada, entre calles, acceso de volteo..."
                >
              </div>
              <div class="field col-span-2">
                <label for="chk-cf-notas">Notas del cliente (opcional)</label>
                <input
                  type="text"
                  id="chk-cf-notas"
                  class="input"
                  maxlength="1000"
                  value="${escaparHtml(esEdicion ? edit.notas || '' : '')}"
                  placeholder="Observaciones permanentes"
                >
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="btn btn-primary btn-sm" id="chk-cf-guardar">
                ${esEdicion ? 'Guardar cambios del cliente' : 'Guardar y seleccionar cliente'}
              </button>
            </div>
          </div>
        `;

        clienteDinamico.querySelector('#chk-cf-nombre')?.focus();

        clienteDinamico
          .querySelector('#chk-cli-form-cancelar')
          ?.addEventListener('click', () => {
            estado.clienteEditando = null;
            estado.subvistaClienteModal = estado.clienteSeleccionado
              ? 'seleccionado'
              : 'buscar';
            pintarSubvistaClienteModal();
            actualizarEstadoPagoModal();
          });

        clienteDinamico
          .querySelector('#chk-cf-guardar')
          ?.addEventListener('click', async () => {
            const nombreVal = clienteDinamico
              .querySelector('#chk-cf-nombre')
              .value.trim();
            if (nombreVal.length < 2) {
              mostrarToast('El nombre del cliente debe tener al menos 2 caracteres.', 'error');
              clienteDinamico.querySelector('#chk-cf-nombre')?.focus();
              return;
            }

            const btnGuardar = clienteDinamico.querySelector('#chk-cf-guardar');
            btnGuardar.disabled = true;

            const payloadCliente = {
              nombre: nombreVal,
              telefono: clienteDinamico.querySelector('#chk-cf-telefono').value.trim(),
              direccion: clienteDinamico.querySelector('#chk-cf-direccion').value.trim(),
              referencias: clienteDinamico
                .querySelector('#chk-cf-referencias')
                .value.trim(),
              notas: clienteDinamico.querySelector('#chk-cf-notas').value.trim()
            };

            try {
              let guardado = null;
              if (esEdicion) {
                const resp = await api.put(`/clientes/${edit.id}`, payloadCliente);
                guardado = resp.cliente;
                mostrarToast('Datos del cliente actualizados.', 'success');
              } else {
                const resp = await api.post('/clientes', payloadCliente);
                guardado = resp.cliente;
                mostrarToast('Cliente registrado y seleccionado.', 'success');
              }

              const listaResp = await api.get('/clientes');
              estado.clientes = listaResp.clientes || [];
              estado.clienteSeleccionado =
                estado.clientes.find((c) => c.id === guardado.id) || guardado;
              estado.clienteEditando = null;
              estado.busquedaCliente = '';
              estado.subvistaClienteModal = 'seleccionado';
              pintarSubvistaClienteModal();
              actualizarEstadoPagoModal();
            } catch (error) {
              mostrarToast(error.message, 'error');
              btnGuardar.disabled = false;
            }
          });
        return;
      }

      if (estado.subvistaClienteModal === 'seleccionado' && estado.clienteSeleccionado) {
        const c = estado.clienteSeleccionado;
        const totalVentas = Number(c.total_ventas || 0);
        const pendientes = Number(c.entregas_pendientes || 0);
        const historialTexto =
          totalVentas > 0
            ? `Cliente recurrente (${totalVentas} ${totalVentas === 1 ? 'venta previa' : 'ventas previas'}${pendientes > 0 ? `, ${pendientes} pendiente(s)` : ''})`
            : 'Cliente registrado (primera venta)';

        clienteDinamico.innerHTML = `
          <div class="pos-selected-client-card">
            <div class="pos-selected-client-head">
              <div>
                <div class="pos-selected-client-name">${escaparHtml(c.nombre)}</div>
                <div style="margin-top:3px;">
                  <span class="badge ${totalVentas > 0 ? 'badge-success' : 'badge-neutral'}">${historialTexto}</span>
                </div>
              </div>
              <div class="row-actions">
                <button type="button" class="btn btn-secondary btn-sm" id="chk-btn-editar-cli">
                  Editar
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="chk-btn-cambiar-cli">
                  Cambiar
                </button>
              </div>
            </div>
            <div class="pos-selected-client-details">
              <div><strong>Telefono:</strong> ${escaparHtml(c.telefono || 'Sin telefono')}</div>
              <div><strong>Direccion:</strong> ${escaparHtml(c.direccion || 'Sin direccion registrada')}</div>
              ${c.referencias ? `<div><strong>Referencias:</strong> ${escaparHtml(c.referencias)}</div>` : ''}
              ${c.ultima_venta ? `<div><strong>Ultima compra:</strong> ${formatearFecha(c.ultima_venta)}</div>` : ''}
            </div>
          </div>

          <div class="pos-client-panel">
            <div class="form-grid">
              <div class="field">
                <label for="chk-entrega-fecha">Dia de entrega *</label>
                <div class="pos-date-quick-row">
                  <input
                    type="date"
                    id="chk-entrega-fecha"
                    class="input"
                    value="${escaparHtml(estado.fechaEntrega || obtenerFechaIsoConDesfase(0))}"
                  >
                  <button type="button" class="btn btn-secondary btn-sm" id="chk-fecha-hoy">Hoy</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="chk-fecha-manana">Manana</button>
                </div>
              </div>
              <div class="field">
                <label for="chk-entrega-horario">Horario estimado</label>
                <input
                  type="text"
                  id="chk-entrega-horario"
                  class="input"
                  maxlength="80"
                  value="${escaparHtml(estado.horarioEntrega)}"
                  placeholder="Ej. 10:00 a 13:00 hrs"
                >
              </div>
            </div>

            <label class="checkbox-row" for="chk-usar-otra-dir">
              <input type="checkbox" id="chk-usar-otra-dir" ${estado.usarOtraDireccion ? 'checked' : ''}>
              <span>Entregar en otra direccion distinta a la del cliente (ej. nueva obra)</span>
            </label>

            <div id="chk-wrap-otra-dir" class="form-grid ${estado.usarOtraDireccion ? '' : 'hidden'}">
              <div class="field col-span-2">
                <label for="chk-entrega-dir-otra">Direccion para esta entrega</label>
                <input
                  type="text"
                  id="chk-entrega-dir-otra"
                  class="input"
                  maxlength="255"
                  value="${escaparHtml(estado.entregaDireccionOtra)}"
                  placeholder="Calle, numero, colonia de la obra"
                >
              </div>
              <div class="field col-span-2">
                <label for="chk-entrega-ref-otra">Referencias para esta entrega</label>
                <input
                  type="text"
                  id="chk-entrega-ref-otra"
                  class="input"
                  maxlength="255"
                  value="${escaparHtml(estado.entregaReferenciasOtra)}"
                  placeholder="Indicaciones para el camion"
                >
              </div>
            </div>
          </div>
        `;

        clienteDinamico
          .querySelector('#chk-btn-editar-cli')
          ?.addEventListener('click', () => {
            estado.clienteEditando = c;
            estado.subvistaClienteModal = 'form';
            pintarSubvistaClienteModal();
            actualizarEstadoPagoModal();
          });

        clienteDinamico
          .querySelector('#chk-btn-cambiar-cli')
          ?.addEventListener('click', () => {
            estado.clienteSeleccionado = null;
            estado.usarOtraDireccion = false;
            estado.entregaDireccionOtra = '';
            estado.entregaReferenciasOtra = '';
            estado.subvistaClienteModal = 'buscar';
            pintarSubvistaClienteModal();
            actualizarEstadoPagoModal();
          });

        const fechaEl = clienteDinamico.querySelector('#chk-entrega-fecha');
        fechaEl?.addEventListener('change', (e) => {
          estado.fechaEntrega = e.target.value;
          actualizarEstadoPagoModal();
        });

        clienteDinamico
          .querySelector('#chk-fecha-hoy')
          ?.addEventListener('click', () => {
            estado.fechaEntrega = obtenerFechaIsoConDesfase(0);
            if (fechaEl) fechaEl.value = estado.fechaEntrega;
            actualizarEstadoPagoModal();
          });

        clienteDinamico
          .querySelector('#chk-fecha-manana')
          ?.addEventListener('click', () => {
            estado.fechaEntrega = obtenerFechaIsoConDesfase(1);
            if (fechaEl) fechaEl.value = estado.fechaEntrega;
            actualizarEstadoPagoModal();
          });

        clienteDinamico
          .querySelector('#chk-entrega-horario')
          ?.addEventListener('input', (e) => {
            estado.horarioEntrega = e.target.value;
          });

        clienteDinamico
          .querySelector('#chk-usar-otra-dir')
          ?.addEventListener('change', (e) => {
            estado.usarOtraDireccion = e.target.checked;
            clienteDinamico
              .querySelector('#chk-wrap-otra-dir')
              ?.classList.toggle('hidden', !estado.usarOtraDireccion);
          });

        clienteDinamico
          .querySelector('#chk-entrega-dir-otra')
          ?.addEventListener('input', (e) => {
            estado.entregaDireccionOtra = e.target.value;
          });

        clienteDinamico
          .querySelector('#chk-entrega-ref-otra')
          ?.addEventListener('input', (e) => {
            estado.entregaReferenciasOtra = e.target.value;
          });
        return;
      }

      // Estado A: Buscador y seleccion de cliente
      clienteDinamico.innerHTML = `
        <div class="pos-client-panel">
          <div class="field">
            <label for="chk-cliente-buscar">Buscar cliente registrado o crear uno nuevo</label>
            <div class="pos-client-search-row">
              <input
                type="text"
                id="chk-cliente-buscar"
                class="input"
                value="${escaparHtml(estado.busquedaCliente)}"
                placeholder="Nombre o telefono del cliente..."
                autocomplete="off"
              >
              <button type="button" class="btn btn-primary btn-sm" id="chk-btn-nuevo-cli">
                + Nuevo cliente
              </button>
            </div>
          </div>
          <div id="chk-cliente-resultados" class="pos-client-results"></div>
        </div>
      `;

      const inputBusq = clienteDinamico.querySelector('#chk-cliente-buscar');
      const listaRes = clienteDinamico.querySelector('#chk-cliente-resultados');

      function pintarListaResultados() {
        const termino = estado.busquedaCliente.trim().toLowerCase();
        const filtrados = estado.clientes.filter((c) => {
          if (!termino) return true;
          return (
            c.nombre.toLowerCase().includes(termino) ||
            (c.telefono || '').toLowerCase().includes(termino) ||
            (c.direccion || '').toLowerCase().includes(termino)
          );
        });

        if (filtrados.length === 0) {
          const limpio = estado.busquedaCliente.trim();
          listaRes.innerHTML = `
            <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12.5px;">
              <div>No se encontraron clientes${limpio ? ` para "${escaparHtml(limpio)}"` : ''}.</div>
              <button type="button" class="btn btn-primary btn-sm" id="chk-btn-reg-rapido" style="margin-top:8px;">
                ${limpio ? `Registrar "${escaparHtml(limpio)}" como nuevo cliente` : 'Registrar nuevo cliente'}
              </button>
            </div>
          `;
          listaRes
            .querySelector('#chk-btn-reg-rapido')
            ?.addEventListener('click', () => {
              estado.clienteEditando = null;
              estado.subvistaClienteModal = 'form';
              pintarSubvistaClienteModal();
              actualizarEstadoPagoModal();
            });
          return;
        }

        listaRes.innerHTML = filtrados
          .map((c) => {
            const ventas = Number(c.total_ventas || 0);
            const pend = Number(c.entregas_pendientes || 0);
            const badgeHist =
              ventas > 0
                ? `<span class="badge badge-success">${ventas} ${ventas === 1 ? 'venta' : 'ventas'}</span>`
                : '<span class="badge badge-neutral">Nuevo</span>';
            const badgePend =
              pend > 0 ? `<span class="badge badge-warning">${pend} pend.</span>` : '';

            return `
              <button type="button" class="pos-client-option" data-chk-pick="${c.id}">
                <div>
                  <div class="pos-client-option-name">${escaparHtml(c.nombre)}</div>
                  <div class="pos-client-option-meta">
                    ${escaparHtml(c.telefono || 'Sin telefono')} | ${escaparHtml(c.direccion || 'Sin direccion')}
                  </div>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
                  ${badgeHist}
                  ${badgePend}
                </div>
              </button>
            `;
          })
          .join('');

        listaRes.querySelectorAll('[data-chk-pick]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const cli = estado.clientes.find(
              (c) => String(c.id) === String(btn.dataset.chkPick)
            );
            if (!cli) return;
            estado.clienteSeleccionado = cli;
            estado.usarOtraDireccion = false;
            estado.entregaDireccionOtra = '';
            estado.entregaReferenciasOtra = '';
            estado.subvistaClienteModal = 'seleccionado';
            pintarSubvistaClienteModal();
            actualizarEstadoPagoModal();
          });
        });
      }

      inputBusq?.addEventListener('input', (e) => {
        estado.busquedaCliente = e.target.value;
        pintarListaResultados();
      });

      clienteDinamico
        .querySelector('#chk-btn-nuevo-cli')
        ?.addEventListener('click', () => {
          estado.clienteEditando = null;
          estado.subvistaClienteModal = 'form';
          pintarSubvistaClienteModal();
          actualizarEstadoPagoModal();
        });

      pintarListaResultados();
    }

    function sincronizarTipoVentaModal() {
      const esCliente = estado.tipoVenta === 'CLIENTE';
      btnGeneral.classList.toggle('active', !esCliente);
      btnCliente.classList.toggle('active', esCliente);
      panelGeneral.classList.toggle('hidden', esCliente);
      panelCliente.classList.toggle('hidden', !esCliente);
      if (esCliente) {
        if (!estado.fechaEntrega) {
          estado.fechaEntrega = obtenerFechaIsoConDesfase(0);
        }
        pintarSubvistaClienteModal();
      }
      sincronizarModalidadPagoModal();
    }

    btnGeneral.addEventListener('click', () => {
      estado.tipoVenta = 'GENERAL';
      sincronizarTipoVentaModal();
    });

    btnCliente.addEventListener('click', () => {
      estado.tipoVenta = 'CLIENTE';
      sincronizarTipoVentaModal();
    });

    btnModCompleto?.addEventListener('click', () => {
      estado.modalidadPago = 'COMPLETO';
      if (estado.dineroRecibidoTexto.trim() === '0') {
        estado.dineroRecibidoTexto = '';
        if (inputPago) {
          inputPago.value = '';
        }
      }
      sincronizarModalidadPagoModal();
      inputPago?.focus();
    });

    btnModParcial?.addEventListener('click', () => {
      estado.modalidadPago = 'PARCIAL';
      if (estado.dineroRecibidoTexto.trim() === '') {
        estado.dineroRecibidoTexto = '0';
        if (inputPago) {
          inputPago.value = '0';
        }
      }
      sincronizarModalidadPagoModal();
      inputPago?.focus();
      inputPago?.select();
    });

    inputNombrePendiente?.addEventListener('input', (e) => {
      estado.nombrePendiente = e.target.value;
    });

    inputTelPendiente?.addEventListener('input', (e) => {
      estado.telefonoPendiente = e.target.value;
    });

    inputNota.addEventListener('input', (e) => {
      estado.notaVenta = e.target.value;
    });

    inputPago.addEventListener('keydown', (event) => {
      bloquearTeclasNoNumericas(event, { permitirDecimal: true });
    });

    inputPago.addEventListener('input', (event) => {
      const limpio = sanitizarEntradaDecimal(event.target.value, 2);
      if (event.target.value !== limpio) {
        event.target.value = limpio;
      }
      estado.dineroRecibidoTexto = limpio;
      actualizarEstadoPagoModal();
    });

    btnExacto.addEventListener('click', () => {
      if (estado.modalidadPago === 'PARCIAL') {
        return;
      }
      const { total: tot } = calcularTotalesCarrito();
      estado.dineroRecibidoTexto = tot.toFixed(2);
      inputPago.value = estado.dineroRecibidoTexto;
      actualizarEstadoPagoModal();
    });

    btnSinAnticipo?.addEventListener('click', () => {
      if (estado.modalidadPago !== 'PARCIAL') {
        return;
      }
      estado.dineroRecibidoTexto = '0';
      inputPago.value = '0';
      actualizarEstadoPagoModal();
      inputPago.focus();
      inputPago.select();
    });

    btnConfirmar.addEventListener('click', async () => {
      await confirmarVentaDesdeModal(btnConfirmar);
    });

    sincronizarTipoVentaModal();
    if (estado.tipoVenta === 'GENERAL') {
      inputPago.focus();
    }
  }

  async function confirmarVentaDesdeModal(btnConfirmar) {
    if (estado.procesando || estado.carrito.length === 0) {
      return;
    }

    for (const item of estado.carrito) {
      if (!Number.isFinite(item.cantidad) || item.cantidad < 1) {
        mostrarToast(`La cantidad minima para "${item.nombre}" es 1.`, 'error');
        return;
      }
    }

    if (estado.tipoVenta === 'CLIENTE') {
      if (!estado.clienteSeleccionado) {
        mostrarToast(
          'Seleccione un cliente o registre uno nuevo para programar la entrega.',
          'error'
        );
        return;
      }
      if (!estado.fechaEntrega) {
        mostrarToast('Seleccione el dia de entrega programada.', 'error');
        return;
      }
    }

    const {
      total,
      esParcial,
      excedeTotalParcial,
      anticipoValido,
      montoAnticipo,
      recibidoValido,
      dineroRecibido,
      faltante
    } = calcularTotalesCarrito();

    if (esParcial) {
      if (!anticipoValido) {
        mostrarToast(
          excedeTotalParcial
            ? 'El monto cubre el total completo. Seleccione "Pago completo".'
            : 'Indique cuanto paga hoy de anticipo (desde $0.00 hasta menor al total).',
          'error'
        );
        return;
      }
    } else if (!recibidoValido || dineroRecibido < total) {
      mostrarToast(
        `Pago insuficiente. Faltan ${formatearMoneda(faltante)} para completar la venta.`,
        'error'
      );
      return;
    }

    estado.procesando = true;
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = esParcial ? 'Guardando nota...' : 'Registrando venta...';

    try {
      const payload = {
        items: estado.carrito.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad
        })),
        dinero_recibido: esParcial ? montoAnticipo : dineroRecibido,
        modalidad_pago: estado.modalidadPago,
        tipo_venta: estado.tipoVenta,
        nota_venta: estado.notaVenta.trim() || null,
        presupuesto_id: estado.presupuestoOrigen ? estado.presupuestoOrigen.id : null
      };

      if (esParcial) {
        payload.monto_anticipo = montoAnticipo;
        if (estado.tipoVenta === 'GENERAL') {
          if (estado.nombrePendiente.trim()) {
            payload.nombre_pendiente = estado.nombrePendiente.trim();
          }
          if (estado.telefonoPendiente.trim()) {
            payload.telefono_pendiente = estado.telefonoPendiente.trim();
          }
        }
      }

      if (estado.tipoVenta === 'CLIENTE') {
        const c = estado.clienteSeleccionado;
        const dirEntrega = estado.usarOtraDireccion
          ? estado.entregaDireccionOtra.trim() || null
          : c.direccion || null;
        const refEntrega = estado.usarOtraDireccion
          ? estado.entregaReferenciasOtra.trim() || null
          : c.referencias || null;

        payload.cliente = {
          cliente_id: c.id,
          nombre: c.nombre,
          telefono: c.telefono || null,
          direccion: dirEntrega,
          referencias: refEntrega,
          actualizar_cliente: false
        };
        payload.entrega = {
          fecha_entrega: estado.fechaEntrega,
          horario_entrega: estado.horarioEntrega.trim() || null,
          direccion_entrega: dirEntrega,
          referencias: refEntrega,
          nota_entrega: estado.notaVenta.trim() || null
        };
      }

      const respuesta = await api.post('/ventas', payload);
      const saldoRestante = Number(respuesta.venta?.saldo_pendiente || 0);
      const mensajeSaldo =
        saldoRestante > 0
          ? ` (saldo pendiente: ${formatearMoneda(saldoRestante)})`
          : '';
      const mensajeExtra = respuesta.entrega
        ? ` y entrega programada para ${formatearFecha(respuesta.entrega.fecha_entrega)}`
        : '';
      mostrarToast(
        `Nota ${respuesta.venta.folio} guardada${mensajeSaldo}${mensajeExtra}.`,
        'success'
      );

      cerrarModal();
      limpiarDatosOperacion();
      await cargarDatos();
      if (onVentaCompletada) {
        onVentaCompletada();
      }

      mostrarModalTicket({
        venta: respuesta.venta,
        detalle: respuesta.detalle,
        entrega: respuesta.entrega,
        pagos: respuesta.pagos || [],
        negocio: respuesta.negocio,
        titulo:
          saldoRestante > 0
            ? `Nota con saldo pendiente ${respuesta.venta.folio}`
            : `Ticket de venta ${respuesta.venta.folio}`
      });
    } catch (error) {
      mostrarToast(error.message, 'error');
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = esParcial
        ? 'Guardar nota con saldo pendiente'
        : 'Confirmar venta';
      await cargarDatos();
    } finally {
      estado.procesando = false;
      actualizarResumenCarrito();
    }
  }

  function abrirModalPresupuesto() {
    if (estado.carrito.length === 0) {
      return;
    }

    const { subtotal, total } = calcularTotalesCarrito();
    const totalItems = estado.carrito.length;
    const opcionesClientes =
      '<option value="">-- Sin cliente / captura libre --</option>' +
      estado.clientes
        .map((c) => {
          const tel = c.telefono ? ` (${c.telefono})` : '';
          const sel =
            String(estado.presClienteSelectId) === String(c.id) ? 'selected' : '';
          return `<option value="${c.id}" ${sel}>${escaparHtml(c.nombre + tel)}</option>`;
        })
        .join('');

    const root = abrirModal({
      titulo: 'Crear presupuesto',
      contenidoHtml: `
        <div class="stack-lg">
          <div class="pos-budget-notice">
            Este presupuesto no se registra como venta ni descuenta existencias del inventario.
          </div>

          <div class="info-box" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <span>Partidas: <strong class="num">${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}</strong> | Subtotal: <strong class="num">${formatearMoneda(subtotal)}</strong></span>
            <span style="font-size:16px;">Total estimado: <strong class="num">${formatearMoneda(total)}</strong></span>
          </div>

          <div class="form-grid">
            <div class="field col-span-2">
              <label for="mp-cliente-select">Cliente registrado (opcional)</label>
              <select id="mp-cliente-select" class="select">
                ${opcionesClientes}
              </select>
            </div>
            <div class="field">
              <label for="mp-cliente-nombre">Nombre del cliente (opcional)</label>
              <input
                type="text"
                id="mp-cliente-nombre"
                class="input"
                maxlength="150"
                value="${escaparHtml(estado.presClienteNombre)}"
                placeholder="A quien se cotiza"
              >
            </div>
            <div class="field">
              <label for="mp-cliente-telefono">Telefono (opcional)</label>
              <input
                type="text"
                id="mp-cliente-telefono"
                class="input"
                maxlength="60"
                value="${escaparHtml(estado.presClienteTelefono)}"
                placeholder="555-000-0000"
              >
            </div>
            <div class="field col-span-2">
              <label for="mp-notas">Notas del presupuesto (opcional)</label>
              <textarea
                id="mp-notas"
                class="textarea"
                maxlength="2000"
                placeholder="Vigencia de precios, condiciones o notas de obra..."
              >${escaparHtml(estado.presNotas)}</textarea>
            </div>
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Volver al carrito</button>
        <button type="button" class="btn btn-primary" id="mp-btn-guardar">
          Guardar presupuesto (58 mm)
        </button>
      `
    });

    if (!root) {
      return;
    }

    const selectCli = root.querySelector('#mp-cliente-select');
    const inputNom = root.querySelector('#mp-cliente-nombre');
    const inputTel = root.querySelector('#mp-cliente-telefono');
    const inputNotas = root.querySelector('#mp-notas');
    const btnGuardar = root.querySelector('#mp-btn-guardar');

    selectCli?.addEventListener('change', (e) => {
      const id = e.target.value;
      estado.presClienteSelectId = id;
      if (id) {
        const cli = estado.clientes.find((c) => String(c.id) === String(id));
        if (cli) {
          estado.presClienteNombre = cli.nombre || '';
          estado.presClienteTelefono = cli.telefono || '';
          if (inputNom) inputNom.value = estado.presClienteNombre;
          if (inputTel) inputTel.value = estado.presClienteTelefono;
        }
      }
    });

    inputNom?.addEventListener('input', (e) => {
      estado.presClienteNombre = e.target.value;
    });
    inputTel?.addEventListener('input', (e) => {
      estado.presClienteTelefono = e.target.value;
    });
    inputNotas?.addEventListener('input', (e) => {
      estado.presNotas = e.target.value;
    });

    btnGuardar?.addEventListener('click', async () => {
      if (estado.procesando) {
        return;
      }
      estado.procesando = true;
      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando presupuesto...';

      try {
        const clienteElegido = estado.presClienteSelectId
          ? estado.clientes.find(
              (c) => String(c.id) === String(estado.presClienteSelectId)
            )
          : null;

        const payload = {
          items: estado.carrito.map((item) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad
          })),
          cliente_id: clienteElegido ? clienteElegido.id : null,
          cliente_nombre: estado.presClienteNombre.trim() || null,
          cliente_telefono: estado.presClienteTelefono.trim() || null,
          cliente_direccion: clienteElegido ? clienteElegido.direccion || null : null,
          notas: estado.presNotas.trim() || null
        };

        const respuesta = await api.post('/presupuestos', payload);
        mostrarToast(
          respuesta.mensaje ||
            `Presupuesto ${respuesta.presupuesto.folio} guardado correctamente.`,
          'success'
        );

        cerrarModal();
        limpiarDatosOperacion();
        renderizarCarrito();
        renderizarCatalogo();

        if (onPresupuestoGuardado) {
          onPresupuestoGuardado();
        }

        mostrarModalTicketPresupuesto({
          presupuesto: respuesta.presupuesto,
          detalle: respuesta.detalle,
          negocio: respuesta.negocio,
          titulo: `Presupuesto ${respuesta.presupuesto.folio}`
        });
      } catch (error) {
        mostrarToast(error.message, 'error');
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar presupuesto (58 mm)';
      } finally {
        estado.procesando = false;
        actualizarResumenCarrito();
      }
    });
  }

  async function cargarDesdePresupuesto({ presupuesto, detalle }) {
    await cargarDatos();

    const mapaProductos = new Map(estado.productos.map((p) => [p.id, p]));
    const nuevoCarrito = [];
    const advertencias = [];

    for (const linea of detalle || []) {
      const prod = mapaProductos.get(linea.producto_id);
      if (!prod) {
        advertencias.push(`"${linea.producto_nombre}" ya no esta activo en el catalogo.`);
        continue;
      }
      const controlaStock = Number(prod.controla_stock) !== 0;
      const stock = redondearCantidad(prod.existencias);
      if (controlaStock && stock < 1) {
        advertencias.push(`"${prod.nombre}" no tiene existencias disponibles.`);
        continue;
      }
      const cantidadCotizada = Math.max(1, redondearCantidad(linea.cantidad));
      const cantidad = controlaStock ? Math.min(stock, cantidadCotizada) : cantidadCotizada;
      if (controlaStock && cantidad < cantidadCotizada) {
        advertencias.push(
          `"${prod.nombre}" ajustado a ${formatearCantidad(cantidad)} por limite de existencias.`
        );
      }
      nuevoCarrito.push({
        producto_id: prod.id,
        nombre: prod.nombre,
        unidad_medida: prod.unidad_medida,
        precio_venta: redondearMoneda(prod.precio_venta),
        controla_stock: controlaStock,
        existencias: stock,
        cantidad
      });
    }

    estado.carrito = nuevoCarrito;
    estado.dineroRecibidoTexto = '';
    estado.presupuestoOrigen = { id: presupuesto.id, folio: presupuesto.folio };
    estado.notaVenta = presupuesto.notas || '';

    if (presupuesto.cliente_id) {
      const clienteEncontrado = estado.clientes.find(
        (c) => Number(c.id) === Number(presupuesto.cliente_id)
      );
      estado.tipoVenta = 'CLIENTE';
      estado.clienteSeleccionado = clienteEncontrado || null;
      estado.subvistaClienteModal = clienteEncontrado ? 'seleccionado' : 'buscar';
      estado.busquedaCliente = clienteEncontrado ? '' : presupuesto.cliente_nombre || '';
      estado.fechaEntrega = obtenerFechaIsoConDesfase(0);
    } else if (presupuesto.cliente_nombre) {
      estado.tipoVenta = 'CLIENTE';
      estado.clienteSeleccionado = null;
      estado.subvistaClienteModal = 'buscar';
      estado.busquedaCliente = presupuesto.cliente_nombre;
      estado.fechaEntrega = obtenerFechaIsoConDesfase(0);
    } else {
      estado.tipoVenta = 'GENERAL';
      estado.clienteSeleccionado = null;
      estado.subvistaClienteModal = 'buscar';
      estado.busquedaCliente = '';
    }

    actualizarBannerPresupuesto();
    renderizarCarrito();
    renderizarCatalogo();

    if (advertencias.length > 0) {
      mostrarToast(advertencias.join(' '), 'warning', 5500);
    } else {
      mostrarToast(
        `Presupuesto ${presupuesto.folio} cargado. Presione "Cobrar venta" para finalizar.`,
        'success'
      );
    }
  }

  async function cargarDatos() {
    renderizarEstructuraBase();
    try {
      const [resProd, resCat, resClientes] = await Promise.all([
        api.get(`/productos${buildQuery({})}`),
        api.get('/categorias'),
        api.get('/clientes')
      ]);

      estado.productos = resProd.productos || [];
      estado.categorias = resCat.categorias || [];
      estado.clientes = resClientes.clientes || [];

      if (estado.clienteSeleccionado) {
        const actualizado = estado.clientes.find(
          (c) => c.id === estado.clienteSeleccionado.id
        );
        estado.clienteSeleccionado = actualizado || null;
        if (!actualizado) {
          estado.subvistaClienteModal = 'buscar';
        }
      }

      const mapa = new Map(estado.productos.map((p) => [p.id, p]));
      estado.carrito = estado.carrito
        .filter((item) => mapa.has(item.producto_id))
        .map((item) => {
          const actual = mapa.get(item.producto_id);
          const controlaStock = Number(actual.controla_stock) !== 0;
          const stock = redondearCantidad(actual.existencias);
          const cant = controlaStock
            ? Math.min(item.cantidad, stock)
            : item.cantidad;
          return {
            ...item,
            nombre: actual.nombre,
            unidad_medida: actual.unidad_medida,
            precio_venta: redondearMoneda(actual.precio_venta),
            controla_stock: controlaStock,
            existencias: stock,
            cantidad: cant
          };
        })
        .filter((item) => item.cantidad >= 1);

      renderizarChipsCategorias();
      renderizarCatalogo();
      renderizarCarrito();
      actualizarBannerPresupuesto();
    } catch (error) {
      mostrarToast(`No se pudo cargar el catalogo: ${error.message}`, 'error');
    }
  }

  return {
    cargarDatos,
    cargarDesdePresupuesto
  };
}
