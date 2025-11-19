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

    console.log('Clientes (localStorage):', ClientManager.getAllClients().length);
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

        const { count, error } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ [getSupabaseClientsCount] Error:', error);
            throw error;
        }

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
            updateCountsFromLocalStorage();
        }
    } else {
        // Usar localStorage como fallback
        updateCountsFromLocalStorage();
    }
}

function updateCountsFromLocalStorage() {
    const clientCount = ClientManager.getAllClients().length;
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
    document.getElementById('btnCancelNewClient').addEventListener('click', () => hideNewClientModal());
    document.getElementById('btnCreateClient').addEventListener('click', () => createClient());
    document.getElementById('btnRepairClients').addEventListener('click', () => repairClients());
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

    // Listeners para cambios en los datos
    ClientManager.onClientsChange(() => {
        updateCounts();
        renderClientsList();
    });

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
        if (supabase) {
            // Crear en Supabase
            const result = await createSupabaseClient({ name, cuit, accountPlan: [] });
            if (result) {
                hideNewClientModal();
                alert(`Cliente "${name}" creado exitosamente en Supabase`);
                await renderClientsList();
                await updateCounts();
            } else {
                throw new Error('No se pudo crear el cliente en Supabase');
            }
        } else {
            // Fallback a localStorage
            ClientManager.createClient({ name, cuit });
            hideNewClientModal();
            alert(`Cliente "${name}" creado exitosamente`);
            await renderClientsList();
        }
    } catch (error) {
        alert('Error al crear cliente: ' + error.message);
    }
}

async function selectClient(clientId) {
    // Esta función mantiene compatibilidad con localStorage
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;
    const success = ClientManager.selectClient(numericId);

    if (success) {
        const client = ClientManager.getClient(numericId);
        alert(`Cliente "${client.name}" seleccionado como activo`);
    }
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
            // Fallback a localStorage
            const client = ClientManager.getClient(numericId);
            if (confirm(`¿Eliminar el cliente "${client.name}"?`)) {
                ClientManager.deleteClient(numericId);
                await renderClientsList();
            }
        }
    } catch (error) {
        console.error('❌ [deleteClient] Error general:', error);
        alert('Error al eliminar cliente: ' + error.message);
    }
}

async function renderClientsList(searchTerm = '') {
    let allClients = [];
    let filteredClients = [];

    if (supabase) {
        // Obtener clientes desde Supabase
        try {
            allClients = await getSupabaseClients();

            // Filtrar por término de búsqueda
            if (searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase();
                filteredClients = allClients.filter(client =>
                    client.name.toLowerCase().includes(term) ||
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
    } else {
        // Fallback a localStorage
        allClients = ClientManager.getAllClients();
        filteredClients = ClientManager.searchClients(searchTerm);
    }

    const selectedClientId = ClientManager.getSelectedClientId();

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

    const html = filteredClients.map(client => {
        const isSelected = selectedClientId === client.id;
        const selectedClass = isSelected ? 'client-item-selected' : '';
        const accountCount = (client.account_plan?.length || client.accountPlan?.length) || 0;
        const idType = Number.isInteger(client.id) ? '✓' : '⚠️';

        return `
            <div class="client-item ${selectedClass}">
                <div class="client-header">
                    <div>
                        <h3>${client.name} ${isSelected ? '(Activo)' : ''}</h3>
                        <p>${client.cuit ? `CUIT: ${client.cuit} | ` : ''}${accountCount} cuentas | ID: ${client.id} ${idType}</p>
                    </div>
                    <div class="client-actions">
                        <button class="btn-select" onclick="selectClient(${client.id})">Seleccionar</button>
                        <button class="btn-delete" onclick="deleteClient(${client.id})">Eliminar</button>
                    </div>
                </div>
                <label class="file-input-label">
                    <span>Plan de Cuentas (Excel: Código | Descripción)</span>
                    <input type="file" accept=".xlsx,.xls" onchange="importAccountPlan(event, ${client.id})">
                </label>
            </div>
        `;
    }).join('');

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
            // Fallback a localStorage
            const success = ClientManager.importAccountPlan(numericId, accounts);
            if (success) {
                alert(`Plan de cuentas importado: ${accounts.length} cuentas`);
                await renderClientsList();
            }
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

        const clientsToImport = jsonData.slice(1).map(row => ({
            name: String(row[0] || '').trim(),
            cuit: String(row[1] || '').trim(),
            accountPlan: []
        })).filter(c => c.name);

        if (clientsToImport.length === 0) {
            alert('No se encontraron clientes válidos en el archivo');
            return;
        }

        if (supabase) {
            // Importar a Supabase
            const result = await importSupabaseClients(clientsToImport);

            if (result.imported > 0) {
                alert(`Se importaron ${result.imported} cliente(s) a Supabase`);
                await renderClientsList();
                await updateCounts();
            } else {
                alert('No se pudieron importar los clientes');
            }
        } else {
            // Fallback a localStorage
            const result = ClientManager.importClients(clientsToImport, true);

            if (result.imported === 0 && result.skipped > 0) {
                alert('Todos los clientes ya existen');
            } else {
                const totalClients = ClientManager.getAllClients().length;
                alert(`Se importaron ${result.imported} cliente(s) nuevo(s).\n` +
                      `Omitidos (duplicados): ${result.skipped}\n` +
                      `Total de clientes: ${totalClients}`);
            }
        }
    } catch (error) {
        alert('Error al importar clientes: ' + error.message);
    }

    event.target.value = '';
}

function repairClients() {
    const allClients = ClientManager.getAllClients();

    if (allClients.length === 0) {
        alert('No hay clientes para reparar');
        return;
    }

    const result = ClientManager.validateAndRepair();

    if (result.totalRepaired === 0) {
        alert('✓ No se detectaron problemas en los datos de clientes');
        return;
    }

    renderClientsList();
    alert(`✓ Reparación completada exitosamente.\n\n` +
          `IDs corruptos reparados: ${result.corruptedIds}\n` +
          `AccountPlans corregidos: ${result.missingAccountPlans}\n\n` +
          `Total reparado: ${result.totalRepaired}`);
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
