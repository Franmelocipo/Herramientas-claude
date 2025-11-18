// check-auth.js
// Script de verificación de autenticación para Herramientas Contables
// Este script verifica si el usuario está autenticado antes de permitir el acceso

(function() {
    'use strict';

    // Verificar si existe la autenticación en sessionStorage
    const isAuthenticated = sessionStorage.getItem('herramientas_auth') === 'authenticated';

    if (!isAuthenticated) {
        // Si no está autenticado, redirigir a login.html
        // Obtener la ruta raíz del proyecto
        const currentPath = window.location.pathname;
        const pathParts = currentPath.split('/');

        // Determinar la ruta relativa al login.html
        let loginPath = 'login.html';

        // Si estamos en un subdirectorio (como herramientas/mercado-pago-converter/)
        // necesitamos construir la ruta correcta de retorno
        if (currentPath.includes('/herramientas/')) {
            loginPath = '../../login.html';
        }

        // Guardar la URL actual para redirigir después del login
        sessionStorage.setItem('return_url', window.location.href);

        // Redirigir inmediatamente
        window.location.replace(loginPath);
    }
})();
