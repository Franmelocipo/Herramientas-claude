// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
const state = {
    step: 0,
    sourceType: '',
    sourceData: [],
    groupedData: [],
    accountCodes: {},       // Una cuenta por grupo
    finalData: [],
    bankAccount: '',        // Cuenta de contrapartida global (banco/caja)
    activeSearchField: null,
    expandedGroups: {},     // Rastrear qué grupos están expandidos
    selectedItems: {}       // Rastrear items seleccionados para reagrupación {groupIdx: {itemIdx: true/false}}
};

// ============================================
// HELPERS PARA COMPATIBILIDAD CON CÓDIGO EXISTENTE
// ============================================

// Cliente seleccionado en este módulo
let clienteSeleccionadoId = null;
let clienteSeleccionadoNombre = '';

function getSelectedClientId() {
    return clienteSeleccionadoId;
}

function getTaxDatabase() {
    return TaxManager.getAllTaxes();
}

// ============================================
// FUNCIÓN CENTRALIZADA PARA PARSEAR IMPORTES
// ============================================
/**
 * Parsea un importe en formato argentino a número
 * Entrada: "393,75" → Salida: 393.75
 * Entrada: "3.933,75" → Salida: 3933.75
 * Entrada: "$1.234.567,89" → Salida: 1234567.89
 */
function parseAmount(value) {
    if (value === undefined || value === null || value === '' || value === '-') {
        return 0;
    }

    // Si ya es un número, retornarlo directamente
    if (typeof value === 'number') {
        return value;
    }

    // Convertir a string y limpiar
    let str = String(value).trim();

    // Remover símbolo de pesos
    str = str.replace('$', '').trim();

    // Si está vacío después de limpiar, retornar 0
    if (str === '' || str === '-') {
        return 0;
    }

    // Formato argentino: punto como separador de miles, coma como decimal
    // 1. Eliminar todos los puntos (separadores de miles)
    // 2. Reemplazar coma por punto (decimal)
    str = str.replace(/\./g, '').replace(',', '.');

    const result = parseFloat(str);
    return isNaN(result) ? 0 : result;
}

// ============================================
// FUNCIONES PARA SELECTOR DE CLIENTE
// ============================================

// Variable para almacenar todos los clientes
let todosLosClientes = [];

async function cargarClientesEnSelector() {
    const select = document.getElementById('selector-cliente-conversor');
    const inputBuscar = document.getElementById('buscar-cliente');
    if (!select) return;

    try {
        // Obtener clientes desde Supabase
        const { data: clientes, error } = await supabase
            .from('clientes')
            .select('id, razon_social')
            .order('razon_social');

        if (error) {
            console.error('Error cargando clientes:', error);
            return;
        }

        // Guardar todos los clientes
        todosLosClientes = clientes;

        // Renderizar opciones
        renderizarOpcionesClientes(clientes);

        console.log('✅ Clientes cargados en selector:', clientes.length);

        // Evento de búsqueda
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                const busqueda = e.target.value.toLowerCase();
                const clientesFiltrados = todosLosClientes.filter(cliente =>
                    cliente.razon_social.toLowerCase().includes(busqueda)
                );
                renderizarOpcionesClientes(clientesFiltrados);
            });
        }

        // Evento al cambiar selección
        select.addEventListener('change', async (e) => {
            const clienteId = e.target.value;
            if (clienteId) {
                const clienteNombre = select.options[select.selectedIndex].text;
                clienteSeleccionadoId = clienteId;
                clienteSeleccionadoNombre = clienteNombre;

                console.log('Cliente seleccionado:', clienteId, clienteNombre);

                // Actualizar nombre en el header
                if (elements.clientName) {
                    elements.clientName.textContent = `Cliente: ${clienteNombre}`;
                }

                await cargarPlanCuentasCliente(clienteId);
            } else {
                clienteSeleccionadoId = null;
                clienteSeleccionadoNombre = '';
                if (elements.clientName) {
                    elements.clientName.textContent = '';
                }
                deshabilitarOpciones();
                ocultarInfoPlan();
            }
        });

    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
    }
}

function renderizarOpcionesClientes(clientes) {
    const select = document.getElementById('selector-cliente-conversor');
    if (!select) return;

    // Limpiar opciones existentes
    select.innerHTML = '';

    if (clientes.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- No se encontraron clientes --';
        select.appendChild(option);
        return;
    }

    // Llenar el select
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.razon_social;
        select.appendChild(option);
    });
}

async function cargarPlanCuentasCliente(clienteId) {
    const infoElement = document.getElementById('clientePlanInfo');

    try {
        const { data: cuentas, error } = await supabase
            .from('plan_cuentas')
            .select('codigo, cuenta')
            .eq('cliente_id', clienteId)
            .order('codigo');

        if (error) {
            console.error('Error cargando plan:', error);
            mostrarInfoPlan('Error al cargar el plan de cuentas', 'error');
            deshabilitarOpciones();
            return;
        }

        if (!cuentas || cuentas.length === 0) {
            mostrarInfoPlan('⚠️ Este cliente no tiene plan de cuentas. Configure el plan primero.', 'error');
            deshabilitarOpciones();
            planCuentas = [];
            return;
        }

        // Guardar las cuentas para usar en los selectores
        planCuentas = cuentas.map(c => ({
            codigo: c.codigo,
            cuenta: c.cuenta
        }));

        mostrarInfoPlan(`✅ Plan de cuentas cargado: ${cuentas.length} cuentas`, 'success');
        console.log('Plan de cuentas cargado:', cuentas.length, 'cuentas');

        habilitarOpciones();

    } catch (error) {
        console.error('❌ Error cargando plan de cuentas:', error);
        mostrarInfoPlan('Error al cargar el plan de cuentas', 'error');
        deshabilitarOpciones();
    }
}

function mostrarInfoPlan(mensaje, tipo) {
    const infoElement = document.getElementById('clientePlanInfo');
    if (infoElement) {
        infoElement.textContent = mensaje;
        infoElement.className = 'cliente-plan-info ' + tipo;
        infoElement.classList.remove('hidden');
    }
}

function ocultarInfoPlan() {
    const infoElement = document.getElementById('clientePlanInfo');
    if (infoElement) {
        infoElement.classList.add('hidden');
    }
}

function deshabilitarOpciones() {
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });
}

function habilitarOpciones() {
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
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
    compensaciones: { name: 'Compensaciones ARCA', icon: '🔄' },
    tabla: { name: 'Tabla de Datos', icon: '📊' },
    soscontador: { name: 'Libro Diario SOS Contador', icon: '📒' }
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

        // Step 1
        sourceTypeName: document.getElementById('sourceTypeName'),
        fileInput: document.getElementById('fileInput'),
        btnSelectFile: document.getElementById('btnSelectFile'),
        btnDownloadTemplateSpecific: document.getElementById('btnDownloadTemplateSpecific'),
        templateButtonText: document.getElementById('templateButtonText'),

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

    // Cargar clientes en el selector
    await cargarClientesEnSelector();

    // Deshabilitar opciones hasta que seleccionen cliente
    deshabilitarOpciones();

    // Adjuntar event listeners
    attachEventListeners();

    console.log(`Base de impuestos: ${getTaxDatabase().length} registros`);
    console.log('======================');
});

