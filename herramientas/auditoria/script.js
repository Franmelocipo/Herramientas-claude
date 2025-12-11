// ============================================
// HERRAMIENTA DE AUDITORÍA - CUENTAS BANCARIAS Y EXTRACTOS
// ============================================

// Estado de la herramienta
const state = {
    clienteActual: null,
    cuentaActual: null,
    extractoActual: null,
    movimientosOriginales: [],
    movimientosEditados: [],
    movimientosEliminados: [],
    ordenActual: { columna: null, direccion: 'asc' },
    filtros: {},
    filtroMarcadores: [], // Marcadores seleccionados para filtrar
    clientesCache: [],
    // Modo rango de fechas
    modoRango: false,
    extractosRango: [], // Lista de extractos cargados en modo rango
    rangoActual: { desde: null, hasta: null }
};

// Categorías predefinidas para clasificar movimientos
const CATEGORIAS_MOVIMIENTO = [
    { id: '', nombre: '-- Sin categoría --', color: '#94a3b8' },
    { id: 'comisiones', nombre: 'Comisiones', color: '#f59e0b' },
    { id: 'iva', nombre: 'IVA', color: '#8b5cf6' },
    { id: 'gastos_bancarios', nombre: 'Gastos Bancarios', color: '#ef4444' },
    { id: 'transferencias', nombre: 'Transferencias', color: '#3b82f6' },
    { id: 'impuestos', nombre: 'Impuestos', color: '#ec4899' },
    { id: 'servicios', nombre: 'Servicios', color: '#14b8a6' },
    { id: 'proveedores', nombre: 'Proveedores', color: '#f97316' },
    { id: 'sueldos', nombre: 'Sueldos', color: '#06b6d4' },
    { id: 'ventas', nombre: 'Ventas', color: '#22c55e' },
    { id: 'otros', nombre: 'Otros', color: '#64748b' }
];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await cargarClientes();

    // Event listeners para filtros
    const filtroFecha = document.getElementById('filtroFecha');
    const filtroDescripcion = document.getElementById('filtroDescripcion');
    const filtroOrigen = document.getElementById('filtroOrigen');

    if (filtroFecha) filtroFecha.addEventListener('input', aplicarFiltrosExtracto);
    if (filtroDescripcion) filtroDescripcion.addEventListener('input', aplicarFiltrosExtracto);
    if (filtroOrigen) filtroOrigen.addEventListener('input', aplicarFiltrosExtracto);
});

// ============================================
// GESTIÓN DE CLIENTES
// ============================================

/**
 * Cargar clientes en el selector
 */
async function cargarClientes() {
    const select = document.getElementById('clienteSelect');

    try {
        let clientes = [];

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
                .from('clientes')
                .select('*')
                .order('razon_social');

            if (error) throw error;
            clientes = data || [];
        } else {
            // Fallback a localStorage
            console.warn('Supabase no disponible, usando localStorage');
            clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
        }

        state.clientesCache = clientes;
        renderizarSelectClientes(clientes);
        console.log('✅ Clientes cargados:', clientes.length);
    } catch (error) {
        console.error('Error cargando clientes:', error);
        select.innerHTML = '<option value="">Error al cargar clientes</option>';
    }
}

/**
 * Renderizar opciones del selector de clientes
 */
function renderizarSelectClientes(clientes) {
    const select = document.getElementById('clienteSelect');

    select.innerHTML = '<option value="">-- Seleccione un cliente --</option>' +
        clientes.map(c => `<option value="${c.id}" data-cuit="${c.cuit || ''}">${c.razon_social}${c.cuit ? ` (${c.cuit})` : ''}</option>`).join('');
}

/**
 * Filtrar clientes en el selector
 */
function filtrarClientes() {
    const busqueda = document.getElementById('clienteSearch').value.toLowerCase();
    const clientes = state.clientesCache;

    const filtrados = clientes.filter(c => {
        const nombre = (c.razon_social || '').toLowerCase();
        const cuit = (c.cuit || '').toLowerCase();
        return nombre.includes(busqueda) || cuit.includes(busqueda);
    });

    renderizarSelectClientes(filtrados);
}

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

/**
 * Cargar dashboard cuando se selecciona un cliente
 */
async function cargarDashboard() {
    const select = document.getElementById('clienteSelect');
    const clienteId = select.value;

    if (!clienteId) {
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        state.clienteActual = null;
        return;
    }

    // Obtener datos del cliente
    const selectedOption = select.options[select.selectedIndex];
    const clienteNombre = selectedOption.text.split(' (')[0];
    const clienteCuit = selectedOption.dataset.cuit || '';

    state.clienteActual = {
        id: clienteId,
        nombre: clienteNombre,
        cuit: clienteCuit
    };

    // Mostrar info del cliente
    document.getElementById('clienteNombre').textContent = clienteNombre;
    document.getElementById('clienteCuit').textContent = clienteCuit ? `CUIT: ${clienteCuit}` : '';

    // Mostrar dashboard y ocultar estado vacío
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';

    // Cargar cuentas bancarias con extractos
    await cargarCuentasConExtractos(clienteId);
}

/**
 * Cargar cuentas bancarias con sus extractos para el dashboard
 */
async function cargarCuentasConExtractos(clienteId) {
    const container = document.getElementById('cuentasList');
    container.innerHTML = '<div class="loading-state">Cargando cuentas bancarias y extractos...</div>';

    try {
        let cuentas = [];

        if (typeof supabase !== 'undefined' && supabase) {
            // Cargar cuentas bancarias
            const { data: cuentasData, error: cuentasError } = await supabase
                .from('cuentas_bancarias')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('banco');

            if (cuentasError) throw cuentasError;
            cuentas = cuentasData || [];

            // Cargar extractos para cada cuenta
            for (let cuenta of cuentas) {
                const { data: extractosData } = await supabase
                    .from('extractos_mensuales')
                    .select('id, mes, anio, data, created_at, updated_at')
                    .eq('cuenta_id', cuenta.id)
                    .order('anio', { ascending: false })
                    .order('mes', { ascending: false });

                cuenta.extractos = extractosData || [];
            }
        } else {
            // Fallback localStorage
            cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            for (let cuenta of cuentas) {
                cuenta.extractos = JSON.parse(localStorage.getItem(`extractos_${cuenta.id}`) || '[]');
            }
        }

        renderizarCuentasConExtractos(cuentas);
    } catch (error) {
        console.error('Error cargando cuentas con extractos:', error);
        container.innerHTML = '<div class="error-state">Error al cargar las cuentas bancarias</div>';
    }
}

