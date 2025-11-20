// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
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

function getSelectedClientId() {
    // Leer desde el objeto cliente_activo (guardado por plan-cuentas.js)
    try {
        const clienteActivoStr = localStorage.getItem('cliente_activo');
        if (!clienteActivoStr) {
            console.log('🔍 No hay cliente_activo en localStorage');
            return null;
        }

        const clienteActivo = JSON.parse(clienteActivoStr);
        console.log('🔍 Cliente activo encontrado:', clienteActivo);
        return clienteActivo.id;
    } catch (error) {
        console.error('❌ Error leyendo cliente activo:', error);
        return null;
    }
}

function getTaxDatabase() {
    return TaxManager.getAllTaxes();
}

// ============================================
// ELEMENTOS DEL DOM
// ============================================
let elements = {};
let planCuentas = [];

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
function initializeElements() {
    elements = {
        // Steps
        step0: document.getElementById('step0'),
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        step3: document.getElementById('step3'),

        // Header
        subtitle: document.getElementById('subtitle'),
        clientName: document.getElementById('clientName'),
        btnReset: document.getElementById('btnReset'),

        // Step 0 - Client warning and template
        noClientWarning: document.getElementById('noClientWarning'),
        templateDownloadSection: document.getElementById('templateDownloadSection'),
        btnDownloadTemplate: document.getElementById('btnDownloadTemplate'),

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

    // Log de elementos no encontrados para debugging
    Object.keys(elements).forEach(key => {
        if (!elements[key]) {
            console.warn(`Elemento no encontrado: ${key}`);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== INICIANDO APLICACIÓN ===');

    // Inicializar elementos del DOM
    initializeElements();

    // Cargar datos - usando sistema centralizado
    console.log('Usando sistema centralizado de datos compartidos');

    await updateClientName();
    await checkClientAndLoadPlanCuentas();

    // Adjuntar event listeners
    attachEventListeners();

    // Log de diagnóstico
    const selectedClientId = getSelectedClientId();
    if (selectedClientId) {
        console.log('Cliente activo ID:', selectedClientId);
        console.log('Plan de cuentas cargado:', planCuentas.length, 'cuentas');
    } else {
        console.log('No hay cliente seleccionado');
    }

    console.log(`Base de impuestos: ${getTaxDatabase().length} registros`);
    console.log('======================');
});

function attachEventListeners() {
    // Header
    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', () => reset());
    }

    // Step 0: Template download
    if (elements.btnDownloadTemplate) {
        elements.btnDownloadTemplate.addEventListener('click', () => downloadTemplate());
    }

    // Step 0: Source type selection
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectSourceType(btn.dataset.type));
    });

    // Step 1: File upload
    if (elements.btnSelectFile) {
        elements.btnSelectFile.addEventListener('click', () => elements.fileInput.click());
    }
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', handleFileUpload);
    }

    // Step 2: Account assignment
    if (elements.bankAccountInput) {
        elements.bankAccountInput.addEventListener('click', () => {
            const selectedClientId = getSelectedClientId();
            if (selectedClientId) {
                state.activeSearchField = 'bank';
                showAccountDropdown('bank');
            }
        });
    }
    if (elements.btnBackToUpload) {
        elements.btnBackToUpload.addEventListener('click', () => goToStep(1));
    }
    if (elements.btnGenerateFinal) {
        elements.btnGenerateFinal.addEventListener('click', () => generateFinalExcel());
    }

    // Step 3: Download
    if (elements.btnBackToAssignment) {
        elements.btnBackToAssignment.addEventListener('click', () => goToStep(2));
    }
    if (elements.btnDownloadExcel) {
        elements.btnDownloadExcel.addEventListener('click', () => downloadExcel());
    }

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
// FUNCIONES AUXILIARES PARA LA HERRAMIENTA
// ============================================
async function updateClientName() {
    console.log('🔍 VERIFICANDO CLIENTE ACTIVO EN CONVERSOR...');

    const selectedClientId = getSelectedClientId();

    if (selectedClientId) {
        // Usar window.obtenerClienteActivo() si está disponible
        if (typeof window.obtenerClienteActivo === 'function') {
            const cliente = window.obtenerClienteActivo();
            if (cliente) {
                elements.clientName.textContent = `Cliente: ${cliente.razon_social}`;
                console.log('✅ Cliente detectado correctamente:', {
                    id: selectedClientId,
                    nombre: cliente.razon_social
                });
            } else {
                elements.clientName.textContent = '';
                console.log('⚠️ No se pudo obtener información del cliente');
            }
        } else {
            elements.clientName.textContent = 'Cliente ID: ' + selectedClientId;
            console.log('⚠️ Función obtenerClienteActivo no disponible');
        }
    } else {
        elements.clientName.textContent = '';
        console.log('❌ NO HAY CLIENTE SELECCIONADO - Debe seleccionar un cliente desde el menú principal');
    }
}

