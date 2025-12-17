// ============================================
// MÓDULO DE ANÁLISIS DE MAYORES CONTABLES
// ============================================

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
    conciliacionCargadaNombre: null  // Nombre de la conciliación actualmente cargada
};

// Variables para gestión de conciliaciones
let conciliacionesMayorGuardadasLista = [];
let conciliacionMayorSeleccionadaId = null;
let conciliacionMayorAEliminarId = null;

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
            iconoOrigen: '📤',
            iconoDestino: '📥',
            descripcionVinculacion: 'Las emisiones de cheques (haber) deben vincularse con los cobros por terceros (debe).'
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
        iconoOrigen: config.iconoOrigen || '📋',
        iconoDestino: config.iconoDestino || '💰',
        descripcionVinculacion: config.descripcionVinculacion || 'Vincule los registros de origen con los de destino.'
    };
}

/**
 * Obtener registros de origen según configuración (cupones o emisiones)
 * @param {Array} registros - Lista de registros
 * @param {boolean} incluirVinculados - Incluir registros ya vinculados
 * @returns {Array} Registros de origen filtrados
 */
function obtenerRegistrosOrigen(registros, incluirVinculados = true) {
    const config = obtenerConfigVinculacion();
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
 * @param {Object} registro - Registro del mayor
 * @returns {number} Monto de origen
 */
function obtenerMontoOrigen(registro) {
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
    } else {
        panelVinculacion.style.display = 'none';
    }

    // Ocultar info del mayor (hasta que se cargue)
    document.getElementById('infoMayorCargado').style.display = 'none';

    // Resetear datos y estado de conciliación cargada
    stateMayores.registrosMayor = [];
    stateMayores.vinculaciones = [];
    stateMayores.conciliacionCargadaId = null;
    stateMayores.conciliacionCargadaNombre = null;
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

    // Actualizar opciones del modo de conciliación
    const modoConciliacion = document.getElementById('modoConciliacion');
    if (modoConciliacion) {
        const opciones = modoConciliacion.options;
        opciones[0].textContent = `1:1 - Una ${config.etiquetaSingularOrigen} con un ${config.etiquetaSingularDestino}`;
        opciones[1].textContent = `N:1 - Varias ${config.etiquetaOrigen.toLowerCase()} con un ${config.etiquetaSingularDestino}`;
        opciones[2].textContent = `1:N - Una ${config.etiquetaSingularOrigen} con varios ${config.etiquetaDestino.toLowerCase()}`;
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
 */
function parsearFecha(fechaStr) {
    if (!fechaStr) return null;

    // Intentar varios formatos
    const formatos = [
        // DD/MM/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    ];

    for (const formato of formatos) {
        const match = fechaStr.toString().match(formato);
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

    // Intentar parseo directo
    const fecha = new Date(fechaStr);
    return isNaN(fecha.getTime()) ? null : fecha;
}

// ============================================
// ANÁLISIS Y VINCULACIÓN (CUPONES DE TARJETAS)
// ============================================

/**
 * Analizar vencimientos de registros de origen (cupones o emisiones)
 */
function analizarVencimientos() {
    const configVinc = obtenerConfigVinculacion();
    const hoy = new Date();

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

    actualizarEstadisticasVinculacion();
}

/**
 * Actualizar estadísticas de vinculación
 */
function actualizarEstadisticasVinculacion() {
    const registros = stateMayores.registrosMayor;

    const vinculados = registros.filter(r => r.estado === 'vinculado').length;
    const pendientes = registros.filter(r => r.estado === 'pendiente').length;
    const vencidos = registros.filter(r => r.estado === 'vencido').length;

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

    // Calcular totales usando configuración dinámica
    const totalOrigen = stateMayores.registrosMayor
        .filter(r => stateMayores.cuponesSeleccionados.includes(r.id))
        .reduce((sum, r) => sum + obtenerMontoOrigen(r), 0);

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
 * Vincular elementos seleccionados
 */
function vincularSeleccionados() {
    if (stateMayores.cuponesSeleccionados.length === 0 || stateMayores.liquidacionesSeleccionadas.length === 0) {
        alert('Debe seleccionar al menos un cupón y una liquidación para vincular');
        return;
    }

    const vinculacionId = `vinc_${Date.now()}`;

    // Marcar cupones como vinculados
    stateMayores.cuponesSeleccionados.forEach(id => {
        const cupon = stateMayores.registrosMayor.find(r => r.id === id);
        if (cupon) {
            cupon.estado = 'vinculado';
            cupon.vinculadoCon = [...(cupon.vinculadoCon || []), ...stateMayores.liquidacionesSeleccionadas];
            cupon.vinculacionId = vinculacionId;
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
        fecha: new Date().toISOString()
    });

    // Limpiar selección
    stateMayores.cuponesSeleccionados = [];
    stateMayores.liquidacionesSeleccionadas = [];

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();

    console.log('✅ Vinculación creada:', vinculacionId);
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

    idsADesvincular.forEach(id => {
        const registro = stateMayores.registrosMayor.find(r => r.id === id);
        if (registro) {
            registro.estado = 'pendiente';
            registro.vinculadoCon = [];
            registro.vinculacionId = null;
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
 * Ejecutar conciliación automática
 */
function ejecutarConciliacion() {
    const tolerancia = parseFloat(document.getElementById('toleranciaImporte').value) || 0.01;
    const diasMaximos = parseInt(document.getElementById('diasMaximos').value) || 40;
    const modo = document.getElementById('modoConciliacion').value;
    const config = obtenerConfigVinculacion();

    console.log(`🤖 Iniciando conciliación automática - Modo: ${modo}, Tolerancia: ${tolerancia}, Días máx: ${diasMaximos}`);
    console.log(`📋 Configuración: tipoOrigen=${config.tipoOrigen}, tipoDestino=${config.tipoDestino}`);

    // Reset del contador de debug para buscarCombinacionSumaGenerica
    buscarCombinacionSumaGenerica._contador = 0;

    const registros = stateMayores.registrosMayor;
    console.log(`📊 Total registros cargados: ${registros.length}`);

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

    let vinculacionesExitosas = 0;
    let origenVinculados = new Set();
    let destinoVinculados = new Set();

    if (modo === 'N:1') {
        // Modo N:1: Varios orígenes pueden vincularse con un destino
        vinculacionesExitosas = conciliarN1(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados
        );
    } else if (modo === '1:1') {
        // Modo 1:1: Un origen con un destino
        vinculacionesExitosas = conciliar11(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados
        );
    } else if (modo === '1:N') {
        // Modo 1:N: Un origen con varios destinos
        vinculacionesExitosas = conciliar1N(
            origenPendientes,
            destinoPendientes,
            tolerancia,
            diasMaximos,
            origenVinculados,
            destinoVinculados
        );
    }

    // Actualizar estadísticas
    const origenSinMatch = origenPendientes.filter(c => !origenVinculados.has(c.id)).length;
    const destinoSinMatch = destinoPendientes.filter(l => !destinoVinculados.has(l.id)).length;

    // Mostrar resultados
    document.getElementById('panelConfigConciliacion').style.display = 'none';
    document.getElementById('resultadosConciliacion').style.display = 'block';
    document.getElementById('conciliacionExitosas').textContent = vinculacionesExitosas;
    document.getElementById('conciliacionPendientes').textContent = origenSinMatch;
    document.getElementById('conciliacionLiquidaciones').textContent = destinoSinMatch;

    // Actualizar etiquetas según el tipo de mayor
    const configResultados = obtenerConfigVinculacion();
    document.getElementById('labelOrigenSinMatch').textContent = `${configResultados.etiquetaOrigen} sin match`;
    document.getElementById('labelDestinoSinMatch').textContent = `${configResultados.etiquetaDestino} sin match`;

    // Analizar vencimientos de los que quedaron
    analizarVencimientos();

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
    actualizarEstadisticasVinculacion();

    console.log(`✅ Conciliación completada: ${vinculacionesExitosas} vinculaciones`);
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
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="text-align: center; padding: 40px;">No hay registros para mostrar</td></tr>`;
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
        </tr>
    `}).join('');
}

/**
 * Filtrar registros del mayor
 */
function filtrarRegistrosMayor() {
    renderizarTablaMayor();
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
 * Cargar lista de conciliaciones guardadas desde localStorage
 */
function cargarConciliacionesMayorGuardadas() {
    if (!stateMayores.clienteActual || !stateMayores.tipoMayorActual) {
        console.log('⚠️ cargarConciliacionesMayorGuardadas: No hay cliente o tipo seleccionado');
        return [];
    }

    try {
        const key = getConciliacionesMayorKey();
        const datosGuardados = localStorage.getItem(key);

        if (datosGuardados) {
            const conciliaciones = JSON.parse(datosGuardados);
            console.log(`📊 ${conciliaciones.length} conciliaciones encontradas para ${key}`);
            return conciliaciones;
        }

        return [];
    } catch (error) {
        console.error('Error cargando conciliaciones:', error);
        return [];
    }
}

/**
 * Verificar y mostrar conciliaciones guardadas al seleccionar tipo de mayor
 */
function verificarConciliacionesMayorGuardadas() {
    console.log('🔍 Verificando conciliaciones de mayor guardadas...');
    console.log('   Cliente ID:', stateMayores.clienteActual?.id);
    console.log('   Tipo Mayor ID:', stateMayores.tipoMayorActual?.id);

    const conciliaciones = cargarConciliacionesMayorGuardadas();
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
        btn.disabled = conciliacionesMayorGuardadasLista.length === 0;
        if (conciliacionesMayorGuardadasLista.length > 0) {
            btn.innerHTML = `<span>📂</span> Gestionar Conciliaciones (${conciliacionesMayorGuardadasLista.length})`;
        } else {
            btn.innerHTML = `<span>📂</span> Gestionar Conciliaciones`;
        }
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
function cargarConciliacionMayorGuardada(conciliacionId) {
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
    stateMayores.conciliacionCargadaId = conciliacion.id;
    stateMayores.conciliacionCargadaNombre = conciliacion.nombre;

    // Actualizar UI
    actualizarEstadisticasMayor();
    renderizarTablaMayor();

    if (stateMayores.tipoMayorActual?.logica === 'vinculacion') {
        renderizarVinculacion();
        actualizarEstadisticasVinculacion();
    }

    document.getElementById('infoMayorCargado').style.display =
        stateMayores.registrosMayor.length > 0 ? 'block' : 'none';

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

    renderizarTablaMayor();
    renderizarVinculacion();

    document.getElementById('infoMayorCargado').style.display = 'none';

    console.log('📝 Nueva conciliación iniciada');
}

/**
 * Abrir modal de gestión de conciliaciones
 */
function abrirGestionConciliacionesMayor() {
    // Recargar lista
    const conciliaciones = cargarConciliacionesMayorGuardadas();
    conciliacionesMayorGuardadasLista = conciliaciones || [];

    const overlay = document.getElementById('overlay-gestion-conciliaciones-mayor');
    const modal = document.getElementById('modal-gestion-conciliaciones-mayor');
    const lista = document.getElementById('gestion-conciliaciones-mayor-lista');

    if (conciliacionesMayorGuardadasLista.length === 0) {
        lista.innerHTML = `
            <div class="conciliaciones-vacio">
                <div class="conciliaciones-vacio-icon">📂</div>
                <p>No hay conciliaciones guardadas para este tipo de mayor</p>
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
 * Ejecutar eliminación de conciliación
 */
function ejecutarEliminarConciliacionMayor() {
    if (!conciliacionMayorAEliminarId) return;

    const key = getConciliacionesMayorKey();

    // Filtrar la conciliación a eliminar
    conciliacionesMayorGuardadasLista = conciliacionesMayorGuardadasLista.filter(
        c => c.id !== conciliacionMayorAEliminarId
    );

    // Guardar lista actualizada
    localStorage.setItem(key, JSON.stringify(conciliacionesMayorGuardadasLista));

    // Si la conciliación eliminada estaba cargada, limpiar
    if (stateMayores.conciliacionCargadaId === conciliacionMayorAEliminarId) {
        stateMayores.registrosMayor = [];
        stateMayores.vinculaciones = [];
        stateMayores.conciliacionCargadaId = null;
        stateMayores.conciliacionCargadaNombre = null;

        renderizarTablaMayor();
        renderizarVinculacion();
        document.getElementById('infoMayorCargado').style.display = 'none';
    }

    cerrarConfirmarEliminarConciliacionMayor();

    // Actualizar botón y refrescar modal de gestión si está abierto
    actualizarBotonGestionConciliacionesMayor();

    // Refrescar modal de gestión
    const modalGestion = document.getElementById('modal-gestion-conciliaciones-mayor');
    if (modalGestion.classList.contains('active')) {
        abrirGestionConciliacionesMayor();
    }

    console.log('🗑️ Conciliación eliminada');
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
 * Ejecutar guardado de conciliación
 */
function ejecutarGuardarConciliacionMayor() {
    const inputNombre = document.getElementById('nombreConciliacionMayor');
    const nombre = inputNombre.value.trim();

    if (!nombre) {
        alert('Por favor ingrese un nombre para la conciliación');
        inputNombre.focus();
        return;
    }

    const key = getConciliacionesMayorKey();

    // Cargar conciliaciones existentes
    let conciliaciones = cargarConciliacionesMayorGuardadas();

    // Crear o actualizar conciliación
    const ahora = new Date().toISOString();

    if (stateMayores.conciliacionCargadaId) {
        // Actualizar conciliación existente
        const index = conciliaciones.findIndex(c => c.id === stateMayores.conciliacionCargadaId);
        if (index !== -1) {
            conciliaciones[index] = {
                ...conciliaciones[index],
                nombre: nombre,
                registros: stateMayores.registrosMayor,
                vinculaciones: stateMayores.vinculaciones,
                fechaModificado: ahora
            };
            console.log('📝 Conciliación actualizada:', nombre);
        }
    } else {
        // Crear nueva conciliación
        const nuevaConciliacion = {
            id: `conc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: nombre,
            registros: stateMayores.registrosMayor,
            vinculaciones: stateMayores.vinculaciones,
            fechaGuardado: ahora,
            fechaModificado: ahora
        };

        conciliaciones.push(nuevaConciliacion);
        stateMayores.conciliacionCargadaId = nuevaConciliacion.id;
        stateMayores.conciliacionCargadaNombre = nombre;

        console.log('💾 Nueva conciliación guardada:', nombre);
    }

    // Guardar en localStorage
    try {
        localStorage.setItem(key, JSON.stringify(conciliaciones));
        conciliacionesMayorGuardadasLista = conciliaciones;

        // Actualizar botón
        actualizarBotonGestionConciliacionesMayor();

        cerrarModalGuardarConciliacionMayor();
        alert('Conciliación guardada correctamente');
    } catch (error) {
        console.error('Error guardando conciliación:', error);
        alert('Error al guardar: ' + error.message);
    }
}

/**
 * Función legacy para compatibilidad - redirige al nuevo modal
 */
async function guardarVinculaciones() {
    mostrarModalGuardarConciliacionMayor();
}

/**
 * Exportar análisis del mayor
 */
function exportarAnalisisMayor() {
    if (stateMayores.registrosMayor.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    const registros = stateMayores.registrosMayor.map(r => ({
        'Fecha': formatearFecha(r.fecha),
        'Asiento': r.asiento,
        'Descripción': r.descripcion,
        'Debe': r.debe || '',
        'Haber': r.haber || '',
        'Estado': obtenerEtiquetaEstado(r.estado),
        'Es Devolución': r.esDevolucion ? 'Sí' : 'No',
        'Vinculado Con': r.vinculadoCon?.length || 0
    }));

    const ws = XLSX.utils.json_to_sheet(registros);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis Mayor');

    const nombreArchivo = `Mayor_${stateMayores.tipoMayorActual?.nombre || 'Analisis'}_${stateMayores.clienteActual?.nombre || 'Cliente'}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
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

console.log('✅ Módulo de Mayores Contables cargado');
