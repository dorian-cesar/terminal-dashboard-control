// --- Configuración de entorno ---
const ENV = "dev"; // Cambia a "dev" o "prod" según corresponda

const URLS = {
  dev: {
    FRONT: "http://localhost/terminal-dashboard-control/dashboard.html",
    API: "http://localhost/caja-calama/",
  },
  prod: {
    FRONT: "http://localhost/terminal-dashboard-control/dashboard.html",
    API: "https://andenes.terminal-calama.com/caja-calama/",
  },
};

// --- URLs dinámicas según entorno ---
const VOLVER_URL = URLS[ENV].FRONT;
const API_URL = URLS[ENV].API;

$(document).ready(function () {
  const VOLVER_URL = URLS[ENV].FRONT;
  $("#volver").attr("href", VOLVER_URL);
});

// --- Sistema de Notificaciones (mejorado, crea contenedor si no existe y tiene fallback) ---
class ToastSystem {
  static show(message, type = "info", duration = 5000) {
    // Garantizar que el contenedor existe
    if (!$(".toast-container").length) {
      $("body").append('<div class="toast-container"></div>');
    }

    const icon = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    }[type] || "ℹ️";

    const title = {
      success: "Éxito",
      error: "Error",
      warning: "Advertencia",
      info: "Información",
    }[type] || "Información";

    const toast = $(`
      <div class="toast toast-${type}">
        <div><strong>${icon} ${title}</strong></div>
        <div>${message}</div>
      </div>
    `);

    $(".toast-container").append(toast);

    // Animación simple
    toast.hide().fadeIn(200);
    setTimeout(() => toast.fadeOut(400, () => toast.remove()), duration);
  }
}

// --- Gestión de Estado de la UI ---
class UIStateManager {
  static setLoading(selector, isLoading) {
    const element = $(selector);
    if (isLoading) {
      element.addClass("loading").prop("disabled", true);
      element.prepend('<span class="spinner"></span>');
    } else {
      element.removeClass("loading").prop("disabled", false);
      element.find(".spinner").remove();
    }
  }

  static updateCajaStatus(isOpen, data = null) {
    const statusElement = $("#cajaStatus");
    const abrirBtn = $("#btnAbrirCaja");
    const cerrarBtn = $("#btnCerrarCaja");
    const imprimirBtn = $("#btnImprimir");
    const refreshBtn = $("#btnRefresh");

    if (isOpen && data) {
      statusElement.removeClass("caja-cerrada").addClass("caja-abierta");
      statusElement.html(
        `<i class="fas fa-circle"></i> Caja Abierta - ID: ${data.id}`
      );

      abrirBtn.prop("disabled", true);
      cerrarBtn.prop("disabled", false);
      imprimirBtn.prop("disabled", false);
      refreshBtn.prop("disabled", false);

      this.updateStats(data);
      this.startTurnTimer(data.hora_inicio);
    } else {
      // ESTADO CERRADO - Asegurar que todos los botones se desactiven/activen correctamente
      statusElement.removeClass("caja-abierta").addClass("caja-cerrada");
      statusElement.html('<i class="fas fa-circle"></i> Caja Cerrada');

      // Forzar el estado de los botones
      abrirBtn.prop("disabled", false);
      cerrarBtn.prop("disabled", true);  // Este es el importante
      imprimirBtn.prop("disabled", true);
      refreshBtn.prop("disabled", false);

      this.resetStats();
      this.stopTurnTimer();
      
      // Limpiar también cualquier loading state
      this.setLoading("#btnCerrarCaja", false);
      this.setLoading("#btnRefresh", false);
    }
  }

  static updateStats(data) {
    const monto_bano = parseFloat(data.monto_bano || 0);
    const monto_custodia = parseFloat(data.monto_custodia || 0);
    const monto_parking = parseFloat(data.monto_parking || 0);
    const monto_andenes = parseFloat(data.monto_andenes || 0);
    const monto_inicial = parseFloat(data.monto_inicial || 0);
    const total =
      monto_inicial +
      monto_bano +
      monto_custodia +
      monto_parking +
      monto_andenes;

    // Formato sin decimales para pesos chilenos
    $("#statMontoInicial").text(`$${this.formatCurrency(monto_inicial)}`);
    $("#statBanos").text(`$${this.formatCurrency(monto_bano)}`);
    $("#statCustodia").text(`$${this.formatCurrency(monto_custodia)}`);
    $("#statParking").text(`$${this.formatCurrency(monto_parking)}`);
    $("#statAndenes").text(`$${this.formatCurrency(monto_andenes)}`);
    $("#statTotal").text(`$${this.formatCurrency(total)}`);
  }

