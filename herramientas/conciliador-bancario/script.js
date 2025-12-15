/**
 * Conciliador Bancario
 * Compara movimientos del Mayor Contable con Extractos Bancarios
 *
 * Formatos de archivo Mayor soportados:
 * - Tango (exportación "Mayor por cuenta analítico") - Sin modificaciones necesarias
 * - Formato genérico con columnas: Fecha, Debe, Haber, Leyenda/Descripción
 *
 * Lógica de conciliación:
 * - Debe del Mayor (entrada de dinero) = Crédito del Extracto
 * - Haber del Mayor (salida de dinero) = Débito del Extracto
 */

console.log('=== script.js cargado correctamente ===');

// Estado de la aplicación
let state = {
    tipoConciliacion: null, // 'creditos' o 'debitos'
    datosMayor: [],
    datosExtracto: [],
    toleranciaFecha: 0, // Proceso inicial: sin tolerancia de fecha
    toleranciaImporte: 0, // Proceso inicial: sin tolerancia de importe
    exigenciaPalabras: 2, // Proceso inicial: 2 palabras coincidentes exigidas
    resultados: null,
    eliminados: [], // Movimientos del Mayor eliminados del proceso de conciliación
    // Integración con auditoría
    fuenteExtracto: 'archivo', // 'archivo' o 'auditoria'
    clienteSeleccionado: null,
    cuentaSeleccionada: null,
    extractosAuditoria: [], // Extractos cargados desde auditoría
    rangoExtractos: { desde: null, hasta: null },
    // Administración del mayor
    mayorAdministrado: false, // Si el usuario ha revisado/administrado el mayor
    filtrosMayorAdmin: {}, // Filtros aplicados en administración del mayor
    filtroCategoriaMayorAdmin: [], // Categorías seleccionadas para filtrar
    // Control de vista inicial de pendientes
    vistaInicialMostrada: false, // Si ya se mostró la vista inicial de pendientes
    datosVistaInicial: null // Hash de los datos para detectar cambios
};

// Memoria de desconciliaciones manuales - pares de IDs que no deben volver a conciliarse automáticamente
// Formato: [{ mayorIds: ['id1', 'id2'], extractoIds: ['id3', 'id4'] }, ...]
let desconciliacionesManuales = [];

// Categorías predefinidas por defecto (se cargan desde BD o localStorage)
const CATEGORIAS_DEFAULT = [
    { id: 'comisiones', nombre: 'Comisiones', color: '#f59e0b', orden: 1 },
    { id: 'iva', nombre: 'IVA', color: '#8b5cf6', orden: 2 },
    { id: 'gastos_bancarios', nombre: 'Gastos Bancarios', color: '#ef4444', orden: 3 },
    { id: 'transferencias', nombre: 'Transferencias', color: '#3b82f6', orden: 4 },
    { id: 'impuestos', nombre: 'Impuestos', color: '#ec4899', orden: 5 },
    { id: 'servicios', nombre: 'Servicios', color: '#14b8a6', orden: 6 },
    { id: 'proveedores', nombre: 'Proveedores', color: '#f97316', orden: 7 },
    { id: 'sueldos', nombre: 'Sueldos', color: '#06b6d4', orden: 8 },
    { id: 'ventas', nombre: 'Ventas', color: '#22c55e', orden: 9 },
    { id: 'otros', nombre: 'Otros', color: '#64748b', orden: 10 }
];

// Categorías dinámicas (se cargan al inicio)
let CATEGORIAS_MOVIMIENTO = [
    { id: '', nombre: '-- Sin categoría --', color: '#94a3b8' }
];

// Cache de datos de auditoría
let auditoriaCache = {
    clientes: [],
    cuentas: [],
    extractosDisponibles: []
};

// Datos formateados de auditoría para los selectores
let auditoriaData = {
    clientes: [],
    cuentas: []
};

// Estado de selección para conciliación manual
let seleccion = {
    mayor: [],      // IDs de movimientos del Mayor seleccionados
    extracto: []    // IDs de movimientos del Extracto seleccionados
};

// Estado de selección para cambio de color masivo en conciliados
let seleccionConciliados = [];  // IDs de conciliaciones seleccionadas

// Contador para IDs únicos de conciliaciones
let conciliacionIdCounter = 0;

// Estado de filtros para Mayor Pendiente
let filtrosMayor = {
    fechaDesde: null,
    fechaHasta: null,
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    numeroAsiento: '',
    leyenda: '',
    ce: 'todos',
    tipo: 'todos'
};

// Estado de filtros para Extracto Pendiente
let filtrosExtracto = {
    fechaDesde: null,
    fechaHasta: null,
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    descripcion: '',
    origen: ''
};

// Estado de filtros para Conciliados (panel unificado - legacy)
let filtrosConciliados = {
    // Mayor
    fechaMayorDesde: null,
    fechaMayorHasta: null,
    numeroAsiento: '',
    leyenda: '',
    // Extracto
    fechaExtractoDesde: null,
    fechaExtractoHasta: null,
    descripcion: '',
    origen: '',
    // Importe (aplica a ambos)
    importeTipo: '',
    importeValor: null,
    importeValor2: null
};

// Estado de visibilidad de grupos de conciliados (verde/naranja)
let gruposConciliados = {
    verdesVisible: true,
    naranjasVisible: true
};

// Flag para bloquear toggles durante cambio de color (evita conflictos de eventos)
let bloqueandoToggleGrupos = false;

// Estado de filtros para Conciliados Verdes
let filtrosConciliadosVerdes = {
    fechaMayorDesde: null,
    fechaMayorHasta: null,
    numeroAsiento: '',
    leyenda: '',
    fechaExtractoDesde: null,
    fechaExtractoHasta: null,
    descripcion: '',
    origen: '',
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    tipoConciliacion: '' // '1:1', '1:N', 'N:1', '' (todos)
};

// Estado de filtros para Conciliados Naranjas
let filtrosConciliadosNaranjas = {
    fechaMayorDesde: null,
    fechaMayorHasta: null,
    numeroAsiento: '',
    leyenda: '',
    fechaExtractoDesde: null,
    fechaExtractoHasta: null,
    descripcion: '',
    origen: '',
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    tipoConciliacion: '' // '1:1', '1:N', 'N:1', '' (todos)
};

// Datos filtrados (para mantener la lista original intacta)
let mayorPendienteFiltrado = [];
let extractoPendienteFiltrado = [];
let conciliadosFiltrado = [];

// Estado de ordenamiento para Mayor Pendiente
let ordenMayor = {
    columna: 'fecha',  // columna activa por defecto
    direccion: 'desc'  // 'asc' o 'desc'
};

// Estado de ordenamiento para Extracto Pendiente
let ordenExtracto = {
    columna: 'fecha',
    direccion: 'desc'
};

// Estado del progreso
let progreso = {
    paso: 1,
    totalPasos: 4,
    porcentaje: 0,
    procesados: 0,
    total: 0,
    conciliados: 0
};

// Historial de procesamiento/reprocesos
let historialProcesamiento = [];

// Tolerancias originales de la primera conciliación
let toleranciasIniciales = {
    fecha: null,
    importe: null
};

// Elementos del DOM
const elements = {
    // Pasos
    stepCliente: document.getElementById('step-cliente'),
    stepCuenta: document.getElementById('step-cuenta'),
    stepMayor: document.getElementById('step-mayor'),
    stepTipo: document.getElementById('step-tipo'),
    stepArchivos: document.getElementById('step-archivos'),
    stepTolerancias: document.getElementById('step-tolerancias'),
    stepEjecutar: document.getElementById('step-ejecutar'),

    // Selección de cliente
    clienteSearchPrincipal: document.getElementById('clienteSearchPrincipal'),
    clienteSelectPrincipal: document.getElementById('clienteSelectPrincipal'),
    clienteSeleccionadoInfo: document.getElementById('clienteSeleccionadoInfo'),
    clienteInfoNombre: document.getElementById('clienteInfoNombre'),

    // Selección de cuenta
    cuentaSelectPrincipal: document.getElementById('cuentaSelectPrincipal'),
    cuentaSeleccionadaInfo: document.getElementById('cuentaSeleccionadaInfo'),
    cuentaInfoNombre: document.getElementById('cuentaInfoNombre'),
    rangoExtractosSection: document.getElementById('rangoExtractosSection'),
    extractoPreviewInfo: document.getElementById('extractoPreviewInfo'),
    extractoMovimientosCount: document.getElementById('extractoMovimientosCount'),

    // Botones de tipo
    tipoButtons: document.querySelectorAll('.type-btn'),

    // Archivos Mayor
    dropZoneMayor: document.getElementById('dropZoneMayor'),
    fileMayor: document.getElementById('fileMayor'),
    previewMayor: document.getElementById('previewMayor'),
    fileNameMayor: document.getElementById('fileNameMayor'),
    recordCountMayor: document.getElementById('recordCountMayor'),
    btnRemoveMayor: document.getElementById('btnRemoveMayor'),
    btnPlantillaMayor: document.getElementById('btnPlantillaMayor'),

    // Archivos Extracto
    dropZoneExtracto: document.getElementById('dropZoneExtracto'),
    fileExtracto: document.getElementById('fileExtracto'),
    previewExtracto: document.getElementById('previewExtracto'),
    fileNameExtracto: document.getElementById('fileNameExtracto'),
    recordCountExtracto: document.getElementById('recordCountExtracto'),
    btnRemoveExtracto: document.getElementById('btnRemoveExtracto'),
    btnPlantillaExtracto: document.getElementById('btnPlantillaExtracto'),

    // Tolerancias
    toleranciaFecha: document.getElementById('toleranciaFecha'),
    toleranciaImporte: document.getElementById('toleranciaImporte'),
    exigenciaPalabras: document.getElementById('exigenciaPalabras'),
    mensajeSugerenciaProceso: document.getElementById('mensaje-sugerencia-proceso'),

    // Conciliación
    btnConciliar: document.getElementById('btnConciliar'),

    // Mensajes
    errorBox: document.getElementById('errorBox'),
    successBox: document.getElementById('successBox'),

    // Resultados
    resultados: document.getElementById('resultados'),
    conciliadosMayorCount: document.getElementById('conciliadosMayorCount'),
    conciliadosExtractoCount: document.getElementById('conciliadosExtractoCount'),
    mayorNoConciliado: document.getElementById('mayorNoConciliado'),
    extractoNoConciliado: document.getElementById('extractoNoConciliado'),
    totalMayor: document.getElementById('totalMayor'),
    totalExtracto: document.getElementById('totalExtracto'),
    diferencia: document.getElementById('diferencia'),
    tablaConciliados: document.getElementById('tablaConciliados'),
    tablaMayorPendiente: document.getElementById('tablaMayorPendiente'),
    tablaExtractoPendiente: document.getElementById('tablaExtractoPendiente'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    btnDescargar: document.getElementById('btnDescargar'),

    // Nueva conciliación
    btnNuevaConciliacion: document.getElementById('btnNuevaConciliacion'),

    // Selección manual
    selectionBar: document.getElementById('selectionBar'),
    selMayorCount: document.getElementById('selMayorCount'),
    selMayorTotal: document.getElementById('selMayorTotal'),
    selExtractoCount: document.getElementById('selExtractoCount'),
    selExtractoTotal: document.getElementById('selExtractoTotal'),
    selDiferencia: document.getElementById('selDiferencia'),
    btnVincular: document.getElementById('btnVincular'),
    btnLimpiarSeleccion: document.getElementById('btnLimpiarSeleccion'),
    selectAllMayor: document.getElementById('selectAllMayor'),
    selectAllExtracto: document.getElementById('selectAllExtracto'),
    countMayorPendiente: document.getElementById('countMayorPendiente'),
    countExtractoPendiente: document.getElementById('countExtractoPendiente'),
    countEliminados: document.getElementById('countEliminados'),
    tablaEliminados: document.getElementById('tablaEliminados'),
    btnEliminarSeleccionados: document.getElementById('btnEliminarSeleccionados'),

    // Modal de progreso
    overlayProgreso: document.getElementById('overlay-progreso'),
    modalProgreso: document.getElementById('modal-progreso'),
    barraProgreso: document.getElementById('barra-progreso'),
    porcentajeProgreso: document.getElementById('porcentaje-progreso'),
    pasoProgreso: document.getElementById('paso-progreso'),
    mensajeProgreso: document.getElementById('mensaje-progreso'),
    contadorProgreso: document.getElementById('contador-progreso'),
    conciliadosProgreso: document.getElementById('conciliados-progreso'),

    // Panel de reprocesamiento
    panelReproceso: document.getElementById('panel-reproceso'),
    panelReprocesoBody: document.getElementById('panelReprocesoBody'),
    btnToggleReproceso: document.getElementById('btnToggleReproceso'),
    reprocesoPendientesMayor: document.getElementById('reprocesoPendientesMayor'),
    reprocesoPendientesExtracto: document.getElementById('reprocesoPendientesExtracto'),
    reprocesoToleranciaFecha: document.getElementById('reproceso-tolerancia-fecha'),
    reprocesoToleranciaImporte: document.getElementById('reproceso-tolerancia-importe'),
    reprocesoExigenciaPalabras: document.getElementById('reproceso-exigencia-palabras'),
    mensajeSugerenciaReproceso: document.getElementById('mensaje-sugerencia-reproceso'),
    btnReprocesar: document.getElementById('btnReprocesar'),

    // Historial de procesamiento
    historialProcesamiento: document.getElementById('historial-procesamiento'),
    historialBody: document.getElementById('historialBody'),
    historialLista: document.getElementById('historialLista'),
    historialTotalConciliados: document.getElementById('historialTotalConciliados'),
    btnToggleHistorial: document.getElementById('btnToggleHistorial')
};

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', init);

function init() {
    // Event listeners para tipo de conciliación
    elements.tipoButtons.forEach(btn => {
        btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo));
    });

    // Event listeners para carga de archivos
    setupFileUpload(elements.dropZoneMayor, elements.fileMayor, 'mayor');
    setupFileUpload(elements.dropZoneExtracto, elements.fileExtracto, 'extracto');

    // Botones de eliminar archivo
    elements.btnRemoveMayor.addEventListener('click', () => eliminarArchivo('mayor'));
    elements.btnRemoveExtracto.addEventListener('click', () => eliminarArchivo('extracto'));

    // Botones de plantilla
    elements.btnPlantillaMayor.addEventListener('click', () => descargarPlantilla('mayor'));
    elements.btnPlantillaExtracto.addEventListener('click', () => descargarPlantilla('extracto'));

    // Tolerancias
    elements.toleranciaFecha.addEventListener('change', () => {
        const valor = parseInt(elements.toleranciaFecha.value);
        // IMPORTANTE: No usar || porque 0 es un valor válido (tolerancia exacta)
        state.toleranciaFecha = isNaN(valor) ? 0 : valor;
    });
    elements.toleranciaImporte.addEventListener('change', () => {
        const valor = parseFloat(elements.toleranciaImporte.value);
        // IMPORTANTE: No usar || porque 0 es un valor válido (importe exacto)
        state.toleranciaImporte = isNaN(valor) ? 0 : valor;
    });
    if (elements.exigenciaPalabras) {
        elements.exigenciaPalabras.addEventListener('change', () => {
            const valor = parseInt(elements.exigenciaPalabras.value);
            state.exigenciaPalabras = isNaN(valor) ? 2 : valor;
        });
    }

    // Conciliar
    elements.btnConciliar.addEventListener('click', ejecutarConciliacion);

    // Tabs
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
    });

    // Descargar
    elements.btnDescargar.addEventListener('click', descargarReporte);

    // Nueva conciliación
    elements.btnNuevaConciliacion.addEventListener('click', reiniciar);

    // Conciliación manual
    elements.btnVincular.addEventListener('click', vincularManualmente);
    elements.btnLimpiarSeleccion.addEventListener('click', limpiarSeleccion);
    elements.selectAllMayor.addEventListener('change', (e) => seleccionarTodosMayor(e.target.checked));
    elements.selectAllExtracto.addEventListener('change', (e) => seleccionarTodosExtracto(e.target.checked));

    // Inicializar integración con auditoría
    initAuditoriaIntegration();

    // Cargar categorías para etiquetado del mayor
    cargarCategoriasConciliador();
}

// ========== NUEVO FLUJO: CLIENTE -> CUENTA -> MAYOR -> TIPO ==========

/**
 * Filtrar clientes en el selector principal basándose en la búsqueda
 */
function filtrarClientesPrincipal() {
    const searchInput = document.getElementById('clienteSearchPrincipal');
    const select = document.getElementById('clienteSelectPrincipal');

    if (!searchInput || !select) return;

    const search = searchInput.value.toLowerCase().trim();

    // Limpiar opciones
    select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';

    // Filtrar y agregar clientes que coincidan
    const clientesFiltrados = auditoriaData.clientes.filter(cliente => {
        const nombre = (cliente.nombre || '').toLowerCase();
        const cuit = (cliente.cuit || '').toLowerCase();
        return nombre.includes(search) || cuit.includes(search);
    });

    clientesFiltrados.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre + (cliente.cuit ? ` (${cliente.cuit})` : '');
        select.appendChild(option);
    });
}

/**
 * Seleccionar cliente desde el selector principal
 */
async function seleccionarClientePrincipal() {
    const clienteId = elements.clienteSelectPrincipal.value;

    if (!clienteId) {
        // Si se deselecciona, ocultar pasos siguientes
        ocultarPasosDesde('cuenta');
        return;
    }

    const cliente = auditoriaData.clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    state.clienteSeleccionado = cliente;

    // Mostrar info del cliente seleccionado
    elements.clienteInfoNombre.textContent = cliente.nombre + (cliente.cuit ? ` (${cliente.cuit})` : '');
    elements.clienteSeleccionadoInfo.classList.remove('hidden');

    // Cargar cuentas del cliente
    await cargarCuentasClientePrincipal(clienteId);

    // Mostrar paso de cuenta
    elements.stepCuenta.classList.remove('hidden');
}

/**
 * Cambiar cliente (volver al paso 1)
 */
function cambiarCliente() {
    // Ocultar info y pasos siguientes
    elements.clienteSeleccionadoInfo.classList.add('hidden');
    ocultarPasosDesde('cuenta');

    // Limpiar estado
    state.clienteSeleccionado = null;
    state.cuentaSeleccionada = null;
    state.datosExtracto = [];

    // Limpiar selección
    elements.clienteSelectPrincipal.value = '';
    elements.clienteSearchPrincipal.value = '';
    filtrarClientesPrincipal();
}

/**
 * Cargar cuentas del cliente seleccionado
 */
async function cargarCuentasClientePrincipal(clienteId) {
    const select = elements.cuentaSelectPrincipal;
    select.innerHTML = '<option value="">Cargando cuentas...</option>';

    try {
        // Usar la misma lógica que cargarCuentasCliente pero para el selector principal
        const { data: cuentas, error } = await supabase
            .from('cuentas_bancarias')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('banco');

        if (error) throw error;

        auditoriaData.cuentas = cuentas || [];

        select.innerHTML = '<option value="">-- Seleccione una cuenta --</option>';

        if (cuentas && cuentas.length > 0) {
            cuentas.forEach(cuenta => {
                const option = document.createElement('option');
                option.value = cuenta.id;
                option.textContent = `${cuenta.banco} - ${cuenta.numero_cuenta}`;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay cuentas registradas';
            option.disabled = true;
            select.appendChild(option);
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
        select.innerHTML = '<option value="">Error cargando cuentas</option>';
    }
}

/**
 * Seleccionar cuenta bancaria desde el selector principal
 */
async function seleccionarCuentaPrincipal() {
    const cuentaId = elements.cuentaSelectPrincipal.value;

    if (!cuentaId) {
        // Si se deselecciona, ocultar pasos siguientes
        ocultarPasosDesde('mayor');
        elements.cuentaSeleccionadaInfo.classList.add('hidden');
        return;
    }

    const cuenta = auditoriaData.cuentas.find(c => c.id === cuentaId);
    if (!cuenta) return;

    // Limpiar referencia a conciliación cargada al cambiar de cuenta
    conciliacionCargadaId = null;
    nombreConciliacionCargada = null;
    actualizarBotonEliminarConciliacionCargada();

    state.cuentaSeleccionada = cuenta;

    // Mostrar info de cuenta seleccionada
    elements.cuentaInfoNombre.textContent = `${cuenta.banco} - ${cuenta.numero_cuenta}`;
    elements.cuentaSeleccionadaInfo.classList.remove('hidden');

    // Cargar extractos disponibles para el rango de fechas
    await cargarExtractosDisponiblesPrincipal();

    // Verificar si hay conciliaciones guardadas para esta cuenta
    await verificarConciliacionesGuardadas();

    // Mostrar paso de mayor
    elements.stepMayor.classList.remove('hidden');
}

/**
 * Cargar extractos disponibles para la cuenta seleccionada
 */
async function cargarExtractosDisponiblesPrincipal() {
    if (!state.clienteSeleccionado || !state.cuentaSeleccionada) return;

    try {
        const { data: extractos, error } = await supabase
            .from('extractos_mensuales')
            .select('id, mes, anio, data')
            .eq('cuenta_id', state.cuentaSeleccionada.id)
            .order('anio', { ascending: false })
            .order('mes', { ascending: false });

        if (error) throw error;

        auditoriaData.extractosDisponibles = extractos || [];

        if (extractos && extractos.length > 0) {
            // Poblar selectores de rango
            poblarSelectoresRango(extractos);
            elements.rangoExtractosSection.classList.remove('hidden');

            // Auto-seleccionar todo el rango disponible
            const rangoDesde = document.getElementById('rangoDesde');
            const rangoHasta = document.getElementById('rangoHasta');
            if (rangoDesde.options.length > 1) {
                rangoDesde.value = rangoDesde.options[rangoDesde.options.length - 1].value;
            }
            if (rangoHasta.options.length > 1) {
                rangoHasta.value = rangoHasta.options[1].value;
            }

            // Cargar extractos automáticamente
            await actualizarExtractosSeleccionados();
        } else {
            elements.rangoExtractosSection.classList.add('hidden');
            mostrarMensaje('No hay extractos cargados para esta cuenta en Auditoría. Puede cargar un extracto manualmente en el paso 5.', 'info');
        }
    } catch (error) {
        console.error('Error cargando extractos:', error);
        elements.rangoExtractosSection.classList.add('hidden');
        mostrarMensaje('No se pudieron cargar extractos de Auditoría. Puede cargar un extracto manualmente en el paso 5.', 'info');
    }
}

/**
 * Poblar selectores de rango de fechas
 */
function poblarSelectoresRango(extractos) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const rangoDesde = document.getElementById('rangoDesde');
    const rangoHasta = document.getElementById('rangoHasta');

    rangoDesde.innerHTML = '<option value="">-- Mes/Año --</option>';
    rangoHasta.innerHTML = '<option value="">-- Mes/Año --</option>';

    extractos.forEach(ext => {
        const label = `${meses[ext.mes - 1]} ${ext.anio}`;
        const value = `${ext.anio}-${String(ext.mes).padStart(2, '0')}`;

        const optionDesde = document.createElement('option');
        optionDesde.value = value;
        optionDesde.textContent = label;
        rangoDesde.appendChild(optionDesde);

        const optionHasta = document.createElement('option');
        optionHasta.value = value;
        optionHasta.textContent = label;
        rangoHasta.appendChild(optionHasta);
    });
}

/**
 * Actualizar extractos seleccionados según el rango de fechas
 */
async function actualizarExtractosSeleccionados() {
    if (!state.clienteSeleccionado || !state.cuentaSeleccionada) return;

    const rangoDesde = document.getElementById('rangoDesde').value;
    const rangoHasta = document.getElementById('rangoHasta').value;

    if (!rangoDesde || !rangoHasta) {
        elements.extractoPreviewInfo.classList.add('hidden');
        return;
    }

    try {
        const [anioDesde, mesDesde] = rangoDesde.split('-').map(Number);
        const [anioHasta, mesHasta] = rangoHasta.split('-').map(Number);

        // Obtener IDs de extractos en el rango
        const extractosEnRango = auditoriaData.extractosDisponibles.filter(ext => {
            const extValue = ext.anio * 100 + ext.mes;
            const desdeValue = anioDesde * 100 + mesDesde;
            const hastaValue = anioHasta * 100 + mesHasta;
            return extValue >= desdeValue && extValue <= hastaValue;
        });

        if (extractosEnRango.length === 0) {
            elements.extractoPreviewInfo.classList.add('hidden');
            return;
        }

        // Obtener movimientos del campo data de los extractos cargados
        const movimientos = [];
        extractosEnRango.forEach(ext => {
            if (ext.data && Array.isArray(ext.data)) {
                ext.data.forEach((mov, idx) => {
                    movimientos.push({
                        id: `${ext.id}_${idx}`,
                        fecha: mov.fecha,
                        descripcion: mov.descripcion || mov.concepto || '',
                        origen: mov.origen || '',
                        debito: parseFloat(mov.debito) || 0,
                        credito: parseFloat(mov.credito) || 0
                    });
                });
            }
        });

        // Procesar movimientos
        state.datosExtracto = movimientos.map(mov => ({
            id: mov.id,
            fecha: new Date(mov.fecha),
            descripcion: mov.descripcion,
            origen: mov.origen,
            debito: mov.debito,
            credito: mov.credito,
            importe: mov.credito || mov.debito || 0
        }));

        // Mostrar info de extractos cargados
        elements.extractoMovimientosCount.textContent =
            `${state.datosExtracto.length} movimientos cargados`;
        elements.extractoPreviewInfo.classList.remove('hidden');

        // Guardar rango seleccionado
        state.rangoExtractos = { desde: rangoDesde, hasta: rangoHasta };

        // Actualizar botón de conciliar
        actualizarBotonConciliar();

    } catch (error) {
        console.error('Error cargando movimientos:', error);
    }
}

/**
 * Ocultar pasos desde un punto específico
 */
function ocultarPasosDesde(desde) {
    const pasos = ['cuenta', 'mayor', 'tipo', 'tolerancias', 'ejecutar'];
    const desdeIndex = pasos.indexOf(desde);

    if (desdeIndex < 0) return;

    for (let i = desdeIndex; i < pasos.length; i++) {
        const paso = pasos[i];
        const element = elements[`step${paso.charAt(0).toUpperCase() + paso.slice(1)}`];
        if (element) {
            element.classList.add('hidden');
        }
    }

    // Limpiar estados relacionados
    if (desdeIndex <= pasos.indexOf('cuenta')) {
        state.cuentaSeleccionada = null;
        elements.cuentaSelectPrincipal.value = '';
        elements.cuentaSeleccionadaInfo.classList.add('hidden');
        elements.rangoExtractosSection.classList.add('hidden');
    }
    if (desdeIndex <= pasos.indexOf('mayor')) {
        state.datosMayor = [];
        elements.previewMayor.classList.add('hidden');
    }
    if (desdeIndex <= pasos.indexOf('tipo')) {
        state.tipoConciliacion = null;
        elements.tipoButtons.forEach(btn => btn.classList.remove('active'));
    }
}

// ========== SELECCIÓN DE TIPO ==========

function seleccionarTipo(tipo) {
    state.tipoConciliacion = tipo;

    // Actualizar UI de botones
    elements.tipoButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tipo === tipo);
    });

    // Mostrar siguientes pasos
    elements.stepTolerancias.classList.remove('hidden');

    actualizarBotonConciliar();
}

// ========== INTEGRACIÓN CON AUDITORÍA ==========

/**
 * Inicializar la integración con auditoría
 */
async function initAuditoriaIntegration() {
    // Cargar clientes al inicio (en background)
    try {
        await cargarClientesAuditoria();
    } catch (error) {
        console.warn('No se pudieron cargar los clientes de auditoría:', error);
    }
}

/**
 * Cambiar entre fuente de extracto (archivo o auditoría)
 */
function cambiarFuenteExtracto() {
    const fuente = document.querySelector('input[name="fuenteExtracto"]:checked').value;
    state.fuenteExtracto = fuente;

    const archivoSection = document.getElementById('extractoArchivoSection');
    const auditoriaSection = document.getElementById('extractoAuditoriaSection');

    if (fuente === 'archivo') {
        archivoSection.classList.remove('hidden');
        auditoriaSection.classList.add('hidden');
    } else {
        archivoSection.classList.add('hidden');
        auditoriaSection.classList.remove('hidden');
        // Cargar clientes si no están cargados
        if (auditoriaCache.clientes.length === 0) {
            cargarClientesAuditoria();
        }
    }

    // Limpiar extractos cuando se cambia de fuente
    state.datosExtracto = [];
    state.extractosAuditoria = [];
    actualizarBotonConciliar();
}

/**
 * Cargar clientes desde Supabase para el selector
 */
async function cargarClientesAuditoria() {
    try {
        let supabaseClient = null;

        // Intentar usar waitForSupabase si está disponible
        if (typeof waitForSupabase === 'function') {
            supabaseClient = await waitForSupabase();
        }

        // Fallback: esperar a que la variable global supabase esté disponible
        if (!supabaseClient) {
            for (let i = 0; i < 50; i++) {
                if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
                    supabaseClient = supabase;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (!supabaseClient) {
            console.warn('Supabase no disponible después de esperar');
            return;
        }

        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .order('razon_social');

        if (error) throw error;

        // Guardar en ambos caches para compatibilidad
        const clientesFormateados = (data || []).map(c => ({
            id: c.id,
            nombre: c.razon_social,
            cuit: c.cuit
        }));
        auditoriaCache.clientes = data || [];
        auditoriaData.clientes = clientesFormateados;

        // Renderizar en selector legado y en selector principal
        renderizarSelectClientes(auditoriaCache.clientes);
        poblarSelectorClientesPrincipal(clientesFormateados);

        console.log('Clientes de auditoría cargados:', clientesFormateados.length);
    } catch (error) {
        console.error('Error cargando clientes:', error);
        actualizarEstadoAuditoria('error', 'Error al cargar clientes');
    }
}

/**
 * Poblar el selector principal de clientes (paso 1)
 */
function poblarSelectorClientesPrincipal(clientes) {
    // Buscar el elemento directamente para evitar problemas de timing
    const select = document.getElementById('clienteSelectPrincipal');
    if (!select) {
        console.warn('Elemento clienteSelectPrincipal no encontrado');
        return;
    }

    console.log('Poblando selector con', clientes.length, 'clientes');

    select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre + (cliente.cuit ? ` (${cliente.cuit})` : '');
        select.appendChild(option);
    });

    // Actualizar también la referencia en elements
    if (!elements.clienteSelectPrincipal) {
        elements.clienteSelectPrincipal = select;
    }
}

/**
 * Renderizar opciones del selector de clientes (legado)
 */
