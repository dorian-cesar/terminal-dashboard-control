// Variables globales
let datosGlobales = [];
const urlBase = "https://andenes.terminal-calama.com";
const urlServer = "https://andenes.terminal-calama.com";
const urlLoad = urlServer + "/TerminalCalama/PHP/Restroom/load.php";
const urlLoadToday = urlServer + "/TerminalCalama/PHP/Restroom/loadToday.php";
const urlSave = urlServer + "/TerminalCalama/PHP/Restroom/save.php";
const urlAddUser = urlServer + "/TerminalCalama/PHP/Restroom/addUser.php";
const urlLevelUser =
  urlServer + "/TerminalCalama/PHP/Restroom/addLevelUser.php";
const urlBoleto = urlServer + "/TerminalCalama/PHP/Restroom/estadoBoleto.php";

let servicioSeleccionado = null;
let metodoPagoSeleccionado = null;

// Inicialización
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado - Inicializando página...");
  console.log("Valores de servicios disponibles:", window.restroom);
  initializePage();
});

function initializePage() {
  console.log("Inicializando página...");

  // Inicializar valores de servicios DESPUÉS de que valores.js se haya cargado
  actualizarValoresServicios();

  // Configurar eventos para los botones de servicio
  const btnBaño = document.getElementById("btnBaño");
  const btnDucha = document.getElementById("btnDucha");

  if (btnBaño) {
    btnBaño.addEventListener("click", () => {
      manejarSeleccionServicio("Baño");
    });
  }

  if (btnDucha) {
    btnDucha.addEventListener("click", () => {
      manejarSeleccionServicio("Ducha");
    });
  }

  initializeModal();

  // Ocultar botones no necesarios
  const genQR = document.getElementById("generar");
  if (genQR) genQR.style.display = "none";

  const btnImprimir = document.querySelector(".btn-success");
  if (btnImprimir) btnImprimir.style.display = "none";

  // Inicializar otros componentes
  initializeFiltersAndVerification();
  updateStats();
  renderHistory();
  generarQRPlaceholder();
}

// Función específica para actualizar los valores de los servicios
function actualizarValoresServicios() {
  console.log("Actualizando valores de servicios...", window.restroom);

  const valorBaño = document.getElementById("valorBaño");
  const valorDucha = document.getElementById("valorDucha");

  // Verificar si los elementos existen antes de intentar actualizarlos
  if (valorBaño) {
    if (window.restroom && window.restroom.Baño) {
      valorBaño.textContent = `$${window.restroom.Baño}`;
      console.log("Valor Baño actualizado:", window.restroom.Baño);
    } else {
      console.warn(
        "No se pudo cargar el valor del Baño, usando valor por defecto"
      );
      valorBaño.textContent = "$500"; // Valor por defecto
    }
  } else {
    console.log("Elemento valorBaño no encontrado en esta página");
  }

  if (valorDucha) {
    if (window.restroom && window.restroom.Ducha) {
      valorDucha.textContent = `$${window.restroom.Ducha}`;
      console.log("Valor Ducha actualizado:", window.restroom.Ducha);
    } else {
      console.warn(
        "No se pudo cargar el valor de la Ducha, usando valor por defecto"
      );
      valorDucha.textContent = "$4000"; // Valor por defecto
    }
  } else {
    console.log("Elemento valorDucha no encontrado en esta página");
  }
}

function initializeModal() {
  const modalPago = document.getElementById("modalPago");
  const modalServiceName = document.getElementById("modalServiceName");
  const modalServicePrice = document.getElementById("modalServicePrice");
  const btnPagoEfectivo = document.getElementById("btnPagoEfectivo");
  const btnPagoTarjeta = document.getElementById("btnPagoTarjeta");
  const closeModal = document.getElementById("closeModal");
  const cancelModal = document.getElementById("cancelModal");

  if (!modalPago) {
    console.warn("Modal de pago no encontrado");
    return;
  }

  // Botones de método de pago
  if (btnPagoEfectivo) {
    btnPagoEfectivo.addEventListener("click", () => {
      seleccionarMetodoPago("efectivo");
    });
  }

  if (btnPagoTarjeta) {
    btnPagoTarjeta.addEventListener("click", () => {
      seleccionarMetodoPago("tarjeta");
    });
  }

  // Botones de cierre
  if (closeModal) {
    closeModal.addEventListener("click", cerrarModal);
  }
  if (cancelModal) {
    cancelModal.addEventListener("click", cerrarModal);
  }
}

