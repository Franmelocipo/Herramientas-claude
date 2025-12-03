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
    selectedItems: {},      // Rastrear items seleccionados para reagrupación {groupIdx: {itemIdx: true/false}}
    selectedGroups: {},     // Rastrear grupos seleccionados para fusión {groupIdx: true/false}
    planCuentas: [],        // Plan de cuentas del cliente seleccionado
    mapeoImpuestos: {}      // Mapeo de códigos de impuesto a cuentas contables
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
        console.log('Cargando plan de cuentas para cliente:', clienteId);

        let { data: cuentas, error } = await supabase
            .from('plan_cuentas')
            .select('codigo, cuenta, codigos_impuesto')
            .eq('cliente_id', clienteId)
            .order('codigo');

        if (error) {
            console.error('Error en query:', error);
            // Si el error es por columna faltante, hacer query sin esa columna
            if (error.message && error.message.includes('codigos_impuesto')) {
                console.log('Columna codigos_impuesto no existe, usando query sin ella');
                const { data: dataFallback, error: errorFallback } = await supabase
                    .from('plan_cuentas')
                    .select('codigo, cuenta')
                    .eq('cliente_id', clienteId)
                    .order('codigo');

                if (errorFallback) {
                    console.error('Error en fallback query:', errorFallback);
                    mostrarInfoPlan('Error al cargar el plan de cuentas', 'error');
                    deshabilitarOpciones();
                    return;
                }
                cuentas = dataFallback;
            } else {
                mostrarInfoPlan('Error al cargar el plan de cuentas', 'error');
                deshabilitarOpciones();
                return;
            }
        }

        if (!cuentas || cuentas.length === 0) {
            mostrarInfoPlan('⚠️ Este cliente no tiene plan de cuentas. Configure el plan primero.', 'error');
            deshabilitarOpciones();
            state.planCuentas = [];
            state.mapeoImpuestos = {};
            return;
        }

        // Guardar las cuentas para usar en los selectores
        state.planCuentas = cuentas.map(c => ({
            codigo: c.codigo,
            nombre: c.cuenta,  // Usar 'nombre' para consistencia con el resto del código
            codigos_impuesto: c.codigos_impuesto || []
        }));

        // Construir mapeo de códigos de impuesto a cuentas
        state.mapeoImpuestos = {};
        cuentas.forEach(cuenta => {
            if (cuenta.codigos_impuesto && cuenta.codigos_impuesto.length > 0) {
                cuenta.codigos_impuesto.forEach(codImpuesto => {
                    state.mapeoImpuestos[codImpuesto] = {
                        codigo: cuenta.codigo,
                        nombre: cuenta.cuenta
                    };
                });
            }
        });

        const numCodigosImpuesto = Object.keys(state.mapeoImpuestos).length;
        mostrarInfoPlan(
            `✅ Plan de cuentas cargado: ${cuentas.length} cuentas${numCodigosImpuesto > 0 ? ` | ${numCodigosImpuesto} códigos de impuesto configurados` : ''}`,
            'success'
        );
        console.log('Plan de cuentas cargado:', cuentas.length, 'cuentas');
        console.log('Mapeo de impuestos:', numCodigosImpuesto, 'códigos');

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
    state.selectedGroups = {};

    elements.fileInput.value = '';
    elements.bankAccountInput.value = '';

    goToStep(0);
}