function renderizarSelectClientes(clientes) {
    const select = document.getElementById('clienteSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccione un cliente --</option>' +
        clientes.map(c => `<option value="${c.id}">${c.razon_social}${c.cuit ? ` (${c.cuit})` : ''}</option>`).join('');
}

/**
 * Filtrar clientes en el selector
 */
function filtrarClientesConciliador() {
    const busqueda = document.getElementById('clienteSearch')?.value.toLowerCase() || '';
    const clientes = auditoriaCache.clientes;

    const filtrados = clientes.filter(c => {
        const nombre = (c.razon_social || '').toLowerCase();
        const cuit = (c.cuit || '').toLowerCase();
        return nombre.includes(busqueda) || cuit.includes(busqueda);
    });

    renderizarSelectClientes(filtrados);
}

/**
 * Cargar cuentas bancarias del cliente seleccionado
 */
async function cargarCuentasCliente() {
    const clienteId = document.getElementById('clienteSelect')?.value;
    const cuentaSelect = document.getElementById('cuentaSelect');
    const rangoDesde = document.getElementById('rangoDesde');
    const rangoHasta = document.getElementById('rangoHasta');

    if (!cuentaSelect) return;

    // Limpiar selecciones anteriores
    cuentaSelect.innerHTML = '<option value="">-- Seleccione una cuenta --</option>';
    cuentaSelect.disabled = true;
    rangoDesde.innerHTML = '<option value="">-- Mes/Año --</option>';
    rangoDesde.disabled = true;
    rangoHasta.innerHTML = '<option value="">-- Mes/Año --</option>';
    rangoHasta.disabled = true;

    // Ocultar preview
    document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');

    if (!clienteId) {
        state.clienteSeleccionado = null;
        auditoriaCache.cuentas = [];
        actualizarEstadoAuditoria('info', 'Seleccione un cliente para ver sus cuentas bancarias');
        return;
    }

    // Guardar cliente seleccionado
    const clienteOption = document.getElementById('clienteSelect').selectedOptions[0];
    state.clienteSeleccionado = {
        id: clienteId,
        nombre: clienteOption.text
    };

    actualizarEstadoAuditoria('loading', 'Cargando cuentas bancarias...');

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;
        if (!supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        const { data, error } = await supabaseClient
            .from('cuentas_bancarias')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('banco');

        if (error) throw error;

        auditoriaCache.cuentas = data || [];

        if (auditoriaCache.cuentas.length === 0) {
            actualizarEstadoAuditoria('info', 'Este cliente no tiene cuentas bancarias configuradas');
            return;
        }

        // Renderizar opciones
        cuentaSelect.innerHTML = '<option value="">-- Seleccione una cuenta --</option>' +
            auditoriaCache.cuentas.map(c =>
                `<option value="${c.id}">${c.banco} - ${c.tipo_cuenta || 'Cuenta'}${c.numero_cuenta ? ` (${c.numero_cuenta})` : ''}</option>`
            ).join('');
        cuentaSelect.disabled = false;

        actualizarEstadoAuditoria('info', `${auditoriaCache.cuentas.length} cuenta(s) encontrada(s). Seleccione una cuenta.`);
    } catch (error) {
        console.error('Error cargando cuentas:', error);
        actualizarEstadoAuditoria('error', 'Error al cargar las cuentas bancarias');
    }
}

/**
 * Cargar extractos disponibles para la cuenta seleccionada
 */
async function cargarExtractosDisponibles() {
    const cuentaId = document.getElementById('cuentaSelect')?.value;
    const rangoDesde = document.getElementById('rangoDesde');
    const rangoHasta = document.getElementById('rangoHasta');

    // Limpiar rangos
    rangoDesde.innerHTML = '<option value="">-- Mes/Año --</option>';
    rangoDesde.disabled = true;
    rangoHasta.innerHTML = '<option value="">-- Mes/Año --</option>';
    rangoHasta.disabled = true;

    // Ocultar preview
    document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');

    if (!cuentaId) {
        state.cuentaSeleccionada = null;
        auditoriaCache.extractosDisponibles = [];
        actualizarEstadoAuditoria('info', 'Seleccione una cuenta bancaria');
        return;
    }

    // Guardar cuenta seleccionada
    const cuentaOption = document.getElementById('cuentaSelect').selectedOptions[0];
    state.cuentaSeleccionada = {
        id: cuentaId,
        nombre: cuentaOption.text
    };

    actualizarEstadoAuditoria('loading', 'Cargando extractos disponibles...');

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;
        if (!supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        const { data, error } = await supabaseClient
            .from('extractos_mensuales')
            .select('id, mes, anio, data')
            .eq('cuenta_id', cuentaId)
            .order('anio', { ascending: false })
            .order('mes', { ascending: false });

        if (error) throw error;

        auditoriaCache.extractosDisponibles = data || [];

        if (auditoriaCache.extractosDisponibles.length === 0) {
            actualizarEstadoAuditoria('info', 'Esta cuenta no tiene extractos cargados. Cargue extractos desde la herramienta de Auditoría.');
            return;
        }

        // Generar opciones de rango
        const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const opciones = auditoriaCache.extractosDisponibles.map(ext => {
            const movimientos = (ext.data || []).length;
            return `<option value="${ext.anio}-${ext.mes}">${mesesNombres[ext.mes - 1]} ${ext.anio} (${movimientos} mov.)</option>`;
        }).join('');

        rangoDesde.innerHTML = '<option value="">-- Mes/Año --</option>' + opciones;
        rangoDesde.disabled = false;
        rangoHasta.innerHTML = '<option value="">-- Mes/Año --</option>' + opciones;
        rangoHasta.disabled = false;

        actualizarEstadoAuditoria('success', `${auditoriaCache.extractosDisponibles.length} extracto(s) disponible(s). Seleccione el período a conciliar.`);
    } catch (error) {
        console.error('Error cargando extractos:', error);
        actualizarEstadoAuditoria('error', 'Error al cargar los extractos');
    }
}

/**
 * Actualizar extractos seleccionados basado en el rango
 */
async function actualizarExtractosSeleccionados() {
    const desdeValue = document.getElementById('rangoDesde')?.value;
    const hastaValue = document.getElementById('rangoHasta')?.value;

    // Si no hay rango seleccionado
    if (!desdeValue && !hastaValue) {
        document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');
        state.datosExtracto = [];
        state.extractosAuditoria = [];
        actualizarBotonConciliar();
        return;
    }

    // Si solo hay uno seleccionado, usar ese como ambos límites
    const desde = desdeValue || hastaValue;
    const hasta = hastaValue || desdeValue;

    // Parsear valores
    const [anioDesde, mesDesde] = desde.split('-').map(Number);
    const [anioHasta, mesHasta] = hasta.split('-').map(Number);

    // Usar extractos de auditoriaData (flujo principal) o auditoriaCache (flujo alternativo)
    const extractosDisponibles = (auditoriaData.extractosDisponibles && auditoriaData.extractosDisponibles.length > 0)
        ? auditoriaData.extractosDisponibles
        : auditoriaCache.extractosDisponibles;

    // Filtrar extractos en el rango
    const extractosEnRango = extractosDisponibles.filter(ext => {
        const fechaExt = ext.anio * 100 + ext.mes;
        const fechaDesde = anioDesde * 100 + mesDesde;
        const fechaHasta = anioHasta * 100 + mesHasta;

        // El rango puede estar invertido
        const min = Math.min(fechaDesde, fechaHasta);
        const max = Math.max(fechaDesde, fechaHasta);

        return fechaExt >= min && fechaExt <= max;
    });

    if (extractosEnRango.length === 0) {
        actualizarEstadoAuditoria('error', 'No hay extractos en el rango seleccionado');
        document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');
        state.datosExtracto = [];
        actualizarBotonConciliar();
        return;
    }

    // Combinar todos los movimientos de los extractos en el rango
    let todosLosMovimientos = [];
    for (const extracto of extractosEnRango) {
        const movimientos = extracto.data || [];
        // Agregar información del extracto a cada movimiento
        movimientos.forEach((mov, idx) => {
            todosLosMovimientos.push({
                ...mov,
                extractoId: extracto.id,
                extractoMes: extracto.mes,
                extractoAnio: extracto.anio
            });
        });
    }

    // Convertir al formato que espera el conciliador
    state.datosExtracto = convertirMovimientosAuditoria(todosLosMovimientos);
    state.extractosAuditoria = extractosEnRango;
    state.rangoExtractos = { desde, hasta };

    // Mostrar preview
    mostrarPreviewExtractoAuditoria(extractosEnRango, state.datosExtracto.length);

    actualizarBotonConciliar();
}

/**
 * Convertir movimientos de auditoría al formato del conciliador
 */
function convertirMovimientosAuditoria(movimientos) {
    return movimientos.map((mov, index) => {
        // Parsear fecha
        let fecha = null;
        if (mov.fecha) {
            fecha = parsearFecha(mov.fecha);
        }

        // Parsear importes
        const debito = parsearImporte(mov.debito) || 0;
        const credito = parsearImporte(mov.credito) || 0;

        return {
            id: `EA${index}`, // EA = Extracto Auditoría
            fecha: fecha,
            descripcion: mov.descripcion || '',
            origen: mov.origen || '',
            debito: debito,
            credito: credito,
            importe: debito > 0 ? debito : credito,
            esDebito: debito > 0,
            usado: false,
            // Información adicional de auditoría
            extractoId: mov.extractoId,
            extractoMes: mov.extractoMes,
            extractoAnio: mov.extractoAnio,
            categoriaId: mov.categoria_id || null,
            marcadores: mov.marcadores || []
        };
    });
}

/**
 * Mostrar preview de extractos de auditoría seleccionados
 */
function mostrarPreviewExtractoAuditoria(extractos, totalMovimientos) {
    const preview = document.getElementById('previewExtractoAuditoria');
    const clienteNombre = document.getElementById('extractoClienteNombre');
    const cuentaNombre = document.getElementById('extractoCuentaNombre');
    const periodo = document.getElementById('extractoPeriodo');
    const recordCount = document.getElementById('recordCountExtractoAuditoria');

    if (!preview) return;

    const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Información del cliente y cuenta
    clienteNombre.textContent = state.clienteSeleccionado?.nombre || '';
    cuentaNombre.textContent = state.cuentaSeleccionada?.nombre || '';

    // Período
    if (extractos.length === 1) {
        const ext = extractos[0];
        periodo.textContent = `${mesesNombres[ext.mes - 1]} ${ext.anio}`;
    } else {
        // Ordenar para mostrar el rango
        const sorted = [...extractos].sort((a, b) => (a.anio * 100 + a.mes) - (b.anio * 100 + b.mes));
        const primero = sorted[0];
        const ultimo = sorted[sorted.length - 1];
        periodo.textContent = `${mesesNombres[primero.mes - 1]} ${primero.anio} - ${mesesNombres[ultimo.mes - 1]} ${ultimo.anio}`;
    }

    // Cantidad de movimientos
    recordCount.textContent = `${totalMovimientos} movimientos`;

    // Mostrar preview
    preview.classList.remove('hidden');

    // Ocultar status
    document.getElementById('extractoAuditoriaStatus')?.classList.add('hidden');
}

/**
 * Limpiar extracto de auditoría seleccionado
 */
function limpiarExtractoAuditoria() {
    // Limpiar selectores de rango
    const rangoDesde = document.getElementById('rangoDesde');
    const rangoHasta = document.getElementById('rangoHasta');

    if (rangoDesde) rangoDesde.value = '';
    if (rangoHasta) rangoHasta.value = '';

    // Limpiar estado
    state.datosExtracto = [];
    state.extractosAuditoria = [];
    state.rangoExtractos = { desde: null, hasta: null };

    // Ocultar preview
    document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');

    // Mostrar status
    actualizarEstadoAuditoria('info', 'Seleccione el período a conciliar');

    actualizarBotonConciliar();
}

/**
 * Actualizar el estado/mensaje de la sección de auditoría
 */
function actualizarEstadoAuditoria(tipo, mensaje) {
    const status = document.getElementById('extractoAuditoriaStatus');
    if (!status) return;

    const icon = status.querySelector('.status-icon');
    const text = status.querySelector('.status-text');

    // Resetear clases
    status.classList.remove('error', 'success', 'loading', 'hidden');

    switch (tipo) {
        case 'error':
            status.classList.add('error');
            icon.textContent = '❌';
            break;
        case 'success':
            status.classList.add('success');
            icon.textContent = '✅';
            break;
        case 'loading':
            status.classList.add('loading');
            icon.textContent = '⏳';
            break;
        case 'info':
        default:
            icon.textContent = 'ℹ️';
            break;
    }

    text.textContent = mensaje;
    status.classList.remove('hidden');
}

// ========== CATEGORÍAS PARA ETIQUETADO DEL MAYOR ==========

/**
 * Cargar categorías desde Supabase o usar las predefinidas
 */
async function cargarCategoriasConciliador() {
    try {
        let categorias = [];

        // Esperar a que Supabase esté disponible
        let supabaseClient = null;

        if (typeof waitForSupabase === 'function') {
            supabaseClient = await waitForSupabase();
        } else {
            // Fallback: esperar a que la variable global supabase esté disponible
            for (let i = 0; i < 50; i++) {
                if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
                    supabaseClient = supabase;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('categorias_movimientos')
                .select('*')
                .order('orden');

            if (error) {
                // Si la tabla no existe, usar las predefinidas
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.warn('Tabla categorias_movimientos no existe, usando predefinidas');
                    categorias = CATEGORIAS_DEFAULT;
                } else {
                    throw error;
                }
            } else {
                categorias = data || [];
            }
        }

        // Si no hay categorías en BD, usar las predefinidas
        if (categorias.length === 0) {
            categorias = CATEGORIAS_DEFAULT;
        }

        // Construir CATEGORIAS_MOVIMIENTO con "Sin categoría" al inicio
        CATEGORIAS_MOVIMIENTO = [
            { id: '', nombre: '-- Sin categoría --', color: '#94a3b8' },
            ...categorias
        ];

        console.log('✅ Categorías cargadas en conciliador:', CATEGORIAS_MOVIMIENTO.length);
    } catch (error) {
        console.error('Error cargando categorías:', error);
        // Usar predefinidas en caso de error
        CATEGORIAS_MOVIMIENTO = [
            { id: '', nombre: '-- Sin categoría --', color: '#94a3b8' },
            ...CATEGORIAS_DEFAULT
        ];
    }
}

/**
 * Obtener categoría por ID
 */
function obtenerCategoria(id) {
    return CATEGORIAS_MOVIMIENTO.find(c => c.id === (id || '')) || CATEGORIAS_MOVIMIENTO[0];
}

// ========== ADMINISTRACIÓN DEL MAYOR ==========

/**
 * Mostrar el panel de administración del mayor después de cargarlo
 */
function mostrarAdminMayor() {
    const stepAdminMayor = document.getElementById('step-admin-mayor');
    if (stepAdminMayor) {
        stepAdminMayor.classList.remove('hidden');
        renderizarTablaMayorAdmin();
        inicializarFiltrosCategoriasMayor();
    }
}

/**
 * Ocultar el panel de administración del mayor
 */
function ocultarAdminMayor() {
    const stepAdminMayor = document.getElementById('step-admin-mayor');
    if (stepAdminMayor) {
        stepAdminMayor.classList.add('hidden');
    }
}

/**
 * Inicializar los controles de filtros por categoría
 */
function inicializarFiltrosCategoriasMayor() {
    const container = document.getElementById('filtrosMarcadoresMayorAdmin');
    if (!container) return;

    container.innerHTML = CATEGORIAS_MOVIMIENTO.map(c => {
        const isActive = state.filtroCategoriaMayorAdmin.includes(c.id);
        return `
            <button class="filtro-marcador ${isActive ? 'active' : ''}"
                    data-categoria="${c.id}"
                    style="--color-cat: ${c.color}"
                    onclick="toggleFiltroCategoriaAdmin('${c.id}')">
                <span class="marcador-color" style="background-color: ${c.color}"></span>
                <span class="marcador-nombre">${c.nombre}</span>
            </button>
        `;
    }).join('');

    // También llenar el select de categorías para asignar en batch
    const selectAsignar = document.getElementById('selectCategoriaAsignar');
    if (selectAsignar) {
        selectAsignar.innerHTML = CATEGORIAS_MOVIMIENTO.map(c =>
            `<option value="${c.id}">${c.nombre}</option>`
        ).join('');
    }
}

/**
 * Alternar filtro por categoría en administración del mayor
 */
function toggleFiltroCategoriaAdmin(categoriaId) {
    const idx = state.filtroCategoriaMayorAdmin.indexOf(categoriaId);
    if (idx === -1) {
        state.filtroCategoriaMayorAdmin.push(categoriaId);
    } else {
        state.filtroCategoriaMayorAdmin.splice(idx, 1);
    }
    inicializarFiltrosCategoriasMayor();
    renderizarTablaMayorAdmin();
}

/**
 * Limpiar todos los filtros de categoría
 */
function limpiarFiltrosCategoriaAdmin() {
    state.filtroCategoriaMayorAdmin = [];
    inicializarFiltrosCategoriasMayor();
    renderizarTablaMayorAdmin();
}

/**
 * Renderizar tabla de administración del mayor con filtros y categorías
 */
function renderizarTablaMayorAdmin() {
    const tbody = document.getElementById('tablaMayorAdmin');
    if (!tbody) return;

    // Aplicar filtros
    let movimientos = [...state.datosMayor];

    // Filtro por categorías
    if (state.filtroCategoriaMayorAdmin.length > 0) {
        movimientos = movimientos.filter(m =>
            state.filtroCategoriaMayorAdmin.includes(m.categoria || '')
        );
    }

    // Filtros de texto
    const filtroFecha = document.getElementById('filtroAdminFecha')?.value || '';
    const filtroLeyenda = document.getElementById('filtroAdminLeyenda')?.value?.toLowerCase() || '';
    const filtroImporte = document.getElementById('filtroAdminImporte')?.value || '';

    if (filtroFecha) {
        movimientos = movimientos.filter(m => {
            const fechaStr = formatearFecha(m.fecha);
            return fechaStr.includes(filtroFecha);
        });
    }

    if (filtroLeyenda) {
        movimientos = movimientos.filter(m =>
            (m.leyenda || '').toLowerCase().includes(filtroLeyenda)
        );
    }

    if (filtroImporte) {
        const importeNum = parseFloat(filtroImporte);
        if (!isNaN(importeNum)) {
            movimientos = movimientos.filter(m =>
                Math.abs(m.debe - importeNum) < 1 || Math.abs(m.haber - importeNum) < 1
            );
        }
    }

    // Actualizar contador
    const countEl = document.getElementById('countMayorAdmin');
    if (countEl) {
        countEl.textContent = `(${movimientos.length} de ${state.datosMayor.length})`;
    }

    // Generar HTML de la tabla
    let html = '';
    movimientos.forEach(m => {
        const categoria = obtenerCategoria(m.categoria);
        const importe = m.debe > 0 ? m.debe : m.haber;
        const tipoImporte = m.debe > 0 ? 'debe' : 'haber';

        html += `
            <tr data-id="${m.id}">
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento || ''}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 45)}</td>
                <td class="text-right ${tipoImporte === 'debe' ? 'text-green' : 'text-red'}">
                    ${formatearNumero(importe)}
                </td>
                <td class="col-categoria">
                    <select class="select-categoria" onchange="cambiarCategoriaMayor('${m.id}', this.value)"
                            style="border-left: 4px solid ${categoria.color}">
                        ${CATEGORIAS_MOVIMIENTO.map(c =>
                            `<option value="${c.id}" ${c.id === (m.categoria || '') ? 'selected' : ''}>
                                ${c.nombre}
                            </option>`
                        ).join('')}
                    </select>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos cargados</td></tr>';

    // Actualizar estadísticas
    actualizarEstadisticasCategoriasMayor();
}

/**
 * Cambiar la categoría de un movimiento del mayor
 */
function cambiarCategoriaMayor(id, categoriaId) {
    const mov = state.datosMayor.find(m => m.id === id);
    if (mov) {
        mov.categoria = categoriaId;
        renderizarTablaMayorAdmin();
    }
}

/**
 * Asignar categoría a todos los movimientos filtrados
 */
function asignarCategoriaFiltrados() {
    const selectCategoria = document.getElementById('selectCategoriaAsignar');
    if (!selectCategoria) return;

    const categoriaId = selectCategoria.value;

    // Obtener movimientos actualmente visibles (filtrados)
    let movimientos = [...state.datosMayor];

    // Aplicar los mismos filtros
    if (state.filtroCategoriaMayorAdmin.length > 0) {
        movimientos = movimientos.filter(m =>
            state.filtroCategoriaMayorAdmin.includes(m.categoria || '')
        );
    }

    const filtroFecha = document.getElementById('filtroAdminFecha')?.value || '';
    const filtroLeyenda = document.getElementById('filtroAdminLeyenda')?.value?.toLowerCase() || '';

    if (filtroFecha) {
        movimientos = movimientos.filter(m => {
            const fechaStr = formatearFecha(m.fecha);
            return fechaStr.includes(filtroFecha);
        });
    }

    if (filtroLeyenda) {
        movimientos = movimientos.filter(m =>
            (m.leyenda || '').toLowerCase().includes(filtroLeyenda)
        );
    }

    if (movimientos.length === 0) {
        alert('No hay movimientos filtrados para asignar categoría');
        return;
    }

    const categoria = obtenerCategoria(categoriaId);
    if (!confirm(`¿Asignar la categoría "${categoria.nombre}" a ${movimientos.length} movimientos?`)) {
        return;
    }

    // Asignar categoría
    movimientos.forEach(m => {
        const movOriginal = state.datosMayor.find(orig => orig.id === m.id);
        if (movOriginal) {
            movOriginal.categoria = categoriaId;
        }
    });

    renderizarTablaMayorAdmin();
    mostrarMensaje(`Categoría asignada a ${movimientos.length} movimientos`, 'success');
}

/**
 * Actualizar estadísticas de categorías del mayor
 */
function actualizarEstadisticasCategoriasMayor() {
    const container = document.getElementById('estadisticasCategoriasMayor');
    if (!container) return;

    // Contar por categoría
    const conteo = {};
    let sinCategoria = 0;
    let total = state.datosMayor.length;

    state.datosMayor.forEach(m => {
        if (!m.categoria) {
            sinCategoria++;
        } else {
            conteo[m.categoria] = (conteo[m.categoria] || 0) + 1;
        }
    });

    const clasificados = total - sinCategoria;
    const porcentaje = total > 0 ? Math.round((clasificados / total) * 100) : 0;

    container.innerHTML = `
        <div class="estadistica-item">
            <span class="estadistica-label">Clasificados:</span>
            <span class="estadistica-valor">${clasificados} de ${total} (${porcentaje}%)</span>
        </div>
        <div class="estadistica-item">
            <span class="estadistica-label">Sin categoría:</span>
            <span class="estadistica-valor">${sinCategoria}</span>
        </div>
    `;
}

/**
 * Confirmar administración del mayor y continuar
 */
function confirmarAdminMayor() {
    state.mayorAdministrado = true;
    mostrarMensaje('Mayor administrado correctamente', 'success');
    actualizarBotonConciliar();
}

/**
 * Aplicar filtros de texto en administración del mayor
 */
function aplicarFiltrosAdminMayor() {
    renderizarTablaMayorAdmin();
}

/**
 * Limpiar filtros de texto en administración del mayor
 */
function limpiarFiltrosAdminMayor() {
    const filtroFecha = document.getElementById('filtroAdminFecha');
    const filtroLeyenda = document.getElementById('filtroAdminLeyenda');
    const filtroImporte = document.getElementById('filtroAdminImporte');

    if (filtroFecha) filtroFecha.value = '';
    if (filtroLeyenda) filtroLeyenda.value = '';
    if (filtroImporte) filtroImporte.value = '';

    state.filtroCategoriaMayorAdmin = [];
    inicializarFiltrosCategoriasMayor();
    renderizarTablaMayorAdmin();
}

// ========== CARGA DE ARCHIVOS ==========

function setupFileUpload(dropZone, fileInput, tipo) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            procesarArchivo(e.target.files[0], tipo);
        }
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            procesarArchivo(e.dataTransfer.files[0], tipo);
        }
    });
}

async function procesarArchivo(file, tipo) {
    try {
        mostrarMensaje('', 'clear');

        const data = await leerExcel(file);

        if (tipo === 'mayor') {
            state.datosMayor = parsearMayor(data);
            elements.fileNameMayor.textContent = file.name;
            elements.recordCountMayor.textContent = `${state.datosMayor.length} registros`;
            elements.previewMayor.classList.remove('hidden');
            elements.dropZoneMayor.style.display = 'none';
        } else {
            state.datosExtracto = parsearExtracto(data);
            elements.fileNameExtracto.textContent = file.name;
            elements.recordCountExtracto.textContent = `${state.datosExtracto.length} registros`;
            elements.previewExtracto.classList.remove('hidden');
            elements.dropZoneExtracto.style.display = 'none';
        }

        actualizarBotonConciliar();

    } catch (error) {
        mostrarMensaje(`Error al procesar archivo: ${error.message}`, 'error');
    }
}

function leerExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // IMPORTANTE: No usar cellDates para evitar problemas de conversión
                // Las fechas se manejan manualmente en parsearFecha()
                const workbook = XLSX.read(e.target.result, { type: 'array' });

                // Buscar hoja preferida para archivos Tango: "Mayor por cuenta analítico"
                // Si no existe, usar la primera hoja disponible
                let sheetName = workbook.SheetNames[0];
                const hojasTango = ['Mayor por cuenta analítico', 'Mayor por cuenta analitico'];
                for (const hojaTango of hojasTango) {
                    if (workbook.SheetNames.includes(hojaTango)) {
                        sheetName = hojaTango;
                        console.log(`Detectada hoja Tango: "${sheetName}"`);
                        break;
                    }
                }

                const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
                    raw: true,  // Mantener valores crudos (números seriales para fechas)
                    defval: ''
                });
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parsea datos del Mayor Contable.
 * Soporta múltiples formatos incluyendo:
 * - Tango (exportación "Mayor por cuenta analítico")
 * - Formato genérico con columnas estándar
 *
 * Mapeo de columnas Tango → Sistema:
 * - "Fecha asiento" → fecha
 * - "Leyenda movimiento" → leyenda (descripción)
 * - "Debe" → debe (entrada de dinero en cuenta bancaria)
 * - "Haber" → haber (salida de dinero de cuenta bancaria)
 * - "Saldo" → saldo (saldo acumulado)
 * - "Número asiento" → numeroAsiento
 * - "C/E" → ce
 * - "Tipo de asiento" → tipoAsiento
 *
 * Nota: Filas sin fecha válida o sin importe son ignoradas automáticamente.
 */
function parsearMayor(data) {
    return data.map((row, index) => {
        // Buscar columnas por diferentes nombres posibles (Tango, genérico, etc.)
        const fecha = parsearFecha(
            row['Fecha asiento'] || row['Fecha'] || row['fecha_asiento'] || row['fecha'] || ''
        );
        const numeroAsiento = row['Número asiento'] || row['Nº Asiento'] || row['numero_asiento'] || row['Numero'] || '';
        const ce = row['C/E'] || row['CE'] || row['c_e'] || '';
        const tipoAsiento = row['Tipo de asiento'] || row['Tipo'] || row['tipo_asiento'] || row['tipo'] || '';
        const leyenda = row['Leyenda movimiento'] || row['Leyenda'] || row['leyenda_movimiento'] || row['leyenda'] || row['Descripción'] || '';
        const debe = parsearImporte(row['Debe'] || row['debe'] || '0');
        const haber = parsearImporte(row['Haber'] || row['haber'] || '0');
        const saldo = parsearImporte(row['Saldo'] || row['saldo'] || '0');

        return {
            id: `M${index}`,
            fecha,
            numeroAsiento,
            ce,
            tipoAsiento,
            leyenda,
            debe,
            haber,
            saldo,
            importe: debe > 0 ? debe : haber,
            esDebe: debe > 0,
            usado: false
        };
    }).filter(row => row.fecha && (row.debe > 0 || row.haber > 0));
}

function parsearExtracto(data) {
    return data.map((row, index) => {
        const fecha = parsearFecha(
            row['Fecha'] || row['fecha'] || ''
        );
        const descripcion = row['Descripción'] || row['Descripcion'] || row['descripcion'] || '';
        const origen = row['Origen'] || row['origen'] || row['Referencia'] || '';
        const debito = parsearImporte(row['Débito'] || row['Debito'] || row['debito'] || '0');
        const credito = parsearImporte(row['Crédito'] || row['Credito'] || row['credito'] || '0');

        return {
            id: `E${index}`,
            fecha,
            descripcion,
            origen,
            debito,
            credito,
            importe: debito > 0 ? debito : credito,
            esDebito: debito > 0,
            usado: false
        };
    }).filter(row => row.fecha && (row.debito > 0 || row.credito > 0));
}

function parsearFecha(valor) {
    if (!valor) return null;

    let fecha = null;

    // Si ya es un objeto Date (poco probable con raw: true, pero por seguridad)
    if (valor instanceof Date) {
        if (!isNaN(valor.getTime())) {
            fecha = new Date(valor.getTime());
        }
    }
    // Si es un número serial de Excel
    else if (typeof valor === 'number') {
        // Excel usa número de días desde 1/1/1900
        // 25569 = días entre 1/1/1900 y 1/1/1970 (época Unix)
        // Valores típicos para fechas 2020-2030: ~44000-55000
        if (valor > 1 && valor < 100000) {
            // Usar UTC para evitar problemas de zona horaria
            const diasDesdeEpoch = (valor - 25569);
            fecha = new Date(Date.UTC(1970, 0, 1 + diasDesdeEpoch));
            // Convertir a fecha local sin cambio de hora
            fecha = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
        }
    }
    // Si es string
    else if (typeof valor === 'string' || valor) {
        const str = String(valor).trim();

        // Formato DD/MM/YYYY o DD-MM-YYYY (formato argentino)
        const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (matchDMY) {
            let num1 = parseInt(matchDMY[1], 10);
            let num2 = parseInt(matchDMY[2], 10);
            let anio = parseInt(matchDMY[3], 10);

            // Si el año tiene 2 dígitos, asumir 2000+
            if (anio < 100) anio += 2000;

            // Determinar si es DD/MM o MM/DD
            // Si num1 > 12, definitivamente es el día (formato DD/MM/YYYY)
            // Si num2 > 12, definitivamente es el día (formato MM/DD/YYYY)
            // Si ambos <= 12, asumimos DD/MM/YYYY (formato argentino)
            let dia, mes;

            if (num1 > 12 && num2 <= 12) {
                // num1 es día (DD/MM/YYYY)
                dia = num1;
                mes = num2 - 1;
            } else if (num2 > 12 && num1 <= 12) {
                // num2 es día (MM/DD/YYYY) - formato americano
                dia = num2;
                mes = num1 - 1;
            } else {
                // Ambos <= 12, asumimos formato argentino DD/MM/YYYY
                dia = num1;
                mes = num2 - 1;
            }

            // Validar que la fecha sea válida
            if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
                fecha = new Date(anio, mes, dia);
                // Verificar que la fecha creada coincida (evitar rollover de meses)
                if (fecha.getDate() !== dia || fecha.getMonth() !== mes) {
                    fecha = null; // Fecha inválida
                }
            }
        }

        // Si no matcheó o falló, intentar formato YYYY-MM-DD (ISO)
        if (!fecha) {
            const matchISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
            if (matchISO) {
                const anio = parseInt(matchISO[1], 10);
                const mes = parseInt(matchISO[2], 10) - 1;
                const dia = parseInt(matchISO[3], 10);
                if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
                    fecha = new Date(anio, mes, dia);
                }
            }
        }

        // Último recurso: parseo nativo (NO recomendado, puede dar resultados inesperados)
        if (!fecha && str.length > 0) {
            const parsed = Date.parse(str);
            if (!isNaN(parsed)) {
                const tempDate = new Date(parsed);
                // Solo aceptar si el año es razonable (1990-2099)
                if (tempDate.getFullYear() >= 1990 && tempDate.getFullYear() <= 2099) {
                    fecha = tempDate;
                }
            }
        }
    }

    // Corrección de años para datos financieros (rango razonable: 2010-2030)
    if (fecha) {
        const anioActual = new Date().getFullYear();
        const anioFecha = fecha.getFullYear();

        // Corregir años muy antiguos (1920-1950) → probablemente son 2020-2050
        if (anioFecha >= 1920 && anioFecha <= 1950) {
            fecha.setFullYear(anioFecha + 100);
        }
        // Corregir años en rango 100-199 → probablemente falta el "20" adelante
        else if (anioFecha >= 100 && anioFecha <= 199) {
            fecha.setFullYear(anioFecha + 1900);
        }
        // NO corregir años futuros cercanos (hasta 2030) - son válidos para proyecciones
        // Solo corregir si es un año muy lejano (> 2050)
        else if (anioFecha > 2050 && anioFecha <= 2150) {
            fecha.setFullYear(anioFecha - 100);
        }
    }

    return fecha;
}

function parsearImporte(valor) {
    if (!valor && valor !== 0) return 0;

    let str = String(valor).trim();

    // Remover símbolos de moneda y espacios
    str = str.replace(/[$\s]/g, '');

    // Detectar formato argentino (1.234.567,89) vs internacional (1,234,567.89)
    const tieneComaDecimal = /\d+,\d{2}$/.test(str);
    const tienePuntoDecimal = /\d+\.\d{2}$/.test(str);

    if (tieneComaDecimal) {
        // Formato argentino: puntos son miles, coma es decimal
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (!tienePuntoDecimal && str.includes(',')) {
        // Si tiene coma pero no es decimal (ej: 1,234,567)
        str = str.replace(/,/g, '');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.abs(num);
}

function eliminarArchivo(tipo) {
    if (tipo === 'mayor') {
        state.datosMayor = [];
        elements.fileMayor.value = '';
        elements.previewMayor.classList.add('hidden');
        elements.dropZoneMayor.style.display = 'block';
    } else {
        state.datosExtracto = [];
        elements.fileExtracto.value = '';
        elements.previewExtracto.classList.add('hidden');
        elements.dropZoneExtracto.style.display = 'block';
    }

    actualizarBotonConciliar();
}

// ========== PLANTILLAS ==========

function descargarPlantilla(tipo) {
    let data, filename;

    if (tipo === 'mayor') {
        // Plantilla compatible con formato Tango "Mayor por cuenta analítico"
        data = [
            ['Fecha asiento', 'Número asiento', 'C/E', 'Tipo de asiento', 'Leyenda movimiento', 'Debe', 'Haber', 'Saldo'],
            ['01/08/2024', '29001', 'E', 'CN', 'Dinastibasa S.R.L () Recibo Nº0003-00009659', '519417.57', '', '68948032.73'],
            ['01/08/2024', '29002', 'E', 'CN', 'IMP.DEB/CRED P/CRED.', '', '27165.83', '68920866.90'],
            ['02/08/2024', '29003', 'S', 'PA', 'Pago a proveedor ABC S.A.', '', '200000', '68720866.90']
        ];
        filename = 'Plantilla_Mayor_Contable.xlsx';
    } else {
        data = [
            ['Fecha', 'Descripción', 'Origen', 'Débito', 'Crédito'],
            ['01/08/2024', 'LIQ COMER VISA', '80951234', '', '150000'],
            ['02/08/2024', 'LIQ COMER MASTERCARD', '80951235', '', '85500'],
            ['03/08/2024', 'TRANSF A TERCEROS', 'OP123456', '200000', '']
        ];
        filename = 'Plantilla_Extracto_Bancario.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // Ajustar anchos de columna
    ws['!cols'] = data[0].map((_, i) => ({ wch: Math.max(...data.map(row => String(row[i] || '').length)) + 2 }));

    XLSX.writeFile(wb, filename);
}

// ========== MODAL DE PROGRESO ==========

function mostrarModalProgreso() {
    // Resetear estado de progreso
    progreso = {
        paso: 1,
        totalPasos: 4,
        porcentaje: 0,
        procesados: 0,
        total: 0,
        conciliados: 0
    };

    // Resetear UI del modal
    actualizarProgreso(0, 'Iniciando...');
    actualizarPaso(1, 'Cargando y validando datos...');
    elements.contadorProgreso.textContent = '';
    elements.conciliadosProgreso.textContent = '';

    // Mostrar modal
    elements.overlayProgreso.classList.add('visible');
    elements.modalProgreso.classList.add('visible');
}

function cerrarModalProgreso() {
    elements.overlayProgreso.classList.remove('visible');
    elements.modalProgreso.classList.remove('visible');
}

function actualizarProgreso(porcentaje, mensaje) {
    progreso.porcentaje = porcentaje;
    elements.barraProgreso.style.width = porcentaje + '%';
    elements.porcentajeProgreso.textContent = Math.round(porcentaje) + '%';
    if (mensaje) {
        elements.mensajeProgreso.textContent = mensaje;
    }
}

function actualizarPaso(paso, mensaje) {
    progreso.paso = paso;
    elements.pasoProgreso.textContent = `Paso ${paso} de ${progreso.totalPasos}`;
    if (mensaje) {
        elements.mensajeProgreso.textContent = mensaje;
    }
}

function actualizarContador(procesados, total) {
    progreso.procesados = procesados;
    progreso.total = total;
    elements.contadorProgreso.textContent = `Procesados: ${procesados} de ${total} movimientos`;
}

function actualizarConciliados(cantidad) {
    progreso.conciliados = cantidad;
    elements.conciliadosProgreso.textContent = `Conciliados hasta ahora: ${cantidad}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== CONCILIACIÓN ==========

/**
 * Muestra la vista inicial de pendientes antes de ejecutar la conciliación automática.
 * Permite al usuario hacer conciliaciones manuales desde el principio.
 */
function mostrarVistaInicialPendientes() {
    // Solo mostrar si hay datos cargados y tipo seleccionado
    if (!state.tipoConciliacion || state.datosMayor.length === 0 || state.datosExtracto.length === 0) {
        return;
    }

    // Reiniciar contador de conciliaciones y selección
    conciliacionIdCounter = 0;
    seleccion = { mayor: [], extracto: [] };

    // Filtrar datos según el tipo de conciliación
    let mayorFiltrado, extractoFiltrado;

    if (state.tipoConciliacion === 'creditos') {
        // Créditos (entradas de dinero): Debe del Mayor = Crédito del Extracto
        mayorFiltrado = state.datosMayor.filter(m => m.debe > 0).map(m => ({...m, importe: m.debe, usado: false}));
        extractoFiltrado = state.datosExtracto.filter(e => e.credito > 0).map(e => ({...e, importe: e.credito, usado: false}));
    } else {
        // Débitos (salidas de dinero): Haber del Mayor = Débito del Extracto
        mayorFiltrado = state.datosMayor.filter(m => m.haber > 0).map(m => ({...m, importe: m.haber, usado: false}));
        extractoFiltrado = state.datosExtracto.filter(e => e.debito > 0).map(e => ({...e, importe: e.debito, usado: false}));
    }

    // Inicializar state.resultados con todos como pendientes
    state.resultados = {
        conciliados: [],
        mayorNoConciliado: mayorFiltrado,
        extractoNoConciliado: extractoFiltrado
    };

    // Limpiar lista de eliminados
    state.eliminados = [];

    // Actualizar contadores y totales
    const totalMayorPendiente = mayorFiltrado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = extractoFiltrado.reduce((sum, e) => sum + e.importe, 0);

    // Actualizar resumen
    elements.conciliadosMayorCount.textContent = '0';
    elements.conciliadosExtractoCount.textContent = '0';
    elements.mayorNoConciliado.textContent = mayorFiltrado.length;
    elements.extractoNoConciliado.textContent = extractoFiltrado.length;

    elements.totalMayor.textContent = formatearMoneda(totalMayorPendiente);
    elements.totalExtracto.textContent = formatearMoneda(totalExtractoPendiente);
    elements.diferencia.textContent = formatearMoneda(Math.abs(totalMayorPendiente - totalExtractoPendiente));

    // Color de diferencia
    const difElement = document.querySelector('.total-row.diferencia .total-value');
    if (difElement) {
        if (Math.abs(totalMayorPendiente - totalExtractoPendiente) > 0) {
            difElement.style.color = '#dc2626';
        } else {
            difElement.style.color = '#059669';
        }
    }

    // Llenar tablas de pendientes (conciliados y eliminados vacíos)
    llenarTablaConciliados([]);
    llenarTablaMayorPendiente(mayorFiltrado);
    llenarTablaExtractoPendiente(extractoFiltrado);
    llenarTablaEliminados();

    // Poblar selector de tipos para el filtro de Mayor
    poblarSelectorTiposMayor();

    // Mostrar sección de resultados
    elements.resultados.classList.remove('hidden');

    // Cambiar al tab de Mayor Pendiente por defecto
    cambiarTab('mayor-pendiente');

    // Scroll a resultados
    elements.resultados.scrollIntoView({ behavior: 'smooth' });
}

function actualizarBotonConciliar() {
    // Nuevo flujo: Cliente -> Cuenta -> Mayor -> Tipo
    const habilitado = state.clienteSeleccionado &&
                       state.cuentaSeleccionada &&
                       state.tipoConciliacion &&
                       state.datosMayor.length > 0 &&
                       state.datosExtracto.length > 0;

    elements.btnConciliar.disabled = !habilitado;

    if (habilitado) {
        elements.stepEjecutar.classList.remove('hidden');
    } else {
        elements.stepEjecutar.classList.add('hidden');
    }

    // Mostrar paso de archivos cuando hay mayor cargado (para permitir carga manual de extractos)
    if (state.datosMayor.length > 0) {
        elements.stepArchivos.classList.remove('hidden');
        elements.stepTipo.classList.remove('hidden');
    }

    // Mostrar paso de tipo cuando hay mayor cargado
    if (state.datosMayor.length > 0 && state.datosExtracto.length > 0) {
        elements.stepTipo.classList.remove('hidden');
    }

    // Mostrar vista inicial de pendientes cuando todos los datos están cargados
    // Crear un "hash" de los datos actuales para detectar cambios
    const datosActuales = `${state.tipoConciliacion}_${state.datosMayor.length}_${state.datosExtracto.length}`;

    if (habilitado && state.datosVistaInicial !== datosActuales) {
        state.datosVistaInicial = datosActuales;
        mostrarVistaInicialPendientes();
    }
}

async function ejecutarConciliacion() {
    try {
        mostrarMensaje('', 'clear');
        mostrarModalProgreso();

        // Iniciar contador de tiempo
        const tiempoInicio = Date.now();

        // Paso 1: Cargando y validando datos
        actualizarPaso(1, 'Cargando y validando datos...');
        actualizarProgreso(5);
        await sleep(100); // Permitir render

        // Preservar conciliaciones manuales previas (si existen)
        const conciliacionesPrevias = state.resultados?.conciliados?.filter(c => c.manual) || [];
        const teniaConciliacionesManuales = conciliacionesPrevias.length > 0;

        // Obtener IDs de movimientos ya conciliados manualmente
        const idsYaConciliadosMayor = new Set();
        const idsYaConciliadosExtracto = new Set();

        conciliacionesPrevias.forEach(c => {
            c.mayor.forEach(m => idsYaConciliadosMayor.add(m.id));
            c.extracto.forEach(e => idsYaConciliadosExtracto.add(e.id));
        });

        if (teniaConciliacionesManuales) {
            console.log(`Preservando ${conciliacionesPrevias.length} conciliaciones manuales (${idsYaConciliadosMayor.size} mov mayor, ${idsYaConciliadosExtracto.size} mov extracto)`);
        }

        // Reiniciar contador de conciliaciones solo si no hay conciliaciones previas
        // Si hay conciliaciones previas, continuar desde el número más alto
        if (teniaConciliacionesManuales) {
            const maxId = conciliacionesPrevias.reduce((max, c) => {
                const num = parseInt(c.id.replace('conc_', '')) || 0;
                return Math.max(max, num);
            }, 0);
            conciliacionIdCounter = maxId;
        } else {
            conciliacionIdCounter = 0;
        }
        seleccion = { mayor: [], extracto: [] };

        // Actualizar tolerancias
        // IMPORTANTE: No usar || porque 0 es un valor válido (coincidencia exacta)
        const valorFecha = parseInt(elements.toleranciaFecha.value);
        const valorImporte = parseFloat(elements.toleranciaImporte.value);
        const valorPalabras = parseInt(elements.exigenciaPalabras.value);
        state.toleranciaFecha = isNaN(valorFecha) ? 0 : valorFecha;
        state.toleranciaImporte = isNaN(valorImporte) ? 0 : valorImporte;
        state.exigenciaPalabras = isNaN(valorPalabras) ? 2 : valorPalabras;

        // DEBUG: Mostrar tolerancias configuradas
        console.log('Tolerancias configuradas:', {
            fecha: state.toleranciaFecha,
            importe: state.toleranciaImporte,
            exigenciaPalabras: state.exigenciaPalabras,
            valorFechaInput: elements.toleranciaFecha.value,
            valorImporteInput: elements.toleranciaImporte.value,
            valorPalabrasInput: elements.exigenciaPalabras.value
        });

        // Filtrar datos según el tipo de conciliación
        let mayorFiltrado, extractoFiltrado;

        if (state.tipoConciliacion === 'creditos') {
            // Créditos (entradas de dinero): Debe del Mayor = Crédito del Extracto
            // La cuenta Banco es un ACTIVO: cuando entra dinero, el activo AUMENTA → se registra en DEBE
            mayorFiltrado = state.datosMayor.filter(m => m.debe > 0).map(m => ({...m, importe: m.debe, usado: false}));
            extractoFiltrado = state.datosExtracto.filter(e => e.credito > 0).map(e => ({...e, importe: e.credito, usado: false}));
        } else {
            // Débitos (salidas de dinero): Haber del Mayor = Débito del Extracto
            // La cuenta Banco es un ACTIVO: cuando sale dinero, el activo DISMINUYE → se registra en HABER
            mayorFiltrado = state.datosMayor.filter(m => m.haber > 0).map(m => ({...m, importe: m.haber, usado: false}));
            extractoFiltrado = state.datosExtracto.filter(e => e.debito > 0).map(e => ({...e, importe: e.debito, usado: false}));
        }

        // OPTIMIZACIÓN: Excluir movimientos ya conciliados manualmente
        if (teniaConciliacionesManuales) {
            const cantMayorAntes = mayorFiltrado.length;
            const cantExtractoAntes = extractoFiltrado.length;

            mayorFiltrado = mayorFiltrado.filter(m => !idsYaConciliadosMayor.has(m.id));
            extractoFiltrado = extractoFiltrado.filter(e => !idsYaConciliadosExtracto.has(e.id));

            console.log(`Optimización: procesando ${mayorFiltrado.length}/${cantMayorAntes} mayor y ${extractoFiltrado.length}/${cantExtractoAntes} extracto (excluidos ya conciliados)`);
        }

        actualizarProgreso(15, 'Datos validados correctamente');
        await sleep(100);

        // Ejecutar algoritmo de conciliación con progreso (solo sobre movimientos no conciliados)
        const resultadosAutomaticos = await conciliar(mayorFiltrado, extractoFiltrado);

        // Combinar conciliaciones manuales previas con las automáticas
        state.resultados = {
            conciliados: [...conciliacionesPrevias, ...resultadosAutomaticos.conciliados],
            mayorNoConciliado: resultadosAutomaticos.mayorNoConciliado,
            extractoNoConciliado: resultadosAutomaticos.extractoNoConciliado
        };

        // Paso 4: Generando resultados
        actualizarPaso(4, 'Generando resultados...');
        actualizarProgreso(95);
        await sleep(100);

        // Mostrar resultados
        mostrarResultados();

        // Calcular duración del proceso
        const duracion = Date.now() - tiempoInicio;

        // Guardar el procesamiento inicial en el historial
        guardarProcesamientoInicial(state.resultados.conciliados.length, duracion);

        // Mostrar panel de reprocesamiento
        actualizarPanelReproceso();

        // Completar progreso
        actualizarProgreso(100, '¡Conciliación completada!');
        await sleep(800);

        cerrarModalProgreso();

    } catch (error) {
        cerrarModalProgreso();
        mostrarMensaje(`Error en la conciliación: ${error.message}`, 'error');
    }
}

async function conciliar(mayor, extracto) {
    const conciliados = [];
    const mayorNoConciliado = [...mayor];
    const extractoNoConciliado = [...extracto];

    const totalMovimientos = mayor.length + extracto.length;
    let procesados = 0;

    // Paso 2: Buscar coincidencias exactas (1 a 1)
    actualizarPaso(2, 'Buscando coincidencias exactas (1 a 1)...');
    actualizarProgreso(20);
    actualizarContador(0, totalMovimientos);
    actualizarConciliados(0);
    await sleep(50);

    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const idxCoincidencia = buscarCoincidenciaExacta(movMayor, extractoNoConciliado);

        if (idxCoincidencia !== -1) {
            const movExtracto = extractoNoConciliado[idxCoincidencia];
            const diferencia = Math.abs(movMayor.importe - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:1',
                mayor: [movMayor],
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            extractoNoConciliado.splice(idxCoincidencia, 1);
        }

        procesados++;

        // Actualizar UI cada 10 movimientos para no bloquear
        if (procesados % 10 === 0 || i === 0) {
            const progresoActual = 20 + (procesados / totalMovimientos) * 25;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    // Paso 3: Buscar coincidencias 1 a muchos (Mayor vs suma de Extracto)
    actualizarPaso(3, 'Buscando coincidencias múltiples (1 a N)...');
    actualizarProgreso(50);
    await sleep(50);

    const mayorRestante = mayorNoConciliado.length;
    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movMayor.importe,
            movMayor.fecha,
            extractoNoConciliado,
            5, // máximo 5 movimientos
            false,
            null,
            movMayor.categoria || '', // Categoría del mayor para filtrar extractos compatibles
            movMayor.leyenda || '', // Texto de referencia para validar coincidencia de palabras
            false // La lista es de extractos
        );

        if (combinacion) {
            const sumaExtracto = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(movMayor.importe - sumaExtracto);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:N',
                mayor: [movMayor],
                extracto: combinacion,
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = extractoNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) extractoNoConciliado.splice(idx, 1);
            });
        }

        procesados++;

        // Actualizar UI cada 5 movimientos (es más lento por las combinaciones)
        if (procesados % 5 === 0 || i === 0) {
            const progresoActual = 50 + ((mayorRestante - i) / mayorRestante) * 20;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    // Paso 3b: Buscar coincidencias muchos a 1 (suma de Mayor vs Extracto)
    // IMPORTANTE: Para este tipo de conciliación, validamos que todos los movimientos
    // del mayor sean de la misma entidad/cliente para evitar agrupar movimientos
    // de diferentes clientes solo porque la suma coincide
    actualizarPaso(3, 'Buscando coincidencias múltiples (N a 1)...');
    actualizarProgreso(70);
    await sleep(50);

    const extractoRestante = extractoNoConciliado.length;
    for (let i = extractoNoConciliado.length - 1; i >= 0; i--) {
        const movExtracto = extractoNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movExtracto.importe,
            movExtracto.fecha,
            mayorNoConciliado,
            5,
            true, // Validar que los movimientos sean de la misma entidad
            movExtracto.descripcion || movExtracto.concepto || '', // Descripción del extracto para validar coincidencia de texto
            movExtracto.categoria || '', // Categoría del extracto para filtrar mayores compatibles
            movExtracto.descripcion || movExtracto.concepto || '', // Texto de referencia para validar coincidencia de palabras
            true // La lista es de mayores
        );

        if (combinacion) {
            const sumaMayor = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(sumaMayor - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: 'N:1',
                mayor: combinacion,
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            extractoNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = mayorNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) mayorNoConciliado.splice(idx, 1);
            });
        }

        procesados++;

        // Actualizar UI cada 5 movimientos
        if (procesados % 5 === 0 || i === 0) {
            const progresoActual = 70 + ((extractoRestante - i) / Math.max(extractoRestante, 1)) * 20;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    return {
        conciliados,
        mayorNoConciliado,
        extractoNoConciliado
    };
}

function buscarCoincidenciaExacta(movMayor, listaExtracto) {
    for (let i = 0; i < listaExtracto.length; i++) {
        const movExtracto = listaExtracto[i];

        // Verificar compatibilidad de etiquetas
        // Si el movimiento del mayor tiene etiqueta, el extracto debe tener la misma etiqueta o estar sin etiquetar
        // Si el movimiento del mayor no tiene etiqueta, puede conciliarse con cualquier movimiento
        if (!verificarCompatibilidadEtiquetas(movMayor, movExtracto)) continue;

        // Verificar tolerancia de importe
        const difImporte = Math.abs(movMayor.importe - movExtracto.importe);

        // DEBUG: Descomentar para ver comparaciones de importes
        // console.log('Comparando importes:', movMayor.importe, movExtracto.importe,
        //     'Diff:', difImporte, 'Tolerancia:', state.toleranciaImporte,
        //     'Acepta:', difImporte <= state.toleranciaImporte);

        if (difImporte > state.toleranciaImporte) continue;

        // Verificar tolerancia de fecha
        if (!fechaDentroTolerancia(movMayor.fecha, movExtracto.fecha)) continue;

        // Verificar exigencia de palabras coincidentes (si está configurada)
        if (state.exigenciaPalabras > 0) {
            if (!tieneCoincidenciaPalabras(movMayor.leyenda, movExtracto.descripcion, state.exigenciaPalabras)) {
                continue;
            }
        }

        return i;
    }

    return -1;
}

/**
 * Verifica si dos movimientos son compatibles.
 * Siempre retorna true - la funcionalidad de etiquetado del mayor fue removida.
 *
 * @param {Object} movMayor - Movimiento del mayor
 * @param {Object} movExtracto - Movimiento del extracto
 * @returns {boolean} true siempre
 */
function verificarCompatibilidadEtiquetas(movMayor, movExtracto) {
    return true;
}

/**
 * Busca una combinación de movimientos que sumen el importe objetivo.
 *
 * @param {number} importeObjetivo - Importe a alcanzar
 * @param {Date} fechaRef - Fecha de referencia para filtrar por tolerancia
 * @param {Array} lista - Lista de movimientos candidatos
 * @param {number} maxElementos - Máximo de elementos a combinar
 * @param {boolean} validarEntidades - Si es true, valida que todos los movimientos sean de la misma entidad
 * @param {string} descripcionExtracto - Descripción del extracto para validar coincidencia de texto (opcional)
 * @param {string} categoriaRef - Categoría de referencia para filtrar por etiqueta (opcional)
 * @param {string} textoReferenciaParaPalabras - Texto de referencia para validar coincidencia de palabras (leyenda o descripción)
 * @param {boolean} esListaMayor - true si la lista contiene movimientos del mayor (para saber qué campo comparar)
 * @returns {Array|null} Combinación encontrada o null
 */
function buscarCombinacionQueSume(importeObjetivo, fechaRef, lista, maxElementos, validarEntidades = false, descripcionExtracto = null, categoriaRef = '', textoReferenciaParaPalabras = null, esListaMayor = false) {
    // Filtrar por fecha primero
    let candidatos = lista.filter(m => fechaDentroTolerancia(fechaRef, m.fecha));

    if (candidatos.length === 0) return null;

    // Filtrar por etiqueta: solo incluir movimientos compatibles con la categoría de referencia
    // Si la categoría de referencia está vacía, todos los movimientos son candidatos
    // Si la categoría tiene valor, solo incluir movimientos con esa misma categoría
    if (categoriaRef) {
        candidatos = candidatos.filter(m => (m.categoria || '') === categoriaRef);
    }

    if (candidatos.length === 0) return null;

    // Limitar candidatos para evitar búsquedas exponenciales que cuelgan el navegador
    // Con muchos candidatos (>50), la búsqueda de combinaciones de 2-5 elementos
    // tiene complejidad O(C(n,5)) que crece exponencialmente
    // Priorizamos los candidatos más cercanos al importe objetivo
    const MAX_CANDIDATOS = 50;
    if (candidatos.length > MAX_CANDIDATOS) {
        // Ordenar por cercanía al importe objetivo y tomar los más cercanos
        candidatos.sort((a, b) => {
            const diffA = Math.abs(a.importe - importeObjetivo);
            const diffB = Math.abs(b.importe - importeObjetivo);
            return diffA - diffB;
        });
        candidatos = candidatos.slice(0, MAX_CANDIDATOS);
    }

    // Buscar combinaciones de 2 a maxElementos elementos
    for (let n = 2; n <= Math.min(maxElementos, candidatos.length); n++) {
        const resultado = encontrarCombinacion(candidatos, importeObjetivo, n, validarEntidades, descripcionExtracto, categoriaRef, textoReferenciaParaPalabras, esListaMayor);
        if (resultado) return resultado;
    }

    return null;
}

/**
 * Busca una combinación de n elementos que sume el importe objetivo.
 *
 * @param {Array} lista - Lista de movimientos candidatos (ya filtrados por categoría)
 * @param {number} objetivo - Importe objetivo a alcanzar
 * @param {number} n - Cantidad exacta de elementos a combinar
 * @param {boolean} validarEntidades - Si es true, valida que todos los movimientos sean de la misma entidad
 * @param {string} descripcionExtracto - Descripción del extracto para validar coincidencia de texto (opcional)
 * @param {string} categoriaRef - Categoría de referencia (no usada, el filtrado ya se hizo)
 * @param {string} textoReferenciaParaPalabras - Texto de referencia para validar coincidencia de palabras
 * @param {boolean} esListaMayor - true si la lista contiene movimientos del mayor
 * @returns {Array|null} Combinación encontrada o null
 */
function encontrarCombinacion(lista, objetivo, n, validarEntidades = false, descripcionExtracto = null, categoriaRef = '', textoReferenciaParaPalabras = null, esListaMayor = false) {
    const indices = [];

    function buscar(start, suma, count) {
        // Verificar si encontramos una combinación válida
        if (count === n) {
            const diferencia = Math.abs(suma - objetivo);
            if (diferencia <= state.toleranciaImporte) {
                const combinacion = indices.map(i => lista[i]);

                // Si se requiere validación de entidades, verificar que todos
                // los movimientos sean de la misma entidad/cliente
                if (validarEntidades && !validarMismaEntidad(combinacion)) {
                    return null; // Rechazar combinación de diferentes entidades
                }

                // Si se proporciona descripción del extracto, validar que haya
                // coincidencia parcial de texto entre las leyendas y la descripción
                // Esto evita matches incorrectos donde la suma coincide por casualidad
                if (descripcionExtracto && !validarCoincidenciaDescripcionExtracto(combinacion, descripcionExtracto)) {
                    return null; // Rechazar si no hay coincidencia de texto
                }

                // Validar exigencia de palabras coincidentes (si está configurada)
                if (state.exigenciaPalabras > 0 && textoReferenciaParaPalabras) {
                    let tieneCoincidencia = false;
                    for (const mov of combinacion) {
                        // Si es lista de mayor, comparar leyenda con texto de referencia (descripción del extracto)
                        // Si es lista de extracto, comparar descripción con texto de referencia (leyenda del mayor)
                        const textoMovimiento = esListaMayor ? mov.leyenda : mov.descripcion;
                        if (tieneCoincidenciaPalabras(textoMovimiento, textoReferenciaParaPalabras, state.exigenciaPalabras)) {
                            tieneCoincidencia = true;
                            break;
                        }
                    }
                    if (!tieneCoincidencia) {
                        return null; // Rechazar si ningún elemento tiene suficientes palabras coincidentes
                    }
                }

                return combinacion;
            }
            return null;
        }

        // Buscar más elementos
        for (let i = start; i < lista.length; i++) {
            indices.push(i);
            const resultado = buscar(i + 1, suma + lista[i].importe, count + 1);
            if (resultado) return resultado;
            indices.pop();
        }

        return null;
    }

    return buscar(0, 0, 0);
}

function fechaDentroTolerancia(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return false;

    // Normalizar ambas fechas a medianoche para comparar solo días
    const f1 = new Date(fecha1);
    const f2 = new Date(fecha2);
    f1.setHours(0, 0, 0, 0);
    f2.setHours(0, 0, 0, 0);

    const diffMs = Math.abs(f1.getTime() - f2.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // CRÍTICO: Si tolerancia es 0, las fechas deben ser exactamente iguales
    // Usar comparación estricta para evitar coerción de tipos
    if (state.toleranciaFecha === 0) {
        const resultado = diffDias === 0;
        // DEBUG: Descomentar para diagnosticar problemas de tolerancia 0
        // console.log('=== COMPARACIÓN DE FECHAS (tolerancia 0) ===');
        // console.log('Fecha 1:', f1.toLocaleDateString('es-AR'));
        // console.log('Fecha 2:', f2.toLocaleDateString('es-AR'));
        // console.log('Diferencia en días:', diffDias);
        // console.log('¿Dentro de tolerancia?:', resultado);
        return resultado;
    }

    return diffDias <= state.toleranciaFecha;
}

// ========== VALIDACIÓN DE ENTIDADES PARA CONCILIACIONES N:1 ==========

/**
 * Extrae el nombre de la entidad/cliente de una leyenda del mayor.
 * La función normaliza el texto y extrae las primeras palabras significativas
 * que generalmente corresponden al nombre del cliente/proveedor.
 *
 * @param {string} texto - Leyenda del movimiento
 * @returns {string} Nombre de entidad normalizado
 */
function extraerEntidad(texto) {
    if (!texto || typeof texto !== 'string') return '';

    // Normalizar: quitar acentos, convertir a minúsculas
    let normalizado = texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // Eliminar prefijos comunes que no identifican la entidad
    const prefijosIgnorar = [
        /^rec\.?\s*/i,           // Rec. o Rec
        /^recibo\s*/i,           // Recibo
        /^pago\s*/i,             // Pago
        /^cobro\s*/i,            // Cobro
        /^fact\.?\s*/i,          // Fact. o Factura
        /^factura\s*/i,
        /^nota\s+de\s+credito\s*/i,
        /^nc\s*/i,               // NC (Nota de Crédito)
        /^nd\s*/i,               // ND (Nota de Débito)
        /^op\s*/i,               // OP (Orden de Pago)
        /^transferencia\s*/i,
        /^trf\.?\s*/i,
        /^dep\.?\s*/i,           // Dep. o Depósito
        /^deposito\s*/i,
        /^cheque\s*/i,
        /^ch\.?\s*/i,
    ];

    for (const prefijo of prefijosIgnorar) {
        normalizado = normalizado.replace(prefijo, '');
    }

    // Eliminar números de documento/recibo al final o paréntesis con info adicional
    normalizado = normalizado
        .replace(/\s*\(.*\)\s*$/g, '')      // (info adicional)
        .replace(/\s*n[º°]?\s*\d+.*$/gi, '') // Nº 12345...
        .replace(/\s+\d{4,}.*$/g, '')        // números largos al final
        .replace(/\s+-\s+.*$/g, '')          // - info adicional
        .trim();

    // Extraer las primeras palabras significativas (máximo 4 palabras para el nombre)
    const palabras = normalizado.split(/\s+/).filter(p => p.length > 1);

    // Si quedan menos de 1 palabra significativa, retornar el texto original normalizado
    if (palabras.length === 0) {
        return texto.toLowerCase().trim().substring(0, 30);
    }

    // Retornar las primeras 4 palabras como identificador de entidad
    return palabras.slice(0, 4).join(' ');
}

/**
 * Calcula la similitud entre dos entidades usando el coeficiente de Jaccard
 * sobre los tokens (palabras) de cada nombre.
 *
 * @param {string} entidad1 - Primera entidad
 * @param {string} entidad2 - Segunda entidad
 * @returns {number} Coeficiente de similitud entre 0 y 1
 */
function calcularSimilitudEntidades(entidad1, entidad2) {
    if (!entidad1 || !entidad2) return 0;

    // Si son exactamente iguales
    if (entidad1 === entidad2) return 1;

    // Tokenizar ambas entidades
    const tokens1 = new Set(entidad1.split(/\s+/).filter(t => t.length > 1));
    const tokens2 = new Set(entidad2.split(/\s+/).filter(t => t.length > 1));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    // Calcular intersección
    const interseccion = new Set([...tokens1].filter(t => tokens2.has(t)));

    // Coeficiente de Jaccard: |A ∩ B| / |A ∪ B|
    const union = new Set([...tokens1, ...tokens2]);
    const jaccard = interseccion.size / union.size;

    // También verificar si una entidad contiene a la otra (para casos como "Juan" vs "Juan Perez")
    const contieneBonus = (entidad1.includes(entidad2) || entidad2.includes(entidad1)) ? 0.3 : 0;

    return Math.min(1, jaccard + contieneBonus);
}

/**
 * Valida que todos los movimientos de una combinación correspondan a la misma entidad.
 * Esta función es crítica para evitar conciliaciones incorrectas donde se agrupan
 * movimientos de diferentes clientes solo porque la suma de importes coincide.
 *
 * @param {Array} movimientos - Array de movimientos del mayor
 * @returns {boolean} true si todos los movimientos son de la misma entidad
 */
function validarMismaEntidad(movimientos) {
    if (!movimientos || movimientos.length < 2) return true;

    // Extraer entidades de cada movimiento
    const entidades = movimientos.map(m => extraerEntidad(m.leyenda || ''));

    // Verificar que todas las entidades sean similares a la primera
    const entidadBase = entidades[0];

    // Umbral de similitud requerido para considerar que son la misma entidad
    // Usamos un umbral moderado (0.5) para ser más restrictivos y evitar
    // matcheos incorrectos de clientes diferentes
    const UMBRAL_SIMILITUD = 0.5;

    for (let i = 1; i < entidades.length; i++) {
        const similitud = calcularSimilitudEntidades(entidadBase, entidades[i]);

        if (similitud < UMBRAL_SIMILITUD) {
            // Las entidades son muy diferentes - no permitir esta combinación
            // console.log(`Entidades diferentes detectadas: "${entidadBase}" vs "${entidades[i]}" (similitud: ${similitud.toFixed(2)})`);
            return false;
        }
    }

    return true;
}

/**
 * Valida que haya coincidencia parcial de texto entre la descripción del extracto
 * y las leyendas de los movimientos del mayor. Esta validación es crucial para
 * evitar matches múltiples incorrectos donde la suma coincide por casualidad pero
 * los movimientos no están relacionados.
 *
 * @param {Array} movimientosMayor - Array de movimientos del mayor a validar
 * @param {string} descripcionExtracto - Descripción del movimiento del extracto bancario
 * @returns {boolean} true si hay coincidencia parcial de texto
 */
function validarCoincidenciaDescripcionExtracto(movimientosMayor, descripcionExtracto) {
    if (!descripcionExtracto || typeof descripcionExtracto !== 'string') return false;
    if (!movimientosMayor || movimientosMayor.length === 0) return false;

    // Normalizar descripción del extracto
    const extractoNormalizado = descripcionExtracto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // Extraer palabras significativas del extracto (mínimo 3 caracteres)
    const palabrasExtracto = extractoNormalizado
        .split(/[\s\.\-_\/\|,;:]+/)
        .filter(p => p.length >= 3);

    // Si el extracto no tiene palabras significativas, no podemos validar
    // (ej: "CR.DEBIN" -> palabras cortas)
    if (palabrasExtracto.length === 0) {
        // Intentar con palabras de 2+ caracteres como fallback
        const palabrasCortas = extractoNormalizado
            .split(/[\s\.\-_\/\|,;:]+/)
            .filter(p => p.length >= 2);

        if (palabrasCortas.length === 0) return false;

        // Verificar si alguna palabra del extracto aparece en alguna leyenda
        for (const mov of movimientosMayor) {
            const leyendaNormalizada = (mov.leyenda || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();

            for (const palabra of palabrasCortas) {
                if (leyendaNormalizada.includes(palabra)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Palabras genéricas que no sirven para identificar coincidencias
    const palabrasIgnorar = new Set([
        'por', 'caj', 'aut', 'trf', 'cta', 'cte', 'bco', 'banco',
        'transferencia', 'deposito', 'pago', 'cobro', 'credito', 'debito',
        'recibo', 'factura', 'nota', 'srl', 'sas', 'sca', 'sociedad'
    ]);

    // Filtrar palabras genéricas
    const palabrasRelevantes = palabrasExtracto.filter(p => !palabrasIgnorar.has(p));

    // Verificar coincidencia en al menos una leyenda del mayor
    for (const mov of movimientosMayor) {
        const leyenda = mov.leyenda || '';
        const leyendaNormalizada = leyenda
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        // Buscar coincidencia de palabras relevantes
        for (const palabra of palabrasRelevantes) {
            if (leyendaNormalizada.includes(palabra)) {
                return true;
            }
        }

        // También extraer palabras de la leyenda y buscar coincidencia inversa
        const palabrasLeyenda = leyendaNormalizada
            .split(/[\s\.\-_\/\|,;:\(\)]+/)
            .filter(p => p.length >= 3 && !palabrasIgnorar.has(p));

        for (const palabra of palabrasLeyenda) {
            if (extractoNormalizado.includes(palabra)) {
                return true;
            }
        }
    }

    return false;
}

// ========== MOSTRAR RESULTADOS ==========

function mostrarResultados() {
    const res = state.resultados;

    // Calcular totales
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);

    const totalMayor = totalConciliadoMayor + totalMayorPendiente;
    const totalExtracto = totalConciliadoExtracto + totalExtractoPendiente;

    // Contar movimientos individuales conciliados
    const movimientosMayorConciliados = res.conciliados.reduce((sum, c) => sum + c.mayor.length, 0);
    const movimientosExtractoConciliados = res.conciliados.reduce((sum, c) => sum + c.extracto.length, 0);

    // Actualizar resumen
    elements.conciliadosMayorCount.textContent = movimientosMayorConciliados;
    elements.conciliadosExtractoCount.textContent = movimientosExtractoConciliados;
    elements.mayorNoConciliado.textContent = res.mayorNoConciliado.length;
    elements.extractoNoConciliado.textContent = res.extractoNoConciliado.length;

    elements.totalMayor.textContent = formatearMoneda(totalMayor);
    elements.totalExtracto.textContent = formatearMoneda(totalExtracto);
    elements.diferencia.textContent = formatearMoneda(Math.abs(totalMayor - totalExtracto));

    // Color de diferencia
    const difElement = document.querySelector('.total-row.diferencia .total-value');
    if (Math.abs(totalMayor - totalExtracto) > 0) {
        difElement.style.color = '#dc2626';
    } else {
        difElement.style.color = '#059669';
    }

    // Llenar tablas
    llenarTablaConciliados(res.conciliados);
    llenarTablaMayorPendiente(res.mayorNoConciliado);
    llenarTablaExtractoPendiente(res.extractoNoConciliado);
    llenarTablaEliminados();

    // Poblar selector de tipos para el filtro de Mayor
    poblarSelectorTiposMayor();

    // Mostrar sección de resultados
    elements.resultados.classList.remove('hidden');

    // Scroll a resultados
    elements.resultados.scrollIntoView({ behavior: 'smooth' });
}

function llenarTablaConciliados(conciliados) {
    // Usar el nuevo sistema de renderizado por grupos
    renderizarConciliadosPorGrupos();
}

function llenarTablaMayorPendiente(pendientes) {
    let html = '';

    // Actualizar contador en header
    elements.countMayorPendiente.textContent = `(${pendientes.length})`;

    // Aplicar ordenamiento
    const pendientesOrdenados = aplicarOrdenamiento(pendientes, 'mayor');

    pendientesOrdenados.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Mayor fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllMayor) {
        elements.selectAllMayor.checked = false;
    }

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('mayor');
}

function llenarTablaExtractoPendiente(pendientes) {
    let html = '';

    // Actualizar contador en header
    elements.countExtractoPendiente.textContent = `(${pendientes.length})`;

    // Aplicar ordenamiento
    const pendientesOrdenados = aplicarOrdenamiento(pendientes, 'extracto');

    pendientesOrdenados.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Extracto fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllExtracto) {
        elements.selectAllExtracto.checked = false;
    }

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('extracto');
}

// ========== CONCILIACIÓN MANUAL ==========

/**
 * Pre-bloquear toggles al hacer mousedown en botón de color
 * Esto se ejecuta ANTES que cualquier onclick
 */
function preBloquearToggle(event) {
    bloqueandoToggleGrupos = true;
    console.log('PRE-Bloqueando toggles de grupo (mousedown)');
    if (event) {
        event.stopPropagation();
    }
}

/**
 * Pre-verificar si un toggle de grupo debe bloquearse
 * Se llama en mousedown de los botones de toggle de grupo
 * Esto previene que el onclick se ejecute si hay un cambio de color en progreso
 */
function preVerificarToggleGrupo(event) {
    if (bloqueandoToggleGrupos) {
        console.log('Toggle de grupo PREVENIDO en mousedown - cambio de color en progreso');
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
        // Marcar el botón para ignorar el click
        if (event && event.target) {
            event.target.dataset.ignorarClick = 'true';
        }
        return false;
    }
    // Limpiar marca si no hay bloqueo
    if (event && event.target) {
        event.target.dataset.ignorarClick = '';
    }
    return true;
}

/**
 * Cambiar la categoría de color de una conciliación (verde/naranja)
 * Verde = coincidencia de descripción, Naranja = sin coincidencia
 */
function toggleColorConciliacion(idConciliacion, event) {
    // Detener propagación del evento para evitar que se disparen otros handlers
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Asegurar que el bloqueo esté activo (por si no se llamó desde mousedown)
    bloqueandoToggleGrupos = true;

    if (!state.resultados) {
        bloqueandoToggleGrupos = false;
        return;
    }

    // Usar String() para consistencia en la comparación
    const idStr = String(idConciliacion);
    const match = state.resultados.conciliados.find(c => String(c.id) === idStr);
    if (!match) {
        console.warn('No se encontró la conciliación:', idConciliacion);
        bloqueandoToggleGrupos = false;
        return;
    }

    // Si no tiene override, calcular el valor actual
    if (match.coincidenciaOverride === undefined) {
        match.coincidenciaOverride = matchTieneCoincidenciaDescripcion(match);
    }

    // Toggle el valor
    match.coincidenciaOverride = !match.coincidenciaOverride;
    const nuevoColor = match.coincidenciaOverride ? 'verde' : 'naranja';
    console.log('Cambiado color de:', idStr, 'a', nuevoColor);

    // Mostrar automáticamente la sección destino si está oculta
    if (match.coincidenciaOverride && !gruposConciliados.verdesVisible) {
        gruposConciliados.verdesVisible = true;
        console.log('Mostrando sección de verdes automáticamente');
    } else if (!match.coincidenciaOverride && !gruposConciliados.naranjasVisible) {
        gruposConciliados.naranjasVisible = true;
        console.log('Mostrando sección de naranjas automáticamente');
    }

    // Re-renderizar por grupos (el elemento se moverá de verde a naranja o viceversa)
    renderizarConciliadosPorGrupos();

    // Desbloquear después de un pequeño delay para asegurar que los eventos pendientes se ignoren
    setTimeout(() => {
        bloqueandoToggleGrupos = false;
        console.log('Desbloqueando toggles de grupo');
    }, 150);
}

/**
 * Toggle selección de una conciliación para cambio masivo de color
 */
function toggleSeleccionConciliado(idConciliacion, checked) {
    console.log('toggleSeleccionConciliado llamado:', { idConciliacion, checked, tipo: typeof idConciliacion });

    // Convertir a string para consistencia
    const idStr = String(idConciliacion);

    if (checked) {
        if (!seleccionConciliados.includes(idStr)) {
            seleccionConciliados.push(idStr);
        }
    } else {
        seleccionConciliados = seleccionConciliados.filter(id => String(id) !== idStr);
    }

    console.log('seleccionConciliados después:', seleccionConciliados);

    // Actualizar visual de la fila
    const filas = document.querySelectorAll(`tr[data-conciliacion-id="${idStr}"]`);
    filas.forEach(fila => {
        if (checked) {
            fila.classList.add('row-conciliado-selected');
        } else {
            fila.classList.remove('row-conciliado-selected');
        }
    });

    actualizarBotonCambioColorMasivo();

    // Actualizar checkbox "seleccionar todos"
    actualizarCheckboxSeleccionarTodosConciliados();
}

/**
 * Seleccionar/deseleccionar todos los conciliados visibles
 */
function seleccionarTodosConciliados(checked) {
    // Obtener los conciliados visibles (filtrados o todos)
    const conciliadosVisibles = hayFiltrosActivosConciliados()
        ? conciliadosFiltrado
        : (state.resultados ? state.resultados.conciliados : []);

    if (checked) {
        // Agregar todos los IDs de conciliados visibles
        conciliadosVisibles.forEach(match => {
            if (!seleccionConciliados.includes(String(match.id))) {
                seleccionConciliados.push(String(match.id));
            }
        });
    } else {
        // Remover solo los que están visibles
        const idsVisibles = conciliadosVisibles.map(m => String(m.id));
        seleccionConciliados = seleccionConciliados.filter(id => !idsVisibles.includes(id));
    }

    // Actualizar todos los checkboxes y clases de fila
    const checkboxes = document.querySelectorAll('.checkbox-conciliado');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const fila = cb.closest('tr');
        if (fila) {
            if (checked) {
                fila.classList.add('row-conciliado-selected');
            } else {
                fila.classList.remove('row-conciliado-selected');
            }
        }
    });

    actualizarBotonCambioColorMasivo();
}

/**
 * Seleccionar/deseleccionar todos los conciliados de un grupo específico
 */
function seleccionarTodosConciliadosGrupo(grupo, checked) {
    if (!state.resultados) return;

    // Separar en verdes y naranjas
    const conciliados = state.resultados.conciliados;
    const conciliadosGrupo = conciliados.filter(match => {
        const tieneCoincidencia = match.coincidenciaOverride !== undefined
            ? match.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(match);
        return grupo === 'verdes' ? tieneCoincidencia : !tieneCoincidencia;
    });

    if (checked) {
        // Agregar todos los IDs del grupo
        conciliadosGrupo.forEach(match => {
            if (!seleccionConciliados.includes(String(match.id))) {
                seleccionConciliados.push(String(match.id));
            }
        });
    } else {
        // Remover solo los del grupo
        const idsGrupo = conciliadosGrupo.map(m => String(m.id));
        seleccionConciliados = seleccionConciliados.filter(id => !idsGrupo.includes(id));
    }

    // Re-renderizar para actualizar checkboxes
    renderizarConciliadosPorGrupos();
    actualizarBotonCambioColorMasivo();
}

/**
 * Actualizar estado del checkbox "seleccionar todos" basado en la selección actual
 */
function actualizarCheckboxSeleccionarTodosConciliados() {
    const checkboxAll = document.getElementById('selectAllConciliados');
    if (!checkboxAll) return;

    const conciliadosVisibles = hayFiltrosActivosConciliados()
        ? conciliadosFiltrado
        : (state.resultados ? state.resultados.conciliados : []);

    if (conciliadosVisibles.length === 0) {
        checkboxAll.checked = false;
        checkboxAll.indeterminate = false;
        return;
    }

    const todosSeleccionados = conciliadosVisibles.every(m => seleccionConciliados.includes(String(m.id)));
    const algunoSeleccionado = conciliadosVisibles.some(m => seleccionConciliados.includes(String(m.id)));

    checkboxAll.checked = todosSeleccionados;
    checkboxAll.indeterminate = algunoSeleccionado && !todosSeleccionados;
}

/**
 * Actualizar visibilidad y contador del botón de cambio de color masivo
 */
function actualizarBotonCambioColorMasivo() {
    const btn = document.getElementById('btnCambiarColorMasivo');
    const countSpan = document.getElementById('countConciliadosSeleccionados');

    if (!btn || !countSpan) return;

    const count = seleccionConciliados.length;
    countSpan.textContent = count;

    if (count > 0) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

/**
 * Mostrar menú de cambio de color masivo
 */
function mostrarMenuCambioColorMasivo() {
    if (seleccionConciliados.length === 0) return;

    const overlay = document.getElementById('overlayCambioColor');
    const menu = document.getElementById('menuCambioColorMasivo');
    const countSpan = document.getElementById('menuCambioColorCount');

    if (overlay) overlay.classList.remove('hidden');
    if (menu) menu.classList.remove('hidden');
    if (countSpan) countSpan.textContent = seleccionConciliados.length;
}

/**
 * Cerrar menú de cambio de color masivo
 */
function cerrarMenuCambioColorMasivo() {
    const overlay = document.getElementById('overlayCambioColor');
    const menu = document.getElementById('menuCambioColorMasivo');

    if (overlay) overlay.classList.add('hidden');
    if (menu) menu.classList.add('hidden');
}

/**
 * Cambiar el color de todas las conciliaciones seleccionadas
 * @param {boolean} tieneCoincidencia - true para verde, false para naranja
 */
function cambiarColorMasivo(tieneCoincidencia) {
    console.log('cambiarColorMasivo llamado:', { tieneCoincidencia, seleccionados: seleccionConciliados });

    if (!state.resultados || seleccionConciliados.length === 0) {
        console.warn('cambiarColorMasivo: No hay resultados o selección vacía');
        return;
    }

    const cantidadCambiados = seleccionConciliados.length;
    let cambiosRealizados = 0;

    // Actualizar el coincidenciaOverride de cada conciliación seleccionada
    seleccionConciliados.forEach(idConciliacion => {
        const idStr = String(idConciliacion);
        const match = state.resultados.conciliados.find(c => String(c.id) === idStr);
        if (match) {
            match.coincidenciaOverride = tieneCoincidencia;
            cambiosRealizados++;
            console.log('Cambiado color de:', idStr, 'a', tieneCoincidencia ? 'verde' : 'naranja');
        } else {
            console.warn('No se encontró conciliación con ID:', idStr);
        }
    });

    // Cerrar el menú
    cerrarMenuCambioColorMasivo();

    // Limpiar selección
    limpiarSeleccionConciliados();

    // Mostrar automáticamente la sección destino si hay cambios
    if (cambiosRealizados > 0) {
        if (tieneCoincidencia && !gruposConciliados.verdesVisible) {
            gruposConciliados.verdesVisible = true;
            console.log('Mostrando sección de verdes automáticamente');
        } else if (!tieneCoincidencia && !gruposConciliados.naranjasVisible) {
            gruposConciliados.naranjasVisible = true;
            console.log('Mostrando sección de naranjas automáticamente');
        }
    }

    // Re-renderizar por grupos
    renderizarConciliadosPorGrupos();

    mostrarMensaje(`Se cambió el color de ${cambiosRealizados} conciliaciones`, 'success');
}

/**
 * Limpiar selección de conciliados
 */
function limpiarSeleccionConciliados() {
    seleccionConciliados = [];

    // Actualizar todos los checkboxes
    const checkboxes = document.querySelectorAll('.checkbox-conciliado');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });

    // Quitar clases de selección
    const filasSeleccionadas = document.querySelectorAll('.row-conciliado-selected');
    filasSeleccionadas.forEach(fila => {
        fila.classList.remove('row-conciliado-selected');
    });

    // Actualizar checkbox "seleccionar todos"
    const checkboxAll = document.getElementById('selectAllConciliados');
    if (checkboxAll) {
        checkboxAll.checked = false;
        checkboxAll.indeterminate = false;
    }

    actualizarBotonCambioColorMasivo();
}

/**
 * Desconciliar un grupo de movimientos conciliados
 */
function desconciliar(idConciliacion) {
    if (!state.resultados) return;

    const grupo = state.resultados.conciliados.find(c => String(c.id) === String(idConciliacion));
    if (!grupo) {
        console.warn('No se encontró la conciliación:', idConciliacion);
        return;
    }

    // Mostrar confirmación con opción de recordar
    const cantMayor = grupo.mayor.length;
    const cantExtracto = grupo.extracto.length;
    const mensaje = `¿Desea desconciliar estos movimientos?\n\n` +
                   `• ${cantMayor} movimiento(s) del Mayor\n` +
                   `• ${cantExtracto} movimiento(s) del Extracto\n\n` +
                   `Estos movimientos no se volverán a conciliar automáticamente en futuros reprocesos.`;

    if (!confirm(mensaje)) return;

    // Guardar los IDs de los movimientos para evitar que se vuelvan a conciliar automáticamente
    const mayorIds = grupo.mayor.map(m => String(m.id));
    const extractoIds = grupo.extracto.map(e => String(e.id));

    // Solo guardar si la conciliación no fue manual (las manuales fueron intencionales)
    if (!grupo.manual) {
        desconciliacionesManuales.push({
            mayorIds: mayorIds,
            extractoIds: extractoIds,
            fechaDesconciliacion: new Date().toISOString(),
            idConciliacionOriginal: String(idConciliacion)
        });
        console.log('Desconciliación registrada:', { mayorIds, extractoIds });
    }

    // Mover movimientos a las listas de pendientes
    state.resultados.mayorNoConciliado.push(...grupo.mayor);
    state.resultados.extractoNoConciliado.push(...grupo.extracto);

    // Eliminar de conciliados
    state.resultados.conciliados = state.resultados.conciliados.filter(c => String(c.id) !== String(idConciliacion));

    // IMPORTANTE: Resetear filtros antes de actualizar vistas
    // Esto evita que los movimientos desconciliados desaparezcan cuando hay filtros activos
    // Bug fix: renderizarTablaExtractoOrdenada() usaba extractoPendienteFiltrado (vacío/desactualizado)
    // cuando hayFiltrosActivosExtracto() era true
    resetearFiltros();

    // Actualizar vistas
    llenarTablaConciliados(state.resultados.conciliados);
    llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    actualizarTotalesYContadores();
    actualizarPanelReproceso();

    mostrarMensaje('Movimientos desconciliados correctamente. No se volverán a conciliar automáticamente.', 'success');
}

/**
 * Verifica si un par de movimientos fue desconciliado manualmente
 * @param {Array} mayorIds - IDs de movimientos del Mayor
 * @param {Array} extractoIds - IDs de movimientos del Extracto
 * @returns {boolean} true si este par fue desconciliado manualmente
 */
function fueDesconciliadoManualmente(mayorIds, extractoIds) {
    const mayorIdsStr = mayorIds.map(id => String(id));
    const extractoIdsStr = extractoIds.map(id => String(id));

    return desconciliacionesManuales.some(desc => {
        // Verificar si hay coincidencia de IDs
        const coincideMayor = mayorIdsStr.some(id => desc.mayorIds.includes(id));
        const coincideExtracto = extractoIdsStr.some(id => desc.extractoIds.includes(id));
        return coincideMayor && coincideExtracto;
    });
}

/**
 * Obtiene el número de desconciliaciones manuales registradas
 * @returns {number} Cantidad de desconciliaciones manuales
 */
function getCountDesconciliacionesManuales() {
    return desconciliacionesManuales.length;
}

/**
 * Limpia todas las desconciliaciones manuales (permite que se vuelvan a conciliar automáticamente)
 */
function limpiarDesconciliacionesManuales() {
    const count = desconciliacionesManuales.length;
    if (count === 0) {
        mostrarMensaje('No hay desconciliaciones manuales registradas', 'info');
        return;
    }

    if (confirm(`¿Está seguro de limpiar ${count} desconciliación(es) manual(es)?\n\nEsto permitirá que estos movimientos se vuelvan a conciliar automáticamente en futuros reprocesos.`)) {
        desconciliacionesManuales = [];
        actualizarInfoDesconciliaciones();
        mostrarMensaje(`Se limpiaron ${count} desconciliaciones manuales. Los movimientos podrán conciliarse automáticamente.`, 'success');
    }
}

/**
 * Vincular manualmente los movimientos seleccionados
 */
function vincularManualmente() {
    if (!state.resultados) return;

    // Obtener movimientos seleccionados
    const movsMayor = state.resultados.mayorNoConciliado.filter(m => seleccion.mayor.includes(m.id));
    const movsExtracto = state.resultados.extractoNoConciliado.filter(e => seleccion.extracto.includes(e.id));

    if (movsMayor.length === 0 || movsExtracto.length === 0) {
        alert('Debe seleccionar al menos un movimiento de cada lista (Mayor y Extracto)');
        return;
    }

    // Calcular diferencia
    const sumaMayor = movsMayor.reduce((sum, m) => sum + m.importe, 0);
    const sumaExtracto = movsExtracto.reduce((sum, e) => sum + e.importe, 0);
    const diferencia = Math.abs(sumaMayor - sumaExtracto);

    // Validar tolerancia
    if (diferencia > state.toleranciaImporte) {
        const mensaje = `La diferencia (${formatearMoneda(diferencia)}) excede la tolerancia configurada (${formatearMoneda(state.toleranciaImporte)}).\n\n¿Desea vincular de todos modos?`;
        if (!confirm(mensaje)) return;
    }

    // Crear nueva conciliación manual
    const nuevaConciliacion = {
        id: 'conc_' + (++conciliacionIdCounter),
        tipo: movsMayor.length > 1 && movsExtracto.length > 1 ? 'N:N' :
              movsMayor.length > 1 ? 'N:1' :
              movsExtracto.length > 1 ? '1:N' : '1:1',
        mayor: movsMayor,
        extracto: movsExtracto,
        diferencia: diferencia,
        manual: true
    };

    // Agregar a conciliados
    state.resultados.conciliados.push(nuevaConciliacion);

    // Remover de pendientes
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(
        m => !seleccion.mayor.includes(m.id)
    );
    state.resultados.extractoNoConciliado = state.resultados.extractoNoConciliado.filter(
        e => !seleccion.extracto.includes(e.id)
    );

    // Limpiar selección
    limpiarSeleccion();

    // Actualizar vistas
    llenarTablaConciliados(state.resultados.conciliados);
    llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    actualizarTotalesYContadores();

    // Cambiar a pestaña de conciliados para ver el resultado
    cambiarTab('conciliados');

    // Registrar la conciliación manual en el historial
    registrarConciliacionManualEnHistorial(movsMayor.length + movsExtracto.length);

    mostrarMensaje('Movimientos vinculados manualmente como conciliados', 'success');
}

/**
 * Registra una conciliación manual en el historial de procesamiento
 * @param {number} cantidadMovimientos - Cantidad de movimientos conciliados manualmente
 */
function registrarConciliacionManualEnHistorial(cantidadMovimientos) {
    // Si no hay historial previo, crear uno vacío para el procesamiento inicial
    if (historialProcesamiento.length === 0) {
        historialProcesamiento = [{
            fecha: new Date().toISOString(),
            toleranciaFecha: state.toleranciaFecha,
            toleranciaImporte: state.toleranciaImporte,
            exigenciaPalabras: state.exigenciaPalabras,
            conciliados: cantidadMovimientos,
            esInicial: true,
            tipo: 'manual',
            duracion: 0
        }];
    } else {
        // Agregar como nuevo proceso manual
        historialProcesamiento.push({
            fecha: new Date().toISOString(),
            toleranciaFecha: state.toleranciaFecha,
            toleranciaImporte: state.toleranciaImporte,
            exigenciaPalabras: state.exigenciaPalabras,
            conciliados: cantidadMovimientos,
            esInicial: false,
            tipo: 'manual',
            duracion: 0
        });
    }

    actualizarHistorial();
}

/**
 * Toggle selección de un movimiento del Mayor
 */
function toggleSeleccionMayor(id, checked) {
    if (checked) {
        if (!seleccion.mayor.includes(id)) {
            seleccion.mayor.push(id);
        }
    } else {
        seleccion.mayor = seleccion.mayor.filter(i => i !== id);
    }

    // Actualizar clase visual en la fila
    const row = document.querySelector(`#tablaMayorPendiente tr[data-id="${id}"]`);
    if (row) {
        row.classList.toggle('row-selected', checked);
    }

    actualizarBarraSeleccion();
}

/**
 * Toggle selección de un movimiento del Extracto
 */
function toggleSeleccionExtracto(id, checked) {
    if (checked) {
        if (!seleccion.extracto.includes(id)) {
            seleccion.extracto.push(id);
        }
    } else {
        seleccion.extracto = seleccion.extracto.filter(i => i !== id);
    }

    // Actualizar clase visual en la fila
    const row = document.querySelector(`#tablaExtractoPendiente tr[data-id="${id}"]`);
    if (row) {
        row.classList.toggle('row-selected', checked);
    }

    actualizarBarraSeleccion();
}

/**
 * Seleccionar/deseleccionar todos los movimientos del Mayor pendiente
 * Respeta los filtros activos: solo selecciona movimientos visibles/filtrados
 */
function seleccionarTodosMayor(checked) {
    if (!state.resultados) return;

    if (checked) {
        // Usar movimientos filtrados si hay filtros activos, sino todos
        const movimientos = hayFiltrosActivosMayor()
            ? mayorPendienteFiltrado
            : state.resultados.mayorNoConciliado;
        seleccion.mayor = movimientos.map(m => m.id);
    } else {
        seleccion.mayor = [];
    }

    // Actualizar checkboxes y clases visuales
    document.querySelectorAll('.checkbox-mayor').forEach(cb => {
        cb.checked = checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });

    actualizarBarraSeleccion();
}

/**
 * Seleccionar/deseleccionar todos los movimientos del Extracto pendiente
 * Respeta los filtros activos: solo selecciona movimientos visibles/filtrados
 */
function seleccionarTodosExtracto(checked) {
    if (!state.resultados) return;

    if (checked) {
        // Usar movimientos filtrados si hay filtros activos, sino todos
        const movimientos = hayFiltrosActivosExtracto()
            ? extractoPendienteFiltrado
            : state.resultados.extractoNoConciliado;
        seleccion.extracto = movimientos.map(e => e.id);
    } else {
        seleccion.extracto = [];
    }

    // Actualizar checkboxes y clases visuales
    document.querySelectorAll('.checkbox-extracto').forEach(cb => {
        cb.checked = checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });

    actualizarBarraSeleccion();
}

/**
 * Limpiar toda la selección
 */
function limpiarSeleccion() {
    seleccion.mayor = [];
    seleccion.extracto = [];

    // Desmarcar checkboxes
    document.querySelectorAll('.checkbox-mayor, .checkbox-extracto').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        if (row) row.classList.remove('row-selected');
    });

    // Reset checkboxes "seleccionar todos"
    if (elements.selectAllMayor) elements.selectAllMayor.checked = false;
    if (elements.selectAllExtracto) elements.selectAllExtracto.checked = false;

    actualizarBarraSeleccion();
}

