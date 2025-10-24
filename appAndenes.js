// === MIDDLEWARE DE VERIFICACIÓN DE ACCESO ===
const verificarAccesoSeccion = (seccionRequerida) => {
  try {
    // Obtener usuario del localStorage
    const userData = localStorage.getItem("user");

    if (!userData) {
      // Si no hay usuario, redirigir al login
      alert("Usuario no autenticado. Será redirigido al login.");
      window.location.href = "index.html";
      return false;
    }

    const usuario = JSON.parse(userData);
    const seccionesPermitidas = usuario.secciones || [];

    // Si el usuario es administrador (nivel 0), permitir acceso a todas las secciones
    if (usuario.nivel === 0) {
      return true;
    }

    // Verificar si tiene acceso a la sección requerida
    const tieneAcceso = seccionesPermitidas.some(
      (seccion) => seccion.toLowerCase() === seccionRequerida.toLowerCase()
    );

    if (!tieneAcceso) {
      alert(
        `No tienes permisos para acceder a la sección: ${seccionRequerida}`
      );
      window.location.href = "dashboard.html";
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error verificando acceso:", error);
    alert("Error verificando permisos de acceso");
    window.location.href = "dashboard.html";
    return false;
  }
};

// === VERIFICACIÓN DE ACCESO INMEDIATA ===
if (!verificarAccesoSeccion("andenes")) {
  // Si no tiene acceso, el middleware ya redirige automáticamente
  // No ejecutar el resto del código
  throw new Error("Acceso denegado a sección andenes");
}
let valorTotGlobal = 0; // Variable global para almacenar el valor total

// --- CONFIGURACIÓN GLOBAL ---

const ENV = window.APP_ENV;
const BASE_URL = window.BASE_URL;
const URL_LOCAL = window.URL_LOCAL;
const URL_PAYMENT_EFECTIVO = window.URL_PAYMENT_EFECTIVO;

const apiDestinos = (BASE_URL || "") + "parkingCalama/php/destinos/api.php";
const apiMovimientos =
  (BASE_URL || "") + "parkingCalama/php/movimientos/api.php";
const apiEmpresas = (BASE_URL || "") + "parkingCalama/php/empresas/api.php";
const apiWhitelist = (BASE_URL || "") + "parkingCalama/php/whitelist/api.php";

const API_PAYMENT_TARJETA = `${URL_LOCAL}/api/payment`;
const API_IMPRESION = `${URL_LOCAL}/api/imprimir`;

const patRegEx = /^[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}$/;

// Variables para el sistema de pago
let servicioSeleccionado = null;
let metodoPagoSeleccionado = null;

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

$(document).ready(function () {
  $("#destinoBuses").select2({
    placeholder: "Seleccione un destino",
    allowClear: true,
    width: "100%",
  });
});

// Inicialización del sistema de pago
document.addEventListener("DOMContentLoaded", function () {
  initializePaymentSystem();
  listarAndenesEmpresas();
});

function initializePaymentSystem() {
  initializeModal();
}

// Sistema de Modal de Pago
function initializeModal() {
  const modalPago = document.getElementById("modalPago");
  const btnPagoEfectivo = document.getElementById("btnPagoEfectivo");
  const btnPagoTarjeta = document.getElementById("btnPagoTarjeta");
  const closeModal = document.getElementById("closeModal");
  const cancelModal = document.getElementById("cancelModal");

  if (!modalPago) {
    console.warn("Modal de pago no encontrado");
    return;
  }

  // Configurar eventos de métodos de pago
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

  // Visual active state
  document
    .querySelectorAll(".payment-method-btn")
    .forEach((btn) => btn.classList.remove("active"));
  btnSeleccionado.classList.add("active");

  // Deshabilitar botones y mostrar spinner
  deshabilitarBotonesPago(true);
  btnSeleccionado.dataset.textoOriginal = btnSeleccionado.innerHTML;
  btnSeleccionado.innerHTML = `${btnSeleccionado.dataset.textoOriginal} <span class="spinner"></span>`;

  try {
    await procesarPago(metodo);
  } catch (err) {
    console.error(err);
    showToast("Error al procesar el pago", "error");
  } finally {
    // Restaurar estado de botones
    btnSeleccionado.innerHTML = btnSeleccionado.dataset.textoOriginal;
    delete btnSeleccionado.dataset.textoOriginal;
    deshabilitarBotonesPago(false);
  }
}

function procesarPago(metodoPago) {
  if (!servicioSeleccionado)
    return Promise.reject("No hay servicio seleccionado");

  console.log(`Procesando pago ${metodoPago} para andén: $${valorTotGlobal}`);

  if (metodoPago === "efectivo") {
    return procesarPagoEfectivo();
  } else if (metodoPago === "tarjeta") {
    return procesarPagoTarjeta();
  } else {
    return Promise.reject("Método de pago no soportado");
  }
}

async function procesarPagoEfectivo() {
  try {
    const folio = await generarBoleta();
    console.log("Folio generado:", folio);
    if (!folio) {
      showToast("No se pudo generar el folio de boleta.", "error");
      return;
    }

    await pagarAndenConMetodo("efectivo", folio);

    showToast("Pago en efectivo registrado correctamente.", "success");
    cerrarModal();
  } catch (error) {
    console.error("Error en pago efectivo:", error);
    showToast("Error al procesar pago en efectivo.", "error");
    throw error;
  }
}

async function generarBoleta() {
  const precio = valorTotGlobal;
  const nombre = "Anden";
  console.log("Precio:", precio, "Nombre:", nombre);
  try {
    const response = await fetch(URL_PAYMENT_EFECTIVO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, precio }),
    });

    if (!response.ok) {
      throw new Error(`Error en la API: ${response.status}`);
    }

    const data = await response.json();
    return data.folio;
  } catch (error) {
    console.error("No se pudo generar la boleta:", error);
    return null;
  }
}

