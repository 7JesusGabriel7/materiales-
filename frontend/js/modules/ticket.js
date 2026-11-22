import {
  escaparHtml,
  formatearCantidad,
  formatearFecha,
  formatearHora,
  formatearMoneda
} from '../utils/format.js';
import { abrirModal, cerrarModal } from '../utils/modal.js';
import { descargarNotaVentaPdf, descargarPresupuestoPdf } from '../utils/pdf.js';

export const CATALOGO_ILUSTRACIONES = [
  { id: 'camion_volteo', nombre: 'Camion de volteo', categoria: 'Camion' },
  { id: 'camion_plataforma', nombre: 'Camion plataforma', categoria: 'Camion' },
  { id: 'camion_revolvedora', nombre: 'Camion revolvedora', categoria: 'Camion' },
  { id: 'retroexcavadora', nombre: 'Retroexcavadora', categoria: 'Maquina de excavar' },
  { id: 'excavadora_orugas', nombre: 'Excavadora sobre orugas', categoria: 'Maquina de excavar' },
  { id: 'ninguno', nombre: 'Sin ilustracion', categoria: 'Solo texto' }
];

const CUERPOS_SVG_ILUSTRACION = {
  camion_volteo: `
    <path d="M16 18 C24 8, 42 7, 54 11 C65 7, 78 10, 86 18 Z" fill="#000000" />
    <path d="M12 18 L92 18 L103 14 L103 18 L90 21 L88 37 L14 37 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <line x1="28" y1="20" x2="28" y2="36" stroke="#000000" stroke-width="1.8" />
    <line x1="46" y1="20" x2="46" y2="36" stroke="#000000" stroke-width="1.8" />
    <line x1="64" y1="20" x2="64" y2="36" stroke="#000000" stroke-width="1.8" />
    <line x1="80" y1="20" x2="80" y2="36" stroke="#000000" stroke-width="1.8" />
    <path d="M91 21 L114 21 L126 30 L128 42 L91 42 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <path d="M96 24 L112 24 L120 30 L96 30 Z" fill="#000000" />
    <rect x="10" y="37" width="121" height="5" fill="#000000" rx="1" />
    <circle cx="29" cy="46" r="8" fill="#000000" />
    <circle cx="29" cy="46" r="3" fill="#ffffff" />
    <circle cx="49" cy="46" r="8" fill="#000000" />
    <circle cx="49" cy="46" r="3" fill="#ffffff" />
    <circle cx="111" cy="46" r="8" fill="#000000" />
    <circle cx="111" cy="46" r="3" fill="#ffffff" />
    <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
  `,
  camion_plataforma: `
    <rect x="16" y="33" width="30" height="3" fill="#000000" />
    <rect x="17" y="15" width="28" height="17" fill="#ffffff" stroke="#000000" stroke-width="1.8" />
    <line x1="17" y1="21" x2="45" y2="21" stroke="#000000" stroke-width="1.4" />
    <line x1="17" y1="27" x2="45" y2="27" stroke="#000000" stroke-width="1.4" />
    <line x1="26" y1="15" x2="26" y2="21" stroke="#000000" stroke-width="1.2" />
    <line x1="35" y1="15" x2="35" y2="21" stroke="#000000" stroke-width="1.2" />
    <line x1="31" y1="21" x2="31" y2="27" stroke="#000000" stroke-width="1.2" />
    <line x1="26" y1="27" x2="26" y2="33" stroke="#000000" stroke-width="1.2" />
    <line x1="35" y1="27" x2="35" y2="33" stroke="#000000" stroke-width="1.2" />
    <rect x="50" y="33" width="28" height="3" fill="#000000" />
    <rect x="51" y="26" width="26" height="6" rx="2" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
    <rect x="51" y="19" width="26" height="6" rx="2" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
    <rect x="54" y="12" width="20" height="6" rx="2" fill="#ffffff" stroke="#000000" stroke-width="1.5" />
    <rect x="82" y="12" width="4" height="25" fill="#000000" />
    <rect x="11" y="36" width="77" height="4" fill="#000000" />
    <path d="M89 20 L114 20 L126 29 L128 41 L89 41 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <path d="M94 23 L112 23 L120 29 L94 29 Z" fill="#000000" />
    <rect x="10" y="38" width="121" height="4" rx="1" fill="#000000" />
    <circle cx="28" cy="46" r="8" fill="#000000" />
    <circle cx="28" cy="46" r="3" fill="#ffffff" />
    <circle cx="48" cy="46" r="8" fill="#000000" />
    <circle cx="48" cy="46" r="3" fill="#ffffff" />
    <circle cx="110" cy="46" r="8" fill="#000000" />
    <circle cx="110" cy="46" r="3" fill="#ffffff" />
    <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
  `,
  camion_revolvedora: `
    <path d="M14 14 L26 14 L28 24 L18 27 Z" fill="#000000" />
    <path d="M10 27 L20 24 L21 28 L11 31 Z" fill="#000000" />
    <path d="M22 25 L34 14 L64 9 L85 16 L85 32 L64 36 L27 33 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <line x1="38" y1="14" x2="46" y2="34" stroke="#000000" stroke-width="1.8" />
    <line x1="53" y1="10" x2="62" y2="36" stroke="#000000" stroke-width="1.8" />
    <line x1="70" y1="12" x2="76" y2="34" stroke="#000000" stroke-width="1.8" />
    <path d="M26 32 L34 32 L36 38 L24 38 Z" fill="#000000" />
    <rect x="84" y="15" width="5" height="22" fill="#000000" />
    <path d="M72 34 L84 34 L84 38 L70 38 Z" fill="#000000" />
    <path d="M91 21 L114 21 L126 30 L128 42 L91 42 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <path d="M96 24 L112 24 L120 30 L96 30 Z" fill="#000000" />
    <rect x="14" y="37" width="117" height="5" rx="1" fill="#000000" />
    <circle cx="31" cy="46" r="8" fill="#000000" />
    <circle cx="31" cy="46" r="3" fill="#ffffff" />
    <circle cx="51" cy="46" r="8" fill="#000000" />
    <circle cx="51" cy="46" r="3" fill="#ffffff" />
    <circle cx="111" cy="46" r="8" fill="#000000" />
    <circle cx="111" cy="46" r="3" fill="#ffffff" />
    <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
  `,
  retroexcavadora: `
    <path d="M44 38 L39 50 L44 50 L48 39 Z" fill="#000000" />
    <path d="M44 35 L33 10 L38 8 L49 32 Z" fill="#000000" />
    <path d="M35 9 L19 25 L23 28 L38 13 Z" fill="#ffffff" stroke="#000000" stroke-width="1.8" stroke-linejoin="round" />
    <path d="M19 25 L10 30 L12 39 L23 36 L22 28 Z" fill="#000000" />
    <rect x="46" y="33" width="48" height="9" fill="#000000" />
    <path d="M68 22 L92 24 L94 34 L68 34 Z" fill="#ffffff" stroke="#000000" stroke-width="1.8" stroke-linejoin="round" />
    <rect x="77" y="17" width="3" height="6" fill="#000000" />
    <path d="M46 11 L68 11 L70 34 L44 34 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <path d="M49 14 L65 14 L66 25 L48 25 Z" fill="#000000" />
    <path d="M66 27 L98 20 L108 38 L103 40 L95 25 L66 32 Z" fill="#ffffff" stroke="#000000" stroke-width="1.6" stroke-linejoin="round" />
    <path d="M107 34 L125 41 L127 48 L104 48 L104 37 Z" fill="#000000" />
    <circle cx="54" cy="42" r="11" fill="#000000" />
    <circle cx="54" cy="42" r="4.5" fill="#ffffff" />
    <circle cx="88" cy="45" r="8" fill="#000000" />
    <circle cx="88" cy="45" r="3" fill="#ffffff" />
    <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
  `,
  excavadora_orugas: `
    <rect x="22" y="40" width="68" height="13" rx="6" fill="#000000" />
    <rect x="26" y="43" width="60" height="7" rx="3" fill="#ffffff" />
    <circle cx="31" cy="46.5" r="2.5" fill="#000000" />
    <circle cx="45" cy="46.5" r="2.5" fill="#000000" />
    <circle cx="59" cy="46.5" r="2.5" fill="#000000" />
    <circle cx="77" cy="46.5" r="2.5" fill="#000000" />
    <rect x="42" y="36" width="26" height="5" fill="#000000" />
    <path d="M24 21 L52 21 L52 36 L24 36 C20 36, 20 21, 24 21 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <rect x="22" y="23" width="8" height="12" fill="#000000" />
    <path d="M52 13 L73 13 L77 36 L52 36 Z" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
    <path d="M55 16 L70 16 L73 27 L55 27 Z" fill="#000000" />
    <path d="M72 28 L93 8 L100 11 L77 34 Z" fill="#ffffff" stroke="#000000" stroke-width="1.8" stroke-linejoin="round" />
    <line x1="76" y1="22" x2="89" y2="14" stroke="#000000" stroke-width="1.6" />
    <path d="M95 9 L111 33 L105 35 L91 12 Z" fill="#000000" />
    <path d="M107 34 L123 36 L126 46 L112 49 L104 42 Z" fill="#000000" />
    <line x1="4" y1="55" x2="136" y2="55" stroke="#000000" stroke-width="1.5" />
  `
};