  static formatCurrency(amount) {
    // Formatear sin decimales y con separadores de miles
    return new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static resetStats() {
    $(
      "#statMontoInicial, #statBanos, #statCustodia, #statParking, #statAndenes, #statTotal"
    ).text("$0");
  }

  static startTurnTimer(startTime) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const start = new Date(`2000-01-01T${startTime}`);

    this.timerInterval = setInterval(() => {
      const now = new Date();
      const diff = now - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      $("#progressTime").text(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );

      // Calcular progreso basado en 8 horas de turno
      const progress = Math.min((diff / (8 * 3600000)) * 100, 100);
      $("#turnProgress").css("width", `${progress}%`);

      // SIEMPRE verde mientras la caja esté abierta
      $("#turnProgress").css("background-color", "var(--accent-success)");
    }, 1000);
  }

  static stopTurnTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    $("#progressTime").text("--:--:--");
    $("#turnProgress").css("width", "0%");
    // No es necesario cambiar el color aquí ya que se reseteará cuando se abra una nueva caja
  }
}

function ahoraChile() {
  return new Date().toLocaleString("es-CL", {
    timeZone: "America/Santiago",
  });
}

// Ejemplo: solo fecha
function fechaHoyChile() {
  return new Date().toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Ejemplo: hora
function horaActualChile() {
  return new Date().toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}


async function obtenerNumeroCaja() {
  const url = "http://10.5.20.105:3000/api/info-caja";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data.numero_caja || "SIN_NUMERO";
  } catch (err) {
    console.error("Error al obtener NUMERO_CAJA:", err);

    // Mostrar siempre alerta visual + fallback de alerta nativa
    ToastSystem.show(
      "No se pudo conectar con el servidor de identificación de terminal.<br>Verifique la red o contacte a soporte técnico.",
      "error",
      8000
    );

    alert("⚠️ Error: no se pudo conectar con el servidor de caja.\n\nVerifique la red o contacte a soporte.");

    return "SIN_NUMERO";
  }
}

// --- Funciones para Movimientos en Tiempo Real ---
function cargarMovimientosCaja(idCaja) {
  $.post(API_URL + "caja.php", {
    accion: "obtener_movimientos",
    id_caja: idCaja,
  })
    .done(function (res) {
      let data;
      try {
        data = JSON.parse(res);
      } catch (e) {
        console.error("Error parseando movimientos:", e);
        return;
      }

      if (data.success) {
        // Actualizar la tabla con los movimientos
        actualizarTablaConMovimientos(data);
        // Actualizar las estadísticas
        actualizarEstadisticas(data);
      } else {
        console.error("Error en movimientos:", data.error);
      }
    })
    .fail(function (xhr, status, error) {
      console.error("Error al cargar movimientos:", error);
    });
}

function actualizarTablaConMovimientos(movimientos) {
  // Obtener los datos básicos de la caja actual
  const id = localStorage.getItem("id_caja");
  const fecha =
    $("#tablaCaja tbody tr td:first-child").text().replace("📅 ", "") ||
    new Date().toISOString().split("T")[0];
  const horaInicio =
    $("#tablaCaja tbody tr td:nth-child(2)").text().replace("⏰ ", "") ||
    new Date().toLocaleTimeString("es-CL");
  const montoInicialText =
    $("#statMontoInicial").text().replace("$", "").replace(/\./g, "") || "0";
  const monto_inicial = parseFloat(montoInicialText) || 0;

  const monto_bano = parseFloat(movimientos.monto_bano || 0);
  const monto_custodia = parseFloat(movimientos.monto_custodia || 0);
  const monto_parking = parseFloat(movimientos.monto_parking || 0);
  const monto_andenes = parseFloat(movimientos.monto_andenes || 0);
  const total =
    monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;

  const estadoBadge =
    '<span class="badge badge-abierta"><i class="fas fa-play-circle me-1"></i>Abierta</span>';

  $("#tablaCaja tbody").html(`
        <tr>
            <td><i class="fas fa-calendar text-gray-400 me-2"></i>${fecha}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${horaInicio}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>-</td>
            <td><strong>$${UIStateManager.formatCurrency(
              monto_inicial
            )}</strong></td>
            <td>$${UIStateManager.formatCurrency(monto_bano)}</td>
            <td>$${UIStateManager.formatCurrency(monto_custodia)}</td>
            <td>$${UIStateManager.formatCurrency(monto_parking)}</td>
            <td>$${UIStateManager.formatCurrency(monto_andenes)}</td>
            <td><strong class="text-success">$${UIStateManager.formatCurrency(
              total
            )}</strong></td>
            <td>${estadoBadge}</td>
        </tr>
    `);

  $("#noDataRow").hide();
  $("#registrosCount").text("1 registro");
}

