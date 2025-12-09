// ============================================
// CACHE DE IMPUESTOS DESDE SUPABASE
// ============================================
let impuestosCache = null;
let impuestosCacheTimestamp = null;
const IMPUESTOS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ============================================
// FUNCIÓN HELPER PARA PARSEAR CÓDIGOS DE IMPUESTO
// ============================================
/**
 * Parsea el campo codigos_impuesto que puede venir en varios formatos:
 * - null/undefined → []
 * - array nativo → array
 * - string JSON (empieza con '[') → JSON.parse
 * - string con comas → split por comas
 * @param {any} codigosRaw - Valor crudo del campo codigos_impuesto
 * @returns {Array<string>} Array de códigos de impuesto
 */
function parseCodigosImpuesto(codigosRaw) {
    if (!codigosRaw) {
        return [];
    }

    // Si ya es un array, devolverlo filtrado
    if (Array.isArray(codigosRaw)) {
        return codigosRaw.filter(c => c && (typeof c === 'string' ? c.trim() : c));
    }

    // Si es un string
    if (typeof codigosRaw === 'string') {
        const trimmed = codigosRaw.trim();

        // Si parece un JSON array, intentar parsearlo
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.filter(c => c && (typeof c === 'string' ? c.trim() : c));
                }
            } catch (e) {
                console.warn('Error parseando JSON de códigos de impuesto:', e);
            }
        }

        // Si no es JSON, hacer split por comas
        return trimmed.split(',').map(c => c.trim()).filter(c => c);
    }

    // Para cualquier otro tipo, devolver array vacío
    console.warn('Tipo inesperado para codigos_impuesto:', typeof codigosRaw, codigosRaw);
    return [];
}

/**
 * Obtener impuestos desde Supabase (con cache)
 * Usa la tabla impuestos_base con las columnas:
 * - codigo_impuesto, descripcion_impuesto
 * - codigo_concepto, descripcion_concepto
 * - codigo_subconcepto, descripcion_subconcepto
 */
async function obtenerImpuestosBase() {
    // Usar cache si está disponible y no ha expirado
    if (impuestosCache && impuestosCacheTimestamp &&
        (Date.now() - impuestosCacheTimestamp) < IMPUESTOS_CACHE_TTL) {
        return impuestosCache;
    }

    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return [];
        }

        // Consultar la tabla impuestos_base con los nombres de columnas correctos
        const { data, error } = await supabase
            .from('impuestos_base')
            .select('*')
            .order('codigo_impuesto')
            .order('codigo_concepto')
            .order('codigo_subconcepto');

        if (error) {
            console.error('Error obteniendo impuestos:', error);
            return [];
        }

        // Normalizar los datos para usar nombres consistentes
        const impuestosNormalizados = (data || []).map(imp => {
            // Usar los nombres de columnas correctos de impuestos_base
            const codImp = imp.codigo_impuesto || '';
            const descImp = imp.descripcion_impuesto || '';
            const codConc = imp.codigo_concepto || '';
            const descConc = imp.descripcion_concepto || '';
            const codSub = imp.codigo_subconcepto || '';
            const descSub = imp.descripcion_subconcepto || '';

            // Crear código compuesto único
            const codigoCompuesto = `${codImp}-${codConc}-${codSub}`;

            // Crear descripción completa
            const descripcionCompleta = [descImp, descConc, descSub]
                .filter(d => d && d.trim())
                .join(' / ');

            return {
                id: imp.id,
                codigoCompuesto,
                codImp,
                descImp,
                codConc,
                descConc,
                codSub,
                descSub,
                descripcionCompleta
            };
        });

        // Guardar en cache
        impuestosCache = impuestosNormalizados;
        impuestosCacheTimestamp = Date.now();

        console.log(`✅ Impuestos cargados: ${impuestosNormalizados.length} registros`);
        return impuestosNormalizados;
    } catch (err) {
        console.error('Error general obteniendo impuestos:', err);
        return [];
    }
}

/**
 * Filtrar impuestos por término de búsqueda
 */
function filtrarImpuestos(impuestos, termino) {
    if (!termino || !termino.trim()) return impuestos;

    const term = termino.toLowerCase().trim();
    return impuestos.filter(imp =>
        imp.codigoCompuesto.toLowerCase().includes(term) ||
        imp.descImp.toLowerCase().includes(term) ||
        imp.descConc.toLowerCase().includes(term) ||
        imp.descSub.toLowerCase().includes(term) ||
        imp.descripcionCompleta.toLowerCase().includes(term)
    );
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== HERRAMIENTAS CONTABLES - SISTEMA CENTRALIZADO ===');

    // Inicializar contadores con datos locales primero
    updateCounts();
    attachEventListeners();

    // Sincronizar con Supabase en segundo plano
    await syncWithSupabase();

    console.log('Impuestos (localStorage):', TaxManager.getAllTaxes().length);
    console.log('====================================================');
});

// Sincronizar datos con Supabase
async function syncWithSupabase() {
    try {
        if (!supabase) {
            console.warn('Supabase no está disponible. Trabajando solo con localStorage.');
            return;
        }

        console.log('🔄 Sincronizando con Supabase...');

        // Obtener conteo de impuestos desde Supabase
        const taxCount = await getSupabaseTaxDatabaseCount();

        console.log(`✅ Supabase: ${taxCount} registros de impuestos`);
        updateCounts();
    } catch (error) {
        console.error('Error sincronizando con Supabase:', error);
    }
}

// Obtener cantidad de impuestos desde Supabase (nueva tabla impuestos_base)
async function getSupabaseTaxDatabaseCount() {
    try {
        const { count, error } = await supabase
            .from('impuestos_base')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error obteniendo conteo de impuestos:', error);
        return 0;
    }
}

// ============================================
// ACTUALIZAR CONTADORES
// ============================================
async function updateCounts() {
    // Los contadores de impuestos ya no se muestran en el UI
    // Esta función se mantiene por compatibilidad
}

async function updateCountsFromLocalStorage() {
    // Los contadores de impuestos ya no se muestran en el UI
    // Esta función se mantiene por compatibilidad
}

// ============================================
// EVENT LISTENERS
// ============================================
function attachEventListeners() {
    // Botones del menú superior
    document.getElementById('btnClients').addEventListener('click', () => showClientsModal());
    document.getElementById('btnTaxes').addEventListener('click', () => showTaxesModal());
    document.getElementById('btnStorage').addEventListener('click', () => showStorageModal());

    // Modal Clientes
    document.getElementById('btnCloseClients').addEventListener('click', () => hideClientsModal());
    document.getElementById('btnNewClient').addEventListener('click', () => showNewClientModal());
    document.getElementById('btnDownloadTemplate').addEventListener('click', () => downloadClientTemplate());
    document.getElementById('btnCancelNewClient').addEventListener('click', () => hideNewClientModal());
    document.getElementById('btnCreateClient').addEventListener('click', async () => {
        const razon_social = document.getElementById('newClientName').value;
        const cuit = document.getElementById('newClientCuit').value;

        if (!razon_social) {
            alert('La razón social es obligatoria');
            return;
        }

        await crearClienteSimple(razon_social, cuit);

        // Recargar lista de clientes
        const clientes = await obtenerClientes();
        console.log('Clientes actuales:', clientes);

        // Cerrar modal y actualizar lista
        hideNewClientModal();
        await renderClientsList();
        await updateCounts();
    });
    document.getElementById('importClientsFile').addEventListener('change', (e) => importClients(e));

    // Búsqueda de clientes
    document.getElementById('clientSearchInput').addEventListener('input', (e) => {
        renderClientsList(e.target.value);
    });

    // Modal Impuestos
    document.getElementById('btnCloseTaxes').addEventListener('click', () => hideTaxesModal());
    document.getElementById('btnDownloadTaxTemplate').addEventListener('click', () => downloadTaxTemplate());
    document.getElementById('importTaxFile').addEventListener('change', (e) => importTaxes(e));
    document.getElementById('btnClearTaxDatabase').addEventListener('click', () => clearTaxDatabase());

    // Modal Almacenamiento
    document.getElementById('btnCloseStorage').addEventListener('click', () => hideStorageModal());
    document.getElementById('btnRefreshStorage').addEventListener('click', () => showStorageStats());

    // Modal Plan de Cuentas
    document.getElementById('btnClosePlanCuentas').addEventListener('click', () => hidePlanCuentasModal());
    document.getElementById('btnDescargarPlantillaPlan').addEventListener('click', () => descargarPlantillaPlan());
    document.getElementById('importPlanFile').addEventListener('change', (e) => importarPlanCuentasUI(e));
    document.getElementById('btnNuevaCuenta').addEventListener('click', () => showNuevaCuentaModal());
    document.getElementById('btnCancelNuevaCuenta').addEventListener('click', () => hideNuevaCuentaModal());
    document.getElementById('btnCrearCuenta').addEventListener('click', () => crearCuentaUI());
    document.getElementById('btnEliminarPlanCompleto').addEventListener('click', () => eliminarPlanCompletoUI());

    // Modal Editar Cuenta
    document.getElementById('btnCancelEditarCuenta').addEventListener('click', () => hideEditarCuentaModal());
    document.getElementById('btnGuardarCuenta').addEventListener('click', () => guardarCambiosCuenta());

    // Listeners para cambios en los datos
    TaxManager.onTaxDatabaseChange(() => {
        updateCounts();
    });
}

