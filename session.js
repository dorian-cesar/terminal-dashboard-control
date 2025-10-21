(() => {
  const CHECK_INTERVAL = 5000;
  let _intervalId = null;
  let _loggingOut = false;

  function parseJwt(token) {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function isTokenExpired(token) {
    if (!token) return true;
    const payload = parseJwt(token);
    if (!payload) return false;
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  }

  function logout() {
    if (_loggingOut) return;
    _loggingOut = true;

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Eliminar cookie jwt
    document.cookie =
      "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";

    console.log("Sesión cerrada correctamente");

    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    setTimeout(() => {
      redirectToLogin();
    }, 100);
  }

  function redirectToLogin() {
    alert("Su sesión ha expirado, inicie sesión nuevamente");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 50);
  }

  function checkAuthOnce() {
    const token = localStorage.getItem("token");
    const jwt = getCookie("jwt");
    if (!token || !jwt) {
      logout();
      return false;
    }

    if (isTokenExpired(token) || isTokenExpired(jwt)) {
      console.warn("Token expirado (según exp). Cerrando sesión.");
      logout();
      return false;
    }

    return true;
  }

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

  function initSessionWatcher(interval = CHECK_INTERVAL) {
    if (_intervalId) return;

    const check = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("No hay token en localStorage. Logout.");
        logout();
        return;
      }

      if (isTokenExpired(token)) {
        console.warn("Token expirado. Logout.");
        logout();
        return;
      }
    };

    const startInterval = () => {
      if (_intervalId) return;
      _intervalId = setInterval(check, interval);
    };

    const stopInterval = () => {
      if (_intervalId) {
        clearInterval(_intervalId);
        _intervalId = null;
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") startInterval();
      else stopInterval();
    });
    if (document.visibilityState === "visible") startInterval();
  }
  window.SessionHelper = {
    logout,
    redirectToLogin,
    checkAuthOnce,
    initSessionWatcher,
  };

  document.addEventListener("DOMContentLoaded", () => {
    checkAuthOnce();

    initSessionWatcher();
  });
})();
