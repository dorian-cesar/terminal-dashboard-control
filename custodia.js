(() => {
    // Config
    const urlServer = 'https://andenes.terminal-calama.com';
    const urlSave = urlServer + '/TerminalCalama/PHP/Custodia/save.php';
    const urlLoad = urlServer + '/TerminalCalama/PHP/Custodia/load.php';
    const urlStore = urlServer + '/TerminalCalama/PHP/Custodia/store.php';
    const urlState = urlServer + '/TerminalCalama/PHP/Custodia/reload.php';
    const urlImpresion = 'http://10.5.20.105:3000/api/imprimir';

    //==================================== HELPERS =======================================
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

    async function operacionAtomica(datosGuardado, datosEstado) {
        try {
            // Paso 1: Guardar el registro
            const resultadoGuardado = await callAPI(datosGuardado, urlSave);
            if (!resultadoGuardado || resultadoGuardado.error) {
                throw new Error('Error al guardar el registro');
            }

            // Paso 2: Actualizar el estado de los casilleros
            const resultadoEstado = await callAPI(datosEstado, urlStore);
            if (!resultadoEstado || resultadoEstado.error) {
                throw new Error('Error al actualizar el estado');
            }

            // Si ambos fueron exitosos, retornar el resultado del guardado
            return resultadoGuardado;

        } catch (error) {
            console.error('Operación atómica falló:', error);
            throw error; // Re-lanzar el error para manejarlo arriba
        }
    }

    //==================================== PDF CON JSPDF ================================
    // Cargar jsPDF desde CDN dinámicamente
    function cargarJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jsPDF) {
                resolve(window.jsPDF);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => resolve(window.jsPDF);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function generarPDFConJsPDF(datosTicket) {
        return new Promise(async (resolve, reject) => {
            try {
                // Verificar si jsPDF está disponible
                if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                    // Cargar jsPDF dinámicamente
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    script.onload = () => {
                        // Dar tiempo para que cargue
                        setTimeout(() => crearPDF(), 100);
                    };
                    script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
                    document.head.appendChild(script);
                } else {
                    crearPDF();
                }

                function crearPDF() {
                    try {
                        // Usar la versión disponible
                        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;

                        if (!jsPDF) {
                            reject(new Error('jsPDF no disponible'));
                            return;
                        }

                        const pdf = new jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: [58, 80]
                        });

                        // Contenido simple del ticket
                        let y = 5;

                        // Título
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(10);
                        pdf.text('TICKET DE RECEPCIÓN', 29, y, { align: 'center' });
                        y += 6;

                        // Información
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(8);
                        pdf.text(`Fecha: ${datosTicket.fecha} ${datosTicket.hora}`, 3, y);
                        y += 4;
                        pdf.text(`Casillero: ${datosTicket.casilla}`, 3, y);
                        y += 4;
                        pdf.text(`Tamaño: ${datosTicket.bulto}`, 3, y);
                        y += 4;
                        pdf.text(`RUT: ${datosTicket.rut}`, 3, y);
                        y += 6;

                        // Generar barcode en canvas offscreen y convertir a dataURL
                        try {
                            // Crear canvas temporal
                            const canvas = document.createElement('canvas');
                            // Ajusta el ancho/alto en px según la calidad que necesites
                            // width (px) se calcula a partir de tus parámetros de JsBarcode (width * numberOfBars)
                            // Aquí dejamos un tamaño suficientemente grande para buena resolución
                            canvas.width = 600;
                            canvas.height = 200;

                            // Usar JsBarcode para dibujar en el canvas (no en SVG)
                            // displayValue: false porque ya imprimimos el texto debajo o lo manejas aparte
                            JsBarcode(canvas, datosTicket.codigoBarras, {
                                format: "CODE128",
                                displayValue: false,
                                width: 2,
                                height: 80,
                                margin: 10
                            });

                            const imageData = canvas.toDataURL('image/png');

                            // Añadir la imagen al PDF
                            // en un papel de 58mm de ancho dejamos margen: x=3, width=52mm
                            // la altura la ajustamos proporcionalmente (ej: 18mm); ajusta si lo ves pequeño/grande
                            const imgX = 3;
                            const imgW = 52;
                            const imgH = 16;
                            pdf.addImage(imageData, 'PNG', imgX, y, imgW, imgH);

                            // Avanzar y escribir el texto del código (opcional)
                            y += imgH + 3;
                            pdf.setFont('courier', 'bold');
                            pdf.setFontSize(10);
                            pdf.text('CÓDIGO:', 3, y);
                            y += 3;
                            pdf.text(datosTicket.codigoBarras, 3, y);
                            y += 8;

                        } catch (imgErr) {
                            // Si algo falla generando la imagen, caemos a la versión solo texto
                            console.warn('No se pudo renderizar imagen del barcode, se añadirá solo texto', imgErr);
                            pdf.setFont('courier', 'bold');
                            pdf.setFontSize(10);
                            pdf.text('CÓDIGO:', 3, y);
                            y += 3;
                            pdf.text(datosTicket.codigoBarras, 3, y);
                            y += 8;
                        }

                        resolve(pdf);

                    } catch (error) {
                        reject(error);
                    }
                }


            } catch (error) {
                reject(error);
            }
        });
    }

    async function enviarPdfAlServidor(pdf, filename = 'ticket.pdf', printer = '') {
        try {
            // Convertir PDF a base64
            const pdfBlob = pdf.output('blob');
            const base64pdf = await blobToBase64NoPrefix(pdfBlob);

            const payload = {
                pdfData: base64pdf,
                printer: printer || undefined,
                filename: filename
            };

            const res = await fetch(urlImpresion, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
            }

            const json = await res.json().catch(() => ({}));
            console.log('Impresión enviada OK:', json);
            return json;
        } catch (err) {
            console.error('Error enviando PDF al servidor:', err);
            throw err;
        }
    }

    function blobToBase64NoPrefix(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }


    //==================================== UI ============================================
    function initMatriz(matCont) {
        const matX = 8, matY = 6;
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

    async function initFormHandlers(formulario, contBarcode) {
        formulario.addEventListener('submit', async (e) => {
            e.preventDefault();

            const casillaStr = formulario.casillero?.value?.trim() || '';
            const rutStr = document.getElementById('rut')?.value?.trim() || '';
            if (!casillaStr || !rutStr) {
                alert('Seleccione casilla e ingrese RUT');
                return;
            }

            const bultoStr = document.getElementById('bulto')?.value;
            if (!bultoStr) {
                alert('Seleccione un tamaño para el bulto');
                return;
            }

            const id_caja = localStorage.getItem('id_caja');
            if (!id_caja) {
                alert('Por favor, primero debe abrir la caja antes de ocupar un casillero.');
                return;
            }

            const dateAct = new Date();
            const horaStr = `${dateAct.getHours().toString().padStart(2, '0')}:${dateAct.getMinutes().toString().padStart(2, '0')}:${dateAct.getSeconds().toString().padStart(2, '0')}`;
            const fechaStr = dateAct.toISOString().split('T')[0];

            const btnGenerar = document.getElementById('generar');
            if (btnGenerar) {
                btnGenerar.disabled = true;
                btnGenerar.classList.add('disabled');
            }

            try {
                const datosGuardado = {
                    hora: horaStr,
                    fecha: fechaStr,
                    casilla: casillaStr,
                    rut: rutStr,
                    bulto: bultoStr,
                    tipo: 'Ingresado',
                    id_caja: id_caja
                };

                const estadoActual = await obtenerEstadoActual();
                estadoActual.push(casillaStr);
                const datosEstado = {
                    estado: JSON.stringify(estadoActual),
                    hora: horaStr,
                    fecha: fechaStr
                };

                // Ejecutar operación atómica
                const result = await operacionAtomica(datosGuardado, datosEstado);
                const barcodeData = `${result}/${rutStr}`;

                // Si llegamos aquí, ambas operaciones fueron exitosas


                try {
                    await navigator.clipboard.writeText(barcodeData);
                } catch (_) { }


                if (contBarcode) {
                    contBarcode.innerHTML = `<svg id="barcode"></svg>`;
                    try {
                        JsBarcode("#barcode", barcodeData, {
                            format: "CODE128",
                            displayValue: true,
                            width: 2,
                            height: 50,
                            margin: 10
                        });
                    } catch (e) {
                        console.warn('JsBarcode error', e);
                    }
                }

                // Generar e imprimir PDF
                try {
                    const datosTicket = {
                        fecha: fechaStr,
                        hora: horaStr,
                        casilla: casillaStr,
                        bulto: bultoStr,
                        rut: rutStr,
                        codigoBarras: barcodeData
                    };

                    console.log('Generando PDF con datos:', datosTicket);
                    const pdf = await generarPDFConJsPDF(datosTicket);
                    const filename = `ticket_${casillaStr}_${fechaStr}.pdf`;
                    await enviarPdfAlServidor(pdf, filename, '');
                    await enviarPdfAlServidor(pdf, filename, '');

                    console.log('PDF generado e enviado exitosamente');
                    alert('Ticket generado e impreso correctamente');

                } catch (err) {
                    console.error('Error generando/enviando PDF:', err);
                    // Fallback: usar html2pdf si jsPDF falla
                    await fallbackConHtml2PDF(barcodeData, datosTicket);
                    await fallbackConHtml2PDF(barcodeData, datosTicket);
                }


                actualizarTabla();
                actualizarEstadoFrontend();

                if (formulario.casillero) {
                    formulario.casillero.value = '';
                }

            } catch (err) {
                console.error('Error general en operación atómica:', err);
                alert('Ocurrió un error al procesar los datos. No se guardó ningún cambio.');
            } finally {
                if (btnGenerar) {
                    btnGenerar.disabled = false;
                    btnGenerar.classList.remove('disabled');
                }
            }
        });
    }

    async function obtenerEstadoActual() {
        try {
            const response = await fetch(urlState);
            const data = await response.json();
            const raw = data.map(item => item.estado)[0];
            if (!raw) return [];

            let estadoActual;
            try {
                estadoActual = JSON.parse(raw);
            } catch (e) {
                console.error('Error parseando estado actual', e);
                return [];
            }

            return Array.isArray(estadoActual) ? estadoActual : [];
        } catch (err) {
            console.error('Error obteniendo estado actual:', err);
            return [];
        }
    }

    function actualizarEstadoFrontend() {
        const btns = document.querySelectorAll('.casilla');
        btns.forEach(btn => {
            btn.classList.remove('disabled', 'active');
        });

        cargarEstado();
    }

    async function fallbackConHtml2PDF(barcodeData, datosTicket) {
        try {
            const element = document.createElement('div');
            element.innerHTML = `
                <div style="width:58mm;padding:5mm;font-family:Arial;text-align:center;">
                    <h3 style="margin:0 0 3mm 0;">TICKET DE RECEPCIÓN</h3>
                    <p style="margin:1mm 0;font-size:10px;">${datosTicket.fecha} ${datosTicket.hora}</p>
                    <p style="margin:1mm 0;font-size:10px;">Casillero: ${datosTicket.casilla}</p>
                    <p style="margin:1mm 0;font-size:10px;">Tamaño: ${datosTicket.bulto}</p>
                    <p style="margin:1mm 0;font-size:10px;">RUT: ${datosTicket.rut}</p>
                    <p style="margin:3mm 0 1mm 0;font-size:11px;font-weight:bold;">CÓDIGO:</p>
                    <p style="margin:0 0 3mm 0;font-family:monospace;font-size:10px;">${barcodeData}</p>
                </div>
            `;

            const opt = {
                margin: 0,
                filename: `ticket_${datosTicket.casilla}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: [58, 80], orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
            const base64pdf = await blobToBase64NoPrefix(pdfBlob);
            await enviarPdfAlServidorBase64(base64pdf, `ticket_${datosTicket.casilla}.pdf`, '');
            await enviarPdfAlServidorBase64(base64pdf, `ticket_${datosTicket.casilla}.pdf`, '');

        } catch (fallbackError) {
            console.error('Fallback también falló:', fallbackError);
            throw fallbackError;
        }
    }

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
            if (formulario && formulario.casillero) {
                formulario.casillero.value = '';
            }
        }
    }

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

    function reactivarBoton(btn) {
        const fechaHoraAct = new Date();
        const horaStr = `${fechaHoraAct.getHours()}:${fechaHoraAct.getMinutes()}:${fechaHoraAct.getSeconds()}`;
        const fechaStr = fechaHoraAct.toISOString().split('T')[0];
        const posStr = btn.textContent;
        const datos = { hora: horaStr, fecha: fechaStr, casilla: posStr, rut: "-", bulto: "-", tipo: "Entregado" };
        callAPI(datos, urlSave).then(() => { actualizarTabla(); guardarEstado(); });
    }

    //==================================== DOM ===========================================
    document.addEventListener('DOMContentLoaded', () => {
        const matCont = document.getElementById('matriz');
        const formulario = document.getElementById('formulario');
        const contBarcode = document.getElementById('contBarcode');

        // Inicializar JsBarcode placeholder
        if (document.getElementById('barcode') && typeof JsBarcode !== 'undefined') {
            try {
                JsBarcode("#barcode", "wit.la", {
                    format: "CODE128",
                    displayValue: true,
                    width: 2,
                    height: 50,
                    margin: 10
                });
            } catch (e) {
                console.warn('JsBarcode init error', e);
            }
        }

        if (matCont) initMatriz(matCont);
        if (formulario && contBarcode) initFormHandlers(formulario, contBarcode);
        if (document.getElementById('tabla-body')) actualizarTabla();
        if (matCont) cargarEstado();

        // Exportar funciones globales
        window.custodia = {
            reactivarBoton,
            actualizarTabla,
            guardarEstado,
            cargarEstado,
            generarPDFConJsPDF,
            enviarPdfAlServidor,
            operacionAtomica,
            actualizarEstadoFrontend
        };
    });
})();