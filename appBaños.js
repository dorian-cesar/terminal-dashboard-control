// Variables globales
let datosGlobales = [];
const urlBase = "https://andenes.terminal-calama.com";
const urlServer = "https://andenes.terminal-calama.com";
const urlLoad = urlServer + "/TerminalCalama/PHP/Restroom/load.php";
const urlSave = urlServer + "/TerminalCalama/PHP/Restroom/save.php";
const urlAddUser = urlServer + "/TerminalCalama/PHP/Restroom/addUser.php";
const urlLevelUser =
  urlServer + "/TerminalCalama/PHP/Restroom/addLevelUser.php";
const urlBoleto = urlServer + "/TerminalCalama/PHP/Restroom/estadoBoleto.php";
console.log(urlBase);

// Inicialización condicional basada en la página actual
document.addEventListener("DOMContentLoaded", function () {
  // Solo inicializar elementos que existen en esta página
  initializePage();
});

function initializePage() {
  // Inicializar valores de servicios si los elementos existen
  const valorBaño = document.getElementById("valorBaño");
  const valorDucha = document.getElementById("valorDucha");
  if (valorBaño && valorDucha && window.restroom) {
    valorBaño.textContent = `$${window.restroom.Baño}`;
    valorDucha.textContent = `$${window.restroom.Ducha}`;
  }

  // Configurar eventos para los botones de servicio
  const btnBaño = document.getElementById("btnBaño");
  const btnDucha = document.getElementById("btnDucha");

  if (btnBaño && btnDucha) {
    // Configurar eventos click para los botones
    btnBaño.addEventListener("click", () => {
      manejarSeleccionServicio("Baño");
    });

    btnDucha.addEventListener("click", () => {
      manejarSeleccionServicio("Ducha");
    });
  }

  // Ocultar el botón "Generar QR" y "Imprimir QR" ya que la funcionalidad se hace con los botones de servicio
  const genQR = document.getElementById("generar");
  if (genQR) {
    genQR.style.display = "none";
  }

  const btnImprimir = document.querySelector(".btn-success");
  if (btnImprimir) {
    btnImprimir.style.display = "none";
  }

  // Inicializar generación de QR si los elementos existen
  const contenedorQR = document.getElementById("contenedorQR");
  const contenedorContador = document.getElementById("keycont");

  // Inicializar con placeholder
  if (contenedorContador) {
    contenedorContador.value = "Código QR";
  }

  // Inicializar estadísticas y tabla si los elementos existen
  const totalDay = document.getElementById("totalDay");
  const tablaBody = document.getElementById("tabla-body");
  if (totalDay || tablaBody) {
    updateStats();
    renderHistory();
  }

  // Inicializar filtros y verificación si los elementos existen
  initializeFiltersAndVerification();

  // Inicializar jQuery para boletas si el elemento existe
  initializeBoletaGeneration();
}

// Función para manejar la selección de servicio
async function manejarSeleccionServicio(tipoServicio) {
  const btnBaño = document.getElementById("btnBaño");
  const btnDucha = document.getElementById("btnDucha");

  // Deshabilitar los botones temporalmente durante la generación
  btnBaño.disabled = true;
  btnDucha.disabled = true;

  // Ejecutar generación de QR
  await generarQRParaServicio(tipoServicio);

  // Ejecutar impresión de QR automáticamente
  setTimeout(() => {
    printQR();

    // Re-habilitar los botones después de imprimir
    setTimeout(() => {
      btnBaño.disabled = false;
      btnDucha.disabled = false;
    }, 1000);
  }, 500);
}

// Nueva función para generar QR específico para servicio
async function generarQRParaServicio(tipoServicio) {
  const contenedorQR = document.getElementById("contenedorQR");
  const contenedorContador = document.getElementById("keycont");

  const id_caja = "12345";

  const fechaHoraAct = new Date();
  const horaStr =
    fechaHoraAct.getHours() +
    ":" +
    fechaHoraAct.getMinutes() +
    ":" +
    fechaHoraAct.getSeconds();
  const fechaStr = fechaHoraAct.toISOString().split("T")[0];
  const tipoStr = tipoServicio;
  const numeroT = generarTokenNumerico();

  const datos = {
    Codigo: numeroT,
    hora: horaStr,
    fecha: fechaStr,
    tipo: tipoStr,
    valor: window.restroom[tipoStr] || 0,
    id_caja: id_caja,
  };

  try {
    const res = await callApi(datos);
    const qrPlaceholder = document.getElementById("qrPlaceholder");

    // Ocultar el placeholder
    if (qrPlaceholder) {
      qrPlaceholder.style.display = "none";
    }

    // Limpiar completamente el contenedor
    contenedorQR.innerHTML = "";

    // Crear una NUEVA instancia de QRCode cada vez
    new QRCode(contenedorQR, {
      text: numeroT,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });

    if (contenedorContador) {
      contenedorContador.value = numeroT;
    }

    leerDatosServer();
    addUser(numeroT);

    setTimeout(() => {
      let name = numeroT.substring(0, 6);
      console.log(name);
      addUserAccessLevel(name);
    }, 1000);
  } catch (error) {
    console.error("Error al generar QR:", error);
    alert("Ocurrió un error al generar el QR. Por favor, intente nuevamente.");
    // Re-habilitar los botones en caso de error
    const btnBaño = document.getElementById("btnBaño");
    const btnDucha = document.getElementById("btnDucha");
    if (btnBaño && btnDucha) {
      btnBaño.disabled = false;
      btnDucha.disabled = false;
    }
  }
}