/**
 * Renderizar cuentas bancarias con sus extractos en formato de panel
 */
function renderizarCuentasConExtractos(cuentas) {
    const container = document.getElementById('cuentasList');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mesesCompletos = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (cuentas.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🏦</div>
                <p>No hay cuentas bancarias configuradas para este cliente.</p>
                <button onclick="mostrarNuevaCuentaBancaria()" class="btn-primary" style="margin-top: 16px;">+ Agregar Cuenta Bancaria</button>
            </div>
        `;
        return;
    }

    // Obtener el año actual y el anterior para mostrar extractos
    const anioActual = new Date().getFullYear();
    const anios = [anioActual, anioActual - 1];

    let html = '';

    cuentas.forEach(cuenta => {
        // Crear mapa de extractos por año-mes
        const extractosMap = {};
        (cuenta.extractos || []).forEach(ext => {
            const key = `${ext.anio}-${ext.mes}`;
            extractosMap[key] = ext;
        });

        html += `
            <div class="cuenta-panel">
                <!-- Header de la cuenta -->
                <div class="cuenta-header">
                    <div class="cuenta-info">
                        <h4>
                            🏦 ${cuenta.banco || 'Sin nombre'}
                            <span class="cuenta-tipo"> - ${cuenta.tipo_cuenta || 'Cuenta'}</span>
                        </h4>
                        <div class="cuenta-detalle">
                            ${cuenta.numero_cuenta ? `N°: ${cuenta.numero_cuenta}` : ''}
                            ${cuenta.alias ? ` | Alias: ${cuenta.alias}` : ''}
                        </div>
                    </div>
                    <div class="cuenta-actions">
                        <button onclick="mostrarSubirExtractoDirecto('${cuenta.id}', '${(cuenta.banco || '').replace(/'/g, "\\'")} - ${(cuenta.tipo_cuenta || '').replace(/'/g, "\\'")}')" class="btn-primary btn-sm">
                            📤 Subir Extracto
                        </button>
                        <button onclick="editarCuentaBancaria('${cuenta.id}')" class="btn-secondary btn-sm">✏️</button>
                        <button onclick="eliminarCuentaBancaria('${cuenta.id}')" class="btn-danger btn-sm">🗑️</button>
                    </div>
                </div>

                <!-- Grid de extractos por año -->
                <div class="extractos-grid-container">
                    ${anios.map(anio => {
                        return `
                            <div class="extractos-anio">
                                <h5>${anio}</h5>
                                <div class="extractos-grid">
                                    ${meses.map((mes, idx) => {
                                        const extracto = extractosMap[`${anio}-${idx + 1}`];
                                        const movimientos = extracto?.data?.length || 0;

                                        if (extracto) {
                                            return `
                                                <div class="extracto-cell extracto-cargado"
                                                     onclick="verDetalleExtracto('${extracto.id}', '${cuenta.id}')"
                                                     title="${mesesCompletos[idx]} ${anio} - ${movimientos} movimientos - Click para ver detalle">
                                                    <div class="extracto-mes">${mes}</div>
                                                    <div class="extracto-mov">${movimientos} mov</div>
                                                </div>
                                            `;
                                        } else {
                                            return `
                                                <div class="extracto-cell extracto-vacio"
                                                     onclick="mostrarSubirExtractoDirecto('${cuenta.id}', '${(cuenta.banco || '').replace(/'/g, "\\'")}', ${idx + 1}, ${anio})"
                                                     title="${mesesCompletos[idx]} ${anio} - Click para cargar extracto">
                                                    <div class="extracto-mes">${mes}</div>
                                                    <div class="extracto-mov">---</div>
                                                </div>
                                            `;
                                        }
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}

                    <!-- Ver todos los extractos y rango de fechas -->
                    ${(cuenta.extractos || []).length > 0 ? `
                        <div class="ver-todos-extractos">
                            <button onclick="mostrarModalRangoFechas('${cuenta.id}', '${(cuenta.banco || '').replace(/'/g, "\\'")} - ${(cuenta.numero_cuenta || '').replace(/'/g, "\\'")}')"
                                    class="btn-primary btn-rango-fechas">
                                📅 Ver por rango de fechas
                            </button>
                            <button onclick="verTodosExtractosCuenta('${cuenta.id}', '${(cuenta.banco || '').replace(/'/g, "\\'")} - ${(cuenta.numero_cuenta || '').replace(/'/g, "\\'")}')"
                                    class="btn-secondary btn-full">
                                📋 Ver todos los extractos (${(cuenta.extractos || []).length})
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// GESTIÓN DE CUENTAS BANCARIAS
// ============================================

/**
 * Mostrar modal para nueva cuenta bancaria
 */
function mostrarNuevaCuentaBancaria() {
    if (!state.clienteActual) {
        alert('Seleccione un cliente primero');
        return;
    }
    document.getElementById('cuentaBancariaId').value = '';
    document.getElementById('cuentaBanco').value = '';
    document.getElementById('cuentaTipo').value = 'Cuenta Corriente';
    document.getElementById('cuentaNumero').value = '';
    document.getElementById('cuentaAlias').value = '';
    document.getElementById('modalNuevaCuentaBancaria').classList.remove('hidden');
    document.getElementById('cuentaBanco').focus();
}

/**
 * Cerrar modal de nueva cuenta bancaria
 */
function cerrarNuevaCuentaBancaria() {
    document.getElementById('modalNuevaCuentaBancaria').classList.add('hidden');
}

/**
 * Guardar cuenta bancaria (crear o editar)
 */