// ============================================
// MODAL CLIENTES
// ============================================
async function showClientsModal() {
    document.getElementById('modalClients').classList.remove('hidden');
    await renderClientsList();
}

function hideClientsModal() {
    document.getElementById('modalClients').classList.add('hidden');
    document.getElementById('clientSearchInput').value = '';
}

function showNewClientModal() {
    document.getElementById('modalNewClient').classList.remove('hidden');
    document.getElementById('newClientName').value = '';
    document.getElementById('newClientCuit').value = '';
    document.getElementById('newClientName').focus();
}

function hideNewClientModal() {
    document.getElementById('modalNewClient').classList.add('hidden');
}

async function createClient() {
    const name = document.getElementById('newClientName').value.trim();
    if (!name) {
        alert('Ingresa una razón social para el cliente');
        return;
    }

    const cuit = document.getElementById('newClientCuit').value.trim();

    try {
        // Crear usando crearClienteSimple (usa Supabase o localStorage)
        const result = await crearClienteSimple(name, cuit);
        if (result) {
            hideNewClientModal();
            alert(`Cliente "${name}" creado exitosamente`);
            await renderClientsList();
            await updateCounts();
        } else {
            throw new Error('No se pudo crear el cliente');
        }
    } catch (error) {
        alert('Error al crear cliente: ' + error.message);
    }
}

async function selectClient(clientId) {
    // Esta función ya no es necesaria - usar seleccionarClienteUI directamente
    console.warn('selectClient está obsoleta, usa seleccionarClienteUI');
}