/**
 * Actualizar la barra de selección flotante con los totales
 */
function actualizarBarraSeleccion() {
    if (!state.resultados) return;

    const cantMayor = seleccion.mayor.length;
    const cantExtracto = seleccion.extracto.length;

    // Calcular totales
    const totalMayor = state.resultados.mayorNoConciliado
        .filter(m => seleccion.mayor.includes(m.id))
        .reduce((sum, m) => sum + m.importe, 0);

    const totalExtracto = state.resultados.extractoNoConciliado
        .filter(e => seleccion.extracto.includes(e.id))
        .reduce((sum, e) => sum + e.importe, 0);

    const diferencia = Math.abs(totalMayor - totalExtracto);

    // Actualizar UI
    elements.selMayorCount.textContent = cantMayor;
    elements.selMayorTotal.textContent = formatearMoneda(totalMayor);
    elements.selExtractoCount.textContent = cantExtracto;
    elements.selExtractoTotal.textContent = formatearMoneda(totalExtracto);
    elements.selDiferencia.textContent = formatearMoneda(diferencia);

    // Color de diferencia
    if (diferencia > state.toleranciaImporte) {
        elements.selDiferencia.classList.add('diff-warning');
    } else {
        elements.selDiferencia.classList.remove('diff-warning');
    }

    // Habilitar/deshabilitar botón vincular
    elements.btnVincular.disabled = cantMayor === 0 || cantExtracto === 0;

    // Mostrar/ocultar barra
    if (cantMayor > 0 || cantExtracto > 0) {
        elements.selectionBar.classList.remove('hidden');
    } else {
        elements.selectionBar.classList.add('hidden');
    }

    // Actualizar botón de eliminar seleccionados
    actualizarBotonEliminarSeleccionados();
}