async function guardarCuentaBancaria() {
    const id = document.getElementById('cuentaBancariaId').value;
    const banco = document.getElementById('cuentaBanco').value.trim();
    const tipo = document.getElementById('cuentaTipo').value;
    const numero = document.getElementById('cuentaNumero').value.trim();
    const alias = document.getElementById('cuentaAlias').value.trim();

    if (!banco) {
        alert('El nombre del banco es obligatorio');
        return;
    }

    const clienteId = state.clienteActual?.id;
    if (!clienteId) {
        alert('Error: No hay cliente seleccionado');
        return;
    }

    try {
        const cuentaData = {
            cliente_id: clienteId,
            banco,
            tipo_cuenta: tipo,
            numero_cuenta: numero,
            alias
        };

        if (typeof supabase !== 'undefined' && supabase) {
            if (id) {
                // Actualizar
                const { error } = await supabase
                    .from('cuentas_bancarias')
                    .update(cuentaData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                // Crear
                const { error } = await supabase
                    .from('cuentas_bancarias')
                    .insert([cuentaData]);
                if (error) throw error;
            }
        } else {
            // Fallback localStorage
            const cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            if (id) {
                const idx = cuentas.findIndex(c => c.id === id);
                if (idx !== -1) cuentas[idx] = { ...cuentas[idx], ...cuentaData };
            } else {
                cuentaData.id = Date.now().toString();
                cuentas.push(cuentaData);
            }
            localStorage.setItem(`cuentas_bancarias_${clienteId}`, JSON.stringify(cuentas));
        }

        cerrarNuevaCuentaBancaria();
        await cargarCuentasConExtractos(clienteId);
        alert(id ? 'Cuenta bancaria actualizada' : 'Cuenta bancaria creada');
    } catch (error) {
        console.error('Error guardando cuenta bancaria:', error);
        alert('Error al guardar la cuenta bancaria: ' + error.message);
    }
}

/**
 * Editar cuenta bancaria
 */
async function editarCuentaBancaria(id) {
    try {
        let cuenta;
        const clienteId = state.clienteActual?.id;

        if (typeof supabase !== 'undefined' && supabase) {
            const { data, error } = await supabase
                .from('cuentas_bancarias')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            cuenta = data;
        } else {
            const cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            cuenta = cuentas.find(c => c.id === id);
        }

        if (!cuenta) {
            alert('Cuenta no encontrada');
            return;
        }

        document.getElementById('cuentaBancariaId').value = cuenta.id;
        document.getElementById('cuentaBanco').value = cuenta.banco || '';
        document.getElementById('cuentaTipo').value = cuenta.tipo_cuenta || 'Cuenta Corriente';
        document.getElementById('cuentaNumero').value = cuenta.numero_cuenta || '';
        document.getElementById('cuentaAlias').value = cuenta.alias || '';
        document.getElementById('modalNuevaCuentaBancaria').classList.remove('hidden');
    } catch (error) {
        console.error('Error cargando cuenta:', error);
        alert('Error al cargar la cuenta bancaria');
    }
}

/**
 * Eliminar cuenta bancaria
 */
async function eliminarCuentaBancaria(id) {
    if (!confirm('¿Eliminar esta cuenta bancaria? También se eliminarán todos los extractos asociados.')) {
        return;
    }

    const clienteId = state.clienteActual?.id;

    try {
        if (typeof supabase !== 'undefined' && supabase) {
            await supabase.from('extractos_mensuales').delete().eq('cuenta_id', id);
            const { error } = await supabase.from('cuentas_bancarias').delete().eq('id', id);
            if (error) throw error;
        } else {
            const cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            const nuevasCuentas = cuentas.filter(c => c.id !== id);
            localStorage.setItem(`cuentas_bancarias_${clienteId}`, JSON.stringify(nuevasCuentas));
            localStorage.removeItem(`extractos_${id}`);
        }

        await cargarCuentasConExtractos(clienteId);
        alert('Cuenta bancaria eliminada');
    } catch (error) {
        console.error('Error eliminando cuenta:', error);
        alert('Error al eliminar la cuenta bancaria');
    }
}

// ============================================
// GESTIÓN DE EXTRACTOS MENSUALES
// ============================================

/**
 * Mostrar modal para subir extracto directamente
 */
function mostrarSubirExtractoDirecto(cuentaId, cuentaNombre, mes, anio) {
    state.cuentaActual = { id: cuentaId, nombre: cuentaNombre };

    // Establecer mes y año si se proporcionan
    if (mes) {
        document.getElementById('extractoMes').value = mes;
    } else {
        document.getElementById('extractoMes').value = new Date().getMonth() + 1;
    }

    if (anio) {
        document.getElementById('extractoAnio').value = anio;
    } else {
        document.getElementById('extractoAnio').value = new Date().getFullYear();
    }

    document.getElementById('extractoFile').value = '';
    document.getElementById('extractoFileInfo').textContent = '';
    document.getElementById('modalSubirExtracto').classList.remove('hidden');
}

/**
 * Ver todos los extractos de una cuenta
 */
async function verTodosExtractosCuenta(cuentaId, cuentaNombre) {
    state.cuentaActual = { id: cuentaId, nombre: cuentaNombre };
    document.getElementById('extractosCuentaNombre').textContent = cuentaNombre;
    document.getElementById('modalExtractosMensuales').classList.remove('hidden');
    await cargarExtractosMensuales(cuentaId);
}

/**
 * Cerrar modal de extractos mensuales
 */
function cerrarExtractosMensuales() {
    document.getElementById('modalExtractosMensuales').classList.add('hidden');
    state.cuentaActual = null;
}

/**
 * Cargar extractos mensuales
 */
async function cargarExtractosMensuales(cuentaId) {
    const lista = document.getElementById('extractosMensualesList');
    lista.innerHTML = '<div class="loading-state">Cargando extractos...</div>';

    try {
        let extractos = [];

        if (typeof supabase !== 'undefined' && supabase) {
            const { data, error } = await supabase
                .from('extractos_mensuales')
                .select('*')
                .eq('cuenta_id', cuentaId)
                .order('anio', { ascending: false })
                .order('mes', { ascending: false });

            if (error) throw error;
            extractos = data || [];
        } else {
            extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
        }

        renderizarExtractosMensuales(extractos);
    } catch (error) {
        console.error('Error cargando extractos:', error);
        lista.innerHTML = '<div class="error-state">Error al cargar extractos</div>';
    }
}

/**
 * Renderizar lista de extractos mensuales
 */
function renderizarExtractosMensuales(extractos) {
    const lista = document.getElementById('extractosMensualesList');

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (extractos.length === 0) {
        lista.innerHTML = '<div class="empty-state">No hay extractos cargados. Suba un archivo Excel para comenzar.</div>';
        return;
    }

    const html = `
        <table class="preview-table">
            <thead>
                <tr>
                    <th>Período</th>
                    <th>Movimientos</th>
                    <th>Fecha de Carga</th>
                    <th class="actions-col">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${extractos.map(ext => {
                    const movimientos = ext.data ? (Array.isArray(ext.data) ? ext.data.length : 0) : 0;
                    const fechaCarga = ext.created_at ? new Date(ext.created_at).toLocaleDateString('es-AR') : '-';
                    return `
                        <tr>
                            <td>${meses[ext.mes - 1]} ${ext.anio}</td>
                            <td>${movimientos} movimientos</td>
                            <td>${fechaCarga}</td>
                            <td class="actions-col">
                                <button onclick="verDetalleExtracto('${ext.id}', '${state.cuentaActual?.id}')" class="btn-sm btn-primary">👁️ Ver</button>
                                <button onclick="eliminarExtracto('${ext.id}')" class="btn-sm btn-danger">🗑️</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    lista.innerHTML = html;
}

/**
 * Mostrar modal para subir nuevo extracto
 */
function mostrarSubirExtracto() {
    const hoy = new Date();
    document.getElementById('extractoMes').value = hoy.getMonth() + 1;
    document.getElementById('extractoAnio').value = hoy.getFullYear();
    document.getElementById('extractoFile').value = '';
    document.getElementById('extractoFileInfo').textContent = '';
    document.getElementById('modalSubirExtracto').classList.remove('hidden');
}

/**
 * Cerrar modal de subir extracto
 */
function cerrarSubirExtracto() {
    document.getElementById('modalSubirExtracto').classList.add('hidden');
}

/**
 * Manejar cambio de archivo de extracto
 */
function handleExtractoFileChange(event) {
    const file = event.target.files[0];
    const info = document.getElementById('extractoFileInfo');

    if (file) {
        info.textContent = `Archivo seleccionado: ${file.name}`;
        info.style.color = '#38a169';
    } else {
        info.textContent = '';
    }
}

/**
 * Procesar y guardar extracto
 */
async function procesarExtracto() {
    const mes = parseInt(document.getElementById('extractoMes').value);
    const anio = parseInt(document.getElementById('extractoAnio').value);
    const fileInput = document.getElementById('extractoFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Seleccione un archivo Excel');
        return;
    }

    const cuentaId = state.cuentaActual?.id;
    if (!cuentaId) {
        alert('Error: No hay cuenta seleccionada');
        return;
    }

    try {
        // Leer archivo Excel
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        // Detectar si hay saldo inicial
        let saldoInicial = null;

        // Buscar encabezados (Fecha, Descripción, etc.)
        let headerRow = -1;
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row[0] && String(row[0]).toLowerCase().includes('fecha')) {
                headerRow = i;
                break;
            }
            // Verificar si hay saldo inicial
            if (row && row[6] && String(row[6]).toLowerCase().includes('saldo inicial')) {
                saldoInicial = jsonData[i + 1] ? jsonData[i + 1][6] : null;
            }
        }

        if (headerRow === -1) {
            alert('No se encontró el encabezado del archivo (debe tener columna "Fecha")');
            return;
        }

        // Parsear movimientos
        const movimientos = [];
        for (let i = headerRow + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[0]) continue;

            // Parsear fecha
            let fecha = row[0];
            if (typeof fecha === 'number') {
                const excelDate = new Date((fecha - 25569) * 86400 * 1000);
                fecha = excelDate.toLocaleDateString('es-AR');
            }

            movimientos.push({
                id: Date.now().toString() + '_' + i,
                fecha: String(fecha || ''),
                descripcion: String(row[1] || ''),
                origen: String(row[2] || ''),
                credito: parseFloat(row[3]) || 0,
                debito: parseFloat(row[4]) || 0,
                saldo: parseFloat(row[5]) || 0
            });
        }

        if (movimientos.length === 0) {
            alert('No se encontraron movimientos en el archivo');
            return;
        }

        // Verificar si ya existe extracto para ese período
        if (typeof supabase !== 'undefined' && supabase) {
            const { data: existente } = await supabase
                .from('extractos_mensuales')
                .select('id')
                .eq('cuenta_id', cuentaId)
                .eq('mes', mes)
                .eq('anio', anio)
                .single();

            if (existente) {
                if (!confirm(`Ya existe un extracto para ${mes}/${anio}. ¿Desea reemplazarlo?`)) {
                    return;
                }
                await supabase.from('extractos_mensuales').delete().eq('id', existente.id);
            }

            // Guardar en Supabase
            const { error } = await supabase
                .from('extractos_mensuales')
                .insert([{
                    cuenta_id: cuentaId,
                    mes,
                    anio,
                    saldo_inicial: saldoInicial,
                    data: movimientos
                }]);

            if (error) throw error;
        } else {
            // Fallback localStorage
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            const existenteIdx = extractos.findIndex(e => e.mes === mes && e.anio === anio);

            if (existenteIdx !== -1) {
                if (!confirm(`Ya existe un extracto para ${mes}/${anio}. ¿Desea reemplazarlo?`)) {
                    return;
                }
                extractos.splice(existenteIdx, 1);
            }

            extractos.push({
                id: Date.now().toString(),
                cuenta_id: cuentaId,
                mes,
                anio,
                saldo_inicial: saldoInicial,
                data: movimientos,
                created_at: new Date().toISOString()
            });

            localStorage.setItem(`extractos_${cuentaId}`, JSON.stringify(extractos));
        }

        cerrarSubirExtracto();

        // Recargar la lista de extractos si el modal está visible
        const modalExtractos = document.getElementById('modalExtractosMensuales');
        if (!modalExtractos.classList.contains('hidden')) {
            await cargarExtractosMensuales(cuentaId);
        }

        // Recargar el dashboard
        await cargarCuentasConExtractos(state.clienteActual.id);

        alert(`Extracto cargado: ${movimientos.length} movimientos`);
    } catch (error) {
        console.error('Error procesando extracto:', error);
        alert('Error al procesar el archivo: ' + error.message);
    }
}