async function deleteClient(clientId) {
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;

    try {
        if (supabase) {
            // Obtener el cliente desde Supabase para confirmar
            console.log('🔍 [deleteClient] Buscando cliente:', numericId);

            const { data: client, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', numericId)
                .single();

            if (error) {
                console.error('❌ [deleteClient] Error buscando cliente:', error);
                throw error;
            }

            if (confirm(`¿Eliminar el cliente "${client.nombre}"?`)) {
                const success = await deleteSupabaseClient(numericId);
                if (success) {
                    await renderClientsList();
                    await updateCounts();
                } else {
                    alert('Error al eliminar el cliente');
                }
            }
        } else {
            // Fallback: este caso no debería ocurrir ya que usamos eliminarClienteUI
            alert('Error: Supabase no está disponible');
        }
    } catch (error) {
        console.error('❌ [deleteClient] Error general:', error);
        alert('Error al eliminar cliente: ' + error.message);
    }
}

async function renderClientsList(searchTerm = '') {
    let allClients = [];
    let filteredClients = [];

    // Obtener clientes desde Supabase usando obtenerClientes()
    try {
        allClients = await obtenerClientes();

        // Filtrar por término de búsqueda
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filteredClients = allClients.filter(client =>
                client.razon_social.toLowerCase().includes(term) ||
                (client.cuit && client.cuit.toLowerCase().includes(term))
            );
        } else {
            filteredClients = allClients;
        }
    } catch (error) {
        console.error('Error cargando clientes desde Supabase:', error);
        allClients = [];
        filteredClients = [];
    }

    // Actualizar estadísticas
    const statsElement = document.getElementById('clientsStats');
    if (searchTerm.trim() !== '' && allClients.length > 0) {
        statsElement.textContent = `Mostrando ${filteredClients.length} de ${allClients.length} clientes`;
        statsElement.classList.add('show');
    } else {
        statsElement.classList.remove('show');
    }

    // Renderizar lista
    const listElement = document.getElementById('clientsList');

    if (allClients.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No hay clientes. Crea uno para comenzar.</div>';
        return;
    }

    if (filteredClients.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No se encontraron clientes con ese criterio de búsqueda.</div>';
        return;
    }

    // Crear tabla HTML (solo administración, sin selección de cliente activo)
    const html = `
        <table class="preview-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Razón Social</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">CUIT</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #475569; width: 300px;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${filteredClients.map(client => {
                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px; color: #1e293b;">
                                ${client.razon_social}
                            </td>
                            <td style="padding: 12px; color: #64748b;">${client.cuit || '-'}</td>
                            <td style="padding: 12px; text-align: center;">
                                <button onclick="abrirPlanCuentas('${client.id}', '${client.razon_social.replace(/'/g, "\\'")}')" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 4px; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">📊 Plan</button>
                                <button onclick="editarCliente('${client.id}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 4px; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">✏️ Editar</button>
                                <button onclick="eliminarClienteUI('${client.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">🗑️ Eliminar</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    listElement.innerHTML = html;
}

async function importAccountPlan(event, clientId) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        const accounts = jsonData.slice(1).map(row => ({
            code: String(row[0] || ''),
            description: String(row[1] || '')
        })).filter(a => a.code && a.description);

        if (supabase) {
            // Actualizar en Supabase
            const success = await updateClientAccountPlan(numericId, accounts);
            if (success) {
                alert(`Plan de cuentas importado: ${accounts.length} cuentas`);
                await renderClientsList();
            } else {
                alert('Error al guardar el plan de cuentas en Supabase');
            }
        } else {
            // Fallback: este caso no debería ocurrir
            alert('Error: Supabase no está disponible');
        }
    } catch (error) {
        alert('Error al importar plan de cuentas: ' + error.message);
    }

    event.target.value = '';
}

async function importClients(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        // Leer las columnas razon_social y cuit
        const clientsToImport = jsonData.slice(1).map(row => ({
            razon_social: String(row[0] || '').trim(),
            cuit: String(row[1] || '').trim()
        })).filter(c => c.razon_social);

        if (clientsToImport.length === 0) {
            alert('No se encontraron clientes válidos en el archivo');
            return;
        }

        // Importar usando crearClienteSimple
        let imported = 0;
        let errors = 0;
        const total = clientsToImport.length;

        for (let i = 0; i < total; i++) {
            const cliente = clientsToImport[i];

            // Mostrar progreso
            const progressMsg = `Importando cliente ${i + 1} de ${total}...`;
            console.log(progressMsg);

            // Actualizar UI con progreso (opcional)
            const statsElement = document.getElementById('clientsStats');
            if (statsElement) {
                statsElement.textContent = progressMsg;
                statsElement.classList.add('show');
            }

            try {
                const result = await crearClienteSimple(cliente.razon_social, cliente.cuit);
                if (result) {
                    imported++;
                } else {
                    errors++;
                }
            } catch (err) {
                console.error(`Error importando cliente ${cliente.razon_social}:`, err);
                errors++;
            }
        }

        // Limpiar mensaje de progreso
        const statsElement = document.getElementById('clientsStats');
        if (statsElement) {
            statsElement.classList.remove('show');
        }

        // Mostrar resultado final
        if (imported > 0) {
            alert(`Se importaron ${imported} cliente(s) exitosamente${errors > 0 ? `\nErrores: ${errors}` : ''}`);
            await renderClientsList();
            await updateCounts();
        } else {
            alert('No se pudieron importar los clientes. Verifica que no existan duplicados.');
        }
    } catch (error) {
        alert('Error al importar clientes: ' + error.message);
    }

    event.target.value = '';
}

// Función para eliminar cliente desde la UI
async function eliminarClienteUI(id) {
    try {
        // Obtener el cliente para confirmar
        const clientes = await obtenerClientes();
        const cliente = clientes.find(c => c.id === id);

        if (!cliente) {
            alert('Cliente no encontrado');
            return;
        }

        if (!confirm(`¿Eliminar el cliente "${cliente.razon_social}"?`)) {
            return;
        }

        const success = await eliminarCliente(id);
        if (success) {
            alert('Cliente eliminado exitosamente');
            await renderClientsList();
            await updateCounts();
        }
    } catch (error) {
        console.error('Error eliminando cliente:', error);
        alert('Error al eliminar cliente: ' + error.message);
    }
}

// Función para editar cliente
async function editarCliente(id) {
    try {
        // Obtener el cliente
        const clientes = await obtenerClientes();
        const cliente = clientes.find(c => c.id === id);

        if (!cliente) {
            alert('Cliente no encontrado');
            return;
        }

        // Solicitar nueva razón social
        const nuevaRazonSocial = prompt('Razón Social:', cliente.razon_social);
        if (nuevaRazonSocial === null) return; // Cancelado

        if (!nuevaRazonSocial.trim()) {
            alert('La razón social no puede estar vacía');
            return;
        }

        // Solicitar nuevo CUIT
        const nuevoCuit = prompt('CUIT:', cliente.cuit || '');
        if (nuevoCuit === null) return; // Cancelado

        // Actualizar cliente
        const result = await actualizarCliente(id, nuevaRazonSocial.trim(), nuevoCuit.trim());
        if (result) {
            alert('Cliente actualizado exitosamente');
            await renderClientsList();
        }
    } catch (error) {
        console.error('Error editando cliente:', error);
        alert('Error al editar cliente: ' + error.message);
    }
}

// Función para descargar plantilla Excel
function downloadClientTemplate() {
    try {
        // Crear datos de ejemplo
        const data = [
            ['razon_social', 'cuit'],
            ['EJEMPLO SA', '30123456789']
        ];

        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

        // Descargar archivo
        XLSX.writeFile(wb, 'plantilla_clientes.xlsx');

        console.log('✅ Plantilla descargada exitosamente');
    } catch (error) {
        console.error('Error descargando plantilla:', error);
        alert('Error al descargar plantilla: ' + error.message);
    }
}

async function repairClients() {
    // Esta función ya no es necesaria con el nuevo sistema
    alert('La función de reparación ya no está disponible. El nuevo sistema maneja la integridad automáticamente.');
}

// ============================================
// MODAL IMPUESTOS
// ============================================
async function showTaxesModal() {
    document.getElementById('modalTaxes').classList.remove('hidden');
    await renderTaxDatabase();
}

function hideTaxesModal() {
    document.getElementById('modalTaxes').classList.add('hidden');
}

// Descargar plantilla Excel para impuestos
function downloadTaxTemplate() {
    try {
        // Crear datos de ejemplo con los 6 campos
        const data = [
            ['codigo_impuesto', 'descripcion_impuesto', 'codigo_concepto', 'descripcion_concepto', 'codigo_subconcepto', 'descripcion_subconcepto'],
            ['IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '21%', 'IVA 21% - Tasa General'],
            ['IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '10.5%', 'IVA 10.5% - Tasa Reducida'],
            ['IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '27%', 'IVA 27% - Tasa Diferencial'],
            ['IVA', 'Impuesto al Valor Agregado', 'CRE', 'Crédito Fiscal', '21%', 'IVA 21% - Tasa General'],
            ['IVA', 'Impuesto al Valor Agregado', 'CRE', 'Crédito Fiscal', '10.5%', 'IVA 10.5% - Tasa Reducida'],
            ['IVA', 'Impuesto al Valor Agregado', 'RET', 'Retenciones', 'SUF', 'Retención IVA Sufrida'],
            ['IVA', 'Impuesto al Valor Agregado', 'PER', 'Percepciones', 'SUF', 'Percepción IVA Sufrida'],
            ['GAN', 'Impuesto a las Ganancias', 'ANT', 'Anticipos', 'ANT', 'Anticipo de Ganancias'],
            ['GAN', 'Impuesto a las Ganancias', 'RET', 'Retenciones', 'SUF', 'Retención Ganancias Sufrida'],
            ['GAN', 'Impuesto a las Ganancias', 'SAL', 'Saldo', 'PAG', 'Saldo a Pagar'],
            ['IIBB', 'Ingresos Brutos', 'RET', 'Retenciones', 'SUF', 'Retención IIBB Sufrida'],
            ['IIBB', 'Ingresos Brutos', 'PER', 'Percepciones', 'SUF', 'Percepción IIBB Sufrida'],
            ['IIBB', 'Ingresos Brutos', 'ANT', 'Anticipos', 'ANT', 'Anticipo IIBB'],
            ['SEG', 'Seguridad Social', 'CON', 'Contribuciones', 'PAT', 'Contribución Patronal'],
            ['SEG', 'Seguridad Social', 'APO', 'Aportes', 'TRA', 'Aporte Trabajadores']
        ];

        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 18 }, // codigo_impuesto
            { wch: 30 }, // descripcion_impuesto
            { wch: 18 }, // codigo_concepto
            { wch: 25 }, // descripcion_concepto
            { wch: 20 }, // codigo_subconcepto
            { wch: 35 }  // descripcion_subconcepto
        ];

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Impuestos');

        // Descargar archivo
        XLSX.writeFile(wb, 'plantilla_base_impuestos.xlsx');

        console.log('✅ Plantilla de impuestos descargada exitosamente');
    } catch (error) {
        console.error('Error descargando plantilla:', error);
        alert('Error al descargar plantilla: ' + error.message);
    }
}

async function importTaxes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        // Nueva estructura con 6 campos
        const taxes = jsonData.slice(1).map(row => ({
            codigo_impuesto: String(row[0] || '').trim(),
            descripcion_impuesto: String(row[1] || '').trim(),
            codigo_concepto: String(row[2] || '').trim(),
            descripcion_concepto: String(row[3] || '').trim(),
            codigo_subconcepto: String(row[4] || '').trim(),
            descripcion_subconcepto: String(row[5] || '').trim()
        })).filter(t => t.codigo_impuesto && t.descripcion_impuesto);

        if (taxes.length === 0) {
            alert('No se encontraron registros válidos en el archivo.\n\nAsegúrate de que el archivo tenga las columnas:\ncodigo_impuesto | descripcion_impuesto | codigo_concepto | descripcion_concepto | codigo_subconcepto | descripcion_subconcepto');
            return;
        }

        if (supabase) {
            // Importar a Supabase (nueva tabla impuestos_base)
            const result = await importSupabaseImpuestosBase(taxes, true);

            if (result.success) {
                await renderTaxDatabase();
                await updateCounts();
                alert(`Base de datos de impuestos importada a Supabase: ${result.imported} registros`);
            } else {
                alert('Error al importar la base de datos: ' + (result.error || 'Error desconocido'));
            }
        } else {
            // Fallback a localStorage
            const result = TaxManager.importFromArray(taxes, true);

            if (result.success) {
                await renderTaxDatabase();
                alert(`Base de datos de impuestos importada: ${result.imported} registros`);
            }
        }
    } catch (error) {
        alert('Error al importar base de datos: ' + error.message);
    }

    event.target.value = '';
}

async function renderTaxDatabase() {
    let taxDatabase = [];

    if (supabase) {
        // Obtener desde Supabase (nueva tabla impuestos_base)
        try {
            taxDatabase = await getSupabaseImpuestosBase();
        } catch (error) {
            console.error('Error cargando base de impuestos desde Supabase:', error);
            taxDatabase = [];
        }
    } else {
        // Fallback a localStorage
        taxDatabase = TaxManager.getAllTaxes();
    }

    const stats = taxDatabase.length === 0
        ? 'No hay datos en la base de impuestos'
        : `Total de registros: ${taxDatabase.length}`;

    document.getElementById('taxStats').textContent = stats;

    const tableBody = document.getElementById('taxTableBody');

    if (taxDatabase.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 32px; color: #64748b;">No hay datos. Importa un archivo Excel para comenzar.</td></tr>';
        return;
    }

    const preview = taxDatabase.slice(0, 50);
    const html = preview.map(tax => `
        <tr>
            <td style="font-family: monospace; font-weight: 600;">${tax.codigo_impuesto || ''}</td>
            <td>${tax.descripcion_impuesto || ''}</td>
            <td style="font-family: monospace;">${tax.codigo_concepto || ''}</td>
            <td>${tax.descripcion_concepto || ''}</td>
            <td style="font-family: monospace;">${tax.codigo_subconcepto || ''}</td>
            <td>${tax.descripcion_subconcepto || ''}</td>
        </tr>
    `).join('');

    tableBody.innerHTML = html;
}

async function clearTaxDatabase() {
    if (!confirm('¿Estás seguro de que deseas limpiar toda la base de datos de impuestos?\n\nEsta acción eliminará todos los registros.')) {
        return;
    }

    try {
        if (supabase) {
            // Limpiar en Supabase (nueva tabla impuestos_base)
            const success = await clearSupabaseImpuestosBase();
            if (success) {
                await renderTaxDatabase();
                await updateCounts();
                alert('Base de datos de impuestos limpiada correctamente');
            } else {
                alert('Error al limpiar la base de datos');
            }
        } else {
            // Fallback a localStorage
            TaxManager.clear();
            await renderTaxDatabase();
            alert('Base de datos limpiada');
        }
    } catch (error) {
        alert('Error al limpiar la base de datos: ' + error.message);
    }
}

// ============================================
// MODAL ALMACENAMIENTO
// ============================================
async function showStorageModal() {
    document.getElementById('modalStorage').classList.remove('hidden');
    await showStorageStats();
}

function hideStorageModal() {
    document.getElementById('modalStorage').classList.add('hidden');
}

async function showStorageStats() {
    const storageElement = document.getElementById('storageStats');
    storageElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;">Cargando estadísticas...</div>';

    try {
        let html = '';

        // Estadísticas de localStorage
        const localStats = DataStore.getStats();
        html += `
            <div style="font-size: 14px; color: #475569; margin-bottom: 24px;">
                <h3 style="margin-bottom: 16px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                    💾 localStorage (Navegador)
                </h3>
                <div style="margin-bottom: 16px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                    <div style="margin-bottom: 12px;">
                        <strong>Total de elementos:</strong> ${localStats.itemCount}
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong>Espacio total:</strong> ${localStats.totalSizeKB} KB (${localStats.totalSizeMB} MB)
                    </div>
                </div>

                <h4 style="margin-bottom: 12px; color: #475569;">Detalle por elemento:</h4>
                <div style="max-height: 200px; overflow-y: auto; margin-bottom: 24px;">
                    ${Object.entries(localStats.items).map(([key, item]) => `
                        <div style="padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
                            <div style="font-weight: 600; color: #1e293b; margin-bottom: 2px; font-size: 13px;">${key}</div>
                            <div style="font-size: 12px; color: #64748b;">${item.sizeKB} KB</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Estadísticas de Supabase
        if (supabase) {
            try {
                const supabaseStats = await getSupabaseStorageStats();

                if (supabaseStats && supabaseStats.tables) {
                    html += `
                        <div style="font-size: 14px; color: #475569;">
                            <h3 style="margin-bottom: 16px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                                ☁️ Supabase (Nube)
                            </h3>
                            <div style="margin-bottom: 16px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                <div style="margin-bottom: 8px;">
                                    <strong>Total de tablas:</strong> ${supabaseStats.tables.length}
                                </div>
                                <div style="font-size: 12px; color: #64748b;">
                                    Última actualización: ${new Date(supabaseStats.timestamp).toLocaleString('es-AR')}
                                </div>
                            </div>

                            <h4 style="margin-bottom: 12px; color: #475569;">Detalle por tabla:</h4>
                            <div style="max-height: 200px; overflow-y: auto;">
                                ${supabaseStats.tables.map(table => `
                                    <div style="padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px;">
                                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 2px; font-size: 13px;">${table.table_name}</div>
                                        <div style="font-size: 12px; color: #64748b;">
                                            Registros: ${table.row_count} | Tamaño: ${table.table_size}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <strong>⚠️ Supabase:</strong> No se pudieron obtener las estadísticas de la nube.
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error obteniendo estadísticas de Supabase:', error);
                html += `
                    <div style="padding: 16px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
                        <strong>❌ Error:</strong> ${error.message}
                    </div>
                `;
            }
        } else {
            html += `
                <div style="padding: 16px; background: #f1f5f9; border-radius: 8px;">
                    <strong>ℹ️ Supabase:</strong> No está conectado. Trabajando solo con localStorage.
                </div>
            `;
        }

        storageElement.innerHTML = html;
    } catch (error) {
        console.error('Error mostrando estadísticas:', error);
        storageElement.innerHTML = `
            <div style="padding: 16px; background: #fee2e2; border-radius: 8px; color: #dc2626;">
                Error al cargar estadísticas: ${error.message}
            </div>
        `;
    }
}

// ============================================
// FUNCIONES PARA SELECCIÓN DE CLIENTE ACTIVO
// ============================================

/**
 * Seleccionar cliente desde la UI
 */
function seleccionarClienteUI(clienteId, razonSocial) {
    console.log('🔵 SELECCIONANDO CLIENTE...');
    console.log('  ID:', clienteId);
    console.log('  Razón Social:', razonSocial);

    // Guardar cliente usando plan-cuentas.js
    seleccionarCliente(clienteId, razonSocial);

    // Verificar que se guardó correctamente
    const verificacion = obtenerClienteActivo();
    if (verificacion && verificacion.id === clienteId) {
        console.log('✅ Cliente guardado correctamente en localStorage');
        console.log('  Verificación:', verificacion);
    } else {
        console.error('❌ ERROR: Cliente NO se guardó correctamente');
    }

    // Re-renderizar lista para actualizar visualmente
    renderClientsList();

    // Mostrar notificación temporal
    mostrarNotificacion(`✅ Cliente seleccionado: ${razonSocial}`, 'success');
}

/**
 * Mostrar notificación temporal
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        font-size: 14px;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;
    notificacion.textContent = mensaje;

    // Agregar animación CSS
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notificacion);

    // Remover después de 3 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 3000);
}

// ============================================
// MODAL PLAN DE CUENTAS
// ============================================

let currentClienteIdPlan = null;
let currentClienteNombrePlan = null;

// Variables para búsqueda y filtro del plan de cuentas
let planCuentasSearchTerm = '';
let planCuentasTipoFiltro = '';

// Cache de cuentas cargadas (para evitar consultas repetidas al filtrar)
let planCuentasCache = [];

async function abrirPlanCuentas(clienteId, razonSocial) {
    console.log('🔵 [abrirPlanCuentas] Abriendo plan de cuentas...');
    console.log('   - clienteId:', clienteId);
    console.log('   - razonSocial:', razonSocial);

    // Validar que se proporcionen los parámetros
    if (!clienteId) {
        console.error('❌ [abrirPlanCuentas] Error: clienteId no proporcionado');
        alert('Error: No se pudo identificar el cliente');
        return;
    }

    // Guardar el ID del cliente actual
    currentClienteIdPlan = String(clienteId).trim();
    currentClienteNombrePlan = razonSocial;

    console.log('   - currentClienteIdPlan guardado:', currentClienteIdPlan);

    // Resetear filtros al abrir
    planCuentasSearchTerm = '';
    planCuentasTipoFiltro = '';

    document.getElementById('planCuentasClienteNombre').textContent = razonSocial;
    document.getElementById('modalPlanCuentas').classList.remove('hidden');

    await renderPlanCuentasList();
}

function hidePlanCuentasModal() {
    document.getElementById('modalPlanCuentas').classList.add('hidden');
    currentClienteIdPlan = null;
    currentClienteNombrePlan = null;
    // Limpiar cache y filtros al cerrar
    planCuentasCache = [];
    planCuentasSearchTerm = '';
    planCuentasTipoFiltro = '';
    // Resetear estado de filtros renderizados
    filtrosPlanCuentasRenderizados = false;
}

// Variable para controlar si los filtros ya fueron renderizados
let filtrosPlanCuentasRenderizados = false;

async function renderPlanCuentasList(forceReload = false, soloActualizarResultados = false) {
    console.log('🔄 [renderPlanCuentasList] ========== INICIO RENDER ==========');
    console.log('   - currentClienteIdPlan:', currentClienteIdPlan);
    console.log('   - forceReload:', forceReload);
    console.log('   - soloActualizarResultados:', soloActualizarResultados);
    console.log('   - planCuentasCache.length:', planCuentasCache.length);

    if (!currentClienteIdPlan) {
        console.error('❌ [renderPlanCuentasList] No hay cliente seleccionado');
        return;
    }

    const listElement = document.getElementById('planCuentasList');
    const statsElement = document.getElementById('planCuentasStats');

    // Variable para almacenar error si ocurre
    let errorMessage = null;

    // Si necesitamos recargar o no hay cache, consultar a la base de datos
    let todasLasCuentas;

    const needsReload = forceReload ||
                        planCuentasCache.length === 0 ||
                        !planCuentasCache[0] ||
                        planCuentasCache[0].cliente_id !== currentClienteIdPlan;

    console.log('   - needsReload:', needsReload);

    if (needsReload) {
        // Mostrar indicador de carga
        listElement.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><div class="spinner" style="margin: 0 auto 16px;"></div>Cargando plan de cuentas...</div>';

        try {
            // Obtener las cuentas del cliente desde la base de datos
            console.log('   - Llamando a obtenerPlanCuentas...');
            const resultado = await obtenerPlanCuentas(currentClienteIdPlan);

            console.log('   - Resultado recibido:', resultado);

            // Manejar el nuevo formato de respuesta {data, error, isEmpty}
            if (resultado && typeof resultado === 'object' && 'data' in resultado) {
                // Nuevo formato
                todasLasCuentas = resultado.data || [];
                errorMessage = resultado.error;
                console.log('   - Nuevo formato detectado. Error:', errorMessage, 'Cuentas:', todasLasCuentas.length);
            } else if (Array.isArray(resultado)) {
                // Formato antiguo (array directo) - compatibilidad
                todasLasCuentas = resultado;
                console.log('   - Formato array detectado. Cuentas:', todasLasCuentas.length);
            } else {
                // Respuesta inesperada
                console.error('   - Respuesta inesperada:', resultado);
                todasLasCuentas = [];
                errorMessage = 'Respuesta inesperada del servidor';
            }

            // Guardar en cache solo si no hubo error
            if (!errorMessage) {
                planCuentasCache = todasLasCuentas;
                console.log('💾 [renderPlanCuentasList] Cache actualizada:', planCuentasCache.length, 'cuentas');
            } else {
                // Si hubo error, limpiar cache para que reintente la próxima vez
                planCuentasCache = [];
                console.log('⚠️ [renderPlanCuentasList] Cache limpiada debido a error');
            }
        } catch (err) {
            console.error('❌ [renderPlanCuentasList] Error cargando cuentas:', err);
            todasLasCuentas = [];
            errorMessage = err.message || 'Error desconocido al cargar el plan de cuentas';
            planCuentasCache = [];
        }
    } else {
        // Usar cache existente
        todasLasCuentas = planCuentasCache;
        console.log('📦 [renderPlanCuentasList] Usando cache:', planCuentasCache.length, 'cuentas');
    }

    console.log('📊 [renderPlanCuentasList] Resultado final:');
    console.log('   - Cuentas:', todasLasCuentas.length);
    console.log('   - Error:', errorMessage);

    // Si hay error, mostrar mensaje de error
    if (errorMessage) {
        listElement.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                <span style="font-size: 48px; display: block; margin-bottom: 16px;">⚠️</span>
                <h3 style="color: #dc2626; margin: 0 0 12px;">Error al cargar el plan de cuentas</h3>
                <p style="color: #991b1b; margin: 0 0 16px;">${errorMessage}</p>
                <button onclick="renderPlanCuentasList(true)"
                        style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s;"
                        onmouseover="this.style.background='#b91c1c'"
                        onmouseout="this.style.background='#dc2626'">
                    🔄 Reintentar
                </button>
            </div>
        `;
        statsElement.textContent = 'Error al cargar datos';
        console.log('🔄 [renderPlanCuentasList] ========== FIN (ERROR) ==========');
        return;
    }

    // Verificar que las cuentas pertenecen al cliente correcto
    if (todasLasCuentas.length > 0) {
        const primeraClienteId = todasLasCuentas[0].cliente_id;
        if (primeraClienteId !== currentClienteIdPlan) {
            console.warn('⚠️ [renderPlanCuentasList] ADVERTENCIA: cliente_id de las cuentas no coincide!');
            console.warn('   - Esperado:', currentClienteIdPlan);
            console.warn('   - Recibido:', primeraClienteId);
        }
    }

    // Renderizar búsqueda y filtros solo si no están renderizados o si es una recarga completa
    let filtrosContainer = document.getElementById('planCuentasFiltrosContainer');
    let resultadosContainer = document.getElementById('planCuentasResultadosContainer');

    // Si no existen los contenedores, crearlos
    if (!filtrosContainer || !resultadosContainer || forceReload) {
        filtrosPlanCuentasRenderizados = false;
        listElement.innerHTML = `
            <div id="planCuentasFiltrosContainer"></div>
            <div id="planCuentasResultadosContainer"></div>
        `;
        filtrosContainer = document.getElementById('planCuentasFiltrosContainer');
        resultadosContainer = document.getElementById('planCuentasResultadosContainer');
    }

    // Renderizar filtros solo una vez (evita pérdida de foco)
    if (!filtrosPlanCuentasRenderizados && !soloActualizarResultados) {
        const searchFilterHtml = `
            <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 16px;">🔍</span>
                        <input type="text"
                               id="planCuentasSearch"
                               placeholder="Buscar por código o nombre de cuenta..."
                               value="${planCuentasSearchTerm}"
                               style="width: 100%; padding: 10px 12px 10px 40px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s;"
                               onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
                               oninput="filtrarPlanCuentas()">
                    </div>
                </div>
                <div style="min-width: 180px;">
                    <select id="planCuentasTipoFilter"
                            style="width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; transition: border-color 0.2s;"
                            onchange="filtrarPlanCuentas()">
                        <option value="">Todos los tipos</option>
                        <option value="Activo" ${planCuentasTipoFiltro === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Pasivo" ${planCuentasTipoFiltro === 'Pasivo' ? 'selected' : ''}>Pasivo</option>
                        <option value="Patrimonio Neto" ${planCuentasTipoFiltro === 'Patrimonio Neto' ? 'selected' : ''}>Patrimonio Neto</option>
                        <option value="Ingreso" ${planCuentasTipoFiltro === 'Ingreso' ? 'selected' : ''}>Ingreso</option>
                        <option value="Egreso" ${planCuentasTipoFiltro === 'Egreso' ? 'selected' : ''}>Egreso</option>
                    </select>
                </div>
            </div>
        `;
        filtrosContainer.innerHTML = searchFilterHtml;
        filtrosPlanCuentasRenderizados = true;
    }

    if (todasLasCuentas.length === 0) {
        resultadosContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
                <span style="font-size: 48px; display: block; margin-bottom: 16px;">📋</span>
                <h3 style="color: #0369a1; margin: 0 0 12px;">Plan de cuentas vacío</h3>
                <p style="color: #0c4a6e; margin: 0 0 16px;">Este cliente no tiene cuentas cargadas en el plan.</p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="showNuevaCuentaModal()"
                            style="background: #0ea5e9; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s;"
                            onmouseover="this.style.background='#0284c7'"
                            onmouseout="this.style.background='#0ea5e9'">
                        ➕ Crear cuenta manualmente
                    </button>
                    <label style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; display: inline-block;"
                           onmouseover="this.style.background='#059669'"
                           onmouseout="this.style.background='#10b981'">
                        📥 Importar desde Excel
                        <input type="file" accept=".xlsx,.xls" onchange="importarPlanCuentasUI(event)" style="display: none;">
                    </label>
                </div>
            </div>
        `;
        statsElement.textContent = 'Sin cuentas cargadas';
        console.log('🔄 [renderPlanCuentasList] ========== FIN (SIN CUENTAS) ==========');
        return;
    }

    // Aplicar filtros
    let cuentasFiltradas = todasLasCuentas;

    // Filtrar por término de búsqueda
    if (planCuentasSearchTerm.trim()) {
        const termino = planCuentasSearchTerm.toLowerCase().trim();
        cuentasFiltradas = cuentasFiltradas.filter(cuenta =>
            cuenta.codigo.toLowerCase().includes(termino) ||
            cuenta.cuenta.toLowerCase().includes(termino)
        );
    }

    // Filtrar por tipo
    if (planCuentasTipoFiltro) {
        cuentasFiltradas = cuentasFiltradas.filter(cuenta =>
            cuenta.tipo === planCuentasTipoFiltro
        );
    }

    // Estadísticas
    const cuentasConImpuestos = todasLasCuentas.filter(c => c.codigos_impuesto && c.codigos_impuesto.length > 0).length;
    let statsText = `Total de cuentas: ${todasLasCuentas.length}`;
    if (cuentasConImpuestos > 0) {
        statsText += ` | ${cuentasConImpuestos} con códigos de impuesto`;
    }
    if (cuentasFiltradas.length !== todasLasCuentas.length) {
        statsText += ` | Mostrando: ${cuentasFiltradas.length}`;
    }
    statsElement.textContent = statsText;

    // Mensaje si no hay resultados después del filtro
    if (cuentasFiltradas.length === 0) {
        resultadosContainer.innerHTML = `
            <div class="empty-state" style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; text-align: center;">
                <span style="font-size: 24px;">🔍</span>
                <p style="margin: 12px 0 0; color: #92400e;">No se encontraron cuentas con los filtros aplicados.</p>
                <button onclick="limpiarFiltrosPlanCuentas()" style="margin-top: 12px; background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">Limpiar filtros</button>
            </div>
        `;
        return;
    }

    const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569; width: 120px;">Código</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Cuenta</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569; width: 120px;">Tipo</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569; width: 140px;">Cód. Impuestos</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #475569; width: 180px;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${cuentasFiltradas.map(cuenta => {
                    // Usar función helper para parsear códigos de impuesto (maneja null, string, array, JSON)
                    const codigosImpuestoArray = parseCodigosImpuesto(cuenta.codigos_impuesto);
                    const codigosImpuestoJson = JSON.stringify(codigosImpuestoArray).replace(/'/g, "\\'").replace(/"/g, '&quot;');

                    // Generar el display de impuestos con formato "X asignados" y botón ver
                    let codigosImpuestoDisplay;
                    const cantidadImpuestos = codigosImpuestoArray.length;
                    if (cantidadImpuestos === 0) {
                        codigosImpuestoDisplay = '<span style="color: #94a3b8;">Sin asignar</span>';
                    } else {
                        const textoAsignados = cantidadImpuestos === 1 ? '1 asignado' : `${cantidadImpuestos} asignados`;
                        codigosImpuestoDisplay = `
                            <span style="display: inline-flex; align-items: center; gap: 6px;">
                                <span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${textoAsignados}</span>
                                <button type="button"
                                    onclick="event.stopPropagation(); mostrarDetalleImpuestos(${codigosImpuestoJson}, this)"
                                    style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; gap: 3px; transition: all 0.2s;"
                                    onmouseover="this.style.background='#e2e8f0'; this.style.borderColor='#94a3b8';"
                                    onmouseout="this.style.background='#f1f5f9'; this.style.borderColor='#cbd5e1';"
                                    title="Ver detalle de impuestos">
                                    👁 Ver
                                </button>
                            </span>
                        `;
                    }

                    // Resaltar términos de búsqueda
                    let codigoDisplay = cuenta.codigo;
                    let cuentaDisplay = cuenta.cuenta;
                    if (planCuentasSearchTerm.trim()) {
                        const termino = planCuentasSearchTerm.trim();
                        const regex = new RegExp(`(${termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                        codigoDisplay = cuenta.codigo.replace(regex, '<mark style="background: #fef08a; padding: 1px 2px; border-radius: 2px;">$1</mark>');
                        cuentaDisplay = cuenta.cuenta.replace(regex, '<mark style="background: #fef08a; padding: 1px 2px; border-radius: 2px;">$1</mark>');
                    }

                    return `
                    <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                        <td style="padding: 12px; color: #1e293b; font-family: monospace;">${codigoDisplay}</td>
                        <td style="padding: 12px; color: #1e293b;">${cuentaDisplay}</td>
                        <td style="padding: 12px; color: #64748b;">${cuenta.tipo || '-'}</td>
                        <td style="padding: 12px;">${codigosImpuestoDisplay}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="editarCuentaUI('${cuenta.id}', '${cuenta.codigo}', '${cuenta.cuenta.replace(/'/g, "\\'")}', '${cuenta.tipo || ''}', ${codigosImpuestoJson})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 13px; transition: background 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">Editar</button>
                            <button onclick="eliminarCuentaUI('${cuenta.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Eliminar</button>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    resultadosContainer.innerHTML = tableHtml;
    console.log('🔄 [renderPlanCuentasList] ========== FIN (EXITOSO) ==========');
}

/**
 * Filtrar plan de cuentas según búsqueda y tipo
 * Esta función usa los datos en cache, NO hace nuevas consultas a la base de datos
 */
function filtrarPlanCuentas() {
    const searchInput = document.getElementById('planCuentasSearch');
    const tipoFilter = document.getElementById('planCuentasTipoFilter');

    planCuentasSearchTerm = searchInput ? searchInput.value : '';
    planCuentasTipoFiltro = tipoFilter ? tipoFilter.value : '';

    console.log('🔍 [filtrarPlanCuentas] Aplicando filtros (usando cache)...');
    console.log('   - Búsqueda:', planCuentasSearchTerm);
    console.log('   - Tipo:', planCuentasTipoFiltro);

    // NO forzar recarga, usar la cache existente
    // soloActualizarResultados=true para mantener el foco en el input de búsqueda
    renderPlanCuentasList(false, true);
}

/**
 * Limpiar filtros del plan de cuentas
 */
function limpiarFiltrosPlanCuentas() {
    planCuentasSearchTerm = '';
    planCuentasTipoFiltro = '';

    const searchInput = document.getElementById('planCuentasSearch');
    const tipoFilter = document.getElementById('planCuentasTipoFilter');

    if (searchInput) searchInput.value = '';
    if (tipoFilter) tipoFilter.value = '';

    renderPlanCuentasList();
}

// ============================================
// POPUP DE DETALLE DE IMPUESTOS ASIGNADOS
// ============================================

/**
 * Variable global para el popup activo
 */
let popupDetalleImpuestosActivo = null;

/**
 * Muestra un popup con el detalle de los impuestos asignados a una cuenta
 * @param {Array} codigosImpuesto - Array de códigos de impuesto (formato: "10-108-51")
 * @param {HTMLElement} boton - Elemento botón que disparó el evento
 */
async function mostrarDetalleImpuestos(codigosImpuesto, boton) {
    // Si hay un popup abierto, cerrarlo
    cerrarPopupDetalleImpuestos();

    if (!codigosImpuesto || codigosImpuesto.length === 0) {
        return;
    }

    // Obtener impuestos desde cache
    const todosLosImpuestos = await obtenerImpuestosBase();

    // Crear mapa de código -> descripción
    const mapaImpuestos = {};
    todosLosImpuestos.forEach(imp => {
        mapaImpuestos[imp.codigoCompuesto] = imp.descripcionCompleta || 'Sin descripción';
    });

    // Crear contenido del popup
    const listaHtml = codigosImpuesto.map(codigo => {
        const descripcion = mapaImpuestos[codigo] || 'Descripción no encontrada';
        return `
            <div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <div style="font-family: monospace; font-weight: 600; color: #1e40af; font-size: 13px;">${codigo}</div>
                <div style="color: #475569; font-size: 12px; margin-top: 2px;">${descripcion}</div>
            </div>
        `;
    }).join('');

    // Crear el popup
    const popup = document.createElement('div');
    popup.id = 'popupDetalleImpuestos';
    popup.innerHTML = `
        <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); min-width: 300px; max-width: 450px; max-height: 350px; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #1e293b; font-size: 14px;">
                    Impuestos asignados (${codigosImpuesto.length})
                </span>
                <button onclick="cerrarPopupDetalleImpuestos()"
                    style="background: none; border: none; cursor: pointer; font-size: 18px; color: #64748b; padding: 0 4px; line-height: 1;"
                    title="Cerrar">×</button>
            </div>
            <div style="padding: 8px 16px; overflow-y: auto; flex: 1;">
                ${listaHtml}
            </div>
        </div>
    `;
    popup.style.cssText = 'position: fixed; z-index: 10000;';

    document.body.appendChild(popup);
    popupDetalleImpuestosActivo = popup;

    // Posicionar el popup cerca del botón
    const rect = boton.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Calcular posición inicial (a la derecha del botón)
    let left = rect.right + 8;
    let top = rect.top - 10;

    // Ajustar si se sale de la pantalla por la derecha
    if (left + popupRect.width > window.innerWidth - 20) {
        left = rect.left - popupRect.width - 8;
    }

    // Ajustar si se sale de la pantalla por abajo
    if (top + popupRect.height > window.innerHeight - 20) {
        top = window.innerHeight - popupRect.height - 20;
    }

    // Ajustar si se sale por arriba
    if (top < 20) {
        top = 20;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    // Cerrar al hacer clic fuera
    setTimeout(() => {
        document.addEventListener('click', cerrarPopupAlClickFuera);
    }, 100);
}

/**
 * Cierra el popup de detalle de impuestos
 */
function cerrarPopupDetalleImpuestos() {
    if (popupDetalleImpuestosActivo) {
        popupDetalleImpuestosActivo.remove();
        popupDetalleImpuestosActivo = null;
    }
    document.removeEventListener('click', cerrarPopupAlClickFuera);
}

/**
 * Cierra el popup si se hace clic fuera de él
 */
function cerrarPopupAlClickFuera(event) {
    const popup = document.getElementById('popupDetalleImpuestos');
    if (popup && !popup.contains(event.target)) {
        cerrarPopupDetalleImpuestos();
    }
}

// ============================================
// FUNCIONES PARA SELECTOR DE IMPUESTOS
// ============================================

// Estado global para los selectores de impuestos (por containerId)
const impuestosAsignadosState = {};

/**
 * Renderiza el selector de impuestos con diseño de chips/tags
 * Sección superior: chips de impuestos asignados con botón X
 * Sección inferior: buscador + lista de impuestos disponibles (sin los asignados)
 * @param {string} containerId - ID del contenedor
 * @param {Array} seleccionados - Array de códigos de impuesto ya seleccionados (formato: "10-108-51")
 */
async function renderizarSelectorImpuestos(containerId, seleccionados = []) {
    console.log('📋 [renderizarSelectorImpuestos] Iniciando:', {
        containerId,
        seleccionados,
        cantidadSeleccionados: seleccionados.length
    });

    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ [renderizarSelectorImpuestos] Contenedor no encontrado:', containerId);
        return;
    }

    // Mostrar loading
    container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 12px;">
            <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 8px;">Cargando impuestos...</div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;

    // Cargar impuestos desde Supabase
    const impuestos = await obtenerImpuestosBase();

    if (impuestos.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 12px;">
                No se encontraron impuestos en la base de datos.
                <br><small>Verifique la tabla de impuestos en Supabase.</small>
            </div>
        `;
        return;
    }

    // Inicializar estado de impuestos asignados para este contenedor
    impuestosAsignadosState[containerId] = new Set(seleccionados.map(s => String(s).trim()));

    // Crear mapa de código -> datos del impuesto
    const mapaImpuestos = {};
    impuestos.forEach(imp => {
        mapaImpuestos[imp.codigoCompuesto] = imp;
    });

    // Log para depuración
    if (seleccionados.length > 0) {
        const coincidencias = seleccionados.filter(s => mapaImpuestos[String(s).trim()]);
        console.log('   - Impuestos que coinciden:', coincidencias.length, 'de', seleccionados.length);
        if (coincidencias.length !== seleccionados.length) {
            console.warn('   - Códigos no encontrados:', seleccionados.filter(s => !mapaImpuestos[String(s).trim()]));
        }
    }

    // IDs de elementos
    const chipsContainerId = containerId + '_chips';
    const searchId = containerId + '_search';
    const listContainerId = containerId + '_list';

    // Función para renderizar chips de impuestos asignados
    const renderChips = () => {
        const asignados = Array.from(impuestosAsignadosState[containerId]);
        if (asignados.length === 0) {
            return `<div style="color: #94a3b8; font-style: italic; padding: 8px 0;">Sin impuestos asignados</div>`;
        }
        return asignados.map(codigo => {
            const imp = mapaImpuestos[codigo];
            const descripcion = imp ? imp.descripcionCompleta : 'Impuesto no encontrado';
            // Truncar descripción si es muy larga
            const descCorta = descripcion.length > 60 ? descripcion.substring(0, 57) + '...' : descripcion;
            return `
                <div class="impuesto-chip" data-codigo="${codigo}" style="display: flex; align-items: center; gap: 8px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-family: monospace; font-weight: 600; color: #0369a1; font-size: 12px;">${codigo}</div>
                        <div style="color: #0c4a6e; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descripcion}">${descCorta}</div>
                    </div>
                    <button type="button" onclick="quitarImpuestoAsignado('${containerId}', '${codigo}')"
                            style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; transition: all 0.2s; flex-shrink: 0;"
                            onmouseover="this.style.background='#fecaca'; this.style.borderColor='#f87171';"
                            onmouseout="this.style.background='#fee2e2'; this.style.borderColor='#fecaca';"
                            title="Quitar impuesto">
                        ✕
                    </button>
                </div>
            `;
        }).join('');
    };

    // Función para renderizar lista de impuestos disponibles (sin los asignados)
    const renderListaDisponibles = (termino = '') => {
        // Filtrar impuestos que NO están asignados
        let disponibles = impuestos.filter(imp => !impuestosAsignadosState[containerId].has(imp.codigoCompuesto));

        // Aplicar filtro de búsqueda
        if (termino.trim()) {
            disponibles = filtrarImpuestos(disponibles, termino);
        }

        if (disponibles.length === 0) {
            if (termino.trim()) {
                return `<div style="text-align: center; color: #64748b; padding: 16px;">No se encontraron impuestos para "${termino}"</div>`;
            }
            return `<div style="text-align: center; color: #64748b; padding: 16px;">Todos los impuestos han sido asignados</div>`;
        }

        return disponibles.map(imp => `
            <label class="impuesto-disponible-item" style="display: flex; align-items: flex-start; padding: 8px 10px; cursor: pointer; border-radius: 6px; transition: background 0.2s; margin-bottom: 2px; border: 1px solid transparent;"
                   onmouseover="this.style.background='#f0fdf4'; this.style.borderColor='#86efac';"
                   onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';">
                <input type="checkbox"
                       class="impuesto-agregar-checkbox"
                       value="${imp.codigoCompuesto}"
                       onchange="agregarImpuestoDesdeCheckbox('${containerId}', '${imp.codigoCompuesto}', this)"
                       style="width: 18px; height: 18px; margin-right: 10px; margin-top: 2px; cursor: pointer; accent-color: #22c55e; flex-shrink: 0;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-family: monospace; font-weight: 600; color: #166534; font-size: 12px;">
                        ${imp.codigoCompuesto}
                    </div>
                    <div style="color: #475569; font-size: 11px; margin-top: 2px; line-height: 1.3;">
                        ${imp.descripcionCompleta || 'Sin descripción'}
                    </div>
                </div>
            </label>
        `).join('');
    };

    // Función para actualizar la UI
    const actualizarUI = (termino = '') => {
        const chipsContainer = document.getElementById(chipsContainerId);
        const listContainer = document.getElementById(listContainerId);

        if (chipsContainer) {
            chipsContainer.innerHTML = renderChips();
        }
        if (listContainer) {
            listContainer.innerHTML = renderListaDisponibles(termino);
        }
    };

    // Guardar función de actualización en el estado para acceso global
    impuestosAsignadosState[containerId + '_updateUI'] = actualizarUI;
    impuestosAsignadosState[containerId + '_searchTerm'] = '';

    // Renderizar estructura completa
    container.innerHTML = `
        <!-- Sección de impuestos asignados -->
        <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">📋</span> Impuestos ARCA asignados:
            </div>
            <div id="${chipsContainerId}" style="max-height: 150px; overflow-y: auto; padding: 4px 0;">
                ${renderChips()}
            </div>
        </div>

        <!-- Separador -->
        <div style="border-top: 1px solid #e2e8f0; margin: 12px 0;"></div>

        <!-- Sección para agregar impuestos -->
        <div>
            <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">➕</span> Agregar impuesto:
            </div>
            <div style="position: relative; margin-bottom: 8px;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px;">🔍</span>
                <input type="text"
                       id="${searchId}"
                       placeholder="Buscar impuesto por código o descripción..."
                       style="width: 100%; padding: 8px 12px 8px 32px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;"
                       autocomplete="off">
            </div>
            <div id="${listContainerId}" style="max-height: 180px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; background: #fafafa;">
                ${renderListaDisponibles()}
            </div>
        </div>
    `;

    // Evento de búsqueda
    const searchInput = document.getElementById(searchId);
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value;
            impuestosAsignadosState[containerId + '_searchTerm'] = termino;
            const listContainer = document.getElementById(listContainerId);
            if (listContainer) {
                listContainer.innerHTML = renderListaDisponibles(termino);
            }
        });
    }
}

