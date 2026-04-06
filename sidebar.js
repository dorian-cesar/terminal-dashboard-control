$(document).ready(function () {
  // Determinar el contenedor correcto
  const sidebarContainer = $("#sidebar-container").length
    ? $("#sidebar-container")
    : $("#sidebar");

  if (sidebarContainer.length === 0) {
    console.error("❌ No se encontró contenedor para el sidebar");
    return;
  }

  // Cargar el sidebar
  sidebarContainer.load("sidebar.html", function (response, status, xhr) {
    if (status === "error") {
      console.error("❌ Error cargando sidebar:", xhr.status, xhr.statusText);
      return;
    }

    // Esperar un momento para que el DOM se actualice completamente
    setTimeout(() => {
      initializeSidebarComplete();
    }, 200);
  });
});

function initializeSidebarComplete() {
  // 1. Filtrar secciones por permisos (LO MÁS IMPORTANTE)
  filterSectionsByPermission();

  // 2. Cargar info del usuario
  loadUserInfo();

  // 3. Resaltar página actual
  highlightCurrentPage();

  // 4. Configurar eventos
  setupSidebarEvents();
}

function filterSectionsByPermission() {
  const userData = localStorage.getItem("user");

  if (!userData) {
    console.warn("No hay información de usuario, mostrando sidebar básico");
    return;
  }

  try {
    const user = JSON.parse(userData);
    const seccionesPermitidas = user.secciones || [];

    // console.log("🔐 Usuario:", user.mail);
    // console.log("📊 Nivel:", user.nivel);
    // console.log("✅ Secciones permitidas:", seccionesPermitidas);

    // Si el usuario es administrador (nivel 0), mostrar todas las secciones
    if (user.nivel === 0) {
      console.log("👑 Usuario administrador - mostrando todas las secciones");
      return; // No filtrar nada
    }

    // Ocultar TODAS las secciones primero
    $(".components li[data-seccion]").hide();

    // Mostrar SOLO las secciones que están en el array seccionesPermitidas
    seccionesPermitidas.forEach((seccionPermitida) => {
      const seccionElement = $(
        `.components li[data-seccion="${seccionPermitida}"]`,
      );

      if (seccionElement.length) {
        seccionElement.show();
        // console.log(`👉 Mostrando sección: ${seccionPermitida}`);
      } else {
        // console.warn(
        //   `⚠️ Sección no encontrada en el sidebar: ${seccionPermitida}`,
        // );
      }
    });

    // Manejar la sección de CONFIGURACIÓN - COMPLETA para nivel 10 o superior
    handleConfigSection(user.nivel);

    // Mostrar dashboard SIEMPRE, incluso si no está en las secciones permitidas
    $('.components li[data-seccion="dashboard"]').show();

    // Contar secciones visibles
    const seccionesVisibles = $(".components li[data-seccion]:visible").length;
    // console.log(`📈 Secciones visibles en total: ${seccionesVisibles}`);
  } catch (error) {
    console.error("❌ Error filtrando secciones:", error);
  }
}

function handleConfigSection(userNivel) {
  const seccionesConfig = [
    "empresas",
    "destinos",
    "usuarios",
    "servicios",
    "listas-blancas",
    "entradas-salidas",
  ];

  const configSectionTitle = $('.components li[data-seccion="configuracion"]');

  // Verificar si el usuario tiene nivel 10 o superior
  if (userNivel >= 10) {
    // console.log("🔧 Usuario con nivel 10+ - mostrando CONFIGURACIÓN completa");

    // Mostrar el título de CONFIGURACIÓN
    configSectionTitle.show();

    // Mostrar TODAS las secciones de configuración
    seccionesConfig.forEach((seccion) => {
      $(`.components li[data-seccion="${seccion}"]`).show();
    });
  } else {
    // Usuario con nivel inferior a 10 - OCULTAR toda la sección de configuración
    configSectionTitle.hide();
    seccionesConfig.forEach((seccion) => {
      $(`.components li[data-seccion="${seccion}"]`).hide();
    });
    console.log("🔧 Ocultando sección CONFIGURACIÓN - nivel insuficiente");
  }
}

function setupSidebarEvents() {
  // Toggle del menú móvil
  $("#mobileMenuToggle").on("click", function () {
    $("#sidebar").toggleClass("active");
  });

  // Cerrar menú móvil al hacer clic en un enlace
  $(".components li a").on("click", function () {
    if (window.innerWidth <= 768) {
      $("#sidebar").removeClass("active");
    }
  });

  // Función de logout - USAR EVENT DELEGATION para asegurar que funcione
  $(document).on("click", "#logoutBtn", function (e) {
    e.preventDefault();
    logout();
  });
}

function loadUserInfo() {
  const userData = localStorage.getItem("user");
  if (userData) {
    try {
      const user = JSON.parse(userData);
      $("#userEmail").text(user.mail || "Usuario");
      $("#userRole").text(`Nivel: ${user.nivel}`);
    } catch (e) {
      console.error("Error parsing user data:", e);
    }
  } else {
    console.warn("No se encontró información del usuario");
  }
}

function applyUserPermissions() {
  // Esta función ya no es necesaria, se reemplaza por filterSectionsByPermission
  console.log("applyUserPermissions está obsoleta");
}

function highlightCurrentPage() {
  // Obtener la ruta actual
  const currentPath = window.location.pathname;
  const currentPage = currentPath.split("/").pop() || "dashboard.html";

  // Remover clase active de todos los elementos
  $(".components li").removeClass("active");

  // Buscar y marcar como activo el elemento correspondiente (solo entre los visibles)
  $(".components li:visible a").each(function () {
    const linkHref = $(this).attr("href");

    // Comparar si el href coincide con la página actual
    if (
      linkHref === currentPage ||
      (currentPage === "" && linkHref === "dashboard.html") ||
      (linkHref.includes(currentPage) && currentPage !== "")
    ) {
      $(this).parent().addClass("active");
      return false; // Salir del bucle una vez encontrado
    }
  });

  // Si no se encontró coincidencia, activar dashboard por defecto
  if ($(".components li.active").length === 0) {
    $('.components li[data-seccion="dashboard"]').addClass("active");
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie =
    "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
  window.location.href = "./index.html";
}
