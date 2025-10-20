(() => {
  // const urlServer = 'https://andenes.terminal-calama.com';
  const urlServer = 'http://10.5.20.93';
  const urlLoad = urlServer + '/TerminalCalama/PHP/Custodia/load.php';
  const urlLoadRut = urlServer + '/TerminalCalama/PHP/Custodia/load_rut.php';

  // Fetch con manejo de errores
  function fetchData(url) {
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  // Asegura que siempre trabajamos con un array
  function ensureArray(data) {
    if (!data && data !== 0) return [];                  // null/undefined
    if (Array.isArray(data)) return data;                // ya es array
    if (Array.isArray(data.data)) return data.data;      // { data: [...] }
    // Si es un objeto con campos típicos de registro, lo devolvemos como array de 1 elemento
    if (typeof data === 'object') return [data];
    // Si llega otra cosa (string/number), lo envolvemos
    return [data];
  }

  // Detecta si el valor es "solo un RUT" en formato tipo 12345678k (o con puntos/guiones)
  function esSoloRut(valor) {
    if (!valor) return false;
    const v = valor.trim().toLowerCase();
    // Permite dígitos y una posible 'k' final; admite puntos y guiones en la entrada
    // Ejemplos válidos: 21748256 12.345.678-5 12345678k
    return /^[0-9.\-kK]+$/.test(v) && /[0-9]/.test(v);
  }

  // Limpia el rut manteniendo dígitos y k final (minúscula)
  function limpiarRutParaApi(valor) {
    if (!valor) return '';
    // quitar todo excepto dígitos y k/K, dejar en minúsculas
    return valor.replace(/[^0-9kK]/g, '').toLowerCase();
  }

  function urlSegunRutInput(rutInput) {
    const val = (rutInput || '').trim();
    if (esSoloRut(val)) {
      const cleaned = limpiarRutParaApi(val);
      return `${urlLoadRut}?rut=${encodeURIComponent(cleaned)}`;
    }
    return urlLoad;
  }

  function renderTabla(data) {
    const tablaBody = document.getElementById('tabla-body');
    if (!tablaBody) return;
    const arr = ensureArray(data);
    const filasHTML = arr.map(item => `
      <tr>
        <td>${item.idcustodia || ''}/${item.rut || ''}</td>
        <td>${item.posicion || ''}</td>
        <td>${item.rut || ''}</td>
        <td>${item.fecha || ''} ${item.hora || ''}</td>
        <td>${(item.fechasal && item.fechasal !== '0000-00-00') ? item.fechasal : ''} ${(item.horasal && item.horasal !== '00:00:00') ? item.horasal : ''}</td>
        <td>${item.talla || ''}</td>
        <td>${item.tipo || ''}</td>
        <td>${(item.valor && Number(item.valor) > 0) ? item.valor : ''}</td>
      </tr>
    `).join('');
    tablaBody.innerHTML = filasHTML;
  }

  function actualizarTabla() {
    const inputRut = document.getElementById('buscador-rut')?.value || '';
    const url = urlSegunRutInput(inputRut);
    console.debug('actualizarTabla -> url:', url);
    fetchData(url)
      .then(data => renderTabla(data))
      .catch(err => {
        console.error('actualizarTabla error', err);
      });
  }

  function aplicarFiltros() {
    const tablaBody = document.getElementById('tabla-body');
    if (!tablaBody) return;

    const rutBusqueda = document.getElementById('buscador-rut')?.value?.trim() || '';
    const tipoFiltro = document.getElementById('filtro-tipo')?.value || '';
    const tallaFiltro = document.getElementById('filtro-talla')?.value || '';

    const url = urlSegunRutInput(rutBusqueda);
    console.debug('aplicarFiltros -> url:', url, 'rutBusqueda:', rutBusqueda);

    fetchData(url).then(data => {
      let datos = ensureArray(data);

      // Si no se usó la API específica de rut (o el usuario puso texto libre), filtramos por coincidencias
      if (!esSoloRut(rutBusqueda) && rutBusqueda !== '') {
        const lower = rutBusqueda.toLowerCase();
        datos = datos.filter(item =>
          ((item.rut || '').toLowerCase().includes(lower)) ||
          ((item.posicion || '').toString().toLowerCase().includes(lower)) ||
          ((item.talla || '').toLowerCase().includes(lower)) ||
          ((item.tipo || '').toLowerCase().includes(lower))
        );
      }

      if (tipoFiltro) {
        datos = datos.filter(item => item.tipo === tipoFiltro);
      }
      if (tallaFiltro) {
        datos = datos.filter(item => item.talla === tallaFiltro);
      }

      renderTabla(datos);
    }).catch(err => {
      console.error('aplicarFiltros error', err);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tabla-body')) actualizarTabla();
    const boton = document.getElementById('boton-filtrar');
    if (boton) boton.addEventListener('click', aplicarFiltros);

    const buscador = document.getElementById('buscador-rut');
    if (buscador) {
      buscador.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicarFiltros();
        }
      });
    }
  });

  window.custodiaHist = { actualizarTabla, aplicarFiltros };
})();
