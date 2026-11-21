import {
  escaparHtml,
  formatearCantidad,
  formatearFecha,
  formatearHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal, cerrarModal } from '../utils/modal.js';
import { descargarNotaVentaPdf, descargarPresupuestoPdf } from '../utils/pdf.js';

export function obtenerSvgCamionVolteo() {
  return `
    <div class="ticket-truck-wrap" aria-hidden="true">
      <svg
        class="ticket-truck-svg"
        viewBox="0 0 140 58"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <!-- Carga de material a granel en la caja -->
        <path
          d="M16 18 C24 8, 42 7, 54 11 C65 7, 78 10, 86 18 Z"
          fill="#000000"
        />
        <!-- Visera protectora sobre cabina y caja de volteo -->
        <path
          d="M12 18 L92 18 L103 14 L103 18 L90 21 L88 37 L14 37 Z"
          fill="#ffffff"
          stroke="#000000"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <!-- Costillas de refuerzo en la caja de volteo -->
        <line x1="28" y1="20" x2="28" y2="36" stroke="#000000" stroke-width="1.8" />
        <line x1="46" y1="20" x2="46" y2="36" stroke="#000000" stroke-width="1.8" />
        <line x1="64" y1="20" x2="64" y2="36" stroke="#000000" stroke-width="1.8" />
        <line x1="80" y1="20" x2="80" y2="36" stroke="#000000" stroke-width="1.8" />
        <!-- Cabina del camion -->
        <path
          d="M91 21 L114 21 L126 30 L128 42 L91 42 Z"
          fill="#ffffff"
          stroke="#000000"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <!-- Parabrisas y ventana lateral -->
        <path
          d="M96 24 L112 24 L120 30 L96 30 Z"
          fill="#000000"
        />
        <!-- Defensa y chasis -->
        <rect x="10" y="37" width="121" height="5" fill="#000000" rx="1" />
        <!-- Eje doble trasero -->
        <circle cx="29" cy="46" r="8" fill="#000000" />
        <circle cx="29" cy="46" r="3" fill="#ffffff" />
        <circle cx="49" cy="46" r="8" fill="#000000" />
        <circle cx="49" cy="46" r="3" fill="#ffffff" />
        <!-- Rueda delantera -->
        <circle cx="111" cy="46" r="8" fill="#000000" />
        <circle cx="111" cy="46" r="3" fill="#ffffff" />
        <!-- Linea de piso -->
        <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
      </svg>
    </div>
  `;
}

function construirEncabezadoNegocio(infoNegocio) {
  const mostrarCamion = infoNegocio.mostrarCamionTicket !== false;
  return `
    <div class="ticket-header">
      ${mostrarCamion ? obtenerSvgCamionVolteo() : ''}
      <div class="ticket-business-name">${escaparHtml(infoNegocio.nombre || 'Casa de Materiales')}</div>
      ${infoNegocio.direccion ? `<div class="ticket-business-line">${escaparHtml(infoNegocio.direccion)}</div>` : ''}
      ${infoNegocio.telefono ? `<div class="ticket-business-line">${escaparHtml(infoNegocio.telefono)}</div>` : ''}
      ${infoNegocio.rfc ? `<div class="ticket-business-line">${escaparHtml(infoNegocio.rfc)}</div>` : ''}
    </div>
  `;
}

