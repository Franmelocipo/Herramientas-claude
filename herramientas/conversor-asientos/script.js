// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
// NOTA: Ahora usamos ClientManager y TaxManager para gestión centralizada de datos
const state = {
    step: 0,
    sourceType: '',
    sourceData: [],
    groupedData: [],
    accountCodes: {},
    finalData: [],
    bankAccount: '',
    activeSearchField: null,
    expandedGroups: {} // Rastrear qué grupos están expandidos
};

// ============================================
// HELPERS PARA COMPATIBILIDAD CON CÓDIGO EXISTENTE
// ============================================
// Estas funciones adaptan el código existente al nuevo sistema centralizado

function getClients() {
    return ClientManager.getAllClients();
}

function getSelectedClientId() {
    return ClientManager.getSelectedClientId();
}

function getTaxDatabase() {
    return TaxManager.getAllTaxes();
}

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const elements = {
    // Steps
    step0: document.getElementById('step0'),
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),

    // Header
    subtitle: document.getElementById('subtitle'),
    clientName: document.getElementById('clientName'),
    btnReset: document.getElementById('btnReset'),

    // Modals - Clients
    modalClientManager: document.getElementById('modalClientManager'),
    modalNewClient: document.getElementById('modalNewClient'),
    btnClientManager: document.getElementById('btnClientManager'),
    btnCloseClientManager: document.getElementById('btnCloseClientManager'),
    btnNewClient: document.getElementById('btnNewClient'),
    btnCancelNewClient: document.getElementById('btnCancelNewClient'),
    btnCreateClient: document.getElementById('btnCreateClient'),
    btnRepairClients: document.getElementById('btnRepairClients'),
    newClientName: document.getElementById('newClientName'),
    newClientCuit: document.getElementById('newClientCuit'),
    clientsList: document.getElementById('clientsList'),
    importClientsFile: document.getElementById('importClientsFile'),

    // Modals - Tax Database
    modalTaxDatabase: document.getElementById('modalTaxDatabase'),
    btnTaxDatabase: document.getElementById('btnTaxDatabase'),
    btnCloseTaxDatabase: document.getElementById('btnCloseTaxDatabase'),
    importTaxFile: document.getElementById('importTaxFile'),
    taxStats: document.getElementById('taxStats'),
    taxTableBody: document.getElementById('taxTableBody'),
    btnClearTaxDatabase: document.getElementById('btnClearTaxDatabase'),

    // Step 1
    sourceTypeName: document.getElementById('sourceTypeName'),
    fileInput: document.getElementById('fileInput'),
    btnSelectFile: document.getElementById('btnSelectFile'),

    // Step 2
    groupStats: document.getElementById('groupStats'),
    bankAccountSection: document.getElementById('bankAccountSection'),
    bankAccountLabel: document.getElementById('bankAccountLabel'),
    bankAccountInput: document.getElementById('bankAccountInput'),
    bankAccountDropdown: document.getElementById('bankAccountDropdown'),
    compensacionesInfo: document.getElementById('compensacionesInfo'),
    groupsList: document.getElementById('groupsList'),
    btnBackToUpload: document.getElementById('btnBackToUpload'),
    btnGenerateFinal: document.getElementById('btnGenerateFinal'),

    // Step 3
    finalStats: document.getElementById('finalStats'),
    previewTableBody: document.getElementById('previewTableBody'),
    btnBackToAssignment: document.getElementById('btnBackToAssignment'),
    btnDownloadExcel: document.getElementById('btnDownloadExcel')
};

// ============================================
// TIPOS DE FUENTE
// ============================================
const sourceTypes = {
    extracto: { name: 'Extracto Bancario', icon: '🏦' },
    registros: { name: 'Registros del Cliente', icon: '📝' },
    veps: { name: 'VEPs ARCA', icon: '🧾' },
    compensaciones: { name: 'Compensaciones ARCA', icon: '🔄' }
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== INICIANDO APLICACIÓN ===');
    console.log('Usando sistema centralizado de datos compartidos');

    updateClientName();
    attachEventListeners();

    // Log de diagnóstico usando ClientManager
    const clients = getClients();
    console.log('Estado inicial de clientes:');
    console.table(clients.map(c => ({
        nombre: c.name,
        id: c.id,
        idValido: Number.isInteger(c.id) ? 'SI' : 'NO',
        cuentas: c.accountPlan?.length || 0
    })));

    const selectedClientId = getSelectedClientId();
    if (selectedClientId) {
        const selected = ClientManager.getClient(selectedClientId);
        console.log('Cliente seleccionado actual:', selected ? selected.name : 'NO ENCONTRADO');
    } else {
        console.log('No hay cliente seleccionado');
    }

    console.log(`Base de impuestos: ${getTaxDatabase().length} registros`);
    console.log('======================');
});

