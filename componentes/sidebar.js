// js/sidebar.js
$(document).ready(function () {
  // Cargar sidebar dentro del contenedor
  $("#sidebar-container").load("componentes/sidebar.html", function () {
    initSidebar();
  });


  function initSidebar() {
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

    // Función de logout
    $("#logoutBtn").on("click", function (e) {
      e.preventDefault();
      logout();
    });

    // Cargar información del usuario
    loadUserInfo();
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie =
      "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
    window.location.href = "./index.html";
  }

  function loadUserInfo() {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      $("#userEmail").text(user.mail || "");
      $("#userRole").text(`Nivel: ${user.nivel}`);
    }
  }
});