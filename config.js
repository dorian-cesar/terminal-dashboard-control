// config.js - CONFIGURACIÓN CENTRALIZADA
//const ENVIRONMENT = "dev"; // ← Cambia a "prod" cuando necesites
const ENVIRONMENT = "prod";

const CONFIG = {
  dev: {
    BASE_URL: "http://localhost/",
    URL_LOCAL: "http://10.5.20.103:3000",
    //URL_LOCAL: "http://localhost:3000",
    URL_PAYMENT_EFECTIVO:
      "https://backend-banios.dev-wit.com/api/boletas-calama/enviar",
  },
  prod: {
    BASE_URL: "https://andenes.terminal-calama.com/",
    URL_LOCAL: "http://localhost:3000",
    URL_PAYMENT_EFECTIVO:
      "https://backend-banios.dev-wit.com/api/boletas-calama/enviar",
  },
};

// Valor por minuto de parking en pesos chilenos
// const VALOR_MINUTO = 30;

// Variables globales
window.APP_ENV = ENVIRONMENT;
window.BASE_URL = CONFIG[ENVIRONMENT].BASE_URL;
window.URL_LOCAL = CONFIG[ENVIRONMENT].URL_LOCAL;
window.URL_PAYMENT_EFECTIVO = CONFIG[ENVIRONMENT].URL_PAYMENT_EFECTIVO;
// window.VALOR_MINUTO = VALOR_MINUTO;
