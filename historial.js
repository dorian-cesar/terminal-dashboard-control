(() => {
    const urlServer = 'https://andenes.terminal-calama.com';
    const urlLoad = urlServer + '/TerminalCalama/PHP/Custodia/load.php';

    function actualizarTabla() {
        const tablaBody = document.getElementById('tabla-body');
        if (!tablaBody) return;
        fetch(urlLoad)
            .then(res => res.json())
            .then(data => {
                const filasHTML = data.map(item => `
            <tr>
              <td>${item.idcustodia}/${item.rut}</td>
              <td>${item.posicion}</td>
              <td>${item.rut}</td>
              <td>${item.fecha} ${item.hora}</td>
              <td>${item.fechasal !== '0000-00-00' ? item.fechasal : ''} ${item.horasal !== '00:00:00' ? item.horasal : ''}</td>
              <td>${item.talla}</td>
              <td>${item.tipo}</td>
              <td>${item.valor > 0 ? item.valor : ''}</td>
            </tr>
          `).join('');
                tablaBody.innerHTML = filasHTML;
                // Opcional: inicializar DataTables (si lo quieres)
                // if (typeof $ !== 'undefined' && $.fn.dataTable) $('#tabla-historial').DataTable();
            })
            .catch(err => console.error('actualizarTabla error', err));
    }

    function aplicarFiltros() {
        const tablaBody = document.getElementById('tabla-body');
        if (!tablaBody) return;
        const rutBusqueda = document.getElementById('buscador-rut')?.value?.toLowerCase() || '';
        const tipoFiltro = document.getElementById('filtro-tipo')?.value || '';
        const tallaFiltro = document.getElementById('filtro-talla')?.value || '';

        fetch(urlLoad).then(r => r.json()).then(data => {
            const datosFiltrados = data.filter(item => {
                const rutMatch = item.rut.toLowerCase().includes(rutBusqueda);
                const tipoMatch = tipoFiltro ? item.tipo === tipoFiltro : true;
                const tallaMatch = tallaFiltro ? item.talla === tallaFiltro : true;
                return rutMatch && tipoMatch && tallaMatch;
            });
            tablaBody.innerHTML = datosFiltrados.map(item => `
          <tr>
            <td>${item.idcustodia}/${item.rut}</td>
            <td>${item.posicion}</td>
            <td>${item.rut}</td>
            <td>${item.fecha} ${item.hora}</td>
            <td>${item.fechasal !== '0000-00-00' ? item.fechasal : ''} ${item.horasal !== '00:00:00' ? item.horasal : ''}</td>
            <td>${item.talla}</td>
            <td>${item.tipo}</td>
            <td>${item.valor > 0 ? item.valor : ''}</td>
          </tr>
        `).join('');
        }).catch(err => console.error(err));
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('tabla-body')) actualizarTabla();
        const boton = document.getElementById('boton-filtrar');
        if (boton) boton.addEventListener('click', aplicarFiltros);
    });

    // exporta para depuración o uso desde consola
    window.custodiaHist = { actualizarTabla, aplicarFiltros };
})();
