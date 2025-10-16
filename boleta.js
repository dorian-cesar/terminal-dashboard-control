const formulario = document.getElementById('formulario');
const barcodeInput = document.getElementById('barcodeIn');
const btnConsultar = document.getElementById('btnConsultar');
const btnLiberarImprimir = document.getElementById('btnLiberarImprimir');

//const urlServer = 'http://localhost'
const urlServer = 'https://andenes.terminal-calama.com'

const urlUpdate = urlServer + '/TerminalCalama/PHP/Boleta/save.php';
const urlStore = urlServer + '/TerminalCalama/PHP/Custodia/store.php';
const urlState = urlServer + '/TerminalCalama/PHP/Custodia/reload.php';
const urlLoad = urlServer + '/TerminalCalama/PHP/Boleta/load.php';

// ---- Reemplazo automático de '-' por '/' mientras escribe ----
barcodeInput.addEventListener('input', function (e) {
    // se reemplazan todos los guiones por slash y se eliminan espacios redundantes
    const cursorPos = this.selectionStart;
    this.value = this.value.replace(/-/g, '/').replace(/\s+/g, '');
    // Opcional: podríamos restaurar posición del cursor si es necesario
    try { this.setSelectionRange(cursorPos, cursorPos); } catch (e) { }
});

// ---- Manejo de "Consultar Ticket" ----
btnConsultar.addEventListener('click', function () {
    let barcodeTxt = barcodeInput.value.trim().replace(/-/g, '/');
    if (barcodeTxt === "") {
        alert("Por favor, ingrese un código de barras.");
        return;
    }
    consultarTicket(barcodeTxt);
});

// ---- Submit del formulario: libera y luego imprime ----
formulario.addEventListener('submit', (e) => {
    e.preventDefault();

    // proteger botón para evitar doble envío
    if (btnLiberarImprimir.disabled) return;
    btnLiberarImprimir.disabled = true;

    const id_caja = localStorage.getItem('id_caja');
    if (!id_caja) {
        alert('Por favor, primero debe abrir la caja antes de liberar un casillero.');
        btnLiberarImprimir.disabled = false;
        return;
    }

    // Normalizar barcode: reemplazar '-' por '/'
    const barcodeTxt = formulario.barcodeIn.value.trim().replace(/-/g, '/');

    // Separar ID y RUT (formato esperado: idcustodia/rut)
    const barcodeData = barcodeTxt.split('/');
    if (barcodeData.length !== 2) {
        alert("Código de barras inválido. El formato debe ser: idcustodia/rut");
        btnLiberarImprimir.disabled = false;
        return;
    }
    const idIn = barcodeData[0]; // ID de custodia
    const rutIn = barcodeData[1]; // RUT

    // Obtenemos la fecha y hora actual
    const dateAct = new Date();
    const horaStr = dateAct.getHours().toString().padStart(2, '0') + ':' +
        dateAct.getMinutes().toString().padStart(2, '0') + ':' +
        dateAct.getSeconds().toString().padStart(2, '0');
    const fechaStr = dateAct.toISOString().split('T')[0];

    // Llamar a la API para obtener los datos de la custodia
    traerDatos(idIn)
        .then(result => {
            if (!result || !result.fecha || !result.hora) {
                throw new Error("Este ticket ya fue procesado o inválido.");
            }

            if (result.estado === "Entregado") {
                throw new Error("El ticket ya ha sido escaneado anteriormente.");
            }

            const dateOld = new Date(result.fecha + 'T' + result.hora);
            const diffTime = Math.abs(dateAct - dateOld);
            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

            const valorBulto = getValorBulto(result.talla);
            if (valorBulto === 0) {
                throw new Error("Error: Talla no válida.");
            }

            const valorTotal = diffDays * valorBulto;

            const filasHTML = `
                <tr>
                    <td>Casillero</td>
                    <td style="text-align:right">${result.posicion || 'No especificado'}</td>
                </tr>
                <tr>
                    <td>Fecha de Entrada</td>
                    <td style="text-align:right">${result.fecha} ${result.hora}</td>
                </tr>
                <tr>
                    <td>Fecha de Salida</td>
                    <td style="text-align:right">${fechaStr} ${horaStr}</td>
                </tr>
                <tr>
                    <td>Tiempo Ocupado</td>
                    <td style="text-align:right">${diffDays} Días</td>
                </tr>
                <tr>
                    <td>Valor por Día</td>
                    <td style="text-align:right">$${valorBulto}</td>
                </tr>
                <tr>
                    <td>Valor Total</td>
                    <td style="text-align:right" id="valorTotal">$${Math.round(valorTotal)}</td>
                </tr>
                <tr>
                    <td>Talla</td>
                    <td style="text-align:right">${result.talla || 'No especificado'}</td>
                </tr>
            `;
            document.getElementById('tabla-body').innerHTML = filasHTML;

            // Preparar los datos para actualizar el registro
            const datos = {
                id: idIn,
                estado: "Entregado",
                hora: horaStr,
                fecha: fechaStr,
                valor: valorTotal,
                rut: rutIn,
                id_caja: id_caja
            };

            // Actualizar el registro en la base de datos y luego liberar casillero
            return callAPI(datos, urlUpdate).then(() => {
                console.log("Registro actualizado correctamente.");
                const casilla = result.posicion;
                if (casilla) {
                    return cargarEstado(casilla); // devuelve promesa
                }
                // si no hay casilla, resolvemos inmediatamente
                return Promise.resolve();
            });
        })
        .then(() => {
            // Si todo OK: imprimir comprobante y limpiar
            try {
                printComp();
            } catch (err) {
                console.error("Error al imprimir comprobante:", err);
            }
            alert("El ticket ha sido escaneado exitosamente y el casillero ha sido liberado.");
            formulario.reset();
        })
        .catch(err => {
            console.error(err.message || err);
            alert(err.message || "El ticket ya ha sido escaneado anteriormente o es inválido.");
        })
        .finally(() => {
            btnLiberarImprimir.disabled = false;
        });
});