function initializeFiltersAndVerification() {
  const botonFiltrar = document.getElementById("boton-filtrar");
  const botonVerificar = document.getElementById("boton-verificar");
  const cerrarTabla = document.getElementById("cerrar-tabla");
  const buscadorCodigo = document.getElementById("buscador-codigo");
  const filtroTipo = document.getElementById("filtro-tipo");
  if (botonFiltrar) {
    botonFiltrar.addEventListener("click", aplicarFiltros);
  }
  if (botonVerificar) {
    botonVerificar.addEventListener("click", verificarCodigo);
  }
  if (cerrarTabla) {
    cerrarTabla.addEventListener("click", cerrarTablaFunc);
  }
  if (buscadorCodigo) {
    buscadorCodigo.addEventListener("input", aplicarFiltros);
  }
  if (filtroTipo) {
    filtroTipo.addEventListener("change", aplicarFiltros);
  }
}

function initializeBoletaGeneration() {
  // Solo inicializar jQuery si estamos en la página principal
  const entradaBtn = document.getElementById("entrada");
  if (entradaBtn && typeof $ !== "undefined") {
    $(document).ready(function () {
      $("#entrada").click(function (event) {
        event.preventDefault();
        // Como ya no hay radio buttons, usar el último servicio seleccionado
        let servicio = "Baño"; // Valor por defecto
        let valor = String(window.restroom[servicio]);
        console.log("Servicio seleccionado:", servicio);
        console.log("Valor asignado:", valor);
        if (!valor) {
          console.error(
            "El valor no fue encontrado para el servicio:",
            servicio
          );
          $("#resultado").html(
            "<div class='alert alert-warning'>Tipo de servicio no válido.</div>"
          );
          return;
        }
        let payload = {
          codigoEmpresa: "89",
          tipoDocumento: "39",
          total: valor,
          detalleBoleta: `53-${valor}-1-dsa-${servicio}`,
        };
        console.log("Payload preparado para el envío:", payload);
        $("#resultado").html(
          "<div class='loading'>Generando boleta, por favor espere...</div>"
        );
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
                let boletaHtml = `<div class='alert alert-success'>
                                    <p><strong>Boleta generada con éxito.</strong></p>
                                    <p><strong>Folio:</strong> ${response.folio}</p>
                                    <p><strong>Fecha:</strong> ${response.fecha}</p>
                                </div>
                                <div class="mt-3">
                                    <a href='${response.rutaAcepta}' target='_blank' class='btn'>Ver Boleta</a>
                                </div>`;
                $("#resultado").html(boletaHtml);
                console.log("Boleta generada correctamente.");
              } else {
                $("#resultado").html(
                  "<div class='alert alert-danger'>Error al generar la boleta.</div>"
                );
                console.warn("Error en la respuesta del servidor:", response);
              }
            } catch (error) {
              console.error("Error al procesar la respuesta:", error);
              $("#resultado").html(
                "<div class='alert alert-danger'>Error inesperado. Consulte la consola para más detalles.</div>"
              );
            }
          },
          error: function (jqXHR, textStatus, errorThrown) {
            console.error(
              "Error en la solicitud AJAX:",
              textStatus,
              errorThrown
            );
            $("#resultado").html(
              "<div class='alert alert-danger'>Error en la comunicación con el servidor.</div>"
            );
          },
          complete: function () {
            console.log("Conexión con el servidor finalizada.");
          },
        });
      });
    });
  }
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

