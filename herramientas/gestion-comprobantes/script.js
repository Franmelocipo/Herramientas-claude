/**
 * SCRIPT PRINCIPAL - GESTIÓN DE COMPROBANTES
 * Maneja navegación, autenticación y carga de vistas
 */

// =====================================================
// VARIABLES GLOBALES
// =====================================================
let currentUser = null;
let currentUserData = null;
let currentView = null;

// =====================================================
// INICIALIZACIÓN
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación de gestión de comprobantes...');

    // Inicializar Supabase
    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    // Verificar autenticación
    await checkAuth();

    // Configurar navegación
    setupNavigation();

    // Configurar logout
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
});

// =====================================================
// AUTENTICACIÓN
// =====================================================

/**
 * Verifica si el usuario está autenticado y obtiene su rol
 */
async function checkAuth() {
    try {
        // Verificar si hay sesión activa
        const sessionAuth = sessionStorage.getItem('herramientas_auth');
        if (sessionAuth !== 'authenticated') {
            redirectToLogin();
            return;
        }

        // En un entorno real, obtendríamos el usuario de Supabase Auth
        // Por ahora, usaremos un sistema simple basado en localStorage
        const userEmail = localStorage.getItem('user_email');
        if (!userEmail) {
            redirectToLogin();
            return;
        }

        // MODO DESARROLLO: Si no hay Supabase configurado, usar usuario de prueba
        let userData = null;

        try {
            // Intentar obtener datos del usuario desde la tabla usuarios
            const { data, error } = await supabase
                .from('usuarios')
                .select('*, clients(nombre, cuit)')
                .eq('email', userEmail)
                .eq('activo', true)
                .single();

            if (!error && data) {
                userData = data;
            }
        } catch (err) {
            console.warn('Supabase no disponible o usuario no existe, usando modo desarrollo');
        }

        // Si no se pudo obtener de Supabase, usar usuario de desarrollo
        if (!userData) {
            console.log('🔧 MODO DESARROLLO: Usando usuario de prueba');
            userData = {
                id: 'dev-user-id',
                email: userEmail,
                nombre: 'Usuario de Desarrollo',
                rol: 'personal_estudio', // Por defecto personal del estudio para testing
                client_id: null,
                activo: true,
                clients: null
            };

            showNotification('Modo desarrollo: Usando usuario de prueba. Configura Supabase para producción.', 'warning', 5000);
        }

        currentUserData = userData;

        // Actualizar UI con información del usuario
        updateUserInfo(userData);

        // Mostrar navegación según rol
        showNavigationByRole(userData.rol);

        // Cargar vista inicial según rol
        loadInitialView(userData.rol);

        console.log('Usuario autenticado:', userData);
    } catch (error) {
        console.error('Error en autenticación:', error);
        redirectToLogin();
    }
}

/**
 * Actualiza la información del usuario en la UI
 */
function updateUserInfo(userData) {
    const displayNameEl = document.getElementById('userDisplayName');
    const roleEl = document.getElementById('userRole');

    if (displayNameEl) {
        if (userData.rol === 'cliente' && userData.clients) {
            displayNameEl.textContent = userData.clients.nombre;
        } else {
            displayNameEl.textContent = userData.nombre;
        }
    }

    if (roleEl) {
        const roleNames = {
            'cliente': 'Cliente',
            'personal_estudio': 'Personal del Estudio',
            'admin': 'Administrador'
        };
        roleEl.textContent = roleNames[userData.rol] || userData.rol;
    }
}

/**
 * Muestra la navegación según el rol del usuario
 */
function showNavigationByRole(rol) {
    const navCliente = document.getElementById('navCliente');
    const navEstudio = document.getElementById('navEstudio');

    if (rol === 'cliente') {
        navCliente.style.display = 'block';
        navEstudio.style.display = 'none';
    } else if (rol === 'personal_estudio' || rol === 'admin') {
        navCliente.style.display = 'none';
        navEstudio.style.display = 'block';
        // Actualizar badge de pendientes
        updatePendientesBadge();
    }
}

/**
 * Carga la vista inicial según el rol
 */
function loadInitialView(rol) {
    if (rol === 'cliente') {
        loadView('subir-comprobantes');
    } else {
        loadView('dashboard');
    }
}

