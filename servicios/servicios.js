// ------------------------- CONFIGURACIÓN DEL BACKEND -------------------------
// 🔁 CAMBIA ESTA URL CUANDO TENGAS TU BACKEND REAL CON BASE DE DATOS.
const API_BASE_URL = ""; // Si está vacío, usamos Mock (simulación local)
// Si quieres pruebas con backend falso, dejamos vacío y se simula.
// Para usar backend real, asigna: const API_BASE_URL = 'https://tudominio.com/api';
// Se asume que los endpoints:
// GET  /precios  -> devuelve objeto con { banos, duchas, andenes_precio_base, andenes_bloque, parking_base, parking_bloque }
// POST /precios/actualizar -> recibe { servicio, nuevoPrecio } y responde { success, message, preciosActualizados? }

// DEFINICIÓN DE SERVICIOS (IDs internos y nombres amigables)
const SERVICIOS = [
  {
    id: "banos",
    nombre: "Baños",
    icono: "fa-toilet",
    color: "#3b82f6",
    claveApi: "banos",
  },
  {
    id: "duchas",
    nombre: "Duchas",
    icono: "fa-shower",
    color: "#a855f7",
    claveApi: "duchas",
  },
  {
    id: "andenes_precio_base",
    nombre: "Andenes (Precio Base)",
    icono: "fa-road",
    color: "#f59e0b",
    claveApi: "andenes_precio_base",
  },
  {
    id: "andenes_bloque",
    nombre: "Andenes (Bloque)",
    icono: "fa-layer-group",
    color: "#f97316",
    claveApi: "andenes_bloque",
  },
  {
    id: "parking_base",
    nombre: "Parking (Base)",
    icono: "fa-parking",
    color: "#10b981",
    claveApi: "parking_base",
  },
  {
    id: "parking_bloque",
    nombre: "Parking (Bloque)",
    icono: "fa-car",
    color: "#14b8a6",
    claveApi: "parking_bloque",
  },
];

// Almacén local de precios (después de cargar)
let currentPrices = {
  banos: 0,
  duchas: 0,
  andenes_precio_base: 0,
  andenes_bloque: 0,
  parking_base: 0,
  parking_bloque: 0,
};

// Helper: mostrar notificaciones tipo toast
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = "toast-notify";
  toast.style.borderLeftColor = isError ? "#ef4444" : "#10b981";
  toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="fas ${isError ? "fa-exclamation-triangle" : "fa-check-circle"}"></i>
        <span>${message}</span>
      </div>
    `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(30px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Función para obtener precios desde el backend (GET)
async function fetchPrices() {
  try {
    // Si no hay URL base, simulamos datos mock (respuesta local)
    if (!API_BASE_URL) {
      console.log("Modo simulación (mock): cargando precios por defecto");
      // Datos mock iniciales con valores representativos
      const mockPrices = {
        banos: 600,
        duchas: 4000,
        andenes_precio_base: 2500,
        andenes_bloque: 4200,
        parking_base: 1800,
        parking_bloque: 3000,
      };
      currentPrices = { ...mockPrices };
      renderPricesToGrid();
      showToast("Precios cargados (modo demostración local)");
      return;
    }

    // Llamada real GET
    const response = await fetch(`${API_BASE_URL}/precios`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // Esperamos que data contenga los campos: banos, duchas, andenes_precio_base, andenes_bloque, parking_base, parking_bloque
    if (data) {
      currentPrices = {
        banos: data.banos ?? currentPrices.banos,
        duchas: data.duchas ?? currentPrices.duchas,
        andenes_precio_base:
          data.andenes_precio_base ?? currentPrices.andenes_precio_base,
        andenes_bloque: data.andenes_bloque ?? currentPrices.andenes_bloque,
        parking_base: data.parking_base ?? currentPrices.parking_base,
        parking_bloque: data.parking_bloque ?? currentPrices.parking_bloque,
      };
      renderPricesToGrid();
      showToast("Precios actualizados desde servidor");
    }
  } catch (error) {
    console.error("Error GET /precios:", error);
    showToast("Error al obtener precios. Usando datos locales.", true);
    // Si falla, mantener precios previos o usar defaults
    if (Object.values(currentPrices).every((v) => v === 0)) {
      currentPrices = {
        banos: 1000,
        duchas: 1300,
        andenes_precio_base: 2000,
        andenes_bloque: 3500,
        parking_base: 1500,
        parking_bloque: 2800,
      };
      renderPricesToGrid();
    } else {
      renderPricesToGrid();
    }
  }
}

// Enviar actualización de precio por POST
async function updatePrice(servicioId, nuevoPrecio) {
  // Validar que el precio sea un número positivo
  const precioNumerico = parseFloat(nuevoPrecio);
  if (isNaN(precioNumerico) || precioNumerico < 0) {
    showToast("Ingrese un precio válido (número positivo)", true);
    return false;
  }

  // Redondear a 2 decimales (por si acaso)
  const precioFinal = Math.round(precioNumerico * 100) / 100;

  // Obtener la claveApi que el backend espera
  const servicioConfig = SERVICIOS.find((s) => s.id === servicioId);
  if (!servicioConfig) return false;
  const backendKey = servicioConfig.claveApi;

  // Mostrar indicador visual en la tarjeta
  const cardElement = document.querySelector(
    `.price-card[data-service-id="${servicioId}"]`,
  );
  if (cardElement) {
    const originalPriceSpan = cardElement.querySelector(".current-price");
    if (originalPriceSpan) {
      originalPriceSpan.innerHTML = `<span class="loading-spinner" style="width:16px;height:16px;"></span>`;
    }
  }

  try {
    // Si no hay backend real, simulamos actualización local exitosa (mock)
    if (!API_BASE_URL) {
      // Simular delay de red
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Actualizar localmente
      currentPrices[backendKey] = precioFinal;
      renderPricesToGrid(); // re-renderiza con nuevo valor
      showToast(
        `Precio actualizado: ${servicioConfig.nombre} = $${precioFinal} (simulado)`,
      );
      return true;
    }

    // Llamada POST real al backend
    const payload = {
      servicio: backendKey, // ej: "banos", "andenes_precio_base"
      nuevoPrecio: precioFinal,
    };
    const response = await fetch(`${API_BASE_URL}/precios/actualizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Error en el servidor");
    }
    // Si el backend devuelve los precios actualizados, actualizamos el estado local
    if (data.preciosActualizados) {
      currentPrices = { ...currentPrices, ...data.preciosActualizados };
    } else {
      // Alternativa: refrescar todos los precios con GET
      await fetchPrices();
    }
    renderPricesToGrid();
    showToast(`${servicioConfig.nombre} actualizado a $${precioFinal}`);
    return true;
  } catch (error) {
    console.error("Error POST actualizar precio:", error);
    showToast(
      `Falló la actualización de ${servicioConfig.nombre}: ${error.message}`,
      true,
    );
    // Revertir renderizado a precio anterior sin cambios
    renderPricesToGrid();
    return false;
  }
}