/**
 * Quitar un impuesto de los asignados (al hacer clic en X del chip)
 */
function quitarImpuestoAsignado(containerId, codigo) {
    if (impuestosAsignadosState[containerId]) {
        impuestosAsignadosState[containerId].delete(codigo);
        const updateUI = impuestosAsignadosState[containerId + '_updateUI'];
        const searchTerm = impuestosAsignadosState[containerId + '_searchTerm'] || '';
        if (updateUI) {
            updateUI(searchTerm);
        }
    }
}

/**
 * Agregar un impuesto desde checkbox (al marcar un checkbox de la lista)
 */
function agregarImpuestoDesdeCheckbox(containerId, codigo, checkbox) {
    if (impuestosAsignadosState[containerId]) {
        impuestosAsignadosState[containerId].add(codigo);
        const updateUI = impuestosAsignadosState[containerId + '_updateUI'];
        const searchTerm = impuestosAsignadosState[containerId + '_searchTerm'] || '';
        if (updateUI) {
            updateUI(searchTerm);
        }
    }
}

/**
 * Obtiene los códigos de impuesto seleccionados de un contenedor
 * @param {string} containerId - ID del contenedor
 * @returns {Array} Array de códigos seleccionados
 */
function obtenerImpuestosSeleccionados(containerId) {
    // Usar el nuevo estado basado en chips
    if (impuestosAsignadosState[containerId]) {
        return Array.from(impuestosAsignadosState[containerId]);
    }
    return [];
}

