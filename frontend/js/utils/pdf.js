import { mostrarToast } from './toast.js';

function extraerNombreArchivo(cabecera, fallback) {
  if (!cabecera) {
    return fallback;
  }
  const matchUtf8 = cabecera.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (matchUtf8 && matchUtf8[1]) {
    try {
      return decodeURIComponent(matchUtf8[1].replace(/["']/g, '').trim());
    } catch {
      return fallback;
    }
  }
  const matchSimple = cabecera.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (matchSimple && matchSimple[1]) {
    return matchSimple[1].trim();
  }
  return fallback;
}

async function descargarArchivoPdf(url, nombreFallback, boton = null) {
  const textoOriginal = boton ? boton.textContent : '';
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Generando PDF...';
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf'
      }
    });

    if (!response.ok) {
      let mensaje = `No se pudo generar el PDF (codigo HTTP ${response.status}).`;
      try {
        const data = await response.json();
        if (data && data.error) {
          mensaje = data.error;
        }
      } catch {
        // Ignorar cuerpo no JSON
      }
      throw new Error(mensaje);
    }

    const blob = await response.blob();
    const nombreArchivo = extraerNombreArchivo(
      response.headers.get('Content-Disposition'),
      nombreFallback
    );

    const blobUrl = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = blobUrl;
    enlace.download = nombreArchivo;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    mostrarToast(`PDF descargado: ${nombreArchivo}`, 'success');
  } catch (error) {
    mostrarToast(error.message || 'No se pudo descargar el PDF.', 'error');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }
}

export function descargarNotaVentaPdf(ventaId, folio = '', boton = null) {
  const folioLimpio = String(folio || ventaId).replace(/[^A-Za-z0-9_-]/g, '');
  return descargarArchivoPdf(
    `/api/ventas/${ventaId}/pdf`,
    `Nota-${folioLimpio}.pdf`,
    boton
  );
}

export function descargarPresupuestoPdf(presupuestoId, folio = '', boton = null) {
  const folioLimpio = String(folio || presupuestoId).replace(/[^A-Za-z0-9_-]/g, '');
  return descargarArchivoPdf(
    `/api/presupuestos/${presupuestoId}/pdf`,
    `Presupuesto-${folioLimpio}.pdf`,
    boton
  );
}