// Renderizar tarjetas de precios en el grid
function renderPricesToGrid() {
  const gridContainer = document.getElementById("servicesGrid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";
  for (const servicio of SERVICIOS) {
    const precioActual = currentPrices[servicio.claveApi] ?? 0;
    // Formatear moneda
    const precioFormateado = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(precioActual);
    // Crear tarjeta
    const card = document.createElement("div");
    card.className = "price-card";
    card.setAttribute("data-service-id", servicio.id);
    // Icono según fontawesome
    const iconHtml = `<i class="fas ${servicio.icono}" style="font-size: 28px; color: ${servicio.color};"></i>`;
    card.innerHTML = `
        <div class="service-header">
          ${iconHtml}
          <span class="service-name">${servicio.nombre}</span>
        </div>
        <div class="price-display">
          <span class="price-label">Precio actual</span>
          <span class="current-price">${precioFormateado}</span>
        </div>
        <div class="edit-control">
          <input type="number" id="input-${servicio.id}" class="price-input" placeholder="Nuevo precio" step="100" min="0" value="${precioActual}">
          <button class="btn btn-primary small-btn update-price-btn" data-id="${servicio.id}">
            Actualizar
          </button>
        </div>
      `;
    gridContainer.appendChild(card);
  }

  // Agregar event listeners a todos los botones "Actualizar"
  document.querySelectorAll(".update-price-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const servicioId = btn.getAttribute("data-id");
      const inputField = document.getElementById(`input-${servicioId}`);
      if (inputField) {
        const newPriceValue = inputField.value.trim();
        if (newPriceValue === "") {
          showToast("Ingrese un precio", true);
          return;
        }
        await updatePrice(servicioId, newPriceValue);
      } else {
        showToast("Error: no se encontró el campo de entrada", true);
      }
    });
  });
}

// Refrescar manual (GET)
async function manualRefresh() {
  const refreshBtn = document.getElementById("refreshPricesBtn");
  if (refreshBtn) {
    const originalHtml = refreshBtn.innerHTML;
    refreshBtn.innerHTML = `<span class="loading-spinner" style="margin-right:6px;"></span> Cargando...`;
    refreshBtn.disabled = true;
    await fetchPrices();
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
  } else {
    await fetchPrices();
  }
}

// Función para ajustar el viewport y evitar scroll horizontal
function adjustForResolution() {
  // Asegurar que el body no tenga overflow horizontal
  document.body.style.overflowX = "hidden";
  const appContainer = document.querySelector(".app-container");
  if (appContainer) {
    appContainer.style.overflowX = "hidden";
  }
}

// Inicializar aplicación
async function init() {
  await fetchPrices();
  adjustForResolution();
}

// Asociar evento de refresco
document.addEventListener("DOMContentLoaded", () => {
  init();
  const refreshBtn = document.getElementById("refreshPricesBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", manualRefresh);
  // Escuchar cambios de tamaño para mantener sin scroll horizontal
  window.addEventListener("resize", adjustForResolution);
});