async function showNuevaCuentaModal() {
    if (!currentClienteIdPlan) {
        alert('Debe abrir el plan de cuentas de un cliente primero');
        return;
    }

    document.getElementById('modalNuevaCuenta').classList.remove('hidden');
    document.getElementById('nuevaCuentaCodigo').value = '';
    document.getElementById('nuevaCuentaNombre').value = '';
    document.getElementById('nuevaCuentaTipo').value = '';

    // Renderizar selector de impuestos sin ninguno seleccionado (ahora es async)
    await renderizarSelectorImpuestos('nuevaCuentaImpuestosContainer', []);

    document.getElementById('nuevaCuentaCodigo').focus();
}

function hideNuevaCuentaModal() {
    document.getElementById('modalNuevaCuenta').classList.add('hidden');
}

async function crearCuentaUI() {
    const codigo = document.getElementById('nuevaCuentaCodigo').value.trim();
    const nombre = document.getElementById('nuevaCuentaNombre').value.trim();
    const tipo = document.getElementById('nuevaCuentaTipo').value;

    if (!codigo || !nombre) {
        alert('El código y el nombre son obligatorios');
        return;
    }

    if (!currentClienteIdPlan) {
        alert('Error: No hay cliente seleccionado');
        return;
    }

    // Obtener códigos de impuesto seleccionados del selector múltiple
    const codigosImpuestoArray = obtenerImpuestosSeleccionados('nuevaCuentaImpuestosContainer');

    const result = await crearCuenta(currentClienteIdPlan, codigo, nombre, tipo,
        codigosImpuestoArray.length > 0 ? codigosImpuestoArray : null);

    if (result) {
        alert('Cuenta creada exitosamente');
        hideNuevaCuentaModal();
        // Forzar recarga de la cache después de crear
        await renderPlanCuentasList(true);
    }
}

