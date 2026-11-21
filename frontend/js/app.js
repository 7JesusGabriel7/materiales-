import { api } from './api/client.js';
import { crearModuloPos } from './modules/pos.js';
import { crearModuloPresupuestos } from './modules/presupuestos.js';
import { crearModuloEntregas } from './modules/entregas.js';
import { crearModuloProductos } from './modules/productos.js';
import { crearModuloInventario } from './modules/inventario.js';
import { crearModuloHistorial } from './modules/historial.js';
import { crearModuloConfiguracion } from './modules/configuracion.js';
import { mostrarToast } from './utils/toast.js';

const TITULOS_VISTAS = {
  pos: 'Modulo de ventas',
  presupuestos: 'Presupuestos y cotizaciones',
  entregas: 'Entregas programadas',
  productos: 'Administracion de productos',
  inventario: 'Control de inventario',
  historial: 'Historial de ventas',
  configuracion: 'Configuracion del establecimiento'
};

const appState = {
  vistaActual: 'pos',
  unidadesMedida: [
    'Pieza',
    'Bulto',
    'Kilogramo',
    'Tonelada',
    'Metro',
    'Metro cúbico',
    'Viaje'
  ],
  negocio: null
};

const appShell = document.getElementById('app-shell');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const pageTitle = document.getElementById('page-title');
const navButtons = document.querySelectorAll('.nav-item[data-view]');
const viewSections = document.querySelectorAll('.view-section');

function esVistaMovil() {
  return window.innerWidth <= 960;
}

function sincronizarEstadoBotonMenu() {
  if (!btnMobileMenu) {
    return;
  }
  const visible = esVistaMovil()
    ? Boolean(sidebar?.classList.contains('open'))
    : !appShell?.classList.contains('sidebar-collapsed');
  btnMobileMenu.setAttribute('aria-expanded', visible ? 'true' : 'false');
}

function cerrarMenuMovil() {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('open');
  sincronizarEstadoBotonMenu();
}

function alternarMenuLateral() {
  if (esVistaMovil()) {
    const abierto = sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open', Boolean(abierto));
  } else {
    appShell?.classList.toggle('sidebar-collapsed');
  }
  sincronizarEstadoBotonMenu();
}

async function refrescarIndicadoresGlobales() {
  try {
    const [resInv, resEnt] = await Promise.all([
      api.get('/inventario/resumen'),
      api.get('/entregas/resumen')
    ]);

    const bajoStock = Number(resInv.resumen?.bajo_stock || 0);
    const badgeStock = document.getElementById('nav-low-stock-badge');
    if (badgeStock) {
      badgeStock.textContent = String(bajoStock);
      badgeStock.classList.toggle('hidden', bajoStock <= 0);
    }

    const pendientesEntrega = Number(resEnt.resumen?.total_pendientes || 0);
    const badgeEntregas = document.getElementById('nav-pending-deliveries-badge');
    if (badgeEntregas) {
      badgeEntregas.textContent = String(pendientesEntrega);
      badgeEntregas.classList.toggle('hidden', pendientesEntrega <= 0);
    }
  } catch {
    // Se ignora si la verificacion periodica no logra conectar temporalmente
  }
}

async function verificarEstadoServidor() {
  const dot = document.getElementById('status-indicator');
  const texto = document.getElementById('status-text');
  try {
    await api.get('/health');
    if (dot) {
      dot.className = 'status-dot status-online';
    }
    if (texto) {
      texto.textContent = 'Base de datos conectada';
    }
  } catch {
    if (dot) {
      dot.className = 'status-dot status-offline';
    }
    if (texto) {
      texto.textContent = 'Sin conexion con servidor';
    }
  }
}

