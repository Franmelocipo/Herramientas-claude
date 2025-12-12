/**
 * Componente de Navegación Global
 * Barra superior persistente para todo el sistema
 */

(function() {
    'use strict';

    // Detectar la ruta base según la ubicación del archivo actual
    function getBasePath() {
        const path = window.location.pathname;
        // Si estamos en index.html o raíz
        if (path.endsWith('/index.html') && !path.includes('/herramientas/')) {
            return '';
        }
        if (path === '/' || path.endsWith('/Herramientas-claude/')) {
            return '';
        }
        // Si estamos en una herramienta (profundidad 2)
        if (path.includes('/herramientas/')) {
            return '../../';
        }
        return '';
    }

    // Lista de herramientas del sistema
    const herramientas = [
        {
            id: 'mercado-pago',
            nombre: 'Convertidor Mercado Pago',
            icono: '📊',
            ruta: 'herramientas/mercado-pago-converter/',
            descripcion: 'Convierte extractos de Mercado Pago'
        },
        {
            id: 'conversor-asientos',
            nombre: 'Conversor de Asientos',
            icono: '📝',
            ruta: 'herramientas/conversor-asientos/',
            descripcion: 'Convierte datos a asientos contables'
        },
        {
            id: 'extractos-bancarios',
            nombre: 'Conversor Extractos Bancarios',
            icono: '🏦',
            ruta: 'herramientas/extractos-bancarios/',
            descripcion: 'Convierte PDF de bancos a Excel'
        },
        {
            id: 'servicios-outsourcing',
            nombre: 'Servicios de Outsourcing',
            icono: '📋',
            ruta: 'herramientas/servicios-outsourcing/login.html',
            descripcion: 'Sistema de gestión para clientes'
        },
        {
            id: 'conversor-veps',
            nombre: 'Conversor VEPs ARCA',
            icono: '📄',
            ruta: 'herramientas/conversor-veps-arca/',
            descripcion: 'Convierte VEPs de ARCA a Excel'
        },
        {
            id: 'conciliador',
            nombre: 'Conciliador Bancario',
            icono: '🔄',
            ruta: 'herramientas/conciliador-bancario/',
            descripcion: 'Compara Mayor vs Extractos'
        },
        {
            id: 'combinador',
            nombre: 'Combinador Excel',
            icono: '📑',
            ruta: 'herramientas/combinador-excel/',
            descripcion: 'Combina múltiples archivos Excel'
        },
        {
            id: 'segmentador',
            nombre: 'Segmentador de Asientos',
            icono: '✂️',
            ruta: 'herramientas/segmentador-asientos/',
            descripcion: 'Filtra asientos por tipo/período'
        },
        {
            id: 'auditoria',
            nombre: 'Auditoría de Extractos',
            icono: '🔍',
            ruta: 'herramientas/auditoria/',
            descripcion: 'Gestione extractos mensuales'
        }
    ];

    // Generar el HTML de la navegación
    function createNavHTML(basePath) {
        const isHome = basePath === '';

        // Generar items del dropdown de herramientas
        const herramientasItems = herramientas.map(h => `
            <a href="${basePath}${h.ruta}" class="dropdown-item">
                <span>${h.icono}</span>
                <span>${h.nombre}</span>
            </a>
        `).join('');

        return `
        <div class="global-nav">
            <div class="global-nav-container">
                <div class="global-nav-left">
                    <a href="${basePath}index.html" class="global-nav-brand">
                        <span class="global-nav-icon">🗄️</span>
                        <span>Bases de Datos Compartidas</span>
                    </a>
                </div>
                <div class="global-nav-buttons">
                    <button id="globalNavClients" class="global-nav-btn" data-action="clients">
                        <span>👥</span>
                        <span>Clientes</span>
                    </button>
                    <div class="global-nav-dropdown">
                        <button class="global-nav-btn">
                            <span>📋</span>
                            <span>Tablas</span>
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="global-nav-dropdown-menu">
                            <button class="dropdown-item" data-action="taxes">
                                <span>📊</span>
                                <span>Impuestos, conceptos y Subconceptos ARCA</span>
                            </button>
                        </div>
                    </div>
                    <button id="globalNavStorage" class="global-nav-btn" data-action="storage">
                        <span>💾</span>
                        <span>Almacenamiento</span>
                    </button>
                    <div class="global-nav-dropdown herramientas-dropdown">
                        <button class="global-nav-btn herramientas-btn">
                            <span>🧮</span>
                            <span>Herramientas</span>
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="global-nav-dropdown-menu herramientas-menu">
                            ${herramientasItems}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // Inyectar CSS
    function injectStyles(basePath) {
        if (document.getElementById('globalNavStyles')) return;

        const link = document.createElement('link');
        link.id = 'globalNavStyles';
        link.rel = 'stylesheet';
        link.href = basePath + 'shared/globalNav.css';
        document.head.appendChild(link);
    }

    // Inicializar la navegación
    function initGlobalNav() {
        const basePath = getBasePath();

        // Inyectar estilos
        injectStyles(basePath);

        // Buscar si existe un data-menu existente para reemplazar
        const existingDataMenu = document.querySelector('.data-menu');

        // Crear el contenedor de navegación
        const navContainer = document.createElement('div');
        navContainer.id = 'globalNavContainer';
        navContainer.innerHTML = createNavHTML(basePath);

        if (existingDataMenu) {
            // Reemplazar el menú existente
            existingDataMenu.replaceWith(navContainer.firstElementChild);
        } else {
            // Insertar al principio del body (después de scripts iniciales)
            const firstElement = document.body.firstChild;
            // Buscar el primer elemento visible (no script)
            let insertPoint = firstElement;
            while (insertPoint && (insertPoint.nodeName === 'SCRIPT' || insertPoint.nodeType === 3)) {
                insertPoint = insertPoint.nextSibling;
            }
            if (insertPoint) {
                document.body.insertBefore(navContainer.firstElementChild, insertPoint);
            } else {
                document.body.prepend(navContainer.firstElementChild);
            }
        }

        // Configurar eventos
        setupEventListeners(basePath);
    }

    // Configurar event listeners
    function setupEventListeners(basePath) {
        const isHome = basePath === '';

        // Evento de Clientes
        const btnClients = document.querySelector('[data-action="clients"]');
        if (btnClients) {
            btnClients.addEventListener('click', () => {
                if (isHome) {
                    // En home, abrir el modal existente
                    const modal = document.getElementById('modalClients');
                    if (modal) {
                        modal.classList.remove('hidden');
                    }
                } else {
                    // En herramientas, redirigir a home con parámetro
                    window.location.href = basePath + 'index.html?action=clients';
                }
            });
        }

        // Evento de Impuestos
        const btnTaxes = document.querySelector('[data-action="taxes"]');
        if (btnTaxes) {
            btnTaxes.addEventListener('click', () => {
                if (isHome) {
                    const modal = document.getElementById('modalTaxes');
                    if (modal) {
                        modal.classList.remove('hidden');
                    }
                } else {
                    window.location.href = basePath + 'index.html?action=taxes';
                }
            });
        }

        // Evento de Almacenamiento
        const btnStorage = document.querySelector('[data-action="storage"]');
        if (btnStorage) {
            btnStorage.addEventListener('click', () => {
                if (isHome) {
                    const modal = document.getElementById('modalStorage');
                    if (modal) {
                        modal.classList.remove('hidden');
                    }
                } else {
                    window.location.href = basePath + 'index.html?action=storage';
                }
            });
        }
    }

    // Verificar parámetros de URL para abrir modales (cuando se viene de otra página)
    function checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');

        if (action) {
            // Esperar a que los modales estén disponibles
            setTimeout(() => {
                switch(action) {
                    case 'clients':
                        const modalClients = document.getElementById('modalClients');
                        if (modalClients) modalClients.classList.remove('hidden');
                        break;
                    case 'taxes':
                        const modalTaxes = document.getElementById('modalTaxes');
                        if (modalTaxes) modalTaxes.classList.remove('hidden');
                        break;
                    case 'storage':
                        const modalStorage = document.getElementById('modalStorage');
                        if (modalStorage) modalStorage.classList.remove('hidden');
                        break;
                }
                // Limpiar parámetros de la URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 100);
        }
    }

    // Exportar para uso global
    window.GlobalNav = {
        init: initGlobalNav,
        getBasePath: getBasePath,
        herramientas: herramientas
    };

    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initGlobalNav();
            checkURLParams();
        });
    } else {
        initGlobalNav();
        checkURLParams();
    }

})();