function actualizarEstadisticas(movimientos) {
  const monto_inicial = parseFloat(
    $("#statMontoInicial").text().replace("$", "").replace(/\./g, "") || 0
  );
  const total =
    monto_inicial +
    parseFloat(movimientos.monto_bano || 0) +
    parseFloat(movimientos.monto_custodia || 0) +
    parseFloat(movimientos.monto_parking || 0) +
    parseFloat(movimientos.monto_andenes || 0);

  $("#statBanos").text(
    `$${UIStateManager.formatCurrency(movimientos.monto_bano || 0)}`
  );
  $("#statCustodia").text(
    `$${UIStateManager.formatCurrency(movimientos.monto_custodia || 0)}`
  );
  $("#statParking").text(
    `$${UIStateManager.formatCurrency(movimientos.monto_parking || 0)}`
  );
  $("#statAndenes").text(
    `$${UIStateManager.formatCurrency(movimientos.monto_andenes || 0)}`
  );
  $("#statTotal").text(`$${UIStateManager.formatCurrency(total)}`);
}

// --- Funciones Principales ---
function mostrarCaja(data) {
  const monto_bano = parseFloat(data.monto_bano || 0);
  const monto_custodia = parseFloat(data.monto_custodia || 0);
  const monto_parking = parseFloat(data.monto_parking || 0);
  const monto_andenes = parseFloat(data.monto_andenes || 0);
  const monto_inicial = parseFloat(data.monto_inicial || 0);
  const total = monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;

  const estadoBadge = data.estado === "abierta"
    ? '<span class="badge badge-abierta"><i class="fas fa-play-circle me-1"></i>Abierta</span>'
    : '<span class="badge badge-cerrada"><i class="fas fa-stop-circle me-1"></i>Cerrada</span>';

  $("#tablaCaja tbody").html(`
        <tr>
            <td><i class="fas fa-calendar text-gray-400 me-2"></i>${data.fecha}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_inicio}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_cierre || "-"}</td>
            <td><strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong></td>
            <td>$${UIStateManager.formatCurrency(monto_bano)}</td>
            <td>$${UIStateManager.formatCurrency(monto_custodia)}</td>
            <td>$${UIStateManager.formatCurrency(monto_parking)}</td>
            <td>$${UIStateManager.formatCurrency(monto_andenes)}</td>
            <td><strong class="text-success">$${UIStateManager.formatCurrency(total)}</strong></td>
            <td>${estadoBadge}</td>
        </tr>
    `);

  $("#noDataRow").hide();
  $("#registrosCount").text("1 registro");

  // Actualizar resumen para impresión
  $("#resumenCaja").html(`
        <div class="text-center mb-4">
            <h3 class="mb-1">Terminal de Buses Calama</h3>
            <p class="text-muted mb-0">Resumen de Caja - ${data.fecha}</p>
        </div>
        <div class="row">
            <div class="col-6">
                <p><strong>Hora Inicio:</strong> ${data.hora_inicio}</p>
                ${data.hora_cierre ? `<p><strong>Hora Cierre:</strong> ${data.hora_cierre}</p>` : ""}
                <p><strong>Estado:</strong> ${data.estado}</p>
            </div>
            <div class="col-6 text-end">
                <p><strong>ID Caja:</strong> ${data.id}</p>
            </div>
        </div>
        <hr>
        <div class="monto-item">
            <span>Monto Inicial:</span>
            <strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong>
        </div>
        <div class="monto-item">
            <span>Ingresos Baños:</span>
            <span>$${UIStateManager.formatCurrency(monto_bano)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Custodia:</span>
            <span>$${UIStateManager.formatCurrency(monto_custodia)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Parking:</span>
            <span>$${UIStateManager.formatCurrency(monto_parking)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Andenes:</span>
            <span>$${UIStateManager.formatCurrency(monto_andenes)}</span>
        </div>
        <hr>
        <div class="monto-total">
            <div class="d-flex justify-content-between align-items-center">
                <span><strong>TOTAL GENERAL:</strong></span>
                <span class="h4 mb-0 text-success"><strong>$${UIStateManager.formatCurrency(total)}</strong></span>
            </div>
        </div>
        <div class="text-center mt-4 text-muted">
            <small>Generado el ${fechaHoyChile()} ${horaActualChile()}</small>
        </div>
    `);
}