/**
 * Eliminar extracto
 */
async function eliminarExtracto(id) {
    if (!confirm('¿Eliminar este extracto?')) {
        return;
    }

    const cuentaId = state.cuentaActual?.id;

    try {
        if (typeof supabase !== 'undefined' && supabase) {
            const { error } = await supabase
                .from('extractos_mensuales')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } else {
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            const nuevos = extractos.filter(e => e.id !== id);
            localStorage.setItem(`extractos_${cuentaId}`, JSON.stringify(nuevos));
        }

        await cargarExtractosMensuales(cuentaId);

        // Recargar el dashboard
        if (state.clienteActual?.id) {
            await cargarCuentasConExtractos(state.clienteActual.id);
        }

        alert('Extracto eliminado');
    } catch (error) {
        console.error('Error eliminando extracto:', error);
        alert('Error al eliminar el extracto');
    }
}

// ============================================
// DETALLE DE EXTRACTO - TABLA EDITABLE
// ============================================

/**
 * Ver detalle de un extracto
 */
async function verDetalleExtracto(id, cuentaId) {
    // Guardar la cuenta actual si se proporciona
    if (cuentaId) {
        state.cuentaActual = { id: cuentaId };
    }

    // Resetear modo rango (estamos viendo un extracto individual)
    state.modoRango = false;
    state.extractosRango = [];
    state.rangoActual = { desde: null, hasta: null };

    try {
        let extracto;

        if (typeof supabase !== 'undefined' && supabase) {
            const { data, error } = await supabase
                .from('extractos_mensuales')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            extracto = data;
        } else {
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            extracto = extractos.find(e => e.id === id);
        }

        if (!extracto) {
            alert('Extracto no encontrado');
            return;
        }

        state.extractoActual = extracto;
        state.movimientosOriginales = JSON.parse(JSON.stringify(extracto.data || []));
        state.movimientosEditados = JSON.parse(JSON.stringify(extracto.data || []));
        state.movimientosEliminados = [];
        state.filtros = {};
        state.ordenActual = { columna: null, direccion: 'asc' };

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        document.getElementById('detalleExtractoPeriodo').textContent =
            `${meses[extracto.mes - 1]} ${extracto.anio}`;
        document.getElementById('modalDetalleExtracto').classList.remove('hidden');

        // Limpiar filtros
        document.getElementById('filtroFecha').value = '';
        document.getElementById('filtroDescripcion').value = '';
        document.getElementById('filtroOrigen').value = '';
        state.filtroMarcadores = [];

        // Inicializar controles de marcadores
        inicializarControlesMarcadores();

        renderizarDetalleExtracto();
    } catch (error) {
        console.error('Error cargando detalle:', error);
        alert('Error al cargar el extracto');
    }
}

