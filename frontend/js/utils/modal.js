import { escaparHtml } from './format.js';

const modalRoot = () => document.getElementById('modal-root');

let escapeListener = null;

export function cerrarModal() {
  const root = modalRoot();
  if (!root) {
    return;
  }
  root.classList.add('hidden');
  root.innerHTML = '';
  if (escapeListener) {
    document.removeEventListener('keydown', escapeListener);
    escapeListener = null;
  }
}

export function abrirModal({ titulo, contenidoHtml, footerHtml = '', size = '' }) {
  const root = modalRoot();
  if (!root) {
    return null;
  }

  const claseTamano = size ? `modal-${size}` : '';
  root.innerHTML = `
    <div class="modal-dialog ${claseTamano}">
      <div class="modal-header">
        <h3 class="modal-title">${escaparHtml(titulo)}</h3>
        <button type="button" class="btn btn-secondary btn-sm" data-modal-close>Cerrar</button>
      </div>
      <div class="modal-body">
        ${contenidoHtml}
      </div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;

  root.classList.remove('hidden');

  root.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', cerrarModal);
  });

  root.onclick = (event) => {
    if (event.target === root) {
      cerrarModal();
    }
  };

  if (escapeListener) {
    document.removeEventListener('keydown', escapeListener);
  }
  escapeListener = (event) => {
    if (event.key === 'Escape') {
      cerrarModal();
    }
  };
  document.addEventListener('keydown', escapeListener);

  return root;
}

export function confirmarAccion({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  tipoConfirmar = 'btn-danger'
}) {
  return new Promise((resolve) => {
    const root = abrirModal({
      titulo,
      size: 'sm',
      contenidoHtml: `<p style="margin:0;color:var(--text-secondary);">${escaparHtml(mensaje)}</p>`,
      footerHtml: `
        <button type="button" class="btn btn-secondary" id="btn-confirm-cancel">Cancelar</button>
        <button type="button" class="btn ${tipoConfirmar}" id="btn-confirm-accept">${escaparHtml(textoConfirmar)}</button>
      `
    });

    if (!root) {
      resolve(false);
      return;
    }

    const cancelar = () => {
      cerrarModal();
      resolve(false);
    };

    const aceptar = () => {
      cerrarModal();
      resolve(true);
    };

    root.querySelector('#btn-confirm-cancel')?.addEventListener('click', cancelar);
    root.querySelector('#btn-confirm-accept')?.addEventListener('click', aceptar);
    root.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => resolve(false));
    });
  });
}