function printQR() {
  const keycont = document.getElementById("keycont");
  const contenedorQR = document.getElementById("contenedorQR");
  const qrPlaceholder = document.getElementById("qrPlaceholder");

  // Verificar si hay un QR generado
  if (
    !keycont ||
    !contenedorQR ||
    (qrPlaceholder && qrPlaceholder.style.display !== "none")
  ) {
    alert("No hay código QR generado para imprimir.");
    return;
  }

  const codigoQR = keycont.value;

  if (!codigoQR || codigoQR === "Código QR") {
    alert("No hay código QR generado para imprimir.");
    return;
  }

  // Obtener el tipo de servicio del código QR generado
  let tipoSeleccionado = "Baño"; // Valor por defecto

  const dateAct = new Date();
  const horaStr =
    dateAct.getHours().toString().padStart(2, "0") +
    ":" +
    dateAct.getMinutes().toString().padStart(2, "0") +
    ":" +
    dateAct.getSeconds().toString().padStart(2, "0");
  const fechaStr = dateAct.toISOString().split("T")[0];
  const precio =
    window.restroom[tipoSeleccionado] !== undefined
      ? `$${window.restroom[tipoSeleccionado]}`
      : "No definido";

  // Crear ventana de impresión optimizada para USB
  const ventanaImpr = window.open("", "_blank");
  ventanaImpr.document.write(
    `<html>
            <head>
                <title>Imprimir QR</title>
                <style>
                    @media print {
                        @page {
                            margin: 0;
                            size: 58mm auto;
                        }
                        body {
                            margin: 0;
                            padding: 3mm;
                            font-family: 'Courier New', monospace;
                            font-size: 14px;
                            width: 52mm;
                        }
                        .ticket {
                            width: 52mm;
                            text-align: center;
                        }
                        .qr-code img, .qr-code canvas {
                            width: 40mm !important;
                            height: 40mm !important;
                            margin: 3mm auto;
                            display: block;
                        }
                        h1 {
                            font-size: 18px;
                            margin: 2mm 0;
                            font-weight: bold;
                        }
                        .info {
                            font-size: 13px;
                            margin: 1mm 0;
                            line-height: 1.3;
                        }
                        .codigo {
                            font-size: 12px;
                            margin: 2mm 0;
                            word-break: break-all;
                            font-weight: bold;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <h1>TICKET DE ACCESO</h1>
                    <div class="info">${fechaStr} ${horaStr}</div>
                    <div class="info">SERVICIO: ${tipoSeleccionado}</div>
                    <div class="info">VALOR: ${precio}</div>
                    <div class="codigo">${codigoQR}</div>
                    <div class="qr-code">
                        ${contenedorQR.innerHTML}
                    </div>
                    <div class="info">¡GRACIAS POR SU PREFERENCIA!</div>
                </div>
                <script>
                    // Forzar impresión automática
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }, 300);
                </script>
            </body>
        </html>`
  );
  ventanaImpr.document.close();
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
  const buscadorCodigo = document.getElementById("buscador-codigo");
  const resultadoDiv = document.getElementById("resultado-verificacion");
  const tablaResultados = document.getElementById("tabla-resultados");
  if (!buscadorCodigo || !resultadoDiv || !tablaResultados) return;
  const codigoInput = buscadorCodigo.value.trim();
  if (!codigoInput || codigoInput.length < 6) {
    alert("El código debe tener al menos 6 caracteres.");
    return;
  }
  fetch(`${urlBoleto}?userPin=${encodeURIComponent(codigoInput)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error en la respuesta del servidor: ${response.status}`
        );
      }
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
    const serverData = await loadServerData();
    const today = new Date().toISOString().split("T")[0];
    const todayTransactions = serverData.filter((t) => t.date === today);
    const totalAmount = todayTransactions.reduce((sum, t) => {
      const price =
        t.tipo === "Baño" ? window.restroom.Baño : window.restroom.Ducha;
      return sum + price;
    }, 0);
    const totalBanos = todayTransactions.filter(
      (t) => t.tipo === "Baño"
    ).length;
    const totalDuchas = todayTransactions.filter(
      (t) => t.tipo === "Ducha"
    ).length;

    // Actualizar UI solo si los elementos existen
    const totalDay = document.getElementById("totalDay");
    const totalTransactions = document.getElementById("totalTransactions");
    const totalBanosElem = document.getElementById("totalBanos");
    const totalDuchasElem = document.getElementById("totalDuchas");
    if (totalDay) totalDay.textContent = "$" + totalAmount;
    if (totalTransactions)
      totalTransactions.textContent = todayTransactions.length;
    if (totalBanosElem) totalBanosElem.textContent = totalBanos;
    if (totalDuchasElem) totalDuchasElem.textContent = totalDuchas;
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
