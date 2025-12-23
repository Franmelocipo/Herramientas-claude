// ============================================
// MÓDULO DE ANÁLISIS DE MAYORES CONTABLES
// ============================================

/**
 * Mostrar notificación temporal (función local para este módulo)
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : tipo === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

// Estado del módulo de mayores
const stateMayores = {
    clienteActual: null,
    tipoMayorActual: null,
    registrosMayor: [],
    registrosOriginales: [],
    vinculaciones: [],
    cuponesSeleccionados: [],
    liquidacionesSeleccionadas: [],
    clientesCache: [],
    conciliacionCargadaId: null,  // ID de la conciliación actualmente cargada
    conciliacionCargadaNombre: null,  // Nombre de la conciliación actualmente cargada
    // Estado del listado de cheques recibidos
    listadoChequesIncorporado: false,
    listadoChequesCargados: [],
    listadoChequesTemporal: [],  // Datos temporales mientras se valida
    // Estado para conciliación por mes
    mesesDisponibles: [],          // Array de meses disponibles para conciliar
    mesesProcesados: {},           // Objeto con estado de cada mes { 'YYYY-MM': { procesado: true, vinculaciones: [...], ... } }
    mesActualConciliacion: null,   // Mes actualmente seleccionado para conciliar
    listadoChequesGuardadoId: null, // ID del listado de cheques guardado
    // Estado para movimientos eliminados
    movimientosEliminados: []      // Array de movimientos eliminados con notas
};

// Variables para gestión de conciliaciones
let conciliacionesMayorGuardadasLista = [];
let conciliacionMayorSeleccionadaId = null;
let conciliacionMayorAEliminarId = null;

// Estado del modal de vinculación manual
let estadoModalVincular = {
    tipo: null,           // 'cheque-a-asiento' o 'asiento-a-cheque'
    elementoOrigen: null, // Cheque o Asiento seleccionado
    opcionesDisponibles: [], // Lista de opciones filtradas
    opcionesTodas: [],    // Lista completa de opciones
    opcionSeleccionada: null // ID de la opción seleccionada
};

// ============================================
// FUNCIONES DE PROGRESO DE CONCILIACIÓN
// ============================================

/**
 * Mostrar panel de progreso de conciliación
 */
function mostrarProgresoConciliacion() {
    document.getElementById('panelConfigConciliacion').style.display = 'none';
    document.getElementById('resultadosConciliacion').style.display = 'none';
    document.getElementById('panelProgresoConciliacion').style.display = 'block';
    actualizarProgresoConciliacion(0, 'Preparando conciliación...');
}

/**
 * Ocultar panel de progreso de conciliación
 */
function ocultarProgresoConciliacion() {
    document.getElementById('panelProgresoConciliacion').style.display = 'none';
}

/**
 * Actualizar barra de progreso de conciliación
 * @param {number} porcentaje - Porcentaje de progreso (0-100)
 * @param {string} detalle - Texto descriptivo del estado actual
 */
function actualizarProgresoConciliacion(porcentaje, detalle) {
    const barra = document.getElementById('progresoConciliacionBarra');
    const texto = document.getElementById('progresoConciliacionTexto');
    const detalleEl = document.getElementById('progresoConciliacionDetalle');

    if (barra) barra.style.width = `${porcentaje}%`;
    if (texto) texto.textContent = `${Math.round(porcentaje)}%`;
    if (detalleEl) detalleEl.textContent = detalle;
}

/**
 * Pausa para permitir que la UI se actualice
 * @returns {Promise} Promesa que se resuelve en el siguiente frame
 */
function permitirActualizacionUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

// ============================================
// FUNCIONES DE PROGRESO DE INCORPORACIÓN DE CHEQUES
// ============================================

/**
 * Mostrar panel de progreso de incorporación de cheques
 */
function mostrarProgresoCheques() {
    const panel = document.getElementById('panelProgresoCheques');
    const botones = document.getElementById('botonesModalCheques');

    if (panel) panel.style.display = 'block';
    if (botones) botones.style.display = 'none';

    actualizarProgresoCheques(0, 'Preparando incorporación de cheques...');
}

/**
 * Ocultar panel de progreso de incorporación de cheques
 */
function ocultarProgresoCheques() {
    const panel = document.getElementById('panelProgresoCheques');
    const botones = document.getElementById('botonesModalCheques');

    if (panel) panel.style.display = 'none';
    if (botones) botones.style.display = 'flex';
}

/**
 * Actualizar barra de progreso de incorporación de cheques
 * @param {number} porcentaje - Porcentaje de progreso (0-100)
 * @param {string} detalle - Texto descriptivo del estado actual
 */
function actualizarProgresoCheques(porcentaje, detalle) {
    const barra = document.getElementById('progresoChequeBarra');
    const texto = document.getElementById('progresoChequeTexto');
    const detalleEl = document.getElementById('progresoChequeDetalle');

    if (barra) barra.style.width = `${porcentaje}%`;
    if (texto) texto.textContent = `${Math.round(porcentaje)}%`;
    if (detalleEl) detalleEl.textContent = detalle;
}

// Tipos de mayores predefinidos
const TIPOS_MAYOR_DEFAULT = [
    {
        id: 'cupones_tarjetas',
        nombre: 'Cupones de Tarjetas',
        descripcion: 'Análisis de cupones de crédito/débito y sus liquidaciones',
        logica: 'vinculacion',
        icono: '💳',
        configuracion: {
            diasVencimiento: 40,
            debeEsCupon: true,  // Los cupones van al debe
            haberEsLiquidacion: true,  // Las liquidaciones van al haber
            // Configuración genérica de vinculación
            tipoOrigen: 'debe',      // El origen de la vinculación (cupones)
            tipoDestino: 'haber',    // El destino de la vinculación (liquidaciones)
            etiquetaOrigen: 'Cupones',
            etiquetaDestino: 'Liquidaciones',
            etiquetaSingularOrigen: 'cupón',
            etiquetaSingularDestino: 'liquidación',
            articuloOrigen: 'un',        // Artículo singular para origen (cupón = masculino)
            articuloDestino: 'una',      // Artículo singular para destino (liquidación = femenino)
            articuloPluralOrigen: 'varios',   // Artículo plural para origen
            articuloPluralDestino: 'varias',  // Artículo plural para destino
            iconoOrigen: '📋',
            iconoDestino: '💰',
            descripcionVinculacion: 'Los cupones (débitos) deben vincularse con liquidaciones (créditos) dentro de 40 días.'
        }
    },
    {
        id: 'cheques_diferidos',
        nombre: 'Cheques Diferidos Emitidos',
        descripcion: 'Análisis de cheques diferidos emitidos y sus cobros por terceros',
        logica: 'vinculacion',
        icono: '📝',
        configuracion: {
            diasVencimiento: 180,  // Los cheques diferidos pueden tardar más en cobrarse
            debeEsCupon: false,    // La lógica está invertida
            haberEsLiquidacion: false,
            // Configuración genérica de vinculación
            tipoOrigen: 'haber',     // Las emisiones van al haber
            tipoDestino: 'debe',     // Los cobros van al debe
            etiquetaOrigen: 'Emisiones',
            etiquetaDestino: 'Cobros',
            etiquetaSingularOrigen: 'emisión',
            etiquetaSingularDestino: 'cobro',
            articuloOrigen: 'una',       // Artículo singular para origen (emisión = femenino)
            articuloDestino: 'un',       // Artículo singular para destino (cobro = masculino)
            articuloPluralOrigen: 'varias',  // Artículo plural para origen
            articuloPluralDestino: 'varios', // Artículo plural para destino
            iconoOrigen: '📤',
            iconoDestino: '📥',
            descripcionVinculacion: 'Las emisiones de cheques (haber) deben vincularse con los cobros por terceros (debe).'
        }
    },
    {
        id: 'cheques_terceros_recibidos',
        nombre: 'Cheques de Terceros Recibidos',
        descripcion: 'Análisis de cheques de terceros recibidos y su posterior uso o depósito',
        logica: 'vinculacion',
        icono: '🏦',
        configuracion: {
            diasVencimiento: 365,  // Plazo amplio ya que el tiempo entre ingreso y uso es variable
            debeEsCupon: true,     // Los ingresos de cheques van al debe
            haberEsLiquidacion: true,  // El uso de cheques va al haber
            // Configuración genérica de vinculación
            tipoOrigen: 'debe',      // Los cheques recibidos se registran en el DEBE
            tipoDestino: 'haber',    // El uso/depósito de cheques se registra en el HABER
            etiquetaOrigen: 'Ingresos',
            etiquetaDestino: 'Usos',
            etiquetaSingularOrigen: 'ingreso',
            etiquetaSingularDestino: 'uso',
            articuloOrigen: 'un',        // Artículo singular para origen (ingreso = masculino)
            articuloDestino: 'un',       // Artículo singular para destino (uso = masculino)
            articuloPluralOrigen: 'varios',   // Artículo plural para origen
            articuloPluralDestino: 'varios',  // Artículo plural para destino
            iconoOrigen: '📥',
            iconoDestino: '📤',
            descripcionVinculacion: 'Los ingresos de cheques (debe) deben vincularse con sus usos o depósitos (haber). El tiempo entre un movimiento y otro es variable.'
        }
    }
];

// Tipos de mayor dinámicos
let TIPOS_MAYOR = [...TIPOS_MAYOR_DEFAULT];

// ============================================
// FUNCIONES HELPER PARA CONFIGURACIÓN DINÁMICA
// ============================================

/**
 * Obtener configuración de vinculación del tipo de mayor actual
 * @returns {Object} Configuración de vinculación con valores por defecto
 */
function obtenerConfigVinculacion() {
    const config = stateMayores.tipoMayorActual?.configuracion || {};
    return {
        diasVencimiento: config.diasVencimiento || 40,
        tipoOrigen: config.tipoOrigen || 'debe',
        tipoDestino: config.tipoDestino || 'haber',
        etiquetaOrigen: config.etiquetaOrigen || 'Cupones',
        etiquetaDestino: config.etiquetaDestino || 'Liquidaciones',
        etiquetaSingularOrigen: config.etiquetaSingularOrigen || 'cupón',
        etiquetaSingularDestino: config.etiquetaSingularDestino || 'liquidación',
        articuloOrigen: config.articuloOrigen || 'un',
        articuloDestino: config.articuloDestino || 'una',
        articuloPluralOrigen: config.articuloPluralOrigen || 'varios',
        articuloPluralDestino: config.articuloPluralDestino || 'varias',
        iconoOrigen: config.iconoOrigen || '📋',
        iconoDestino: config.iconoDestino || '💰',
        descripcionVinculacion: config.descripcionVinculacion || 'Vincule los registros de origen con los de destino.'
    };
}

/**
 * Determina si se deben usar los cheques del listado como "origen" (ingresos)
 * para el paso 3 de conciliación en lugar de los registros del debe.
 * Esto aplica solo para cheques_terceros_recibidos cuando hay listado incorporado.
 * @returns {boolean} true si se deben usar cheques como origen
 */
function usarChequesComoOrigen() {
    return stateMayores.tipoMayorActual?.id === 'cheques_terceros_recibidos' &&
           stateMayores.listadoChequesIncorporado &&
           stateMayores.listadoChequesCargados &&
           stateMayores.listadoChequesCargados.length > 0;
}

/**
 * Obtener registros de origen según configuración (cupones o emisiones)
 * Para cheques_terceros_recibidos con listado incorporado, retorna los cheques
 * del listado como "ingresos" en lugar de los registros del debe.
 * @param {Array} registros - Lista de registros
 * @param {boolean} incluirVinculados - Incluir registros ya vinculados
 * @returns {Array} Registros de origen filtrados
 */
function obtenerRegistrosOrigen(registros, incluirVinculados = true) {
    const config = obtenerConfigVinculacion();

    // Para cheques de terceros con listado incorporado, usar los cheques como origen
    if (usarChequesComoOrigen()) {
        return stateMayores.listadoChequesCargados.filter(cheque => {
            if (!incluirVinculados && cheque.estadoVinculacion === 'vinculado') return false;
            return true;
        }).map(cheque => ({
            // Propiedades del cheque original
            ...cheque,
            // Propiedades adaptadas para compatibilidad con el sistema de vinculación
            fecha: cheque.fechaRecepcion || cheque.fechaEmision,
            descripcion: `${cheque.origen || 'Sin origen'} - Cheque #${cheque.numero || cheque.interno || 'S/N'}`,
            debe: cheque.importe,
            haber: 0,
            estado: cheque.estadoVinculacion || 'pendiente',
            esCheque: true,  // Marcador para identificar que es un cheque
            chequeOriginal: cheque  // Referencia al cheque original
        }));
    }

    // Comportamiento estándar para otros tipos de mayor
    return registros.filter(r => {
        if (!incluirVinculados && r.estado === 'vinculado') return false;
        if (r.esDevolucion) return false;

        if (config.tipoOrigen === 'debe') {
            return r.debe > 0;
        } else {
            return r.haber > 0;
        }
    });
}

/**
 * Obtener registros de destino según configuración (liquidaciones o cobros)
 * @param {Array} registros - Lista de registros
 * @param {boolean} incluirVinculados - Incluir registros ya vinculados
 * @returns {Array} Registros de destino filtrados
 */
function obtenerRegistrosDestino(registros, incluirVinculados = true) {
    const config = obtenerConfigVinculacion();
    return registros.filter(r => {
        if (!incluirVinculados && r.estado === 'vinculado') return false;

        if (config.tipoDestino === 'haber') {
            return r.haber > 0 || r.esDevolucion;
        } else {
            return r.debe > 0 || r.esDevolucion;
        }
    });
}

/**
 * Obtener monto de origen de un registro según configuración
 * Para cheques, retorna el importe del cheque
 * @param {Object} registro - Registro del mayor o cheque
 * @returns {number} Monto de origen
 */
function obtenerMontoOrigen(registro) {
    // Si es un cheque, retornar el importe
    if (registro.esCheque || registro.importe !== undefined) {
        return registro.importe || registro.debe || 0;
    }
    const config = obtenerConfigVinculacion();
    return config.tipoOrigen === 'debe' ? registro.debe : registro.haber;
}

/**
 * Obtener monto de destino de un registro según configuración
 * @param {Object} registro - Registro del mayor
 * @returns {number} Monto de destino
 */
function obtenerMontoDestino(registro) {
    const config = obtenerConfigVinculacion();
    return config.tipoDestino === 'haber' ? registro.haber : registro.debe;
}

/**
 * Determinar si un registro es de tipo "origen" según configuración
 * @param {Object} registro - Registro del mayor
 * @returns {boolean} true si es registro de origen
 */
function esRegistroOrigen(registro) {
    if (registro.esDevolucion) return false;
    const config = obtenerConfigVinculacion();
    if (config.tipoOrigen === 'debe') {
        return registro.debe > 0;
    } else {
        return registro.haber > 0;
    }
}

// ============================================
// NAVEGACIÓN ENTRE MÓDULOS
// ============================================

/**
 * Seleccionar herramienta de auditoría
 */
function seleccionarHerramienta(herramienta) {
    const panelHerramientas = document.getElementById('herramientasPanel');
    const moduloExtractos = document.getElementById('moduloExtractos');
    const moduloMayores = document.getElementById('moduloMayores');

    panelHerramientas.style.display = 'none';

    if (herramienta === 'extractos') {
        moduloExtractos.style.display = 'block';
        moduloMayores.style.display = 'none';
        // Cargar clientes si no están cargados
        if (state.clientesCache.length === 0) {
            cargarClientes();
        }
    } else if (herramienta === 'mayores') {
        moduloExtractos.style.display = 'none';
        moduloMayores.style.display = 'block';
        inicializarModuloMayores();
    }
}

/**
 * Volver al panel de herramientas
 */
function volverAHerramientas() {
    const panelHerramientas = document.getElementById('herramientasPanel');
    const moduloExtractos = document.getElementById('moduloExtractos');
    const moduloMayores = document.getElementById('moduloMayores');

    panelHerramientas.style.display = 'block';
    moduloExtractos.style.display = 'none';
    moduloMayores.style.display = 'none';

    // Resetear estado
    stateMayores.clienteActual = null;
    stateMayores.tipoMayorActual = null;
    stateMayores.registrosMayor = [];
}

// ============================================
// INICIALIZACIÓN DEL MÓDULO DE MAYORES
// ============================================

/**
 * Inicializar módulo de mayores
 */
async function inicializarModuloMayores() {
    await cargarClientesMayores();
    await cargarTiposMayor();
    renderizarTiposMayor();
}

/**
 * Cargar clientes en el selector de mayores
 */
async function cargarClientesMayores() {
    const select = document.getElementById('clienteSelectMayores');

    try {
        let clientes = [];

        const client = typeof waitForSupabase === 'function' ? await waitForSupabase() : window.supabaseDB;
        if (client) {
            const { data, error } = await client
                .from('clientes')
                .select('*')
                .order('razon_social');

            if (error) throw error;
            clientes = data || [];
        } else {
            clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
        }

        stateMayores.clientesCache = clientes;
        renderizarSelectClientesMayores(clientes);
    } catch (error) {
        console.error('Error cargando clientes para mayores:', error);
        select.innerHTML = '<option value="">Error al cargar clientes</option>';
    }
}

/**
 * Renderizar opciones del selector de clientes para mayores
 */
function renderizarSelectClientesMayores(clientes) {
    const select = document.getElementById('clienteSelectMayores');

    select.innerHTML = '<option value="">-- Seleccione un cliente --</option>' +
        clientes.map(c => `<option value="${c.id}" data-cuit="${c.cuit || ''}">${c.razon_social}${c.cuit ? ` (${c.cuit})` : ''}</option>`).join('');
}

/**
 * Filtrar clientes en el selector de mayores
 */
function filtrarClientesMayores() {
    const busqueda = document.getElementById('clienteSearchMayores').value.toLowerCase();
    const clientes = stateMayores.clientesCache;

    const filtrados = clientes.filter(c => {
        const nombre = (c.razon_social || '').toLowerCase();
        const cuit = (c.cuit || '').toLowerCase();
        return nombre.includes(busqueda) || cuit.includes(busqueda);
    });

    renderizarSelectClientesMayores(filtrados);
}

/**
 * Cargar dashboard de mayores cuando se selecciona cliente
 */
function cargarDashboardMayores() {
    const select = document.getElementById('clienteSelectMayores');
    const clienteId = select.value;

    if (!clienteId) {
        document.getElementById('dashboardMayores').style.display = 'none';
        document.getElementById('emptyStateMayores').style.display = 'block';
        stateMayores.clienteActual = null;
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const clienteNombre = selectedOption.text.split(' (')[0];
    const clienteCuit = selectedOption.dataset.cuit || '';

    stateMayores.clienteActual = {
        id: clienteId,
        nombre: clienteNombre,
        cuit: clienteCuit
    };

    document.getElementById('clienteNombreMayores').textContent = clienteNombre;
    document.getElementById('clienteCuitMayores').textContent = clienteCuit ? `CUIT: ${clienteCuit}` : '';

    document.getElementById('dashboardMayores').style.display = 'block';
    document.getElementById('emptyStateMayores').style.display = 'none';

    // Ocultar panel de análisis al cambiar de cliente
    document.getElementById('panelAnalisisMayor').style.display = 'none';
    stateMayores.tipoMayorActual = null;

    // Resetear selección de tipo
    document.querySelectorAll('.tipo-mayor-card').forEach(card => {
        card.classList.remove('active');
    });
}

// ============================================
// TIPOS DE MAYOR
// ============================================

/**
 * Cargar tipos de mayor desde localStorage o Supabase
 */
async function cargarTiposMayor() {
    try {
        // Intentar cargar desde localStorage primero
        const tiposGuardados = localStorage.getItem('auditoria_tipos_mayor');
        if (tiposGuardados) {
            TIPOS_MAYOR = JSON.parse(tiposGuardados);

            // Sincronizar: agregar nuevos tipos por defecto que no existan en localStorage
            const idsExistentes = new Set(TIPOS_MAYOR.map(t => t.id));
            const tiposNuevos = TIPOS_MAYOR_DEFAULT.filter(t => !idsExistentes.has(t.id));

            if (tiposNuevos.length > 0) {
                TIPOS_MAYOR = [...TIPOS_MAYOR, ...tiposNuevos];
                localStorage.setItem('auditoria_tipos_mayor', JSON.stringify(TIPOS_MAYOR));
                console.log(`✅ Sincronizados ${tiposNuevos.length} nuevos tipos de mayor:`, tiposNuevos.map(t => t.nombre));
            }
        } else {
            TIPOS_MAYOR = [...TIPOS_MAYOR_DEFAULT];
            localStorage.setItem('auditoria_tipos_mayor', JSON.stringify(TIPOS_MAYOR));
        }
    } catch (error) {
        console.error('Error cargando tipos de mayor:', error);
        TIPOS_MAYOR = [...TIPOS_MAYOR_DEFAULT];
    }
}

/**
 * Renderizar grid de tipos de mayor
 */
function renderizarTiposMayor() {
    const container = document.getElementById('tiposMayorGrid');

    if (!TIPOS_MAYOR || TIPOS_MAYOR.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay tipos de mayor configurados</div>';
        return;
    }

    container.innerHTML = TIPOS_MAYOR.map(tipo => `
        <div class="tipo-mayor-card" onclick="seleccionarTipoMayor('${tipo.id}')" data-tipo="${tipo.id}">
            <h4>
                <span>${tipo.icono || '📊'}</span>
                ${tipo.nombre}
                <span class="tipo-badge">${tipo.logica === 'vinculacion' ? 'Vinculación' : 'Simple'}</span>
            </h4>
            <p>${tipo.descripcion}</p>
        </div>
    `).join('');
}

/**
 * Seleccionar tipo de mayor
 */
function seleccionarTipoMayor(tipoId) {
    const tipo = TIPOS_MAYOR.find(t => t.id === tipoId);
    if (!tipo) return;

    stateMayores.tipoMayorActual = tipo;

    // Marcar como activo
    document.querySelectorAll('.tipo-mayor-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`.tipo-mayor-card[data-tipo="${tipoId}"]`).classList.add('active');

    // Mostrar panel de análisis
    document.getElementById('panelAnalisisMayor').style.display = 'block';
    document.getElementById('tipoMayorTitulo').textContent = `${tipo.icono || '📊'} ${tipo.nombre}`;
    document.getElementById('tipoMayorDescripcion').textContent = tipo.descripcion;

    // Mostrar/ocultar panel de vinculación según el tipo
    const panelVinculacion = document.getElementById('panelVinculacionCupones');
    if (tipo.logica === 'vinculacion') {
        panelVinculacion.style.display = 'block';
        // Actualizar etiquetas dinámicas según el tipo de mayor
        actualizarEtiquetasVinculacion();
        // Actualizar títulos del paso de vinculación
        actualizarTitulosPasoVinculacion();
    } else {
        panelVinculacion.style.display = 'none';
    }

    // Mostrar/ocultar panel de conciliación cheques vs debe (Paso 1)
    actualizarPanelConciliacionChequesDebe();

    // Ocultar botón de cargar listado cheques de la toolbar (ahora está en el paso 1)
    const btnCargarListadoCheques = document.getElementById('btnCargarListadoCheques');
    if (btnCargarListadoCheques) {
        btnCargarListadoCheques.style.display = 'none';
    }

    // Ocultar info del mayor (hasta que se cargue)
    document.getElementById('infoMayorCargado').style.display = 'none';

    // Ocultar botón de guardar (hasta que se cargue un mayor)
    const btnGuardar = document.getElementById('btnGuardarConciliacion');
    if (btnGuardar) btnGuardar.style.display = 'none';

    // Resetear datos y estado de conciliación cargada
    stateMayores.registrosMayor = [];
    stateMayores.vinculaciones = [];
    stateMayores.conciliacionCargadaId = null;
    stateMayores.conciliacionCargadaNombre = null;
    stateMayores.listadoChequesIncorporado = false;
    stateMayores.listadoChequesCargados = [];

    // Ocultar y resetear filtro de asociaciones parciales
    const filtroParcialesLabel = document.getElementById('filtroParcialesLabel');
    if (filtroParcialesLabel) {
        filtroParcialesLabel.style.display = 'none';
    }
    const checkboxParciales = document.getElementById('mostrarSoloParciales');
    if (checkboxParciales) {
        checkboxParciales.checked = false;
    }

    renderizarTablaMayor();
    renderizarVinculacion();

    // Verificar si hay conciliaciones guardadas para este cliente/tipo
    verificarConciliacionesMayorGuardadas();
}

/**
 * Actualizar etiquetas del panel de vinculación según el tipo de mayor
 */
function actualizarEtiquetasVinculacion() {
    const config = obtenerConfigVinculacion();

    // Actualizar título del panel
    const headerTitle = document.querySelector('.vinculacion-header h4');
    if (headerTitle) {
        headerTitle.textContent = `🔗 Vinculación de ${config.etiquetaOrigen}`;
    }

    // Actualizar descripción de lógica
    const vinculacionInfo = document.querySelector('.vinculacion-info p');
    if (vinculacionInfo) {
        vinculacionInfo.innerHTML = `<strong>Lógica de vinculación:</strong> ${config.descripcionVinculacion}`;
    }

    // Actualizar etiqueta de vencidos según configuración
    const vencidosLabel = document.querySelector('.vinculacion-stats .stat.vencidos');
    if (vencidosLabel) {
        const vencidosCount = vencidosLabel.querySelector('span');
        vencidosLabel.innerHTML = `<span id="cuponesVencidos">${vencidosCount?.textContent || '0'}</span> vencidos (+${config.diasVencimiento} días)`;
    }

    // Actualizar encabezado columna origen (cupones/emisiones)
    const columnaOrigenHeader = document.querySelector('.cupones-columna .columna-header h5');
    if (columnaOrigenHeader) {
        const tipoColumna = config.tipoOrigen === 'debe' ? 'Debe' : 'Haber';
        columnaOrigenHeader.textContent = `${config.iconoOrigen} ${config.etiquetaOrigen} (${tipoColumna})`;
    }

    // Actualizar encabezado columna destino (liquidaciones/cobros)
    const columnaDestinoHeader = document.querySelector('.liquidaciones-columna .columna-header h5');
    if (columnaDestinoHeader) {
        const tipoColumna = config.tipoDestino === 'haber' ? 'Haber' : 'Debe';
        columnaDestinoHeader.textContent = `${config.iconoDestino} ${config.etiquetaDestino} (${tipoColumna})`;
    }

    // Actualizar etiquetas en la barra de selección flotante
    const selOrigenLabel = document.querySelector('.cupones-group .selection-label');
    if (selOrigenLabel) {
        selOrigenLabel.textContent = config.etiquetaOrigen + ':';
    }

    const selDestinoLabel = document.querySelector('.liquidaciones-group .selection-label');
    if (selDestinoLabel) {
        selDestinoLabel.textContent = config.etiquetaDestino + ':';
    }

    // Actualizar iconos en la barra de selección
    const selOrigenIcon = document.querySelector('.cupones-group .selection-icon');
    if (selOrigenIcon) {
        selOrigenIcon.textContent = config.iconoOrigen;
    }

    const selDestinoIcon = document.querySelector('.liquidaciones-group .selection-icon');
    if (selDestinoIcon) {
        selDestinoIcon.textContent = config.iconoDestino;
    }

    // Actualizar opciones del modo de conciliación con artículos correctos
    const modoConciliacion = document.getElementById('modoConciliacion');
    if (modoConciliacion) {
        const opciones = modoConciliacion.options;
        // Capitalizar primera letra del artículo para inicio de frase
        const artOrigenCap = config.articuloOrigen.charAt(0).toUpperCase() + config.articuloOrigen.slice(1);
        const artPluralOrigenCap = config.articuloPluralOrigen.charAt(0).toUpperCase() + config.articuloPluralOrigen.slice(1);
        opciones[0].textContent = `1:1 - ${artOrigenCap} ${config.etiquetaSingularOrigen} con ${config.articuloDestino} ${config.etiquetaSingularDestino}`;
        opciones[1].textContent = `N:1 - ${artPluralOrigenCap} ${config.etiquetaOrigen.toLowerCase()} con ${config.articuloDestino} ${config.etiquetaSingularDestino}`;
        opciones[2].textContent = `1:N - ${artOrigenCap} ${config.etiquetaSingularOrigen} con ${config.articuloPluralDestino} ${config.etiquetaDestino.toLowerCase()}`;
    }

    // Actualizar etiquetas en panel de configuración
    const labelDias = document.querySelector('.config-item label[for="diasMaximos"], .config-item label');
    if (labelDias && labelDias.textContent.includes('Días máximos')) {
        const tipoMayor = stateMayores.tipoMayorActual;
        const sufijo = tipoMayor === 'cheques_diferidos' ? ' de cheques' : '';
        labelDias.textContent = `Días máximos entre ${config.etiquetaSingularOrigen} y ${config.etiquetaSingularDestino}${sufijo}:`;
    }
}

// ============================================
// CARGA Y PROCESAMIENTO DE MAYOR
// ============================================

/**
 * Mostrar modal para subir mayor
 */
function mostrarSubirMayor() {
    document.getElementById('modalSubirMayor').classList.remove('hidden');
    document.getElementById('mayorFile').value = '';
    document.getElementById('mayorFileInfo').innerHTML = '';
    document.getElementById('mayorPreviewInfo').style.display = 'none';
}

/**
 * Cerrar modal de subir mayor
 */
function cerrarSubirMayor() {
    document.getElementById('modalSubirMayor').classList.add('hidden');
}

/**
 * Manejar cambio de archivo de mayor
 */
function handleMayorFileChange(event) {
    const file = event.target.files[0];
    const fileInfo = document.getElementById('mayorFileInfo');
    const previewInfo = document.getElementById('mayorPreviewInfo');

    if (!file) {
        fileInfo.innerHTML = '';
        previewInfo.style.display = 'none';
        return;
    }

    fileInfo.innerHTML = `<strong>Archivo:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    // Leer preview del archivo
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length > 1) {
                const headers = jsonData[0];
                const rowCount = jsonData.length - 1;
                previewInfo.innerHTML = `
                    <strong>Vista previa:</strong><br>
                    Columnas detectadas: ${headers.join(', ')}<br>
                    Registros: ${rowCount}
                `;
                previewInfo.style.display = 'block';
            }
        } catch (error) {
            console.error('Error leyendo archivo:', error);
            previewInfo.innerHTML = '<span style="color: red;">Error al leer el archivo</span>';
            previewInfo.style.display = 'block';
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Parsear número en formato argentino (puntos = miles, coma = decimal)
 */
function parsearNumeroArgentino(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;

    // Si ya es número, retornarlo
    if (typeof valor === 'number') return valor;

    // Convertir a string
    let str = valor.toString().trim();

    // Quitar símbolos de moneda y espacios
    str = str.replace(/[$\s]/g, '');

    // Si está vacío o es solo guiones, retornar 0
    if (!str || str === '-' || str === '--') return 0;

    // Detectar formato:
    // Formato argentino: 56.247,680 (punto = miles, coma = decimal)
    // Formato internacional: 56,247.680 (coma = miles, punto = decimal)

    const tienePunto = str.includes('.');
    const tieneComa = str.includes(',');

    if (tienePunto && tieneComa) {
        // Tiene ambos - determinar cuál es el decimal por posición
        const posPunto = str.lastIndexOf('.');
        const posComa = str.lastIndexOf(',');

        if (posComa > posPunto) {
            // Formato argentino: 1.234,56
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // Formato internacional: 1,234.56
            str = str.replace(/,/g, '');
        }
    } else if (tieneComa && !tienePunto) {
        // Solo coma - probablemente decimal argentino: 1234,56
        str = str.replace(',', '.');
    } else if (tienePunto && !tieneComa) {
        // Solo punto - verificar si es decimal o miles
        // Si hay más de un punto, son separadores de miles
        const puntos = (str.match(/\./g) || []).length;
        if (puntos > 1) {
            // Múltiples puntos = separadores de miles sin decimal
            str = str.replace(/\./g, '');
        }
        // Si solo hay un punto, asumir que es decimal
    }

    const resultado = parseFloat(str);
    return isNaN(resultado) ? 0 : Math.abs(resultado);
}

/**
 * Buscar valor en objeto de fila con múltiples posibles nombres de columna
 * @param {Object} row - Fila de datos
 * @param {Object} opciones - Opciones de búsqueda (excluir: array de palabras a excluir)
 * @param {...string} nombres - Nombres posibles de columna
 */
function buscarColumna(row, opciones, ...nombres) {
    // Si opciones es string, es un nombre de columna (compatibilidad hacia atrás)
    if (typeof opciones === 'string') {
        nombres.unshift(opciones);
        opciones = {};
    }

    const excluir = opciones.excluir || [];

    for (const nombre of nombres) {
        // Buscar coincidencia exacta
        if (row[nombre] !== undefined) return row[nombre];

        // Buscar coincidencia parcial (la columna contiene el nombre)
        for (const key of Object.keys(row)) {
            if (key.toLowerCase().includes(nombre.toLowerCase())) {
                // Verificar que no contenga palabras excluidas
                const contieneExcluida = excluir.some(ex =>
                    key.toLowerCase().includes(ex.toLowerCase())
                );
                if (!contieneExcluida) {
                    return row[key];
                }
            }
        }
    }
    return '';
}

/**
 * Procesar archivo de mayor
 */
async function procesarMayor() {
    const fileInput = document.getElementById('mayorFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Por favor seleccione un archivo');
        return;
    }

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (jsonData.length === 0) {
            alert('El archivo está vacío');
            return;
        }

        console.log('Columnas detectadas:', Object.keys(jsonData[0]));
        console.log('Primera fila:', jsonData[0]);

        // Mapear columnas del mayor de Tango (flexibilidad en nombres)
        const registros = jsonData.map((row, index) => {
            // Buscar columnas con múltiples nombres posibles
            const fecha = buscarColumna(row, 'Fecha asien', 'Fecha', 'FECHA', 'fecha');
            const asiento = buscarColumna(row, { excluir: ['Fecha'] }, 'Nro. asiento', 'Nro asiento', 'Número asiento', 'Número C', 'Numero', 'Asiento', 'ASIENTO', 'NroAsiento');
            const descripcion = buscarColumna(row, 'Leyenda movimiento', 'Leyenda', 'Descripción', 'DESCRIPCION', 'Concepto', 'CONCEPTO');
            const debeRaw = buscarColumna(row, 'Debe', 'DEBE');
            const haberRaw = buscarColumna(row, 'Haber', 'HABER');

            // Parsear números con formato argentino
            const debe = parsearNumeroArgentino(debeRaw);
            const haber = parsearNumeroArgentino(haberRaw);

            return {
                id: `reg_${index}_${Date.now()}`,
                fecha: parsearFecha(fecha),
                fechaOriginal: fecha,
                asiento: asiento ? asiento.toString() : '',
                descripcion: descripcion || '',
                debe: debe,
                haber: haber,
                estado: 'pendiente',
                vinculadoCon: [],
                tipo: debe > 0 ? 'debe' : 'haber',
                esDevolucion: false
            };
        }).filter(r => r.debe > 0 || r.haber > 0);

        stateMayores.registrosMayor = registros;
        stateMayores.registrosOriginales = JSON.parse(JSON.stringify(registros));
        stateMayores.vinculaciones = [];

        // Cerrar modal
        cerrarSubirMayor();

        // Actualizar UI
        actualizarEstadisticasMayor();
        renderizarTablaMayor();

        if (stateMayores.tipoMayorActual?.logica === 'vinculacion') {
            analizarVencimientos();
            renderizarVinculacion();
        }

        // Mostrar info del mayor
        document.getElementById('infoMayorCargado').style.display = 'block';

        // Mostrar botón de guardar en toolbar
        const btnGuardar = document.getElementById('btnGuardarConciliacion');
        if (btnGuardar) btnGuardar.style.display = 'inline-flex';

        console.log(`✅ Mayor procesado: ${registros.length} registros`);
        if (registros.length > 0) {
            console.log('Ejemplo de registro:', registros[0]);
        }

    } catch (error) {
        console.error('Error procesando mayor:', error);
        alert('Error al procesar el archivo: ' + error.message);
    }
}

/**
 * Parsear fecha en varios formatos
 * Soporta: strings DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, números seriales de Excel, objetos Date
 */
function parsearFecha(fechaStr) {
    if (!fechaStr) return null;

    // Si ya es un objeto Date válido, devolverlo
    if (fechaStr instanceof Date) {
        return isNaN(fechaStr.getTime()) ? null : fechaStr;
    }

    // Si es un número, puede ser un serial de Excel
    if (typeof fechaStr === 'number') {
        // Excel usa números seriales: días desde 1/1/1900
        // Pero tiene un bug: considera 1900 como bisiesto (29/02/1900 no existió)
        // Para convertir: serial - 25569 = días desde 1/1/1970 (epoch JS)
        // Luego multiplicar por 86400000 (ms por día)
        if (fechaStr > 0 && fechaStr < 200000) {  // Rango razonable para serial de Excel
            // Ajustar por el bug de 1900 de Excel (si fecha > 60, restar 1)
            const serialAjustado = fechaStr > 60 ? fechaStr - 1 : fechaStr;
            const diasDesdeEpoch = serialAjustado - 25569;
            const fecha = new Date(diasDesdeEpoch * 86400000);
            if (!isNaN(fecha.getTime()) && fecha.getFullYear() > 1970 && fecha.getFullYear() < 2100) {
                return fecha;
            }
        }
    }

    // Convertir a string para procesar
    const fechaString = fechaStr.toString().trim();

    // Intentar varios formatos de string
    const formatos = [
        // DD/MM/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    ];

    for (const formato of formatos) {
        const match = fechaString.match(formato);
        if (match) {
            if (formato === formatos[2]) {
                // YYYY-MM-DD
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            } else {
                // DD/MM/YYYY o DD-MM-YYYY
                return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            }
        }
    }

    // Intentar parseo directo como último recurso
    const fecha = new Date(fechaString);
    if (!isNaN(fecha.getTime()) && fecha.getFullYear() > 1970 && fecha.getFullYear() < 2100) {
        return fecha;
    }

    return null;
}

// ============================================
// ANÁLISIS Y VINCULACIÓN (CUPONES DE TARJETAS)
// ============================================

/**
 * Analizar vencimientos de registros de origen (cupones, emisiones o cheques)
 */
function analizarVencimientos() {
    const configVinc = obtenerConfigVinculacion();
    const hoy = new Date();

    // Analizar registros del mayor (comportamiento estándar)
    stateMayores.registrosMayor.forEach(registro => {
        if (registro.estado === 'vinculado' || registro.esDevolucion) return;

        // Analizar registros de origen según configuración
        const montoOrigen = obtenerMontoOrigen(registro);
        if (montoOrigen > 0 && registro.fecha) {
            const diasTranscurridos = Math.floor((hoy - registro.fecha) / (1000 * 60 * 60 * 24));
            if (diasTranscurridos > configVinc.diasVencimiento) {
                registro.estado = 'vencido';
            } else {
                registro.estado = 'pendiente';
            }
        }
    });

    // Si estamos usando cheques como origen, también analizar vencimientos de cheques
    if (usarChequesComoOrigen()) {
        stateMayores.listadoChequesCargados.forEach(cheque => {
            if (cheque.estadoVinculacion === 'vinculado') return;

            const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
            if (fechaCheque) {
                const diasTranscurridos = Math.floor((hoy - fechaCheque) / (1000 * 60 * 60 * 24));
                if (diasTranscurridos > configVinc.diasVencimiento) {
                    cheque.estadoVinculacion = 'vencido';
                } else if (!cheque.estadoVinculacion) {
                    cheque.estadoVinculacion = 'pendiente';
                }
            }
        });
    }

    actualizarEstadisticasVinculacion();
}

/**
 * Actualizar estadísticas de vinculación
 */
function actualizarEstadisticasVinculacion() {
    let vinculados, pendientes, vencidos;

    // Si estamos usando cheques como origen, contar desde el listado de cheques
    if (usarChequesComoOrigen()) {
        const cheques = stateMayores.listadoChequesCargados;
        vinculados = cheques.filter(c => c.estadoVinculacion === 'vinculado').length;
        pendientes = cheques.filter(c => !c.estadoVinculacion || c.estadoVinculacion === 'pendiente').length;
        vencidos = cheques.filter(c => c.estadoVinculacion === 'vencido').length;
    } else {
        // Comportamiento estándar: contar desde registros del mayor
        const registros = stateMayores.registrosMayor;
        vinculados = registros.filter(r => r.estado === 'vinculado').length;
        pendientes = registros.filter(r => r.estado === 'pendiente').length;
        vencidos = registros.filter(r => r.estado === 'vencido').length;
    }

    document.getElementById('cuponesVinculados').textContent = vinculados;
    document.getElementById('cuponesPendientes').textContent = pendientes;
    document.getElementById('cuponesVencidos').textContent = vencidos;
}

/**
 * Actualizar estadísticas del mayor
 */
function actualizarEstadisticasMayor() {
    const registros = stateMayores.registrosMayor;

    const totalDebe = registros.reduce((sum, r) => sum + (r.debe || 0), 0);
    const totalHaber = registros.reduce((sum, r) => sum + (r.haber || 0), 0);

    // Detectar período
    const fechas = registros.filter(r => r.fecha).map(r => r.fecha);
    let periodo = '-';
    if (fechas.length > 0) {
        const minFecha = new Date(Math.min(...fechas));
        const maxFecha = new Date(Math.max(...fechas));
        periodo = `${formatearFecha(minFecha)} - ${formatearFecha(maxFecha)}`;
    }

    // Calcular saldo (Debe - Haber)
    const saldo = totalDebe - totalHaber;

    document.getElementById('mayorPeriodo').textContent = periodo;
    document.getElementById('mayorTotalRegistros').textContent = registros.length;
    document.getElementById('mayorTotalDebe').textContent = formatearMoneda(totalDebe);
    document.getElementById('mayorTotalHaber').textContent = formatearMoneda(totalHaber);

    // Mostrar saldo con estilo según signo
    const saldoElement = document.getElementById('mayorSaldo');
    saldoElement.textContent = formatearMoneda(Math.abs(saldo));
    saldoElement.classList.remove('debe', 'haber');
    if (saldo > 0) {
        saldoElement.textContent = formatearMoneda(saldo) + ' (D)';
        saldoElement.classList.add('debe');
    } else if (saldo < 0) {
        saldoElement.textContent = formatearMoneda(Math.abs(saldo)) + ' (H)';
        saldoElement.classList.add('haber');
    }
}

/**
 * Renderizar panel de vinculación
 */
function renderizarVinculacion() {
    const registros = stateMayores.registrosMayor;
    const config = obtenerConfigVinculacion();

    // Filtrar registros de origen y destino según configuración
    const registrosOrigen = obtenerRegistrosOrigen(registros);
    const registrosDestino = obtenerRegistrosDestino(registros);

    // Aplicar filtros
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const origenFiltrados = registrosOrigen.filter(c => {
        if (filtroEstado && c.estado !== filtroEstado) return false;
        if (filtroTexto && !c.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    const destinoFiltrados = registrosDestino.filter(l => {
        if (filtroEstado === 'devolucion' && !l.esDevolucion) return false;
        if (filtroEstado && filtroEstado !== 'devolucion' && l.estado !== filtroEstado) return false;
        if (filtroTexto && !l.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    // Calcular totales usando los montos según configuración
    const totalOrigen = origenFiltrados.reduce((sum, c) => sum + obtenerMontoOrigen(c), 0);
    const totalDestino = destinoFiltrados.reduce((sum, l) => sum + obtenerMontoDestino(l), 0);

    document.getElementById('totalCuponesDebe').textContent = formatearMoneda(totalOrigen);
    document.getElementById('totalLiquidacionesHaber').textContent = formatearMoneda(totalDestino);

    // Renderizar lista de origen (cupones o emisiones)
    const listaCupones = document.getElementById('listaCupones');
    const claseMontoOrigen = config.tipoOrigen === 'debe' ? 'debe' : 'haber';
    listaCupones.innerHTML = origenFiltrados.length === 0
        ? `<div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">No hay ${config.etiquetaOrigen.toLowerCase()}</div>`
        : origenFiltrados.map(c => `
            <div class="registro-item ${c.estado} ${stateMayores.cuponesSeleccionados.includes(c.id) ? 'selected' : ''}"
                 onclick="toggleSeleccionCupon('${c.id}')" data-id="${c.id}">
                <input type="checkbox" class="registro-checkbox"
                       ${stateMayores.cuponesSeleccionados.includes(c.id) ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <div class="registro-info">
                    <div class="registro-fecha">${formatearFecha(c.fecha)}</div>
                    <div class="registro-desc" title="${c.descripcion}">${c.descripcion}</div>
                </div>
                <div class="registro-monto ${claseMontoOrigen}">${formatearMoneda(obtenerMontoOrigen(c))}</div>
                <span class="registro-estado ${c.estado}">${obtenerEtiquetaEstado(c.estado)}</span>
            </div>
        `).join('');

    // Renderizar lista de destino (liquidaciones o cobros)
    const listaLiquidaciones = document.getElementById('listaLiquidaciones');
    const claseMontoDestino = config.tipoDestino === 'haber' ? 'haber' : 'debe';
    listaLiquidaciones.innerHTML = destinoFiltrados.length === 0
        ? `<div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">No hay ${config.etiquetaDestino.toLowerCase()}</div>`
        : destinoFiltrados.map(l => `
            <div class="registro-item ${l.esDevolucion ? 'devolucion' : l.estado} ${stateMayores.liquidacionesSeleccionadas.includes(l.id) ? 'selected' : ''}"
                 onclick="toggleSeleccionLiquidacion('${l.id}')" data-id="${l.id}">
                <input type="checkbox" class="registro-checkbox"
                       ${stateMayores.liquidacionesSeleccionadas.includes(l.id) ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <div class="registro-info">
                    <div class="registro-fecha">${formatearFecha(l.fecha)}</div>
                    <div class="registro-desc" title="${l.descripcion}">${l.descripcion}</div>
                </div>
                <div class="registro-monto ${claseMontoDestino}">${formatearMoneda(obtenerMontoDestino(l))}</div>
                <span class="registro-estado ${l.esDevolucion ? 'devolucion' : l.estado}">${l.esDevolucion ? 'Devolución' : obtenerEtiquetaEstado(l.estado)}</span>
            </div>
        `).join('');

    actualizarEstadisticasVinculacion();
}

/**
 * Obtener etiqueta de estado
 */
function obtenerEtiquetaEstado(estado) {
    const etiquetas = {
        pendiente: 'Pendiente',
        vinculado: 'Vinculado',
        vencido: 'Vencido',
        devolucion: 'Devolución'
    };
    return etiquetas[estado] || estado;
}

/**
 * Filtrar vinculaciones
 */
function filtrarVinculaciones() {
    renderizarVinculacion();
}

/**
 * Toggle selección de cupón
 */
function toggleSeleccionCupon(id) {
    const index = stateMayores.cuponesSeleccionados.indexOf(id);
    if (index > -1) {
        stateMayores.cuponesSeleccionados.splice(index, 1);
    } else {
        stateMayores.cuponesSeleccionados.push(id);
    }

    // Actualizar clase visual del elemento
    const item = document.querySelector(`.registro-item[data-id="${id}"]`);
    if (item) {
        item.classList.toggle('selected', stateMayores.cuponesSeleccionados.includes(id));
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = stateMayores.cuponesSeleccionados.includes(id);
    }

    actualizarBarraSeleccionMayores();
}

/**
 * Toggle selección de liquidación
 */
function toggleSeleccionLiquidacion(id) {
    const index = stateMayores.liquidacionesSeleccionadas.indexOf(id);
    if (index > -1) {
        stateMayores.liquidacionesSeleccionadas.splice(index, 1);
    } else {
        stateMayores.liquidacionesSeleccionadas.push(id);
    }

    // Actualizar clase visual del elemento
    const item = document.querySelector(`.registro-item[data-id="${id}"]`);
    if (item) {
        item.classList.toggle('selected', stateMayores.liquidacionesSeleccionadas.includes(id));
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = stateMayores.liquidacionesSeleccionadas.includes(id);
    }

    actualizarBarraSeleccionMayores();
}

/**
 * Actualizar barra de selección flotante
 */
function actualizarBarraSeleccionMayores() {
    const bar = document.getElementById('selectionBarMayores');
    if (!bar) return;

    const cantOrigen = stateMayores.cuponesSeleccionados.length;
    const cantDestino = stateMayores.liquidacionesSeleccionadas.length;
    const modoChequesOrigen = usarChequesComoOrigen();

    // Calcular totales de origen (cheques o registros del mayor)
    let totalOrigen = 0;
    if (modoChequesOrigen) {
        // Buscar en el listado de cheques
        totalOrigen = stateMayores.listadoChequesCargados
            .filter(c => stateMayores.cuponesSeleccionados.includes(c.id))
            .reduce((sum, c) => sum + (c.importe || 0), 0);
    } else {
        // Buscar en registros del mayor
        totalOrigen = stateMayores.registrosMayor
            .filter(r => stateMayores.cuponesSeleccionados.includes(r.id))
            .reduce((sum, r) => sum + obtenerMontoOrigen(r), 0);
    }

    // Calcular totales de destino (siempre registros del mayor)
    const totalDestino = stateMayores.registrosMayor
        .filter(r => stateMayores.liquidacionesSeleccionadas.includes(r.id))
        .reduce((sum, r) => sum + obtenerMontoDestino(r), 0);

    const diferencia = totalOrigen - totalDestino;
    const diferenciaAbs = Math.abs(diferencia);

    // Actualizar UI
    document.getElementById('selCuponesCount').textContent = cantOrigen;
    document.getElementById('selCuponesTotal').textContent = formatearMoneda(totalOrigen);
    document.getElementById('selLiquidacionesCount').textContent = cantDestino;
    document.getElementById('selLiquidacionesTotal').textContent = formatearMoneda(totalDestino);

    const diffElement = document.getElementById('selDiferenciaMayores');
    const signo = diferencia > 0 ? '+' : diferencia < 0 ? '-' : '';
    diffElement.textContent = signo + formatearMoneda(diferenciaAbs);

    // Colorear según la diferencia
    diffElement.classList.remove('diff-warning', 'diff-error', 'diff-ok');
    if (diferenciaAbs === 0) {
        diffElement.classList.add('diff-ok');
    } else if (diferenciaAbs <= 1) {
        diffElement.classList.add('diff-warning');
    } else {
        diffElement.classList.add('diff-error');
    }

    // Habilitar/deshabilitar botón de vincular
    const btnVincular = document.getElementById('btnVincularMayores');
    btnVincular.disabled = cantOrigen === 0 || cantDestino === 0;

    // Mostrar/ocultar barra
    if (cantOrigen > 0 || cantDestino > 0) {
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }
}

/**
 * Limpiar selección de mayores
 */
function limpiarSeleccionMayores() {
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Quitar clases visuales de las listas de cupones/liquidaciones
    document.querySelectorAll('.registro-item.selected').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = false;
    });

    // Limpiar checkboxes de la tabla del mayor
    document.querySelectorAll('#tablaMayorBody input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Limpiar checkbox de seleccionar todos
    const selectAll = document.getElementById('selectAllMayor');
    if (selectAll) selectAll.checked = false;

    actualizarBarraSeleccionMayores();
}

/**
 * Vincular seleccionados manualmente (versión mejorada)
 */
function vincularSeleccionadosManual() {
    const config = obtenerConfigVinculacion();

    if (stateMayores.cuponesSeleccionados.length === 0 || stateMayores.liquidacionesSeleccionadas.length === 0) {
        alert(`Debe seleccionar al menos un ${config.etiquetaOrigen.toLowerCase().slice(0, -1)} y un ${config.etiquetaDestino.toLowerCase().slice(0, -1)} para vincular`);
        return;
    }

    // Obtener registros seleccionados
    const origenes = stateMayores.registrosMayor.filter(r => stateMayores.cuponesSeleccionados.includes(r.id));
    const destinos = stateMayores.registrosMayor.filter(r => stateMayores.liquidacionesSeleccionadas.includes(r.id));

    // Calcular diferencia usando configuración dinámica
    const sumaOrigenes = origenes.reduce((sum, o) => sum + obtenerMontoOrigen(o), 0);
    const sumaDestinos = destinos.reduce((sum, d) => sum + obtenerMontoDestino(d), 0);
    const diferencia = Math.abs(sumaOrigenes - sumaDestinos);

    // Validar diferencia
    if (diferencia > 1) {
        const mensaje = `La diferencia entre ${config.etiquetaOrigen.toLowerCase()} y ${config.etiquetaDestino.toLowerCase()} es de ${formatearMoneda(diferencia)}.\n\n¿Desea vincular de todos modos?`;
        if (!confirm(mensaje)) return;
    }

    const vinculacionId = `vinc_manual_${Date.now()}`;

    // Marcar orígenes como vinculados
    origenes.forEach(origen => {
        origen.estado = 'vinculado';
        origen.vinculadoCon = stateMayores.liquidacionesSeleccionadas.slice();
        origen.vinculacionId = vinculacionId;
    });

    // Marcar destinos como vinculados
    destinos.forEach(destino => {
        destino.estado = 'vinculado';
        destino.vinculadoCon = stateMayores.cuponesSeleccionados.slice();
        destino.vinculacionId = vinculacionId;
    });

    // Registrar vinculación
    stateMayores.vinculaciones.push({
        id: vinculacionId,
        cupones: stateMayores.cuponesSeleccionados.slice(),
        liquidaciones: stateMayores.liquidacionesSeleccionadas.slice(),
        tipo: 'manual',
        diferencia: diferencia,
        fecha: new Date().toISOString()
    });

    // Limpiar selección
    limpiarSeleccionMayores();

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
    actualizarEstadisticasVinculacion();

    console.log(`✅ Vinculación manual creada: ${origenes.length} ${config.etiquetaOrigen.toLowerCase()} con ${destinos.length} ${config.etiquetaDestino.toLowerCase()}`);
}

/**
 * Seleccionar todos los registros de origen visibles (cupones o emisiones)
 */
function seleccionarTodosCupones() {
    const registrosOrigen = obtenerRegistrosOrigen(stateMayores.registrosMayor);
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const origenFiltrados = registrosOrigen.filter(c => {
        if (filtroEstado && c.estado !== filtroEstado) return false;
        if (filtroTexto && !c.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    // Toggle: si todos están seleccionados, deseleccionar; si no, seleccionar todos
    const todosSeleccionados = origenFiltrados.every(c => stateMayores.cuponesSeleccionados.includes(c.id));

    if (todosSeleccionados) {
        stateMayores.cuponesSeleccionados = [];
    } else {
        stateMayores.cuponesSeleccionados = origenFiltrados.map(c => c.id);
    }

    // Actualizar checkboxes visualmente
    document.querySelectorAll('#listaCupones .registro-item').forEach(item => {
        const id = item.dataset.id;
        const isSelected = stateMayores.cuponesSeleccionados.includes(id);
        item.classList.toggle('selected', isSelected);
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = isSelected;
    });

    actualizarBarraSeleccionMayores();
}

/**
 * Seleccionar todos los registros de destino visibles (liquidaciones o cobros)
 */
function seleccionarTodasLiquidaciones() {
    const registrosDestino = obtenerRegistrosDestino(stateMayores.registrosMayor);
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const destinoFiltrados = registrosDestino.filter(l => {
        if (filtroEstado === 'devolucion' && !l.esDevolucion) return false;
        if (filtroEstado && filtroEstado !== 'devolucion' && l.estado !== filtroEstado) return false;
        if (filtroTexto && !l.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    const todasSeleccionadas = destinoFiltrados.every(l => stateMayores.liquidacionesSeleccionadas.includes(l.id));

    if (todasSeleccionadas) {
        stateMayores.liquidacionesSeleccionadas = [];
    } else {
        stateMayores.liquidacionesSeleccionadas = destinoFiltrados.map(l => l.id);
    }

    // Actualizar checkboxes visualmente
    document.querySelectorAll('#listaLiquidaciones .registro-item').forEach(item => {
        const id = item.dataset.id;
        const isSelected = stateMayores.liquidacionesSeleccionadas.includes(id);
        item.classList.toggle('selected', isSelected);
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = isSelected;
    });

    actualizarBarraSeleccionMayores();
}

/**
 * Buscar un elemento de origen por ID (puede ser un registro del mayor o un cheque)
 * @param {string} id - ID del elemento
 * @returns {Object|null} Elemento encontrado o null
 */
function buscarElementoOrigen(id) {
    // Primero buscar en registros del mayor
    const registro = stateMayores.registrosMayor.find(r => r.id === id);
    if (registro) return { elemento: registro, tipo: 'registro' };

    // Si usamos cheques como origen, buscar en el listado de cheques
    if (usarChequesComoOrigen()) {
        const cheque = stateMayores.listadoChequesCargados.find(c => c.id === id);
        if (cheque) return { elemento: cheque, tipo: 'cheque' };
    }

    return null;
}

/**
 * Vincular elementos seleccionados
 */
function vincularSeleccionados() {
    if (stateMayores.cuponesSeleccionados.length === 0 || stateMayores.liquidacionesSeleccionadas.length === 0) {
        alert('Debe seleccionar al menos un cupón y una liquidación para vincular');
        return;
    }

    const vinculacionId = `vinc_${Date.now()}`;
    const modoChequesOrigen = usarChequesComoOrigen();

    // Marcar cupones/cheques como vinculados
    stateMayores.cuponesSeleccionados.forEach(id => {
        if (modoChequesOrigen) {
            // Buscar en listado de cheques
            const cheque = stateMayores.listadoChequesCargados.find(c => c.id === id);
            if (cheque) {
                cheque.estadoVinculacion = 'vinculado';
                cheque.vinculadoCon = [...(cheque.vinculadoCon || []), ...stateMayores.liquidacionesSeleccionadas];
                cheque.vinculacionId = vinculacionId;
            }
        } else {
            // Comportamiento estándar: buscar en registros del mayor
            const cupon = stateMayores.registrosMayor.find(r => r.id === id);
            if (cupon) {
                cupon.estado = 'vinculado';
                cupon.vinculadoCon = [...(cupon.vinculadoCon || []), ...stateMayores.liquidacionesSeleccionadas];
                cupon.vinculacionId = vinculacionId;
            }
        }
    });

    // Marcar liquidaciones como vinculadas
    stateMayores.liquidacionesSeleccionadas.forEach(id => {
        const liquidacion = stateMayores.registrosMayor.find(r => r.id === id);
        if (liquidacion) {
            liquidacion.estado = 'vinculado';
            liquidacion.vinculadoCon = [...(liquidacion.vinculadoCon || []), ...stateMayores.cuponesSeleccionados];
            liquidacion.vinculacionId = vinculacionId;
        }
    });

    // Registrar vinculación
    stateMayores.vinculaciones.push({
        id: vinculacionId,
        cupones: [...stateMayores.cuponesSeleccionados],
        liquidaciones: [...stateMayores.liquidacionesSeleccionadas],
        fecha: new Date().toISOString(),
        tipoOrigen: modoChequesOrigen ? 'cheques' : 'registros'
    });

    // Limpiar selección
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();

    console.log('✅ Vinculación creada:', vinculacionId, modoChequesOrigen ? '(cheques)' : '(registros)');
}

/**
 * Desvincular elementos seleccionados
 */
function desvincularSeleccionados() {
    const idsADesvincular = [...stateMayores.cuponesSeleccionados, ...stateMayores.liquidacionesSeleccionadas];

    if (idsADesvincular.length === 0) {
        alert('Seleccione elementos para desvincular');
        return;
    }

    const modoChequesOrigen = usarChequesComoOrigen();

    idsADesvincular.forEach(id => {
        // Buscar en registros del mayor
        const registro = stateMayores.registrosMayor.find(r => r.id === id);
        if (registro) {
            registro.estado = 'pendiente';
            registro.vinculadoCon = [];
            registro.vinculacionId = null;
        }

        // Si estamos en modo cheques, también buscar en el listado de cheques
        if (modoChequesOrigen) {
            const cheque = stateMayores.listadoChequesCargados.find(c => c.id === id);
            if (cheque) {
                cheque.estadoVinculacion = 'pendiente';
                cheque.vinculadoCon = [];
                cheque.vinculacionId = null;
            }
        }
    });

    // Actualizar vinculaciones
    stateMayores.vinculaciones = stateMayores.vinculaciones.filter(v => {
        const cuponesRestantes = v.cupones.filter(id => !idsADesvincular.includes(id));
        const liquidacionesRestantes = v.liquidaciones.filter(id => !idsADesvincular.includes(id));
        return cuponesRestantes.length > 0 && liquidacionesRestantes.length > 0;
    });

    // Limpiar selección
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Analizar vencimientos nuevamente
    analizarVencimientos();

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
}

/**
 * Marcar como devolución
 */
function marcarComoDevolucion() {
    const idsSeleccionados = [...stateMayores.cuponesSeleccionados, ...stateMayores.liquidacionesSeleccionadas];

    if (idsSeleccionados.length === 0) {
        alert('Seleccione elementos para marcar como devolución');
        return;
    }

    idsSeleccionados.forEach(id => {
        const registro = stateMayores.registrosMayor.find(r => r.id === id);
        if (registro) {
            registro.esDevolucion = !registro.esDevolucion;
            if (registro.esDevolucion) {
                registro.estado = 'devolucion';
            } else {
                registro.estado = 'pendiente';
            }
        }
    });

    // Limpiar selección
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
}

// ============================================
// CONCILIACIÓN AUTOMÁTICA
// ============================================

/**
 * Mostrar panel de configuración de conciliación
 */
function conciliarAutomaticamente() {
    const registros = stateMayores.registrosMayor;
    const config = obtenerConfigVinculacion();

    if (registros.length === 0) {
        alert('Primero debe cargar un mayor contable');
        return;
    }

    const origenPendientes = obtenerRegistrosOrigen(registros, false);
    const destinoPendientes = obtenerRegistrosDestino(registros, false);

    if (origenPendientes.length === 0) {
        alert(`No hay ${config.etiquetaOrigen.toLowerCase()} pendientes de vincular`);
        return;
    }

    if (destinoPendientes.length === 0) {
        alert(`No hay ${config.etiquetaDestino.toLowerCase()} pendientes de vincular`);
        return;
    }

    // Configurar modo N:1 por defecto para cheques de terceros
    // ya que es el patrón más común (varios cheques van juntos a un proveedor)
    const modoConciliacion = document.getElementById('modoConciliacion');
    if (modoConciliacion && usarChequesComoOrigen()) {
        modoConciliacion.value = 'N:1';
    }

    // Mostrar panel de configuración
    document.getElementById('panelConfigConciliacion').style.display = 'block';
    document.getElementById('resultadosConciliacion').style.display = 'none';
}

/**
 * Cerrar panel de configuración
 */
function cerrarConfigConciliacion() {
    document.getElementById('panelConfigConciliacion').style.display = 'none';
}

/**
 * Cerrar resultados de conciliación
 */
function cerrarResultadosConciliacion() {
    document.getElementById('resultadosConciliacion').style.display = 'none';
}

/**
 * Ejecutar conciliación automática (versión asíncrona con barra de progreso)
 */
async function ejecutarConciliacion() {
    const tolerancia = parseFloat(document.getElementById('toleranciaImporte').value) || 0.01;
    const diasMaximos = parseInt(document.getElementById('diasMaximos').value) || 40;
    const modo = document.getElementById('modoConciliacion').value;
    const config = obtenerConfigVinculacion();

    // Mostrar barra de progreso
    mostrarProgresoConciliacion();
    await permitirActualizacionUI();

    console.log(`🤖 Iniciando conciliación automática - Modo: ${modo}, Tolerancia: ${tolerancia}, Días máx: ${diasMaximos}`);
    console.log(`📋 Configuración: tipoOrigen=${config.tipoOrigen}, tipoDestino=${config.tipoDestino}`);

    // Reset del contador de debug para buscarCombinacionSumaGenerica
    buscarCombinacionSumaGenerica._contador = 0;

    const registros = stateMayores.registrosMayor;
    console.log(`📊 Total registros cargados: ${registros.length}`);

    actualizarProgresoConciliacion(5, 'Analizando registros cargados...');
    await permitirActualizacionUI();

    // Debug: Verificar estado de las fechas
    const conFechaValida = registros.filter(r => r.fecha instanceof Date && !isNaN(r.fecha.getTime())).length;
    const conFechaInvalida = registros.filter(r => r.fecha && (!(r.fecha instanceof Date) || isNaN(r.fecha.getTime()))).length;
    const sinFecha = registros.filter(r => !r.fecha).length;
    console.log(`📅 Fechas: válidas=${conFechaValida}, inválidas=${conFechaInvalida}, sin fecha=${sinFecha}`);
    if (conFechaInvalida > 0 || sinFecha > 0) {
        const ejemploInvalida = registros.find(r => r.fecha && (!(r.fecha instanceof Date) || isNaN(r.fecha.getTime())));
        if (ejemploInvalida) {
            console.log(`   ⚠️ Ejemplo fecha inválida: tipo=${typeof ejemploInvalida.fecha}, valor=${ejemploInvalida.fecha}`);
        }
    }

    actualizarProgresoConciliacion(10, 'Clasificando registros de origen y destino...');
    await permitirActualizacionUI();

    // Obtener registros de origen y destino pendientes según configuración
    let origenPendientes = obtenerRegistrosOrigen(registros, false)
        .sort((a, b) => (a.fecha || 0) - (b.fecha || 0)); // Ordenar por fecha

    let destinoPendientes = obtenerRegistrosDestino(registros, false)
        .filter(r => !r.esDevolucion)
        .sort((a, b) => (a.fecha || 0) - (b.fecha || 0));

    // Debug: mostrar estadísticas de registros
    console.log(`📤 Registros origen (${config.etiquetaOrigen}) pendientes: ${origenPendientes.length}`);
    console.log(`📥 Registros destino (${config.etiquetaDestino}) pendientes: ${destinoPendientes.length}`);

    // Debug: mostrar muestra de registros
    if (origenPendientes.length > 0) {
        const muestra = origenPendientes[0];
        console.log(`   Ejemplo origen: fecha=${muestra.fecha}, monto=${obtenerMontoOrigen(muestra)}, leyenda=${muestra.leyenda?.substring(0, 50)}`);
    }
    if (destinoPendientes.length > 0) {
        const muestra = destinoPendientes[0];
        console.log(`   Ejemplo destino: fecha=${muestra.fecha}, monto=${obtenerMontoDestino(muestra)}, leyenda=${muestra.leyenda?.substring(0, 50)}`);
    }

    actualizarProgresoConciliacion(15, `Iniciando conciliación ${modo}...`);
    await permitirActualizacionUI();

    let vinculacionesExitosas = 0;
    let origenVinculados = new Set();
    let destinoVinculados = new Set();

    // Callback para actualizar progreso durante la conciliación
    const actualizarProgresoCallback = async (procesados, total, vinculacionesActuales) => {
        const porcentajeBase = 15;
        const porcentajeMax = 90;
        const porcentaje = porcentajeBase + ((procesados / total) * (porcentajeMax - porcentajeBase));
        const modoTexto = modo === 'N:1' ? 'N:1' : modo === '1:1' ? '1:1' : '1:N';
        actualizarProgresoConciliacion(
            porcentaje,
            `Procesando ${modo}: ${procesados}/${total} registros (${vinculacionesActuales} vinculaciones encontradas)`
        );
        await permitirActualizacionUI();
    };

    if (modo === 'N:1') {
        // Modo N:1: Varios orígenes pueden vincularse con un destino
        vinculacionesExitosas = await conciliarN1Async(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados,
            actualizarProgresoCallback
        );
    } else if (modo === '1:1') {
        // Modo 1:1: Un origen con un destino
        vinculacionesExitosas = await conciliar11Async(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados,
            actualizarProgresoCallback
        );
    } else if (modo === '1:N') {
        // Modo 1:N: Un origen con varios destinos
        vinculacionesExitosas = await conciliar1NAsync(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados,
            actualizarProgresoCallback
        );
    }

    actualizarProgresoConciliacion(92, 'Calculando estadísticas...');
    await permitirActualizacionUI();

    // Actualizar estadísticas
    const origenSinMatch = origenPendientes.filter(c => !origenVinculados.has(c.id)).length;
    const destinoSinMatch = destinoPendientes.filter(l => !destinoVinculados.has(l.id)).length;

    actualizarProgresoConciliacion(95, 'Analizando vencimientos...');
    await permitirActualizacionUI();

    // Analizar vencimientos de los que quedaron
    analizarVencimientos();

    actualizarProgresoConciliacion(98, 'Actualizando interfaz...');
    await permitirActualizacionUI();

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
    actualizarEstadisticasVinculacion();

    actualizarProgresoConciliacion(100, '¡Conciliación completada!');
    await permitirActualizacionUI();

    // Esperar un momento antes de mostrar resultados
    await new Promise(resolve => setTimeout(resolve, 500));

    // Ocultar progreso y mostrar resultados
    ocultarProgresoConciliacion();
    document.getElementById('resultadosConciliacion').style.display = 'block';
    document.getElementById('conciliacionExitosas').textContent = vinculacionesExitosas;
    document.getElementById('conciliacionPendientes').textContent = origenSinMatch;
    document.getElementById('conciliacionLiquidaciones').textContent = destinoSinMatch;

    // Actualizar etiquetas según el tipo de mayor
    const configResultados = obtenerConfigVinculacion();
    document.getElementById('labelOrigenSinMatch').textContent = `${configResultados.etiquetaOrigen} sin match`;
    document.getElementById('labelDestinoSinMatch').textContent = `${configResultados.etiquetaDestino} sin match`;

    console.log(`✅ Conciliación completada: ${vinculacionesExitosas} vinculaciones`);
}

/**
 * Actualizar el estado de vinculación de un registro de origen
 * Si es un cheque, actualiza tanto el objeto como el cheque original en listadoChequesCargados
 * @param {Object} origen - Registro de origen o cheque adaptado
 * @param {string} estado - Estado de vinculación ('vinculado', 'pendiente', etc.)
 * @param {Array} vinculadoCon - IDs de registros vinculados
 * @param {string} vinculacionId - ID de la vinculación
 */
function actualizarEstadoVinculacionOrigen(origen, estado, vinculadoCon, vinculacionId) {
    // Actualizar el objeto de origen
    origen.estado = estado;
    origen.vinculadoCon = vinculadoCon;
    origen.vinculacionId = vinculacionId;

    // Si es un cheque, también actualizar el cheque original en listadoChequesCargados
    if (origen.esCheque && usarChequesComoOrigen()) {
        const chequeOriginal = stateMayores.listadoChequesCargados.find(c => c.id === origen.id);
        if (chequeOriginal) {
            chequeOriginal.estadoVinculacion = estado;
            chequeOriginal.vinculadoCon = vinculadoCon;
            chequeOriginal.vinculacionId = vinculacionId;
        }
    }
}

/**
 * Conciliación N:1 Asíncrona - Varios orígenes con un destino
 * @param {Array} origenes - Registros de origen
 * @param {Array} destinos - Registros de destino
 * @param {number} tolerancia - Tolerancia de importe
 * @param {number} diasMaximos - Días máximos entre fecha origen y destino
 * @param {Set} origenesVinculados - Set de IDs de orígenes vinculados
 * @param {Set} destinosVinculados - Set de IDs de destinos vinculados
 * @param {Function} onProgreso - Callback para actualizar progreso
 * @returns {Promise<number>} Número de vinculaciones exitosas
 */
async function conciliarN1Async(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados, onProgreso) {
    let vinculaciones = 0;
    const total = destinos.length;
    const intervaloActualizacion = Math.max(1, Math.floor(total / 50)); // Actualizar cada 2%
    const modoChequesOrigen = usarChequesComoOrigen();

    for (let i = 0; i < destinos.length; i++) {
        const destino = destinos[i];
        if (destinosVinculados.has(destino.id)) continue;

        const montoDestino = obtenerMontoDestino(destino);
        const fechaDestino = destino.fecha;

        if (!fechaDestino) continue;

        // Buscar orígenes candidatos (fecha anterior al destino, dentro del plazo)
        const origenesCandidatos = origenes.filter(o => {
            if (origenesVinculados.has(o.id)) return false;
            if (!o.fecha) return false;

            const diasDiferencia = Math.floor((fechaDestino - o.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (origenesCandidatos.length === 0) continue;

        // Intentar encontrar combinación de orígenes que sumen el monto del destino
        // Para cheques, usar búsqueda mejorada que prioriza por destino y fecha de salida
        let combinacion;
        if (modoChequesOrigen) {
            // Usar búsqueda inteligente que agrupa cheques por destino y fecha de salida
            combinacion = buscarCombinacionChequesPorDestino(
                origenesCandidatos,
                montoDestino,
                tolerancia,
                destino.descripcion || destino.leyenda || '',
                fechaDestino  // Pasar fecha del uso para matching con fecha de transferencia/depósito
            );
        } else {
            combinacion = buscarCombinacionSumaGenerica(origenesCandidatos, montoDestino, tolerancia, obtenerMontoOrigen);
        }

        if (combinacion && combinacion.length > 0) {
            // Crear vinculación
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            // Marcar orígenes (incluyendo cheques si corresponde)
            combinacion.forEach(origen => {
                actualizarEstadoVinculacionOrigen(origen, 'vinculado', [destino.id], vinculacionId);
                origenesVinculados.add(origen.id);
            });

            // Marcar destino
            destino.estado = 'vinculado';
            destino.vinculadoCon = combinacion.map(o => o.id);
            destino.vinculacionId = vinculacionId;
            destinosVinculados.add(destino.id);

            // Registrar vinculación
            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: combinacion.map(o => o.id),
                liquidaciones: [destino.id],
                tipo: 'automatica',
                tipoOrigen: modoChequesOrigen ? 'cheques' : 'registros',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }

        // Actualizar progreso periódicamente
        if (i % intervaloActualizacion === 0 || i === total - 1) {
            await onProgreso(i + 1, total, vinculaciones);
        }
    }

    return vinculaciones;
}

/**
 * Conciliación 1:1 Asíncrona - Un origen con un destino
 * @param {Array} origenes - Registros de origen
 * @param {Array} destinos - Registros de destino
 * @param {number} tolerancia - Tolerancia de importe
 * @param {number} diasMaximos - Días máximos entre fecha origen y destino
 * @param {Set} origenesVinculados - Set de IDs de orígenes vinculados
 * @param {Set} destinosVinculados - Set de IDs de destinos vinculados
 * @param {Function} onProgreso - Callback para actualizar progreso
 * @returns {Promise<number>} Número de vinculaciones exitosas
 */
async function conciliar11Async(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados, onProgreso) {
    let vinculaciones = 0;
    const total = origenes.length;
    const intervaloActualizacion = Math.max(1, Math.floor(total / 50)); // Actualizar cada 2%
    const modoChequesOrigen = usarChequesComoOrigen();

    for (let i = 0; i < origenes.length; i++) {
        const origen = origenes[i];
        if (origenesVinculados.has(origen.id)) continue;
        if (!origen.fecha) continue;

        const montoOrigen = obtenerMontoOrigen(origen);

        // Buscar destino que coincida
        for (const destino of destinos) {
            if (destinosVinculados.has(destino.id)) continue;
            if (!destino.fecha) continue;

            const diasDiferencia = Math.floor((destino.fecha - origen.fecha) / (1000 * 60 * 60 * 24));
            if (diasDiferencia < 0 || diasDiferencia > diasMaximos) continue;

            const diferencia = Math.abs(montoOrigen - obtenerMontoDestino(destino));
            if (diferencia <= tolerancia) {
                // Match encontrado
                const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

                // Usar helper para actualizar origen (incluyendo cheques)
                actualizarEstadoVinculacionOrigen(origen, 'vinculado', [destino.id], vinculacionId);

                destino.estado = 'vinculado';
                destino.vinculadoCon = [origen.id];
                destino.vinculacionId = vinculacionId;

                origenesVinculados.add(origen.id);
                destinosVinculados.add(destino.id);

                stateMayores.vinculaciones.push({
                    id: vinculacionId,
                    cupones: [origen.id],
                    liquidaciones: [destino.id],
                    tipo: 'automatica',
                    tipoOrigen: modoChequesOrigen ? 'cheques' : 'registros',
                    fecha: new Date().toISOString()
                });

                vinculaciones++;
                break;
            }
        }

        // Actualizar progreso periódicamente
        if (i % intervaloActualizacion === 0 || i === total - 1) {
            await onProgreso(i + 1, total, vinculaciones);
        }
    }

    return vinculaciones;
}

/**
 * Conciliación 1:N Asíncrona - Un origen con varios destinos
 * @param {Array} origenes - Registros de origen
 * @param {Array} destinos - Registros de destino
 * @param {number} tolerancia - Tolerancia de importe
 * @param {number} diasMaximos - Días máximos entre fecha origen y destino
 * @param {Set} origenesVinculados - Set de IDs de orígenes vinculados
 * @param {Set} destinosVinculados - Set de IDs de destinos vinculados
 * @param {Function} onProgreso - Callback para actualizar progreso
 * @returns {Promise<number>} Número de vinculaciones exitosas
 */
async function conciliar1NAsync(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados, onProgreso) {
    let vinculaciones = 0;
    let origenesEvaluados = 0;
    let origenesSinFecha = 0;
    let origenesSinCandidatos = 0;
    const total = origenes.length;
    const intervaloActualizacion = Math.max(1, Math.floor(total / 50)); // Actualizar cada 2%
    const modoChequesOrigen = usarChequesComoOrigen();

    console.log(`🔍 conciliar1NAsync: Evaluando ${origenes.length} orígenes contra ${destinos.length} destinos`);

    for (let i = 0; i < origenes.length; i++) {
        const origen = origenes[i];
        if (origenesVinculados.has(origen.id)) continue;
        if (!origen.fecha) {
            origenesSinFecha++;
            continue;
        }
        origenesEvaluados++;

        const montoOrigen = obtenerMontoOrigen(origen);

        // Buscar destinos candidatos
        const destinosCandidatos = destinos.filter(d => {
            if (destinosVinculados.has(d.id)) return false;
            if (!d.fecha) return false;

            const diasDiferencia = Math.floor((d.fecha - origen.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (destinosCandidatos.length === 0) {
            origenesSinCandidatos++;
            if (origenesSinCandidatos <= 3) {
                const fechaOrigen = origen.fecha instanceof Date ? origen.fecha.toISOString().split('T')[0] : origen.fecha;
                console.log(`   ⚠️ Origen sin candidatos: monto=${montoOrigen.toFixed(2)}, fecha=${fechaOrigen}`);
            }
            continue;
        }

        // Buscar combinación de destinos que sumen el monto del origen
        const combinacion = buscarCombinacionSumaGenerica(destinosCandidatos, montoOrigen, tolerancia, obtenerMontoDestino);

        if (combinacion && combinacion.length > 0) {
            // Crear vinculación
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            // Usar helper para actualizar origen (incluyendo cheques)
            actualizarEstadoVinculacionOrigen(origen, 'vinculado', combinacion.map(d => d.id), vinculacionId);
            origenesVinculados.add(origen.id);

            // Marcar destinos
            combinacion.forEach(destino => {
                destino.estado = 'vinculado';
                destino.vinculadoCon = [origen.id];
                destino.vinculacionId = vinculacionId;
                destinosVinculados.add(destino.id);
            });

            // Registrar vinculación
            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: [origen.id],
                liquidaciones: combinacion.map(d => d.id),
                tipo: 'automatica',
                tipoOrigen: modoChequesOrigen ? 'cheques' : 'registros',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }

        // Actualizar progreso periódicamente
        if (i % intervaloActualizacion === 0 || i === total - 1) {
            await onProgreso(i + 1, total, vinculaciones);
        }
    }

    console.log(`📊 Resumen 1:N: evaluados=${origenesEvaluados}, sinFecha=${origenesSinFecha}, sinCandidatos=${origenesSinCandidatos}`);
    return vinculaciones;
}

/**
 * Conciliación N:1 - Varios orígenes con un destino
 * (Ej: Varios cupones con una liquidación, o varias emisiones con un cobro)
 */
function conciliarN1(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados) {
    let vinculaciones = 0;

    for (const destino of destinos) {
        if (destinosVinculados.has(destino.id)) continue;

        const montoDestino = obtenerMontoDestino(destino);
        const fechaDestino = destino.fecha;

        if (!fechaDestino) continue;

        // Buscar orígenes candidatos (fecha anterior al destino, dentro del plazo)
        const origenesCandidatos = origenes.filter(o => {
            if (origenesVinculados.has(o.id)) return false;
            if (!o.fecha) return false;

            const diasDiferencia = Math.floor((fechaDestino - o.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (origenesCandidatos.length === 0) continue;

        // Intentar encontrar combinación de orígenes que sumen el monto del destino
        const combinacion = buscarCombinacionSumaGenerica(origenesCandidatos, montoDestino, tolerancia, obtenerMontoOrigen);

        if (combinacion && combinacion.length > 0) {
            // Crear vinculación
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            // Marcar orígenes
            combinacion.forEach(origen => {
                origen.estado = 'vinculado';
                origen.vinculadoCon = [destino.id];
                origen.vinculacionId = vinculacionId;
                origenesVinculados.add(origen.id);
            });

            // Marcar destino
            destino.estado = 'vinculado';
            destino.vinculadoCon = combinacion.map(o => o.id);
            destino.vinculacionId = vinculacionId;
            destinosVinculados.add(destino.id);

            // Registrar vinculación
            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: combinacion.map(o => o.id),
                liquidaciones: [destino.id],
                tipo: 'automatica',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }
    }

    return vinculaciones;
}

/**
 * Conciliación 1:1 - Un origen con un destino
 * (Ej: Un cupón con una liquidación, o una emisión con un cobro)
 */
function conciliar11(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados) {
    let vinculaciones = 0;

    for (const origen of origenes) {
        if (origenesVinculados.has(origen.id)) continue;
        if (!origen.fecha) continue;

        const montoOrigen = obtenerMontoOrigen(origen);

        // Buscar destino que coincida
        for (const destino of destinos) {
            if (destinosVinculados.has(destino.id)) continue;
            if (!destino.fecha) continue;

            const diasDiferencia = Math.floor((destino.fecha - origen.fecha) / (1000 * 60 * 60 * 24));
            if (diasDiferencia < 0 || diasDiferencia > diasMaximos) continue;

            const diferencia = Math.abs(montoOrigen - obtenerMontoDestino(destino));
            if (diferencia <= tolerancia) {
                // Match encontrado
                const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

                origen.estado = 'vinculado';
                origen.vinculadoCon = [destino.id];
                origen.vinculacionId = vinculacionId;

                destino.estado = 'vinculado';
                destino.vinculadoCon = [origen.id];
                destino.vinculacionId = vinculacionId;

                origenesVinculados.add(origen.id);
                destinosVinculados.add(destino.id);

                stateMayores.vinculaciones.push({
                    id: vinculacionId,
                    cupones: [origen.id],
                    liquidaciones: [destino.id],
                    tipo: 'automatica',
                    fecha: new Date().toISOString()
                });

                vinculaciones++;
                break;
            }
        }
    }

    return vinculaciones;
}

/**
 * Conciliación 1:N - Un origen con varios destinos
 * (Ej: Un cupón con varias liquidaciones, o una emisión con varios cobros)
 */
function conciliar1N(origenes, destinos, tolerancia, diasMaximos, origenesVinculados, destinosVinculados) {
    let vinculaciones = 0;
    let origenesEvaluados = 0;
    let origenesSinFecha = 0;
    let origenesSinCandidatos = 0;

    console.log(`🔍 conciliar1N: Evaluando ${origenes.length} orígenes contra ${destinos.length} destinos`);

    for (const origen of origenes) {
        if (origenesVinculados.has(origen.id)) continue;
        if (!origen.fecha) {
            origenesSinFecha++;
            continue;
        }
        origenesEvaluados++;

        const montoOrigen = obtenerMontoOrigen(origen);

        // Buscar destinos candidatos
        const destinosCandidatos = destinos.filter(d => {
            if (destinosVinculados.has(d.id)) return false;
            if (!d.fecha) return false;

            const diasDiferencia = Math.floor((d.fecha - origen.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (destinosCandidatos.length === 0) {
            origenesSinCandidatos++;
            // Debug: mostrar por qué no hay candidatos para el primer origen sin candidatos
            if (origenesSinCandidatos <= 3) {
                const fechaOrigen = origen.fecha instanceof Date ? origen.fecha.toISOString().split('T')[0] : origen.fecha;
                console.log(`   ⚠️ Origen sin candidatos: monto=${montoOrigen.toFixed(2)}, fecha=${fechaOrigen}`);
                // Ver cuántos destinos tienen fecha válida
                const destinosConFecha = destinos.filter(d => d.fecha && !destinosVinculados.has(d.id));
                console.log(`      Destinos con fecha válida: ${destinosConFecha.length}`);
                if (destinosConFecha.length > 0) {
                    const ejemploDestino = destinosConFecha[0];
                    const fechaDestino = ejemploDestino.fecha instanceof Date ? ejemploDestino.fecha.toISOString().split('T')[0] : ejemploDestino.fecha;
                    const diasDif = Math.floor((ejemploDestino.fecha - origen.fecha) / (1000 * 60 * 60 * 24));
                    console.log(`      Ejemplo destino: fecha=${fechaDestino}, diasDif=${diasDif}, dentroRango=${diasDif >= 0 && diasDif <= diasMaximos}`);
                }
            }
            continue;
        }

        // Debug: mostrar candidatos encontrados para los primeros orígenes
        if (origenesEvaluados <= 3) {
            const sumaDestinos = destinosCandidatos.reduce((sum, d) => sum + obtenerMontoDestino(d), 0);
            console.log(`   🎯 Origen #${origenesEvaluados}: monto=${montoOrigen.toFixed(2)}, candidatos=${destinosCandidatos.length}, sumaCandidatos=${sumaDestinos.toFixed(2)}`);
        }

        // Buscar combinación de destinos que sumen el monto del origen
        const combinacion = buscarCombinacionSumaGenerica(destinosCandidatos, montoOrigen, tolerancia, obtenerMontoDestino);

        if (combinacion && combinacion.length > 0) {
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            origen.estado = 'vinculado';
            origen.vinculadoCon = combinacion.map(d => d.id);
            origen.vinculacionId = vinculacionId;
            origenesVinculados.add(origen.id);

            combinacion.forEach(dest => {
                dest.estado = 'vinculado';
                dest.vinculadoCon = [origen.id];
                dest.vinculacionId = vinculacionId;
                destinosVinculados.add(dest.id);
            });

            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: [origen.id],
                liquidaciones: combinacion.map(d => d.id),
                tipo: 'automatica',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }
    }

    // Resumen de debug
    console.log(`📈 Resumen conciliar1N:`);
    console.log(`   - Orígenes evaluados: ${origenesEvaluados}`);
    console.log(`   - Orígenes sin fecha: ${origenesSinFecha}`);
    console.log(`   - Orígenes sin candidatos (por rango de fechas): ${origenesSinCandidatos}`);
    console.log(`   - Vinculaciones exitosas: ${vinculaciones}`);

    return vinculaciones;
}

/**
 * Normalizar texto para comparación (quitar tildes, espacios extra, mayúsculas)
 * @param {string} texto - Texto a normalizar
 * @returns {string} Texto normalizado
 */
function normalizarTextoParaComparacion(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Quitar tildes
        .replace(/[^a-z0-9\s]/g, ' ')      // Reemplazar caracteres especiales por espacios
        .replace(/\s+/g, ' ')              // Múltiples espacios a uno
        .trim();
}

/**
 * Calcular similitud entre dos textos (basado en palabras compartidas)
 * @param {string} texto1 - Primer texto
 * @param {string} texto2 - Segundo texto
 * @returns {number} Similitud entre 0 y 1
 */
function calcularSimilitudTextos(texto1, texto2) {
    const norm1 = normalizarTextoParaComparacion(texto1);
    const norm2 = normalizarTextoParaComparacion(texto2);

    if (!norm1 || !norm2) return 0;

    const palabras1 = norm1.split(' ').filter(p => p.length > 2);
    const palabras2 = norm2.split(' ').filter(p => p.length > 2);

    if (palabras1.length === 0 || palabras2.length === 0) return 0;

    // Contar palabras compartidas
    const compartidas = palabras1.filter(p => palabras2.some(p2 =>
        p2.includes(p) || p.includes(p2)
    )).length;

    // Calcular similitud como proporción de palabras compartidas
    const maxPalabras = Math.max(palabras1.length, palabras2.length);
    return compartidas / maxPalabras;
}

/**
 * Obtener la fecha de "salida" de un cheque (cuando dejó la empresa)
 * Prioriza: fechaTransferencia > fechaDeposito
 * @param {Object} cheque - Cheque a analizar
 * @returns {Date|null} Fecha de salida o null
 */
function obtenerFechaSalidaCheque(cheque) {
    const original = cheque.chequeOriginal || cheque;
    const fecha = original.fechaTransferencia || original.fechaDeposito || null;

    // Validar que sea una fecha válida
    if (!fecha) return null;

    // Si ya es un Date válido, retornarlo
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
        return fecha;
    }

    // Intentar parsear si es string
    if (typeof fecha === 'string' || typeof fecha === 'number') {
        const parsed = new Date(fecha);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return null;
}

/**
 * Convertir fecha a string ISO de forma segura
 * @param {Date|string|number} fecha - Fecha a convertir
 * @returns {string} String en formato YYYY-MM-DD o 'sin_fecha'
 */
function fechaAStringISO(fecha) {
    if (!fecha) return 'sin_fecha';

    let dateObj = fecha;

    // Si no es un Date, intentar convertir
    if (!(fecha instanceof Date)) {
        dateObj = new Date(fecha);
    }

    // Validar que sea válido
    if (isNaN(dateObj.getTime())) {
        return 'sin_fecha';
    }

    return dateObj.toISOString().split('T')[0];
}

/**
 * Verificar si dos fechas son el mismo día
 * @param {Date} fecha1 - Primera fecha
 * @param {Date} fecha2 - Segunda fecha
 * @returns {boolean} true si son el mismo día
 */
function sonMismoDia(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return false;
    const d1 = new Date(fecha1);
    const d2 = new Date(fecha2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

/**
 * Buscar combinación de cheques priorizando los que tienen el mismo destino y fecha de salida
 * Usa fechaTransferencia/fechaDeposito para matching preciso con la fecha del uso
 * @param {Array} cheques - Lista de cheques candidatos
 * @param {number} montoObjetivo - Monto a alcanzar
 * @param {number} tolerancia - Tolerancia permitida
 * @param {string} descripcionUso - Descripción del registro de uso (haber)
 * @param {Date} fechaUso - Fecha del registro de uso (haber) - opcional
 * @returns {Array|null} Combinación encontrada o null
 */
function buscarCombinacionChequesPorDestino(cheques, montoObjetivo, tolerancia, descripcionUso, fechaUso = null) {
    if (!cheques || cheques.length === 0) return null;

    // 1. Primero intentar match exacto con un solo cheque (priorizando fecha de salida coincidente)
    const chequesMismaFecha = fechaUso ? cheques.filter(c => sonMismoDia(obtenerFechaSalidaCheque(c), fechaUso)) : [];

    // Buscar match exacto primero entre los de misma fecha
    for (const cheque of chequesMismaFecha) {
        const monto = cheque.importe || cheque.debe || 0;
        if (Math.abs(monto - montoObjetivo) <= tolerancia) {
            console.log(`✅ Match exacto con cheque de misma fecha de salida`);
            return [cheque];
        }
    }

    // Luego buscar en todos
    for (const cheque of cheques) {
        const monto = cheque.importe || cheque.debe || 0;
        if (Math.abs(monto - montoObjetivo) <= tolerancia) {
            return [cheque];
        }
    }

    // 2. Agrupar cheques por destino Y fecha de salida (clave compuesta)
    const chequesPorGrupo = new Map();

    for (const cheque of cheques) {
        const original = cheque.chequeOriginal || cheque;
        const destino = original.destino || '';
        const fechaSalida = obtenerFechaSalidaCheque(cheque);
        const fechaSalidaStr = fechaAStringISO(fechaSalida);

        // Clave compuesta: destino + fecha de salida
        const destinoNorm = normalizarTextoParaComparacion(destino) || 'sin_destino';
        const claveGrupo = `${destinoNorm}|${fechaSalidaStr}`;

        if (!chequesPorGrupo.has(claveGrupo)) {
            chequesPorGrupo.set(claveGrupo, {
                destino: destino,
                destinoNorm: destinoNorm,
                fechaSalida: fechaSalida,
                fechaSalidaStr: fechaSalidaStr,
                cheques: [],
                sumaTotal: 0
            });
        }
        const grupo = chequesPorGrupo.get(claveGrupo);
        grupo.cheques.push(cheque);
        grupo.sumaTotal += cheque.importe || cheque.debe || 0;
    }

    // 3. Calcular score de cada grupo
    const grupos = Array.from(chequesPorGrupo.values());
    grupos.forEach(grupo => {
        // Similitud de destino con descripción del uso
        grupo.similitudDestino = calcularSimilitudTextos(grupo.destino, descripcionUso);

        // Coincidencia de fecha de salida con fecha del uso
        grupo.coincideFecha = fechaUso && sonMismoDia(grupo.fechaSalida, fechaUso);

        // Score combinado: fecha exacta es muy importante, destino también
        grupo.score = (grupo.coincideFecha ? 100 : 0) + (grupo.similitudDestino * 50);
    });

    // 4. Ordenar grupos por score (descendente)
    grupos.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.sumaTotal - a.sumaTotal;
    });

    // 5. Log de grupos encontrados (para debug)
    if (grupos.length > 0 && grupos[0].score > 0) {
        console.log(`🔍 Grupos encontrados: ${grupos.length}, mejor score: ${grupos[0].score.toFixed(0)} ` +
                    `(fecha: ${grupos[0].coincideFecha ? 'SÍ' : 'NO'}, destino: ${(grupos[0].similitudDestino * 100).toFixed(0)}%)`);
    }

    // 6. Intentar encontrar combinación dentro de cada grupo (priorizando los de mayor score)
    for (const grupo of grupos) {
        if (grupo.cheques.length === 0) continue;

        // Si la suma del grupo es exacta, usar todos los cheques del grupo
        if (Math.abs(grupo.sumaTotal - montoObjetivo) <= tolerancia) {
            console.log(`✅ Grupo completo "${grupo.destino}" (${grupo.fechaSalidaStr}) suma exactamente al objetivo ` +
                        `(score: ${grupo.score.toFixed(0)}, fecha: ${grupo.coincideFecha ? 'coincide' : 'no coincide'})`);
            return grupo.cheques;
        }

        // Intentar encontrar una combinación dentro del grupo
        const combinacion = buscarCombinacionSumaGenerica(
            grupo.cheques,
            montoObjetivo,
            tolerancia,
            c => c.importe || c.debe || 0
        );
        if (combinacion) {
            console.log(`✅ Combinación de ${combinacion.length} cheques en grupo "${grupo.destino}" (${grupo.fechaSalidaStr})`);
            return combinacion;
        }
    }

    // 7. Intentar combinaciones mezclando grupos con misma fecha de salida (aunque distinto destino)
    if (fechaUso) {
        const gruposMismaFecha = grupos.filter(g => g.coincideFecha);
        if (gruposMismaFecha.length > 1) {
            const chequesMismaFechaTodos = gruposMismaFecha.flatMap(g => g.cheques);
            const sumaMismaFecha = chequesMismaFechaTodos.reduce((sum, c) => sum + (c.importe || c.debe || 0), 0);

            // Si todos los cheques del mismo día suman el objetivo
            if (Math.abs(sumaMismaFecha - montoObjetivo) <= tolerancia) {
                console.log(`✅ Todos los cheques de la fecha ${fechaAStringISO(fechaUso)} suman al objetivo`);
                return chequesMismaFechaTodos;
            }

            const combinacion = buscarCombinacionSumaGenerica(
                chequesMismaFechaTodos,
                montoObjetivo,
                tolerancia,
                c => c.importe || c.debe || 0
            );
            if (combinacion) {
                console.log(`✅ Combinación encontrada entre ${gruposMismaFecha.length} grupos de misma fecha`);
                return combinacion;
            }
        }
    }

    // 8. Intentar combinaciones mezclando grupos con alto score de destino
    const gruposConSimilitud = grupos.filter(g => g.similitudDestino > 0.3);
    if (gruposConSimilitud.length > 0) {
        const chequesDeSimilares = gruposConSimilitud.flatMap(g => g.cheques);
        const combinacion = buscarCombinacionSumaGenerica(
            chequesDeSimilares,
            montoObjetivo,
            tolerancia,
            c => c.importe || c.debe || 0
        );
        if (combinacion) {
            console.log(`✅ Combinación encontrada entre grupos con destino similar`);
            return combinacion;
        }
    }

    // 9. Como fallback, buscar en todos los cheques sin restricción
    const combinacion = buscarCombinacionSumaGenerica(
        cheques,
        montoObjetivo,
        tolerancia,
        c => c.importe || c.debe || 0
    );
    if (combinacion) {
        console.log(`ℹ️ Combinación encontrada sin restricción de destino`);
    }
    return combinacion;
}

/**
 * Buscar combinación de elementos que sumen un monto específico (versión genérica)
 * @param {Array} elementos - Lista de elementos
 * @param {number} montoObjetivo - Monto a alcanzar
 * @param {number} tolerancia - Tolerancia permitida
 * @param {Function} obtenerMonto - Función para obtener el monto de un elemento
 * @returns {Array|null} Combinación encontrada o null
 */
function buscarCombinacionSumaGenerica(elementos, montoObjetivo, tolerancia, obtenerMonto) {
    // Debug: log de entrada (solo para las primeras 3 búsquedas)
    if (!buscarCombinacionSumaGenerica._contador) {
        buscarCombinacionSumaGenerica._contador = 0;
    }
    buscarCombinacionSumaGenerica._contador++;
    const logThis = buscarCombinacionSumaGenerica._contador <= 3;

    if (logThis) {
        console.log(`🔎 buscarCombinacionSumaGenerica #${buscarCombinacionSumaGenerica._contador}:`);
        console.log(`   Objetivo: ${montoObjetivo.toFixed(2)}, Elementos: ${elementos.length}, Tolerancia: ${tolerancia}`);
    }

    // Primero intentar match exacto con un solo elemento
    for (const elem of elementos) {
        if (Math.abs(obtenerMonto(elem) - montoObjetivo) <= tolerancia) {
            if (logThis) console.log(`   ✅ Match exacto encontrado con 1 elemento`);
            return [elem];
        }
    }

    // OPTIMIZACIÓN: Verificar si TODOS los elementos suman al objetivo
    // Esto es común en cheques diferidos donde una emisión se vincula con todos los cobros
    const sumaTotal = elementos.reduce((sum, elem) => sum + obtenerMonto(elem), 0);
    if (logThis) {
        console.log(`   Suma total de todos los elementos: ${sumaTotal.toFixed(2)}`);
        console.log(`   Diferencia con objetivo: ${Math.abs(sumaTotal - montoObjetivo).toFixed(2)}`);
    }
    if (Math.abs(sumaTotal - montoObjetivo) <= tolerancia) {
        console.log(`✅ Todos los ${elementos.length} elementos suman al objetivo: ${sumaTotal.toFixed(2)} ≈ ${montoObjetivo.toFixed(2)}`);
        return [...elementos];
    }

    // Ordenar por monto descendente para mejor eficiencia
    const ordenados = [...elementos].sort((a, b) => obtenerMonto(b) - obtenerMonto(a));

    // Intentar combinaciones (algoritmo greedy)
    const resultado = [];
    let sumaActual = 0;

    for (const elem of ordenados) {
        const montoElem = obtenerMonto(elem);
        if (sumaActual + montoElem <= montoObjetivo + tolerancia) {
            resultado.push(elem);
            sumaActual += montoElem;

            if (Math.abs(sumaActual - montoObjetivo) <= tolerancia) {
                return resultado;
            }
        }
    }

    // Si el greedy no funcionó, intentar subset sum con límite
    // El límite de 25 elementos permite manejar hasta 2^25 = 33M combinaciones
    // Para el caso típico de cheques diferidos (15-25 cobros por emisión) esto es suficiente
    if (elementos.length <= 25) {
        if (logThis) console.log(`   🔄 Intentando subset sum con ${elementos.length} elementos...`);
        const combinacion = subsetSumGenerico(elementos, montoObjetivo, tolerancia, obtenerMonto, elementos.length);
        if (combinacion) {
            if (logThis) console.log(`   ✅ Subset sum encontró combinación de ${combinacion.length} elementos`);
            return combinacion;
        }
        if (logThis) console.log(`   ❌ Subset sum no encontró combinación`);
    } else {
        if (logThis) console.log(`   ⚠️ Demasiados elementos (${elementos.length}) para subset sum, se omite`);
    }

    return null;
}

/**
 * Buscar combinación de cupones que sumen un monto específico (legacy - usa debe)
 */
function buscarCombinacionSuma(elementos, montoObjetivo, tolerancia) {
    return buscarCombinacionSumaGenerica(elementos, montoObjetivo, tolerancia, e => e.debe);
}

/**
 * Buscar combinación de liquidaciones que sumen un monto específico (legacy - usa haber)
 */
function buscarCombinacionSumaHaber(elementos, montoObjetivo, tolerancia) {
    return buscarCombinacionSumaGenerica(elementos, montoObjetivo, tolerancia, e => e.haber);
}

/**
 * Algoritmo de subset sum genérico
 * @param {Array} elementos - Lista de elementos
 * @param {number} objetivo - Monto objetivo
 * @param {number} tolerancia - Tolerancia permitida
 * @param {Function} obtenerMonto - Función para obtener el monto de un elemento
 * @param {number} maxElementos - Máximo de elementos a considerar
 * @returns {Array|null} Combinación encontrada o null
 */
function subsetSumGenerico(elementos, objetivo, tolerancia, obtenerMonto, maxElementos = 10) {
    const n = Math.min(elementos.length, maxElementos);

    // Generar todas las combinaciones posibles (hasta 2^n)
    for (let mask = 1; mask < (1 << n); mask++) {
        const combo = [];
        let suma = 0;

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                combo.push(elementos[i]);
                suma += obtenerMonto(elementos[i]);
            }
        }

        if (Math.abs(suma - objetivo) <= tolerancia) {
            return combo;
        }
    }

    return null;
}

/**
 * Algoritmo de subset sum para cupones (legacy - usa debe)
 */
function subsetSum(elementos, objetivo, tolerancia, maxElementos = 10) {
    return subsetSumGenerico(elementos, objetivo, tolerancia, e => e.debe, maxElementos);
}

/**
 * Algoritmo de subset sum para liquidaciones (legacy - usa haber)
 */
function subsetSumHaber(elementos, objetivo, tolerancia, maxElementos = 10) {
    return subsetSumGenerico(elementos, objetivo, tolerancia, e => e.haber, maxElementos);
}

// ============================================
// TABLA DE REGISTROS
// ============================================

/**
 * Renderizar tabla del mayor
 */
function renderizarTablaMayor() {
    const tbody = document.getElementById('tablaMayorBody');
    const registros = stateMayores.registrosMayor;
    const mostrarSoloNoVinculados = document.getElementById('mostrarSoloNoVinculados')?.checked || false;

    let registrosFiltrados = registros;
    if (mostrarSoloNoVinculados) {
        registrosFiltrados = registros.filter(r => r.estado !== 'vinculado');
    }

    if (registrosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state" style="text-align: center; padding: 40px;">No hay registros para mostrar</td></tr>`;
        return;
    }

    tbody.innerHTML = registrosFiltrados.map(r => {
        // Determinar si el registro está seleccionado usando configuración dinámica
        const esOrigen = esRegistroOrigen(r);
        const isSelected = esOrigen
            ? stateMayores.cuponesSeleccionados.includes(r.id)
            : stateMayores.liquidacionesSeleccionadas.includes(r.id);
        const checkedAttr = isSelected ? 'checked' : '';
        const rowClass = isSelected ? `${r.estado} row-selected` : r.estado;

        return `
        <tr class="${rowClass}" data-id="${r.id}">
            <td class="checkbox-col">
                <input type="checkbox" ${checkedAttr} onchange="toggleSeleccionRegistroMayor('${r.id}', this)">
            </td>
            <td>${formatearFecha(r.fecha)}</td>
            <td>${r.asiento}</td>
            <td title="${r.descripcion}">${truncarTexto(r.descripcion, 50)}</td>
            <td class="text-right" style="color: #dc2626;">${r.debe > 0 ? formatearMoneda(r.debe) : ''}</td>
            <td class="text-right" style="color: #16a34a;">${r.haber > 0 ? formatearMoneda(r.haber) : ''}</td>
            <td><span class="registro-estado ${r.estado}">${obtenerEtiquetaEstado(r.estado)}</span></td>
            <td>${r.vinculadoCon?.length > 0 ? `${r.vinculadoCon.length} reg.` : '-'}</td>
            <td class="acciones-col">
                <button class="btn-eliminar-mov" onclick="mostrarModalEliminarMovimiento('${r.id}')" title="Eliminar movimiento">🗑️</button>
            </td>
        </tr>
    `}).join('');
}

/**
 * Renderizar tabla del mayor con vista especial de asientos y cheques asociados
 * Muestra los asientos del debe originales con colores según estado de cheques
 */
function renderizarTablaMayorConAsientos() {
    const tbody = document.getElementById('tablaMayorBody');
    const mostrarSoloNoVinculados = document.getElementById('mostrarSoloNoVinculados')?.checked || false;
    const mostrarSoloParciales = document.getElementById('mostrarSoloParciales')?.checked || false;

    // Si no hay listado de cheques incorporado, usar renderizado normal
    if (!stateMayores.listadoChequesIncorporado || !stateMayores.asientosDebeOriginales) {
        renderizarTablaMayor();
        return;
    }

    // Obtener asientos del debe originales enriquecidos
    const asientosDebe = stateMayores.asientosDebeOriginales || [];

    // Obtener registros del haber del mayor actual
    const registrosHaber = stateMayores.registrosMayor.filter(r => r.haber > 0 || r.esDevolucion);

    // Obtener cheques no asociados
    const chequesNoAsociados = stateMayores.chequesNoAsociados || [];

    // Filtrar si es necesario
    let asientosDebeFiltered = asientosDebe;
    let registrosHaberFiltered = registrosHaber;
    let chequesNoAsociadosFiltered = chequesNoAsociados;

    // Filtro: Solo asociaciones parciales (prioridad alta)
    if (mostrarSoloParciales) {
        asientosDebeFiltered = asientosDebe.filter(asiento => asiento.estadoCheques === 'parcial');
        // Al filtrar por parciales, no mostrar registros del haber ni cheques sin asociar
        registrosHaberFiltered = [];
        chequesNoAsociadosFiltered = [];
    } else if (mostrarSoloNoVinculados) {
        // Filtrar asientos que tienen cheques sin vincular
        asientosDebeFiltered = asientosDebe.filter(asiento => {
            const chequesPendientes = asiento.chequesAsociados.filter(ch => {
                const regCheque = stateMayores.registrosMayor.find(r => r.id === ch.id);
                return !regCheque || regCheque.estado !== 'vinculado';
            });
            return chequesPendientes.length > 0 || asiento.estadoCheques === 'sin_cheques';
        });
        registrosHaberFiltered = registrosHaber.filter(r => r.estado !== 'vinculado');
    }

    if (asientosDebeFiltered.length === 0 && registrosHaberFiltered.length === 0 && chequesNoAsociadosFiltered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="text-align: center; padding: 40px;">No hay registros para mostrar</td></tr>`;
        return;
    }

    let html = '';

    // Renderizar sección de asientos del debe con cheques
    if (asientosDebeFiltered.length > 0) {
        html += `<tr class="seccion-header seccion-debe">
            <td colspan="8" style="background: #fef2f2; font-weight: bold; padding: 12px; border-bottom: 2px solid #dc2626;">
                📥 ASIENTOS DEL DEBE (Ingresos de Cheques) - ${asientosDebeFiltered.length} asientos
            </td>
        </tr>`;

        asientosDebeFiltered.forEach(asiento => {
            const estadoClass = getClaseEstadoCheques(asiento.estadoCheques);
            const estadoIcono = getIconoEstadoCheques(asiento.estadoCheques);
            const cantidadCheques = asiento.chequesAsociados.length;
            const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
            const expandido = stateMayores.asientosExpandidos?.[asiento.id] || false;

            // Fila del asiento principal
            html += `
            <tr class="asiento-row ${estadoClass}" data-id="${asiento.id}">
                <td class="checkbox-col" style="width: 40px;">
                    <button class="btn-expandir" onclick="toggleExpandirAsiento('${asiento.id}')" title="Ver cheques asociados">
                        ${expandido ? '▼' : '▶'}
                    </button>
                </td>
                <td>${formatearFecha(asiento.fecha)}</td>
                <td>${asiento.asiento}</td>
                <td title="${asiento.descripcion}">${truncarTexto(asiento.descripcion, 40)}</td>
                <td class="text-right" style="color: #dc2626; font-weight: bold;">${formatearMoneda(asiento.debe)}</td>
                <td class="text-right"></td>
                <td>
                    <span class="estado-cheques ${estadoClass}">
                        ${estadoIcono} ${cantidadCheques} cheque${cantidadCheques !== 1 ? 's' : ''}
                    </span>
                </td>
                <td class="info-diferencia">
                    ${asiento.estadoCheques === 'parcial'
                        ? `<span class="diferencia" title="Diferencia entre asiento y suma de cheques">Dif: ${formatearMoneda(asiento.diferenciaCheques)}</span>`
                        : asiento.estadoCheques === 'completo'
                            ? '<span class="coincide">✓ Coincide</span>'
                            : '<span class="sin-cheques">Sin cheques</span>'
                    }
                </td>
            </tr>`;

            // Filas de cheques asociados (sublistado)
            if (expandido && asiento.chequesAsociados.length > 0) {
                html += `<tr class="cheques-container-row"><td colspan="8" style="padding: 0;">
                    <div class="cheques-sublistado">
                        <table class="tabla-cheques-asociados">
                            <thead>
                                <tr>
                                    <th style="width: 40px;"></th>
                                    <th>Número</th>
                                    <th>Origen</th>
                                    <th>F. Emisión</th>
                                    <th>F. Recepción</th>
                                    <th>Importe</th>
                                    <th>Estado Cheque</th>
                                    <th>Estado Conc.</th>
                                    <th style="width: 60px;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>`;

                asiento.chequesAsociados.forEach(cheque => {
                    // Buscar el registro del cheque para ver su estado de conciliación
                    const regCheque = stateMayores.registrosMayor.find(r => r.id === cheque.id);
                    const estadoConciliacion = regCheque?.estado || 'pendiente';
                    const isSelected = regCheque && stateMayores.cuponesSeleccionados.includes(regCheque.id);

                    html += `
                        <tr class="cheque-row ${estadoConciliacion}" data-cheque-id="${cheque.id}">
                            <td>
                                <input type="checkbox" ${isSelected ? 'checked' : ''}
                                    onchange="toggleSeleccionRegistroMayor('${cheque.id}', this)"
                                    ${!regCheque ? 'disabled' : ''}>
                            </td>
                            <td><strong>CHQ ${cheque.numero || cheque.interno || '-'}</strong></td>
                            <td title="${cheque.origen || ''}">${truncarTexto(cheque.origen || '-', 25)}</td>
                            <td>${formatearFecha(cheque.fechaEmision)}</td>
                            <td>${formatearFecha(cheque.fechaRecepcion)}</td>
                            <td class="text-right" style="color: #dc2626;">${formatearMoneda(cheque.importe)}</td>
                            <td><span class="estado-cheque-badge">${cheque.estado || '-'}</span></td>
                            <td><span class="registro-estado ${estadoConciliacion}">${obtenerEtiquetaEstado(estadoConciliacion)}</span></td>
                            <td>
                                <button class="btn-liberar-cheque" onclick="liberarChequeDeAsiento('${cheque.id}', '${asiento.id}')" title="Liberar cheque de este asiento">
                                    ✕
                                </button>
                            </td>
                        </tr>`;
                });

                html += `</tbody></table></div></td></tr>`;
            }
        });
    }

    // Renderizar cheques no asociados (si hay)
    if (chequesNoAsociadosFiltered.length > 0) {
        // Generar opciones de asientos del debe para el select de vinculación manual
        const opcionesAsientos = asientosDebe
            .filter(a => a.estadoCheques !== 'completo')  // Solo asientos que no están completos
            .map(a => `<option value="${a.id}">${a.asiento} - ${truncarTexto(a.descripcion, 30)} ($${formatearMoneda(a.debe)})</option>`)
            .join('');

        html += `<tr class="seccion-header seccion-sin-asiento">
            <td colspan="8" style="background: #fef3c7; font-weight: bold; padding: 12px; border-bottom: 2px solid #f59e0b;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⚠️ CHEQUES SIN ASIENTO ASOCIADO - ${chequesNoAsociadosFiltered.length} cheques</span>
                    <button class="btn-reprocesar-cheques" onclick="reprocesarChequesNoAsociados()" title="Intentar vincular automáticamente los cheques pendientes">
                        🔄 Reprocesar vinculación
                    </button>
                </div>
            </td>
        </tr>`;

        chequesNoAsociadosFiltered.forEach(cheque => {
            const regCheque = stateMayores.registrosMayor.find(r => r.id === cheque.id);
            const estadoConciliacion = regCheque?.estado || 'pendiente';
            const isSelected = regCheque && stateMayores.cuponesSeleccionados.includes(regCheque.id);

            html += `
            <tr class="cheque-sin-asiento ${estadoConciliacion}" data-cheque-id="${cheque.id}">
                <td class="checkbox-col">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}
                        onchange="toggleSeleccionRegistroMayor('${cheque.id}', this)"
                        ${!regCheque ? 'disabled' : ''}>
                </td>
                <td>${formatearFecha(cheque.fechaRecepcion) !== '-' ? formatearFecha(cheque.fechaRecepcion) : formatearFecha(cheque.fechaEmision)}</td>
                <td>-</td>
                <td><strong>CHQ ${cheque.numero || cheque.interno || '-'}</strong> de ${truncarTexto(cheque.origen || '-', 20)}</td>
                <td class="text-right" style="color: #dc2626;">${formatearMoneda(cheque.importe)}</td>
                <td>
                    <select class="select-vincular-asiento" onchange="vincularChequeManual('${cheque.id}', this.value)" title="Vincular manualmente a un asiento">
                        <option value="">Vincular a...</option>
                        ${opcionesAsientos}
                    </select>
                </td>
                <td><span class="registro-estado ${estadoConciliacion}">${obtenerEtiquetaEstado(estadoConciliacion)}</span></td>
                <td><span class="estado-cheque-badge">${cheque.estado || '-'}</span></td>
            </tr>`;
        });
    }

    // Renderizar sección del haber (usos de cheques)
    if (registrosHaberFiltered.length > 0) {
        html += `<tr class="seccion-header seccion-haber">
            <td colspan="8" style="background: #f0fdf4; font-weight: bold; padding: 12px; border-bottom: 2px solid #16a34a; margin-top: 20px;">
                📤 REGISTROS DEL HABER (Usos/Depósitos de Cheques) - ${registrosHaberFiltered.length} registros
            </td>
        </tr>`;

        registrosHaberFiltered.forEach(r => {
            const isSelected = stateMayores.liquidacionesSeleccionadas.includes(r.id);
            const checkedAttr = isSelected ? 'checked' : '';
            const rowClass = isSelected ? `${r.estado} row-selected` : r.estado;

            html += `
            <tr class="${rowClass}" data-id="${r.id}">
                <td class="checkbox-col">
                    <input type="checkbox" ${checkedAttr} onchange="toggleSeleccionRegistroMayor('${r.id}', this)">
                </td>
                <td>${formatearFecha(r.fecha)}</td>
                <td>${r.asiento}</td>
                <td title="${r.descripcion}">${truncarTexto(r.descripcion, 50)}</td>
                <td class="text-right"></td>
                <td class="text-right" style="color: #16a34a;">${formatearMoneda(r.haber)}</td>
                <td><span class="registro-estado ${r.estado}">${obtenerEtiquetaEstado(r.estado)}</span></td>
                <td>${r.vinculadoCon?.length > 0 ? `${r.vinculadoCon.length} reg.` : '-'}</td>
            </tr>`;
        });
    }

    tbody.innerHTML = html;

    // Inicializar estado de expansión si no existe
    if (!stateMayores.asientosExpandidos) {
        stateMayores.asientosExpandidos = {};
    }
}

/**
 * Toggle expandir/colapsar asiento para ver cheques asociados
 * Optimizado: solo manipula el DOM del asiento específico sin re-renderizar toda la tabla
 */
function toggleExpandirAsiento(asientoId) {
    if (!stateMayores.asientosExpandidos) {
        stateMayores.asientosExpandidos = {};
    }

    const expandido = !stateMayores.asientosExpandidos[asientoId];
    stateMayores.asientosExpandidos[asientoId] = expandido;

    // Buscar la fila del asiento en el DOM
    const asientoRow = document.querySelector(`tr.asiento-row[data-id="${asientoId}"]`);
    if (!asientoRow) {
        return;
    }

    // Actualizar el botón de expandir/colapsar
    const btnExpandir = asientoRow.querySelector('.btn-expandir');
    if (btnExpandir) {
        btnExpandir.textContent = expandido ? '▼' : '▶';
    }

    // Buscar si ya existe una fila de cheques asociados
    const nextRow = asientoRow.nextElementSibling;
    const existeFilaCheques = nextRow && nextRow.classList.contains('cheques-container-row');

    if (expandido) {
        // Expandir: insertar la fila de cheques si no existe
        if (!existeFilaCheques) {
            const asiento = stateMayores.asientosDebeOriginales?.find(a => a.id === asientoId);
            if (asiento && asiento.chequesAsociados.length > 0) {
                const filaCheques = crearFilaChequesAsociados(asiento);
                asientoRow.insertAdjacentHTML('afterend', filaCheques);
            }
        }
    } else {
        // Colapsar: remover la fila de cheques si existe
        if (existeFilaCheques) {
            nextRow.remove();
        }
    }
}

/**
 * Crea el HTML de la fila con los cheques asociados a un asiento
 * @param {Object} asiento - El asiento con sus cheques asociados
 * @returns {string} HTML de la fila de cheques
 */
function crearFilaChequesAsociados(asiento) {
    let html = `<tr class="cheques-container-row"><td colspan="8" style="padding: 0;">
        <div class="cheques-sublistado">
            <table class="tabla-cheques-asociados">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th>Número</th>
                        <th>Origen</th>
                        <th>F. Emisión</th>
                        <th>F. Recepción</th>
                        <th>Importe</th>
                        <th>Estado Cheque</th>
                        <th>Estado Conc.</th>
                        <th style="width: 60px;">Acción</th>
                    </tr>
                </thead>
                <tbody>`;

    asiento.chequesAsociados.forEach(cheque => {
        const regCheque = stateMayores.registrosMayor.find(r => r.id === cheque.id);
        const estadoConciliacion = regCheque?.estado || 'pendiente';
        const isSelected = regCheque && stateMayores.cuponesSeleccionados.includes(regCheque.id);

        html += `
            <tr class="cheque-row ${estadoConciliacion}" data-cheque-id="${cheque.id}">
                <td>
                    <input type="checkbox" ${isSelected ? 'checked' : ''}
                        onchange="toggleSeleccionRegistroMayor('${cheque.id}', this)"
                        ${!regCheque ? 'disabled' : ''}>
                </td>
                <td><strong>CHQ ${cheque.numero || cheque.interno || '-'}</strong></td>
                <td title="${cheque.origen || ''}">${truncarTexto(cheque.origen || '-', 25)}</td>
                <td>${formatearFecha(cheque.fechaEmision)}</td>
                <td>${formatearFecha(cheque.fechaRecepcion)}</td>
                <td class="text-right" style="color: #dc2626;">${formatearMoneda(cheque.importe)}</td>
                <td><span class="estado-cheque-badge">${cheque.estado || '-'}</span></td>
                <td><span class="registro-estado ${estadoConciliacion}">${obtenerEtiquetaEstado(estadoConciliacion)}</span></td>
                <td>
                    <button class="btn-liberar-cheque" onclick="liberarChequeDeAsiento('${cheque.id}', '${asiento.id}')" title="Liberar cheque de este asiento">
                        ✕
                    </button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div></td></tr>`;
    return html;
}

/**
 * Obtener clase CSS según estado de cheques del asiento
 */
function getClaseEstadoCheques(estadoCheques) {
    switch (estadoCheques) {
        case 'completo': return 'cheques-completo';
        case 'parcial': return 'cheques-parcial';
        case 'sin_cheques': return 'cheques-sin';
        default: return '';
    }
}

/**
 * Obtener icono según estado de cheques del asiento
 */
function getIconoEstadoCheques(estadoCheques) {
    switch (estadoCheques) {
        case 'completo': return '✅';
        case 'parcial': return '⚠️';
        case 'sin_cheques': return '❌';
        default: return '❓';
    }
}

/**
 * Liberar un cheque de su vinculación con un asiento del debe
 * El cheque pasa a la sección "Sin asiento asociado"
 * @param {string} chequeId - ID del cheque a liberar
 * @param {string} asientoId - ID del asiento del cual liberar el cheque
 */
function liberarChequeDeAsiento(chequeId, asientoId) {
    // Buscar el asiento en los asientos del debe originales
    const asiento = stateMayores.asientosDebeOriginales?.find(a => a.id === asientoId);
    if (!asiento) {
        console.error('No se encontró el asiento:', asientoId);
        return;
    }

    // Buscar el cheque en los cheques asociados del asiento
    const indexCheque = asiento.chequesAsociados.findIndex(ch => ch.id === chequeId);
    if (indexCheque === -1) {
        console.error('No se encontró el cheque en el asiento:', chequeId);
        return;
    }

    // Extraer el cheque del array
    const cheque = asiento.chequesAsociados.splice(indexCheque, 1)[0];
    cheque.asientoAsociado = null;  // Limpiar referencia al asiento

    // Agregar a cheques no asociados
    if (!stateMayores.chequesNoAsociados) {
        stateMayores.chequesNoAsociados = [];
    }
    stateMayores.chequesNoAsociados.push(cheque);

    // Recalcular estado del asiento
    const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
    const tolerancia = 0.01;

    if (asiento.chequesAsociados.length === 0) {
        asiento.estadoCheques = 'sin_cheques';
    } else if (Math.abs(asiento.debe - sumaCheques) <= tolerancia) {
        asiento.estadoCheques = 'completo';
    } else {
        asiento.estadoCheques = 'parcial';
        asiento.diferenciaCheques = asiento.debe - sumaCheques;
    }

    // Actualizar el registro del cheque en registrosMayor para marcarlo como sin asiento
    const regCheque = stateMayores.registrosMayor.find(r => r.id === chequeId);
    if (regCheque) {
        regCheque.asientoOrigenId = null;
        // Actualizar descripción para indicar que no tiene asiento
        if (!regCheque.descripcion.includes('[SIN ASIENTO]')) {
            regCheque.descripcion += ' [SIN ASIENTO]';
        }
    }

    console.log(`✅ Cheque ${cheque.numero || chequeId} liberado del asiento ${asiento.asiento}`);

    // Re-renderizar la tabla
    renderizarTablaMayorConAsientos();
    actualizarEstadisticasMayor();
}

/**
 * Vincular manualmente un cheque no asociado a un asiento del debe
 * @param {string} chequeId - ID del cheque a vincular
 * @param {string} asientoId - ID del asiento destino
 */
function vincularChequeManual(chequeId, asientoId) {
    if (!asientoId) return;  // No se seleccionó ningún asiento

    // Buscar el cheque en los no asociados
    const indexCheque = stateMayores.chequesNoAsociados?.findIndex(ch => ch.id === chequeId);
    if (indexCheque === -1 || indexCheque === undefined) {
        console.error('No se encontró el cheque:', chequeId);
        return;
    }

    // Buscar el asiento destino
    const asiento = stateMayores.asientosDebeOriginales?.find(a => a.id === asientoId);
    if (!asiento) {
        console.error('No se encontró el asiento:', asientoId);
        return;
    }

    // Extraer el cheque de los no asociados
    const cheque = stateMayores.chequesNoAsociados.splice(indexCheque, 1)[0];
    cheque.asientoAsociado = asiento.asiento;

    // Agregar al asiento
    asiento.chequesAsociados.push(cheque);

    // Recalcular estado del asiento
    const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
    const tolerancia = 0.01;

    if (Math.abs(asiento.debe - sumaCheques) <= tolerancia) {
        asiento.estadoCheques = 'completo';
    } else {
        asiento.estadoCheques = 'parcial';
        asiento.diferenciaCheques = asiento.debe - sumaCheques;
    }

    // Actualizar el registro del cheque en registrosMayor
    const regCheque = stateMayores.registrosMayor.find(r => r.id === chequeId);
    if (regCheque) {
        regCheque.asientoOrigenId = asiento.id;
        // Quitar marca de sin asiento si la tenía
        regCheque.descripcion = regCheque.descripcion.replace(' [SIN ASIENTO]', '');
    }

    console.log(`✅ Cheque ${cheque.numero || chequeId} vinculado manualmente al asiento ${asiento.asiento}`);

    // Re-renderizar la tabla
    renderizarTablaMayorConAsientos();
    actualizarEstadisticasMayor();
}

/**
 * Reprocesar cheques no asociados intentando vincularlos automáticamente
 * Usa el algoritmo de scoring para encontrar mejores matches
 */
function reprocesarChequesNoAsociados() {
    const chequesNoAsociados = stateMayores.chequesNoAsociados || [];
    const asientosDelDebe = stateMayores.asientosDebeOriginales || [];

    if (chequesNoAsociados.length === 0) {
        alert('No hay cheques pendientes de vinculación.');
        return;
    }

    // Funciones auxiliares (copiadas del algoritmo principal)
    const siglasExcluir = ['srl', 's r l', 'sas', 's a s', 'sa', 's a', 'sca', 's c a', 'sci', 's c i', 'se', 's e'];

    function normalizarTexto(texto) {
        if (!texto) return '';
        let resultado = texto.toString().toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        for (const sigla of siglasExcluir) {
            resultado = resultado.replace(new RegExp(`\\s+${sigla}$`, 'g'), '');
            resultado = resultado.replace(new RegExp(`\\s+${sigla}\\s+`, 'g'), ' ');
        }
        return resultado.trim();
    }

    function calcularSimilitudTexto(origenCheque, descripcionAsiento) {
        const origenNorm = normalizarTexto(origenCheque);
        const descripcionNorm = normalizarTexto(descripcionAsiento);
        if (!origenNorm || !descripcionNorm) return 0;
        if (descripcionNorm.includes(origenNorm) || origenNorm.includes(descripcionNorm)) return 1;
        // Usar palabras de más de 3 caracteres para evitar falsos positivos con "san", "de", etc.
        const palabrasOrigen = origenNorm.split(' ').filter(p => p.length > 3);
        const palabrasDescripcion = descripcionNorm.split(' ').filter(p => p.length > 3);
        if (palabrasOrigen.length === 0) return 0;
        let coincidencias = 0;
        for (const palabra of palabrasOrigen) {
            // Comparación más estricta: la palabra debe coincidir exactamente o
            // una debe contener a la otra solo si la diferencia de longitud es <= 2
            if (palabrasDescripcion.some(pd => {
                if (pd === palabra) return true;
                const diffLen = Math.abs(pd.length - palabra.length);
                if (diffLen > 2) return false;
                return pd.includes(palabra) || palabra.includes(pd);
            })) coincidencias++;
        }
        return coincidencias / palabrasOrigen.length;
    }

    function calcularScoreAsociacion(cheque, registro) {
        let score = 0;
        const detalles = { fecha: 0, texto: 0, diffDias: Infinity };
        // Tolerancia máxima de días: +/- 15 días (operaciones bancarias pueden demorar)
        const TOLERANCIA_DIAS_CHEQUES = 15; // Tolerancia ampliada para operaciones bancarias

        const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
        if (fechaCheque && registro.fecha) {
            detalles.diffDias = Math.abs((registro.fecha - fechaCheque) / (1000 * 60 * 60 * 24));
            // Solo asignar score si está dentro de la tolerancia de +/- 15 días
            if (detalles.diffDias <= TOLERANCIA_DIAS_CHEQUES) {
                if (detalles.diffDias === 0) detalles.fecha = 50;
                else if (detalles.diffDias <= 1) detalles.fecha = 48;
                else if (detalles.diffDias <= 2) detalles.fecha = 45;
                else if (detalles.diffDias <= 3) detalles.fecha = 42;
                else if (detalles.diffDias <= 5) detalles.fecha = 38;
                else if (detalles.diffDias <= 7) detalles.fecha = 32;
                else if (detalles.diffDias <= 10) detalles.fecha = 25;
                else detalles.fecha = 18; // 11-15 días
            }
            // Si diffDias > 15, detalles.fecha queda en 0
        }
        const similitud = calcularSimilitudTexto(cheque.origen, registro.descripcion);
        detalles.texto = Math.round(similitud * 50);
        // Si la fecha está fuera de tolerancia, el score es 0
        const dentroToleranciaFecha = detalles.diffDias <= TOLERANCIA_DIAS_CHEQUES;
        score = dentroToleranciaFecha ? (detalles.fecha + detalles.texto) : 0;
        return { score, detalles };
    }

    function excederiaMontoDelDebe(registro, importeCheque) {
        const tolerancia = 0.50;
        const sumaActual = registro.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
        return (sumaActual + importeCheque) > (registro.debe + tolerancia);
    }

    let vinculados = 0;
    const chequesParaRemover = [];

    // Intentar vincular cada cheque no asociado
    chequesNoAsociados.forEach((cheque, index) => {
        let mejorAsiento = null;
        let mejorScore = 0;

        asientosDelDebe.forEach(asiento => {
            if (asiento.estadoCheques === 'completo') return;
            if (excederiaMontoDelDebe(asiento, cheque.importe)) return;

            const { score, detalles } = calcularScoreAsociacion(cheque, asiento);
            // Umbral para reproceso: score >= 40 o texto >= 35 (70% similitud mínima)
            if (score > mejorScore && (score >= 40 || detalles.texto >= 35)) {
                mejorScore = score;
                mejorAsiento = asiento;
            }
        });

        if (mejorAsiento) {
            // Vincular el cheque al asiento
            cheque.asientoAsociado = mejorAsiento.asiento;
            mejorAsiento.chequesAsociados.push(cheque);

            // Recalcular estado del asiento
            const sumaCheques = mejorAsiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
            if (Math.abs(mejorAsiento.debe - sumaCheques) <= 0.01) {
                mejorAsiento.estadoCheques = 'completo';
            } else {
                mejorAsiento.estadoCheques = 'parcial';
                mejorAsiento.diferenciaCheques = mejorAsiento.debe - sumaCheques;
            }

            // Actualizar registro en registrosMayor
            const regCheque = stateMayores.registrosMayor.find(r => r.id === cheque.id);
            if (regCheque) {
                regCheque.asientoOrigenId = mejorAsiento.id;
                regCheque.descripcion = regCheque.descripcion.replace(' [SIN ASIENTO]', '');
            }

            chequesParaRemover.push(index);
            vinculados++;
        }
    });

    // Remover cheques vinculados del array de no asociados (en orden inverso para no afectar índices)
    chequesParaRemover.sort((a, b) => b - a).forEach(idx => {
        stateMayores.chequesNoAsociados.splice(idx, 1);
    });

    console.log(`🔄 Reproceso completado: ${vinculados} cheques vinculados`);

    // Re-renderizar
    renderizarTablaMayorConAsientos();
    actualizarEstadisticasMayor();

    alert(`Reproceso completado:\n✅ ${vinculados} cheques vinculados\n⏳ ${chequesNoAsociados.length} cheques siguen pendientes`);
}

/**
 * Filtrar registros del mayor
 */
function filtrarRegistrosMayor() {
    if (stateMayores.listadoChequesIncorporado) {
        renderizarTablaMayorConAsientos();
    } else {
        renderizarTablaMayor();
    }
}

/**
 * Toggle seleccionar todos en la tabla del mayor
 */
function toggleSeleccionarTodosMayor(checkbox) {
    const registros = stateMayores.registrosMayor;
    const mostrarSoloNoVinculados = document.getElementById('mostrarSoloNoVinculados')?.checked || false;

    // Obtener registros visibles según filtro
    let registrosVisibles = registros;
    if (mostrarSoloNoVinculados) {
        registrosVisibles = registros.filter(r => r.estado !== 'vinculado');
    }

    if (checkbox.checked) {
        // Seleccionar todos los registros visibles usando configuración dinámica
        registrosVisibles.forEach(r => {
            if (esRegistroOrigen(r)) {
                if (!stateMayores.cuponesSeleccionados.includes(r.id)) {
                    stateMayores.cuponesSeleccionados.push(r.id);
                }
            } else {
                if (!stateMayores.liquidacionesSeleccionadas.includes(r.id)) {
                    stateMayores.liquidacionesSeleccionadas.push(r.id);
                }
            }
        });
    } else {
        // Deseleccionar solo los registros visibles
        const idsVisibles = registrosVisibles.map(r => r.id);
        stateMayores.cuponesSeleccionados = stateMayores.cuponesSeleccionados.filter(id => !idsVisibles.includes(id));
        stateMayores.liquidacionesSeleccionadas = stateMayores.liquidacionesSeleccionadas.filter(id => !idsVisibles.includes(id));
    }

    // Actualizar checkboxes visualmente
    const checkboxes = document.querySelectorAll('#tablaMayorBody input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });

    // Actualizar panel de vinculación y barra de selección flotante
    renderizarVinculacion();
    actualizarBarraSeleccionMayores();
}

/**
 * Toggle selección de registro en tabla
 */
function toggleSeleccionRegistroMayor(id, checkbox) {
    // Actualizar selección según tipo usando configuración dinámica
    const registro = stateMayores.registrosMayor.find(r => r.id === id);
    if (!registro) return;

    if (esRegistroOrigen(registro)) {
        if (checkbox.checked) {
            if (!stateMayores.cuponesSeleccionados.includes(id)) {
                stateMayores.cuponesSeleccionados.push(id);
            }
        } else {
            stateMayores.cuponesSeleccionados = stateMayores.cuponesSeleccionados.filter(i => i !== id);
        }
    } else {
        if (checkbox.checked) {
            if (!stateMayores.liquidacionesSeleccionadas.includes(id)) {
                stateMayores.liquidacionesSeleccionadas.push(id);
            }
        } else {
            stateMayores.liquidacionesSeleccionadas = stateMayores.liquidacionesSeleccionadas.filter(i => i !== id);
        }
    }

    // Actualizar panel de vinculación y barra de selección flotante
    renderizarVinculacion();
    actualizarBarraSeleccionMayores();
}

// ============================================
// PERSISTENCIA DE DATOS Y GESTIÓN DE CONCILIACIONES
// ============================================

/**
 * Obtener la clave base para localStorage de conciliaciones
 */
function getConciliacionesMayorKey() {
    return `conciliaciones_mayor_${stateMayores.clienteActual.id}_${stateMayores.tipoMayorActual.id}`;
}

/**
 * Función de debug: Listar todas las claves de conciliaciones en localStorage
 * Se puede ejecutar desde la consola del navegador: listarConciliacionesGuardadas()
 */
function listarConciliacionesGuardadas() {
    const claves = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('conciliaciones_mayor_')) {
            try {
                const datos = JSON.parse(localStorage.getItem(key));
                claves.push({
                    clave: key,
                    cantidad: Array.isArray(datos) ? datos.length : 0,
                    conciliaciones: Array.isArray(datos) ? datos.map(c => ({
                        id: c.id,
                        nombre: c.nombre,
                        fechaGuardado: c.fechaGuardado,
                        registros: (c.registros || []).length
                    })) : []
                });
            } catch (e) {
                claves.push({ clave: key, error: 'No se pudo parsear' });
            }
        }
    }

    console.log('📋 Conciliaciones guardadas en localStorage:');
    if (claves.length === 0) {
        console.log('   No se encontraron conciliaciones guardadas');
    } else {
        claves.forEach(item => {
            console.log(`\n   🔑 ${item.clave}`);
            if (item.error) {
                console.log(`      ❌ ${item.error}`);
            } else {
                console.log(`      📊 ${item.cantidad} conciliación(es):`);
                item.conciliaciones.forEach(c => {
                    console.log(`         - "${c.nombre}" (${c.registros} registros) - ${c.fechaGuardado}`);
                });
            }
        });
    }

    return claves;
}

/**
 * Mostrar todas las conciliaciones del sistema en el modal de gestión
 */
function mostrarTodasLasConciliaciones() {
    const lista = document.getElementById('gestion-conciliaciones-mayor-lista');
    const todasLasConciliaciones = listarConciliacionesGuardadas();

    if (todasLasConciliaciones.length === 0) {
        lista.innerHTML = `
            <div class="conciliaciones-vacio">
                <div class="conciliaciones-vacio-icon">📭</div>
                <p>No hay ninguna conciliación guardada en el sistema</p>
                <p style="font-size: 12px; color: #6c757d; margin-top: 10px;">
                    El localStorage no contiene datos de conciliaciones. Esto puede ocurrir si:
                    <br>• Se limpió el caché del navegador
                    <br>• Se está usando otro navegador o modo incógnito
                    <br>• Nunca se guardó una conciliación
                </p>
            </div>
        `;
    } else {
        let html = `
            <div style="margin-bottom: 15px; padding: 10px; background: #e7f3ff; border-radius: 6px; font-size: 12px;">
                <strong>🔍 Todas las conciliaciones guardadas en el sistema</strong>
                <br><span style="color: #666;">Comparar las claves con la clave actual para encontrar tu conciliación</span>
            </div>
        `;

        todasLasConciliaciones.forEach(item => {
            const esClaveActual = stateMayores.clienteActual && stateMayores.tipoMayorActual &&
                item.clave === getConciliacionesMayorKey();

            html += `
                <div style="margin-bottom: 15px; padding: 12px; background: ${esClaveActual ? '#d4edda' : '#f8f9fa'}; border-radius: 6px; border: ${esClaveActual ? '2px solid #28a745' : '1px solid #dee2e6'};">
                    <div style="font-size: 11px; font-family: monospace; color: #666; margin-bottom: 8px; word-break: break-all;">
                        🔑 ${item.clave}
                        ${esClaveActual ? '<span style="color: #28a745; font-weight: bold;"> ← CLAVE ACTUAL</span>' : ''}
                    </div>
                    ${item.error ?
                        `<div style="color: #dc3545;">❌ ${item.error}</div>` :
                        item.conciliaciones.map(c => `
                            <div style="padding: 8px; background: white; border-radius: 4px; margin-top: 5px; border: 1px solid #e9ecef;">
                                <div style="font-weight: 500;">"${c.nombre}"</div>
                                <div style="font-size: 11px; color: #666;">
                                    📊 ${c.registros} registros | 📅 ${new Date(c.fechaGuardado).toLocaleString('es-AR')}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            `;
        });

        lista.innerHTML = html;
    }
}

/**
 * Cargar lista de conciliaciones guardadas desde Supabase (o localStorage como fallback)
 */
async function cargarConciliacionesMayorGuardadas() {
    if (!stateMayores.clienteActual || !stateMayores.tipoMayorActual) {
        console.log('⚠️ cargarConciliacionesMayorGuardadas: No hay cliente o tipo seleccionado');
        return [];
    }

    const clienteId = stateMayores.clienteActual.id;
    const tipoMayorId = stateMayores.tipoMayorActual.id;

    try {
        // Intentar cargar desde Supabase primero
        if (window.supabaseDB) {
            const { data, error } = await window.supabaseDB
                .from('conciliaciones_mayor')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('tipo_mayor_id', tipoMayorId)
                .order('fecha_modificado', { ascending: false });

            if (error) {
                // Si la tabla no existe, caer en localStorage
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('⚠️ Tabla conciliaciones_mayor no existe en Supabase, usando localStorage');
                } else {
                    console.error('Error cargando desde Supabase:', error);
                }
            } else if (data && data.length > 0) {
                console.log(`📊 ${data.length} conciliaciones cargadas desde Supabase`);
                // Transformar datos de Supabase al formato esperado
                return data.map(c => ({
                    id: c.id,
                    nombre: c.nombre,
                    registros: c.registros || [],
                    vinculaciones: c.vinculaciones || [],
                    movimientosEliminados: c.movimientos_eliminados || [],
                    listadoChequesGuardadoId: c.listado_cheques_guardado_id,
                    listadoChequesIncorporado: c.listado_cheques_incorporado,
                    listadoChequesCargados: c.listado_cheques_cargados || [],
                    mesesDisponibles: c.meses_disponibles || [],
                    mesesProcesados: c.meses_procesados || {},
                    mesesProcesadosResumen: c.meses_procesados_resumen || {},
                    fechaGuardado: c.fecha_guardado,
                    fechaModificado: c.fecha_modificado
                }));
            } else {
                console.log('📊 No hay conciliaciones en Supabase para este cliente/tipo');
                // Intentar migrar desde localStorage si hay datos
                await migrarConciliacionesLocalStorageASupabase();
                // Recargar desde Supabase después de la migración
                const { data: dataPostMigration } = await window.supabaseDB
                    .from('conciliaciones_mayor')
                    .select('*')
                    .eq('cliente_id', clienteId)
                    .eq('tipo_mayor_id', tipoMayorId)
                    .order('fecha_modificado', { ascending: false });

                if (dataPostMigration && dataPostMigration.length > 0) {
                    return dataPostMigration.map(c => ({
                        id: c.id,
                        nombre: c.nombre,
                        registros: c.registros || [],
                        vinculaciones: c.vinculaciones || [],
                        movimientosEliminados: c.movimientos_eliminados || [],
                        listadoChequesGuardadoId: c.listado_cheques_guardado_id,
                        listadoChequesIncorporado: c.listado_cheques_incorporado,
                        listadoChequesCargados: c.listado_cheques_cargados || [],
                        mesesDisponibles: c.meses_disponibles || [],
                        mesesProcesados: c.meses_procesados || {},
                        mesesProcesadosResumen: c.meses_procesados_resumen || {},
                        fechaGuardado: c.fecha_guardado,
                        fechaModificado: c.fecha_modificado
                    }));
                }
                return [];
            }
        }

        // Fallback a localStorage si Supabase no está disponible
        const key = getConciliacionesMayorKey();
        const datosGuardados = localStorage.getItem(key);

        if (datosGuardados) {
            const conciliaciones = JSON.parse(datosGuardados);
            console.log(`📊 ${conciliaciones.length} conciliaciones encontradas en localStorage para ${key}`);
            return conciliaciones;
        }

        return [];
    } catch (error) {
        console.error('Error cargando conciliaciones:', error);

        // Último intento: localStorage
        try {
            const key = getConciliacionesMayorKey();
            const datosGuardados = localStorage.getItem(key);
            if (datosGuardados) {
                return JSON.parse(datosGuardados);
            }
        } catch (e) {
            console.error('Error en fallback localStorage:', e);
        }

        return [];
    }
}

/**
 * Migrar conciliaciones de localStorage a Supabase
 */
async function migrarConciliacionesLocalStorageASupabase() {
    if (!window.supabaseDB || !stateMayores.clienteActual || !stateMayores.tipoMayorActual) {
        return;
    }

    const key = getConciliacionesMayorKey();
    const datosGuardados = localStorage.getItem(key);

    if (!datosGuardados) {
        return;
    }

    try {
        const conciliaciones = JSON.parse(datosGuardados);
        if (!Array.isArray(conciliaciones) || conciliaciones.length === 0) {
            return;
        }

        console.log(`🔄 Migrando ${conciliaciones.length} conciliaciones de localStorage a Supabase...`);

        for (const c of conciliaciones) {
            const registro = {
                id: c.id,
                cliente_id: stateMayores.clienteActual.id,
                tipo_mayor_id: stateMayores.tipoMayorActual.id,
                nombre: c.nombre,
                registros: c.registros || [],
                vinculaciones: c.vinculaciones || [],
                listado_cheques_guardado_id: c.listadoChequesGuardadoId || null,
                listado_cheques_incorporado: c.listadoChequesIncorporado || false,
                meses_disponibles: c.mesesDisponibles || [],
                meses_procesados_resumen: c.mesesProcesadosResumen || {},
                fecha_guardado: c.fechaGuardado || new Date().toISOString(),
                fecha_modificado: c.fechaModificado || new Date().toISOString()
            };

            const { error } = await window.supabaseDB
                .from('conciliaciones_mayor')
                .upsert(registro, { onConflict: 'id' });

            if (error) {
                console.error('Error migrando conciliación:', c.nombre, error);
            }
        }

        console.log('✅ Migración completada');
        // Limpiar localStorage después de migrar exitosamente
        localStorage.removeItem(key);
        console.log('🗑️ Datos de localStorage eliminados (ya están en Supabase)');

    } catch (error) {
        console.error('Error en migración:', error);
    }
}

/**
 * Verificar y mostrar conciliaciones guardadas al seleccionar tipo de mayor
 */
async function verificarConciliacionesMayorGuardadas() {
    console.log('🔍 Verificando conciliaciones de mayor guardadas...');
    console.log('   Cliente:', stateMayores.clienteActual?.nombre, '(ID:', stateMayores.clienteActual?.id + ')');
    console.log('   Tipo Mayor:', stateMayores.tipoMayorActual?.nombre, '(ID:', stateMayores.tipoMayorActual?.id + ')');

    // Mostrar información de origen de datos
    if (stateMayores.clienteActual && stateMayores.tipoMayorActual) {
        console.log('   🔑 Buscando en Supabase y localStorage...');
    }

    const conciliaciones = await cargarConciliacionesMayorGuardadas();
    conciliacionesMayorGuardadasLista = conciliaciones || [];

    console.log('📋 Conciliaciones encontradas:', conciliacionesMayorGuardadasLista.length);

    // Actualizar estado del botón de gestión
    actualizarBotonGestionConciliacionesMayor();

    if (conciliacionesMayorGuardadasLista.length > 0) {
        console.log('✅ Mostrando modal con conciliaciones');
        mostrarModalConciliacionMayorGuardada(conciliacionesMayorGuardadasLista);
    } else {
        console.log('ℹ️ No hay conciliaciones guardadas para este tipo de mayor');
    }
}

/**
 * Actualizar estado del botón de gestión de conciliaciones
 */
function actualizarBotonGestionConciliacionesMayor() {
    const btn = document.getElementById('btnGestionConciliacionesMayor');
    if (btn) {
        // Siempre habilitar el botón para permitir ver información de debug
        btn.disabled = false;
        btn.innerHTML = `<span>📂</span> Gestionar Conciliaciones (${conciliacionesMayorGuardadasLista.length})`;
    }
}

/**
 * Mostrar modal de selección de conciliaciones guardadas
 */
function mostrarModalConciliacionMayorGuardada(conciliaciones) {
    const overlay = document.getElementById('overlay-conciliacion-mayor-guardada');
    const modal = document.getElementById('modal-conciliacion-mayor-guardada');
    const lista = document.getElementById('conciliaciones-mayor-seleccion-lista');
    const btnCargar = document.getElementById('btnConfirmarCargarConciliacionMayor');

    // Resetear selección
    conciliacionMayorSeleccionadaId = null;
    if (btnCargar) btnCargar.disabled = true;

    // Generar lista de conciliaciones
    lista.innerHTML = conciliaciones.map(conciliacion => {
        const fechaGuardado = new Date(conciliacion.fechaGuardado);
        const fechaFormateada = fechaGuardado.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const registros = conciliacion.registros || [];
        const vinculaciones = conciliacion.vinculaciones || [];
        const vinculados = registros.filter(r => r.estado === 'vinculado').length;
        const pendientes = registros.filter(r => r.estado === 'pendiente').length;
        const vencidos = registros.filter(r => r.estado === 'vencido').length;

        // Detectar período
        const fechas = registros.filter(r => r.fecha).map(r => new Date(r.fecha));
        let periodo = 'N/A';
        if (fechas.length > 0) {
            const minFecha = new Date(Math.min(...fechas));
            const maxFecha = new Date(Math.max(...fechas));
            periodo = `${formatearFecha(minFecha)} - ${formatearFecha(maxFecha)}`;
        }

        const nombre = conciliacion.nombre || `Conciliación ${fechaFormateada}`;

        return `
            <div class="conciliacion-seleccion-item" onclick="seleccionarConciliacionMayor('${conciliacion.id}')">
                <div class="conciliacion-radio">
                    <input type="radio" name="conciliacionMayorSeleccion" id="conc_${conciliacion.id}" value="${conciliacion.id}">
                </div>
                <div class="conciliacion-info">
                    <div class="conciliacion-nombre">${nombre}</div>
                    <div class="conciliacion-detalles">
                        <span class="conciliacion-fecha">📅 ${fechaFormateada}</span>
                        <span class="conciliacion-periodo">📆 ${periodo}</span>
                    </div>
                    <div class="conciliacion-stats">
                        <span class="stat-vinculados">✓ ${vinculados} vinculados</span>
                        <span class="stat-pendientes">⏳ ${pendientes} pendientes</span>
                        <span class="stat-vencidos">⚠️ ${vencidos} vencidos</span>
                        <span class="stat-total">📊 ${registros.length} registros</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Mostrar modal
    overlay.classList.add('active');
    modal.classList.add('active');
}

/**
 * Cerrar modal de conciliación guardada
 */
function cerrarModalConciliacionMayorGuardada() {
    const overlay = document.getElementById('overlay-conciliacion-mayor-guardada');
    const modal = document.getElementById('modal-conciliacion-mayor-guardada');

    overlay.classList.remove('active');
    modal.classList.remove('active');

    conciliacionMayorSeleccionadaId = null;
}

/**
 * Seleccionar una conciliación de la lista
 */
function seleccionarConciliacionMayor(id) {
    conciliacionMayorSeleccionadaId = id;

    // Marcar radio button
    const radio = document.getElementById(`conc_${id}`);
    if (radio) radio.checked = true;

    // Marcar item visualmente
    document.querySelectorAll('.conciliacion-seleccion-item').forEach(item => {
        item.classList.remove('selected');
    });
    const item = document.querySelector(`.conciliacion-seleccion-item input[value="${id}"]`);
    if (item) {
        item.closest('.conciliacion-seleccion-item').classList.add('selected');
    }

    // Habilitar botón de cargar
    const btnCargar = document.getElementById('btnConfirmarCargarConciliacionMayor');
    if (btnCargar) btnCargar.disabled = false;
}

/**
 * Confirmar y cargar la conciliación seleccionada
 */
function confirmarCargarConciliacionMayorSeleccionada() {
    if (!conciliacionMayorSeleccionadaId) {
        alert('Seleccione una conciliación para cargar');
        return;
    }

    cargarConciliacionMayorGuardada(conciliacionMayorSeleccionadaId);
    cerrarModalConciliacionMayorGuardada();
}

/**
 * Cargar una conciliación guardada específica
 */
async function cargarConciliacionMayorGuardada(conciliacionId) {
    const conciliacion = conciliacionesMayorGuardadasLista.find(c => c.id === conciliacionId);

    if (!conciliacion) {
        alert('No se encontró la conciliación seleccionada');
        return;
    }

    console.log('📂 Cargando conciliación:', conciliacion.nombre);

    // Restaurar fechas como objetos Date
    const registros = conciliacion.registros || [];
    registros.forEach(r => {
        if (r.fecha) {
            r.fecha = new Date(r.fecha);
        }
    });

    // Restaurar estado
    stateMayores.registrosMayor = registros;
    stateMayores.vinculaciones = conciliacion.vinculaciones || [];
    // Restaurar movimientos eliminados (soporta ambos formatos: snake_case de Supabase y camelCase de localStorage)
    let movimientosEliminados = conciliacion.movimientosEliminados || conciliacion.movimientos_eliminados || [];

    // Si no hay movimientos eliminados en la conciliación, intentar cargar desde localStorage (fallback)
    if (movimientosEliminados.length === 0) {
        try {
            const keyEliminados = `movimientos_eliminados_conciliacion_${conciliacion.id}`;
            const datosEliminados = localStorage.getItem(keyEliminados);
            if (datosEliminados) {
                movimientosEliminados = JSON.parse(datosEliminados);
                console.log(`🗑️ Movimientos eliminados cargados desde fallback: ${movimientosEliminados.length}`);
            }
        } catch (error) {
            console.warn('No se pudieron cargar movimientos eliminados desde fallback:', error);
        }
    }
    stateMayores.movimientosEliminados = movimientosEliminados;
    stateMayores.conciliacionCargadaId = conciliacion.id;
    stateMayores.conciliacionCargadaNombre = conciliacion.nombre;

    // Restaurar cheques si están incluidos en la conciliación (formato antiguo)
    if (conciliacion.listadoChequesCargados && conciliacion.listadoChequesCargados.length > 0) {
        // Restaurar fechas de los cheques como objetos Date
        conciliacion.listadoChequesCargados.forEach(c => {
            if (c.fechaRecepcion) c.fechaRecepcion = new Date(c.fechaRecepcion);
            if (c.fechaEmision) c.fechaEmision = new Date(c.fechaEmision);
            if (c.fechaDeposito) c.fechaDeposito = new Date(c.fechaDeposito);
        });

        stateMayores.listadoChequesCargados = conciliacion.listadoChequesCargados;
        stateMayores.listadoChequesIncorporado = conciliacion.listadoChequesIncorporado || true;
        stateMayores.mesesDisponibles = conciliacion.mesesDisponibles || calcularMesesDeCheques(conciliacion.listadoChequesCargados);
        // Restaurar mesesProcesados (soporta formato optimizado con IDs y formato antiguo con objetos)
        stateMayores.mesesProcesados = restaurarMesesProcesadosDesdeDatos(
            conciliacion.mesesProcesados || {},
            stateMayores.listadoChequesCargados
        );

        console.log(`📋 Cheques restaurados: ${conciliacion.listadoChequesCargados.length} cheques`);
    } else if (conciliacion.listadoChequesGuardadoId || conciliacion.listadoChequesIncorporado) {
        // Formato nuevo: cargar cheques desde el listado guardado separadamente
        let chequesEncontrados = false;

        // Primero intentar cargar desde la clave específica de la conciliación (fallback)
        const keyFallback = `listado_cheques_conciliacion_${conciliacion.id}`;
        try {
            const datosFallback = localStorage.getItem(keyFallback);
            if (datosFallback) {
                const datos = JSON.parse(datosFallback);
                // Verificar si es una referencia (guardado compacto por falta de espacio)
                if (datos.referencia === 'cheques_en_listado_cliente' || datos.referencia === 'cheques_no_guardados_localStorage_lleno') {
                    console.log(`📋 Fallback contiene solo referencia (${datos.referencia}), buscando cheques en otro lugar...`);
                    // No marcar como encontrados, dejar que busque en el listado del cliente o pida recargar
                    if (datos.referencia === 'cheques_no_guardados_localStorage_lleno') {
                        console.warn('⚠️ Los cheques no se guardaron previamente por falta de espacio');
                    }
                } else if (datos.cheques && datos.cheques.length > 0) {
                    // Restaurar fechas de los cheques como objetos Date
                    datos.cheques.forEach(c => {
                        if (c.fechaRecepcion) c.fechaRecepcion = new Date(c.fechaRecepcion);
                        if (c.fechaEmision) c.fechaEmision = new Date(c.fechaEmision);
                        if (c.fechaDeposito) c.fechaDeposito = new Date(c.fechaDeposito);
                    });

                    stateMayores.listadoChequesCargados = datos.cheques;
                    stateMayores.listadoChequesIncorporado = true;
                    stateMayores.mesesDisponibles = conciliacion.mesesDisponibles || calcularMesesDeCheques(datos.cheques);
                    // Restaurar mesesProcesados (soporta formato optimizado con IDs)
                    stateMayores.mesesProcesados = restaurarMesesProcesadosDesdeDatos(
                        datos.mesesProcesados || {},
                        stateMayores.listadoChequesCargados
                    );

                    console.log(`📋 Cheques cargados desde fallback: ${datos.cheques.length} cheques`);
                    chequesEncontrados = true;
                }
            }
        } catch (error) {
            console.warn('No se encontraron cheques en fallback:', error);
        }

        // Si no se encontraron, intentar con la clave general del cliente
        if (!chequesEncontrados) {
            const keyListado = getListadoChequesKey();
            if (keyListado) {
                try {
                    const datosListado = localStorage.getItem(keyListado);
                    if (datosListado) {
                        const datos = JSON.parse(datosListado);
                        // Restaurar fechas de los cheques como objetos Date
                        datos.cheques.forEach(c => {
                            if (c.fechaRecepcion) c.fechaRecepcion = new Date(c.fechaRecepcion);
                            if (c.fechaEmision) c.fechaEmision = new Date(c.fechaEmision);
                            if (c.fechaDeposito) c.fechaDeposito = new Date(c.fechaDeposito);
                        });

                        stateMayores.listadoChequesCargados = datos.cheques;
                        stateMayores.listadoChequesIncorporado = true;
                        stateMayores.listadoChequesGuardadoId = datos.id;
                        stateMayores.mesesDisponibles = conciliacion.mesesDisponibles || datos.meses || calcularMesesDeCheques(datos.cheques);

                        // Cargar meses procesados
                        cargarMesesProcesados();

                        console.log(`📋 Cheques cargados desde listado guardado: ${datos.cheques.length} cheques`);
                        chequesEncontrados = true;
                    }
                } catch (error) {
                    console.error('Error cargando listado de cheques:', error);
                }
            }
        }

        // Si aún no se encontraron y hay listadoChequesGuardadoId, intentar cargar desde Supabase
        if (!chequesEncontrados && conciliacion.listadoChequesGuardadoId && window.supabaseDB) {
            console.log('📋 Intentando cargar cheques desde Supabase...');
            try {
                const { data, error } = await window.supabaseDB
                    .from('listados_cheques')
                    .select('*')
                    .eq('id', conciliacion.listadoChequesGuardadoId)
                    .single();

                if (!error && data && data.cheques) {
                    // Restaurar fechas de los cheques como objetos Date
                    data.cheques.forEach(c => {
                        if (c.fechaRecepcion) c.fechaRecepcion = new Date(c.fechaRecepcion);
                        if (c.fechaEmision) c.fechaEmision = new Date(c.fechaEmision);
                        if (c.fechaDeposito) c.fechaDeposito = new Date(c.fechaDeposito);
                    });

                    stateMayores.listadoChequesCargados = data.cheques;
                    stateMayores.listadoChequesIncorporado = true;
                    stateMayores.listadoChequesGuardadoId = data.id;
                    stateMayores.mesesDisponibles = conciliacion.mesesDisponibles || data.meses || calcularMesesDeCheques(data.cheques);

                    cargarMesesProcesados();

                    console.log(`📋 Cheques cargados desde Supabase: ${data.cheques.length} cheques`);
                    chequesEncontrados = true;
                }
            } catch (error) {
                console.error('Error cargando cheques desde Supabase:', error);
            }
        }

        // Si la conciliación esperaba cheques pero no se encontraron, avisar al usuario
        if (!chequesEncontrados && (conciliacion.listadoChequesIncorporado || conciliacion.listadoChequesGuardadoId || conciliacion.listadoChequesCount > 0)) {
            console.warn('⚠️ No se pudieron cargar los cheques de la conciliación');
            setTimeout(() => {
                const chequeCount = conciliacion.listadoChequesCount || '(desconocido)';
                alert(`⚠️ No se pudieron cargar los cheques de esta conciliación.\n\nCheques esperados: ${chequeCount}\n\nPor favor, recargue el listado de cheques manualmente usando "Importar cheques" antes de continuar.`);
            }, 500);
        }
    }

    // Intentar cargar meses_procesados desde localStorage si no hay vinculaciones (fallback)
    const tieneVinculaciones = Object.values(stateMayores.mesesProcesados || {}).some(m => m.vinculaciones && m.vinculaciones.length > 0);
    if (!tieneVinculaciones && conciliacion.id) {
        try {
            const keyMesesProcesados = `meses_procesados_conciliacion_${conciliacion.id}`;
            const datosMesesProcesados = localStorage.getItem(keyMesesProcesados);
            if (datosMesesProcesados) {
                const mesesCargados = JSON.parse(datosMesesProcesados);
                // Verificar que tiene vinculaciones
                const tieneVinculacionesFallback = Object.values(mesesCargados).some(m => m.vinculaciones && m.vinculaciones.length > 0);
                if (tieneVinculacionesFallback) {
                    // Restaurar mesesProcesados (soporta formato optimizado con IDs)
                    stateMayores.mesesProcesados = restaurarMesesProcesadosDesdeDatos(
                        mesesCargados,
                        stateMayores.listadoChequesCargados
                    );
                    console.log('🔗 Meses procesados (vinculaciones) cargados desde fallback localStorage');
                    const totalVinculaciones = Object.values(stateMayores.mesesProcesados).reduce((sum, m) => sum + (m.vinculaciones?.length || 0), 0);
                    console.log(`   Total vinculaciones restauradas: ${totalVinculaciones}`);
                }
            }
        } catch (error) {
            console.warn('No se pudieron cargar meses procesados desde fallback:', error);
        }
    }

    // Actualizar UI
    actualizarEstadisticasMayor();
    renderizarTablaMayor();
    actualizarContadorEliminados();

    if (stateMayores.tipoMayorActual?.logica === 'vinculacion') {
        renderizarVinculacion();
        actualizarEstadisticasVinculacion();
    }

    // Actualizar UI de cheques si corresponde
    if (stateMayores.tipoMayorActual?.id === 'cheques_terceros_recibidos') {
        actualizarEstadoListadoCheques();
        actualizarResumenListadoCheques();

        // Mostrar panel de conciliación por mes si hay cheques
        const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
        if (panelPaso2Mes && stateMayores.listadoChequesIncorporado) {
            panelPaso2Mes.style.display = 'block';
            renderizarListaMeses();
        }
    }

    document.getElementById('infoMayorCargado').style.display =
        stateMayores.registrosMayor.length > 0 ? 'block' : 'none';

    // Mostrar/ocultar botón de guardar en toolbar
    const btnGuardar = document.getElementById('btnGuardarConciliacion');
    if (btnGuardar) {
        btnGuardar.style.display = stateMayores.registrosMayor.length > 0 ? 'inline-flex' : 'none';
    }

    console.log(`✅ Conciliación "${conciliacion.nombre}" cargada: ${registros.length} registros`);
}

/**
 * Nueva conciliación (cerrar modal y empezar desde cero)
 */
function nuevaConciliacionMayor() {
    cerrarModalConciliacionMayorGuardada();

    // Resetear estado
    stateMayores.registrosMayor = [];
    stateMayores.vinculaciones = [];
    stateMayores.conciliacionCargadaId = null;
    stateMayores.conciliacionCargadaNombre = null;

    // Resetear cheques también
    stateMayores.listadoChequesCargados = [];
    stateMayores.listadoChequesIncorporado = false;
    stateMayores.listadoChequesTemporal = [];
    stateMayores.mesesDisponibles = [];
    stateMayores.mesesProcesados = {};
    stateMayores.mesActualConciliacion = null;
    stateMayores.listadoChequesGuardadoId = null;

    renderizarTablaMayor();
    renderizarVinculacion();

    // Actualizar UI de cheques si corresponde
    if (stateMayores.tipoMayorActual?.id === 'cheques_terceros_recibidos') {
        actualizarEstadoListadoCheques();
        const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
        if (panelPaso2Mes) panelPaso2Mes.style.display = 'none';
    }

    document.getElementById('infoMayorCargado').style.display = 'none';

    // Ocultar botón de guardar en toolbar
    const btnGuardar = document.getElementById('btnGuardarConciliacion');
    if (btnGuardar) btnGuardar.style.display = 'none';

    console.log('📝 Nueva conciliación iniciada');
}

/**
 * Abrir modal de gestión de conciliaciones
 */
async function abrirGestionConciliacionesMayor() {
    // Recargar lista desde Supabase/localStorage
    const conciliaciones = await cargarConciliacionesMayorGuardadas();
    conciliacionesMayorGuardadasLista = conciliaciones || [];

    const overlay = document.getElementById('overlay-gestion-conciliaciones-mayor');
    const modal = document.getElementById('modal-gestion-conciliaciones-mayor');
    const lista = document.getElementById('gestion-conciliaciones-mayor-lista');

    if (conciliacionesMayorGuardadasLista.length === 0) {
        const key = getConciliacionesMayorKey();
        lista.innerHTML = `
            <div class="conciliaciones-vacio">
                <div class="conciliaciones-vacio-icon">📂</div>
                <p>No hay conciliaciones guardadas para este tipo de mayor</p>
                <div style="margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 6px; font-size: 12px; text-align: left;">
                    <strong>Información de búsqueda:</strong><br>
                    <span style="color: #6c757d;">Cliente:</span> ${stateMayores.clienteActual?.nombre || 'No seleccionado'}<br>
                    <span style="color: #6c757d;">Tipo Mayor:</span> ${stateMayores.tipoMayorActual?.nombre || 'No seleccionado'}<br>
                    <span style="color: #6c757d;">Clave:</span> <code style="background: #e9ecef; padding: 2px 4px; border-radius: 3px; font-size: 11px;">${key}</code>
                </div>
                <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">
                    💡 Si guardaste una conciliación previamente, verifica que hayas seleccionado el mismo cliente y tipo de mayor.
                </p>
            </div>
        `;
    } else {
        lista.innerHTML = conciliacionesMayorGuardadasLista.map(conciliacion => {
            const fechaGuardado = new Date(conciliacion.fechaGuardado);
            const fechaFormateada = fechaGuardado.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const registros = conciliacion.registros || [];
            const vinculados = registros.filter(r => r.estado === 'vinculado').length;
            const pendientes = registros.filter(r => r.estado === 'pendiente').length;

            // Detectar período
            const fechas = registros.filter(r => r.fecha).map(r => new Date(r.fecha));
            let periodo = 'N/A';
            if (fechas.length > 0) {
                const minFecha = new Date(Math.min(...fechas));
                const maxFecha = new Date(Math.max(...fechas));
                periodo = `${formatearFecha(minFecha)} - ${formatearFecha(maxFecha)}`;
            }

            const nombre = conciliacion.nombre || `Conciliación ${fechaFormateada}`;
            const esCargada = stateMayores.conciliacionCargadaId === conciliacion.id;

            return `
                <div class="conciliacion-gestion-item ${esCargada ? 'activa' : ''}">
                    <div class="conciliacion-gestion-info">
                        <div class="conciliacion-nombre">
                            ${nombre}
                            ${esCargada ? '<span class="badge-activa">Cargada</span>' : ''}
                        </div>
                        <div class="conciliacion-detalles">
                            <span>📅 ${fechaFormateada}</span>
                            <span>📆 ${periodo}</span>
                            <span>📊 ${registros.length} registros</span>
                            <span>✓ ${vinculados} vinculados</span>
                            <span>⏳ ${pendientes} pendientes</span>
                        </div>
                    </div>
                    <div class="conciliacion-gestion-acciones">
                        <button onclick="cargarConciliacionDesdeGestion('${conciliacion.id}')" class="btn-cargar-conciliacion" title="Cargar">📂 Cargar</button>
                        <button onclick="confirmarEliminarConciliacionMayor('${conciliacion.id}')" class="btn-eliminar-conciliacion" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    overlay.classList.add('active');
    modal.classList.add('active');
}

/**
 * Cargar conciliación desde modal de gestión
 */
function cargarConciliacionDesdeGestion(id) {
    cerrarGestionConciliacionesMayor();
    cargarConciliacionMayorGuardada(id);
}

/**
 * Cerrar modal de gestión de conciliaciones
 */
function cerrarGestionConciliacionesMayor() {
    const overlay = document.getElementById('overlay-gestion-conciliaciones-mayor');
    const modal = document.getElementById('modal-gestion-conciliaciones-mayor');

    overlay.classList.remove('active');
    modal.classList.remove('active');
}

/**
 * Confirmar eliminación de conciliación
 */
function confirmarEliminarConciliacionMayor(id) {
    conciliacionMayorAEliminarId = id;

    const conciliacion = conciliacionesMayorGuardadasLista.find(c => c.id === id);
    if (!conciliacion) return;

    const detalles = document.getElementById('eliminar-conciliacion-mayor-detalles');
    const registros = conciliacion.registros || [];

    detalles.innerHTML = `
        <p><strong>Nombre:</strong> ${conciliacion.nombre || 'Sin nombre'}</p>
        <p><strong>Registros:</strong> ${registros.length}</p>
        <p><strong>Guardada:</strong> ${new Date(conciliacion.fechaGuardado).toLocaleDateString('es-AR')}</p>
    `;

    const overlay = document.getElementById('overlay-confirmar-eliminar-conciliacion-mayor');
    const modal = document.getElementById('modal-confirmar-eliminar-conciliacion-mayor');

    overlay.classList.add('active');
    modal.classList.add('active');
}

/**
 * Cerrar modal de confirmación de eliminación
 */
function cerrarConfirmarEliminarConciliacionMayor() {
    const overlay = document.getElementById('overlay-confirmar-eliminar-conciliacion-mayor');
    const modal = document.getElementById('modal-confirmar-eliminar-conciliacion-mayor');

    overlay.classList.remove('active');
    modal.classList.remove('active');

    conciliacionMayorAEliminarId = null;
}

/**
 * Ejecutar eliminación de conciliación de Supabase (o localStorage)
 */
async function ejecutarEliminarConciliacionMayor() {
    if (!conciliacionMayorAEliminarId) return;

    console.log('🗑️ Eliminando conciliación:', conciliacionMayorAEliminarId);

    try {
        let eliminadoExitoso = false;

        // Intentar eliminar de Supabase primero
        if (window.supabaseDB) {
            const { error } = await window.supabaseDB
                .from('conciliaciones_mayor')
                .delete()
                .eq('id', conciliacionMayorAEliminarId);

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('⚠️ Tabla conciliaciones_mayor no existe, eliminando de localStorage');
                } else {
                    console.error('Error eliminando de Supabase:', error);
                }
            } else {
                eliminadoExitoso = true;
                console.log('✅ Conciliación eliminada de Supabase');
            }
        }

        // También eliminar de localStorage (por si existe copia local)
        const key = getConciliacionesMayorKey();
        try {
            const datosGuardados = localStorage.getItem(key);
            if (datosGuardados) {
                const conciliaciones = JSON.parse(datosGuardados);
                const conciliacionesFiltradas = conciliaciones.filter(c => c.id !== conciliacionMayorAEliminarId);
                localStorage.setItem(key, JSON.stringify(conciliacionesFiltradas));
            }
        } catch (e) {
            console.error('Error eliminando de localStorage:', e);
        }

        // Actualizar lista en memoria
        conciliacionesMayorGuardadasLista = conciliacionesMayorGuardadasLista.filter(
            c => c.id !== conciliacionMayorAEliminarId
        );

        // Si la conciliación eliminada estaba cargada, limpiar
        if (stateMayores.conciliacionCargadaId === conciliacionMayorAEliminarId) {
            stateMayores.registrosMayor = [];
            stateMayores.vinculaciones = [];
            stateMayores.conciliacionCargadaId = null;
            stateMayores.conciliacionCargadaNombre = null;

            renderizarTablaMayor();
            renderizarVinculacion();
            document.getElementById('infoMayorCargado').style.display = 'none';

            // Ocultar botón de guardar en toolbar
            const btnGuardar = document.getElementById('btnGuardarConciliacion');
            if (btnGuardar) btnGuardar.style.display = 'none';
        }

        cerrarConfirmarEliminarConciliacionMayor();

        // Actualizar botón y refrescar modal de gestión si está abierto
        actualizarBotonGestionConciliacionesMayor();

        // Refrescar modal de gestión
        const modalGestion = document.getElementById('modal-gestion-conciliaciones-mayor');
        if (modalGestion.classList.contains('active')) {
            await abrirGestionConciliacionesMayor();
        }

        console.log('🗑️ Conciliación eliminada correctamente');

    } catch (error) {
        console.error('Error eliminando conciliación:', error);
        alert('Error al eliminar: ' + error.message);
    }
}

/**
 * Mostrar modal para guardar conciliación con nombre
 */
function mostrarModalGuardarConciliacionMayor() {
    if (!stateMayores.clienteActual || !stateMayores.tipoMayorActual) {
        alert('Debe seleccionar un cliente y tipo de mayor');
        return;
    }

    if (stateMayores.registrosMayor.length === 0) {
        alert('No hay datos para guardar. Primero cargue un mayor.');
        return;
    }

    const overlay = document.getElementById('overlay-guardar-conciliacion-mayor');
    const modal = document.getElementById('modal-guardar-conciliacion-mayor');
    const inputNombre = document.getElementById('nombreConciliacionMayor');

    // Pre-llenar con nombre existente o sugerir uno nuevo
    if (stateMayores.conciliacionCargadaNombre) {
        inputNombre.value = stateMayores.conciliacionCargadaNombre;
    } else {
        const fechaHoy = new Date().toLocaleDateString('es-AR');
        inputNombre.value = `Conciliación ${stateMayores.tipoMayorActual.nombre} - ${fechaHoy}`;
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNombre.focus();
    inputNombre.select();
}

/**
 * Cerrar modal de guardar conciliación
 */
function cerrarModalGuardarConciliacionMayor() {
    const overlay = document.getElementById('overlay-guardar-conciliacion-mayor');
    const modal = document.getElementById('modal-guardar-conciliacion-mayor');

    overlay.classList.remove('active');
    modal.classList.remove('active');
}

/**
 * Optimizar mesesProcesados para guardado - reemplaza objetos de cheques por solo IDs
 * Esto reduce significativamente el tamaño del payload (de MB a KB)
 */
function optimizarMesesProcesadosParaGuardado(mesesProcesados) {
    if (!mesesProcesados || Object.keys(mesesProcesados).length === 0) {
        return {};
    }

    const mesesOptimizados = {};

    for (const [mesKey, estadoMes] of Object.entries(mesesProcesados)) {
        mesesOptimizados[mesKey] = {
            procesado: estadoMes.procesado || false,
            completo: estadoMes.completo || false,
            fechaProcesado: estadoMes.fechaProcesado || null,
            // Guardar solo IDs de cheques del mes (no objetos completos)
            chequesDelMesIds: (estadoMes.chequesDelMes || []).map(c => c.id || c.interno),
            // Guardar solo IDs de cheques no asociados
            chequesNoAsociadosDelMesIds: (estadoMes.chequesNoAsociadosDelMes || []).map(c => c.id || c.interno),
            // Guardar asientos con solo IDs de cheques asociados (no objetos completos)
            asientosDelMes: (estadoMes.asientosDelMes || []).map(asiento => ({
                id: asiento.id,
                fecha: asiento.fecha,
                asiento: asiento.asiento,
                descripcion: asiento.descripcion,
                debe: asiento.debe,
                haber: asiento.haber,
                estadoCheques: asiento.estadoCheques,
                // Solo guardar IDs de cheques asociados
                chequesAsociadosIds: (asiento.chequesAsociados || []).map(c => c.id || c.interno)
            })),
            // Mantener vinculaciones si existen (estas ya son referencias)
            vinculaciones: estadoMes.vinculaciones || []
        };
    }

    return mesesOptimizados;
}

/**
 * Restaurar mesesProcesados desde datos optimizados - reconstruye objetos de cheques desde IDs
 */
function restaurarMesesProcesadosDesdeDatos(mesesOptimizados, listadoCheques) {
    if (!mesesOptimizados || Object.keys(mesesOptimizados).length === 0) {
        return {};
    }

    // Crear mapa de cheques por ID para búsqueda rápida
    const chequesMap = new Map();
    (listadoCheques || []).forEach(cheque => {
        const id = cheque.id || cheque.interno;
        if (id) {
            chequesMap.set(id, cheque);
        }
    });

    const mesesRestaurados = {};

    for (const [mesKey, estadoMes] of Object.entries(mesesOptimizados)) {
        // Verificar si ya tiene formato antiguo (con objetos completos)
        const tieneFormatoAntiguo = estadoMes.chequesDelMes &&
            estadoMes.chequesDelMes.length > 0 &&
            typeof estadoMes.chequesDelMes[0] === 'object' &&
            estadoMes.chequesDelMes[0].importe !== undefined;

        if (tieneFormatoAntiguo) {
            // Ya tiene formato antiguo, usar directamente
            mesesRestaurados[mesKey] = estadoMes;
            continue;
        }

        // Reconstruir cheques del mes desde IDs
        const chequesDelMes = (estadoMes.chequesDelMesIds || [])
            .map(id => chequesMap.get(id))
            .filter(c => c !== undefined);

        // Reconstruir cheques no asociados desde IDs
        const chequesNoAsociadosDelMes = (estadoMes.chequesNoAsociadosDelMesIds || [])
            .map(id => chequesMap.get(id))
            .filter(c => c !== undefined);

        // Reconstruir asientos con cheques asociados
        const asientosDelMes = (estadoMes.asientosDelMes || []).map(asiento => ({
            ...asiento,
            // Reconstruir cheques asociados desde IDs
            chequesAsociados: (asiento.chequesAsociadosIds || [])
                .map(id => chequesMap.get(id))
                .filter(c => c !== undefined)
        }));

        mesesRestaurados[mesKey] = {
            procesado: estadoMes.procesado || false,
            completo: estadoMes.completo || false,
            fechaProcesado: estadoMes.fechaProcesado || null,
            chequesDelMes,
            chequesNoAsociadosDelMes,
            asientosDelMes,
            vinculaciones: estadoMes.vinculaciones || []
        };
    }

    return mesesRestaurados;
}

/**
 * Ejecutar guardado de conciliación en Supabase (o localStorage como fallback)
 */
async function ejecutarGuardarConciliacionMayor() {
    const inputNombre = document.getElementById('nombreConciliacionMayor');
    const nombre = inputNombre.value.trim();

    if (!nombre) {
        alert('Por favor ingrese un nombre para la conciliación');
        inputNombre.focus();
        return;
    }

    const clienteId = stateMayores.clienteActual?.id;
    const tipoMayorId = stateMayores.tipoMayorActual?.id;

    if (!clienteId || !tipoMayorId) {
        alert('Error: No hay cliente o tipo de mayor seleccionado');
        return;
    }

    console.log('💾 Guardando conciliación en Supabase...');
    console.log(`📋 Cheques a guardar: ${(stateMayores.listadoChequesCargados || []).length}`);

    // Si hay muchos cheques y no hay listadoChequesGuardadoId, guardar el listado primero en Supabase
    const chequesCount = (stateMayores.listadoChequesCargados || []).length;
    if (chequesCount > 500 && !stateMayores.listadoChequesGuardadoId && window.supabaseDB) {
        console.log('📋 Guardando listado de cheques en Supabase primero (son muchos para localStorage)...');
        try {
            const listadoId = `listado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const datosListado = {
                id: listadoId,
                cliente_id: clienteId,
                fecha_guardado: new Date().toISOString(),
                cheques: stateMayores.listadoChequesCargados,
                total_cheques: chequesCount,
                total_importe: stateMayores.listadoChequesCargados.reduce((sum, c) => sum + (c.importe || 0), 0),
                meses: stateMayores.mesesDisponibles || []
            };

            const { data: listadoData, error: listadoError } = await window.supabaseDB
                .from('listados_cheques')
                .upsert(datosListado, { onConflict: 'id' })
                .select();

            // Verificar que realmente se guardó (data no vacío y sin error)
            if (!listadoError && listadoData && listadoData.length > 0) {
                stateMayores.listadoChequesGuardadoId = listadoId;
                console.log('✅ Listado de cheques guardado en Supabase:', listadoId);
            } else {
                // La tabla no existe o hubo error - NO establecer listadoChequesGuardadoId
                if (listadoError) {
                    console.warn('⚠️ No se pudo guardar listado en Supabase (tabla no existe o error):', listadoError.message || listadoError);
                } else {
                    console.warn('⚠️ Guardado en listados_cheques no confirmado, continuando sin él');
                }
            }
        } catch (error) {
            console.warn('⚠️ Error guardando listado de cheques en Supabase:', error);
        }
    }

    // Crear o actualizar conciliación
    const ahora = new Date().toISOString();

    // Preparar datos mínimos de cheques (solo referencia, no los datos completos)
    const mesesProcesadosResumen = Object.keys(stateMayores.mesesProcesados || {}).reduce((acc, mes) => {
        const mesDatos = stateMayores.mesesProcesados[mes];
        acc[mes] = {
            procesado: mesDatos.procesado || false,
            totalAsociados: (mesDatos.vinculaciones || []).length,
            fechaProcesado: mesDatos.fechaProcesado || null
        };
        return acc;
    }, {});

    // Preparar el registro para Supabase
    const conciliacionId = stateMayores.conciliacionCargadaId || `conc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const esNueva = !stateMayores.conciliacionCargadaId;

    // Optimizar mesesProcesados para guardado (solo IDs en lugar de objetos completos)
    const mesesProcesadosOptimizados = optimizarMesesProcesadosParaGuardado(stateMayores.mesesProcesados);

    // Log de optimización para depuración
    const tamanoOriginal = JSON.stringify(stateMayores.mesesProcesados || {}).length;
    const tamanoOptimizado = JSON.stringify(mesesProcesadosOptimizados).length;
    console.log(`📊 Optimización mesesProcesados: ${(tamanoOriginal / 1024).toFixed(1)}KB → ${(tamanoOptimizado / 1024).toFixed(1)}KB (${((1 - tamanoOptimizado / tamanoOriginal) * 100).toFixed(0)}% reducción)`);

    const registro = {
        id: conciliacionId,
        cliente_id: clienteId,
        tipo_mayor_id: tipoMayorId,
        nombre: nombre,
        registros: stateMayores.registrosMayor || [],
        vinculaciones: stateMayores.vinculaciones || [],
        movimientos_eliminados: stateMayores.movimientosEliminados || [],
        listado_cheques_guardado_id: stateMayores.listadoChequesGuardadoId || null,
        listado_cheques_incorporado: stateMayores.listadoChequesIncorporado || false,
        listado_cheques_cargados: stateMayores.listadoChequesCargados || [],
        meses_disponibles: stateMayores.mesesDisponibles || [],
        meses_procesados: mesesProcesadosOptimizados,
        meses_procesados_resumen: mesesProcesadosResumen,
        fecha_guardado: esNueva ? ahora : undefined,
        fecha_modificado: ahora
    };

    // Remover fecha_guardado si es actualización (no queremos sobrescribirla)
    if (!esNueva) {
        delete registro.fecha_guardado;
    }

    try {
        let guardadoExitoso = false;

        // Intentar guardar en Supabase primero
        if (window.supabaseDB) {
            let { error } = await window.supabaseDB
                .from('conciliaciones_mayor')
                .upsert(registro, { onConflict: 'id' });

            // Si falla por columnas faltantes, intentar sin las nuevas columnas
            if (error && error.message && error.message.includes('Could not find')) {
                console.warn('⚠️ Columnas nuevas no existen en Supabase, guardando sin ellas...');
                // Crear registro sin las columnas nuevas
                const registroBasico = {
                    id: registro.id,
                    cliente_id: registro.cliente_id,
                    tipo_mayor_id: registro.tipo_mayor_id,
                    nombre: registro.nombre,
                    registros: registro.registros,
                    vinculaciones: registro.vinculaciones,
                    listado_cheques_guardado_id: registro.listado_cheques_guardado_id,
                    listado_cheques_incorporado: registro.listado_cheques_incorporado,
                    meses_disponibles: registro.meses_disponibles,
                    meses_procesados_resumen: registro.meses_procesados_resumen,
                    fecha_guardado: registro.fecha_guardado,
                    fecha_modificado: registro.fecha_modificado
                };
                if (!esNueva) delete registroBasico.fecha_guardado;

                const resultado = await window.supabaseDB
                    .from('conciliaciones_mayor')
                    .upsert(registroBasico, { onConflict: 'id' });
                error = resultado.error;

                if (!error) {
                    // Guardar cheques en localStorage como fallback SOLO si no hay listadoChequesGuardadoId
                    // Si ya existe listadoChequesGuardadoId, los cheques ya están guardados en Supabase
                    if ((stateMayores.listadoChequesCargados || []).length > 0 && !stateMayores.listadoChequesGuardadoId) {
                        const keyListado = `listado_cheques_conciliacion_${registro.id}`;
                        let chequesGuardados = false;

                        try {
                            localStorage.setItem(keyListado, JSON.stringify({
                                cheques: stateMayores.listadoChequesCargados,
                                mesesProcesados: mesesProcesadosOptimizados // Usar versión optimizada
                            }));
                            console.log('📋 Cheques guardados en localStorage como fallback');
                            chequesGuardados = true;
                        } catch (storageError) {
                            if (storageError.name === 'QuotaExceededError') {
                                console.warn('⚠️ localStorage lleno, intentando guardar en listado del cliente...');

                                // Intentar guardar en el listado general del cliente
                                const keyListadoCliente = getListadoChequesKey();
                                if (keyListadoCliente) {
                                    try {
                                        const datosListadoCliente = {
                                            id: `listado_${Date.now()}`,
                                            fechaGuardado: new Date().toISOString(),
                                            cheques: stateMayores.listadoChequesCargados,
                                            totalCheques: stateMayores.listadoChequesCargados.length,
                                            totalImporte: stateMayores.listadoChequesCargados.reduce((sum, c) => sum + (c.importe || 0), 0),
                                            meses: stateMayores.mesesDisponibles || []
                                        };
                                        localStorage.setItem(keyListadoCliente, JSON.stringify(datosListadoCliente));
                                        stateMayores.listadoChequesGuardadoId = datosListadoCliente.id;
                                        console.log('📋 Cheques guardados en listado del cliente');
                                        chequesGuardados = true;
                                    } catch (e2) {
                                        console.error('❌ No se pudieron guardar los cheques - localStorage lleno');
                                    }
                                }

                                if (!chequesGuardados) {
                                    // Guardar solo referencia como último recurso
                                    try {
                                        localStorage.setItem(keyListado, JSON.stringify({
                                            chequesCount: stateMayores.listadoChequesCargados.length,
                                            mesesProcesadosResumen: Object.keys(stateMayores.mesesProcesados || {}).reduce((acc, mes) => {
                                                acc[mes] = { procesado: stateMayores.mesesProcesados[mes]?.procesado || false };
                                                return acc;
                                            }, {}),
                                            referencia: 'cheques_no_guardados_localStorage_lleno'
                                        }));
                                        console.warn('⚠️ Solo se guardó referencia - los cheques deberán recargarse manualmente');
                                        // Mostrar advertencia al usuario
                                        setTimeout(() => {
                                            alert('⚠️ Advertencia: Los cheques no se pudieron guardar por falta de espacio.\n\nLa conciliación se guardó pero deberá recargar el listado de cheques al abrir esta conciliación.\n\nRecomendación: Contacte al administrador para habilitar el almacenamiento en Supabase.');
                                        }, 500);
                                    } catch (e) {
                                        console.warn('⚠️ No se pudo guardar ni la referencia mínima en localStorage');
                                    }
                                }
                            } else {
                                console.error('Error guardando cheques en localStorage:', storageError);
                            }
                        }
                    } else if (stateMayores.listadoChequesGuardadoId) {
                        console.log('📋 Cheques ya referenciados por listadoChequesGuardadoId, no se duplican en localStorage');
                    }
                    // Guardar movimientos eliminados en localStorage como fallback
                    if ((stateMayores.movimientosEliminados || []).length > 0) {
                        const keyEliminados = `movimientos_eliminados_conciliacion_${registro.id}`;
                        try {
                            localStorage.setItem(keyEliminados, JSON.stringify(stateMayores.movimientosEliminados));
                            console.log('🗑️ Movimientos eliminados guardados en localStorage como fallback');
                        } catch (storageError) {
                            if (storageError.name === 'QuotaExceededError') {
                                console.warn('⚠️ localStorage lleno, no se pudieron guardar movimientos eliminados');
                            } else {
                                console.error('Error guardando movimientos eliminados:', storageError);
                            }
                        }
                    }
                    // Guardar meses_procesados en localStorage como fallback (contiene las vinculaciones)
                    if (Object.keys(stateMayores.mesesProcesados || {}).length > 0) {
                        const keyMesesProcesados = `meses_procesados_conciliacion_${registro.id}`;
                        try {
                            // Usar versión optimizada (ya calculada arriba)
                            localStorage.setItem(keyMesesProcesados, JSON.stringify(mesesProcesadosOptimizados));
                            console.log('🔗 Meses procesados (vinculaciones) guardados en localStorage como fallback (optimizado)');
                        } catch (storageError) {
                            if (storageError.name === 'QuotaExceededError') {
                                console.warn('⚠️ localStorage lleno, no se pudieron guardar meses procesados');
                            } else {
                                console.error('Error guardando meses procesados:', storageError);
                            }
                        }
                    }
                }
            }

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('⚠️ Tabla conciliaciones_mayor no existe, usando localStorage');
                } else {
                    console.error('Error guardando en Supabase:', error);
                    throw error;
                }
            } else {
                guardadoExitoso = true;
                console.log('✅ Conciliación guardada en Supabase:', nombre);
            }
        }

        // Fallback a localStorage si Supabase no funcionó
        if (!guardadoExitoso) {
            const key = getConciliacionesMayorKey();
            let conciliaciones = [];

            try {
                const datosGuardados = localStorage.getItem(key);
                if (datosGuardados) {
                    conciliaciones = JSON.parse(datosGuardados);
                }
            } catch (e) {
                conciliaciones = [];
            }

            // Si hay listadoChequesGuardadoId, no duplicar los cheques en localStorage
            // Los cheques ya están guardados en el listado del cliente en Supabase
            const tieneReferenciaACheques = !!stateMayores.listadoChequesGuardadoId;

            const conciliacionLocal = {
                id: conciliacionId,
                nombre: nombre,
                registros: stateMayores.registrosMayor || [],
                vinculaciones: stateMayores.vinculaciones || [],
                movimientosEliminados: stateMayores.movimientosEliminados || [],
                listadoChequesGuardadoId: stateMayores.listadoChequesGuardadoId || null,
                listadoChequesIncorporado: stateMayores.listadoChequesIncorporado || false,
                // Solo incluir cheques completos si no hay referencia a listado guardado
                listadoChequesCargados: tieneReferenciaACheques ? [] : (stateMayores.listadoChequesCargados || []),
                listadoChequesCount: (stateMayores.listadoChequesCargados || []).length, // Mantener el conteo
                mesesDisponibles: stateMayores.mesesDisponibles || [],
                mesesProcesados: mesesProcesadosOptimizados, // Usar versión optimizada
                mesesProcesadosResumen: mesesProcesadosResumen,
                fechaGuardado: esNueva ? ahora : (conciliaciones.find(c => c.id === conciliacionId)?.fechaGuardado || ahora),
                fechaModificado: ahora
            };

            if (esNueva) {
                conciliaciones.push(conciliacionLocal);
            } else {
                const index = conciliaciones.findIndex(c => c.id === conciliacionId);
                if (index !== -1) {
                    conciliaciones[index] = conciliacionLocal;
                } else {
                    conciliaciones.push(conciliacionLocal);
                }
            }

            try {
                localStorage.setItem(key, JSON.stringify(conciliaciones));
                console.log('💾 Conciliación guardada en localStorage:', nombre);
            } catch (storageError) {
                if (storageError.name === 'QuotaExceededError') {
                    console.warn('⚠️ localStorage lleno, intentando guardar versión compacta...');
                    // Intentar guardar sin cheques ni registros pesados
                    conciliacionLocal.listadoChequesCargados = [];
                    conciliacionLocal.registros = [];
                    conciliacionLocal.mesesProcesados = mesesProcesadosResumen; // Solo resumen

                    if (esNueva) {
                        conciliaciones[conciliaciones.length - 1] = conciliacionLocal;
                    } else {
                        const index = conciliaciones.findIndex(c => c.id === conciliacionId);
                        if (index !== -1) conciliaciones[index] = conciliacionLocal;
                    }

                    try {
                        localStorage.setItem(key, JSON.stringify(conciliaciones));
                        console.log('💾 Conciliación guardada en localStorage (versión compacta):', nombre);
                        console.warn('⚠️ Algunos datos no se guardaron por falta de espacio. Los cheques deben recargarse desde Supabase.');
                    } catch (e) {
                        console.error('❌ No se pudo guardar en localStorage, incluso con versión compacta');
                        throw new Error('No hay espacio suficiente en localStorage para guardar la conciliación. Por favor, libere espacio o contacte al administrador para activar Supabase.');
                    }
                } else {
                    throw storageError;
                }
            }
        }

        // Actualizar estado local
        stateMayores.conciliacionCargadaId = conciliacionId;
        stateMayores.conciliacionCargadaNombre = nombre;

        // Recargar lista de conciliaciones
        conciliacionesMayorGuardadasLista = await cargarConciliacionesMayorGuardadas();

        // Guardar meses procesados por separado si hay datos
        if (Object.keys(stateMayores.mesesProcesados || {}).length > 0) {
            await guardarMesesProcesadosSupabase();
        }

        // Actualizar botón
        actualizarBotonGestionConciliacionesMayor();

        cerrarModalGuardarConciliacionMayor();
        mostrarNotificacion('Conciliación guardada correctamente', 'success');

    } catch (error) {
        console.error('Error guardando conciliación:', error);
        alert('Error al guardar: ' + error.message);
    }
}

/**
 * Guardar meses procesados en Supabase
 */
async function guardarMesesProcesadosSupabase() {
    if (!window.supabaseDB || !stateMayores.clienteActual) {
        // Fallback a localStorage
        guardarMesesProcesados();
        return;
    }

    try {
        // Optimizar antes de guardar (solo IDs en lugar de objetos completos)
        const mesesOptimizados = optimizarMesesProcesadosParaGuardado(stateMayores.mesesProcesados);

        const { error } = await window.supabaseDB
            .from('meses_procesados')
            .upsert({
                cliente_id: stateMayores.clienteActual.id,
                datos: mesesOptimizados,
                updated_at: new Date().toISOString()
            }, { onConflict: 'cliente_id' });

        if (error) {
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                console.warn('⚠️ Tabla meses_procesados no existe, usando localStorage');
                guardarMesesProcesados();
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error guardando meses procesados en Supabase:', error);
        guardarMesesProcesados();
    }
}

/**
 * Función legacy para compatibilidad - redirige al nuevo modal
 */
async function guardarVinculaciones() {
    mostrarModalGuardarConciliacionMayor();
}

/**
 * Exportar análisis del mayor con separación de vinculaciones
 */
function exportarAnalisisMayor() {
    if (stateMayores.registrosMayor.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    const config = obtenerConfigVinculacion();
    const wb = XLSX.utils.book_new();

    // Agrupar registros por vinculación
    const gruposVinculacion = agruparRegistrosPorVinculacion();

    // Clasificar vinculaciones: totales vs parciales
    const vinculacionesTotales = [];
    const vinculacionesParciales = [];
    const registrosSinVincular = [];

    // Procesar grupo sin vinculación
    if (gruposVinculacion['sin_vincular']) {
        gruposVinculacion['sin_vincular'].forEach(r => {
            registrosSinVincular.push(r);
        });
        delete gruposVinculacion['sin_vincular'];
    }

    // Clasificar cada vinculación
    for (const [vinculacionId, registros] of Object.entries(gruposVinculacion)) {
        const analisis = analizarVinculacion(registros);

        if (Math.abs(analisis.diferencia) <= 1) {
            // Vinculación total (diferencia despreciable)
            vinculacionesTotales.push({
                vinculacionId,
                registros,
                ...analisis
            });
        } else {
            // Vinculación parcial (tiene diferencia)
            vinculacionesParciales.push({
                vinculacionId,
                registros,
                ...analisis
            });
        }
    }

    // ===== HOJA 1: RESUMEN Y COMPOSICIÓN DEL SALDO =====
    const resumenData = generarResumenComposicionSaldo(
        vinculacionesTotales,
        vinculacionesParciales,
        registrosSinVincular,
        config
    );
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // ===== HOJA 2: VINCULACIONES TOTALES =====
    const datosVinculacionesTotales = generarDatosVinculaciones(
        vinculacionesTotales,
        'total',
        config
    );
    if (datosVinculacionesTotales.length > 1) {
        const wsVincTotales = XLSX.utils.aoa_to_sheet(datosVinculacionesTotales);
        XLSX.utils.book_append_sheet(wb, wsVincTotales, 'Vinculaciones Totales');
    }

    // ===== HOJA 3: VINCULACIONES PARCIALES =====
    const datosVinculacionesParciales = generarDatosVinculaciones(
        vinculacionesParciales,
        'parcial',
        config
    );
    if (datosVinculacionesParciales.length > 1) {
        const wsVincParciales = XLSX.utils.aoa_to_sheet(datosVinculacionesParciales);
        XLSX.utils.book_append_sheet(wb, wsVincParciales, 'Vinculaciones Parciales');
    }

    // ===== HOJA 4: PENDIENTES (SIN VINCULAR) =====
    const datosSinVincular = generarDatosSinVincular(registrosSinVincular, config);
    if (datosSinVincular.length > 1) {
        const wsSinVincular = XLSX.utils.aoa_to_sheet(datosSinVincular);
        XLSX.utils.book_append_sheet(wb, wsSinVincular, 'Pendientes');
    }

    // ===== HOJA 5: COMPOSICIÓN DEL SALDO CONTABLE =====
    const datosComposicionSaldo = generarDatosComposicionSaldoContable(
        vinculacionesParciales,
        registrosSinVincular,
        config
    );
    const wsComposicionSaldo = XLSX.utils.aoa_to_sheet(datosComposicionSaldo);
    XLSX.utils.book_append_sheet(wb, wsComposicionSaldo, 'Composición Saldo');

    // ===== HOJA 6: DETALLE COMPLETO (TODOS LOS REGISTROS) =====
    const registrosCompletos = stateMayores.registrosMayor.map(r => ({
        'Fecha': formatearFecha(r.fecha),
        'Asiento': r.asiento,
        'Descripción': r.descripcion,
        'Debe': r.debe || '',
        'Haber': r.haber || '',
        'Estado': obtenerEtiquetaEstado(r.estado),
        'Es Devolución': r.esDevolucion ? 'Sí' : 'No',
        'ID Vinculación': r.vinculacionId || '-',
        'Vinculado Con': r.vinculadoCon?.length || 0
    }));
    const wsCompleto = XLSX.utils.json_to_sheet(registrosCompletos);
    XLSX.utils.book_append_sheet(wb, wsCompleto, 'Detalle Completo');

    const nombreArchivo = `Mayor_${stateMayores.tipoMayorActual?.nombre || 'Analisis'}_${stateMayores.clienteActual?.nombre || 'Cliente'}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Agrupar registros por su ID de vinculación
 */
function agruparRegistrosPorVinculacion() {
    const grupos = {};

    stateMayores.registrosMayor.forEach(r => {
        const key = r.vinculacionId || 'sin_vincular';
        if (!grupos[key]) {
            grupos[key] = [];
        }
        grupos[key].push(r);
    });

    return grupos;
}

/**
 * Analizar una vinculación y calcular totales y diferencia
 */
function analizarVinculacion(registros) {
    const config = obtenerConfigVinculacion();

    let totalOrigen = 0;
    let totalDestino = 0;
    const registrosOrigen = [];
    const registrosDestino = [];

    registros.forEach(r => {
        if (esRegistroOrigen(r)) {
            totalOrigen += obtenerMontoOrigen(r);
            registrosOrigen.push(r);
        } else {
            totalDestino += obtenerMontoDestino(r);
            registrosDestino.push(r);
        }
    });

    return {
        totalOrigen,
        totalDestino,
        diferencia: totalOrigen - totalDestino,
        cantidadOrigen: registrosOrigen.length,
        cantidadDestino: registrosDestino.length,
        registrosOrigen,
        registrosDestino
    };
}

/**
 * Generar datos para la hoja de resumen y composición del saldo
 */
function generarResumenComposicionSaldo(vincTotales, vincParciales, sinVincular, config) {
    const datos = [];

    // Calcular totales de registros sin vincular
    let totalOrigenSinVincular = 0;
    let totalDestinoSinVincular = 0;
    sinVincular.forEach(r => {
        if (esRegistroOrigen(r)) {
            totalOrigenSinVincular += obtenerMontoOrigen(r);
        } else {
            totalDestinoSinVincular += obtenerMontoDestino(r);
        }
    });

    // Calcular diferencias de vinculaciones parciales
    let sumaDiferenciasParciales = 0;
    vincParciales.forEach(v => {
        sumaDiferenciasParciales += v.diferencia;
    });

    // Calcular saldo total del mayor
    const totalDebe = stateMayores.registrosMayor.reduce((sum, r) => sum + (r.debe || 0), 0);
    const totalHaber = stateMayores.registrosMayor.reduce((sum, r) => sum + (r.haber || 0), 0);
    const saldoMayor = totalDebe - totalHaber;

    // Encabezado
    datos.push(['ANÁLISIS DE MAYOR - RESUMEN Y COMPOSICIÓN DEL SALDO']);
    datos.push([`Tipo de Mayor: ${stateMayores.tipoMayorActual?.nombre || 'N/A'}`]);
    datos.push([`Cliente: ${stateMayores.clienteActual?.nombre || 'N/A'}`]);
    datos.push([`Fecha de exportación: ${new Date().toLocaleDateString('es-AR')}`]);
    datos.push([]);

    // Resumen general
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['RESUMEN GENERAL']);
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['Concepto', 'Cantidad', 'Total Debe', 'Total Haber']);
    datos.push([
        'Total registros',
        stateMayores.registrosMayor.length,
        formatearMonedaExcel(totalDebe),
        formatearMonedaExcel(totalHaber)
    ]);
    datos.push(['Saldo del Mayor (Debe - Haber)', '', '', formatearMonedaExcel(saldoMayor)]);
    datos.push([]);

    // Resumen de vinculaciones
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['RESUMEN DE VINCULACIONES']);
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['Tipo', 'Cantidad Vinculaciones', 'Registros Involucrados', 'Diferencia Acumulada']);

    const regVincTotales = vincTotales.reduce((sum, v) => sum + v.registros.length, 0);
    const regVincParciales = vincParciales.reduce((sum, v) => sum + v.registros.length, 0);

    datos.push([
        'Vinculaciones Totales (sin diferencia)',
        vincTotales.length,
        regVincTotales,
        formatearMonedaExcel(0)
    ]);
    datos.push([
        'Vinculaciones Parciales (con diferencia)',
        vincParciales.length,
        regVincParciales,
        formatearMonedaExcel(sumaDiferenciasParciales)
    ]);
    datos.push([
        'Registros sin vincular',
        '-',
        sinVincular.length,
        '-'
    ]);
    datos.push([]);

    // Composición del saldo
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['COMPOSICIÓN DEL SALDO DEL MAYOR']);
    datos.push(['═══════════════════════════════════════════════════════']);
    datos.push(['Los elementos vinculados totalmente no afectan el saldo.']);
    datos.push(['El saldo se compone de:']);
    datos.push([]);
    datos.push(['Concepto', '', 'Importe']);
    datos.push([]);

    // Pendientes sin vincular
    datos.push([`${config.etiquetaOrigen} sin vincular (pendientes)`, '', formatearMonedaExcel(totalOrigenSinVincular)]);
    datos.push([`${config.etiquetaDestino} sin vincular (pendientes)`, '', formatearMonedaExcel(-totalDestinoSinVincular)]);
    datos.push(['Subtotal pendientes sin vincular', '', formatearMonedaExcel(totalOrigenSinVincular - totalDestinoSinVincular)]);
    datos.push([]);

    // Diferencias de vinculaciones parciales
    datos.push(['Diferencias de vinculaciones parciales:', '', formatearMonedaExcel(sumaDiferenciasParciales)]);

    // Detalle de diferencias parciales si hay
    if (vincParciales.length > 0) {
        vincParciales.forEach((v, idx) => {
            const descripcionOrigen = v.registrosOrigen[0]?.descripcion?.substring(0, 40) || 'N/A';
            datos.push([
                `  - Vinculación ${idx + 1}: ${descripcionOrigen}...`,
                '',
                formatearMonedaExcel(v.diferencia)
            ]);
        });
    }
    datos.push([]);

    // Total composición
    const saldoCalculado = (totalOrigenSinVincular - totalDestinoSinVincular) + sumaDiferenciasParciales;
    datos.push(['───────────────────────────────────────────────────────']);
    datos.push(['TOTAL COMPOSICIÓN DEL SALDO', '', formatearMonedaExcel(saldoCalculado)]);
    datos.push(['Saldo según mayor contable', '', formatearMonedaExcel(saldoMayor)]);

    const diferenciaConciliacion = Math.abs(saldoCalculado - saldoMayor);
    if (diferenciaConciliacion <= 1) {
        datos.push(['Estado', '', 'CONCILIADO ✓']);
    } else {
        datos.push(['Diferencia de conciliación', '', formatearMonedaExcel(saldoCalculado - saldoMayor)]);
    }

    return datos;
}

/**
 * Generar datos para hojas de vinculaciones (totales o parciales)
 */
function generarDatosVinculaciones(vinculaciones, tipo, config) {
    const datos = [];

    // Encabezado
    const titulo = tipo === 'total'
        ? 'VINCULACIONES TOTALES (SIN DIFERENCIA)'
        : 'VINCULACIONES PARCIALES (CON DIFERENCIA)';
    datos.push([titulo]);
    datos.push([]);

    if (vinculaciones.length === 0) {
        datos.push(['No hay vinculaciones de este tipo']);
        return datos;
    }

    // Procesar cada vinculación
    vinculaciones.forEach((vinc, idx) => {
        datos.push(['═══════════════════════════════════════════════════════']);
        datos.push([`VINCULACIÓN #${idx + 1}`]);
        datos.push([`ID: ${vinc.vinculacionId}`]);
        datos.push([`Total ${config.etiquetaOrigen}: ${formatearMonedaExcel(vinc.totalOrigen)}`]);
        datos.push([`Total ${config.etiquetaDestino}: ${formatearMonedaExcel(vinc.totalDestino)}`]);
        datos.push([`Diferencia: ${formatearMonedaExcel(vinc.diferencia)}`]);
        datos.push([]);

        // Encabezados de columnas
        datos.push(['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Tipo']);

        // Primero los orígenes
        vinc.registrosOrigen.forEach(r => {
            datos.push([
                formatearFecha(r.fecha),
                r.asiento,
                r.descripcion,
                r.debe || '',
                r.haber || '',
                config.etiquetaSingularOrigen.toUpperCase()
            ]);
        });

        // Luego los destinos
        vinc.registrosDestino.forEach(r => {
            datos.push([
                formatearFecha(r.fecha),
                r.asiento,
                r.descripcion,
                r.debe || '',
                r.haber || '',
                config.etiquetaSingularDestino.toUpperCase()
            ]);
        });

        datos.push([]);
    });

    return datos;
}

/**
 * Generar datos para hoja de registros sin vincular
 */
function generarDatosSinVincular(registros, config) {
    const datos = [];

    datos.push(['REGISTROS PENDIENTES (SIN VINCULAR)']);
    datos.push(['Estos registros componen parte del saldo del mayor']);
    datos.push([]);

    if (registros.length === 0) {
        datos.push(['No hay registros pendientes de vincular']);
        return datos;
    }

    // Separar por tipo
    const origenes = registros.filter(r => esRegistroOrigen(r));
    const destinos = registros.filter(r => !esRegistroOrigen(r));

    // Orígenes pendientes
    if (origenes.length > 0) {
        datos.push(['═══════════════════════════════════════════════════════']);
        datos.push([`${config.etiquetaOrigen.toUpperCase()} PENDIENTES`]);
        datos.push(['═══════════════════════════════════════════════════════']);
        datos.push(['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Estado']);

        origenes.forEach(r => {
            datos.push([
                formatearFecha(r.fecha),
                r.asiento,
                r.descripcion,
                r.debe || '',
                r.haber || '',
                obtenerEtiquetaEstado(r.estado)
            ]);
        });

        const totalOrigenes = origenes.reduce((sum, r) => sum + obtenerMontoOrigen(r), 0);
        datos.push([]);
        datos.push(['', '', `TOTAL ${config.etiquetaOrigen.toUpperCase()}:`, formatearMonedaExcel(totalOrigenes), '', '']);
        datos.push([]);
    }

    // Destinos pendientes
    if (destinos.length > 0) {
        datos.push(['═══════════════════════════════════════════════════════']);
        datos.push([`${config.etiquetaDestino.toUpperCase()} PENDIENTES`]);
        datos.push(['═══════════════════════════════════════════════════════']);
        datos.push(['Fecha', 'Asiento', 'Descripción', 'Debe', 'Haber', 'Estado']);

        destinos.forEach(r => {
            datos.push([
                formatearFecha(r.fecha),
                r.asiento,
                r.descripcion,
                r.debe || '',
                r.haber || '',
                obtenerEtiquetaEstado(r.estado)
            ]);
        });

        const totalDestinos = destinos.reduce((sum, r) => sum + obtenerMontoDestino(r), 0);
        datos.push([]);
        datos.push(['', '', `TOTAL ${config.etiquetaDestino.toUpperCase()}:`, '', formatearMonedaExcel(totalDestinos), '']);
    }

    return datos;
}

/**
 * Generar datos para hoja de composición del saldo contable
 * Muestra emisiones sin vincular y diferencias de vinculaciones parciales
 */
function generarDatosComposicionSaldoContable(vincParciales, sinVincular, config) {
    const datos = [];

    // Calcular totales
    const emisionesSinVincular = sinVincular.filter(r => esRegistroOrigen(r));
    const totalEmisionesSinVincular = emisionesSinVincular.reduce((sum, r) => sum + obtenerMontoOrigen(r), 0);

    // Calcular total de diferencias de vinculaciones parciales (sólo la parte de emisiones pendientes)
    let totalDiferenciasParciales = 0;
    vincParciales.forEach(v => {
        if (v.diferencia > 0) {
            totalDiferenciasParciales += v.diferencia;
        }
    });

    // Calcular saldo del mayor
    const totalDebe = stateMayores.registrosMayor.reduce((sum, r) => sum + (r.debe || 0), 0);
    const totalHaber = stateMayores.registrosMayor.reduce((sum, r) => sum + (r.haber || 0), 0);
    const saldoMayor = totalHaber - totalDebe; // Para cheques: haber (emisiones) - debe (cobros)

    // Encabezado
    datos.push(['COMPOSICIÓN DEL SALDO CONTABLE DEL MAYOR']);
    datos.push([`Tipo de Mayor: ${stateMayores.tipoMayorActual?.nombre || 'N/A'}`]);
    datos.push([`Cliente: ${stateMayores.clienteActual?.nombre || 'N/A'}`]);
    datos.push([`Fecha de exportación: ${new Date().toLocaleDateString('es-AR')}`]);
    datos.push([]);
    datos.push(['Este detalle muestra los elementos que componen el saldo del mayor contable.']);
    datos.push(['El saldo se compone de: emisiones sin vincular + diferencias de vinculaciones parciales.']);
    datos.push([]);

    // Resumen de composición
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push(['RESUMEN DE COMPOSICIÓN']);
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push(['Concepto', 'Cantidad', 'Importe']);
    datos.push([`${config.etiquetaOrigen} sin vinculación`, emisionesSinVincular.length, formatearMonedaExcel(totalEmisionesSinVincular)]);
    datos.push([`${config.etiquetaOrigen} con vinculación parcial (diferencias)`, vincParciales.filter(v => v.diferencia > 0).length, formatearMonedaExcel(totalDiferenciasParciales)]);
    datos.push(['───────────────────────────────────────────────────────────────────────────────']);
    datos.push(['TOTAL COMPOSICIÓN DEL SALDO', '', formatearMonedaExcel(totalEmisionesSinVincular + totalDiferenciasParciales)]);
    datos.push(['Saldo según Mayor Contable', '', formatearMonedaExcel(saldoMayor)]);
    datos.push([]);

    // ===== SECCIÓN 1: EMISIONES SIN VINCULACIÓN =====
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push([`${config.etiquetaOrigen.toUpperCase()} SIN VINCULACIÓN`]);
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push([`Estos registros no tienen ninguna vinculación y componen directamente el saldo.`]);
    datos.push([]);

    if (emisionesSinVincular.length === 0) {
        datos.push(['No hay emisiones sin vinculación']);
        datos.push([]);
    } else {
        datos.push(['Fecha', 'Asiento', 'Descripción', 'Importe', 'Estado']);

        // Ordenar por fecha
        const emisionesOrdenadas = [...emisionesSinVincular].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        emisionesOrdenadas.forEach(r => {
            const monto = obtenerMontoOrigen(r);
            datos.push([
                formatearFecha(r.fecha),
                r.asiento,
                r.descripcion,
                formatearMonedaExcel(monto),
                obtenerEtiquetaEstado(r.estado)
            ]);
        });

        datos.push(['───────────────────────────────────────────────────────────────────────────────']);
        datos.push(['', '', `SUBTOTAL ${config.etiquetaOrigen.toUpperCase()} SIN VINCULACIÓN:`, formatearMonedaExcel(totalEmisionesSinVincular), '']);
        datos.push([]);
    }

    // ===== SECCIÓN 2: EMISIONES CON VINCULACIONES PARCIALES =====
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push([`${config.etiquetaOrigen.toUpperCase()} CON VINCULACIÓN PARCIAL`]);
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push([`Estos registros tienen vinculación parcial. Se muestra la diferencia pendiente de cada vinculación.`]);
    datos.push([]);

    // Filtrar sólo vinculaciones parciales con diferencia positiva (emisiones > cobros)
    const vincParcialesConDiferencia = vincParciales.filter(v => v.diferencia > 0);

    if (vincParcialesConDiferencia.length === 0) {
        datos.push(['No hay emisiones con vinculaciones parciales']);
        datos.push([]);
    } else {
        vincParcialesConDiferencia.forEach((vinc, idx) => {
            datos.push(['───────────────────────────────────────────────────────────────────────────────']);
            datos.push([`Vinculación Parcial #${idx + 1}`]);
            datos.push([`Total ${config.etiquetaOrigen}: ${formatearMonedaExcel(vinc.totalOrigen)} | Total ${config.etiquetaDestino}: ${formatearMonedaExcel(vinc.totalDestino)} | DIFERENCIA PENDIENTE: ${formatearMonedaExcel(vinc.diferencia)}`]);
            datos.push([]);

            // Mostrar las emisiones de esta vinculación
            datos.push(['Fecha', 'Asiento', 'Descripción', 'Importe', 'Tipo']);

            vinc.registrosOrigen.forEach(r => {
                datos.push([
                    formatearFecha(r.fecha),
                    r.asiento,
                    r.descripcion,
                    formatearMonedaExcel(obtenerMontoOrigen(r)),
                    config.etiquetaSingularOrigen.toUpperCase()
                ]);
            });

            // Mostrar los cobros parciales de esta vinculación
            vinc.registrosDestino.forEach(r => {
                datos.push([
                    formatearFecha(r.fecha),
                    r.asiento,
                    r.descripcion,
                    formatearMonedaExcel(obtenerMontoDestino(r)),
                    config.etiquetaSingularDestino.toUpperCase()
                ]);
            });

            datos.push([]);
        });

        datos.push(['───────────────────────────────────────────────────────────────────────────────']);
        datos.push(['', '', `SUBTOTAL DIFERENCIAS PARCIALES:`, formatearMonedaExcel(totalDiferenciasParciales), '']);
        datos.push([]);
    }

    // ===== RESUMEN FINAL =====
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    datos.push(['VERIFICACIÓN']);
    datos.push(['═══════════════════════════════════════════════════════════════════════════════']);
    const totalComposicion = totalEmisionesSinVincular + totalDiferenciasParciales;
    datos.push(['Concepto', '', 'Importe']);
    datos.push([`${config.etiquetaOrigen} sin vinculación`, '', formatearMonedaExcel(totalEmisionesSinVincular)]);
    datos.push(['Diferencias de vinculaciones parciales', '', formatearMonedaExcel(totalDiferenciasParciales)]);
    datos.push(['───────────────────────────────────────────────────────────────────────────────']);
    datos.push(['TOTAL COMPOSICIÓN', '', formatearMonedaExcel(totalComposicion)]);
    datos.push(['Saldo Mayor Contable', '', formatearMonedaExcel(saldoMayor)]);

    const diferencia = Math.abs(totalComposicion - saldoMayor);
    if (diferencia <= 1) {
        datos.push(['Estado', '', 'VERIFICADO ✓']);
    } else {
        datos.push(['Diferencia', '', formatearMonedaExcel(totalComposicion - saldoMayor)]);
    }

    return datos;
}

/**
 * Formatear moneda para Excel (sin símbolo $)
 */
function formatearMonedaExcel(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return 0;
    return Math.round(valor * 100) / 100;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Formatear fecha
 */
function formatearFecha(fecha) {
    if (!fecha) return '-';
    if (typeof fecha === 'string') {
        fecha = new Date(fecha);
    }
    if (isNaN(fecha.getTime())) return '-';

    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

/**
 * Formatear moneda
 */
function formatearMoneda(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return '$0,00';
    return '$' + valor.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formatear mes en formato corto (Ej: "2024-08" -> "Ago")
 */
function formatearMesCorto(mesKey) {
    if (!mesKey) return '';
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partes = mesKey.split('-');
    if (partes.length !== 2) return mesKey;
    const mes = parseInt(partes[1], 10) - 1;
    if (mes < 0 || mes > 11) return mesKey;
    return mesesNombres[mes];
}

/**
 * Truncar texto
 */
function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    return texto.length > maxLength ? texto.substring(0, maxLength) + '...' : texto;
}

// ============================================
// GESTIÓN DE TIPOS DE MAYOR
// ============================================

/**
 * Abrir modal de configurar tipos de mayor
 */
function abrirConfigurarTipoMayor() {
    document.getElementById('modalConfigurarTipoMayor').classList.remove('hidden');
    renderizarListaTiposMayor();
}

/**
 * Cerrar modal de configurar tipos de mayor
 */
function cerrarConfigurarTipoMayor() {
    document.getElementById('modalConfigurarTipoMayor').classList.add('hidden');
}

/**
 * Agregar nuevo tipo de mayor
 */
function agregarTipoMayor() {
    const id = document.getElementById('nuevoTipoMayorId').value.trim();
    const nombre = document.getElementById('nuevoTipoMayorNombre').value.trim();
    const descripcion = document.getElementById('nuevoTipoMayorDescripcion').value.trim();
    const logica = document.getElementById('nuevoTipoMayorLogica').value;

    if (!id || !nombre) {
        alert('El ID y nombre son obligatorios');
        return;
    }

    if (TIPOS_MAYOR.some(t => t.id === id)) {
        alert('Ya existe un tipo con ese ID');
        return;
    }

    TIPOS_MAYOR.push({
        id,
        nombre,
        descripcion,
        logica,
        icono: '📊',
        configuracion: logica === 'vinculacion' ? { diasVencimiento: 40 } : {}
    });

    localStorage.setItem('auditoria_tipos_mayor', JSON.stringify(TIPOS_MAYOR));

    // Limpiar formulario
    document.getElementById('nuevoTipoMayorId').value = '';
    document.getElementById('nuevoTipoMayorNombre').value = '';
    document.getElementById('nuevoTipoMayorDescripcion').value = '';

    renderizarListaTiposMayor();
    renderizarTiposMayor();
}

/**
 * Renderizar lista de tipos de mayor en el modal de configuración
 */
function renderizarListaTiposMayor() {
    const container = document.getElementById('tiposMayorLista');

    if (TIPOS_MAYOR.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay tipos de mayor configurados</div>';
        return;
    }

    container.innerHTML = TIPOS_MAYOR.map(tipo => `
        <div class="categoria-item">
            <div class="categoria-info">
                <span class="categoria-nombre">${tipo.icono || '📊'} ${tipo.nombre}</span>
                <span class="categoria-id">${tipo.id} | ${tipo.logica}</span>
            </div>
            <div class="categoria-actions">
                <button onclick="eliminarTipoMayor('${tipo.id}')" class="btn-danger btn-sm">🗑️</button>
            </div>
        </div>
    `).join('');
}

/**
 * Eliminar tipo de mayor
 */
function eliminarTipoMayor(id) {
    if (!confirm('¿Está seguro de eliminar este tipo de mayor?')) return;

    TIPOS_MAYOR = TIPOS_MAYOR.filter(t => t.id !== id);
    localStorage.setItem('auditoria_tipos_mayor', JSON.stringify(TIPOS_MAYOR));

    renderizarListaTiposMayor();
    renderizarTiposMayor();
}

// ============================================
// FUNCIONES PARA LISTADO DE CHEQUES RECIBIDOS
// ============================================

/**
 * Mostrar modal para cargar listado de cheques
 */
function mostrarCargarListadoCheques() {
    // Verificar que hay un mayor cargado
    if (stateMayores.registrosMayor.length === 0) {
        alert('Primero debe cargar un mayor contable antes de incorporar el listado de cheques.');
        return;
    }

    document.getElementById('modalCargarListadoCheques').classList.remove('hidden');
    document.getElementById('listadoChequesFile').value = '';
    document.getElementById('listadoChequesFileInfo').innerHTML = '';
    document.getElementById('listadoChequesPreviewInfo').style.display = 'none';
    document.getElementById('comparacionSumasPanel').style.display = 'none';
    document.getElementById('btnProcesarListadoCheques').disabled = true;
    stateMayores.listadoChequesTemporal = [];
}

/**
 * Cerrar modal de cargar listado de cheques
 */
function cerrarCargarListadoCheques() {
    document.getElementById('modalCargarListadoCheques').classList.add('hidden');
    stateMayores.listadoChequesTemporal = [];
}

/**
 * Manejar cambio de archivo de listado de cheques
 */
function handleListadoChequesFileChange(event) {
    const file = event.target.files[0];
    const fileInfo = document.getElementById('listadoChequesFileInfo');
    const previewInfo = document.getElementById('listadoChequesPreviewInfo');
    const comparacionPanel = document.getElementById('comparacionSumasPanel');
    const btnProcesar = document.getElementById('btnProcesarListadoCheques');

    if (!file) {
        fileInfo.innerHTML = '';
        previewInfo.style.display = 'none';
        comparacionPanel.style.display = 'none';
        btnProcesar.disabled = true;
        return;
    }

    fileInfo.innerHTML = `<strong>Archivo:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    // Leer y procesar el archivo
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

            if (jsonData.length === 0) {
                previewInfo.innerHTML = '<span style="color: red;">El archivo está vacío</span>';
                previewInfo.style.display = 'block';
                comparacionPanel.style.display = 'none';
                btnProcesar.disabled = true;
                return;
            }

            // Procesar los cheques
            const cheques = procesarDatosListadoCheques(jsonData);
            stateMayores.listadoChequesTemporal = cheques;

            // Mostrar preview
            const headers = Object.keys(jsonData[0]);
            previewInfo.innerHTML = `
                <strong>Vista previa:</strong><br>
                Columnas detectadas: ${headers.join(', ')}<br>
                Cheques encontrados: ${cheques.length}
            `;
            previewInfo.style.display = 'block';

            // Calcular y mostrar comparación
            mostrarComparacionSumas(cheques);

        } catch (error) {
            console.error('Error leyendo archivo de cheques:', error);
            previewInfo.innerHTML = '<span style="color: red;">Error al leer el archivo: ' + error.message + '</span>';
            previewInfo.style.display = 'block';
            comparacionPanel.style.display = 'none';
            btnProcesar.disabled = true;
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Procesar datos del listado de cheques
 * @param {Array} jsonData - Datos del archivo Excel
 * @returns {Array} Lista de cheques procesados
 */
function procesarDatosListadoCheques(jsonData) {
    return jsonData.map((row, index) => {
        // Buscar columnas con flexibilidad en nombres
        const interno = buscarColumna(row, 'Interno', 'interno', 'INTERNO', 'Id', 'ID');
        const numero = buscarColumna(row, 'Numero', 'numero', 'NUMERO', 'Nro', 'NRO', 'Número');
        const fechaEmision = buscarColumna(row, 'Fecha Emision', 'FechaEmision', 'Fecha_Emision', 'Emision', 'EMISION');
        const fechaRecepcion = buscarColumna(row, 'Fecha Recepcion', 'FechaRecepcion', 'Fecha_Recepcion', 'Recepcion', 'RECEPCION');
        const fechaCobro = buscarColumna(row, 'Fecha cobro', 'FechaCobro', 'Fecha_Cobro', 'Cobro', 'COBRO');
        const fechaRechazo = buscarColumna(row, 'FechaRechazo', 'Fecha Rechazo', 'Fecha_Rechazo', 'Rechazo', 'RECHAZO');
        const fechaDeposito = buscarColumna(row, 'FechaDeposito', 'Fecha Deposito', 'Fecha_Deposito', 'Deposito', 'DEPOSITO');
        const fechaTransferencia = buscarColumna(row, 'FechaTransferencia', 'Fecha Transferencia', 'Fecha_Transferencia', 'Transferencia', 'TRANSFERENCIA');
        const origen = buscarColumna(row, 'Origen', 'origen', 'ORIGEN', 'Cliente', 'CLIENTE');
        const destino = buscarColumna(row, 'Destino', 'destino', 'DESTINO', 'Proveedor', 'PROVEEDOR');
        const importeRaw = buscarColumna(row, 'Importe', 'importe', 'IMPORTE', 'Monto', 'MONTO', 'Valor', 'VALOR');
        const estado = buscarColumna(row, 'Estado', 'estado', 'ESTADO');

        // Parsear importe
        const importe = parsearNumeroArgentino(importeRaw);

        return {
            id: `cheque_${index}_${Date.now()}`,
            interno: interno ? interno.toString() : '',
            numero: numero ? numero.toString() : '',
            fechaEmision: parsearFecha(fechaEmision),
            fechaEmisionOriginal: fechaEmision || '',
            fechaRecepcion: parsearFecha(fechaRecepcion),
            fechaRecepcionOriginal: fechaRecepcion || '',
            fechaCobro: parsearFecha(fechaCobro),
            fechaCobroOriginal: fechaCobro || '',
            fechaRechazo: parsearFecha(fechaRechazo),
            fechaRechazoOriginal: fechaRechazo || '',
            fechaDeposito: parsearFecha(fechaDeposito),
            fechaDepositoOriginal: fechaDeposito || '',
            fechaTransferencia: parsearFecha(fechaTransferencia),
            fechaTransferenciaOriginal: fechaTransferencia || '',
            origen: origen || '',
            destino: destino || '',
            importe: importe,
            estado: estado || ''
        };
    }).filter(c => c.importe > 0);  // Filtrar cheques sin importe
}

/**
 * Mostrar comparación de sumas entre listado de cheques y debe del mayor
 * @param {Array} cheques - Lista de cheques procesados
 */
function mostrarComparacionSumas(cheques) {
    const comparacionPanel = document.getElementById('comparacionSumasPanel');
    const btnProcesar = document.getElementById('btnProcesarListadoCheques');

    // Calcular total del debe del mayor (solo registros no vinculados del debe)
    const registrosDebe = stateMayores.registrosMayor.filter(r => r.debe > 0 && !r.esDevolucion);
    const totalDebeMayor = registrosDebe.reduce((sum, r) => sum + r.debe, 0);

    // Calcular total del listado de cheques
    const totalListadoCheques = cheques.reduce((sum, c) => sum + c.importe, 0);

    // Calcular diferencia
    const diferencia = Math.abs(totalDebeMayor - totalListadoCheques);
    const coinciden = diferencia < 1;  // Tolerancia de $1

    // Actualizar UI
    document.getElementById('totalDebeMayorComparacion').textContent = formatearMoneda(totalDebeMayor);
    document.getElementById('totalListadoChequesComparacion').textContent = formatearMoneda(totalListadoCheques);

    const diferenciaEl = document.getElementById('diferenciaComparacion');
    diferenciaEl.textContent = formatearMoneda(diferencia);
    diferenciaEl.className = 'comparacion-valor ' + (coinciden ? 'coincide' : 'no-coincide');

    // Mostrar mensaje
    const mensajeEl = document.getElementById('mensajeComparacion');
    if (coinciden) {
        mensajeEl.innerHTML = '✅ <strong>Los totales coinciden.</strong> Puede incorporar el listado de cheques al análisis.';
        mensajeEl.className = 'mensaje-comparacion success';
        btnProcesar.disabled = false;
    } else {
        const porcentajeDif = ((diferencia / totalDebeMayor) * 100).toFixed(2);
        mensajeEl.innerHTML = `⚠️ <strong>Los totales no coinciden.</strong> Diferencia de ${formatearMoneda(diferencia)} (${porcentajeDif}%). Puede incorporar de todas formas si lo desea.`;
        mensajeEl.className = 'mensaje-comparacion warning';
        btnProcesar.disabled = false;
    }

    comparacionPanel.style.display = 'block';
}

/**
 * Procesar e incorporar listado de cheques al mayor
 */
function procesarListadoCheques() {
    const cheques = stateMayores.listadoChequesTemporal;

    if (cheques.length === 0) {
        alert('No hay cheques para incorporar.');
        return;
    }

    // Verificar si coinciden las sumas
    const registrosDebe = stateMayores.registrosMayor.filter(r => r.debe > 0 && !r.esDevolucion);
    const totalDebeMayor = registrosDebe.reduce((sum, r) => sum + r.debe, 0);
    const totalListadoCheques = cheques.reduce((sum, c) => sum + c.importe, 0);
    const diferencia = Math.abs(totalDebeMayor - totalListadoCheques);
    const coinciden = diferencia < 1;

    if (!coinciden) {
        // Mostrar modal de confirmación
        document.getElementById('confirmTotalDebeMayor').textContent = formatearMoneda(totalDebeMayor);
        document.getElementById('confirmTotalListado').textContent = formatearMoneda(totalListadoCheques);
        document.getElementById('confirmDiferencia').textContent = formatearMoneda(diferencia);
        document.getElementById('modalConfirmarDiferenciaListado').classList.remove('hidden');
        return;
    }

    // Si coinciden, incorporar directamente
    incorporarListadoChequesAlMayor();
}

/**
 * Cerrar modal de confirmación de diferencia
 */
function cerrarConfirmarDiferenciaListado() {
    document.getElementById('modalConfirmarDiferenciaListado').classList.add('hidden');
}

/**
 * Confirmar incorporación del listado con diferencia
 */
function confirmarIncorporarListadoConDiferencia() {
    cerrarConfirmarDiferenciaListado();
    incorporarListadoChequesAlMayor();
}

/**
 * Incorporar el listado de cheques al mayor.
 * NUEVA LÓGICA: Solo carga el listado, no hace asociación automática.
 * La conciliación se realiza gradualmente por mes en el Paso 2.
 */
async function incorporarListadoChequesAlMayor() {
    const cheques = stateMayores.listadoChequesTemporal;

    if (cheques.length === 0) {
        alert('No hay cheques para incorporar.');
        return;
    }

    // Mostrar barra de progreso
    mostrarProgresoCheques();
    actualizarProgresoCheques(0, 'Procesando listado de cheques...');
    await permitirActualizacionUI();

    // Enriquecer cada cheque con un ID único
    actualizarProgresoCheques(30, 'Preparando cheques...');
    await permitirActualizacionUI();

    const chequesEnriquecidos = cheques.map((cheque, index) => ({
        id: `cheque_${index}_${Date.now()}`,
        interno: cheque.interno,
        numero: cheque.numero,
        fechaEmision: cheque.fechaEmision,
        fechaEmisionOriginal: cheque.fechaEmisionOriginal,
        fechaRecepcion: cheque.fechaRecepcion,
        fechaRecepcionOriginal: cheque.fechaRecepcionOriginal,
        fechaCobro: cheque.fechaCobro,
        fechaCobroOriginal: cheque.fechaCobroOriginal,
        fechaDeposito: cheque.fechaDeposito,
        fechaDepositoOriginal: cheque.fechaDepositoOriginal,
        fechaTransferencia: cheque.fechaTransferencia,
        fechaTransferenciaOriginal: cheque.fechaTransferenciaOriginal,
        origen: cheque.origen,
        destino: cheque.destino,
        importe: cheque.importe,
        estado: cheque.estado,
        asientoAsociado: null
    }));

    // Calcular meses disponibles
    actualizarProgresoCheques(60, 'Calculando meses disponibles...');
    await permitirActualizacionUI();

    const mesesDisponibles = calcularMesesDeCheques(chequesEnriquecidos);

    // Actualizar estado
    actualizarProgresoCheques(80, 'Actualizando estado...');
    await permitirActualizacionUI();

    stateMayores.listadoChequesIncorporado = true;
    stateMayores.listadoChequesCargados = chequesEnriquecidos;
    stateMayores.listadoChequesTemporal = [];
    stateMayores.mesesDisponibles = mesesDisponibles;
    stateMayores.mesesProcesados = {};

    // Actualizar UI
    actualizarProgresoCheques(90, 'Actualizando interfaz...');
    await permitirActualizacionUI();

    // Actualizar estado del listado de cheques (Paso 1)
    actualizarEstadoListadoCheques();
    actualizarResumenListadoCheques();

    // Mostrar panel de conciliación por mes (Paso 2)
    const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
    if (panelPaso2Mes) {
        panelPaso2Mes.style.display = 'block';
        renderizarListaMeses();
    }

    actualizarProgresoCheques(100, '¡Completado!');
    await permitirActualizacionUI();

    console.log(`✅ Listado de cheques cargado:`);
    console.log(`   - ${chequesEnriquecidos.length} cheques procesados`);
    console.log(`   - ${mesesDisponibles.length} meses disponibles para conciliar`);

    // Ocultar progreso y cerrar modal
    ocultarProgresoCheques();
    cerrarCargarListadoCheques();

    alert(`✅ Se cargaron ${chequesEnriquecidos.length} cheques.\n\n` +
          `📅 ${mesesDisponibles.length} meses disponibles para conciliar.\n\n` +
          `Vaya al Paso 2 para conciliar los cheques con los registros del debe mes por mes.`);
}

/**
 * FUNCIÓN LEGACY: Incorporar el listado de cheques al mayor con asociación automática
 * Esta función mantiene la lógica anterior para compatibilidad.
 * Se puede invocar manualmente si se necesita el comportamiento antiguo.
 */
async function incorporarListadoChequesAlMayorLegacy() {
    const cheques = stateMayores.listadoChequesTemporal;

    if (cheques.length === 0) {
        alert('No hay cheques para incorporar.');
        return;
    }

    // Mostrar barra de progreso
    mostrarProgresoCheques();
    actualizarProgresoCheques(0, 'Iniciando procesamiento...');
    await permitirActualizacionUI();

    // Obtener registros del debe (que mantendremos y enriqueceremos)
    actualizarProgresoCheques(5, 'Separando registros del mayor...');
    await permitirActualizacionUI();

    const registrosDebe = stateMayores.registrosMayor.filter(r => r.debe > 0 && !r.esDevolucion);

    // Obtener registros del haber (que se mantienen sin cambios)
    const registrosHaber = stateMayores.registrosMayor.filter(r => r.haber > 0 || r.esDevolucion);

    actualizarProgresoCheques(10, `Preparando ${registrosDebe.length} asientos del debe...`);
    await permitirActualizacionUI();

    // Asociar cheques a cada registro del debe por número de asiento y/o fecha cercana
    registrosDebe.forEach(registro => {
        registro.chequesAsociados = [];
        registro.esAsientoConCheques = true;  // Marcar para identificación en renderizado
    });

    // Array para cheques no asociados
    const chequesNoAsociados = [];

    /**
     * Normalizar texto para comparación (quitar tildes, espacios extra, mayúsculas)
     * También elimina siglas de tipos societarios que se repiten entre distintos originantes
     */
    function normalizarTexto(texto) {
        if (!texto) return '';

        // Siglas de tipos societarios a excluir (se repiten y no aportan a la identificación)
        const siglasExcluir = [
            'srl', 's r l',
            'sas', 's a s',
            'sa', 's a',
            'sca', 's c a',
            'sci', 's c i',
            'se', 's e'
        ];

        let resultado = texto
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
            .replace(/[^a-z0-9\s]/g, ' ')    // Solo letras, números y espacios
            .replace(/\s+/g, ' ')            // Normalizar espacios múltiples
            .trim();

        // Eliminar siglas de tipos societarios (como palabras completas al final o en medio)
        for (const sigla of siglasExcluir) {
            // Eliminar al final del texto
            const regexFin = new RegExp(`\\s+${sigla}$`, 'g');
            resultado = resultado.replace(regexFin, '');
            // Eliminar en medio del texto (rodeada de espacios)
            const regexMedio = new RegExp(`\\s+${sigla}\\s+`, 'g');
            resultado = resultado.replace(regexMedio, ' ');
        }

        return resultado.trim();
    }

    /**
     * Palabras comunes/frecuentes que por sí solas no deben validar una vinculación.
     * Cuando la única coincidencia es una de estas palabras, se requiere al menos
     * una segunda palabra coincidente para considerar la vinculación válida.
     */
    const PALABRAS_COMUNES = [
        'repuestos', 'repuesto',
        'automotores', 'automotor', 'automotriz',
        'distribuidora', 'distribuidor', 'distribuciones',
        'comercial', 'comercializadora',
        'servicios', 'servicio',
        'transporte', 'transportes',
        'construccion', 'construcciones', 'constructora',
        'industria', 'industrial', 'industrias',
        'agropecuaria', 'agropecuario',
        'inmobiliaria', 'inmobiliario',
        'metalurgica', 'metalurgico',
        'empresa', 'empresas',
        'grupo', 'compania',
        'norte', 'sur', 'este', 'oeste', 'centro',
        'argentina', 'buenos', 'aires'
    ];

    /**
     * Calcular similitud entre origen del cheque y descripción del asiento.
     * El requisito de coincidencias es proporcional al número de palabras:
     * - Orígenes cortos (1-2 palabras): requiere al menos 1 coincidencia
     * - Orígenes largos (3+ palabras): requiere al menos 2 coincidencias
     *
     * IMPORTANTE: Si las únicas coincidencias son palabras comunes (como "repuestos"),
     * se requiere al menos una segunda palabra coincidente para validar la vinculación.
     * Retorna un valor entre 0 y 1.
     */
    function calcularSimilitudTexto(origenCheque, descripcionAsiento) {
        const origenNorm = normalizarTexto(origenCheque);
        const descripcionNorm = normalizarTexto(descripcionAsiento);

        if (!origenNorm || !descripcionNorm) return 0;

        // Verificar si el origen está contenido en la descripción o viceversa
        if (descripcionNorm.includes(origenNorm) || origenNorm.includes(descripcionNorm)) {
            return 1;
        }

        // Dividir en palabras - usar más de 2 caracteres para incluir "hnos", etc.
        const palabrasOrigen = origenNorm.split(' ').filter(p => p.length > 2);
        const palabrasDescripcion = descripcionNorm.split(' ').filter(p => p.length > 2);

        if (palabrasOrigen.length === 0) return 0;

        let coincidencias = 0;
        let coincidenciasNoComunes = 0;  // Contador de coincidencias con palabras NO comunes

        for (const palabra of palabrasOrigen) {
            // Comparación flexible: exacta, inclusión o prefijo común
            const tieneCoincidencia = palabrasDescripcion.some(pd => {
                if (pd === palabra) return true;
                if (pd.includes(palabra) || palabra.includes(pd)) return true;
                // Comparar por prefijo (4+ caracteres) para manejar abreviaciones
                if (palabra.length >= 4 && pd.length >= 4 &&
                    pd.substring(0, 4) === palabra.substring(0, 4)) return true;
                return false;
            });

            if (tieneCoincidencia) {
                coincidencias++;
                // Verificar si esta palabra NO es una palabra común
                const esPalabraComun = PALABRAS_COMUNES.some(pc =>
                    palabra === pc || palabra.includes(pc) || pc.includes(palabra) ||
                    (palabra.length >= 4 && pc.length >= 4 && palabra.substring(0, 4) === pc.substring(0, 4))
                );
                if (!esPalabraComun) {
                    coincidenciasNoComunes++;
                }
            }
        }

        // Requisito proporcional al número de palabras del origen:
        // - Si el origen tiene 1 palabra: requerir 1 coincidencia
        // - Si el origen tiene 2+ palabras: requerir al menos 2 coincidencias
        // Esto evita falsos positivos cuando solo coincide un nombre común (ej: "Pablo")
        const minimoRequerido = palabrasOrigen.length >= 2 ? 2 : 1;
        if (coincidencias < minimoRequerido) {
            return 0;  // No hay suficientes palabras coincidentes
        }

        // NUEVA VALIDACIÓN: Si TODAS las coincidencias son palabras comunes,
        // requerir al menos 2 coincidencias totales para validar la vinculación.
        // Esto evita falsos positivos con palabras genéricas como "repuestos" solas.
        if (coincidenciasNoComunes === 0 && coincidencias < 2) {
            return 0;  // Solo hay coincidencias con palabras comunes y son menos de 2
        }

        return coincidencias / palabrasOrigen.length;
    }

    /**
     * Calcular score de asociación entre un cheque y un registro del debe
     * NUEVA LÓGICA:
     * - Exige coincidencia de texto entre origen del cheque y leyenda del mayor
     * - Prioriza por cercanía de fechas como criterio secundario
     * - RESTRICCIÓN: Tolerancia de fechas de +/- 15 días máximo
     * Retorna un objeto con score, detalles y flag de match de texto
     */
    function calcularScoreAsociacion(cheque, registro) {
        const detalles = { fecha: 0, texto: 0, diffDias: Infinity };

        // Tolerancia máxima de días entre fecha de recepción del cheque y fecha del registro
        const TOLERANCIA_DIAS_CHEQUES = 15; // Tolerancia ampliada para operaciones bancarias

        // Primero calcular similitud de texto origen/descripción (REQUISITO OBLIGATORIO)
        const similitud = calcularSimilitudTexto(cheque.origen, registro.descripcion);
        detalles.texto = Math.round(similitud * 100);  // Porcentaje de similitud

        // Umbral mínimo de coincidencia de texto (50% de las palabras deben coincidir)
        const UMBRAL_MINIMO_TEXTO = 50;
        const tieneMatchTexto = detalles.texto >= UMBRAL_MINIMO_TEXTO;

        // Score por fecha (para priorización entre matches de texto)
        // Usamos diferencia en días - menor es mejor
        // RESTRICCIÓN: Solo se consideran válidos matches dentro de +/- 15 días
        const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
        if (fechaCheque && registro.fecha) {
            detalles.diffDias = Math.abs((registro.fecha - fechaCheque) / (1000 * 60 * 60 * 24));

            // Solo asignar score si está dentro de la tolerancia de +/- 15 días
            if (detalles.diffDias <= TOLERANCIA_DIAS_CHEQUES) {
                // Score de fecha: 100 para fecha exacta, decrece con la distancia
                if (detalles.diffDias === 0) {
                    detalles.fecha = 100;
                } else if (detalles.diffDias <= 1) {
                    detalles.fecha = 95;
                } else if (detalles.diffDias <= 2) {
                    detalles.fecha = 90;
                } else if (detalles.diffDias <= 3) {
                    detalles.fecha = 85;
                } else if (detalles.diffDias <= 5) {
                    detalles.fecha = 75;
                } else if (detalles.diffDias <= 7) {
                    detalles.fecha = 60;
                } else if (detalles.diffDias <= 10) {
                    detalles.fecha = 45;
                } else {
                    detalles.fecha = 30; // 11-15 días
                }
            } else {
                // Fuera de tolerancia: no hay match válido de fecha
                detalles.fecha = 0;
            }
        }

        // El score ahora prioriza: primero match de texto, luego cercanía de fecha
        // Si no hay match de texto O si la fecha está fuera de tolerancia, el score es 0
        const dentroToleranciaFecha = detalles.diffDias <= TOLERANCIA_DIAS_CHEQUES;
        const score = (tieneMatchTexto && dentroToleranciaFecha) ? detalles.fecha : 0;

        return { score, detalles, tieneMatchTexto: tieneMatchTexto && dentroToleranciaFecha };
    }

    /**
     * Verificar si agregar un cheque a un registro excedería el monto del debe
     * @param {Object} registro - Registro del debe
     * @param {number} importeCheque - Importe del cheque a agregar
     * @returns {boolean} True si excedería el monto
     */
    function excederiaMontoDelDebe(registro, importeCheque) {
        const tolerancia = 0.50;  // Tolerancia de 50 centavos para redondeos
        const sumaActual = registro.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
        const nuevaSuma = sumaActual + importeCheque;
        return nuevaSuma > (registro.debe + tolerancia);
    }

    // Asociar cada cheque al registro del debe correspondiente usando scoring
    actualizarProgresoCheques(15, `Asociando ${cheques.length} cheques a asientos...`);
    await permitirActualizacionUI();

    const totalCheques = cheques.length;
    const intervaloActualizacion = Math.max(1, Math.floor(totalCheques / 50)); // Actualizar cada 2% aprox

    for (let index = 0; index < totalCheques; index++) {
        const cheque = cheques[index];
        let registroAsociado = null;
        let mejorScore = 0;

        // Actualizar progreso periódicamente (cada intervaloActualizacion cheques)
        if (index % intervaloActualizacion === 0) {
            const porcentaje = 15 + ((index / totalCheques) * 50); // 15% a 65%
            actualizarProgresoCheques(porcentaje, `Procesando cheque ${index + 1} de ${totalCheques}...`);
            await permitirActualizacionUI();
        }

        // Primero intentar asociar por número de asiento exacto (si el cheque tiene asiento)
        if (cheque.asiento) {
            const registroPorAsiento = registrosDebe.find(r => r.asiento === cheque.asiento);
            // Solo asociar si no excede el monto del debe
            if (registroPorAsiento && !excederiaMontoDelDebe(registroPorAsiento, cheque.importe)) {
                registroAsociado = registroPorAsiento;
            }
        }

        // Si no se encontró por asiento, usar scoring para encontrar el mejor match
        // NUEVA LÓGICA: Exigir coincidencia de texto (origen vs leyenda), luego priorizar por fecha
        if (!registroAsociado) {
            let mejorDiffDias = Infinity;

            for (const registro of registrosDebe) {
                // IMPORTANTE: No asociar si excedería el monto del debe
                if (excederiaMontoDelDebe(registro, cheque.importe)) {
                    continue;  // Skip este registro
                }

                const { score, detalles, tieneMatchTexto } = calcularScoreAsociacion(cheque, registro);

                // REQUISITO OBLIGATORIO: Debe haber coincidencia de texto entre origen y leyenda
                if (!tieneMatchTexto) {
                    continue;  // Skip si no hay match de texto
                }

                // Entre los que tienen match de texto, priorizar por cercanía de fechas
                // (menor diffDias es mejor)
                if (detalles.diffDias < mejorDiffDias) {
                    mejorDiffDias = detalles.diffDias;
                    mejorScore = score;
                    registroAsociado = registro;
                }
            }
        }

        // Crear objeto de cheque enriquecido
        const chequeEnriquecido = {
            id: `cheque_${index}_${Date.now()}`,
            interno: cheque.interno,
            numero: cheque.numero,
            fechaEmision: cheque.fechaEmision,
            fechaEmisionOriginal: cheque.fechaEmisionOriginal,
            fechaRecepcion: cheque.fechaRecepcion,
            fechaRecepcionOriginal: cheque.fechaRecepcionOriginal,
            fechaCobro: cheque.fechaCobro,
            fechaCobroOriginal: cheque.fechaCobroOriginal,
            fechaDeposito: cheque.fechaDeposito,
            fechaDepositoOriginal: cheque.fechaDepositoOriginal,
            fechaTransferencia: cheque.fechaTransferencia,
            fechaTransferenciaOriginal: cheque.fechaTransferenciaOriginal,
            origen: cheque.origen,
            destino: cheque.destino,
            importe: cheque.importe,
            estado: cheque.estado,
            asientoAsociado: registroAsociado ? registroAsociado.asiento : null
        };

        if (registroAsociado) {
            registroAsociado.chequesAsociados.push(chequeEnriquecido);
        } else {
            chequesNoAsociados.push(chequeEnriquecido);
        }
    }

    // Calcular estado de completitud de cheques para cada registro del debe
    actualizarProgresoCheques(70, 'Calculando estados de asientos...');
    await permitirActualizacionUI();

    registrosDebe.forEach(registro => {
        const sumaCheques = registro.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
        const tolerancia = 0.01;  // Tolerancia de 1 centavo

        if (registro.chequesAsociados.length === 0) {
            registro.estadoCheques = 'sin_cheques';
        } else if (Math.abs(registro.debe - sumaCheques) <= tolerancia) {
            registro.estadoCheques = 'completo';
        } else {
            registro.estadoCheques = 'parcial';
            registro.diferenciaCheques = registro.debe - sumaCheques;
        }
    });

    // Crear registros individuales de cheques para la conciliación
    // Estos reemplazan los registros del debe originales para el proceso de conciliación
    actualizarProgresoCheques(75, 'Creando registros individuales de cheques...');
    await permitirActualizacionUI();

    const registrosCheques = [];

    registrosDebe.forEach(registro => {
        registro.chequesAsociados.forEach(cheque => {
            // Construir descripción enriquecida
            const descripcionParts = [];
            if (cheque.numero) descripcionParts.push(`CHQ ${cheque.numero}`);
            if (cheque.origen) descripcionParts.push(`de ${cheque.origen}`);
            if (cheque.fechaEmision) descripcionParts.push(`em. ${formatearFecha(cheque.fechaEmision)}`);
            if (cheque.estado) descripcionParts.push(`[${cheque.estado}]`);

            const descripcion = descripcionParts.length > 0
                ? descripcionParts.join(' - ')
                : `Cheque ${cheque.interno || cheque.id}`;

            registrosCheques.push({
                id: cheque.id,
                fecha: cheque.fechaRecepcion || cheque.fechaEmision,
                fechaOriginal: formatearFecha(cheque.fechaRecepcion) !== '-' ? formatearFecha(cheque.fechaRecepcion) : formatearFecha(cheque.fechaEmision),
                asiento: registro.asiento,
                descripcion: descripcion,
                debe: cheque.importe,
                haber: 0,
                estado: 'pendiente',
                vinculadoCon: [],
                tipo: 'debe',
                esDevolucion: false,
                esChequeIndividual: true,  // Marcar como cheque individual
                asientoOrigenId: registro.id,  // Referencia al asiento original
                datosChequeFuente: {
                    interno: cheque.interno,
                    numero: cheque.numero,
                    fechaEmision: cheque.fechaEmisionOriginal,
                    fechaRecepcion: cheque.fechaRecepcionOriginal,
                    fechaCobro: cheque.fechaCobroOriginal,
                    fechaDeposito: cheque.fechaDepositoOriginal,
                    fechaTransferencia: cheque.fechaTransferenciaOriginal,
                    origen: cheque.origen,
                    destino: cheque.destino,
                    estado: cheque.estado
                }
            });
        });
    });

    // Los cheques no asociados también se agregan como registros para conciliar
    chequesNoAsociados.forEach(cheque => {
        const descripcionParts = [];
        if (cheque.numero) descripcionParts.push(`CHQ ${cheque.numero}`);
        if (cheque.origen) descripcionParts.push(`de ${cheque.origen}`);
        if (cheque.fechaEmision) descripcionParts.push(`em. ${formatearFecha(cheque.fechaEmision)}`);
        if (cheque.estado) descripcionParts.push(`[${cheque.estado}]`);
        descripcionParts.push('[SIN ASIENTO]');

        registrosCheques.push({
            id: cheque.id,
            fecha: cheque.fechaRecepcion || cheque.fechaEmision,
            fechaOriginal: formatearFecha(cheque.fechaRecepcion) !== '-' ? formatearFecha(cheque.fechaRecepcion) : formatearFecha(cheque.fechaEmision),
            asiento: '',
            descripcion: descripcionParts.join(' - '),
            debe: cheque.importe,
            haber: 0,
            estado: 'pendiente',
            vinculadoCon: [],
            tipo: 'debe',
            esDevolucion: false,
            esChequeIndividual: true,
            asientoOrigenId: null,
            datosChequeFuente: {
                interno: cheque.interno,
                numero: cheque.numero,
                fechaEmision: cheque.fechaEmisionOriginal,
                fechaRecepcion: cheque.fechaRecepcionOriginal,
                fechaCobro: cheque.fechaCobroOriginal,
                fechaDeposito: cheque.fechaDepositoOriginal,
                fechaTransferencia: cheque.fechaTransferenciaOriginal,
                origen: cheque.origen,
                destino: cheque.destino,
                estado: cheque.estado
            }
        });
    });

    // Guardar los registros del debe originales enriquecidos para visualización
    actualizarProgresoCheques(85, 'Organizando registros...');
    await permitirActualizacionUI();

    stateMayores.asientosDebeOriginales = registrosDebe;
    stateMayores.chequesNoAsociados = chequesNoAsociados;

    // Combinar registros de cheques individuales con registros del haber
    // Los cheques individuales son los que se usan para la conciliación
    stateMayores.registrosMayor = [...registrosCheques, ...registrosHaber];

    // Ordenar por fecha
    stateMayores.registrosMayor.sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha - b.fecha;
    });

    // Actualizar estado
    stateMayores.listadoChequesIncorporado = true;
    stateMayores.listadoChequesCargados = [...cheques];
    stateMayores.listadoChequesTemporal = [];

    // Resetear vinculaciones existentes
    stateMayores.vinculaciones = [];
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Actualizar UI
    actualizarProgresoCheques(90, 'Actualizando interfaz...');
    await permitirActualizacionUI();

    actualizarEstadisticasMayor();
    renderizarTablaMayorConAsientos();  // Usar nueva función de renderizado
    analizarVencimientos();
    renderizarVinculacion();

    // Mostrar indicador de listado incorporado
    mostrarIndicadorListadoIncorporado();

    // Actualizar panel del Paso 1 (Conciliación Cheques vs Debe)
    actualizarEstadoListadoCheques();

    // Mostrar filtro de asociaciones parciales
    const filtroParcialesLabel = document.getElementById('filtroParcialesLabel');
    if (filtroParcialesLabel) {
        filtroParcialesLabel.style.display = 'inline';
    }

    // Estadísticas de asociación
    const asientosCompletos = registrosDebe.filter(r => r.estadoCheques === 'completo').length;
    const asientosSinCheques = registrosDebe.filter(r => r.estadoCheques === 'sin_cheques').length;
    const asientosParciales = registrosDebe.filter(r => r.estadoCheques === 'parcial').length;

    actualizarProgresoCheques(100, '¡Completado!');
    await permitirActualizacionUI();

    console.log(`✅ Listado de cheques incorporado:`);
    console.log(`   - ${cheques.length} cheques procesados`);
    console.log(`   - ${asientosCompletos} asientos completos (verde)`);
    console.log(`   - ${asientosParciales} asientos con diferencias (amarillo)`);
    console.log(`   - ${asientosSinCheques} asientos sin cheques (rojo)`);
    console.log(`   - ${chequesNoAsociados.length} cheques sin asiento asociado`);

    // Ocultar progreso y cerrar modal
    ocultarProgresoCheques();
    cerrarCargarListadoCheques();

    alert(`Se incorporaron ${cheques.length} cheques al análisis.\n\n` +
          `📊 Estado de asientos:\n` +
          `✅ ${asientosCompletos} completos\n` +
          `⚠️ ${asientosParciales} con diferencias\n` +
          `❌ ${asientosSinCheques} sin cheques\n\n` +
          `Los cheques individuales están listos para conciliar.`);
}

/**
 * Mostrar indicador de que el listado de cheques fue incorporado
 */
function mostrarIndicadorListadoIncorporado() {
    const infoMayor = document.getElementById('infoMayorCargado');

    // Verificar si ya existe el indicador
    let indicador = document.getElementById('indicadorListadoCheques');

    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorListadoCheques';
        indicador.className = 'listado-cheques-incorporado';
        infoMayor.appendChild(indicador);
    }

    const cantidadCheques = stateMayores.listadoChequesCargados.length;
    const asientos = stateMayores.asientosDebeOriginales || [];
    const asientosCompletos = asientos.filter(a => a.estadoCheques === 'completo').length;
    const asientosParciales = asientos.filter(a => a.estadoCheques === 'parcial').length;
    const asientosSinCheques = asientos.filter(a => a.estadoCheques === 'sin_cheques').length;
    const chequesNoAsociados = (stateMayores.chequesNoAsociados || []).length;

    indicador.innerHTML = `
        <span class="icono">📋</span>
        <span class="texto">
            Listado incorporado: <span class="cantidad">${cantidadCheques} cheques</span> en ${asientos.length} asientos
            <span class="estado-resumen">
                <span class="estado-completo" title="Asientos con todos sus cheques">✅ ${asientosCompletos}</span>
                ${asientosParciales > 0 ? `<span class="estado-parcial" title="Asientos con diferencias">⚠️ ${asientosParciales}</span>` : ''}
                ${asientosSinCheques > 0 ? `<span class="estado-sin" title="Asientos sin cheques asociados">❌ ${asientosSinCheques}</span>` : ''}
                ${chequesNoAsociados > 0 ? `<span class="estado-sin-asiento" title="Cheques sin asiento">📌 ${chequesNoAsociados} s/asiento</span>` : ''}
            </span>
        </span>
    `;
    indicador.style.display = 'flex';
}

/**
 * Ocultar indicador de listado incorporado
 */
function ocultarIndicadorListadoIncorporado() {
    const indicador = document.getElementById('indicadorListadoCheques');
    if (indicador) {
        indicador.style.display = 'none';
    }
}

// ============================================
// FUNCIONES PARA PASOS DE CONCILIACIÓN SEPARADOS
// ============================================

/**
 * Toggle expandir/colapsar Paso 1: Conciliación Cheques vs Debe
 */
function togglePasoChequesDebe() {
    const contenido = document.getElementById('contenidoPaso1');
    const icono = document.getElementById('iconTogglePaso1');
    const btnToggle = contenido.closest('.panel-paso-conciliacion').querySelector('.btn-toggle-paso');

    if (contenido.classList.contains('collapsed')) {
        contenido.classList.remove('collapsed');
        icono.textContent = '▼';
        btnToggle.classList.remove('collapsed');
    } else {
        contenido.classList.add('collapsed');
        icono.textContent = '▶';
        btnToggle.classList.add('collapsed');
    }
}

/**
 * Toggle expandir/colapsar Paso 2: Conciliación Debe vs Haber
 */
function togglePasoVinculacion() {
    const contenido = document.getElementById('contenidoPaso2');
    const icono = document.getElementById('iconTogglePaso2');
    const btnToggle = contenido.closest('.panel-paso-conciliacion').querySelector('.btn-toggle-paso');

    if (contenido.classList.contains('collapsed')) {
        contenido.classList.remove('collapsed');
        icono.textContent = '▼';
        btnToggle.classList.remove('collapsed');
    } else {
        contenido.classList.add('collapsed');
        icono.textContent = '▶';
        btnToggle.classList.add('collapsed');
    }
}

/**
 * Actualizar la visualización del panel de conciliación Paso 1 (Carga de Cheques)
 * y Paso 2 (Conciliación por Mes) según el tipo de mayor seleccionado
 */
function actualizarPanelConciliacionChequesDebe() {
    const panelPaso1 = document.getElementById('panelConciliacionChequesDebe');
    const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
    const tipoMayor = stateMayores.tipoMayorActual;

    // Solo mostrar para cheques_terceros_recibidos
    if (tipoMayor && tipoMayor.id === 'cheques_terceros_recibidos') {
        panelPaso1.style.display = 'block';

        // Mostrar Paso 2 (conciliación por mes) solo si hay listado cargado
        if (stateMayores.listadoChequesIncorporado) {
            panelPaso2Mes.style.display = 'block';
            renderizarListaMeses();
        } else {
            panelPaso2Mes.style.display = 'none';
        }

        // Actualizar número del paso 3 a "3" cuando hay pasos 1 y 2
        const numeroPaso3 = document.getElementById('numeroPasoVinculacion');
        if (numeroPaso3) numeroPaso3.textContent = '3';

        // Actualizar estado del listado de cheques
        actualizarEstadoListadoCheques();

        // NOTA: Los cheques se guardan/cargan junto con la conciliación completa
        // No se verifica listado guardado por separado para evitar confusión
    } else {
        panelPaso1.style.display = 'none';
        panelPaso2Mes.style.display = 'none';

        // Actualizar número del paso a "1" cuando no hay pasos previos
        const numeroPaso3 = document.getElementById('numeroPasoVinculacion');
        if (numeroPaso3) numeroPaso3.textContent = '1';
    }
}

/**
 * Actualizar el estado visual del listado de cheques en el Paso 1
 * NUEVA LÓGICA: El paso 1 solo muestra el estado de carga del listado.
 * Las estadísticas de conciliación se muestran en el Paso 2 por mes.
 */
function actualizarEstadoListadoCheques() {
    const listadoNoCargado = document.getElementById('listadoNoCarado');
    const listadoCargado = document.getElementById('listadoCargado');

    if (stateMayores.listadoChequesIncorporado) {
        // Mostrar estado cargado
        listadoNoCargado.style.display = 'none';
        listadoCargado.style.display = 'flex';

        // Actualizar resumen
        const resumen = document.getElementById('resumenListadoCheques');
        const cantCheques = stateMayores.listadoChequesCargados.length;
        resumen.textContent = `${cantCheques} cheques cargados`;

        // Actualizar resumen de meses disponibles
        const resumenMeses = document.getElementById('resumenMesesDisponibles');
        if (resumenMeses) {
            const meses = stateMayores.mesesDisponibles || [];
            resumenMeses.textContent = `${meses.length} meses disponibles para conciliar`;
        }
    } else {
        // Mostrar estado sin cargar
        listadoNoCargado.style.display = 'flex';
        listadoCargado.style.display = 'none';

        // Ocultar resumen detallado
        const panelResumen = document.getElementById('resumenListadoChequesDetalle');
        if (panelResumen) panelResumen.style.display = 'none';
    }
}

/**
 * Actualizar las estadísticas de conciliación de cheques con registros del debe
 */
function actualizarEstadisticasConciliacionCheques() {
    const asientos = stateMayores.asientosDebeOriginales || [];

    // Calcular estadísticas
    const completos = asientos.filter(a => a.estadoCheques === 'completo').length;
    const parciales = asientos.filter(a => a.estadoCheques === 'parcial').length;
    const sinCheques = asientos.filter(a => a.estadoCheques === 'sin_cheques').length;
    const chequesNoAsoc = (stateMayores.chequesNoAsociados || []).length;

    // Actualizar UI
    document.getElementById('statRegistrosCompletos').textContent = completos;
    document.getElementById('statRegistrosParciales').textContent = parciales;
    document.getElementById('statRegistrosSinCheques').textContent = sinCheques;
    document.getElementById('statChequesNoAsociados').textContent = chequesNoAsoc;
}

/**
 * Renderizar la tabla resumen de asociaciones de cheques con registros del debe
 */
function renderizarTablaResumenAsociaciones() {
    const tbody = document.getElementById('tablaResumenAsociacionesBody');
    const asientos = stateMayores.asientosDebeOriginales || [];
    const soloPendientes = document.getElementById('filtroSoloPendientesCheques')?.checked || false;

    // Filtrar asientos según el checkbox
    const asientosFiltrados = soloPendientes
        ? asientos.filter(a => a.estadoCheques !== 'completo')
        : asientos;

    if (asientosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">
                    ${soloPendientes ? 'No hay registros con diferencias' : 'No hay registros del debe'}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = asientosFiltrados.map(asiento => {
        const sumaCheques = (asiento.chequesAsociados || []).reduce((sum, ch) => sum + ch.importe, 0);
        const diferencia = asiento.debe - sumaCheques;

        let claseEstado = '';
        let textoEstado = '';

        switch (asiento.estadoCheques) {
            case 'completo':
                claseEstado = 'completo';
                textoEstado = '✅ Completo';
                break;
            case 'parcial':
                claseEstado = 'parcial';
                textoEstado = '⚠️ Parcial';
                break;
            case 'sin_cheques':
                claseEstado = 'sin-cheques';
                textoEstado = '❌ Sin cheques';
                break;
            default:
                textoEstado = '-';
        }

        return `
            <tr class="fila-${claseEstado}">
                <td>${formatearFecha(asiento.fecha)}</td>
                <td>${asiento.asiento || '-'}</td>
                <td title="${asiento.descripcion}">${truncarTexto(asiento.descripcion, 40)}</td>
                <td class="text-right debe">${formatearMoneda(asiento.debe)}</td>
                <td class="text-right">${formatearMoneda(sumaCheques)}</td>
                <td class="text-right ${Math.abs(diferencia) > 0.01 ? 'diferencia-warning' : ''}">${formatearMoneda(diferencia)}</td>
                <td><span class="estado-asociacion ${claseEstado}">${textoEstado}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Filtrar la tabla resumen de asociaciones
 */
function filtrarResumenAsociaciones() {
    renderizarTablaResumenAsociaciones();
}

/**
 * Truncar texto a una longitud máxima
 */
function truncarTexto(texto, maxLen) {
    if (!texto) return '';
    return texto.length > maxLen ? texto.substring(0, maxLen) + '...' : texto;
}

/**
 * Actualizar títulos dinámicos del Paso 3 según el tipo de mayor
 */
function actualizarTitulosPasoVinculacion() {
    const config = obtenerConfigVinculacion();
    const tipoMayor = stateMayores.tipoMayorActual;

    const titulo = document.getElementById('tituloPasoVinculacion');
    const descripcion = document.getElementById('descripcionPasoVinculacion');

    if (titulo) {
        titulo.textContent = `🔗 Conciliación: ${config.etiquetaOrigen} vs ${config.etiquetaDestino}`;
    }

    if (descripcion) {
        descripcion.textContent = config.descripcionVinculacion;
    }
}

// ============================================
// FUNCIONES PARA CONCILIACIÓN POR MES (PASO 2)
// ============================================

/**
 * Obtener clave para localStorage del listado de cheques
 */
function getListadoChequesKey() {
    if (!stateMayores.clienteActual) return null;
    return `listado_cheques_${stateMayores.clienteActual.id}`;
}

/**
 * Obtener clave para localStorage de meses procesados
 */
function getMesesProcesadosKey() {
    if (!stateMayores.clienteActual) return null;
    return `meses_procesados_${stateMayores.clienteActual.id}`;
}

/**
 * Guardar el listado de cheques cargado en localStorage
 */
function guardarListadoChequesLocal() {
    const key = getListadoChequesKey();
    if (!key) {
        alert('Debe seleccionar un cliente primero');
        return;
    }

    const cheques = stateMayores.listadoChequesCargados;
    if (cheques.length === 0) {
        alert('No hay cheques cargados para guardar');
        return;
    }

    try {
        const datosGuardar = {
            id: `listado_${Date.now()}`,
            fechaGuardado: new Date().toISOString(),
            cheques: cheques,
            totalCheques: cheques.length,
            totalImporte: cheques.reduce((sum, c) => sum + c.importe, 0),
            meses: calcularMesesDeCheques(cheques)
        };

        localStorage.setItem(key, JSON.stringify(datosGuardar));
        stateMayores.listadoChequesGuardadoId = datosGuardar.id;

        alert(`✅ Listado de ${cheques.length} cheques guardado correctamente.`);
        console.log('💾 Listado de cheques guardado:', datosGuardar);
    } catch (error) {
        console.error('Error guardando listado de cheques:', error);
        alert('Error al guardar el listado: ' + error.message);
    }
}

/**
 * Verificar si hay un listado de cheques guardado y ofrecerlo al cargar
 */
function verificarListadoChequesGuardado() {
    const key = getListadoChequesKey();
    if (!key) return;

    try {
        const datosGuardados = localStorage.getItem(key);
        if (datosGuardados && !stateMayores.listadoChequesIncorporado) {
            const datos = JSON.parse(datosGuardados);
            const fechaGuardado = new Date(datos.fechaGuardado).toLocaleDateString('es-AR');

            if (confirm(`Se encontró un listado de cheques guardado:\n\n` +
                       `📋 ${datos.totalCheques} cheques\n` +
                       `💰 ${formatearMoneda(datos.totalImporte)} total\n` +
                       `📅 Guardado el ${fechaGuardado}\n\n` +
                       `¿Desea cargar este listado?`)) {
                cargarListadoChequesDesdeLocal(datos);
            }
        }
    } catch (error) {
        console.error('Error verificando listado guardado:', error);
    }
}

/**
 * Cargar un listado de cheques desde localStorage
 */
function cargarListadoChequesDesdeLocal(datos) {
    stateMayores.listadoChequesCargados = datos.cheques;
    stateMayores.listadoChequesIncorporado = true;
    stateMayores.listadoChequesGuardadoId = datos.id;
    stateMayores.mesesDisponibles = datos.meses || calcularMesesDeCheques(datos.cheques);

    // Cargar meses procesados si existen
    cargarMesesProcesados();

    // Actualizar UI
    actualizarEstadoListadoCheques();
    actualizarResumenListadoCheques();

    // Mostrar panel de conciliación por mes
    const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
    if (panelPaso2Mes) {
        panelPaso2Mes.style.display = 'block';
        renderizarListaMeses();
    }

    console.log('📂 Listado de cheques cargado desde localStorage:', datos);
}

/**
 * Calcular los meses disponibles a partir de los cheques cargados
 */
function calcularMesesDeCheques(cheques) {
    const mesesSet = new Set();

    cheques.forEach(cheque => {
        const fecha = cheque.fechaRecepcion || cheque.fechaEmision;
        if (fecha) {
            const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
            if (!isNaN(fechaDate.getTime())) {
                const mesKey = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
                mesesSet.add(mesKey);
            }
        }
    });

    return Array.from(mesesSet).sort();
}

/**
 * Actualizar el resumen del listado de cheques cargado
 */
function actualizarResumenListadoCheques() {
    const cheques = stateMayores.listadoChequesCargados;
    const meses = stateMayores.mesesDisponibles || calcularMesesDeCheques(cheques);

    // Actualizar resumen en el paso 1
    const resumenEl = document.getElementById('resumenListadoCheques');
    if (resumenEl) {
        resumenEl.textContent = `${cheques.length} cheques cargados`;
    }

    const resumenMeses = document.getElementById('resumenMesesDisponibles');
    if (resumenMeses) {
        resumenMeses.textContent = `${meses.length} meses disponibles para conciliar`;
    }

    // Actualizar estadísticas detalladas
    const totalCheques = document.getElementById('totalChequesCargados');
    if (totalCheques) totalCheques.textContent = cheques.length;

    const totalImporte = document.getElementById('totalImporteCheques');
    if (totalImporte) totalImporte.textContent = formatearMoneda(cheques.reduce((sum, c) => sum + c.importe, 0));

    const totalMeses = document.getElementById('totalMesesCheques');
    if (totalMeses) totalMeses.textContent = meses.length;

    // Mostrar panel de resumen
    const panelResumen = document.getElementById('resumenListadoChequesDetalle');
    if (panelResumen) panelResumen.style.display = 'block';
}

/**
 * Cargar meses procesados desde localStorage
 */
function cargarMesesProcesados() {
    const key = getMesesProcesadosKey();
    if (!key) return;

    try {
        const datos = localStorage.getItem(key);
        if (datos) {
            const mesesCargados = JSON.parse(datos);
            // Restaurar mesesProcesados (soporta formato optimizado con IDs)
            stateMayores.mesesProcesados = restaurarMesesProcesadosDesdeDatos(
                mesesCargados,
                stateMayores.listadoChequesCargados
            );
            console.log('📂 Meses procesados cargados:', Object.keys(stateMayores.mesesProcesados).length);
        }
    } catch (error) {
        console.error('Error cargando meses procesados:', error);
        stateMayores.mesesProcesados = {};
    }
}

/**
 * Guardar meses procesados en localStorage (versión optimizada)
 */
function guardarMesesProcesados() {
    const key = getMesesProcesadosKey();
    if (!key) return;

    try {
        // Optimizar antes de guardar (solo IDs en lugar de objetos completos)
        const mesesOptimizados = optimizarMesesProcesadosParaGuardado(stateMayores.mesesProcesados);
        localStorage.setItem(key, JSON.stringify(mesesOptimizados));
        console.log('💾 Meses procesados guardados (optimizado)');
    } catch (error) {
        console.error('Error guardando meses procesados:', error);
    }
}

// ============================================
// FUNCIONES PARA IMPORTAR CHEQUES DESDE EXCEL
// ============================================

// Variable temporal para almacenar los cheques a importar
let chequesParaImportar = [];

/**
 * Mostrar modal para importar cheques desde Excel
 */
function mostrarModalImportarChequesExcel() {
    // Verificar que hay un mayor cargado
    if (stateMayores.registrosMayor.length === 0) {
        alert('Primero debe cargar un mayor contable antes de importar cheques.');
        return;
    }

    // Verificar que el listado está iniciado
    if (!stateMayores.listadoChequesIncorporado) {
        // Iniciar listado vacío automáticamente
        stateMayores.listadoChequesIncorporado = true;
        stateMayores.listadoChequesCargados = [];
        stateMayores.mesesDisponibles = [];
        stateMayores.mesesProcesados = {};
        actualizarEstadoListadoCheques();
    }

    // Limpiar estado anterior
    chequesParaImportar = [];
    document.getElementById('archivoImportarCheques').value = '';
    document.getElementById('previewImportacionCheques').style.display = 'none';
    document.getElementById('resumenImportacionCheques').style.display = 'none';
    document.getElementById('btnConfirmarImportacion').disabled = true;

    // Ocultar mensaje de error
    const errorEl = document.getElementById('errorImportarCheques');
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }

    // Mostrar modal
    document.getElementById('modalImportarChequesExcel').classList.remove('hidden');
}

/**
 * Cerrar modal de importar cheques desde Excel
 */
function cerrarModalImportarChequesExcel() {
    document.getElementById('modalImportarChequesExcel').classList.add('hidden');
    chequesParaImportar = [];
}

/**
 * Previsualizar los cheques del archivo Excel seleccionado
 * @param {HTMLInputElement} input - Input de archivo
 */
function previsualizarImportacionCheques(input) {
    const file = input.files[0];
    const previewPanel = document.getElementById('previewImportacionCheques');
    const infoPreview = document.getElementById('infoPreviewImportacion');
    const resumenPanel = document.getElementById('resumenImportacionCheques');
    const btnConfirmar = document.getElementById('btnConfirmarImportacion');
    const errorEl = document.getElementById('errorImportarCheques');

    if (!file) {
        previewPanel.style.display = 'none';
        resumenPanel.style.display = 'none';
        btnConfirmar.disabled = true;
        return;
    }

    // Mostrar loading
    previewPanel.style.display = 'block';
    infoPreview.innerHTML = '<strong>Procesando archivo...</strong>';
    resumenPanel.style.display = 'none';
    btnConfirmar.disabled = true;
    errorEl.style.display = 'none';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                infoPreview.innerHTML = '<span style="color: red;">El archivo no contiene datos.</span>';
                return;
            }

            // Procesar los cheques del Excel
            const chequesExcel = procesarDatosListadoCheques(jsonData);

            // Verificar duplicados usando la columna "interno"
            const internosExistentes = new Set(
                stateMayores.listadoChequesCargados
                    .filter(c => c.interno && c.interno.toString().trim() !== '')
                    .map(c => c.interno.toString().trim().toLowerCase())
            );

            // Separar cheques nuevos y duplicados
            const chequesNuevos = [];
            const chequesDuplicados = [];
            const internosEnExcel = new Set();

            chequesExcel.forEach(cheque => {
                const internoNormalizado = cheque.interno ? cheque.interno.toString().trim().toLowerCase() : '';

                // Verificar si ya existe en el listado actual
                if (internoNormalizado && internosExistentes.has(internoNormalizado)) {
                    chequesDuplicados.push(cheque);
                }
                // Verificar si es duplicado dentro del mismo Excel
                else if (internoNormalizado && internosEnExcel.has(internoNormalizado)) {
                    chequesDuplicados.push(cheque);
                }
                else {
                    chequesNuevos.push(cheque);
                    if (internoNormalizado) {
                        internosEnExcel.add(internoNormalizado);
                    }
                }
            });

            // Guardar cheques para importar
            chequesParaImportar = chequesNuevos;

            // Mostrar información del archivo
            const headers = Object.keys(jsonData[0]);
            infoPreview.innerHTML = `
                <strong>Archivo procesado correctamente</strong><br>
                Columnas detectadas: ${headers.join(', ')}
            `;

            // Actualizar resumen
            document.getElementById('chequesEnExcel').textContent = chequesExcel.length;
            document.getElementById('chequesExistentes').textContent = stateMayores.listadoChequesCargados.length;
            document.getElementById('chequesNuevos').textContent = chequesNuevos.length;
            document.getElementById('chequesDuplicados').textContent = chequesDuplicados.length;

            // Mostrar lista de cheques nuevos a agregar
            const listaChequesEl = document.getElementById('listaChequesNuevos');
            if (chequesNuevos.length > 0) {
                const totalImporteNuevos = chequesNuevos.reduce((sum, c) => sum + c.importe, 0);
                listaChequesEl.innerHTML = `
                    <div class="info-box" style="background: #f0fdf4; border-color: #86efac;">
                        <strong>Cheques a agregar:</strong> ${chequesNuevos.length} cheques por un total de ${formatearMoneda(totalImporteNuevos)}
                    </div>
                    <table class="tabla-preview-cheques" style="width: 100%; font-size: 12px; margin-top: 10px;">
                        <thead>
                            <tr style="background: #f3f4f6;">
                                <th style="padding: 4px; text-align: left;">Interno</th>
                                <th style="padding: 4px; text-align: left;">Número</th>
                                <th style="padding: 4px; text-align: right;">Importe</th>
                                <th style="padding: 4px; text-align: left;">Origen</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${chequesNuevos.slice(0, 10).map(c => `
                                <tr>
                                    <td style="padding: 4px;">${c.interno || '-'}</td>
                                    <td style="padding: 4px;">${c.numero || '-'}</td>
                                    <td style="padding: 4px; text-align: right;">${formatearMoneda(c.importe)}</td>
                                    <td style="padding: 4px;">${c.origen || '-'}</td>
                                </tr>
                            `).join('')}
                            ${chequesNuevos.length > 10 ? `
                                <tr>
                                    <td colspan="4" style="padding: 4px; text-align: center; font-style: italic; color: #666;">
                                        ... y ${chequesNuevos.length - 10} cheques más
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                `;
                btnConfirmar.disabled = false;
            } else {
                listaChequesEl.innerHTML = `
                    <div class="info-box" style="background: #fef3c7; border-color: #fcd34d;">
                        <strong>No hay cheques nuevos para agregar.</strong> Todos los cheques del archivo ya existen en el listado actual (verificado por columna "Interno").
                    </div>
                `;
                btnConfirmar.disabled = true;
            }

            // Mostrar advertencia de duplicados si hay
            if (chequesDuplicados.length > 0) {
                listaChequesEl.innerHTML += `
                    <div class="info-box mt-2" style="background: #fef2f2; border-color: #fca5a5; margin-top: 10px;">
                        <strong>Cheques omitidos (duplicados):</strong> ${chequesDuplicados.length} cheques no se agregarán porque ya existen en el listado.
                        <details style="margin-top: 5px;">
                            <summary style="cursor: pointer; color: #dc2626;">Ver cheques duplicados</summary>
                            <ul style="margin-top: 5px; padding-left: 20px; font-size: 11px;">
                                ${chequesDuplicados.slice(0, 10).map(c => `
                                    <li>Interno: ${c.interno || '-'} | Nro: ${c.numero || '-'} | ${formatearMoneda(c.importe)}</li>
                                `).join('')}
                                ${chequesDuplicados.length > 10 ? `<li>... y ${chequesDuplicados.length - 10} más</li>` : ''}
                            </ul>
                        </details>
                    </div>
                `;
            }

            resumenPanel.style.display = 'block';

        } catch (error) {
            console.error('Error leyendo archivo de cheques:', error);
            infoPreview.innerHTML = '<span style="color: red;">Error al leer el archivo: ' + error.message + '</span>';
            resumenPanel.style.display = 'none';
            btnConfirmar.disabled = true;
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Confirmar e importar los cheques al listado
 */
function confirmarImportacionCheques() {
    if (chequesParaImportar.length === 0) {
        alert('No hay cheques nuevos para importar.');
        return;
    }

    // Marcar los cheques como importados desde Excel
    const chequesConMarca = chequesParaImportar.map(cheque => ({
        ...cheque,
        id: `cheque_importado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agregadoManualmente: false,
        importadoDesdeExcel: true
    }));

    // Agregar cheques al listado existente
    stateMayores.listadoChequesCargados.push(...chequesConMarca);

    // Recalcular meses disponibles
    stateMayores.mesesDisponibles = calcularMesesDeCheques(stateMayores.listadoChequesCargados);

    // Actualizar UI
    actualizarEstadoListadoCheques();
    actualizarResumenListadoCheques();

    // Actualizar lista de meses
    const panelPaso2Mes = document.getElementById('panelConciliacionPorMes');
    if (panelPaso2Mes) {
        panelPaso2Mes.style.display = 'block';
        renderizarListaMeses();
    }

    // Si hay un mes seleccionado, actualizar su vista también
    if (stateMayores.mesSeleccionado) {
        renderizarConciliacionMes(stateMayores.mesSeleccionado);
    }

    const totalImporte = chequesConMarca.reduce((sum, c) => sum + c.importe, 0);
    console.log(`✅ Importados ${chequesConMarca.length} cheques desde Excel por un total de ${formatearMoneda(totalImporte)}`);

    // Cerrar modal
    cerrarModalImportarChequesExcel();

    // Mostrar confirmación
    alert(`✅ Importación completada:\n\n${chequesConMarca.length} cheques agregados\nImporte total: ${formatearMoneda(totalImporte)}\n\nTotal de cheques en listado: ${stateMayores.listadoChequesCargados.length}`);
}

// ============================================
// FUNCIONES PARA ELIMINAR MOVIMIENTOS DEL MAYOR
// ============================================

/**
 * Mostrar modal para eliminar un movimiento del mayor
 * @param {string} movimientoId - ID del movimiento a eliminar
 */
function mostrarModalEliminarMovimiento(movimientoId) {
    const registro = stateMayores.registrosMayor.find(r => r.id === movimientoId);

    if (!registro) {
        alert('No se encontró el movimiento seleccionado.');
        return;
    }

    // Llenar información del movimiento
    document.getElementById('elimMovFecha').textContent = formatearFecha(registro.fecha);
    document.getElementById('elimMovAsiento').textContent = registro.asiento || '-';
    document.getElementById('elimMovDescripcion').textContent = registro.descripcion || '-';

    const importe = registro.debe > 0 ? registro.debe : registro.haber;
    const tipoImporte = registro.debe > 0 ? 'Debe' : 'Haber';
    document.getElementById('elimMovImporte').textContent = `${formatearMoneda(importe)} (${tipoImporte})`;

    // Guardar ID del movimiento a eliminar
    document.getElementById('movimientoAEliminarId').value = movimientoId;

    // Limpiar nota
    document.getElementById('notaEliminacion').value = '';

    // Mostrar modal
    document.getElementById('modalEliminarMovimiento').classList.remove('hidden');
}

/**
 * Cerrar modal de eliminar movimiento
 */
function cerrarModalEliminarMovimiento() {
    document.getElementById('modalEliminarMovimiento').classList.add('hidden');
    document.getElementById('movimientoAEliminarId').value = '';
    document.getElementById('notaEliminacion').value = '';
}

/**
 * Confirmar y ejecutar la eliminación del movimiento
 */
function confirmarEliminarMovimiento() {
    const movimientoId = document.getElementById('movimientoAEliminarId').value;
    const nota = document.getElementById('notaEliminacion').value.trim();

    if (!movimientoId) {
        alert('Error: No se especificó el movimiento a eliminar.');
        return;
    }

    // Buscar el movimiento
    const indice = stateMayores.registrosMayor.findIndex(r => r.id === movimientoId);

    if (indice === -1) {
        alert('Error: No se encontró el movimiento en el mayor.');
        cerrarModalEliminarMovimiento();
        return;
    }

    const registro = stateMayores.registrosMayor[indice];

    // Crear registro de movimiento eliminado
    const movimientoEliminado = {
        id: `elim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        movimientoOriginal: { ...registro },
        fechaEliminacion: new Date().toISOString(),
        nota: nota || 'Sin nota',
        eliminadoPor: 'Usuario'  // Podría expandirse para incluir info del usuario
    };

    // Agregar a la lista de eliminados
    stateMayores.movimientosEliminados.push(movimientoEliminado);

    // Eliminar del array de registros del mayor
    stateMayores.registrosMayor.splice(indice, 1);

    // Si el registro estaba vinculado, deshacer las vinculaciones
    if (registro.vinculadoCon && registro.vinculadoCon.length > 0) {
        registro.vinculadoCon.forEach(vinculadoId => {
            const regVinculado = stateMayores.registrosMayor.find(r => r.id === vinculadoId);
            if (regVinculado && regVinculado.vinculadoCon) {
                regVinculado.vinculadoCon = regVinculado.vinculadoCon.filter(id => id !== movimientoId);
                if (regVinculado.vinculadoCon.length === 0) {
                    regVinculado.estado = 'pendiente';
                }
            }
        });

        // Eliminar vinculación del array principal
        stateMayores.vinculaciones = stateMayores.vinculaciones.filter(v =>
            !v.origenes.includes(movimientoId) && !v.destinos.includes(movimientoId)
        );
    }

    // Actualizar mesesProcesados si el registro pertenece a un mes procesado
    if (registro.fecha && stateMayores.mesesProcesados) {
        const fechaRegistro = registro.fecha instanceof Date ? registro.fecha : new Date(registro.fecha);
        const mesKey = `${fechaRegistro.getFullYear()}-${String(fechaRegistro.getMonth() + 1).padStart(2, '0')}`;
        const estadoMes = stateMayores.mesesProcesados[mesKey];

        if (estadoMes && estadoMes.asientosDelMes) {
            // Buscar el asiento en asientosDelMes
            const indiceAsiento = estadoMes.asientosDelMes.findIndex(a => a.id === movimientoId);

            if (indiceAsiento !== -1) {
                const asientoEliminado = estadoMes.asientosDelMes[indiceAsiento];

                // Si el asiento tenía cheques asociados, devolverlos a chequesNoAsociadosDelMes
                if (asientoEliminado.chequesAsociados && asientoEliminado.chequesAsociados.length > 0) {
                    if (!estadoMes.chequesNoAsociadosDelMes) {
                        estadoMes.chequesNoAsociadosDelMes = [];
                    }
                    estadoMes.chequesNoAsociadosDelMes.push(...asientoEliminado.chequesAsociados);
                    console.log(`↩️ Devueltos ${asientoEliminado.chequesAsociados.length} cheques a no asociados del mes ${mesKey}`);
                }

                // Eliminar el asiento del mes
                estadoMes.asientosDelMes.splice(indiceAsiento, 1);
                console.log(`🗓️ Asiento eliminado de mesesProcesados[${mesKey}]`);

                // Si es el mes actual, re-renderizar el panel de asociaciones
                if (stateMayores.mesActualConciliacion === mesKey) {
                    renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes || []);
                }
            }
        }
    }

    // Actualizar UI
    actualizarContadorEliminados();
    renderizarTablaMayor();
    actualizarEstadisticasMayor();

    // Actualizar panel de vinculación para reflejar el registro eliminado
    renderizarVinculacion();

    console.log(`🗑️ Movimiento eliminado: ${registro.asiento} - ${registro.descripcion}`);

    // Cerrar modal
    cerrarModalEliminarMovimiento();

    // Mostrar notificación
    mostrarNotificacion(`Movimiento eliminado correctamente. ${nota ? 'Nota: ' + nota : ''}`);
}

/**
 * Actualizar contador de movimientos eliminados en la toolbar
 */
function actualizarContadorEliminados() {
    const contador = stateMayores.movimientosEliminados.length;
    const contadorEl = document.getElementById('contadorEliminados');
    const btnVerEliminados = document.getElementById('btnVerEliminados');

    if (contadorEl) {
        contadorEl.textContent = contador;
    }

    // Mostrar/ocultar botón según si hay eliminados
    if (btnVerEliminados) {
        btnVerEliminados.style.display = contador > 0 ? 'inline-flex' : 'none';
    }
}

/**
 * Mostrar modal de movimientos eliminados
 */
function mostrarModalMovimientosEliminados() {
    renderizarTablaMovimientosEliminados();
    document.getElementById('modalMovimientosEliminados').classList.remove('hidden');
}

/**
 * Cerrar modal de movimientos eliminados
 */
function cerrarModalMovimientosEliminados() {
    document.getElementById('modalMovimientosEliminados').classList.add('hidden');
}

/**
 * Renderizar tabla de movimientos eliminados
 */
function renderizarTablaMovimientosEliminados() {
    const tbody = document.getElementById('tablaMovimientosEliminadosBody');
    const eliminados = stateMayores.movimientosEliminados;
    const btnExportar = document.getElementById('btnExportarEliminados');

    // Actualizar resumen
    document.getElementById('totalMovimientosEliminados').textContent = eliminados.length;

    const totalImporte = eliminados.reduce((sum, e) => {
        const mov = e.movimientoOriginal;
        return sum + (mov.debe > 0 ? mov.debe : mov.haber);
    }, 0);
    document.getElementById('totalImporteEliminado').textContent = formatearMoneda(totalImporte);

    // Habilitar/deshabilitar botón exportar
    if (btnExportar) {
        btnExportar.disabled = eliminados.length === 0;
    }

    if (eliminados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="text-align: center; padding: 20px;">No hay movimientos eliminados</td></tr>`;
        return;
    }

    tbody.innerHTML = eliminados.map(e => {
        const mov = e.movimientoOriginal;
        const fechaElim = new Date(e.fechaEliminacion).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <tr data-id="${e.id}">
            <td class="fecha-eliminacion">${fechaElim}</td>
            <td>${formatearFecha(mov.fecha)}</td>
            <td>${mov.asiento || '-'}</td>
            <td title="${mov.descripcion}">${truncarTexto(mov.descripcion, 30)}</td>
            <td class="text-right" style="color: #dc2626;">${mov.debe > 0 ? formatearMoneda(mov.debe) : ''}</td>
            <td class="text-right" style="color: #16a34a;">${mov.haber > 0 ? formatearMoneda(mov.haber) : ''}</td>
            <td class="nota-eliminacion" title="${e.nota}">${truncarTexto(e.nota, 25)}</td>
            <td class="acciones-col">
                <button class="btn-restaurar-mov" onclick="restaurarMovimiento('${e.id}')" title="Restaurar movimiento">↩️</button>
            </td>
        </tr>
        `;
    }).join('');
}

/**
 * Restaurar un movimiento eliminado
 * @param {string} eliminadoId - ID del registro de eliminación
 */
function restaurarMovimiento(eliminadoId) {
    const indice = stateMayores.movimientosEliminados.findIndex(e => e.id === eliminadoId);

    if (indice === -1) {
        alert('Error: No se encontró el movimiento eliminado.');
        return;
    }

    const eliminado = stateMayores.movimientosEliminados[indice];
    const movimiento = eliminado.movimientoOriginal;

    // Restaurar al array de registros del mayor
    // Resetear estado de vinculación ya que las vinculaciones fueron deshechas
    movimiento.estado = 'pendiente';
    movimiento.vinculadoCon = [];

    stateMayores.registrosMayor.push(movimiento);

    // Ordenar por fecha
    stateMayores.registrosMayor.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Eliminar de la lista de eliminados
    stateMayores.movimientosEliminados.splice(indice, 1);

    // Actualizar UI
    actualizarContadorEliminados();
    renderizarTablaMovimientosEliminados();
    renderizarTablaMayor();
    actualizarEstadisticas();

    console.log(`↩️ Movimiento restaurado: ${movimiento.asiento} - ${movimiento.descripcion}`);

    // Mostrar notificación
    mostrarNotificacion('Movimiento restaurado correctamente.');
}

/**
 * Exportar movimientos eliminados a Excel
 */
function exportarMovimientosEliminados() {
    const eliminados = stateMayores.movimientosEliminados;

    if (eliminados.length === 0) {
        alert('No hay movimientos eliminados para exportar.');
        return;
    }

    // Preparar datos para Excel
    const datosExcel = eliminados.map(e => {
        const mov = e.movimientoOriginal;
        return {
            'Fecha Eliminación': new Date(e.fechaEliminacion).toLocaleDateString('es-AR'),
            'Hora Eliminación': new Date(e.fechaEliminacion).toLocaleTimeString('es-AR'),
            'Fecha Movimiento': formatearFecha(mov.fecha),
            'Asiento': mov.asiento || '',
            'Descripción': mov.descripcion || '',
            'Debe': mov.debe > 0 ? mov.debe : '',
            'Haber': mov.haber > 0 ? mov.haber : '',
            'Nota de Eliminación': e.nota || ''
        };
    });

    // Crear libro de Excel
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos Eliminados');

    // Ajustar anchos de columna
    ws['!cols'] = [
        { wch: 15 }, // Fecha Eliminación
        { wch: 12 }, // Hora Eliminación
        { wch: 15 }, // Fecha Movimiento
        { wch: 12 }, // Asiento
        { wch: 40 }, // Descripción
        { wch: 15 }, // Debe
        { wch: 15 }, // Haber
        { wch: 40 }  // Nota
    ];

    // Generar nombre de archivo
    const clienteNombre = stateMayores.clienteActual?.nombre || 'cliente';
    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = `movimientos_eliminados_${clienteNombre}_${fecha}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);

    console.log(`📥 Exportados ${eliminados.length} movimientos eliminados a ${nombreArchivo}`);
}

/**
 * Renderizar la lista de meses disponibles para conciliar
 */
function renderizarListaMeses() {
    const container = document.getElementById('listaMesesConciliacion');
    if (!container) return;

    const cheques = stateMayores.listadoChequesCargados;
    const meses = stateMayores.mesesDisponibles || calcularMesesDeCheques(cheques);
    stateMayores.mesesDisponibles = meses;

    if (meses.length === 0) {
        container.innerHTML = `
            <div class="empty-state-meses">
                <p>No hay meses disponibles. Cargue un listado de cheques primero.</p>
            </div>
        `;
        return;
    }

    // Agrupar cheques por mes
    const chequesPorMes = {};
    cheques.forEach(cheque => {
        const fecha = cheque.fechaRecepcion || cheque.fechaEmision;
        if (fecha) {
            const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
            if (!isNaN(fechaDate.getTime())) {
                const mesKey = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
                if (!chequesPorMes[mesKey]) {
                    chequesPorMes[mesKey] = [];
                }
                chequesPorMes[mesKey].push(cheque);
            }
        }
    });

    container.innerHTML = meses.map(mesKey => {
        const chequesDelMes = chequesPorMes[mesKey] || [];
        const totalImporte = chequesDelMes.reduce((sum, c) => sum + c.importe, 0);
        const estadoMes = stateMayores.mesesProcesados[mesKey];

        // Determinar estado visual
        let claseEstado = '';
        let textoEstado = 'Pendiente';
        if (estadoMes) {
            if (estadoMes.completo) {
                claseEstado = 'procesado';
                textoEstado = '✅ Completo';
            } else if (estadoMes.procesado) {
                claseEstado = 'con-pendientes';
                textoEstado = `⚠️ ${estadoMes.pendientes || 0} pendientes`;
            }
        }

        // Formatear nombre del mes
        const [anio, mes] = mesKey.split('-');
        const nombreMes = new Date(anio, parseInt(mes) - 1, 1).toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric'
        });

        return `
            <div class="mes-card ${claseEstado}" onclick="seleccionarMesConciliacion('${mesKey}')">
                <div class="mes-card-nombre">${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</div>
                <div class="mes-card-stats">
                    <div class="stat-row">
                        <span>Cheques:</span>
                        <span><strong>${chequesDelMes.length}</strong></span>
                    </div>
                    <div class="stat-row">
                        <span>Importe:</span>
                        <span><strong>${formatearMoneda(totalImporte)}</strong></span>
                    </div>
                </div>
                <span class="mes-card-estado ${claseEstado ? claseEstado : 'pendiente'}">${textoEstado}</span>
            </div>
        `;
    }).join('');
}

/**
 * Toggle expandir/colapsar Paso 2: Conciliación por Mes
 */
function togglePasoConciliacionPorMes() {
    const contenido = document.getElementById('contenidoPaso2Mes');
    const icono = document.getElementById('iconTogglePaso2Mes');
    const btnToggle = contenido.closest('.panel-paso-conciliacion').querySelector('.btn-toggle-paso');

    if (contenido.classList.contains('collapsed')) {
        contenido.classList.remove('collapsed');
        icono.textContent = '▼';
        btnToggle.classList.remove('collapsed');
    } else {
        contenido.classList.add('collapsed');
        icono.textContent = '▶';
        btnToggle.classList.add('collapsed');
    }
}

/**
 * Seleccionar un mes para conciliación
 */
function seleccionarMesConciliacion(mesKey) {
    stateMayores.mesActualConciliacion = mesKey;

    // Mostrar panel del mes seleccionado
    const panel = document.getElementById('panelMesSeleccionado');
    if (panel) panel.style.display = 'block';

    // Actualizar nombre del mes
    const [anio, mes] = mesKey.split('-');
    const nombreMes = new Date(anio, parseInt(mes) - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric'
    });
    const nombreEl = document.getElementById('nombreMesSeleccionado');
    if (nombreEl) nombreEl.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

    // Marcar visualmente el mes seleccionado
    document.querySelectorAll('.mes-card').forEach(card => {
        card.classList.remove('procesando');
    });
    const cardSeleccionada = document.querySelector(`.mes-card[onclick*="${mesKey}"]`);
    if (cardSeleccionada) cardSeleccionada.classList.add('procesando');

    // Verificar si ya hay datos procesados para este mes
    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (estadoMes && estadoMes.asientosDelMes) {
        // Verificar si hay nuevos cheques que se agregaron después de procesar el mes
        const chequesActualesDelMes = obtenerChequesDelMes(mesKey);
        const idsChequesEnEstado = new Set([
            ...(estadoMes.chequesDelMes || []).map(c => c.id || c.interno),
            ...(estadoMes.chequesNoAsociadosDelMes || []).map(c => c.id || c.interno),
            ...estadoMes.asientosDelMes.flatMap(a => (a.chequesAsociados || []).map(c => c.id || c.interno))
        ]);

        // Filtrar cheques nuevos que no están en el estado
        const chequesNuevos = chequesActualesDelMes.filter(c => !idsChequesEnEstado.has(c.id || c.interno));

        if (chequesNuevos.length > 0) {
            // Agregar los nuevos cheques a chequesNoAsociadosDelMes
            estadoMes.chequesDelMes = [...(estadoMes.chequesDelMes || []), ...chequesNuevos];
            estadoMes.chequesNoAsociadosDelMes = [...(estadoMes.chequesNoAsociadosDelMes || []), ...chequesNuevos];
            console.log(`📥 Se agregaron ${chequesNuevos.length} cheques nuevos al mes ${mesKey}`);
        }

        // Verificar si hay cheques de meses anteriores que ahora están disponibles
        // (por ejemplo, si se desvincularon en otro mes)
        const chequesAnterioresActuales = obtenerChequesNoVinculadosMesesAnteriores(mesKey);
        const chequesAnterioresNuevos = chequesAnterioresActuales.filter(c => !idsChequesEnEstado.has(c.id || c.interno));

        if (chequesAnterioresNuevos.length > 0) {
            estadoMes.chequesNoAsociadosDelMes = [...(estadoMes.chequesNoAsociadosDelMes || []), ...chequesAnterioresNuevos];
            console.log(`📥 Se agregaron ${chequesAnterioresNuevos.length} cheques de meses anteriores al mes ${mesKey}`);
        }

        // Verificar si hay registros eliminados que aún están en asientosDelMes
        // Obtener IDs de registros actuales en el mayor (no eliminados)
        const idsRegistrosMayor = new Set(stateMayores.registrosMayor.map(r => r.id));
        const asientosAntesDeFiltar = estadoMes.asientosDelMes.length;

        // Filtrar asientos que ya no existen en el mayor (fueron eliminados)
        estadoMes.asientosDelMes = estadoMes.asientosDelMes.filter(asiento => {
            if (idsRegistrosMayor.has(asiento.id)) {
                return true; // El registro sigue existiendo
            }
            // El registro fue eliminado, devolver sus cheques asociados a no asociados
            if (asiento.chequesAsociados && asiento.chequesAsociados.length > 0) {
                if (!estadoMes.chequesNoAsociadosDelMes) {
                    estadoMes.chequesNoAsociadosDelMes = [];
                }
                estadoMes.chequesNoAsociadosDelMes.push(...asiento.chequesAsociados);
                console.log(`↩️ Devueltos ${asiento.chequesAsociados.length} cheques del registro eliminado ${asiento.asiento || asiento.id}`);
            }
            return false; // Eliminar este asiento del panel
        });

        const asientosEliminados = asientosAntesDeFiltar - estadoMes.asientosDelMes.length;
        if (asientosEliminados > 0) {
            console.log(`🗑️ Se filtraron ${asientosEliminados} registros eliminados del mes ${mesKey}`);
        }

        // Cargar estado guardado (ahora con los nuevos cheques si los hay)
        renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes || []);
    } else {
        // Preparar datos para conciliación
        prepararConciliacionMes(mesKey);
    }
}

/**
 * Obtener cheques que corresponden a un mes específico
 * @param {string} mesKey - Clave del mes en formato YYYY-MM
 * @returns {Array} - Cheques del mes
 */
function obtenerChequesDelMes(mesKey) {
    const cheques = stateMayores.listadoChequesCargados || [];
    return cheques.filter(cheque => {
        const fecha = cheque.fechaRecepcion || cheque.fechaEmision;
        if (!fecha) return false;
        const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(fechaDate.getTime())) return false;
        const mesKeyCheque = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
        return mesKeyCheque === mesKey;
    });
}

/**
 * Obtener cheques no vinculados de meses anteriores al mes indicado
 * @param {string} mesKey - Clave del mes en formato YYYY-MM
 * @returns {Array} - Cheques no vinculados de meses anteriores con indicador de mes origen
 */
function obtenerChequesNoVinculadosMesesAnteriores(mesKey) {
    const chequesAnteriores = [];
    const mesesProcesados = stateMayores.mesesProcesados || {};
    const mesesDisponibles = stateMayores.mesesDisponibles || [];
    const todosLosCheques = stateMayores.listadoChequesCargados || [];

    // Filtrar meses anteriores al mes actual
    const mesesAnterioresKeys = mesesDisponibles.filter(mes => mes < mesKey);
    const chequesYaAgregadosIds = new Set();

    // Crear un Set de IDs de cheques que ya están vinculados en algún asiento
    const chequesVinculadosIds = new Set();
    Object.values(mesesProcesados).forEach(estadoMes => {
        if (estadoMes && estadoMes.asientosDelMes) {
            estadoMes.asientosDelMes.forEach(asiento => {
                if (asiento.chequesAsociados) {
                    asiento.chequesAsociados.forEach(ch => {
                        chequesVinculadosIds.add(ch.id || ch.interno);
                    });
                }
            });
        }
    });

    mesesAnterioresKeys.forEach(mesAnterior => {
        // Siempre buscar cheques del mes específico directamente del listado principal
        // para obtener el estado más actualizado
        const chequesDelMesAnterior = todosLosCheques.filter(cheque => {
            const fecha = cheque.fechaRecepcion || cheque.fechaEmision;
            if (!fecha) return false;
            const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
            if (isNaN(fechaDate.getTime())) return false;
            const mesKeyCheque = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
            return mesKeyCheque === mesAnterior;
        });

        chequesDelMesAnterior.forEach(cheque => {
            const chequeId = cheque.id || cheque.interno;
            // Solo agregar si no está vinculado en algún mes procesado
            // IMPORTANTE: No usamos cheque.asientoAsociado porque puede estar seteado por la
            // vinculación automática durante la importación, que no respeta los límites de meses.
            // Solo consideramos vinculados los cheques que están en asientos de mesesProcesados.
            const estaVinculado = chequesVinculadosIds.has(chequeId);
            if (!estaVinculado && !chequesYaAgregadosIds.has(chequeId)) {
                chequesAnteriores.push({
                    ...cheque,
                    mesOrigen: mesAnterior,
                    esDeMesAnterior: true
                });
                chequesYaAgregadosIds.add(chequeId);
            }
        });
    });

    return chequesAnteriores;
}

/**
 * Cerrar el panel de conciliación del mes
 */
function cerrarConciliacionMes() {
    stateMayores.mesActualConciliacion = null;
    const panel = document.getElementById('panelMesSeleccionado');
    if (panel) panel.style.display = 'none';

    // Quitar marca visual
    document.querySelectorAll('.mes-card').forEach(card => {
        card.classList.remove('procesando');
    });
}

/**
 * Preparar datos para conciliación de un mes específico
 */
function prepararConciliacionMes(mesKey) {
    const cheques = stateMayores.listadoChequesCargados;
    const registrosDebe = stateMayores.registrosMayor.filter(r => r.debe > 0 && !r.esDevolucion);

    // Filtrar cheques del mes actual
    const chequesDelMesActual = cheques.filter(cheque => {
        const fecha = cheque.fechaRecepcion || cheque.fechaEmision;
        if (!fecha) return false;
        const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(fechaDate.getTime())) return false;
        const mesKeyCheque = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
        return mesKeyCheque === mesKey;
    }).map(cheque => ({
        ...cheque,
        mesOrigen: mesKey,
        esDeMesAnterior: false
    }));

    // Obtener cheques no vinculados de meses anteriores
    const chequesNoVinculadosAnteriores = obtenerChequesNoVinculadosMesesAnteriores(mesKey);

    // Combinar cheques del mes actual con los de meses anteriores no vinculados
    const todosLosChequesDisponibles = [...chequesDelMesActual, ...chequesNoVinculadosAnteriores];

    // Filtrar registros del debe del mes
    const registrosDelMes = registrosDebe.filter(registro => {
        if (!registro.fecha) return false;
        const fechaDate = registro.fecha instanceof Date ? registro.fecha : new Date(registro.fecha);
        if (isNaN(fechaDate.getTime())) return false;
        const mesKeyRegistro = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`;
        return mesKeyRegistro === mesKey;
    });

    // Preparar asientos con cheques asociados vacíos
    const asientosDelMes = registrosDelMes.map(registro => ({
        ...registro,
        chequesAsociados: [],
        estadoCheques: 'sin_cheques'
    }));

    // Guardar en estado temporal
    stateMayores.mesesProcesados[mesKey] = {
        procesado: false,
        completo: false,
        asientosDelMes: asientosDelMes,
        chequesDelMes: chequesDelMesActual,
        chequesNoAsociadosDelMes: [...todosLosChequesDisponibles]
    };

    renderizarConciliacionMes(asientosDelMes, todosLosChequesDisponibles);
}

/**
 * Renderizar la tabla de conciliación del mes
 */
function renderizarConciliacionMes(asientos, chequesNoAsociados) {
    const tbody = document.getElementById('tablaAsociacionesMesBody');
    const soloPendientes = document.getElementById('filtroSoloPendientesMes')?.checked || false;

    // Calcular estadísticas
    const completos = asientos.filter(a => a.estadoCheques === 'completo').length;
    const parciales = asientos.filter(a => a.estadoCheques === 'parcial').length;
    const sinCheques = asientos.filter(a => a.estadoCheques === 'sin_cheques').length;

    // Actualizar estadísticas
    document.getElementById('statMesCompletos').textContent = completos;
    document.getElementById('statMesParciales').textContent = parciales;
    document.getElementById('statMesSinCheques').textContent = sinCheques;
    document.getElementById('statMesChequesNoAsociados').textContent = chequesNoAsociados.length;

    // Filtrar asientos
    const asientosFiltrados = soloPendientes
        ? asientos.filter(a => a.estadoCheques !== 'completo')
        : asientos;

    if (asientosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: #64748b; padding: 20px;">
                    ${soloPendientes ? 'No hay registros con diferencias' : 'No hay registros del debe en este mes'}
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = asientosFiltrados.map(asiento => {
            const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
            const diferencia = asiento.debe - sumaCheques;
            const estado = asiento.estadoCheques;
            const cantidadCheques = asiento.chequesAsociados.length;
            const tieneChequesAsociados = cantidadCheques > 0;

            let claseEstado = '';
            let textoEstado = '';
            if (estado === 'completo') {
                claseEstado = 'completo';
                textoEstado = '✅ Completo';
            } else if (estado === 'parcial') {
                claseEstado = 'parcial';
                textoEstado = '⚠️ Parcial';
            } else {
                claseEstado = 'sin-cheques';
                textoEstado = '❌ Sin cheques';
            }

            // Generar HTML de cheques asociados para la fila expandible
            const chequesDetalleHTML = tieneChequesAsociados ? `
                <tr class="fila-detalle-cheques" id="detalle-${asiento.id}" style="display: none;">
                    <td colspan="10" class="celda-detalle-cheques">
                        <div class="contenedor-cheques-asociados">
                            <div class="titulo-cheques-asociados">Cheques asociados (${cantidadCheques}):</div>
                            <table class="tabla-cheques-asociados-detalle">
                                <thead>
                                    <tr>
                                        <th>Número</th>
                                        <th>Origen</th>
                                        <th>F. Recepción</th>
                                        <th class="text-right">Importe</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${asiento.chequesAsociados.map(cheque => {
                                        const fechaRec = cheque.fechaRecepcion
                                            ? formatearFecha(cheque.fechaRecepcion instanceof Date ? cheque.fechaRecepcion : new Date(cheque.fechaRecepcion))
                                            : '-';
                                        return `
                                            <tr>
                                                <td>${cheque.numero || cheque.interno || '-'}</td>
                                                <td title="${cheque.origen || ''}">${truncarTexto(cheque.origen || '', 30)}</td>
                                                <td>${fechaRec}</td>
                                                <td class="text-right">${formatearMoneda(cheque.importe)}</td>
                                                <td>${cheque.estado || '-'}</td>
                                                <td>
                                                    <button class="btn-accion-fila btn-desvincular" onclick="desvincularChequeDeAsiento('${asiento.id}', '${cheque.id || cheque.interno}')" title="Desvincular cheque">
                                                        ✖
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            ` : '';

            return `
                <tr class="fila-${claseEstado} fila-asiento-principal" data-asiento-id="${asiento.id}">
                    <td class="celda-expandir">
                        ${tieneChequesAsociados ? `<button class="btn-expandir-fila" onclick="toggleDetalleChequesAsiento('${asiento.id}')" title="Ver cheques asociados">▶</button>` : ''}
                    </td>
                    <td>${formatearFecha(asiento.fecha)}</td>
                    <td>${asiento.asiento || '-'}</td>
                    <td title="${asiento.descripcion}">${truncarTexto(asiento.descripcion, 35)}</td>
                    <td class="text-right debe">${formatearMoneda(asiento.debe)}</td>
                    <td class="text-center">
                        ${tieneChequesAsociados
                            ? `<span class="badge-cheques" onclick="toggleDetalleChequesAsiento('${asiento.id}')" title="Click para ver detalle">${cantidadCheques}</span>`
                            : '<span class="badge-cheques-vacio">0</span>'}
                    </td>
                    <td class="text-right">${formatearMoneda(sumaCheques)}</td>
                    <td class="text-right ${Math.abs(diferencia) > 0.01 ? 'diferencia-warning' : ''}">${formatearMoneda(diferencia)}</td>
                    <td><span class="estado-asociacion ${claseEstado}">${textoEstado}</span></td>
                    <td>
                        <button class="btn-accion-fila btn-vincular" onclick="mostrarChequesParaVincular('${asiento.id}')" title="Vincular cheque">
                            🔗 Vincular
                        </button>
                    </td>
                </tr>
                ${chequesDetalleHTML}
            `;
        }).join('');
    }

    // Mostrar/ocultar panel de cheques no asociados
    const panelNoAsociados = document.getElementById('chequesNoAsociadosMes');
    if (chequesNoAsociados.length > 0) {
        panelNoAsociados.style.display = 'block';
        renderizarChequesNoAsociadosMes(chequesNoAsociados);
    } else {
        panelNoAsociados.style.display = 'none';
    }

    // Restaurar estados de expansión después del render
    if (stateMayores.asientosExpandidos) {
        Object.keys(stateMayores.asientosExpandidos).forEach(asientoId => {
            if (stateMayores.asientosExpandidos[asientoId]) {
                const filaDetalle = document.getElementById(`detalle-${asientoId}`);
                const filaPrincipal = document.querySelector(`tr[data-asiento-id="${asientoId}"]`);
                const btnExpandir = filaPrincipal?.querySelector('.btn-expandir-fila');

                if (filaDetalle) {
                    filaDetalle.style.display = 'table-row';
                    if (btnExpandir) {
                        btnExpandir.textContent = '▼';
                    }
                    filaPrincipal?.classList.add('fila-expandida');
                }
            }
        });
    }
}

/**
 * Toggle para mostrar/ocultar detalle de cheques asociados a un asiento
 */
function toggleDetalleChequesAsiento(asientoId) {
    const filaDetalle = document.getElementById(`detalle-${asientoId}`);
    const filaPrincipal = document.querySelector(`tr[data-asiento-id="${asientoId}"]`);
    const btnExpandir = filaPrincipal?.querySelector('.btn-expandir-fila');

    // Inicializar estado de expansión si no existe
    if (!stateMayores.asientosExpandidos) {
        stateMayores.asientosExpandidos = {};
    }

    if (filaDetalle) {
        const estaVisible = filaDetalle.style.display !== 'none';
        filaDetalle.style.display = estaVisible ? 'none' : 'table-row';

        // Guardar estado de expansión
        stateMayores.asientosExpandidos[asientoId] = !estaVisible;

        if (btnExpandir) {
            btnExpandir.textContent = estaVisible ? '▶' : '▼';
        }
        if (!estaVisible) {
            filaPrincipal?.classList.add('fila-expandida');
        } else {
            filaPrincipal?.classList.remove('fila-expandida');
        }
    }
}

/**
 * Desvincular un cheque de un asiento
 */
function desvincularChequeDeAsiento(asientoId, chequeId) {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    const asiento = estadoMes.asientosDelMes.find(a => a.id === asientoId);
    if (!asiento) return;

    // Encontrar y remover el cheque
    const indiceCheque = asiento.chequesAsociados.findIndex(ch => (ch.id || ch.interno) === chequeId);
    if (indiceCheque === -1) return;

    const chequeDesvinculado = asiento.chequesAsociados.splice(indiceCheque, 1)[0];

    // Agregar a la lista de no asociados del mes actual
    if (!estadoMes.chequesNoAsociadosDelMes) {
        estadoMes.chequesNoAsociadosDelMes = [];
    }
    estadoMes.chequesNoAsociadosDelMes.push(chequeDesvinculado);

    // Si el cheque es de un mes anterior, también devolverlo a su mes de origen
    if (chequeDesvinculado.esDeMesAnterior && chequeDesvinculado.mesOrigen && chequeDesvinculado.mesOrigen !== mesKey) {
        const estadoMesOrigen = stateMayores.mesesProcesados[chequeDesvinculado.mesOrigen];
        if (estadoMesOrigen) {
            if (!estadoMesOrigen.chequesNoAsociadosDelMes) {
                estadoMesOrigen.chequesNoAsociadosDelMes = [];
            }
            // Verificar que no exista ya el cheque en el mes de origen
            const yaExisteEnOrigen = estadoMesOrigen.chequesNoAsociadosDelMes.some(
                c => (c.id || c.interno) === (chequeDesvinculado.id || chequeDesvinculado.interno)
            );
            if (!yaExisteEnOrigen) {
                // Agregar sin la marca de esDeMesAnterior para que se muestre normal en su mes
                const chequeParaOrigen = { ...chequeDesvinculado, esDeMesAnterior: false };
                estadoMesOrigen.chequesNoAsociadosDelMes.push(chequeParaOrigen);
            }
        }
    }

    // Limpiar el campo asientoAsociado del cheque original para que vuelva a estar disponible
    const chequeOriginal = stateMayores.listadoChequesCargados?.find(
        c => (c.id || c.interno) === (chequeDesvinculado.id || chequeDesvinculado.interno)
    );
    if (chequeOriginal) {
        chequeOriginal.asientoAsociado = null;
    }

    // Recalcular estado del asiento
    const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
    if (asiento.chequesAsociados.length === 0) {
        asiento.estadoCheques = 'sin_cheques';
        // Limpiar estado de expansión cuando no quedan cheques (la fila expandible no existirá)
        if (stateMayores.asientosExpandidos) {
            delete stateMayores.asientosExpandidos[asientoId];
        }
    } else if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
        asiento.estadoCheques = 'completo';
    } else {
        asiento.estadoCheques = 'parcial';
        asiento.diferenciaCheques = asiento.debe - sumaCheques;
    }

    // Re-renderizar
    renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes || []);
}

// Estado para filtros y ordenamiento de cheques no asociados
let chequesNoAsociadosOrdenamiento = {
    campo: null,
    direccion: 'asc'
};
let chequesNoAsociadosOriginales = [];

// Estado para selección múltiple de cheques
let chequesSeleccionados = new Set();
let asientosDisponiblesParaVincular = [];
let asientoSeleccionadoParaVincularMultiples = null;

/**
 * Renderizar tabla de cheques no asociados del mes
 */
function renderizarChequesNoAsociadosMes(cheques) {
    // Guardar referencia original para filtros
    chequesNoAsociadosOriginales = [...cheques];

    // Limpiar selección al cambiar de mes
    chequesSeleccionados.clear();
    actualizarContadorSeleccionados();

    // Contar cheques del mes actual vs meses anteriores
    const chequesDelMesActual = cheques.filter(c => !c.esDeMesAnterior).length;
    const chequesDeMesesAnteriores = cheques.filter(c => c.esDeMesAnterior === true).length;

    // Actualizar contador
    const contador = document.getElementById('contadorChequesNoAsociados');
    if (contador) {
        if (chequesDeMesesAnteriores > 0) {
            contador.innerHTML = `(${cheques.length} cheques: <span style="color: #059669;">${chequesDelMesActual} del mes</span> + <span style="color: #ea580c;">${chequesDeMesesAnteriores} de meses anteriores</span>)`;
        } else {
            contador.textContent = `(${cheques.length} cheques)`;
        }
    }

    renderizarTablaChequesNoAsociados(cheques);
}

/**
 * Renderizar la tabla de cheques no asociados (usado internamente)
 */
function renderizarTablaChequesNoAsociados(cheques) {
    const tbody = document.getElementById('tablaChequesNoAsociadosMes');

    if (cheques.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">
                    No hay cheques que coincidan con los filtros
                </td>
            </tr>
        `;
        // Resetear checkbox de seleccionar todos
        const checkboxTodos = document.getElementById('checkboxSeleccionarTodosCheques');
        if (checkboxTodos) checkboxTodos.checked = false;
        return;
    }

    tbody.innerHTML = cheques.map(cheque => {
        const fechaRecepcion = cheque.fechaRecepcion
            ? formatearFecha(cheque.fechaRecepcion instanceof Date ? cheque.fechaRecepcion : new Date(cheque.fechaRecepcion))
            : '-';
        const chequeId = cheque.id || cheque.interno;
        const isChecked = chequesSeleccionados.has(chequeId);
        const esDeMesAnterior = cheque.esDeMesAnterior === true;
        const mesOrigenTexto = esDeMesAnterior ? formatearMesCorto(cheque.mesOrigen) : '';

        return `
            <tr class="${isChecked ? 'fila-seleccionada' : ''} ${esDeMesAnterior ? 'fila-mes-anterior' : ''}">
                <td class="td-checkbox">
                    <input type="checkbox"
                           class="checkbox-cheque"
                           data-cheque-id="${chequeId}"
                           ${isChecked ? 'checked' : ''}
                           onchange="toggleSeleccionCheque('${chequeId}', this.checked)">
                </td>
                <td>
                    ${cheque.numero || cheque.interno || '-'}
                    ${esDeMesAnterior ? `<span class="badge-mes-anterior" title="Cheque de ${mesOrigenTexto}">${mesOrigenTexto}</span>` : ''}
                </td>
                <td title="${cheque.origen || ''}">${truncarTexto(cheque.origen || '', 25)}</td>
                <td>${fechaRecepcion}</td>
                <td class="text-right">${formatearMoneda(cheque.importe)}</td>
                <td>${cheque.estado || '-'}</td>
                <td>
                    <button class="btn-accion-fila btn-vincular" onclick="mostrarAsientosParaVincular('${chequeId}')" title="Vincular a asiento">
                        🔗 Vincular
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Actualizar estado del checkbox "seleccionar todos"
    actualizarCheckboxSeleccionarTodos(cheques);
}

/**
 * Filtrar cheques no asociados según los inputs de filtro
 */
function filtrarChequesNoAsociados() {
    const filtroNumero = (document.getElementById('filtroNumeroChequeSinAsociar')?.value || '').toLowerCase().trim();
    const filtroOrigen = (document.getElementById('filtroOrigenChequeSinAsociar')?.value || '').toLowerCase().trim();
    const filtroEstado = (document.getElementById('filtroEstadoChequeSinAsociar')?.value || '').toLowerCase().trim();

    let chequesFiltrados = chequesNoAsociadosOriginales.filter(cheque => {
        const numero = (cheque.numero || cheque.interno || '').toString().toLowerCase();
        const origen = (cheque.origen || '').toLowerCase();
        const estado = (cheque.estado || '').toLowerCase();

        const matchNumero = !filtroNumero || numero.includes(filtroNumero);
        const matchOrigen = !filtroOrigen || origen.includes(filtroOrigen);
        const matchEstado = !filtroEstado || estado.includes(filtroEstado);

        return matchNumero && matchOrigen && matchEstado;
    });

    // Aplicar ordenamiento si hay uno activo
    if (chequesNoAsociadosOrdenamiento.campo) {
        chequesFiltrados = ordenarCheques(chequesFiltrados, chequesNoAsociadosOrdenamiento.campo, chequesNoAsociadosOrdenamiento.direccion);
    }

    renderizarTablaChequesNoAsociados(chequesFiltrados);
}

/**
 * Limpiar filtros de cheques no asociados
 */
function limpiarFiltrosChequesNoAsociados() {
    const filtroNumero = document.getElementById('filtroNumeroChequeSinAsociar');
    const filtroOrigen = document.getElementById('filtroOrigenChequeSinAsociar');
    const filtroEstado = document.getElementById('filtroEstadoChequeSinAsociar');

    if (filtroNumero) filtroNumero.value = '';
    if (filtroOrigen) filtroOrigen.value = '';
    if (filtroEstado) filtroEstado.value = '';

    // Resetear ordenamiento
    chequesNoAsociadosOrdenamiento = { campo: null, direccion: 'asc' };
    actualizarIconosOrdenamiento(null);

    renderizarTablaChequesNoAsociados(chequesNoAsociadosOriginales);
}

/**
 * Ordenar cheques no asociados por columna
 */
function ordenarChequesNoAsociados(campo) {
    // Si se hace clic en la misma columna, cambiar dirección
    if (chequesNoAsociadosOrdenamiento.campo === campo) {
        chequesNoAsociadosOrdenamiento.direccion = chequesNoAsociadosOrdenamiento.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        chequesNoAsociadosOrdenamiento.campo = campo;
        chequesNoAsociadosOrdenamiento.direccion = 'asc';
    }

    // Actualizar iconos
    actualizarIconosOrdenamiento(campo);

    // Re-aplicar filtros (que también aplicará ordenamiento)
    filtrarChequesNoAsociados();
}

/**
 * Ordenar array de cheques por campo
 */
function ordenarCheques(cheques, campo, direccion) {
    return [...cheques].sort((a, b) => {
        let valorA, valorB;

        switch (campo) {
            case 'numero':
                valorA = (a.numero || a.interno || '').toString().toLowerCase();
                valorB = (b.numero || b.interno || '').toString().toLowerCase();
                break;
            case 'origen':
                valorA = (a.origen || '').toLowerCase();
                valorB = (b.origen || '').toLowerCase();
                break;
            case 'fechaRecepcion':
                valorA = a.fechaRecepcion ? new Date(a.fechaRecepcion).getTime() : 0;
                valorB = b.fechaRecepcion ? new Date(b.fechaRecepcion).getTime() : 0;
                break;
            case 'importe':
                valorA = a.importe || 0;
                valorB = b.importe || 0;
                break;
            case 'estado':
                valorA = (a.estado || '').toLowerCase();
                valorB = (b.estado || '').toLowerCase();
                break;
            default:
                return 0;
        }

        let comparacion = 0;
        if (typeof valorA === 'number' && typeof valorB === 'number') {
            comparacion = valorA - valorB;
        } else {
            comparacion = valorA.toString().localeCompare(valorB.toString());
        }

        return direccion === 'asc' ? comparacion : -comparacion;
    });
}

/**
 * Actualizar iconos de ordenamiento en cabeceras
 */
function actualizarIconosOrdenamiento(campoActivo) {
    const tabla = document.querySelector('.tabla-cheques-no-asociados');
    if (!tabla) return;

    const headers = tabla.querySelectorAll('th.sortable');
    headers.forEach(th => {
        const campo = th.getAttribute('data-sort');
        const icono = th.querySelector('.sort-icon');
        if (icono) {
            if (campo === campoActivo) {
                icono.textContent = chequesNoAsociadosOrdenamiento.direccion === 'asc' ? '▲' : '▼';
                th.classList.add('sorted');
            } else {
                icono.textContent = '⇅';
                th.classList.remove('sorted');
            }
        }
    });
}

/**
 * Filtrar asociaciones del mes
 */
function filtrarAsociacionesMes() {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (estadoMes) {
        renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes || []);
    }
}

/**
 * Conciliar automáticamente el mes seleccionado
 */
async function conciliarMesAutomaticamente() {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) {
        alert('Seleccione un mes primero');
        return;
    }

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) {
        alert('No hay datos para este mes');
        return;
    }

    const asientos = estadoMes.asientosDelMes;
    const cheques = estadoMes.chequesDelMes || [];
    const chequesNoAsociados = [];

    // Resetear asociaciones
    asientos.forEach(asiento => {
        asiento.chequesAsociados = [];
        asiento.estadoCheques = 'sin_cheques';
    });

    // Usar la misma lógica de asociación que en incorporarListadoChequesAlMayor
    for (const cheque of cheques) {
        let registroAsociado = null;
        let mejorDiffDias = Infinity;

        for (const asiento of asientos) {
            // Verificar si excedería el monto
            const sumaActual = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
            if (sumaActual + cheque.importe > asiento.debe + 0.50) continue;

            // Calcular similitud de texto
            const similitud = calcularSimilitudTextoMes(cheque.origen, asiento.descripcion);
            if (similitud < 0.5) continue;

            // Calcular diferencia de días
            const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
            if (!fechaCheque || !asiento.fecha) continue;

            const fechaChequeDate = fechaCheque instanceof Date ? fechaCheque : new Date(fechaCheque);
            const fechaAsientoDate = asiento.fecha instanceof Date ? asiento.fecha : new Date(asiento.fecha);
            // Calcular diferencia SIN Math.abs(): positivo = asiento posterior al cheque (válido)
            // negativo = asiento anterior al cheque (inválido - no se puede contabilizar antes de recibir)
            const diffDias = (fechaAsientoDate - fechaChequeDate) / (1000 * 60 * 60 * 24);

            // Tolerancia de 15 días: el asiento debe ser igual o posterior al cheque (diffDias >= 0)
            if (diffDias >= 0 && diffDias <= 15 && diffDias < mejorDiffDias) {
                mejorDiffDias = diffDias;
                registroAsociado = asiento;
            }
        }

        if (registroAsociado) {
            const chequeEnriquecido = {
                id: cheque.id || `cheque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...cheque
            };
            registroAsociado.chequesAsociados.push(chequeEnriquecido);
        } else {
            chequesNoAsociados.push(cheque);
        }
    }

    // Calcular estado de cada asiento
    asientos.forEach(asiento => {
        const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
        if (asiento.chequesAsociados.length === 0) {
            asiento.estadoCheques = 'sin_cheques';
        } else if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
            asiento.estadoCheques = 'completo';
        } else {
            asiento.estadoCheques = 'parcial';
            asiento.diferenciaCheques = asiento.debe - sumaCheques;
        }
    });

    // Actualizar estado del mes
    const completos = asientos.filter(a => a.estadoCheques === 'completo').length;
    estadoMes.asientosDelMes = asientos;
    estadoMes.chequesNoAsociadosDelMes = chequesNoAsociados;
    estadoMes.procesado = true;
    estadoMes.completo = chequesNoAsociados.length === 0 && asientos.every(a => a.estadoCheques === 'completo');
    estadoMes.pendientes = asientos.filter(a => a.estadoCheques !== 'completo').length;

    // Renderizar resultados
    renderizarConciliacionMes(asientos, chequesNoAsociados);
    renderizarListaMeses();

    // Mostrar resumen
    alert(`Conciliación automática completada:\n\n` +
          `✅ ${completos} asientos completos\n` +
          `⚠️ ${asientos.filter(a => a.estadoCheques === 'parcial').length} asientos parciales\n` +
          `❌ ${asientos.filter(a => a.estadoCheques === 'sin_cheques').length} sin cheques\n` +
          `📌 ${chequesNoAsociados.length} cheques sin asociar`);
}

/**
 * Calcular similitud de texto (versión simplificada para conciliación por mes)
 * Mejorada para manejar nombres cortos como "REYES HNOS. S.R.L"
 */
function calcularSimilitudTextoMes(origenCheque, descripcionAsiento) {
    if (!origenCheque || !descripcionAsiento) return 0;

    // Palabras genéricas que no deben contar como coincidencias significativas
    // Son comunes en muchos nombres de empresas y causan falsos positivos
    const palabrasGenericas = new Set([
        'repuestos', 'repuesto', 'accesorios', 'accesorio', 'servicios', 'servicio',
        'comercial', 'comercio', 'distribuidora', 'distribuidor', 'mayorista', 'minorista',
        'materiales', 'material', 'construccion', 'construcciones', 'automotor', 'automotores',
        'autopartes', 'autoparte', 'ferreteria', 'ferreterias', 'industria', 'industrial',
        'empresa', 'empresas', 'compania', 'transporte', 'transportes', 'logistica',
        'agro', 'agricola', 'ganadera', 'ganadero', 'rural', 'campo',
        'electronica', 'electrica', 'electricidad', 'sanitarios', 'plomeria',
        'pinturas', 'pintura', 'maderas', 'madera', 'hierros', 'hierro', 'aceros', 'acero',
        'plasticos', 'plastico', 'vidrios', 'vidrio', 'alimentos', 'alimenticia',
        'norte', 'sur', 'este', 'oeste', 'centro', 'del', 'las', 'los', 'san',
        'srl', 'sas', 'hnos', 'hermanos', 'hijos', 'hijo', 'cia', 'ltda'
    ]);

    const normalizar = (texto) => {
        return texto.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    };

    const origenNorm = normalizar(origenCheque);
    const descripcionNorm = normalizar(descripcionAsiento);

    // Verificar inclusión directa (match exacto del nombre en la descripción)
    if (descripcionNorm.includes(origenNorm) || origenNorm.includes(descripcionNorm)) {
        return 1;
    }

    // Extraer palabras significativas (>2 caracteres para incluir "hnos", "srl", etc.)
    const todasPalabrasOrigen = origenNorm.split(' ').filter(p => p.length > 2);
    const todasPalabrasDescripcion = descripcionNorm.split(' ').filter(p => p.length > 2);

    // Separar palabras específicas (nombres propios) de palabras genéricas
    const palabrasEspecificasOrigen = todasPalabrasOrigen.filter(p => !palabrasGenericas.has(p));
    const palabrasEspecificasDescripcion = todasPalabrasDescripcion.filter(p => !palabrasGenericas.has(p));

    // Si no hay palabras específicas en el origen, no podemos hacer match confiable
    if (palabrasEspecificasOrigen.length === 0) return 0;

    let coincidenciasEspecificas = 0;
    for (const palabra of palabrasEspecificasOrigen) {
        // Comparación solo con palabras específicas de la descripción
        if (palabrasEspecificasDescripcion.some(pd => {
            // Coincidencia exacta
            if (pd === palabra) return true;

            // Inclusión parcial: la palabra incluida debe ser >= 70% de la longitud de la contenedora
            // Esto evita falsos positivos como "san" -> "sanchez" (3/7 = 0.43 < 0.7)
            // pero permite "repuesto" -> "repuestos" (8/9 = 0.89 > 0.7)
            if (pd.includes(palabra) && palabra.length / pd.length >= 0.7) return true;
            if (palabra.includes(pd) && pd.length / palabra.length >= 0.7) return true;

            // Comparación por similitud de caracteres (para manejar abreviaciones)
            // Requiere que ambas palabras tengan al menos 5 caracteres para evitar falsos positivos
            if (palabra.length >= 5 && pd.length >= 5 &&
                pd.substring(0, 5) === palabra.substring(0, 5)) return true;

            return false;
        })) {
            coincidenciasEspecificas++;
        }
    }

    // Requerir al menos 1 coincidencia de palabra específica (nombre propio)
    if (coincidenciasEspecificas === 0) return 0;

    return coincidenciasEspecificas / palabrasEspecificasOrigen.length;
}

/**
 * Agrupar asientos similares por descripción (proveedor) y fecha cercana
 * Esto permite optimizar la distribución de cheques cuando hay múltiples asientos
 * del mismo proveedor en fechas cercanas.
 */
function agruparAsientosSimilares(asientos, chequesDisponibles, toleranciaDias = 5) {
    const grupos = [];
    const asientosUsados = new Set();

    for (const asiento of asientos) {
        if (asientosUsados.has(asiento.id)) continue;
        if (asiento.estadoCheques === 'completo') continue;

        // Buscar asientos similares (misma descripción/proveedor, fecha cercana)
        const grupo = {
            asientos: [asiento],
            chequesCandidatos: []
        };
        asientosUsados.add(asiento.id);

        for (const otroAsiento of asientos) {
            if (asientosUsados.has(otroAsiento.id)) continue;
            if (otroAsiento.estadoCheques === 'completo') continue;

            // Verificar similitud de descripción
            const similitud = calcularSimilitudTextoMes(asiento.descripcion, otroAsiento.descripcion);
            if (similitud < 0.7) continue;

            // Verificar cercanía de fechas
            const fechaA = asiento.fecha instanceof Date ? asiento.fecha : new Date(asiento.fecha);
            const fechaB = otroAsiento.fecha instanceof Date ? otroAsiento.fecha : new Date(otroAsiento.fecha);
            const diffDias = Math.abs((fechaA - fechaB) / (1000 * 60 * 60 * 24));
            if (diffDias > toleranciaDias) continue;

            grupo.asientos.push(otroAsiento);
            asientosUsados.add(otroAsiento.id);
        }

        // Encontrar cheques candidatos para este grupo
        for (const cheque of chequesDisponibles) {
            // Verificar similitud con al menos un asiento del grupo
            const tieneMatch = grupo.asientos.some(a => {
                const similitud = calcularSimilitudTextoMes(cheque.origen, a.descripcion);
                return similitud >= 0.5;
            });
            if (tieneMatch) {
                // Verificar fecha compatible
                const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
                if (!fechaCheque) continue;
                const fechaChequeDate = fechaCheque instanceof Date ? fechaCheque : new Date(fechaCheque);

                const fechaCompatible = grupo.asientos.some(a => {
                    const fechaAsiento = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
                    const diffDias = (fechaAsiento - fechaChequeDate) / (1000 * 60 * 60 * 24);
                    return diffDias >= 0 && diffDias <= 15;
                });

                if (fechaCompatible) {
                    grupo.chequesCandidatos.push(cheque);
                }
            }
        }

        grupos.push(grupo);
    }

    return grupos;
}

/**
 * Optimizar distribución de cheques entre asientos de un grupo similar.
 * IMPORTANTE: Considera TODOS los cheques del grupo (ya asociados + sin asociar)
 * y busca la distribución óptima que minimice las diferencias, priorizando
 * dejar todos los asientos con diferencia 0.
 */
function optimizarDistribucionGrupo(grupo) {
    const { asientos, chequesCandidatos } = grupo;

    // Si no hay múltiples asientos, no hay nada que optimizar
    if (asientos.length <= 1) {
        return null;
    }

    // Recopilar TODOS los cheques del grupo (ya asociados + sin asociar)
    const todosLosCheques = [];
    const chequeIds = new Set();

    // Agregar cheques ya asociados a los asientos del grupo
    for (const asiento of asientos) {
        for (const cheque of (asiento.chequesAsociados || [])) {
            if (!chequeIds.has(cheque.id)) {
                todosLosCheques.push(cheque);
                chequeIds.add(cheque.id);
            }
        }
    }

    // Agregar cheques candidatos (sin asociar)
    for (const cheque of chequesCandidatos) {
        if (!chequeIds.has(cheque.id)) {
            todosLosCheques.push(cheque);
            chequeIds.add(cheque.id);
        }
    }

    if (todosLosCheques.length === 0) return null;

    // Calcular totales para verificar si una solución perfecta es posible
    const totalCheques = todosLosCheques.reduce((sum, ch) => sum + ch.importe, 0);
    const totalAsientos = asientos.reduce((sum, a) => sum + a.debe, 0);
    const solucionPerfectaPosible = Math.abs(totalCheques - totalAsientos) <= 0.50;

    // Preparar datos de asientos
    const datosAsientos = asientos.map(a => ({
        asiento: a,
        objetivo: a.debe,
        id: a.id
    }));

    // Intentar encontrar la distribución óptima usando búsqueda con backtracking
    const mejorDistribucion = buscarDistribucionOptima(todosLosCheques, datosAsientos, solucionPerfectaPosible);

    if (!mejorDistribucion) return null;

    // Verificar si la nueva distribución es mejor que la actual
    let diferenciaActual = 0;
    for (const asiento of asientos) {
        const sumaActual = (asiento.chequesAsociados || []).reduce((sum, ch) => sum + ch.importe, 0);
        diferenciaActual += Math.abs(asiento.debe - sumaActual);
    }

    // Solo retornar si mejora la situación
    if (mejorDistribucion.diferenciaTotal >= diferenciaActual - 0.01) {
        return null;
    }

    return mejorDistribucion;
}

/**
 * Buscar la distribución óptima de cheques entre asientos usando backtracking.
 * Prioriza encontrar distribuciones con diferencia 0 en todos los asientos.
 */
function buscarDistribucionOptima(cheques, datosAsientos, buscarPerfecta) {
    const n = cheques.length;
    const m = datosAsientos.length;

    // Para optimizar, ordenar cheques de mayor a menor
    const chequesOrdenados = [...cheques].sort((a, b) => b.importe - a.importe);

    let mejorResultado = null;
    let mejorDiferencia = Infinity;

    // Inicializar distribución: cada asiento tiene array vacío
    const distribucionActual = new Map();
    const sumasActuales = new Map();
    for (const dato of datosAsientos) {
        distribucionActual.set(dato.id, []);
        sumasActuales.set(dato.id, 0);
    }

    /**
     * Función recursiva de backtracking
     * @param {number} idx - Índice del cheque actual
     */
    function backtrack(idx) {
        // Caso base: todos los cheques asignados
        if (idx === n) {
            let diferenciaTotal = 0;
            let todosCompletos = true;

            for (const dato of datosAsientos) {
                const suma = sumasActuales.get(dato.id);
                const diff = Math.abs(dato.objetivo - suma);
                diferenciaTotal += diff;
                if (diff > 0.50) todosCompletos = false;
            }

            // Si buscamos solución perfecta y no la encontramos, seguir buscando
            if (buscarPerfecta && !todosCompletos && mejorResultado === null) {
                // Guardar como mejor parcial solo si es mejor
                if (diferenciaTotal < mejorDiferencia) {
                    mejorDiferencia = diferenciaTotal;
                    mejorResultado = {
                        distribucion: new Map(),
                        diferenciaTotal,
                        asientosCompletos: datosAsientos.filter(d => Math.abs(d.objetivo - sumasActuales.get(d.id)) <= 0.50).length,
                        chequesUsados: new Set(cheques.map(c => c.id)),
                        requiereReasignacion: true
                    };
                    for (const [id, arr] of distribucionActual) {
                        mejorResultado.distribucion.set(id, [...arr]);
                    }
                }
                return;
            }

            if (diferenciaTotal < mejorDiferencia) {
                mejorDiferencia = diferenciaTotal;
                mejorResultado = {
                    distribucion: new Map(),
                    diferenciaTotal,
                    asientosCompletos: datosAsientos.filter(d => Math.abs(d.objetivo - sumasActuales.get(d.id)) <= 0.50).length,
                    chequesUsados: new Set(cheques.map(c => c.id)),
                    requiereReasignacion: true
                };
                for (const [id, arr] of distribucionActual) {
                    mejorResultado.distribucion.set(id, [...arr]);
                }

                // Si encontramos solución perfecta, podemos parar
                if (todosCompletos) {
                    return true; // Signal to stop
                }
            }
            return;
        }

        const cheque = chequesOrdenados[idx];

        // Intentar asignar el cheque a cada asiento
        for (const dato of datosAsientos) {
            const sumaActual = sumasActuales.get(dato.id);
            const nuevaSuma = sumaActual + cheque.importe;

            // Poda: no exceder el objetivo por más de un margen razonable
            // (permitimos un pequeño exceso para manejar redondeos)
            if (nuevaSuma > dato.objetivo + 0.50) continue;

            // Asignar cheque a este asiento
            distribucionActual.get(dato.id).push(cheque);
            sumasActuales.set(dato.id, nuevaSuma);

            const result = backtrack(idx + 1);
            if (result === true) return true; // Solución perfecta encontrada

            // Deshacer asignación
            distribucionActual.get(dato.id).pop();
            sumasActuales.set(dato.id, sumaActual);
        }

        // También intentar no asignar el cheque a ningún asiento del grupo
        // (quedará sin asociar)
        backtrack(idx + 1);
    }

    // Limitar tiempo de búsqueda para casos con muchos cheques
    const maxIteraciones = 100000;
    let iteraciones = 0;

    function backtrackLimitado(idx) {
        iteraciones++;
        if (iteraciones > maxIteraciones) return 'limit';

        if (idx === n) {
            let diferenciaTotal = 0;
            let todosCompletos = true;

            for (const dato of datosAsientos) {
                const suma = sumasActuales.get(dato.id);
                const diff = Math.abs(dato.objetivo - suma);
                diferenciaTotal += diff;
                if (diff > 0.50) todosCompletos = false;
            }

            if (diferenciaTotal < mejorDiferencia) {
                mejorDiferencia = diferenciaTotal;
                mejorResultado = {
                    distribucion: new Map(),
                    diferenciaTotal,
                    asientosCompletos: datosAsientos.filter(d => Math.abs(d.objetivo - sumasActuales.get(d.id)) <= 0.50).length,
                    chequesUsados: new Set(cheques.map(c => c.id)),
                    requiereReasignacion: true
                };
                for (const [id, arr] of distribucionActual) {
                    mejorResultado.distribucion.set(id, [...arr]);
                }

                if (todosCompletos) return true;
            }
            return;
        }

        const cheque = chequesOrdenados[idx];

        // Ordenar asientos por proximidad al objetivo para mejorar poda
        const asientosOrdenados = [...datosAsientos].sort((a, b) => {
            const diffA = a.objetivo - sumasActuales.get(a.id);
            const diffB = b.objetivo - sumasActuales.get(b.id);
            // Priorizar asientos donde el cheque encaja mejor
            const fitA = Math.abs(diffA - cheque.importe);
            const fitB = Math.abs(diffB - cheque.importe);
            return fitA - fitB;
        });

        for (const dato of asientosOrdenados) {
            const sumaActual = sumasActuales.get(dato.id);
            const nuevaSuma = sumaActual + cheque.importe;

            if (nuevaSuma > dato.objetivo + 0.50) continue;

            distribucionActual.get(dato.id).push(cheque);
            sumasActuales.set(dato.id, nuevaSuma);

            const result = backtrackLimitado(idx + 1);
            if (result === true) return true;
            if (result === 'limit') return 'limit';

            distribucionActual.get(dato.id).pop();
            sumasActuales.set(dato.id, sumaActual);
        }

        // No asignar a ninguno
        return backtrackLimitado(idx + 1);
    }

    // Usar versión con límite si hay muchos cheques
    if (n > 15) {
        backtrackLimitado(0);
    } else {
        backtrack(0);
    }

    return mejorResultado;
}

/**
 * Reprocesar cheques sin asociar del mes actual
 * IMPORTANTE: Esta función NO elimina vinculaciones manuales existentes.
 * Solo intenta vincular los cheques que aún no están asociados a asientos
 * que no tienen cheques o tienen vinculación parcial.
 *
 * MEJORA: Cuando hay múltiples asientos del mismo proveedor, optimiza la
 * distribución de cheques para minimizar las diferencias totales.
 */
function reprocesarChequesMes() {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) {
        alert('Seleccione un mes primero');
        return;
    }

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) {
        alert('No hay datos para este mes');
        return;
    }

    const asientos = estadoMes.asientosDelMes;
    let chequesNoAsociados = estadoMes.chequesNoAsociadosDelMes || [];

    if (chequesNoAsociados.length === 0) {
        alert('No hay cheques pendientes de vinculación.');
        return;
    }

    // Obtener IDs de cheques ya vinculados para no duplicarlos
    const chequesYaVinculadosIds = new Set();
    asientos.forEach(asiento => {
        (asiento.chequesAsociados || []).forEach(ch => {
            if (ch.id) chequesYaVinculadosIds.add(ch.id);
        });
    });

    // Solo trabajar con cheques que realmente no están asociados
    const chequesParaProcesar = chequesNoAsociados.filter(ch => !chequesYaVinculadosIds.has(ch.id));

    if (chequesParaProcesar.length === 0) {
        alert('No hay cheques pendientes de vinculación.');
        return;
    }

    let vinculacionesNuevas = 0;
    const chequesUsadosEnOptimizacion = new Set();

    // PASO 1: Optimización para grupos de asientos similares
    // Esto maneja casos donde hay múltiples asientos del mismo proveedor
    const grupos = agruparAsientosSimilares(asientos, chequesParaProcesar);

    for (const grupo of grupos) {
        // Solo optimizar grupos con múltiples asientos
        if (grupo.asientos.length > 1) {
            const resultado = optimizarDistribucionGrupo(grupo);

            if (resultado && resultado.distribucion) {
                // Si requiere reasignación, primero limpiar los cheques de los asientos del grupo
                if (resultado.requiereReasignacion) {
                    // Recopilar IDs de cheques que serán reasignados
                    const chequesReasignados = new Set();
                    for (const [, cheques] of resultado.distribucion) {
                        for (const cheque of cheques) {
                            chequesReasignados.add(cheque.id);
                        }
                    }

                    // Remover cheques de los asientos del grupo que serán reasignados
                    for (const asiento of grupo.asientos) {
                        if (asiento.chequesAsociados && asiento.chequesAsociados.length > 0) {
                            // Filtrar: mantener solo los cheques que NO serán reasignados
                            const chequesOriginales = asiento.chequesAsociados.filter(
                                ch => !chequesReasignados.has(ch.id)
                            );
                            // Los cheques removidos se marcan como disponibles
                            for (const ch of asiento.chequesAsociados) {
                                if (chequesReasignados.has(ch.id)) {
                                    chequesYaVinculadosIds.delete(ch.id);
                                }
                            }
                            asiento.chequesAsociados = chequesOriginales;
                        }
                    }
                }

                // Aplicar la nueva distribución
                for (const [asientoId, cheques] of resultado.distribucion) {
                    const asiento = asientos.find(a => a.id === asientoId);
                    if (!asiento) continue;

                    // Inicializar array si no existe
                    if (!asiento.chequesAsociados) {
                        asiento.chequesAsociados = [];
                    }

                    for (const cheque of cheques) {
                        // Verificar que no esté ya en este asiento
                        const yaExiste = asiento.chequesAsociados.some(ch => ch.id === cheque.id);
                        if (yaExiste) continue;

                        const chequeEnriquecido = {
                            id: cheque.id || `cheque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            ...cheque
                        };
                        asiento.chequesAsociados.push(chequeEnriquecido);
                        chequesUsadosEnOptimizacion.add(cheque.id);
                        chequesYaVinculadosIds.add(cheque.id);
                        vinculacionesNuevas++;
                    }
                }
            }
        }
    }

    // Recalcular estados después de la optimización
    asientos.forEach(asiento => {
        const sumaCheques = (asiento.chequesAsociados || []).reduce((sum, ch) => sum + ch.importe, 0);
        if (!asiento.chequesAsociados || asiento.chequesAsociados.length === 0) {
            asiento.estadoCheques = 'sin_cheques';
        } else if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
            asiento.estadoCheques = 'completo';
        } else {
            asiento.estadoCheques = 'parcial';
            asiento.diferenciaCheques = asiento.debe - sumaCheques;
        }
    });

    // PASO 2: Procesar cheques restantes con el algoritmo original
    const chequesRestantes = chequesParaProcesar.filter(ch => !chequesUsadosEnOptimizacion.has(ch.id));
    const chequesQueSiguenSinAsociar = [];

    for (const cheque of chequesRestantes) {
        let registroAsociado = null;
        let mejorDiffDias = Infinity;

        // Solo buscar en asientos que NO están completos (sin_cheques o parcial)
        for (const asiento of asientos) {
            // Omitir asientos ya completos
            if (asiento.estadoCheques === 'completo') continue;

            // Verificar si excedería el monto (considerando cheques ya vinculados)
            const sumaActual = (asiento.chequesAsociados || []).reduce((sum, ch) => sum + ch.importe, 0);
            if (sumaActual + cheque.importe > asiento.debe + 0.50) continue;

            // Calcular similitud de texto
            const similitud = calcularSimilitudTextoMes(cheque.origen, asiento.descripcion);
            if (similitud < 0.5) continue;

            // Calcular diferencia de días
            const fechaCheque = cheque.fechaRecepcion || cheque.fechaEmision;
            if (!fechaCheque || !asiento.fecha) continue;

            const fechaChequeDate = fechaCheque instanceof Date ? fechaCheque : new Date(fechaCheque);
            const fechaAsientoDate = asiento.fecha instanceof Date ? asiento.fecha : new Date(asiento.fecha);
            // Calcular diferencia SIN Math.abs(): positivo = asiento posterior al cheque (válido)
            // negativo = asiento anterior al cheque (inválido - no se puede contabilizar antes de recibir)
            const diffDias = (fechaAsientoDate - fechaChequeDate) / (1000 * 60 * 60 * 24);

            // Tolerancia de 15 días: el asiento debe ser igual o posterior al cheque (diffDias >= 0)
            if (diffDias >= 0 && diffDias <= 15 && diffDias < mejorDiffDias) {
                mejorDiffDias = diffDias;
                registroAsociado = asiento;
            }
        }

        if (registroAsociado) {
            // Inicializar array si no existe
            if (!registroAsociado.chequesAsociados) {
                registroAsociado.chequesAsociados = [];
            }

            const chequeEnriquecido = {
                id: cheque.id || `cheque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...cheque
            };
            registroAsociado.chequesAsociados.push(chequeEnriquecido);
            vinculacionesNuevas++;
        } else {
            chequesQueSiguenSinAsociar.push(cheque);
        }
    }

    // Recalcular estado de cada asiento (solo actualizar estados, no borrar vinculaciones)
    asientos.forEach(asiento => {
        const sumaCheques = (asiento.chequesAsociados || []).reduce((sum, ch) => sum + ch.importe, 0);
        if (!asiento.chequesAsociados || asiento.chequesAsociados.length === 0) {
            asiento.estadoCheques = 'sin_cheques';
        } else if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
            asiento.estadoCheques = 'completo';
        } else {
            asiento.estadoCheques = 'parcial';
            asiento.diferenciaCheques = asiento.debe - sumaCheques;
        }
    });

    // Actualizar lista de cheques no asociados
    estadoMes.chequesNoAsociadosDelMes = chequesQueSiguenSinAsociar;

    // Actualizar estado del mes
    const completos = asientos.filter(a => a.estadoCheques === 'completo').length;
    estadoMes.asientosDelMes = asientos;
    estadoMes.procesado = true;
    estadoMes.completo = chequesQueSiguenSinAsociar.length === 0 && asientos.every(a => a.estadoCheques === 'completo');
    estadoMes.pendientes = asientos.filter(a => a.estadoCheques !== 'completo').length;

    // Renderizar resultados
    renderizarConciliacionMes(asientos, chequesQueSiguenSinAsociar);
    renderizarListaMeses();

    // Mostrar resumen
    alert(`Reprocesamiento completado:\n\n` +
          `🔄 ${vinculacionesNuevas} nuevas vinculaciones realizadas\n` +
          `✅ ${completos} asientos completos\n` +
          `⚠️ ${asientos.filter(a => a.estadoCheques === 'parcial').length} asientos parciales\n` +
          `❌ ${asientos.filter(a => a.estadoCheques === 'sin_cheques').length} sin cheques\n` +
          `📌 ${chequesQueSiguenSinAsociar.length} cheques sin asociar`);
}

/**
 * Guardar el progreso de conciliación del mes actual
 */
function guardarConciliacionMes() {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) {
        alert('Seleccione un mes primero');
        return;
    }

    guardarMesesProcesados();
    alert('✅ Progreso del mes guardado correctamente');
}

/**
 * Mostrar cheques disponibles para vincular a un asiento (usando modal)
 */
function mostrarChequesParaVincular(asientoId) {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    const asiento = estadoMes.asientosDelMes.find(a => a.id === asientoId);
    const chequesDisponibles = estadoMes.chequesNoAsociadosDelMes || [];

    if (chequesDisponibles.length === 0) {
        alert('No hay cheques disponibles para vincular');
        return;
    }

    // Configurar estado del modal
    estadoModalVincular = {
        tipo: 'asiento-a-cheque',
        elementoOrigen: asiento,
        opcionesTodas: chequesDisponibles,
        opcionesDisponibles: chequesDisponibles,
        opcionSeleccionada: null
    };

    // Abrir modal
    abrirModalVincularManual();
}

/**
 * Mostrar asientos disponibles para vincular un cheque (usando modal)
 */
function mostrarAsientosParaVincular(chequeId) {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    const cheque = estadoMes.chequesNoAsociadosDelMes.find(c => (c.id || c.interno) === chequeId);
    if (!cheque) return;

    const asientosDisponibles = estadoMes.asientosDelMes.filter(a => a.estadoCheques !== 'completo');

    if (asientosDisponibles.length === 0) {
        alert('No hay asientos disponibles para vincular (todos completos)');
        return;
    }

    // Configurar estado del modal
    estadoModalVincular = {
        tipo: 'cheque-a-asiento',
        elementoOrigen: cheque,
        opcionesTodas: asientosDisponibles,
        opcionesDisponibles: asientosDisponibles,
        opcionSeleccionada: null
    };

    // Abrir modal
    abrirModalVincularManual();
}

/**
 * Abrir modal de vinculación manual
 */
function abrirModalVincularManual() {
    const overlay = document.getElementById('overlay-vincular-manual');
    const modal = document.getElementById('modal-vincular-manual');

    // Configurar título según el tipo
    const titulo = document.getElementById('titulo-modal-vincular');
    const listaTitulo = document.getElementById('vincular-lista-titulo');

    if (estadoModalVincular.tipo === 'cheque-a-asiento') {
        titulo.textContent = '🔗 Vincular Cheque a Asiento';
        listaTitulo.textContent = 'Asientos disponibles';
    } else {
        titulo.textContent = '🔗 Vincular Asiento a Cheque';
        listaTitulo.textContent = 'Cheques disponibles';
    }

    // Renderizar información del elemento origen
    renderizarElementoOrigen();

    // Limpiar filtros
    document.getElementById('filtro-busqueda-vincular').value = '';
    document.getElementById('filtro-solo-compatibles').checked = true;

    // Renderizar opciones
    filtrarOpcionesVincular();

    // Deshabilitar botón de confirmar
    document.getElementById('btn-confirmar-vincular').disabled = true;

    // Mostrar modal
    overlay.classList.add('active');
    modal.classList.add('active');
}

/**
 * Cerrar modal de vinculación manual
 */
function cerrarModalVincularManual() {
    const overlay = document.getElementById('overlay-vincular-manual');
    const modal = document.getElementById('modal-vincular-manual');

    overlay.classList.remove('active');
    modal.classList.remove('active');

    // Limpiar estado
    estadoModalVincular = {
        tipo: null,
        elementoOrigen: null,
        opcionesDisponibles: [],
        opcionesTodas: [],
        opcionSeleccionada: null
    };
}

/**
 * Renderizar información del elemento origen en el modal
 */
function renderizarElementoOrigen() {
    const container = document.getElementById('info-elemento-vincular');
    const elem = estadoModalVincular.elementoOrigen;

    if (estadoModalVincular.tipo === 'cheque-a-asiento') {
        // El elemento origen es un cheque
        const fechaRecep = elem.fechaRecepcion
            ? formatearFecha(elem.fechaRecepcion instanceof Date ? elem.fechaRecepcion : new Date(elem.fechaRecepcion))
            : '-';

        container.innerHTML = `
            <div class="elemento-tipo">Cheque seleccionado</div>
            <div class="elemento-principal">
                <span class="elemento-descripcion">${elem.numero || elem.interno || 'S/N'} - ${elem.origen || 'Sin origen'}</span>
                <span class="elemento-monto">${formatearMoneda(elem.importe)}</span>
            </div>
            <div class="elemento-detalles">
                <div class="elemento-detalle">
                    <span class="elemento-detalle-label">F. Recepción:</span>
                    <span>${fechaRecep}</span>
                </div>
                <div class="elemento-detalle">
                    <span class="elemento-detalle-label">Estado:</span>
                    <span>${elem.estado || '-'}</span>
                </div>
            </div>
        `;
    } else {
        // El elemento origen es un asiento
        const sumaCheques = elem.chequesAsociados ? elem.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0;
        const diferencia = elem.debe - sumaCheques;

        container.innerHTML = `
            <div class="elemento-tipo">Asiento seleccionado</div>
            <div class="elemento-principal">
                <span class="elemento-descripcion">${elem.asiento || 'S/N'} - ${truncarTexto(elem.descripcion, 50)}</span>
                <span class="elemento-monto">${formatearMoneda(elem.debe)}</span>
            </div>
            <div class="elemento-detalles">
                <div class="elemento-detalle">
                    <span class="elemento-detalle-label">Fecha:</span>
                    <span>${elem.fecha ? formatearFecha(new Date(elem.fecha)) : '-'}</span>
                </div>
                <div class="elemento-detalle">
                    <span class="elemento-detalle-label">Cheques asociados:</span>
                    <span>${elem.chequesAsociados ? elem.chequesAsociados.length : 0}</span>
                </div>
                ${diferencia > 0 ? `
                <div class="elemento-detalle">
                    <span class="elemento-detalle-label">Pendiente:</span>
                    <span style="color: #f59e0b; font-weight: 600;">${formatearMoneda(diferencia)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}

/**
 * Filtrar opciones de vinculación según los filtros activos
 */
function filtrarOpcionesVincular() {
    const busqueda = document.getElementById('filtro-busqueda-vincular').value.toLowerCase();
    const soloCompatibles = document.getElementById('filtro-solo-compatibles').checked;
    const elem = estadoModalVincular.elementoOrigen;

    let montoReferencia;
    if (estadoModalVincular.tipo === 'cheque-a-asiento') {
        montoReferencia = elem.importe;
    } else {
        // Para asiento a cheque, calcular el pendiente
        const sumaCheques = elem.chequesAsociados ? elem.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0;
        montoReferencia = elem.debe - sumaCheques;
    }

    let filtradas = estadoModalVincular.opcionesTodas.filter(opcion => {
        // Filtro de búsqueda
        if (busqueda) {
            const texto = estadoModalVincular.tipo === 'cheque-a-asiento'
                ? `${opcion.asiento || ''} ${opcion.descripcion || ''}`.toLowerCase()
                : `${opcion.numero || ''} ${opcion.interno || ''} ${opcion.origen || ''}`.toLowerCase();
            if (!texto.includes(busqueda)) return false;
        }

        // Filtro de montos compatibles (±5%)
        if (soloCompatibles) {
            const montoOpcion = estadoModalVincular.tipo === 'cheque-a-asiento'
                ? (opcion.debe - (opcion.chequesAsociados ? opcion.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0))
                : opcion.importe;
            const tolerancia = montoReferencia * 0.05;
            if (Math.abs(montoOpcion - montoReferencia) > tolerancia && montoOpcion > 0) {
                // También mostrar si el monto de la opción es mayor (podría ser una asociación parcial)
                if (montoOpcion < montoReferencia * 0.5) return false;
            }
        }

        return true;
    });

    // Aplicar ordenamiento según selector
    filtradas = aplicarOrdenamientoVincular(filtradas, montoReferencia);

    estadoModalVincular.opcionesDisponibles = filtradas;

    // Actualizar contador
    document.getElementById('vincular-lista-count').textContent = filtradas.length;

    // Renderizar opciones
    renderizarOpcionesVincular();
}

/**
 * Ordenar opciones de vinculación según el selector
 */
function ordenarOpcionesVincular() {
    filtrarOpcionesVincular();
}

/**
 * Aplicar ordenamiento a las opciones de vinculación
 */
function aplicarOrdenamientoVincular(opciones, montoReferencia) {
    const selectOrden = document.getElementById('ordenar-opciones-vincular');
    const criterio = selectOrden ? selectOrden.value : 'compatibilidad';

    const getMonto = (opcion) => {
        if (estadoModalVincular.tipo === 'cheque-a-asiento') {
            return opcion.debe - (opcion.chequesAsociados ? opcion.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0);
        }
        return opcion.importe || 0;
    };

    const getNumero = (opcion) => {
        if (estadoModalVincular.tipo === 'cheque-a-asiento') {
            return (opcion.numeroAsiento || opcion.id || '').toString();
        }
        return (opcion.numero || opcion.interno || '').toString();
    };

    const getDescripcion = (opcion) => {
        if (estadoModalVincular.tipo === 'cheque-a-asiento') {
            return (opcion.descripcion || '').toLowerCase();
        }
        return (opcion.origen || '').toLowerCase();
    };

    if (criterio === 'compatibilidad') {
        // Ordenar por diferencia de monto (los más cercanos primero)
        opciones.sort((a, b) => {
            const montoA = getMonto(a);
            const montoB = getMonto(b);
            return Math.abs(montoA - montoReferencia) - Math.abs(montoB - montoReferencia);
        });
    } else {
        const [campo, direccion] = criterio.split('-');

        opciones.sort((a, b) => {
            let valorA, valorB;

            switch (campo) {
                case 'numero':
                    valorA = getNumero(a);
                    valorB = getNumero(b);
                    // Intentar comparación numérica si es posible
                    const numA = parseInt(valorA.replace(/\D/g, ''));
                    const numB = parseInt(valorB.replace(/\D/g, ''));
                    if (!isNaN(numA) && !isNaN(numB)) {
                        valorA = numA;
                        valorB = numB;
                    }
                    break;
                case 'monto':
                    valorA = getMonto(a);
                    valorB = getMonto(b);
                    break;
                case 'descripcion':
                    valorA = getDescripcion(a);
                    valorB = getDescripcion(b);
                    break;
                default:
                    valorA = 0;
                    valorB = 0;
            }

            let resultado;
            if (typeof valorA === 'string' && typeof valorB === 'string') {
                resultado = valorA.localeCompare(valorB, 'es');
            } else {
                resultado = valorA - valorB;
            }

            return direccion === 'desc' ? -resultado : resultado;
        });
    }

    return opciones;
}

/**
 * Renderizar lista de opciones de vinculación
 */
function renderizarOpcionesVincular() {
    const container = document.getElementById('vincular-lista-opciones');
    const opciones = estadoModalVincular.opcionesDisponibles;
    const elem = estadoModalVincular.elementoOrigen;

    if (opciones.length === 0) {
        container.innerHTML = `
            <div class="vincular-lista-vacia">
                <div class="icono">🔍</div>
                <div class="mensaje">No se encontraron opciones con los filtros actuales</div>
            </div>
        `;
        return;
    }

    // Calcular monto de referencia para diferencias
    let montoReferencia;
    if (estadoModalVincular.tipo === 'cheque-a-asiento') {
        montoReferencia = elem.importe;
    } else {
        const sumaCheques = elem.chequesAsociados ? elem.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0;
        montoReferencia = elem.debe - sumaCheques;
    }

    container.innerHTML = opciones.map(opcion => {
        const id = estadoModalVincular.tipo === 'cheque-a-asiento'
            ? opcion.id
            : (opcion.id || opcion.interno);

        const isSelected = estadoModalVincular.opcionSeleccionada === id;

        if (estadoModalVincular.tipo === 'cheque-a-asiento') {
            // Renderizar opción de asiento
            const sumaCheques = opcion.chequesAsociados ? opcion.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0) : 0;
            const pendiente = opcion.debe - sumaCheques;
            const diferencia = montoReferencia - pendiente;
            const porcentajeDif = Math.abs(diferencia / montoReferencia * 100);

            let claseDif = 'compatible';
            if (porcentajeDif > 5 && porcentajeDif <= 20) claseDif = 'warning';
            else if (porcentajeDif > 20) claseDif = 'error';

            let estadoBadge = '';
            if (opcion.chequesAsociados && opcion.chequesAsociados.length > 0) {
                estadoBadge = `<span class="estado-badge parcial">Parcial (${opcion.chequesAsociados.length} ch.)</span>`;
            } else {
                estadoBadge = `<span class="estado-badge sin-vincular">Sin cheques</span>`;
            }

            return `
                <div class="vincular-opcion-item ${isSelected ? 'selected' : ''}" onclick="seleccionarOpcionVincular('${id}')">
                    <input type="radio" name="opcion-vincular" class="vincular-opcion-radio" ${isSelected ? 'checked' : ''}>
                    <div class="vincular-opcion-info">
                        <div class="vincular-opcion-numero">${opcion.asiento || 'S/N'}</div>
                        <div class="vincular-opcion-descripcion" title="${opcion.descripcion}">${truncarTexto(opcion.descripcion, 45)}</div>
                    </div>
                    <div class="vincular-opcion-monto">
                        <div class="monto-valor">${formatearMoneda(pendiente)}</div>
                        <div class="monto-diferencia ${claseDif}">
                            ${diferencia === 0 ? '✓ Exacto' : (diferencia > 0 ? `+${formatearMoneda(diferencia)}` : formatearMoneda(diferencia))}
                        </div>
                    </div>
                    <div class="vincular-opcion-estado">
                        ${estadoBadge}
                    </div>
                </div>
            `;
        } else {
            // Renderizar opción de cheque
            const diferencia = montoReferencia - opcion.importe;
            const porcentajeDif = Math.abs(diferencia / montoReferencia * 100);

            let claseDif = 'compatible';
            if (porcentajeDif > 5 && porcentajeDif <= 20) claseDif = 'warning';
            else if (porcentajeDif > 20) claseDif = 'error';

            const fechaRecep = opcion.fechaRecepcion
                ? formatearFecha(opcion.fechaRecepcion instanceof Date ? opcion.fechaRecepcion : new Date(opcion.fechaRecepcion))
                : '-';

            return `
                <div class="vincular-opcion-item ${isSelected ? 'selected' : ''}" onclick="seleccionarOpcionVincular('${id}')">
                    <input type="radio" name="opcion-vincular" class="vincular-opcion-radio" ${isSelected ? 'checked' : ''}>
                    <div class="vincular-opcion-info">
                        <div class="vincular-opcion-numero">${opcion.numero || opcion.interno || 'S/N'}</div>
                        <div class="vincular-opcion-descripcion" title="${opcion.origen}">${opcion.origen || 'Sin origen'} - ${fechaRecep}</div>
                    </div>
                    <div class="vincular-opcion-monto">
                        <div class="monto-valor">${formatearMoneda(opcion.importe)}</div>
                        <div class="monto-diferencia ${claseDif}">
                            ${diferencia === 0 ? '✓ Exacto' : (diferencia > 0 ? `+${formatearMoneda(diferencia)}` : formatearMoneda(diferencia))}
                        </div>
                    </div>
                    <div class="vincular-opcion-estado">
                        <span class="estado-badge ${opcion.estado === 'transferido' ? 'completo' : 'sin-vincular'}">${opcion.estado || 'pendiente'}</span>
                    </div>
                </div>
            `;
        }
    }).join('');
}

/**
 * Seleccionar una opción de vinculación
 */
function seleccionarOpcionVincular(id) {
    estadoModalVincular.opcionSeleccionada = id;

    // Actualizar visualización
    document.querySelectorAll('.vincular-opcion-item').forEach(item => {
        item.classList.remove('selected');
        item.querySelector('.vincular-opcion-radio').checked = false;
    });

    const itemSeleccionado = document.querySelector(`.vincular-opcion-item[onclick*="'${id}'"]`);
    if (itemSeleccionado) {
        itemSeleccionado.classList.add('selected');
        itemSeleccionado.querySelector('.vincular-opcion-radio').checked = true;
    }

    // Habilitar botón de confirmar
    document.getElementById('btn-confirmar-vincular').disabled = false;
}

/**
 * Confirmar vinculación manual
 */
function confirmarVinculacionManual() {
    if (!estadoModalVincular.opcionSeleccionada) return;

    const id = estadoModalVincular.opcionSeleccionada;

    if (estadoModalVincular.tipo === 'cheque-a-asiento') {
        // Vincular cheque a asiento seleccionado
        const asiento = estadoModalVincular.opcionesDisponibles.find(a => a.id === id);
        if (asiento) {
            vincularChequeAAsientoMes(estadoModalVincular.elementoOrigen, asiento.id);
        }
    } else {
        // Vincular asiento a cheque seleccionado
        const cheque = estadoModalVincular.opcionesDisponibles.find(c => (c.id || c.interno) === id);
        if (cheque) {
            vincularChequeAAsientoMes(cheque, estadoModalVincular.elementoOrigen.id);
        }
    }

    // Cerrar modal
    cerrarModalVincularManual();
}

/**
 * Vincular un cheque a un asiento en la conciliación del mes
 */
function vincularChequeAAsientoMes(cheque, asientoId) {
    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    const asiento = estadoMes.asientosDelMes.find(a => a.id === asientoId);
    if (!asiento) return;

    // Agregar cheque al asiento
    const chequeEnriquecido = {
        id: cheque.id || `cheque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...cheque
    };
    asiento.chequesAsociados.push(chequeEnriquecido);

    // Remover de cheques no asociados del mes actual
    const idxCheque = estadoMes.chequesNoAsociadosDelMes.findIndex(c => (c.id || c.interno) === (cheque.id || cheque.interno));
    if (idxCheque !== -1) {
        estadoMes.chequesNoAsociadosDelMes.splice(idxCheque, 1);
    }

    // Si el cheque es de un mes anterior, también eliminarlo de su mes de origen
    if (cheque.esDeMesAnterior && cheque.mesOrigen && cheque.mesOrigen !== mesKey) {
        const estadoMesOrigen = stateMayores.mesesProcesados[cheque.mesOrigen];
        if (estadoMesOrigen && estadoMesOrigen.chequesNoAsociadosDelMes) {
            const idxEnOrigen = estadoMesOrigen.chequesNoAsociadosDelMes.findIndex(
                c => (c.id || c.interno) === (cheque.id || cheque.interno)
            );
            if (idxEnOrigen !== -1) {
                estadoMesOrigen.chequesNoAsociadosDelMes.splice(idxEnOrigen, 1);
            }
        }
    }

    // Marcar el cheque como vinculado en el listado original para que no aparezca
    // como disponible al procesar otros meses
    const chequeOriginal = stateMayores.listadoChequesCargados?.find(
        c => (c.id || c.interno) === (cheque.id || cheque.interno)
    );
    if (chequeOriginal) {
        chequeOriginal.asientoAsociado = asiento.asiento || asientoId;
    }

    // Recalcular estado del asiento
    const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
    if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
        asiento.estadoCheques = 'completo';
    } else {
        asiento.estadoCheques = 'parcial';
        asiento.diferenciaCheques = asiento.debe - sumaCheques;
    }

    // Actualizar estado del mes
    estadoMes.procesado = true;
    estadoMes.completo = estadoMes.chequesNoAsociadosDelMes.length === 0 &&
                         estadoMes.asientosDelMes.every(a => a.estadoCheques === 'completo');
    estadoMes.pendientes = estadoMes.asientosDelMes.filter(a => a.estadoCheques !== 'completo').length;

    // Renderizar actualización
    renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes);
    renderizarListaMeses();
}

// ==========================================
// FUNCIONES PARA SELECCIÓN MÚLTIPLE DE CHEQUES
// ==========================================

/**
 * Toggle selección de un cheque individual
 */
function toggleSeleccionCheque(chequeId, isSelected) {
    if (isSelected) {
        chequesSeleccionados.add(chequeId);
    } else {
        chequesSeleccionados.delete(chequeId);
    }

    // Actualizar visual de la fila
    const checkbox = document.querySelector(`input[data-cheque-id="${chequeId}"]`);
    if (checkbox) {
        const fila = checkbox.closest('tr');
        if (fila) {
            fila.classList.toggle('fila-seleccionada', isSelected);
        }
    }

    actualizarContadorSeleccionados();
    actualizarCheckboxSeleccionarTodos(chequesNoAsociadosOriginales);
}

/**
 * Toggle seleccionar/deseleccionar todos los cheques
 */
function toggleSeleccionarTodosCheques(seleccionar) {
    const checkboxes = document.querySelectorAll('.checkbox-cheque');

    if (seleccionar) {
        // Seleccionar todos los cheques visibles
        checkboxes.forEach(cb => {
            const chequeId = cb.dataset.chequeId;
            chequesSeleccionados.add(chequeId);
            cb.checked = true;
            const fila = cb.closest('tr');
            if (fila) fila.classList.add('fila-seleccionada');
        });
    } else {
        // Deseleccionar todos
        chequesSeleccionados.clear();
        checkboxes.forEach(cb => {
            cb.checked = false;
            const fila = cb.closest('tr');
            if (fila) fila.classList.remove('fila-seleccionada');
        });
    }

    actualizarContadorSeleccionados();
}

/**
 * Actualizar estado del checkbox "seleccionar todos"
 */
function actualizarCheckboxSeleccionarTodos(cheques) {
    const checkboxTodos = document.getElementById('checkboxSeleccionarTodosCheques');
    if (!checkboxTodos) return;

    const checkboxesVisibles = document.querySelectorAll('.checkbox-cheque');
    const todosSeleccionados = checkboxesVisibles.length > 0 &&
        Array.from(checkboxesVisibles).every(cb => cb.checked);
    const algunosSeleccionados = Array.from(checkboxesVisibles).some(cb => cb.checked);

    checkboxTodos.checked = todosSeleccionados;
    checkboxTodos.indeterminate = algunosSeleccionados && !todosSeleccionados;
}

/**
 * Actualizar contador de cheques seleccionados y visibilidad del botón
 */
function actualizarContadorSeleccionados() {
    const contador = document.getElementById('contadorSeleccionados');
    const boton = document.getElementById('btnVincularSeleccionados');

    if (contador) {
        contador.textContent = chequesSeleccionados.size;
    }

    if (boton) {
        boton.style.display = chequesSeleccionados.size > 0 ? 'inline-flex' : 'none';
    }
}

/**
 * Abrir modal para vincular múltiples cheques
 */
function abrirModalVincularMultiples() {
    if (chequesSeleccionados.size === 0) {
        mostrarNotificacion('Seleccione al menos un cheque para vincular', 'warning');
        return;
    }

    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    // Obtener los cheques seleccionados
    const chequesParaVincular = estadoMes.chequesNoAsociadosDelMes.filter(ch =>
        chequesSeleccionados.has(ch.id || ch.interno)
    );

    // Calcular importe total
    const importeTotal = chequesParaVincular.reduce((sum, ch) => sum + (ch.importe || 0), 0);

    // Actualizar resumen en el modal
    document.getElementById('cantidadChequesSeleccionados').textContent = chequesParaVincular.length;
    document.getElementById('importeTotalSeleccionados').textContent = formatearMoneda(importeTotal);

    // Renderizar lista de cheques seleccionados
    const listaChequesContainer = document.getElementById('listaChequesAVincular');
    listaChequesContainer.innerHTML = chequesParaVincular.map(cheque => `
        <div class="vincular-opcion-item cheque-seleccionado-item">
            <div class="opcion-info">
                <span class="opcion-numero">#${cheque.numero || cheque.interno}</span>
                <span class="opcion-descripcion">${truncarTexto(cheque.origen || '', 30)}</span>
            </div>
            <div class="opcion-monto">${formatearMoneda(cheque.importe)}</div>
        </div>
    `).join('');

    // Obtener asientos disponibles del mes
    asientosDisponiblesParaVincular = estadoMes.asientosDelMes.filter(a =>
        a.estadoCheques !== 'completo'
    );

    // Limpiar filtro y selección anterior
    const filtroInput = document.getElementById('filtro-busqueda-vincular-multiples');
    if (filtroInput) filtroInput.value = '';
    asientoSeleccionadoParaVincularMultiples = null;

    // Renderizar asientos disponibles
    renderizarAsientosParaVincularMultiples(asientosDisponiblesParaVincular);

    // Deshabilitar botón de confirmar hasta que se seleccione un asiento
    document.getElementById('btn-confirmar-vincular-multiples').disabled = true;

    // Mostrar modal
    document.getElementById('overlay-vincular-multiples').style.display = 'block';
    document.getElementById('modal-vincular-multiples').style.display = 'block';
}

/**
 * Cerrar modal de vinculación múltiple
 */
function cerrarModalVincularMultiples() {
    document.getElementById('overlay-vincular-multiples').style.display = 'none';
    document.getElementById('modal-vincular-multiples').style.display = 'none';
    asientoSeleccionadoParaVincularMultiples = null;
}

/**
 * Renderizar asientos disponibles para vincular múltiples cheques
 */
function renderizarAsientosParaVincularMultiples(asientos) {
    const container = document.getElementById('listaAsientosVincularMultiples');
    const countBadge = document.getElementById('vincular-multiples-lista-count');

    if (countBadge) {
        countBadge.textContent = asientos.length;
    }

    if (asientos.length === 0) {
        container.innerHTML = `
            <div class="vincular-sin-opciones">
                No hay asientos disponibles para vincular
            </div>
        `;
        return;
    }

    container.innerHTML = asientos.map(asiento => {
        const montoPendiente = asiento.debe - (asiento.chequesAsociados?.reduce((sum, ch) => sum + ch.importe, 0) || 0);
        const isSelected = asientoSeleccionadoParaVincularMultiples === asiento.id;

        return `
            <div class="vincular-opcion-item ${isSelected ? 'opcion-seleccionada' : ''}"
                 onclick="seleccionarAsientoParaVincularMultiples('${asiento.id}')">
                <div class="opcion-radio">
                    <input type="radio" name="asiento-vincular-multiples"
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); seleccionarAsientoParaVincularMultiples('${asiento.id}')">
                </div>
                <div class="opcion-info">
                    <span class="opcion-numero">Asiento ${asiento.numeroAsiento || asiento.id}</span>
                    <span class="opcion-descripcion">${truncarTexto(asiento.descripcion || '', 40)}</span>
                </div>
                <div class="opcion-monto-container">
                    <span class="opcion-monto">${formatearMoneda(asiento.debe)}</span>
                    <span class="opcion-pendiente">Pendiente: ${formatearMoneda(montoPendiente)}</span>
                </div>
                <div class="opcion-estado">
                    <span class="badge-estado ${asiento.estadoCheques || 'sin-cheques'}">${
                        asiento.estadoCheques === 'parcial' ? 'Parcial' :
                        asiento.estadoCheques === 'completo' ? 'Completo' : 'Sin cheques'
                    }</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filtrar asientos en el modal de vinculación múltiple
 */
function filtrarAsientosParaVincularMultiples() {
    // Llamar a ordenar que también aplica el filtro
    ordenarAsientosParaVincular();
}

/**
 * Ordenar asientos disponibles para vincular
 */
function ordenarAsientosParaVincular() {
    const selectOrden = document.getElementById('ordenar-asientos-vincular');
    if (!selectOrden) return;

    const criterio = selectOrden.value;
    const [campo, direccion] = criterio.split('-');

    // Primero aplicar filtro si existe
    const filtro = (document.getElementById('filtro-busqueda-vincular-multiples')?.value || '').toLowerCase().trim();

    let asientosParaOrdenar = asientosDisponiblesParaVincular.filter(asiento => {
        if (!filtro) return true;
        const numero = (asiento.numeroAsiento || asiento.id || '').toString().toLowerCase();
        const descripcion = (asiento.descripcion || '').toLowerCase();
        return numero.includes(filtro) || descripcion.includes(filtro);
    });

    // Función para calcular monto pendiente
    const getMontoPendiente = (asiento) => {
        return asiento.debe - (asiento.chequesAsociados?.reduce((sum, ch) => sum + ch.importe, 0) || 0);
    };

    // Ordenar según criterio
    asientosParaOrdenar.sort((a, b) => {
        let valorA, valorB;

        switch (campo) {
            case 'numero':
                valorA = (a.numeroAsiento || a.id || '').toString();
                valorB = (b.numeroAsiento || b.id || '').toString();
                // Intentar comparación numérica si es posible
                const numA = parseInt(valorA.replace(/\D/g, ''));
                const numB = parseInt(valorB.replace(/\D/g, ''));
                if (!isNaN(numA) && !isNaN(numB)) {
                    valorA = numA;
                    valorB = numB;
                }
                break;
            case 'monto':
                valorA = a.debe || 0;
                valorB = b.debe || 0;
                break;
            case 'pendiente':
                valorA = getMontoPendiente(a);
                valorB = getMontoPendiente(b);
                break;
            case 'descripcion':
                valorA = (a.descripcion || '').toLowerCase();
                valorB = (b.descripcion || '').toLowerCase();
                break;
            default:
                valorA = 0;
                valorB = 0;
        }

        // Comparación
        let resultado;
        if (typeof valorA === 'string' && typeof valorB === 'string') {
            resultado = valorA.localeCompare(valorB, 'es');
        } else {
            resultado = valorA - valorB;
        }

        return direccion === 'desc' ? -resultado : resultado;
    });

    renderizarAsientosParaVincularMultiples(asientosParaOrdenar);
}

/**
 * Seleccionar un asiento para vincular múltiples cheques
 */
function seleccionarAsientoParaVincularMultiples(asientoId) {
    asientoSeleccionadoParaVincularMultiples = asientoId;

    // Actualizar visual
    document.querySelectorAll('#listaAsientosVincularMultiples .vincular-opcion-item').forEach(item => {
        item.classList.remove('opcion-seleccionada');
        const radio = item.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });

    const itemSeleccionado = document.querySelector(`#listaAsientosVincularMultiples .vincular-opcion-item[onclick*="'${asientoId}'"]`);
    if (itemSeleccionado) {
        itemSeleccionado.classList.add('opcion-seleccionada');
        const radio = itemSeleccionado.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    // Habilitar botón de confirmar
    document.getElementById('btn-confirmar-vincular-multiples').disabled = false;
}

/**
 * Confirmar vinculación de múltiples cheques a un asiento
 */
function confirmarVinculacionMultiple() {
    if (!asientoSeleccionadoParaVincularMultiples) {
        mostrarNotificacion('Seleccione un asiento para vincular', 'warning');
        return;
    }

    const mesKey = stateMayores.mesActualConciliacion;
    if (!mesKey) return;

    const estadoMes = stateMayores.mesesProcesados[mesKey];
    if (!estadoMes) return;

    const asiento = estadoMes.asientosDelMes.find(a => a.id === asientoSeleccionadoParaVincularMultiples);
    if (!asiento) {
        mostrarNotificacion('No se encontró el asiento seleccionado', 'error');
        return;
    }

    // Obtener cheques seleccionados
    const chequesParaVincular = estadoMes.chequesNoAsociadosDelMes.filter(ch =>
        chequesSeleccionados.has(ch.id || ch.interno)
    );

    if (chequesParaVincular.length === 0) {
        mostrarNotificacion('No hay cheques para vincular', 'warning');
        return;
    }

    // Vincular cada cheque al asiento
    let vinculados = 0;
    chequesParaVincular.forEach(cheque => {
        const chequeEnriquecido = {
            id: cheque.id || `cheque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...cheque
        };
        asiento.chequesAsociados.push(chequeEnriquecido);

        // Remover de cheques no asociados del mes actual
        const idx = estadoMes.chequesNoAsociadosDelMes.findIndex(c =>
            (c.id || c.interno) === (cheque.id || cheque.interno)
        );
        if (idx !== -1) {
            estadoMes.chequesNoAsociadosDelMes.splice(idx, 1);
        }

        // Si el cheque es de un mes anterior, también eliminarlo de su mes de origen
        if (cheque.esDeMesAnterior && cheque.mesOrigen && cheque.mesOrigen !== mesKey) {
            const estadoMesOrigen = stateMayores.mesesProcesados[cheque.mesOrigen];
            if (estadoMesOrigen && estadoMesOrigen.chequesNoAsociadosDelMes) {
                const idxEnOrigen = estadoMesOrigen.chequesNoAsociadosDelMes.findIndex(
                    c => (c.id || c.interno) === (cheque.id || cheque.interno)
                );
                if (idxEnOrigen !== -1) {
                    estadoMesOrigen.chequesNoAsociadosDelMes.splice(idxEnOrigen, 1);
                }
            }
        }
        vinculados++;
    });

    // Recalcular estado del asiento
    const sumaCheques = asiento.chequesAsociados.reduce((sum, ch) => sum + ch.importe, 0);
    if (Math.abs(asiento.debe - sumaCheques) <= 0.01) {
        asiento.estadoCheques = 'completo';
    } else {
        asiento.estadoCheques = 'parcial';
        asiento.diferenciaCheques = asiento.debe - sumaCheques;
    }

    // Actualizar estado del mes
    estadoMes.procesado = true;
    estadoMes.completo = estadoMes.chequesNoAsociadosDelMes.length === 0 &&
                         estadoMes.asientosDelMes.every(a => a.estadoCheques === 'completo');
    estadoMes.pendientes = estadoMes.asientosDelMes.filter(a => a.estadoCheques !== 'completo').length;

    // Limpiar selección
    chequesSeleccionados.clear();
    actualizarContadorSeleccionados();

    // Cerrar modal
    cerrarModalVincularMultiples();

    // Renderizar actualización
    renderizarConciliacionMes(estadoMes.asientosDelMes, estadoMes.chequesNoAsociadosDelMes);
    renderizarListaMeses();

    mostrarNotificacion(`${vinculados} cheque(s) vinculado(s) al asiento exitosamente`, 'success');
}

console.log('✅ Módulo de Mayores Contables cargado');
