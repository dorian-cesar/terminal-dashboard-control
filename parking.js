const API_URL_MOVIMIENTOS = "http://localhost/parkingCalama/php/movimientos/api.php?patente=";
const API_MOV_UPDATE = "http://localhost/parkingCalama/php/movimientos/api.php";
const API_WHITELIST = "http://localhost/parkingCalama/php/whitelist/api.php?patente=";
const API_EMPRESAS = "http://localhost/parkingCalama/php/empresas/api.php";
const VALOR_MINUTO = 30;

// Endpoints del gateway
const urlLocal = 'http://10.5.20.105:3000';
const urlPaymentTarjeta = urlLocal + '/api/payment';
const urlPaymentEfectivo = 'https://backend-banios.dev-wit.com/api/boletas-calama/enviar';

let ultimoMovimiento = null;
let estaEnWhitelist = false;
let id_caja = null;
let empresasCache = [];

/* --- utilidades --- */
function calcularMinutos(fechaEnt, horaEnt, fechaSal, horaSal) {
    const inicio = new Date(`${fechaEnt}T${horaEnt}`);
    const fin = new Date(`${fechaSal}T${horaSal}`);
    const diffMs = fin - inicio;
    return Math.max(1, Math.floor(diffMs / (1000 * 60)));
}

function mostrarErrorUsuario(msg) {
    alert(msg);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function cargarEmpresas() {
    try {
        const response = await axios.get(API_EMPRESAS);
        empresasCache = response.data;
        console.log("Empresas cargadas:", empresasCache);
    } catch (error) {
        console.error("Error cargando empresas:", error);
        mostrarErrorUsuario("Error al cargar lista de empresas");
    }
}

/* --- Buscar ID de empresa por nombre --- */
function buscarIdEmpresaPorNombre(nombreEmpresa) {
    if (!nombreEmpresa || !empresasCache.length) return 0;

    const empresa = empresasCache.find(emp =>
        emp.nombre.toLowerCase() === nombreEmpresa.toLowerCase()
    );

    return empresa ? empresa.idemp : 0;
}


/* --- handlers UI --- */
$("#btnConsultar").on("click", async function () {
    const patenteRaw = $("#patente").val().trim();
    if (!patenteRaw) {
        alert("Ingrese una patente válida");
        return;
    }
    const patente = patenteRaw.toUpperCase().replace(/\s+/g, '');

    // Obtener id_caja del localStorage y asignar a variable global
    id_caja = localStorage.getItem('id_caja');
    if (!id_caja) {
        alert('Por favor, primero debe abrir la caja antes de procesar pagos.');
        return;
    }

    try {
        // 1) obtener movimiento
        const res = await axios.get(API_URL_MOVIMIENTOS + patente);
        const data = res.data;

        if (!data || !data.patente) {
            $("#resultado").hide();
            $("#sinDatos").show();
            alert("No se encontraron datos de entrada para esa patente.");
            return;
        }

        // Validar que el movimiento esté activo (fechasal = "0000-00-00")
        if (data.fechasal !== "0000-00-00") {
            $("#resultado").hide();
            $("#sinDatos").show();
            alert("Esta patente ya fue cobrada o no está activa.");
            return;
        }

        // Validar que sea tipo parking
        if (data.tipo && data.tipo.toLowerCase() !== 'parking') {
            $("#resultado").hide();
            $("#sinDatos").show();
            alert("Este vehículo no está en Parking.");
            return;
        }

        ultimoMovimiento = data;

        // 2) consultar whitelist
        estaEnWhitelist = false;
        try {
            const wlRes = await axios.get(API_WHITELIST + patente);
            if (wlRes && wlRes.data !== null) {
                estaEnWhitelist = true;
            }
        } catch (wlErr) {
            console.error("Error consultando whitelist:", wlErr);
        }

        // 3) calcular tiempos y valor
        const ahora = new Date();
        const fechaSalida = ahora.toISOString().split("T")[0];
        const horaSalida = ahora.toTimeString().split(" ")[0];

        const minutos = calcularMinutos(data.fechaent, data.horaent, fechaSalida, horaSalida);
        let valor = minutos * VALOR_MINUTO;

        // 4) UI: si whitelist => exento
        if (estaEnWhitelist) {
            valor = 0;
            $("#infoValor").text(`$0 (Exento - Lista Blanca)`);
            $("#infoPatente").text(data.patente);
            if (!$("#wlBadge").length) {
                $("#infoPatente").append('<span id="wlBadge" class="badge bg-success ms-2">Lista Blanca</span>');
            }
            $(".btn-pagar").prop("disabled", true).text("Exento — No requiere pago");
            $("#btnEfectivo").prop("disabled", true);
            $("#btnTarjeta").prop("disabled", true);
        } else {
            $("#infoValor").text(`$${valor.toLocaleString("es-CL")}`);
            $("#wlBadge").remove();
            $(".btn-pagar").prop("disabled", false).text("Pagar");
            $("#btnEfectivo").prop("disabled", false);
            $("#btnTarjeta").prop("disabled", false);
        }

        // Rellenar resto UI
        $("#infoPatente").text(data.patente);
        $("#infoEmpresa").text(data.empresa);
        $("#infoFechaEnt").text(data.fechaent);
        $("#infoHoraEnt").text(data.horaent);
        $("#infoHoraSal").text(horaSalida);
        $("#infoTiempo").text(`${minutos} min.`);

        // Guardamos algunos datos en el objeto para enviar al gateway
        ultimoMovimiento._valorCalculado = valor;
        ultimoMovimiento._minutos = minutos;
        ultimoMovimiento._fechaSalida = fechaSalida;
        ultimoMovimiento._horaSalida = horaSalida;

        $("#resultado").fadeIn();
        $("#sinDatos").hide();

    } catch (err) {
        console.error(err);
        mostrarErrorUsuario("Error al consultar la patente o la API no responde.");
    }
});


$("#btnEfectivo").on("click", async function () {
    try {
        if (!ultimoMovimiento) {
            mostrarErrorUsuario("No hay movimiento cargado para procesar el pago.");
            return;
        }
        if (!id_caja) {
            mostrarErrorUsuario("No hay caja abierta. Por favor, abra una caja primero.");
            return;
        }
        if (estaEnWhitelist) {
            mostrarErrorUsuario("Esta patente está exenta (Lista Blanca). No se requiere pago.");
            $("#modalPago").modal("hide");
            return;
        }

        $("#btnEfectivo").prop("disabled", true).text("Procesando...");
        const resultado = await procesarPagoEfectivo(ultimoMovimiento);

        if (resultado && resultado.success) {
            try {
                await registrarPagoMovimiento(ultimoMovimiento, resultado, 'efectivo');

                // Imprimir boleta después del pago exitoso
                await imprimirBoletaTermica(ultimoMovimiento, resultado);

                alert(`Pago en efectivo procesado: ${resultado.mensaje || 'OK'}`);
                marcarComoPagadoUI();

                // Limpiar formulario
                $("#patente").val('');
                $("#resultado").hide();
                ultimoMovimiento = null;

            } catch (regErr) {
                console.error("Error registrando pago:", regErr);
                alert(`Pago procesado pero error al registrar: ${regErr.message}. Contacte soporte.`);
            }
        } else {
            throw new Error(resultado && resultado.mensaje ? resultado.mensaje : 'Error al procesar pago efectivo');
        }
    } catch (err) {
        console.error("Error pago efectivo:", err);
        mostrarErrorUsuario(err.message || 'Error procesando pago en efectivo.');
    } finally {
        $("#btnEfectivo").prop("disabled", false).text("💵 Efectivo");
        $("#modalPago").modal("hide");
    }
});

$("#btnTarjeta").on("click", async function () {
    try {
        if (!ultimoMovimiento) {
            mostrarErrorUsuario("No hay movimiento cargado para procesar el pago.");
            return;
        }
        if (!id_caja) {
            mostrarErrorUsuario("No hay caja abierta. Por favor, abra una caja primero.");
            return;
        }
        if (estaEnWhitelist) {
            mostrarErrorUsuario("Esta patente está exenta (Lista Blanca). No se requiere pago.");
            $("#modalPago").modal("hide");
            return;
        }

        $("#btnTarjeta").prop("disabled", true).text("Procesando...");
        const resultado = await procesarPagoTarjeta(ultimoMovimiento);

        if (resultado && resultado.success) {
            try {
                await registrarPagoMovimiento(ultimoMovimiento, resultado, 'tarjeta');

                // Imprimir boleta después del pago exitoso
                await imprimirBoletaTermica(ultimoMovimiento, resultado);

                alert(`Pago con tarjeta procesado: ${resultado.mensaje || 'OK'}`);
                marcarComoPagadoUI();

                // Limpiar formulario
                $("#patente").val('');
                $("#resultado").hide();
                ultimoMovimiento = null;

            } catch (regErr) {
                console.error("Error registrando pago:", regErr);
                alert(`Pago procesado pero error al registrar: ${regErr.message}. Contacte soporte.`);
            }
        } else {
            throw new Error(resultado && resultado.mensaje ? resultado.mensaje : 'Error al procesar pago con tarjeta');
        }
    } catch (err) {
        console.error("Error pago tarjeta:", err);
        mostrarErrorUsuario(err.message || 'Error procesando pago con tarjeta.');
    } finally {
        $("#btnTarjeta").prop("disabled", false).text("💳 Tarjeta");
        $("#modalPago").modal("hide");
    }
});

/* --- funciones de pago (adaptadas del script grande) --- */
function generateCode(length = 6) {
    try {
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        let code = '';
        for (let i = 0; i < length; i++) code += (array[i] % 10).toString();
        return code;
    } catch (e) {
        let code = '';
        for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10).toString();
        return code;
    }
}

