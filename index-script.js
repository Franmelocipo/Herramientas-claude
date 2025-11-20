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

    // Actualizar indicador de cliente activo
    if (typeof actualizarIndicadorClienteActivo === 'function') {
        actualizarIndicadorClienteActivo();
    }
});

// Sincronizar datos con Supabase
async function syncWithSupabase() {
    try {
        if (!supabase) {
            console.warn('Supabase no está disponible. Trabajando solo con localStorage.');
            return;
        }

        console.log('🔄 Sincronizando con Supabase...');

        // Obtener conteos desde Supabase
        const [clientsCount, taxCount] = await Promise.all([
            getSupabaseClientsCount(),
            getSupabaseTaxDatabaseCount()
        ]);

        console.log(`✅ Supabase: ${clientsCount} clientes, ${taxCount} registros de impuestos`);
        updateCounts();
    } catch (error) {
        console.error('Error sincronizando con Supabase:', error);
    }
}

// Obtener cantidad de clientes desde Supabase
async function getSupabaseClientsCount() {
    try {
        console.log('🔢 [getSupabaseClientsCount] Obteniendo conteo de clientes...');

        const clientes = await obtenerClientes();
        const count = clientes.length;

        console.log(`✅ [getSupabaseClientsCount] Total: ${count || 0} clientes`);
        return count || 0;
    } catch (error) {
        console.error('❌ [getSupabaseClientsCount] Error general:', error);
        return 0;
    }
}