/**
 * Cerrar modal de detalle de extracto
 */
function cerrarDetalleExtracto() {
    document.getElementById('modalDetalleExtracto').classList.add('hidden');
    state.extractoActual = null;
    // Resetear modo rango
    state.modoRango = false;
    state.extractosRango = [];
    state.rangoActual = { desde: null, hasta: null };
}

/**
 * Renderizar tabla de detalle de extracto
 */
function renderizarDetalleExtracto() {
    const tbody = document.getElementById('detalleExtractoBody');
    const stats = document.getElementById('detalleExtractoStats');

    let movimientos = [...state.movimientosEditados];

    // Aplicar filtros de texto
    if (state.filtros.fecha) {
        movimientos = movimientos.filter(m =>
            m.fecha.toLowerCase().includes(state.filtros.fecha.toLowerCase())
        );
    }
    if (state.filtros.descripcion) {
        movimientos = movimientos.filter(m =>
            m.descripcion.toLowerCase().includes(state.filtros.descripcion.toLowerCase())
        );
    }
    if (state.filtros.origen) {
        movimientos = movimientos.filter(m =>
            m.origen.toLowerCase().includes(state.filtros.origen.toLowerCase())
        );
    }

    // Guardar movimientos filtrados por texto (antes de filtrar por marcadores)
    // para poder asignar marcadores a estos
    state.movimientosFiltradosTexto = movimientos.map(m => m.id);

    // Aplicar filtro de marcadores (si hay alguno seleccionado)
    if (state.filtroMarcadores && state.filtroMarcadores.length > 0) {
        movimientos = movimientos.filter(m => {
            const cat = m.categoria || '';
            return state.filtroMarcadores.includes(cat);
        });
    }

    // Aplicar ordenamiento
    if (state.ordenActual.columna) {
        const col = state.ordenActual.columna;
        const dir = state.ordenActual.direccion === 'asc' ? 1 : -1;

        movimientos.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * dir;
            }

            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
    }

    // Actualizar estadísticas
    const totalCreditos = movimientos.reduce((sum, m) => sum + (m.credito || 0), 0);
    const totalDebitos = movimientos.reduce((sum, m) => sum + (m.debito || 0), 0);

    // Contar categorías
    const categoriasCount = {};
    state.movimientosEditados.forEach(m => {
        const cat = m.categoria || '';
        categoriasCount[cat] = (categoriasCount[cat] || 0) + 1;
    });
    const sinCategoria = categoriasCount[''] || 0;
    const conCategoria = state.movimientosEditados.length - sinCategoria;

    // Agregar clase de modo rango si corresponde
    if (state.modoRango) {
        stats.classList.add('modo-rango');
    } else {
        stats.classList.remove('modo-rango');
    }

    stats.innerHTML = `
        <span>Mostrando ${movimientos.length} de ${state.movimientosEditados.length} movimientos</span>
        ${state.modoRango ? `<span class="stat-rango">📅 ${state.extractosRango.length} extractos combinados</span>` : ''}
        <span class="stat-credito">Total Créditos: <strong>$${formatNumber(totalCreditos)}</strong></span>
        <span class="stat-debito">Total Débitos: <strong>$${formatNumber(totalDebitos)}</strong></span>
        <span class="stat-categorias">Clasificados: <strong>${conCategoria}</strong> | Sin categoría: <strong>${sinCategoria}</strong></span>
        ${state.movimientosEliminados.length > 0 ?
            `<span class="stat-eliminados">${state.movimientosEliminados.length} eliminados (restaurables)</span>` : ''}
    `;

    // Renderizar filas con columna de categoría
    const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    tbody.innerHTML = movimientos.map(m => {
        const categoria = CATEGORIAS_MOVIMIENTO.find(c => c.id === (m.categoria || '')) || CATEGORIAS_MOVIMIENTO[0];
        const badgeStyle = m.categoria ? `background-color: ${categoria.color}20; color: ${categoria.color}; border: 1px solid ${categoria.color}40;` : '';

        // En modo rango, mostrar el período del movimiento
        const periodoCell = state.modoRango && m._extractoMes && m._extractoAnio
            ? `<td class="periodo-cell">${mesesCortos[m._extractoMes - 1]} ${m._extractoAnio}</td>`
            : '';

        return `
        <tr data-id="${m.id}">
            <td class="categoria-cell">
                <select class="categoria-select" onchange="cambiarCategoria('${m.id}', this.value)"
                        style="${m.categoria ? `border-color: ${categoria.color}; background-color: ${categoria.color}10;` : ''}">
                    ${CATEGORIAS_MOVIMIENTO.map(c =>
                        `<option value="${c.id}" ${m.categoria === c.id ? 'selected' : ''}>${c.nombre}</option>`
                    ).join('')}
                </select>
            </td>
            ${periodoCell}
            <td>${m.fecha}</td>
            <td class="editable" onclick="editarCelda(this, '${m.id}', 'descripcion')">${escapeHtml(m.descripcion)}</td>
            <td>${m.origen}</td>
            <td class="text-right credito">${m.credito > 0 ? '$' + formatNumber(m.credito) : '-'}</td>
            <td class="text-right debito">${m.debito > 0 ? '$' + formatNumber(m.debito) : '-'}</td>
            <td class="text-right">${'$' + formatNumber(m.saldo)}</td>
            <td class="actions-col">
                <button onclick="eliminarMovimiento('${m.id}')" class="btn-sm btn-danger" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `}).join('');

    // Actualizar headers de la tabla según modo rango
    actualizarHeadersTabla();

    // Actualizar indicadores de orden en headers
    document.querySelectorAll('#detalleExtractoTable th[data-sort]').forEach(th => {
        const col = th.dataset.sort;
        th.classList.remove('sort-asc', 'sort-desc');
        if (state.ordenActual.columna === col) {
            th.classList.add(`sort-${state.ordenActual.direccion}`);
        }
    });

    // Actualizar contador de movimientos filtrados para asignación
    actualizarContadorFiltrados();
}