/**
 * Actualiza el badge de comprobantes pendientes
 */
async function updatePendientesBadge() {
    try {
        if (!supabase) return; // Protección si Supabase no está inicializado

        const { data, error } = await supabase
            .from('comprobantes')
            .select('id', { count: 'exact' })
            .eq('estado', 'pendiente');

        if (!error) {
            const count = data?.length || 0;
            const badge = document.getElementById('badgePendientes');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (error) {
        console.warn('No se pudo actualizar badge (modo desarrollo)');
    }
}

/**
 * Redirige al login
 */
function redirectToLogin() {
    window.location.href = '../../login.html';
}

/**
 * Maneja el cierre de sesión
 */
function handleLogout() {
    sessionStorage.removeItem('herramientas_auth');
    localStorage.removeItem('user_email');
    redirectToLogin();
}

// =====================================================
// NAVEGACIÓN
// =====================================================

/**
 * Configura los event listeners de navegación
 */
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.getAttribute('data-view');
            if (view) {
                loadView(view);
                // Actualizar clase active
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
            }
        });
    });
}

/**
 * Carga una vista en el contenedor principal
 */
async function loadView(viewName) {
    const container = document.getElementById('viewContainer');
    if (!container) return;

    currentView = viewName;

    // Mostrar loader
    container.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>Cargando vista...</p>
        </div>
    `;

    try {
        // Cargar contenido según la vista
        let htmlContent = '';

        switch (viewName) {
            case 'subir-comprobantes':
                htmlContent = await loadSubirComprobantes();
                break;
            case 'mis-comprobantes':
                htmlContent = await loadMisComprobantes();
                break;
            case 'mis-ordenes':
                htmlContent = await loadMisOrdenes();
                break;
            case 'dashboard':
                htmlContent = await loadDashboard();
                break;
            case 'periodos':
                htmlContent = await loadPeriodos();
                break;
            case 'vinculacion':
                htmlContent = await loadVinculacion();
                break;
            case 'ordenes-pago':
                htmlContent = await loadOrdenesPago();
                break;
            case 'reportes':
                htmlContent = await loadReportes();
                break;
            case 'clientes':
                htmlContent = await loadClientes();
                break;
            case 'usuarios':
                htmlContent = await loadUsuarios();
                break;
            default:
                htmlContent = '<div class="empty-state"><h2>Vista no encontrada</h2></div>';
        }

        container.innerHTML = htmlContent;

        // Inicializar funcionalidad específica de la vista
        await initializeViewFunctionality(viewName);

    } catch (error) {
        console.error('Error cargando vista:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h2 class="empty-state-title">Error al cargar la vista</h2>
                <p class="empty-state-text">Por favor, intenta nuevamente</p>
            </div>
        `;
        handleError(error, 'Cargar vista');
    }
}

/**
 * Inicializa la funcionalidad específica de cada vista
 */
async function initializeViewFunctionality(viewName) {
    switch (viewName) {
        case 'subir-comprobantes':
            initSubirComprobantes();
            break;
        case 'mis-comprobantes':
            initMisComprobantes();
            break;
        case 'mis-ordenes':
            initMisOrdenes();
            break;
        case 'dashboard':
            initDashboard();
            break;
        case 'periodos':
            initPeriodos();
            break;
        case 'vinculacion':
            initVinculacion();
            break;
        case 'ordenes-pago':
            initOrdenesPago();
            break;
        case 'reportes':
            initReportes();
            break;
        case 'clientes':
            initClientes();
            break;
        case 'usuarios':
            initUsuarios();
            break;
    }
}

// =====================================================
// VISTAS - CLIENTE
// =====================================================

/**
 * Carga la vista de Subir Comprobantes
 */