// ============================================
// FUNCIONES AUXILIARES PARA LA HERRAMIENTA
// ============================================
async function getClientAccounts() {
    return state.planCuentas.map(cuenta => ({
        code: cuenta.codigo,
        description: cuenta.nombre
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

    // Mostrar/ocultar info box para VEPs
    const vepsInfoBox = document.getElementById('vepsInfoBox');
    if (vepsInfoBox) {
        if (type === 'veps') {
            vepsInfoBox.classList.remove('hidden');
        } else {
            vepsInfoBox.classList.add('hidden');
        }
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

/**
 * Normaliza una descripción eliminando patrones variables para permitir agrupación consistente.
 * Elimina referencias, números de operación, fechas y códigos numéricos largos.
 *
 * @param {string} descripcion - Descripción original del movimiento
 * @returns {string} - Descripción normalizada para agrupación
 */
function normalizarDescripcion(descripcion) {
    return descripcion
        .replace(/\(REF:\s*\d+\)/gi, '')       // Quitar (REF: 123456)
        .replace(/\(Ref:\s*\d+\)/gi, '')       // Quitar (Ref: 123456)
        .replace(/REF:\s*\d+/gi, '')           // Quitar REF: 123456
        .replace(/\bREF\s+\d+\b/gi, '')        // Quitar REF 123456
        .replace(/\(\d{6,}\)/g, '')            // Quitar números largos entre paréntesis (ej: (0000007744))
        .replace(/\b\d{8,}\b/g, '')            // Quitar números largos sueltos (8+ dígitos)
        .replace(/\d{2}\/\d{2}\/\d{4}/g, '')  // Quitar fechas dd/mm/aaaa
        .replace(/\d{2}-\d{2}-\d{4}/g, '')    // Quitar fechas dd-mm-aaaa
        .replace(/\s+/g, ' ')                  // Normalizar espacios múltiples a uno solo
        .trim();                               // Eliminar espacios al inicio y final
}

/**
 * Extrae un prefijo común de una descripción normalizada para agrupación inteligente.
 * Toma las primeras 2-3 palabras significativas después de normalizar y filtrar conectores.
 *
 * Ejemplos:
 * - "Pago - - - Compra de Juego 2 Soportes..." → "Pago Compra"
 * - "Pago - - - Compra de Impresora Hp 1102w..." → "Pago Compra"
 * - "TRANSFERENCIA RECIBIDA DE CLIENTE ABC" → "TRANSFERENCIA RECIBIDA"
 *
 * @param {string} descripcion - Descripción original del movimiento
 * @returns {string} - Prefijo común para agrupar (primeras 2-3 palabras significativas)
 */
function extraerPrefijo(descripcion) {
    // Primero normalizar la descripción
    const normalizada = normalizarDescripcion(descripcion);

    // Separar en palabras y filtrar palabras vacías o poco significativas
    const palabras = normalizada
        .split(/\s+/)
        .filter(palabra => {
            // Filtrar palabras vacías y conectores comunes
            if (!palabra || palabra.length === 0) return false;
            if (palabra === '-' || palabra === '/' || palabra === '|') return false;
            // Filtrar artículos y preposiciones cortas
            const palabraLower = palabra.toLowerCase();
            if (['de', 'del', 'la', 'el', 'los', 'las', 'a', 'en', 'y', 'o', 'por', 'para'].includes(palabraLower)) return false;
            return true;
        });

    // Tomar las primeras 2 palabras significativas para mejor agrupación
    // Esto permite agrupar "Pago Compra Juego" y "Pago Compra Impresora" juntos
    const prefijo = palabras.slice(0, 2).join(' ');

    return prefijo.trim();
}

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
        // CAMBIO: Agrupar por VEP, no por impuesto
        // Un VEP = Un asiento (con múltiples líneas de débito y una de crédito)
        data.forEach((row) => {
            const nroVep = String(row['NRO_VEP'] || row['Nro_VEP'] || row['nro_vep'] || '').trim();
            if (!nroVep) return;

            const periodo = String(row['PERIODO'] || row['Periodo'] || row['periodo'] || '').trim();
            const fecha = String(row['FECHA'] || row['Fecha'] || row['fecha'] || '').trim();
            const entidadPago = String(row['ENTIDAD_PAGO'] || row['Entidad_Pago'] || row['entidad_pago'] || '').trim();
            const importe = parseAmount(row['IMPORTE']);

            // Clave de agrupación: número de VEP
            const key = `VEP ${nroVep}`;

            if (!groups[key]) {
                groups[key] = {
                    concepto: key,
                    ejemploCompleto: `VEP ${nroVep} / ${periodo}${entidadPago ? ` / ${entidadPago}` : ''}`,
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: [],
                    nroVep: nroVep,
                    periodo: periodo,
                    fecha: fecha,
                    entidadPago: entidadPago
                };
            }

            groups[key].count++;
            groups[key].totalDebe += importe;
            groups[key].items.push(row);
        });

    } else if (state.sourceType === 'registros') {
        data.forEach((row) => {
            // CRÍTICO: Agrupar por número interno (N_INTER), NO por DESC_CTA
            // Todas las líneas con el mismo N_INTER deben formar UN SOLO asiento
            const numeroInterno = String(row['N_INTER'] || row['N_Inter'] || row['n_inter'] || '').trim();
            if (!numeroInterno) return;

            const descCta = String(row['DESC_CTA'] || row['Desc_Cta'] || row['desc_cta'] || '').trim();
            const proveedor = String(row['PROVEEDOR'] || row['Proveedor'] || row['proveedor'] ||
                                     row['RAZON SOCIAL'] || row['RAZON_SOCIAL'] || row['Razon Social'] || '').trim();
            const concepto = String(row['CONCEPTO'] || row['Concepto'] || row['concepto'] || '').trim();
            const nComp = String(row['N_COMP'] || row['N_Comp'] || row['n_comp'] || '').trim();

            const debeVal = parseAmount(row['DEBE']);
            const haberVal = parseAmount(row['HABER']);

            const key = numeroInterno;

            if (!groups[key]) {
                groups[key] = {
                    concepto: numeroInterno,
                    ejemploCompleto: [concepto, nComp, proveedor].filter(Boolean).join(' / '),
                    count: 0,
                    totalDebe: 0,
                    totalHaber: 0,
                    items: [],
                    numeroInterno: numeroInterno
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
                // Negativo → DEBE (valor absoluto)
                debeVal = Math.abs(importe);
            } else {
                // Positivo → HABER
                haberVal = importe;
            }

            // AGRUPACIÓN POR PREFIJO COMÚN
            // Extraer prefijo común para agrupar conceptos similares
            // Ejemplo: "Pago - - - Compra de Juego..." → "Pago Compra"
            const prefijo = extraerPrefijo(descripcion);
            const key = prefijo.toUpperCase();

            if (!groups[key]) {
                groups[key] = {
                    concepto: prefijo,            // Usar prefijo común como concepto
                    ejemploCompleto: descripcion, // Mantener un ejemplo de la descripción original
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

            // Si no matchea con patrones específicos, agrupar por PREFIJO COMÚN
            if (!matched) {
                // AGRUPACIÓN INTELIGENTE: Extraer prefijo común de la descripción
                // Esto agrupa movimientos como:
                // - "Pago - - - Compra de Juego..." → "Pago Compra"
                // - "Pago - - - Compra de Impresora..." → "Pago Compra"
                const prefijo = extraerPrefijo(desc);
                const key = prefijo.toUpperCase();

                if (!groups[key]) {
                    groups[key] = {
                        concepto: prefijo,          // Usar prefijo común como concepto
                        ejemploCompleto: desc,      // Mantener un ejemplo de la descripción original
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

    // Para registros del cliente, extraer descripciones únicas de contrapartida
    if (state.sourceType === 'registros') {
        extractDescripcionesUnicas();
    }
}

// ============================================
// EXTRACCIÓN DE DESCRIPCIONES ÚNICAS (REGISTROS)
// ============================================
/**
 * Extrae todas las descripciones únicas de DESC_CTA de los registros del cliente.
 * Estas descripciones representan las cuentas de contrapartida que necesitan asignación.
 * En lugar de pedir una cuenta por cada asiento, pedimos una vez por descripción única.
 */
function extractDescripcionesUnicas() {
    const descripcionesMap = new Map();

    state.groupedData.forEach(grupo => {
        grupo.items.forEach(item => {
            const descCta = String(item['DESC_CTA'] || item['Desc_Cta'] || item['desc_cta'] || '').trim();
            const debe = parseAmount(item['DEBE']);
            const haber = parseAmount(item['HABER']);

            // Solo procesar líneas que tienen DESC_CTA (son las líneas de contrapartida)
            if (descCta) {
                if (!descripcionesMap.has(descCta)) {
                    descripcionesMap.set(descCta, {
                        descripcion: descCta,
                        count: 0,
                        totalImporte: 0,
                        asientos: new Set()
                    });
                }

                const info = descripcionesMap.get(descCta);
                info.count++;
                info.totalImporte += Math.abs(debe - haber);
                info.asientos.add(grupo.numeroInterno || grupo.concepto);
            }
        });
    });

    // Convertir a array y ordenar por frecuencia (más común primero)
    state.descripcionesUnicas = Array.from(descripcionesMap.values())
        .sort((a, b) => b.count - a.count);

    // Inicializar objeto de asignaciones de cuenta por descripción si no existe
    if (!state.cuentasPorDescripcion) {
        state.cuentasPorDescripcion = {};
    }
}

// ============================================
// EXTRACCIÓN DE IMPUESTOS Y BANCOS ÚNICOS (VEPs)
// ============================================
/**
 * Extrae los códigos de impuesto únicos de todos los VEPs cargados
 * @returns {Array} Array con información de cada impuesto único
 */
function extraerImpuestosUnicos() {
    const impuestosMap = new Map();

    state.groupedData.forEach(grupo => {
        grupo.items.forEach(item => {
            const codImpuesto = String(item['COD_IMPUESTO'] || item['Cod_Impuesto'] || item['cod_impuesto'] || '').trim();
            const impuesto = String(item['IMPUESTO'] || item['Impuesto'] || item['impuesto'] || '').trim();
            const importe = parseAmount(item['IMPORTE']);

            if (codImpuesto) {
                if (!impuestosMap.has(codImpuesto)) {
                    impuestosMap.set(codImpuesto, {
                        codigo: codImpuesto,
                        descripcion: impuesto,
                        contador: 0,
                        totalImporte: 0,
                        veps: new Set()
                    });
                }

                const info = impuestosMap.get(codImpuesto);
                info.contador++;
                info.totalImporte += Math.abs(importe);
                info.veps.add(grupo.nroVep || grupo.concepto);
            }
        });
    });

    return Array.from(impuestosMap.values())
        .map(imp => ({
            ...imp,
            cantidadVeps: imp.veps.size
        }))
        .sort((a, b) => b.contador - a.contador);
}

/**
 * Extrae los bancos/entidades de pago únicos de todos los VEPs cargados
 * @returns {Array} Array con información de cada banco único
 */
function extraerBancosUnicos() {
    const bancosMap = new Map();

    state.groupedData.forEach(grupo => {
        const banco = String(grupo.entidadPago || '').trim();
        const totalVep = grupo.totalDebe || 0;

        if (banco) {
            if (!bancosMap.has(banco)) {
                bancosMap.set(banco, {
                    nombre: banco,
                    contador: 0,
                    totalImporte: 0
                });
            }

            const info = bancosMap.get(banco);
            info.contador++;
            info.totalImporte += totalVep;
        }
    });

    return Array.from(bancosMap.values())
        .sort((a, b) => b.contador - a.contador);
}

/**
 * Renderiza la interfaz de asignación de cuentas para VEPs
 * Agrupa por código de impuesto (débito) y banco (crédito)
 */
function renderAsignacionVeps() {
    const impuestosUnicos = extraerImpuestosUnicos();
    const bancosUnicos = extraerBancosUnicos();

    // Guardar en state para uso posterior
    state.impuestosUnicos = impuestosUnicos;
    state.bancosUnicos = bancosUnicos;

    // Inicializar mapas de asignación si no existen
    if (!state.cuentasPorImpuesto) {
        state.cuentasPorImpuesto = {};
    }
    if (!state.cuentasPorBanco) {
        state.cuentasPorBanco = {};
    }
    if (!state.nombresCuentasPorImpuesto) {
        state.nombresCuentasPorImpuesto = {};
    }
    if (!state.nombresCuentasPorBanco) {
        state.nombresCuentasPorBanco = {};
    }

    // Pre-asignar cuentas automáticas desde mapeoImpuestos (plan de cuentas)
    impuestosUnicos.forEach(imp => {
        if (state.mapeoImpuestos[imp.codigo] && !state.cuentasPorImpuesto[imp.codigo]) {
            state.cuentasPorImpuesto[imp.codigo] = state.mapeoImpuestos[imp.codigo].codigo;
            state.nombresCuentasPorImpuesto[imp.codigo] = state.mapeoImpuestos[imp.codigo].nombre;
        }
    });

    console.log('Estructura VEPs:', {
        totalVEPs: state.groupedData.length,
        totalAsientos: state.groupedData.length,
        impuestosUnicos: impuestosUnicos.length,
        bancosUnicos: bancosUnicos.length
    });

    elements.groupStats.textContent = `${state.groupedData.length} VEPs → ${state.groupedData.length} asientos | ${impuestosUnicos.length} impuestos | ${bancosUnicos.length} bancos`;

    // Ocultar sección de cuenta de contrapartida global (usaremos cuentas por banco)
    elements.bankAccountSection.classList.add('hidden');
    elements.compensacionesInfo.classList.add('hidden');

    // HTML principal
    let html = `
        <div class="asignacion-veps-container">
            <div class="descripcion-info-box" style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                <h3 style="margin: 0 0 8px 0; color: #2e7d32;">Asignar Cuentas Contables</h3>
                <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                    <p style="margin: 0; color: #333;">
                        <strong>${state.groupedData.length} VEPs</strong> → Generarán <strong>${state.groupedData.length} asientos</strong>
                    </p>
                    <p style="margin: 0; color: #333;">
                        <strong>${impuestosUnicos.length}</strong> tipos de impuesto diferentes
                    </p>
                    <p style="margin: 0; color: #333;">
                        <strong>${bancosUnicos.length}</strong> ${bancosUnicos.length === 1 ? 'banco' : 'bancos'} diferentes
                    </p>
                </div>
            </div>

            <!-- SECCIÓN IMPUESTOS (DÉBITO) -->
            <div class="seccion-cuentas" style="margin-bottom: 24px;">
                <h4 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 8px; margin-bottom: 16px;">
                    Impuestos (Débito)
                </h4>
                <p style="color: #666; font-size: 13px; margin-bottom: 16px;">
                    Asigna una cuenta para cada tipo de impuesto. Se aplicará a <strong>TODOS</strong> los asientos que contengan ese impuesto.
                </p>
    `;

    // Renderizar impuestos
    impuestosUnicos.forEach((impuesto, idx) => {
        const cuentaAsignada = state.cuentasPorImpuesto[impuesto.codigo] || '';
        const nombreCuenta = state.nombresCuentasPorImpuesto[impuesto.codigo] || '';
        let valorInput = cuentaAsignada;
        if (cuentaAsignada && nombreCuenta) {
            valorInput = `${cuentaAsignada} - ${nombreCuenta}`;
        }

        const tieneAsignacionAuto = state.mapeoImpuestos[impuesto.codigo] ? true : false;

        html += `
            <div class="asignacion-item" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px; ${tieneAsignacionAuto ? 'border-left: 4px solid #4caf50;' : ''}">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <strong style="color: #1976d2; font-size: 15px;">${impuesto.codigo} - ${impuesto.descripcion}</strong>
                            <span class="badge" style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                                ${impuesto.cantidadVeps} VEP(s)
                            </span>
                            ${tieneAsignacionAuto ? '<span style="color: #4caf50; font-size: 12px;">✓ Asignación automática</span>' : ''}
                        </div>
                        <div style="color: #666; font-size: 13px;">
                            Total: $${impuesto.totalImporte.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style="min-width: 400px;">
                        <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Cuenta contable (Débito)</label>
                        <div class="input-with-dropdown">
                            <input
                                type="text"
                                class="input-text impuesto-cuenta-input"
                                data-codigo-impuesto="${impuesto.codigo}"
                                data-impuesto-idx="${idx}"
                                value="${valorInput}"
                                placeholder="${getSelectedClientId() ? '🔍 Buscar cuenta...' : 'Código de cuenta'}"
                                style="width: 100%; padding: 0.75rem; font-size: 0.95rem; ${valorInput ? 'border-color: #4caf50; background: #e8f5e9;' : ''}"
                            >
                            <div class="account-dropdown hidden" id="dropdown-impuesto-${idx}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>

            <!-- SECCIÓN BANCOS (CRÉDITO) -->
            <div class="seccion-cuentas">
                <h4 style="color: #388e3c; border-bottom: 2px solid #388e3c; padding-bottom: 8px; margin-bottom: 16px;">
                    Bancos (Crédito)
                </h4>
                <p style="color: #666; font-size: 13px; margin-bottom: 16px;">
                    Asigna una cuenta para cada banco. Se aplicará a <strong>TODOS</strong> los pagos realizados desde ese banco.
                </p>
    `;

    // Renderizar bancos
    bancosUnicos.forEach((banco, idx) => {
        const cuentaAsignada = state.cuentasPorBanco[banco.nombre] || '';
        const nombreCuenta = state.nombresCuentasPorBanco[banco.nombre] || '';
        let valorInput = cuentaAsignada;
        if (cuentaAsignada && nombreCuenta) {
            valorInput = `${cuentaAsignada} - ${nombreCuenta}`;
        }

        html += `
            <div class="asignacion-item" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <strong style="color: #388e3c; font-size: 15px;">${banco.nombre}</strong>
                            <span class="badge" style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                                ${banco.contador} VEP(s)
                            </span>
                        </div>
                        <div style="color: #666; font-size: 13px;">
                            Total: $${banco.totalImporte.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style="min-width: 400px;">
                        <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Cuenta contable (Crédito/Banco)</label>
                        <div class="input-with-dropdown">
                            <input
                                type="text"
                                class="input-text banco-cuenta-input"
                                data-banco="${banco.nombre}"
                                data-banco-idx="${idx}"
                                value="${valorInput}"
                                placeholder="${getSelectedClientId() ? '🔍 Buscar cuenta...' : 'Código de cuenta'}"
                                style="width: 100%; padding: 0.75rem; font-size: 0.95rem; ${valorInput ? 'border-color: #4caf50; background: #e8f5e9;' : ''}"
                            >
                            <div class="account-dropdown hidden" id="dropdown-banco-${idx}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    elements.groupsList.innerHTML = html;

    // Attach event listeners para inputs de impuestos
    document.querySelectorAll('.impuesto-cuenta-input').forEach(input => {
        const codigoImpuesto = input.dataset.codigoImpuesto;
        const idx = parseInt(input.dataset.impuestoIdx);

        input.addEventListener('input', (e) => {
            if (getSelectedClientId()) {
                handleImpuestoCuentaInputChange(idx, codigoImpuesto);
            }
        });

        input.addEventListener('focus', () => {
            if (getSelectedClientId()) {
                state.activeSearchField = `impuesto-${idx}`;
                showImpuestoCuentaDropdown(idx, codigoImpuesto);
            }
        });

        input.addEventListener('keydown', (e) => {
            handleImpuestoCuentaInputKeydown(e, idx, codigoImpuesto);
        });
    });

    // Attach event listeners para inputs de bancos
    document.querySelectorAll('.banco-cuenta-input').forEach(input => {
        const banco = input.dataset.banco;
        const idx = parseInt(input.dataset.bancoIdx);

        input.addEventListener('input', (e) => {
            if (getSelectedClientId()) {
                handleBancoCuentaInputChange(idx, banco);
            }
        });

        input.addEventListener('focus', () => {
            if (getSelectedClientId()) {
                state.activeSearchField = `banco-${idx}`;
                showBancoCuentaDropdown(idx, banco);
            }
        });

        input.addEventListener('keydown', (e) => {
            handleBancoCuentaInputKeydown(e, idx, banco);
        });
    });
}

// ============================================
// FUNCIONES DE BÚSQUEDA PARA IMPUESTOS (VEPs)
// ============================================
function handleImpuestoCuentaInputChange(idx, codigoImpuesto) {
    const input = document.querySelector(`input[data-impuesto-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-impuesto-${idx}`);

    if (!dropdown) return;

    if (searchTerm.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    const filteredAccounts = state.planCuentas.filter(account => {
        const codigo = String(account.codigo || '').toUpperCase();
        const nombre = String(account.nombre || '').toUpperCase();
        return codigo.includes(searchTerm) || nombre.includes(searchTerm);
    }).slice(0, 50);

    if (filteredAccounts.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = filteredAccounts.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectImpuestoCuenta('${codigoImpuesto}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function showImpuestoCuentaDropdown(idx, codigoImpuesto) {
    const input = document.querySelector(`input[data-impuesto-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-impuesto-${idx}`);

    if (!dropdown) return;

    if (state.planCuentas.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No hay plan de cuentas cargado</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    let accountsToShow = state.planCuentas;
    if (searchTerm.length > 0) {
        accountsToShow = accountsToShow.filter(account => {
            const codigo = String(account.codigo || '').toUpperCase();
            const nombre = String(account.nombre || '').toUpperCase();
            return codigo.includes(searchTerm) || nombre.includes(searchTerm);
        });
    }

    accountsToShow = accountsToShow.slice(0, 50);

    if (accountsToShow.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = accountsToShow.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectImpuestoCuenta('${codigoImpuesto}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function selectImpuestoCuenta(codigoImpuesto, idx, codigo, nombre) {
    state.cuentasPorImpuesto[codigoImpuesto] = codigo;
    state.nombresCuentasPorImpuesto[codigoImpuesto] = nombre;

    const input = document.querySelector(`input[data-impuesto-idx="${idx}"]`);
    if (input) {
        input.value = `${codigo} - ${nombre}`;
        input.style.borderColor = '#4caf50';
        input.style.background = '#e8f5e9';
    }

    const dropdown = document.getElementById(`dropdown-impuesto-${idx}`);
    if (dropdown) {
        dropdown.classList.add('hidden');
    }

    console.log(`Impuesto ${codigoImpuesto} → Cuenta ${codigo} - ${nombre}`);
}

function handleImpuestoCuentaInputKeydown(e, idx, codigoImpuesto) {
    const dropdown = document.getElementById(`dropdown-impuesto-${idx}`);
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const items = dropdown.querySelectorAll('.dropdown-item');
    if (items.length === 0) return;

    const currentActive = dropdown.querySelector('.dropdown-item.active');
    let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
            items[currentIndex].click();
        }
        return;
    } else if (e.key === 'Escape') {
        e.preventDefault();
        dropdown.classList.add('hidden');
        return;
    } else {
        return;
    }

    items.forEach(item => item.classList.remove('active'));
    if (items[currentIndex]) {
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
}

// ============================================
// FUNCIONES DE BÚSQUEDA PARA BANCOS (VEPs)
// ============================================
function handleBancoCuentaInputChange(idx, banco) {
    const input = document.querySelector(`input[data-banco-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-banco-${idx}`);

    if (!dropdown) return;

    if (searchTerm.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    const filteredAccounts = state.planCuentas.filter(account => {
        const codigo = String(account.codigo || '').toUpperCase();
        const nombre = String(account.nombre || '').toUpperCase();
        return codigo.includes(searchTerm) || nombre.includes(searchTerm);
    }).slice(0, 50);

    if (filteredAccounts.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = filteredAccounts.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectBancoCuenta('${banco.replace(/'/g, "\\'")}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function showBancoCuentaDropdown(idx, banco) {
    const input = document.querySelector(`input[data-banco-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-banco-${idx}`);

    if (!dropdown) return;

    if (state.planCuentas.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No hay plan de cuentas cargado</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    let accountsToShow = state.planCuentas;
    if (searchTerm.length > 0) {
        accountsToShow = accountsToShow.filter(account => {
            const codigo = String(account.codigo || '').toUpperCase();
            const nombre = String(account.nombre || '').toUpperCase();
            return codigo.includes(searchTerm) || nombre.includes(searchTerm);
        });
    }

    accountsToShow = accountsToShow.slice(0, 50);

    if (accountsToShow.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = accountsToShow.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectBancoCuenta('${banco.replace(/'/g, "\\'")}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function selectBancoCuenta(banco, idx, codigo, nombre) {
    state.cuentasPorBanco[banco] = codigo;
    state.nombresCuentasPorBanco[banco] = nombre;

    const input = document.querySelector(`input[data-banco-idx="${idx}"]`);
    if (input) {
        input.value = `${codigo} - ${nombre}`;
        input.style.borderColor = '#4caf50';
        input.style.background = '#e8f5e9';
    }

    const dropdown = document.getElementById(`dropdown-banco-${idx}`);
    if (dropdown) {
        dropdown.classList.add('hidden');
    }

    console.log(`Banco ${banco} → Cuenta ${codigo} - ${nombre}`);
}

function handleBancoCuentaInputKeydown(e, idx, banco) {
    const dropdown = document.getElementById(`dropdown-banco-${idx}`);
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const items = dropdown.querySelectorAll('.dropdown-item');
    if (items.length === 0) return;

    const currentActive = dropdown.querySelector('.dropdown-item.active');
    let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
            items[currentIndex].click();
        }
        return;
    } else if (e.key === 'Escape') {
        e.preventDefault();
        dropdown.classList.add('hidden');
        return;
    } else {
        return;
    }

    items.forEach(item => item.classList.remove('active'));
    if (items[currentIndex]) {
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
}

// ============================================
// RENDERIZADO DE LISTA DE GRUPOS
// ============================================
function renderGroupsList() {
    // PARA REGISTROS: Renderizar interfaz de descripciones únicas
    if (state.sourceType === 'registros') {
        renderDescripcionesUnicas();
        return;
    }

    // PARA VEPs: Renderizar interfaz de asignación por código de impuesto
    if (state.sourceType === 'veps') {
        renderAsignacionVeps();
        return;
    }

    // PARA OTROS TIPOS: Renderizar interfaz estándar de grupos
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
            <div class="group-item ${classType} ${state.selectedGroups[idx] ? 'group-selected' : ''}">
                <div class="group-main-row">
                    <input type="checkbox"
                           class="group-checkbox"
                           id="groupCheckbox-${idx}"
                           ${state.selectedGroups[idx] ? 'checked' : ''}
                           onchange="toggleGroupSelection(${idx})"
                           title="Seleccionar grupo completo">
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
// RENDERIZADO DE DESCRIPCIONES ÚNICAS (REGISTROS)
// ============================================
function renderDescripcionesUnicas() {
    const numAsientos = state.groupedData.length;
    const numDescripciones = state.descripcionesUnicas ? state.descripcionesUnicas.length : 0;

    elements.groupStats.textContent = `${numAsientos} asientos | ${numDescripciones} descripciones únicas de contrapartida`;

    // Ocultar sección de cuenta de contrapartida global (no se usa para registros)
    elements.bankAccountSection.classList.add('hidden');
    elements.compensacionesInfo.classList.add('hidden');

    // Información explicativa
    let html = `
        <div class="descripcion-info-box" style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
            <h3 style="margin: 0 0 8px 0; color: #1976d2;">📋 Asignación por Descripción de Cuenta</h3>
            <p style="margin: 0; color: #333;">
                Se encontraron <strong>${numDescripciones} descripciones únicas</strong> de cuentas de contrapartida.
                Asigne una cuenta contable a cada descripción y se aplicará automáticamente a <strong>todos los asientos</strong> que la contengan.
            </p>
        </div>
    `;

    // Renderizar cada descripción única
    if (state.descripcionesUnicas && state.descripcionesUnicas.length > 0) {
        html += state.descripcionesUnicas.map((desc, idx) => {
            const cuentaAsignada = state.cuentasPorDescripcion[desc.descripcion] || '';
            const nombreCuenta = state.nombresCuentasPorDescripcion?.[desc.descripcion] || '';

            // Si hay cuenta asignada y nombre, mostrar formato completo
            let valorInput = cuentaAsignada;
            if (cuentaAsignada && nombreCuenta) {
                valorInput = `${cuentaAsignada} - ${nombreCuenta}`;
            }

            return `
                <div class="descripcion-item" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: flex-start; gap: 16px;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <strong style="color: #1976d2; font-size: 15px;">${desc.descripcion}</strong>
                                <span class="badge" style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                                    Aparece en ${desc.count} ${desc.count === 1 ? 'asiento' : 'asientos'}
                                </span>
                            </div>
                            <div style="color: #666; font-size: 13px;">
                                Total: $${desc.totalImporte.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style="min-width: 400px;">
                            <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Cuenta contable</label>
                            <div class="input-with-dropdown">
                                <input
                                    type="text"
                                    class="input-text descripcion-cuenta-input"
                                    data-descripcion="${desc.descripcion}"
                                    data-desc-idx="${idx}"
                                    value="${valorInput}"
                                    placeholder="${getSelectedClientId() ? '🔍 Buscar cuenta por código o nombre...' : 'Código de cuenta'}"
                                    style="width: 100%; padding: 0.75rem; font-size: 0.95rem;"
                                >
                                <div class="account-dropdown hidden" id="dropdown-desc-${idx}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        html += `
            <div style="padding: 40px; text-align: center; color: #999;">
                <p>No se encontraron descripciones de contrapartida.</p>
            </div>
        `;
    }

    elements.groupsList.innerHTML = html;

    // Attach event listeners a los inputs de descripción
    document.querySelectorAll('.descripcion-cuenta-input').forEach(input => {
        const descripcion = input.dataset.descripcion;
        const idx = parseInt(input.dataset.descIdx);

        // Guardar cambios en tiempo real
        input.addEventListener('input', (e) => {
            const valor = e.target.value.trim();
            state.cuentasPorDescripcion[descripcion] = valor;

            if (getSelectedClientId() && valor.length > 0) {
                handleDescripcionAccountInputChange(idx, descripcion);
            }
        });

        // Mostrar dropdown al enfocar
        input.addEventListener('focus', () => {
            if (getSelectedClientId()) {
                state.activeSearchField = `desc-${idx}`;
                showDescripcionAccountDropdown(idx, descripcion);
            }
        });

        // Navegación por teclado
        input.addEventListener('keydown', (e) => {
            handleDescripcionAccountInputKeydown(e, idx, descripcion);
        });
    });
}

// ============================================
// FUNCIONES DE BÚSQUEDA PARA DESCRIPCIONES
// ============================================
function handleDescripcionAccountInputChange(idx, descripcion) {
    const input = document.querySelector(`input[data-desc-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-desc-${idx}`);

    if (!dropdown) return;

    if (searchTerm.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    // Filtrar plan de cuentas
    const filteredAccounts = state.planCuentas.filter(account => {
        const codigo = String(account.codigo || '').toUpperCase();
        const nombre = String(account.nombre || '').toUpperCase();
        return codigo.includes(searchTerm) || nombre.includes(searchTerm);
    }).slice(0, 50);

    if (filteredAccounts.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = filteredAccounts.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectDescripcionAccount('${descripcion}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function showDescripcionAccountDropdown(idx, descripcion) {
    const input = document.querySelector(`input[data-desc-idx="${idx}"]`);
    if (!input) return;

    const searchTerm = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(`dropdown-desc-${idx}`);

    if (!dropdown) return;

    if (state.planCuentas.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No hay plan de cuentas cargado</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    let accountsToShow = state.planCuentas;
    if (searchTerm.length > 0) {
        accountsToShow = accountsToShow.filter(account => {
            const codigo = String(account.codigo || '').toUpperCase();
            const nombre = String(account.nombre || '').toUpperCase();
            return codigo.includes(searchTerm) || nombre.includes(searchTerm);
        });
    }

    accountsToShow = accountsToShow.slice(0, 50);

    if (accountsToShow.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item-empty">No se encontraron cuentas</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = accountsToShow.map((account, i) => `
        <div class="dropdown-item" data-index="${i}" onclick="selectDescripcionAccount('${descripcion}', ${idx}, '${account.codigo}', '${account.nombre.replace(/'/g, "\\'")}')">
            <strong>${account.codigo}</strong> - ${account.nombre}
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}

function selectDescripcionAccount(descripcion, idx, codigo, nombre) {
    // Guardar la cuenta y el nombre en el mapa de descripciones
    state.cuentasPorDescripcion[descripcion] = codigo;

    // Guardar también el nombre de la cuenta para uso posterior
    if (!state.nombresCuentasPorDescripcion) {
        state.nombresCuentasPorDescripcion = {};
    }
    state.nombresCuentasPorDescripcion[descripcion] = nombre;

    // Actualizar el input mostrando CÓDIGO - DESCRIPCIÓN
    const input = document.querySelector(`input[data-desc-idx="${idx}"]`);
    if (input) {
        input.value = `${codigo} - ${nombre}`;

        // Agregar feedback visual de éxito
        input.style.borderColor = '#4caf50';
        input.style.borderWidth = '2px';
        input.style.background = '#e8f5e9';
        input.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 20 20\'%3E%3Cpath fill=\'%234caf50\' d=\'M0 11l2-2 5 5L18 3l2 2L7 18z\'/%3E%3C/svg%3E")';
        input.style.backgroundRepeat = 'no-repeat';
        input.style.backgroundPosition = 'right 10px center';
        input.style.paddingRight = '35px';
    }

    // Ocultar dropdown
    const dropdown = document.getElementById(`dropdown-desc-${idx}`);
    if (dropdown) {
        dropdown.classList.add('hidden');
    }

    // Mostrar feedback visual
    console.log(`Asignado: "${descripcion}" → Cuenta ${codigo} - ${nombre}`);
}

function handleDescripcionAccountInputKeydown(e, idx, descripcion) {
    const dropdown = document.getElementById(`dropdown-desc-${idx}`);
    if (!dropdown || dropdown.classList.contains('hidden')) return;

    const items = dropdown.querySelectorAll('.dropdown-item');
    if (items.length === 0) return;

    const currentActive = dropdown.querySelector('.dropdown-item.active');
    let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
            items[currentIndex].click();
        }
        return;
    } else if (e.key === 'Escape') {
        e.preventDefault();
        dropdown.classList.add('hidden');
        return;
    } else {
        return;
    }

    // Actualizar clase active
    items.forEach(item => item.classList.remove('active'));
    if (items[currentIndex]) {
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
}

// Cerrar dropdowns al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-with-dropdown')) {
        document.querySelectorAll('.account-dropdown').forEach(dropdown => {
            dropdown.classList.add('hidden');
        });
    }
});

// ============================================
// EXPANSIÓN DE GRUPOS
// ============================================
function toggleGroupExpansion(idx) {
    state.expandedGroups[idx] = !state.expandedGroups[idx];
    renderGroupsList();
}

function expandirTodos() {
    state.groupedData.forEach((_, idx) => {
        state.expandedGroups[idx] = true;
    });
    renderGroupsList();
}

function colapsarTodos() {
    state.groupedData.forEach((_, idx) => {
        state.expandedGroups[idx] = false;
    });
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

/**
 * Elimina grupos que no tienen movimientos (items vacíos)
 * También limpia las referencias de selectedItems y expandedGroups
 */
function eliminarGruposVacios() {
    // Iterar en reversa para evitar problemas al eliminar elementos
    for (let i = state.groupedData.length - 1; i >= 0; i--) {
        const grupo = state.groupedData[i];

        // Si el grupo no tiene items o el array está vacío
        if (!grupo.items || grupo.items.length === 0) {
            // Eliminar el grupo
            state.groupedData.splice(i, 1);

            // Limpiar referencias en selectedItems
            if (state.selectedItems[i]) {
                delete state.selectedItems[i];
            }

            // Limpiar referencias en expandedGroups
            if (state.expandedGroups[i]) {
                delete state.expandedGroups[i];
            }

            // Actualizar índices en selectedItems y expandedGroups
            // Los grupos posteriores ahora tienen un índice menor
            const newSelectedItems = {};
            const newExpandedGroups = {};

            Object.keys(state.selectedItems).forEach(key => {
                const idx = parseInt(key);
                if (idx > i) {
                    newSelectedItems[idx - 1] = state.selectedItems[key];
                } else if (idx < i) {
                    newSelectedItems[idx] = state.selectedItems[key];
                }
            });

            Object.keys(state.expandedGroups).forEach(key => {
                const idx = parseInt(key);
                if (idx > i) {
                    newExpandedGroups[idx - 1] = state.expandedGroups[key];
                } else if (idx < i) {
                    newExpandedGroups[idx] = state.expandedGroups[key];
                }
            });

            state.selectedItems = newSelectedItems;
            state.expandedGroups = newExpandedGroups;
        }
    }
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

    // Eliminar grupos vacíos automáticamente
    eliminarGruposVacios();

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

    // Eliminar grupos vacíos automáticamente
    eliminarGruposVacios();

    // Re-renderizar
    renderGroupsList();

    alert(`Grupo "${newGroupName}" creado con ${selectedItems.length} movimiento${selectedItems.length > 1 ? 's' : ''}.`);
}

// ============================================
// FUSIÓN DE GRUPOS COMPLETOS
// ============================================

/**
 * Alterna la selección de un grupo completo
 */
function toggleGroupSelection(groupIdx) {
    state.selectedGroups[groupIdx] = !state.selectedGroups[groupIdx];
    actualizarContadorGrupos();
    renderGroupsList();
}

/**
 * Actualiza el contador de grupos seleccionados y habilita/deshabilita botones
 */
function actualizarContadorGrupos() {
    const selectedCount = Object.values(state.selectedGroups).filter(v => v).length;
    const countElement = document.getElementById('selectedGroupsCount');
    const mergeControls = document.getElementById('groupMergeControls');
    const btnMergeToNew = document.getElementById('btnMergeToNew');
    const btnMergeToExisting = document.getElementById('btnMergeToExisting');

    if (countElement) {
        countElement.textContent = `${selectedCount} grupo${selectedCount !== 1 ? 's' : ''} seleccionado${selectedCount !== 1 ? 's' : ''}`;
    }

    // Mostrar/ocultar controles de fusión
    if (mergeControls) {
        if (selectedCount > 0) {
            mergeControls.classList.remove('hidden');
        } else {
            mergeControls.classList.add('hidden');
        }
    }

    // Habilitar/deshabilitar botones (se necesitan al menos 2 grupos)
    const canMerge = selectedCount >= 2;
    if (btnMergeToNew) {
        btnMergeToNew.disabled = !canMerge;
    }
    if (btnMergeToExisting) {
        btnMergeToExisting.disabled = !canMerge;
    }
}

/**
 * Fusiona los grupos seleccionados en un nuevo grupo
 */
function fusionarEnNuevoGrupo() {
    const selectedIndices = Object.entries(state.selectedGroups)
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx));

    if (selectedIndices.length < 2) {
        alert('Debes seleccionar al menos 2 grupos para fusionar.');
        return;
    }

    // Pedir nombre del nuevo grupo
    const newGroupName = prompt('Ingresa el nombre del nuevo grupo:', 'Grupo Fusionado');
    if (!newGroupName || !newGroupName.trim()) {
        return;
    }

    // Crear nuevo grupo con todos los movimientos de los grupos seleccionados
    const newGroup = {
        concepto: newGroupName.trim(),
        ejemploCompleto: '',
        count: 0,
        totalDebe: 0,
        totalHaber: 0,
        items: []
    };

    // Recopilar todos los movimientos de los grupos seleccionados
    selectedIndices.forEach(idx => {
        const group = state.groupedData[idx];
        if (group && group.items) {
            // Agregar todos los items al nuevo grupo
            group.items.forEach(item => {
                newGroup.items.push(item);

                const debe = parseAmount(item['Débito'] || item['DEBE'] || 0);
                const haber = parseAmount(item['Crédito'] || item['HABER'] || item['Haber'] || 0);

                newGroup.totalDebe += debe;
                newGroup.totalHaber += haber;
                newGroup.count++;
            });
        }
    });

    // Establecer ejemplo completo del primer item
    if (newGroup.items.length > 0) {
        newGroup.ejemploCompleto = newGroup.items[0]['Descripción']
            || newGroup.items[0]['Leyenda']
            || newGroup.items[0]['CONCEPTO']
            || newGroupName.trim();
    }

    // Agregar nuevo grupo
    state.groupedData.push(newGroup);

    // Eliminar grupos seleccionados (en orden inverso para no afectar índices)
    selectedIndices.sort((a, b) => b - a).forEach(idx => {
        state.groupedData.splice(idx, 1);
    });

    // Limpiar selección de grupos
    state.selectedGroups = {};

    // Eliminar grupos vacíos por si acaso
    eliminarGruposVacios();

    // Re-renderizar
    renderGroupsList();
    actualizarContadorGrupos();

    alert(`✅ Grupos fusionados exitosamente en "${newGroupName}".\n${newGroup.count} movimientos en el nuevo grupo.`);
}

/**
 * Muestra opciones para fusionar en grupo existente
 */
function mostrarOpcionesFusionExistente() {
    const selectedIndices = Object.entries(state.selectedGroups)
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx));

    if (selectedIndices.length < 2) {
        alert('Debes seleccionar al menos 2 grupos para fusionar.');
        return;
    }

    // Obtener grupos NO seleccionados
    const availableGroups = state.groupedData
        .map((g, idx) => ({ group: g, idx }))
        .filter(({ idx }) => !state.selectedGroups[idx]);

    if (availableGroups.length === 0) {
        alert('No hay grupos disponibles como destino. Todos los grupos están seleccionados.');
        return;
    }

    // Crear modal con opciones
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Selecciona el grupo destino</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <p style="color: #64748b; margin-bottom: 16px;">
                Fusionar ${selectedIndices.length} grupos en:
            </p>
            <div style="max-height: 400px; overflow-y: auto;">
                ${availableGroups.map(({ group, idx }) => `
                    <div class="group-option" onclick="fusionarEnGrupoExistente(${idx})">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                            ${group.concepto}
                        </div>
                        <div style="font-size: 13px; color: #64748b;">
                            ${group.count} movimientos | Debe: $${group.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | Haber: $${group.totalHaber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Cerrar modal al hacer click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Fusiona los grupos seleccionados en un grupo existente
 */
function fusionarEnGrupoExistente(targetGroupIdx) {
    // Cerrar modal
    document.querySelector('.modal')?.remove();

    const selectedIndices = Object.entries(state.selectedGroups)
        .filter(([_, isSelected]) => isSelected)
        .map(([idx, _]) => parseInt(idx));

    if (selectedIndices.length < 2) {
        alert('Debes seleccionar al menos 2 grupos para fusionar.');
        return;
    }

    const targetGroup = state.groupedData[targetGroupIdx];
    if (!targetGroup) {
        alert('Grupo destino no encontrado.');
        return;
    }

    let totalMovimientos = 0;

    // Mover todos los movimientos de los grupos seleccionados al grupo destino
    selectedIndices.forEach(idx => {
        const sourceGroup = state.groupedData[idx];
        if (sourceGroup && sourceGroup.items && idx !== targetGroupIdx) {
            sourceGroup.items.forEach(item => {
                targetGroup.items.push(item);

                const debe = parseAmount(item['Débito'] || item['DEBE'] || 0);
                const haber = parseAmount(item['Crédito'] || item['HABER'] || item['Haber'] || 0);

                targetGroup.totalDebe += debe;
                targetGroup.totalHaber += haber;
                targetGroup.count++;
                totalMovimientos++;
            });
        }
    });

    // Eliminar grupos seleccionados (en orden inverso)
    selectedIndices.sort((a, b) => b - a).forEach(idx => {
        if (idx !== targetGroupIdx) {
            state.groupedData.splice(idx, 1);
        }
    });

    // Limpiar selección de grupos
    state.selectedGroups = {};

    // Eliminar grupos vacíos
    eliminarGruposVacios();

    // Re-renderizar
    renderGroupsList();
    actualizarContadorGrupos();

    alert(`✅ Grupos fusionados exitosamente en "${targetGroup.concepto}".\n${totalMovimientos} movimientos agregados.`);
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

    // VALIDACIÓN ESPECÍFICA PARA REGISTROS DEL CLIENTE
    if (state.sourceType === 'registros') {
        // Validar que todas las descripciones únicas tengan cuenta asignada
        if (state.descripcionesUnicas && state.descripcionesUnicas.length > 0) {
            state.descripcionesUnicas.forEach(desc => {
                const cuentaAsignada = state.cuentasPorDescripcion[desc.descripcion];
                if (!cuentaAsignada || cuentaAsignada.trim() === '') {
                    errors.push(`Falta asignar cuenta para: "${desc.descripcion}"`);
                }
            });
        }
    } else if (state.sourceType === 'veps') {
        // VALIDACIÓN ESPECÍFICA PARA VEPs
        // Validar que todos los códigos de impuesto tengan cuenta asignada
        if (state.impuestosUnicos && state.impuestosUnicos.length > 0) {
            state.impuestosUnicos.forEach(imp => {
                const cuentaAsignada = state.cuentasPorImpuesto?.[imp.codigo] || state.mapeoImpuestos?.[imp.codigo]?.codigo;
                if (!cuentaAsignada || cuentaAsignada.trim() === '') {
                    errors.push(`Impuesto "${imp.codigo} - ${imp.descripcion}": falta asignar cuenta`);
                }
            });
        }

        // Validar que todos los bancos tengan cuenta asignada
        if (state.bancosUnicos && state.bancosUnicos.length > 0) {
            state.bancosUnicos.forEach(banco => {
                const cuentaAsignada = state.cuentasPorBanco?.[banco.nombre];
                if (!cuentaAsignada || cuentaAsignada.trim() === '') {
                    errors.push(`Banco "${banco.nombre}": falta asignar cuenta`);
                }
            });
        }
    } else {
        // VALIDACIÓN PARA OTROS TIPOS DE ORIGEN
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
    }

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

    // NUEVA LÓGICA: Diferenciamos el tratamiento de registros del cliente
    state.groupedData.forEach((g, idx) => {
        const cuentaGrupo = state.accountCodes[idx] || '';

        // REGISTROS DEL CLIENTE: Lógica especial - UN asiento por grupo (número interno)
        // CADA LÍNEA usa la cuenta asignada según su DESC_CTA
        if (state.sourceType === 'registros') {
            if (g.items.length === 0) return;

            // Obtener información del primer item para datos comunes del asiento
            const primeraLinea = g.items[0];
            const fecha = primeraLinea['FECHA'] || primeraLinea['Fecha'] || '';
            const concepto = primeraLinea['CONCEPTO'] || primeraLinea['Concepto'] || '';
            const nComp = primeraLinea['N_COMP'] || primeraLinea['N_Comp'] || '';
            const razonSocial = primeraLinea['RAZON SOCIAL'] || primeraLinea['RAZON_SOCIAL'] ||
                               primeraLinea['Razon Social'] || primeraLinea['PROVEEDOR'] || '';

            // Descripción principal del asiento (para las líneas principales)
            const descripcionPrincipal = [concepto, nComp, razonSocial].filter(Boolean).join(' / ');

            // Generar las líneas del asiento - cada línea del archivo se convierte en una línea del asiento
            g.items.forEach((item, itemIdx) => {
                const debe = parseAmount(item['DEBE']);
                const haber = parseAmount(item['HABER']);
                const descCta = String(item['DESC_CTA'] || item['Desc_Cta'] || item['desc_cta'] || '').trim();

                // Determinar la cuenta contable según DESC_CTA
                let cuentaLinea = '';
                let descripcionLinea = '';

                if (descCta) {
                    // Esta línea tiene DESC_CTA: buscar la cuenta asignada para esta descripción
                    cuentaLinea = state.cuentasPorDescripcion[descCta] || '';
                    descripcionLinea = descCta;

                    // Si no hay cuenta asignada para este DESC_CTA, mostrar error
                    if (!cuentaLinea) {
                        console.error(`No se encontró cuenta asignada para DESC_CTA: "${descCta}"`);
                        cuentaLinea = ''; // Esto causará un error de validación
                    }
                } else {
                    // Esta línea NO tiene DESC_CTA: es la línea principal del asiento
                    // No agregar ninguna cuenta (estas líneas no se deben procesar)
                    // En el formato de registros del cliente, todas las líneas deberían tener DESC_CTA
                    console.warn(`Línea sin DESC_CTA en asiento ${g.concepto}:`, item);
                    return; // Saltar esta línea
                }

                // Solo agregar si tiene importe
                if (debe > 0 || haber > 0) {
                    const importeNeto = parseFloat((debe - haber).toFixed(2));

                    // Obtener el nombre de la cuenta desde el mapa de nombres (para vista previa)
                    let nombreCuenta = '';
                    if (descCta && state.nombresCuentasPorDescripcion) {
                        nombreCuenta = state.nombresCuentasPorDescripcion[descCta] || '';
                    }

                    // Generar leyenda con formato: N_COMP / PROVEEDOR
                    const leyendaParts = [];
                    if (nComp) leyendaParts.push(nComp);
                    if (razonSocial) leyendaParts.push(razonSocial);
                    const leyenda = leyendaParts.join(' / ');

                    allData.push({
                        Fecha: fecha,
                        Numero: numeroAsiento,
                        Cuenta: cuentaLinea,
                        'Descripción Cuenta': nombreCuenta,
                        Debe: parseFloat(debe.toFixed(2)),
                        Haber: parseFloat(haber.toFixed(2)),
                        'Tipo de auxiliar': 1,
                        Auxiliar: 1,
                        Importe: importeNeto,
                        Leyenda: leyenda,
                        ExtraContable: 's'
                    });
                }
            });

            numeroAsiento++;
            return; // No continuar con la lógica genérica
        }

        // LÓGICA ESPECÍFICA PARA VEPs: Un asiento por VEP (con múltiples líneas)
        // NUEVA LÓGICA: Usa asignaciones por código de impuesto y por banco
        if (state.sourceType === 'veps') {
            if (g.items.length === 0) return;

            const primeraLinea = g.items[0];
            const fecha = primeraLinea['FECHA'] || primeraLinea['Fecha'] || '';
            const nroVep = g.nroVep || primeraLinea['NRO_VEP'] || primeraLinea['Nro_VEP'] || '';
            const periodo = g.periodo || primeraLinea['PERIODO'] || primeraLinea['Periodo'] || '';
            const entidadPago = g.entidadPago || primeraLinea['ENTIDAD_PAGO'] || primeraLinea['Entidad_Pago'] || '';

            let totalVep = 0;

            // LEYENDA UNIFORME para TODAS las líneas del asiento (DEBE y HABER)
            // Formato: "Pago VEP [NUMERO_VEP] / [PERIODO] / [BANCO]"
            const leyendaUniforme = `Pago VEP ${nroVep} / ${periodo}${entidadPago ? ` / ${entidadPago}` : ''}`;

            // TODAS las líneas de DÉBITO (impuestos) van con el MISMO número de asiento
            g.items.forEach(item => {
                const codImpuesto = item['COD_IMPUESTO'] || item['Cod_Impuesto'] || item['cod_impuesto'] || '';
                const importe = parseAmount(item['IMPORTE']);

                // Sumar al total del VEP para la contrapartida bancaria
                totalVep += importe;

                // ASIGNACIÓN DE CUENTA POR CÓDIGO DE IMPUESTO (nueva lógica)
                let cuentaImpuesto = '';
                let descripcionCuenta = '';

                // 1. Primero buscar en cuentasPorImpuesto (asignación manual del usuario)
                if (codImpuesto && state.cuentasPorImpuesto && state.cuentasPorImpuesto[codImpuesto]) {
                    cuentaImpuesto = state.cuentasPorImpuesto[codImpuesto];
                    descripcionCuenta = state.nombresCuentasPorImpuesto?.[codImpuesto] || '';
                    console.log(`✅ Cuenta asignada (manual): Cod.${codImpuesto} → ${cuentaImpuesto} (${descripcionCuenta})`);
                }
                // 2. Fallback a mapeoImpuestos (asignación automática del plan de cuentas)
                else if (codImpuesto && state.mapeoImpuestos && state.mapeoImpuestos[codImpuesto]) {
                    cuentaImpuesto = state.mapeoImpuestos[codImpuesto].codigo;
                    descripcionCuenta = state.mapeoImpuestos[codImpuesto].nombre;
                    console.log(`✅ Cuenta asignada (automática): Cod.${codImpuesto} → ${cuentaImpuesto} (${descripcionCuenta})`);
                }

                // Línea de débito (pago de impuesto)
                allData.push({
                    Fecha: fecha,
                    Numero: numeroAsiento,
                    Cuenta: cuentaImpuesto,
                    'Descripción Cuenta': descripcionCuenta,
                    Debe: parseFloat(importe.toFixed(2)),
                    Haber: 0,
                    'Tipo de auxiliar': 1,
                    Auxiliar: 1,
                    Importe: parseFloat(importe.toFixed(2)),
                    Leyenda: leyendaUniforme,
                    ExtraContable: 's',
                    COD_IMPUESTO: codImpuesto  // Guardar código de impuesto para referencia
                });
            });

            // UNA SOLA línea de CRÉDITO (contrapartida - banco)
            // NUEVA LÓGICA: Buscar cuenta asignada al banco específico
            let cuentaBanco = '';
            let descripcionBanco = '';

            // 1. Primero buscar en cuentasPorBanco (asignación por banco)
            if (entidadPago && state.cuentasPorBanco && state.cuentasPorBanco[entidadPago]) {
                cuentaBanco = state.cuentasPorBanco[entidadPago];
                descripcionBanco = state.nombresCuentasPorBanco?.[entidadPago] || '';
                console.log(`✅ Banco asignado: ${entidadPago} → ${cuentaBanco} (${descripcionBanco})`);
            }
            // 2. Fallback a contrapartida global (si existe)
            else if (contrapartida) {
                cuentaBanco = contrapartida;
            }

            // Línea de crédito (banco) - usa la misma leyenda uniforme
            allData.push({
                Fecha: fecha,
                Numero: numeroAsiento,
                Cuenta: cuentaBanco,
                'Descripción Cuenta': descripcionBanco,
                Debe: 0,
                Haber: parseFloat(totalVep.toFixed(2)),
                'Tipo de auxiliar': 1,
                Auxiliar: 1,
                Importe: parseFloat((-totalVep).toFixed(2)),
                Leyenda: leyendaUniforme,
                ExtraContable: 's'
            });

            numeroAsiento++;
            return; // No continuar con la lógica genérica
        }

        // LÓGICA GENÉRICA para otros tipos de origen
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
                    // Importe negativo: cuenta_grupo al DEBE, contrapartida al HABER
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
                } else {
                    // Importe positivo: cuenta_grupo al HABER, contrapartida al DEBE
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
        // Mostrar advertencia al usuario sobre asientos desbalanceados
        const maxErrors = 5;
        let warnMsg = `⚠️ ADVERTENCIA: Se encontraron ${partidaDobleErrors.length} asiento(s) desbalanceado(s):\n\n`;
        warnMsg += partidaDobleErrors.slice(0, maxErrors).map(e => `• ${e}`).join('\n');
        if (partidaDobleErrors.length > maxErrors) {
            warnMsg += `\n\n... y ${partidaDobleErrors.length - maxErrors} más.`;
        }
        warnMsg += '\n\nLos asientos desbalanceados pueden causar errores al importar. Revise los datos antes de continuar.';
        alert(warnMsg);
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

        // Generar leyenda con formato: N_COMP / PROVEEDOR
        const leyendaParts = [];
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
                ['NRO_VEP', 'FECHA', 'PERIODO', 'COD_IMPUESTO', 'IMPUESTO', 'COD_CONCEPTO', 'CONCEPTO', 'COD_SUBCONCEPTO', 'SUBCONCEPTO', 'IMPORTE', 'ENTIDAD_PAGO'],
                ['12345678', '15/01/2025', '2024/12', '30', 'IVA', '19', 'DECLARACIÓN JURADA', '19', 'IMPUESTO DETERMINADO', 50000, 'BANCO NACIÓN'],
                ['12345678', '15/01/2025', '2024/12', '30', 'IVA', '19', 'DECLARACIÓN JURADA', '51', 'INTERESES RESARCITORIOS', 1500, 'BANCO NACIÓN'],
                ['87654321', '20/01/2025', '2024/12', '30', 'GANANCIAS SOCIEDADES', '19', 'ANTICIPO', '19', 'IMPUESTO DETERMINADO', 25000, 'BANCO GALICIA']
            ];
            fileName = 'plantilla_veps_arca.xlsx';
            instrucciones = [
                ['PLANTILLA VEPs ARCA - Formato del Conversor de VEPs'],
                [''],
                ['FLUJO RECOMENDADO:'],
                ['1. Usar el Conversor de VEPs ARCA para convertir PDFs a Excel'],
                ['2. Usar ese Excel aquí para generar los asientos contables'],
                [''],
                ['Columnas del formato (generadas automáticamente por el conversor):'],
                ['- NRO_VEP: Número de VEP'],
                ['- FECHA: Fecha de pago (DD/MM/YYYY)'],
                ['- PERIODO: Período fiscal (YYYY/MM)'],
                ['- COD_IMPUESTO: Código del impuesto'],
                ['- IMPUESTO: Nombre del impuesto'],
                ['- COD_CONCEPTO: Código del concepto'],
                ['- CONCEPTO: Concepto de pago'],
                ['- COD_SUBCONCEPTO: Código de subconcepto'],
                ['- SUBCONCEPTO: Descripción del subconcepto'],
                ['- IMPORTE: Monto a pagar'],
                ['- ENTIDAD_PAGO: Banco o entidad de pago'],
                [''],
                ['Los VEPs se agrupan por impuesto y concepto']
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
                ['• IMPORTE NEGATIVO → va a columna DEBE'],
                ['  Ejemplo: -50000 se convierte en Debe: 50000'],
                ['  (representa salidas de dinero: pagos, gastos, débitos en banco)'],
                [''],
                ['• IMPORTE POSITIVO → va a columna HABER'],
                ['  Ejemplo: 80000 se convierte en Haber: 80000'],
                ['  (representa entradas de dinero: cobros, ingresos, créditos en banco)'],
                [''],
                ['El sistema usa el valor absoluto (sin el signo negativo).'],
                [''],
                ['EJEMPLOS:'],
                ['-50000 (Pago proveedores) → Debe: 50.000,00'],
                ['+80000 (Cobro clientes) → Haber: 80.000,00'],
                ['-12500 (Compra insumos) → Debe: 12.500,00'],
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

    // Aplicar formato argentino a las columnas numéricas
    // Para SOS Contador, el encabezado está en la fila 6 (índice 6)
    const headerRowIndex = state.sourceType === 'soscontador' ? 6 : 0;
    aplicarFormatoArgentino(wsDatos, headerRowIndex);

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
            <td class="descripcion-cuenta-col" style="color: #666; font-size: 0.9em;">${r['Descripción Cuenta'] || ''}</td>
            <td class="text-right debe-col">${r.Debe > 0 ? r.Debe.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="text-right haber-col">${r.Haber > 0 ? r.Haber.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="leyenda-col">${r.Leyenda}</td>
        </tr>
    `).join('');

    elements.previewTableBody.innerHTML = html;
}

/**
 * Valida el balance de los asientos generados
 * @returns {Array} Array de asientos desbalanceados con movimientos incluidos
 */
function validarBalance() {
    const asientosDesbalanceados = [];

    // Agrupar movimientos por número de asiento
    const asientosPorNumero = {};

    state.finalData.forEach((mov, index) => {
        const numero = mov.Numero;
        if (!asientosPorNumero[numero]) {
            asientosPorNumero[numero] = {
                numero: numero,
                fecha: mov.Fecha,
                leyenda: mov.Leyenda,
                movimientos: []
            };
        }
        // Guardar el movimiento con su índice en finalData para poder editarlo
        asientosPorNumero[numero].movimientos.push({
            ...mov,
            finalDataIndex: index
        });
    });

    // Validar balance de cada asiento
    Object.values(asientosPorNumero).forEach(asiento => {
        let totalDebito = 0;
        let totalCredito = 0;

        asiento.movimientos.forEach(mov => {
            totalDebito += parseFloat(mov.Debe || 0);
            totalCredito += parseFloat(mov.Haber || 0);
        });

        const diferencia = Math.abs(totalDebito - totalCredito);

        // Tolerancia de 1 centavo por redondeo
        if (diferencia > 0.01) {
            asientosDesbalanceados.push({
                numero: asiento.numero,
                fecha: asiento.fecha,
                leyenda: asiento.leyenda,
                totalDebito: totalDebito,
                totalCredito: totalCredito,
                diferencia: diferencia,
                cantidadMovimientos: asiento.movimientos.length,
                movimientos: asiento.movimientos // Incluir movimientos para edición
            });
        }
    });

    return asientosDesbalanceados;
}

/**
 * Muestra el modal con los asientos desbalanceados con capacidad de edición
 * @param {Array} desbalanceados - Array de asientos desbalanceados
 */
function mostrarModalDesbalance(desbalanceados) {
    const modal = document.getElementById('modalDesbalance');
    const lista = document.getElementById('listaDesbalance');

    let html = '';
    desbalanceados.forEach((asiento, asientoIndex) => {
        html += `
            <div class="asiento-desbalanceado" id="asiento-${asiento.numero}" style="border: 2px solid #f44336; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; background: #ffebee;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <strong style="font-size: 1.1rem;">Asiento #${asiento.numero}: ${asiento.leyenda || 'Sin leyenda'}</strong>
                        <div id="balance-info-${asiento.numero}" style="margin-top: 0.5rem; font-size: 0.9rem;">
                            <span>Total Débito: <strong>$${asiento.totalDebito.toFixed(2)}</strong></span> |
                            <span>Total Crédito: <strong>$${asiento.totalCredito.toFixed(2)}</strong></span> |
                            <span style="color: #f44336; font-weight: bold;">Diferencia: $${asiento.diferencia.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- Tabla de movimientos editables -->
                <div style="background: white; border-radius: 6px; padding: 1rem; max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                                <th style="padding: 0.5rem; text-align: left;">Fecha</th>
                                <th style="padding: 0.5rem; text-align: left;">Cuenta</th>
                                <th style="padding: 0.5rem; text-align: left;">Leyenda</th>
                                <th style="padding: 0.5rem; text-align: right;">Debe</th>
                                <th style="padding: 0.5rem; text-align: right;">Haber</th>
                                <th style="padding: 0.5rem; text-align: center; width: 60px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="movimientos-${asiento.numero}">
                            ${generarFilasMovimientos(asiento.movimientos, asiento.numero)}
                        </tbody>
                    </table>

                    <button onclick="agregarMovimientoDesbalance('${asiento.numero}')"
                            class="btn-secondary"
                            style="margin-top: 0.5rem; width: 100%; padding: 0.5rem;">
                        + Agregar Movimiento
                    </button>
                </div>

                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button onclick="recalcularBalance('${asiento.numero}')" class="btn-primary">
                        🔄 Recalcular Balance
                    </button>
                </div>
            </div>
        `;
    });

    lista.innerHTML = html;
    modal.style.display = 'flex';
}

/**
 * Cierra el modal de asientos desbalanceados
 */
function cerrarModalDesbalance() {
    const modal = document.getElementById('modalDesbalance');
    modal.style.display = 'none';
}

// Hacer la función global para que pueda ser llamada desde el onclick del HTML
window.cerrarModalDesbalance = cerrarModalDesbalance;

/**
 * Genera las filas HTML editables para los movimientos de un asiento
 * @param {Array} movimientos - Array de movimientos
 * @param {string} numeroAsiento - Número del asiento
 * @returns {string} HTML de las filas
 */
function generarFilasMovimientos(movimientos, numeroAsiento) {
    return movimientos.map((mov, movIndex) => {
        const fechaValue = mov.Fecha || '';
        const cuentaValue = mov.Cuenta || '';
        const leyendaValue = mov.Leyenda || '';
        const debeValue = mov.Debe || '';
        const haberValue = mov.Haber || '';

        return `
            <tr style="border-bottom: 1px solid #eee;" data-mov-index="${movIndex}" data-final-index="${mov.finalDataIndex}">
                <td style="padding: 0.5rem;">
                    <input type="date"
                           value="${fechaValue}"
                           onchange="actualizarMovimiento('${numeroAsiento}', ${movIndex}, 'Fecha', this.value)"
                           style="width: 100%; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px;">
                </td>
                <td style="padding: 0.5rem;">
                    <input type="text"
                           value="${cuentaValue}"
                           onchange="actualizarMovimiento('${numeroAsiento}', ${movIndex}, 'Cuenta', this.value)"
                           style="width: 100%; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px;"
                           placeholder="Código cuenta">
                </td>
                <td style="padding: 0.5rem;">
                    <input type="text"
                           value="${leyendaValue}"
                           onchange="actualizarMovimiento('${numeroAsiento}', ${movIndex}, 'Leyenda', this.value)"
                           style="width: 100%; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px;"
                           placeholder="Leyenda">
                </td>
                <td style="padding: 0.5rem;">
                    <input type="number"
                           step="0.01"
                           value="${debeValue}"
                           onchange="actualizarMovimiento('${numeroAsiento}', ${movIndex}, 'Debe', this.value)"
                           style="width: 100%; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px; text-align: right;">
                </td>
                <td style="padding: 0.5rem;">
                    <input type="number"
                           step="0.01"
                           value="${haberValue}"
                           onchange="actualizarMovimiento('${numeroAsiento}', ${movIndex}, 'Haber', this.value)"
                           style="width: 100%; padding: 0.25rem; border: 1px solid #ddd; border-radius: 4px; text-align: right;">
                </td>
                <td style="padding: 0.5rem; text-align: center;">
                    <button onclick="eliminarMovimientoDesbalance('${numeroAsiento}', ${movIndex})"
                            style="background: #f44336; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;"
                            title="Eliminar">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Actualiza un campo de un movimiento en el modal de desbalance
 * @param {string} numeroAsiento - Número del asiento
 * @param {number} movIndex - Índice del movimiento en la tabla
 * @param {string} campo - Campo a actualizar
 * @param {*} valor - Nuevo valor
 */
function actualizarMovimiento(numeroAsiento, movIndex, campo, valor) {
    console.log(`Actualizando asiento ${numeroAsiento}, movimiento ${movIndex}, campo ${campo}:`, valor);

    // Buscar el índice en finalData
    const tbody = document.getElementById(`movimientos-${numeroAsiento}`);
    const row = tbody.querySelectorAll('tr')[movIndex];
    const finalDataIndex = parseInt(row.getAttribute('data-final-index'));

    // Actualizar en state.finalData
    if (finalDataIndex !== undefined && finalDataIndex >= 0) {
        state.finalData[finalDataIndex][campo] = valor;
        console.log(`✓ Actualizado en finalData[${finalDataIndex}].${campo} = ${valor}`);
    }

    // Si se actualiza Debe o Haber, recalcular automáticamente
    if (campo === 'Debe' || campo === 'Haber') {
        recalcularBalance(numeroAsiento);
    }
}

/**
 * Recalcula el balance de un asiento y actualiza el feedback visual
 * @param {string} numeroAsiento - Número del asiento
 */
function recalcularBalance(numeroAsiento) {
    console.log(`Recalculando balance del asiento #${numeroAsiento}...`);

    // Obtener todos los movimientos de este asiento desde finalData
    const movimientos = state.finalData.filter(mov => mov.Numero == numeroAsiento);

    let totalDebito = 0;
    let totalCredito = 0;

    movimientos.forEach(mov => {
        totalDebito += parseFloat(mov.Debe || 0);
        totalCredito += parseFloat(mov.Haber || 0);
    });

    const diferencia = Math.abs(totalDebito - totalCredito);
    const balancea = diferencia < 0.01;

    console.log('Balance recalculado:', { totalDebito, totalCredito, diferencia, balancea });

    // Actualizar la vista del balance
    const balanceInfo = document.getElementById(`balance-info-${numeroAsiento}`);
    if (balanceInfo) {
        balanceInfo.innerHTML = `
            <span>Total Débito: <strong>$${totalDebito.toFixed(2)}</strong></span> |
            <span>Total Crédito: <strong>$${totalCredito.toFixed(2)}</strong></span> |
            <span style="color: ${balancea ? '#4caf50' : '#f44336'}; font-weight: bold;">
                ${balancea ? '✓ Balancea' : `Diferencia: $${diferencia.toFixed(2)}`}
            </span>
        `;
    }

    // Actualizar el contenedor del asiento
    const asientoElement = document.getElementById(`asiento-${numeroAsiento}`);
    if (asientoElement && balancea) {
        asientoElement.style.borderColor = '#4caf50';
        asientoElement.style.background = '#e8f5e9';

        // Remover de la lista de desbalanceados después de 1 segundo
        setTimeout(() => {
            asientoElement.style.opacity = '0.5';
            asientoElement.style.transition = 'opacity 0.5s';

            setTimeout(() => {
                asientoElement.remove();

                // Verificar si quedan más asientos desbalanceados
                const restantes = document.querySelectorAll('.asiento-desbalanceado');
                if (restantes.length === 0) {
                    alert('✓ Todos los asientos ahora balancean correctamente. Puede proceder a exportar.');
                    cerrarModalDesbalance();
                    // Actualizar la vista previa
                    updatePreview();
                }
            }, 500);
        }, 1000);
    }
}

/**
 * Agrega un nuevo movimiento a un asiento desbalanceado
 * @param {string} numeroAsiento - Número del asiento
 */
function agregarMovimientoDesbalance(numeroAsiento) {
    console.log(`Agregando movimiento al asiento #${numeroAsiento}`);

    // Obtener el último movimiento de este asiento para copiar algunos datos
    const movimientosExistentes = state.finalData.filter(mov => mov.Numero == numeroAsiento);
    const ultimoMov = movimientosExistentes[movimientosExistentes.length - 1];

    // Crear nuevo movimiento
    const nuevoMovimiento = {
        Fecha: ultimoMov.Fecha || new Date().toISOString().split('T')[0],
        Numero: numeroAsiento,
        Cuenta: '',
        Debe: '',
        Haber: '',
        Leyenda: ultimoMov.Leyenda || ''
    };

    // Agregar a finalData
    state.finalData.push(nuevoMovimiento);
    const nuevoIndex = state.finalData.length - 1;

    // Obtener todos los movimientos actualizados de este asiento
    const movimientosActualizados = state.finalData
        .map((mov, index) => ({ ...mov, finalDataIndex: index }))
        .filter(mov => mov.Numero == numeroAsiento);

    // Regenerar la tabla
    const tbody = document.getElementById(`movimientos-${numeroAsiento}`);
    tbody.innerHTML = generarFilasMovimientos(movimientosActualizados, numeroAsiento);

    console.log(`✓ Movimiento agregado en finalData[${nuevoIndex}]`);
}

/**
 * Elimina un movimiento de un asiento desbalanceado
 * @param {string} numeroAsiento - Número del asiento
 * @param {number} movIndex - Índice del movimiento en la tabla
 */
function eliminarMovimientoDesbalance(numeroAsiento, movIndex) {
    if (!confirm('¿Está seguro de eliminar este movimiento?')) {
        return;
    }

    console.log(`Eliminando movimiento ${movIndex} del asiento #${numeroAsiento}`);

    // Buscar el índice en finalData
    const tbody = document.getElementById(`movimientos-${numeroAsiento}`);
    const row = tbody.querySelectorAll('tr')[movIndex];
    const finalDataIndex = parseInt(row.getAttribute('data-final-index'));

    if (finalDataIndex !== undefined && finalDataIndex >= 0) {
        // Eliminar de finalData
        state.finalData.splice(finalDataIndex, 1);
        console.log(`✓ Eliminado de finalData[${finalDataIndex}]`);

        // Obtener todos los movimientos actualizados de este asiento
        const movimientosActualizados = state.finalData
            .map((mov, index) => ({ ...mov, finalDataIndex: index }))
            .filter(mov => mov.Numero == numeroAsiento);

        // Regenerar la tabla
        tbody.innerHTML = generarFilasMovimientos(movimientosActualizados, numeroAsiento);

        // Recalcular balance
        recalcularBalance(numeroAsiento);
    }
}

/**
 * Aplica formato de número argentino (coma decimal) a las columnas numéricas del Excel
 * @param {Object} ws - Hoja de trabajo de XLSX
 * @param {number} headerRow - Fila donde están los encabezados (por defecto 0)
 * @param {Array<string>} columnNames - Nombres adicionales de columnas numéricas (opcional)
 */
function aplicarFormatoArgentino(ws, headerRow = 0, columnNames = []) {
    if (!ws['!ref']) return;

    const range = XLSX.utils.decode_range(ws['!ref']);

    // Lista de columnas numéricas comunes
    const nombresColumnasNumericas = [
        'Debe', 'Haber', 'Importe',
        'DEBE', 'HABER', 'IMPORTE',
        'Débito', 'Crédito', 'Saldo',
        'Monto Debe', 'Monto Haber', 'Monto Saldo',
        ...columnNames
    ];

    // Identificar las columnas numéricas por su encabezado
    const columnasNumericas = new Map();

    // Leer encabezados
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: C });
        const cell = ws[cellAddress];

        if (cell && cell.v) {
            const header = cell.v.toString();
            // Verificar si el encabezado es una columna numérica
            if (nombresColumnasNumericas.includes(header)) {
                columnasNumericas.set(C, true);
            }
        }
    }

    // Aplicar formato a las celdas numéricas (desde fila siguiente al encabezado)
    for (let R = headerRow + 1; R <= range.e.r; ++R) {
        columnasNumericas.forEach((_, C) => {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];

            if (cell && cell.t === 'n') {  // Solo aplicar a celdas numéricas
                // Formato argentino: #.##0,00 (punto separador de miles, coma decimal)
                cell.z = '#.##0,00';
            }
        });
    }
}

/**
 * Valida todos los asientos y exporta si no hay desbalances
 */
function validarYExportar() {
    console.log('Revalidando asientos antes de exportar...');

    const desbalanceados = validarBalance();

    if (desbalanceados.length === 0) {
        console.log('✓ Todos los asientos balancean correctamente');
        cerrarModalDesbalance();

        // Actualizar la vista previa
        updatePreview();

        // Proceder con la exportación
        setTimeout(() => {
            // Filtrar la columna "Descripción Cuenta" antes de exportar
            const dataParaExportar = state.finalData.map(row => {
                const { 'Descripción Cuenta': _, ...rowSinDescripcion } = row;
                return rowSinDescripcion;
            });

            const ws = XLSX.utils.json_to_sheet(dataParaExportar);

            // Aplicar formato argentino a columnas numéricas
            aplicarFormatoArgentino(ws);

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Asientos');
            const fileName = `asientos_${state.sourceType}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            console.log('✅ Archivo Excel exportado exitosamente');
        }, 300);
    } else {
        alert(`Aún hay ${desbalanceados.length} asiento(s) desbalanceado(s). Por favor corrija antes de exportar.`);
        console.warn(`⚠️ Todavía hay ${desbalanceados.length} asientos desbalanceados`);
    }
}

// Hacer las funciones globales para que puedan ser llamadas desde el HTML
window.generarFilasMovimientos = generarFilasMovimientos;
window.actualizarMovimiento = actualizarMovimiento;
window.recalcularBalance = recalcularBalance;
window.agregarMovimientoDesbalance = agregarMovimientoDesbalance;
window.eliminarMovimientoDesbalance = eliminarMovimientoDesbalance;
window.validarYExportar = validarYExportar;

/**
 * Descarga el archivo Excel con los asientos
 * Valida el balance antes de exportar
 */
function downloadExcel() {
    // Validar balance antes de exportar
    const desbalanceados = validarBalance();

    if (desbalanceados.length > 0) {
        console.warn(`⚠️ Se encontraron ${desbalanceados.length} asiento(s) desbalanceado(s)`);
        mostrarModalDesbalance(desbalanceados);
        return; // No permitir exportar
    }

    // Si todo balancea, proceder con exportación
    // Filtrar columnas internas antes de exportar (Descripción Cuenta y COD_IMPUESTO)
    const dataParaExportar = state.finalData.map(row => {
        const { 'Descripción Cuenta': _, 'COD_IMPUESTO': __, ...rowLimpia } = row;
        return rowLimpia;
    });

    const ws = XLSX.utils.json_to_sheet(dataParaExportar);

    // Aplicar formato argentino a columnas numéricas
    aplicarFormatoArgentino(ws);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asientos');
    const fileName = `asientos_${state.sourceType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    console.log('✅ Archivo Excel exportado exitosamente');
}