async function editarCuentaUI(cuentaId, codigoActual, nombreActual, tipoActual, codigosImpuestoActuales) {
    console.log('🔧 [editarCuentaUI] Abriendo modal de edición:', {
        cuentaId,
        codigoActual,
        nombreActual,
        tipoActual,
        codigosImpuestoActuales
    });

    // Mostrar modal de edición con los valores actuales
    document.getElementById('editarCuentaId').value = cuentaId;
    document.getElementById('editarCuentaCodigo').value = codigoActual;
    document.getElementById('editarCuentaNombre').value = nombreActual;
    document.getElementById('editarCuentaTipo').value = tipoActual || '';

    document.getElementById('modalEditarCuenta').classList.remove('hidden');

    // Renderizar selector de impuestos con los códigos actuales pre-seleccionados
    // Usar función helper para parsear códigos (maneja null, string, array, JSON)
    const codigosActuales = parseCodigosImpuesto(codigosImpuestoActuales);

    console.log('   - Códigos a pre-seleccionar:', codigosActuales);
    await renderizarSelectorImpuestos('editarCuentaImpuestosContainer', codigosActuales);

    document.getElementById('editarCuentaCodigo').focus();
}

function hideEditarCuentaModal() {
    document.getElementById('modalEditarCuenta').classList.add('hidden');
}