/**
 * Actualizar todos los totales y contadores después de cambios manuales
 */
function actualizarTotalesYContadores() {
    if (!state.resultados) return;

    const res = state.resultados;

    // Calcular totales
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);

    const totalMayor = totalConciliadoMayor + totalMayorPendiente;
    const totalExtracto = totalConciliadoExtracto + totalExtractoPendiente;

    // Contar movimientos individuales conciliados
    const movimientosMayorConciliados = res.conciliados.reduce((sum, c) => sum + c.mayor.length, 0);
    const movimientosExtractoConciliados = res.conciliados.reduce((sum, c) => sum + c.extracto.length, 0);

    // Actualizar contadores en resumen
    elements.conciliadosMayorCount.textContent = movimientosMayorConciliados;
    elements.conciliadosExtractoCount.textContent = movimientosExtractoConciliados;
    elements.mayorNoConciliado.textContent = res.mayorNoConciliado.length;
    elements.extractoNoConciliado.textContent = res.extractoNoConciliado.length;

    // Actualizar totales
    elements.totalMayor.textContent = formatearMoneda(totalMayor);
    elements.totalExtracto.textContent = formatearMoneda(totalExtracto);
    elements.diferencia.textContent = formatearMoneda(Math.abs(totalMayor - totalExtracto));

    // Color de diferencia
    const difElement = document.querySelector('.total-row.diferencia .total-value');
    if (difElement) {
        if (Math.abs(totalMayor - totalExtracto) > 0) {
            difElement.style.color = '#dc2626';
        } else {
            difElement.style.color = '#059669';
        }
    }

    // Actualizar contadores en headers de pestañas pendientes
    elements.countMayorPendiente.textContent = `(${res.mayorNoConciliado.length})`;
    elements.countExtractoPendiente.textContent = `(${res.extractoNoConciliado.length})`;

    // Actualizar contador de eliminados
    if (elements.countEliminados) {
        elements.countEliminados.textContent = `(${state.eliminados.length})`;
    }

    // Actualizar resumen de eliminados
    actualizarResumenEliminados();
}

/**
 * Actualizar la información de eliminados en el resumen
 */
function actualizarResumenEliminados() {
    const eliminadosResumen = document.getElementById('eliminadosResumen');
    const totalEliminadosSpan = document.getElementById('totalEliminados');
    const diferenciaAjustadaRow = document.getElementById('diferenciaAjustadaRow');
    const diferenciaAjustadaSpan = document.getElementById('diferenciaAjustada');

    if (!eliminadosResumen || !totalEliminadosSpan) return;

    const cantidadEliminados = state.eliminados.length;
    const totalEliminados = state.eliminados.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

    if (cantidadEliminados > 0) {
        eliminadosResumen.classList.remove('hidden');
        totalEliminadosSpan.textContent = `${cantidadEliminados} movimiento${cantidadEliminados !== 1 ? 's' : ''} (${formatearMoneda(totalEliminados)})`;

        // Calcular y mostrar diferencia ajustada
        if (state.resultados && diferenciaAjustadaRow && diferenciaAjustadaSpan) {
            const totalMayorPendiente = state.resultados.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
            const totalExtractoPendiente = state.resultados.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);
            const diferenciaOriginal = Math.abs(totalMayorPendiente - totalExtractoPendiente);
            const diferenciaAjustada = Math.abs((totalMayorPendiente - totalEliminados) - totalExtractoPendiente);

            diferenciaAjustadaRow.classList.remove('hidden');
            diferenciaAjustadaSpan.textContent = formatearMoneda(diferenciaAjustada);

            // Color según si la diferencia ajustada es menor que la original
            if (diferenciaAjustada < diferenciaOriginal) {
                diferenciaAjustadaSpan.style.color = '#059669';
            } else {
                diferenciaAjustadaSpan.style.color = '#dc2626';
            }
        }
    } else {
        eliminadosResumen.classList.add('hidden');
        if (diferenciaAjustadaRow) {
            diferenciaAjustadaRow.classList.add('hidden');
        }
    }
}

// ========== ELIMINACIÓN DE MOVIMIENTOS DEL MAYOR ==========

/**
 * Mostrar modal de confirmación para eliminar un movimiento
 * @param {string} id - ID del movimiento a eliminar (puede ser un ID o 'seleccionados')
 */
