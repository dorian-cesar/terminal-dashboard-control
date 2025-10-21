// config.js - SOLO URL BASE
const ENVIRONMENT = "dev"; // ← Cambia a "prod" cuando necesites
//const ENVIRONMENT = "prod";

const CONFIG = {
    dev: {
        BASE_URL: "http://localhost/"
    },
    prod: {
        BASE_URL: "https://andenes.terminal-calama.com/"
    }
};

// Variables globales
window.APP_ENV = ENVIRONMENT;
window.BASE_URL = CONFIG[ENVIRONMENT].BASE_URL;

console.log('✅ Config loaded:', {
    environment: ENVIRONMENT,
    baseURL: window.BASE_URL
});