function attachEventListeners() {
    // Header
    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', () => reset());
    }

    // Step 0: Source type selection
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectSourceType(btn.dataset.type));
    });

    // Step 1: Template download specific
    if (elements.btnDownloadTemplateSpecific) {
        elements.btnDownloadTemplateSpecific.addEventListener('click', () => downloadTemplateSpecific());
    }

    // Step 1: File upload
    if (elements.btnSelectFile) {
        elements.btnSelectFile.addEventListener('click', () => elements.fileInput.click());
    }
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', handleFileUpload);
    }

    // Step 2: Account assignment
    if (elements.bankAccountInput) {
        elements.bankAccountInput.addEventListener('focus', () => {
            const selectedClientId = getSelectedClientId();
            if (selectedClientId) {
                state.activeSearchField = 'bank';
                showAccountDropdown('bank');
            }
        });
        elements.bankAccountInput.addEventListener('input', () => {
            const selectedClientId = getSelectedClientId();
            if (selectedClientId) {
                handleAccountInputChange('bank');
            }
        });
        elements.bankAccountInput.addEventListener('keydown', (e) => {
            handleAccountInputKeydown(e, 'bank');
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

    // Actualizar texto del botón de plantilla según el tipo
    const templateNames = {
        extracto: 'Descargar Plantilla Extracto',
        registros: 'Descargar Plantilla Registros',
        veps: 'Descargar Plantilla VEPs',
        compensaciones: 'Descargar Plantilla Compensaciones',
        tabla: 'Descargar Plantilla Tabla de Datos',
        soscontador: 'Descargar Plantilla SOS Contador'
    };

    if (elements.templateButtonText) {
        elements.templateButtonText.textContent = templateNames[type] || 'Descargar Plantilla';
    }

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
        } else if (state.sourceType === 'soscontador') {
            // SOS Contador tiene estructura especial - parsear desde fila 7
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
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

        // Validar datos si es tipo tabla
        if (state.sourceType === 'tabla') {
            const validationErrors = validateTablaData(rows);
            if (validationErrors.length > 0) {
                const maxErrors = 10;
                let errorMsg = `Se encontraron ${validationErrors.length} error(es) en el archivo:\n\n`;
                errorMsg += validationErrors.slice(0, maxErrors).join('\n');
                if (validationErrors.length > maxErrors) {
                    errorMsg += `\n\n... y ${validationErrors.length - maxErrors} error(es) más.`;
                }
                errorMsg += '\n\nPor favor, corrija los errores y vuelva a cargar el archivo.';
                alert(errorMsg);
                return;
            }
        }

        // Caso especial: SOS Contador tiene estructura jerárquica
        if (state.sourceType === 'soscontador') {
            const parsedData = parseSOSContador(jsonData);
            if (parsedData.length === 0) {
                alert('No se encontraron asientos válidos en el archivo.\nVerifique que el archivo tenga el formato correcto de SOS Contador.');
                return;
            }
            state.sourceData = parsedData;
            state.finalData = parsedData;
            goToStep(3); // Saltar directo a descarga (no requiere asignación)
            return;
        }

        state.sourceData = rows;
        groupSimilarEntries(rows);
        goToStep(2);

    } catch (error) {
        alert('Error al leer el archivo: ' + error.message);
    }
}

// ============================================
// PARSEO ESPECIAL PARA SOS CONTADOR
// ============================================
function parseSOSContador(jsonData) {
    const result = [];
    let currentFecha = '';
    let currentDescripcion = '';
    let numeroAsiento = 1;

    // Ignorar las primeras 7 filas (encabezados del libro)
    // Fila 7 (índice 6) tiene los headers: Asiento, Descripcion - Cuenta, NaN, Monto Debe, Monto Haber, Monto Saldo

    for (let i = 7; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const colA = String(row[0] || '').trim();
        const colB = String(row[1] || '').trim();
        const colC = String(row[2] || '').trim();
        const colD = row[3]; // Monto Debe
        const colE = row[4]; // Monto Haber

        // Detectar encabezado de asiento: "Asiento Nro. X - Fecha DD/MM/YYYY - COMPROBANTE"
        if (colA.includes('Asiento Nro.') || colA.includes('Asiento Nro')) {
            // Extraer fecha del encabezado
            const fechaMatch = colA.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
            if (fechaMatch) {
                currentFecha = fechaMatch[1];
            }
            numeroAsiento++;
            continue;
        }

        // Detectar línea de descripción (tiene texto en columna B pero no en C, D, E)
        if (colB && !colC && (colD === undefined || colD === null || colD === '') && (colE === undefined || colE === null || colE === '')) {
            // Extraer descripción: "Operación según comprobante - PROVEEDOR"
            currentDescripcion = colB;
            continue;
        }

        // Procesar línea de movimiento (tiene código de cuenta en columna C)
        if (colC && colC.includes(' - ')) {
            // Extraer código de cuenta (antes del " - ")
            const partes = colC.split(' - ');
            const codigoCuenta = partes[0].trim();

            // Obtener montos
            let debe = 0, haber = 0;

            debe = parseAmount(colD);
            haber = parseAmount(colE);

            // Solo agregar si tiene algún monto
            if (debe > 0 || haber > 0) {
                result.push({
                    Fecha: currentFecha,
                    Numero: numeroAsiento - 1,
                    Cuenta: codigoCuenta,
                    Debe: parseFloat(debe.toFixed(2)),
                    Haber: parseFloat(haber.toFixed(2)),
                    'Tipo de auxiliar': 1,
                    Auxiliar: 1,
                    Importe: parseFloat((debe - haber).toFixed(2)),
                    Leyenda: currentDescripcion,
                    ExtraContable: 's'
                });
            }
        }
    }

    return result;
}

// ============================================
// VALIDACIÓN DE DATOS PARA TABLA
// ============================================
function validateTablaData(rows) {
    const errors = [];

    rows.forEach((row, idx) => {
        const rowNum = idx + 2; // +2 porque idx empieza en 0 y hay encabezado

        // Validar fecha
        const fecha = row['FECHA'] || row['Fecha'] || row['fecha'];
        if (!fecha) {
            errors.push(`Fila ${rowNum}: FECHA está vacía`);
        } else {
            // Intentar parsear la fecha
            const fechaStr = String(fecha);
            const isValidDate = !isNaN(Date.parse(fechaStr)) ||
                               /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaStr) ||
                               /^\d{4}-\d{2}-\d{2}$/.test(fechaStr);
            if (!isValidDate && typeof fecha !== 'number') {
                errors.push(`Fila ${rowNum}: FECHA inválida (${fecha})`);
            }
        }

        // Validar descripción
        const descripcion = row['DESCRIPCION'] || row['Descripcion'] || row['descripcion'];
        if (!descripcion || String(descripcion).trim() === '') {
            errors.push(`Fila ${rowNum}: DESCRIPCION está vacía`);
        }

        // Validar importe
        const importeRaw = row['IMPORTE'] || row['Importe'] || row['importe'];
        if (importeRaw === undefined || importeRaw === null || importeRaw === '') {
            errors.push(`Fila ${rowNum}: IMPORTE está vacío`);
        } else {
            const importe = parseAmount(importeRaw);
            if (importe === 0) {
                errors.push(`Fila ${rowNum}: IMPORTE no es un número válido o es cero (${importeRaw})`);
            }
        }
    });

    return errors;
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

            const importe = parseAmount(row['Importe']);

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

            const importe = parseAmount(row['IMPORTE']);

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

            const debeVal = parseAmount(row['DEBE']);
            const haberVal = parseAmount(row['HABER']);

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

    } else if (state.sourceType === 'tabla') {
        // Tabla de Datos - formato simple con 3 columnas
        data.forEach((row) => {
            const descripcion = String(row['DESCRIPCION'] || row['Descripcion'] || row['descripcion'] || '').trim();
            if (!descripcion) return;

            // Obtener importe (puede ser positivo o negativo)
            const importeRaw = row['IMPORTE'] || row['Importe'] || row['importe'];
            const importe = parseAmount(importeRaw);

            // Determinar si va al debe o haber según el signo
            let debeVal = 0, haberVal = 0;
            if (importe < 0) {
                // Negativo → HABER (valor absoluto)
                haberVal = Math.abs(importe);
            } else {
                // Positivo → DEBE
                debeVal = importe;
            }

            const key = descripcion;

            if (!groups[key]) {
                groups[key] = {
                    concepto: descripcion,
                    ejemploCompleto: descripcion,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: []
                };
            }

            groups[key].count++;
            groups[key].totalDebe += debeVal;
            groups[key].totalHaber += haberVal;
            groups[key].items.push({
                ...row,
                _calculatedDebe: debeVal,
                _calculatedHaber: haberVal
            });
        });

    } else {
        // Extractos bancarios - NUEVA LÓGICA: Agrupación más específica
        // En lugar de agrupar por categorías amplias, agrupamos por descripción exacta
        // o por palabras clave específicas que comparten la misma cuenta contable

        const specificPatterns = [
            // Grupos específicos de impuestos (cada uno va a cuenta diferente)
            { key: 'DEBITO IVA', keywords: ['DEBITO IVA'], exact: true },
            { key: 'COBRO IIBB - SIRCREB', keywords: ['SIRCREB', 'COBRO IIBB', 'ING. BRUTOS'], exact: false },

            // Comisiones bancarias (pueden compartir cuenta)
            { key: 'COMISIONES BANCARIAS', keywords: ['COM.ADM.DESC', 'COMIS.AUT.MANT', 'COMISION'], exact: false },

            // Transferencias
            { key: 'TRANSFERENCIAS RECIBIDAS', keywords: ['TRANSFER', 'TRANSF', 'ACREDITAMIENTO', 'ACREDIT'], exact: false },

            // Cheques
            { key: 'CHEQUES DEPOSITADOS', keywords: ['ECHEQ', 'CHEQUE', 'CHQ', 'CANJE'], exact: false },

            // Débitos automáticos
            { key: 'DEBITOS AUTOMATICOS', keywords: ['DEB AUT', 'DEBITO AUT'], exact: false },

            // Retenciones
            { key: 'RETENCIONES', keywords: ['RETENCION', 'RET.', 'PERCEPCION'], exact: false }
        ];

        data.forEach((row) => {
            const desc = String(row['Descripción'] || row.Leyenda || '').trim();
            const descUpper = desc.toUpperCase();
            if (!desc) return;

            const debitoVal = parseAmount(row['Débito']);
            const creditoVal = parseAmount(row['Crédito']);

            let matched = false;

            // Primero intentar con patrones específicos
            for (const pattern of specificPatterns) {
                const keywordMatch = pattern.keywords.some(kw => descUpper.includes(kw));

                if (keywordMatch) {
                    if (!groups[pattern.key]) {
                        groups[pattern.key] = {
                            concepto: pattern.key,
                            ejemploCompleto: desc,
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

            // Si no matchea con patrones específicos, agrupar por descripción exacta
            if (!matched) {
                // Normalizar la descripción: tomar las primeras 3-5 palabras significativas
                const palabras = descUpper.split(/\s+/).filter(p => p.length > 2).slice(0, 4);
                let key = palabras.join(' ');

                // Si es muy corto, usar descripción completa
                if (palabras.length === 0) {
                    key = descUpper.substring(0, 50);
                }

                if (!groups[key]) {
                    groups[key] = {
                        concepto: key,
                        ejemploCompleto: desc,
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

    // SIEMPRE mostrar la sección de cuenta de contrapartida (banco/caja)
    elements.bankAccountSection.classList.remove('hidden');
    elements.bankAccountLabel.textContent = 'Cuenta de CONTRAPARTIDA (banco/caja) para TODOS los movimientos';
    elements.bankAccountInput.placeholder = getSelectedClientId() ? '🔍 Buscar cuenta contrapartida...' : 'Ej: 11020101';
    elements.bankAccountInput.value = state.bankAccount;

    // Ocultar info de compensaciones (ya no aplica)
    elements.compensacionesInfo.classList.add('hidden');

    // Renderizar grupos
    const html = state.groupedData.map((g, idx) => {
        const classType = state.sourceType === 'compensaciones'
            ? (g.isOrigen ? 'origen' : 'destino')
            : '';

        const isExpanded = state.expandedGroups[idx] || false;
        const expandIcon = isExpanded ? '▼' : '▶';

        // Generar tabla de detalle de movimientos
        let detailsHtml = '';
        if (isExpanded && g.items && g.items.length > 0) {
            const headers = Object.keys(g.items[0]).filter(k => !k.startsWith('_'));

            // Inicializar selectedItems para este grupo si no existe
            if (!state.selectedItems[idx]) {
                state.selectedItems[idx] = {};
            }

            detailsHtml = `
                <div class="group-details">
                    <div class="group-details-table-container">
                        <table class="group-details-table">
                            <thead>
                                <tr>
                                    <th style="width: 30px;">
                                        <input type="checkbox"
                                               id="selectAll-${idx}"
                                               onchange="toggleSelectAll(${idx})"
                                               title="Seleccionar todos">
                                    </th>
                                    ${headers.map(h => `<th>${h}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${g.items.map((item, itemIdx) => `
                                    <tr>
                                        <td>
                                            <input type="checkbox"
                                                   class="item-checkbox"
                                                   data-group-idx="${idx}"
                                                   data-item-idx="${itemIdx}"
                                                   ${state.selectedItems[idx][itemIdx] ? 'checked' : ''}
                                                   onchange="toggleItemSelection(${idx}, ${itemIdx})">
                                        </td>
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
                    <div class="group-actions">
                        <button class="btn-move-items" onclick="openMoveToGroupModal(${idx})" title="Mover seleccionados a otro grupo">
                            📦 Mover seleccionados
                        </button>
                        <button class="btn-create-group" onclick="openCreateGroupModal(${idx})" title="Crear nuevo grupo con seleccionados">
                            ➕ Nuevo grupo
                        </button>
                        <span class="selected-count" id="selected-count-${idx}">0 seleccionados</span>
                    </div>
                </div>
            `;
        }

        // UN solo campo de cuenta por grupo (nueva lógica simplificada)
        const totalMovimientos = Math.abs(g.totalDebe - g.totalHaber);
        const accountFieldsHtml = `
            <div class="group-account-single">
                <div class="account-field">
                    <label class="account-label">Cuenta para: ${g.concepto.substring(0, 30)}${g.concepto.length > 30 ? '...' : ''}</label>
                    <div class="account-totals">$${totalMovimientos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    <div class="input-with-dropdown">
                        <input
                            type="text"
                            class="input-text"
                            data-group-idx="${idx}"
                            value="${state.accountCodes[idx] || ''}"
                            placeholder="${getSelectedClientId() ? '🔍 Buscar cuenta...' : 'Código'}"
                        >
                        <div class="account-dropdown hidden" id="dropdown-${idx}"></div>
                    </div>
                </div>
            </div>
        `;

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
                            ${g.count} mov | Debe: $${g.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | Haber: $${g.totalHaber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    ${accountFieldsHtml}
                </div>
                ${detailsHtml}
            </div>
        `;
    }).join('');

    elements.groupsList.innerHTML = html;

    // Attach event listeners to account inputs (un solo campo por grupo)
    document.querySelectorAll('.group-account-single input[data-group-idx]').forEach(input => {
        const idx = parseInt(input.dataset.groupIdx);

        // Filtrado en tiempo real
        input.addEventListener('input', (e) => {
            if (getSelectedClientId()) {
                handleAccountInputChange(idx);
            }
        });

        // Mostrar dropdown al enfocar
        input.addEventListener('focus', () => {
            if (getSelectedClientId()) {
                state.activeSearchField = idx;
                showAccountDropdown(idx);
            }
        });

        // Navegación por teclado
        input.addEventListener('keydown', (e) => {
            handleAccountInputKeydown(e, idx);
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
// SELECCIÓN Y REAGRUPACIÓN DE ITEMS
// ============================================
function toggleItemSelection(groupIdx, itemIdx) {
    if (!state.selectedItems[groupIdx]) {
        state.selectedItems[groupIdx] = {};
    }
    state.selectedItems[groupIdx][itemIdx] = !state.selectedItems[groupIdx][itemIdx];
    updateSelectedCount(groupIdx);
}

function toggleSelectAll(groupIdx) {
    const checkbox = document.getElementById(`selectAll-${groupIdx}`);
    const isChecked = checkbox.checked;

    if (!state.selectedItems[groupIdx]) {
        state.selectedItems[groupIdx] = {};
    }

    // Seleccionar o deseleccionar todos los items del grupo
    const group = state.groupedData[groupIdx];
    if (group && group.items) {
        group.items.forEach((_, itemIdx) => {
            state.selectedItems[groupIdx][itemIdx] = isChecked;
        });
    }

    // Re-renderizar para actualizar checkboxes
    renderGroupsList();
}

function updateSelectedCount(groupIdx) {
    const countEl = document.getElementById(`selected-count-${groupIdx}`);
    if (countEl) {
        const count = Object.values(state.selectedItems[groupIdx] || {}).filter(v => v).length;
        countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
    }
}

function openMoveToGroupModal(sourceGroupIdx) {
    const selectedItems = getSelectedItems(sourceGroupIdx);
    if (selectedItems.length === 0) {
        alert('Por favor, selecciona al menos un movimiento para mover.');
        return;
    }

    // Crear modal con lista de grupos disponibles
    const otherGroups = state.groupedData
        .map((g, idx) => ({ ...g, idx }))
        .filter(g => g.idx !== sourceGroupIdx);

    if (otherGroups.length === 0) {
        alert('No hay otros grupos disponibles. Primero crea un nuevo grupo.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content-sm">
            <div class="modal-header">
                <h2>Mover a grupo</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <p style="color: #64748b; margin-bottom: 16px;">
                Mover ${selectedItems.length} movimiento${selectedItems.length > 1 ? 's' : ''} a:
            </p>
            <div style="max-height: 400px; overflow-y: auto;">
                ${otherGroups.map(g => `
                    <div class="group-option" onclick="moveItemsToGroup(${sourceGroupIdx}, ${g.idx}); this.closest('.modal').remove();"
                         style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#6366f1';"
                         onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0';">
                        <div style="font-weight: 600; color: #1e293b;">${g.concepto}</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                            ${g.count} mov | $${g.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openCreateGroupModal(sourceGroupIdx) {
    const selectedItems = getSelectedItems(sourceGroupIdx);
    if (selectedItems.length === 0) {
        alert('Por favor, selecciona al menos un movimiento para crear un grupo.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content-sm">
            <div class="modal-header">
                <h2>Crear nuevo grupo</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <p style="color: #64748b; margin-bottom: 16px;">
                Crear grupo con ${selectedItems.length} movimiento${selectedItems.length > 1 ? 's' : ''}:
            </p>
            <input type="text" id="newGroupName" placeholder="Nombre del nuevo grupo"
                   style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px;">
            <div style="display: flex; gap: 8px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn-primary flex-1" onclick="createNewGroup(${sourceGroupIdx}); this.closest('.modal').remove();">
                    Crear grupo
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Focus en el input
    setTimeout(() => {
        const input = document.getElementById('newGroupName');
        if (input) input.focus();
    }, 100);
}

function getSelectedItems(groupIdx) {
    const group = state.groupedData[groupIdx];
    if (!group || !group.items) return [];

    const selectedIndices = Object.entries(state.selectedItems[groupIdx] || {})
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx));

    return selectedIndices.map(idx => group.items[idx]).filter(Boolean);
}

function moveItemsToGroup(sourceGroupIdx, targetGroupIdx) {
    const selectedItems = getSelectedItems(sourceGroupIdx);
    if (selectedItems.length === 0) return;

    const sourceGroup = state.groupedData[sourceGroupIdx];
    const targetGroup = state.groupedData[targetGroupIdx];

    // Remover items del grupo origen
    const selectedIndices = Object.entries(state.selectedItems[sourceGroupIdx] || {})
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx))
        .sort((a, b) => b - a); // Ordenar de mayor a menor para remover correctamente

    selectedIndices.forEach(idx => {
        const item = sourceGroup.items[idx];
        sourceGroup.items.splice(idx, 1);

        // Agregar al grupo destino
        targetGroup.items.push(item);

        // Actualizar totales
        const debe = parseAmount(item['Débito'] || item['DEBE'] || 0);
        const haber = parseAmount(item['Crédito'] || item['HABER'] || item['Haber'] || 0);

        sourceGroup.totalDebe -= debe;
        sourceGroup.totalHaber -= haber;
        sourceGroup.count--;

        targetGroup.totalDebe += debe;
        targetGroup.totalHaber += haber;
        targetGroup.count++;
    });

    // Limpiar selección
    state.selectedItems[sourceGroupIdx] = {};

    // Re-renderizar
    renderGroupsList();

    alert(`${selectedItems.length} movimiento${selectedItems.length > 1 ? 's movidos' : ' movido'} a "${targetGroup.concepto}"`);
}

function createNewGroup(sourceGroupIdx) {
    const newGroupName = document.getElementById('newGroupName')?.value.trim();
    if (!newGroupName) {
        alert('Por favor, ingresa un nombre para el nuevo grupo.');
        return;
    }

    const selectedItems = getSelectedItems(sourceGroupIdx);
    if (selectedItems.length === 0) return;

    const sourceGroup = state.groupedData[sourceGroupIdx];

    // Crear nuevo grupo
    const newGroup = {
        concepto: newGroupName,
        ejemploCompleto: selectedItems[0]['Descripción'] || selectedItems[0]['Leyenda'] || selectedItems[0]['CONCEPTO'] || newGroupName,
        count: selectedItems.length,
        totalDebe: 0,
        totalHaber: 0,
        items: []
    };

    // Remover items del grupo origen y agregarlos al nuevo grupo
    const selectedIndices = Object.entries(state.selectedItems[sourceGroupIdx] || {})
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx))
        .sort((a, b) => b - a);

    selectedIndices.forEach(idx => {
        const item = sourceGroup.items[idx];
        sourceGroup.items.splice(idx, 1);

        newGroup.items.push(item);

        const debe = parseAmount(item['Débito'] || item['DEBE'] || 0);
        const haber = parseAmount(item['Crédito'] || item['HABER'] || item['Haber'] || 0);

        sourceGroup.totalDebe -= debe;
        sourceGroup.totalHaber -= haber;
        sourceGroup.count--;

        newGroup.totalDebe += debe;
        newGroup.totalHaber += haber;
    });

    // Agregar nuevo grupo a la lista
    state.groupedData.push(newGroup);

    // Limpiar selección
    state.selectedItems[sourceGroupIdx] = {};

    // Re-renderizar
    renderGroupsList();

    alert(`Grupo "${newGroupName}" creado con ${selectedItems.length} movimiento${selectedItems.length > 1 ? 's' : ''}.`);
}

// ============================================
// DROPDOWN DE CUENTAS - SISTEMA UNIFICADO
// ============================================

// Estado para navegación con teclado
let dropdownState = {
    currentIndex: -1,
    accounts: [],
    fieldId: null
};

async function showAccountDropdown(fieldId) {
    closeAllDropdowns();

    const accounts = await getClientAccounts();
    if (accounts.length === 0) {
        alert('El cliente no tiene plan de cuentas configurado.\n\nPor favor, configure el plan de cuentas antes de continuar.');
        return;
    }

    dropdownState.accounts = accounts;
    dropdownState.fieldId = fieldId;
    dropdownState.currentIndex = -1;

    let dropdown;
    let inputElement;

    if (fieldId === 'bank') {
        dropdown = elements.bankAccountDropdown;
        inputElement = elements.bankAccountInput;
    } else {
        dropdown = document.getElementById(`dropdown-${fieldId}`);
        inputElement = document.querySelector(`input[data-group-idx="${fieldId}"]`);
    }

    if (!dropdown || !inputElement) return;

    // Filtrar cuentas basándose en el valor actual del input
    const query = inputElement.value.trim().toLowerCase();
    renderAccountResults(dropdown, accounts, query);

    dropdown.classList.remove('hidden');
}

function renderAccountResults(dropdown, accounts, query) {
    const filteredAccounts = query === ''
        ? accounts.slice(0, 30)
        : accounts.filter(a =>
            String(a.code || '').toLowerCase().includes(query) ||
            String(a.description || '').toLowerCase().includes(query)
        ).slice(0, 30);

    if (filteredAccounts.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-empty">No se encontraron resultados</div>';
        return;
    }

    const itemsHtml = filteredAccounts.map((acc, idx) => `
        <div class="dropdown-item ${idx === dropdownState.currentIndex ? 'activo' : ''}" data-code="${acc.code}" data-idx="${idx}">
            <div class="dropdown-item-code">${acc.code}</div>
            <div class="dropdown-item-desc">${acc.description}</div>
        </div>
    `).join('');

    dropdown.innerHTML = `<div class="dropdown-items">${itemsHtml}</div>`;

    // Item clicks
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            selectAccount(item.dataset.code);
        });
    });

    // Guardar cuentas filtradas para navegación
    dropdownState.filteredAccounts = filteredAccounts;
}

function selectAccount(code) {
    const acc = dropdownState.accounts.find(a => a.code === code);
    if (!acc) return;

    if (dropdownState.fieldId === 'bank') {
        state.bankAccount = acc.code;
        elements.bankAccountInput.value = `${acc.code} - ${acc.description}`;
    } else {
        // Guardar en el estado (una cuenta por grupo)
        state.accountCodes[dropdownState.fieldId] = acc.code;

        // Actualizar el input
        const input = document.querySelector(`input[data-group-idx="${dropdownState.fieldId}"]`);
        if (input) input.value = `${acc.code} - ${acc.description}`;
    }
    closeAllDropdowns();
}

function navegarDropdown(direccion) {
    if (!dropdownState.filteredAccounts || dropdownState.filteredAccounts.length === 0) return;

    const maxIndex = dropdownState.filteredAccounts.length - 1;

    if (direccion === 'down') {
        dropdownState.currentIndex = Math.min(dropdownState.currentIndex + 1, maxIndex);
    } else if (direccion === 'up') {
        dropdownState.currentIndex = Math.max(dropdownState.currentIndex - 1, 0);
    }

    // Actualizar visual
    document.querySelectorAll('.dropdown-item').forEach((item, idx) => {
        if (idx === dropdownState.currentIndex) {
            item.classList.add('activo');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('activo');
        }
    });
}

function seleccionarItemActivo() {
    if (dropdownState.currentIndex >= 0 && dropdownState.filteredAccounts) {
        const acc = dropdownState.filteredAccounts[dropdownState.currentIndex];
        if (acc) selectAccount(acc.code);
    }
}

function handleAccountInputKeydown(e, fieldId) {
    let dropdown;
    if (fieldId === 'bank') {
        dropdown = elements.bankAccountDropdown;
    } else {
        dropdown = document.getElementById(`dropdown-${fieldId}`);
    }

    if (!dropdown || dropdown.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            showAccountDropdown(fieldId);
        }
        return;
    }

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            navegarDropdown('down');
            break;
        case 'ArrowUp':
            e.preventDefault();
            navegarDropdown('up');
            break;
        case 'Enter':
            e.preventDefault();
            if (dropdownState.currentIndex >= 0) {
                seleccionarItemActivo();
            } else if (dropdownState.filteredAccounts && dropdownState.filteredAccounts.length > 0) {
                selectAccount(dropdownState.filteredAccounts[0].code);
            }
            break;
        case 'Escape':
            e.preventDefault();
            closeAllDropdowns();
            break;
    }
}

function handleAccountInputChange(fieldId) {
    let inputElement;
    let dropdown;

    if (fieldId === 'bank') {
        inputElement = elements.bankAccountInput;
        dropdown = elements.bankAccountDropdown;
    } else {
        inputElement = document.querySelector(`input[data-group-idx="${fieldId}"]`);
        dropdown = document.getElementById(`dropdown-${fieldId}`);
    }

    if (!inputElement || !dropdown) return;

    const query = inputElement.value.trim().toLowerCase();

    // Si el dropdown no está visible, mostrarlo
    if (dropdown.classList.contains('hidden')) {
        showAccountDropdown(fieldId);
    } else {
        // Actualizar resultados
        dropdownState.currentIndex = -1;
        renderAccountResults(dropdown, dropdownState.accounts, query);
    }
}

function closeAllDropdowns() {
    dropdownState.currentIndex = -1;
    dropdownState.fieldId = null;
    if (elements.bankAccountDropdown) {
        elements.bankAccountDropdown.classList.add('hidden');
    }
    document.querySelectorAll('.account-dropdown').forEach(d => d.classList.add('hidden'));
}

// ============================================
// GENERACIÓN DE ASIENTOS FINALES
// ============================================
function generateFinalExcel() {
    // Validaciones simplificadas (nueva lógica)
    const errors = [];

    // Validar cuenta de contrapartida global (obligatoria para todos)
    if (!state.bankAccount) {
        errors.push('Falta la cuenta de CONTRAPARTIDA (banco/caja)');
    }

    // Validar que cada grupo tenga su cuenta asignada
    state.groupedData.forEach((g, idx) => {
        const hasCuenta = state.accountCodes[idx];

        if (!hasCuenta) {
            errors.push(`Grupo "${g.concepto}": falta asignar la cuenta`);
        }

        // Validar que la cuenta del grupo no sea igual a la contrapartida
        if (hasCuenta && state.bankAccount && state.accountCodes[idx] === state.bankAccount) {
            errors.push(`Grupo "${g.concepto}": la cuenta no puede ser igual a la contrapartida`);
        }
    });

    if (errors.length > 0) {
        const maxErrors = 10;
        let errorMsg = `⚠️ Se encontraron ${errors.length} error(es):\n\n`;
        errorMsg += errors.slice(0, maxErrors).map(e => `• ${e}`).join('\n');
        if (errors.length > maxErrors) {
            errorMsg += `\n\n... y ${errors.length - maxErrors} error(es) más.`;
        }
        alert(errorMsg);
        return;
    }

    const allData = [];
    let numeroAsiento = 1;
    const contrapartida = state.bankAccount;

    // NUEVA LÓGICA UNIFICADA: procesar cada grupo con la misma lógica
    state.groupedData.forEach((g, idx) => {
        const cuentaGrupo = state.accountCodes[idx] || '';

        g.items.forEach(item => {
            // Obtener fecha y descripción según el tipo de fuente
            let fecha = '';
            let descripcion = '';
            let importe = 0;

            if (state.sourceType === 'extracto') {
                fecha = item.Fecha || '';
                descripcion = item['Descripción'] || item.Leyenda || '';
                // Extracto: Débito = negativo (sale), Crédito = positivo (entra)
                const debito = parseAmount(item['Débito']);
                const credito = parseAmount(item['Crédito']);
                importe = credito - debito;
            } else if (state.sourceType === 'compensaciones') {
                fecha = item['Fecha Operación'] || item['Fecha Operacion'] || '';
                const transaccion = item['Transacción'] || item['Transaccion'] || '';
                const impuesto = g.isOrigen ? (item['Impuesto Orig'] || '') : (item['Impuesto Dest'] || '');
                const concepto = g.isOrigen ? (item['Concepto Orig'] || '') : (item['Concepto Dest'] || '');
                descripcion = `COMP ${transaccion} - ${impuesto} ${concepto}`;
                importe = parseAmount(item['Importe']);
                // Origen = sale (negativo), Destino = entra (positivo)
                if (g.isOrigen) importe = -importe;
            } else if (state.sourceType === 'veps') {
                fecha = item['FECHA'] || item['Fecha'] || '';
                const nroVep = item['NRO_VEP'] || item['Nro_VEP'] || '';
                const impuesto = item['IMPUESTO'] || item['Impuesto'] || '';
                const concepto = item['CONCEPTO'] || item['Concepto'] || '';
                const periodo = item['PERIODO'] || item['Periodo'] || '';
                descripcion = `${impuesto} - ${concepto} / ${periodo} / VEP ${nroVep}`;
                importe = parseAmount(item['IMPORTE']);
                // VEPs son pagos (negativos - sale del banco)
                importe = -importe;
            } else if (state.sourceType === 'registros') {
                fecha = item['FECHA'] || item['Fecha'] || '';
                const nComp = item['N_COMP'] || item['N_Comp'] || '';
                const razonSocial = item['RAZON SOCIAL'] || item['RAZON_SOCIAL'] || item['Razon Social'] || item['PROVEEDOR'] || '';
                const concepto = item['CONCEPTO'] || item['Concepto'] || '';
                descripcion = [concepto, nComp, razonSocial].filter(Boolean).join(' / ');
                const debeVal = parseAmount(item['DEBE']);
                const haberVal = parseAmount(item['HABER']);
                importe = debeVal - haberVal;
            } else if (state.sourceType === 'tabla') {
                fecha = item['FECHA'] || item['Fecha'] || item['fecha'] || '';
                descripcion = item['DESCRIPCION'] || item['Descripcion'] || item['descripcion'] || '';
                // Usar valores calculados del agrupamiento
                const debeVal = item._calculatedDebe || 0;
                const haberVal = item._calculatedHaber || 0;
                importe = debeVal - haberVal;
            }

            // Generar asiento con la nueva lógica basada en signo
            const absImporte = Math.abs(importe);
            if (absImporte > 0.001) {
                if (importe < 0) {
                    // Importe negativo: cuenta_grupo al HABER, contrapartida al DEBE
                    allData.push({
                        Fecha: fecha,
                        Numero: numeroAsiento,
                        Cuenta: cuentaGrupo,
                        Debe: 0,
                        Haber: parseFloat(absImporte.toFixed(2)),
                        'Tipo de auxiliar': 1,
                        Auxiliar: 1,
                        Importe: parseFloat((-absImporte).toFixed(2)),
                        Leyenda: descripcion,
                        ExtraContable: 's'
                    });
                    allData.push({
                        Fecha: fecha,
                        Numero: numeroAsiento,
                        Cuenta: contrapartida,
                        Debe: parseFloat(absImporte.toFixed(2)),
                        Haber: 0,
                        'Tipo de auxiliar': 1,
                        Auxiliar: 1,
                        Importe: parseFloat(absImporte.toFixed(2)),
                        Leyenda: descripcion,
                        ExtraContable: 's'
                    });
                } else {
                    // Importe positivo: cuenta_grupo al DEBE, contrapartida al HABER
                    allData.push({
                        Fecha: fecha,
                        Numero: numeroAsiento,
                        Cuenta: cuentaGrupo,
                        Debe: parseFloat(absImporte.toFixed(2)),
                        Haber: 0,
                        'Tipo de auxiliar': 1,
                        Auxiliar: 1,
                        Importe: parseFloat(absImporte.toFixed(2)),
                        Leyenda: descripcion,
                        ExtraContable: 's'
                    });
                    allData.push({
                        Fecha: fecha,
                        Numero: numeroAsiento,
                        Cuenta: contrapartida,
                        Debe: 0,
                        Haber: parseFloat(absImporte.toFixed(2)),
                        'Tipo de auxiliar': 1,
                        Auxiliar: 1,
                        Importe: parseFloat((-absImporte).toFixed(2)),
                        Leyenda: descripcion,
                        ExtraContable: 's'
                    });
                }
                numeroAsiento++;
            }
        });
    });

    // Validación de partida doble: suma DEBE = suma HABER por asiento
    const asientosByNumero = {};
    allData.forEach(item => {
        const numero = item.Numero || 'sin_numero';
        if (!asientosByNumero[numero]) {
            asientosByNumero[numero] = { debe: 0, haber: 0 };
        }
        asientosByNumero[numero].debe += item.Debe || 0;
        asientosByNumero[numero].haber += item.Haber || 0;
    });

    const partidaDobleErrors = [];
    Object.entries(asientosByNumero).forEach(([numero, sumas]) => {
        const diferencia = Math.abs(sumas.debe - sumas.haber);
        if (diferencia > 0.01) { // Tolerancia por redondeo
            partidaDobleErrors.push(`Asiento ${numero}: Debe ($${sumas.debe.toFixed(2)}) ≠ Haber ($${sumas.haber.toFixed(2)})`);
        }
    });

    if (partidaDobleErrors.length > 0) {
        console.warn('Advertencias de partida doble:', partidaDobleErrors);
        // Opcional: mostrar advertencia al usuario
        // const maxErrors = 5;
        // let warnMsg = `⚠️ Se encontraron ${partidaDobleErrors.length} asiento(s) desbalanceado(s):\n\n`;
        // warnMsg += partidaDobleErrors.slice(0, maxErrors).map(e => `• ${e}`).join('\n');
        // if (partidaDobleErrors.length > maxErrors) {
        //     warnMsg += `\n\n... y ${partidaDobleErrors.length - maxErrors} más.`;
        // }
        // alert(warnMsg);
    }

    state.finalData = allData;
    goToStep(3);
}

function processCompensaciones(g, codeDebe, codeHaber, allData) {
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

        const importe = parseAmount(primeraLinea['Importe']);

        let leyenda;
        const importeVal = parseFloat(importe.toFixed(2));

        if (g.isOrigen) {
            const impuesto = primeraLinea['Impuesto Orig'] || '';
            const concepto = primeraLinea['Concepto Orig'] || '';
            const subconcepto = primeraLinea['Subconcepto Orig'] || '';
            leyenda = `COMP ${transaccion} - ${impuesto} ${concepto} ${subconcepto} / ${periodoOrig}`;

            // Línea 1: Cuenta DEBE al debe
            allData.push({
                Fecha: fechaOp,
                Cuenta: codeDebe,
                Debe: importeVal,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(importeVal.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _transaccion: transaccion
            });

            // Línea 2: Cuenta HABER al haber (contrapartida)
            allData.push({
                Fecha: fechaOp,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: importeVal,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-importeVal).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _transaccion: transaccion
            });
        } else {
            const impuesto = primeraLinea['Impuesto Dest'] || '';
            const concepto = primeraLinea['Concepto Dest'] || '';
            const subconcepto = primeraLinea['Subconcepto Dest'] || '';
            leyenda = `COMP ${transaccion} - ${impuesto} ${concepto} ${subconcepto} / ${periodoDest}`;

            // Línea 1: Cuenta DEBE al debe
            allData.push({
                Fecha: fechaOp,
                Cuenta: codeDebe,
                Debe: importeVal,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(importeVal.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _transaccion: transaccion
            });

            // Línea 2: Cuenta HABER al haber (contrapartida)
            allData.push({
                Fecha: fechaOp,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: importeVal,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-importeVal).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _transaccion: transaccion
            });
        }
    });
}

function processVeps(g, codeDebe, codeHaber, allData, numeroAsiento) {
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

            const importe = parseAmount(item['IMPORTE']);

            totalVep += importe;

            const leyenda = `${impuesto} - ${concepto} - ${subconcepto} / ${periodo} / VEP ${nroVep}`;

            // Cada línea del VEP va al DEBE (pago de impuesto)
            const debe = parseFloat(importe.toFixed(2));
            const haber = 0;
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: codeDebe || codeHaber, // Usar la cuenta que esté disponible
                Debe: debe,
                Haber: haber,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((debe - haber).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
            });
        });

        // La contrapartida va al HABER (sale del banco)
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

function processRegistros(g, codeDebe, codeHaber, allData) {
    g.items.forEach(item => {
        const fecha = item['FECHA'] || item['Fecha'] || '';
        const nInter = item['N_INTER'] || item['N_Inter'] || item['n_inter'] || '';
        const nComp = item['N_COMP'] || item['N_Comp'] || item['n_comp'] || '';
        const razonSocial = item['RAZON SOCIAL'] || item['RAZON_SOCIAL'] || item['Razon Social'] ||
            item['PROVEEDOR'] || item['Proveedor'] || item['proveedor'] || '';
        const concepto = item['CONCEPTO'] || item['Concepto'] || item['concepto'] || '';

        let debeVal = 0, haberVal = 0;

        debeVal = parseAmount(item['DEBE']);
        haberVal = parseAmount(item['HABER']);

        const debe = debeVal > 0 ? parseFloat(debeVal.toFixed(2)) : 0;
        const haber = haberVal > 0 ? parseFloat(haberVal.toFixed(2)) : 0;

        const leyendaParts = [];
        if (concepto) leyendaParts.push(concepto);
        if (nComp) leyendaParts.push(nComp);
        if (razonSocial) leyendaParts.push(razonSocial);
        const leyenda = leyendaParts.join(' / ');

        const sortOrder = parseInt(nInter) || 0;

        // Generar asiento completo por partida doble
        if (debe > 0) {
            // Línea 1: Cuenta DEBE al debe
            allData.push({
                Fecha: fecha,
                Numero: nInter,
                Cuenta: codeDebe,
                Debe: debe,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(debe.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _sortOrder: sortOrder
            });

            // Línea 2: Cuenta HABER al haber (contrapartida)
            allData.push({
                Fecha: fecha,
                Numero: nInter,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: debe,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-debe).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _sortOrder: sortOrder
            });
        } else if (haber > 0) {
            // Línea 1: Cuenta DEBE al debe (contrapartida)
            allData.push({
                Fecha: fecha,
                Numero: nInter,
                Cuenta: codeDebe,
                Debe: haber,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(haber.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _sortOrder: sortOrder
            });

            // Línea 2: Cuenta HABER al haber
            allData.push({
                Fecha: fecha,
                Numero: nInter,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: haber,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-haber).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's',
                _sortOrder: sortOrder
            });
        }
    });
}

function processExtracto(g, codeDebe, codeHaber, allData, numeroAsiento) {
    // codeDebe = cuenta del grupo (única)
    // state.bankAccount = cuenta de contrapartida (global)
    const cuentaGrupo = codeDebe;
    const cuentaContrapartida = state.bankAccount;

    g.items.forEach(item => {
        const descripcion = item['Descripción'] || item.Leyenda || '';
        const fecha = item.Fecha || '';

        let debitoVal = 0, creditoVal = 0;

        debitoVal = parseAmount(item['Débito']);
        creditoVal = parseAmount(item['Crédito']);

        const leyenda = `EXTRACTO - ${descripcion}`;

        // Débito en el extracto = sale del banco (equivale a importe negativo)
        // Lógica: Haber = cuenta del grupo, Debe = contrapartida
        if (debitoVal > 0) {
            const importe = parseFloat(debitoVal.toFixed(2));

            // Línea 1: Cuenta del grupo al HABER
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: cuentaGrupo,
                Debe: 0, Haber: importe,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((0 - importe).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });

            // Línea 2: Contrapartida (banco) al DEBE
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: cuentaContrapartida,
                Debe: importe, Haber: 0,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat(importe.toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            numeroAsiento++;
        }

        // Crédito en el extracto = entra al banco (equivale a importe positivo)
        // Lógica: Debe = cuenta del grupo, Haber = contrapartida
        if (creditoVal > 0) {
            const importe = parseFloat(creditoVal.toFixed(2));

            // Línea 1: Cuenta del grupo al DEBE
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: cuentaGrupo,
                Debe: importe, Haber: 0,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat(importe.toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });

            // Línea 2: Contrapartida (banco) al HABER
            allData.push({
                Fecha: fecha, Numero: numeroAsiento, Cuenta: cuentaContrapartida,
                Debe: 0, Haber: importe,
                'Tipo de auxiliar': 1, Auxiliar: 1,
                Importe: parseFloat((0 - importe).toFixed(2)),
                Leyenda: leyenda, ExtraContable: 's'
            });
            numeroAsiento++;
        }
    });

    return numeroAsiento;
}

function processTabla(g, codeDebe, codeHaber, allData, numeroAsiento) {
    // Procesar cada item de la tabla de datos
    // IMPORTANTE: Generar asientos completos por partida doble
    g.items.forEach(item => {
        // Obtener fecha en diferentes formatos posibles
        let fecha = item['FECHA'] || item['Fecha'] || item['fecha'] || '';

        // Obtener descripción
        const descripcion = item['DESCRIPCION'] || item['Descripcion'] || item['descripcion'] || '';

        // Usar los valores ya calculados en el agrupamiento
        const debeVal = item._calculatedDebe || 0;
        const haberVal = item._calculatedHaber || 0;

        const debe = debeVal > 0 ? parseFloat(debeVal.toFixed(2)) : 0;
        const haber = haberVal > 0 ? parseFloat(haberVal.toFixed(2)) : 0;

        // Crear leyenda
        const leyenda = descripcion;

        // Generar asiento completo por partida doble
        if (debe > 0) {
            // Importe positivo: Cuenta DEBE al debe, Cuenta HABER al haber
            // Línea 1: DEBE
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: codeDebe,
                Debe: debe,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(debe.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
            });
            // Línea 2: HABER (contrapartida)
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: debe,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-debe).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
            });
            numeroAsiento++;
        } else if (haber > 0) {
            // Importe negativo: Cuenta HABER al haber, Cuenta DEBE al debe
            // Línea 1: DEBE (contrapartida)
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: codeDebe,
                Debe: haber,
                Haber: 0,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat(haber.toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
            });
            // Línea 2: HABER
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: codeHaber,
                Debe: 0,
                Haber: haber,
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-haber).toFixed(2)),
                Leyenda: leyenda,
                ExtraContable: 's'
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
// DESCARGA DE PLANTILLAS ESPECÍFICAS
// ============================================
function downloadTemplateSpecific() {
    const wb = XLSX.utils.book_new();
    let datos, fileName, instrucciones;

    switch (state.sourceType) {
        case 'extracto':
            datos = [
                ['Fecha', 'Descripción', 'Débito', 'Crédito', 'Saldo'],
                ['15/01/2025', 'TRANSFERENCIA RECIBIDA - CLIENTE SA', '', 50000, 50000],
                ['16/01/2025', 'DEBITO AUTOMATICO - SERVICIO LUZ', 3500, '', 46500],
                ['17/01/2025', 'COMISION MANTENIMIENTO CTA', 500, '', 46000],
                ['18/01/2025', 'ACREDITAMIENTO ECHEQ', '', 25000, 71000],
                ['19/01/2025', 'TRANSFERENCIA ENVIADA - PROVEEDOR', 15000, '', 56000]
            ];
            fileName = 'plantilla_extracto_bancario.xlsx';
            instrucciones = [
                ['PLANTILLA EXTRACTO BANCARIO'],
                [''],
                ['Columnas requeridas:'],
                ['- Fecha: Fecha del movimiento (DD/MM/YYYY)'],
                ['- Descripción: Detalle del movimiento bancario'],
                ['- Débito: Monto que sale de la cuenta (número)'],
                ['- Crédito: Monto que entra a la cuenta (número)'],
                ['- Saldo: Saldo después del movimiento (opcional)'],
                [''],
                ['El sistema agrupará automáticamente por tipo de operación']
            ];
            break;

        case 'registros':
            datos = [
                ['FECHA', 'N_INTER', 'N_COMP', 'PROVEEDOR', 'CONCEPTO', 'DESC_CTA', 'DEBE', 'HABER'],
                ['15/01/2025', 1, 'FC-001', 'PROVEEDOR SA', 'Compra mercadería', 'Mercaderías', 10000, ''],
                ['15/01/2025', 1, 'FC-001', 'PROVEEDOR SA', 'Compra mercadería', 'IVA CF', 2100, ''],
                ['15/01/2025', 1, 'FC-001', 'PROVEEDOR SA', 'Compra mercadería', 'Proveedores', '', 12100],
                ['20/01/2025', 2, 'FC-002', 'SERVICIOS SRL', 'Servicio contable', 'Honorarios', 5000, ''],
                ['20/01/2025', 2, 'FC-002', 'SERVICIOS SRL', 'Servicio contable', 'Proveedores', '', 5000]
            ];
            fileName = 'plantilla_registros_cliente.xlsx';
            instrucciones = [
                ['PLANTILLA REGISTROS DEL CLIENTE'],
                [''],
                ['Columnas requeridas:'],
                ['- FECHA: Fecha del asiento (DD/MM/YYYY)'],
                ['- N_INTER: Número de asiento interno'],
                ['- N_COMP: Número de comprobante'],
                ['- PROVEEDOR: Razón social del proveedor'],
                ['- CONCEPTO: Descripción del concepto'],
                ['- DESC_CTA: Descripción de la cuenta (para agrupar)'],
                ['- DEBE: Importe al debe'],
                ['- HABER: Importe al haber'],
                [''],
                ['Cada N_INTER representa un asiento completo']
            ];
            break;

        case 'veps':
            datos = [
                ['NRO_VEP', 'FECHA', 'PERIODO', 'IMPUESTO', 'CONCEPTO', 'COD_SUBCONCEPTO', 'SUBCONCEPTO', 'IMPORTE'],
                ['12345678', '15/01/2025', '12/2024', 'IVA', 'DECLARACIÓN JURADA', '19', 'IMPUESTO DETERMINADO', 50000],
                ['12345678', '15/01/2025', '12/2024', 'IVA', 'DECLARACIÓN JURADA', '51', 'INTERESES RESARCITORIOS', 1500],
                ['87654321', '20/01/2025', '12/2024', 'GANANCIAS', 'ANTICIPO', '19', 'IMPUESTO DETERMINADO', 25000]
            ];
            fileName = 'plantilla_veps_arca.xlsx';
            instrucciones = [
                ['PLANTILLA VEPs ARCA'],
                [''],
                ['Columnas requeridas:'],
                ['- NRO_VEP: Número de VEP'],
                ['- FECHA: Fecha de pago'],
                ['- PERIODO: Período fiscal (MM/YYYY)'],
                ['- IMPUESTO: Nombre del impuesto'],
                ['- CONCEPTO: Concepto de pago'],
                ['- COD_SUBCONCEPTO: Código de subconcepto (51 = intereses)'],
                ['- SUBCONCEPTO: Descripción del subconcepto'],
                ['- IMPORTE: Monto a pagar'],
                [''],
                ['Los VEPs se agrupan por impuesto y se separan intereses']
            ];
            break;

        case 'compensaciones':
            datos = [
                ['Transacción', 'Fecha Operación', 'Impuesto Orig', 'Concepto Orig', 'Subconcepto Orig', 'Período Orig', 'Impuesto Dest', 'Concepto Dest', 'Subconcepto Dest', 'Período Dest', 'Importe'],
                ['1001', '15/01/2025', 'IVA', 'SALDO A FAVOR', 'LIBRE DISPONIBILIDAD', '11/2024', 'GANANCIAS', 'ANTICIPO', 'IMPUESTO', '12/2024', 25000],
                ['1002', '20/01/2025', 'IVA', 'SALDO A FAVOR', 'LIBRE DISPONIBILIDAD', '12/2024', 'IIBB', 'ANTICIPO', 'IMPUESTO', '01/2025', 15000]
            ];
            fileName = 'plantilla_compensaciones_arca.xlsx';
            instrucciones = [
                ['PLANTILLA COMPENSACIONES ARCA'],
                [''],
                ['Columnas requeridas:'],
                ['- Transacción: Número de transacción'],
                ['- Fecha Operación: Fecha de la compensación'],
                ['- Impuesto Orig: Impuesto de origen (donde sale)'],
                ['- Concepto Orig / Subconcepto Orig / Período Orig'],
                ['- Impuesto Dest: Impuesto de destino (donde entra)'],
                ['- Concepto Dest / Subconcepto Dest / Período Dest'],
                ['- Importe: Monto compensado'],
                [''],
                ['ORIGEN va al HABER (sale), DESTINO va al DEBE (entra)']
            ];
            break;

        case 'tabla':
            datos = [
                ['FECHA', 'DESCRIPCION', 'IMPORTE'],
                ['2025-01-15', 'Pago proveedores', -50000],
                ['2025-01-15', 'Cobro clientes', 80000],
                ['2025-01-20', 'Compra insumos', -12500],
                ['2025-01-22', 'Venta productos', 45000],
                ['2025-01-25', 'Gastos bancarios', -1500],
                ['2025-01-28', 'Intereses ganados', 3200]
            ];
            fileName = 'plantilla_tabla_datos.xlsx';
            instrucciones = [
                ['PLANTILLA TABLA DE DATOS'],
                [''],
                ['Formato simple de 3 columnas para casos generales.'],
                [''],
                ['Columnas requeridas:'],
                ['- FECHA: Fecha del movimiento (YYYY-MM-DD o DD/MM/YYYY)'],
                ['- DESCRIPCION: Texto descriptivo del movimiento'],
                ['- IMPORTE: Número positivo o negativo'],
                [''],
                ['LÓGICA DE CONVERSIÓN:'],
                [''],
                ['• IMPORTE NEGATIVO → va a columna HABER'],
                ['  Ejemplo: -50000 se convierte en Haber: 50000'],
                ['  (representa salidas de dinero: pagos, gastos, etc.)'],
                [''],
                ['• IMPORTE POSITIVO → va a columna DEBE'],
                ['  Ejemplo: 80000 se convierte en Debe: 80000'],
                ['  (representa entradas de dinero: cobros, ingresos, etc.)'],
                [''],
                ['El sistema usa el valor absoluto (sin el signo negativo).'],
                [''],
                ['EJEMPLOS:'],
                ['-50000 (Pago proveedores) → Haber: 50.000,00'],
                ['+80000 (Cobro clientes) → Debe: 80.000,00'],
                ['-12500 (Compra insumos) → Haber: 12.500,00'],
                ['+45000 (Venta productos) → Debe: 45.000,00']
            ];
            break;

        case 'soscontador':
            datos = [
                ['', '', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['Asiento', 'Descripcion - Cuenta', '', 'Monto Debe', 'Monto Haber', 'Monto Saldo'],
                ['Asiento Nro. 1 - Fecha 15/01/2025 - FC A-0001-00000123', '', '', '', '', ''],
                ['', 'Compra de mercadería según factura - PROVEEDOR SA', '', '', '', ''],
                ['', '', '4110101 - Mercaderías', 50000, '', 50000],
                ['', '', '1160101 - IVA Crédito Fiscal', 10500, '', 60500],
                ['', '', '2110101 - Proveedores', '', 60500, 0],
                ['Asiento Nro. 2 - Fecha 20/01/2025 - REC 0001', '', '', '', '', ''],
                ['', 'Pago a proveedor según recibo - PROVEEDOR SA', '', '', '', ''],
                ['', '', '2110101 - Proveedores', 60500, '', 60500],
                ['', '', '1110101 - Caja', '', 60500, 0],
                ['Asiento Nro. 3 - Fecha 25/01/2025 - FC A-0001-00000456', '', '', '', '', ''],
                ['', 'Honorarios profesionales - CONTADOR SRL', '', '', '', ''],
                ['', '', '4210309 - Honorarios Profesionales', 15000, '', 15000],
                ['', '', '1160101 - IVA Crédito Fiscal', 3150, '', 18150],
                ['', '', '2110101 - Proveedores', '', 18150, 0]
            ];
            fileName = 'plantilla_sos_contador.xlsx';
            instrucciones = [
                ['PLANTILLA LIBRO DIARIO SOS CONTADOR'],
                [''],
                ['Este formato es específico para exportaciones de SOS Contador.'],
                [''],
                ['ESTRUCTURA DEL ARCHIVO:'],
                [''],
                ['• Filas 1-6: Encabezados del libro (se ignoran)'],
                ['• Fila 7: Headers de columnas'],
                ['  - Columna A: Asiento'],
                ['  - Columna B: Descripcion - Cuenta'],
                ['  - Columna C: (vacío en headers)'],
                ['  - Columna D: Monto Debe'],
                ['  - Columna E: Monto Haber'],
                ['  - Columna F: Monto Saldo (se ignora)'],
                [''],
                ['ESTRUCTURA DE CADA ASIENTO:'],
                [''],
                ['1. ENCABEZADO DEL ASIENTO (Columna A):'],
                ['   "Asiento Nro. X - Fecha DD/MM/YYYY - COMPROBANTE"'],
                ['   Ejemplo: "Asiento Nro. 1 - Fecha 15/01/2025 - FC A-0001-00000123"'],
                [''],
                ['2. DESCRIPCIÓN (Columna B, fila siguiente):'],
                ['   "Operación según comprobante - PROVEEDOR"'],
                ['   Ejemplo: "Compra de mercadería según factura - PROVEEDOR SA"'],
                [''],
                ['3. LÍNEAS DE MOVIMIENTO (Columna C):'],
                ['   "CODIGO - DESCRIPCION CUENTA"'],
                ['   Ejemplo: "4210309 - Honorarios Profesionales"'],
                ['   - Columna D: Monto Debe'],
                ['   - Columna E: Monto Haber'],
                [''],
                ['IMPORTANTE:'],
                ['- El sistema extrae SOLO el código de cuenta (números antes del " - ")'],
                ['- No requiere asignación de cuentas porque ya vienen los códigos'],
                ['- La fecha se extrae del encabezado de cada asiento'],
                ['- La descripción de la operación se usa como leyenda']
            ];
            break;

        default:
            alert('Por favor, seleccione un tipo de archivo primero');
            return;
    }

    // Crear hoja de datos
    const wsDatos = XLSX.utils.aoa_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');

    // Crear hoja de instrucciones
    const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
    wsInstrucciones['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

    // Descargar archivo
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
