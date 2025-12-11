// ============================================
// MÓDULO DE AUDITORÍA - CUENTAS BANCARIAS Y EXTRACTOS
// ============================================

// Estado del módulo de auditoría
const auditoriaState = {
    clienteActual: null,
    cuentaActual: null,
    extractoActual: null,
    movimientosOriginales: [], // Para restaurar
    movimientosEditados: [],
    movimientosEliminados: [],
    ordenActual: { columna: null, direccion: 'asc' },
    filtros: {}
};

// ============================================
// GESTIÓN DE CUENTAS BANCARIAS
// ============================================

/**
 * Abrir modal de cuentas bancarias para un cliente
 */
async function abrirCuentasBancarias(clienteId, clienteNombre) {
    auditoriaState.clienteActual = { id: clienteId, nombre: clienteNombre };

    document.getElementById('cuentasBancariasClienteNombre').textContent = clienteNombre;
    document.getElementById('modalCuentasBancarias').classList.remove('hidden');

    await cargarCuentasBancarias(clienteId);
}

/**
 * Cerrar modal de cuentas bancarias
 */
function cerrarCuentasBancarias() {
    document.getElementById('modalCuentasBancarias').classList.add('hidden');
    auditoriaState.clienteActual = null;
}

/**
 * Cargar cuentas bancarias desde Supabase
 */
async function cargarCuentasBancarias(clienteId) {
    const lista = document.getElementById('cuentasBancariasList');
    lista.innerHTML = '<div class="loading-state">Cargando cuentas bancarias...</div>';

    try {
        // Intentar cargar desde Supabase
        if (supabase) {
            const { data, error } = await supabase
                .from('cuentas_bancarias')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('banco');

            if (error) throw error;

            renderizarCuentasBancarias(data || []);
        } else {
            // Fallback a localStorage
            const cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            renderizarCuentasBancarias(cuentas);
        }
    } catch (error) {
        console.error('Error cargando cuentas bancarias:', error);
        lista.innerHTML = '<div class="error-state">Error al cargar cuentas bancarias</div>';
    }
}

/**
 * Renderizar lista de cuentas bancarias
 */
function renderizarCuentasBancarias(cuentas) {
    const lista = document.getElementById('cuentasBancariasList');

    if (cuentas.length === 0) {
        lista.innerHTML = '<div class="empty-state">No hay cuentas bancarias configuradas. Agregue una para comenzar.</div>';
        return;
    }

    const html = `
        <table class="preview-table" style="width: 100%;">
            <thead>
                <tr>
                    <th>Banco</th>
                    <th>Tipo de Cuenta</th>
                    <th>Número/CBU</th>
                    <th>Alias</th>
                    <th style="width: 200px; text-align: center;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${cuentas.map(cuenta => `
                    <tr>
                        <td>${cuenta.banco || '-'}</td>
                        <td>${cuenta.tipo_cuenta || '-'}</td>
                        <td>${cuenta.numero_cuenta || '-'}</td>
                        <td>${cuenta.alias || '-'}</td>
                        <td style="text-align: center;">
                            <button onclick="verExtractosCuenta('${cuenta.id}', '${(cuenta.banco || '').replace(/'/g, "\\'")} - ${(cuenta.numero_cuenta || '').replace(/'/g, "\\'")}')" class="btn-sm btn-primary" style="margin-right: 4px;">📋 Extractos</button>
                            <button onclick="editarCuentaBancaria('${cuenta.id}')" class="btn-sm btn-secondary" style="margin-right: 4px;">✏️</button>
                            <button onclick="eliminarCuentaBancaria('${cuenta.id}')" class="btn-sm btn-danger">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    lista.innerHTML = html;
}

/**
 * Mostrar modal para nueva cuenta bancaria
 */