async function procesarPagoEfectivo(datos) {
    // espera: devuelve objeto { success: true, metodo: 'efectivo', folio, ficticia, respuestaGateway, mensaje }
    console.log('Procesando pago efectivo para', datos);

    try {
        const valor = datos._valorCalculado;
        if (!valor || valor <= 0) {
            throw new Error('Monto inválido para procesar pago en efectivo');
        }

        const payload = {
            nombre: "parking",
            precio: valor
        };

        const response = await fetch(urlPaymentEfectivo, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        const textBody = await response.text().catch(() => '');
        let result = null;
        try { result = textBody ? JSON.parse(textBody) : null; } catch (e) { result = null; }

        if (!response.ok) {
            let errDetail = `Error ${response.status}: ${response.statusText}`;
            if (textBody) errDetail += ` - ${textBody}`;
            const err = new Error(`Error del servidor: ${errDetail}`);
            err.httpStatus = response.status;
            throw err;
        }

        if (result && (result.folio !== undefined || result.message)) {
            const folio = result.folio ?? null;
            const ficticia = !!result.ficticia;
            const mensaje = result.message || 'Pago en efectivo procesado';

            datos._pago = {
                metodo: 'efectivo',
                folio,
                ficticia,
                raw: result
            };

            return { success: true, metodo: 'efectivo', folio, ficticia, respuestaGateway: result, mensaje };
        }

        throw new Error('Respuesta inesperada del servidor de pagos (efectivo)');

    } catch (error) {
        console.error('procesarPagoEfectivo error:', error);
        let um = error.message || 'Error procesando pago en efectivo';
        if (um.includes('Failed to fetch')) um = 'Error de conexión con el servidor de pagos (efectivo).';
        throw new Error(um);
    }
}

async function procesarPagoTarjeta(datos) {
    console.log('Procesando pago tarjeta para', datos);

    try {
        const valor = datos._valorCalculado;
        if (!valor || valor <= 0) {
            throw new Error('Monto inválido para procesar pago con tarjeta');
        }

        const ticketNumber = generateCode(6);
        const payload = {
            amount: valor,
            ticketNumber: ticketNumber
        };

        const response = await fetch(urlPaymentTarjeta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const textBody = await response.text().catch(() => '');
        let jsonBody = null;
        try { jsonBody = textBody ? JSON.parse(textBody) : null; } catch (e) { jsonBody = null; }

        if (!response.ok) {
            if (jsonBody && (jsonBody.success === false || jsonBody.code)) {
                const code = jsonBody.code || null;
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

            const err = new Error(`Error HTTP ${response.status}: ${textBody || response.statusText}`);
            err.httpStatus = response.status;
            throw err;
        }

        const result = jsonBody || (textBody ? JSON.parse(textBody) : null);
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

        const referenciaPago = (result && (result.transactionId || result.reference || result.referenceId)) || ticketNumber;
        datos._pago = {
            metodo: 'tarjeta',
            codigoTransaccion: ticketNumber,
            referenciaPago,
            raw: result
        };

        return {
            success: true,
            metodo: 'tarjeta',
            codigoTransaccion: ticketNumber,
            referenciaPago,
            respuestaGateway: result,
            mensaje: 'Pago con tarjeta procesado correctamente'
        };

    } catch (error) {
        console.error('procesarPagoTarjeta error:', error);
        if (error.message && error.message.includes('Failed to fetch')) {
            throw new Error('Error de conexión con el servidor de pagos. Verifique su conexión.');
        }
        throw error;
    }
}

async function registrarPagoMovimiento(movimiento, resultadoPago, metodo) {
    try {
        const ahora = new Date();
        const fechaSalida = ahora.toISOString().split('T')[0];
        const horaSalida = ahora.toTimeString().split(' ')[0].substring(0, 8);

        // Buscar el ID de la empresa por nombre
        const idEmpresa = buscarIdEmpresaPorNombre(movimiento.empresa);

        if (idEmpresa === 0) {
            console.warn("No se encontró ID para empresa:", movimiento.empresa, "Usando 0 como fallback");
        }

        // Payload final para la API
        const payload = {
            id: movimiento.idmov || movimiento.id,
            patente: movimiento.patente,
            fecha: fechaSalida,
            hora: horaSalida,
            valor: movimiento._valorCalculado || 0,
            empresa: idEmpresa,  // <-- Ahora enviamos el ID numérico
            id_caja: parseInt(id_caja) || 0,
            medio_pago: metodo
        };

        console.log("Enviando registro de pago al servidor:", payload);

        const response = await fetch(API_MOV_UPDATE, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('jwt')}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log('Respuesta cruda del servidor:', responseText);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${responseText}`);
        }

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Respuesta no válida del servidor: ${responseText}`);
        }

        console.log('Registro de pago guardado correctamente:', responseData);
        return responseData;

    } catch (err) {
        console.error('Error registrando pago en servidor:', err);
        throw err;
    }
}



async function imprimirBoletaTermica(datos, resultadoPago) {
    const ventanaImpr = window.open('', '_blank');

    // Preparar datos para la boleta
    const infoPago = resultadoPago.metodo === 'efectivo'
        ? `Folio: ${resultadoPago.folio || 'N/A'}`
        : `Transacción: ${resultadoPago.codigoTransaccion || 'N/A'}`;

    ventanaImpr.document.write(`
        <html>
        <head>
            <title>Boleta de Pago</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    text-align: center; 
                    width: 280px;
                    margin: 0 auto;
                    padding: 10px;
                    font-size: 12px;
                }
                h1, h3 { margin: 5px 0; }
                .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                .text-left { text-align: left; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>WIT.LA</h1>
            <h3>Boleta de Pago (Parking)</h3>
            <div class="line"></div>
            
            <div class="text-left">
                <div><strong>Patente:</strong> ${datos.patente}</div>
                <div><strong>Empresa:</strong> ${datos.empresa}</div>
                <div><strong>Fecha Entrada:</strong> ${datos.fechaent}</div>
                <div><strong>Hora Entrada:</strong> ${datos.horaent}</div>
                <div><strong>Fecha Salida:</strong> ${datos._fechaSalida}</div>
                <div><strong>Hora Salida:</strong> ${datos._horaSalida}</div>
                <div><strong>Tiempo:</strong> ${datos._minutos} min.</div>
            </div>
            
            <div class="line"></div>
            
            <div class="text-left">
                <div><strong>Método de Pago:</strong> ${resultadoPago.metodo.toUpperCase()}</div>
                <div>${infoPago}</div>
            </div>
            
            <div class="line"></div>
            
            <h2 class="bold">TOTAL: $${datos._valorCalculado.toLocaleString("es-CL")}</h2>
            
            <div class="line"></div>
            
            <h3>¡Gracias por su visita!</h3>
            <div>${new Date().toLocaleString('es-CL')}</div>
        </body>
        </html>
    `);
    ventanaImpr.document.close();

    setTimeout(() => {
        ventanaImpr.focus();
        ventanaImpr.print();

        setTimeout(() => {
            try {
                ventanaImpr.close();
            } catch (e) {
                console.error("No se pudo cerrar la ventana:", e);
            }
        }, 1000);
    }, 500);
}

/* --- UI helpers después de pago exitoso --- */
function marcarComoPagadoUI() {
    $(".btn-pagar").prop("disabled", true).text("Pagado");
    $("#btnEfectivo").prop("disabled", true);
    $("#btnTarjeta").prop("disabled", true);

    if (!$("#paidBadge").length) {
        $("#infoPatente").append('<span id="paidBadge" class="badge bg-primary ms-2">Pagado</span>');
    }
}

/* --- init --- */
$(document).ready(function () {
    id_caja = localStorage.getItem('id_caja');

    // Cargar empresas al iniciar la página
    cargarEmpresas();

    $("#modalPago").on('show.bs.modal', function () {
        if (estaEnWhitelist) {
            $("#modalPago").modal('hide');
            return;
        }
        $("#btnEfectivo").prop("disabled", false).text("💵 Efectivo");
        $("#btnTarjeta").prop("disabled", false).text("💳 Tarjeta");
    });
});