async function seleccionarMetodoPago(metodo) {
  metodoPagoSeleccionado = metodo;

  const btnSeleccionado = document.getElementById(
    `btnPago${metodo.charAt(0).toUpperCase() + metodo.slice(1)}`
  );
  if (!btnSeleccionado) return;

  // Visual active
  document
    .querySelectorAll(".payment-method-btn")
    .forEach((btn) => btn.classList.remove("active"));
  btnSeleccionado.classList.add("active");

  // Deshabilitar todos los botones y mostrar spinner solo en el seleccionado
  deshabilitarBotonesPago(true);
  btnSeleccionado.dataset.textoOriginal = btnSeleccionado.innerHTML;
  btnSeleccionado.innerHTML = `${btnSeleccionado.dataset.textoOriginal} <span class="spinner"></span>`;

  try {
    await procesarPago(metodo);
  } catch (err) {
    console.error(err);
  } finally {
    // Habilitar todos los botones y quitar spinner
    btnSeleccionado.innerHTML = btnSeleccionado.dataset.textoOriginal;
    delete btnSeleccionado.dataset.textoOriginal;
    deshabilitarBotonesPago(false);
  }
}

function manejarSeleccionServicio(tipoServicio) {
  servicioSeleccionado = tipoServicio;
  metodoPagoSeleccionado = null; // Resetear método de pago
  mostrarModalPago(tipoServicio);
}

function mostrarModalPago(tipoServicio) {
  const modalPago = document.getElementById("modalPago");
  const modalServiceName = document.getElementById("modalServiceName");
  const modalServicePrice = document.getElementById("modalServicePrice");

  if (!modalPago) return;

  // Actualizar información del servicio con los valores de valores.js
  if (modalServiceName) modalServiceName.textContent = tipoServicio;

  // OBTENER EL VALOR DESDE window.restroom
  const precio = window.restroom ? window.restroom[tipoServicio] : 0;
  if (modalServicePrice) {
    modalServicePrice.textContent = `$${precio}`;
    console.log(`Mostrando modal para ${tipoServicio}: $${precio}`);
  }

  // Remover selección anterior
  const botones = document.querySelectorAll(".payment-method-btn");
  botones.forEach((btn) => btn.classList.remove("active"));

  // Mostrar modal
  modalPago.classList.add("active");
  modalPago.setAttribute("aria-hidden", "false");
}

function procesarPago(metodoPago) {
  const tipoServicio = servicioSeleccionado;
  if (!tipoServicio) return Promise.reject("No hay servicio seleccionado");

  const precio = window.restroom ? window.restroom[tipoServicio] : 0;
  console.log(`Procesando pago ${metodoPago} para ${tipoServicio}: $${precio}`);

  if (metodoPago === "efectivo") {
    return procesarPagoEfectivo(tipoServicio); // RETORNAR la promesa
  } else if (metodoPago === "tarjeta") {
    return procesarPagoTarjeta(tipoServicio); // RETORNAR la promesa
  } else {
    return Promise.reject("Método de pago no soportado");
  }
}

async function procesarPagoEfectivo(tipoServicio) {
  try {
    // Para efectivo, generar QR directamente
    const codigo = await generarQRParaServicio(tipoServicio);
    // await printQR();

    // Generar boleta para efectivo y mostrar folio
    const folio = await generarBoleta(tipoServicio);
    console.log("Folio generado:", folio);

    showToast("Pago en efectivo registrado correctamente.", "success");
    cerrarModal();
  } catch (error) {
    console.error("Error en pago efectivo:", error);
    showToast("Error al procesar pago en efectivo.", "error");
  } finally {
    updateStats();
  }
}

async function procesarPagoTarjeta(tipoServicio) {
  try {
    // 1. Generar código único para el QR
    const codigoQR = generarTokenNumerico(); // o cualquier lógica que uses

    // 2. Usar ese código como ticketNumber para Transbank
    const resultadoTransbank = await procesarConTransbank(
      tipoServicio,
      codigoQR
    );

    if (!resultadoTransbank.success) {
      showToast(
        "Error en pago con tarjeta: " + resultadoTransbank.error,
        "error"
      );
      return;
    }

    // 3. Generar QR usando el mismo código
    await generarQRParaServicio(tipoServicio, codigoQR);

    showToast("Pago con tarjeta procesado correctamente.", "success");
    cerrarModal();
  } catch (error) {
    console.error("Error en pago tarjeta:", error);
    showToast("Error al procesar pago con tarjeta.", "error");
  } finally {
    updateStats();
  }
}