async function guardarCambiosCuenta() {
    const cuentaId = document.getElementById('editarCuentaId').value;
    const nuevoCodigo = document.getElementById('editarCuentaCodigo').value.trim();
    const nuevoNombre = document.getElementById('editarCuentaNombre').value.trim();
    const nuevoTipo = document.getElementById('editarCuentaTipo').value;

    if (!nuevoCodigo || !nuevoNombre) {
        alert('El código y el nombre son obligatorios');
        return;
    }

    // Obtener códigos de impuesto seleccionados del selector múltiple
    const codigosImpuestoArray = obtenerImpuestosSeleccionados('editarCuentaImpuestosContainer');

    console.log('💾 [guardarCambiosCuenta] Guardando cambios:', {
        cuentaId,
        nuevoCodigo,
        nuevoNombre,
        nuevoTipo,
        codigosImpuestoArray
    });

    const result = await actualizarCuenta(cuentaId, nuevoCodigo, nuevoNombre, nuevoTipo, codigosImpuestoArray);

    if (result) {
        alert('Cuenta actualizada exitosamente');
        hideEditarCuentaModal();
        // Forzar recarga de la cache después de actualizar
        await renderPlanCuentasList(true);
    }
}

async function eliminarCuentaUI(cuentaId) {
    if (!confirm('¿Eliminar esta cuenta del plan?')) {
        return;
    }

    const result = await eliminarCuenta(cuentaId);

    if (result) {
        alert('Cuenta eliminada exitosamente');
        // Forzar recarga de la cache después de eliminar
        await renderPlanCuentasList(true);
    }
}