function mostrarNuevaCuentaBancaria() {
    document.getElementById('nuevaCuentaBancariaId').value = '';
    document.getElementById('nuevaCuentaBanco').value = '';
    document.getElementById('nuevaCuentaTipo').value = 'Cuenta Corriente';
    document.getElementById('nuevaCuentaNumero').value = '';
    document.getElementById('nuevaCuentaAlias').value = '';
    document.getElementById('modalNuevaCuentaBancaria').classList.remove('hidden');
    document.getElementById('nuevaCuentaBanco').focus();
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
    const id = document.getElementById('nuevaCuentaBancariaId').value;
    const banco = document.getElementById('nuevaCuentaBanco').value.trim();
    const tipo = document.getElementById('nuevaCuentaTipo').value;
    const numero = document.getElementById('nuevaCuentaNumero').value.trim();
    const alias = document.getElementById('nuevaCuentaAlias').value.trim();

    if (!banco) {
        alert('El nombre del banco es obligatorio');
        return;
    }

    const clienteId = auditoriaState.clienteActual?.id;
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

        if (supabase) {
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
        await cargarCuentasBancarias(clienteId);
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
        const clienteId = auditoriaState.clienteActual?.id;

        if (supabase) {
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

        document.getElementById('nuevaCuentaBancariaId').value = cuenta.id;
        document.getElementById('nuevaCuentaBanco').value = cuenta.banco || '';
        document.getElementById('nuevaCuentaTipo').value = cuenta.tipo_cuenta || 'Cuenta Corriente';
        document.getElementById('nuevaCuentaNumero').value = cuenta.numero_cuenta || '';
        document.getElementById('nuevaCuentaAlias').value = cuenta.alias || '';
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

    const clienteId = auditoriaState.clienteActual?.id;

    try {
        if (supabase) {
            // Primero eliminar extractos asociados
            await supabase
                .from('extractos_mensuales')
                .delete()
                .eq('cuenta_id', id);

            // Luego eliminar la cuenta
            const { error } = await supabase
                .from('cuentas_bancarias')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } else {
            const cuentas = JSON.parse(localStorage.getItem(`cuentas_bancarias_${clienteId}`) || '[]');
            const nuevasCuentas = cuentas.filter(c => c.id !== id);
            localStorage.setItem(`cuentas_bancarias_${clienteId}`, JSON.stringify(nuevasCuentas));
            localStorage.removeItem(`extractos_${id}`);
        }

        await cargarCuentasBancarias(clienteId);
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
 * Ver extractos de una cuenta
 */
async function verExtractosCuenta(cuentaId, cuentaNombre) {
    auditoriaState.cuentaActual = { id: cuentaId, nombre: cuentaNombre };

    document.getElementById('extractosCuentaNombre').textContent = cuentaNombre;
    document.getElementById('modalExtractosMensuales').classList.remove('hidden');

    await cargarExtractosMensuales(cuentaId);
}

/**
 * Cerrar modal de extractos mensuales
 */
function cerrarExtractosMensuales() {
    document.getElementById('modalExtractosMensuales').classList.add('hidden');
    auditoriaState.cuentaActual = null;
}

/**
 * Cargar extractos mensuales desde Supabase
 */
async function cargarExtractosMensuales(cuentaId) {
    const lista = document.getElementById('extractosMensualesList');
    lista.innerHTML = '<div class="loading-state">Cargando extractos...</div>';

    try {
        let extractos = [];

        if (supabase) {
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
        <table class="preview-table" style="width: 100%;">
            <thead>
                <tr>
                    <th>Período</th>
                    <th>Movimientos</th>
                    <th>Fecha de Carga</th>
                    <th style="width: 200px; text-align: center;">Acciones</th>
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
                            <td style="text-align: center;">
                                <button onclick="verDetalleExtracto('${ext.id}')" class="btn-sm btn-primary" style="margin-right: 4px;">👁️ Ver</button>
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
    // Establecer mes y año actual por defecto
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

    const cuentaId = auditoriaState.cuentaActual?.id;
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

        // Detectar si hay saldo inicial (fila con "Saldo inicial" en columna G)
        let saldoInicial = null;
        let startRow = 0;

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
                // Fecha en formato Excel
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
        if (supabase) {
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
                // Eliminar el existente
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
        await cargarExtractosMensuales(cuentaId);
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

    const cuentaId = auditoriaState.cuentaActual?.id;

    try {
        if (supabase) {
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
async function verDetalleExtracto(id) {
    try {
        let extracto;
        const cuentaId = auditoriaState.cuentaActual?.id;

        if (supabase) {
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

        auditoriaState.extractoActual = extracto;
        auditoriaState.movimientosOriginales = JSON.parse(JSON.stringify(extracto.data || []));
        auditoriaState.movimientosEditados = JSON.parse(JSON.stringify(extracto.data || []));
        auditoriaState.movimientosEliminados = [];
        auditoriaState.filtros = {};
        auditoriaState.ordenActual = { columna: null, direccion: 'asc' };

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        document.getElementById('detalleExtractoPeriodo').textContent =
            `${meses[extracto.mes - 1]} ${extracto.anio}`;
        document.getElementById('modalDetalleExtracto').classList.remove('hidden');

        // Limpiar filtros
        document.getElementById('filtroFecha').value = '';
        document.getElementById('filtroDescripcion').value = '';
        document.getElementById('filtroOrigen').value = '';

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
    auditoriaState.extractoActual = null;
}

/**
 * Renderizar tabla de detalle de extracto
 */
function renderizarDetalleExtracto() {
    const tbody = document.getElementById('detalleExtractoBody');
    const stats = document.getElementById('detalleExtractoStats');

    let movimientos = [...auditoriaState.movimientosEditados];

    // Aplicar filtros
    if (auditoriaState.filtros.fecha) {
        movimientos = movimientos.filter(m =>
            m.fecha.toLowerCase().includes(auditoriaState.filtros.fecha.toLowerCase())
        );
    }
    if (auditoriaState.filtros.descripcion) {
        movimientos = movimientos.filter(m =>
            m.descripcion.toLowerCase().includes(auditoriaState.filtros.descripcion.toLowerCase())
        );
    }
    if (auditoriaState.filtros.origen) {
        movimientos = movimientos.filter(m =>
            m.origen.toLowerCase().includes(auditoriaState.filtros.origen.toLowerCase())
        );
    }

    // Aplicar ordenamiento
    if (auditoriaState.ordenActual.columna) {
        const col = auditoriaState.ordenActual.columna;
        const dir = auditoriaState.ordenActual.direccion === 'asc' ? 1 : -1;

        movimientos.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            // Para números
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * dir;
            }

            // Para strings
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
    stats.innerHTML = `
        <span>Mostrando ${movimientos.length} de ${auditoriaState.movimientosEditados.length} movimientos</span>
        <span style="margin-left: 20px;">Total Créditos: <strong style="color: #38a169;">$${formatNumber(totalCreditos)}</strong></span>
        <span style="margin-left: 20px;">Total Débitos: <strong style="color: #e53e3e;">$${formatNumber(totalDebitos)}</strong></span>
        ${auditoriaState.movimientosEliminados.length > 0 ?
            `<span style="margin-left: 20px; color: #f59e0b;">${auditoriaState.movimientosEliminados.length} eliminados (restaurables)</span>` : ''}
    `;

    // Renderizar filas
    tbody.innerHTML = movimientos.map(m => `
        <tr data-id="${m.id}">
            <td>${m.fecha}</td>
            <td class="editable" onclick="editarCelda(this, '${m.id}', 'descripcion')">${escapeHtml(m.descripcion)}</td>
            <td>${m.origen}</td>
            <td style="text-align: right; color: #38a169;">${m.credito > 0 ? '$' + formatNumber(m.credito) : '-'}</td>
            <td style="text-align: right; color: #e53e3e;">${m.debito > 0 ? '$' + formatNumber(m.debito) : '-'}</td>
            <td style="text-align: right;">${'$' + formatNumber(m.saldo)}</td>
            <td style="text-align: center;">
                <button onclick="eliminarMovimiento('${m.id}')" class="btn-sm btn-danger" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');

    // Actualizar indicadores de orden en headers
    document.querySelectorAll('#detalleExtractoTable th[data-sort]').forEach(th => {
        const col = th.dataset.sort;
        th.classList.remove('sort-asc', 'sort-desc');
        if (auditoriaState.ordenActual.columna === col) {
            th.classList.add(`sort-${auditoriaState.ordenActual.direccion}`);
        }
    });
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
    if (auditoriaState.ordenActual.columna === columna) {
        auditoriaState.ordenActual.direccion =
            auditoriaState.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        auditoriaState.ordenActual.columna = columna;
        auditoriaState.ordenActual.direccion = 'asc';
    }
    renderizarDetalleExtracto();
}

/**
 * Aplicar filtros
 */
function aplicarFiltrosExtracto() {
    auditoriaState.filtros = {
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
    auditoriaState.filtros = {};
    renderizarDetalleExtracto();
}

/**
 * Editar celda (descripción)
 */
function editarCelda(td, movId, campo) {
    if (td.querySelector('input')) return; // Ya está en modo edición

    const valorActual = td.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valorActual;
    input.className = 'edit-input';
    input.style.cssText = 'width: 100%; padding: 4px; border: 1px solid #3b82f6; border-radius: 4px;';

    const guardar = () => {
        const nuevoValor = input.value.trim();
        const mov = auditoriaState.movimientosEditados.find(m => m.id === movId);
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

    auditoriaState.movimientosEditados.unshift(nuevoMov);
    renderizarDetalleExtracto();
}

/**
 * Eliminar movimiento
 */
function eliminarMovimiento(id) {
    const idx = auditoriaState.movimientosEditados.findIndex(m => m.id === id);
    if (idx !== -1) {
        const eliminado = auditoriaState.movimientosEditados.splice(idx, 1)[0];
        auditoriaState.movimientosEliminados.push(eliminado);
        renderizarDetalleExtracto();
    }
}

/**
 * Restaurar movimientos eliminados
 */
function restaurarMovimientos() {
    if (auditoriaState.movimientosEliminados.length === 0) {
        alert('No hay movimientos eliminados para restaurar');
        return;
    }

    auditoriaState.movimientosEditados.push(...auditoriaState.movimientosEliminados);
    auditoriaState.movimientosEliminados = [];
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

    auditoriaState.movimientosEditados = JSON.parse(JSON.stringify(auditoriaState.movimientosOriginales));
    auditoriaState.movimientosEliminados = [];
    renderizarDetalleExtracto();
    alert('Datos restaurados');
}

/**
 * Guardar cambios del extracto
 */
async function guardarCambiosExtracto() {
    const extractoId = auditoriaState.extractoActual?.id;
    const cuentaId = auditoriaState.cuentaActual?.id;

    if (!extractoId) {
        alert('Error: No hay extracto seleccionado');
        return;
    }

    try {
        if (supabase) {
            const { error } = await supabase
                .from('extractos_mensuales')
                .update({
                    data: auditoriaState.movimientosEditados,
                    updated_at: new Date().toISOString()
                })
                .eq('id', extractoId);

            if (error) throw error;
        } else {
            const extractos = JSON.parse(localStorage.getItem(`extractos_${cuentaId}`) || '[]');
            const idx = extractos.findIndex(e => e.id === extractoId);
            if (idx !== -1) {
                extractos[idx].data = auditoriaState.movimientosEditados;
                extractos[idx].updated_at = new Date().toISOString();
                localStorage.setItem(`extractos_${cuentaId}`, JSON.stringify(extractos));
            }
        }

        // Actualizar originales
        auditoriaState.movimientosOriginales = JSON.parse(JSON.stringify(auditoriaState.movimientosEditados));
        auditoriaState.movimientosEliminados = [];

        alert('Cambios guardados exitosamente');
    } catch (error) {
        console.error('Error guardando cambios:', error);
        alert('Error al guardar los cambios: ' + error.message);
    }
}

/**
 * Descargar extracto como Excel
 */
function descargarExtractoExcel() {
    const movimientos = auditoriaState.movimientosEditados;
    const extracto = auditoriaState.extractoActual;

    if (!movimientos || movimientos.length === 0) {
        alert('No hay movimientos para descargar');
        return;
    }

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const wsData = [
        ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'],
        ...movimientos.map(m => [
            m.fecha,
            m.descripcion,
            m.origen,
            m.credito || 0,
            m.debito || 0,
            m.saldo || 0
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formatear columnas numéricas
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = 1; row <= range.e.r; row++) {
        for (let col = 3; col <= 5; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
                ws[cellRef].t = 'n';
                ws[cellRef].z = '#,##0.00';
            }
        }
    }

    // Ajustar anchos
    ws['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 50 }, // Descripción
        { wch: 20 }, // Origen
        { wch: 15 }, // Crédito
        { wch: 15 }, // Débito
        { wch: 15 }  // Saldo
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracto');

    const fileName = `extracto_${meses[extracto.mes - 1]}_${extracto.anio}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ============================================
// INICIALIZACIÓN DE EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Event listeners para filtros
    const filtroFecha = document.getElementById('filtroFecha');
    const filtroDescripcion = document.getElementById('filtroDescripcion');
    const filtroOrigen = document.getElementById('filtroOrigen');

    if (filtroFecha) {
        filtroFecha.addEventListener('input', aplicarFiltrosExtracto);
    }
    if (filtroDescripcion) {
        filtroDescripcion.addEventListener('input', aplicarFiltrosExtracto);
    }
    if (filtroOrigen) {
        filtroOrigen.addEventListener('input', aplicarFiltrosExtracto);
    }
});