/**
 * Actualizar headers de la tabla según modo (rango o individual)
 */
function actualizarHeadersTabla() {
    const thead = document.querySelector('#detalleExtractoTable thead tr');
    if (!thead) return;

    const periodoHeader = thead.querySelector('th.periodo-col');

    if (state.modoRango) {
        // Agregar columna de período si no existe
        if (!periodoHeader) {
            const newTh = document.createElement('th');
            newTh.className = 'periodo-col sortable';
            newTh.dataset.sort = '_extractoMes';
            newTh.onclick = () => ordenarPorColumna('_extractoMes');
            newTh.innerHTML = 'Período <span class="sort-indicator">⇅</span>';
            // Insertar después de la columna de categoría
            const categoriaCol = thead.querySelector('th.categoria-col');
            if (categoriaCol && categoriaCol.nextSibling) {
                thead.insertBefore(newTh, categoriaCol.nextSibling);
            }
        }
    } else {
        // Remover columna de período si existe
        if (periodoHeader) {
            periodoHeader.remove();
        }
    }
}

/**
 * Formatear número con separador de miles
 */
function formatNumber(num) {
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Escapar HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Ordenar por columna
 */
function ordenarPorColumna(columna) {
    if (state.ordenActual.columna === columna) {
        state.ordenActual.direccion =
            state.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        state.ordenActual.columna = columna;
        state.ordenActual.direccion = 'asc';
    }
    renderizarDetalleExtracto();
}

/**
 * Aplicar filtros
 */
function aplicarFiltrosExtracto() {
    state.filtros = {
        fecha: document.getElementById('filtroFecha').value,
        descripcion: document.getElementById('filtroDescripcion').value,
        origen: document.getElementById('filtroOrigen').value
    };
    renderizarDetalleExtracto();
}

/**
 * Limpiar filtros
 */
function limpiarFiltrosExtracto() {
    document.getElementById('filtroFecha').value = '';
    document.getElementById('filtroDescripcion').value = '';
    document.getElementById('filtroOrigen').value = '';
    state.filtros = {};
    renderizarDetalleExtracto();
}

/**
 * Editar celda (descripción)
 */
function editarCelda(td, movId, campo) {
    if (td.querySelector('input')) return;

    const valorActual = td.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valorActual;
    input.className = 'edit-input';

    const guardar = () => {
        const nuevoValor = input.value.trim();
        const mov = state.movimientosEditados.find(m => m.id === movId);
        if (mov) {
            mov[campo] = nuevoValor;
        }
        td.textContent = nuevoValor;
    };

    input.onblur = guardar;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            guardar();
            input.blur();
        } else if (e.key === 'Escape') {
            td.textContent = valorActual;
        }
    };

    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();
}

/**
 * Agregar nuevo movimiento
 */
function agregarMovimiento() {
    const nuevoMov = {
        id: Date.now().toString(),
        fecha: new Date().toLocaleDateString('es-AR'),
        descripcion: 'Nuevo movimiento',
        origen: '',
        credito: 0,
        debito: 0,
        saldo: 0
    };

    state.movimientosEditados.unshift(nuevoMov);
    renderizarDetalleExtracto();
}

/**
 * Eliminar movimiento
 */
function eliminarMovimiento(id) {
    const idx = state.movimientosEditados.findIndex(m => m.id === id);
    if (idx !== -1) {
        const eliminado = state.movimientosEditados.splice(idx, 1)[0];
        state.movimientosEliminados.push(eliminado);
        renderizarDetalleExtracto();
    }
}

/**
 * Restaurar movimientos eliminados
 */
function restaurarMovimientos() {
    if (state.movimientosEliminados.length === 0) {
        alert('No hay movimientos eliminados para restaurar');
        return;
    }

    state.movimientosEditados.push(...state.movimientosEliminados);
    state.movimientosEliminados = [];
    renderizarDetalleExtracto();
    alert('Movimientos restaurados');
}

/**
 * Restaurar datos originales
 */
function restaurarDatosOriginales() {
    if (!confirm('¿Restaurar todos los datos originales? Se perderán los cambios no guardados.')) {
        return;
    }

    state.movimientosEditados = JSON.parse(JSON.stringify(state.movimientosOriginales));
    state.movimientosEliminados = [];
    renderizarDetalleExtracto();
    alert('Datos restaurados');
}

/**
 * Guardar cambios del extracto (detecta automáticamente si es modo rango o individual)
 */
async function guardarCambiosExtracto() {
    // Si estamos en modo rango, usar la función específica
    if (state.modoRango) {
        return guardarCambiosExtractoModoRango();
    }

    // Modo individual (extracto único)
    const extractoId = state.extractoActual?.id;
    const cuentaId = state.cuentaActual?.id;

    if (!extractoId) {
        alert('Error: No hay extracto seleccionado');
        return;
    }

    try {
        if (typeof supabase !== 'undefined' && supabase) {
            const { error } = await supabase
                .from('extractos_mensuales')
                .update({
                    data: state.movimientosEditados,
                    updated_at: new Date().toISOString()
                })
                .eq('id', extractoId);

            if (error) throw error;
        } else {
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            const idx = extractos.findIndex(e => e.id === extractoId);
            if (idx !== -1) {
                extractos[idx].data = state.movimientosEditados;
                extractos[idx].updated_at = new Date().toISOString();
                localStorage.setItem(`extractos_${cuentaId}`, JSON.stringify(extractos));
            }
        }

        // Actualizar originales
        state.movimientosOriginales = JSON.parse(JSON.stringify(state.movimientosEditados));
        state.movimientosEliminados = [];

        alert('Cambios guardados exitosamente');
    } catch (error) {
        console.error('Error guardando cambios:', error);
        alert('Error al guardar los cambios: ' + error.message);
    }
}

