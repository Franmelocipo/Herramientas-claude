// check-auth.js
// Script de verificación de autenticación para Herramientas Contables
// Este script verifica si el usuario está autenticado antes de permitir el acceso

(function() {
    'use strict';

    // PRIORIDAD 1: Verificar si hay sesión activa del módulo Gestión de Comprobantes
    // Los usuarios externos (rol='cliente') deben ser redirigidos automáticamente
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userRole = localStorage.getItem('rol');

    if (isLoggedIn && userRole) {
        // Si es un usuario externo (cliente), redirigir automáticamente a su panel
        if (userRole === 'cliente') {
            console.log('Usuario externo detectado, redirigiendo a panel de cliente...');
            window.location.replace('herramientas/servicios-outsourcing/panel-cliente.html');
            return;
        }

        // Si es admin, permitir acceso al index (puede ver todas las herramientas)
        if (userRole === 'admin') {
            console.log('Usuario admin detectado, acceso permitido a todas las herramientas');
            return;
        }
    }

    // PRIORIDAD 2: Verificar autenticación del sistema anterior (sessionStorage)
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