async function loadSubirComprobantes() {
    // Obtener períodos abiertos del cliente
    let periodos = [];
    try {
        if (currentUserData.client_id) {
            periodos = await getPeriodosAbiertos(currentUserData.client_id);
        }
    } catch (error) {
        console.warn('No se pudieron cargar períodos (modo desarrollo)');
    }

    return `
        <div class="content-header">
            <h1>📤 Subir Comprobantes</h1>
            <p>Sube tus comprobantes de gastos y facturas</p>
        </div>

        ${periodos.length === 0 && !currentUserData.client_id ? `
        <div class="card" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <div class="card-body">
                <h3 style="color: #856404; margin-bottom: 12px;">🔧 Modo Desarrollo</h3>
                <p style="color: #856404; margin-bottom: 12px;">
                    Para usar esta funcionalidad necesitas:
                </p>
                <ol style="color: #856404; margin-left: 20px;">
                    <li>Configurar Supabase (ejecutar supabase-schema-comprobantes.sql)</li>
                    <li>Crear un cliente en la tabla <code>clients</code></li>
                    <li>Crear un usuario en la tabla <code>usuarios</code> con rol 'cliente'</li>
                    <li>Abrir un período en la tabla <code>periods</code></li>
                </ol>
                <p style="color: #856404; margin-top: 12px;">
                    Ver <code>herramientas/gestion-comprobantes/README.md</code> para instrucciones completas.
                </p>
            </div>
        </div>
        ` : ''}

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Nuevo Comprobante</h3>
            </div>
            <div class="card-body">
                <form id="formSubirComprobante">
                    <!-- Período -->
                    <div class="form-group">
                        <label class="form-label required">Período</label>
                        <select class="form-select" id="periodo" name="period_id" required>
                            <option value="">Seleccione un período</option>
                            ${periodos.map(p => `
                                <option value="${p.id}">${formatPeriodo(p.year, p.month)}</option>
                            `).join('')}
                        </select>
                        ${periodos.length === 0 ? '<p class="form-error">No hay períodos abiertos. Contacta al estudio.</p>' : ''}
                    </div>

                    <!-- Archivo -->
                    <div class="form-group">
                        <label class="form-label required">Archivo del Comprobante</label>
                        <div class="file-upload-area" id="fileUploadArea">
                            <div class="file-upload-icon">📎</div>
                            <div class="file-upload-text">Arrastra tu archivo aquí o haz click para seleccionar</div>
                            <div class="file-upload-hint">JPG, PNG o PDF - Máximo 10MB</div>
                        </div>
                        <input type="file" id="archivo" name="archivo" accept=".jpg,.jpeg,.png,.pdf" style="display: none;" required>
                        <div id="filePreview"></div>
                    </div>

                    <!-- Tipo de Comprobante -->
                    <div class="form-group">
                        <label class="form-label required">Tipo de Comprobante</label>
                        <select class="form-select" name="tipo_comprobante" required>
                            <option value="">Seleccione...</option>
                            <option value="factura_a">Factura A</option>
                            <option value="factura_b">Factura B</option>
                            <option value="factura_c">Factura C</option>
                            <option value="factura_e">Factura E</option>
                            <option value="recibo">Recibo</option>
                            <option value="ticket">Ticket</option>
                            <option value="nota_credito">Nota de Crédito</option>
                            <option value="nota_debito">Nota de Débito</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>

                    <div class="grid grid-2">
                        <!-- Número de Comprobante -->
                        <div class="form-group">
                            <label class="form-label">Número de Comprobante</label>
                            <input type="text" class="form-input" name="numero_comprobante" placeholder="0001-00001234">
                        </div>

                        <!-- Fecha -->
                        <div class="form-group">
                            <label class="form-label required">Fecha del Comprobante</label>
                            <input type="date" class="form-input" name="fecha_comprobante" required>
                        </div>
                    </div>

                    <div class="grid grid-2">
                        <!-- Proveedor -->
                        <div class="form-group">
                            <label class="form-label required">Proveedor</label>
                            <input type="text" class="form-input" name="proveedor" placeholder="Nombre del proveedor" required>
                        </div>

                        <!-- CUIT Proveedor -->
                        <div class="form-group">
                            <label class="form-label">CUIT del Proveedor</label>
                            <input type="text" class="form-input" name="cuit_proveedor" placeholder="XX-XXXXXXXX-X">
                        </div>
                    </div>

                    <!-- Monto Total -->
                    <div class="form-group">
                        <label class="form-label required">Monto Total</label>
                        <input type="number" class="form-input" name="monto_total" step="0.01" placeholder="0.00" required>
                    </div>

                    <!-- Concepto -->
                    <div class="form-group">
                        <label class="form-label">Concepto / Descripción</label>
                        <textarea class="form-textarea" name="concepto" placeholder="Descripción del gasto"></textarea>
                    </div>

                    <!-- Botones -->
                    <div class="form-group">
                        <button type="submit" class="btn btn-primary btn-lg" ${periodos.length === 0 ? 'disabled' : ''}>
                            <span class="icon">📤</span>
                            Subir Comprobante
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function initSubirComprobantes() {
    // Configurar drag & drop para archivo
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('archivo');
    const filePreview = document.getElementById('filePreview');

    if (fileUploadArea && fileInput) {
        fileUploadArea.addEventListener('click', () => fileInput.click());

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragging');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragging');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragging');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                showFilePreview(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                showFilePreview(e.target.files[0]);
            }
        });
    }

    function showFilePreview(file) {
        const validation = validarArchivoComprobante(file);
        if (!validation.valid) {
            showNotification(validation.error, 'error');
            fileInput.value = '';
            return;
        }

        filePreview.innerHTML = `
            <div class="file-preview">
                <div class="file-preview-icon">${file.type.includes('pdf') ? '📄' : '🖼️'}</div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${file.name}</div>
                    <div class="file-preview-size">${formatFileSize(file.size)}</div>
                </div>
                <button type="button" class="file-preview-remove" onclick="removeFile()">Quitar</button>
            </div>
        `;
    }

    window.removeFile = () => {
        fileInput.value = '';
        filePreview.innerHTML = '';
    };

    // Manejar envío del formulario
    const form = document.getElementById('formSubirComprobante');
    if (form) {
        form.addEventListener('submit', handleSubirComprobante);
    }
}

async function handleSubirComprobante(e) {
    e.preventDefault();

    const loader = showLoader('Subiendo comprobante...');

    try {
        const formData = new FormData(e.target);
        const file = document.getElementById('archivo').files[0];

        if (!file) {
            throw new Error('Debe seleccionar un archivo');
        }

        // Validar archivo
        const validation = validarArchivoComprobante(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Obtener datos del período seleccionado
        const periodId = formData.get('period_id');
        const { data: period } = await supabase
            .from('periods')
            .select('year, month')
            .eq('id', periodId)
            .single();

        if (!period) {
            throw new Error('Período no encontrado');
        }

        loader.updateMessage('Subiendo archivo...');

        // Subir archivo a Storage
        const archivoSubido = await subirArchivoComprobante(
            file,
            currentUserData.client_id,
            period.year,
            period.month
        );

        loader.updateMessage('Guardando comprobante...');

        // Crear comprobante en la BD
        const comprobante = {
            client_id: currentUserData.client_id,
            period_id: periodId,
            archivo_url: archivoSubido.url,
            archivo_nombre: archivoSubido.nombre,
            archivo_tipo: file.type,
            archivo_tamanio: file.size,
            tipo_comprobante: formData.get('tipo_comprobante'),
            numero_comprobante: formData.get('numero_comprobante') || null,
            fecha_comprobante: formData.get('fecha_comprobante'),
            proveedor: formData.get('proveedor'),
            cuit_proveedor: formData.get('cuit_proveedor') || null,
            monto_total: parseFloat(formData.get('monto_total')),
            concepto: formData.get('concepto') || null,
            subido_por: currentUserData.id
        };

        await crearComprobante(comprobante);

        loader.hide();
        showNotification('Comprobante subido exitosamente', 'success');

        // Limpiar formulario
        e.target.reset();
        document.getElementById('filePreview').innerHTML = '';

    } catch (error) {
        loader.hide();
        handleError(error, 'Subir comprobante');
    }
}

/**
 * Carga la vista de Mis Comprobantes
 */
async function loadMisComprobantes() {
    return `
        <div class="content-header">
            <h1>📄 Mis Comprobantes</h1>
            <p>Listado de todos tus comprobantes subidos</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Comprobantes</h3>
            </div>
            <div class="card-body">
                <div id="comprobantesContainer">
                    <div class="loader-content">
                        <div class="spinner"></div>
                        <p>Cargando comprobantes...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initMisComprobantes() {
    const container = document.getElementById('comprobantesContainer');

    try {
        let comprobantes = [];
        if (currentUserData.client_id) {
            comprobantes = await getComprobantes({ clientId: currentUserData.client_id });
        }

        if (comprobantes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <h3 class="empty-state-title">No hay comprobantes</h3>
                    <p class="empty-state-text">Todavía no has subido ningún comprobante</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th>Concepto</th>
                            <th>Monto</th>
                            <th>Estado</th>
                            <th>Archivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comprobantes.map(c => `
                            <tr>
                                <td>${formatDate(c.fecha_comprobante)}</td>
                                <td>${c.proveedor}</td>
                                <td>${c.concepto || '-'}</td>
                                <td>${formatCurrency(c.monto_total)}</td>
                                <td><span class="badge badge-${c.estado === 'vinculado' ? 'success' : 'warning'}">${c.estado}</span></td>
                                <td><a href="${c.archivo_url}" target="_blank" class="btn btn-sm btn-secondary">Ver</a></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        handleError(error, 'Cargar comprobantes');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">Error al cargar</h3>
                <p class="empty-state-text">No se pudieron cargar los comprobantes</p>
            </div>
        `;
    }
}

/**
 * Carga la vista de Mis Órdenes
 */
async function loadMisOrdenes() {
    return `
        <div class="content-header">
            <h1>💰 Órdenes de Pago</h1>
            <p>Estado de tus órdenes de pago</p>
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Órdenes</h3>
            </div>
            <div class="card-body">
                <div id="ordenesContainer">
                    <div class="loader-content">
                        <div class="spinner"></div>
                        <p>Cargando órdenes...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initMisOrdenes() {
    const container = document.getElementById('ordenesContainer');

    try {
        let ordenes = [];
        if (currentUserData.client_id) {
            ordenes = await getOrdenesPago({ clientId: currentUserData.client_id });
        }

        if (ordenes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <h3 class="empty-state-title">No hay órdenes de pago</h3>
                    <p class="empty-state-text">Todavía no tienes órdenes de pago generadas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Fecha</th>
                            <th>Beneficiario</th>
                            <th>Monto</th>
                            <th>Estado</th>
                            <th>Vencimiento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ordenes.map(o => `
                            <tr>
                                <td><strong>${o.numero_orden}</strong></td>
                                <td>${formatDate(o.fecha_solicitud)}</td>
                                <td>${o.beneficiario}</td>
                                <td>${formatCurrency(o.monto)}</td>
                                <td><span class="badge badge-${getBadgeClass(o.estado)}">${o.estado}</span></td>
                                <td>${o.fecha_vencimiento ? formatDate(o.fecha_vencimiento) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        handleError(error, 'Cargar órdenes');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">Error al cargar</h3>
                <p class="empty-state-text">No se pudieron cargar las órdenes</p>
            </div>
        `;
    }
}

function getBadgeClass(estado) {
    const classes = {
        'pendiente': 'warning',
        'aprobada': 'info',
        'pagada': 'success',
        'rechazada': 'danger'
    };
    return classes[estado] || 'secondary';
}

// =====================================================
// VISTAS - PERSONAL DEL ESTUDIO
// =====================================================
// Las implementaciones detalladas de dashboard, períodos, vinculación, etc.
// se cargarán desde archivos separados en las carpetas estudio/

async function loadDashboard() {
    return '<div class="content-header"><h1>📊 Dashboard</h1><p>Resumen general del sistema</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadPeriodos() {
    return '<div class="content-header"><h1>📅 Períodos</h1><p>Gestión de períodos contables</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadVinculacion() {
    return '<div class="content-header"><h1>🔗 Vinculación</h1><p>Vincular comprobantes con registros contables</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadOrdenesPago() {
    return '<div class="content-header"><h1>💳 Órdenes de Pago</h1><p>Gestión de órdenes de pago</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadReportes() {
    return '<div class="content-header"><h1>📈 Reportes</h1><p>Reportes y estadísticas</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadClientes() {
    return '<div class="content-header"><h1>👥 Clientes</h1><p>Gestión de clientes</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

async function loadUsuarios() {
    return '<div class="content-header"><h1>⚙️ Usuarios</h1><p>Gestión de usuarios del sistema</p></div><div class="card"><p>Vista en desarrollo...</p></div>';
}

// Inicialización por defecto para vistas pendientes
function initDashboard() {}
function initPeriodos() {}
function initVinculacion() {}
function initOrdenesPago() {}
function initReportes() {}
function initClientes() {}
function initUsuarios() {}