function aplicarConfiguracionNegocio(negocio) {
  if (!negocio) {
    return;
  }
  appState.negocio = negocio;
  const brandEl = document.getElementById('sidebar-business-name');
  const topbarMetaEl = document.getElementById('topbar-business-info');
  if (brandEl && negocio.nombre) {
    brandEl.textContent = negocio.nombre;
  }
  if (topbarMetaEl) {
    topbarMetaEl.textContent = [negocio.nombre, negocio.telefono]
      .filter(Boolean)
      .join(' | ');
  }
}

async function cargarConfiguracionInicial() {
  try {
    const resp = await api.get('/config');
    if (Array.isArray(resp.unidades_medida) && resp.unidades_medida.length > 0) {
      appState.unidadesMedida = resp.unidades_medida;
    }
    if (resp.negocio) {
      aplicarConfiguracionNegocio(resp.negocio);
    }
  } catch (error) {
    mostrarToast(`No se pudo obtener la configuracion inicial: ${error.message}`, 'warning');
  }
}

function actualizarFechaSidebar() {
  const dateEl = document.getElementById('current-date-label');
  if (!dateEl) {
    return;
  }
  const formato = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  dateEl.textContent = formato.format(new Date());
}

const moduloPos = crearModuloPos({
  onVentaCompletada: () => {
    refrescarIndicadoresGlobales();
  },
  onPresupuestoGuardado: () => {
    refrescarIndicadoresGlobales();
  }
});

const moduloPresupuestos = crearModuloPresupuestos({
  onCargarEnPos: async (datosPresupuesto) => {
    await activarVistaSoloUi('pos');
    await moduloPos.cargarDesdePresupuesto(datosPresupuesto);
  }
});

const moduloEntregas = crearModuloEntregas({
  onEntregasModificadas: () => {
    refrescarIndicadoresGlobales();
  }
});

const moduloProductos = crearModuloProductos({
  obtenerUnidades: () => appState.unidadesMedida,
  onCatalogoModificado: () => {
    refrescarIndicadoresGlobales();
  }
});

const moduloInventario = crearModuloInventario({
  onInventarioModificado: () => {
    refrescarIndicadoresGlobales();
  }
});

const moduloHistorial = crearModuloHistorial();

const moduloConfiguracion = crearModuloConfiguracion({
  onConfiguracionActualizada: (negocio) => {
    aplicarConfiguracionNegocio(negocio);
  }
});

const cargadoresVista = {
  pos: () => moduloPos.cargarDatos(),
  presupuestos: () => moduloPresupuestos.cargarDatos(),
  entregas: () => moduloEntregas.cargarDatos(),
  productos: () => moduloProductos.cargarDatos(),
  inventario: () => moduloInventario.cargarDatos(),
  historial: () => moduloHistorial.cargarDatos(),
  configuracion: () => moduloConfiguracion.cargarDatos()
};

function activarVistaSoloUi(vista) {
  appState.vistaActual = vista;
  if (pageTitle) {
    pageTitle.textContent = TITULOS_VISTAS[vista] || 'Punto de Venta';
  }

  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === vista);
  });

  viewSections.forEach((sec) => {
    const activa = sec.id === `vista-${vista}`;
    sec.classList.toggle('hidden', !activa);
    sec.classList.toggle('active', activa);
  });

  cerrarMenuMovil();
}

async function cambiarVista(vista) {
  if (!cargadoresVista[vista]) {
    return;
  }
  activarVistaSoloUi(vista);
  await cargadoresVista[vista]();
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    cambiarVista(btn.dataset.view);
  });
});

btnMobileMenu?.addEventListener('click', alternarMenuLateral);
sidebarOverlay?.addEventListener('click', cerrarMenuMovil);
window.addEventListener('resize', () => {
  if (!esVistaMovil()) {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
  }
  sincronizarEstadoBotonMenu();
});

async function iniciarAplicacion() {
  actualizarFechaSidebar();
  sincronizarEstadoBotonMenu();
  await Promise.all([
    cargarConfiguracionInicial(),
    verificarEstadoServidor(),
    refrescarIndicadoresGlobales()
  ]);
  await cambiarVista('pos');
}

iniciarAplicacion();