async function checkClientAndLoadPlanCuentas() {
    console.log('🔍 VERIFICANDO CLIENTE Y CARGANDO PLAN DE CUENTAS...');

    const clienteActivo = window.obtenerClienteActivo ? window.obtenerClienteActivo() : null;

    console.log('  Cliente activo:', clienteActivo);

    if (!clienteActivo || !clienteActivo.id) {
        // No hay cliente activo - mostrar advertencia
        if (elements.noClientWarning) {
            elements.noClientWarning.classList.remove('hidden');
        }
        // Deshabilitar botones de selección de tipo
        document.querySelectorAll('.source-type-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
        console.warn('❌ NO HAY CLIENTE ACTIVO SELECCIONADO');
        console.warn('   Por favor, seleccione un cliente desde el menú principal (👥 Clientes)');
        return;
    }

    console.log('✅ Cliente activo detectado:', {
        id: clienteActivo.id,
        razon_social: clienteActivo.razon_social
    });

    // Hay cliente activo - ocultar advertencia
    if (elements.noClientWarning) {
        elements.noClientWarning.classList.add('hidden');
    }

    // Cargar plan de cuentas
    try {
        if (typeof window.obtenerPlanCuentas === 'function') {
            console.log('📊 Cargando plan de cuentas...');
            planCuentas = await window.obtenerPlanCuentas(clienteActivo.id);

            if (!planCuentas || planCuentas.length === 0) {
                console.warn('⚠️ El cliente no tiene plan de cuentas configurado');
                alert('Este cliente no tiene plan de cuentas configurado.\n\nPor favor, configure el plan de cuentas antes de usar el conversor.');
            } else {
                console.log('✅ Plan de cuentas cargado exitosamente:', planCuentas.length, 'cuentas');
            }
        } else {
            console.error('❌ Función obtenerPlanCuentas no disponible');
        }
    } catch (error) {
        console.error('❌ Error cargando plan de cuentas:', error);
        alert('Error al cargar el plan de cuentas del cliente');
    }
}

async function getClientAccounts() {
    return planCuentas.map(cuenta => ({
        code: cuenta.codigo,
        description: cuenta.cuenta
    }));
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
async function showAccountDropdown(fieldId) {
    closeAllDropdowns();

    const accounts = await getClientAccounts();
    if (accounts.length === 0) {
        alert('El cliente no tiene plan de cuentas configurado.\n\nPor favor, configure el plan de cuentas antes de continuar.');
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
// DESCARGA DE PLANTILLA EXCEL
// ============================================
function downloadTemplate() {
    // Crear workbook
    const wb = XLSX.utils.book_new();

    // ========== HOJA 1: DATOS ==========
    const datosEjemplo = [
        ['fecha', 'descripcion', 'debe', 'haber'],
        ['2025-01-15', 'Pago proveedor', 10000, 0],
        ['2025-01-15', 'Banco cuenta corriente', 0, 10000],
        ['2025-01-20', 'Venta producto', 0, 5000],
        ['2025-01-20', 'Caja', 5000, 0],
        ['2025-01-25', 'Compra mercadería', 15000, 0],
        ['2025-01-25', 'Proveedores', 0, 15000],
        ['2025-01-28', 'Cobro de cliente', 0, 8000],
        ['2025-01-28', 'Banco cuenta corriente', 8000, 0]
    ];

    const wsDatos = XLSX.utils.aoa_to_sheet(datosEjemplo);

    // Configurar anchos de columna
    wsDatos['!cols'] = [
        { wch: 12 },  // fecha
        { wch: 30 },  // descripcion
        { wch: 12 },  // debe
        { wch: 12 }   // haber
    ];

    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');

    // ========== HOJA 2: INSTRUCCIONES ==========
    const instrucciones = [
        ['INSTRUCCIONES DE USO DE LA PLANTILLA'],
        [''],
        ['1. Complete la columna "fecha" en formato YYYY-MM-DD (ejemplo: 2025-01-15)'],
        [''],
        ['2. Complete la columna "descripcion" con el detalle del movimiento'],
        [''],
        ['3. La columna "debe" es para débitos (cargos/entradas)'],
        ['   - Ingrese el importe numérico sin símbolos'],
        ['   - Si el movimiento no tiene débito, deje en 0'],
        [''],
        ['4. La columna "haber" es para créditos (abonos/salidas)'],
        ['   - Ingrese el importe numérico sin símbolos'],
        ['   - Si el movimiento no tiene crédito, deje en 0'],
        [''],
        ['5. IMPORTANTE: Cada movimiento debe tener DEBE o HABER (no ambos simultáneamente)'],
        [''],
        ['6. Los asientos deben estar balanceados:'],
        ['   - Por cada debe, debe haber un haber de igual importe'],
        ['   - O viceversa'],
        [''],
        ['7. Una vez completada la plantilla:'],
        ['   - Guarde el archivo en formato Excel (.xlsx)'],
        ['   - Súbalo al conversor de asientos contables'],
        ['   - El sistema agrupará automáticamente los movimientos similares'],
        [''],
        ['8. Tipos de archivo que puede procesar el conversor:'],
        ['   - Extractos Bancarios'],
        ['   - Registros del Cliente'],
        ['   - VEPs de ARCA'],
        ['   - Compensaciones de ARCA'],
        [''],
        ['Para más información, consulte la documentación del sistema.']
    ];

    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);

    // Configurar ancho de columna para instrucciones
    wsInstrucciones['!cols'] = [{ wch: 80 }];

    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

    // Descargar archivo
    const fileName = 'plantilla_extracto_bancario.xlsx';
    XLSX.writeFile(wb, fileName);

    console.log('✅ Plantilla descargada:', fileName);
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
