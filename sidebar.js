$(document).ready(function () {
  // Determinar el contenedor correcto
  const sidebarContainer = $("#sidebar-container").length ? $("#sidebar-container") : $("#sidebar");
  
  if (sidebarContainer.length === 0) {
    console.error("❌ No se encontró contenedor para el sidebar");
    return;
  }
  
  // Cargar el sidebar
  sidebarContainer.load("sidebar.html", function(response, status, xhr) {
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
  // 1. Cargar info del usuario
  loadUserInfo();
  
  // 2. Aplicar permisos
  applyUserPermissions();
  
  // 3. Resaltar página actual
  highlightCurrentPage();
  
  // 4. Configurar eventos (DE ÚLTIMO, después de que todo esté listo)
  setupSidebarEvents();
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
  
  // Verificar que el botón existe y tiene el evento
  setTimeout(() => {
    const logoutBtn = $("#logoutBtn");
    if (logoutBtn.length) {
    } else {
    }
  }, 300);
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
  const userData = localStorage.getItem("user");
  if (userData) {
    try {
      const user = JSON.parse(userData);
      
      // Buscar elementos de configuración
      const configElements = $(".config-section");
      
      if (user.nivel === 1) {
        configElements.hide();
        
        // Verificación
        setTimeout(() => {
          const remaining = $(".config-section:visible").length;
          if (remaining === 0) {
          } else {
            $(".config-section").css('display', 'none');
          }
        }, 300);
        
      } else {
        configElements.show();
      }
    } catch (e) {
      console.error("Error aplicando permisos:", e);
    }
  }
}

function highlightCurrentPage() {
  // Obtener la ruta actual
  const currentPath = window.location.pathname;
  const currentPage = currentPath.split('/').pop() || 'dashboard.html';
  
  // Remover clase active de todos los elementos
  $(".components li").removeClass("active");
  
  // Buscar y marcar como activo el elemento correspondiente
  $(".components li a").each(function() {
    const linkHref = $(this).attr('href');
    
    // Comparar si el href coincide con la página actual
    if (linkHref === currentPage || 
        (currentPage === '' && linkHref === 'dashboard.html') ||
        (linkHref.includes(currentPage) && currentPage !== '')) {
      
      $(this).parent().addClass("active");
      return false; // Salir del bucle una vez encontrado
    }
  });
  
  // Si no se encontró coincidencia, activar dashboard por defecto
  if ($(".components li.active").length === 0) {
    $(".components li:first").addClass("active");
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
  window.location.href = "./index.html";
}