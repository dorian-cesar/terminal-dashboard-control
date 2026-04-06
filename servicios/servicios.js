// ------------------------- CONFIGURACIÓN DEL BACKEND -------------------------
// 🔁 CAMBIA ESTA URL CUANDO TENGAS TU BACKEND REAL CON BASE DE DATOS.
const API_BASE_URL = window.BASE_URL; // Si está vacío, usamos Mock (simulación local)
// Si quieres pruebas con backend falso, dejamos vacío y se simula.
// Para usar backend real, asigna: const API_BASE_URL = 'https://tudominio.com/api';
// Se asume que los endpoints:
// GET  /precios  -> devuelve ARRAY [{ id, nombre, precio_actual }]
// POST /actualizar_precio.php -> recibe { id, precio_actual } (form-data)

// DEFINICIÓN DE SERVICIOS (IDs internos y nombres amigables)
const SERVICIOS = [
  {
    id: "banos",
    nombre: "Baños",
    icono: "fa-toilet",
    color: "#3b82f6",
    claveApi: "banos",
    idBackend: 1,
  },
  {
    id: "duchas",
    nombre: "Duchas",
    icono: "fa-shower",
    color: "#a855f7",
    claveApi: "duchas",
    idBackend: 2,
  },
  {
    id: "andenes_precio_base",
    nombre: "Andenes (Precio Base)",
    icono: "fa-road",
    color: "#f59e0b",
    claveApi: "andenes_precio_base",
    idBackend: 3,
  },
  {
    id: "andenes_bloque",
    nombre: "Andenes (Bloque)",
    icono: "fa-layer-group",
    color: "#f97316",
    claveApi: "andenes_bloque",
    idBackend: 4,
  },
  {
    id: "parking_base",
    nombre: "Parking (Base)",
    icono: "fa-parking",
    color: "#10b981",
    claveApi: "parking_base",
    idBackend: 5,
  },
  {
    id: "parking_bloque",
    nombre: "Parking (Bloque)",
    icono: "fa-car",
    color: "#14b8a6",
    claveApi: "parking_bloque",
    idBackend: 6,
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

    // Llamada real GET (ARRAY)
    const response = await fetch(
      `${API_BASE_URL}parkingCalama/php/servicios/servicios.php`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Formato inválido de API");
    }

    const preciosMap = {
      banos: 0,
      duchas: 0,
      andenes_precio_base: 0,
      andenes_bloque: 0,
      parking_base: 0,
      parking_bloque: 0,
    };

    // mapping dinámico desde SERVICIOS
    const idMap = Object.fromEntries(
      SERVICIOS.map((s) => [s.idBackend, s.claveApi]),
    );

    data.forEach((item) => {
      const id = Number(item.id);
      const precio = Number(item.precio_actual);
      const key = idMap[id];
      if (key) preciosMap[key] = precio;
    });

    currentPrices = preciosMap;

    renderPricesToGrid();
    showToast("Precios actualizados desde servidor");
  } catch (error) {
    console.error("Error GET /precios:", error);
    showToast("Error al obtener precios. Usando datos locales.", true);

    if (Object.values(currentPrices).every((v) => v === 0)) {
      currentPrices = {
        banos: 1000,
        duchas: 1300,
        andenes_precio_base: 2000,
        andenes_bloque: 3500,
        parking_base: 1500,
        parking_bloque: 2800,
      };
    }

    renderPricesToGrid();
  }
}

// Enviar actualización de precio por POST
async function updatePrice(servicioId, nuevoPrecio) {
  const precioNumerico = parseFloat(nuevoPrecio);
  if (isNaN(precioNumerico) || precioNumerico < 0) {
    showToast("Ingrese un precio válido (número positivo)", true);
    return false;
  }

  const precioFinal = Math.round(precioNumerico);

  const servicioConfig = SERVICIOS.find((s) => s.id === servicioId);
  if (!servicioConfig) return false;

  const backendKey = servicioConfig.claveApi;

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
    if (!API_BASE_URL) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      currentPrices[backendKey] = precioFinal;
      renderPricesToGrid();
      showToast(
        `Precio actualizado: ${servicioConfig.nombre} = $${precioFinal} (simulado)`,
      );
      return true;
    }

    // 🔥 POST REAL CORREGIDO
    const formData = new FormData();
    formData.append("id", servicioConfig.idBackend);
    formData.append("precio_actual", precioFinal);

    const response = await fetch(
      `${API_BASE_URL}parkingCalama/php/servicios/serviciosUpdate.php`,
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || "Error en el servidor");
    }

    currentPrices[backendKey] = precioFinal;

    renderPricesToGrid();
    showToast(`${servicioConfig.nombre} actualizado a $${precioFinal}`);

    return true;
  } catch (error) {
    console.error("Error POST actualizar precio:", error);
    showToast(
      `Falló la actualización de ${servicioConfig.nombre}: ${error.message}`,
      true,
    );
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

    const precioFormateado = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(precioActual);

    const card = document.createElement("div");
    card.className = "price-card";
    card.setAttribute("data-service-id", servicio.id);

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
  window.addEventListener("resize", adjustForResolution);
});
