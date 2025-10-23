export const verificarAccesoSeccion = (seccionRequerida) => {
    try {
        // Obtener usuario del localStorage
        const userData = localStorage.getItem('user');
        
        if (!userData) {
            // Si no hay usuario, redirigir al login
            alert('Usuario no autenticado. Será redirigido al login.');
            window.location.href = '../index.html';
            return false;
        }

        const usuario = JSON.parse(userData);
        const seccionesPermitidas = usuario.secciones || [];

        // Si el usuario es administrador (nivel 0), permitir acceso a todas las secciones
        if (usuario.nivel === 0) {
            return true;
        }

        // Verificar si tiene acceso a la sección requerida
        const tieneAcceso = seccionesPermitidas.some(seccion => 
            seccion.toLowerCase() === seccionRequerida.toLowerCase()
        );

        if (!tieneAcceso) {
            alert(`No tienes permisos para acceder a la sección: ${seccionRequerida}`);
            window.location.href = '../dashboard.html';
            return false;
        }

        return true;

    } catch (error) {
        console.error('Error verificando acceso:', error);
        alert('Error verificando permisos de acceso');
        window.location.href = '../dashboard.html';
        return false;
    }
};