async function traerDatos(id) {
    let datos = await fetch(urlLoad, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(id)
    })
        .then(response => response.json())
        .then(result => {
            return result;
        })
        .catch(error => {
            console.error('Error obteniendo datos: ', error);
        });
    return datos;
}

// Función para enviar datos a la API
async function callAPI(datos, url) {
    let id = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
    })
        .then(response => response.json())
        .then(result => {
            console.log('Respuesta del servidor: ', result);
            return result;
        })
        .catch(error => {
            console.error('Error al enviar la solicitud: ', error);
        });
    return id;
}

async function cargarEstado(casilla) {
    try {
        let response = await fetch(urlState);
        let data = await response.json();

        if (!data || data.length === 0) {
            console.error('No se encontró información de estado.');
            return;
        }

        let estadoLista = JSON.parse(data[0].estado || '[]');

        const index = estadoLista.indexOf(casilla);
        if (index > -1) {
            estadoLista.splice(index, 1);
        } else {
            console.warn(`Casillero ${casilla} no estaba bloqueado.`);
        }

        const dateAct = new Date();
        const horaStr = dateAct.getHours().toString().padStart(2, '0') + ':' +
            dateAct.getMinutes().toString().padStart(2, '0') + ':' +
            dateAct.getSeconds().toString().padStart(2, '0');
        const fechaStr = dateAct.toISOString().split('T')[0];

        const datos = {
            estado: JSON.stringify(estadoLista),
            hora: horaStr,
            fecha: fechaStr,
        };

        await callAPI(datos, urlStore);
        console.log(`Estado actualizado: Casillero ${casilla} desbloqueado.`);

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        throw error;
    }
}