// Obtener cantidad de impuestos desde Supabase
async function getSupabaseTaxDatabaseCount() {
    try {
        const { count, error } = await supabase
            .from('tax_database')
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
    if (supabase) {
        // Si Supabase está disponible, usar datos de la nube
        try {
            const [clientsCount, taxCount] = await Promise.all([
                getSupabaseClientsCount(),
                getSupabaseTaxDatabaseCount()
            ]);

            document.getElementById('clientCount').textContent = clientsCount;
            document.getElementById('taxCount').textContent = taxCount;
        } catch (error) {
            console.error('Error actualizando contadores desde Supabase:', error);
            // Fallback a localStorage
            await updateCountsFromLocalStorage();
        }
    } else {
        // Usar localStorage como fallback
        await updateCountsFromLocalStorage();
    }
}

async function updateCountsFromLocalStorage() {
    // Obtener clientes desde localStorage via obtenerClientes()
    const clientes = await obtenerClientes();
    const clientCount = clientes.length;
    const taxCount = TaxManager.getAllTaxes().length;

    document.getElementById('clientCount').textContent = clientCount;
    document.getElementById('taxCount').textContent = taxCount;
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

    // Obtener cliente activo
    const clienteActivo = obtenerClienteActivo();
    const clienteActivoId = clienteActivo ? clienteActivo.id : null;

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

    // Crear tabla HTML
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
                    const isActive = clienteActivoId === client.id;
                    const activeClass = isActive ? 'cliente-activo-row' : '';
                    const activeBadge = isActive ? '<span class="badge-cliente-activo" style="font-size: 9px; padding: 3px 6px; margin-left: 8px;">✓ ACTIVO</span>' : '';
                    return `
                        <tr class="${activeClass}" onclick="seleccionarClienteUI('${client.id}', '${client.razon_social.replace(/'/g, "\\'")}')" style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px; color: #1e293b; font-weight: ${isActive ? '600' : '400'};">
                                ${client.razon_social}
                                ${activeBadge}
                            </td>
                            <td style="padding: 12px; color: #64748b;">${client.cuit || '-'}</td>
                            <td style="padding: 12px; text-align: center;" onclick="event.stopPropagation()">
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

async function importTaxes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        const taxes = jsonData.slice(1).map(row => ({
            impuesto: String(row[0] || '').trim(),
            concepto: String(row[1] || '').trim(),
            subconcepto: String(row[2] || '').trim()
        })).filter(t => t.impuesto && t.concepto && t.subconcepto);

        if (taxes.length === 0) {
            alert('No se encontraron registros válidos en el archivo');
            return;
        }

        if (supabase) {
            // Importar a Supabase
            const result = await importSupabaseTaxDatabase(taxes, true);

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
        // Obtener desde Supabase
        try {
            taxDatabase = await getSupabaseTaxDatabase();
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
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 32px; color: #64748b;">No hay datos. Importa un archivo Excel para comenzar.</td></tr>';
        return;
    }

    const preview = taxDatabase.slice(0, 50);
    const html = preview.map(tax => `
        <tr>
            <td>${tax.impuesto}</td>
            <td>${tax.concepto}</td>
            <td>${tax.subconcepto}</td>
        </tr>
    `).join('');

    tableBody.innerHTML = html;
}

async function clearTaxDatabase() {
    if (!confirm('¿Estás seguro de que deseas limpiar toda la base de datos de impuestos?')) {
        return;
    }

    try {
        if (supabase) {
            // Limpiar en Supabase
            const success = await clearSupabaseTaxDatabase();
            if (success) {
                await renderTaxDatabase();
                await updateCounts();
                alert('Base de datos limpiada en Supabase');
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

async function abrirPlanCuentas(clienteId, razonSocial) {
    currentClienteIdPlan = clienteId;
    document.getElementById('planCuentasClienteNombre').textContent = razonSocial;
    document.getElementById('modalPlanCuentas').classList.remove('hidden');
    await renderPlanCuentasList();
}

function hidePlanCuentasModal() {
    document.getElementById('modalPlanCuentas').classList.add('hidden');
    currentClienteIdPlan = null;
}

async function renderPlanCuentasList() {
    if (!currentClienteIdPlan) return;

    const cuentas = await obtenerPlanCuentas(currentClienteIdPlan);
    const listElement = document.getElementById('planCuentasList');
    const statsElement = document.getElementById('planCuentasStats');

    if (cuentas.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No hay cuentas en el plan. Importa un archivo Excel o crea cuentas manualmente.</div>';
        statsElement.textContent = '';
        return;
    }

    statsElement.textContent = `Total de cuentas: ${cuentas.length}`;

    const html = `
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569; width: 120px;">Código</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569;">Cuenta</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #475569; width: 150px;">Tipo</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #475569; width: 180px;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${cuentas.map(cuenta => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; color: #1e293b; font-family: monospace;">${cuenta.codigo}</td>
                        <td style="padding: 12px; color: #1e293b;">${cuenta.cuenta}</td>
                        <td style="padding: 12px; color: #64748b;">${cuenta.tipo || '-'}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="editarCuentaUI('${cuenta.id}', '${cuenta.codigo}', '${cuenta.cuenta.replace(/'/g, "\\'")}', '${cuenta.tipo || ''}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 13px;">✏️ Editar</button>
                            <button onclick="eliminarCuentaUI('${cuenta.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">🗑️ Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    listElement.innerHTML = html;
}

function showNuevaCuentaModal() {
    if (!currentClienteIdPlan) {
        alert('Debe abrir el plan de cuentas de un cliente primero');
        return;
    }

    document.getElementById('modalNuevaCuenta').classList.remove('hidden');
    document.getElementById('nuevaCuentaCodigo').value = '';
    document.getElementById('nuevaCuentaNombre').value = '';
    document.getElementById('nuevaCuentaTipo').value = '';
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

    const result = await crearCuenta(currentClienteIdPlan, codigo, nombre, tipo);

    if (result) {
        alert('Cuenta creada exitosamente');
        hideNuevaCuentaModal();
        await renderPlanCuentasList();
    }
}

async function editarCuentaUI(cuentaId, codigoActual, nombreActual, tipoActual) {
    const nuevoCodigo = prompt('Código:', codigoActual);
    if (nuevoCodigo === null) return;

    const nuevoNombre = prompt('Nombre de la Cuenta:', nombreActual);
    if (nuevoNombre === null) return;

    const nuevoTipo = prompt('Tipo (Activo/Pasivo/Patrimonio Neto/Ingreso/Egreso):', tipoActual);
    if (nuevoTipo === null) return;

    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) {
        alert('El código y el nombre son obligatorios');
        return;
    }

    const result = await actualizarCuenta(cuentaId, nuevoCodigo.trim(), nuevoNombre.trim(), nuevoTipo.trim());

    if (result) {
        alert('Cuenta actualizada exitosamente');
        await renderPlanCuentasList();
    }
}

async function eliminarCuentaUI(cuentaId) {
    if (!confirm('¿Eliminar esta cuenta del plan?')) {
        return;
    }

    const result = await eliminarCuenta(cuentaId);

    if (result) {
        alert('Cuenta eliminada exitosamente');
        await renderPlanCuentasList();
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
        await renderPlanCuentasList();
    }

    event.target.value = '';
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
