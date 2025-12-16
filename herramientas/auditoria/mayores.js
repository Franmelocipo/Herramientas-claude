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
            haberEsLiquidacion: true  // Las liquidaciones van al haber
        }
    }
];

// Tipos de mayor dinámicos
let TIPOS_MAYOR = [...TIPOS_MAYOR_DEFAULT];

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

        if (typeof supabase !== 'undefined' && supabase) {
            const { data, error } = await supabase
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
 * Analizar vencimientos de cupones
 */
function analizarVencimientos() {
    const config = stateMayores.tipoMayorActual?.configuracion || { diasVencimiento: 40 };
    const hoy = new Date();

    stateMayores.registrosMayor.forEach(registro => {
        if (registro.estado === 'vinculado' || registro.esDevolucion) return;

        // Solo analizar cupones (débitos)
        if (registro.debe > 0 && registro.fecha) {
            const diasTranscurridos = Math.floor((hoy - registro.fecha) / (1000 * 60 * 60 * 24));
            if (diasTranscurridos > config.diasVencimiento) {
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

    document.getElementById('mayorPeriodo').textContent = periodo;
    document.getElementById('mayorTotalRegistros').textContent = registros.length;
    document.getElementById('mayorTotalDebe').textContent = formatearMoneda(totalDebe);
    document.getElementById('mayorTotalHaber').textContent = formatearMoneda(totalHaber);
}

/**
 * Renderizar panel de vinculación
 */
function renderizarVinculacion() {
    const registros = stateMayores.registrosMayor;

    // Filtrar cupones (débitos) y liquidaciones (créditos)
    const cupones = registros.filter(r => r.debe > 0 && !r.esDevolucion);
    const liquidaciones = registros.filter(r => r.haber > 0 || r.esDevolucion);

    // Aplicar filtros
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const cuponesFiltrados = cupones.filter(c => {
        if (filtroEstado && c.estado !== filtroEstado) return false;
        if (filtroTexto && !c.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    const liquidacionesFiltradas = liquidaciones.filter(l => {
        if (filtroEstado === 'devolucion' && !l.esDevolucion) return false;
        if (filtroEstado && filtroEstado !== 'devolucion' && l.estado !== filtroEstado) return false;
        if (filtroTexto && !l.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    // Calcular totales
    const totalCupones = cuponesFiltrados.reduce((sum, c) => sum + c.debe, 0);
    const totalLiquidaciones = liquidacionesFiltradas.reduce((sum, l) => sum + l.haber, 0);

    document.getElementById('totalCuponesDebe').textContent = formatearMoneda(totalCupones);
    document.getElementById('totalLiquidacionesHaber').textContent = formatearMoneda(totalLiquidaciones);

    // Renderizar lista de cupones
    const listaCupones = document.getElementById('listaCupones');
    listaCupones.innerHTML = cuponesFiltrados.length === 0
        ? '<div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">No hay cupones</div>'
        : cuponesFiltrados.map(c => `
            <div class="registro-item ${c.estado} ${stateMayores.cuponesSeleccionados.includes(c.id) ? 'selected' : ''}"
                 onclick="toggleSeleccionCupon('${c.id}')" data-id="${c.id}">
                <input type="checkbox" class="registro-checkbox"
                       ${stateMayores.cuponesSeleccionados.includes(c.id) ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <div class="registro-info">
                    <div class="registro-fecha">${formatearFecha(c.fecha)}</div>
                    <div class="registro-desc" title="${c.descripcion}">${c.descripcion}</div>
                </div>
                <div class="registro-monto debe">${formatearMoneda(c.debe)}</div>
                <span class="registro-estado ${c.estado}">${obtenerEtiquetaEstado(c.estado)}</span>
            </div>
        `).join('');

    // Renderizar lista de liquidaciones
    const listaLiquidaciones = document.getElementById('listaLiquidaciones');
    listaLiquidaciones.innerHTML = liquidacionesFiltradas.length === 0
        ? '<div class="empty-state" style="padding: 20px; text-align: center; color: #94a3b8;">No hay liquidaciones</div>'
        : liquidacionesFiltradas.map(l => `
            <div class="registro-item ${l.esDevolucion ? 'devolucion' : l.estado} ${stateMayores.liquidacionesSeleccionadas.includes(l.id) ? 'selected' : ''}"
                 onclick="toggleSeleccionLiquidacion('${l.id}')" data-id="${l.id}">
                <input type="checkbox" class="registro-checkbox"
                       ${stateMayores.liquidacionesSeleccionadas.includes(l.id) ? 'checked' : ''}
                       onclick="event.stopPropagation()">
                <div class="registro-info">
                    <div class="registro-fecha">${formatearFecha(l.fecha)}</div>
                    <div class="registro-desc" title="${l.descripcion}">${l.descripcion}</div>
                </div>
                <div class="registro-monto haber">${formatearMoneda(l.haber || l.debe)}</div>
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

    const cantCupones = stateMayores.cuponesSeleccionados.length;
    const cantLiquidaciones = stateMayores.liquidacionesSeleccionadas.length;

    // Calcular totales
    const totalCupones = stateMayores.registrosMayor
        .filter(r => stateMayores.cuponesSeleccionados.includes(r.id))
        .reduce((sum, r) => sum + (r.debe || 0), 0);

    const totalLiquidaciones = stateMayores.registrosMayor
        .filter(r => stateMayores.liquidacionesSeleccionadas.includes(r.id))
        .reduce((sum, r) => sum + (r.haber || r.debe || 0), 0);

    const diferencia = totalCupones - totalLiquidaciones;
    const diferenciAbs = Math.abs(diferencia);

    // Actualizar UI
    document.getElementById('selCuponesCount').textContent = cantCupones;
    document.getElementById('selCuponesTotal').textContent = formatearMoneda(totalCupones);
    document.getElementById('selLiquidacionesCount').textContent = cantLiquidaciones;
    document.getElementById('selLiquidacionesTotal').textContent = formatearMoneda(totalLiquidaciones);

    const diffElement = document.getElementById('selDiferenciaMayores');
    const signo = diferencia > 0 ? '+' : diferencia < 0 ? '-' : '';
    diffElement.textContent = signo + formatearMoneda(diferenciAbs);

    // Colorear según la diferencia
    diffElement.classList.remove('diff-warning', 'diff-error', 'diff-ok');
    if (diferenciAbs === 0) {
        diffElement.classList.add('diff-ok');
    } else if (diferenciAbs <= 1) {
        diffElement.classList.add('diff-warning');
    } else {
        diffElement.classList.add('diff-error');
    }

    // Habilitar/deshabilitar botón de vincular
    const btnVincular = document.getElementById('btnVincularMayores');
    btnVincular.disabled = cantCupones === 0 || cantLiquidaciones === 0;

    // Mostrar/ocultar barra
    if (cantCupones > 0 || cantLiquidaciones > 0) {
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

    // Quitar clases visuales
    document.querySelectorAll('.registro-item.selected').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.registro-checkbox');
        if (checkbox) checkbox.checked = false;
    });

    actualizarBarraSeleccionMayores();
}

/**
 * Vincular seleccionados manualmente (versión mejorada)
 */
function vincularSeleccionadosManual() {
    if (stateMayores.cuponesSeleccionados.length === 0 || stateMayores.liquidacionesSeleccionadas.length === 0) {
        alert('Debe seleccionar al menos un cupón y una liquidación para vincular');
        return;
    }

    // Obtener registros seleccionados
    const cupones = stateMayores.registrosMayor.filter(r => stateMayores.cuponesSeleccionados.includes(r.id));
    const liquidaciones = stateMayores.registrosMayor.filter(r => stateMayores.liquidacionesSeleccionadas.includes(r.id));

    // Calcular diferencia
    const sumaCupones = cupones.reduce((sum, c) => sum + (c.debe || 0), 0);
    const sumaLiquidaciones = liquidaciones.reduce((sum, l) => sum + (l.haber || l.debe || 0), 0);
    const diferencia = Math.abs(sumaCupones - sumaLiquidaciones);

    // Validar diferencia
    if (diferencia > 1) {
        const mensaje = `La diferencia entre cupones y liquidaciones es de ${formatearMoneda(diferencia)}.\n\n¿Desea vincular de todos modos?`;
        if (!confirm(mensaje)) return;
    }

    const vinculacionId = `vinc_manual_${Date.now()}`;

    // Marcar cupones como vinculados
    cupones.forEach(cupon => {
        cupon.estado = 'vinculado';
        cupon.vinculadoCon = stateMayores.liquidacionesSeleccionadas.slice();
        cupon.vinculacionId = vinculacionId;
    });

    // Marcar liquidaciones como vinculadas
    liquidaciones.forEach(liq => {
        liq.estado = 'vinculado';
        liq.vinculadoCon = stateMayores.cuponesSeleccionados.slice();
        liq.vinculacionId = vinculacionId;
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

    console.log(`✅ Vinculación manual creada: ${cupones.length} cupones con ${liquidaciones.length} liquidaciones`);
}

/**
 * Seleccionar todos los cupones visibles
 */
function seleccionarTodosCupones() {
    const cupones = stateMayores.registrosMayor.filter(r => r.debe > 0 && !r.esDevolucion);
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const cuponesFiltrados = cupones.filter(c => {
        if (filtroEstado && c.estado !== filtroEstado) return false;
        if (filtroTexto && !c.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    // Toggle: si todos están seleccionados, deseleccionar; si no, seleccionar todos
    const todosSeleccionados = cuponesFiltrados.every(c => stateMayores.cuponesSeleccionados.includes(c.id));

    if (todosSeleccionados) {
        stateMayores.cuponesSeleccionados = [];
    } else {
        stateMayores.cuponesSeleccionados = cuponesFiltrados.map(c => c.id);
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
 * Seleccionar todas las liquidaciones visibles
 */
function seleccionarTodasLiquidaciones() {
    const liquidaciones = stateMayores.registrosMayor.filter(r => r.haber > 0 || r.esDevolucion);
    const filtroEstado = document.getElementById('filtroEstadoVinculacion')?.value || '';
    const filtroTexto = document.getElementById('filtroTextoVinculacion')?.value?.toLowerCase() || '';

    const liquidacionesFiltradas = liquidaciones.filter(l => {
        if (filtroEstado === 'devolucion' && !l.esDevolucion) return false;
        if (filtroEstado && filtroEstado !== 'devolucion' && l.estado !== filtroEstado) return false;
        if (filtroTexto && !l.descripcion.toLowerCase().includes(filtroTexto)) return false;
        return true;
    });

    const todasSeleccionadas = liquidacionesFiltradas.every(l => stateMayores.liquidacionesSeleccionadas.includes(l.id));

    if (todasSeleccionadas) {
        stateMayores.liquidacionesSeleccionadas = [];
    } else {
        stateMayores.liquidacionesSeleccionadas = liquidacionesFiltradas.map(l => l.id);
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
    if (registros.length === 0) {
        alert('Primero debe cargar un mayor contable');
        return;
    }

    const cuponesPendientes = registros.filter(r => r.debe > 0 && r.estado !== 'vinculado' && !r.esDevolucion);
    const liquidacionesPendientes = registros.filter(r => r.haber > 0 && r.estado !== 'vinculado' && !r.esDevolucion);

    if (cuponesPendientes.length === 0) {
        alert('No hay cupones pendientes de vincular');
        return;
    }

    if (liquidacionesPendientes.length === 0) {
        alert('No hay liquidaciones pendientes de vincular');
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

    console.log(`🤖 Iniciando conciliación automática - Modo: ${modo}, Tolerancia: ${tolerancia}, Días máx: ${diasMaximos}`);

    const registros = stateMayores.registrosMayor;

    // Obtener cupones y liquidaciones pendientes
    let cuponesPendientes = registros.filter(r =>
        r.debe > 0 && r.estado !== 'vinculado' && !r.esDevolucion
    ).sort((a, b) => (a.fecha || 0) - (b.fecha || 0)); // Ordenar por fecha

    let liquidacionesPendientes = registros.filter(r =>
        r.haber > 0 && r.estado !== 'vinculado' && !r.esDevolucion
    ).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));

    let vinculacionesExitosas = 0;
    let cuponesVinculados = new Set();
    let liquidacionesVinculadas = new Set();

    if (modo === 'N:1') {
        // Modo N:1: Varios cupones pueden vincularse con una liquidación
        // La suma de cupones debe coincidir con la liquidación
        vinculacionesExitosas = conciliarN1(
            cuponesPendientes,
            liquidacionesPendientes,
            tolerancia,
            diasMaximos,
            cuponesVinculados,
            liquidacionesVinculadas
        );
    } else if (modo === '1:1') {
        // Modo 1:1: Un cupón con una liquidación
        vinculacionesExitosas = conciliar11(
            cuponesPendientes,
            liquidacionesPendientes,
            tolerancia,
            diasMaximos,
            cuponesVinculados,
            liquidacionesVinculadas
        );
    } else if (modo === '1:N') {
        // Modo 1:N: Un cupón con varias liquidaciones
        vinculacionesExitosas = conciliar1N(
            cuponesPendientes,
            liquidacionesPendientes,
            tolerancia,
            diasMaximos,
            cuponesVinculados,
            liquidacionesVinculadas
        );
    }

    // Actualizar estadísticas
    const cuponesSinMatch = cuponesPendientes.filter(c => !cuponesVinculados.has(c.id)).length;
    const liquidacionesSinMatch = liquidacionesPendientes.filter(l => !liquidacionesVinculadas.has(l.id)).length;

    // Mostrar resultados
    document.getElementById('panelConfigConciliacion').style.display = 'none';
    document.getElementById('resultadosConciliacion').style.display = 'block';
    document.getElementById('conciliacionExitosas').textContent = vinculacionesExitosas;
    document.getElementById('conciliacionPendientes').textContent = cuponesSinMatch;
    document.getElementById('conciliacionLiquidaciones').textContent = liquidacionesSinMatch;

    // Analizar vencimientos de los que quedaron
    analizarVencimientos();

    // Actualizar UI
    renderizarVinculacion();
    renderizarTablaMayor();
    actualizarEstadisticasVinculacion();

    console.log(`✅ Conciliación completada: ${vinculacionesExitosas} vinculaciones`);
}

/**
 * Conciliación N:1 - Varios cupones con una liquidación
 */
function conciliarN1(cupones, liquidaciones, tolerancia, diasMaximos, cuponesVinculados, liquidacionesVinculadas) {
    let vinculaciones = 0;

    for (const liquidacion of liquidaciones) {
        if (liquidacionesVinculadas.has(liquidacion.id)) continue;

        const montoLiquidacion = liquidacion.haber;
        const fechaLiquidacion = liquidacion.fecha;

        if (!fechaLiquidacion) continue;

        // Buscar cupones candidatos (fecha anterior a liquidación, dentro del plazo)
        const cuponesCandidatos = cupones.filter(c => {
            if (cuponesVinculados.has(c.id)) return false;
            if (!c.fecha) return false;

            const diasDiferencia = Math.floor((fechaLiquidacion - c.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (cuponesCandidatos.length === 0) continue;

        // Intentar encontrar combinación de cupones que sumen el monto de la liquidación
        const combinacion = buscarCombinacionSuma(cuponesCandidatos, montoLiquidacion, tolerancia);

        if (combinacion && combinacion.length > 0) {
            // Crear vinculación
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            // Marcar cupones
            combinacion.forEach(cupon => {
                cupon.estado = 'vinculado';
                cupon.vinculadoCon = [liquidacion.id];
                cupon.vinculacionId = vinculacionId;
                cuponesVinculados.add(cupon.id);
            });

            // Marcar liquidación
            liquidacion.estado = 'vinculado';
            liquidacion.vinculadoCon = combinacion.map(c => c.id);
            liquidacion.vinculacionId = vinculacionId;
            liquidacionesVinculadas.add(liquidacion.id);

            // Registrar vinculación
            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: combinacion.map(c => c.id),
                liquidaciones: [liquidacion.id],
                tipo: 'automatica',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }
    }

    return vinculaciones;
}

/**
 * Conciliación 1:1 - Un cupón con una liquidación
 */
function conciliar11(cupones, liquidaciones, tolerancia, diasMaximos, cuponesVinculados, liquidacionesVinculadas) {
    let vinculaciones = 0;

    for (const cupon of cupones) {
        if (cuponesVinculados.has(cupon.id)) continue;
        if (!cupon.fecha) continue;

        const montoCupon = cupon.debe;

        // Buscar liquidación que coincida
        for (const liquidacion of liquidaciones) {
            if (liquidacionesVinculadas.has(liquidacion.id)) continue;
            if (!liquidacion.fecha) continue;

            const diasDiferencia = Math.floor((liquidacion.fecha - cupon.fecha) / (1000 * 60 * 60 * 24));
            if (diasDiferencia < 0 || diasDiferencia > diasMaximos) continue;

            const diferencia = Math.abs(montoCupon - liquidacion.haber);
            if (diferencia <= tolerancia) {
                // Match encontrado
                const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

                cupon.estado = 'vinculado';
                cupon.vinculadoCon = [liquidacion.id];
                cupon.vinculacionId = vinculacionId;

                liquidacion.estado = 'vinculado';
                liquidacion.vinculadoCon = [cupon.id];
                liquidacion.vinculacionId = vinculacionId;

                cuponesVinculados.add(cupon.id);
                liquidacionesVinculadas.add(liquidacion.id);

                stateMayores.vinculaciones.push({
                    id: vinculacionId,
                    cupones: [cupon.id],
                    liquidaciones: [liquidacion.id],
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
 * Conciliación 1:N - Un cupón con varias liquidaciones
 */
function conciliar1N(cupones, liquidaciones, tolerancia, diasMaximos, cuponesVinculados, liquidacionesVinculadas) {
    let vinculaciones = 0;

    for (const cupon of cupones) {
        if (cuponesVinculados.has(cupon.id)) continue;
        if (!cupon.fecha) continue;

        const montoCupon = cupon.debe;

        // Buscar liquidaciones candidatas
        const liquidacionesCandidatas = liquidaciones.filter(l => {
            if (liquidacionesVinculadas.has(l.id)) return false;
            if (!l.fecha) return false;

            const diasDiferencia = Math.floor((l.fecha - cupon.fecha) / (1000 * 60 * 60 * 24));
            return diasDiferencia >= 0 && diasDiferencia <= diasMaximos;
        });

        if (liquidacionesCandidatas.length === 0) continue;

        // Buscar combinación de liquidaciones que sumen el monto del cupón
        const combinacion = buscarCombinacionSumaHaber(liquidacionesCandidatas, montoCupon, tolerancia);

        if (combinacion && combinacion.length > 0) {
            const vinculacionId = `vinc_auto_${Date.now()}_${vinculaciones}`;

            cupon.estado = 'vinculado';
            cupon.vinculadoCon = combinacion.map(l => l.id);
            cupon.vinculacionId = vinculacionId;
            cuponesVinculados.add(cupon.id);

            combinacion.forEach(liq => {
                liq.estado = 'vinculado';
                liq.vinculadoCon = [cupon.id];
                liq.vinculacionId = vinculacionId;
                liquidacionesVinculadas.add(liq.id);
            });

            stateMayores.vinculaciones.push({
                id: vinculacionId,
                cupones: [cupon.id],
                liquidaciones: combinacion.map(l => l.id),
                tipo: 'automatica',
                fecha: new Date().toISOString()
            });

            vinculaciones++;
        }
    }

    return vinculaciones;
}

/**
 * Buscar combinación de cupones que sumen un monto específico
 * Usa un algoritmo greedy con backtracking limitado para eficiencia
 */
function buscarCombinacionSuma(elementos, montoObjetivo, tolerancia) {
    // Primero intentar match exacto con un solo elemento
    for (const elem of elementos) {
        if (Math.abs(elem.debe - montoObjetivo) <= tolerancia) {
            return [elem];
        }
    }

    // Ordenar por monto descendente para mejor eficiencia
    const ordenados = [...elementos].sort((a, b) => b.debe - a.debe);

    // Intentar combinaciones (limitado a combinaciones razonables)
    const resultado = [];
    let sumaActual = 0;

    for (const elem of ordenados) {
        if (sumaActual + elem.debe <= montoObjetivo + tolerancia) {
            resultado.push(elem);
            sumaActual += elem.debe;

            if (Math.abs(sumaActual - montoObjetivo) <= tolerancia) {
                return resultado;
            }
        }
    }

    // Si el greedy no funcionó, intentar subset sum con límite
    if (elementos.length <= 20) {
        const combinacion = subsetSum(elementos, montoObjetivo, tolerancia);
        if (combinacion) return combinacion;
    }

    return null;
}

/**
 * Buscar combinación de liquidaciones que sumen un monto específico
 */
function buscarCombinacionSumaHaber(elementos, montoObjetivo, tolerancia) {
    // Primero intentar match exacto con un solo elemento
    for (const elem of elementos) {
        if (Math.abs(elem.haber - montoObjetivo) <= tolerancia) {
            return [elem];
        }
    }

    // Ordenar por monto descendente
    const ordenados = [...elementos].sort((a, b) => b.haber - a.haber);

    // Greedy
    const resultado = [];
    let sumaActual = 0;

    for (const elem of ordenados) {
        if (sumaActual + elem.haber <= montoObjetivo + tolerancia) {
            resultado.push(elem);
            sumaActual += elem.haber;

            if (Math.abs(sumaActual - montoObjetivo) <= tolerancia) {
                return resultado;
            }
        }
    }

    // Subset sum limitado
    if (elementos.length <= 20) {
        const combinacion = subsetSumHaber(elementos, montoObjetivo, tolerancia);
        if (combinacion) return combinacion;
    }

    return null;
}

/**
 * Algoritmo de subset sum para cupones (debe)
 */
function subsetSum(elementos, objetivo, tolerancia, maxElementos = 10) {
    const n = Math.min(elementos.length, maxElementos);

    // Generar todas las combinaciones posibles (hasta 2^n)
    for (let mask = 1; mask < (1 << n); mask++) {
        const combo = [];
        let suma = 0;

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                combo.push(elementos[i]);
                suma += elementos[i].debe;
            }
        }

        if (Math.abs(suma - objetivo) <= tolerancia) {
            return combo;
        }
    }

    return null;
}

/**
 * Algoritmo de subset sum para liquidaciones (haber)
 */
function subsetSumHaber(elementos, objetivo, tolerancia, maxElementos = 10) {
    const n = Math.min(elementos.length, maxElementos);

    for (let mask = 1; mask < (1 << n); mask++) {
        const combo = [];
        let suma = 0;

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                combo.push(elementos[i]);
                suma += elementos[i].haber;
            }
        }

        if (Math.abs(suma - objetivo) <= tolerancia) {
            return combo;
        }
    }

    return null;
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

    tbody.innerHTML = registrosFiltrados.map(r => `
        <tr class="${r.estado}" data-id="${r.id}">
            <td class="checkbox-col">
                <input type="checkbox" onchange="toggleSeleccionRegistroMayor('${r.id}', this)">
            </td>
            <td>${formatearFecha(r.fecha)}</td>
            <td>${r.asiento}</td>
            <td title="${r.descripcion}">${truncarTexto(r.descripcion, 50)}</td>
            <td class="text-right" style="color: #dc2626;">${r.debe > 0 ? formatearMoneda(r.debe) : ''}</td>
            <td class="text-right" style="color: #16a34a;">${r.haber > 0 ? formatearMoneda(r.haber) : ''}</td>
            <td><span class="registro-estado ${r.estado}">${obtenerEtiquetaEstado(r.estado)}</span></td>
            <td>${r.vinculadoCon?.length > 0 ? `${r.vinculadoCon.length} reg.` : '-'}</td>
        </tr>
    `).join('');
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
    const checkboxes = document.querySelectorAll('#tablaMayorBody input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

/**
 * Toggle selección de registro en tabla
 */
function toggleSeleccionRegistroMayor(id, checkbox) {
    // Actualizar selección según tipo
    const registro = stateMayores.registrosMayor.find(r => r.id === id);
    if (!registro) return;

    if (registro.debe > 0 && !registro.esDevolucion) {
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

    renderizarVinculacion();
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