async function procesarPagoTarjeta() {
  try {
    // Procesar con Transbank
    const resultadoTransbank = await procesarConTransbank();

    if (!resultadoTransbank.success) {
      showToast(
        "Error en pago con tarjeta: " + resultadoTransbank.error,
        "error"
      );
      return;
    }

    // Si el pago con tarjeta fue exitoso, procesar el pago
    await pagarAndenConMetodo("tarjeta", resultadoTransbank.autorizacion);

    showToast("Pago con tarjeta procesado correctamente.", "success");
    cerrarModal();
  } catch (error) {
    console.error("Error en pago tarjeta:", error);
    showToast("Error al procesar pago con tarjeta.", "error");
    throw error;
  }
}

// Función para procesar con Transbank
async function procesarConTransbank() {
  try {
    const response = await fetch(API_PAYMENT_TARJETA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: valorTotGlobal,
        ticketNumber: generarTokenNumerico(),
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

// Función modificada para pagar con método de pago
async function pagarAndenConMetodo(metodoPago, autorizacion = null) {
  const input = document.getElementById("andenQRPat").value;
  const cont = document.getElementById("contAnden");
  const empresaSelect = document.getElementById("empresaBuses");
  const btnPagoEfectivo = document.getElementById("btnPagoEfectivo");
  const btnPagoTarjeta = document.getElementById("btnPagoTarjeta");
  const date = new Date();

  // Validación de id_caja en localStorage
  const id_caja = localStorage.getItem("id_caja");
  if (!id_caja) {
    throw new Error("Caja no abierta");
  }

  if (!patRegEx.test(input)) {
    throw new Error("Patente inválida");
  }

  const data = await getMovByPatente(input);
  if (!data) {
    throw new Error("Patente no encontrada");
  }

  if (data["tipo"].toLowerCase() === "anden") {
    if (data["fechasal"] === "0000-00-00") {
      console.log("Patente válida, registrando el pago...");

      const empresaSeleccionada =
        empresaSelect.value !== "0" ? empresaSelect.value : null;

      if (!empresaSeleccionada || empresaSeleccionada === "0") {
        throw new Error("Debe seleccionar una empresa antes de pagar.");
      }

      const datos = {
        id: data["idmov"],
        patente: data["patente"],
        fecha: date.toISOString().split("T")[0],
        hora: `${date.getHours().toString().padStart(2, "0")}:${date
          .getMinutes()
          .toString()
          .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`,
        valor: valorTotGlobal,
        empresa: empresaSeleccionada,
        empresaNombre: window.datosAnden.empresaNombre,
        destino:
          document.getElementById("destinoBuses").options[
            document.getElementById("destinoBuses").selectedIndex
          ].text,
        id_caja: id_caja,
        medio_pago: metodoPago,
        autorizacion_tarjeta: autorizacion,
      };

      // Llamar a la API para actualizar el movimiento
      const response = await fetch(apiMovimientos, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("jwt")}`,
        },
        body: JSON.stringify(datos),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      if (result.msg) {
        // Imprimir boleta térmica
        await imprimirBoletaTermicaAndenes(datos);

        // Limpiar el formulario
        document.getElementById("andenQRPat").value = "";
        cont.innerHTML = `
          <div class="empty-state">
            <h3>Sin datos para mostrar</h3>
            <p>Ingrese una patente y calcule para ver los detalles</p>
          </div>
        `;
        // payBtn.disabled = true;
        btnPagoEfectivo.disabled = true;
        btnPagoTarjeta.disabled = true;
        cont.classList.remove("loaded");

        return result;
      } else {
        throw new Error("Error al registrar el pago: " + result.error);
      }
    } else {
      throw new Error("Esta patente ya fue cobrada");
    }
  } else {
    throw new Error("La patente pertenece a un tipo distinto de movimiento.");
  }
}

function mostrarModalPago() {
  const modalPago = document.getElementById("modalPago");
  const modalServiceName = document.getElementById("modalServiceName");
  const modalServicePrice = document.getElementById("modalServicePrice");

  if (!modalPago) return;

  // Actualizar información del servicio
  if (modalServiceName) modalServiceName.textContent = "Estacionamiento Andén";
  if (modalServicePrice)
    modalServicePrice.textContent = `$${valorTotGlobal.toFixed(0)}`;

  // Remover selección anterior de métodos
  const botones = document.querySelectorAll(".payment-method-btn");
  botones.forEach((btn) => btn.classList.remove("active"));

  // Mostrar modal
  modalPago.classList.add("active");
  modalPago.setAttribute("aria-hidden", "false");
}

function cerrarModal() {
  const modalPago = document.getElementById("modalPago");
  if (modalPago) {
    modalPago.classList.remove("active");
    modalPago.setAttribute("aria-hidden", "true");
  }
}

function deshabilitarBotonesPago(deshabilitar = true) {
  const modalPago = document.getElementById("modalPago");
  if (modalPago) {
    modalPago.querySelectorAll(".payment-method-btn, button").forEach((el) => {
      if (el.tagName === "DIV") {
        el.style.pointerEvents = deshabilitar ? "none" : "auto";
      } else {
        el.disabled = deshabilitar;
      }
      el.classList.toggle("opacity-50", deshabilitar);
      el.classList.toggle("cursor-not-allowed", deshabilitar);
    });
  }
}

function generarTokenNumerico() {
  let token = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 10; i++) {
    token += Math.floor(Math.random() * 10);
  }
  return token;
}

// Función original modificada para abrir modal de pago
async function calcAndenes() {
  const id_caja = localStorage.getItem("id_caja");
  if (!id_caja) {
    showToast(
      "Por favor, primero debe abrir la caja antes de realizar un pago.",
      "warning"
    );
    return;
  }

  const patente = document
    .getElementById("andenQRPat")
    .value.trim()
    .toUpperCase();
  const cont = document.getElementById("contAnden");
  const destinoSelect = document.getElementById("destinoBuses");
  const empresaSelect = document.getElementById("empresaBuses");

  if (!patente) {
    showToast("Ingrese una patente válida.", "warning");
    return;
  }

  if (empresaSelect.value === "0" || destinoSelect.value === "0") {
    showToast("Seleccione Empresa y Destino.", "warning");
    return;
  }

  try {
    const data = await getMovByPatente(patente);
    if (!data || Object.keys(data).length === 0) {
      showToast("Patente no encontrada.", "error");
      return;
    }

    if (data["tipo"].toLowerCase() !== "anden") {
      showToast("La patente corresponde a otro tipo de movimiento.", "warning");
      return;
    }

    if (data["fechasal"] !== "0000-00-00") {
      showToast("Esta patente ya fue cobrada.", "warning");
      return;
    }

    cont.innerHTML = "";
    cont.classList.remove("loaded");
    void cont.offsetWidth;

    const fechaActual = new Date();
    const fechaEntrada = new Date(`${data["fechaent"]}T${data["horaent"]}`);
    const minutos = Math.ceil((fechaActual - fechaEntrada) / 60000);

    const destOption = destinoSelect.options[destinoSelect.selectedIndex];
    const empresaOption = empresaSelect.options[empresaSelect.selectedIndex];

    const destInfo = {
      tipo: destOption.dataset.tipo,
      valor: Number(destOption.dataset.valor),
    };

    const empresaInfo = {
      nombre: empresaOption.dataset.nombre,
    };

    if (!destInfo.tipo || isNaN(destInfo.valor)) {
      showToast("Error: datos del destino inválidos.", "error");
      return;
    }

    // Calcular valor total
    let valorBase = destInfo.valor || 0;
    let bloques =
      destInfo.tipo === "nacional"
        ? Math.ceil(minutos / configuracion.nacional)
        : Math.ceil(minutos / configuracion.internacional);

    valorBase *= bloques;
    valorTotGlobal = Math.max(valorBase, 0);

    const ret = await getWLByPatente(data["patente"]);
    const isWhitelist = ret !== null;
    if (isWhitelist) valorTotGlobal = 0;

    const iva = valorTotGlobal * configuracion.iva;
    const valorConIVA = valorTotGlobal + iva;
    const nowTime = `${fechaActual
      .getHours()
      .toString()
      .padStart(2, "0")}:${fechaActual
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${fechaActual
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;

    // Crear estructura HTML
    const paymentHTML = `
      <div class="panel-header">
        <h2>Detalles del Pago</h2>
        <p>Resumen del cálculo y opciones de pago</p>
      </div>

      <div class="payment-info-compact">
        <div class="info-item"><span class="info-label">Empresa:</span><span class="info-value">${
          empresaInfo.nombre
        }</span></div>
        <div class="info-item"><span class="info-label">Patente:</span><span class="info-value">${patente}</span></div>
        <div class="info-item"><span class="info-label">Fecha ingreso:</span><span class="info-value">${
          data["fechaent"]
        }</span></div>
        <div class="info-item"><span class="info-label">Hora ingreso:</span><span class="info-value">${
          data["horaent"]
        }</span></div>
        <div class="info-item"><span class="info-label">Hora salida:</span><span class="info-value">${nowTime}</span></div>
        <div class="info-item highlight"><span class="info-label">Tiempo estacionado:</span><span class="info-value">${minutos} minutos</span></div>
      </div>

      ${
        !isWhitelist
          ? `
            <div class="payment-breakdown">
              <div class="payment-breakdown-title">Desglose de Costos</div>
              <div class="payment-breakdown-item"><span class="payment-breakdown-label">Tarifa base (${bloques} bloques)</span><span class="payment-breakdown-value">$${valorBase.toFixed(
              0
            )}</span></div>
              <div class="payment-breakdown-item"><span class="payment-breakdown-label">IVA (${(
                configuracion.iva * 100
              ).toFixed(
                0
              )}%)</span><span class="payment-breakdown-value">$${iva.toFixed(
              0
            )}</span></div>
            </div>
            <div class="payment-summary clickable" id="proceedToPayment">
              <div class="payment-summary-title">Total a Pagar</div>
              <div class="payment-total-amount">$${valorConIVA.toFixed(0)}</div>
              <div class="payment-total-label">Haga clic para seleccionar método de pago</div>
            </div>
          `
          : `
            <div class="payment-summary clickable" id="proceedToPayment">
              <div class="payment-summary-title">Vehículo en Lista Blanca</div>
              <div class="payment-total-amount" style="color: var(--success);">$0</div>
              <div class="payment-total-label">Exento de pago — haga clic para registrar salida</div>
            </div>
          `
      }
    `;

    cont.innerHTML = paymentHTML;
    setTimeout(() => cont.classList.add("loaded"), 10);

    const proceedBtn = document.getElementById("proceedToPayment");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", async () => {
        if (isWhitelist) {
          const datos = {
            id: data["idmov"],
            patente: data["patente"],
            fecha: fechaActual.toISOString().split("T")[0],
            hora: nowTime,
            valor: 0,
            empresa: empresaSelect.value,
            empresaNombre: empresaInfo.nombre,
            destino: destinoSelect.options[destinoSelect.selectedIndex].text,
            id_caja,
          };

          try {
            const response = await fetch(apiMovimientos, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getCookie("jwt")}`,
              },
              body: JSON.stringify(datos),
            });

            if (response.ok) {
              showToast(
                "Salida registrada correctamente (Lista Blanca).",
                "success"
              );
              cont.innerHTML = `<div class="empty-state"><h3>Registro completado</h3><p>Vehículo en lista blanca registrado con éxito.</p></div>`;
            } else {
              showToast("Error al registrar salida de whitelist.", "error");
            }
          } catch (err) {
            console.error("Error registrando whitelist:", err);
            showToast("Error en la comunicación con la API.", "error");
          }
        } else {
          servicioSeleccionado = "anden";
          mostrarModalPago();
        }
      });
    }

    window.datosAnden = {
      id: data["idmov"],
      patente: data["patente"],
      fecha: fechaActual.toISOString().split("T")[0],
      hora: nowTime,
      valor: isWhitelist ? 0 : valorConIVA,
      empresa: empresaSelect.value,
      empresaNombre: empresaInfo.nombre,
    };

    valorTotGlobal = isWhitelist ? 0 : valorConIVA;
  } catch (error) {
    console.error("Error en el cálculo:", error);
    showToast("Ocurrió un error al calcular el valor del andén.", "error");
  }
}

// Funciones auxiliares originales
async function getWLByPatente(patIn) {
  let ret = await fetch(
    apiWhitelist + "?" + new URLSearchParams({ patente: patIn }),
    {
      method: "GET",
      mode: "cors",
      headers: { Authorization: `Bearer ${getCookie("jwt")}` },
    }
  )
    .then((reply) => reply.json())
    .then((data) => data)
    .catch((error) => console.log(error));
  return ret;
}

async function getMovByPatente(patente) {
  if (getCookie("jwt")) {
    let ret = await fetch(
      apiMovimientos + "?" + new URLSearchParams({ patente: patente }),
      {
        method: "GET",
        mode: "cors",
        headers: { Authorization: `Bearer ${getCookie("jwt")}` },
      }
    )
      .then((reply) => reply.json())
      .then((data) => data)
      .catch((error) => console.log(error));
    return ret;
  }
}

// Función para listar empresas en el select
function listarAndenesEmpresas() {
  andGetEmpresas()
    .then((data) => {
      if (data) {
        const lista = document.getElementById("empresaBuses");
        lista.innerHTML = ""; // Limpiar el select

        const nullData = document.createElement("option");
        nullData.value = 0;
        nullData.textContent = "Seleccione Empresa";
        lista.appendChild(nullData);

        data.forEach((itm) => {
          const optData = document.createElement("option");
          optData.value = itm["idemp"];
          optData.textContent = itm["nombre"];
          optData.dataset.nombre = itm["nombre"];
          lista.appendChild(optData);
        });
      }
    })
    .catch((error) => {
      console.error("Error al listar empresas:", error);
    });
}

// Función auxiliar para cargar y filtrar destinos
async function cargarDestinos(tipoDest, lista) {
  try {
    const data = await andGetDestinos();
    if (data) {
      lista.textContent = "";
      let nullData = document.createElement("option");
      nullData.value = 0;
      nullData.textContent = "Seleccione Destino";
      lista.appendChild(nullData);

      data.forEach((itm) => {
        if (itm["tipo"] === tipoDest) {
          let optData = document.createElement("option");
          optData.value = itm["iddest"];
          optData.textContent = `${itm["ciudad"]} - $${itm["valor"]}`;
          optData.dataset.tipo = itm["tipo"];
          optData.dataset.valor = itm["valor"];
          lista.appendChild(optData);
        }
      });
    }
  } catch (error) {
    console.error("Error al cargar los destinos:", error);
  }
}

// Función para listar andenes y destinos (también utiliza la función auxiliar)
async function listarAndenesDestinos() {
  const tipoDest = document.getElementById("tipoDestino").value;
  const lista = document.getElementById("destinoBuses");

  if (!tipoDest) {
    lista.textContent = "";
    return;
  }

  await cargarDestinos(tipoDest, lista);

  for (let option of lista.options) {
    if (option.value && option.text.includes(" - ")) {
      option.text = option.text.split(" - ")[0].trim();
    }
  }
}

// Agregar un evento para que se ejecute al cambiar el tipo de destino
document
  .getElementById("tipoDestino")
  .addEventListener("change", listarAndenesDestinos);

// Obtiene la lista de empresas desde la API
async function andGetEmpresas() {
  try {
    const response = await fetch(apiEmpresas, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error al obtener empresas:", error);
    // Redirigir al index.html
    window.location.href = "index.html";
    return null;
  }
}

// Obtiene la lista de destinos desde la API
async function andGetDestinos() {
  if (getCookie("jwt")) {
    try {
      const response = await fetch(apiDestinos, {
        method: "GET",
        mode: "cors",
        headers: {
          Authorization: `Bearer ${getCookie("jwt")}`,
        },
      });
      const ret = await response.json();
      return ret;
    } catch (error) {
      console.error("Error al obtener destinos:", error);
      return null;
    }
  }
}

// Función original de pago (mantenida para compatibilidad)
async function pagarAnden(valorTot = valorTotGlobal) {
  console.log("valorTot recibido en impAnden:", valorTot);

  const input = document.getElementById("andenQRPat").value;
  const cont = document.getElementById("contAnden");
  const empresaSelect = document.getElementById("empresaBuses"); // Captura la empresa seleccionada
  // const payBtn = document.getElementById("payBtn");
  const date = new Date();

  // Validación de id_caja en localStorage
  const id_caja = localStorage.getItem("id_caja");
  if (!id_caja) {
    showToast(
      "Por favor, primero debe abrir la caja antes de realizar un pago.",
      "warning"
    );
    return; // Detiene la ejecución si no hay id_caja
  }

  if (!patRegEx.test(input)) {
    console.log("No es patente, leer QR");
    return;
  }

  try {
    const data = await getMovByPatente(input);
    if (!data) {
      showToast("Patente no encontrada", "error");
      return;
    }

    if (data["tipo"].toLowerCase() === "anden") {
      if (data["fechasal"] === "0000-00-00") {
        console.log("Patente válida, registrando el pago...");

        const empresaSeleccionada =
          empresaSelect.value !== "0" ? empresaSelect.value : null;

        if (!empresaSeleccionada || empresaSeleccionada === "0") {
          showToast("Debe seleccionar una empresa antes de pagar.", "warning");
          return;
        }

        const datos = {
          id: data["idmov"],
          patente: data["patente"],
          fecha: date.toISOString().split("T")[0],
          hora: `${date.getHours().toString().padStart(2, "0")}:${date
            .getMinutes()
            .toString()
            .padStart(2, "0")}:${date
            .getSeconds()
            .toString()
            .padStart(2, "0")}`,
          valor: valorTot,
          empresa: empresaSeleccionada, // Insertar el ID de la empresa seleccionada
          empresaNombre: window.datosAnden.empresaNombre, // Insertar el nombre de la empresa seleccionada
          destino:
            document.getElementById("destinoBuses").options[
              document.getElementById("destinoBuses").selectedIndex
            ].text, // Obtener destino seleccionado
          id_caja: id_caja,
        };

        // Llamar a la API para actualizar el movimiento antes de imprimir la boleta
        const response = await fetch(apiMovimientos, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("jwt")}`,
          },
          body: JSON.stringify(datos),
        });

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        if (result.msg) {
          showToast("Pago registrado correctamente.", "success");
          imprimirBoletaTermicaAndenes(datos);
        } else {
          showToast("Error al registrar el pago: " + result.error, "error");
        }

        // Limpiar el formulario
        document.getElementById("andenQRPat").value = "";
        cont.innerHTML = `
          <div class="empty-state">
            <h3>Sin datos para mostrar</h3>
            <p>Ingrese una patente y calcule para ver los detalles</p>
          </div>
        `;
        // payBtn.disabled = true;
        btnPagoEfectivo.disabled = true;
        btnPagoTarjeta.disabled = true;
        cont.classList.remove("loaded");
      } else {
        showToast("Esta patente ya fue cobrada", "warning");
      }
    } else {
      showToast(
        "La patente pertenece a un tipo distinto de movimiento.",
        "warning"
      );
    }
  } catch (error) {
    console.error("Error:", error);
    showToast("Ocurrió un error al procesar la solicitud.", "error");
  }
}

async function imprimirBoletaTermicaAndenes(datos) {
  const dateAct = new Date();
  const fechaStr = dateAct.toLocaleDateString("es-CL");
  const horaStr = dateAct.toLocaleTimeString("es-CL");
  const destino = datos.destino.split(" - ")[0].trim();
  const patente = datos.patente.toUpperCase();
  const medio_pago = datos.medio_pago?.toUpperCase() || "EFECTIVO";

  // HTML del ticket térmico con fuente legible
  const ticketHTML = `
    <div id="ticketImpresion" style="
        width:200px;
        text-align:center;
        font-family:'Arial', 'Helvetica', sans-serif;
        color:#000;
        font-size:13px;
        line-height:1.35;
        padding:6px;
    ">
      <h3 style="font-size:15px; font-weight:700; margin-bottom:2px;">TERMINAL CALAMA</h3>
      <div style="margin:2px 0;">BOLETA DE ANDÉN</div>
      <div style="margin:2px 0;">${fechaStr} ${horaStr}</div>
      <div style="margin:4px 0;">----------------------------------</div>
      <div style="margin:2px 0;">PATENTE: <b>${patente}</b></div>
      <div style="margin:2px 0;">EMPRESA: <b>${datos.empresaNombre}</b></div>
      <div style="margin:2px 0;">DESTINO: <b>${destino}</b></div>
      <div style="margin:2px 0;">VALOR TOTAL: <b>$${datos.valor}</b></div>
      <div style="margin:2px 0;">MÉTODO PAGO: <b>${medio_pago}</b></div>
      ${
        datos.autorizacion_tarjeta
          ? `<div style="margin:2px 0;">BOLETA: <b>${datos.autorizacion_tarjeta}</b></div>`
          : ""
      }
      <div style="margin:4px 0;">----------------------------------</div>
      <div style="margin-top:4px; font-size:12px; font-weight:600;">VÁLIDO COMO BOLETA</div>
      <div style="margin-top:6px; font-size:12px;">¡GRACIAS POR SU VISITA!</div>
    </div>`;

  // Crear un div temporal fuera de pantalla
  const div = document.createElement("div");
  div.innerHTML = ticketHTML;
  div.style.position = "fixed";
  div.style.left = "-9999px";
  document.body.appendChild(div);

  try {
    // Capturar el HTML como imagen de alta resolución
    const canvas = await html2canvas(div, { scale: 4 });
    const imgData = canvas.toDataURL("image/png");

    // Crear PDF tipo térmico (58 mm)
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [58, 100],
    });

    pdf.addImage(imgData, "PNG", 2, 2, 54, 0);
    const pdfBase64 = pdf.output("datauristring").split(",")[1];

    // Enviar el PDF al servidor de impresión
    const response = await fetch(API_IMPRESION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfData: pdfBase64,
        printer: "POS58",
        filename: `boleta_anden_${patente}.pdf`,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showToast("Boleta enviada a impresión correctamente.", "success");
    } else {
      showToast("Error al imprimir: " + data.message, "error");
    }
  } catch (error) {
    console.error("Error al imprimir boleta térmica:", error);
    showToast("Error generando o enviando la boleta térmica.", "error");
  } finally {
    document.body.removeChild(div);
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