async function importarPlanCuentasUI(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentClienteIdPlan) {
        alert('Error: No hay cliente seleccionado');
        event.target.value = '';
        return;
    }

    const result = await importarPlanCuentas(file, currentClienteIdPlan);

    if (result.success) {
        // Forzar recarga de la cache después de importar
        await renderPlanCuentasList(true);
    }

    event.target.value = '';
}

async function eliminarPlanCompletoUI() {
    if (!currentClienteIdPlan) {
        alert('Error: No hay cliente seleccionado');
        return;
    }

    // Obtener nombre del cliente para el mensaje
    const nombreCliente = document.getElementById('planCuentasClienteNombre').textContent;

    const confirmacion = confirm(
        `¿Está seguro de eliminar TODO el plan de cuentas de ${nombreCliente}?\n\n` +
        `Esta acción no se puede deshacer.`
    );

    if (!confirmacion) {
        return;
    }

    try {
        const success = await eliminarPlanCuentas(currentClienteIdPlan);

        if (success) {
            alert('Plan de cuentas eliminado correctamente');
            // Forzar recarga de la cache después de eliminar todo
            await renderPlanCuentasList(true);
        }
    } catch (error) {
        console.error('Error eliminando plan de cuentas:', error);
        alert('Error al eliminar el plan de cuentas: ' + error.message);
    }
}

// ============================================
// FUNCIONES GLOBALES PARA OTRAS HERRAMIENTAS
// ============================================

/**
 * Función global para seleccionar cliente activo
 * Disponible para todas las herramientas
 */
window.seleccionarClienteActivo = function(clienteId, razonSocial) {
    if (typeof seleccionarCliente === 'function') {
        seleccionarCliente(clienteId, razonSocial);
        console.log('✅ Cliente activo establecido:', razonSocial);
        return {
            success: true,
            cliente: {
                id: clienteId,
                razon_social: razonSocial
            }
        };
    } else {
        console.error('❌ Función seleccionarCliente no disponible');
        return { success: false, error: 'Función no disponible' };
    }
};

console.log('✅ Sistema de Cliente Activo inicializado');
console.log('   Funciones disponibles:');
console.log('   - window.seleccionarClienteActivo(id, nombre)');
console.log('   - window.obtenerClienteActivo()');
console.log('   - window.limpiarClienteActivo()');