function attachEventListeners() {
    // Header
    elements.btnClientManager.addEventListener('click', () => showClientManager());
    elements.btnTaxDatabase.addEventListener('click', () => showTaxDatabase());
    elements.btnReset.addEventListener('click', () => reset());

    // Modals - Clients
    elements.btnCloseClientManager.addEventListener('click', () => hideClientManager());
    elements.btnNewClient.addEventListener('click', () => showNewClientModal());
    elements.btnCancelNewClient.addEventListener('click', () => hideNewClientModal());
    elements.btnCreateClient.addEventListener('click', () => createClient());
    elements.btnRepairClients.addEventListener('click', () => repairClientData());
    elements.importClientsFile.addEventListener('change', (e) => importClients(e));

    // Client search
    const clientSearchInput = document.getElementById('clientSearchInput');
    if (clientSearchInput) {
        clientSearchInput.addEventListener('input', (e) => {
            renderClientsList(e.target.value);
        });
    }

    // Modals - Tax Database
    elements.btnCloseTaxDatabase.addEventListener('click', () => hideTaxDatabase());
    elements.importTaxFile.addEventListener('change', (e) => importTaxDatabase(e));
    elements.btnClearTaxDatabase.addEventListener('click', () => clearTaxDatabase());

    // Step 0: Source type selection
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectSourceType(btn.dataset.type));
    });

    // Step 1: File upload
    elements.btnSelectFile.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileUpload);

    // Step 2: Account assignment
    elements.bankAccountInput.addEventListener('click', () => {
        if (getSelectedClientId()) {
            state.activeSearchField = 'bank';
            showAccountDropdown('bank');
        }
    });
    elements.btnBackToUpload.addEventListener('click', () => goToStep(1));
    elements.btnGenerateFinal.addEventListener('click', () => generateFinalExcel());

    // Step 3: Download
    elements.btnBackToAssignment.addEventListener('click', () => goToStep(2));
    elements.btnDownloadExcel.addEventListener('click', () => downloadExcel());

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-with-dropdown') && !e.target.closest('.account-dropdown')) {
            closeAllDropdowns();
        }
    });
}

// ============================================
// NAVEGACIÓN ENTRE PASOS
// ============================================
function goToStep(step) {
    state.step = step;

    // Hide all steps
    elements.step0.classList.add('hidden');
    elements.step1.classList.add('hidden');
    elements.step2.classList.add('hidden');
    elements.step3.classList.add('hidden');

    // Show current step
    switch (step) {
        case 0:
            elements.step0.classList.remove('hidden');
            elements.subtitle.textContent = 'Selecciona el origen';
            elements.btnReset.classList.add('hidden');
            break;
        case 1:
            elements.step1.classList.remove('hidden');
            elements.subtitle.textContent = `${sourceTypes[state.sourceType].name} → Formato de Importación`;
            elements.btnReset.classList.remove('hidden');
            break;
        case 2:
            elements.step2.classList.remove('hidden');
            elements.subtitle.textContent = `${sourceTypes[state.sourceType].name} → Formato de Importación`;
            elements.btnReset.classList.remove('hidden');
            renderGroupsList();
            break;
        case 3:
            elements.step3.classList.remove('hidden');
            elements.subtitle.textContent = `${sourceTypes[state.sourceType].name} → Formato de Importación`;
            elements.btnReset.classList.remove('hidden');
            renderPreview();
            break;
    }
}

function reset() {
    state.step = 0;
    state.sourceType = '';
    state.sourceData = [];
    state.groupedData = [];
    state.accountCodes = {};
    state.finalData = [];
    state.bankAccount = '';
    state.activeSearchField = null;
    state.expandedGroups = {};

    elements.fileInput.value = '';
    elements.bankAccountInput.value = '';

    goToStep(0);
}

// ============================================
// GESTIÓN DE CLIENTES
// ============================================
function showClientManager() {
    elements.modalClientManager.classList.remove('hidden');
    renderClientsList();
}

function hideClientManager() {
    elements.modalClientManager.classList.add('hidden');
    // Limpiar campo de búsqueda al cerrar
    const clientSearchInput = document.getElementById('clientSearchInput');
    if (clientSearchInput) {
        clientSearchInput.value = '';
    }
}

function showNewClientModal() {
    elements.modalNewClient.classList.remove('hidden');
    elements.newClientName.value = '';
    elements.newClientCuit.value = '';
    elements.newClientName.focus();
}

function hideNewClientModal() {
    elements.modalNewClient.classList.add('hidden');
}

function createClient() {
    const name = elements.newClientName.value.trim();
    if (!name) {
        alert('Ingresa una razón social para el cliente');
        return;
    }

    const cuit = elements.newClientCuit.value.trim();

    try {
        const newClient = ClientManager.createClient({ name, cuit });
        ClientManager.selectClient(newClient.id);
        updateClientName();

        hideNewClientModal();
        renderClientsList();
    } catch (error) {
        alert('Error al crear cliente: ' + error.message);
    }
}

function selectClient(clientId) {
    console.log('=== SELECCIONANDO CLIENTE ===');
    console.log('ID recibido (raw):', clientId, 'tipo:', typeof clientId);

    // Convertir a número si viene como string del HTML onclick
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;
    console.log('ID convertido:', numericId, 'tipo:', typeof numericId);

    const success = ClientManager.selectClient(numericId);

    if (success) {
        updateClientName();
        console.log('Cliente asignado exitosamente');
    } else {
        console.error('ERROR: No se encontró el cliente con ID:', numericId);
    }

    // Limpiar campo de búsqueda
    const clientSearchInput = document.getElementById('clientSearchInput');
    if (clientSearchInput) {
        clientSearchInput.value = '';
    }

    console.log('========================');
    hideClientManager();
}

function deleteClient(clientId) {
    // Convertir a número si viene como string del HTML onclick
    const numericId = typeof clientId === 'string' ? parseFloat(clientId) : clientId;

    if (confirm('¿Eliminar este cliente?')) {
        const deleted = ClientManager.deleteClient(numericId);
        if (deleted) {
            updateClientName();
            renderClientsList();
        }
    }
}