function mostrarModalEliminar(id) {
    if (!state.resultados) return;

    const modal = document.getElementById('modal-eliminar');
    const overlay = document.getElementById('overlay-eliminar');
    const detalles = document.getElementById('eliminar-detalles');
    const inputMotivo = document.getElementById('eliminar-motivo');

    if (!modal || !overlay) return;

    // Limpiar motivo previo
    if (inputMotivo) inputMotivo.value = '';

    if (id === 'seleccionados') {
        // Eliminar múltiples seleccionados
        const movimientos = state.resultados.mayorNoConciliado.filter(m => seleccion.mayor.includes(m.id));
        if (movimientos.length === 0) {
            alert('No hay movimientos seleccionados para eliminar');
            return;
        }

        const totalImporte = movimientos.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

        detalles.innerHTML = `
            <p><strong>Se eliminarán ${movimientos.length} movimientos:</strong></p>
            <p>Importe total: <strong>${formatearMoneda(totalImporte)}</strong></p>
            <div class="eliminar-lista-preview">
                ${movimientos.slice(0, 5).map(m => `
                    <div class="eliminar-item-preview">
                        <span>Asiento ${m.numeroAsiento}</span>
                        <span>${formatearMoneda(m.importe || m.debe || m.haber)}</span>
                    </div>
                `).join('')}
                ${movimientos.length > 5 ? `<div class="eliminar-item-preview text-muted">...y ${movimientos.length - 5} más</div>` : ''}
            </div>
        `;

        modal.dataset.eliminarId = 'seleccionados';
    } else {
        // Eliminar un solo movimiento
        const movimiento = state.resultados.mayorNoConciliado.find(m => m.id === id);
        if (!movimiento) return;

        const importe = movimiento.importe || movimiento.debe || movimiento.haber || 0;

        detalles.innerHTML = `
            <div class="eliminar-item-info">
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Nº Asiento:</span>
                    <span class="eliminar-value">${movimiento.numeroAsiento}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Fecha:</span>
                    <span class="eliminar-value">${formatearFecha(movimiento.fecha)}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Leyenda:</span>
                    <span class="eliminar-value" title="${movimiento.leyenda}">${truncar(movimiento.leyenda, 40)}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Importe:</span>
                    <span class="eliminar-value importe-destacado">${formatearMoneda(importe)}</span>
                </div>
            </div>
        `;

        modal.dataset.eliminarId = id;
    }

    // Mostrar modal
    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Cerrar modal de eliminar
 */
function cerrarModalEliminar() {
    const modal = document.getElementById('modal-eliminar');
    const overlay = document.getElementById('overlay-eliminar');

    if (modal) modal.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
}

/**
 * Confirmar eliminación desde el modal
 */
function confirmarEliminar() {
    const modal = document.getElementById('modal-eliminar');
    const inputMotivo = document.getElementById('eliminar-motivo');

    if (!modal) return;

    const id = modal.dataset.eliminarId;
    const motivo = inputMotivo ? inputMotivo.value.trim() : '';

    if (id === 'seleccionados') {
        eliminarMovimientosSeleccionados(motivo);
    } else {
        eliminarMovimiento(id, motivo);
    }

    cerrarModalEliminar();
}

/**
 * Eliminar un movimiento del Mayor del proceso de conciliación
 * @param {string} id - ID del movimiento a eliminar
 * @param {string} motivo - Motivo de eliminación (opcional)
 */
function eliminarMovimiento(id, motivo = '') {
    if (!state.resultados) return;

    const movimiento = state.resultados.mayorNoConciliado.find(m => m.id === id);
    if (!movimiento) return;

    // Agregar a eliminados con metadata
    state.eliminados.push({
        ...movimiento,
        fechaEliminacion: new Date().toISOString(),
        motivo: motivo
    });

    // Quitar de mayorNoConciliado
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(m => m.id !== id);

    // Quitar de selección si estaba seleccionado
    seleccion.mayor = seleccion.mayor.filter(i => i !== id);

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje('Movimiento eliminado del proceso de conciliación', 'success');
}

/**
 * Eliminar múltiples movimientos seleccionados
 * @param {string} motivo - Motivo de eliminación (opcional)
 */
function eliminarMovimientosSeleccionados(motivo = '') {
    if (!state.resultados) return;

    const idsAEliminar = [...seleccion.mayor];
    if (idsAEliminar.length === 0) return;

    const movimientos = state.resultados.mayorNoConciliado.filter(m => idsAEliminar.includes(m.id));

    // Agregar a eliminados con metadata
    movimientos.forEach(movimiento => {
        state.eliminados.push({
            ...movimiento,
            fechaEliminacion: new Date().toISOString(),
            motivo: motivo
        });
    });

    // Quitar de mayorNoConciliado
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(
        m => !idsAEliminar.includes(m.id)
    );

    // Limpiar selección
    seleccion.mayor = [];

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje(`${movimientos.length} movimiento(s) eliminado(s) del proceso de conciliación`, 'success');
}

/**
 * Restaurar un movimiento eliminado
 * @param {string} id - ID del movimiento a restaurar
 */
function restaurarMovimiento(id) {
    const idx = state.eliminados.findIndex(m => m.id === id);
    if (idx === -1) return;

    const movimientoEliminado = state.eliminados[idx];

    // Quitar campos de eliminación y restaurar el movimiento original
    const { fechaEliminacion, motivo, ...movimientoOriginal } = movimientoEliminado;

    // Agregar a mayorNoConciliado
    if (state.resultados) {
        state.resultados.mayorNoConciliado.push(movimientoOriginal);
    }

    // Quitar de eliminados
    state.eliminados.splice(idx, 1);

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje('Movimiento restaurado al proceso de conciliación', 'success');
}

/**
 * Actualizar todas las vistas después de eliminar/restaurar
 */
function actualizarVistasEliminacion() {
    if (!state.resultados) return;

    // Actualizar tabla Mayor Pendiente
    if (hayFiltrosActivosMayor()) {
        mayorPendienteFiltrado = filtrarMovimientosMayor(state.resultados.mayorNoConciliado);
        renderizarMayorPendienteFiltrado();
        mostrarResultadoFiltrosMayor(mayorPendienteFiltrado.length, state.resultados.mayorNoConciliado.length);
    } else {
        llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    }

    // Actualizar tabla Eliminados
    llenarTablaEliminados();

    // Actualizar contadores y totales
    actualizarTotalesYContadores();

    // Actualizar barra de selección
    actualizarBarraSeleccion();

    // Actualizar botón de eliminar seleccionados
    actualizarBotonEliminarSeleccionados();
}

/**
 * Llenar la tabla de movimientos eliminados
 */
function llenarTablaEliminados() {
    if (!elements.tablaEliminados) return;

    let html = '';

    // Actualizar contadores (en pestaña y en header)
    if (elements.countEliminados) {
        elements.countEliminados.textContent = `(${state.eliminados.length})`;
    }
    const countEliminadosTab = document.getElementById('countEliminadosTab');
    if (countEliminadosTab) {
        countEliminadosTab.textContent = `(${state.eliminados.length})`;
    }

    if (state.eliminados.length === 0) {
        elements.tablaEliminados.innerHTML = '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos eliminados</td></tr>';
        return;
    }

    // Ordenar por fecha de eliminación (más reciente primero)
    const eliminadosOrdenados = [...state.eliminados].sort((a, b) => {
        return new Date(b.fechaEliminacion) - new Date(a.fechaEliminacion);
    });

    eliminadosOrdenados.forEach(m => {
        const importe = m.importe || m.debe || m.haber || 0;
        const fechaElim = new Date(m.fechaEliminacion);
        const fechaEliminacionFormateada = formatearFecha(fechaElim) + ' ' +
            fechaElim.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        html += `
            <tr data-id="${m.id}">
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 35)}</td>
                <td class="text-right">${formatearNumero(importe)}</td>
                <td class="text-muted fecha-eliminacion">${fechaEliminacionFormateada}</td>
                <td title="${m.motivo || ''}">${truncar(m.motivo || '-', 20)}</td>
                <td class="col-action-restaurar">
                    <button class="btn-restaurar" onclick="restaurarMovimiento('${m.id}')" title="Restaurar al proceso de conciliación">
                        ↩️ Restaurar
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaEliminados.innerHTML = html;
}

/**
 * Actualizar botón de eliminar seleccionados
 */
function actualizarBotonEliminarSeleccionados() {
    if (!elements.btnEliminarSeleccionados) return;

    const cantidad = seleccion.mayor.length;

    if (cantidad > 0) {
        elements.btnEliminarSeleccionados.classList.remove('hidden');
        elements.btnEliminarSeleccionados.innerHTML = `🗑️ Eliminar seleccionados (${cantidad})`;
    } else {
        elements.btnEliminarSeleccionados.classList.add('hidden');
    }
}

// ========== FILTROS DE BÚSQUEDA ==========

/**
 * Toggle para mostrar/ocultar panel de filtros
 */
function toggleFiltros(tipo) {
    const panel = document.getElementById(`filtros-${tipo}`);
    const btn = document.getElementById(`btnFiltros${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.innerHTML = '🔍 Filtros ▲';
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('active');
        btn.innerHTML = '🔍 Filtros ▼';
    }
}

/**
 * Toggle para mostrar segundo campo de importe (cuando se selecciona "Entre")
 */
function toggleSegundoImporte(tipo) {
    const selectTipo = document.getElementById(`filtro${tipo.charAt(0).toUpperCase() + tipo.slice(1)}ImporteTipo`);
    const input2 = document.getElementById(`filtro${tipo.charAt(0).toUpperCase() + tipo.slice(1)}ImporteValor2`);

    if (selectTipo.value === 'entre') {
        input2.classList.remove('hidden');
    } else {
        input2.classList.add('hidden');
        input2.value = '';
    }
}

/**
 * Aplicar filtros a Mayor Pendiente
 */
function aplicarFiltrosMayor() {
    if (!state.resultados) return;

    // Leer valores de los inputs
    filtrosMayor.fechaDesde = document.getElementById('filtroMayorFechaDesde').value || null;
    filtrosMayor.fechaHasta = document.getElementById('filtroMayorFechaHasta').value || null;
    filtrosMayor.importeTipo = document.getElementById('filtroMayorImporteTipo').value || '';
    filtrosMayor.importeValor = parseFloat(document.getElementById('filtroMayorImporteValor').value) || null;
    filtrosMayor.importeValor2 = parseFloat(document.getElementById('filtroMayorImporteValor2').value) || null;
    filtrosMayor.numeroAsiento = document.getElementById('filtroMayorNumeroAsiento').value.trim();
    filtrosMayor.leyenda = document.getElementById('filtroMayorLeyenda').value.trim();
    filtrosMayor.ce = document.getElementById('filtroMayorCE').value;
    filtrosMayor.tipo = document.getElementById('filtroMayorTipo').value;

    // Aplicar filtros
    const original = state.resultados.mayorNoConciliado;
    mayorPendienteFiltrado = filtrarMovimientosMayor(original);

    // Actualizar UI
    renderizarMayorPendienteFiltrado();
    mostrarResultadoFiltrosMayor(mayorPendienteFiltrado.length, original.length);
    mostrarBadgesFiltrosMayor();
}

/**
 * Filtrar movimientos del Mayor según los filtros activos
 */
function filtrarMovimientosMayor(movimientos) {
    return movimientos.filter(mov => {
        // Filtro fecha desde
        if (filtrosMayor.fechaDesde) {
            const fechaDesde = new Date(filtrosMayor.fechaDesde);
            if (mov.fecha < fechaDesde) return false;
        }

        // Filtro fecha hasta
        if (filtrosMayor.fechaHasta) {
            const fechaHasta = new Date(filtrosMayor.fechaHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            if (mov.fecha > fechaHasta) return false;
        }

        // Filtro importe
        const importe = mov.importe || mov.debe || mov.haber || 0;
        if (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) {
            switch (filtrosMayor.importeTipo) {
                case 'mayor':
                    if (importe <= filtrosMayor.importeValor) return false;
                    break;
                case 'menor':
                    if (importe >= filtrosMayor.importeValor) return false;
                    break;
                case 'igual':
                    if (Math.abs(importe - filtrosMayor.importeValor) > 0.01) return false;
                    break;
                case 'entre':
                    if (filtrosMayor.importeValor2 !== null) {
                        if (importe < filtrosMayor.importeValor || importe > filtrosMayor.importeValor2) return false;
                    }
                    break;
            }
        }

        // Filtro número de asiento (búsqueda parcial)
        if (filtrosMayor.numeroAsiento) {
            if (!String(mov.numeroAsiento).toLowerCase().includes(filtrosMayor.numeroAsiento.toLowerCase())) {
                return false;
            }
        }

        // Filtro leyenda (búsqueda parcial, case insensitive)
        if (filtrosMayor.leyenda) {
            if (!mov.leyenda.toLowerCase().includes(filtrosMayor.leyenda.toLowerCase())) {
                return false;
            }
        }

        // Filtro C/E
        if (filtrosMayor.ce !== 'todos') {
            if (mov.ce !== filtrosMayor.ce) return false;
        }

        // Filtro Tipo
        if (filtrosMayor.tipo !== 'todos') {
            if (mov.tipoAsiento !== filtrosMayor.tipo) return false;
        }

        return true;
    });
}

/**
 * Renderizar tabla de Mayor Pendiente con datos filtrados
 */
function renderizarMayorPendienteFiltrado() {
    let html = '';

    // Aplicar ordenamiento a los datos filtrados
    const pendientes = aplicarOrdenamiento(mayorPendienteFiltrado, 'mayor');

    pendientes.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos que coincidan con los filtros</td></tr>';

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('mayor');
}

/**
 * Mostrar contador de resultados filtrados Mayor
 */
function mostrarResultadoFiltrosMayor(mostrados, total) {
    const resultado = document.getElementById('filtrosMayorResultado');
    const spanMostrados = document.getElementById('filtrosMayorMostrados');
    const spanTotal = document.getElementById('filtrosMayorTotal');

    if (hayFiltrosActivosMayor()) {
        spanMostrados.textContent = mostrados;
        spanTotal.textContent = total;
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
    }
}

/**
 * Verificar si hay filtros activos en Mayor
 */
function hayFiltrosActivosMayor() {
    return filtrosMayor.fechaDesde ||
           filtrosMayor.fechaHasta ||
           (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) ||
           filtrosMayor.numeroAsiento ||
           filtrosMayor.leyenda ||
           filtrosMayor.ce !== 'todos' ||
           filtrosMayor.tipo !== 'todos';
}

/**
 * Mostrar badges de filtros activos Mayor
 */
function mostrarBadgesFiltrosMayor() {
    const container = document.getElementById('filtrosMayorActivos');
    let badges = '';

    if (filtrosMayor.fechaDesde) {
        badges += crearBadgeFiltro('Desde: ' + filtrosMayor.fechaDesde, 'mayor', 'fechaDesde');
    }
    if (filtrosMayor.fechaHasta) {
        badges += crearBadgeFiltro('Hasta: ' + filtrosMayor.fechaHasta, 'mayor', 'fechaHasta');
    }
    if (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) {
        let textoImporte = '';
        switch (filtrosMayor.importeTipo) {
            case 'mayor': textoImporte = `> $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'menor': textoImporte = `< $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'igual': textoImporte = `= $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'entre': textoImporte = `$${formatearNumero(filtrosMayor.importeValor)} - $${formatearNumero(filtrosMayor.importeValor2 || 0)}`; break;
        }
        badges += crearBadgeFiltro('Importe: ' + textoImporte, 'mayor', 'importe');
    }
    if (filtrosMayor.numeroAsiento) {
        badges += crearBadgeFiltro('Asiento: ' + filtrosMayor.numeroAsiento, 'mayor', 'numeroAsiento');
    }
    if (filtrosMayor.leyenda) {
        badges += crearBadgeFiltro('Leyenda: ' + truncar(filtrosMayor.leyenda, 20), 'mayor', 'leyenda');
    }
    if (filtrosMayor.ce !== 'todos') {
        badges += crearBadgeFiltro('C/E: ' + filtrosMayor.ce, 'mayor', 'ce');
    }
    if (filtrosMayor.tipo !== 'todos') {
        badges += crearBadgeFiltro('Tipo: ' + filtrosMayor.tipo, 'mayor', 'tipo');
    }

    container.innerHTML = badges;
    if (badges) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Crear HTML de un badge de filtro
 */
function crearBadgeFiltro(texto, seccion, campo) {
    return `
        <span class="filtro-badge">
            ${texto}
            <button class="filtro-badge-remove" onclick="removerFiltro('${seccion}', '${campo}')" title="Quitar filtro">✕</button>
        </span>
    `;
}

/**
 * Remover un filtro específico
 */
function removerFiltro(seccion, campo) {
    if (seccion === 'mayor') {
        switch (campo) {
            case 'fechaDesde':
                filtrosMayor.fechaDesde = null;
                document.getElementById('filtroMayorFechaDesde').value = '';
                break;
            case 'fechaHasta':
                filtrosMayor.fechaHasta = null;
                document.getElementById('filtroMayorFechaHasta').value = '';
                break;
            case 'importe':
                filtrosMayor.importeTipo = '';
                filtrosMayor.importeValor = null;
                filtrosMayor.importeValor2 = null;
                document.getElementById('filtroMayorImporteTipo').value = '';
                document.getElementById('filtroMayorImporteValor').value = '';
                document.getElementById('filtroMayorImporteValor2').value = '';
                document.getElementById('filtroMayorImporteValor2').classList.add('hidden');
                break;
            case 'numeroAsiento':
                filtrosMayor.numeroAsiento = '';
                document.getElementById('filtroMayorNumeroAsiento').value = '';
                break;
            case 'leyenda':
                filtrosMayor.leyenda = '';
                document.getElementById('filtroMayorLeyenda').value = '';
                break;
            case 'ce':
                filtrosMayor.ce = 'todos';
                document.getElementById('filtroMayorCE').value = 'todos';
                break;
            case 'tipo':
                filtrosMayor.tipo = 'todos';
                document.getElementById('filtroMayorTipo').value = 'todos';
                break;
        }
        aplicarFiltrosMayor();
    } else if (seccion === 'extracto') {
        switch (campo) {
            case 'fechaDesde':
                filtrosExtracto.fechaDesde = null;
                document.getElementById('filtroExtractoFechaDesde').value = '';
                break;
            case 'fechaHasta':
                filtrosExtracto.fechaHasta = null;
                document.getElementById('filtroExtractoFechaHasta').value = '';
                break;
            case 'importe':
                filtrosExtracto.importeTipo = '';
                filtrosExtracto.importeValor = null;
                filtrosExtracto.importeValor2 = null;
                document.getElementById('filtroExtractoImporteTipo').value = '';
                document.getElementById('filtroExtractoImporteValor').value = '';
                document.getElementById('filtroExtractoImporteValor2').value = '';
                document.getElementById('filtroExtractoImporteValor2').classList.add('hidden');
                break;
            case 'descripcion':
                filtrosExtracto.descripcion = '';
                document.getElementById('filtroExtractoDescripcion').value = '';
                break;
            case 'origen':
                filtrosExtracto.origen = '';
                document.getElementById('filtroExtractoOrigen').value = '';
                break;
        }
        aplicarFiltrosExtracto();
    } else if (seccion === 'conciliados') {
        switch (campo) {
            case 'fechaMayorDesde':
                filtrosConciliados.fechaMayorDesde = null;
                document.getElementById('filtroConciliadosMayorFechaDesde').value = '';
                break;
            case 'fechaMayorHasta':
                filtrosConciliados.fechaMayorHasta = null;
                document.getElementById('filtroConciliadosMayorFechaHasta').value = '';
                break;
            case 'numeroAsiento':
                filtrosConciliados.numeroAsiento = '';
                document.getElementById('filtroConciliadosNumeroAsiento').value = '';
                break;
            case 'leyenda':
                filtrosConciliados.leyenda = '';
                document.getElementById('filtroConciliadosLeyenda').value = '';
                break;
            case 'fechaExtractoDesde':
                filtrosConciliados.fechaExtractoDesde = null;
                document.getElementById('filtroConciliadosExtractoFechaDesde').value = '';
                break;
            case 'fechaExtractoHasta':
                filtrosConciliados.fechaExtractoHasta = null;
                document.getElementById('filtroConciliadosExtractoFechaHasta').value = '';
                break;
            case 'descripcion':
                filtrosConciliados.descripcion = '';
                document.getElementById('filtroConciliadosDescripcion').value = '';
                break;
            case 'origen':
                filtrosConciliados.origen = '';
                document.getElementById('filtroConciliadosOrigen').value = '';
                break;
            case 'importe':
                filtrosConciliados.importeTipo = '';
                filtrosConciliados.importeValor = null;
                filtrosConciliados.importeValor2 = null;
                document.getElementById('filtroConciliadosImporteTipo').value = '';
                document.getElementById('filtroConciliadosImporteValor').value = '';
                document.getElementById('filtroConciliadosImporteValor2').value = '';
                document.getElementById('filtroConciliadosImporteValor2').classList.add('hidden');
                break;
        }
        aplicarFiltrosConciliados();
    }
}

/**
 * Limpiar todos los filtros de Mayor
 */
function limpiarFiltrosMayor() {
    // Resetear estado
    filtrosMayor = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        numeroAsiento: '',
        leyenda: '',
        ce: 'todos',
        tipo: 'todos'
    };

    // Resetear inputs
    document.getElementById('filtroMayorFechaDesde').value = '';
    document.getElementById('filtroMayorFechaHasta').value = '';
    document.getElementById('filtroMayorImporteTipo').value = '';
    document.getElementById('filtroMayorImporteValor').value = '';
    document.getElementById('filtroMayorImporteValor2').value = '';
    document.getElementById('filtroMayorImporteValor2').classList.add('hidden');
    document.getElementById('filtroMayorNumeroAsiento').value = '';
    document.getElementById('filtroMayorLeyenda').value = '';
    document.getElementById('filtroMayorCE').value = 'todos';
    document.getElementById('filtroMayorTipo').value = 'todos';

    // Ocultar resultados y badges
    document.getElementById('filtrosMayorResultado').classList.add('hidden');
    document.getElementById('filtrosMayorActivos').classList.add('hidden');
    document.getElementById('filtrosMayorActivos').innerHTML = '';

    // Re-renderizar con todos los datos
    if (state.resultados) {
        llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    }
}

/**
 * Aplicar filtros a Extracto Pendiente
 */
function aplicarFiltrosExtracto() {
    if (!state.resultados) return;

    // Leer valores de los inputs
    filtrosExtracto.fechaDesde = document.getElementById('filtroExtractoFechaDesde').value || null;
    filtrosExtracto.fechaHasta = document.getElementById('filtroExtractoFechaHasta').value || null;
    filtrosExtracto.importeTipo = document.getElementById('filtroExtractoImporteTipo').value || '';
    filtrosExtracto.importeValor = parseFloat(document.getElementById('filtroExtractoImporteValor').value) || null;
    filtrosExtracto.importeValor2 = parseFloat(document.getElementById('filtroExtractoImporteValor2').value) || null;
    filtrosExtracto.descripcion = document.getElementById('filtroExtractoDescripcion').value.trim();
    filtrosExtracto.origen = document.getElementById('filtroExtractoOrigen').value.trim();

    // Aplicar filtros
    const original = state.resultados.extractoNoConciliado;
    extractoPendienteFiltrado = filtrarMovimientosExtracto(original);

    // Actualizar UI
    renderizarExtractoPendienteFiltrado();
    mostrarResultadoFiltrosExtracto(extractoPendienteFiltrado.length, original.length);
    mostrarBadgesFiltrosExtracto();
}

/**
 * Filtrar movimientos del Extracto según los filtros activos
 */
function filtrarMovimientosExtracto(movimientos) {
    return movimientos.filter(mov => {
        // Filtro fecha desde
        if (filtrosExtracto.fechaDesde) {
            const fechaDesde = new Date(filtrosExtracto.fechaDesde);
            if (mov.fecha < fechaDesde) return false;
        }

        // Filtro fecha hasta
        if (filtrosExtracto.fechaHasta) {
            const fechaHasta = new Date(filtrosExtracto.fechaHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            if (mov.fecha > fechaHasta) return false;
        }

        // Filtro importe
        const importe = mov.importe || mov.debito || mov.credito || 0;
        if (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) {
            switch (filtrosExtracto.importeTipo) {
                case 'mayor':
                    if (importe <= filtrosExtracto.importeValor) return false;
                    break;
                case 'menor':
                    if (importe >= filtrosExtracto.importeValor) return false;
                    break;
                case 'igual':
                    if (Math.abs(importe - filtrosExtracto.importeValor) > 0.01) return false;
                    break;
                case 'entre':
                    if (filtrosExtracto.importeValor2 !== null) {
                        if (importe < filtrosExtracto.importeValor || importe > filtrosExtracto.importeValor2) return false;
                    }
                    break;
            }
        }

        // Filtro descripción (búsqueda parcial, case insensitive)
        if (filtrosExtracto.descripcion) {
            if (!mov.descripcion.toLowerCase().includes(filtrosExtracto.descripcion.toLowerCase())) {
                return false;
            }
        }

        // Filtro origen (búsqueda parcial)
        if (filtrosExtracto.origen) {
            if (!String(mov.origen).toLowerCase().includes(filtrosExtracto.origen.toLowerCase())) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Renderizar tabla de Extracto Pendiente con datos filtrados
 */
function renderizarExtractoPendienteFiltrado() {
    let html = '';

    // Aplicar ordenamiento a los datos filtrados
    const pendientes = aplicarOrdenamiento(extractoPendienteFiltrado, 'extracto');

    pendientes.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos que coincidan con los filtros</td></tr>';

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('extracto');
}

/**
 * Mostrar contador de resultados filtrados Extracto
 */
function mostrarResultadoFiltrosExtracto(mostrados, total) {
    const resultado = document.getElementById('filtrosExtractoResultado');
    const spanMostrados = document.getElementById('filtrosExtractoMostrados');
    const spanTotal = document.getElementById('filtrosExtractoTotal');

    if (hayFiltrosActivosExtracto()) {
        spanMostrados.textContent = mostrados;
        spanTotal.textContent = total;
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
    }
}

/**
 * Verificar si hay filtros activos en Extracto
 */
function hayFiltrosActivosExtracto() {
    return filtrosExtracto.fechaDesde ||
           filtrosExtracto.fechaHasta ||
           (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) ||
           filtrosExtracto.descripcion ||
           filtrosExtracto.origen;
}

/**
 * Mostrar badges de filtros activos Extracto
 */
function mostrarBadgesFiltrosExtracto() {
    const container = document.getElementById('filtrosExtractoActivos');
    let badges = '';

    if (filtrosExtracto.fechaDesde) {
        badges += crearBadgeFiltro('Desde: ' + filtrosExtracto.fechaDesde, 'extracto', 'fechaDesde');
    }
    if (filtrosExtracto.fechaHasta) {
        badges += crearBadgeFiltro('Hasta: ' + filtrosExtracto.fechaHasta, 'extracto', 'fechaHasta');
    }
    if (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) {
        let textoImporte = '';
        switch (filtrosExtracto.importeTipo) {
            case 'mayor': textoImporte = `> $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'menor': textoImporte = `< $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'igual': textoImporte = `= $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'entre': textoImporte = `$${formatearNumero(filtrosExtracto.importeValor)} - $${formatearNumero(filtrosExtracto.importeValor2 || 0)}`; break;
        }
        badges += crearBadgeFiltro('Importe: ' + textoImporte, 'extracto', 'importe');
    }
    if (filtrosExtracto.descripcion) {
        badges += crearBadgeFiltro('Descripción: ' + truncar(filtrosExtracto.descripcion, 20), 'extracto', 'descripcion');
    }
    if (filtrosExtracto.origen) {
        badges += crearBadgeFiltro('Origen: ' + filtrosExtracto.origen, 'extracto', 'origen');
    }

    container.innerHTML = badges;
    if (badges) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Limpiar todos los filtros de Extracto
 */
function limpiarFiltrosExtracto() {
    // Resetear estado
    filtrosExtracto = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        descripcion: '',
        origen: ''
    };

    // Resetear inputs
    document.getElementById('filtroExtractoFechaDesde').value = '';
    document.getElementById('filtroExtractoFechaHasta').value = '';
    document.getElementById('filtroExtractoImporteTipo').value = '';
    document.getElementById('filtroExtractoImporteValor').value = '';
    document.getElementById('filtroExtractoImporteValor2').value = '';
    document.getElementById('filtroExtractoImporteValor2').classList.add('hidden');
    document.getElementById('filtroExtractoDescripcion').value = '';
    document.getElementById('filtroExtractoOrigen').value = '';

    // Ocultar resultados y badges
    document.getElementById('filtrosExtractoResultado').classList.add('hidden');
    document.getElementById('filtrosExtractoActivos').classList.add('hidden');
    document.getElementById('filtrosExtractoActivos').innerHTML = '';

    // Re-renderizar con todos los datos
    if (state.resultados) {
        llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    }
}

// ========== FILTROS CONCILIADOS ==========

/**
 * Aplicar filtros a Conciliados
 */
function aplicarFiltrosConciliados() {
    if (!state.resultados) return;

    // Leer valores de los inputs - Mayor
    filtrosConciliados.fechaMayorDesde = document.getElementById('filtroConciliadosMayorFechaDesde').value || null;
    filtrosConciliados.fechaMayorHasta = document.getElementById('filtroConciliadosMayorFechaHasta').value || null;
    filtrosConciliados.numeroAsiento = document.getElementById('filtroConciliadosNumeroAsiento').value.trim();
    filtrosConciliados.leyenda = document.getElementById('filtroConciliadosLeyenda').value.trim();

    // Leer valores de los inputs - Extracto
    filtrosConciliados.fechaExtractoDesde = document.getElementById('filtroConciliadosExtractoFechaDesde').value || null;
    filtrosConciliados.fechaExtractoHasta = document.getElementById('filtroConciliadosExtractoFechaHasta').value || null;
    filtrosConciliados.descripcion = document.getElementById('filtroConciliadosDescripcion').value.trim();
    filtrosConciliados.origen = document.getElementById('filtroConciliadosOrigen').value.trim();

    // Leer valores de los inputs - Importe
    filtrosConciliados.importeTipo = document.getElementById('filtroConciliadosImporteTipo').value || '';
    filtrosConciliados.importeValor = parseFloat(document.getElementById('filtroConciliadosImporteValor').value) || null;
    filtrosConciliados.importeValor2 = parseFloat(document.getElementById('filtroConciliadosImporteValor2').value) || null;

    // Aplicar filtros
    const original = state.resultados.conciliados;
    conciliadosFiltrado = filtrarConciliados(original);

    // Actualizar UI
    renderizarConciliadosFiltrado();
    mostrarResultadoFiltrosConciliados(conciliadosFiltrado.length, original.length);
    mostrarBadgesFiltrosConciliados();
}

/**
 * Filtrar conciliaciones según los filtros activos
 */
function filtrarConciliados(conciliaciones) {
    return conciliaciones.filter(match => {
        // Filtros para Mayor - se aplican a cualquier movimiento del grupo mayor
        const mayorMovs = match.mayor || [];

        // Filtro fecha Mayor desde
        if (filtrosConciliados.fechaMayorDesde) {
            const fechaDesde = new Date(filtrosConciliados.fechaMayorDesde);
            const algunoEnRango = mayorMovs.some(m => m.fecha >= fechaDesde);
            if (!algunoEnRango) return false;
        }

        // Filtro fecha Mayor hasta
        if (filtrosConciliados.fechaMayorHasta) {
            const fechaHasta = new Date(filtrosConciliados.fechaMayorHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            const algunoEnRango = mayorMovs.some(m => m.fecha <= fechaHasta);
            if (!algunoEnRango) return false;
        }

        // Filtro número de asiento (búsqueda parcial)
        if (filtrosConciliados.numeroAsiento) {
            const algunoCoincide = mayorMovs.some(m =>
                String(m.numeroAsiento).toLowerCase().includes(filtrosConciliados.numeroAsiento.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtro leyenda (búsqueda parcial, case insensitive)
        if (filtrosConciliados.leyenda) {
            const algunoCoincide = mayorMovs.some(m =>
                m.leyenda && m.leyenda.toLowerCase().includes(filtrosConciliados.leyenda.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtros para Extracto - se aplican a cualquier movimiento del grupo extracto
        const extractoMovs = match.extracto || [];

        // Filtro fecha Extracto desde
        if (filtrosConciliados.fechaExtractoDesde) {
            const fechaDesde = new Date(filtrosConciliados.fechaExtractoDesde);
            const algunoEnRango = extractoMovs.some(e => e.fecha >= fechaDesde);
            if (!algunoEnRango) return false;
        }

        // Filtro fecha Extracto hasta
        if (filtrosConciliados.fechaExtractoHasta) {
            const fechaHasta = new Date(filtrosConciliados.fechaExtractoHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            const algunoEnRango = extractoMovs.some(e => e.fecha <= fechaHasta);
            if (!algunoEnRango) return false;
        }

        // Filtro descripción (búsqueda parcial, case insensitive)
        if (filtrosConciliados.descripcion) {
            const algunoCoincide = extractoMovs.some(e =>
                e.descripcion && e.descripcion.toLowerCase().includes(filtrosConciliados.descripcion.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtro origen (búsqueda parcial)
        if (filtrosConciliados.origen) {
            const algunoCoincide = extractoMovs.some(e =>
                String(e.origen).toLowerCase().includes(filtrosConciliados.origen.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtro importe - busca en los importes de mayor y extracto
        if (filtrosConciliados.importeTipo && filtrosConciliados.importeValor !== null) {
            // Obtener todos los importes del match
            const importesMayor = mayorMovs.map(m => m.importe || 0);
            const importesExtracto = extractoMovs.map(e => e.importe || 0);
            const todosImportes = [...importesMayor, ...importesExtracto];

            let algunoCumple = false;
            for (const importe of todosImportes) {
                switch (filtrosConciliados.importeTipo) {
                    case 'mayor':
                        if (importe > filtrosConciliados.importeValor) algunoCumple = true;
                        break;
                    case 'menor':
                        if (importe < filtrosConciliados.importeValor) algunoCumple = true;
                        break;
                    case 'igual':
                        if (Math.abs(importe - filtrosConciliados.importeValor) <= 0.01) algunoCumple = true;
                        break;
                    case 'entre':
                        if (filtrosConciliados.importeValor2 !== null) {
                            if (importe >= filtrosConciliados.importeValor && importe <= filtrosConciliados.importeValor2) algunoCumple = true;
                        }
                        break;
                }
                if (algunoCumple) break;
            }
            if (!algunoCumple) return false;
        }

        return true;
    });
}

/**
 * Renderizar tabla de Conciliados con datos filtrados
 */
function renderizarConciliadosFiltrado() {
    let html = '';

    // Ordenar por color: verdes (con coincidencia) arriba, naranjas (sin coincidencia) abajo
    const conciliadosOrdenados = [...conciliadosFiltrado].sort((a, b) => {
        const tieneCoincidenciaA = a.coincidenciaOverride !== undefined
            ? a.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(a);
        const tieneCoincidenciaB = b.coincidenciaOverride !== undefined
            ? b.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(b);

        // Verdes (true) primero, naranjas (false) después
        if (tieneCoincidenciaA === tieneCoincidenciaB) return 0;
        return tieneCoincidenciaA ? -1 : 1;
    });

    conciliadosOrdenados.forEach((match, idx) => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);

        // Determinar clase según coincidencia de descripción
        const tieneCoincidencia = match.coincidenciaOverride !== undefined
            ? match.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(match);
        const coincidenciaClass = tieneCoincidencia ? ' row-coincidencia-descripcion' : ' row-sin-coincidencia';
        const isSelected = seleccionConciliados.includes(String(match.id));
        const selectedClass = isSelected ? ' row-conciliado-selected' : '';

        for (let i = 0; i < maxRows; i++) {
            const m = match.mayor[i];
            const e = match.extracto[i];
            const isFirst = i === 0;
            const isSubRow = i > 0;
            const manualClass = match.manual ? ' row-manual' : '';

            html += `<tr class="${isFirst ? 'match-group' : 'sub-row'}${manualClass}${coincidenciaClass}${selectedClass}" data-conciliacion-id="${match.id}">`;

            // Checkbox de selección (solo en primera fila)
            if (isFirst) {
                const checked = isSelected ? 'checked' : '';
                html += `<td class="col-checkbox" rowspan="${maxRows}">
                    <input type="checkbox" class="checkbox-conciliado" data-id="${match.id}" ${checked} onchange="toggleSeleccionConciliado('${match.id}', this.checked)">
                </td>`;
            }

            // Columnas Mayor
            if (m) {
                html += `
                    <td class="col-fecha">${formatearFecha(m.fecha)}</td>
                    <td class="col-numero">${m.numeroAsiento}</td>
                    <td class="col-leyenda" title="${m.leyenda}">${truncar(m.leyenda, 30)}</td>
                    <td class="col-importe">${formatearNumero(m.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-numero"></td><td class="col-leyenda"></td><td class="col-importe"></td>';
            }

            // Separador
            html += '<td class="separator"></td>';

            // Columnas Extracto
            if (e) {
                html += `
                    <td class="col-fecha">${formatearFecha(e.fecha)}</td>
                    <td class="col-descripcion" title="${e.descripcion}">${truncar(e.descripcion, 25)}</td>
                    <td class="col-origen">${e.origen}</td>
                    <td class="col-importe">${formatearNumero(e.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-descripcion"></td><td class="col-origen"></td><td class="col-importe"></td>';
            }

            // Diferencia (solo en primera fila)
            if (isFirst) {
                const colorClass = match.diferencia > 0 ? 'text-red' : 'text-green';
                html += `<td class="col-diferencia ${colorClass}">${match.diferencia > 0 ? formatearNumero(match.diferencia) : '-'}</td>`;
            } else {
                html += '<td class="col-diferencia"></td>';
            }

            // Botón de acción (solo en primera fila)
            if (isFirst) {
                const manualBadge = match.manual ? '<span class="badge-manual">Manual</span>' : '';
                let reprocesoBadge = '';
                if (match.reproceso && match.parametrosReproceso) {
                    const tooltipText = `Reproceso #${match.parametrosReproceso.numeroReproceso}: ${match.parametrosReproceso.toleranciaFecha} días, $${match.parametrosReproceso.toleranciaImporte.toLocaleString('es-AR')}`;
                    reprocesoBadge = `<span class="badge-reproceso" title="${tooltipText}">🔄 Rep</span>`;
                }
                // Botón para cambiar categoría de color (verde/naranja)
                const colorBtnIcon = tieneCoincidencia ? '🟢' : '🟠';
                const colorBtnTitle = tieneCoincidencia
                    ? 'Marcar como sin coincidencia (naranja)'
                    : 'Marcar como con coincidencia (verde)';
                html += `
                    <td class="col-action">
                        ${manualBadge}${reprocesoBadge}
                        <button class="btn-toggle-color" onmousedown="preBloquearToggle(event)" onclick="toggleColorConciliacion('${match.id}', event)" title="${colorBtnTitle}">
                            ${colorBtnIcon}
                        </button>
                        <button class="btn-desconciliar" onclick="desconciliar('${match.id}')" title="Desconciliar">
                            ✕
                        </button>
                    </td>
                `;
            } else {
                html += '<td class="col-action"></td>';
            }

            html += '</tr>';
        }
    });

    elements.tablaConciliados.innerHTML = html || '<tr><td colspan="12" class="text-muted" style="text-align:center;padding:20px;">No hay conciliaciones que coincidan con los filtros</td></tr>';

    // Actualizar contador en tab
    const countTab = document.getElementById('countConciliadosTab');
    if (countTab) {
        countTab.textContent = `(${conciliadosFiltrado.length})`;
    }

    // Actualizar estado del checkbox "seleccionar todos" y botón de cambio masivo
    actualizarCheckboxSeleccionarTodosConciliados();
    actualizarBotonCambioColorMasivo();
}

/**
 * Mostrar contador de resultados filtrados Conciliados
 */
function mostrarResultadoFiltrosConciliados(mostrados, total) {
    const resultado = document.getElementById('filtrosConciliadosResultado');
    const spanMostrados = document.getElementById('filtrosConciliadosMostrados');
    const spanTotal = document.getElementById('filtrosConciliadosTotal');

    if (hayFiltrosActivosConciliados()) {
        spanMostrados.textContent = mostrados;
        spanTotal.textContent = total;
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
    }
}

/**
 * Verificar si hay filtros activos en Conciliados
 */
function hayFiltrosActivosConciliados() {
    return filtrosConciliados.fechaMayorDesde ||
           filtrosConciliados.fechaMayorHasta ||
           filtrosConciliados.numeroAsiento ||
           filtrosConciliados.leyenda ||
           filtrosConciliados.fechaExtractoDesde ||
           filtrosConciliados.fechaExtractoHasta ||
           filtrosConciliados.descripcion ||
           filtrosConciliados.origen ||
           (filtrosConciliados.importeTipo && filtrosConciliados.importeValor !== null);
}

/**
 * Mostrar badges de filtros activos Conciliados
 */
function mostrarBadgesFiltrosConciliados() {
    const container = document.getElementById('filtrosConciliadosActivos');
    let badges = '';

    // Badges de Mayor
    if (filtrosConciliados.fechaMayorDesde) {
        badges += crearBadgeFiltro('Mayor desde: ' + filtrosConciliados.fechaMayorDesde, 'conciliados', 'fechaMayorDesde');
    }
    if (filtrosConciliados.fechaMayorHasta) {
        badges += crearBadgeFiltro('Mayor hasta: ' + filtrosConciliados.fechaMayorHasta, 'conciliados', 'fechaMayorHasta');
    }
    if (filtrosConciliados.numeroAsiento) {
        badges += crearBadgeFiltro('Asiento: ' + filtrosConciliados.numeroAsiento, 'conciliados', 'numeroAsiento');
    }
    if (filtrosConciliados.leyenda) {
        badges += crearBadgeFiltro('Leyenda: ' + truncar(filtrosConciliados.leyenda, 20), 'conciliados', 'leyenda');
    }

    // Badges de Extracto
    if (filtrosConciliados.fechaExtractoDesde) {
        badges += crearBadgeFiltro('Extracto desde: ' + filtrosConciliados.fechaExtractoDesde, 'conciliados', 'fechaExtractoDesde');
    }
    if (filtrosConciliados.fechaExtractoHasta) {
        badges += crearBadgeFiltro('Extracto hasta: ' + filtrosConciliados.fechaExtractoHasta, 'conciliados', 'fechaExtractoHasta');
    }
    if (filtrosConciliados.descripcion) {
        badges += crearBadgeFiltro('Descripción: ' + truncar(filtrosConciliados.descripcion, 20), 'conciliados', 'descripcion');
    }
    if (filtrosConciliados.origen) {
        badges += crearBadgeFiltro('Origen: ' + filtrosConciliados.origen, 'conciliados', 'origen');
    }

    // Badge de importe
    if (filtrosConciliados.importeTipo && filtrosConciliados.importeValor !== null) {
        let textoImporte = '';
        switch (filtrosConciliados.importeTipo) {
            case 'mayor': textoImporte = `> $${formatearNumero(filtrosConciliados.importeValor)}`; break;
            case 'menor': textoImporte = `< $${formatearNumero(filtrosConciliados.importeValor)}`; break;
            case 'igual': textoImporte = `= $${formatearNumero(filtrosConciliados.importeValor)}`; break;
            case 'entre': textoImporte = `$${formatearNumero(filtrosConciliados.importeValor)} - $${formatearNumero(filtrosConciliados.importeValor2 || 0)}`; break;
        }
        badges += crearBadgeFiltro('Importe: ' + textoImporte, 'conciliados', 'importe');
    }

    container.innerHTML = badges;
    if (badges) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Limpiar todos los filtros de Conciliados
 */
function limpiarFiltrosConciliados() {
    // Resetear estado
    filtrosConciliados = {
        fechaMayorDesde: null,
        fechaMayorHasta: null,
        numeroAsiento: '',
        leyenda: '',
        fechaExtractoDesde: null,
        fechaExtractoHasta: null,
        descripcion: '',
        origen: '',
        importeTipo: '',
        importeValor: null,
        importeValor2: null
    };

    // Resetear inputs - Mayor
    document.getElementById('filtroConciliadosMayorFechaDesde').value = '';
    document.getElementById('filtroConciliadosMayorFechaHasta').value = '';
    document.getElementById('filtroConciliadosNumeroAsiento').value = '';
    document.getElementById('filtroConciliadosLeyenda').value = '';

    // Resetear inputs - Extracto
    document.getElementById('filtroConciliadosExtractoFechaDesde').value = '';
    document.getElementById('filtroConciliadosExtractoFechaHasta').value = '';
    document.getElementById('filtroConciliadosDescripcion').value = '';
    document.getElementById('filtroConciliadosOrigen').value = '';

    // Resetear inputs - Importe
    document.getElementById('filtroConciliadosImporteTipo').value = '';
    document.getElementById('filtroConciliadosImporteValor').value = '';
    document.getElementById('filtroConciliadosImporteValor2').value = '';
    document.getElementById('filtroConciliadosImporteValor2').classList.add('hidden');

    // Ocultar resultados y badges
    document.getElementById('filtrosConciliadosResultado').classList.add('hidden');
    document.getElementById('filtrosConciliadosActivos').classList.add('hidden');
    document.getElementById('filtrosConciliadosActivos').innerHTML = '';

    // Re-renderizar con todos los datos
    if (state.resultados) {
        llenarTablaConciliados(state.resultados.conciliados);
        // Actualizar contador
        const countTab = document.getElementById('countConciliadosTab');
        if (countTab) {
            countTab.textContent = `(${state.resultados.conciliados.length})`;
        }
    }
}

// ========== TOGGLE DE GRUPOS VERDES/NARANJAS ==========

/**
 * Toggle visibilidad del grupo de conciliados verdes
 */
function toggleGrupoVerdes(event) {
    // Detener propagación si hay evento
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Verificar si el click fue marcado para ignorar en mousedown
    if (event && event.target && event.target.dataset.ignorarClick === 'true') {
        console.log('toggleGrupoVerdes IGNORADO - marcado en mousedown');
        event.target.dataset.ignorarClick = '';
        return;
    }

    // Verificar si estamos bloqueados por un cambio de color en progreso
    if (bloqueandoToggleGrupos) {
        console.log('toggleGrupoVerdes BLOQUEADO - cambio de color en progreso');
        return;
    }

    console.log('toggleGrupoVerdes llamado, estado actual:', gruposConciliados.verdesVisible);
    gruposConciliados.verdesVisible = !gruposConciliados.verdesVisible;
    console.log('nuevo estado verdes:', gruposConciliados.verdesVisible);
    actualizarVistaGruposConciliados();
}

/**
 * Toggle visibilidad del grupo de conciliados naranjas
 */
function toggleGrupoNaranjas(event) {
    // Detener propagación si hay evento
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Verificar si el click fue marcado para ignorar en mousedown
    if (event && event.target && event.target.dataset.ignorarClick === 'true') {
        console.log('toggleGrupoNaranjas IGNORADO - marcado en mousedown');
        event.target.dataset.ignorarClick = '';
        return;
    }

    // Verificar si estamos bloqueados por un cambio de color en progreso
    if (bloqueandoToggleGrupos) {
        console.log('toggleGrupoNaranjas BLOQUEADO - cambio de color en progreso');
        return;
    }

    console.log('toggleGrupoNaranjas llamado, estado actual:', gruposConciliados.naranjasVisible);
    gruposConciliados.naranjasVisible = !gruposConciliados.naranjasVisible;
    console.log('nuevo estado naranjas:', gruposConciliados.naranjasVisible);
    actualizarVistaGruposConciliados();
}

/**
 * Actualiza la UI después de cambiar la visibilidad de grupos
 */
function actualizarVistaGruposConciliados() {
    console.log('actualizarVistaGruposConciliados - verdes:', gruposConciliados.verdesVisible, 'naranjas:', gruposConciliados.naranjasVisible);

    // Actualizar botones de toggle
    const btnVerdes = document.getElementById('btnToggleVerdes');
    const btnNaranjas = document.getElementById('btnToggleNaranjas');

    if (btnVerdes) {
        btnVerdes.innerHTML = gruposConciliados.verdesVisible
            ? '🟢 Ocultar verdes'
            : '🟢 Mostrar verdes';
        btnVerdes.classList.toggle('btn-toggle-oculto', !gruposConciliados.verdesVisible);
    }

    if (btnNaranjas) {
        btnNaranjas.innerHTML = gruposConciliados.naranjasVisible
            ? '🟠 Ocultar naranjas'
            : '🟠 Mostrar naranjas';
        btnNaranjas.classList.toggle('btn-toggle-oculto', !gruposConciliados.naranjasVisible);
    }

    // Actualizar visibilidad de secciones usando style.display directamente para mayor confiabilidad
    const seccionVerdes = document.getElementById('seccion-conciliados-verdes');
    const seccionNaranjas = document.getElementById('seccion-conciliados-naranjas');

    if (seccionVerdes) {
        if (gruposConciliados.verdesVisible) {
            seccionVerdes.classList.remove('hidden');
            seccionVerdes.style.display = '';
        } else {
            seccionVerdes.classList.add('hidden');
            seccionVerdes.style.display = 'none';
        }
        console.log('seccionVerdes display:', seccionVerdes.style.display, 'hidden class:', seccionVerdes.classList.contains('hidden'));
    }

    if (seccionNaranjas) {
        if (gruposConciliados.naranjasVisible) {
            seccionNaranjas.classList.remove('hidden');
            seccionNaranjas.style.display = '';
        } else {
            seccionNaranjas.classList.add('hidden');
            seccionNaranjas.style.display = 'none';
        }
        console.log('seccionNaranjas display:', seccionNaranjas.style.display, 'hidden class:', seccionNaranjas.classList.contains('hidden'));
    }

    // Actualizar contadores en los botones
    actualizarContadoresGrupos();
}

/**
 * Actualiza los contadores de cada grupo
 */
function actualizarContadoresGrupos() {
    if (!state.resultados) return;

    const conciliados = state.resultados.conciliados;
    let countVerdes = 0;
    let countNaranjas = 0;

    conciliados.forEach(match => {
        const tieneCoincidencia = match.coincidenciaOverride !== undefined
            ? match.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(match);
        if (tieneCoincidencia) {
            countVerdes++;
        } else {
            countNaranjas++;
        }
    });

    // Actualizar contadores en headers
    const countVerdesEl = document.getElementById('countVerdesFiltrados');
    const countNaranjasEl = document.getElementById('countNaranjasFiltrados');

    if (countVerdesEl) countVerdesEl.textContent = `(${countVerdes})`;
    if (countNaranjasEl) countNaranjasEl.textContent = `(${countNaranjas})`;
}

// ========== FILTROS SEPARADOS VERDES/NARANJAS ==========

/**
 * Toggle panel de filtros para grupo específico
 */
function toggleFiltrosGrupo(grupo) {
    const panelId = grupo === 'verdes' ? 'filtros-conciliados-verdes' : 'filtros-conciliados-naranjas';
    const btnId = grupo === 'verdes' ? 'btnFiltrosVerdes' : 'btnFiltrosNaranjas';

    const panel = document.getElementById(panelId);
    const btn = document.getElementById(btnId);

    if (panel && btn) {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        btn.innerHTML = isHidden ? '🔍 Filtros ▲' : '🔍 Filtros ▼';
    }
}

/**
 * Aplicar filtros al grupo de conciliados verdes
 */
function aplicarFiltrosVerdes() {
    // Leer valores de los inputs
    filtrosConciliadosVerdes.fechaMayorDesde = document.getElementById('filtroVerdesMayorFechaDesde')?.value || null;
    filtrosConciliadosVerdes.fechaMayorHasta = document.getElementById('filtroVerdesMayorFechaHasta')?.value || null;
    filtrosConciliadosVerdes.numeroAsiento = document.getElementById('filtroVerdesNumeroAsiento')?.value.trim() || '';
    filtrosConciliadosVerdes.leyenda = document.getElementById('filtroVerdesLeyenda')?.value.trim() || '';
    filtrosConciliadosVerdes.fechaExtractoDesde = document.getElementById('filtroVerdesExtractoFechaDesde')?.value || null;
    filtrosConciliadosVerdes.fechaExtractoHasta = document.getElementById('filtroVerdesExtractoFechaHasta')?.value || null;
    filtrosConciliadosVerdes.descripcion = document.getElementById('filtroVerdesDescripcion')?.value.trim() || '';
    filtrosConciliadosVerdes.origen = document.getElementById('filtroVerdesOrigen')?.value.trim() || '';
    filtrosConciliadosVerdes.importeTipo = document.getElementById('filtroVerdesImporteTipo')?.value || '';
    filtrosConciliadosVerdes.importeValor = parseFloat(document.getElementById('filtroVerdesImporteValor')?.value) || null;
    filtrosConciliadosVerdes.importeValor2 = parseFloat(document.getElementById('filtroVerdesImporteValor2')?.value) || null;
    filtrosConciliadosVerdes.tipoConciliacion = document.getElementById('filtroVerdesTipoConciliacion')?.value || '';

    renderizarConciliadosPorGrupos();
}

/**
 * Aplicar filtros al grupo de conciliados naranjas
 */
function aplicarFiltrosNaranjas() {
    // Leer valores de los inputs
    filtrosConciliadosNaranjas.fechaMayorDesde = document.getElementById('filtroNaranjasMayorFechaDesde')?.value || null;
    filtrosConciliadosNaranjas.fechaMayorHasta = document.getElementById('filtroNaranjasMayorFechaHasta')?.value || null;
    filtrosConciliadosNaranjas.numeroAsiento = document.getElementById('filtroNaranjasNumeroAsiento')?.value.trim() || '';
    filtrosConciliadosNaranjas.leyenda = document.getElementById('filtroNaranjasLeyenda')?.value.trim() || '';
    filtrosConciliadosNaranjas.fechaExtractoDesde = document.getElementById('filtroNaranjasExtractoFechaDesde')?.value || null;
    filtrosConciliadosNaranjas.fechaExtractoHasta = document.getElementById('filtroNaranjasExtractoFechaHasta')?.value || null;
    filtrosConciliadosNaranjas.descripcion = document.getElementById('filtroNaranjasDescripcion')?.value.trim() || '';
    filtrosConciliadosNaranjas.origen = document.getElementById('filtroNaranjasOrigen')?.value.trim() || '';
    filtrosConciliadosNaranjas.importeTipo = document.getElementById('filtroNaranjasImporteTipo')?.value || '';
    filtrosConciliadosNaranjas.importeValor = parseFloat(document.getElementById('filtroNaranjasImporteValor')?.value) || null;
    filtrosConciliadosNaranjas.importeValor2 = parseFloat(document.getElementById('filtroNaranjasImporteValor2')?.value) || null;
    filtrosConciliadosNaranjas.tipoConciliacion = document.getElementById('filtroNaranjasTipoConciliacion')?.value || '';

    renderizarConciliadosPorGrupos();
}

/**
 * Limpiar filtros del grupo verdes
 */
function limpiarFiltrosVerdes() {
    filtrosConciliadosVerdes = {
        fechaMayorDesde: null,
        fechaMayorHasta: null,
        numeroAsiento: '',
        leyenda: '',
        fechaExtractoDesde: null,
        fechaExtractoHasta: null,
        descripcion: '',
        origen: '',
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        tipoConciliacion: ''
    };

    // Resetear inputs
    const inputs = ['filtroVerdesMayorFechaDesde', 'filtroVerdesMayorFechaHasta', 'filtroVerdesNumeroAsiento',
                   'filtroVerdesLeyenda', 'filtroVerdesExtractoFechaDesde', 'filtroVerdesExtractoFechaHasta',
                   'filtroVerdesDescripcion', 'filtroVerdesOrigen', 'filtroVerdesImporteTipo',
                   'filtroVerdesImporteValor', 'filtroVerdesImporteValor2', 'filtroVerdesTipoConciliacion'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const importeValor2 = document.getElementById('filtroVerdesImporteValor2');
    if (importeValor2) importeValor2.classList.add('hidden');

    renderizarConciliadosPorGrupos();
}

/**
 * Limpiar filtros del grupo naranjas
 */
function limpiarFiltrosNaranjas() {
    filtrosConciliadosNaranjas = {
        fechaMayorDesde: null,
        fechaMayorHasta: null,
        numeroAsiento: '',
        leyenda: '',
        fechaExtractoDesde: null,
        fechaExtractoHasta: null,
        descripcion: '',
        origen: '',
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        tipoConciliacion: ''
    };

    // Resetear inputs
    const inputs = ['filtroNaranjasMayorFechaDesde', 'filtroNaranjasMayorFechaHasta', 'filtroNaranjasNumeroAsiento',
                   'filtroNaranjasLeyenda', 'filtroNaranjasExtractoFechaDesde', 'filtroNaranjasExtractoFechaHasta',
                   'filtroNaranjasDescripcion', 'filtroNaranjasOrigen', 'filtroNaranjasImporteTipo',
                   'filtroNaranjasImporteValor', 'filtroNaranjasImporteValor2', 'filtroNaranjasTipoConciliacion'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const importeValor2 = document.getElementById('filtroNaranjasImporteValor2');
    if (importeValor2) importeValor2.classList.add('hidden');

    renderizarConciliadosPorGrupos();
}

/**
 * Filtrar conciliaciones por grupo con filtros específicos
 */
function filtrarConciliadosGrupo(conciliaciones, filtros) {
    return conciliaciones.filter(match => {
        // Filtro por tipo de conciliación (1:1, 1:N, N:1)
        if (filtros.tipoConciliacion) {
            if (filtros.tipoConciliacion === '1:1') {
                if (match.mayor.length !== 1 || match.extracto.length !== 1) return false;
            } else if (filtros.tipoConciliacion === '1:N') {
                if (match.mayor.length !== 1 || match.extracto.length <= 1) return false;
            } else if (filtros.tipoConciliacion === 'N:1') {
                if (match.mayor.length <= 1 || match.extracto.length !== 1) return false;
            } else if (filtros.tipoConciliacion === 'multiple') {
                // 1:N o N:1
                if (match.mayor.length === 1 && match.extracto.length === 1) return false;
            }
        }

        // Filtros para Mayor
        const mayorMovs = match.mayor || [];

        if (filtros.fechaMayorDesde) {
            const fechaDesde = new Date(filtros.fechaMayorDesde);
            const algunoEnRango = mayorMovs.some(m => m.fecha >= fechaDesde);
            if (!algunoEnRango) return false;
        }

        if (filtros.fechaMayorHasta) {
            const fechaHasta = new Date(filtros.fechaMayorHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            const algunoEnRango = mayorMovs.some(m => m.fecha <= fechaHasta);
            if (!algunoEnRango) return false;
        }

        if (filtros.numeroAsiento) {
            const algunoCoincide = mayorMovs.some(m =>
                String(m.numeroAsiento).toLowerCase().includes(filtros.numeroAsiento.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        if (filtros.leyenda) {
            const algunoCoincide = mayorMovs.some(m =>
                m.leyenda && m.leyenda.toLowerCase().includes(filtros.leyenda.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtros para Extracto
        const extractoMovs = match.extracto || [];

        if (filtros.fechaExtractoDesde) {
            const fechaDesde = new Date(filtros.fechaExtractoDesde);
            const algunoEnRango = extractoMovs.some(e => e.fecha >= fechaDesde);
            if (!algunoEnRango) return false;
        }

        if (filtros.fechaExtractoHasta) {
            const fechaHasta = new Date(filtros.fechaExtractoHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            const algunoEnRango = extractoMovs.some(e => e.fecha <= fechaHasta);
            if (!algunoEnRango) return false;
        }

        if (filtros.descripcion) {
            const algunoCoincide = extractoMovs.some(e =>
                e.descripcion && e.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        if (filtros.origen) {
            const algunoCoincide = extractoMovs.some(e =>
                String(e.origen).toLowerCase().includes(filtros.origen.toLowerCase())
            );
            if (!algunoCoincide) return false;
        }

        // Filtro importe
        if (filtros.importeTipo && filtros.importeValor !== null) {
            const importesMayor = mayorMovs.map(m => m.importe || 0);
            const importesExtracto = extractoMovs.map(e => e.importe || 0);
            const todosImportes = [...importesMayor, ...importesExtracto];

            let algunoCumple = false;
            for (const importe of todosImportes) {
                switch (filtros.importeTipo) {
                    case 'mayor':
                        if (importe > filtros.importeValor) algunoCumple = true;
                        break;
                    case 'menor':
                        if (importe < filtros.importeValor) algunoCumple = true;
                        break;
                    case 'igual':
                        if (Math.abs(importe - filtros.importeValor) <= 0.01) algunoCumple = true;
                        break;
                    case 'entre':
                        if (filtros.importeValor2 !== null) {
                            if (importe >= filtros.importeValor && importe <= filtros.importeValor2) algunoCumple = true;
                        }
                        break;
                }
                if (algunoCumple) break;
            }
            if (!algunoCumple) return false;
        }

        return true;
    });
}

/**
 * Toggle para mostrar segundo campo de importe (entre)
 */
function toggleSegundoImporteGrupo(grupo) {
    const tipoId = grupo === 'verdes' ? 'filtroVerdesImporteTipo' : 'filtroNaranjasImporteTipo';
    const valor2Id = grupo === 'verdes' ? 'filtroVerdesImporteValor2' : 'filtroNaranjasImporteValor2';

    const tipo = document.getElementById(tipoId);
    const valor2 = document.getElementById(valor2Id);

    if (tipo && valor2) {
        if (tipo.value === 'entre') {
            valor2.classList.remove('hidden');
        } else {
            valor2.classList.add('hidden');
        }
    }
}

/**
 * Renderizar conciliados separados por grupos (verdes/naranjas)
 */
function renderizarConciliadosPorGrupos() {
    if (!state.resultados) return;

    const conciliados = state.resultados.conciliados;

    // Separar en verdes y naranjas
    const verdes = [];
    const naranjas = [];

    conciliados.forEach(match => {
        const tieneCoincidencia = match.coincidenciaOverride !== undefined
            ? match.coincidenciaOverride
            : matchTieneCoincidenciaDescripcion(match);
        if (tieneCoincidencia) {
            verdes.push(match);
        } else {
            naranjas.push(match);
        }
    });

    // Aplicar filtros a cada grupo
    const verdesFiltrados = filtrarConciliadosGrupo(verdes, filtrosConciliadosVerdes);
    const naranjasFiltrados = filtrarConciliadosGrupo(naranjas, filtrosConciliadosNaranjas);

    // Renderizar cada grupo
    renderizarGrupoConciliados('verdes', verdesFiltrados, verdes.length);
    renderizarGrupoConciliados('naranjas', naranjasFiltrados, naranjas.length);

    // Actualizar contadores
    actualizarContadoresGrupos();

    // Actualizar visibilidad de secciones y botones
    actualizarVistaGruposConciliados();

    // Actualizar contador total (suma de movimientos del mayor y extracto)
    const countTab = document.getElementById('countConciliadosTab');
    if (countTab) {
        const totalMovimientos = conciliados.reduce((sum, c) => sum + c.mayor.length + c.extracto.length, 0);
        countTab.textContent = `(${totalMovimientos})`;
    }
}

/**
 * Renderizar tabla de un grupo específico de conciliados
 */
function renderizarGrupoConciliados(grupo, conciliadosFiltrados, totalOriginal) {
    const tablaId = grupo === 'verdes' ? 'tablaConciliadosVerdes' : 'tablaConciliadosNaranjas';
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;

    let html = '';
    const coincidenciaClass = grupo === 'verdes' ? ' row-coincidencia-descripcion' : ' row-sin-coincidencia';

    conciliadosFiltrados.forEach((match, idx) => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);
        const isSelected = seleccionConciliados.includes(String(match.id));
        const selectedClass = isSelected ? ' row-conciliado-selected' : '';

        // Badge de tipo de conciliación
        let tipoBadge = '';
        if (match.mayor.length === 1 && match.extracto.length === 1) {
            tipoBadge = '<span class="badge-tipo-conc badge-1a1">1:1</span>';
        } else if (match.mayor.length === 1 && match.extracto.length > 1) {
            tipoBadge = `<span class="badge-tipo-conc badge-1aN">1:${match.extracto.length}</span>`;
        } else if (match.mayor.length > 1 && match.extracto.length === 1) {
            tipoBadge = `<span class="badge-tipo-conc badge-Na1">${match.mayor.length}:1</span>`;
        }

        for (let i = 0; i < maxRows; i++) {
            const m = match.mayor[i];
            const e = match.extracto[i];
            const isFirst = i === 0;
            const manualClass = match.manual ? ' row-manual' : '';

            html += `<tr class="${isFirst ? 'match-group' : 'sub-row'}${manualClass}${coincidenciaClass}${selectedClass}" data-conciliacion-id="${match.id}">`;

            // Checkbox de selección (solo en primera fila)
            if (isFirst) {
                const checked = isSelected ? 'checked' : '';
                html += `<td class="col-checkbox" rowspan="${maxRows}">
                    <input type="checkbox" class="checkbox-conciliado" data-id="${match.id}" ${checked} onchange="toggleSeleccionConciliado('${match.id}', this.checked)">
                </td>`;
            }

            // Columnas Mayor
            if (m) {
                html += `
                    <td class="col-fecha">${formatearFecha(m.fecha)}</td>
                    <td class="col-numero">${m.numeroAsiento}</td>
                    <td class="col-leyenda" title="${m.leyenda}">${truncar(m.leyenda, 30)}</td>
                    <td class="col-importe">${formatearNumero(m.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-numero"></td><td class="col-leyenda"></td><td class="col-importe"></td>';
            }

            // Separador
            html += '<td class="separator"></td>';

            // Columnas Extracto
            if (e) {
                html += `
                    <td class="col-fecha">${formatearFecha(e.fecha)}</td>
                    <td class="col-descripcion" title="${e.descripcion}">${truncar(e.descripcion, 25)}</td>
                    <td class="col-origen">${e.origen}</td>
                    <td class="col-importe">${formatearNumero(e.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-descripcion"></td><td class="col-origen"></td><td class="col-importe"></td>';
            }

            // Diferencia (solo en primera fila)
            if (isFirst) {
                const colorClass = match.diferencia > 0 ? 'text-red' : 'text-green';
                html += `<td class="col-diferencia ${colorClass}">${match.diferencia > 0 ? formatearNumero(match.diferencia) : '-'}</td>`;
            } else {
                html += '<td class="col-diferencia"></td>';
            }

            // Botón de acción (solo en primera fila)
            if (isFirst) {
                const manualBadge = match.manual ? '<span class="badge-manual">Manual</span>' : '';
                let reprocesoBadge = '';
                if (match.reproceso && match.parametrosReproceso) {
                    const tooltipText = `Reproceso #${match.parametrosReproceso.numeroReproceso}: ${match.parametrosReproceso.toleranciaFecha} días, $${match.parametrosReproceso.toleranciaImporte.toLocaleString('es-AR')}`;
                    reprocesoBadge = `<span class="badge-reproceso" title="${tooltipText}">🔄 Rep</span>`;
                }
                const tieneCoincidencia = grupo === 'verdes';
                const colorBtnIcon = tieneCoincidencia ? '🟢' : '🟠';
                const colorBtnTitle = tieneCoincidencia
                    ? 'Marcar como sin coincidencia (naranja)'
                    : 'Marcar como con coincidencia (verde)';
                // Botón de nota - muestra icono diferente si tiene nota
                const tieneNota = match.nota && match.nota.trim().length > 0;
                const notaBtnClass = tieneNota ? 'btn-nota btn-nota-activa' : 'btn-nota';
                const notaBtnIcon = tieneNota ? '📝' : '📋';
                const notaBtnTitle = tieneNota ? `Nota: ${match.nota.substring(0, 50)}${match.nota.length > 50 ? '...' : ''}` : 'Agregar nota';
                html += `
                    <td class="col-action">
                        ${tipoBadge}${manualBadge}${reprocesoBadge}
                        <button class="${notaBtnClass}" onclick="abrirModalNota('${match.id}')" title="${notaBtnTitle}">
                            ${notaBtnIcon}
                        </button>
                        <button class="btn-toggle-color" onmousedown="preBloquearToggle(event)" onclick="toggleColorConciliacion('${match.id}', event)" title="${colorBtnTitle}">
                            ${colorBtnIcon}
                        </button>
                        <button class="btn-desconciliar" onclick="desconciliar('${match.id}')" title="Desconciliar">
                            ✕
                        </button>
                    </td>
                `;
            } else {
                html += '<td class="col-action"></td>';
            }

            html += '</tr>';
        }
    });

    const emptyMsg = grupo === 'verdes'
        ? 'No hay conciliaciones verdes que coincidan con los filtros'
        : 'No hay conciliaciones naranjas que coincidan con los filtros';

    tabla.innerHTML = html || `<tr><td colspan="12" class="text-muted" style="text-align:center;padding:20px;">${emptyMsg}</td></tr>`;

    // Actualizar contador del grupo
    const countEl = grupo === 'verdes' ? document.getElementById('countVerdesFiltrados') : document.getElementById('countNaranjasFiltrados');
    if (countEl) {
        const hayFiltros = grupo === 'verdes' ? hayFiltrosActivosGrupo(filtrosConciliadosVerdes) : hayFiltrosActivosGrupo(filtrosConciliadosNaranjas);
        if (hayFiltros) {
            countEl.textContent = `(${conciliadosFiltrados.length} de ${totalOriginal})`;
        } else {
            countEl.textContent = `(${totalOriginal})`;
        }
    }
}

/**
 * Verificar si hay filtros activos en un grupo
 */
function hayFiltrosActivosGrupo(filtros) {
    return filtros.fechaMayorDesde ||
           filtros.fechaMayorHasta ||
           filtros.numeroAsiento ||
           filtros.leyenda ||
           filtros.fechaExtractoDesde ||
           filtros.fechaExtractoHasta ||
           filtros.descripcion ||
           filtros.origen ||
           filtros.tipoConciliacion ||
           (filtros.importeTipo && filtros.importeValor !== null);
}

/**
 * Poblar selector de tipos únicos para Mayor
 */
function poblarSelectorTiposMayor() {
    if (!state.resultados) return;

    const tipos = new Set();
    state.resultados.mayorNoConciliado.forEach(m => {
        if (m.tipoAsiento) tipos.add(m.tipoAsiento);
    });

    const select = document.getElementById('filtroMayorTipo');
    // Mantener la opción "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar tipos únicos ordenados
    [...tipos].sort().forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        select.appendChild(option);
    });
}

/**
 * Resetear estado de filtros (llamado al reiniciar)
 */
function resetearFiltros() {
    // Resetear estados
    filtrosMayor = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        numeroAsiento: '',
        leyenda: '',
        ce: 'todos',
        tipo: 'todos'
    };

    filtrosExtracto = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        descripcion: '',
        origen: ''
    };

    mayorPendienteFiltrado = [];
    extractoPendienteFiltrado = [];

    // Ocultar paneles de filtros
    const panelMayor = document.getElementById('filtros-mayor');
    const panelExtracto = document.getElementById('filtros-extracto');
    const btnMayor = document.getElementById('btnFiltrosMayor');
    const btnExtracto = document.getElementById('btnFiltrosExtracto');

    if (panelMayor) {
        panelMayor.classList.add('hidden');
        if (btnMayor) {
            btnMayor.classList.remove('active');
            btnMayor.innerHTML = '🔍 Filtros ▼';
        }
    }

    if (panelExtracto) {
        panelExtracto.classList.add('hidden');
        if (btnExtracto) {
            btnExtracto.classList.remove('active');
            btnExtracto.innerHTML = '🔍 Filtros ▼';
        }
    }

    // Ocultar resultados y badges
    const elementos = [
        'filtrosMayorResultado', 'filtrosMayorActivos',
        'filtrosExtractoResultado', 'filtrosExtractoActivos'
    ];

    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            if (id.includes('Activos')) el.innerHTML = '';
        }
    });
}

// ========== ORDENAMIENTO DE TABLAS ==========

/**
 * Ordenar tabla por columna
 * @param {string} tipo - 'mayor' o 'extracto'
 * @param {string} columna - nombre de la columna
 */
function ordenarPorColumna(tipo, columna) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;

    // Si es la misma columna, invertir dirección
    if (estado.columna === columna) {
        estado.direccion = estado.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        // Nueva columna, empezar descendente
        estado.columna = columna;
        estado.direccion = 'desc';
    }

    // Renderizar tabla con ordenamiento
    if (tipo === 'mayor') {
        renderizarTablaMayorOrdenada();
    } else {
        renderizarTablaExtractoOrdenada();
    }
}

/**
 * Aplicar ordenamiento a un array de movimientos
 * @param {Array} movimientos - array de movimientos
 * @param {string} tipo - 'mayor' o 'extracto'
 * @returns {Array} - array ordenado
 */
function aplicarOrdenamiento(movimientos, tipo) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;
    const { columna, direccion } = estado;

    return [...movimientos].sort((a, b) => {
        let valorA = obtenerValorColumna(a, columna, tipo);
        let valorB = obtenerValorColumna(b, columna, tipo);

        // Manejar valores nulos/vacíos (siempre al final)
        const esVacioA = valorA === null || valorA === '' || valorA === undefined;
        const esVacioB = valorB === null || valorB === '' || valorB === undefined;

        if (esVacioA && !esVacioB) return 1;
        if (!esVacioA && esVacioB) return -1;
        if (esVacioA && esVacioB) return 0;

        let comparacion = 0;

        // Comparar según tipo de dato
        if (columna === 'fecha') {
            // Ordenamiento por fecha
            const fechaA = valorA instanceof Date ? valorA.getTime() : new Date(valorA).getTime();
            const fechaB = valorB instanceof Date ? valorB.getTime() : new Date(valorB).getTime();
            comparacion = fechaA - fechaB;
        } else if (['debe', 'haber', 'debito', 'credito', 'numeroAsiento', 'importe', 'origen'].includes(columna)) {
            // Ordenamiento numérico
            const numA = parseFloat(valorA) || 0;
            const numB = parseFloat(valorB) || 0;
            // Para valores numéricos vacíos (0), mantenerlos al final si el original era vacío
            if (numA === 0 && numB !== 0) return 1;
            if (numA !== 0 && numB === 0) return -1;
            comparacion = numA - numB;
        } else {
            // Ordenamiento alfabético
            comparacion = String(valorA).localeCompare(String(valorB), 'es', { sensitivity: 'base' });
        }

        // Invertir si es descendente
        return direccion === 'asc' ? comparacion : -comparacion;
    });
}

/**
 * Obtener valor de una columna de un movimiento
 * @param {Object} movimiento - objeto de movimiento
 * @param {string} columna - nombre de la columna
 * @param {string} tipo - 'mayor' o 'extracto'
 * @returns {any} - valor de la columna
 */
function obtenerValorColumna(movimiento, columna, tipo) {
    const mapeoMayor = {
        'fecha': mov => mov.fecha,
        'numeroAsiento': mov => mov.numeroAsiento,
        'ce': mov => mov.ce,
        'tipo': mov => mov.tipoAsiento,
        'leyenda': mov => mov.leyenda,
        'debe': mov => mov.debe || 0,
        'haber': mov => mov.haber || 0
    };

    const mapeoExtracto = {
        'fecha': mov => mov.fecha,
        'descripcion': mov => mov.descripcion,
        'origen': mov => mov.origen,
        'debito': mov => mov.debito || 0,
        'credito': mov => mov.credito || 0
    };

    const mapeo = tipo === 'mayor' ? mapeoMayor : mapeoExtracto;
    return mapeo[columna] ? mapeo[columna](movimiento) : '';
}

/**
 * Renderizar tabla Mayor Pendiente con ordenamiento aplicado
 */
function renderizarTablaMayorOrdenada() {
    if (!state.resultados) return;

    // Obtener datos: filtrados si hay filtros activos Y hay datos filtrados, o todos
    // IMPORTANTE: Si mayorPendienteFiltrado está vacío, usar siempre los datos originales
    // Esto evita que movimientos desaparezcan cuando hay filtros residuales
    const hayFiltros = hayFiltrosActivosMayor();
    const hayDatosFiltrados = mayorPendienteFiltrado && mayorPendienteFiltrado.length > 0;

    let movimientos = (hayFiltros && hayDatosFiltrados)
        ? mayorPendienteFiltrado
        : state.resultados.mayorNoConciliado;

    // Aplicar ordenamiento
    movimientos = aplicarOrdenamiento(movimientos, 'mayor');

    // Actualizar contador para reflejar lo que realmente se muestra
    if (elements.countMayorPendiente) {
        elements.countMayorPendiente.textContent = `(${movimientos.length})`;
    }

    // Renderizar filas
    let html = '';
    movimientos.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos pendientes</td></tr>';

    // Actualizar indicadores visuales
    actualizarIndicadoresOrden('mayor');
}

/**
 * Renderizar tabla Extracto Pendiente con ordenamiento aplicado
 */
function renderizarTablaExtractoOrdenada() {
    if (!state.resultados) return;

    // Obtener datos: filtrados si hay filtros activos Y hay datos filtrados, o todos
    // IMPORTANTE: Si extractoPendienteFiltrado está vacío, usar siempre los datos originales
    // Esto evita que movimientos desaparezcan cuando hay filtros residuales
    const hayFiltros = hayFiltrosActivosExtracto();
    const hayDatosFiltrados = extractoPendienteFiltrado && extractoPendienteFiltrado.length > 0;

    let movimientos = (hayFiltros && hayDatosFiltrados)
        ? extractoPendienteFiltrado
        : state.resultados.extractoNoConciliado;

    // Aplicar ordenamiento
    movimientos = aplicarOrdenamiento(movimientos, 'extracto');

    // Actualizar contador para reflejar lo que realmente se muestra
    if (elements.countExtractoPendiente) {
        elements.countExtractoPendiente.textContent = `(${movimientos.length})`;
    }

    // Renderizar filas
    let html = '';
    movimientos.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos pendientes</td></tr>';

    // Actualizar indicadores visuales
    actualizarIndicadoresOrden('extracto');
}

/**
 * Actualizar indicadores visuales de orden en los encabezados
 * @param {string} tipo - 'mayor' o 'extracto'
 */
function actualizarIndicadoresOrden(tipo) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;
    const contenedor = tipo === 'mayor' ? '#tab-mayor-pendiente' : '#tab-extracto-pendiente';

    // Quitar clase activa de todas las columnas
    document.querySelectorAll(`${contenedor} .columna-ordenable`).forEach(th => {
        th.classList.remove('activa', 'asc', 'desc');
        const icono = th.querySelector('.icono-orden');
        if (icono) icono.textContent = '↕';
    });

    // Agregar clase activa a la columna actual
    const columnaActiva = document.querySelector(`${contenedor} .columna-ordenable[data-columna="${estado.columna}"]`);
    if (columnaActiva) {
        columnaActiva.classList.add('activa', estado.direccion);
        const icono = columnaActiva.querySelector('.icono-orden');
        if (icono) icono.textContent = estado.direccion === 'asc' ? '▲' : '▼';
    }
}

/**
 * Resetear estado de ordenamiento
 */
function resetearOrdenamiento() {
    ordenMayor = {
        columna: 'fecha',
        direccion: 'desc'
    };
    ordenExtracto = {
        columna: 'fecha',
        direccion: 'desc'
    };
}

// ========== TABS ==========

function cambiarTab(tabId) {
    elements.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}

// ========== DESCARGA DE REPORTE ==========

function descargarReporte() {
    const res = state.resultados;
    const wb = XLSX.utils.book_new();

    // Hoja 1: Conciliados (con información de pasada y tolerancias)
    const dataConciliados = [];
    dataConciliados.push([
        'Fecha Mayor', 'Nº Asiento', 'Leyenda Mayor', 'Importe Mayor', '',
        'Fecha Extracto', 'Descripción Extracto', 'Origen', 'Importe Extracto', 'Diferencia', 'Tipo', 'Pasada', 'Tolerancias'
    ]);

    res.conciliados.forEach(match => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);

        // Determinar información de pasada
        let pasada = 'Inicial';
        let tolerancias = '';
        if (match.reproceso && match.parametrosReproceso) {
            pasada = `Reproceso ${match.parametrosReproceso.numeroReproceso}`;
            tolerancias = `${match.parametrosReproceso.toleranciaFecha} días, $${match.parametrosReproceso.toleranciaImporte.toLocaleString('es-AR')}`;
        } else if (toleranciasIniciales.fecha !== null) {
            tolerancias = `${toleranciasIniciales.fecha} días, $${toleranciasIniciales.importe.toLocaleString('es-AR')}`;
        }

        for (let i = 0; i < maxRows; i++) {
            const m = match.mayor[i];
            const e = match.extracto[i];

            dataConciliados.push([
                m ? formatearFecha(m.fecha) : '',
                m ? m.numeroAsiento : '',
                m ? m.leyenda : '',
                m ? m.importe : '',
                '',
                e ? formatearFecha(e.fecha) : '',
                e ? e.descripcion : '',
                e ? e.origen : '',
                e ? e.importe : '',
                i === 0 ? match.diferencia : '',
                i === 0 ? (match.manual ? 'Manual' : 'Automático') : '',
                i === 0 ? pasada : '',
                i === 0 ? tolerancias : ''
            ]);
        }
    });

    const wsConciliados = XLSX.utils.aoa_to_sheet(dataConciliados);
    XLSX.utils.book_append_sheet(wb, wsConciliados, 'Conciliados');

    // Hoja 2: Mayor No Conciliado
    const dataMayor = [];
    dataMayor.push(['Fecha', 'Nº Asiento', 'C/E', 'Tipo', 'Leyenda', 'Debe', 'Haber']);

    res.mayorNoConciliado.forEach(m => {
        dataMayor.push([
            formatearFecha(m.fecha),
            m.numeroAsiento,
            m.ce,
            m.tipoAsiento,
            m.leyenda,
            m.debe || '',
            m.haber || ''
        ]);
    });

    const wsMayor = XLSX.utils.aoa_to_sheet(dataMayor);
    XLSX.utils.book_append_sheet(wb, wsMayor, 'Mayor No Conciliado');

    // Hoja 3: Extracto No Conciliado
    const dataExtracto = [];
    dataExtracto.push(['Fecha', 'Descripción', 'Origen', 'Débito', 'Crédito']);

    res.extractoNoConciliado.forEach(e => {
        dataExtracto.push([
            formatearFecha(e.fecha),
            e.descripcion,
            e.origen,
            e.debito || '',
            e.credito || ''
        ]);
    });

    const wsExtracto = XLSX.utils.aoa_to_sheet(dataExtracto);
    XLSX.utils.book_append_sheet(wb, wsExtracto, 'Extracto No Conciliado');

    // Hoja 4: Eliminados
    const dataEliminados = [];
    dataEliminados.push(['Fecha Asiento', 'Nº Asiento', 'C/E', 'Tipo', 'Leyenda', 'Debe', 'Haber', 'Fecha Eliminación', 'Motivo']);

    state.eliminados.forEach(m => {
        const fechaElim = new Date(m.fechaEliminacion);
        dataEliminados.push([
            formatearFecha(m.fecha),
            m.numeroAsiento,
            m.ce,
            m.tipoAsiento,
            m.leyenda,
            m.debe || '',
            m.haber || '',
            formatearFecha(fechaElim) + ' ' + fechaElim.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            m.motivo || ''
        ]);
    });

    const wsEliminados = XLSX.utils.aoa_to_sheet(dataEliminados);
    XLSX.utils.book_append_sheet(wb, wsEliminados, 'Eliminados');

    // Hoja 5: Resumen
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);
    const totalEliminados = state.eliminados.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

    const dataResumen = [
        ['RESUMEN DE CONCILIACIÓN'],
        [''],
        ['Tipo de conciliación:', state.tipoConciliacion === 'creditos' ? 'Créditos' : 'Débitos'],
        ['Tolerancia inicial de fechas:', toleranciasIniciales.fecha !== null ? `${toleranciasIniciales.fecha} días` : `${state.toleranciaFecha} días`],
        ['Tolerancia inicial de importes:', toleranciasIniciales.importe !== null ? `$${toleranciasIniciales.importe.toLocaleString('es-AR')}` : `$${state.toleranciaImporte.toLocaleString('es-AR')}`],
        [''],
        ['RESULTADOS'],
        ['Cantidad de grupos conciliados:', res.conciliados.length],
        ['Cantidad Mayor no conciliado:', res.mayorNoConciliado.length],
        ['Cantidad Extracto no conciliado:', res.extractoNoConciliado.length],
        ['Cantidad eliminados del Mayor:', state.eliminados.length],
        [''],
        ['TOTALES'],
        ['Total Mayor conciliado:', totalConciliadoMayor],
        ['Total Extracto conciliado:', totalConciliadoExtracto],
        ['Total Mayor no conciliado:', totalMayorPendiente],
        ['Total Extracto no conciliado:', totalExtractoPendiente],
        ['Total eliminados del Mayor:', totalEliminados],
        [''],
        ['Diferencia en conciliados:', Math.abs(totalConciliadoMayor - totalConciliadoExtracto)],
        [''],
        ['DIFERENCIA AJUSTADA (excluyendo eliminados)'],
        ['Diferencia original:', Math.abs(totalMayorPendiente - totalExtractoPendiente)],
        ['Diferencia ajustada:', Math.abs((totalMayorPendiente - totalEliminados) - totalExtractoPendiente)]
    ];

    // Agregar historial de procesamiento si hay reprocesos
    if (historialProcesamiento.length > 0) {
        dataResumen.push(['']);
        dataResumen.push(['HISTORIAL DE PROCESAMIENTO']);

        let totalHistorialConciliados = 0;
        historialProcesamiento.forEach((item, idx) => {
            const prefijo = idx === 0 ? 'Procesamiento inicial' : `Reproceso ${idx}`;
            const signo = idx === 0 ? '' : '+';
            const toleranciasStr = `${item.toleranciaFecha} días, $${item.toleranciaImporte.toLocaleString('es-AR')}`;
            dataResumen.push([`${idx + 1}. ${prefijo} (${toleranciasStr})`, `→ ${signo}${item.conciliados} conciliados`]);
            totalHistorialConciliados += item.conciliados;
        });

        dataResumen.push(['']);
        dataResumen.push(['Total conciliados (historial):', totalHistorialConciliados]);
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(dataResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    const tipo = state.tipoConciliacion === 'creditos' ? 'Creditos' : 'Debitos';
    XLSX.writeFile(wb, `Conciliacion_${tipo}_${fecha}.xlsx`);
}

// ========== GUARDADO DE CONCILIACIONES ==========

/**
 * Convierte un formato año-mes "YYYY-MM" a fecha completa "YYYY-MM-DD"
 * @param {string} yearMonth - Formato "YYYY-MM" (ej: "2024-07")
 * @param {boolean} endOfMonth - Si es true, devuelve el último día del mes; si es false, el primero
 * @returns {string|null} - Fecha en formato "YYYY-MM-DD" o null si el input es inválido
 */
function convertirAFechaCompleta(yearMonth, endOfMonth = false) {
    if (!yearMonth || typeof yearMonth !== 'string') return null;

    // Si ya tiene formato completo YYYY-MM-DD, devolverlo tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(yearMonth)) return yearMonth;

    // Verificar formato YYYY-MM
    const match = yearMonth.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1]);
    const month = parseInt(match[2]);

    if (endOfMonth) {
        // Obtener el último día del mes
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
        // Primer día del mes
        return `${year}-${String(month).padStart(2, '0')}-01`;
    }
}

/**
 * Guardar la conciliación actual en Supabase
 */
async function guardarConciliacion() {
    if (!state.resultados) {
        mostrarMensaje('No hay resultados para guardar', 'error');
        return;
    }

    if (!state.clienteSeleccionado || !state.cuentaSeleccionada) {
        mostrarMensaje('Debe seleccionar cliente y cuenta para guardar', 'error');
        return;
    }

    // Mostrar prompt para el nombre de la conciliación
    const fechaActual = new Date();
    const fechaFormateada = fechaActual.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const tipoTexto = state.tipoConciliacion === 'creditos' ? 'Créditos' : 'Débitos';
    const nombreSugerido = `${tipoTexto} - ${fechaFormateada}`;

    const nombreConciliacion = prompt('Ingrese un nombre para identificar esta conciliación:', nombreSugerido);

    if (nombreConciliacion === null) {
        // El usuario canceló
        return;
    }

    const btnGuardar = document.getElementById('btnGuardarConciliacion');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '⏳ Guardando...';
    }

    try {
        // Convertir rangos de extractos a formato de fecha completa
        const rangoDesde = convertirAFechaCompleta(state.rangoExtractos?.desde, false);
        const rangoHasta = convertirAFechaCompleta(state.rangoExtractos?.hasta, true);

        // Preparar datos para guardar
        const datosAGuardar = {
            cliente_id: state.clienteSeleccionado.id,
            cuenta_bancaria_id: state.cuentaSeleccionada.id,
            tipo: state.tipoConciliacion,
            nombre: nombreConciliacion.trim() || nombreSugerido,
            rango_desde: rangoDesde,
            rango_hasta: rangoHasta,
            tolerancia_fecha: state.toleranciaFecha,
            tolerancia_importe: state.toleranciaImporte,
            exigencia_palabras: state.exigenciaPalabras,
            datos: {
                conciliados: state.resultados.conciliados.map(c => ({
                    id: c.id,
                    tipo: c.tipo,
                    diferencia: c.diferencia,
                    manual: c.manual || false,
                    coincidenciaOverride: c.coincidenciaOverride,
                    nota: c.nota || null,
                    mayor: c.mayor.map(m => ({
                        id: m.id,
                        fecha: m.fecha,
                        numeroAsiento: m.numeroAsiento,
                        ce: m.ce,
                        tipoAsiento: m.tipoAsiento,
                        leyenda: m.leyenda,
                        debe: m.debe,
                        haber: m.haber,
                        importe: m.importe
                    })),
                    extracto: c.extracto.map(e => ({
                        id: e.id,
                        fecha: e.fecha,
                        descripcion: e.descripcion,
                        origen: e.origen,
                        debito: e.debito,
                        credito: e.credito,
                        importe: e.importe
                    }))
                })),
                mayorNoConciliado: state.resultados.mayorNoConciliado.map(m => ({
                    id: m.id,
                    fecha: m.fecha,
                    numeroAsiento: m.numeroAsiento,
                    ce: m.ce,
                    tipoAsiento: m.tipoAsiento,
                    leyenda: m.leyenda,
                    debe: m.debe,
                    haber: m.haber,
                    importe: m.importe
                })),
                extractoNoConciliado: state.resultados.extractoNoConciliado.map(e => ({
                    id: e.id,
                    fecha: e.fecha,
                    descripcion: e.descripcion,
                    origen: e.origen,
                    debito: e.debito,
                    credito: e.credito,
                    importe: e.importe
                })),
                eliminados: state.eliminados,
                // Guardar desconciliaciones manuales para que no se vuelvan a conciliar en reprocesos
                desconciliacionesManuales: desconciliacionesManuales
            },
            historial_procesamiento: historialProcesamiento,
            fecha_conciliacion: new Date().toISOString()
        };

        // Si hay una conciliación cargada, actualizar; si no, crear nueva
        if (conciliacionCargadaId) {
            // UPDATE: sobrescribir la conciliación existente
            const { error } = await supabase
                .from('conciliaciones_guardadas')
                .update(datosAGuardar)
                .eq('id', conciliacionCargadaId);

            if (error) throw error;

            const fechaHoraGuardado = new Date().toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            mostrarMensaje(`Conciliación actualizada correctamente (${fechaHoraGuardado})`, 'success');
        } else {
            // INSERT: crear nueva conciliación y guardar el ID
            const { data, error } = await supabase
                .from('conciliaciones_guardadas')
                .insert([datosAGuardar])
                .select('id');

            if (error) throw error;

            // Guardar el ID para futuros guardados (sobrescribir en lugar de crear nuevo)
            if (data && data.length > 0) {
                conciliacionCargadaId = data[0].id;
            }

            const fechaHoraGuardado = new Date().toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            mostrarMensaje(`Conciliación guardada correctamente (${fechaHoraGuardado})`, 'success');
        }

        // Actualizar lista de conciliaciones guardadas
        const conciliaciones = await cargarConciliacionesGuardadas();
        conciliacionesGuardadasLista = conciliaciones || [];
        actualizarBotonGestionConciliaciones();

    } catch (error) {
        console.error('Error guardando conciliación:', error);
        mostrarMensaje('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 Guardar Conciliación';
        }
    }
}

/**
 * Sincronizar movimientos del extracto con la conciliación actual
 * Detecta y recupera movimientos que existen en el extracto pero faltan en la conciliación
 */
async function sincronizarConExtracto() {
    if (!state.resultados || !state.cuentaSeleccionada) {
        mostrarMensaje('Debe tener una conciliación cargada para sincronizar', 'error');
        return;
    }

    if (!state.rangoExtractos?.desde || !state.rangoExtractos?.hasta) {
        mostrarMensaje('No hay rango de extractos definido', 'error');
        return;
    }

    try {
        mostrarMensaje('Buscando movimientos faltantes...', 'info');

        // Obtener extractos del rango actual
        const [anioDesde, mesDesde] = state.rangoExtractos.desde.split('-').map(Number);
        const [anioHasta, mesHasta] = state.rangoExtractos.hasta.split('-').map(Number);

        const { data: extractos, error } = await supabase
            .from('extractos_mensuales')
            .select('id, mes, anio, data')
            .eq('cuenta_id', state.cuentaSeleccionada.id);

        if (error) throw error;

        // Filtrar extractos en el rango
        const extractosEnRango = (extractos || []).filter(ext => {
            const extValue = ext.anio * 100 + ext.mes;
            const desdeValue = anioDesde * 100 + mesDesde;
            const hastaValue = anioHasta * 100 + mesHasta;
            const min = Math.min(desdeValue, hastaValue);
            const max = Math.max(desdeValue, hastaValue);
            return extValue >= min && extValue <= max;
        });

        if (extractosEnRango.length === 0) {
            mostrarMensaje('No se encontraron extractos en el rango de la conciliación', 'error');
            return;
        }

        // Combinar todos los movimientos de los extractos
        let todosLosMovimientos = [];
        for (const extracto of extractosEnRango) {
            const movimientos = extracto.data || [];
            movimientos.forEach((mov, idx) => {
                todosLosMovimientos.push({
                    ...mov,
                    extractoId: extracto.id,
                    extractoMes: extracto.mes,
                    extractoAnio: extracto.anio
                });
            });
        }

        // Convertir al formato del conciliador
        const movimientosExtracto = convertirMovimientosAuditoria(todosLosMovimientos);

        // Filtrar por tipo de conciliación (débitos o créditos)
        const movimientosFiltrados = state.tipoConciliacion === 'creditos'
            ? movimientosExtracto.filter(e => e.credito > 0)
            : movimientosExtracto.filter(e => e.debito > 0);

        // Crear función para generar clave única de movimiento
        // Usamos origen (número de referencia) + importe ya que el origen es único por movimiento
        const generarClave = (mov) => {
            const origen = String(mov.origen || '').trim();
            const importe = Number(mov.importe || mov.debito || mov.credito || 0).toFixed(2);
            // Si no hay origen, usar descripción + importe como fallback
            if (!origen) {
                const desc = String(mov.descripcion || '').trim().toLowerCase();
                return `desc:${desc}|${importe}`;
            }
            return `origen:${origen}|${importe}`;
        };

        // Obtener claves de todos los movimientos en la conciliación actual
        const clavesEnConciliacion = new Set();

        // Claves en conciliados
        state.resultados.conciliados.forEach(c => {
            c.extracto.forEach(e => clavesEnConciliacion.add(generarClave(e)));
        });

        // Claves en pendientes
        state.resultados.extractoNoConciliado.forEach(e => clavesEnConciliacion.add(generarClave(e)));

        // Claves en eliminados (solo movimientos de extracto)
        state.eliminados.forEach(e => {
            if (e.descripcion !== undefined) { // Es un movimiento de extracto
                clavesEnConciliacion.add(generarClave(e));
            }
        });

        console.log('Claves en conciliación (muestra):', Array.from(clavesEnConciliacion).slice(0, 10));
        console.log('Clave del movimiento buscado (496529):', generarClave({origen: '496529', debito: 2872724.42}));

        // Encontrar movimientos faltantes (comparando por clave única)
        const movimientosFaltantes = movimientosFiltrados.filter(m => !clavesEnConciliacion.has(generarClave(m)));

        if (movimientosFaltantes.length === 0) {
            mostrarMensaje('No se encontraron movimientos faltantes. La conciliación está sincronizada.', 'success');
            return;
        }

        // Mostrar confirmación con detalles
        const tipoMovimiento = state.tipoConciliacion === 'creditos' ? 'créditos' : 'débitos';
        let detalles = movimientosFaltantes.slice(0, 5).map(m =>
            `• ${m.origen || 'S/N'} - ${m.descripcion} - $${(m.importe || m.debito || m.credito).toLocaleString('es-AR')}`
        ).join('\n');
        if (movimientosFaltantes.length > 5) {
            detalles += `\n... y ${movimientosFaltantes.length - 5} más`;
        }

        const mensaje = `Se encontraron ${movimientosFaltantes.length} movimiento(s) de ${tipoMovimiento} faltantes:\n\n${detalles}\n\n¿Desea agregarlos a la lista de pendientes?`;

        if (!confirm(mensaje)) {
            return;
        }

        // Agregar movimientos faltantes a pendientes
        movimientosFaltantes.forEach(m => {
            // Asegurar que tenga el campo importe
            if (!m.importe) {
                m.importe = state.tipoConciliacion === 'creditos' ? m.credito : m.debito;
            }
            state.resultados.extractoNoConciliado.push(m);
        });

        // Actualizar vistas
        resetearFiltros();
        mostrarResultados();
        actualizarTotalesYContadores();

        mostrarMensaje(`Se agregaron ${movimientosFaltantes.length} movimiento(s) a pendientes. Recuerde guardar la conciliación.`, 'success');

        // Log para debugging
        console.log('Movimientos recuperados:', movimientosFaltantes);

    } catch (error) {
        console.error('Error sincronizando con extracto:', error);
        mostrarMensaje('Error al sincronizar: ' + (error.message || 'Error desconocido'), 'error');
    }
}

/**
 * Verificar integridad de la conciliación al cargarla
 * Compara los movimientos de la conciliación con los del extracto original
 * y alerta si hay discrepancias
 */
async function verificarIntegridadConciliacion() {
    if (!state.resultados || !state.cuentaSeleccionada) {
        return; // No hay conciliación cargada
    }

    if (!state.rangoExtractos?.desde || !state.rangoExtractos?.hasta) {
        return; // No hay rango definido
    }

    try {
        console.log('🔍 Verificando integridad de la conciliación...');

        // Obtener extractos del rango actual
        const [anioDesde, mesDesde] = state.rangoExtractos.desde.split('-').map(Number);
        const [anioHasta, mesHasta] = state.rangoExtractos.hasta.split('-').map(Number);

        const { data: extractos, error } = await supabase
            .from('extractos_mensuales')
            .select('id, mes, anio, data')
            .eq('cuenta_id', state.cuentaSeleccionada.id);

        if (error) {
            console.error('Error verificando integridad:', error);
            return;
        }

        // Filtrar extractos en el rango
        const extractosEnRango = (extractos || []).filter(ext => {
            const extValue = ext.anio * 100 + ext.mes;
            const desdeValue = anioDesde * 100 + mesDesde;
            const hastaValue = anioHasta * 100 + mesHasta;
            const min = Math.min(desdeValue, hastaValue);
            const max = Math.max(desdeValue, hastaValue);
            return extValue >= min && extValue <= max;
        });

        if (extractosEnRango.length === 0) {
            return; // No hay extractos para comparar
        }

        // Combinar todos los movimientos de los extractos
        let todosLosMovimientos = [];
        for (const extracto of extractosEnRango) {
            const movimientos = extracto.data || [];
            movimientos.forEach((mov, idx) => {
                todosLosMovimientos.push({
                    ...mov,
                    extractoId: extracto.id,
                    extractoMes: extracto.mes,
                    extractoAnio: extracto.anio
                });
            });
        }

        // Convertir al formato del conciliador
        const movimientosExtracto = convertirMovimientosAuditoria(todosLosMovimientos);

        // Filtrar por tipo de conciliación (débitos o créditos)
        const movimientosFiltrados = state.tipoConciliacion === 'creditos'
            ? movimientosExtracto.filter(e => e.credito > 0)
            : movimientosExtracto.filter(e => e.debito > 0);

        // Crear función para generar clave única
        const generarClave = (mov) => {
            const origen = String(mov.origen || '').trim();
            const importe = Number(mov.importe || mov.debito || mov.credito || 0).toFixed(2);
            if (!origen) {
                const desc = String(mov.descripcion || '').trim().toLowerCase();
                return `desc:${desc}|${importe}`;
            }
            return `origen:${origen}|${importe}`;
        };

        // Obtener claves de todos los movimientos en la conciliación actual
        const clavesEnConciliacion = new Set();

        state.resultados.conciliados.forEach(c => {
            c.extracto.forEach(e => clavesEnConciliacion.add(generarClave(e)));
        });
        state.resultados.extractoNoConciliado.forEach(e => clavesEnConciliacion.add(generarClave(e)));
        state.eliminados.forEach(e => {
            if (e.descripcion !== undefined) {
                clavesEnConciliacion.add(generarClave(e));
            }
        });

        // Encontrar movimientos faltantes
        const movimientosFaltantes = movimientosFiltrados.filter(m => !clavesEnConciliacion.has(generarClave(m)));

        if (movimientosFaltantes.length === 0) {
            console.log('✅ Integridad OK: Todos los movimientos del extracto están en la conciliación');
            return;
        }

        // Hay discrepancias - mostrar alerta
        console.warn(`⚠️ Integridad: Se encontraron ${movimientosFaltantes.length} movimiento(s) faltante(s)`);

        const tipoMovimiento = state.tipoConciliacion === 'creditos' ? 'créditos' : 'débitos';

        // Crear y mostrar el banner de alerta
        mostrarAlertaIntegridad(movimientosFaltantes.length, tipoMovimiento);

    } catch (error) {
        console.error('Error verificando integridad:', error);
    }
}

/**
 * Mostrar banner de alerta de integridad
 */
function mostrarAlertaIntegridad(cantidad, tipo) {
    // Remover alerta anterior si existe
    const alertaAnterior = document.getElementById('alerta-integridad');
    if (alertaAnterior) {
        alertaAnterior.remove();
    }

    const alertaHtml = `
        <div id="alerta-integridad" style="
            background: linear-gradient(135deg, #fef3cd 0%, #fff3cd 100%);
            border: 1px solid #ffc107;
            border-left: 4px solid #ff9800;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">⚠️</span>
                <div>
                    <strong style="color: #856404;">Verificación de integridad</strong>
                    <p style="margin: 4px 0 0 0; color: #856404; font-size: 14px;">
                        Se detectaron <strong>${cantidad}</strong> movimiento(s) de ${tipo} en el extracto que no están en la conciliación.
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="sincronizarConExtracto()" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                    🔄 Sincronizar ahora
                </button>
                <button onclick="document.getElementById('alerta-integridad').remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#5a6268'" onmouseout="this.style.background='#6c757d'">
                    ✕ Ignorar
                </button>
            </div>
        </div>
    `;

    // Insertar antes de la sección de resultados
    const resultados = document.getElementById('resultados');
    if (resultados) {
        resultados.insertAdjacentHTML('afterbegin', alertaHtml);
    }
}

/**
 * Cargar conciliaciones guardadas para el cliente/cuenta actual
 */
async function cargarConciliacionesGuardadas() {
    if (!state.clienteSeleccionado || !state.cuentaSeleccionada) {
        console.log('⚠️ cargarConciliacionesGuardadas: No hay cliente o cuenta seleccionada');
        return [];
    }

    try {
        console.log('🔄 Consultando conciliaciones_guardadas en Supabase...');
        console.log('   Filtro cliente_id:', state.clienteSeleccionado.id);
        console.log('   Filtro cuenta_bancaria_id:', state.cuentaSeleccionada.id);

        const { data, error } = await supabase
            .from('conciliaciones_guardadas')
            .select('*')
            .eq('cliente_id', state.clienteSeleccionado.id)
            .eq('cuenta_bancaria_id', state.cuentaSeleccionada.id)
            .order('fecha_conciliacion', { ascending: false });

        if (error) {
            console.error('❌ Error en consulta:', error);
            throw error;
        }

        console.log('📊 Resultado de consulta:', data);
        return data || [];
    } catch (error) {
        console.error('Error cargando conciliaciones guardadas:', error);
        return [];
    }
}

/**
 * Cargar una conciliación guardada específica
 */
async function cargarConciliacionGuardada(conciliacionId) {
    console.log('🔄 cargarConciliacionGuardada llamada con ID:', conciliacionId, 'tipo:', typeof conciliacionId);

    if (!conciliacionId || conciliacionId === 'null' || conciliacionId === 'undefined') {
        console.error('❌ ID de conciliación inválido:', conciliacionId);
        mostrarMensaje('Error: ID de conciliación inválido', 'error');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('conciliaciones_guardadas')
            .select('*')
            .eq('id', conciliacionId)
            .single();

        if (error) throw error;

        if (data) {
            console.log('✅ Cargando conciliación guardada:', data);

            // Restaurar estado
            state.tipoConciliacion = data.tipo;
            state.toleranciaFecha = data.tolerancia_fecha;
            state.toleranciaImporte = data.tolerancia_importe;
            state.exigenciaPalabras = data.exigencia_palabras !== undefined ? data.exigencia_palabras : 2;

            // Convertir fechas de YYYY-MM-DD a YYYY-MM para los selectores
            const rangoDesdeSelector = data.rango_desde ? data.rango_desde.substring(0, 7) : null;
            const rangoHastaSelector = data.rango_hasta ? data.rango_hasta.substring(0, 7) : null;

            state.rangoExtractos = {
                desde: rangoDesdeSelector,
                hasta: rangoHastaSelector
            };

            // Restaurar resultados
            if (data.datos) {
                state.resultados = {
                    conciliados: data.datos.conciliados || [],
                    mayorNoConciliado: data.datos.mayorNoConciliado || [],
                    extractoNoConciliado: data.datos.extractoNoConciliado || []
                };
                state.eliminados = data.datos.eliminados || [];

                // Restaurar desconciliaciones manuales
                desconciliacionesManuales = data.datos.desconciliacionesManuales || [];
                console.log('Desconciliaciones manuales restauradas:', desconciliacionesManuales.length);
            }

            // Restaurar historial
            historialProcesamiento = data.historial_procesamiento || [];

            // Actualizar UI - Tipo de conciliación
            elements.tipoButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tipo === data.tipo);
            });

            // Actualizar UI - Tolerancias
            elements.toleranciaFecha.value = data.tolerancia_fecha;
            elements.toleranciaImporte.value = data.tolerancia_importe;
            if (elements.exigenciaPalabras) {
                elements.exigenciaPalabras.value = data.exigencia_palabras !== undefined ? data.exigencia_palabras : 2;
            }

            // Actualizar UI - Selectores de rango
            const rangoDesdeSelect = document.getElementById('rangoDesde');
            const rangoHastaSelect = document.getElementById('rangoHasta');
            if (rangoDesdeSelect && rangoDesdeSelector) {
                rangoDesdeSelect.value = rangoDesdeSelector;
            }
            if (rangoHastaSelect && rangoHastaSelector) {
                rangoHastaSelect.value = rangoHastaSelector;
            }

            // Mostrar pasos de configuración si no están visibles
            if (elements.stepExtracto) {
                elements.stepExtracto.classList.remove('hidden');
            }
            if (elements.stepConciliacion) {
                elements.stepConciliacion.classList.remove('hidden');
            }

            // IMPORTANTE: Resetear filtros antes de mostrar resultados
            // Esto evita que filtros residuales de sesiones anteriores oculten los movimientos
            // Bug fix: movimientos desconciliados desaparecían porque renderizarTablaMayorOrdenada()
            // usaba mayorPendienteFiltrado (vacío) cuando hayFiltrosActivosMayor() era true
            resetearFiltros();

            // Mostrar resultados
            mostrarResultados(state.resultados);

            // Actualizar panel de reprocesamiento y historial
            actualizarPanelReproceso();
            actualizarHistorial();
            actualizarSugerenciasReproceso(); // Actualizar número de reproceso basado en historial

            console.log('✅ Conciliación cargada - Conciliados:', state.resultados.conciliados.length,
                        'Mayor pendiente:', state.resultados.mayorNoConciliado.length,
                        'Extracto pendiente:', state.resultados.extractoNoConciliado.length);

            // Guardar referencia a la conciliación cargada
            conciliacionCargadaId = data.id;
            nombreConciliacionCargada = data.nombre || `Conciliación ${data.tipo}`;

            // Mostrar botón de eliminar conciliación cargada
            actualizarBotonEliminarConciliacionCargada();

            mostrarMensaje('Conciliación cargada correctamente', 'success');

            // Verificar integridad de la conciliación (comparar con extracto original)
            // Esto se ejecuta de forma asíncrona para no bloquear la UI
            setTimeout(() => {
                verificarIntegridadConciliacion();
            }, 500);
        }
    } catch (error) {
        console.error('Error cargando conciliación:', error);
        mostrarMensaje('Error al cargar la conciliación', 'error');
    }
}

// Variables para almacenar las conciliaciones guardadas
let conciliacionesGuardadasLista = [];
let conciliacionSeleccionadaId = null;
let conciliacionAEliminar = null;
let conciliacionCargadaId = null; // ID de la conciliación actualmente cargada
let nombreConciliacionCargada = null; // Nombre de la conciliación actualmente cargada

/**
 * Verificar si hay conciliaciones guardadas para el cliente/cuenta actual
 */
async function verificarConciliacionesGuardadas() {
    console.log('🔍 Verificando conciliaciones guardadas...');
    console.log('   Cliente ID:', state.clienteSeleccionado?.id);
    console.log('   Cuenta ID:', state.cuentaSeleccionada?.id);

    const conciliaciones = await cargarConciliacionesGuardadas();
    conciliacionesGuardadasLista = conciliaciones || [];

    console.log('📋 Conciliaciones encontradas:', conciliacionesGuardadasLista.length, conciliacionesGuardadasLista);

    // Actualizar estado del botón de gestión
    actualizarBotonGestionConciliaciones();

    if (conciliacionesGuardadasLista.length > 0) {
        console.log('✅ Mostrando modal con conciliaciones');
        mostrarModalConciliacionGuardada(conciliacionesGuardadasLista);
    } else {
        console.log('ℹ️ No hay conciliaciones guardadas para esta cuenta');
    }
}

/**
 * Actualizar estado del botón de gestión de conciliaciones
 */
function actualizarBotonGestionConciliaciones() {
    const btn = document.getElementById('btnGestionConciliaciones');
    if (btn) {
        btn.disabled = conciliacionesGuardadasLista.length === 0;
        if (conciliacionesGuardadasLista.length > 0) {
            btn.innerHTML = `<span>📂</span> Gestionar Conciliaciones (${conciliacionesGuardadasLista.length})`;
        } else {
            btn.innerHTML = `<span>📂</span> Gestionar Conciliaciones Guardadas`;
        }
    }
}

/**
 * Mostrar modal de conciliaciones guardadas con lista seleccionable
 */
function mostrarModalConciliacionGuardada(conciliaciones) {
    const overlay = document.getElementById('overlay-conciliacion-guardada');
    const modal = document.getElementById('modal-conciliacion-guardada');
    const lista = document.getElementById('conciliaciones-seleccion-lista');
    const btnCargar = document.getElementById('btnConfirmarCargarConciliacion');

    // Resetear selección
    conciliacionSeleccionadaId = null;
    if (btnCargar) btnCargar.disabled = true;

    // Generar lista de conciliaciones
    lista.innerHTML = conciliaciones.map(conciliacion => {
        const fechaGuardado = new Date(conciliacion.fecha_conciliacion);
        const fechaFormateada = fechaGuardado.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const datos = conciliacion.datos || {};
        const conciliadosArray = datos.conciliados || [];
        const movMayorConc = conciliadosArray.reduce((sum, c) => sum + (c.mayor ? c.mayor.length : 0), 0);
        const movExtractoConc = conciliadosArray.reduce((sum, c) => sum + (c.extracto ? c.extracto.length : 0), 0);
        const mayorPendiente = (datos.mayorNoConciliado || []).length;
        const extractoPendiente = (datos.extractoNoConciliado || []).length;

        const rangoDesde = conciliacion.rango_desde || 'N/A';
        const rangoHasta = conciliacion.rango_hasta || 'N/A';
        const nombre = conciliacion.nombre || `Conciliación ${conciliacion.tipo}`;

        return `
            <div class="conciliacion-seleccion-item" onclick="seleccionarConciliacionParaCargar('${conciliacion.id}', this)">
                <input type="radio" name="conciliacion-seleccion" value="${conciliacion.id}">
                <div class="conciliacion-seleccion-info">
                    <div class="conciliacion-seleccion-titulo">
                        ${nombre}
                        <span class="conciliacion-tipo-badge ${conciliacion.tipo}">${conciliacion.tipo === 'creditos' ? 'Créditos' : 'Débitos'}</span>
                    </div>
                    <div class="conciliacion-seleccion-detalles">
                        <span>📅 ${fechaFormateada}</span>
                        <span>📆 ${rangoDesde} a ${rangoHasta}</span>
                        <span>✅ ${movMayorConc}|${movExtractoConc} mov.</span>
                        <span>📋 ${mayorPendiente} pend.</span>
                        <span>🏦 ${extractoPendiente} ext.</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Seleccionar una conciliación para cargar
 */
function seleccionarConciliacionParaCargar(conciliacionId, elemento) {
    console.log('🎯 seleccionarConciliacionParaCargar llamada con ID:', conciliacionId, 'tipo:', typeof conciliacionId);

    // Quitar selección anterior
    document.querySelectorAll('.conciliacion-seleccion-item').forEach(item => {
        item.classList.remove('selected');
        item.querySelector('input[type="radio"]').checked = false;
    });

    // Marcar selección actual
    elemento.classList.add('selected');
    elemento.querySelector('input[type="radio"]').checked = true;
    conciliacionSeleccionadaId = conciliacionId;

    console.log('✅ conciliacionSeleccionadaId establecido:', conciliacionSeleccionadaId);

    // Habilitar botón
    const btnCargar = document.getElementById('btnConfirmarCargarConciliacion');
    if (btnCargar) btnCargar.disabled = false;
}

/**
 * Confirmar carga de conciliación seleccionada
 */
async function confirmarCargarConciliacionSeleccionada() {
    console.log('📂 confirmarCargarConciliacionSeleccionada - ID actual:', conciliacionSeleccionadaId, 'tipo:', typeof conciliacionSeleccionadaId);

    if (!conciliacionSeleccionadaId) {
        mostrarMensaje('Por favor, seleccione una conciliación', 'error');
        return;
    }

    // Guardar el ID antes de cerrar el modal (cerrar resetea la variable a null)
    const idACargar = conciliacionSeleccionadaId;
    cerrarModalConciliacionGuardada();
    await cargarConciliacionGuardada(idACargar);
}

/**
 * Cerrar modal de conciliación guardada
 */
function cerrarModalConciliacionGuardada() {
    const overlay = document.getElementById('overlay-conciliacion-guardada');
    const modal = document.getElementById('modal-conciliacion-guardada');

    overlay.classList.remove('visible');
    modal.classList.remove('visible');

    conciliacionSeleccionadaId = null;
}

// ========== GESTIÓN DE CONCILIACIONES ==========

/**
 * Abrir modal de gestión de conciliaciones
 */
async function abrirGestionConciliaciones() {
    if (!state.clienteSeleccionado || !state.cuentaSeleccionada) {
        mostrarMensaje('Debe seleccionar cliente y cuenta primero', 'error');
        return;
    }

    // Recargar lista de conciliaciones
    const conciliaciones = await cargarConciliacionesGuardadas();
    conciliacionesGuardadasLista = conciliaciones || [];

    const overlay = document.getElementById('overlay-gestion-conciliaciones');
    const modal = document.getElementById('modal-gestion-conciliaciones');
    const lista = document.getElementById('gestion-conciliaciones-lista');

    if (conciliacionesGuardadasLista.length === 0) {
        lista.innerHTML = `
            <div class="conciliaciones-vacio">
                <div class="conciliaciones-vacio-icon">📂</div>
                <p>No hay conciliaciones guardadas para esta cuenta</p>
            </div>
        `;
    } else {
        lista.innerHTML = conciliacionesGuardadasLista.map(conciliacion => {
            const fechaGuardado = new Date(conciliacion.fecha_conciliacion);
            const fechaFormateada = fechaGuardado.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const datos = conciliacion.datos || {};
            const conciliadosArray = datos.conciliados || [];
            const movMayorConc = conciliadosArray.reduce((sum, c) => sum + (c.mayor ? c.mayor.length : 0), 0);
            const movExtractoConc = conciliadosArray.reduce((sum, c) => sum + (c.extracto ? c.extracto.length : 0), 0);
            const mayorPendiente = (datos.mayorNoConciliado || []).length;
            const extractoPendiente = (datos.extractoNoConciliado || []).length;

            const rangoDesde = conciliacion.rango_desde || 'N/A';
            const rangoHasta = conciliacion.rango_hasta || 'N/A';
            const nombre = conciliacion.nombre || `Conciliación ${conciliacion.tipo}`;

            return `
                <div class="conciliacion-item">
                    <div class="conciliacion-info" onclick="cargarConciliacionDesdeGestion('${conciliacion.id}')">
                        <div class="conciliacion-nombre">
                            ${nombre}
                            <span class="conciliacion-tipo-badge ${conciliacion.tipo}">${conciliacion.tipo === 'creditos' ? 'Créditos' : 'Débitos'}</span>
                        </div>
                        <div class="conciliacion-meta">
                            <span class="conciliacion-meta-item">📅 ${fechaFormateada}</span>
                            <span class="conciliacion-meta-item">📆 ${rangoDesde} a ${rangoHasta}</span>
                            <span class="conciliacion-meta-item">✅ ${movMayorConc}|${movExtractoConc} mov.</span>
                            <span class="conciliacion-meta-item">📋 ${mayorPendiente} pend.</span>
                            <span class="conciliacion-meta-item">🏦 ${extractoPendiente} ext.</span>
                        </div>
                    </div>
                    <div class="conciliacion-acciones">
                        <button class="btn-cargar-conciliacion" onclick="cargarConciliacionDesdeGestion('${conciliacion.id}')">
                            📂 Cargar
                        </button>
                        <button class="btn-eliminar-conciliacion" onclick="confirmarEliminarConciliacion('${conciliacion.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Cerrar modal de gestión de conciliaciones
 */
function cerrarGestionConciliaciones() {
    const overlay = document.getElementById('overlay-gestion-conciliaciones');
    const modal = document.getElementById('modal-gestion-conciliaciones');

    overlay.classList.remove('visible');
    modal.classList.remove('visible');
}

/**
 * Cargar una conciliación desde el modal de gestión
 */
async function cargarConciliacionDesdeGestion(conciliacionId) {
    cerrarGestionConciliaciones();
    await cargarConciliacionGuardada(conciliacionId);
}

/**
 * Mostrar confirmación para eliminar una conciliación
 */
function confirmarEliminarConciliacion(conciliacionId) {
    const conciliacion = conciliacionesGuardadasLista.find(c => c.id === conciliacionId);
    if (!conciliacion) return;

    conciliacionAEliminar = conciliacion;

    const overlay = document.getElementById('overlay-confirmar-eliminar-conciliacion');
    const modal = document.getElementById('modal-confirmar-eliminar-conciliacion');
    const detalles = document.getElementById('eliminar-conciliacion-detalles');

    const fechaGuardado = new Date(conciliacion.fecha_conciliacion);
    const fechaFormateada = fechaGuardado.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const datos = conciliacion.datos || {};
    const conciliadosArray = datos.conciliados || [];
    const movMayorConc = conciliadosArray.reduce((sum, c) => sum + (c.mayor ? c.mayor.length : 0), 0);
    const movExtractoConc = conciliadosArray.reduce((sum, c) => sum + (c.extracto ? c.extracto.length : 0), 0);
    const nombre = conciliacion.nombre || `Conciliación ${conciliacion.tipo}`;

    detalles.innerHTML = `
        <div class="eliminar-item-info">
            <div class="eliminar-info-row">
                <span class="eliminar-label">Nombre:</span>
                <span class="eliminar-value">${nombre}</span>
            </div>
            <div class="eliminar-info-row">
                <span class="eliminar-label">Tipo:</span>
                <span class="eliminar-value">${conciliacion.tipo === 'creditos' ? 'Créditos' : 'Débitos'}</span>
            </div>
            <div class="eliminar-info-row">
                <span class="eliminar-label">Fecha guardada:</span>
                <span class="eliminar-value">${fechaFormateada}</span>
            </div>
            <div class="eliminar-info-row">
                <span class="eliminar-label">Movimientos conciliados:</span>
                <span class="eliminar-value">${movMayorConc} mayor | ${movExtractoConc} extracto</span>
            </div>
        </div>
    `;

    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Cerrar modal de confirmación de eliminación
 */
function cerrarConfirmarEliminarConciliacion() {
    const overlay = document.getElementById('overlay-confirmar-eliminar-conciliacion');
    const modal = document.getElementById('modal-confirmar-eliminar-conciliacion');

    overlay.classList.remove('visible');
    modal.classList.remove('visible');

    conciliacionAEliminar = null;
}

/**
 * Ejecutar eliminación de conciliación
 */
async function ejecutarEliminarConciliacion() {
    if (!conciliacionAEliminar) return;

    try {
        const { error } = await supabase
            .from('conciliaciones_guardadas')
            .delete()
            .eq('id', conciliacionAEliminar.id);

        if (error) throw error;

        mostrarMensaje('Conciliación eliminada correctamente', 'success');

        // Actualizar lista
        conciliacionesGuardadasLista = conciliacionesGuardadasLista.filter(
            c => c.id !== conciliacionAEliminar.id
        );

        cerrarConfirmarEliminarConciliacion();

        // Actualizar botón de gestión
        actualizarBotonGestionConciliaciones();

        // Si el modal de gestión está abierto, refrescarlo
        const modalGestion = document.getElementById('modal-gestion-conciliaciones');
        if (modalGestion.classList.contains('visible')) {
            abrirGestionConciliaciones();
        }

    } catch (error) {
        console.error('Error eliminando conciliación:', error);
        mostrarMensaje('Error al eliminar la conciliación: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// ========== ELIMINAR CONCILIACIÓN CARGADA ==========

/**
 * Actualizar visibilidad del botón de eliminar conciliación cargada
 */
function actualizarBotonEliminarConciliacionCargada() {
    const wrapper = document.getElementById('conciliacionCargadaWrapper');
    const nombreSpan = document.getElementById('nombreConciliacionCargada');

    if (wrapper && nombreSpan) {
        if (conciliacionCargadaId) {
            wrapper.classList.remove('hidden');
            nombreSpan.textContent = nombreConciliacionCargada || 'Conciliación sin nombre';
        } else {
            wrapper.classList.add('hidden');
        }
    }
}

/**
 * Mostrar confirmación para eliminar la conciliación cargada
 */
function confirmarEliminarConciliacionCargada() {
    if (!conciliacionCargadaId) {
        mostrarMensaje('No hay conciliación cargada para eliminar', 'error');
        return;
    }

    const overlay = document.getElementById('overlay-confirmar-eliminar-cargada');
    const modal = document.getElementById('modal-confirmar-eliminar-cargada');
    const detalles = document.getElementById('eliminar-cargada-detalles');

    if (!modal || !overlay) return;

    const conciliadosArray = state.resultados ? state.resultados.conciliados : [];
    const movMayorConc = conciliadosArray.reduce((sum, c) => sum + (c.mayor ? c.mayor.length : 0), 0);
    const movExtractoConc = conciliadosArray.reduce((sum, c) => sum + (c.extracto ? c.extracto.length : 0), 0);

    detalles.innerHTML = `
        <div class="eliminar-item-info">
            <div class="eliminar-info-row">
                <span class="eliminar-label">Nombre:</span>
                <span class="eliminar-value">${nombreConciliacionCargada}</span>
            </div>
            <div class="eliminar-info-row">
                <span class="eliminar-label">Tipo:</span>
                <span class="eliminar-value">${state.tipoConciliacion === 'creditos' ? 'Créditos' : 'Débitos'}</span>
            </div>
            <div class="eliminar-info-row">
                <span class="eliminar-label">Movimientos conciliados:</span>
                <span class="eliminar-value">${movMayorConc} mayor | ${movExtractoConc} extracto</span>
            </div>
        </div>
        <p class="eliminar-advertencia">⚠️ Esta acción no se puede deshacer. Se eliminarán todos los datos de esta conciliación.</p>
    `;

    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Cerrar modal de confirmar eliminación de conciliación cargada
 */
function cerrarConfirmarEliminarCargada() {
    const overlay = document.getElementById('overlay-confirmar-eliminar-cargada');
    const modal = document.getElementById('modal-confirmar-eliminar-cargada');

    if (overlay) overlay.classList.remove('visible');
    if (modal) modal.classList.remove('visible');
}

/**
 * Ejecutar eliminación de la conciliación cargada
 */
async function ejecutarEliminarConciliacionCargada() {
    if (!conciliacionCargadaId) return;

    try {
        const { error } = await supabase
            .from('conciliaciones_guardadas')
            .delete()
            .eq('id', conciliacionCargadaId);

        if (error) throw error;

        mostrarMensaje('Conciliación eliminada correctamente', 'success');

        // Actualizar lista local
        conciliacionesGuardadasLista = conciliacionesGuardadasLista.filter(
            c => c.id !== conciliacionCargadaId
        );

        // Limpiar referencia
        const idEliminado = conciliacionCargadaId;
        conciliacionCargadaId = null;
        nombreConciliacionCargada = null;

        cerrarConfirmarEliminarCargada();

        // Ocultar botón de eliminar
        actualizarBotonEliminarConciliacionCargada();

        // Actualizar botón de gestión
        actualizarBotonGestionConciliaciones();

        // Limpiar la vista y reiniciar el proceso
        limpiarVistaConciliacion();

        mostrarMensaje('Conciliación eliminada. Puede iniciar una nueva conciliación o cargar otra guardada.', 'info');

    } catch (error) {
        console.error('Error eliminando conciliación:', error);
        mostrarMensaje('Error al eliminar la conciliación: ' + (error.message || 'Error desconocido'), 'error');
    }
}

/**
 * Limpiar la vista de conciliación después de eliminar
 */
function limpiarVistaConciliacion() {
    // Limpiar resultados
    state.resultados = null;
    state.eliminados = [];

    // Ocultar sección de resultados
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
        resultsSection.classList.add('hidden');
    }

    // Limpiar tablas
    const tablaConciliadosVerdes = document.getElementById('tablaConciliadosVerdes');
    const tablaConciliadosNaranjas = document.getElementById('tablaConciliadosNaranjas');
    const tablaMayorPendiente = document.getElementById('tablaMayorPendiente');
    const tablaExtractoPendiente = document.getElementById('tablaExtractoPendiente');

    if (tablaConciliadosVerdes) tablaConciliadosVerdes.innerHTML = '';
    if (tablaConciliadosNaranjas) tablaConciliadosNaranjas.innerHTML = '';
    if (tablaMayorPendiente) tablaMayorPendiente.innerHTML = '';
    if (tablaExtractoPendiente) tablaExtractoPendiente.innerHTML = '';

    // Actualizar contadores
    actualizarContadoresGrupos();
}

// ========== ACTUALIZAR MAYOR CONTABLE ==========

// Variables para almacenar los movimientos del archivo de actualización
let movimientosArchivoActualizar = [];
let movimientosNuevosDetectados = [];

/**
 * Mostrar el modal para actualizar el mayor contable
 */
function mostrarModalActualizarMayor() {
    const modal = document.getElementById('modalActualizarMayor');
    const dropZone = document.getElementById('dropZoneActualizarMayor');
    const fileInput = document.getElementById('fileActualizarMayor');
    const preview = document.getElementById('previewActualizarMayor');

    // Reiniciar estado del modal
    movimientosArchivoActualizar = [];
    movimientosNuevosDetectados = [];
    preview.classList.add('hidden');
    dropZone.style.display = 'flex';

    // Configurar eventos de carga de archivo
    if (!dropZone.dataset.initialized) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                procesarArchivoActualizarMayor(e.target.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                procesarArchivoActualizarMayor(e.dataTransfer.files[0]);
            }
        });

        dropZone.dataset.initialized = 'true';
    }

    modal.classList.remove('hidden');
}

/**
 * Cerrar el modal de actualizar mayor
 */
function cerrarModalActualizarMayor() {
    const modal = document.getElementById('modalActualizarMayor');
    const fileInput = document.getElementById('fileActualizarMayor');

    modal.classList.add('hidden');
    fileInput.value = '';
    movimientosArchivoActualizar = [];
    movimientosNuevosDetectados = [];
}

/**
 * Procesar el archivo subido para actualizar el mayor
 */
async function procesarArchivoActualizarMayor(file) {
    const dropZone = document.getElementById('dropZoneActualizarMayor');
    const preview = document.getElementById('previewActualizarMayor');
    const btnConfirmar = document.getElementById('btnConfirmarActualizarMayor');

    try {
        // Leer y parsear el archivo Excel
        const data = await leerExcel(file);
        movimientosArchivoActualizar = parsearMayor(data);

        // Determinar el tipo de movimiento según el tipo de conciliación
        // Para créditos: esDebe = true (debe > 0), Para débitos: esDebe = false (haber > 0)
        const esDebeActual = state.tipoConciliacion === 'creditos';

        // Filtrar movimientos del archivo según el tipo de conciliación ANTES de procesar
        const movimientosDelTipoCorrecto = movimientosArchivoActualizar.filter(m => m.esDebe === esDebeActual);

        // Obtener los números de asiento existentes (solo del mismo tipo de movimiento)
        const numerosAsientoExistentes = new Set();
        let debugCounts = { conciliados: 0, mayorNoConciliado: 0, datosMayor: 0, eliminados: 0 };

        // Helper para determinar si un movimiento es de tipo "debe" (puede no tener esDebe si viene de conciliación guardada)
        const esMovimientoDebe = (m) => {
            if (typeof m.esDebe === 'boolean') return m.esDebe;
            // Calcular basándose en debe/haber si esDebe no está definido
            return (m.debe || 0) > 0;
        };

        // Desde los conciliados (solo del tipo actual)
        if (state.resultados && state.resultados.conciliados) {
            state.resultados.conciliados.forEach(c => {
                if (c.mayor && Array.isArray(c.mayor)) {
                    c.mayor.forEach(m => {
                        if (m.numeroAsiento && esMovimientoDebe(m) === esDebeActual) {
                            numerosAsientoExistentes.add(String(m.numeroAsiento).trim());
                            debugCounts.conciliados++;
                        }
                    });
                }
            });
        }

        // Desde el mayor no conciliado (solo del tipo actual)
        if (state.resultados && state.resultados.mayorNoConciliado) {
            state.resultados.mayorNoConciliado.forEach(m => {
                if (m.numeroAsiento && esMovimientoDebe(m) === esDebeActual) {
                    numerosAsientoExistentes.add(String(m.numeroAsiento).trim());
                    debugCounts.mayorNoConciliado++;
                }
            });
        }

        // Desde los datos originales del mayor (solo del tipo actual)
        if (state.datosMayor) {
            state.datosMayor.forEach(m => {
                if (m.numeroAsiento && esMovimientoDebe(m) === esDebeActual) {
                    numerosAsientoExistentes.add(String(m.numeroAsiento).trim());
                    debugCounts.datosMayor++;
                }
            });
        }

        // Desde los movimientos eliminados (solo del tipo actual)
        if (state.eliminados && state.eliminados.length > 0) {
            state.eliminados.forEach(m => {
                if (m.numeroAsiento && esMovimientoDebe(m) === esDebeActual) {
                    numerosAsientoExistentes.add(String(m.numeroAsiento).trim());
                    debugCounts.eliminados++;
                }
            });
        }

        console.log('Detección asientos nuevos - números existentes encontrados:', numerosAsientoExistentes.size,
            'por fuente:', debugCounts, 'esDebeActual:', esDebeActual);

        // Filtrar movimientos nuevos del tipo correcto (que no existen por número de asiento)
        movimientosNuevosDetectados = movimientosDelTipoCorrecto.filter(m => {
            const numAsiento = String(m.numeroAsiento || '').trim();
            return numAsiento && !numerosAsientoExistentes.has(numAsiento);
        });

        // Calcular estadísticas (solo del tipo correcto según la conciliación)
        const totalArchivo = movimientosArchivoActualizar.length;
        const totalDelTipo = movimientosDelTipoCorrecto.length;
        const nuevos = movimientosNuevosDetectados.length;
        const existentes = totalDelTipo - nuevos;
        const ignorados = totalArchivo - totalDelTipo;
        const tipoTexto = state.tipoConciliacion === 'debitos' ? 'débitos' : 'créditos';

        // Actualizar UI - mostrar total del tipo correcto y mencionar ignorados si hay
        let textoTotal = `${totalDelTipo} ${tipoTexto}`;
        if (ignorados > 0) {
            textoTotal += ` (${ignorados} ${state.tipoConciliacion === 'debitos' ? 'créditos' : 'débitos'} ignorados)`;
        }
        document.getElementById('totalMovimientosArchivo').textContent = textoTotal;
        document.getElementById('movimientosNuevos').textContent = nuevos;
        document.getElementById('movimientosExistentes').textContent = existentes;

        // Mostrar/ocultar botón según si hay nuevos
        if (nuevos > 0) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = `✅ Agregar ${nuevos} movimiento${nuevos > 1 ? 's' : ''} nuevo${nuevos > 1 ? 's' : ''}`;
        } else {
            btnConfirmar.disabled = true;
            btnConfirmar.textContent = 'No hay movimientos nuevos para agregar';
        }

        // Mostrar preview y ocultar dropzone
        dropZone.style.display = 'none';
        preview.classList.remove('hidden');

    } catch (error) {
        console.error('Error procesando archivo:', error);
        mostrarMensaje('Error al procesar el archivo: ' + error.message, 'error');
    }
}

/**
 * Confirmar y agregar los movimientos nuevos al mayor no conciliado
 */
function confirmarActualizarMayor() {
    if (movimientosNuevosDetectados.length === 0) {
        mostrarMensaje('No hay movimientos nuevos para agregar', 'error');
        return;
    }

    // Filtrar según el tipo de conciliación actual (débitos o créditos)
    let movimientosFiltrados;
    if (state.tipoConciliacion === 'creditos') {
        // Para créditos: movimientos con Debe > 0 (esDebe = true)
        movimientosFiltrados = movimientosNuevosDetectados.filter(m => m.esDebe);
    } else {
        // Para débitos: movimientos con Haber > 0 (esDebe = false)
        movimientosFiltrados = movimientosNuevosDetectados.filter(m => !m.esDebe);
    }

    if (movimientosFiltrados.length === 0) {
        mostrarMensaje(`No hay movimientos nuevos de ${state.tipoConciliacion} para agregar`, 'error');
        cerrarModalActualizarMayor();
        return;
    }

    // Generar IDs únicos para los nuevos movimientos
    const maxIdActual = obtenerMaxIdMayor();
    movimientosFiltrados = movimientosFiltrados.map((m, index) => ({
        ...m,
        id: `M${maxIdActual + index + 1}`,
        usado: false
    }));

    // Agregar al mayor no conciliado
    if (!state.resultados) {
        state.resultados = {
            conciliados: [],
            mayorNoConciliado: [],
            extractoNoConciliado: []
        };
    }

    state.resultados.mayorNoConciliado = [
        ...state.resultados.mayorNoConciliado,
        ...movimientosFiltrados
    ];

    // También agregar a datosMayor para futuras referencias
    if (state.datosMayor) {
        state.datosMayor = [...state.datosMayor, ...movimientosFiltrados];
    }

    // Actualizar UI
    mostrarResultados(state.resultados);

    // Cerrar modal y mostrar mensaje
    cerrarModalActualizarMayor();
    mostrarMensaje(`Se agregaron ${movimientosFiltrados.length} movimientos nuevos al mayor no conciliado`, 'success');
}

/**
 * Obtener el máximo ID numérico del mayor existente
 */
function obtenerMaxIdMayor() {
    let maxId = 0;

    const extraerId = (id) => {
        if (typeof id === 'string' && id.startsWith('M')) {
            const num = parseInt(id.substring(1), 10);
            if (!isNaN(num) && num > maxId) {
                maxId = num;
            }
        }
    };

    // Revisar conciliados
    if (state.resultados && state.resultados.conciliados) {
        state.resultados.conciliados.forEach(c => {
            if (c.mayor && Array.isArray(c.mayor)) {
                c.mayor.forEach(m => extraerId(m.id));
            }
        });
    }

    // Revisar mayor no conciliado
    if (state.resultados && state.resultados.mayorNoConciliado) {
        state.resultados.mayorNoConciliado.forEach(m => extraerId(m.id));
    }

    // Revisar datos originales
    if (state.datosMayor) {
        state.datosMayor.forEach(m => extraerId(m.id));
    }

    return maxId;
}

// ========== UTILIDADES ==========

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return '';

    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();

    return `${dia}/${mes}/${anio}`;
}

function formatearNumero(num) {
    if (num === null || num === undefined || num === '') return '';
    return Number(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearMoneda(num) {
    return '$' + formatearNumero(num);
}

function truncar(texto, maxLen) {
    if (!texto) return '';
    return texto.length > maxLen ? texto.substring(0, maxLen) + '...' : texto;
}

// Verifica si hay al menos N palabras coincidentes entre dos textos
// Ignora palabras cortas (<=2 caracteres) y normaliza el texto
function tieneCoincidenciaPalabras(texto1, texto2, minimoCoincidencias = 1) {
    if (!texto1 || !texto2) return false;

    // Normalizar: quitar acentos, convertir a minúsculas, quitar caracteres especiales
    const normalizar = (texto) => {
        return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/[^a-z0-9\s]/g, ' ')    // Reemplazar caracteres especiales por espacios
            .split(/\s+/)                     // Separar por espacios
            .filter(palabra => palabra.length > 2); // Ignorar palabras muy cortas
    };

    const palabras1 = new Set(normalizar(texto1));
    const palabras2 = normalizar(texto2);

    let coincidencias = 0;
    for (const palabra of palabras2) {
        if (palabras1.has(palabra)) {
            coincidencias++;
            if (coincidencias >= minimoCoincidencias) return true;
        }
    }

    return false;
}

// Verifica coincidencia de palabras para un match de conciliación
// Compara todas las leyendas del mayor con todas las descripciones del extracto
function matchTieneCoincidenciaDescripcion(match) {
    if (!match.mayor || !match.extracto) return false;

    for (const m of match.mayor) {
        for (const e of match.extracto) {
            if (tieneCoincidenciaPalabras(m.leyenda, e.descripcion, 1)) {
                return true;
            }
        }
    }
    return false;
}

function mostrarMensaje(mensaje, tipo) {
    if (tipo === 'clear') {
        elements.errorBox.classList.add('hidden');
        elements.successBox.classList.add('hidden');
        return;
    }

    if (tipo === 'error') {
        elements.errorBox.textContent = mensaje;
        elements.errorBox.classList.remove('hidden');
        elements.successBox.classList.add('hidden');
    } else {
        elements.successBox.textContent = mensaje;
        elements.successBox.classList.remove('hidden');
        elements.errorBox.classList.add('hidden');
    }
}

function reiniciar() {
    // Resetear estado
    state = {
        tipoConciliacion: null,
        datosMayor: [],
        datosExtracto: [],
        toleranciaFecha: 0,
        toleranciaImporte: 0,
        exigenciaPalabras: 2,
        resultados: null,
        eliminados: [],
        // Integración con auditoría
        fuenteExtracto: 'archivo',
        clienteSeleccionado: null,
        cuentaSeleccionada: null,
        extractosAuditoria: [],
        rangoExtractos: { desde: null, hasta: null },
        // Administración del mayor
        mayorAdministrado: false,
        filtrosMayorAdmin: {},
        filtroCategoriaMayorAdmin: [],
        // Control de vista inicial de pendientes
        vistaInicialMostrada: false,
        datosVistaInicial: null
    };

    // Ocultar panel de administración del mayor
    ocultarAdminMayor();

    // Resetear selección y contador
    seleccion = { mayor: [], extracto: [] };
    seleccionConciliados = [];
    conciliacionIdCounter = 0;

    // Resetear filtros
    resetearFiltros();

    // Resetear ordenamiento
    resetearOrdenamiento();

    // Resetear UI
    elements.tipoButtons.forEach(btn => btn.classList.remove('active'));

    // Ocultar todos los pasos excepto el primero (cliente)
    elements.stepCuenta.classList.add('hidden');
    elements.stepMayor.classList.add('hidden');
    elements.stepTipo.classList.add('hidden');
    elements.stepArchivos.classList.add('hidden');
    elements.stepTolerancias.classList.add('hidden');
    elements.stepEjecutar.classList.add('hidden');
    elements.resultados.classList.add('hidden');
    elements.selectionBar.classList.add('hidden');

    // Resetear selectores de cliente y cuenta
    if (elements.clienteSelectPrincipal) {
        elements.clienteSelectPrincipal.value = '';
    }
    if (elements.clienteSearchPrincipal) {
        elements.clienteSearchPrincipal.value = '';
    }
    if (elements.clienteSeleccionadoInfo) {
        elements.clienteSeleccionadoInfo.classList.add('hidden');
    }
    if (elements.cuentaSelectPrincipal) {
        elements.cuentaSelectPrincipal.value = '';
    }
    if (elements.cuentaSeleccionadaInfo) {
        elements.cuentaSeleccionadaInfo.classList.add('hidden');
    }
    if (elements.rangoExtractosSection) {
        elements.rangoExtractosSection.classList.add('hidden');
    }
    if (elements.extractoPreviewInfo) {
        elements.extractoPreviewInfo.classList.add('hidden');
    }

    // Re-poblar selector de clientes
    if (auditoriaData.clientes.length > 0) {
        poblarSelectorClientesPrincipal(auditoriaData.clientes);
    }

    // Resetear archivos
    eliminarArchivo('mayor');
    eliminarArchivo('extracto');

    // Resetear tolerancias a valores sugeridos para proceso inicial
    elements.toleranciaFecha.value = 0;
    elements.toleranciaImporte.value = 0;
    if (elements.exigenciaPalabras) {
        elements.exigenciaPalabras.value = 2;
    }

    // Resetear tabs
    cambiarTab('conciliados');

    // Limpiar mensajes
    mostrarMensaje('', 'clear');

    // Scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Resetear historial y tolerancias iniciales
    historialProcesamiento = [];
    toleranciasIniciales = { fecha: null, importe: null };

    // Ocultar panel de reproceso e historial
    if (elements.panelReproceso) {
        elements.panelReproceso.classList.add('hidden');
    }
    if (elements.historialProcesamiento) {
        elements.historialProcesamiento.classList.add('hidden');
    }

    // Resetear integración con auditoría
    resetearAuditoria();
}

/**
 * Resetear la sección de auditoría
 */
function resetearAuditoria() {
    // Resetear radios a archivo
    const radioArchivo = document.querySelector('input[name="fuenteExtracto"][value="archivo"]');
    if (radioArchivo) {
        radioArchivo.checked = true;
    }

    // Mostrar sección archivo, ocultar auditoría
    const archivoSection = document.getElementById('extractoArchivoSection');
    const auditoriaSection = document.getElementById('extractoAuditoriaSection');
    if (archivoSection) archivoSection.classList.remove('hidden');
    if (auditoriaSection) auditoriaSection.classList.add('hidden');

    // Resetear selectores de auditoría
    const clienteSelect = document.getElementById('clienteSelect');
    const cuentaSelect = document.getElementById('cuentaSelect');
    const rangoDesde = document.getElementById('rangoDesde');
    const rangoHasta = document.getElementById('rangoHasta');

    if (clienteSelect) clienteSelect.value = '';
    if (cuentaSelect) {
        cuentaSelect.innerHTML = '<option value="">-- Seleccione una cuenta --</option>';
        cuentaSelect.disabled = true;
    }
    if (rangoDesde) {
        rangoDesde.innerHTML = '<option value="">-- Mes/Año --</option>';
        rangoDesde.disabled = true;
    }
    if (rangoHasta) {
        rangoHasta.innerHTML = '<option value="">-- Mes/Año --</option>';
        rangoHasta.disabled = true;
    }

    // Ocultar preview
    document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');

    // Resetear estado del status
    actualizarEstadoAuditoria('info', 'Seleccione un cliente y cuenta para cargar los extractos disponibles');

    // Limpiar cache de cuentas y extractos
    auditoriaCache.cuentas = [];
    auditoriaCache.extractosDisponibles = [];
}

// ========== REPROCESAMIENTO DE PENDIENTES ==========

/**
 * Alterna la visibilidad del cuerpo del panel de reprocesamiento
 */
function togglePanelReproceso() {
    const body = elements.panelReprocesoBody;
    const btn = elements.btnToggleReproceso;

    if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        btn.textContent = '▼';
    } else {
        body.classList.add('collapsed');
        btn.textContent = '▶';
    }
}

/**
 * Alterna la visibilidad del historial de procesamiento
 */
function toggleHistorial() {
    const body = elements.historialBody;
    const btn = elements.btnToggleHistorial;

    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        btn.textContent = 'Ocultar';
    } else {
        body.classList.add('hidden');
        btn.textContent = 'Mostrar';
    }
}

/**
 * Actualiza el panel de reprocesamiento con los datos actuales
 */
function actualizarPanelReproceso() {
    if (!state.resultados) return;

    const mayorPendiente = state.resultados.mayorNoConciliado.length;
    const extractoPendiente = state.resultados.extractoNoConciliado.length;

    // Actualizar contadores
    elements.reprocesoPendientesMayor.textContent = mayorPendiente;
    elements.reprocesoPendientesExtracto.textContent = extractoPendiente;

    // Habilitar/deshabilitar botón según si hay pendientes
    const hayPendientes = mayorPendiente > 0 && extractoPendiente > 0;
    elements.btnReprocesar.disabled = !hayPendientes;

    if (!hayPendientes) {
        elements.btnReprocesar.title = 'No hay movimientos pendientes para reprocesar';
    } else {
        elements.btnReprocesar.title = '';
    }

    // Actualizar info de desconciliaciones manuales
    actualizarInfoDesconciliaciones();

    // Mostrar panel si hay resultados
    elements.panelReproceso.classList.remove('hidden');
}

/**
 * Actualiza la UI con información de desconciliaciones manuales
 */
function actualizarInfoDesconciliaciones() {
    const infoDiv = document.getElementById('desconciliaciones-info');
    const countSpan = document.getElementById('countDesconciliaciones');

    if (!infoDiv || !countSpan) return;

    const count = desconciliacionesManuales.length;

    if (count > 0) {
        countSpan.textContent = count;
        infoDiv.classList.remove('hidden');
    } else {
        infoDiv.classList.add('hidden');
    }
}

/**
 * Formatea la duración en milisegundos a un formato legible
 * @param {number} ms - Duración en milisegundos
 * @returns {string} - Duración formateada
 */
function formatearDuracion(ms) {
    if (!ms || ms <= 0) return '';

    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;

    if (minutos > 0) {
        return `${minutos}m ${segundosRestantes}s`;
    } else if (segundos > 0) {
        return `${segundos}s`;
    } else {
        return `${ms}ms`;
    }
}

/**
 * Actualiza el historial de procesamiento en la UI
 */
function actualizarHistorial() {
    if (historialProcesamiento.length === 0) {
        elements.historialProcesamiento.classList.add('hidden');
        return;
    }

    elements.historialProcesamiento.classList.remove('hidden');

    let html = '';
    let totalConciliados = 0;
    let contadorAutomatico = 0;
    let contadorManual = 0;

    historialProcesamiento.forEach((item, idx) => {
        totalConciliados += item.conciliados;

        // Determinar tipo y prefijo
        const esManual = item.tipo === 'manual';
        const tipoClase = esManual ? 'historial-item-manual' : 'historial-item-automatico';

        let prefijo;
        if (esManual) {
            contadorManual++;
            prefijo = contadorManual === 1 ? 'Vinculación manual' : `Vinculación manual ${contadorManual}`;
        } else {
            if (item.esInicial) {
                prefijo = 'Procesamiento inicial';
            } else {
                contadorAutomatico++;
                prefijo = `Reproceso ${contadorAutomatico}`;
            }
        }

        const signo = idx === 0 ? '' : '+';
        const palabrasTexto = item.exigenciaPalabras !== undefined
            ? `, ${item.exigenciaPalabras} pal.`
            : '';

        // Formatear duración
        const duracionTexto = item.duracion ? ` (${formatearDuracion(item.duracion)})` : '';

        // Descripción de parámetros (solo para procesos automáticos)
        const parametrosTexto = esManual
            ? ''
            : ` (${item.toleranciaFecha} días, $${item.toleranciaImporte.toLocaleString('es-AR')}${palabrasTexto})`;

        html += `
            <div class="historial-item ${tipoClase}">
                <span class="historial-numero">${idx + 1}.</span>
                <span class="historial-descripcion">${prefijo}${parametrosTexto}${duracionTexto}</span>
                <span class="historial-resultado">→ ${signo}${item.conciliados} conciliados</span>
            </div>
        `;
    });

    elements.historialLista.innerHTML = html;
    elements.historialTotalConciliados.textContent = totalConciliados;
}

/**
 * Configuraciones sugeridas para cada reproceso.
 * Los primeros 6 procesos tienen sugerencias predefinidas.
 */
const SUGERENCIAS_REPROCESO = [
    // Proceso inicial (índice 0) - Se maneja con valores por defecto en UI
    { toleranciaFecha: 0, toleranciaImporte: 0, exigenciaPalabras: 2, mensaje: 'Proceso inicial: Parámetros sugeridos para máxima precisión. Se recomienda comenzar con 0 días, $0 y 2 palabras de exigencia.' },
    // Reproceso 1 (índice 1) - Reducir a 1 palabra
    { toleranciaFecha: 0, toleranciaImporte: 0, exigenciaPalabras: 1, mensaje: 'Reproceso 1: Mantener tolerancias estrictas, reducir exigencia a 1 palabra coincidente.' },
    // Reproceso 2 (índice 2) - Sin exigencia de palabras
    { toleranciaFecha: 0, toleranciaImporte: 0, exigenciaPalabras: 0, mensaje: 'Reproceso 2: Sin exigencia de palabras, mantener tolerancias de fecha e importe estrictas.' },
    // Reproceso 3 (índice 3) - Ampliar tolerancias, volver a 2 palabras
    { toleranciaFecha: 1, toleranciaImporte: 1, exigenciaPalabras: 2, mensaje: 'Reproceso 3: Ampliar tolerancias (1 día, $1), volver a exigir 2 palabras coincidentes.' },
    // Reproceso 4 (índice 4) - 1 palabra con tolerancias ampliadas
    { toleranciaFecha: 1, toleranciaImporte: 1, exigenciaPalabras: 1, mensaje: 'Reproceso 4: Mantener tolerancias ampliadas, reducir exigencia a 1 palabra.' },
    // Reproceso 5 (índice 5) - Sin exigencia de palabras con tolerancias
    { toleranciaFecha: 1, toleranciaImporte: 1, exigenciaPalabras: 0, mensaje: 'Reproceso 5: Sin exigencia de palabras, tolerancias ampliadas. Último reproceso sugerido.' }
];

/**
 * Actualiza los valores sugeridos y mensajes para el próximo reproceso
 */
function actualizarSugerenciasReproceso() {
    const numReproceso = historialProcesamiento.length; // Esto da el número del próximo reproceso

    // Si hay más de 6 reprocesos, no hay sugerencias predefinidas
    if (numReproceso >= SUGERENCIAS_REPROCESO.length) {
        // Mostrar mensaje genérico
        if (elements.mensajeSugerenciaReproceso) {
            const texto = elements.mensajeSugerenciaReproceso.querySelector('.sugerencia-texto');
            if (texto) {
                texto.textContent = `Reproceso ${numReproceso}: Parámetros libres a configurar según necesidad.`;
            }
        }
        return;
    }

    const sugerencia = SUGERENCIAS_REPROCESO[numReproceso];

    // Actualizar valores en el panel de reproceso
    if (elements.reprocesoToleranciaFecha) {
        elements.reprocesoToleranciaFecha.value = sugerencia.toleranciaFecha;
    }
    if (elements.reprocesoToleranciaImporte) {
        elements.reprocesoToleranciaImporte.value = sugerencia.toleranciaImporte;
    }
    if (elements.reprocesoExigenciaPalabras) {
        elements.reprocesoExigenciaPalabras.value = sugerencia.exigenciaPalabras;
    }

    // Actualizar mensaje de sugerencia
    if (elements.mensajeSugerenciaReproceso) {
        const texto = elements.mensajeSugerenciaReproceso.querySelector('.sugerencia-texto');
        if (texto) {
            texto.textContent = sugerencia.mensaje;
        }
    }
}

/**
 * Guarda el procesamiento inicial en el historial
 * @param {number} cantidadConciliados - Cantidad de movimientos conciliados
 * @param {number} duracion - Duración del proceso en milisegundos
 */
function guardarProcesamientoInicial(cantidadConciliados, duracion = 0) {
    toleranciasIniciales = {
        fecha: state.toleranciaFecha,
        importe: state.toleranciaImporte,
        palabras: state.exigenciaPalabras
    };

    historialProcesamiento = [{
        fecha: new Date().toISOString(),
        toleranciaFecha: state.toleranciaFecha,
        toleranciaImporte: state.toleranciaImporte,
        exigenciaPalabras: state.exigenciaPalabras,
        conciliados: cantidadConciliados,
        esInicial: true,
        tipo: 'automatico',
        duracion: duracion
    }];

    actualizarHistorial();

    // Actualizar sugerencias para el primer reproceso
    actualizarSugerenciasReproceso();
}

/**
 * Reprocesa los movimientos pendientes con nuevos parámetros de tolerancia
 */
async function reprocesarPendientes() {
    try {
        // Obtener nuevos parámetros
        // IMPORTANTE: No usar || porque 0 es un valor válido (coincidencia exacta)
        const valorFecha = parseInt(elements.reprocesoToleranciaFecha.value);
        const valorImporte = parseFloat(elements.reprocesoToleranciaImporte.value);
        const valorPalabras = parseInt(elements.reprocesoExigenciaPalabras.value);
        const nuevaToleranciaFecha = isNaN(valorFecha) ? 0 : valorFecha;
        const nuevaToleranciaImporte = isNaN(valorImporte) ? 0 : valorImporte;
        const nuevaExigenciaPalabras = isNaN(valorPalabras) ? 1 : valorPalabras;

        // Validar que hay movimientos pendientes
        if (state.resultados.mayorNoConciliado.length === 0 || state.resultados.extractoNoConciliado.length === 0) {
            mostrarMensaje('No hay movimientos pendientes para reprocesar', 'error');
            return;
        }

        // Verificar si los parámetros son iguales a la última ejecución
        const ultimoProceso = historialProcesamiento[historialProcesamiento.length - 1];
        if (ultimoProceso &&
            ultimoProceso.toleranciaFecha === nuevaToleranciaFecha &&
            ultimoProceso.toleranciaImporte === nuevaToleranciaImporte &&
            ultimoProceso.exigenciaPalabras === nuevaExigenciaPalabras) {
            if (!confirm('Los parámetros son iguales al último procesamiento. ¿Desea continuar de todos modos?')) {
                return;
            }
        }

        // Mostrar progreso
        mostrarModalProgreso();

        // Iniciar contador de tiempo
        const tiempoInicio = Date.now();

        actualizarPaso(1, 'Iniciando reprocesamiento...');
        actualizarProgreso(5);
        actualizarConciliados(0); // Inicializar contador de conciliados
        await sleep(100);

        // Guardar referencia a conciliados actuales (no se tocan)
        const conciliadosPrevios = [...state.resultados.conciliados];
        const eliminadosPrevios = [...state.eliminados];

        // Crear copias de los pendientes para procesar
        const mayorPendiente = state.resultados.mayorNoConciliado.map(m => ({...m, usado: false}));
        const extractoPendiente = state.resultados.extractoNoConciliado.map(e => ({...e, usado: false}));

        // Actualizar tolerancias temporalmente para el algoritmo
        const toleranciaFechaOriginal = state.toleranciaFecha;
        const toleranciaImporteOriginal = state.toleranciaImporte;
        const exigenciaPalabrasOriginal = state.exigenciaPalabras;
        state.toleranciaFecha = nuevaToleranciaFecha;
        state.toleranciaImporte = nuevaToleranciaImporte;
        state.exigenciaPalabras = nuevaExigenciaPalabras;

        // Ejecutar conciliación SOLO con pendientes
        actualizarPaso(2, 'Buscando coincidencias exactas (1:1)...');
        actualizarProgreso(20);
        await sleep(100);

        // Callback para actualizar progreso durante el reproceso
        const onProgresoReproceso = (fase, porcentaje, mensaje, conciliadosActuales = 0) => {
            // Fase va de 1 a 3, mapeamos a progreso 20-70
            const progresoBase = 20 + (fase - 1) * 16;
            const progresoFinal = progresoBase + Math.floor(porcentaje * 0.16);
            actualizarPaso(2, mensaje);
            actualizarProgreso(Math.min(progresoFinal, 70));
            // Actualizar contador de conciliados en tiempo real
            if (conciliadosActuales > 0) {
                actualizarConciliados(conciliadosActuales);
            }
        };

        const resultadosReproceso = await conciliarReproceso(mayorPendiente, extractoPendiente, onProgresoReproceso);

        // Restaurar tolerancias originales
        state.toleranciaFecha = toleranciaFechaOriginal;
        state.toleranciaImporte = toleranciaImporteOriginal;
        state.exigenciaPalabras = exigenciaPalabrasOriginal;

        actualizarPaso(3, 'Actualizando resultados...');
        actualizarProgreso(75);
        await sleep(100);

        // Marcar nuevas conciliaciones como resultado de reproceso
        const nuevosConciliados = resultadosReproceso.conciliados.map(c => ({
            ...c,
            reproceso: true,
            parametrosReproceso: {
                toleranciaFecha: nuevaToleranciaFecha,
                toleranciaImporte: nuevaToleranciaImporte,
                exigenciaPalabras: nuevaExigenciaPalabras,
                numeroReproceso: historialProcesamiento.length
            }
        }));

        // Agregar nuevas conciliaciones a las existentes
        state.resultados.conciliados = [
            ...conciliadosPrevios,
            ...nuevosConciliados
        ];

        // Actualizar pendientes (quitar los que conciliaron)
        state.resultados.mayorNoConciliado = resultadosReproceso.mayorNoConciliado;
        state.resultados.extractoNoConciliado = resultadosReproceso.extractoNoConciliado;

        // Mantener eliminados
        state.eliminados = eliminadosPrevios;

        // Calcular duración del proceso
        const duracion = Date.now() - tiempoInicio;

        // Guardar en historial
        historialProcesamiento.push({
            fecha: new Date().toISOString(),
            toleranciaFecha: nuevaToleranciaFecha,
            toleranciaImporte: nuevaToleranciaImporte,
            exigenciaPalabras: nuevaExigenciaPalabras,
            conciliados: nuevosConciliados.length,
            esInicial: false,
            tipo: 'automatico',
            duracion: duracion
        });

        // Actualizar sugerencias para el próximo reproceso
        actualizarSugerenciasReproceso();

        actualizarPaso(4, 'Finalizando...');
        actualizarProgreso(95);
        await sleep(100);

        // Actualizar vistas
        mostrarResultados();
        actualizarHistorial();
        actualizarPanelReproceso();

        // Completar progreso
        actualizarProgreso(100, '¡Reprocesamiento completado!');
        await sleep(500);

        cerrarModalProgreso();

        // Mostrar resumen
        mostrarResumenReproceso(nuevosConciliados.length);

    } catch (error) {
        cerrarModalProgreso();
        mostrarMensaje(`Error en el reprocesamiento: ${error.message}`, 'error');
    }
}

/**
 * Versión simplificada de conciliar para reprocesamiento
 * No actualiza la UI con tanta frecuencia ya que los conjuntos son más pequeños
 * IMPORTANTE: Respeta las desconciliaciones manuales previas
 * @param {Array} mayor - Movimientos del mayor pendientes
 * @param {Array} extracto - Movimientos del extracto pendientes
 * @param {Function} onProgreso - Callback para actualizar progreso (fase, porcentaje, mensaje, conciliadosActuales)
 */
async function conciliarReproceso(mayor, extracto, onProgreso = null) {
    const conciliados = [];
    const mayorNoConciliado = [...mayor];
    const extractoNoConciliado = [...extracto];

    console.log('conciliarReproceso - desconciliaciones manuales a respetar:', desconciliacionesManuales.length);
    console.log('conciliarReproceso - mayor pendiente:', mayorNoConciliado.length, 'extracto pendiente:', extractoNoConciliado.length);

    const totalMayor = mayorNoConciliado.length;
    const totalExtracto = extractoNoConciliado.length;

    // Paso 1: Buscar coincidencias exactas (1 a 1)
    if (onProgreso) onProgreso(1, 0, 'Buscando coincidencias exactas (1:1)...', 0);

    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];
        const idxCoincidencia = buscarCoincidenciaExacta(movMayor, extractoNoConciliado);

        if (idxCoincidencia !== -1) {
            const movExtracto = extractoNoConciliado[idxCoincidencia];

            // Verificar si este par fue desconciliado manualmente
            if (fueDesconciliadoManualmente([movMayor.id], [movExtracto.id])) {
                console.log('Omitiendo conciliación 1:1 por desconciliación manual previa:', movMayor.id, movExtracto.id);
                continue;
            }

            const diferencia = Math.abs(movMayor.importe - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:1',
                mayor: [movMayor],
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            extractoNoConciliado.splice(idxCoincidencia, 1);
        }

        // Yield para no bloquear UI y actualizar progreso
        if (i % 20 === 0) {
            const porcentaje = totalMayor > 0 ? Math.floor(((totalMayor - i) / totalMayor) * 100) : 100;
            if (onProgreso) onProgreso(1, porcentaje, `Buscando coincidencias exactas (1:1)... ${totalMayor - i}/${totalMayor}`, conciliados.length);
            await sleep(0);
        }
    }

    console.log('conciliarReproceso - Paso 1 completado, encontrados:', conciliados.filter(c => c.tipo === '1:1').length);

    // Paso 2: Buscar coincidencias 1 a muchos
    if (onProgreso) onProgreso(2, 0, 'Buscando coincidencias (1:N)...', conciliados.length);

    const mayorParaN = mayorNoConciliado.length;
    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movMayor.importe,
            movMayor.fecha,
            extractoNoConciliado,
            5,
            false,
            null,
            movMayor.categoria || '', // Categoría del mayor para filtrar extractos compatibles
            movMayor.leyenda || '', // Texto de referencia para validar coincidencia de palabras
            false // La lista es de extractos
        );

        if (combinacion) {
            // Verificar si este par fue desconciliado manualmente
            const extractoIds = combinacion.map(e => e.id);
            if (fueDesconciliadoManualmente([movMayor.id], extractoIds)) {
                console.log('Omitiendo conciliación 1:N por desconciliación manual previa:', movMayor.id, extractoIds);
                continue;
            }

            const sumaExtracto = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(movMayor.importe - sumaExtracto);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:N',
                mayor: [movMayor],
                extracto: combinacion,
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = extractoNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) extractoNoConciliado.splice(idx, 1);
            });
        }

        // Yield en cada iteración para evitar que el navegador se cuelgue
        // La búsqueda de combinaciones es muy costosa con muchos movimientos
        const porcentaje = mayorParaN > 0 ? Math.floor(((mayorParaN - i) / mayorParaN) * 100) : 100;
        if (onProgreso) onProgreso(2, porcentaje, `Buscando coincidencias (1:N)... ${mayorParaN - i}/${mayorParaN}`, conciliados.length);
        await sleep(0);
    }

    console.log('conciliarReproceso - Paso 2 completado, encontrados:', conciliados.filter(c => c.tipo === '1:N').length);

    // Paso 3: Buscar coincidencias muchos a 1
    // IMPORTANTE: Para este tipo de conciliación, validamos que todos los movimientos
    // del mayor sean de la misma entidad y que haya coincidencia de texto con el extracto
    if (onProgreso) onProgreso(3, 0, 'Buscando coincidencias (N:1)...', conciliados.length);

    const extractoParaN1 = extractoNoConciliado.length;
    for (let i = extractoNoConciliado.length - 1; i >= 0; i--) {
        const movExtracto = extractoNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movExtracto.importe,
            movExtracto.fecha,
            mayorNoConciliado,
            5,
            true, // Validar que los movimientos sean de la misma entidad
            movExtracto.descripcion || movExtracto.concepto || '', // Descripción del extracto para validar coincidencia de texto
            movExtracto.categoria || '', // Categoría del extracto para filtrar mayores compatibles
            movExtracto.descripcion || movExtracto.concepto || '', // Texto de referencia para validar coincidencia de palabras
            true // La lista es de mayores
        );

        if (combinacion) {
            // Verificar si este par fue desconciliado manualmente
            const mayorIds = combinacion.map(m => m.id);
            if (fueDesconciliadoManualmente(mayorIds, [movExtracto.id])) {
                console.log('Omitiendo conciliación N:1 por desconciliación manual previa:', mayorIds, movExtracto.id);
                continue;
            }

            const sumaMayor = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(sumaMayor - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: 'N:1',
                mayor: combinacion,
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            extractoNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = mayorNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) mayorNoConciliado.splice(idx, 1);
            });
        }

        // Yield en cada iteración para evitar que el navegador se cuelgue
        // La búsqueda de combinaciones es muy costosa con muchos movimientos
        const porcentaje = extractoParaN1 > 0 ? Math.floor(((extractoParaN1 - i) / extractoParaN1) * 100) : 100;
        if (onProgreso) onProgreso(3, porcentaje, `Buscando coincidencias (N:1)... ${extractoParaN1 - i}/${extractoParaN1}`, conciliados.length);
        await sleep(0);
    }

    console.log('conciliarReproceso - Paso 3 completado, encontrados:', conciliados.filter(c => c.tipo === 'N:1').length);
    console.log('conciliarReproceso - Total conciliados:', conciliados.length);

    return {
        conciliados,
        mayorNoConciliado,
        extractoNoConciliado
    };
}

/**
 * Muestra un mensaje de resumen después del reprocesamiento
 */
function mostrarResumenReproceso(nuevosConciliados) {
    if (nuevosConciliados > 0) {
        mostrarMensaje(`Se encontraron ${nuevosConciliados} nuevas conciliaciones`, 'success');
    } else {
        mostrarMensaje('No se encontraron nuevas conciliaciones con estos parámetros', 'error');
    }

    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
        mostrarMensaje('', 'clear');
    }, 5000);
}

// ========== NOTAS DE CONCILIACIÓN ==========

let conciliacionNotaActual = null; // ID de la conciliación que se está editando

/**
 * Abre el modal para agregar/editar nota de una conciliación
 * @param {string} conciliacionId - ID de la conciliación
 */
function abrirModalNota(conciliacionId) {
    const conciliacion = state.resultados?.conciliados.find(c => c.id === conciliacionId);
    if (!conciliacion) {
        mostrarMensaje('No se encontró la conciliación', 'error');
        return;
    }

    conciliacionNotaActual = conciliacionId;

    // Mostrar información del movimiento
    const detallesEl = document.getElementById('nota-detalles');
    if (detallesEl) {
        const primerMayor = conciliacion.mayor[0];
        const primerExtracto = conciliacion.extracto[0];

        detallesEl.innerHTML = `
            <div class="nota-info-row">
                <span class="nota-info-label">Mayor:</span>
                <span class="nota-info-value">${formatearFecha(primerMayor?.fecha)} - ${primerMayor?.leyenda || 'Sin leyenda'}</span>
            </div>
            <div class="nota-info-row">
                <span class="nota-info-label">Extracto:</span>
                <span class="nota-info-value">${formatearFecha(primerExtracto?.fecha)} - ${primerExtracto?.descripcion || 'Sin descripción'}</span>
            </div>
            <div class="nota-info-row">
                <span class="nota-info-label">Importe:</span>
                <span class="nota-info-value">${formatearNumero(primerMayor?.importe || 0)}</span>
            </div>
        `;
    }

    // Cargar nota existente si hay
    const textareaEl = document.getElementById('nota-contenido');
    if (textareaEl) {
        textareaEl.value = conciliacion.nota || '';
        actualizarContadorNotas();
    }

    // Mostrar modal
    document.getElementById('overlay-nota').classList.remove('hidden');
    document.getElementById('modal-nota').classList.remove('hidden');

    // Focus en el textarea
    setTimeout(() => {
        if (textareaEl) textareaEl.focus();
    }, 100);
}

/**
 * Cierra el modal de notas
 */
function cerrarModalNota() {
    document.getElementById('overlay-nota').classList.add('hidden');
    document.getElementById('modal-nota').classList.add('hidden');
    conciliacionNotaActual = null;
}

/**
 * Guarda la nota en la conciliación
 */
function guardarNota() {
    if (!conciliacionNotaActual || !state.resultados) {
        cerrarModalNota();
        return;
    }

    const textareaEl = document.getElementById('nota-contenido');
    const nota = textareaEl?.value?.trim() || '';

    // Buscar y actualizar la conciliación
    const conciliacion = state.resultados.conciliados.find(c => c.id === conciliacionNotaActual);
    if (conciliacion) {
        conciliacion.nota = nota;

        // Re-renderizar para mostrar el icono actualizado
        renderizarResultados();

        mostrarMensaje(nota ? 'Nota guardada correctamente' : 'Nota eliminada', 'success');
        setTimeout(() => mostrarMensaje('', 'clear'), 3000);
    }

    cerrarModalNota();
}

/**
 * Actualiza el contador de caracteres del textarea de notas
 */
function actualizarContadorNotas() {
    const textareaEl = document.getElementById('nota-contenido');
    const contadorEl = document.getElementById('nota-contador-chars');

    if (textareaEl && contadorEl) {
        contadorEl.textContent = textareaEl.value.length;
    }
}

// Event listener para actualizar contador
document.addEventListener('DOMContentLoaded', () => {
    const textareaEl = document.getElementById('nota-contenido');
    if (textareaEl) {
        textareaEl.addEventListener('input', actualizarContadorNotas);
    }
});

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalNota = document.getElementById('modal-nota');
        if (modalNota && !modalNota.classList.contains('hidden')) {
            cerrarModalNota();
        }
    }
});

