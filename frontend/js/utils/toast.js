export function mostrarToast(mensaje, tipo = 'success', duracionMs = 3800) {
  const contenedor = document.getElementById('toast-container');
  if (!contenedor) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, duracionMs);
}