function limpiarEstadoCaja() {
  // Limpiar localStorage
  localStorage.removeItem("id_caja");
  
  // Forzar estado cerrado en la UI
  $("#btnCerrarCaja").prop("disabled", true);
  $("#btnImprimir").prop("disabled", true);
  $("#btnAbrirCaja").prop("disabled", false);
  
  $("#cajaStatus").removeClass("caja-abierta").addClass("caja-cerrada")
                 .html('<i class="fas fa-circle"></i> Caja Cerrada');
  
  // Resetear estadísticas
  UIStateManager.resetStats();
  UIStateManager.stopTurnTimer();
  
  // Mostrar tabla vacía
  $("#noDataRow").show();
  $("#registrosCount").text("0 registros");
  $("#tablaCaja tbody").html(`
        <tr id="noDataRow">
            <td colspan="10" class="text-center py-5 text-muted">
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <br>
                No hay datos de caja disponibles
            </td>
        </tr>
    `);
}

// --- Funciones Principales Simplificadas ---
function mostrarCaja(data) {
  const monto_bano = parseFloat(data.monto_bano || 0);
  const monto_custodia = parseFloat(data.monto_custodia || 0);
  const monto_parking = parseFloat(data.monto_parking || 0);
  const monto_andenes = parseFloat(data.monto_andenes || 0);
  const monto_inicial = parseFloat(data.monto_inicial || 0);
  const total = monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;

  const estadoBadge = data.estado === "abierta"
    ? '<span class="badge badge-abierta"><i class="fas fa-play-circle me-1"></i>Abierta</span>'
    : '<span class="badge badge-cerrada"><i class="fas fa-stop-circle me-1"></i>Cerrada</span>';

  $("#tablaCaja tbody").html(`
        <tr>
            <td><i class="fas fa-calendar text-gray-400 me-2"></i>${data.fecha}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_inicio}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_cierre || "-"}</td>
            <td><strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong></td>
            <td>$${UIStateManager.formatCurrency(monto_bano)}</td>
            <td>$${UIStateManager.formatCurrency(monto_custodia)}</td>
            <td>$${UIStateManager.formatCurrency(monto_parking)}</td>
            <td>$${UIStateManager.formatCurrency(monto_andenes)}</td>
            <td><strong class="text-success">$${UIStateManager.formatCurrency(total)}</strong></td>
            <td>${estadoBadge}</td>
        </tr>
    `);

  $("#noDataRow").hide();
  $("#registrosCount").text("1 registro");

  // Actualizar resumen para impresión
  $("#resumenCaja").html(`
        <div class="text-center mb-4">
            <h3 class="mb-1">Terminal de Buses Calama</h3>
            <p class="text-muted mb-0">Resumen de Caja - ${data.fecha}</p>
        </div>
        <div class="row">
            <div class="col-6">
                <p><strong>Hora Inicio:</strong> ${data.hora_inicio}</p>
                ${data.hora_cierre ? `<p><strong>Hora Cierre:</strong> ${data.hora_cierre}</p>` : ""}
                <p><strong>Estado:</strong> ${data.estado}</p>
            </div>
            <div class="col-6 text-end">
                <p><strong>ID Caja:</strong> ${data.id}</p>
            </div>
        </div>
        <hr>
        <div class="monto-item">
            <span>Monto Inicial:</span>
            <strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong>
        </div>
        <div class="monto-item">
            <span>Ingresos Baños:</span>
            <span>$${UIStateManager.formatCurrency(monto_bano)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Custodia:</span>
            <span>$${UIStateManager.formatCurrency(monto_custodia)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Parking:</span>
            <span>$${UIStateManager.formatCurrency(monto_parking)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Andenes:</span>
            <span>$${UIStateManager.formatCurrency(monto_andenes)}</span>
        </div>
        <hr>
        <div class="monto-total">
            <div class="d-flex justify-content-between align-items-center">
                <span><strong>TOTAL GENERAL:</strong></span>
                <span class="h4 mb-0 text-success"><strong>$${UIStateManager.formatCurrency(total)}</strong></span>
            </div>
        </div>
        <div class="text-center mt-4 text-muted">
            <small>Generado el ${fechaHoyChile()} ${horaActualChile()}</small>
        </div>
    `);
}