// Función para procesar con Transbank
async function procesarConTransbank(tipoServicio, ticketNumber) {
  try {
    const precio = window.restroom ? window.restroom[tipoServicio] : 0;

    // Llamada al backend que integra Transbank
    const response = await fetch("http://10.5.20.105:3000/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: precio,
        ticketNumber, // usamos el mismo que el QR
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error("Error en Transbank:", data.error);
      return { success: false, error: data.error };
    }

    return {
      success: true,
      idTransaccion: data.data.operationNumber,
      autorizacion: data.data.authorizationCode,
      monto: data.data.amount,
      ultimos4: data.data.last4Digits,
      tipoTarjeta: data.data.cardType,
      marcaTarjeta: data.data.cardBrand,
      mensaje: data.data.responseMessage,
    };
  } catch (error) {
    console.error("Error procesando pago:", error);
    return { success: false, error: error.message };
  }
}

// Función para generar boleta
async function generarBoleta(tipoServicio) {
  const precio = window.restroom ? window.restroom[tipoServicio] : 0;
  const nombre = tipoServicio === "Baño" ? "Bano" : tipoServicio;

  try {
    const response = await fetch(
      "https://backend-banios.dev-wit.com/api/boletas-calama/enviar",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, precio }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error en la API: ${response.status}`);
    }

    const data = await response.json();

    return data.folio;
  } catch (error) {
    console.error("No se pudo generar la boleta:", error);
    return null; // si hay error, retornamos null
  }
}

function cerrarModal() {
  const modalPago = document.getElementById("modalPago");
  if (modalPago) {
    modalPago.classList.remove("active");
    modalPago.setAttribute("aria-hidden", "true");
  }
}

// Función para generar QR específico para servicio
function generarQRParaServicio(tipoServicio) {
  return new Promise(async (resolve, reject) => {
    const contenedorQR = document.getElementById("contenedorQR");
    const contenedorContador = document.getElementById("keycont");

    const id_caja = localStorage.getItem("id_caja");
    if (!id_caja) {
      showToast(
        "Por favor, primero debe abrir la caja antes de generar un código QR.",
        "warning"
      );
      return reject("Caja no abierta");
    }

    const fechaHoraAct = new Date();
    const horaStr =
      fechaHoraAct.getHours().toString().padStart(2, "0") +
      ":" +
      fechaHoraAct.getMinutes().toString().padStart(2, "0") +
      ":" +
      fechaHoraAct.getSeconds().toString().padStart(2, "0");
    const fechaStr = fechaHoraAct.toISOString().split("T")[0];
    const tipoStr = tipoServicio;

    // USAR EL VALOR DESDE window.restroom
    const valor = window.restroom ? window.restroom[tipoServicio] : 0;
    const numeroT = generarTokenNumerico();

    const datos = {
      Codigo: numeroT,
      hora: horaStr,
      fecha: fechaStr,
      tipo: tipoStr,
      valor: valor, // Usar el valor dinámico
      id_caja: id_caja,
    };

    console.log("Enviando datos a API:", datos);

    try {
      await callApi(datos);

      // Ocultar placeholder si existe
      const qrPlaceholder = document.getElementById("qrPlaceholder");
      if (qrPlaceholder) qrPlaceholder.style.display = "none";

      // Limpiar contenedor
      contenedorQR.innerHTML = "";

      // Crear QR
      new QRCode(contenedorQR, {
        text: numeroT,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });

      // Esperar a que el canvas esté listo
      await new Promise((resCanvas) => {
        const interval = setInterval(() => {
          const canvas = contenedorQR.querySelector("canvas");
          if (canvas) {
            clearInterval(interval);
            resCanvas();
          }
        }, 50);
      });

      // Guardar código en el contador
      if (contenedorContador) contenedorContador.value = numeroT;

      // Otros procesos
      leerDatosServer();
      addUser(numeroT);
      addUserAccessLevel(numeroT.substring(0, 6));

      resolve(numeroT);
    } catch (error) {
      console.error("Error al generar QR:", error);
      showToast(
        "Ocurrió un error al generar el QR. Por favor, intente nuevamente.",
        "error"
      );
      reject(error);
    }
  });
}

function initializeFiltersAndVerification() {
  const botonFiltrar = document.getElementById("boton-filtrar");
  const botonVerificar = document.getElementById("boton-verificar");
  const cerrarTabla = document.getElementById("cerrar-tabla");
  const buscadorCodigo = document.getElementById("buscador-codigo");
  const filtroTipo = document.getElementById("filtro-tipo");
  const filtroFecha = document.getElementById("filtro-fecha");
  if (botonFiltrar) botonFiltrar.addEventListener("click", aplicarFiltros);
  if (botonVerificar) botonVerificar.addEventListener("click", verificarCodigo);
  if (cerrarTabla) cerrarTabla.addEventListener("click", cerrarTablaFunc);
  if (buscadorCodigo) buscadorCodigo.addEventListener("input", aplicarFiltros);
  if (filtroTipo) filtroTipo.addEventListener("change", aplicarFiltros);
  if (filtroFecha) filtroFecha.addEventListener("change", aplicarFiltros);
}

// FUNCIONES DE API Y UTILIDADES
async function callApi(datos) {
  let ret = await fetch(urlSave, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Error en la solicitud");
      }
      return response.text();
    })
    .then((result) => {
      console.log("Respuesta del servidor:", result);
    })
    .catch((error) => {
      console.error("Error al enviar la solicitud:", error);
    });
  return ret;
}

function generarTokenNumerico() {
  let token = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 10; i++) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
}

function leerDatosServer() {
  fetch(urlLoad)
    .then((response) => response.json())
    .then((data) => {
      datosGlobales = data;
      aplicarFiltros();
    })
    .catch((error) => {
      console.error("Error al obtener datos:", error);
    });
}

// Función para aplicar filtros
function aplicarFiltros() {
  const buscadorCodigo = document.getElementById("buscador-codigo");
  const filtroTipo = document.getElementById("filtro-tipo");
  const filtroFecha = document.getElementById("filtro-fecha");
  const tablaBody = document.getElementById("tabla-body");
  if (!buscadorCodigo || !filtroTipo || !filtroFecha || !tablaBody) return;
  const codigoFiltro = buscadorCodigo.value.toLowerCase();
  const tipoFiltro = filtroTipo.value;
  const fechaFiltro = filtroFecha.value;
  const datosFiltrados = datosGlobales.filter((item) => {
    const coincideCodigo = item.Codigo.toLowerCase().includes(codigoFiltro);
    const coincideTipo = tipoFiltro === "" || item.tipo === tipoFiltro;
    const coincideFecha = fechaFiltro === "" || item.date === fechaFiltro;
    return coincideCodigo && coincideTipo && coincideFecha;
  });
  const filasHTML = datosFiltrados
    .map(
      (item) => `<tr>
            <td>${item.idrestroom}</td>
            <td>${item.Codigo}</td>
            <td>${item.tipo}</td>
            <td>${item.date}</td>
            <td>${item.time}</td>
        </tr>`
    )
    .join("");
  tablaBody.innerHTML = filasHTML;
}

async function printQR() {
  const keycont = document.getElementById("keycont");
  const contenedorQR = document.getElementById("contenedorQR");
  const qrPlaceholder = document.getElementById("qrPlaceholder");

  if (
    !keycont ||
    !contenedorQR ||
    (qrPlaceholder && qrPlaceholder.style.display !== "none")
  ) {
    showToast("No hay código QR generado para imprimir.", "warning");
    return;
  }

  const codigoQR = keycont.value;
  if (!codigoQR || codigoQR === "Código QR") {
    showToast("No hay código QR generado para imprimir.", "warning");
    return;
  }

  // Usar servicioSeleccionado en lugar de valor fijo "Baño"
  let tipoSeleccionado = servicioSeleccionado || "Baño";
  const dateAct = new Date();
  const horaStr = dateAct.toLocaleTimeString("es-CL");
  const fechaStr = dateAct.toLocaleDateString("es-CL");
  const precio =
    window.restroom?.[tipoSeleccionado] !== undefined
      ? `$${window.restroom[tipoSeleccionado]}`
      : "No definido";

  // Ticket HTML con QR más grande
  const ticketHTML = `
    <div id="ticketImpresion" style="
        width:200px;
        text-align:center;
        font-family:'Courier New', monospace;
        color:#000;
        font-size:14px;
        line-height:1.3;
        padding:5px;
    ">
      <h3 style="font-size:16px;">TICKET DE ACCESO</h3>
      <div style="margin:2px 0;">${fechaStr} ${horaStr}</div>
      <div style="margin:2px 0;">SERVICIO: <b>${tipoSeleccionado}</b></div>
      <div style="margin:2px 0;">VALOR: <b>${precio}</b></div>
      <div style="margin:6px 0; font-size:13px; font-weight:bold;">${codigoQR}</div>
      <div style="margin:10px auto; width:140px;">
        <div style="transform:scale(1); transform-origin:center;">
          ${contenedorQR.innerHTML}
        </div>
      </div>
      <div style="margin-top:8px; font-size:12px;">¡GRACIAS POR SU PREFERENCIA!</div>
    </div>`;

  const div = document.createElement("div");
  div.innerHTML = ticketHTML;
  div.style.position = "fixed";
  div.style.left = "-9999px";
  document.body.appendChild(div);

  try {
    // Capturar el ticket con buena resolución
    const canvas = await html2canvas(div, { scale: 4 });
    const imgData = canvas.toDataURL("image/png");

    // Crear PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [58, 95], // un poco más alto por el QR más grande
    });

    pdf.addImage(imgData, "PNG", 2, 2, 54, 0);
    const pdfBase64 = pdf.output("datauristring").split(",")[1];

    // Enviar a API
    const response = await fetch("http://10.5.20.105:3000/api/imprimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfData: pdfBase64,
        printer: "POS58",
        filename: `voucher_${codigoQR}.pdf`,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      showToast("Error al imprimir: " + data.message, "error");
    }
  } catch (error) {
    console.error(error);
    alert("Error generando o enviando el ticket.");
  } finally {
    document.body.removeChild(div);
  }
}

async function addUser(token) {
  const userData = {
    pin: token,
    idNo: token,
  };
  try {
    let response = await fetch(urlAddUser, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
    let result = await response.text();
    console.log("Respuesta de addUser:", result);
  } catch (error) {
    console.error("Error al agregar usuario:", error);
  }
}

async function addUserAccessLevel(token) {
  const accessData = {
    pin: token,
  };
  try {
    let response = await fetch(urlLevelUser, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accessData),
    });
    let result = await response.text();
    console.log("Respuesta de addLevelUser:", result);
  } catch (error) {
    console.error("Error al asignar niveles de acceso:", error);
  }
}

function verificarCodigo() {
  const botonVerificar = document.getElementById("boton-verificar");
  const buscadorCodigo = document.getElementById("buscador-codigo");
  const resultadoDiv = document.getElementById("resultado-verificacion");
  const tablaResultados = document.getElementById("tabla-resultados");

  if (!botonVerificar || !buscadorCodigo || !resultadoDiv || !tablaResultados)
    return;

  const codigoInput = buscadorCodigo.value.trim();
  if (!codigoInput || codigoInput.length < 6) {
    showToast("El código debe tener al menos 6 caracteres.", "warning");
    return;
  }

  const originalContent = botonVerificar.innerHTML;
  botonVerificar.innerHTML = `Verificando <span class="spinner"></span>`;
  botonVerificar.disabled = true;

  fetch(`${urlBoleto}?userPin=${encodeURIComponent(codigoInput)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(`Error del servidor: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      tablaResultados.innerHTML = "";
      if (data.error) {
        tablaResultados.innerHTML = `<tr><td colspan="4" style="color: red;">Error: ${data.error}</td></tr>`;
      } else {
        const mensaje = data.message || "Verificación exitosa";
        const fecha = data.eventTime || "N/A";
        const puerta = data.doorName || "N/A";
        tablaResultados.innerHTML = `<tr>
          <td>${codigoInput}</td>
          <td>${mensaje}</td>
          <td>${fecha}</td>
          <td>${puerta}</td>
        </tr>`;
      }
      resultadoDiv.style.display = "block";
    })
    .catch((error) => {
      console.error("Error en la solicitud:", error);
      tablaResultados.innerHTML = `<tr><td colspan="4" style="color: red;">Hubo un problema al verificar el código.</td></tr>`;
      resultadoDiv.style.display = "block";
    })
    .finally(() => {
      botonVerificar.innerHTML = originalContent;
      botonVerificar.disabled = false;
    });
}

function cerrarTablaFunc() {
  const resultadoDiv = document.getElementById("resultado-verificacion");
  if (resultadoDiv) {
    resultadoDiv.style.display = "none";
  }
}

// Función para cargar datos del servidor
async function loadServerData() {
  try {
    const response = await fetch(urlLoad);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error al cargar datos del servidor:", error);
    return [];
  }
}

// Función para actualizar estadísticas con datos del día
async function updateStats() {
  try {
    // Llamar a la API que devuelve los totales del día
    const response = await fetch(urlLoadToday);
    if (!response.ok)
      throw new Error("Error al obtener estadísticas del servidor");
    const stats = await response.json();

    // Actualizar UI solo si los elementos existen
    const totalDay = document.getElementById("totalDay");
    const totalTransactions = document.getElementById("totalTransactions");
    const totalBanosElem = document.getElementById("totalBanos");
    const totalDuchasElem = document.getElementById("totalDuchas");

    if (totalDay) totalDay.textContent = `$${stats.totalAmount}`;
    if (totalTransactions)
      totalTransactions.textContent = stats.totalTransactions;
    if (totalBanosElem) totalBanosElem.textContent = stats.totalBanos;
    if (totalDuchasElem) totalDuchasElem.textContent = stats.totalDuchas;
  } catch (error) {
    console.error("Error al actualizar estadísticas:", error);
  }
}

// Función para renderizar historial con datos del servidor
async function renderHistory() {
  try {
    const serverData = await loadServerData();
    datosGlobales = serverData;
    const tbody = document.getElementById("tabla-body");
    if (!tbody) return;
    if (serverData.length === 0) {
      tbody.innerHTML = `<tr>
                <td colspan="5" style="text-align: center; color: #a3a3a3;">
                    No hay transacciones registradas
                </td>
            </tr>`;
      return;
    }
    tbody.innerHTML = serverData
      .map(
        (t) => `<tr>
                <td>${t.idrestroom}</td>
                <td><code style="color: #3b82f6;">${t.Codigo}</code></td>
                <td>${t.tipo}</td>
                <td>${t.date}</td>
                <td>${t.time}</td>
            </tr>`
      )
      .join("");
  } catch (error) {
    console.error("Error al renderizar historial:", error);
  }
}

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  // Limitar a máximo 5 toasts
  while (container.children.length >= 5) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button>&times;</button>
  `;

  // Cerrar manualmente
  toast.querySelector("button").addEventListener("click", () => {
    toast.style.animation = "slide-out 0.5s forwards";
    setTimeout(() => {
      if (toast.parentNode) container.removeChild(toast);
    }, 500);
  });

  container.appendChild(toast);

  // Auto-cerrar con animación
  setTimeout(() => {
    toast.style.animation = "slide-out 0.5s forwards";
    setTimeout(() => {
      if (toast.parentNode) container.removeChild(toast);
    }, 500);
  }, duration);
}

function generarQRPlaceholder() {
  const contenedorQR = document.getElementById("contenedorQR");
  const qrPlaceholder = document.getElementById("qrPlaceholder");

  if (!contenedorQR) return;

  // Ocultar texto e ícono del placeholder
  if (qrPlaceholder) qrPlaceholder.style.display = "none";

  // Limpiar contenedor
  contenedorQR.innerHTML = "";

  // Texto ficticio para el QR de placeholder
  const placeholderCode = "PLACEHOLDER";

  // Crear QR
  new QRCode(contenedorQR, {
    text: placeholderCode,
    width: 256,
    height: 256,
    colorDark: "#000000ff", // color gris para diferenciar
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
}

function mostrarSpinnerEnModal(botonSeleccionado) {
  const botones = document.querySelectorAll(".payment-method-btn");
  botones.forEach((btn) => (btn.disabled = true)); // deshabilitar todos

  botonSeleccionado.dataset.textoOriginal = botonSeleccionado.innerHTML;
  botonSeleccionado.innerHTML = `${botonSeleccionado.dataset.textoOriginal} <span class="spinner"></span>`;
}

function quitarSpinnerEnModal() {
  const botones = document.querySelectorAll(".payment-method-btn");
  botones.forEach((btn) => {
    btn.disabled = false;
    if (btn.dataset.textoOriginal) {
      btn.innerHTML = btn.dataset.textoOriginal;
    }
  });
}

function deshabilitarBotonesPago(deshabilitar = true) {
  const modalPago = document.getElementById("modalPago");
  if (modalPago) {
    // Seleccionamos todos los elementos clickeables dentro del modal
    modalPago.querySelectorAll(".payment-method-btn, button").forEach((el) => {
      if (el.tagName === "DIV") {
        // Para los divs de métodos de pago
        el.style.pointerEvents = deshabilitar ? "none" : "auto";
      } else {
        // Para los botones (Cancelar y X)
        el.disabled = deshabilitar;
      }
      // Clases de estilo visual
      el.classList.toggle("opacity-50", deshabilitar);
      el.classList.toggle("cursor-not-allowed", deshabilitar);
    });
  }
}
