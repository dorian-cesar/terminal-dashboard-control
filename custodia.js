(() => {
    // Config
    const urlServer = 'https://andenes.terminal-calama.com';
    const urlSave = urlServer + '/TerminalCalama/PHP/Custodia/save.php';
    const urlLoad = urlServer + '/TerminalCalama/PHP/Custodia/load.php';
    const urlStore = urlServer + '/TerminalCalama/PHP/Custodia/store.php';
    const urlState = urlServer + '/TerminalCalama/PHP/Custodia/reload.php';

    // Utilidades
    async function callAPI(datos, url) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            return await res.json();
        } catch (err) {
            console.error('callAPI error', err);
            return null;
        }
    }

    function getLetterFromNumber(num) {
        if (num > 25) { num += 6; }
        return String.fromCharCode(65 + num);
    }

    // Print (puedes reemplazar por la versión optimizada si quieres)
    function printBarcode() {
        setTimeout(() => {
            const barcodeElement = document.getElementById('barcode');
            if (!barcodeElement) { console.error("barcode not found"); return; }
            const barcodeSVG = barcodeElement.outerHTML;
            const dateAct = new Date();
            const horaStr = dateAct.getHours().toString().padStart(2, '0') + ':' +
                dateAct.getMinutes().toString().padStart(2, '0') + ':' +
                dateAct.getSeconds().toString().padStart(2, '0');
            const fechaStr = dateAct.toISOString().split('T')[0];

            const printContent = `
                <!doctype html>
                <html>

                <head>
                    <meta charset="utf-8">
                    <title>Imprimir</title>
                    <style>
                        @page {
                            margin: 4mm;
                        }

                        body {
                            font-family: Arial;
                            margin: 0;
                            padding: 6mm;
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            gap: 3cm;
                        }

                        .ticket {
                            width: 100%;
                            padding: 4px 0;
                            page-break-after: avoid;
                        }

                        svg {
                            max-width: 100%;
                            height: auto;
                        }
                    </style>
                </head>

                <body>
                    <div class="ticket">
                        <h1 style="font-size:12px;margin:0">Ticket de Recepción</h1>
                        <div style="font-size:10px;margin:2px 0">${fechaStr} ${horaStr}</div>
                        ${barcodeSVG}
                    </div>
                    <div class="ticket">
                        <h1 style="font-size:12px;margin:0">Ticket de Recepción</h1>
                        <div style="font-size:10px;margin:2px 0">${fechaStr} ${horaStr}</div>
                        ${barcodeSVG}
                    </div>
                </body>

                </html>
        `;

            const win = window.open('', '_blank', 'width=400,height=600');
            if (!win) { alert('Permite popups para imprimir'); return; }
            win.document.open();
            win.document.write(printContent);
            win.document.close();
            win.onload = () => { setTimeout(() => { win.print(); setTimeout(() => win.close(), 800); }, 300); };
        }, 100);
    }

    // Inicializadores
    function initMatriz(matCont) {
        const matX = 8, matY = 6;
        // Evita recrear si ya hay contenido
        if (matCont.querySelector('.casilla')) return;
        for (let i = 0; i < matY; i++) {
            for (let j = 0; j < matX; j++) {
                const letra = getLetterFromNumber(j);
                const btn = document.createElement('button');
                btn.className = 'casilla';
                btn.id = 'lockerbtn' + i + letra;
                btn.textContent = `${i},${letra}`;
                btn.type = 'button';
                btn.addEventListener('click', () => toggleButton(btn));
                matCont.appendChild(btn);
            }
        }
    }

    function initFormHandlers(formulario, contBarcode) {
        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const casillaStr = formulario.casillero?.value?.trim() || '';
            const rutStr = document.getElementById('rut')?.value?.trim() || '';
            if (!casillaStr || !rutStr) { alert('Seleccione casilla e ingrese RUT'); return; }
            const bultoStr = document.getElementById('bulto')?.value;
            if (!bultoStr) { alert('Seleccione un tamaño para el bulto'); return; }
            const id_caja = localStorage.getItem('id_caja');
            if (!id_caja) { alert('Por favor, primero debe abrir la caja antes de generar un código de barras.'); return; }
            const dateAct = new Date();
            const horaStr = `${dateAct.getHours()}:${dateAct.getMinutes()}:${dateAct.getSeconds()}`;
            const fechaStr = dateAct.toISOString().split('T')[0];
            const btnGenerar = document.getElementById('generar');
            if (btnGenerar) { btnGenerar.disabled = true; btnGenerar.classList.add('disabled'); }

            try {
                const datos = { hora: horaStr, fecha: fechaStr, casilla: casillaStr, rut: rutStr, bulto: bultoStr, tipo: 'Ingresado', id_caja: id_caja };
                const result = await callAPI(datos, urlSave);
                const barcodeData = `${result}/${rutStr}`;

                // copiar al clipboard (no bloquear si falla)
                try { await navigator.clipboard.writeText(barcodeData); } catch (_) { }

                if (contBarcode) {
                    contBarcode.innerHTML = `<svg id="barcode"></svg>`;
                    try {
                        JsBarcode("#barcode", barcodeData, { format: "CODE128", displayValue: true, width: 2, height: 50, margin: 10 });
                    } catch (e) { console.warn('JsBarcode error', e); }
                }

                // refrescar tabla/estado
                actualizarTabla();
                formulario.casillero && (formulario.casillero.value = '');
                guardarEstado();
                printBarcode();
            } catch (err) {
                console.error(err);
                alert('Ocurrió un error al procesar los datos.');
            } finally {
                if (btnGenerar) { btnGenerar.disabled = false; btnGenerar.classList.remove('disabled'); }
            }
        });
    }

    // Toggle casilla (usa formulario si existe)
    function toggleButton(btn) {
        const btns = document.querySelectorAll('.casilla');
        btns.forEach(bt => bt.classList.remove('active'));
        if (!btn.classList.contains('disabled')) {
            btn.classList.toggle('active');
            const formulario = document.getElementById('formulario');
            if (formulario && formulario.casillero) {
                formulario.casillero.value = btn.classList.contains('active') ? btn.textContent : '';
            }
        } else {
            const formulario = document.getElementById('formulario');
            if (formulario && formulario.casillero) formulario.casillero.value = '';
        }
    }

    // Estado - cargar/guardar
    function cargarEstado() {
        fetch(urlState)
            .then(r => r.json())
            .then(data => {
                const raw = data.map(item => item.estado)[0];
                if (!raw) return;
                let est;
                try { est = JSON.parse(raw); } catch (e) { console.error('estado parse error', e); return; }
                const formulario = document.getElementById('formulario');
                if (formulario && formulario.casillero) formulario.casillero.value = '';
                est.forEach(estado => {
                    const btn = document.getElementById('lockerbtn' + estado.replace(',', ''));
                    if (btn) { btn.classList.add('disabled'); btn.classList.remove('active'); }
                });
            })
            .catch(err => console.error('cargarEstado', err));
    }

    function guardarEstado() {
        const estadoObj = [];
        const btns = document.querySelectorAll('.casilla');
        btns.forEach(btn => {
            if (btn.classList.contains('active') || btn.classList.contains('disabled')) estadoObj.push(btn.textContent);
            if (btn.classList.contains('active')) { btn.classList.add('disabled'); btn.classList.remove('active'); }
        });
        const dateAct = new Date();
        const horaStr = `${dateAct.getHours()}:${dateAct.getMinutes()};${dateAct.getSeconds()}`;
        const fechaStr = dateAct.toISOString().split('T')[0];
        callAPI({ estado: JSON.stringify(estadoObj), hora: horaStr, fecha: fechaStr }, urlStore);
    }

    // Tabla (lee del mismo endpoint)
    function actualizarTabla() {
        const tablaBody = document.getElementById('tabla-body');
        if (!tablaBody) return;
        fetch(urlLoad)
            .then(r => r.json())
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
            })
            .catch(err => console.error('actualizarTabla', err));
    }

    // reactivar botón (entregar)
    function reactivarBoton(btn) {
        const fechaHoraAct = new Date();
        const horaStr = `${fechaHoraAct.getHours()}:${fechaHoraAct.getMinutes()}:${fechaHoraAct.getSeconds()}`;
        const fechaStr = fechaHoraAct.toISOString().split('T')[0];
        const posStr = btn.textContent;
        const datos = { hora: horaStr, fecha: fechaStr, casilla: posStr, rut: "-", bulto: "-", tipo: "Entregado" };
        callAPI(datos, urlSave).then(() => { actualizarTabla(); guardarEstado(); });
    }

    // DOMContentLoaded - inicializa solo cuando existan elementos
    document.addEventListener('DOMContentLoaded', () => {
        const matCont = document.getElementById('matriz');
        const formulario = document.getElementById('formulario');
        const contBarcode = document.getElementById('contBarcode');
        const selectBulto = document.getElementById('bulto');

        // inicializar JsBarcode placeholder solo si existe elemento
        if (document.getElementById('barcode') && typeof JsBarcode !== 'undefined') {
            try { JsBarcode("#barcode", "wit.la", { format: "CODE128", displayValue: true, width: 2, height: 50, margin: 10 }); }
            catch (e) { console.warn('JsBarcode init error', e); }
        }

        if (matCont) initMatriz(matCont);
        if (formulario) initFormHandlers(formulario, contBarcode);
        if (document.getElementById('tabla-body')) actualizarTabla();
        if (matCont) cargarEstado();

        // rellenar select bulto si existe y si existe valoresBulto
        if (selectBulto && typeof valoresBulto !== 'undefined') {
            selectBulto.innerHTML = '<option value="0" class="select-items selectClass">Seleccione</option>';
            for (const [t, v] of Object.entries(valoresBulto)) {
                const option = document.createElement('option');
                option.value = t;
                option.classList.add('select-items', 'selectClass');
                option.textContent = `Talla ${t} ($${v.toLocaleString()})`;
                selectBulto.appendChild(option);
            }
        }

        // listener de filtro (si existe)
        const botonFiltrar = document.getElementById('boton-filtrar');
        if (botonFiltrar) botonFiltrar.addEventListener('click', () => {
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
                const filasHTML = datosFiltrados.map(item => `
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
                const tablaBody = document.getElementById('tabla-body');
                if (tablaBody) tablaBody.innerHTML = filasHTML;
            }).catch(err => console.error(err));
        });
    });

    // exportar funciones al scope global si se necesitan (por ejemplo reactivar desde HTML)
    window.custodia = { reactivarBoton, actualizarTabla, guardarEstado, cargarEstado, printBarcode };
})();