function limpiarEstadoCaja() {
  // Limpiar localStorage
  localStorage.removeItem("id_caja");
  
  // Restaurar botón cerrar caja a estado normal (pero disabled)
  $("#btnCerrarCaja").prop("disabled", true);
  $("#btnCerrarCaja").html(`
    <i class="fas fa-lock me-2"></i>
    Cerrar Caja
  `);
  
  $("#btnImprimir").prop("disabled", true);
  $("#btnAbrirCaja").prop("disabled", false);
  
  $("#cajaStatus").removeClass("caja-abierta").addClass("caja-cerrada")
                 .html('<i class="fas fa-circle"></i> Caja Cerrada');
  
  // Resetear estadísticas
  UIStateManager.resetStats();
  UIStateManager.stopTurnTimer();
  
  // Mostrar tabla vacía
  $("#noDataRow").show();
  $("#registrosCount").text("0 registros");
  $("#tablaCaja tbody").html(`
        <tr id="noDataRow">
            <td colspan="10" class="text-center py-5 text-muted">
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <br>
                No hay datos de caja disponibles
            </td>
        </tr>
    `);
}

function verificarEstadoCaja() {
  const id_caja_local = localStorage.getItem("id_caja");
  
  // Si NO hay id_caja en localStorage → caja cerrada
  if (!id_caja_local) {
    limpiarEstadoCaja();
    return;
  }
  
  // Si hay id_caja, verificar en el servidor si sigue abierta
  $.post(API_URL + "caja.php", { accion: "mostrar", id_caja: id_caja_local })
    .done(function (res) {
      try {
        const data = JSON.parse(res);
        
        if (data.success && data.estado === "abierta") {
          // Caja existe y está abierta → mostrar datos
          mostrarCaja(data);
          UIStateManager.updateCajaStatus(true, data);
          cargarMovimientosCaja(data.id);
        } else {
          // Caja no existe o está cerrada → limpiar estado
          limpiarEstadoCaja();
        }
      } catch (e) {
        console.error("Error parseando respuesta:", e);
        limpiarEstadoCaja();
      }
    })
    .fail(function (xhr, status, error) {
      console.error("Error al verificar caja:", error);
      // En caso de error, mantener el estado actual pero intentar de nuevo luego
    });
}