function updateClientName() {
    const selectedClientId = getSelectedClientId();

    if (selectedClientId) {
        const client = ClientManager.getClient(selectedClientId);
        if (client) {
            elements.clientName.textContent = `Cliente: ${client.name}`;
            console.log('Cliente seleccionado:', {
                id: selectedClientId,
                nombre: client.name,
                cuentas: client.accountPlan?.length || 0
            });
        } else {
            console.error('No se encontró el cliente con ID:', selectedClientId);
            elements.clientName.textContent = '';
        }
    } else {
        elements.clientName.textContent = '';
    }
}

function renderClientsList(searchTerm = '') {
    // Usar ClientManager para buscar clientes
    const allClients = getClients();
    const filteredClients = ClientManager.searchClients(searchTerm);

    // Actualizar estadísticas
    const statsElement = document.getElementById('clientsStats');
    if (searchTerm.trim() !== '' && allClients.length > 0) {
        statsElement.textContent = `Mostrando ${filteredClients.length} de ${allClients.length} clientes`;
        statsElement.classList.add('show');
    } else {
        statsElement.classList.remove('show');
    }

    const selectedClientId = getSelectedClientId();

    // Renderizar lista
    const html = allClients.length === 0
        ? '<div class="empty-state">No hay clientes. Crea uno para comenzar.</div>'
        : filteredClients.length === 0
        ? '<div class="empty-state">No se encontraron clientes con ese criterio de búsqueda.</div>'
        : filteredClients.map(client => {
            const isSelected = selectedClientId === client.id;
            const selectedClass = isSelected ? 'client-item-selected' : '';
            const accountCount = client.accountPlan?.length || 0;
            const idType = Number.isInteger(client.id) ? '✓' : '⚠️';

            return `
                <div class="client-item ${selectedClass}">
                    <div class="client-header">
                        <div>
                            <h3>${client.name} ${isSelected ? '(Seleccionado)' : ''}</h3>
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

    elements.clientsList.innerHTML = html;
}

async function importAccountPlan(event, clientId) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Convertir a número si viene como string del HTML onchange
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

function getClientAccounts() {
    const selectedClientId = getSelectedClientId();
    if (!selectedClientId) return [];
    return ClientManager.getAccountPlan(selectedClientId);
}

function repairClientData() {
    console.log('=== REPARACIÓN DE DATOS DE CLIENTES ===');

    const allClients = getClients();

    if (allClients.length === 0) {
        alert('No hay clientes para reparar');
        return;
    }

    // Usar ClientManager para validar y reparar
    const result = ClientManager.validateAndRepair();

    if (result.totalRepaired === 0) {
        alert('✓ No se detectaron problemas en los datos de clientes');
        console.log('No se detectaron problemas');
        return;
    }

    // Re-renderizar
    updateClientName();
    renderClientsList();

    console.log('=== REPARACIÓN COMPLETADA ===');
    alert(`✓ Reparación completada exitosamente.\n\n` +
          `IDs corruptos reparados: ${result.corruptedIds}\n` +
          `AccountPlans corregidos: ${result.missingAccountPlans}\n\n` +
          `Por favor, selecciona nuevamente tu cliente.`);
}

// ============================================
// IMPORTACIÓN MASIVA DE CLIENTES
// ============================================
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

        // Usar ClientManager para importar
        const result = ClientManager.importClients(clientsToImport, true);

        if (result.imported === 0 && result.skipped > 0) {
            alert('Todos los clientes ya existen');
        } else {
            renderClientsList();
            const totalClients = getClients().length;
            alert(`Se importaron ${result.imported} cliente(s) nuevo(s).\n` +
                  `Omitidos (duplicados): ${result.skipped}\n` +
                  `Total de clientes: ${totalClients}`);
        }
    } catch (error) {
        alert('Error al importar clientes: ' + error.message);
    }

    event.target.value = '';
}

// ============================================
// GESTIÓN DE BASE DE DATOS DE IMPUESTOS
// ============================================
function showTaxDatabase() {
    elements.modalTaxDatabase.classList.remove('hidden');
    renderTaxDatabase();
}

function hideTaxDatabase() {
    elements.modalTaxDatabase.classList.add('hidden');
}

async function importTaxDatabase(event) {
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

        // Usar TaxManager para importar
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
    const taxDatabase = getTaxDatabase();

    const stats = taxDatabase.length === 0
        ? 'No hay datos en la base de impuestos'
        : `Total de registros: ${taxDatabase.length}`;

    elements.taxStats.textContent = stats;

    if (taxDatabase.length === 0) {
        elements.taxTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 32px; color: #64748b;">No hay datos. Importa un archivo Excel para comenzar.</td></tr>';
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

    elements.taxTableBody.innerHTML = html;
}

function clearTaxDatabase() {
    if (confirm('¿Estás seguro de que deseas limpiar toda la base de datos de impuestos?')) {
        TaxManager.clear();
        renderTaxDatabase();
        alert('Base de datos limpiada');
    }
}

// ============================================
// SELECCIÓN DE TIPO DE FUENTE
// ============================================
function selectSourceType(type) {
    state.sourceType = type;
    elements.sourceTypeName.textContent = sourceTypes[type].name;
    goToStep(1);
}

// ============================================
// CARGA DE ARCHIVO
// ============================================
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { raw: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        let jsonData;

        if (state.sourceType === 'compensaciones') {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, range: 1 });
        } else {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
        }

        if (jsonData.length === 0) {
            alert('El archivo está vacío');
            return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = row[idx];
            });
            return obj;
        });

        state.sourceData = rows;
        groupSimilarEntries(rows);
        goToStep(2);

    } catch (error) {
        alert('Error al leer el archivo: ' + error.message);
    }
}

// ============================================
// AGRUPACIÓN DE DATOS
// ============================================
function groupSimilarEntries(data) {
    const groups = {};

    if (state.sourceType === 'compensaciones') {
        data.forEach((row) => {
            const impuestoOrig = String(row['Impuesto Orig'] || '').trim();
            const conceptoOrig = String(row['Concepto Orig'] || '').trim();
            const subconceptoOrig = String(row['Subconcepto Orig'] || '').trim();

            const impuestoDest = String(row['Impuesto Dest'] || '').trim();
            const conceptoDest = String(row['Concepto Dest'] || '').trim();
            const subconceptoDest = String(row['Subconcepto Dest'] || '').trim();

            if (!impuestoOrig || !impuestoDest) return;

            let importe = 0;
            const importeStr = String(row['Importe'] || '0').replace('$', '').trim();
            if (importeStr && importeStr !== '0') {
                importe = parseFloat(importeStr.replace(/\./g, '').replace(',', '.')) || 0;
            }

            // Grupo ORIGEN (HABER)
            const keyOrig = `ORIG: ${impuestoOrig} / ${conceptoOrig} / ${subconceptoOrig}`;
            if (!groups[keyOrig]) {
                groups[keyOrig] = {
                    concepto: keyOrig,
                    ejemploCompleto: `🔵 Origen (HABER): ${impuestoOrig} - ${conceptoOrig} - ${subconceptoOrig}`,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: [],
                    isOrigen: true,
                    impuesto: impuestoOrig
                };
            }

            groups[keyOrig].count++;
            groups[keyOrig].totalHaber += importe;
            groups[keyOrig].items.push({ ...row, tipo: 'origen' });

            // Grupo DESTINO (DEBE)
            const keyDest = `DEST: ${impuestoDest} / ${conceptoDest} / ${subconceptoDest}`;
            if (!groups[keyDest]) {
                groups[keyDest] = {
                    concepto: keyDest,
                    ejemploCompleto: `🟢 Destino (DEBE): ${impuestoDest} - ${conceptoDest} - ${subconceptoDest}`,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: [],
                    isOrigen: false,
                    impuesto: impuestoDest
                };
            }

            groups[keyDest].count++;
            groups[keyDest].totalDebe += importe;
            groups[keyDest].items.push({ ...row, tipo: 'destino' });
        });

    } else if (state.sourceType === 'veps') {
        data.forEach((row) => {
            const nroVep = String(row['NRO_VEP'] || row['Nro_VEP'] || row['nro_vep'] || '').trim();
            if (!nroVep) return;

            const impuesto = String(row['IMPUESTO'] || row['Impuesto'] || row['impuesto'] || '').trim();
            const codSubconcepto = String(row['COD_SUBCONCEPTO'] || row['Cod_Subconcepto'] || row['cod_subconcepto'] || '').trim();
            const subconcepto = String(row['SUBCONCEPTO'] || row['Subconcepto'] || row['subconcepto'] || '').trim();

            let importe = 0;
            if (row['IMPORTE'] !== undefined && row['IMPORTE'] !== null && row['IMPORTE'] !== '' && row['IMPORTE'] !== '-') {
                importe = typeof row['IMPORTE'] === 'number' ? row['IMPORTE'] : parseFloat(String(row['IMPORTE']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            let key;
            if (codSubconcepto === '51' || (subconcepto.toUpperCase().includes('INTERES') && subconcepto.toUpperCase().includes('RESARCITORIO'))) {
                key = 'INTERESES RESARCITORIOS';
            } else {
                key = impuesto;
            }

            if (!groups[key]) {
                groups[key] = {
                    concepto: key,
                    ejemploCompleto: key,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: [],
                    veps: new Set()
                };
            }

            groups[key].count++;
            groups[key].totalDebe += importe;
            groups[key].items.push(row);
            groups[key].veps.add(nroVep);
        });

        Object.values(groups).forEach(group => {
            group.vepsArray = Array.from(group.veps);
            group.ejemploCompleto = `${group.concepto} (${group.vepsArray.length} VEP${group.vepsArray.length > 1 ? 's' : ''})`;
            delete group.veps;
        });

    } else if (state.sourceType === 'registros') {
        data.forEach((row) => {
            const descCta = String(row['DESC_CTA'] || row['Desc_Cta'] || row['desc_cta'] || '').trim();
            if (!descCta) return;

            const proveedor = String(row['PROVEEDOR'] || row['Proveedor'] || row['proveedor'] || '').trim();
            const concepto = String(row['CONCEPTO'] || row['Concepto'] || row['concepto'] || '').trim();

            let debeVal = 0, haberVal = 0;

            if (row['DEBE'] !== undefined && row['DEBE'] !== null && row['DEBE'] !== '' && row['DEBE'] !== '-') {
                debeVal = typeof row['DEBE'] === 'number' ? row['DEBE'] : parseFloat(String(row['DEBE']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            if (row['HABER'] !== undefined && row['HABER'] !== null && row['HABER'] !== '' && row['HABER'] !== '-') {
                haberVal = typeof row['HABER'] === 'number' ? row['HABER'] : parseFloat(String(row['HABER']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            const key = descCta;

            if (!groups[key]) {
                groups[key] = {
                    concepto: descCta,
                    ejemploCompleto: proveedor ? `${proveedor} - ${concepto || descCta}` : `${concepto || descCta}`,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: []
                };
            }

            groups[key].count++;
            groups[key].totalDebe += debeVal;
            groups[key].totalHaber += haberVal;
            groups[key].items.push(row);
        });

    } else {
        // Extractos bancarios
        const patterns = [
            { key: 'TRANSFERENCIAS RECIBIDAS', keywords: ['TRANSFER', 'TRANSF', 'ACREDITAMIENTO', 'ACREDIT'] },
            { key: 'CHEQUES DEPOSITADOS', keywords: ['ECHEQ', 'CHEQUE', 'CHQ', 'CANJE'] },
            { key: 'DEBITOS AUTOMATICOS', keywords: ['DEB AUT', 'DEBITO AUT'] },
            { key: 'IMPUESTOS', keywords: ['ING. BRUTOS', 'IIBB', 'SIRCREB', 'IVA'] },
            { key: 'COMISIONES', keywords: ['COMISION', 'COM.'] },
            { key: 'RETENCIONES', keywords: ['RETENCION', 'RET.', 'PERCEPCION'] }
        ];

        data.forEach((row) => {
            const desc = String(row['Descripción'] || row.Leyenda || '').toUpperCase();
            if (!desc) return;

            let debitoVal = 0, creditoVal = 0;

            if (row['Débito'] !== undefined && row['Débito'] !== null && row['Débito'] !== '' && row['Débito'] !== 0) {
                debitoVal = typeof row['Débito'] === 'number' ? row['Débito'] : parseFloat(String(row['Débito']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            if (row['Crédito'] !== undefined && row['Crédito'] !== null && row['Crédito'] !== '' && row['Crédito'] !== 0) {
                creditoVal = typeof row['Crédito'] === 'number' ? row['Crédito'] : parseFloat(String(row['Crédito']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            let matched = false;
            for (const pattern of patterns) {
                if (pattern.keywords.some(kw => desc.includes(kw))) {
                    if (!groups[pattern.key]) {
                        groups[pattern.key] = {
                            concepto: pattern.key,
                            ejemploCompleto: row['Descripción'] || row.Leyenda,
                            count: 0,
                            totalDebe: 0,
                            totalHaber: 0,
                            items: []
                        };
                    }
                    groups[pattern.key].count++;
                    groups[pattern.key].totalDebe += debitoVal;
                    groups[pattern.key].totalHaber += creditoVal;
                    groups[pattern.key].items.push(row);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                const palabras = desc.split(' ').filter(p => p.length > 2).slice(0, 3).join(' ');
                const key = palabras || 'OTROS';
                if (!groups[key]) {
                    groups[key] = {
                        concepto: key,
                        ejemploCompleto: row['Descripción'] || row.Leyenda,
                        count: 0,
                        totalDebe: 0,
                        totalHaber: 0,
                        items: []
                    };
                }
                groups[key].count++;
                groups[key].totalDebe += debitoVal;
                groups[key].totalHaber += creditoVal;
                groups[key].items.push(row);
            }
        });
    }

    state.groupedData = Object.values(groups);
}

// ============================================
// RENDERIZADO DE LISTA DE GRUPOS
// ============================================
function renderGroupsList() {
    elements.groupStats.textContent = `${state.groupedData.length} grupos | ${state.sourceData.length} movimientos`;

    // Mostrar/ocultar sección de cuenta bancaria
    if (state.sourceType === 'extracto' || state.sourceType === 'veps') {
        elements.bankAccountSection.classList.remove('hidden');
        elements.bankAccountLabel.textContent = state.sourceType === 'extracto'
            ? 'Cuenta del Banco (contrapartida)'
            : 'Cuenta de Contrapartida (para totales de VEP)';
        elements.bankAccountInput.placeholder = getSelectedClientId() ? 'Click para buscar cuenta...' : 'Ej: 11010101';
        elements.bankAccountInput.value = state.bankAccount;
    } else {
        elements.bankAccountSection.classList.add('hidden');
    }

    // Mostrar/ocultar info de compensaciones
    if (state.sourceType === 'compensaciones') {
        elements.compensacionesInfo.classList.remove('hidden');
    } else {
        elements.compensacionesInfo.classList.add('hidden');
    }

    // Renderizar grupos
    const html = state.groupedData.map((g, idx) => {
        const classType = state.sourceType === 'compensaciones'
            ? (g.isOrigen ? 'origen' : 'destino')
            : '';

        const extraLabel = state.sourceType === 'compensaciones'
            ? (g.isOrigen ? ' (HABER)' : ' (DEBE)')
            : '';

        const isExpanded = state.expandedGroups[idx] || false;
        const expandIcon = isExpanded ? '▼' : '▶';

        // Generar tabla de detalle de movimientos
        let detailsHtml = '';
        if (isExpanded && g.items && g.items.length > 0) {
            const headers = Object.keys(g.items[0]).filter(k => !k.startsWith('_'));
            detailsHtml = `
                <div class="group-details">
                    <div class="group-details-table-container">
                        <table class="group-details-table">
                            <thead>
                                <tr>
                                    ${headers.map(h => `<th>${h}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${g.items.map(item => `
                                    <tr>
                                        ${headers.map(h => {
                                            const val = item[h];
                                            if (val === undefined || val === null || val === '') return '<td>-</td>';
                                            if (typeof val === 'number') return `<td class="text-right">${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>`;
                                            return `<td>${val}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        return `
            <div class="group-item ${classType}">
                <div class="group-main-row">
                    <button class="group-expand-btn" onclick="toggleGroupExpansion(${idx})" title="Ver detalle de movimientos">
                        ${expandIcon}
                    </button>
                    <div class="group-info">
                        <div class="group-concepto">${g.concepto}</div>
                        <div class="group-ejemplo">${g.ejemploCompleto}</div>
                        <div class="group-stats">
                            ${g.count} mov | Debe: $${g.totalDebe.toFixed(2)} | Haber: $${g.totalHaber.toFixed(2)}
                        </div>
                    </div>
                    <div class="group-account">
                        <label>Código de cuenta${extraLabel}</label>
                        <div class="input-with-dropdown">
                            <input
                                type="text"
                                class="input-text"
                                data-group-idx="${idx}"
                                value="${state.accountCodes[idx] || ''}"
                                placeholder="${getSelectedClientId() ? 'Click para buscar...' : 'Código'}"
                            >
                            <div class="account-dropdown hidden" id="dropdown-${idx}"></div>
                        </div>
                    </div>
                </div>
                ${detailsHtml}
            </div>
        `;
    }).join('');

    elements.groupsList.innerHTML = html;

    // Attach event listeners to account inputs
    document.querySelectorAll('.group-account input[data-group-idx]').forEach(input => {
        const idx = parseInt(input.dataset.groupIdx);
        input.addEventListener('input', (e) => {
            state.accountCodes[idx] = e.target.value;
        });
        input.addEventListener('click', () => {
            if (getSelectedClientId()) {
                state.activeSearchField = idx;
                showAccountDropdown(idx);
            }
        });
    });
}

// ============================================
// EXPANSIÓN DE GRUPOS
// ============================================
function toggleGroupExpansion(idx) {
    state.expandedGroups[idx] = !state.expandedGroups[idx];
    renderGroupsList();
}

// ============================================
// DROPDOWN DE CUENTAS
// ============================================
function showAccountDropdown(fieldId) {
    closeAllDropdowns();

    const accounts = getClientAccounts();
    if (accounts.length === 0) {
        alert('El cliente no tiene plan de cuentas');
        return;
    }

    let dropdown;
    if (fieldId === 'bank') {
        dropdown = elements.bankAccountDropdown;
    } else {
        dropdown = document.getElementById(`dropdown-${fieldId}`);
    }

    if (!dropdown) return;

    renderAccountDropdown(dropdown, accounts, (acc) => {
        if (fieldId === 'bank') {
            state.bankAccount = acc.code;
            elements.bankAccountInput.value = acc.code;
        } else {
            state.accountCodes[fieldId] = acc.code;
            const input = document.querySelector(`input[data-group-idx="${fieldId}"]`);
            if (input) input.value = acc.code;
        }
        closeAllDropdowns();
    });

    dropdown.classList.remove('hidden');
}

function renderAccountDropdown(dropdown, accounts, onSelect) {
    let query = '';

    const render = () => {
        const filteredAccounts = query.trim() === ''
            ? accounts.slice(0, 20)
            : accounts.filter(a =>
                String(a.code || '').toLowerCase().includes(query.toLowerCase()) ||
                String(a.description || '').toLowerCase().includes(query.toLowerCase())
            ).slice(0, 20);

        const searchHtml = `
            <div class="dropdown-search">
                <input type="text" placeholder="Buscar por código o descripción..." class="dropdown-search-input">
            </div>
        `;

        const itemsHtml = filteredAccounts.length === 0
            ? '<div class="dropdown-empty">No se encontraron resultados</div>'
            : filteredAccounts.map(acc => `
                <div class="dropdown-item" data-code="${acc.code}">
                    <div class="dropdown-item-code">${acc.code}</div>
                    <div class="dropdown-item-desc">${acc.description}</div>
                </div>
            `).join('');

        dropdown.innerHTML = `
            ${searchHtml}
            <div class="dropdown-items">${itemsHtml}</div>
        `;

        // Search input
        const searchInput = dropdown.querySelector('.dropdown-search-input');
        if (searchInput) {
            searchInput.value = query;
            searchInput.focus();
            searchInput.addEventListener('input', (e) => {
                query = e.target.value;
                render();
            });
        }

        // Item clicks
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                const acc = accounts.find(a => a.code === code);
                if (acc) onSelect(acc);
            });
        });
    };

    render();
}

function closeAllDropdowns() {
    state.activeSearchField = null;
    elements.bankAccountDropdown.classList.add('hidden');
    document.querySelectorAll('.account-dropdown').forEach(d => d.classList.add('hidden'));
}

// ============================================
// GENERACIÓN DE ASIENTOS FINALES
// ============================================
function generateFinalExcel() {
    if (state.sourceType === 'compensaciones') {
        const missingAccounts = state.groupedData.filter((g, idx) => !state.accountCodes[idx]);
        if (missingAccounts.length > 0) {
            alert(`⚠️ Faltan asignar cuentas a ${missingAccounts.length} grupo(s)`);
            return;
        }
    } else if ((state.sourceType === 'extracto' || state.sourceType === 'veps') && !state.bankAccount) {
        alert(state.sourceType === 'extracto' ? 'Por favor ingresa la cuenta del banco' : 'Por favor ingresa la cuenta de contrapartida');
        return;
    }

    const allData = [];
    let numeroAsientoGlobal = 1;

    state.groupedData.forEach((g, idx) => {
        const code = state.accountCodes[idx] || '';
        let numeroAsiento = numeroAsientoGlobal;

        if (state.sourceType === 'compensaciones') {
            processCompensaciones(g, code, allData);
        } else if (state.sourceType === 'veps') {
            numeroAsiento = processVeps(g, code, allData, numeroAsiento);
            numeroAsientoGlobal = numeroAsiento;
        } else if (state.sourceType === 'registros') {
            processRegistros(g, code, allData);
        } else if (state.sourceType === 'extracto') {
            numeroAsiento = processExtracto(g, code, allData, numeroAsiento);
            numeroAsientoGlobal = numeroAsiento;
        }
    });

    // Post-procesamiento
    if (state.sourceType === 'compensaciones') {
        postProcessCompensaciones(allData);
    } else if (state.sourceType === 'registros') {
        allData.sort((a, b) => a._sortOrder - b._sortOrder);
        allData.forEach(item => delete item._sortOrder);
    }

    state.finalData = allData;
    goToStep(3);
}

function processCompensaciones(g, code, allData) {
    const itemsByTransaccion = {};

    g.items.forEach(item => {
        const transaccion = item['Transacción'] || item['Transaccion'] || '';
        if (!itemsByTransaccion[transaccion]) {
            itemsByTransaccion[transaccion] = [];
        }
        itemsByTransaccion[transaccion].push(item);
    });

    Object.entries(itemsByTransaccion).forEach(([transaccion, items]) => {
        const primeraLinea = items[0];
        const fechaOp = primeraLinea['Fecha Operación'] || primeraLinea['Fecha Operacion'] || '';
        const periodoOrig = primeraLinea['Período Orig'] || primeraLinea['Periodo Orig'] || '';
        const periodoDest = primeraLinea['Período Dest'] || primeraLinea['Periodo Dest'] || '';

        let importe = 0;
        const importeStr = String(primeraLinea['Importe'] || '0').replace('$', '').trim();
        if (importeStr && importeStr !== '0') {
            importe = parseFloat(importeStr.replace(/\./g, '').replace(',', '.')) || 0;
        }

        let leyenda, debe, haber;

        if (g.isOrigen) {
            const impuesto = primeraLinea['Impuesto Orig'] || '';
            const concepto = primeraLinea['Concepto Orig'] || '';
            const subconcepto = primeraLinea['Subconcepto Orig'] || '';
            leyenda = `COMP ${transaccion} - ${impuesto} ${concepto} ${subconcepto} / ${periodoOrig}`;
            debe = 0;
            haber = parseFloat(importe.toFixed(2));
        } else {
            const impuesto = primeraLinea['Impuesto Dest'] || '';
            const concepto = primeraLinea['Concepto Dest'] || '';
            const subconcepto = primeraLinea['Subconcepto Dest'] || '';
            leyenda = `COMP ${transaccion} - ${impuesto} ${concepto} ${subconcepto} / ${periodoDest}`;
            debe = parseFloat(importe.toFixed(2));
            haber = 0;
        }

        allData.push({
            Fecha: fechaOp,
            Cuenta: code,
            Debe: debe,
            Haber: haber,
            'Tipo de auxiliar': 1,
            Auxiliar: 1,
            Importe: parseFloat((debe - haber).toFixed(2)),
            Leyenda: leyenda,
            ExtraContable: 's',
            _transaccion: transaccion
        });
    });
}

function processVeps(g, code, allData, numeroAsiento) {
    const itemsByVep = {};

    g.items.forEach(item => {
        const nroVep = item['NRO_VEP'] || item['Nro_VEP'] || item['nro_vep'] || '';
        if (!itemsByVep[nroVep]) {
            itemsByVep[nroVep] = [];
        }
        itemsByVep[nroVep].push(item);
    });

    Object.entries(itemsByVep).forEach(([nroVep, items]) => {
        let totalVep = 0;
        const primeraLinea = items[0];
        const fecha = primeraLinea['FECHA'] || primeraLinea['Fecha'] || '';
        const periodo = primeraLinea['PERIODO'] || primeraLinea['Periodo'] || '';

        items.forEach(item => {
            const impuesto = item['IMPUESTO'] || item['Impuesto'] || '';
            const concepto = item['CONCEPTO'] || item['Concepto'] || '';
            const subconcepto = item['SUBCONCEPTO'] || item['Subconcepto'] || '';

            let importe = 0;
            if (item['IMPORTE'] !== undefined && item['IMPORTE'] !== null && item['IMPORTE'] !== '') {
                importe = typeof item['IMPORTE'] === 'number' ? item['IMPORTE'] : parseFloat(String(item['IMPORTE']).replace(/\./g, '').replace(',', '.')) || 0;
            }

            totalVep += importe;

            const leyenda = `${impuesto} - ${concepto} - ${subconcepto} / ${periodo} / VEP ${nroVep}`;

            const debe = parseFloat(importe.toFixed(2));
            const haber = 0;
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: code,
                Debe: debe,
                Haber: haber,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((debe - haber).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
            });
        });

        const leyendaContrapartida = `VEP ${nroVep} / ${periodo}`;
        const debeContra = 0;
        const haberContra = parseFloat(totalVep.toFixed(2));
        allData.push({
            Fecha: fecha,
            Numero: numeroAsiento,
            Cuenta: state.bankAccount,
            Debe: debeContra,
            Haber: haberContra,
            'Tipo de auxiliar': 1,
            Auxiliar: 1,
            Importe: parseFloat((debeContra - haberContra).toFixed(2)),
            Leyenda: leyendaContrapartida,
            ExtraContable: 's'
        });

        numeroAsiento++;
    });

    return numeroAsiento;
}

function processRegistros(g, code, allData) {
    g.items.forEach(item => {
        const fecha = item['FECHA'] || item['Fecha'] || '';
        const nInter = item['N_INTER'] || item['N_Inter'] || item['n_inter'] || '';
        const nComp = item['N_COMP'] || item['N_Comp'] || item['n_comp'] || '';
        const razonSocial = item['RAZON SOCIAL'] || item['RAZON_SOCIAL'] || item['Razon Social'] ||
            item['PROVEEDOR'] || item['Proveedor'] || item['proveedor'] || '';
        const concepto = item['CONCEPTO'] || item['Concepto'] || item['concepto'] || '';

        let debeVal = 0, haberVal = 0;

        if (item['DEBE'] !== undefined && item['DEBE'] !== null && item['DEBE'] !== '' && item['DEBE'] !== '-') {
            debeVal = typeof item['DEBE'] === 'number' ? item['DEBE'] : parseFloat(String(item['DEBE']).replace(/\./g, '').replace(',', '.')) || 0;
        }

        if (item['HABER'] !== undefined && item['HABER'] !== null && item['HABER'] !== '' && item['HABER'] !== '-') {
            haberVal = typeof item['HABER'] === 'number' ? item['HABER'] : parseFloat(String(item['HABER']).replace(/\./g, '').replace(',', '.')) || 0;
        }

        const debe = debeVal > 0 ? parseFloat(debeVal.toFixed(2)) : 0;
        const haber = haberVal > 0 ? parseFloat(haberVal.toFixed(2)) : 0;

        const leyendaParts = [];
        if (concepto) leyendaParts.push(concepto);
        if (nComp) leyendaParts.push(nComp);
        if (razonSocial) leyendaParts.push(razonSocial);
        const leyenda = leyendaParts.join(' / ');

        allData.push({
            Fecha: fecha,
            Numero: nInter,
            Cuenta: code,
            Debe: debe,
            Haber: haber,
            'Tipo de auxiliar': 1,
            Auxiliar: 1,
            Importe: parseFloat((debe - haber).toFixed(2)),
            Leyenda: leyenda,
            ExtraContable: 's',
            _sortOrder: parseInt(nInter) || 0
        });
    });
}

function processExtracto(g, code, allData, numeroAsiento) {
    g.items.forEach(item => {
        const descripcion = item['Descripción'] || item.Leyenda || '';
        const fecha = item.Fecha || '';

        let debitoVal = 0, creditoVal = 0;

        if (item['Débito'] !== undefined && item['Débito'] !== null && item['Débito'] !== '') {
            debitoVal = typeof item['Débito'] === 'number' ? item['Débito'] : parseFloat(String(item['Débito']).replace(/\./g, '').replace(',', '.')) || 0;
        }

        if (item['Crédito'] !== undefined && item['Crédito'] !== null && item['Crédito'] !== '') {
            creditoVal = typeof item['Crédito'] === 'number' ? item['Crédito'] : parseFloat(String(item['Crédito']).replace(/\./g, '').replace(',', '.')) || 0;
        }

        const leyenda = `EXTRACTO - ${descripcion}`;

        if (debitoVal > 0) {
            const debe1 = parseFloat(debitoVal.toFixed(2));
            const haber1 = 0;
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: code,
                Debe: debe1, Haber: haber1,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((debe1 - haber1).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            const debe2 = 0;
            const haber2 = parseFloat(debitoVal.toFixed(2));
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: state.bankAccount,
                Debe: debe2, Haber: haber2,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((debe2 - haber2).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            numeroAsiento++;
        }

        if (creditoVal > 0) {
            const debe3 = parseFloat(creditoVal.toFixed(2));
            const haber3 = 0;
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: state.bankAccount,
                Debe: debe3, Haber: haber3,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((debe3 - haber3).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            const debe4 = 0;
            const haber4 = parseFloat(creditoVal.toFixed(2));
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: code,
                Debe: debe4, Haber: haber4,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((debe4 - haber4).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            numeroAsiento++;
        }
    });

    return numeroAsiento;
}

function postProcessCompensaciones(allData) {
    const transacciones = {};
    allData.forEach(asiento => {
        const trans = asiento._transaccion;
        if (!transacciones[trans]) {
            transacciones[trans] = [];
        }
        transacciones[trans].push(asiento);
    });

    allData.length = 0;
    let nuevoNumero = 1;
    Object.keys(transacciones).sort((a, b) => parseInt(a) - parseInt(b)).forEach(trans => {
        transacciones[trans].forEach(asiento => {
            asiento.Numero = nuevoNumero;
            delete asiento._transaccion;
            allData.push(asiento);
        });
        nuevoNumero++;
    });
}

// ============================================
// VISTA PREVIA Y DESCARGA
// ============================================
function renderPreview() {
    elements.finalStats.textContent = `${state.finalData.length} líneas de asientos`;

    const preview = state.finalData.slice(0, 30);
    const html = preview.map((r, i) => `
        <tr>
            <td>${r.Fecha}</td>
            <td class="numero-col">${r.Numero}</td>
            <td class="cuenta-col">${r.Cuenta}</td>
            <td class="text-right debe-col">${r.Debe > 0 ? r.Debe.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="text-right haber-col">${r.Haber > 0 ? r.Haber.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="leyenda-col">${r.Leyenda}</td>
        </tr>
    `).join('');

    elements.previewTableBody.innerHTML = html;
}

function downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(state.finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asientos');
    const fileName = `asientos_${state.sourceType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
