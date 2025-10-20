(() => {
    // Config
    const urlServer = 'https://andenes.terminal-calama.com';
    const urlUpdate = urlServer + '/TerminalCalama/PHP/Boleta/save.php';
    const urlStore = urlServer + '/TerminalCalama/PHP/Custodia/store.php';
    const urlState = urlServer + '/TerminalCalama/PHP/Custodia/reload.php';
    const urlLoad = urlServer + '/TerminalCalama/PHP/Boleta/load.php';
    const urlLocal = 'http://10.5.20.105:3000';
    const urlImpresion = urlLocal + '/api/imprimir';
    const urlPaymentTarjeta = urlLocal + '/api/payment';
    const urlPaymentEfectivo = 'https://backend-banios.dev-wit.com/api/boletas-calama/enviar'


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

    //==================================== PDF CON JSPDF ================================
    async function generarPDFEntrega(datosTicket) {
        return new Promise(async (resolve, reject) => {
            try {
                // Verificar si jsPDF está disponible
                if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                    // Cargar jsPDF dinámicamente
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    script.onload = () => {
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

                        // Contenido del ticket de entrega
                        let y = 5;

                        // Título
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(10);
                        pdf.text('COMPROBANTE DE ENTREGA', 29, y, { align: 'center' });
                        y += 6;

                        // Información
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(8);
                        pdf.text(`Fecha Entrega: ${datosTicket.fechaSalida} ${datosTicket.horaSalida}`, 3, y);
                        y += 4;
                        pdf.text(`Casillero: ${datosTicket.casillero}`, 3, y);
                        y += 4;
                        pdf.text(`Tiempo Ocupado: ${datosTicket.tiempoOcupado}`, 3, y);
                        y += 4;
                        pdf.text(`Valor Total: ${datosTicket.valorTotal}`, 3, y);
                        y += 4;
                        pdf.text(`RUT: ${datosTicket.rut}`, 3, y);
                        y += 4;
                        pdf.text(`Método de Pago: ${datosTicket.metodoPago || 'Efectivo'}`, 3, y);
                        y += 6;
                        // Generar barcode en canvas offscreen
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 600;
                            canvas.height = 200;

                            JsBarcode(canvas, datosTicket.codigoBarras, {
                                format: "CODE128",
                                displayValue: false,
                                width: 2,
                                height: 80,
                                margin: 10
                            });

                            const imageData = canvas.toDataURL('image/png');

                            // Añadir la imagen al PDF
                            const imgX = 3;
                            const imgW = 52;
                            const imgH = 16;
                            pdf.addImage(imageData, 'PNG', imgX, y, imgW, imgH);

                            // Avanzar y escribir el texto del código
                            y += imgH + 3;
                            pdf.setFont('courier', 'bold');
                            pdf.setFontSize(10);
                            pdf.text('CÓDIGO:', 3, y);
                            y += 3;
                            pdf.text(datosTicket.codigoBarras, 3, y);

                        } catch (imgErr) {
                            console.warn('No se pudo renderizar imagen del barcode, se añadirá solo texto', imgErr);
                            pdf.setFont('courier', 'bold');
                            pdf.setFontSize(10);
                            pdf.text('CÓDIGO:', 3, y);
                            y += 3;
                            pdf.text(datosTicket.codigoBarras, 3, y);
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

    async function enviarPdfAlServidor(pdf, filename = 'comprobante_entrega.pdf', printer = '') {
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

    //==================================== FUNCIONES EXISTENTES MODIFICADAS ==============
    const formulario = document.getElementById('formulario');
    const barcodeInput = document.getElementById('barcodeIn');
    const btnConsultar = document.getElementById('btnConsultar');
    const btnLiberarImprimir = document.getElementById('btnLiberarImprimir');

    // ---- Reemplazo automático de '-' por '/' mientras escribe ----
    barcodeInput.addEventListener('input', function (e) {
        const cursorPos = this.selectionStart;
        this.value = this.value.replace(/-/g, '/').replace(/\s+/g, '');
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

    let datosPagoActual = null;

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();

        // proteger botón para evitar doble envío
        if (btnLiberarImprimir.disabled) return;
        btnLiberarImprimir.disabled = true;

        // const id_caja = "90";

        const id_caja = localStorage.getItem('id_caja');
        if (!id_caja) {
            alert('Por favor, primero debe abrir la caja antes de liberar un casillero.');
            btnLiberarImprimir.disabled = false;
            return;
        }

        try {
            // Normalizar barcode: reemplazar '-' por '/'
            const barcodeTxt = formulario.barcodeIn.value.trim().replace(/-/g, '/');

            // Separar ID y RUT (formato esperado: idcustodia/rut)
            const barcodeData = barcodeTxt.split('/');
            if (barcodeData.length !== 2) {
                alert("Código de barras inválido. El formato debe ser: idcustodia/rut");
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
            const result = await traerDatos(idIn);

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

            // Actualizar UI
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
            datosPagoActual = {
                idIn,
                rutIn,
                result,
                valorTotal: Math.round(valorTotal),
                diffDays,
                fechaStr,
                horaStr,
                id_caja,
                barcodeTxt
            };

            mostrarModalPago(datosPagoActual);

        } catch (err) {
            console.error(err.message || err);
            alert(err.message || "El ticket ya ha sido escaneado anteriormente o es inválido.");
            btnLiberarImprimir.disabled = false;
        }
    });

    function mostrarModalPago(datos) {
        // Actualizar resumen en el modal
        document.getElementById('resumenValorTotal').textContent = `$${datos.valorTotal}`;
        document.getElementById('resumenCasillero').textContent = datos.result.posicion || '-';
        document.getElementById('resumenTiempo').textContent = `${datos.diffDays} Días`;

        // Resetear selección
        document.querySelectorAll('.card-pago-option').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('btnConfirmarPago').disabled = true;

        // Mostrar modal
        const modalPago = new bootstrap.Modal(document.getElementById('modalPago'));
        modalPago.show();
    }
    function inicializarEventosModal() {
        // Eventos para selección de método de pago
        document.querySelectorAll('.card-pago-option').forEach(card => {
            card.addEventListener('click', function () {
                // Remover selección anterior
                document.querySelectorAll('.card-pago-option').forEach(c => {
                    c.classList.remove('selected');
                });

                // Agregar selección actual
                this.classList.add('selected');

                // Habilitar botón de confirmar
                document.getElementById('btnConfirmarPago').disabled = false;
            });
        });

        // Evento para confirmar pago
        document.getElementById('btnConfirmarPago').addEventListener('click', async function () {
            const btn = this;
            const metodoSeleccionado = document.querySelector('.card-pago-option.selected')?.dataset.metodo;

            if (!metodoSeleccionado) {
                alert('Por favor seleccione un método de pago');
                return;
            }

            // Deshabilitar botón mientras se procesa
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';

            try {
                // Procesar pago (efectivo o tarjeta)
                const resultadoPago = await procesarPago(metodoSeleccionado);

                // procesarPago debe devolver un objeto con success: true/false
                if (!resultadoPago || !resultadoPago.success) {
                    throw new Error(resultadoPago?.mensaje || 'Error en el procesamiento del pago');
                }

                // Actualizar datosPagoActual con la info del pago (procesarPago ya lo hace en tu código)
                // Ahora completar todo el proceso: actualizar DB, liberar casillero y generar/imprimir PDF
                await completarProcesoEntrega(datosPagoActual);

                // Si todo OK, dejar estado del botón y cerrar modal
                btn.innerHTML = originalHTML;
                btn.disabled = false;

                const modal = bootstrap.Modal.getInstance(document.getElementById('modalPago'));
                if (modal) modal.hide();

            } catch (error) {
                console.error('Error procesando/entregando:', error);

                // Mensaje por defecto
                let userMsg = 'Error al procesar el pago o generar el comprobante.';

                // Si el error viene del gateway con código conocido
                if (error.gatewayCode === 'USER_CANCELLED' || (error.message && error.message.toLowerCase().includes('cancel'))) {
                    userMsg = 'La transacción fue cancelada en el POS.';
                } else if (error.message && error.message.toLowerCase().includes('pos')) {
                    userMsg = 'No se pudo comunicar con el POS. Verifique estado/conexión del dispositivo.';
                } else if (error.httpStatus) {
                    userMsg = `Error del servidor de pagos (HTTP ${error.httpStatus}).`;
                } else if (error.message) {
                    userMsg = error.message;
                }

                // Mostrar mensaje amigable al usuario
                alert(userMsg);

                // (Opcional) log adicional con raw para soporte
                if (error.gatewayRaw) console.info('Gateway raw:', error.gatewayRaw);

                // Restaurar estado del botón
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        });
    }

    async function procesarPago(metodoPago) {
        if (!datosPagoActual) {
            throw new Error('No hay datos de pago disponibles');
        }

        console.log(`Procesando pago con método: ${metodoPago}`);

        let resultadoPago;

        // Procesar según el método seleccionado
        if (metodoPago === 'efectivo') {
            resultadoPago = await procesarPagoEfectivo(datosPagoActual);
        } else if (metodoPago === 'tarjeta') {
            resultadoPago = await procesarPagoTarjeta(datosPagoActual);
        } else {
            throw new Error('Método de pago no válido');
        }

        // Validar que el pago fue exitoso
        if (!resultadoPago.success) {
            throw new Error(resultadoPago.mensaje || 'Error en el procesamiento del pago');
        }

        console.log('Pago procesado exitosamente:', resultadoPago);

        // Agregar información del pago a los datos para el comprobante
        datosPagoActual.metodoPago = resultadoPago.metodo;
        datosPagoActual.codigoTransaccion = resultadoPago.codigoTransaccion;
        datosPagoActual.referenciaPago = resultadoPago.referenciaPago;

        return resultadoPago;
    }

    function generateCode(length = 6) {
        try {
            const array = new Uint32Array(length);
            crypto.getRandomValues(array);

            let code = '';
            for (let i = 0; i < length; i++) {
                code += (array[i] % 10).toString();
            }

            return code;
        } catch (error) {
            console.warn('Crypto no disponible, usando fallback');
            let code = '';
            for (let i = 0; i < length; i++) {
                code += Math.floor(Math.random() * 10).toString();
            }
            return code;
        }
    }

    async function procesarPagoEfectivo(datos) {
        console.log('Procesando pago en efectivo:', datos);

        try {
            if (!datos.valorTotal || datos.valorTotal <= 0) {
                throw new Error('Monto inválido para procesar pago en efectivo');
            }

            const payload = {
                nombre: "casillero_custodia",
                precio: datos.valorTotal
            };

            console.log("Enviando pago en efectivo a:", urlPaymentEfectivo);
            console.log("Payload:", payload);

            const response = await fetch(urlPaymentEfectivo, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
            });

            console.log("Respuesta HTTP:", response.status, response.statusText);

            // Validar respuesta HTTP
            if (!response.ok) {
                let errorDetail = `Error ${response.status}: ${response.statusText}`;

                try {
                    const errorText = await response.text();
                    console.error("Detalle del error:", errorText);
                    errorDetail += ` - ${errorText}`;
                } catch (e) {
                    console.error("No se pudo obtener detalle del error");
                }

                throw new Error(`Error del servidor: ${errorDetail}`);
            }

            // Procesar respuesta JSON
            const result = await response.json();
            console.log("Respuesta del servidor (JSON):", result);

            if (result.success === false || result.error) {
                throw new Error(result.message || result.error || 'Error en la respuesta del servidor');
            }

            return {
                success: true,
                metodo: 'efectivo',
                codigoTransaccion: generateCode(6),
                referenciaPago: `EF-${generateCode(4)}`,
                respuestaGateway: result,
                mensaje: 'Pago en efectivo registrado correctamente'
            };

        } catch (error) {
            console.error('Error completo en pago en efectivo:', error);

            // Mejorar mensajes de error para el usuario
            let userMessage = error.message || 'Error procesando pago en efectivo';

            if (error.message.includes('Failed to fetch')) {
                userMessage = 'Error de conexión con el servidor. Verifique su conexión a internet y que el servidor esté disponible.';
            } else if (error.message.includes('CORS') || error.message.includes('cors')) {
                userMessage = 'Error de configuración del servidor. Contacte al administrador.';
            } else if (error.message.includes('404')) {
                userMessage = 'Servicio no encontrado. Verifique la URL del endpoint.';
            } else if (error.message.includes('500')) {
                userMessage = 'Error interno del servidor. Contacte al administrador.';
            }

            throw new Error(userMessage);
        }
    }

    async function procesarPagoTarjeta(datos) {
        console.log('Procesando pago con tarjeta:', datos);

        try {
            if (!datos.valorTotal || datos.valorTotal <= 0) {
                throw new Error('Monto inválido para procesar pago con tarjeta');
            }

            const ticketNumber = generateCode(6);
            const payload = {
                amount: datos.valorTotal,
                ticketNumber: ticketNumber
            };

            console.log('Enviando pago a gateway:', payload);

            const response = await fetch(urlPaymentTarjeta, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Leer cuerpo (sea OK o error) intentando parsear JSON
            const textBody = await response.text().catch(() => '');
            let jsonBody = null;
            try { jsonBody = textBody ? JSON.parse(textBody) : null; } catch (e) { jsonBody = null; }

            // Si HTTP no OK -> mapear error y lanzar uno amigable
            if (!response.ok) {
                // si tenemos JSON con estructura conocida, usarlo
                if (jsonBody && jsonBody.success === false) {
                    const code = jsonBody.code || (jsonBody.error && jsonBody.error.code) || null;
                    const rawMsg = jsonBody.error || jsonBody.message || jsonBody.meta?.rawData?.responseMessage || textBody;
                    const friendly = (code === 'USER_CANCELLED' || (rawMsg && rawMsg.toString().toLowerCase().includes('cancel')))
                        ? 'Transacción cancelada desde el POS.'
                        : ((rawMsg && rawMsg.toString().toLowerCase().includes('desconect'))
                            ? 'No se pudo comunicar con el POS (dispositivo desconectado).'
                            : `Error en el servidor de pagos: ${rawMsg}`);

                    const err = new Error(friendly);
                    err.gatewayCode = code || null;
                    err.gatewayRaw = jsonBody;
                    throw err;
                }

                // fallback: no JSON o formato distinto
                const err = new Error(`Error HTTP ${response.status}: ${textBody || response.statusText}`);
                err.httpStatus = response.status;
                err.httpBody = textBody;
                throw err;
            }

            // Si llegó OK, parsear JSON si no lo hicimos
            const result = jsonBody || (textBody ? JSON.parse(textBody) : null);
            console.log('Respuesta del gateway de pagos:', result);

            // Si el gateway responde success:false (aunque HTTP 200) manejarlo
            if (result && result.success === false) {
                const code = result.code || null;
                const rawMsg = result.error || result.message || result.meta?.rawData?.responseMessage || 'Error desconocido desde el gateway';
                const friendly = (code === 'USER_CANCELLED' || (rawMsg && rawMsg.toString().toLowerCase().includes('cancel')))
                    ? 'Transacción cancelada desde el POS.'
                    : ((rawMsg && rawMsg.toString().toLowerCase().includes('desconect'))
                        ? 'No se pudo comunicar con el POS (dispositivo desconectado).'
                        : rawMsg);

                const err = new Error(friendly);
                err.gatewayCode = code;
                err.gatewayRaw = result;
                throw err;
            }

            // Respuesta OK y sin success:false -> asumimos pago correcto
            datos.metodoPago = 'Tarjeta';
            datos.codigoTransaccion = ticketNumber;
            datos.referenciaPago = (result && (result.transactionId || result.reference)) || ticketNumber;

            return {
                success: true,
                metodo: 'tarjeta',
                codigoTransaccion: ticketNumber,
                referenciaPago: datos.referenciaPago,
                respuestaGateway: result,
                mensaje: 'Pago con tarjeta procesado correctamente'
            };

        } catch (error) {
            console.error('Error en pago con tarjeta:', error);

            // Normalizar mensajes de red
            if (error.message && error.message.includes('Failed to fetch')) {
                throw new Error('Error de conexión con el servidor de pagos. Verifique su conexión.');
            }

            // Si ya es un Error creado arriba (con friendly message) lo re-lanzamos tal cual
            if (error.gatewayCode || error.httpStatus || /Transacción cancelada|POS/.test(error.message)) {
                throw error;
            }

            // Fallback genérico
            throw new Error(error.message || 'Error procesando pago con tarjeta');
        }
    }

    async function completarProcesoEntrega(datos) {
        const { idIn, rutIn, result, valorTotal, fechaStr, horaStr, id_caja, barcodeTxt } = datos;

        // Preparar los datos para actualizar el registro
        const datosUpdate = {
            id: idIn,
            estado: "Entregado",
            hora: horaStr,
            fecha: fechaStr,
            valor: valorTotal,
            rut: rutIn,
            id_caja: id_caja
        };

        // Actualizar el registro en la base de datos
        await callAPI(datosUpdate, urlUpdate);
        console.log("Registro actualizado correctamente.");

        // Liberar casillero
        const casilla = result.posicion;
        if (casilla) {
            await cargarEstado(casilla);
        }

        // Generar e imprimir PDF de entrega
        const datosTicket = {
            fechaSalida: fechaStr,
            horaSalida: horaStr,
            casillero: result.posicion,
            tiempoOcupado: `${datos.diffDays} Días`,
            valorTotal: `$${valorTotal}`,
            rut: rutIn,
            metodoPago: datos.metodoPago || 'Efectivo',
            codigoTransaccion: datos.codigoTransaccion || 'N/A',
            referenciaPago: datos.referenciaPago || 'N/A',
            codigoBarras: barcodeTxt
        };

        console.log('Generando PDF de entrega con datos:', datosTicket);
        const pdf = await generarPDFEntrega(datosTicket);
        const filename = `entrega_${result.posicion}_${fechaStr}.pdf`;
        await enviarPdfAlServidor(pdf, filename, '');

        console.log('PDF de entrega generado e enviado exitosamente');

        // Mensaje personalizado según el método de pago
        const mensajeExito = datos.metodoPago === 'Tarjeta'
            ? `Pago con tarjeta procesado exitosamente. Referencia: ${datos.referenciaPago}. El casillero ha sido liberado y se imprimió el comprobante.`
            : `Pago en efectivo procesado exitosamente. Código: ${datos.codigoTransaccion}. El casillero ha sido liberado y se imprimió el comprobante.`;

        alert(mensajeExito);

        formulario.reset();
        btnLiberarImprimir.disabled = false;

        // Limpiar datos
        datosPagoActual = null;
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

    const consultarTicket = (barcodeTxt) => {
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

    // Mantener función printComp como fallback si es necesario
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


    document.addEventListener('DOMContentLoaded', function () {
        // Inicializar eventos del modal
        inicializarEventosModal();
    });

    // Exportar funciones globales si es necesario
    window.boleta = {
        generarPDFEntrega,
        enviarPdfAlServidor,
        printComp
    };

})();