// --- Event Handlers ---
$("#formInicioCaja").on("submit", async function (e) {
  e.preventDefault();

  const monto = $("#monto_inicial_modal").val();
  if (!monto || parseFloat(monto) <= 0) {
    ToastSystem.show("Ingrese un monto inicial válido", "error");
    return;
  }

  UIStateManager.setLoading("#btnSubmitAbrir", true);

  const userData = JSON.parse(localStorage.getItem("user")) || {};
  const id_usuario = userData.iduser || null;

  if (!id_usuario) {
    ToastSystem.show("Error: No se encontró el usuario en sesión.", "error");
    UIStateManager.setLoading("#btnSubmitAbrir", false);
    return;
  }

  const numeroCaja = await obtenerNumeroCaja();
  if (!numeroCaja || numeroCaja === "SIN_NUMERO") {
    ToastSystem.show("No se pudo identificar el terminal de caja.", "error");
    UIStateManager.setLoading("#btnSubmitAbrir", false);
    return;
  }

  // Hora actual de Chile
  const hora_inicio = horaActualChile();

  $.post(API_URL + "caja.php", {
    accion: "abrir",
    monto_inicial: monto,
    id_usuario: id_usuario,
    numero_caja: numeroCaja,
    hora_inicio: hora_inicio
  })
  .done(function (res) {
    let data;
    try { data = JSON.parse(res); } catch (e) { throw new Error("Respuesta inválida"); }

    if (data.success) {
      localStorage.setItem("id_caja", data.id);
      mostrarCaja(data);
      UIStateManager.updateCajaStatus(true, data);
      cargarMovimientosCaja(data.id);

      $("#modalInicio").modal("hide");
      $("#formInicioCaja")[0].reset();

      ToastSystem.show(data.reutilizada ? 
        "Se ha retomado correctamente la caja abierta." : 
        "Caja abierta correctamente.", 
        "success"
      );
    } else {
      throw new Error(data.error || "Error al abrir caja");
    }
  })
  .fail(function (xhr, status, error) {
    ToastSystem.show("Error de conexión: " + error, "error");
  })
  .always(function () {
    UIStateManager.setLoading("#btnSubmitAbrir", false);
  });
});

$("#btnCerrarCaja").on("click", function () {
  if (!confirm("¿Está seguro de que desea cerrar la caja?")) return;

  const id = localStorage.getItem("id_caja");
  if (!id) {
    ToastSystem.show("No hay caja abierta", "warning");
    return;
  }

  // MOSTRAR SPINNER Y DESACTIVAR INMEDIATAMENTE
  const $btn = $(this);
  const originalText = $btn.html();
  
  $btn.prop("disabled", true);
  $btn.html(`
    <span class="spinner"></span>
    Cerrando caja...
  `);

  const hora_cierre = horaActualChile();

  $.post(API_URL + "caja.php", { 
    accion: "cerrar", 
    id_caja: id,
    hora_cierre: hora_cierre
  })
  .done(function (res) {
    try {
      const data = JSON.parse(res);
      if (data.success) {
        // Limpiar estado inmediatamente
        limpiarEstadoCaja();
        ToastSystem.show("Caja cerrada correctamente", "success");
      } else {
        throw new Error(data.error || "Error al cerrar caja");
      }
    } catch (e) {
      ToastSystem.show("Error al procesar respuesta: " + e.message, "error");
      // Aún así limpiar el estado local
      limpiarEstadoCaja();
    }
  })
  .fail(function (xhr, status, error) {
    ToastSystem.show("Error de conexión: " + error, "error");
    // Aún así limpiar el estado local
    limpiarEstadoCaja();
  })
  .always(function () {
  });
});

$("#btnImprimir").on("click", function () {
  const id = localStorage.getItem("id_caja");
  if (!id) {
    ToastSystem.show("No hay caja abierta para imprimir", "warning");
    return;
  }

  $("#resumenCaja").show();
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      $("#resumenCaja").hide();
    }, 500);
  }, 500);
});

$("#btnRefresh").on("click", function () {
  verificarEstadoCaja();
  ToastSystem.show("Datos actualizados", "info", 2000);
});

// --- Inicialización ---
$(document).ready(function () {
  // Verificar estado al cargar la página
  verificarEstadoCaja();

  // Configurar verificación automática cada 30 segundos
  setInterval(() => {
    verificarEstadoCaja();
  }, 30000);

  // Configurar auto-refresh cada 10 segundos para movimientos si hay caja abierta
  setInterval(() => {
    if (localStorage.getItem("id_caja")) {
      const id = localStorage.getItem("id_caja");
      cargarMovimientosCaja(id);
    }
  }, 10000);

  // Mejorar la experiencia del formulario
  $("#monto_inicial_modal").on("focus", function () {
    $(this).select();
  });

  // Prevenir el cierre del modal si hay errores
  $("#modalInicio").on("hide.bs.modal", function () {
    $("#formInicioCaja")[0].reset();
  });

  // Shortcut keys
  $(document).on("keydown", function (e) {
    // F5 para refresh
    if (e.key === "F5") {
      e.preventDefault();
      $("#btnRefresh").click();
    }
    // Ctrl+P para imprimir
    if (e.ctrlKey && e.key === "p") {
      e.preventDefault();
      $("#btnImprimir").click();
    }
  });
});