function construirFilasPartidas(detalle) {
  return (detalle || [])
    .map(
      (item) => `
      <tr>
        <td colspan="2">
          <div class="ticket-item-name">${escaparHtml(item.producto_nombre)}</div>
          <div class="ticket-item-detail">
            <span>${formatearCantidad(item.cantidad)} ${escaparHtml(item.unidad_medida)} x ${formatearMoneda(item.precio_unitario)}</span>
            <strong>${formatearMoneda(item.importe)}</strong>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

export function generarHtmlTicket58mm({ venta, detalle, entrega = null, negocio }) {
  const infoNegocio = negocio || {};
  const clienteNombre = entrega?.cliente_nombre || venta.cliente_nombre || '';
  const clienteTelefono = entrega?.cliente_telefono || venta.cliente_telefono || '';
  const clienteDireccion = entrega?.direccion_entrega || venta.cliente_direccion || '';
  const referencias = entrega?.referencias || '';
  const nota = venta.nota_venta || entrega?.nota_entrega || '';

  const bloqueClienteEntrega =
    venta.tipo_venta === 'CLIENTE' || clienteNombre || entrega
      ? `
        <div class="ticket-divider"></div>
        <div class="ticket-meta">
          <div class="ticket-section-title">Datos de cliente / entrega</div>
          ${clienteNombre ? `<div><strong>Cliente:</strong> ${escaparHtml(clienteNombre)}</div>` : ''}
          ${clienteTelefono ? `<div><strong>Tel:</strong> ${escaparHtml(clienteTelefono)}</div>` : ''}
          ${clienteDireccion ? `<div><strong>Dir:</strong> ${escaparHtml(clienteDireccion)}</div>` : ''}
          ${referencias ? `<div><strong>Ref:</strong> ${escaparHtml(referencias)}</div>` : ''}
          ${entrega?.fecha_entrega ? `<div><strong>Dia entrega:</strong> ${formatearFecha(entrega.fecha_entrega)}</div>` : ''}
          ${entrega?.horario_entrega ? `<div><strong>Horario:</strong> ${escaparHtml(entrega.horario_entrega)}</div>` : ''}
          ${entrega?.estado ? `<div><strong>Estado entrega:</strong> ${escaparHtml(entrega.estado)}</div>` : ''}
        </div>
      `
      : '';

  const bloqueNota = nota
    ? `
      <div class="ticket-divider"></div>
      <div class="ticket-note-box">
        <div class="ticket-section-title">Nota de venta</div>
        <div>${escaparHtml(nota)}</div>
      </div>
    `
    : '';

  return `
    <div class="ticket-58mm">
      ${construirEncabezadoNegocio(infoNegocio)}

      <div class="ticket-divider"></div>

      <div class="ticket-meta">
        <div class="ticket-meta-row">
          <span>Folio:</span>
          <strong>${escaparHtml(venta.folio)}</strong>
        </div>
        <div class="ticket-meta-row">
          <span>Tipo:</span>
          <span>${venta.tipo_venta === 'CLIENTE' ? 'Con cliente' : 'Venta general'}</span>
        </div>
        <div class="ticket-meta-row">
          <span>Fecha:</span>
          <span>${formatearFecha(venta.fecha_venta)}</span>
        </div>
        <div class="ticket-meta-row">
          <span>Hora:</span>
          <span>${formatearHora(venta.fecha_venta)}</span>
        </div>
      </div>

      ${bloqueClienteEntrega}

      <div class="ticket-divider"></div>

      <table class="ticket-items">
        <thead>
          <tr>
            <th>Producto / Cant. x Precio</th>
            <th class="text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${construirFilasPartidas(detalle)}
        </tbody>
      </table>

      <div class="ticket-divider"></div>

      <div class="ticket-totals">
        <div class="ticket-total-row">
          <span>Subtotal:</span>
          <span>${formatearMoneda(venta.subtotal)}</span>
        </div>
        <div class="ticket-total-row ticket-grand-total">
          <span>TOTAL:</span>
          <span>${formatearMoneda(venta.total)}</span>
        </div>
        <div class="ticket-total-row">
          <span>Recibido:</span>
          <span>${formatearMoneda(venta.dinero_recibido)}</span>
        </div>
        <div class="ticket-total-row">
          <span>Cambio:</span>
          <span>${formatearMoneda(venta.cambio)}</span>
        </div>
      </div>

      ${bloqueNota}

      <div class="ticket-divider"></div>

      <div class="ticket-footer">
        ${escaparHtml(infoNegocio.mensajeTicket || 'Gracias por su compra.')}
      </div>
    </div>
  `;
}

export function generarHtmlTicketPresupuesto58mm({ presupuesto, detalle, negocio }) {
  const infoNegocio = negocio || {};

  const bloqueCliente =
    presupuesto.cliente_nombre || presupuesto.cliente_telefono || presupuesto.cliente_direccion
      ? `
        <div class="ticket-divider"></div>
        <div class="ticket-meta">
          <div class="ticket-section-title">Cliente</div>
          ${presupuesto.cliente_nombre ? `<div><strong>Nombre:</strong> ${escaparHtml(presupuesto.cliente_nombre)}</div>` : ''}
          ${presupuesto.cliente_telefono ? `<div><strong>Tel:</strong> ${escaparHtml(presupuesto.cliente_telefono)}</div>` : ''}
          ${presupuesto.cliente_direccion ? `<div><strong>Dir:</strong> ${escaparHtml(presupuesto.cliente_direccion)}</div>` : ''}
        </div>
      `
      : '';

  const bloqueNotas = presupuesto.notas
    ? `
      <div class="ticket-divider"></div>
      <div class="ticket-note-box">
        <div class="ticket-section-title">Notas</div>
        <div>${escaparHtml(presupuesto.notas)}</div>
      </div>
    `
    : '';

  return `
    <div class="ticket-58mm">
      ${construirEncabezadoNegocio(infoNegocio)}

      <div class="ticket-doc-type">PRESUPUESTO</div>

      <div class="ticket-meta">
        <div class="ticket-meta-row">
          <span>Folio:</span>
          <strong>${escaparHtml(presupuesto.folio)}</strong>
        </div>
        <div class="ticket-meta-row">
          <span>Fecha:</span>
          <span>${formatearFecha(presupuesto.fecha_presupuesto)}</span>
        </div>
        <div class="ticket-meta-row">
          <span>Hora:</span>
          <span>${formatearHora(presupuesto.fecha_presupuesto)}</span>
        </div>
      </div>

      ${bloqueCliente}

      <div class="ticket-divider"></div>

      <table class="ticket-items">
        <thead>
          <tr>
            <th>Producto / Cant. x Precio</th>
            <th class="text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${construirFilasPartidas(detalle)}
        </tbody>
      </table>

      <div class="ticket-divider"></div>

      <div class="ticket-totals">
        <div class="ticket-total-row">
          <span>Subtotal:</span>
          <span>${formatearMoneda(presupuesto.subtotal)}</span>
        </div>
        <div class="ticket-total-row ticket-grand-total">
          <span>TOTAL ESTIMADO:</span>
          <span>${formatearMoneda(presupuesto.total)}</span>
        </div>
      </div>

      ${bloqueNotas}

      <div class="ticket-divider"></div>

      <div class="ticket-footer">
        Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.
      </div>
    </div>
  `;
}

function abrirVentanaImpresion(ticketHtml, titulo, { onDescargarPdf = null } = {}) {
  const printContainer = document.getElementById('print-ticket-container');
  if (printContainer) {
    printContainer.innerHTML = ticketHtml;
  }

  const botonPdfHtml = onDescargarPdf
    ? '<button type="button" class="btn btn-secondary" id="btn-ticket-pdf">Descargar PDF</button>'
    : '';

  const root = abrirModal({
    titulo,
    size: 'sm',
    contenidoHtml: `
      <div class="ticket-preview-wrapper">
        ${ticketHtml}
      </div>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" id="btn-ticket-cerrar">Cerrar</button>
      ${botonPdfHtml}
      <button type="button" class="btn btn-primary" id="btn-ticket-imprimir">Imprimir ticket (58 mm)</button>
    `
  });

  if (!root) {
    return;
  }

  root.querySelector('#btn-ticket-cerrar')?.addEventListener('click', cerrarModal);
  const btnPdf = root.querySelector('#btn-ticket-pdf');
  if (btnPdf && onDescargarPdf) {
    btnPdf.addEventListener('click', () => {
      onDescargarPdf(btnPdf);
    });
  }
  root.querySelector('#btn-ticket-imprimir')?.addEventListener('click', () => {
    window.print();
  });
}

export function mostrarModalTicket({
  venta,
  detalle,
  entrega = null,
  negocio,
  titulo = 'Comprobante de venta (58 mm)'
}) {
  const ticketHtml = generarHtmlTicket58mm({ venta, detalle, entrega, negocio });
  abrirVentanaImpresion(ticketHtml, titulo, {
    onDescargarPdf: venta?.id
      ? (boton) => descargarNotaVentaPdf(venta.id, venta.folio, boton)
      : null
  });
}

export function mostrarModalTicketPresupuesto({
  presupuesto,
  detalle,
  negocio,
  titulo = 'Presupuesto (58 mm)'
}) {
  const ticketHtml = generarHtmlTicketPresupuesto58mm({ presupuesto, detalle, negocio });
  abrirVentanaImpresion(ticketHtml, titulo, {
    onDescargarPdf: presupuesto?.id
      ? (boton) => descargarPresupuestoPdf(presupuesto.id, presupuesto.folio, boton)
      : null
  });
}