/**
 * Guardar cambios en modo rango (múltiples extractos)
 */
async function guardarCambiosExtractoModoRango() {
    const cuentaId = state.cuentaActual?.id;

    if (!cuentaId) {
        alert('Error: No hay cuenta seleccionada');
        return;
    }

    try {
        // Agrupar movimientos por extracto
        const movimientosPorExtracto = {};

        state.movimientosEditados.forEach(mov => {
            const extractoId = mov._extractoId;
            if (!movimientosPorExtracto[extractoId]) {
                movimientosPorExtracto[extractoId] = [];
            }
            // Crear copia sin campos internos
            const movLimpio = { ...mov };
            delete movLimpio._extractoId;
            delete movLimpio._extractoMes;
            delete movLimpio._extractoAnio;
            movimientosPorExtracto[extractoId].push(movLimpio);
        });

        // Actualizar cada extracto
        if (typeof supabase !== 'undefined' && supabase) {
            for (const extractoId of Object.keys(movimientosPorExtracto)) {
                const { error } = await supabase
                    .from('extractos_mensuales')
                    .update({
                        data: movimientosPorExtracto[extractoId],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', extractoId);

                if (error) throw error;
            }
        } else {
            // Fallback localStorage
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            for (const extractoId of Object.keys(movimientosPorExtracto)) {
                const idx = extractos.findIndex(e => e.id === extractoId);
                if (idx !== -1) {
                    extractos[idx].data = movimientosPorExtracto[extractoId];
                    extractos[idx].updated_at = new Date().toISOString();
                }
            }
            localStorage.setItem(`extractos_${cuentaId}`, JSON.stringify(extractos));
        }

        // Actualizar originales manteniendo referencias
        state.movimientosOriginales = JSON.parse(JSON.stringify(state.movimientosEditados));
        state.movimientosEliminados = [];

        const totalExtractos = Object.keys(movimientosPorExtracto).length;
        alert(`Cambios guardados exitosamente en ${totalExtractos} extractos`);
    } catch (error) {
        console.error('Error guardando cambios:', error);
        alert('Error al guardar los cambios: ' + error.message);
    }
}

/**
 * Descargar extracto como Excel
 */
function descargarExtractoExcel() {
    const movimientos = state.movimientosEditados;
    const extracto = state.extractoActual;

    if (!movimientos || movimientos.length === 0) {
        alert('No hay movimientos para descargar');
        return;
    }

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const wsData = [
        ['Categoría', 'Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'],
        ...movimientos.map(m => {
            const cat = CATEGORIAS_MOVIMIENTO.find(c => c.id === (m.categoria || ''));
            return [
                cat ? cat.nombre : '',
                m.fecha,
                m.descripcion,
                m.origen,
                m.credito || 0,
                m.debito || 0,
                m.saldo || 0
            ];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formatear columnas numéricas
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = 1; row <= range.e.r; row++) {
        for (let col = 4; col <= 6; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
                ws[cellRef].t = 'n';
                ws[cellRef].z = '#,##0.00';
            }
        }
    }

    // Ajustar anchos
    ws['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 50 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracto');

    const fileName = `extracto_${meses[extracto.mes - 1]}_${extracto.anio}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ============================================
// GESTIÓN DE MARCADORES/CATEGORÍAS
// ============================================

/**
 * Inicializar controles de marcadores
 */
function inicializarControlesMarcadores() {
    // Llenar select de asignación masiva
    const selectAsignar = document.getElementById('marcadorAsignar');
    if (selectAsignar) {
        selectAsignar.innerHTML = CATEGORIAS_MOVIMIENTO
            .filter(c => c.id !== '') // Excluir "Sin categoría" del selector de asignación
            .map(c => `<option value="${c.id}">${c.nombre}</option>`)
            .join('');
    }

    // Llenar checkboxes de filtro
    const container = document.getElementById('filtroMarcadoresContainer');
    if (container) {
        container.innerHTML = CATEGORIAS_MOVIMIENTO.map(c => {
            const checkId = `filtroMarcador_${c.id || 'sin'}`;
            return `
                <label class="marcador-checkbox" style="${c.id ? `--marcador-color: ${c.color};` : ''}">
                    <input type="checkbox" id="${checkId}" value="${c.id}" onchange="toggleFiltroMarcador('${c.id}')">
                    <span class="marcador-label ${c.id ? 'con-color' : ''}">${c.id ? c.nombre : 'Sin categoría'}</span>
                </label>
            `;
        }).join('');
    }
}

/**
 * Actualizar contador de movimientos filtrados
 */
function actualizarContadorFiltrados() {
    const label = document.querySelector('.asignar-label');
    if (label && state.movimientosFiltradosTexto) {
        const count = state.movimientosFiltradosTexto.length;
        label.textContent = `🏷️ Asignar a filtrados (${count}):`;
    }
}

/**
 * Cambiar categoría de un movimiento individual
 */
function cambiarCategoria(movId, categoriaId) {
    const mov = state.movimientosEditados.find(m => m.id === movId);
    if (mov) {
        mov.categoria = categoriaId;
        renderizarDetalleExtracto();
    }
}

/**
 * Asignar marcador a todos los movimientos filtrados por texto
 */
function asignarMarcadorFiltrados() {
    const selectAsignar = document.getElementById('marcadorAsignar');
    const categoriaId = selectAsignar.value;

    if (!categoriaId) {
        alert('Seleccione una categoría para asignar');
        return;
    }

    const idsFiltrados = state.movimientosFiltradosTexto || [];

    if (idsFiltrados.length === 0) {
        alert('No hay movimientos filtrados para asignar');
        return;
    }

    const categoria = CATEGORIAS_MOVIMIENTO.find(c => c.id === categoriaId);
    if (!confirm(`¿Asignar "${categoria.nombre}" a ${idsFiltrados.length} movimientos filtrados?`)) {
        return;
    }

    // Asignar categoría a los movimientos filtrados
    let count = 0;
    state.movimientosEditados.forEach(m => {
        if (idsFiltrados.includes(m.id)) {
            m.categoria = categoriaId;
            count++;
        }
    });

    renderizarDetalleExtracto();
    alert(`Se asignó "${categoria.nombre}" a ${count} movimientos`);
}

/**
 * Quitar categoría de todos los movimientos filtrados
 */
function quitarMarcadorFiltrados() {
    const idsFiltrados = state.movimientosFiltradosTexto || [];

    if (idsFiltrados.length === 0) {
        alert('No hay movimientos filtrados');
        return;
    }

    if (!confirm(`¿Quitar la categoría de ${idsFiltrados.length} movimientos filtrados?`)) {
        return;
    }

    // Quitar categoría de los movimientos filtrados
    let count = 0;
    state.movimientosEditados.forEach(m => {
        if (idsFiltrados.includes(m.id) && m.categoria) {
            m.categoria = '';
            count++;
        }
    });

    renderizarDetalleExtracto();
    alert(`Se quitó la categoría de ${count} movimientos`);
}

/**
 * Toggle filtro de marcador (checkbox)
 */
function toggleFiltroMarcador(categoriaId) {
    const idx = state.filtroMarcadores.indexOf(categoriaId);
    if (idx === -1) {
        state.filtroMarcadores.push(categoriaId);
    } else {
        state.filtroMarcadores.splice(idx, 1);
    }
    renderizarDetalleExtracto();
}

/**
 * Limpiar filtro de marcadores
 */
function limpiarFiltroMarcadores() {
    state.filtroMarcadores = [];

    // Desmarcar todos los checkboxes
    document.querySelectorAll('#filtroMarcadoresContainer input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    renderizarDetalleExtracto();
}

// ============================================
// MODO RANGO DE FECHAS - VER MÚLTIPLES EXTRACTOS
// ============================================

/**
 * Mostrar modal para seleccionar rango de fechas
 */
function mostrarModalRangoFechas(cuentaId, cuentaNombre) {
    document.getElementById('rangoCuentaId').value = cuentaId;
    document.getElementById('rangoCuentaNombre').value = cuentaNombre;

    // Establecer valores por defecto (último año)
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    document.getElementById('rangoMesDesde').value = '1';
    document.getElementById('rangoAnioDesde').value = anioActual;
    document.getElementById('rangoMesHasta').value = mesActual;
    document.getElementById('rangoAnioHasta').value = anioActual;

    document.getElementById('modalRangoFechas').classList.remove('hidden');
}

/**
 * Cerrar modal de rango de fechas
 */
function cerrarModalRangoFechas() {
    document.getElementById('modalRangoFechas').classList.add('hidden');
}

/**
 * Cargar extractos por rango de fechas
 */
async function cargarExtractosPorRango() {
    const cuentaId = document.getElementById('rangoCuentaId').value;
    const cuentaNombre = document.getElementById('rangoCuentaNombre').value;

    const mesDesde = parseInt(document.getElementById('rangoMesDesde').value);
    const anioDesde = parseInt(document.getElementById('rangoAnioDesde').value);
    const mesHasta = parseInt(document.getElementById('rangoMesHasta').value);
    const anioHasta = parseInt(document.getElementById('rangoAnioHasta').value);

    // Validar rango
    if (!anioDesde || !anioHasta) {
        alert('Por favor complete el año de inicio y fin');
        return;
    }

    const fechaDesde = anioDesde * 100 + mesDesde;
    const fechaHasta = anioHasta * 100 + mesHasta;

    if (fechaDesde > fechaHasta) {
        alert('La fecha "Desde" debe ser anterior o igual a la fecha "Hasta"');
        return;
    }

    try {
        let extractos = [];

        if (typeof supabase !== 'undefined' && supabase) {
            // Cargar extractos de la cuenta en el rango especificado
            const { data, error } = await supabase
                .from('extractos_mensuales')
                .select('*')
                .eq('cuenta_id', cuentaId)
                .order('anio', { ascending: true })
                .order('mes', { ascending: true });

            if (error) throw error;

            // Filtrar por rango de fechas
            extractos = (data || []).filter(ext => {
                const fechaExt = ext.anio * 100 + ext.mes;
                return fechaExt >= fechaDesde && fechaExt <= fechaHasta;
            });
        } else {
            // Fallback localStorage
            const todosExtractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            extractos = todosExtractos.filter(ext => {
                const fechaExt = ext.anio * 100 + ext.mes;
                return fechaExt >= fechaDesde && fechaExt <= fechaHasta;
            }).sort((a, b) => {
                const fechaA = a.anio * 100 + a.mes;
                const fechaB = b.anio * 100 + b.mes;
                return fechaA - fechaB;
            });
        }

        if (extractos.length === 0) {
            alert('No se encontraron extractos en el rango seleccionado');
            return;
        }

        // Configurar estado para modo rango
        state.modoRango = true;
        state.extractosRango = extractos;
        state.cuentaActual = { id: cuentaId, nombre: cuentaNombre };
        state.rangoActual = {
            desde: { mes: mesDesde, anio: anioDesde },
            hasta: { mes: mesHasta, anio: anioHasta }
        };

        // Combinar todos los movimientos con referencia a su extracto
        const movimientosCombinados = [];
        extractos.forEach(ext => {
            const movs = ext.data || [];
            movs.forEach(mov => {
                movimientosCombinados.push({
                    ...mov,
                    _extractoId: ext.id,
                    _extractoMes: ext.mes,
                    _extractoAnio: ext.anio
                });
            });
        });

        state.movimientosOriginales = JSON.parse(JSON.stringify(movimientosCombinados));
        state.movimientosEditados = JSON.parse(JSON.stringify(movimientosCombinados));
        state.movimientosEliminados = [];
        state.filtros = {};
        state.filtroMarcadores = [];
        state.ordenActual = { columna: null, direccion: 'asc' };

        // Actualizar título del modal
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const periodoTexto = `${meses[mesDesde - 1]} ${anioDesde} - ${meses[mesHasta - 1]} ${anioHasta}`;

        document.getElementById('detalleExtractoPeriodo').innerHTML =
            `<span class="periodo-rango">${periodoTexto}</span> <span class="badge-rango">${extractos.length} extractos</span>`;

        // Cerrar modal de rango y abrir detalle
        cerrarModalRangoFechas();
        document.getElementById('modalDetalleExtracto').classList.remove('hidden');

        // Limpiar filtros de texto
        document.getElementById('filtroFecha').value = '';
        document.getElementById('filtroDescripcion').value = '';
        document.getElementById('filtroOrigen').value = '';

        // Inicializar controles de marcadores
        inicializarControlesMarcadores();

        renderizarDetalleExtracto();

        console.log(`✅ Cargados ${extractos.length} extractos con ${movimientosCombinados.length} movimientos en total`);
    } catch (error) {
        console.error('Error cargando extractos por rango:', error);
        alert('Error al cargar los extractos: ' + error.message);
    }
}
