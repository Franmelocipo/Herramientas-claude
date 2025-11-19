// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== HERRAMIENTAS CONTABLES - SISTEMA CENTRALIZADO ===');
    updateCounts();
    attachEventListeners();
    console.log('Clientes:', ClientManager.getAllClients().length);
    console.log('Impuestos:', TaxManager.getAllTaxes().length);
    console.log('====================================================');
});

// ============================================
// ACTUALIZAR CONTADORES
// ============================================
function updateCounts() {
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
function showClientsModal() {
    document.getElementById('modalClients').classList.remove('hidden');
    renderClientsList();
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

function createClient() {
    const name = document.getElementById('newClientName').value.trim();
    if (!name) {
        alert('Ingresa una razón social para el cliente');
        return;
    }

    const cuit = document.getElementById('newClientCuit').value.trim();

    try {
        ClientManager.createClient({ name, cuit });
        hideNewClientModal();
        alert(`Cliente "${name}" creado exitosamente`);
    } catch (error) {
        alert('Error al crear cliente: ' + error.message);
    }
}

function selectClient(clientId) {
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;
    const success = ClientManager.selectClient(numericId);

    if (success) {
        const client = ClientManager.getClient(numericId);
        alert(`Cliente "${client.name}" seleccionado como activo`);
    }
}

function deleteClient(clientId) {
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;
    const client = ClientManager.getClient(numericId);

    if (confirm(`¿Eliminar el cliente "${client.name}"?`)) {
        ClientManager.deleteClient(numericId);
        renderClientsList();
    }
}

function renderClientsList(searchTerm = '') {
    const allClients = ClientManager.getAllClients();
    const filteredClients = ClientManager.searchClients(searchTerm);
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
        const accountCount = client.accountPlan?.length || 0;
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

        const success = ClientManager.importAccountPlan(numericId, accounts);
        if (success) {
            alert(`Plan de cuentas importado: ${accounts.length} cuentas`);
            renderClientsList();
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
            cuit: String(row[1] || '').trim()
        })).filter(c => c.name);

        if (clientsToImport.length === 0) {
            alert('No se encontraron clientes válidos en el archivo');
            return;
        }

        const result = ClientManager.importClients(clientsToImport, true);

        if (result.imported === 0 && result.skipped > 0) {
            alert('Todos los clientes ya existen');
        } else {
            const totalClients = ClientManager.getAllClients().length;
            alert(`Se importaron ${result.imported} cliente(s) nuevo(s).\n` +
                  `Omitidos (duplicados): ${result.skipped}\n` +
                  `Total de clientes: ${totalClients}`);
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
function showTaxesModal() {
    document.getElementById('modalTaxes').classList.remove('hidden');
    renderTaxDatabase();
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

        const result = TaxManager.importFromArray(taxes, true);

        if (result.success) {
            renderTaxDatabase();
            alert(`Base de datos de impuestos importada: ${result.imported} registros`);
        }
    } catch (error) {
        alert('Error al importar base de datos: ' + error.message);
    }

    event.target.value = '';
}

function renderTaxDatabase() {
    const taxDatabase = TaxManager.getAllTaxes();

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

function clearTaxDatabase() {
    if (confirm('¿Estás seguro de que deseas limpiar toda la base de datos de impuestos?')) {
        TaxManager.clear();
        renderTaxDatabase();
        alert('Base de datos limpiada');
    }
}

// ============================================
// MODAL ALMACENAMIENTO
// ============================================
function showStorageModal() {
    document.getElementById('modalStorage').classList.remove('hidden');
    showStorageStats();
}

function hideStorageModal() {
    document.getElementById('modalStorage').classList.add('hidden');
}

function showStorageStats() {
    const stats = DataStore.getStats();

    const html = `
        <div style="font-size: 14px; color: #475569;">
            <div style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                <div style="margin-bottom: 12px;">
                    <strong>Total de elementos:</strong> ${stats.itemCount}
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Espacio total:</strong> ${stats.totalSizeKB} KB (${stats.totalSizeMB} MB)
                </div>
            </div>

            <h4 style="margin-bottom: 12px; color: #1e293b;">Detalle por elemento:</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${Object.entries(stats.items).map(([key, item]) => `
                    <div style="padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${key}</div>
                        <div style="font-size: 13px; color: #64748b;">${item.sizeKB} KB</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('storageStats').innerHTML = html;
}