export function obtenerSvgIlustracion(iconoId = 'camion_volteo', { envolver = true } = {}) {
  if (!iconoId || iconoId === 'ninguno') {
    return '';
  }
  const cuerpo = CUERPOS_SVG_ILUSTRACION[iconoId] || CUERPOS_SVG_ILUSTRACION.camion_volteo;
  const svg = `
    <svg
      class="ticket-truck-svg"
      viewBox="0 0 140 58"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      ${cuerpo}
    </svg>
  `;
  return envolver ? `<div class="ticket-truck-wrap" aria-hidden="true">${svg}</div>` : svg;
}

export function obtenerSvgCamionVolteo() {
  return obtenerSvgIlustracion('camion_volteo');
}

function construirEncabezadoNegocio(infoNegocio) {
  const iconoActivo =
    infoNegocio.iconoTicket ||
    (infoNegocio.mostrarCamionTicket === false ? 'ninguno' : 'camion_volteo');
  return `
    <div class="ticket-header">
      ${iconoActivo !== 'ninguno' ? obtenerSvgIlustracion(iconoActivo) : ''}
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

const ETIQUETAS_TIPO_PAGO_TICKET = {
  ANTICIPO: 'Anticipo',
  ABONO: 'Abono',
  LIQUIDACION: 'Liquidacion'
};

export function generarHtmlTicket58mm({
  venta,
  detalle,
  entrega = null,
  pagos = [],
  negocio
}) {
  const infoNegocio = negocio || {};
  const clienteNombre = entrega?.cliente_nombre || venta.cliente_nombre || '';
  const nombreAsignado = venta.nombre_pendiente || '';
  const clienteTelefono = entrega?.cliente_telefono || venta.cliente_telefono || '';
  const clienteDireccion = entrega?.direccion_entrega || venta.cliente_direccion || '';
  const referencias = entrega?.referencias || '';
  const nota = venta.nota_venta || entrega?.nota_entrega || '';

  const saldoPendiente = Number(venta.saldo_pendiente || 0);
  const esParcial =
    Boolean(Number(venta.es_pago_parcial)) ||
    venta.estado_pago === 'PENDIENTE' ||
    saldoPendiente > 0;
  const totalNum = Number(venta.total || 0);
  const montoPagado = esParcial ? Number(venta.monto_pagado || 0) : totalNum;

  const bandaEstadoPago = esParcial
    ? `<div class="ticket-doc-type">${
        saldoPendiente > 0 ? 'NOTA CON SALDO PENDIENTE' : 'NOTA LIQUIDADA'
      }</div>`
    : '';

  const bloqueClienteEntrega =
    venta.tipo_venta === 'CLIENTE' || clienteNombre || entrega || clienteTelefono
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

  const bloquePagos =
    esParcial && Array.isArray(pagos) && pagos.length > 0
      ? `
        <div class="ticket-divider"></div>
        <div class="ticket-meta">
          <div class="ticket-section-title">Pagos registrados</div>
          ${pagos
            .map(
              (p) => `
              <div class="ticket-meta-row">
                <span>${formatearFecha(p.fecha_pago)} ${escaparHtml(ETIQUETAS_TIPO_PAGO_TICKET[p.tipo] || p.tipo)}</span>
                <strong>${formatearMoneda(p.monto)}</strong>
              </div>
            `
            )
            .join('')}
        </div>
      `
      : '';

  const bloqueTotalesDetalle = esParcial
    ? `
        <div class="ticket-total-row">
          <span>Pagado:</span>
          <span>${formatearMoneda(montoPagado)}</span>
        </div>
        <div class="ticket-total-row ticket-grand-total">
          <span>${saldoPendiente > 0 ? 'SALDO PENDIENTE:' : 'SALDO RESTANTE:'}</span>
          <span>${formatearMoneda(saldoPendiente)}</span>
        </div>
        ${
          Number(venta.dinero_recibido) > 0
            ? `<div class="ticket-total-row">
                <span>Recibido (anticipo):</span>
                <span>${formatearMoneda(venta.dinero_recibido)}</span>
              </div>`
            : ''
        }
        ${
          Number(venta.cambio) > 0
            ? `<div class="ticket-total-row">
                <span>Cambio (anticipo):</span>
                <span>${formatearMoneda(venta.cambio)}</span>
              </div>`
            : ''
        }
      `
    : `
        <div class="ticket-total-row">
          <span>Recibido:</span>
          <span>${formatearMoneda(venta.dinero_recibido)}</span>
        </div>
        <div class="ticket-total-row">
          <span>Cambio:</span>
          <span>${formatearMoneda(venta.cambio)}</span>
        </div>
      `;

  return `
    <div class="ticket-58mm">
      ${construirEncabezadoNegocio(infoNegocio)}

      ${bandaEstadoPago}

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
        ${
          nombreAsignado
            ? `<div class="ticket-meta-row">
                <span>A nombre de:</span>
                <strong>${escaparHtml(nombreAsignado)}</strong>
              </div>`
            : ''
        }
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
        ${bloqueTotalesDetalle}
      </div>

      ${bloquePagos}

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
        ${escaparHtml(
          infoNegocio.mensajePresupuesto ||
            'Cotizacion informativa. No valido como comprobante de pago ni descuenta inventario. Precios sujetos a cambio sin previo aviso.'
        )}
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
  pagos = [],
  negocio,
  titulo = 'Comprobante de venta (58 mm)'
}) {
  const ticketHtml = generarHtmlTicket58mm({ venta, detalle, entrega, pagos, negocio });
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