function printBol() {
    const valorTotal = parseFloat(document.querySelector('#valorTotal').textContent.replace('$', '').trim());

    if (!valorTotal || isNaN(valorTotal)) {
        console.error("El valor total no es válido para el servicio:", "Custodia");
        return;
    }

    let servicio = "Custodia";

    let payload = {
        "codigoEmpresa": "89",
        "tipoDocumento": "39",
        "total": valorTotal.toString(),
        "detalleBoleta": `53-${valorTotal}-1-dsa-${servicio}`
    };

    console.log("Payload preparado para el envío:", payload);

    $.ajax({
        url: "https://qa.pullman.cl/srv-dte-web/rest/emisionDocumentoElectronico/generarDocumento",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(payload),
        beforeSend: function () {
            console.log("Iniciando conexión con el servidor...");
        },
        success: function (response) {
            try {
                console.log("Respuesta recibida:", response);

                if (response.respuesta === "OK") {
                    let pdfUrl = response.rutaAcepta;

                    const ventanaImpr = window.open(pdfUrl, '_blank');
                    if (!ventanaImpr) {
                        alert("Por favor, habilite las ventanas emergentes para visualizar el PDF.");
                    } else {
                        console.log("PDF abierto en nueva ventana:", pdfUrl);
                    }
                } else {
                    console.error("Error al generar la boleta:", response);
                    alert("Error al generar la boleta.");
                }
            } catch (error) {
                console.error("Error al procesar la respuesta:", error);
                alert("Error inesperado. Consulte la consola para más detalles.");
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("Error en la solicitud AJAX:", textStatus, errorThrown);
            alert("Error en la comunicación con el servidor.");
        },
        complete: function () {
            console.log("Conexión con el servidor finalizada.");
        }
    });
}

const consultarTicket = (barcodeTxt) => {
    // barcodeTxt ya viene normalizado desde quien lo llame (reemplazo hecho)
    const barcodeData = barcodeTxt.split('/');
    if (barcodeData.length !== 2) {
        alert("Código de barras inválido.");
        return;
    }
    const idIn = barcodeData[0];
    const rutIn = barcodeData[1];

    const dateAct = new Date();
    const horaStr = dateAct.getHours().toString().padStart(2, '0') + ':' +
        dateAct.getMinutes().toString().padStart(2, '0') + ':' +
        dateAct.getSeconds().toString().padStart(2, '0');
    const fechaStr = dateAct.toISOString().split('T')[0];

    traerDatos(idIn)
        .then(result => {
            if (!result || !result.fecha || !result.hora) {
                throw new Error("El ticket ya ha sido escaneado anteriormente o es inválido.");
            }

            if (result.estado === "Entregado") {
                throw new Error("El ticket ya ha sido marcado como entregado.");
            }

            const dateOld = new Date(result.fecha + 'T' + result.hora);
            const diffTime = Math.abs(dateAct - dateOld);
            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

            const valorBulto = getValorBulto(result.talla);
            if (valorBulto === 0) {
                throw new Error("Error: Talla no válida.");
            }

            let valorTotal = diffDays * valorBulto;

            const filasHTML = `
                <tr>
                    <td>Casillero</td>
                    <td style="text-align:right">${result.posicion || 'No especificado'}</td>
                </tr>
                <tr>
                    <td>Fecha de Entrada</td>
                    <td style="text-align:right">${result.fecha} ${result.hora}</td>
                </tr>
                <tr>
                    <td>Fecha de Salida</td>
                    <td style="text-align:right">${fechaStr} ${horaStr}</td>
                </tr>
                <tr>
                    <td>Tiempo Ocupado</td>
                    <td style="text-align:right">${diffDays} Días</td>
                </tr>
                <tr>
                    <td>Valor por Día</td>
                    <td style="text-align:right">$${valorBulto}</td>
                </tr>
                <tr>
                    <td>Valor Total</td>
                    <td style="text-align:right">$${Math.round(valorTotal)}</td>
                </tr>
                <tr>
                    <td>Talla</td>
                    <td style="text-align:right">${result.talla || 'No especificado'}</td>
                </tr>
            `;
            document.getElementById('tabla-body').innerHTML = filasHTML;
        })
        .catch(err => {
            console.error(err.message);
            alert(err.message || "Error al consultar el ticket.");
        });
};

// Mantengo la función printComp (la misma que tenías), la llamamos desde el submit
function printComp() {
    // Normalizar y obtener barcode (id/rut) desde el input
    const rawBarcode = (barcodeInput && barcodeInput.value) ? barcodeInput.value.trim().replace(/-/g, '/') : '';
    // Datos visibles en el comprobante tomados de la tabla (si existen)
    const casillero = document.querySelector('#tabla-body tr:nth-child(1) td:nth-child(2)')?.innerText || '';
    const fechaEntrada = document.querySelector('#tabla-body tr:nth-child(2) td:nth-child(2)')?.innerText || '';
    const fechaSalida = document.querySelector('#tabla-body tr:nth-child(3) td:nth-child(2)')?.innerText || '';
    const tiempoOcupado = document.querySelector('#tabla-body tr:nth-child(4) td:nth-child(2)')?.innerText || '';
    const valorPorDia = document.querySelector('#tabla-body tr:nth-child(5) td:nth-child(2)')?.innerText || '';
    const valorTotal = document.querySelector('#tabla-body tr:nth-child(6) td:nth-child(2)')?.innerText || '';
    const talla = document.querySelector('#tabla-body tr:nth-child(7) td:nth-child(2)')?.innerText || '';

    // Si no hay barcode, pedir confirmación antes de imprimir sin él
    if (!rawBarcode) {
        if (!confirm('No se detectó el código (id/rut). ¿Deseas imprimir el comprobante sin código de barras?')) return;
    }

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
    @page { margin: 4mm; }
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 6mm;
        text-align: center;
    }
    .ticket { width: 100%; padding: 4px 0; page-break-after: avoid; }
    h1 { font-size: 12px; margin: 0; }
    .datetime { font-size: 10px; margin: 4px 0 8px; }
    .left { text-align: left; padding: 0 6mm; font-size: 11px; }
    .line { border-bottom: 1px dashed #000; margin: 8px 0; }
    svg { max-width: 100%; height: auto; display: block; margin: 6px auto; }
    .total { font-weight: bold; font-size: 13px; margin-top: 6px; }
</style>
</head>
<body>
    <div class="ticket">
        <h1>Terminal Calama</h1>
        <div class="datetime">${fechaStr} ${horaStr}</div>
        <div class="left">
            <div><strong>Casillero:</strong> ${casillero}</div>
            <div><strong>Entrada:</strong> ${fechaEntrada}</div>
            <div><strong>Salida:</strong> ${fechaSalida}</div>
            <div><strong>Tiempo:</strong> ${tiempoOcupado}</div>
            <div class="line"></div>
            <div><strong>Valor/día:</strong> ${valorPorDia}</div>
            <div><strong>Talla:</strong> ${talla}</div>
            <div class="line"></div>
            <div class="total">TOTAL: ${valorTotal}</div>
        </div>
        <div id="barcode-wrap" style="margin-top:8px;">
            <svg id="barcode"></svg>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
        (function() {
            try {
                const data = ${JSON.stringify(rawBarcode)};
                if (data) {
                    try {
                        JsBarcode("#barcode", data, { format: "CODE128", displayValue: true, width: 2, height: 50, margin: 10 });
                    } catch (e) {
                        console.warn('JsBarcode error', e);
                        document.getElementById('barcode-wrap').innerHTML = '<div style="font-size:10px;">'+data+'</div>';
                    }
                } else {
                    // No hay barcode: eliminar SVG y mostrar texto
                    document.getElementById('barcode-wrap').innerHTML = '<div style="font-size:12px;">No hay código disponible</div>';
                }
            } catch (err) {
                console.error('print window init error', err);
            }

            // Esperar un poco para que el SVG se renderice, luego imprimir y cerrar
            setTimeout(() => {
                try { window.focus(); window.print(); } catch (e) { console.error('print error', e); }
                setTimeout(() => { try { window.close(); } catch(e){} }, 800);
            }, 350);
        })();
    </script>
</body>
</html>
`;

    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) {
        alert('Permite popups en tu navegador para poder imprimir.');
        return;
    }
    win.document.open();
    win.document.write(printContent);
    win.document.close();
}

