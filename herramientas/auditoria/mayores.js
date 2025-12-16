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
    clientesCache: []
};

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

    // Resetear datos
    stateMayores.registrosMayor = [];
    stateMayores.vinculaciones = [];
    renderizarTablaMayor();
    renderizarVinculacion();

    // Intentar cargar datos guardados
    cargarDatosGuardados();
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

        // Mapear columnas del mayor de Tango
        const registros = jsonData.map((row, index) => {
            // Detectar columnas (flexibilidad en nombres)
            const fecha = row['Fecha'] || row['FECHA'] || row['fecha'] || '';
            const asiento = row['Asiento'] || row['ASIENTO'] || row['asiento'] || row['Nro Asiento'] || '';
            const descripcion = row['Descripción'] || row['DESCRIPCION'] || row['descripcion'] || row['Concepto'] || row['CONCEPTO'] || '';
            const debe = parseFloat((row['Debe'] || row['DEBE'] || row['debe'] || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            const haber = parseFloat((row['Haber'] || row['HABER'] || row['haber'] || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

            return {
                id: `reg_${index}_${Date.now()}`,
                fecha: parsearFecha(fecha),
                fechaOriginal: fecha,
                asiento: asiento.toString(),
                descripcion: descripcion,
                debe: Math.abs(debe),
                haber: Math.abs(haber),
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
    renderizarVinculacion();
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
    renderizarVinculacion();
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

    renderizarVinculacion();
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

    renderizarVinculacion();
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
// PERSISTENCIA DE DATOS
// ============================================

/**
 * Guardar vinculaciones
 */
async function guardarVinculaciones() {
    if (!stateMayores.clienteActual || !stateMayores.tipoMayorActual) {
        alert('Debe seleccionar un cliente y tipo de mayor');
        return;
    }

    const key = `mayor_${stateMayores.clienteActual.id}_${stateMayores.tipoMayorActual.id}`;

    const datos = {
        registros: stateMayores.registrosMayor,
        vinculaciones: stateMayores.vinculaciones,
        fechaGuardado: new Date().toISOString()
    };

    try {
        localStorage.setItem(key, JSON.stringify(datos));
        alert('Vinculaciones guardadas correctamente');
        console.log('✅ Datos guardados en:', key);
    } catch (error) {
        console.error('Error guardando datos:', error);
        alert('Error al guardar: ' + error.message);
    }
}

/**
 * Cargar datos guardados
 */
function cargarDatosGuardados() {
    if (!stateMayores.clienteActual || !stateMayores.tipoMayorActual) return;

    const key = `mayor_${stateMayores.clienteActual.id}_${stateMayores.tipoMayorActual.id}`;

    try {
        const datosGuardados = localStorage.getItem(key);
        if (datosGuardados) {
            const datos = JSON.parse(datosGuardados);

            // Restaurar fechas como objetos Date
            datos.registros.forEach(r => {
                if (r.fecha) {
                    r.fecha = new Date(r.fecha);
                }
            });

            stateMayores.registrosMayor = datos.registros || [];
            stateMayores.vinculaciones = datos.vinculaciones || [];

            actualizarEstadisticasMayor();
            renderizarTablaMayor();
            renderizarVinculacion();

            document.getElementById('infoMayorCargado').style.display =
                stateMayores.registrosMayor.length > 0 ? 'block' : 'none';

            console.log('✅ Datos cargados desde:', key);
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
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
