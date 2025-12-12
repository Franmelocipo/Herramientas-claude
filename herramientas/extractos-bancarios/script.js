// Configuración PDF.js
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Cliente seleccionado en este módulo
let clienteSeleccionadoId = null;
let clienteSeleccionadoNombre = '';

// Función global para parsear números en formato argentino
function parseArgentineNumber(value) {
    if (!value || value === '0' || value === '') return 0;
    // Detectar si el valor es negativo ANTES de limpiar
    const isNegative = value.toString().includes('-');
    // Limpiar el formato argentino (puntos de miles y coma decimal)
    const cleaned = value.toString().replace(/\./g, '').replace(',', '.').replace('-', '');
    const number = parseFloat(cleaned);
    // Aplicar el signo negativo si corresponde
    return isNegative ? -number : (isNaN(number) ? 0 : number);
}

// Función global para formatear números a formato argentino
function formatearNumeroArgentino(numero) {
    if (numero === null || numero === undefined || isNaN(numero)) return '-';
    return numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Estado de la aplicación
const state = {
    selectedType: '',
    selectedBank: '',
    selectedSubOption: '',  // Para bancos con sub-opciones (ej: Macro)
    file: null,
    extractedData: [],
    saldoInicial: null,
    isProcessing: false
};

// ============================================
// FUNCIONES PARA SELECTOR DE CLIENTE
// ============================================

async function cargarClientesEnSelector() {
    const select = document.getElementById('selector-cliente-extractos');
    if (!select) return;

    try {
        // Esperar a que Supabase esté disponible usando la función global o esperando la variable
        let supabaseClient = null;

        // Intentar usar waitForSupabase si está disponible, sino esperar la variable global
        if (typeof waitForSupabase === 'function') {
            supabaseClient = await waitForSupabase();
        } else {
            // Fallback: esperar a que la variable global supabase esté disponible
            for (let i = 0; i < 50; i++) {
                if (window.supabase && typeof window.supabase.from === 'function') {
                    supabaseClient = window.supabase;
                    break;
                }
                // También verificar si existe la variable supabase inicializada por supabase-config.js
                if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') {
                    supabaseClient = supabase;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (!supabaseClient) {
            console.error('❌ No se pudo conectar con Supabase');
            select.innerHTML = '<option value="">-- Error cargando clientes --</option>';
            return;
        }

        // Obtener clientes desde Supabase
        const { data: clientes, error } = await supabaseClient
            .from('clientes')
            .select('id, razon_social')
            .order('razon_social');

        if (error) {
            console.error('Error cargando clientes:', error);
            select.innerHTML = '<option value="">-- Error cargando clientes --</option>';
            return;
        }

        // Limpiar opciones existentes excepto la primera
        select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';

        // Llenar el select
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.razon_social;
            select.appendChild(option);
        });

        console.log('✅ Clientes cargados en selector:', clientes.length);

        // Evento al cambiar selección
        select.addEventListener('change', (e) => {
            const clienteId = e.target.value;
            const clientNameElement = document.getElementById('clientName');

            if (clienteId) {
                const clienteNombre = select.options[select.selectedIndex].text;
                clienteSeleccionadoId = clienteId;
                clienteSeleccionadoNombre = clienteNombre;

                console.log('Cliente seleccionado:', clienteId, clienteNombre);

                // Actualizar nombre en el header
                if (clientNameElement) {
                    clientNameElement.textContent = `Cliente: ${clienteNombre}`;
                }

                // Habilitar pasos
                habilitarPasos();
            } else {
                clienteSeleccionadoId = null;
                clienteSeleccionadoNombre = '';
                if (clientNameElement) {
                    clientNameElement.textContent = '';
                }
                deshabilitarPasos();
            }
        });

    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
    }
}

function deshabilitarPasos() {
    // Deshabilitar botones de tipo de extracto
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });
}

function habilitarPasos() {
    // Habilitar botones de tipo de extracto
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
}

// Configuración de bancos
const banksBancarios = [
    { id: 'galicia', name: 'Banco Galicia' },
    { id: 'bbva', name: 'Banco BBVA' },
    { id: 'bpn', name: 'BPN (Banco Provincia Neuquén)' },
    { id: 'santander', name: 'Banco Santander' },
    {
        id: 'macro',
        name: 'Banco Macro',
        hasSubOptions: true,
        subOptions: [
            { id: 'macro-resumen', name: 'Resumen de Movimientos', description: 'Últimos Movimientos - una columna de importe' },
            { id: 'macro-extracto', name: 'Extracto Bancario', description: 'Detalle de Movimiento - columnas DEBITOS y CREDITOS separadas' }
        ]
    },
    { id: 'nacion', name: 'Banco Nación', disabled: true },
    { id: 'lapampa', name: 'Banco de La Pampa' }
];

const banksInversiones = [
    { id: 'galicia-inversiones', name: 'Galicia Inversiones' }
];

// Elementos DOM
const elements = {
    typeBtns: null,
    stepBank: null,
    stepSubOption: null,
    suboptionGrid: null,
    suboptionTitle: null,
    suboptionDescription: null,
    stepFile: null,
    stepConvert: null,
    bankGrid: null,
    entityType: null,
    dropZone: null,
    fileInput: null,
    selectedFile: null,
    fileName: null,
    convertBtn: null,
    errorBox: null,
    successBox: null,
    previewSection: null,
    previewHeader: null,
    previewBody: null,
    previewFooter: null,
    downloadBtn: null,
    rowCount: null
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    attachEventListeners();

    // Cargar clientes y deshabilitar pasos hasta selección
    await cargarClientesEnSelector();
    deshabilitarPasos();
});

function initElements() {
    elements.typeBtns = document.querySelectorAll('[data-type]');
    elements.stepBank = document.getElementById('step-bank');
    elements.stepSubOption = document.getElementById('step-suboption');
    elements.suboptionGrid = document.getElementById('suboption-grid');
    elements.suboptionTitle = document.getElementById('suboption-title');
    elements.suboptionDescription = document.getElementById('suboption-description');
    elements.stepFile = document.getElementById('step-file');
    elements.stepConvert = document.getElementById('step-convert');
    elements.bankGrid = document.getElementById('bank-grid');
    elements.entityType = document.getElementById('entity-type');
    elements.dropZone = document.getElementById('dropZone');
    elements.fileInput = document.getElementById('fileInput');
    elements.selectedFile = document.getElementById('selectedFile');
    elements.fileName = document.getElementById('fileName');
    elements.convertBtn = document.getElementById('convertBtn');
    elements.errorBox = document.getElementById('errorBox');
    elements.successBox = document.getElementById('successBox');
    elements.previewSection = document.getElementById('previewSection');
    elements.previewHeader = document.getElementById('previewHeader');
    elements.previewBody = document.getElementById('previewBody');
    elements.previewFooter = document.getElementById('previewFooter');
    elements.downloadBtn = document.getElementById('downloadBtn');
    elements.rowCount = document.getElementById('rowCount');
    // Elementos de resumen de saldos
    elements.resumenSaldos = document.getElementById('resumenSaldos');
    elements.saldoInicialPeriodo = document.getElementById('saldoInicialPeriodo');
    elements.saldoCierrePeriodo = document.getElementById('saldoCierrePeriodo');
}

function attachEventListeners() {
    // Botones de tipo
    elements.typeBtns.forEach(btn => {
        btn.addEventListener('click', () => handleTypeSelect(btn.dataset.type));
    });

    // Zona de arrastre
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);

    // Input de archivo
    elements.fileInput.addEventListener('change', handleFileInput);

    // Botón convertir
    elements.convertBtn.addEventListener('click', handleConvert);

    // Botón descargar
    elements.downloadBtn.addEventListener('click', handleDownloadExcel);
}

function handleTypeSelect(type) {
    state.selectedType = type;
    state.selectedBank = '';
    state.selectedSubOption = '';
    state.file = null;
    state.extractedData = [];
    state.saldoInicial = null;

    // Actualizar UI
    elements.typeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Mostrar paso de banco
    elements.stepBank.classList.remove('hidden');
    elements.stepSubOption.classList.add('hidden');
    elements.stepFile.classList.add('hidden');
    elements.stepConvert.classList.add('hidden');
    elements.previewSection.classList.add('hidden');

    // Actualizar texto
    elements.entityType.textContent = type === 'bancario' ? 'banco' : 'entidad';

    // Llenar grid de bancos
    const banks = type === 'bancario' ? banksBancarios : banksInversiones;
    elements.bankGrid.innerHTML = banks.map(bank => `
        <button class="bank-btn" data-bank="${bank.id}" ${bank.disabled ? 'disabled' : ''}>
            <div>${bank.name}</div>
            ${bank.disabled ? '<div class="bank-btn-subtitle">Próximamente</div>' : ''}
        </button>
    `).join('');

    // Agregar event listeners a botones de banco
    document.querySelectorAll('.bank-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.disabled) {
                handleBankSelect(btn.dataset.bank);
            }
        });
    });

    hideMessages();
}

function handleBankSelect(bankId) {
    state.selectedBank = bankId;
    state.selectedSubOption = '';
    state.file = null;
    state.extractedData = [];
    state.saldoInicial = null;

    // Actualizar UI
    document.querySelectorAll('.bank-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bank === bankId);
    });

    // Buscar si el banco tiene sub-opciones
    const banks = state.selectedType === 'bancario' ? banksBancarios : banksInversiones;
    const selectedBank = banks.find(b => b.id === bankId);

    if (selectedBank && selectedBank.hasSubOptions) {
        // Mostrar paso de sub-opciones
        elements.stepSubOption.classList.remove('hidden');
        elements.stepFile.classList.add('hidden');
        elements.stepConvert.classList.add('hidden');
        elements.previewSection.classList.add('hidden');

        // Actualizar título y descripción
        elements.suboptionTitle.textContent = `Tipo de extracto de ${selectedBank.name}`;
        elements.suboptionDescription.textContent = 'Selecciona el tipo de extracto que deseas convertir:';

        // Llenar grid de sub-opciones
        elements.suboptionGrid.innerHTML = selectedBank.subOptions.map(opt => `
            <button class="suboption-btn" data-suboption="${opt.id}">
                <div class="suboption-btn-title">${opt.name}</div>
                <div class="suboption-btn-desc">${opt.description}</div>
            </button>
        `).join('');

        // Agregar event listeners a botones de sub-opciones
        document.querySelectorAll('.suboption-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleSubOptionSelect(btn.dataset.suboption);
            });
        });
    } else {
        // Mostrar paso de archivo directamente
        elements.stepSubOption.classList.add('hidden');
        elements.stepFile.classList.remove('hidden');
        elements.stepConvert.classList.add('hidden');
        elements.previewSection.classList.add('hidden');
        elements.selectedFile.classList.add('hidden');
    }

    hideMessages();
}

function handleSubOptionSelect(subOptionId) {
    state.selectedSubOption = subOptionId;
    state.file = null;
    state.extractedData = [];

    // Actualizar UI
    document.querySelectorAll('.suboption-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.suboption === subOptionId);
    });

    // Mostrar paso de archivo
    elements.stepFile.classList.remove('hidden');
    elements.stepConvert.classList.add('hidden');
    elements.previewSection.classList.add('hidden');
    elements.selectedFile.classList.add('hidden');

    hideMessages();
}

function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileInput(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    if (file.type === 'application/pdf') {
        state.file = file;
        elements.fileName.textContent = file.name;
        elements.selectedFile.classList.remove('hidden');
        elements.stepConvert.classList.remove('hidden');
        hideMessages();
    } else {
        showError('Por favor selecciona un archivo PDF válido');
    }
}

async function handleConvert() {
    if (!state.file) {
        showError('Por favor selecciona un archivo primero');
        return;
    }

    state.isProcessing = true;
    elements.convertBtn.disabled = true;
    elements.convertBtn.textContent = 'Procesando PDF...';
    hideMessages();

    try {
        if (state.selectedBank === 'galicia') {
            await processGaliciaPDF(state.file);
        } else if (state.selectedBank === 'bbva') {
            await processBBVAPDF(state.file);
        } else if (state.selectedBank === 'bpn') {
            await processBPNPDF(state.file);
        } else if (state.selectedBank === 'santander') {
            await processSantanderPDF(state.file);
        } else if (state.selectedBank === 'macro') {
            await processMacroPDF(state.file, state.selectedSubOption);
        } else if (state.selectedBank === 'galicia-inversiones') {
            await processGaliciaInversionesPDF(state.file);
        } else if (state.selectedBank === 'lapampa') {
            await processLaPampaPDF(state.file);
        }
    } catch (err) {
        console.error('Error procesando PDF:', err);
        showError('Error al procesar el archivo PDF.');
    } finally {
        state.isProcessing = false;
        elements.convertBtn.disabled = false;
        elements.convertBtn.textContent = 'Convertir archivo';
    }
}

// Funciones de procesamiento de PDF
async function extractTextFromPDF(pdfFile) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

// Extraer texto línea por línea del PDF (agrupando por Y)
async function extractTextLinesFromPDF(pdfFile) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allItems = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        for (const item of textContent.items) {
            if (item.str.trim()) {
                allItems.push({
                    text: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    page: pageNum
                });
            }
        }
    }

    // Agrupar items por línea (Y similar dentro de la misma página)
    const lineGroups = {};
    for (const item of allItems) {
        // Usar página y Y redondeado como clave
        const yKey = `${item.page}-${Math.round(item.y / 5) * 5}`;
        if (!lineGroups[yKey]) {
            lineGroups[yKey] = { items: [], page: item.page, y: item.y };
        }
        lineGroups[yKey].items.push(item);
    }

    // Convertir a array de líneas ordenadas
    const lines = Object.values(lineGroups)
        .sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            return b.y - a.y; // Y mayor primero (arriba a abajo)
        })
        .map(group => {
            // Ordenar items de izquierda a derecha y concatenar
            const sortedItems = group.items.sort((a, b) => a.x - b.x);
            return sortedItems.map(item => item.text).join(' ');
        });

    return lines;
}

// Extraer texto con posiciones X para determinar columnas
async function extractTextWithPositions(pdfFile) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allItems = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        for (const item of textContent.items) {
            if (item.str.trim()) {
                allItems.push({
                    text: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    page: pageNum
                });
            }
        }
    }

    // Agrupar items por línea (Y similar dentro de la misma página)
    const lineGroups = {};
    for (const item of allItems) {
        const yKey = `${item.page}-${Math.round(item.y / 5) * 5}`;
        if (!lineGroups[yKey]) {
            lineGroups[yKey] = { items: [], page: item.page, y: item.y };
        }
        lineGroups[yKey].items.push(item);
    }

    // Convertir a array de líneas con items y posiciones
    const lines = Object.values(lineGroups)
        .sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            return b.y - a.y;
        })
        .map(group => {
            const sortedItems = group.items.sort((a, b) => a.x - b.x);
            return {
                text: sortedItems.map(item => item.text).join(' '),
                items: sortedItems
            };
        });

    return lines;
}

function extractSaldoInicial(text) {
    const periodoMatch = text.match(/Período de movimientos\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+Saldos\s+\$?([\d.,]+)\s+\$?([\d.,]+)/i);

    if (periodoMatch) {
        return periodoMatch[4];
    }

    const saldosMatch = text.match(/Saldos\s+\$?([\d.,]+)\s+\$?([\d.,]+)/i);

    if (saldosMatch) {
        return saldosMatch[2];
    }

    const saldoAnteriorMatch = text.match(/SALDO ANTERIOR\s+([\d.,]+)/i);
    if (saldoAnteriorMatch) {
        return saldoAnteriorMatch[1];
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Saldos')) {
            const nextLines = lines.slice(i, i + 3).join(' ');
            const amounts = nextLines.match(/\$?([\d.]+,\d{2})/g);
            if (amounts && amounts.length >= 2) {
                return amounts[1].replace('$', '');
            }
        }
    }

    return null;
}

function parseGaliciaExtract(text) {
    const movements = [];

    const movimientosIndex = text.indexOf('Movimientos');
    if (movimientosIndex === -1) {
        console.log('No se encontró la sección "Movimientos"');
        return movements;
    }

    let movimientosText = text.substring(movimientosIndex);

    const consolidadoIndex = movimientosText.indexOf('Consolidado de retención de impuestos');
    if (consolidadoIndex !== -1) {
        movimientosText = movimientosText.substring(0, consolidadoIndex);
    }

    const totalIndex = movimientosText.search(/Total\s+\$?\s*[\d.,]+\s+\$?\s*[\d.,]+\s+\$?\s*[\d.,]+/i);
    if (totalIndex !== -1) {
        movimientosText = movimientosText.substring(0, totalIndex);
    }

    const datePattern = /\d{2}\/\d{2}\/\d{2,4}/g;
    const datePositions = [];
    let match;

    while ((match = datePattern.exec(movimientosText)) !== null) {
        datePositions.push({
            date: match[0],
            index: match.index
        });
    }

    for (let i = 0; i < datePositions.length; i++) {
        const currentDate = datePositions[i];
        const nextDate = datePositions[i + 1];

        const endIndex = nextDate ? nextDate.index : movimientosText.length;
        const segment = movimientosText.substring(currentDate.index, endIndex).trim();

        const amountRegex = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
        const amounts = segment.match(amountRegex) || [];

        if (amounts.length === 0) continue;

        const fecha = currentDate.date;

        let descripcion = segment.replace(fecha, '').trim();
        amounts.forEach(amt => {
            descripcion = descripcion.replace(amt, '');
        });

        descripcion = descripcion
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/Fecha\s+Descripción\s+Origen\s+Crédito\s+Débito\s+Saldo/gi, '')
            .replace(/Resumen de\s+Cuenta Corriente en Pesos/gi, '')
            .replace(/Página\s+\d+\s+\/\s+\d+/gi, '')
            .replace(/\d{14,}/g, '')
            .replace(/\bResumen\s+de\b/gi, '')
            .replace(/\bCuenta\s+Corriente\s+en\s+Pesos\b/gi, '')
            .replace(/\bPágina\b/gi, '')
            .replace(/Total\s+\$\s*-?\$?\s*\$/gi, '')
            .replace(/Total\s+\$/gi, '')
            .replace(/Consolidado de retención de Impuestos.*/gi, '')
            .replace(/PERIODO COMPRENDIDO.*/gi, '')
            .replace(/TOTAL RETENCION.*/gi, '')
            .replace(/TOTAL IMPUESTO.*/gi, '')
            .replace(/CUIT del Responsable Impositivo.*?esumen de/gi, '')
            .replace(/IVA:\s*Responsable inscripto/gi, '')
            .replace(/RAUL GAVAROTTO DISTRIBUIDORA S A/gi, '')
            .trim();

        if (!descripcion) continue;

        if (/^Total\b/i.test(descripcion) || descripcion.toLowerCase() === 'total') {
            continue;
        }

        const nextDateInDesc = descripcion.match(/\d{2}\/\d{2}\/\d{2,4}/);
        if (nextDateInDesc) {
            descripcion = descripcion.substring(0, descripcion.indexOf(nextDateInDesc[0])).trim();
        }

        descripcion = descripcion
            .replace(/\d{14,}/g, '')
            .replace(/\s+[A-Z]$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const movement = {
            fecha: fecha,
            descripcion: descripcion,
            origen: '',
            credito: '0',
            debito: '0',
            saldo: ''
        };

        if (amounts.length >= 1) {
            movement.saldo = amounts[amounts.length - 1];
        }

        if (amounts.length >= 2) {
            const movementAmount = amounts[amounts.length - 2];
            if (movementAmount.includes('-')) {
                movement.debito = movementAmount;
                movement.credito = '0';
            } else {
                movement.credito = movementAmount;
                movement.debito = '0';
            }
        }

        if (amounts.length === 3) {
            const credits = amounts.filter(amt => !amt.includes('-'));
            const debits = amounts.filter(amt => amt.includes('-'));

            if (credits.length === 1 && debits.length === 1) {
                movement.credito = credits[0];
                movement.debito = debits[0];
            } else if (credits.length >= 2) {
                movement.credito = amounts[amounts.length - 2].includes('-') ? '0' : amounts[amounts.length - 2];
            }
        }

        if (amounts.length >= 4) {
            const movementAmount = amounts[amounts.length - 2];
            if (movementAmount.includes('-')) {
                movement.debito = movementAmount;
                movement.credito = '0';
            } else {
                movement.credito = movementAmount;
                movement.debito = '0';
            }
        }

        if (movement.fecha && movement.descripcion && (movement.credito !== '0' || movement.debito !== '0' || movement.saldo)) {
            movements.push(movement);
        }
    }

    return movements;
}

function parseBBVAExtract(text) {
    const movements = [];

    text = text.replace(/D\s*É\s*BITO/gi, 'DEBITO');
    text = text.replace(/CR\s*É\s*DITO/gi, 'CREDITO');
    text = text.replace(/P\s*á\s*gina/gi, 'Pagina');

    const movimientosRegex = /SALDO ANTERIOR\s+([\s\S]*?)(?:SALDO AL|TOTAL MOVIMIENTOS)/i;
    const movimientosMatch = text.match(movimientosRegex);

    if (!movimientosMatch) {
        return movements;
    }

    const movimientosText = movimientosMatch[1];
    const movimientoRegex = /(\d{2}\/\d{2})\s+([A-Z].*?)(?=\s+\d{2}\/\d{2}\s+[A-Z]|$)/g;

    let match;
    while ((match = movimientoRegex.exec(movimientosText)) !== null) {
        const fecha = match[1];
        const contenido = match[2].trim();

        const amountRegex = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
        const amounts = contenido.match(amountRegex) || [];

        if (amounts.length === 0) continue;

        let descripcion = contenido;
        amounts.forEach(amt => {
            descripcion = descripcion.replace(amt, '');
        });

        descripcion = descripcion
            .replace(/\s+/g, ' ')
            .replace(/^[A-Z]\s+\d+\s+/, '')
            .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')
            .trim();

        const movement = {
            fecha: fecha,
            descripcion: descripcion,
            origen: '',
            credito: '0',
            debito: '0',
            saldo: ''
        };

        if (amounts.length >= 1) {
            movement.saldo = amounts[amounts.length - 1];
        }

        if (amounts.length === 2) {
            if (amounts[0].startsWith('-')) {
                movement.debito = amounts[0];
            } else {
                movement.credito = amounts[0];
            }
        } else if (amounts.length === 3) {
            if (amounts[0].startsWith('-')) {
                movement.debito = amounts[0];
            } else {
                movement.credito = amounts[0];
            }
            if (amounts[1].startsWith('-') && movement.debito === '0') {
                movement.debito = amounts[1];
            } else if (!amounts[1].startsWith('-') && movement.credito === '0') {
                movement.credito = amounts[1];
            }
        }

        movements.push(movement);
    }

    return movements;
}

// Limpiar descripción BPN cortando antes del texto del footer del PDF
// El parser concatena el texto del pie de página al último movimiento
function limpiarDescripcionBPN(descripcion) {
    // Patrones que indican inicio del footer del PDF
    const patronesFooter = [
        'encuentra incluido el IVA',
        'Se informa que para',
        'Para reportar Fraudes',
        'Personas Expuestas',
        'Usted puede solicitar',
        'Los depósitos en pesos',
        'prevencion_fraudes@bpn.com.ar'
    ];

    for (const patron of patronesFooter) {
        const index = descripcion.indexOf(patron);
        if (index > 0) {
            console.log('Limpiando footer de descripción BPN. Patrón encontrado:', patron);
            descripcion = descripcion.substring(0, index).trim();
            break;
        }
    }

    return descripcion;
}

// Parsear extracto BPN (Banco Provincia del Neuquén) usando posiciones de columnas
// Estructura: Fecha | Descripción | Comprobante | Débito | Crédito | Saldo
function parseBPNWithPositions(linesWithPositions, saldoInicial = null) {
    const movements = [];
    let currentMovement = null;

    // Detectar posiciones de columnas buscando el header
    let debitoColumnX = null;
    let creditoColumnX = null;
    let saldoColumnX = null;

    // Buscar la línea de encabezado para determinar posiciones de columnas
    for (const lineData of linesWithPositions) {
        const text = lineData.text.toLowerCase();
        if (text.includes('débito') || text.includes('debito')) {
            for (const item of lineData.items) {
                const itemText = item.text.toLowerCase();
                if (itemText.includes('débito') || itemText.includes('debito')) {
                    debitoColumnX = item.x;
                } else if (itemText.includes('crédito') || itemText.includes('credito')) {
                    creditoColumnX = item.x;
                } else if (itemText === 'saldo') {
                    saldoColumnX = item.x;
                }
            }
            if (debitoColumnX && creditoColumnX) {
                console.log('Columnas BPN detectadas - Débito X:', debitoColumnX, 'Crédito X:', creditoColumnX, 'Saldo X:', saldoColumnX);
                break;
            }
        }
    }

    // Si no encontramos las columnas exactas, usar valores por defecto típicos
    if (!debitoColumnX || !creditoColumnX) {
        debitoColumnX = 350;
        creditoColumnX = 420;
        saldoColumnX = 500;
        console.log('Usando posiciones de columnas por defecto para BPN');
    }

    // Calcular el punto medio entre débito y crédito para clasificar
    const midPoint = (debitoColumnX + creditoColumnX) / 2;

    // Regex para detectar fecha al inicio de línea
    const dateRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\b/;

    console.log('Procesando', linesWithPositions.length, 'líneas del PDF BPN');
    console.log('='.repeat(80));

    for (const lineData of linesWithPositions) {
        const trimmedLine = lineData.text.trim();

        // Ignorar líneas vacías o de encabezado
        if (!trimmedLine ||
            /^(Fecha|Descripción|Comprobante|D[eé]bito|Cr[eé]dito|Saldo)$/i.test(trimmedLine) ||
            /Total\s+en\s+concepto\s+de/i.test(trimmedLine) ||
            /Verificá|información|adicional|consultas/i.test(trimmedLine)) {
            continue;
        }

        // BUG 1 FIX: Ignorar texto legal del pie de página
        // Líneas que comienzan con comillas simples
        if (trimmedLine.startsWith("'")) {
            continue;
        }

        // Líneas que contienen palabras clave del texto legal
        const legalKeywords = [
            'Se informa',
            'Para reportar',
            'Personas Expuestas',
            'Usted puede',
            'Los depósitos',
            'Se presumirá',
            'Total en concepto',
            'Responsables Inscriptos',
            'en el concepto de total de IVA'
        ];

        if (legalKeywords.some(keyword => trimmedLine.includes(keyword))) {
            continue;
        }

        // Líneas muy largas (probablemente texto legal)
        if (trimmedLine.length > 200) {
            continue;
        }

        // BUG FIX: Ignorar líneas de separación (guiones, underscores, signos de igual)
        // Estas líneas aparecen antes de "Saldo en $" y pueden agregarse a la descripción
        // del último movimiento, causando que sea filtrado por tener > 100 caracteres
        // El regex permite espacios mezclados y variaciones como "__ __ __" o "----  ----"
        if (/^[_\-=\s]+$/.test(trimmedLine) && /[_\-=]{3,}/.test(trimmedLine)) {
            continue;
        }

        // BUG FIX: Ignorar línea de "Saldo en $" que marca el fin de los movimientos
        if (/^Saldo\s+en\s+\$/i.test(trimmedLine)) {
            continue;
        }

        // Verificar si la línea empieza con fecha
        const dateMatch = trimmedLine.match(dateRegex);

        if (dateMatch) {
            // Guardar movimiento anterior si existe
            if (currentMovement) {
                movements.push(currentMovement);
            }

            // Extraer fecha y convertir de DD/MM/YY a DD/MM/YYYY si es necesario
            // BUG 3 FIX: Formatear correctamente fechas con día/mes de 1 dígito
            const dateParts = dateMatch[1].split('/');

            // Agregar cero a la izquierda para día y mes si es necesario
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');

            // Convertir año de 2 dígitos a 4 dígitos si es necesario
            let fullYear = dateParts[2];
            if (dateParts[2].length === 2) {
                const year = parseInt(dateParts[2]);
                fullYear = year < 50 ? `20${dateParts[2]}` : `19${dateParts[2]}`;
            }

            const fecha = `${day}/${month}/${fullYear}`;

            // Encontrar todos los importes con sus posiciones X
            const amountsWithPositions = [];
            for (const item of lineData.items) {
                // Buscar items que sean importes
                // Formato: 1.234,56 o 123,45 o -3.277,62
                // BUG 2 FIX: Preservar el signo negativo en los importes
                const amountMatch = item.text.match(/^(-?\s*[\d.]+,\d{2})$/);
                if (amountMatch) {
                    amountsWithPositions.push({
                        value: amountMatch[1].replace(/\s+/g, ''),  // Remover espacios pero preservar el signo
                        x: item.x,
                        text: item.text
                    });
                }
            }

            // Ordenar por posición X (izquierda a derecha)
            amountsWithPositions.sort((a, b) => a.x - b.x);

            // Extraer descripción
            let descripcion = trimmedLine;
            descripcion = descripcion.replace(dateRegex, '').trim();
            descripcion = descripcion.replace(/-?\s*[\d.]+,\d{2}/g, '').trim();

            // Extraer comprobante (generalmente un número largo)
            const comprobanteMatch = descripcion.match(/\b(\d{6,})\b/);
            const comprobante = comprobanteMatch ? comprobanteMatch[1] : '';
            if (comprobante) {
                descripcion = descripcion.replace(comprobante, '').trim();
            }

            // Clasificar importes por posición de columna
            let debito = '0';
            let credito = '0';
            let saldo = '0';

            // Log para debug
            console.log(`Fila PDF BPN: ${trimmedLine.substring(0, 100)}`);
            console.log(`  Importes encontrados: ${amountsWithPositions.length}`);
            amountsWithPositions.forEach((a, i) => {
                console.log(`    [${i}] valor: ${a.value}, X: ${a.x.toFixed(1)}`);
            });

            if (amountsWithPositions.length >= 1) {
                // El último siempre es saldo (columna más a la derecha)
                saldo = amountsWithPositions[amountsWithPositions.length - 1].value;
            }

            if (amountsWithPositions.length >= 2) {
                // El penúltimo es el movimiento (débito o crédito)
                const movAmount = amountsWithPositions[amountsWithPositions.length - 2];

                // Clasificar según posición X
                if (movAmount.x < midPoint) {
                    debito = movAmount.value;
                } else {
                    credito = movAmount.value;
                }
            }

            // Si hay 3 importes, puede haber comprobante numérico, débito/crédito y saldo
            // O débito, crédito y saldo
            if (amountsWithPositions.length >= 3) {
                const first = amountsWithPositions[0];
                const second = amountsWithPositions[1];

                // Verificar si el primero parece ser un comprobante (número grande sin decimales típicos)
                const isFirstComprobante = !first.value.match(/,\d{2}$/);

                if (!isFirstComprobante) {
                    if (first.x < midPoint) {
                        debito = first.value;
                    } else {
                        credito = first.value;
                    }

                    if (second.x < midPoint && debito === '0') {
                        debito = second.value;
                    } else if (second.x >= midPoint && credito === '0') {
                        credito = second.value;
                    }
                }
            }

            console.log(`  → Débito: ${debito} | Crédito: ${credito} | Saldo: ${saldo}`);
            console.log('-'.repeat(80));

            currentMovement = {
                fecha: fecha,
                descripcion: descripcion,
                origen: comprobante,
                debito: debito,
                credito: credito,
                saldo: saldo
            };

        } else if (currentMovement) {
            // Es continuación de la descripción
            // BUG FIX: Verificación adicional para no agregar líneas de separación o de cierre
            // que pudieron escapar los filtros anteriores
            const isHeaderOrFooter = /^(Fecha|Descripción|Comprobante|D[eé]bito|Cr[eé]dito|Saldo|Total)/i.test(trimmedLine);
            const isSeparatorLine = /^[_\-=\s]+$/.test(trimmedLine) && /[_\-=]{3,}/.test(trimmedLine);
            const isSaldoLine = /Saldo\s+en\s+\$/i.test(trimmedLine);
            // BUG FIX: No agregar líneas que son solo importes (números aislados)
            // Formato: -1.234,56 o 1.234,56 (pueden quedar aislados en el PDF)
            const isOnlyAmount = /^-?\s*[\d.]+,\d{2}\s*$/.test(trimmedLine);

            if (!isHeaderOrFooter && !isSeparatorLine && !isSaldoLine && !isOnlyAmount) {
                currentMovement.descripcion += ' ' + trimmedLine;
            }
        }
    }

    // No olvidar el último movimiento
    // BUG FIX: Limpiar la descripción del último movimiento para remover texto del footer
    // que se concatena incorrectamente al parsear el PDF
    if (currentMovement) {
        currentMovement.descripcion = limpiarDescripcionBPN(currentMovement.descripcion);
        console.log('Agregando último movimiento:', currentMovement.fecha, currentMovement.descripcion);
        movements.push(currentMovement);
    } else {
        console.log('ADVERTENCIA: currentMovement es null/undefined al final del loop');
    }

    console.log('Movimientos BPN antes de filtrar:', movements.length);

    // Limpiar descripciones y filtrar movimientos con descripciones sospechosas
    const filteredMovements = movements
        .filter(mov => {
            // Filtrar líneas de totales que puedan haber pasado el filtro inicial
            if (/^Total\b/i.test(mov.descripcion)) {
                console.log('FILTRADO por empezar con Total:', mov.fecha, mov.descripcion);
                return false;
            }

            return true;
        })
        .map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .trim();
            return mov;
        });

    console.log('='.repeat(80));
    console.log('Movimientos BPN encontrados:', filteredMovements.length);

    return filteredMovements;
}

// Parsear extracto Banco Macro usando posiciones de columnas
// Estructura: Fecha | Nro. de Referencia | Causal | Concepto | Importe | Saldo
// Importe: $ -1.234,56 (negativo = débito) o $ 1.234,56 (positivo = crédito)
function parseMacroWithPositions(linesWithPositions) {
    const movements = [];
    let currentMovement = null;
    let inMovementsSection = false;

    // Detectar posiciones de columnas buscando el header
    let importeColumnX = null;
    let saldoColumnX = null;

    // Buscar la línea de encabezado para determinar posiciones de columnas
    for (const lineData of linesWithPositions) {
        const text = lineData.text.toLowerCase();
        if (text.includes('importe') && text.includes('saldo')) {
            for (const item of lineData.items) {
                const itemText = item.text.toLowerCase();
                if (itemText === 'importe' || itemText.includes('importe')) {
                    importeColumnX = item.x;
                } else if (itemText === 'saldo') {
                    saldoColumnX = item.x;
                }
            }
            if (importeColumnX && saldoColumnX) {
                console.log('Columnas Macro detectadas - Importe X:', importeColumnX, 'Saldo X:', saldoColumnX);
                inMovementsSection = true;
                break;
            }
        }
    }

    // Si no encontramos las columnas exactas, usar valores por defecto
    if (!importeColumnX || !saldoColumnX) {
        importeColumnX = 400;
        saldoColumnX = 500;
        console.log('Usando posiciones de columnas por defecto para Macro');
    }

    // Calcular el punto medio entre importe y saldo para clasificar
    const midPoint = (importeColumnX + saldoColumnX) / 2;

    // Regex para detectar fecha al inicio de línea (DD/MM/YYYY)
    const dateRegex = /^(\d{2}\/\d{2}\/\d{4})\b/;

    console.log('Procesando', linesWithPositions.length, 'líneas del PDF Macro');
    console.log('='.repeat(80));

    for (const lineData of linesWithPositions) {
        const trimmedLine = lineData.text.trim();

        // Ignorar líneas vacías o de encabezado
        if (!trimmedLine ||
            /^(Fecha|Nro\.\s*de\s*Referencia|Causal|Concepto|Importe|Saldo)$/i.test(trimmedLine) ||
            /Últimos\s+Movimientos/i.test(trimmedLine) ||
            /CUENTA\s+CORRIENTE/i.test(trimmedLine) ||
            /Tipo:\s*Cuenta/i.test(trimmedLine) ||
            /Número:\s*\d+/i.test(trimmedLine) ||
            /Moneda:\s*PESOS/i.test(trimmedLine) ||
            /Fecha\s+de\s+descarga/i.test(trimmedLine) ||
            /Operador:/i.test(trimmedLine) ||
            /Empresa:/i.test(trimmedLine)) {
            continue;
        }

        // Detectar inicio de sección de movimientos
        if (/FechaNro\.\s*de\s*Referencia|Fecha.*Referencia.*Causal.*Concepto.*Importe.*Saldo/i.test(trimmedLine)) {
            inMovementsSection = true;
            continue;
        }

        // Verificar si la línea empieza con fecha (DD/MM/YYYY)
        const dateMatch = trimmedLine.match(dateRegex);

        if (dateMatch) {
            // Guardar movimiento anterior si existe
            if (currentMovement) {
                movements.push(currentMovement);
            }

            const fecha = dateMatch[1];

            // Encontrar todos los importes con sus posiciones X
            // Formato Macro: $ -1.234,56 o $ 1.234,56
            const amountsWithPositions = [];
            for (const item of lineData.items) {
                // Buscar items que sean importes (con o sin signo, con o sin $)
                // Formatos: $ -1.234,56 | $ 1.234,56 | -1.234,56 | 1.234,56
                const amountMatch = item.text.match(/^\$?\s*(-?\s*[\d.]+,\d{2})$/) ||
                                   item.text.match(/^(-?\d{1,3}(?:\.\d{3})*,\d{2})$/);
                if (amountMatch) {
                    amountsWithPositions.push({
                        value: amountMatch[1].replace(/\s+/g, ''),
                        x: item.x,
                        text: item.text
                    });
                }
            }

            // Ordenar por posición X (izquierda a derecha)
            amountsWithPositions.sort((a, b) => a.x - b.x);

            // Extraer descripción (concepto)
            let descripcion = trimmedLine;
            descripcion = descripcion.replace(dateRegex, '').trim();
            // Remover importes del texto
            descripcion = descripcion.replace(/\$?\s*-?\s*[\d.]+,\d{2}/g, '').trim();

            // Extraer referencia (número largo al inicio después de la fecha)
            const referenciaMatch = descripcion.match(/^(\d{4,})/);
            const referencia = referenciaMatch ? referenciaMatch[1] : '';
            if (referencia) {
                descripcion = descripcion.replace(referencia, '').trim();
            }

            // Extraer causal (número de 3-4 dígitos después de la referencia)
            const causalMatch = descripcion.match(/^(\d{3,4})\b/);
            if (causalMatch) {
                descripcion = descripcion.replace(causalMatch[1], '').trim();
            }

            // Clasificar importes
            let debito = '0';
            let credito = '0';
            let saldo = '0';

            // Log para debug
            console.log(`Fila PDF Macro: ${trimmedLine.substring(0, 100)}`);
            console.log(`  Importes encontrados: ${amountsWithPositions.length}`);
            amountsWithPositions.forEach((a, i) => {
                console.log(`    [${i}] valor: ${a.value}, X: ${a.x.toFixed(1)}`);
            });

            if (amountsWithPositions.length >= 1) {
                // El último siempre es saldo (columna más a la derecha)
                saldo = amountsWithPositions[amountsWithPositions.length - 1].value;
                // Remover el signo negativo del saldo si lo tiene (el saldo siempre es positivo)
                saldo = saldo.replace('-', '');
            }

            if (amountsWithPositions.length >= 2) {
                // El penúltimo es el importe del movimiento
                const importeValue = amountsWithPositions[amountsWithPositions.length - 2].value;

                // En Banco Macro, el signo determina si es débito o crédito
                // Negativo = Débito (salida de dinero)
                // Positivo = Crédito (entrada de dinero)
                if (importeValue.includes('-')) {
                    // Es un débito - guardar valor absoluto
                    debito = importeValue.replace('-', '');
                } else {
                    // Es un crédito
                    credito = importeValue;
                }
            }

            console.log(`  → Débito: ${debito} | Crédito: ${credito} | Saldo: ${saldo}`);
            console.log('-'.repeat(80));

            currentMovement = {
                fecha: fecha,
                descripcion: descripcion,
                origen: referencia,
                debito: debito,
                credito: credito,
                saldo: saldo
            };

        } else if (currentMovement) {
            // Es continuación de la descripción
            if (!/^(Fecha|Nro|Causal|Concepto|Importe|Saldo|Últimos|CUENTA|Tipo|Número|Moneda|Operador|Empresa)/i.test(trimmedLine)) {
                currentMovement.descripcion += ' ' + trimmedLine;
            }
        }
    }

    // No olvidar el último movimiento
    if (currentMovement) {
        movements.push(currentMovement);
    }

    // Limpiar descripciones y filtrar movimientos inválidos
    const filteredMovements = movements
        .filter(mov => {
            // Filtrar descripciones vacías o muy cortas
            if (!mov.descripcion || mov.descripcion.length < 3) {
                return false;
            }
            // Filtrar líneas que no son movimientos reales
            if (/^Total\b/i.test(mov.descripcion)) {
                return false;
            }
            return true;
        })
        .map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .trim();
            return mov;
        });

    console.log('='.repeat(80));
    console.log('Movimientos Macro encontrados:', filteredMovements.length);

    return filteredMovements;
}

// Parsear Extracto Bancario de Banco Macro (formato con columnas DEBITOS y CREDITOS separadas)
// Estructura: FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO
// Puede contener múltiples cuentas en el mismo PDF
function parseMacroExtractoBancario(linesWithPositions) {
    const allMovements = [];
    let currentAccount = null;
    let inMovementsSection = false;

    // Detectar posiciones de columnas
    let debitosColumnX = null;
    let creditosColumnX = null;
    let saldoColumnX = null;

    // Regex para detectar fecha al inicio de línea (DD/MM/YY)
    const dateRegex = /^(\d{2}\/\d{2}\/\d{2})\b/;

    console.log('Procesando Extracto Bancario Macro...');
    console.log('='.repeat(80));

    for (const lineData of linesWithPositions) {
        const trimmedLine = lineData.text.trim();

        // Detectar inicio de una cuenta nueva
        if (/CUENTA\s+CORRIENTE\s+BANCARIA\s+NRO\.?:?\s*([\d\-]+)/i.test(trimmedLine)) {
            const match = trimmedLine.match(/CUENTA\s+CORRIENTE\s+BANCARIA\s+NRO\.?:?\s*([\d\-]+)/i);
            currentAccount = match ? match[1] : 'Desconocida';
            console.log(`\n📄 Nueva cuenta detectada: ${currentAccount}`);
            inMovementsSection = false;
        }

        // Detectar cabecera de movimientos para obtener posiciones de columnas
        if (/DETALLE\s+DE\s+MOVIMIENTO/i.test(trimmedLine)) {
            inMovementsSection = true;
            console.log('   → Sección DETALLE DE MOVIMIENTO encontrada');
            continue;
        }

        // Detectar encabezado de columnas
        const textLower = trimmedLine.toLowerCase();
        if (textLower.includes('debitos') || textLower.includes('débitos')) {
            for (const item of lineData.items) {
                const itemText = item.text.toLowerCase();
                if (itemText.includes('debitos') || itemText.includes('débitos')) {
                    debitosColumnX = item.x;
                } else if (itemText.includes('creditos') || itemText.includes('créditos')) {
                    creditosColumnX = item.x;
                } else if (itemText === 'saldo') {
                    saldoColumnX = item.x;
                }
            }
            if (debitosColumnX && creditosColumnX) {
                console.log(`   Columnas detectadas - Débitos X: ${debitosColumnX?.toFixed(1)}, Créditos X: ${creditosColumnX?.toFixed(1)}, Saldo X: ${saldoColumnX?.toFixed(1)}`);
            }
            continue;
        }

        // Ignorar líneas especiales
        if (/SALDO\s+ULTIMO\s+EXTRACTO/i.test(trimmedLine) ||
            /SALDO\s+FINAL\s+AL\s+DIA/i.test(trimmedLine) ||
            /TOTAL\s+COBRADO\s+DEL\s+IMP/i.test(trimmedLine) ||
            /^FECHA\s+DESCRIPCION/i.test(trimmedLine) ||
            /Clave\s+Bancaria\s+Uniforme/i.test(trimmedLine) ||
            /Periodo\s+del\s+Extracto/i.test(trimmedLine) ||
            /Resumen\s+General/i.test(trimmedLine) ||
            /Saldo\s+Cuentas\s+en\s+PESOS/i.test(trimmedLine) ||
            /Sr\(es\):/i.test(trimmedLine) ||
            /C\.U\.I\.T/i.test(trimmedLine) ||
            /Sucursal\s+\d+/i.test(trimmedLine) ||
            /^\s*$/.test(trimmedLine)) {
            continue;
        }

        // Procesar líneas de movimiento (comienzan con fecha DD/MM/YY)
        const dateMatch = trimmedLine.match(dateRegex);

        if (dateMatch && inMovementsSection) {
            // Convertir fecha de DD/MM/YY a DD/MM/YYYY
            const dateParts = dateMatch[1].split('/');
            const year = parseInt(dateParts[2]);
            const fullYear = year < 50 ? `20${dateParts[2]}` : `19${dateParts[2]}`;
            const fecha = `${dateParts[0]}/${dateParts[1]}/${fullYear}`;

            // Encontrar todos los importes con sus posiciones X
            const amountsWithPositions = [];
            for (const item of lineData.items) {
                // Formato: 1.234,56 o 123,45 (sin signo negativo en este formato)
                const amountMatch = item.text.match(/^([\d.]+,\d{2})$/);
                if (amountMatch) {
                    amountsWithPositions.push({
                        value: amountMatch[1],
                        x: item.x,
                        text: item.text
                    });
                }
            }

            // Ordenar por posición X (izquierda a derecha)
            amountsWithPositions.sort((a, b) => a.x - b.x);

            // Extraer descripción
            let descripcion = trimmedLine;
            descripcion = descripcion.replace(dateRegex, '').trim();
            // Remover importes del texto
            descripcion = descripcion.replace(/[\d.]+,\d{2}/g, '').trim();

            // Extraer referencia (número al final de la descripción antes de los importes)
            const referenciaMatch = descripcion.match(/\b(\d+)\s*$/);
            const referencia = referenciaMatch ? referenciaMatch[1] : '0';
            if (referenciaMatch) {
                descripcion = descripcion.replace(/\b\d+\s*$/, '').trim();
            }

            // Clasificar importes por posición de columna
            let debito = '0';
            let credito = '0';
            let saldo = '0';

            // Si tenemos posiciones de columnas detectadas, usarlas
            if (debitosColumnX && creditosColumnX) {
                const midPointDC = (debitosColumnX + creditosColumnX) / 2;
                const midPointCS = creditosColumnX && saldoColumnX ? (creditosColumnX + saldoColumnX) / 2 : creditosColumnX + 100;

                for (const amount of amountsWithPositions) {
                    if (amount.x < midPointDC) {
                        debito = amount.value;
                    } else if (amount.x < midPointCS) {
                        credito = amount.value;
                    } else {
                        saldo = amount.value;
                    }
                }
            } else {
                // Fallback: asumir orden DEBITO, CREDITO, SALDO
                if (amountsWithPositions.length >= 1) {
                    saldo = amountsWithPositions[amountsWithPositions.length - 1].value;
                }
                if (amountsWithPositions.length >= 2) {
                    // Si hay 2 importes además del saldo, el primero es débito o crédito
                    const movAmount = amountsWithPositions[amountsWithPositions.length - 2];
                    // En este formato, si hay valor en una posición es ese tipo
                    if (amountsWithPositions.length === 2) {
                        // Solo hay un importe y saldo - determinar por posición relativa
                        debito = movAmount.value;
                    }
                }
                if (amountsWithPositions.length >= 3) {
                    debito = amountsWithPositions[0].value;
                    credito = amountsWithPositions[1].value;
                }
            }

            // Si tanto débito como crédito son 0 pero hay importes, intentar clasificar
            if (debito === '0' && credito === '0' && amountsWithPositions.length >= 2) {
                // Tomar el penúltimo como el movimiento
                const movValue = amountsWithPositions[amountsWithPositions.length - 2].value;
                // Por defecto asignar como débito (se puede mejorar con más contexto)
                debito = movValue;
            }

            console.log(`  ${fecha} | ${descripcion.substring(0, 40)}... | D:${debito} | C:${credito} | S:${saldo}`);

            allMovements.push({
                fecha: fecha,
                descripcion: descripcion,
                origen: referencia,
                debito: debito,
                credito: credito,
                saldo: saldo,
                cuenta: currentAccount || 'Principal'
            });
        }
    }

    // Limpiar descripciones y filtrar movimientos inválidos
    const filteredMovements = allMovements
        .filter(mov => {
            // Filtrar descripciones vacías o muy cortas
            if (!mov.descripcion || mov.descripcion.length < 2) {
                return false;
            }
            // Filtrar líneas de totales
            if (/^Total\b/i.test(mov.descripcion)) {
                return false;
            }
            return true;
        })
        .map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .trim();
            return mov;
        });

    console.log('='.repeat(80));
    console.log('Movimientos Extracto Bancario Macro encontrados:', filteredMovements.length);

    return filteredMovements;
}

// Detectar automáticamente el tipo de extracto de Banco Macro
function detectMacroExtractType(linesWithPositions) {
    for (const lineData of linesWithPositions) {
        const text = lineData.text;

        // Si contiene "Últimos Movimientos" es el formato Resumen
        if (/Últimos\s+Movimientos/i.test(text)) {
            console.log('Tipo detectado: Resumen de Movimientos (por "Últimos Movimientos")');
            return 'macro-resumen';
        }

        // Si contiene "Resumen General" o "DETALLE DE MOVIMIENTO" es Extracto Bancario
        if (/Resumen\s+General/i.test(text) || /DETALLE\s+DE\s+MOVIMIENTO/i.test(text)) {
            console.log('Tipo detectado: Extracto Bancario (por "Resumen General" o "DETALLE DE MOVIMIENTO")');
            return 'macro-extracto';
        }
    }

    // Por defecto, asumir el formato original
    console.log('Tipo no detectado, usando Resumen de Movimientos por defecto');
    return 'macro-resumen';
}

// Parsear extracto Santander usando posiciones de columnas
// Estructura: Fecha | Comprobante | Movimiento | DÉBITO | CRÉDITO | Saldo
// Determina débito/crédito por la posición X en el PDF
// Si falla, usa validación por cambio de saldo como respaldo
function parseSantanderWithPositions(linesWithPositions, saldoInicial = null) {
    const movements = [];
    let currentMovement = null;

    // Detectar posiciones de columnas buscando el header
    let debitoColumnX = null;
    let creditoColumnX = null;
    let saldoColumnX = null;

    // Buscar la línea de encabezado para determinar posiciones de columnas
    for (const lineData of linesWithPositions) {
        const text = lineData.text.toLowerCase();
        if (text.includes('débito') || text.includes('debito')) {
            for (const item of lineData.items) {
                const itemText = item.text.toLowerCase();
                if (itemText.includes('débito') || itemText.includes('debito')) {
                    debitoColumnX = item.x;
                } else if (itemText.includes('crédito') || itemText.includes('credito')) {
                    creditoColumnX = item.x;
                } else if (itemText === 'saldo') {
                    saldoColumnX = item.x;
                }
            }
            if (debitoColumnX && creditoColumnX) {
                console.log('Columnas detectadas - Débito X:', debitoColumnX, 'Crédito X:', creditoColumnX, 'Saldo X:', saldoColumnX);
                break;
            }
        }
    }

    // Si no encontramos las columnas exactas, usar valores por defecto típicos de Santander
    if (!debitoColumnX || !creditoColumnX) {
        debitoColumnX = 380;
        creditoColumnX = 450;
        saldoColumnX = 520;
        console.log('Usando posiciones de columnas por defecto');
    }

    // Calcular el punto medio entre débito y crédito para clasificar
    const midPoint = (debitoColumnX + creditoColumnX) / 2;

    // Regex para detectar fecha al inicio de línea
    const dateRegex = /^(\d{2}\/\d{2}\/\d{2})\b/;
    // Regex para extraer número de comprobante
    const comprobanteRegex = /^\d{2}\/\d{2}\/\d{2}\s+(\d+)/;

    console.log('Procesando', linesWithPositions.length, 'líneas del PDF');
    console.log('='.repeat(80));

    for (const lineData of linesWithPositions) {
        const trimmedLine = lineData.text.trim();

        // Ignorar líneas vacías o de encabezado
        if (!trimmedLine ||
            /^(Fecha|Comprobante|Movimiento|D[eé]bito|Cr[eé]dito|Saldo)$/i.test(trimmedLine) ||
            /Cuenta Corriente N[º°]/i.test(trimmedLine) ||
            /P[aá]gina\s+\d+/i.test(trimmedLine) ||
            /Saldo total/i.test(trimmedLine) ||
            /Detalle impositivo/i.test(trimmedLine)) {
            continue;
        }

        // Verificar si la línea empieza con fecha
        const dateMatch = trimmedLine.match(dateRegex);

        if (dateMatch) {
            // Guardar movimiento anterior si existe
            if (currentMovement) {
                movements.push(currentMovement);
            }

            // Extraer fecha y convertir de DD/MM/YY a DD/MM/YYYY
            const dateParts = dateMatch[1].split('/');
            const year = parseInt(dateParts[2]);
            const fullYear = year < 50 ? `20${dateParts[2]}` : `19${dateParts[2]}`;
            const fecha = `${dateParts[0]}/${dateParts[1]}/${fullYear}`;

            // Extraer comprobante
            const comprobanteMatch = trimmedLine.match(comprobanteRegex);
            const comprobante = comprobanteMatch ? comprobanteMatch[1] : '';

            // Encontrar todos los importes con sus posiciones X
            // Mejorar regex para capturar más formatos de importes
            const amountsWithPositions = [];
            for (const item of lineData.items) {
                // Buscar items que sean importes - múltiples patrones
                // Formato: 1.234,56 o 123,45 o $1.234,56
                const amountMatch = item.text.match(/^\$?\s*([\d.]+,\d{2})$/) ||
                                   item.text.match(/^([\d.]+,\d{2})$/);
                if (amountMatch) {
                    amountsWithPositions.push({
                        value: amountMatch[1],
                        x: item.x,
                        text: item.text
                    });
                }
            }

            // Ordenar por posición X (izquierda a derecha)
            amountsWithPositions.sort((a, b) => a.x - b.x);

            // Extraer descripción
            let descripcion = trimmedLine;
            descripcion = descripcion.replace(dateRegex, '').trim();
            if (comprobante) {
                descripcion = descripcion.replace(new RegExp('^' + comprobante + '\\s*'), '').trim();
            }
            descripcion = descripcion.replace(/\$?\s*[\d.]+,\d{2}/g, '').trim();

            // Clasificar importes por posición de columna
            let debito = '0';
            let credito = '0';
            let saldo = '0';

            // Log para debug
            console.log(`Fila PDF: ${trimmedLine.substring(0, 100)}`);
            console.log(`  Importes encontrados: ${amountsWithPositions.length}`);
            amountsWithPositions.forEach((a, i) => {
                console.log(`    [${i}] valor: ${a.value}, X: ${a.x.toFixed(1)}`);
            });

            if (amountsWithPositions.length >= 1) {
                // El último siempre es saldo (columna más a la derecha)
                saldo = amountsWithPositions[amountsWithPositions.length - 1].value;
            }

            if (amountsWithPositions.length >= 2) {
                // El penúltimo es el movimiento (débito o crédito)
                const movAmount = amountsWithPositions[amountsWithPositions.length - 2];

                // Clasificar según posición X
                if (movAmount.x < midPoint) {
                    debito = movAmount.value;
                } else {
                    credito = movAmount.value;
                }
            }

            // Si hay 3 importes, el primero y segundo son débito y crédito
            if (amountsWithPositions.length >= 3) {
                const first = amountsWithPositions[0];
                const second = amountsWithPositions[1];

                if (first.x < midPoint) {
                    debito = first.value;
                } else {
                    credito = first.value;
                }

                if (second.x < midPoint && debito === '0') {
                    debito = second.value;
                } else if (second.x >= midPoint && credito === '0') {
                    credito = second.value;
                }
            }

            console.log(`  → Débito: ${debito} | Crédito: ${credito} | Saldo: ${saldo}`);
            console.log('-'.repeat(80));

            currentMovement = {
                fecha: fecha,
                descripcion: descripcion,
                origen: comprobante,
                debito: debito,
                credito: credito,
                saldo: saldo
            };

        } else if (currentMovement) {
            // Es continuación de la descripción
            if (!/^(Fecha|Comprobante|Movimiento|D[eé]bito|Cr[eé]dito|Saldo|P[aá]gina|Cuenta Corriente)/i.test(trimmedLine)) {
                currentMovement.descripcion += ' ' + trimmedLine;
            }
        }
    }

    // No olvidar el último movimiento
    if (currentMovement) {
        movements.push(currentMovement);
    }

    // Filtrar "Saldo Inicial" y limpiar descripciones
    let filteredMovements = movements
        .filter(mov => !/Saldo Inicial/i.test(mov.descripcion))
        .map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .replace(/Fecha\s+Comprobante\s+Movimiento\s+D[eé]bito\s+Cr[eé]dito\s+Saldo/gi, '')
                .trim();
            return mov;
        });

    console.log('='.repeat(80));
    console.log('Movimientos encontrados:', filteredMovements.length);

    // VALIDACIÓN ADICIONAL: Corregir movimientos con 0/0 usando cambio de saldo
    filteredMovements = validateAndFixAmounts(filteredMovements, saldoInicial);

    return filteredMovements;
}

// Función de validación: Si Crédito=0 y Débito=0 pero el saldo cambió, calcular el movimiento
function validateAndFixAmounts(movements, saldoInicial) {
    const parseArgentineNumber = (value) => {
        if (!value || value === '0') return 0;
        return parseFloat(value.replace(/\./g, '').replace(',', '.'));
    };

    const formatArgentineNumber = (num) => {
        if (num === 0) return '0';
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).replace(/\s/g, '');
    };

    let saldoAnterior = saldoInicial ? parseArgentineNumber(saldoInicial) : null;
    let fixedCount = 0;

    console.log('='.repeat(80));
    console.log('VALIDACIÓN DE IMPORTES (por cambio de saldo)');
    console.log('Saldo inicial:', saldoAnterior);
    console.log('='.repeat(80));

    for (let i = 0; i < movements.length; i++) {
        const mov = movements[i];
        const saldoActual = parseArgentineNumber(mov.saldo);
        const debito = parseArgentineNumber(mov.debito);
        const credito = parseArgentineNumber(mov.credito);

        // Si no tenemos saldo anterior, usar el primero disponible
        if (saldoAnterior === null && i === 0) {
            // Para el primer movimiento, si tiene saldo pero no tiene movimiento,
            // necesitamos inferir del siguiente
            saldoAnterior = saldoActual - credito + debito;
        }

        // VALIDACIÓN: Si ambos son 0 pero el saldo cambió
        if (debito === 0 && credito === 0 && saldoAnterior !== null && saldoActual !== saldoAnterior) {
            const diferencia = saldoActual - saldoAnterior;

            console.log(`⚠️  Corrigiendo movimiento: ${mov.descripcion.substring(0, 50)}`);
            console.log(`    Saldo anterior: ${saldoAnterior}, Saldo actual: ${saldoActual}`);
            console.log(`    Diferencia: ${diferencia}`);

            if (diferencia > 0) {
                // El saldo aumentó → es crédito
                mov.credito = formatArgentineNumber(diferencia);
                mov.debito = '0';
                console.log(`    → Asignado como CRÉDITO: ${mov.credito}`);
            } else {
                // El saldo disminuyó → es débito
                mov.debito = formatArgentineNumber(Math.abs(diferencia));
                mov.credito = '0';
                console.log(`    → Asignado como DÉBITO: ${mov.debito}`);
            }
            fixedCount++;
        }

        // También verificar si el movimiento ya tiene valor pero está en la columna incorrecta
        // comparando con el cambio de saldo esperado
        if ((debito > 0 || credito > 0) && saldoAnterior !== null) {
            const cambioEsperado = saldoActual - saldoAnterior;
            const cambioCalculado = credito - debito;

            // Si el cambio no coincide, puede estar invertido
            if (Math.abs(cambioEsperado - cambioCalculado) > 0.01 && Math.abs(cambioEsperado + cambioCalculado) < 0.01) {
                console.log(`⚠️  Invirtiendo débito/crédito: ${mov.descripcion.substring(0, 50)}`);
                const temp = mov.debito;
                mov.debito = mov.credito;
                mov.credito = temp;
                fixedCount++;
            }
        }

        // Actualizar saldo anterior para el siguiente movimiento
        saldoAnterior = saldoActual;
    }

    console.log('='.repeat(80));
    console.log(`Movimientos corregidos por validación de saldo: ${fixedCount}`);
    console.log('='.repeat(80));

    return movements;
}

// Función legacy - mantener para compatibilidad
function parseSantanderLineByLine(lines) {
    // Convertir líneas simples a formato con posiciones (fallback)
    const linesWithPositions = lines.map(line => ({
        text: line,
        items: [{ text: line, x: 0 }]
    }));
    return parseSantanderWithPositions(linesWithPositions);
}

// Clasificar débito/crédito comparando saldos
function classifyDebitCredit(movements, saldoInicial) {
    const parseArgentineNumber = (value) => {
        if (!value || value === '0') return 0;
        return parseFloat(value.replace(/\./g, '').replace(',', '.'));
    };

    const formatArgentineNumber = (num) => {
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).replace(/\s/g, '');
    };

    let saldoAnterior = saldoInicial ? parseArgentineNumber(saldoInicial) : 0;

    for (const mov of movements) {
        const saldoActual = parseArgentineNumber(mov.saldo);
        const importe = parseArgentineNumber(mov.importe);

        // Determinar si es débito o crédito comparando saldos
        // Si el saldo aumentó → es crédito
        // Si el saldo disminuyó → es débito
        const diferencia = saldoActual - saldoAnterior;

        if (diferencia > 0) {
            // El saldo aumentó → crédito
            mov.credito = mov.importe;
            mov.debito = '0';
        } else if (diferencia < 0) {
            // El saldo disminuyó → débito
            mov.debito = mov.importe;
            mov.credito = '0';
        } else {
            // Sin cambio (raro, pero posible)
            if (importe > 0) {
                mov.credito = mov.importe;
                mov.debito = '0';
            }
        }

        // Limpiar campo temporal
        delete mov.importe;

        // Actualizar saldo anterior
        saldoAnterior = saldoActual;
    }

    // Limpiar descripciones
    for (const mov of movements) {
        mov.descripcion = mov.descripcion
            .replace(/\s+/g, ' ')
            .replace(/Fecha\s+Comprobante\s+Movimiento\s+D[eé]bito\s+Cr[eé]dito\s+Saldo/gi, '')
            .trim();
    }

    return movements;
}

// Función legacy para compatibilidad (usa texto plano)
function parseSantanderExtract(text) {
    // Esta función ya no se usa, pero se mantiene por compatibilidad
    return [];
}

async function processSantanderPDF(pdfFile) {
    try {
        // Extraer texto CON POSICIONES para determinar columnas
        const linesWithPositions = await extractTextWithPositions(pdfFile);
        console.log('Líneas extraídas del PDF:', linesWithPositions.length);

        // Extraer saldo inicial de Santander
        // Buscar en la línea "Saldo Inicial" - el último número es el saldo
        state.saldoInicial = null;

        // Buscar línea de Saldo Inicial
        for (const lineData of linesWithPositions) {
            if (/Saldo Inicial/i.test(lineData.text)) {
                const amounts = lineData.text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
                if (amounts && amounts.length >= 1) {
                    // El último importe en la línea de Saldo Inicial es el saldo
                    state.saldoInicial = amounts[amounts.length - 1];
                }
                break;
            }
        }

        console.log('Saldo inicial encontrado:', state.saldoInicial);

        // Parsear movimientos usando POSICIONES DE COLUMNAS
        // Y validación adicional por cambio de saldo como respaldo
        const movements = parseSantanderWithPositions(linesWithPositions, state.saldoInicial);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF. Verifique que el archivo contenga movimientos con formato de fecha DD/MM/YY.');
            return;
        }

        console.log('Movimientos procesados:', movements.length);
        if (movements.length > 0) {
            console.log('Primer movimiento:', movements[0]);
            console.log('Último movimiento:', movements[movements.length - 1]);
        }

        state.extractedData = movements;
        showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        renderPreview();

    } catch (err) {
        console.error('Error procesando PDF Santander:', err);
        throw err;
    }
}

async function processBPNPDF(pdfFile) {
    try {
        // Extraer texto CON POSICIONES para determinar columnas
        const linesWithPositions = await extractTextWithPositions(pdfFile);
        console.log('Líneas extraídas del PDF BPN:', linesWithPositions.length);

        // Extraer saldo inicial del BPN
        // Buscar "Saldo Anterior" o similar antes de la tabla de movimientos
        state.saldoInicial = null;

        // Buscar línea de Saldo Anterior
        for (const lineData of linesWithPositions) {
            if (/Saldo\s+Anterior/i.test(lineData.text)) {
                const amounts = lineData.text.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g);
                if (amounts && amounts.length >= 1) {
                    // El último importe en la línea de Saldo Anterior es el saldo
                    state.saldoInicial = amounts[amounts.length - 1];
                }
                break;
            }
        }

        console.log('Saldo inicial BPN encontrado:', state.saldoInicial);

        // Parsear movimientos usando POSICIONES DE COLUMNAS
        const movements = parseBPNWithPositions(linesWithPositions, state.saldoInicial);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF. Verifique que el archivo contenga movimientos con formato de fecha DD/MM/YYYY.');
            return;
        }

        console.log('Movimientos BPN procesados:', movements.length);
        if (movements.length > 0) {
            console.log('Primer movimiento:', movements[0]);
            console.log('Último movimiento:', movements[movements.length - 1]);
        }

        state.extractedData = movements;
        showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        renderPreview();

    } catch (err) {
        console.error('Error procesando PDF BPN:', err);
        throw err;
    }
}

async function processMacroPDF(pdfFile, subOption = '') {
    try {
        // Extraer texto CON POSICIONES para determinar columnas
        const linesWithPositions = await extractTextWithPositions(pdfFile);
        console.log('Líneas extraídas del PDF Macro:', linesWithPositions.length);

        // Banco Macro no muestra saldo inicial explícitamente en el encabezado
        state.saldoInicial = null;

        // Determinar qué tipo de extracto es
        let extractType = subOption;

        // Si no se especificó sub-opción, detectar automáticamente
        if (!extractType) {
            extractType = detectMacroExtractType(linesWithPositions);
            console.log('Tipo de extracto detectado automáticamente:', extractType);
        } else {
            console.log('Tipo de extracto seleccionado por usuario:', extractType);
        }

        // Parsear según el tipo de extracto
        let movements;
        if (extractType === 'macro-extracto') {
            // Extracto Bancario (columnas DEBITOS y CREDITOS separadas)
            movements = parseMacroExtractoBancario(linesWithPositions);
        } else {
            // Resumen de Movimientos (columna única de Importe con signo)
            movements = parseMacroWithPositions(linesWithPositions);
        }

        if (movements.length === 0) {
            const formatoMsg = extractType === 'macro-extracto'
                ? 'Extracto Bancario (DD/MM/YY)'
                : 'Resumen de Movimientos (DD/MM/YYYY)';
            showError(`No se encontraron movimientos en el PDF. Verifique que el archivo sea del formato "${formatoMsg}".`);
            return;
        }

        console.log('Movimientos Macro procesados:', movements.length);
        if (movements.length > 0) {
            console.log('Primer movimiento:', movements[0]);
            console.log('Último movimiento:', movements[movements.length - 1]);
        }

        // Verificar si hay múltiples cuentas
        if (extractType === 'macro-extracto') {
            const cuentas = [...new Set(movements.map(m => m.cuenta).filter(c => c))];
            if (cuentas.length > 1) {
                console.log('Cuentas encontradas:', cuentas);
                showSuccess(`¡Archivo procesado! ${movements.length} movimientos de ${cuentas.length} cuentas: ${cuentas.join(', ')}`);
            } else {
                showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
            }
        } else {
            showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        }

        state.extractedData = movements;
        renderPreview();

    } catch (err) {
        console.error('Error procesando PDF Macro:', err);
        throw err;
    }
}

function parseGaliciaInversionesExtract(text) {
    const movements = [];

    const instrumentoMatch = text.match(/BONO - ([A-Z0-9-]+)/);
    const nombreInstrumento = instrumentoMatch ? instrumentoMatch[1] : 'BONO';

    const regex = /(\d{2}\/\d{2}\/\d{4})\s+(COMPRA|VENTA)\s+BYMA\s+([\d.,]+)\s+(?:USD|\$)\s+([\d.,]+)\s+(?:USD|\$)\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const fecha = match[1];
        const tipo = match[2];
        const cantidad = match[3];
        const precio = match[4];
        const monto = match[5];

        movements.push({
            fecha: fecha,
            descripcion: `${nombreInstrumento} - ${tipo}`,
            origen: cantidad,
            credito: tipo === 'COMPRA' ? monto : '0',
            debito: tipo === 'VENTA' ? monto : '0',
            saldo: ''
        });
    }

    return movements;
}

async function processGaliciaPDF(pdfFile) {
    try {
        const text = await extractTextFromPDF(pdfFile);

        const saldoInicialValue = extractSaldoInicial(text);
        state.saldoInicial = saldoInicialValue;

        const movements = parseGaliciaExtract(text);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF.');
            return;
        }

        state.extractedData = movements;
        showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        renderPreview();

    } catch (err) {
        throw err;
    }
}

async function processBBVAPDF(pdfFile) {
    try {
        const text = await extractTextFromPDF(pdfFile);

        const saldoInicialValue = extractSaldoInicial(text);
        state.saldoInicial = saldoInicialValue;

        const movements = parseBBVAExtract(text);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF.');
            return;
        }

        state.extractedData = movements;
        showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        renderPreview();

    } catch (err) {
        throw err;
    }
}

async function processGaliciaInversionesPDF(pdfFile) {
    try {
        const text = await extractTextFromPDF(pdfFile);

        state.saldoInicial = null;

        const movements = parseGaliciaInversionesExtract(text);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF.');
            return;
        }

        state.extractedData = movements;
        showSuccess(`¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`);
        renderPreview();

    } catch (err) {
        throw err;
    }
}

// ============================================
// BANCO DE LA PAMPA - Parser y Procesador
// ============================================

// Mapeo de conceptos a secciones de detalle
const LAPAMPA_CONCEPTO_SECCION = {
    'DEBITO DIRECTO': 'DEBITOS_AUTOMATICOS',
    'TC. DEB. AUT.': 'DEBITOS_AUTOMATICOS',
    'E-BANKING TRF.': 'TRANSFERENCIAS_EMITIDAS',
    'E-BANKING TRF SUELDO': 'TRANSFERENCIAS_EMITIDAS',
    'TRF.POR CAJ.AUT./HB': 'TRANSFERENCIAS_RECIBIDAS',
    'CR.DEBIN': 'TRANSFERENCIAS_RECIBIDAS',
    'DATANET': 'TRANSFERENCIAS_RECIBIDAS'
};

// Conceptos que NO tienen detalle adicional
const LAPAMPA_SIN_DETALLE = [
    'COMER FISERV-VISA',
    'COMER FS-MC/MA/MD',
    'COMER CABAL',
    'IMP. I.B SIRCREB',
    'IMP.DEB/CRED P/CRED.',
    'IMP.DEB/CRED P/DEB.',
    'COM.TRANSF.EMIT.HB',
    'COM.X REC. TRANSF.HB',
    'IMP. LEY 25413',
    'IMP. SELLOS',
    'COM. MANTENIMIENTO',
    'PERCEP. IIBB',
    'RET.IMP.GANANCIAS'
];

// Frases que indican líneas de basura (pie de página, encabezados de página, etc.)
// Si la línea contiene CUALQUIERA de estas frases, se descarta
const LAPAMPA_FRASES_BASURA = [
    // Pie de página legal - Defensa del Consumidor
    'Defensa del Consumidor',
    '0800-333-7148',
    '0800-222-9042',
    '0800-999-2727',
    'Se presumirá conformidad',
    'formulación de un reclamo',
    'garantía de hasta',
    '$25.000.000',
    'Ley 24.485',
    'Decreto 540/95',
    'Com. "A" 2337',
    'Com."A" 2337',
    'tasas superiores a la de referencia',
    'adquiridos por endoso',
    'personas vinculadas a la entidad',
    'provincia de La Pampa',
    'Ley 1949',
    'Carta Orgánica del Banco',
    'operaciones financieras pasivas',
    'Banco de La Pampa S.E.M',
    'garantiza los depósitos',
    'depósitos en pesos y en moneda extranjera',
    'prorrateará entre sus titulares',
    'número de cuentas y/o depósitos',
    'captados a tasas superiores',
    'límites establecidos por el Banco Central',
    // Encabezados de página que se pegan con el pie
    'Cuenta Número:',
    'INSPECTOR GATICA',
    '8300-NEUQUEN',
    'SUCURSAL CIPOLLETTI',
    'I.V.A.:',
    'R. I.',
    'Fecha emisión:',
    'Pág.:',
    'Hoja N',
    'Titulares:',
    'Cantidad de Titulares',
    // Identificadores de cuenta/cliente
    'CEDISA SRL',
    'Cuenta Corriente Bancaria',
    'Moneda: INSPECTOR GATICA',
    'Moneda: Pesos'
];

// Función para detectar si una línea es basura (pie de página, encabezado, etc.)
function esLineaBasuraBDLP(linea) {
    if (!linea || typeof linea !== 'string') return true;
    const texto = linea.trim();
    if (!texto) return true;

    // Filtrar líneas con número de página + guiones (ej: "792 ____...", "793 _____...")
    // Esto viene de la línea "Pág.: 792" del encabezado o números de página sueltos
    if (/^\d{1,4}\s*[_\-]+/.test(texto)) {
        console.log('Línea de basura filtrada (número de página + guiones):', texto.substring(0, 50));
        return true;
    }

    // Filtrar líneas que son solo guiones bajos
    if (/^[_\-]+$/.test(texto)) {
        console.log('Línea de basura filtrada (solo guiones):', texto.substring(0, 50));
        return true;
    }

    // Filtrar números de página sueltos (solo 1-4 dígitos sin más contenido válido)
    if (/^\d{1,4}$/.test(texto)) {
        console.log('Línea de basura filtrada (número de página suelto):', texto);
        return true;
    }

    // Si contiene cualquiera de las frases de basura, descartar
    const esBasura = LAPAMPA_FRASES_BASURA.some(frase => texto.includes(frase));
    if (esBasura) {
        console.log('Línea de basura filtrada:', texto.substring(0, 80) + (texto.length > 80 ? '...' : ''));
    }
    return esBasura;
}

// Parsear extracto La Pampa con posiciones
function parseLaPampaWithPositions(linesWithPositions) {
    const movements = [];
    const detallesDebitosAuto = [];
    const detallesTransfEmitidas = [];
    const detallesTransfRecibidas = [];

    let currentSection = 'MOVIMIENTOS';
    let inMovimientosSection = false;
    let foundSaldoFinal = false;

    // Detectar posiciones de columnas del encabezado de movimientos
    let fechaColumnX = null;
    let conceptoColumnX = null;
    let comprobanteColumnX = null;
    let debitoColumnX = null;
    let creditoColumnX = null;
    let saldoColumnX = null;

    // Variable para trackear el saldo del movimiento anterior (validación de coherencia)
    let saldoAnterior = null;

    // Conceptos que típicamente son DÉBITOS (salidas de dinero)
    const CONCEPTOS_DEBITO = [
        'IMP.', 'DEBITO', 'PAGO', 'E-BANKING TRF', 'COM.', 'CHQ.PAG', 'TC. DEB',
        'DEBITO DIRECTO', 'PERCEP.', 'RET.', 'TRANSF.', 'IVA', 'GANANCIAS'
    ];

    // Conceptos que típicamente son CRÉDITOS (entradas de dinero)
    const CONCEPTOS_CREDITO = [
        'TRF.POR CAJ.AUT./HB', 'CR.DEBIN', 'DEP.', 'DATANET', 'COMER FISERV',
        'COMER FS-MC', 'COMER CABAL', 'ACRED.', 'CREDITO', 'DEPOSITO'
    ];

    // Regex para detectar fecha DD/MM/AA o DD/MM/AAAA
    const dateRegex = /^(\d{2}\/\d{2}\/\d{2,4})\b/;

    // Funciones de parseo para el formato particular del BDLP
    // El BDLP usa: punto como decimal (27165.83), coma como separador de millones en saldos (68,428615.16)

    // Parsear importes de débito/crédito del BDLP (formato: 27165.83 - punto es decimal)
    const parseImporteBDLP = (importeStr) => {
        if (!importeStr || importeStr.trim() === '' || importeStr === '0') return 0;
        // El punto ya es decimal, no hay separador de miles
        return parseFloat(importeStr.trim());
    };

    // Parsear saldos del BDLP (formato: 68,428615.16 o -2,965669.21 - coma separa millones, punto es decimal)
    const parseSaldoBDLP = (saldoStr) => {
        if (!saldoStr || saldoStr.trim() === '') return 0;
        let cleaned = saldoStr.trim();
        // Detectar si es negativo ANTES de limpiar
        const isNegative = cleaned.startsWith('-');
        if (isNegative) {
            cleaned = cleaned.substring(1); // Quitar el signo para procesar
        }
        // Si tiene coma, es separador de millones (formato BDLP)
        // Ejemplo: "68,428615.16" -> "68428615.16"
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/,/g, '');
        }
        // Ahora el punto es decimal
        const result = parseFloat(cleaned);
        return isNegative ? -result : result;
    };

    // Convertir número a formato argentino para mostrar/almacenar
    const formatoArgentino = (numero) => {
        if (numero === null || numero === undefined || numero === 0) return '0';
        return numero.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // Regex para detectar importes del BDLP (punto como decimal)
    // Formato débito/crédito: 27165.83, 1142.31, 10388.35
    // Formato saldo: 68,428615.16 o 400307.02 o -2,965669.21 (negativos)
    const bdlpImporteRegex = /^-?\d+(?:,\d+)?\.\d{2}$/;

    console.log('='.repeat(80));
    console.log('PROCESANDO EXTRACTO BANCO DE LA PAMPA');
    console.log('='.repeat(80));

    // Primera pasada: detectar secciones y columnas
    for (let i = 0; i < linesWithPositions.length; i++) {
        const lineData = linesWithPositions[i];
        const text = lineData.text.trim();

        // Detectar encabezado de columnas de movimientos
        if (text.includes('Fecha') && text.includes('Concepto') && text.includes('Comprob')) {
            console.log('Encabezado de movimientos encontrado:', text);
            inMovimientosSection = true;

            // Detectar posiciones de columnas
            for (const item of lineData.items) {
                const itemText = item.text.trim().toLowerCase();
                if (itemText === 'fecha') fechaColumnX = item.x;
                else if (itemText === 'concepto') conceptoColumnX = item.x;
                else if (itemText.includes('comprob')) comprobanteColumnX = item.x;
                else if (itemText.includes('débito') || itemText.includes('debito')) debitoColumnX = item.x;
                else if (itemText.includes('crédito') || itemText.includes('credito')) creditoColumnX = item.x;
                else if (itemText === 'saldos' || itemText === 'saldo') saldoColumnX = item.x;
            }
            console.log('Columnas detectadas - Fecha:', fechaColumnX, 'Concepto:', conceptoColumnX,
                        'Comprob:', comprobanteColumnX, 'Débito:', debitoColumnX,
                        'Crédito:', creditoColumnX, 'Saldo:', saldoColumnX);
            continue;
        }

        // Detectar saldo final (marca el fin de la sección de movimientos)
        if (/Saldo\s+final/i.test(text) || /SALDO\s+FINAL/i.test(text)) {
            console.log('Saldo final encontrado - fin de movimientos principales');
            foundSaldoFinal = true;
            currentSection = 'POST_MOVIMIENTOS';
            continue;
        }

        // Detectar secciones de detalle
        if (/DEBITOS\s+AUTOMATICOS/i.test(text)) {
            currentSection = 'DEBITOS_AUTOMATICOS';
            console.log('Sección DEBITOS AUTOMATICOS detectada');
            continue;
        }
        if (/TRANSFERENCIAS\s+EMITIDAS/i.test(text)) {
            currentSection = 'TRANSFERENCIAS_EMITIDAS';
            console.log('Sección TRANSFERENCIAS EMITIDAS detectada');
            continue;
        }
        if (/TRANSFERENCIAS\s+RECIBIDAS/i.test(text)) {
            currentSection = 'TRANSFERENCIAS_RECIBIDAS';
            console.log('Sección TRANSFERENCIAS RECIBIDAS detectada');
            continue;
        }
    }

    // Si no detectamos columnas, usar valores por defecto
    if (!debitoColumnX || !creditoColumnX) {
        fechaColumnX = fechaColumnX || 30;
        conceptoColumnX = conceptoColumnX || 80;
        comprobanteColumnX = comprobanteColumnX || 280;
        debitoColumnX = debitoColumnX || 350;
        creditoColumnX = creditoColumnX || 430;
        saldoColumnX = saldoColumnX || 510;
        console.log('Usando posiciones de columnas por defecto');
    }

    // Calcular punto medio para clasificar débito/crédito
    const midPoint = (debitoColumnX + creditoColumnX) / 2;

    // Segunda pasada: parsear datos
    currentSection = 'MOVIMIENTOS';
    let currentMovement = null;
    // Flag para controlar que solo procesamos movimientos DESPUÉS de encontrar SALDO ANTERIOR
    // Esto evita que las líneas del encabezado de cada página (como "Fecha emisión: 02/09/24")
    // sean confundidas con movimientos
    let puedeProcesamoMovimientos = false;

    for (let i = 0; i < linesWithPositions.length; i++) {
        const lineData = linesWithPositions[i];
        const text = lineData.text.trim();

        // Detectar encabezado de columnas de nueva página - resetear flag de procesamiento
        // Esto asegura que cada página solo procese movimientos DESPUÉS de su SALDO ANTERIOR
        if (text.includes('Fecha') && text.includes('Concepto') && text.includes('Comprob') &&
            (text.includes('Débito') || text.includes('Debito') || text.includes('Crédito') || text.includes('Credito'))) {
            console.log('Nueva página detectada (encabezado de columnas) - esperando SALDO ANTERIOR');
            puedeProcesamoMovimientos = false;
            continue;
        }

        // Ignorar líneas vacías o de encabezado/pie de página
        if (!text ||
            // Encabezados de columnas
            /^(Fecha|Fec\.Mov|Concepto|Comprob|D[eé]bito|Cr[eé]dito|Saldos?)$/i.test(text) ||
            /Detalle de la Transacci[oó]n/i.test(text) ||
            /^Importe$/i.test(text) ||
            // Encabezados del banco
            /Banco de La Pampa/i.test(text) ||
            // Paginación
            /P[aá]gina\s+\d+/i.test(text) ||
            /^\d+\s+de\s+\d+$/i.test(text) ||  // "1 de 5"
            /^-\s*\d+\s*-$/i.test(text) ||      // "- 1 -"
            // Datos de cuenta/cliente
            /^CUIT:/i.test(text) ||
            /^CBU:/i.test(text) ||
            /^Alias:/i.test(text) ||
            /^Nro\.?\s+Cuenta/i.test(text) ||
            /^Tipo\s+Cuenta/i.test(text) ||
            /^Sucursal:/i.test(text) ||
            // Encabezados de secciones informativas
            /^CUENTA\s+CORRIENTE/i.test(text) ||
            /^RESUMEN\s+DE\s+CUENTA/i.test(text) ||
            /^EXTRACTO\s+BANCARIO/i.test(text) ||
            /^PER[IÍ]ODO:/i.test(text) ||
            /^Fecha\s+de\s+emisi[oó]n/i.test(text) ||
            // Líneas que solo contienen números de referencia sin fecha
            /^\d{1,3}$/i.test(text) ||            // Solo número corto (probablemente página)
            // Pie de página común
            /www\./i.test(text) ||
            /https?:\/\//i.test(text) ||
            /^\d{4}-\d{4}$/i.test(text) ||        // Número de teléfono
            /^Tel[eé]fono/i.test(text) ||
            // Filtrar pie de página legal y encabezados de página
            esLineaBasuraBDLP(text)) {
            continue;
        }

        // Capturar saldo inicial/anterior para la validación de coherencia
        // IMPORTANTE: SALDO ANTERIOR marca el inicio de los movimientos reales de esta página
        if (/SALDO\s+ANTERIOR/i.test(text) || /Saldo\s+inicial/i.test(text)) {
            // Activar el flag - a partir de aquí podemos procesar movimientos
            puedeProcesamoMovimientos = true;
            console.log('SALDO ANTERIOR encontrado - habilitando procesamiento de movimientos');

            // Extraer el saldo de esta línea (incluye negativos)
            const saldoMatches = text.match(/-?\d+(?:,\d+)?\.\d{2}/g);
            if (saldoMatches && saldoMatches.length > 0) {
                const saldoRaw = saldoMatches[saldoMatches.length - 1];
                // Usar la función parseSaldoBDLP que ya maneja negativos y comas
                saldoAnterior = parseSaldoBDLP(saldoRaw);
                console.log('Saldo inicial/anterior detectado:', saldoAnterior);
            }
            continue;
        }

        // Filtrar líneas que NO son movimientos (encabezados, totales, saldos informativos)
        if (/Titulares:/i.test(text) ||
            /Cantidad de Titulares/i.test(text) ||
            /Resumen\s+Consolidado/i.test(text) ||
            /Total\s+D[eé]bitos/i.test(text) ||
            /Total\s+Cr[eé]ditos/i.test(text)) {
            console.log('Línea ignorada (no es movimiento):', text.substring(0, 50));
            continue;
        }

        // Actualizar sección según marcadores
        if (/Saldo\s+final/i.test(text)) {
            currentSection = 'POST_MOVIMIENTOS';
            if (currentMovement) {
                movements.push(currentMovement);
                currentMovement = null;
            }
            continue;
        }
        if (/DEBITOS\s+AUTOMATICOS/i.test(text)) {
            currentSection = 'DEBITOS_AUTOMATICOS';
            continue;
        }
        if (/TRANSFERENCIAS\s+EMITIDAS/i.test(text)) {
            currentSection = 'TRANSFERENCIAS_EMITIDAS';
            continue;
        }
        if (/TRANSFERENCIAS\s+RECIBIDAS/i.test(text)) {
            currentSection = 'TRANSFERENCIAS_RECIBIDAS';
            continue;
        }

        // Procesar según sección actual
        if (currentSection === 'MOVIMIENTOS') {
            // CRÍTICO: Solo procesar movimientos DESPUÉS de encontrar SALDO ANTERIOR
            // Esto evita que las líneas del encabezado de página (como "Fecha emisión: 02/09/24")
            // sean procesadas como movimientos
            if (!puedeProcesamoMovimientos) {
                console.log('Línea ignorada (antes de SALDO ANTERIOR):', text.substring(0, 60));
                continue;
            }

            // Verificar si la línea empieza con fecha
            const dateMatch = text.match(dateRegex);

            if (dateMatch) {
                // Guardar movimiento anterior si existe
                if (currentMovement) {
                    movements.push(currentMovement);
                }

                // Extraer fecha y convertir formato
                let fecha = dateMatch[1];
                if (fecha.length === 8) { // DD/MM/YY
                    const parts = fecha.split('/');
                    const year = parseInt(parts[2]);
                    const fullYear = year < 50 ? `20${parts[2]}` : `19${parts[2]}`;
                    fecha = `${parts[0]}/${parts[1]}/${fullYear}`;
                }

                // Buscar importes con sus posiciones (formato BDLP)
                // Formato BDLP: débitos/créditos usan punto decimal (27165.83)
                // Saldos usan coma como separador de millones y punto decimal (68,428615.16 o 400307.02)
                const amountsWithPositions = [];
                for (const item of lineData.items) {
                    const itemText = item.text.trim();
                    // Verificar si es un importe en formato BDLP:
                    // - Débito/Crédito: 27165.83, 1142.31 (número con punto decimal)
                    // - Saldo: 68,428615.16 o 400307.02 (opcionalmente con coma de millones)
                    if (/^-?\d+(?:,\d+)?\.\d{2}$/.test(itemText)) {
                        amountsWithPositions.push({
                            value: itemText,
                            x: item.x,
                            // Marcar si es probablemente un saldo (tiene coma de millones O es negativo)
                            // Los números negativos son siempre saldos, nunca débitos/créditos individuales
                            esSaldo: itemText.includes(',') || itemText.startsWith('-')
                        });
                    }
                }

                // Ordenar por posición X
                amountsWithPositions.sort((a, b) => a.x - b.x);

                // Extraer comprobante - buscar número después del concepto
                let comprobante = '';
                let concepto = '';

                // Buscar el concepto en la línea (entre fecha y números)
                const textAfterDate = text.replace(dateRegex, '').trim();
                const conceptoMatch = textAfterDate.match(/^([A-Z][A-Z\s.\-\/]+?)(?:\s+\d|$)/i);
                if (conceptoMatch) {
                    concepto = conceptoMatch[1].trim();
                }

                // Buscar número de comprobante (secuencia de dígitos)
                const comprobMatch = textAfterDate.match(/(\d{6,})/);
                if (comprobMatch) {
                    comprobante = comprobMatch[1];
                }

                // Si no encontramos concepto, usar texto sin fecha ni números
                if (!concepto) {
                    concepto = textAfterDate
                        // Limpiar importes en formato BDLP (con punto decimal, opcionalmente coma de millones y/o negativos)
                        .replace(/-?\d+(?:,\d+)?\.\d{2}/g, '')
                        .replace(/\d{6,}/g, '')
                        .trim();
                }

                // Clasificar importes usando VALIDACIÓN POR CONTEXTO
                // Regla clave del BDLP:
                // - SALDOS: pueden tener coma de millones (68,428615.16) - formato XX,XXXXXX.XX
                // - DÉBITOS/CRÉDITOS: NUNCA tienen coma (27165.83)
                let debito = '0';
                let credito = '0';
                let saldo = '0';
                let saldoNumerico = 0;
                let importeNumerico = 0;

                // Separar importes en candidatos a saldo vs candidatos a movimiento
                // Un importe CON coma es definitivamente saldo
                // Un importe SIN coma puede ser movimiento O saldo (si es menor a 1 millón)
                const candidatosSaldo = amountsWithPositions.filter(a => a.esSaldo);
                const candidatosMovimiento = amountsWithPositions.filter(a => !a.esSaldo);

                // Si hay un importe con coma, ESE es el saldo seguro
                if (candidatosSaldo.length >= 1) {
                    // Tomar el que esté más a la derecha (mayor X) como saldo
                    const saldoCandidate = candidatosSaldo.reduce((max, curr) => curr.x > max.x ? curr : max);
                    saldoNumerico = parseSaldoBDLP(saldoCandidate.value);
                    saldo = formatoArgentino(saldoNumerico);

                    // Los candidatos a movimiento son los que NO son el saldo
                    // Si no hay candidatos sin coma, buscar otro importe con coma que no sea el saldo
                    if (candidatosMovimiento.length === 0 && candidatosSaldo.length > 1) {
                        // Varios saldos detectados, el que NO es el saldo principal es el movimiento
                        for (const c of candidatosSaldo) {
                            if (c !== saldoCandidate) {
                                candidatosMovimiento.push(c);
                            }
                        }
                    }
                } else if (amountsWithPositions.length >= 1) {
                    // No hay importes con coma - el último debería ser el saldo
                    // Pero podría ser que el movimiento grande (sin coma) se confunda con saldo
                    // Usar posición X como fallback: el más a la derecha es saldo
                    const saldoCandidate = amountsWithPositions.reduce((max, curr) => curr.x > max.x ? curr : max);
                    saldoNumerico = parseSaldoBDLP(saldoCandidate.value);
                    saldo = formatoArgentino(saldoNumerico);

                    // El resto son candidatos a movimiento
                    for (const a of amountsWithPositions) {
                        if (a !== saldoCandidate) {
                            candidatosMovimiento.push(a);
                        }
                    }
                }

                // Clasificar el movimiento (débito o crédito)
                if (candidatosMovimiento.length >= 1) {
                    // Tomar el candidato a movimiento (si hay varios, el de mayor importe)
                    let movCandidate = candidatosMovimiento[0];
                    if (candidatosMovimiento.length > 1) {
                        movCandidate = candidatosMovimiento.reduce((max, curr) => {
                            const maxVal = parseImporteBDLP(max.value);
                            const currVal = parseImporteBDLP(curr.value);
                            return currVal > maxVal ? curr : max;
                        });
                    }

                    importeNumerico = parseImporteBDLP(movCandidate.value);
                    const importeFormateado = formatoArgentino(importeNumerico);

                    // Determinar si es débito o crédito usando posición X como hint
                    // pero preferir la validación por concepto
                    const esDebito = movCandidate.x < midPoint;
                    if (esDebito) {
                        debito = importeFormateado;
                    } else {
                        credito = importeFormateado;
                    }
                }

                // NOTA: Si hay 2+ candidatos a movimiento, NO asignar a ambas columnas.
                // En un extracto bancario real, cada movimiento es SOLO débito O SOLO crédito.
                // El segundo candidato probablemente es el comprobante u otro número mal interpretado.
                // La lógica anterior (líneas 2659-2681) ya selecciona el mejor candidato único.

                // VALIDACIÓN DE COHERENCIA DE SALDOS
                // Si tenemos saldo anterior, validar que: saldoActual = saldoAnterior - débito + crédito
                // Si no cuadra, corregir la clasificación débito/crédito
                const parseArgNumber = (str) => {
                    if (!str || str === '0') return 0;
                    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
                };

                if (saldoAnterior !== null && saldoNumerico > 0 && importeNumerico > 0) {
                    const debitoNum = parseArgNumber(debito);
                    const creditoNum = parseArgNumber(credito);
                    const saldoEsperadoDebito = saldoAnterior - importeNumerico;
                    const saldoEsperadoCred = saldoAnterior + importeNumerico;

                    // Verificar coherencia
                    const tolerancia = 0.02; // Tolerancia de 2 centavos por redondeo
                    const esCoherenteComoDebito = Math.abs(saldoEsperadoDebito - saldoNumerico) < tolerancia;
                    const esCoherenteComoCredito = Math.abs(saldoEsperadoCred - saldoNumerico) < tolerancia;

                    if (debitoNum > 0 && !esCoherenteComoDebito && esCoherenteComoCredito) {
                        // Clasificado como débito pero debería ser crédito
                        console.log(`CORRECCIÓN: ${concepto} - moviendo ${debito} de DÉBITO a CRÉDITO (saldo coherente)`);
                        credito = debito;
                        debito = '0';
                    } else if (creditoNum > 0 && !esCoherenteComoCredito && esCoherenteComoDebito) {
                        // Clasificado como crédito pero debería ser débito
                        console.log(`CORRECCIÓN: ${concepto} - moviendo ${credito} de CRÉDITO a DÉBITO (saldo coherente)`);
                        debito = credito;
                        credito = '0';
                    } else if (debitoNum === 0 && creditoNum === 0 && importeNumerico > 0) {
                        // No se clasificó, usar coherencia de saldos
                        const importeFormateado = formatoArgentino(importeNumerico);
                        if (esCoherenteComoDebito) {
                            console.log(`CLASIFICACIÓN por coherencia: ${concepto} = DÉBITO ${importeFormateado}`);
                            debito = importeFormateado;
                        } else if (esCoherenteComoCredito) {
                            console.log(`CLASIFICACIÓN por coherencia: ${concepto} = CRÉDITO ${importeFormateado}`);
                            credito = importeFormateado;
                        }
                    }
                }

                // FALLBACK: Si aún no se clasificó, usar el concepto
                if (debito === '0' && credito === '0' && importeNumerico > 0) {
                    const importeFormateado = formatoArgentino(importeNumerico);
                    const conceptoUpper = concepto.toUpperCase();

                    const esConceptoDebito = CONCEPTOS_DEBITO.some(c => conceptoUpper.includes(c.toUpperCase()));
                    const esConceptoCredito = CONCEPTOS_CREDITO.some(c => conceptoUpper.includes(c.toUpperCase()));

                    if (esConceptoDebito && !esConceptoCredito) {
                        console.log(`CLASIFICACIÓN por concepto: ${concepto} = DÉBITO ${importeFormateado}`);
                        debito = importeFormateado;
                    } else if (esConceptoCredito && !esConceptoDebito) {
                        console.log(`CLASIFICACIÓN por concepto: ${concepto} = CRÉDITO ${importeFormateado}`);
                        credito = importeFormateado;
                    }
                }

                currentMovement = {
                    fecha: fecha,
                    descripcion: concepto,
                    origen: comprobante,
                    debito: debito,
                    credito: credito,
                    saldo: saldo,
                    detalle: null
                };

                // Actualizar saldo anterior para el próximo movimiento
                if (saldoNumerico > 0) {
                    saldoAnterior = saldoNumerico;
                }

            } else if (currentMovement) {
                // Continuación de descripción
                if (!/^(Fecha|Concepto|Comprob|Total|Saldo)/i.test(text)) {
                    currentMovement.descripcion += ' ' + text;
                }
            }

        } else if (currentSection === 'DEBITOS_AUTOMATICOS') {
            // Parsear línea de débito automático
            // Formato: DD/MM/AA EMPRESA REFERENCIA (TIPO) COMPROBANTE IMPORTE
            const detMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(\d{9,})\s+([\d.,]+)$/);
            if (detMatch) {
                const detalle = {
                    fecha: detMatch[1],
                    descripcionCompleta: detMatch[2].trim(),
                    comprobante: detMatch[3],
                    importe: detMatch[4],
                    tipo: 'DEBITO_AUTOMATICO'
                };

                // Extraer empresa, referencia y categoría
                const descMatch = detalle.descripcionCompleta.match(/^(.+?)\s+(\d+)\s*(?:\(([^)]+)\))?$/);
                if (descMatch) {
                    detalle.empresa = descMatch[1].trim();
                    detalle.referencia = descMatch[2];
                    detalle.categoria = descMatch[3] || null;
                } else {
                    // Intentar otro patrón
                    const altMatch = detalle.descripcionCompleta.match(/^(.+?)\s*(?:\(([^)]+)\))?\s*$/);
                    if (altMatch) {
                        detalle.empresa = altMatch[1].trim();
                        detalle.categoria = altMatch[2] || null;
                    } else {
                        detalle.empresa = detalle.descripcionCompleta;
                    }
                }

                detallesDebitosAuto.push(detalle);
                console.log('Débito automático:', detalle);
            }

        } else if (currentSection === 'TRANSFERENCIAS_EMITIDAS') {
            // Formato: DD/MM/AA CUIT-RAZON_SOCIAL COMPROBANTE IMPORTE
            // Ejemplo: 06/08/24 30714882445-EXPRESO DE A CUATRO SRL                   000562641  1972348.11
            // La razón social puede tener espacios internos y hay múltiples espacios antes del comprobante
            // Usamos regex que captura desde el final: comprobante (9+ dígitos) y luego importe
            const detMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{11})-(.+?)\s{2,}(\d{9,})\s+([\d.,]+)\s*$/);
            if (detMatch) {
                const detalle = {
                    fecha: detMatch[1],
                    cuit: detMatch[2],
                    razonSocial: detMatch[3].trim(),
                    comprobante: detMatch[4],
                    importe: detMatch[5],
                    tipo: 'TRANSFERENCIA_EMITIDA'
                };
                detallesTransfEmitidas.push(detalle);
                console.log('Transferencia emitida:', detalle);
            } else {
                // Regex alternativo: un solo espacio antes del comprobante
                const altMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{11})-(.+)\s+(\d{9,})\s+([\d.,]+)\s*$/);
                if (altMatch) {
                    const detalle = {
                        fecha: altMatch[1],
                        cuit: altMatch[2],
                        razonSocial: altMatch[3].trim(),
                        comprobante: altMatch[4],
                        importe: altMatch[5],
                        tipo: 'TRANSFERENCIA_EMITIDA'
                    };
                    detallesTransfEmitidas.push(detalle);
                    console.log('Transferencia emitida (alt):', detalle);
                }
            }

        } else if (currentSection === 'TRANSFERENCIAS_RECIBIDAS') {
            // Formato: DD/MM/AA CUIT-NOMBRE REFERENCIA COMPROBANTE IMPORTE
            // Ejemplos:
            // 01/08/24 30717286789-DINASTIBASA S. R. L.           VAR-       000127877   519417.57
            // 01/08/24 20238017328-LUNA GABRIEL                   VAR-VARIOS 000237092   432357.54
            // 01/08/24 20168419563-DEVOTO HUGO RAUL               VAR-VARVarios 000277627 1600000.00
            // 01/08/24 20165119100-AGOSTINELLI JUAN JOSE          FAC-Agostinelli 000284493 68883.21
            // 02/08/24 27252201578-MARIELA PAOLA CAVALLARO        L18MKX9R1M1P648V9O6WYV 000172008 215000.00
            //
            // La referencia puede ser: VAR-XXX, FAC-XXX, o código alfanumérico largo
            // Hay múltiples espacios separando: nombre | referencia | comprobante | importe
            // \S+ captura cualquier secuencia sin espacios (la referencia)
            const detMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{11})-(.+?)\s{2,}(\S+)\s+(\d{9,})\s+([\d.,]+)\s*$/);
            if (detMatch) {
                const detalle = {
                    fecha: detMatch[1],
                    cuit: detMatch[2],
                    nombre: detMatch[3].trim(),
                    referenciaPago: detMatch[4],
                    comprobante: detMatch[5],
                    importe: detMatch[6],
                    tipo: 'TRANSFERENCIA_RECIBIDA'
                };
                detallesTransfRecibidas.push(detalle);
                console.log('Transferencia recibida:', detalle);
            } else {
                // Patrón alternativo: referencia seguida directamente del comprobante con un solo espacio
                const altMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{11})-(.+)\s+(\S+)\s+(\d{9,})\s+([\d.,]+)\s*$/);
                if (altMatch) {
                    // Extraer nombre y referencia del grupo 3 (puede venir concatenado)
                    let nombre = altMatch[3].trim();
                    let referenciaPago = altMatch[4];
                    const detalle = {
                        fecha: altMatch[1],
                        cuit: altMatch[2],
                        nombre: nombre,
                        referenciaPago: referenciaPago,
                        comprobante: altMatch[5],
                        importe: altMatch[6],
                        tipo: 'TRANSFERENCIA_RECIBIDA'
                    };
                    detallesTransfRecibidas.push(detalle);
                    console.log('Transferencia recibida (alt):', detalle);
                } else {
                    // Patrón sin referencia explícita (nombre directo hasta comprobante)
                    const noRefMatch = text.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{11})-(.+?)\s{2,}(\d{9,})\s+([\d.,]+)\s*$/);
                    if (noRefMatch) {
                        const detalle = {
                            fecha: noRefMatch[1],
                            cuit: noRefMatch[2],
                            nombre: noRefMatch[3].trim(),
                            referenciaPago: '',
                            comprobante: noRefMatch[4],
                            importe: noRefMatch[5],
                            tipo: 'TRANSFERENCIA_RECIBIDA'
                        };
                        detallesTransfRecibidas.push(detalle);
                        console.log('Transferencia recibida (sin ref):', detalle);
                    }
                }
            }
        }
    }

    // No olvidar el último movimiento
    if (currentMovement) {
        movements.push(currentMovement);
    }

    console.log('='.repeat(80));
    console.log('Movimientos principales encontrados:', movements.length);
    console.log('Detalles débitos automáticos:', detallesDebitosAuto.length);
    console.log('Detalles transferencias emitidas:', detallesTransfEmitidas.length);
    console.log('Detalles transferencias recibidas:', detallesTransfRecibidas.length);
    console.log('='.repeat(80));

    // Enriquecer movimientos con detalles
    const enrichedMovements = enrichLaPampaMovements(
        movements,
        detallesDebitosAuto,
        detallesTransfEmitidas,
        detallesTransfRecibidas
    );

    return enrichedMovements;
}

// Enriquecer movimientos con información de las secciones de detalle
function enrichLaPampaMovements(movements, debitosAuto, transfEmitidas, transfRecibidas) {
    // Parsea formato argentino (punto=miles, coma=decimal) usado en movimientos ya procesados
    const parseArgNumber = (str) => {
        if (!str || str === '0') return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    };

    // Parsea formato BDLP (punto=decimal) usado en los detalles
    const parseBDLPNumber = (str) => {
        if (!str || str === '0') return 0;
        // Formato BDLP: punto es decimal, coma es separador de millones
        let cleaned = str.trim();
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/,/g, '');
        }
        return parseFloat(cleaned);
    };

    const formatDate = (dateStr) => {
        // Normalizar fecha a DD/MM/YY para comparación
        if (dateStr.length === 10) { // DD/MM/YYYY
            return dateStr.substring(0, 6) + dateStr.substring(8);
        }
        return dateStr;
    };

    // Comparar comprobantes ignorando ceros a la izquierda
    // Ej: "127877" debe coincidir con "000127877"
    const compararComprobantes = (comp1, comp2) => {
        if (!comp1 || !comp2) return false;
        // Eliminar ceros a la izquierda para comparar
        const norm1 = comp1.replace(/^0+/, '');
        const norm2 = comp2.replace(/^0+/, '');
        return norm1 === norm2;
    };

    let enrichedCount = 0;

    for (const mov of movements) {
        const movDate = formatDate(mov.fecha);
        const movComprobante = mov.origen;
        const movDebito = parseArgNumber(mov.debito);
        const movCredito = parseArgNumber(mov.credito);
        const movAmount = movDebito > 0 ? movDebito : movCredito;

        // Determinar en qué sección buscar según el concepto
        let seccionBusqueda = null;
        const conceptoUpper = mov.descripcion.toUpperCase().trim();

        // Buscar coincidencia en el mapeo de conceptos
        for (const [concepto, seccion] of Object.entries(LAPAMPA_CONCEPTO_SECCION)) {
            if (conceptoUpper.includes(concepto.toUpperCase())) {
                seccionBusqueda = seccion;
                break;
            }
        }

        // Si el concepto está en la lista de sin detalle, saltar
        if (LAPAMPA_SIN_DETALLE.some(c => conceptoUpper.includes(c.toUpperCase()))) {
            continue;
        }

        // Si no hay sección determinada pero tiene comprobante, intentar buscar
        if (!seccionBusqueda && movComprobante) {
            // Intentar en todas las secciones
            seccionBusqueda = 'TODAS';
        }

        if (!seccionBusqueda) continue;

        let detalleEncontrado = null;

        // Buscar en la sección correspondiente
        if (seccionBusqueda === 'DEBITOS_AUTOMATICOS' || seccionBusqueda === 'TODAS') {
            for (const det of debitosAuto) {
                const detDate = formatDate(det.fecha);
                const detAmount = parseBDLPNumber(det.importe);

                // Correlacionar por comprobante e importe
                if (compararComprobantes(det.comprobante, movComprobante) && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'DEBITO_AUTOMATICO',
                        empresa: det.empresa,
                        referencia: det.referencia || '',
                        categoria: det.categoria || ''
                    };
                    break;
                }
                // Si no hay comprobante, usar fecha e importe
                if (!movComprobante && detDate === movDate && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'DEBITO_AUTOMATICO',
                        empresa: det.empresa,
                        referencia: det.referencia || '',
                        categoria: det.categoria || ''
                    };
                    break;
                }
            }
        }

        if (!detalleEncontrado && (seccionBusqueda === 'TRANSFERENCIAS_EMITIDAS' || seccionBusqueda === 'TODAS')) {
            for (const det of transfEmitidas) {
                const detDate = formatDate(det.fecha);
                const detAmount = parseBDLPNumber(det.importe);

                if (compararComprobantes(det.comprobante, movComprobante) && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'TRANSFERENCIA_EMITIDA',
                        cuit: det.cuit,
                        razonSocial: det.razonSocial
                    };
                    break;
                }
                if (!movComprobante && detDate === movDate && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'TRANSFERENCIA_EMITIDA',
                        cuit: det.cuit,
                        razonSocial: det.razonSocial
                    };
                    break;
                }
            }
        }

        if (!detalleEncontrado && (seccionBusqueda === 'TRANSFERENCIAS_RECIBIDAS' || seccionBusqueda === 'TODAS')) {
            for (const det of transfRecibidas) {
                const detDate = formatDate(det.fecha);
                const detAmount = parseBDLPNumber(det.importe);

                if (compararComprobantes(det.comprobante, movComprobante) && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'TRANSFERENCIA_RECIBIDA',
                        cuit: det.cuit,
                        nombre: det.nombre,
                        referenciaPago: det.referenciaPago || ''
                    };
                    break;
                }
                if (!movComprobante && detDate === movDate && Math.abs(detAmount - movAmount) < 0.01) {
                    detalleEncontrado = {
                        tipo: 'TRANSFERENCIA_RECIBIDA',
                        cuit: det.cuit,
                        nombre: det.nombre,
                        referenciaPago: det.referenciaPago || ''
                    };
                    break;
                }
            }
        }

        if (detalleEncontrado) {
            mov.detalle = detalleEncontrado;
            enrichedCount++;

            // Enriquecer la descripción con información del detalle
            // Formato: CONCEPTO | DETALLE1 | DETALLE2 | ...
            let descripcionEnriquecida = mov.descripcion;
            if (detalleEncontrado.tipo === 'DEBITO_AUTOMATICO') {
                // Formato: DEBITO DIRECTO | TELEFONICA MOVIL | TELEFONIA
                descripcionEnriquecida += ` | ${detalleEncontrado.empresa}`;
                if (detalleEncontrado.categoria) {
                    descripcionEnriquecida += ` | ${detalleEncontrado.categoria}`;
                }
            } else if (detalleEncontrado.tipo === 'TRANSFERENCIA_EMITIDA') {
                // Formato: E-BANKING TRF. | CUIT: 30714882445 | EXPRESO DE A CUATRO SRL
                descripcionEnriquecida += ` | CUIT: ${detalleEncontrado.cuit} | ${detalleEncontrado.razonSocial}`;
            } else if (detalleEncontrado.tipo === 'TRANSFERENCIA_RECIBIDA') {
                // Formato: TRF.POR CAJ.AUT./HB | CUIT: 30717286789 | DINASTIBASA S. R. L. | Ref: VAR-
                descripcionEnriquecida += ` | CUIT: ${detalleEncontrado.cuit} | ${detalleEncontrado.nombre}`;
                if (detalleEncontrado.referenciaPago) {
                    descripcionEnriquecida += ` | Ref: ${detalleEncontrado.referenciaPago}`;
                }
            }
            mov.descripcion = descripcionEnriquecida;
        }
    }

    console.log('Movimientos enriquecidos con detalle:', enrichedCount);

    return movements;
}

// Procesar PDF de Banco de La Pampa
async function processLaPampaPDF(pdfFile) {
    try {
        // Extraer texto con posiciones para determinar columnas
        const linesWithPositions = await extractTextWithPositions(pdfFile);
        console.log('Líneas extraídas del PDF La Pampa:', linesWithPositions.length);

        // Verificar que es un extracto de Banco de La Pampa
        const fullText = linesWithPositions.map(l => l.text).join(' ');
        if (!fullText.toLowerCase().includes('banco de la pampa') &&
            !fullText.toLowerCase().includes('pampa') &&
            !fullText.toLowerCase().includes('bdlp')) {
            console.warn('Advertencia: El documento podría no ser del Banco de La Pampa');
        }

        // Buscar saldo inicial/anterior
        state.saldoInicial = null;
        for (const lineData of linesWithPositions) {
            // Buscar línea con "Saldo anterior" o "Saldo inicial"
            if (/Saldo\s+(anterior|inicial)/i.test(lineData.text)) {
                // Formato BDLP: saldos con punto decimal, opcionalmente coma de millones y/o negativos
                // Ejemplo: 68,428615.16 o 400307.02 o -2,965669.21
                const amounts = lineData.text.match(/-?\d+(?:,\d+)?\.\d{2}/g);
                if (amounts && amounts.length >= 1) {
                    // Parsear y convertir a formato argentino
                    const saldoRaw = amounts[amounts.length - 1];
                    // Detectar si es negativo
                    const isNegative = saldoRaw.startsWith('-');
                    let cleanedSaldo = isNegative ? saldoRaw.substring(1) : saldoRaw;
                    let saldoNumerico;
                    if (cleanedSaldo.includes(',')) {
                        // Formato con coma de millones: "68,428615.16" -> 68428615.16
                        saldoNumerico = parseFloat(cleanedSaldo.replace(/,/g, ''));
                    } else {
                        saldoNumerico = parseFloat(cleanedSaldo);
                    }
                    // Aplicar signo negativo si corresponde
                    if (isNegative) {
                        saldoNumerico = -saldoNumerico;
                    }
                    state.saldoInicial = saldoNumerico.toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                }
                break;
            }
        }

        console.log('Saldo inicial La Pampa encontrado:', state.saldoInicial);

        // Parsear movimientos con enriquecimiento
        const movements = parseLaPampaWithPositions(linesWithPositions);

        if (movements.length === 0) {
            showError('No se encontraron movimientos en el PDF. Verifique que el archivo sea del Banco de La Pampa con formato correcto.');
            return;
        }

        console.log('Movimientos La Pampa procesados:', movements.length);
        if (movements.length > 0) {
            console.log('Primer movimiento:', movements[0]);
            console.log('Último movimiento:', movements[movements.length - 1]);
        }

        // Limpiar descripciones
        const cleanedMovements = movements.map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .trim();
            // Eliminar el campo detalle del objeto para el export (ya está en la descripción)
            const { detalle, ...movSinDetalle } = mov;
            return movSinDetalle;
        });

        state.extractedData = cleanedMovements;

        // Contar movimientos enriquecidos
        const enrichedCount = movements.filter(m => m.detalle).length;
        const mensaje = enrichedCount > 0
            ? `¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados (${enrichedCount} con detalle enriquecido).`
            : `¡Archivo procesado exitosamente! ${movements.length} movimientos encontrados.`;

        showSuccess(mensaje);
        renderPreview();

    } catch (err) {
        console.error('Error procesando PDF Banco de La Pampa:', err);
        throw err;
    }
}

function renderPreview() {
    elements.previewSection.classList.remove('hidden');

    // Renderizar encabezados según el tipo
    if (state.selectedType === 'inversiones') {
        elements.previewHeader.innerHTML = `
            <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Monto</th>
            </tr>
        `;
        // Ocultar panel de saldos para inversiones
        if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    } else {
        elements.previewHeader.innerHTML = `
            <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Origen</th>
                <th class="text-right">Crédito</th>
                <th class="text-right">Débito</th>
                <th class="text-right">Saldo</th>
            </tr>
        `;

        // Recalcular saldos de todos los movimientos: saldo = saldo anterior + crédito - débito
        recalcularSaldosMovimientos();

        // Mostrar panel de saldos para extractos bancarios
        if (elements.resumenSaldos && state.extractedData.length > 0) {
            elements.resumenSaldos.classList.remove('hidden');

            // Calcular saldo inicial del período (saldo antes del primer movimiento)
            const primerMov = state.extractedData[0];
            const saldoPrimerMov = parseArgentineNumber(primerMov.saldo);
            const creditoPrimerMov = parseArgentineNumber(primerMov.credito);
            const debitoPrimerMov = parseArgentineNumber(primerMov.debito);
            const saldoInicialPeriodo = saldoPrimerMov - creditoPrimerMov + debitoPrimerMov;

            // Saldo al cierre del período (saldo del último movimiento)
            const ultimoMov = state.extractedData[state.extractedData.length - 1];
            const saldoCierrePeriodo = parseArgentineNumber(ultimoMov.saldo);

            // Actualizar los valores en el panel
            elements.saldoInicialPeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoInicialPeriodo);
            elements.saldoCierrePeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoCierrePeriodo);
        } else if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    }

    // Renderizar filas (primeras 10)
    const rowsToShow = state.extractedData.slice(0, 10);
    elements.previewBody.innerHTML = rowsToShow.map(row => {
        if (state.selectedType === 'inversiones') {
            const monto = row.credito !== '0' ? row.credito : row.debito;
            return `
                <tr>
                    <td>${row.fecha}</td>
                    <td>${row.descripcion}</td>
                    <td class="text-right">${row.origen}</td>
                    <td class="text-right">${monto}</td>
                </tr>
            `;
        } else {
            return `
                <tr>
                    <td>${row.fecha}</td>
                    <td>${row.descripcion}</td>
                    <td>${row.origen}</td>
                    <td class="text-right text-green">${row.credito}</td>
                    <td class="text-right text-red">${row.debito}</td>
                    <td class="text-right">${row.saldo}</td>
                </tr>
            `;
        }
    }).join('');

    // Mostrar footer si hay más de 10 movimientos
    if (state.extractedData.length > 10) {
        elements.previewFooter.textContent = `... y ${state.extractedData.length - 10} movimientos más`;
    } else {
        elements.previewFooter.textContent = '';
    }

    elements.rowCount.textContent = state.extractedData.length;
}

// Función para recalcular los saldos de los movimientos
// Fórmula: saldo = saldo anterior + crédito - débito
function recalcularSaldosMovimientos() {
    if (state.extractedData.length === 0) return;

    // Calcular saldo inicial a partir del primer movimiento
    const primerMov = state.extractedData[0];
    const saldoPrimerMov = parseArgentineNumber(primerMov.saldo);
    const creditoPrimerMov = parseArgentineNumber(primerMov.credito);
    const debitoPrimerMov = parseArgentineNumber(primerMov.debito);
    let saldoActual = saldoPrimerMov - creditoPrimerMov + debitoPrimerMov;

    // Recalcular saldo de cada movimiento
    for (const mov of state.extractedData) {
        const credito = parseArgentineNumber(mov.credito);
        const debito = parseArgentineNumber(mov.debito);
        saldoActual = saldoActual + credito - debito;
        // Actualizar el saldo en formato argentino
        mov.saldo = formatearNumeroArgentino(saldoActual);
    }
}

function handleDownloadExcel() {
    if (state.extractedData.length === 0) return;

    const parseArgentineNumber = (value) => {
        if (!value || value === '0') return 0;
        // Detectar si el valor es negativo ANTES de limpiar
        const isNegative = value.includes('-');
        // Limpiar el formato argentino (puntos de miles y coma decimal)
        const cleaned = value.replace(/\./g, '').replace(',', '.').replace('-', '');
        const number = parseFloat(cleaned);
        // Aplicar el signo negativo si corresponde
        return isNegative ? -number : number;
    };

    const dataRows = state.extractedData.map((row) => {
        let fecha = row.fecha;
        if (fecha.length === 8) {
            const parts = fecha.split('/');
            const year = parseInt(parts[2]);
            const fullYear = year < 50 ? `20${parts[2]}` : `19${parts[2]}`;
            fecha = `${parts[0]}/${parts[1]}/${fullYear}`;
        } else if (fecha.length === 5) {
            const currentYear = new Date().getFullYear();
            fecha = `${fecha}/${currentYear}`;
        }

        let credito = parseArgentineNumber(row.credito);
        let debito = parseArgentineNumber(row.debito);
        let saldo = parseArgentineNumber(row.saldo);

        return [
            fecha,
            row.descripcion,
            row.origen,
            credito,
            debito,
            saldo
        ];
    });

    let wsData;
    if (state.selectedType === 'inversiones') {
        wsData = [
            ['Fecha', 'Descripción', 'Cantidad', 'Monto'],
            ...dataRows.map(row => [
                row[0],
                row[1],
                parseArgentineNumber(row[2]),
                row[3] > 0 ? row[3] : row[4]
            ])
        ];
    } else {
        wsData = state.saldoInicial ? [
            ['', '', '', '', '', '', 'Saldo inicial'],
            ['', '', '', '', '', '', parseArgentineNumber(state.saldoInicial)],
            ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo', ''],
            ...dataRows.map(row => [...row, ''])
        ] : [
            ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'],
            ...dataRows
        ];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const range = XLSX.utils.decode_range(ws['!ref']);

    if (state.selectedType === 'bancarios' && state.saldoInicial) {
        const saldoInicialCell = 'G2';
        if (ws[saldoInicialCell] && typeof ws[saldoInicialCell].v === 'number') {
            ws[saldoInicialCell].t = 'n';
            ws[saldoInicialCell].z = '#,##0.00';
        }
    }

    if (state.selectedType === 'inversiones') {
        for (let row = 1; row <= range.e.r; row++) {
            const cantidadCell = XLSX.utils.encode_cell({ r: row, c: 2 });
            if (ws[cantidadCell] && typeof ws[cantidadCell].v === 'number') {
                ws[cantidadCell].t = 'n';
                ws[cantidadCell].z = '#,##0.00';
            }

            const montoCell = XLSX.utils.encode_cell({ r: row, c: 3 });
            if (ws[montoCell] && typeof ws[montoCell].v === 'number') {
                ws[montoCell].t = 'n';
                ws[montoCell].z = '#,##0.00';
            }
        }

        ws['!cols'] = [
            { wch: 12 },
            { wch: 50 },
            { wch: 15 },
            { wch: 15 }
        ];
    } else {
        const startRow = state.saldoInicial ? 3 : 1;
        for (let row = startRow; row < range.e.r + 1; row++) {
            const creditCell = XLSX.utils.encode_cell({ r: row, c: 3 });
            if (ws[creditCell]) {
                ws[creditCell].t = 'n';
                ws[creditCell].z = '#,##0.00';
            }

            const debitCell = XLSX.utils.encode_cell({ r: row, c: 4 });
            if (ws[debitCell]) {
                ws[debitCell].t = 'n';
                ws[debitCell].z = '#,##0.00';
            }

            const saldoCell = XLSX.utils.encode_cell({ r: row, c: 5 });
            if (ws[saldoCell]) {
                ws[saldoCell].t = 'n';
                ws[saldoCell].z = '#,##0.00';
            }
        }

        ws['!cols'] = [
            { wch: 12 },
            { wch: 50 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 18 },
            { wch: 18 }
        ];
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracto');

    const originalFileName = state.file.name;
    const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
    const fileName = `${fileNameWithoutExt}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

function showError(message) {
    elements.errorBox.textContent = message;
    elements.errorBox.classList.remove('hidden');
    elements.successBox.classList.add('hidden');
}

function showSuccess(message) {
    elements.successBox.textContent = message;
    elements.successBox.classList.remove('hidden');
    elements.errorBox.classList.add('hidden');
}

function hideMessages() {
    elements.errorBox.classList.add('hidden');
    elements.successBox.classList.add('hidden');
}

// ============================================
// FUNCIONALIDAD: COMBINAR EXTRACTOS EXCEL
// ============================================

// Estado para combinar archivos
const combinarState = {
    archivos: [],           // Array de objetos { file, nombre, datos, movimientos, fechaMin, fechaMax }
    todosLosMovimientos: [],// Array combinado de todos los movimientos
    duplicadosDetectados: [],
    duplicadosRemovidos: [],
    advertencias: [],
    bancoDetectado: ''
};

// Elementos DOM para combinar
const combinarElements = {
    seccionConvertir: null,
    seccionCombinar: null,
    btnConvertir: null,
    btnCombinar: null,
    dropZoneCombinar: null,
    fileInputCombinar: null,
    archivosCargados: null,
    contadorArchivos: null,
    listaArchivos: null,
    stepVistaPreviaCombinar: null,
    periodoDetectado: null,
    totalMovimientos: null,
    listaArchivosProcesados: null,
    advertenciasCombinar: null,
    listaAdvertencias: null,
    stepOpcionesCombinar: null,
    stepDescargarCombinado: null,
    btnDescargarCombinado: null,
    errorBoxCombinar: null,
    successBoxCombinar: null
};

// Inicializar elementos de combinar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initCombinarElements();
    attachCombinarEventListeners();
});

function initCombinarElements() {
    combinarElements.seccionConvertir = document.getElementById('seccionConvertir');
    combinarElements.seccionCombinar = document.getElementById('seccionCombinar');
    combinarElements.btnConvertir = document.getElementById('btnConvertir');
    combinarElements.btnCombinar = document.getElementById('btnCombinar');
    combinarElements.dropZoneCombinar = document.getElementById('dropZoneCombinar');
    combinarElements.fileInputCombinar = document.getElementById('fileInputCombinar');
    combinarElements.archivosCargados = document.getElementById('archivosCargados');
    combinarElements.contadorArchivos = document.getElementById('contadorArchivos');
    combinarElements.listaArchivos = document.getElementById('listaArchivos');
    combinarElements.stepVistaPreviaCombinar = document.getElementById('stepVistaPreviaCombinar');
    combinarElements.periodoDetectado = document.getElementById('periodoDetectado');
    combinarElements.totalMovimientos = document.getElementById('totalMovimientos');
    combinarElements.listaArchivosProcesados = document.getElementById('listaArchivosProcesados');
    combinarElements.advertenciasCombinar = document.getElementById('advertenciasCombinar');
    combinarElements.listaAdvertencias = document.getElementById('listaAdvertencias');
    combinarElements.stepOpcionesCombinar = document.getElementById('stepOpcionesCombinar');
    combinarElements.stepDescargarCombinado = document.getElementById('stepDescargarCombinado');
    combinarElements.btnDescargarCombinado = document.getElementById('btnDescargarCombinado');
    combinarElements.errorBoxCombinar = document.getElementById('errorBoxCombinar');
    combinarElements.successBoxCombinar = document.getElementById('successBoxCombinar');
}

function attachCombinarEventListeners() {
    // Botones de modo
    if (combinarElements.btnConvertir) {
        combinarElements.btnConvertir.addEventListener('click', () => cambiarModo('convertir'));
    }
    if (combinarElements.btnCombinar) {
        combinarElements.btnCombinar.addEventListener('click', () => cambiarModo('combinar'));
    }

    // Zona de arrastre para combinar
    if (combinarElements.dropZoneCombinar) {
        combinarElements.dropZoneCombinar.addEventListener('click', () => combinarElements.fileInputCombinar.click());
        combinarElements.dropZoneCombinar.addEventListener('dragover', handleDragOverCombinar);
        combinarElements.dropZoneCombinar.addEventListener('dragleave', handleDragLeaveCombinar);
        combinarElements.dropZoneCombinar.addEventListener('drop', handleDropCombinar);
    }

    // Input de archivos para combinar
    if (combinarElements.fileInputCombinar) {
        combinarElements.fileInputCombinar.addEventListener('change', handleFileInputCombinar);
    }

    // Botón descargar combinado
    if (combinarElements.btnDescargarCombinado) {
        combinarElements.btnDescargarCombinado.addEventListener('click', handleDescargarCombinado);
    }
}

function cambiarModo(modo) {
    // Actualizar botones
    combinarElements.btnConvertir.classList.toggle('active', modo === 'convertir');
    combinarElements.btnCombinar.classList.toggle('active', modo === 'combinar');

    // Mostrar/ocultar secciones
    if (modo === 'convertir') {
        combinarElements.seccionConvertir.classList.remove('hidden');
        combinarElements.seccionCombinar.classList.add('hidden');
    } else {
        combinarElements.seccionConvertir.classList.add('hidden');
        combinarElements.seccionCombinar.classList.remove('hidden');
        // Resetear estado de combinar
        resetearCombinar();
    }
}

function resetearCombinar() {
    combinarState.archivos = [];
    combinarState.todosLosMovimientos = [];
    combinarState.duplicadosDetectados = [];
    combinarState.duplicadosRemovidos = [];
    combinarState.advertencias = [];
    combinarState.bancoDetectado = '';

    // Ocultar pasos
    combinarElements.archivosCargados.classList.add('hidden');
    combinarElements.stepVistaPreviaCombinar.classList.add('hidden');
    combinarElements.stepOpcionesCombinar.classList.add('hidden');
    combinarElements.stepDescargarCombinado.classList.add('hidden');
    combinarElements.advertenciasCombinar.classList.add('hidden');

    // Limpiar listas
    combinarElements.listaArchivos.innerHTML = '';
    combinarElements.contadorArchivos.textContent = '0';

    hideCombinarMessages();
}

function handleDragOverCombinar(e) {
    e.preventDefault();
    combinarElements.dropZoneCombinar.classList.add('dragover');
}

function handleDragLeaveCombinar(e) {
    e.preventDefault();
    combinarElements.dropZoneCombinar.classList.remove('dragover');
}

function handleDropCombinar(e) {
    e.preventDefault();
    combinarElements.dropZoneCombinar.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files);
    agregarArchivosCombinar(files);
}

function handleFileInputCombinar(e) {
    const files = Array.from(e.target.files);
    agregarArchivosCombinar(files);
    // Limpiar input para poder seleccionar el mismo archivo de nuevo si es necesario
    e.target.value = '';
}

async function agregarArchivosCombinar(files) {
    hideCombinarMessages();

    for (const file of files) {
        // Validar extensión
        const extension = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(extension)) {
            showCombinarError(`El archivo "${file.name}" no es un archivo Excel válido`);
            continue;
        }

        // Verificar si el archivo ya está en la lista
        if (combinarState.archivos.some(a => a.nombre === file.name)) {
            showCombinarError(`El archivo "${file.name}" ya ha sido agregado`);
            continue;
        }

        // Leer el archivo Excel
        try {
            const datos = await leerArchivoExcel(file);

            if (datos.movimientos.length === 0) {
                showCombinarError(`El archivo "${file.name}" no contiene movimientos válidos`);
                continue;
            }

            combinarState.archivos.push({
                file: file,
                nombre: file.name,
                datos: datos,
                movimientos: datos.movimientos,
                fechaMin: datos.fechaMin,
                fechaMax: datos.fechaMax,
                columnas: datos.columnas
            });

            actualizarListaArchivos();

        } catch (error) {
            console.error('Error leyendo archivo:', error);
            showCombinarError(`Error al leer el archivo "${file.name}": ${error.message}`);
        }
    }

    // Si hay al menos 1 archivo, procesar
    if (combinarState.archivos.length >= 1) {
        await procesarArchivosCombinar();
    }
}

async function leerArchivoExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Obtener la primera hoja
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convertir a JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length < 2) {
                    reject(new Error('El archivo no contiene datos suficientes'));
                    return;
                }

                // Detectar la fila de encabezados
                let headerRowIndex = 0;
                let columnas = {};

                for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                    const row = jsonData[i];
                    if (row && row.length >= 4) {
                        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
                        if (rowStr.includes('fecha') && (rowStr.includes('descripci') || rowStr.includes('concepto'))) {
                            headerRowIndex = i;
                            // Mapear columnas
                            row.forEach((cell, idx) => {
                                const cellStr = String(cell || '').toLowerCase();
                                if (cellStr.includes('fecha')) columnas.fecha = idx;
                                if (cellStr.includes('descripci') || cellStr.includes('concepto')) columnas.descripcion = idx;
                                if (cellStr.includes('referencia') || cellStr.includes('origen')) columnas.referencia = idx;
                                if (cellStr.includes('cr') || cellStr === 'credito' || cellStr === 'crédito') columnas.credito = idx;
                                if (cellStr.includes('deb') || cellStr === 'debito' || cellStr === 'débito') columnas.debito = idx;
                                if (cellStr.includes('saldo') && !cellStr.includes('inicial')) columnas.saldo = idx;
                            });
                            break;
                        }
                    }
                }

                // Verificar columnas mínimas requeridas
                if (columnas.fecha === undefined || columnas.descripcion === undefined) {
                    reject(new Error('No se encontraron las columnas requeridas (Fecha, Descripción)'));
                    return;
                }

                // Extraer movimientos
                const movimientos = [];
                let fechaMin = null;
                let fechaMax = null;

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const fecha = row[columnas.fecha];
                    if (!fecha) continue;

                    // Parsear fecha
                    const fechaParseada = parsearFecha(fecha);
                    if (!fechaParseada) continue;

                    // Obtener valores
                    const descripcion = row[columnas.descripcion] || '';
                    const referencia = columnas.referencia !== undefined ? (row[columnas.referencia] || '') : '';
                    const credito = columnas.credito !== undefined ? parseNumber(row[columnas.credito]) : 0;
                    const debito = columnas.debito !== undefined ? parseNumber(row[columnas.debito]) : 0;
                    const saldo = columnas.saldo !== undefined ? parseNumber(row[columnas.saldo]) : 0;

                    // Ignorar filas sin movimiento
                    if (credito === 0 && debito === 0 && !descripcion) continue;

                    movimientos.push({
                        fecha: formatearFecha(fechaParseada),
                        fechaObj: fechaParseada,
                        descripcion: String(descripcion).trim(),
                        referencia: String(referencia).trim(),
                        credito: credito,
                        debito: debito,
                        saldo: saldo,
                        archivoOrigen: file.name
                    });

                    // Actualizar rango de fechas
                    if (!fechaMin || fechaParseada < fechaMin) fechaMin = fechaParseada;
                    if (!fechaMax || fechaParseada > fechaMax) fechaMax = fechaParseada;
                }

                resolve({
                    movimientos: movimientos,
                    fechaMin: fechaMin,
                    fechaMax: fechaMax,
                    columnas: columnas
                });

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

function parsearFecha(valor) {
    if (!valor) return null;

    // Si es un número (fecha de Excel)
    if (typeof valor === 'number') {
        const date = XLSX.SSF.parse_date_code(valor);
        if (date) {
            return new Date(date.y, date.m - 1, date.d);
        }
    }

    // Si es una cadena
    const str = String(valor).trim();

    // Formato DD/MM/YYYY o DD/MM/YY
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
        let dia = parseInt(match[1], 10);
        let mes = parseInt(match[2], 10) - 1;
        let anio = parseInt(match[3], 10);

        if (anio < 100) {
            anio = anio < 50 ? 2000 + anio : 1900 + anio;
        }

        return new Date(anio, mes, dia);
    }

    // Intentar parseo directo
    const parsed = new Date(valor);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

function formatearFecha(date) {
    if (!date) return '';
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function parseNumber(valor) {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;

    const str = String(valor).trim();
    // Detectar negativo
    const isNegative = str.includes('-') || str.startsWith('(');
    // Limpiar formato argentino/internacional
    const cleaned = str.replace(/[^0-9.,]/g, '');

    // Determinar separador decimal
    let number = 0;
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Si tiene ambos, el último es el decimal
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            // Formato argentino: 1.234,56
            number = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else {
            // Formato inglés: 1,234.56
            number = parseFloat(cleaned.replace(/,/g, ''));
        }
    } else if (cleaned.includes(',')) {
        // Solo coma - podría ser decimal o miles
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length === 2) {
            // Probablemente decimal
            number = parseFloat(cleaned.replace(',', '.'));
        } else {
            number = parseFloat(cleaned.replace(/,/g, ''));
        }
    } else {
        number = parseFloat(cleaned) || 0;
    }

    return isNegative ? -Math.abs(number) : number;
}

function actualizarListaArchivos() {
    combinarElements.contadorArchivos.textContent = combinarState.archivos.length;
    combinarElements.archivosCargados.classList.remove('hidden');

    combinarElements.listaArchivos.innerHTML = combinarState.archivos.map((archivo, index) => `
        <li>
            <div class="archivo-info">
                <span class="archivo-icon">📄</span>
                <span class="archivo-nombre">${archivo.nombre}</span>
            </div>
            <button class="archivo-eliminar" onclick="eliminarArchivoCombinar(${index})" title="Eliminar">✕</button>
        </li>
    `).join('');
}

// Función global para eliminar archivo
window.eliminarArchivoCombinar = function(index) {
    combinarState.archivos.splice(index, 1);
    actualizarListaArchivos();

    if (combinarState.archivos.length >= 1) {
        procesarArchivosCombinar();
    } else {
        // Ocultar pasos si no hay archivos
        combinarElements.stepVistaPreviaCombinar.classList.add('hidden');
        combinarElements.stepOpcionesCombinar.classList.add('hidden');
        combinarElements.stepDescargarCombinado.classList.add('hidden');
    }
};

async function procesarArchivosCombinar() {
    combinarState.advertencias = [];
    combinarState.duplicadosDetectados = [];

    // Combinar todos los movimientos
    let todosLosMovimientos = [];
    for (const archivo of combinarState.archivos) {
        todosLosMovimientos.push(...archivo.movimientos);
    }

    // Detectar duplicados
    const duplicados = detectarDuplicados(todosLosMovimientos);
    combinarState.duplicadosDetectados = duplicados;

    if (duplicados.length > 0) {
        combinarState.advertencias.push(`Posibles duplicados detectados: ${duplicados.length}`);
    }

    // Verificar fechas superpuestas entre archivos
    const superpuestos = verificarFechasSuperpuestas();
    if (superpuestos.length > 0) {
        combinarState.advertencias.push(`Fechas superpuestas entre archivos: ${superpuestos.join(', ')}`);
    }

    // Verificar estructura de columnas
    const estructurasDistintas = verificarEstructuraColumnas();
    if (estructurasDistintas) {
        combinarState.advertencias.push('Algunos archivos tienen estructura de columnas diferente');
    }

    combinarState.todosLosMovimientos = todosLosMovimientos;

    // Mostrar vista previa
    mostrarVistaPreviaCombinar();
}

function detectarDuplicados(movimientos) {
    const duplicados = [];
    const vistos = new Map();

    movimientos.forEach((mov, index) => {
        // Crear clave única: fecha + descripción + importe
        const importe = mov.credito !== 0 ? mov.credito : mov.debito;
        const clave = `${mov.fecha}|${mov.descripcion.toLowerCase()}|${importe}|${mov.referencia}`;

        if (vistos.has(clave)) {
            duplicados.push({
                original: vistos.get(clave),
                duplicado: index,
                movimiento: mov
            });
        } else {
            vistos.set(clave, index);
        }
    });

    return duplicados;
}

function verificarFechasSuperpuestas() {
    const superpuestos = [];

    for (let i = 0; i < combinarState.archivos.length; i++) {
        for (let j = i + 1; j < combinarState.archivos.length; j++) {
            const a1 = combinarState.archivos[i];
            const a2 = combinarState.archivos[j];

            if (a1.fechaMin && a1.fechaMax && a2.fechaMin && a2.fechaMax) {
                // Verificar superposición
                if (a1.fechaMin <= a2.fechaMax && a2.fechaMin <= a1.fechaMax) {
                    superpuestos.push(`${a1.nombre} y ${a2.nombre}`);
                }
            }
        }
    }

    return superpuestos;
}

function verificarEstructuraColumnas() {
    if (combinarState.archivos.length < 2) return false;

    const primera = combinarState.archivos[0].columnas;
    for (let i = 1; i < combinarState.archivos.length; i++) {
        const actual = combinarState.archivos[i].columnas;
        // Comparar columnas principales
        if (actual.credito !== primera.credito || actual.debito !== primera.debito) {
            return true;
        }
    }

    return false;
}

function mostrarVistaPreviaCombinar() {
    // Calcular período total
    let fechaMinGlobal = null;
    let fechaMaxGlobal = null;

    combinarState.archivos.forEach(archivo => {
        if (archivo.fechaMin && (!fechaMinGlobal || archivo.fechaMin < fechaMinGlobal)) {
            fechaMinGlobal = archivo.fechaMin;
        }
        if (archivo.fechaMax && (!fechaMaxGlobal || archivo.fechaMax > fechaMaxGlobal)) {
            fechaMaxGlobal = archivo.fechaMax;
        }
    });

    // Mostrar período
    if (fechaMinGlobal && fechaMaxGlobal) {
        combinarElements.periodoDetectado.textContent =
            `${formatearFecha(fechaMinGlobal)} al ${formatearFecha(fechaMaxGlobal)}`;
    } else {
        combinarElements.periodoDetectado.textContent = 'No detectado';
    }

    // Mostrar total de movimientos
    combinarElements.totalMovimientos.textContent =
        combinarState.todosLosMovimientos.length.toLocaleString('es-AR');

    // Mostrar lista de archivos procesados
    combinarElements.listaArchivosProcesados.innerHTML = combinarState.archivos.map(archivo => {
        const mesAnio = archivo.fechaMin ?
            `${archivo.fechaMin.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}` :
            'Fecha no detectada';
        return `
            <li>
                <span class="archivo-status ok">✓</span>
                <span>${mesAnio}: ${archivo.movimientos.length} movimientos</span>
                <span class="archivo-detalle">(${archivo.nombre})</span>
            </li>
        `;
    }).join('');

    // Mostrar advertencias
    if (combinarState.advertencias.length > 0) {
        combinarElements.advertenciasCombinar.classList.remove('hidden');
        combinarElements.listaAdvertencias.innerHTML = combinarState.advertencias.map(adv =>
            `<li>${adv}</li>`
        ).join('');
    } else {
        combinarElements.advertenciasCombinar.classList.add('hidden');
    }

    // Mostrar pasos
    combinarElements.stepVistaPreviaCombinar.classList.remove('hidden');
    combinarElements.stepOpcionesCombinar.classList.remove('hidden');
    combinarElements.stepDescargarCombinado.classList.remove('hidden');
}

function handleDescargarCombinado() {
    if (combinarState.todosLosMovimientos.length === 0) {
        showCombinarError('No hay movimientos para combinar');
        return;
    }

    // Obtener opciones
    const ordenAsc = document.querySelector('input[name="ordenFecha"]:checked').value === 'asc';
    const eliminarDuplicados = document.getElementById('chkEliminarDuplicados').checked;
    const incluirResumen = document.getElementById('chkIncluirResumen').checked;

    // Clonar movimientos para no modificar el original
    let movimientos = [...combinarState.todosLosMovimientos];

    // Eliminar duplicados si se seleccionó
    combinarState.duplicadosRemovidos = [];
    if (eliminarDuplicados && combinarState.duplicadosDetectados.length > 0) {
        const indicesAEliminar = new Set(combinarState.duplicadosDetectados.map(d => d.duplicado));
        combinarState.duplicadosRemovidos = movimientos.filter((_, idx) => indicesAEliminar.has(idx));
        movimientos = movimientos.filter((_, idx) => !indicesAEliminar.has(idx));
    }

    // Ordenar por fecha
    movimientos.sort((a, b) => {
        const diff = a.fechaObj - b.fechaObj;
        return ordenAsc ? diff : -diff;
    });

    // Recalcular saldos
    recalcularSaldos(movimientos);

    // Generar Excel
    generarExcelCombinado(movimientos, incluirResumen);
}

function recalcularSaldos(movimientos) {
    if (movimientos.length === 0) return;

    // Tomar el saldo del primer movimiento como referencia inicial
    // y recalcular desde ahí
    let saldoActual = 0;

    // Calcular saldo inicial basándose en el primer movimiento
    const primerMov = movimientos[0];
    saldoActual = primerMov.saldo - primerMov.credito + primerMov.debito;

    // Recalcular todos los saldos
    for (const mov of movimientos) {
        saldoActual = saldoActual + mov.credito - mov.debito;
        mov.saldoRecalculado = saldoActual;
    }
}

function generarExcelCombinado(movimientos, incluirResumen) {
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Movimientos
    const datosMovimientos = [
        ['Fecha', 'Descripción', 'Referencia', 'Crédito', 'Débito', 'Saldo'],
        ...movimientos.map(mov => [
            mov.fecha,
            mov.descripcion,
            mov.referencia,
            mov.credito || 0,
            mov.debito || 0,
            mov.saldoRecalculado || mov.saldo || 0
        ])
    ];

    const wsMovimientos = XLSX.utils.aoa_to_sheet(datosMovimientos);

    // Formato numérico
    const range = XLSX.utils.decode_range(wsMovimientos['!ref']);
    for (let row = 1; row <= range.e.r; row++) {
        for (let col = 3; col <= 5; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (wsMovimientos[cellRef]) {
                wsMovimientos[cellRef].t = 'n';
                wsMovimientos[cellRef].z = '#,##0.00';
            }
        }
    }

    // Ancho de columnas
    wsMovimientos['!cols'] = [
        { wch: 12 },
        { wch: 50 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(workbook, wsMovimientos, 'Movimientos');

    // Hoja 2: Resumen por Mes (opcional)
    if (incluirResumen) {
        const resumenPorMes = generarResumenPorMes(movimientos);
        const datosResumen = [
            ['Mes', 'Cantidad Mov.', 'Total Débitos', 'Total Créditos', 'Saldo Final'],
            ...resumenPorMes.meses.map(m => [
                m.mes,
                m.cantidad,
                m.totalDebitos,
                m.totalCreditos,
                m.saldoFinal
            ]),
            ['TOTAL', resumenPorMes.totalCantidad, resumenPorMes.totalDebitos, resumenPorMes.totalCreditos, '']
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);

        // Formato numérico para resumen
        const rangeResumen = XLSX.utils.decode_range(wsResumen['!ref']);
        for (let row = 1; row <= rangeResumen.e.r; row++) {
            for (let col = 2; col <= 4; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                if (wsResumen[cellRef] && typeof wsResumen[cellRef].v === 'number') {
                    wsResumen[cellRef].t = 'n';
                    wsResumen[cellRef].z = '#,##0.00';
                }
            }
        }

        wsResumen['!cols'] = [
            { wch: 20 },
            { wch: 15 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 }
        ];

        XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen por Mes');
    }

    // Hoja 3: Duplicados Removidos (si hay)
    if (combinarState.duplicadosRemovidos.length > 0) {
        const datosDuplicados = [
            ['Fecha', 'Descripción', 'Referencia', 'Crédito', 'Débito', 'Archivo Origen'],
            ...combinarState.duplicadosRemovidos.map(mov => [
                mov.fecha,
                mov.descripcion,
                mov.referencia,
                mov.credito || 0,
                mov.debito || 0,
                mov.archivoOrigen
            ])
        ];

        const wsDuplicados = XLSX.utils.aoa_to_sheet(datosDuplicados);

        wsDuplicados['!cols'] = [
            { wch: 12 },
            { wch: 50 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(workbook, wsDuplicados, 'Duplicados Removidos');
    }

    // Generar nombre de archivo
    let fechaInicio = '', fechaFin = '';
    if (movimientos.length > 0) {
        const ordenados = [...movimientos].sort((a, b) => a.fechaObj - b.fechaObj);
        const primerFecha = ordenados[0].fechaObj;
        const ultimaFecha = ordenados[ordenados.length - 1].fechaObj;

        fechaInicio = `${primerFecha.getFullYear()}${String(primerFecha.getMonth() + 1).padStart(2, '0')}`;
        fechaFin = `${ultimaFecha.getFullYear()}${String(ultimaFecha.getMonth() + 1).padStart(2, '0')}`;
    }

    const nombreArchivo = `Extracto_Combinado_${fechaInicio}_a_${fechaFin}.xlsx`;

    // Descargar
    XLSX.writeFile(workbook, nombreArchivo);

    showCombinarSuccess(`Archivo combinado generado: ${movimientos.length} movimientos${combinarState.duplicadosRemovidos.length > 0 ? ` (${combinarState.duplicadosRemovidos.length} duplicados removidos)` : ''}`);
}

function generarResumenPorMes(movimientos) {
    const mesesMap = new Map();

    for (const mov of movimientos) {
        const fecha = mov.fechaObj;
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const mesNombre = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        if (!mesesMap.has(mesKey)) {
            mesesMap.set(mesKey, {
                mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
                cantidad: 0,
                totalDebitos: 0,
                totalCreditos: 0,
                saldoFinal: 0
            });
        }

        const mesData = mesesMap.get(mesKey);
        mesData.cantidad++;
        mesData.totalDebitos += mov.debito || 0;
        mesData.totalCreditos += mov.credito || 0;
        mesData.saldoFinal = mov.saldoRecalculado || mov.saldo || 0;
    }

    // Convertir a array y ordenar
    const meses = Array.from(mesesMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, data]) => data);

    // Calcular totales
    const totalCantidad = meses.reduce((sum, m) => sum + m.cantidad, 0);
    const totalDebitos = meses.reduce((sum, m) => sum + m.totalDebitos, 0);
    const totalCreditos = meses.reduce((sum, m) => sum + m.totalCreditos, 0);

    return {
        meses,
        totalCantidad,
        totalDebitos,
        totalCreditos
    };
}

function showCombinarError(message) {
    combinarElements.errorBoxCombinar.textContent = message;
    combinarElements.errorBoxCombinar.classList.remove('hidden');
    combinarElements.successBoxCombinar.classList.add('hidden');
}

function showCombinarSuccess(message) {
    combinarElements.successBoxCombinar.textContent = message;
    combinarElements.successBoxCombinar.classList.remove('hidden');
    combinarElements.errorBoxCombinar.classList.add('hidden');
}

function hideCombinarMessages() {
    combinarElements.errorBoxCombinar.classList.add('hidden');
    combinarElements.successBoxCombinar.classList.add('hidden');
}

// ============================================
// BUSCAR Y REEMPLAZAR + FILTROS TIPO EXCEL
// ============================================

// Estado para filtros y búsqueda
const filterState = {
    selectedDescriptions: new Set(),        // Descripciones seleccionadas para mostrar
    allDescriptions: [],                    // Todas las descripciones únicas con su conteo
    isFilterActive: false,                  // Si hay un filtro activo (descripción)
    filteredData: [],                       // Datos filtrados actuales
    searchCurrentIndex: -1,                 // Índice actual de búsqueda
    searchMatches: [],                      // Coincidencias de búsqueda
    // Estado para filtro de importes
    importesFilterType: 'todos',            // 'todos', 'ambos_cero', 'ambos_distintos_cero'
    isImportesFilterActive: false           // Si hay un filtro de importes activo
};

// Elementos DOM para buscar/reemplazar y filtros
const filterElements = {
    btnBuscarReemplazar: null,
    btnFiltroDescripcion: null,
    filterDropdown: null,
    filterSearchInput: null,
    filterCheckboxList: null,
    filterBadge: null,
    btnSelectAll: null,
    btnDeselectAll: null,
    btnAplicarFiltro: null,
    btnLimpiarFiltro: null,
    modalBuscarReemplazar: null,
    btnCerrarModal: null,
    inputBuscar: null,
    inputReemplazar: null,
    chkCaseSensitive: null,
    chkPalabraCompleta: null,
    buscarResultado: null,
    coincidenciasCount: null,
    btnBuscarSiguiente: null,
    btnReemplazarUno: null,
    btnReemplazarTodos: null,
    // Elementos para filtro de importes
    btnFiltroImportes: null,
    filterImportesDropdown: null,
    filterImportesBadge: null,
    btnAplicarFiltroImportes: null,
    btnLimpiarFiltroImportes: null,
    // Elementos para plantillas de buscar/reemplazar
    plantillasContainer: null,
    btnGuardarPlantilla: null
};

// Inicializar elementos de filtro después de que el DOM esté listo
function initFilterElements() {
    filterElements.btnBuscarReemplazar = document.getElementById('btnBuscarReemplazar');
    filterElements.btnFiltroDescripcion = document.getElementById('btnFiltroDescripcion');
    filterElements.filterDropdown = document.getElementById('filterDropdown');
    filterElements.filterSearchInput = document.getElementById('filterSearchInput');
    filterElements.filterCheckboxList = document.getElementById('filterCheckboxList');
    filterElements.filterBadge = document.getElementById('filterBadge');
    filterElements.btnSelectAll = document.getElementById('btnSelectAll');
    filterElements.btnDeselectAll = document.getElementById('btnDeselectAll');
    filterElements.btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    filterElements.btnLimpiarFiltro = document.getElementById('btnLimpiarFiltro');
    filterElements.modalBuscarReemplazar = document.getElementById('modalBuscarReemplazar');
    filterElements.btnCerrarModal = document.getElementById('btnCerrarModal');
    filterElements.inputBuscar = document.getElementById('inputBuscar');
    filterElements.inputReemplazar = document.getElementById('inputReemplazar');
    filterElements.chkCaseSensitive = document.getElementById('chkCaseSensitive');
    filterElements.chkPalabraCompleta = document.getElementById('chkPalabraCompleta');
    filterElements.buscarResultado = document.getElementById('buscarResultado');
    filterElements.coincidenciasCount = document.getElementById('coincidenciasCount');
    filterElements.btnBuscarSiguiente = document.getElementById('btnBuscarSiguiente');
    filterElements.btnReemplazarUno = document.getElementById('btnReemplazarUno');
    filterElements.btnReemplazarTodos = document.getElementById('btnReemplazarTodos');
    // Elementos para filtro de importes
    filterElements.btnFiltroImportes = document.getElementById('btnFiltroImportes');
    filterElements.filterImportesDropdown = document.getElementById('filterImportesDropdown');
    filterElements.filterImportesBadge = document.getElementById('filterImportesBadge');
    filterElements.btnAplicarFiltroImportes = document.getElementById('btnAplicarFiltroImportes');
    filterElements.btnLimpiarFiltroImportes = document.getElementById('btnLimpiarFiltroImportes');
    // Elementos para plantillas de buscar/reemplazar
    filterElements.plantillasContainer = document.getElementById('plantillasContainer');
    filterElements.btnGuardarPlantilla = document.getElementById('btnGuardarPlantilla');

    attachFilterEventListeners();
}

// Agregar event listeners para filtros y búsqueda
function attachFilterEventListeners() {
    // Botón buscar y reemplazar
    if (filterElements.btnBuscarReemplazar) {
        filterElements.btnBuscarReemplazar.addEventListener('click', openSearchReplaceModal);
    }

    // Botón filtro de descripción
    if (filterElements.btnFiltroDescripcion) {
        filterElements.btnFiltroDescripcion.addEventListener('click', toggleFilterDropdown);
    }

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (filterElements.filterDropdown &&
            !filterElements.filterDropdown.classList.contains('hidden') &&
            !filterElements.filterDropdown.contains(e.target) &&
            !filterElements.btnFiltroDescripcion.contains(e.target)) {
            filterElements.filterDropdown.classList.add('hidden');
        }
    });

    // Búsqueda en filtro
    if (filterElements.filterSearchInput) {
        filterElements.filterSearchInput.addEventListener('input', filterCheckboxList);
    }

    // Seleccionar/Deseleccionar todo
    if (filterElements.btnSelectAll) {
        filterElements.btnSelectAll.addEventListener('click', selectAllFilters);
    }
    if (filterElements.btnDeselectAll) {
        filterElements.btnDeselectAll.addEventListener('click', deselectAllFilters);
    }

    // Aplicar/Limpiar filtro
    if (filterElements.btnAplicarFiltro) {
        filterElements.btnAplicarFiltro.addEventListener('click', applyFilter);
    }
    if (filterElements.btnLimpiarFiltro) {
        filterElements.btnLimpiarFiltro.addEventListener('click', clearFilter);
    }

    // Modal cerrar
    if (filterElements.btnCerrarModal) {
        filterElements.btnCerrarModal.addEventListener('click', closeSearchReplaceModal);
    }
    if (filterElements.modalBuscarReemplazar) {
        filterElements.modalBuscarReemplazar.addEventListener('click', (e) => {
            if (e.target === filterElements.modalBuscarReemplazar) {
                closeSearchReplaceModal();
            }
        });
    }

    // Búsqueda en tiempo real
    if (filterElements.inputBuscar) {
        filterElements.inputBuscar.addEventListener('input', updateSearchCount);
    }

    // Botones del modal
    if (filterElements.btnBuscarSiguiente) {
        filterElements.btnBuscarSiguiente.addEventListener('click', findNext);
    }
    if (filterElements.btnReemplazarUno) {
        filterElements.btnReemplazarUno.addEventListener('click', replaceOne);
    }
    if (filterElements.btnReemplazarTodos) {
        filterElements.btnReemplazarTodos.addEventListener('click', replaceAll);
    }

    // Botón guardar plantilla
    if (filterElements.btnGuardarPlantilla) {
        filterElements.btnGuardarPlantilla.addEventListener('click', guardarPlantillaBuscarReemplazar);
    }

    // Atajo de teclado Ctrl+H
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            if (!elements.previewSection.classList.contains('hidden')) {
                e.preventDefault();
                openSearchReplaceModal();
            }
        }
        // Escape para cerrar modal
        if (e.key === 'Escape') {
            if (filterElements.modalBuscarReemplazar &&
                !filterElements.modalBuscarReemplazar.classList.contains('hidden')) {
                closeSearchReplaceModal();
            }
            if (filterElements.filterDropdown &&
                !filterElements.filterDropdown.classList.contains('hidden')) {
                filterElements.filterDropdown.classList.add('hidden');
            }
            if (filterElements.filterImportesDropdown &&
                !filterElements.filterImportesDropdown.classList.contains('hidden')) {
                filterElements.filterImportesDropdown.classList.add('hidden');
            }
        }
    });

    // Event listeners para filtro de importes
    if (filterElements.btnFiltroImportes) {
        filterElements.btnFiltroImportes.addEventListener('click', toggleImportesFilterDropdown);
    }
    if (filterElements.btnAplicarFiltroImportes) {
        filterElements.btnAplicarFiltroImportes.addEventListener('click', applyImportesFilter);
    }
    if (filterElements.btnLimpiarFiltroImportes) {
        filterElements.btnLimpiarFiltroImportes.addEventListener('click', clearImportesFilter);
    }

    // Cerrar dropdown de importes al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (filterElements.filterImportesDropdown &&
            !filterElements.filterImportesDropdown.classList.contains('hidden') &&
            !filterElements.filterImportesDropdown.contains(e.target) &&
            !filterElements.btnFiltroImportes.contains(e.target)) {
            filterElements.filterImportesDropdown.classList.add('hidden');
        }
    });
}

// ============================================
// FUNCIONES DE FILTRO TIPO EXCEL
// ============================================

function toggleFilterDropdown() {
    if (filterElements.filterDropdown.classList.contains('hidden')) {
        // Generar lista de descripciones únicas
        generateDescriptionCheckboxes();
        filterElements.filterDropdown.classList.remove('hidden');
        filterElements.filterSearchInput.focus();
    } else {
        filterElements.filterDropdown.classList.add('hidden');
    }
}

function generateDescriptionCheckboxes() {
    // Contar ocurrencias de cada descripción
    const descriptionCount = new Map();
    state.extractedData.forEach(row => {
        const desc = row.descripcion || '';
        descriptionCount.set(desc, (descriptionCount.get(desc) || 0) + 1);
    });

    // Convertir a array y ordenar por frecuencia
    filterState.allDescriptions = Array.from(descriptionCount.entries())
        .map(([desc, count]) => ({ description: desc, count }))
        .sort((a, b) => b.count - a.count);

    // Si no hay filtro activo, seleccionar todas
    if (!filterState.isFilterActive) {
        filterState.selectedDescriptions = new Set(filterState.allDescriptions.map(d => d.description));
    }

    renderCheckboxList(filterState.allDescriptions);
}

function renderCheckboxList(descriptions) {
    filterElements.filterCheckboxList.innerHTML = descriptions.map(({ description, count }) => {
        const isChecked = filterState.selectedDescriptions.has(description);
        const displayDesc = description || '(vacío)';
        const escapedDesc = escapeHtml(description);
        return `
            <label class="filter-checkbox-item" title="${escapeHtml(displayDesc)}">
                <input type="checkbox"
                       value="${escapedDesc}"
                       ${isChecked ? 'checked' : ''}
                       onchange="handleCheckboxChange(this)">
                <span class="filter-checkbox-label">${escapeHtml(displayDesc)}</span>
                <span class="filter-checkbox-count">${count}</span>
            </label>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Función global para manejar cambios en checkboxes
window.handleCheckboxChange = function(checkbox) {
    const value = checkbox.value;
    // Decodificar el valor escapado
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const decodedValue = tempDiv.textContent;

    if (checkbox.checked) {
        filterState.selectedDescriptions.add(decodedValue);
    } else {
        filterState.selectedDescriptions.delete(decodedValue);
    }
};

function filterCheckboxList() {
    const searchText = filterElements.filterSearchInput.value.toLowerCase();

    if (!searchText) {
        renderCheckboxList(filterState.allDescriptions);
        return;
    }

    const filtered = filterState.allDescriptions.filter(({ description }) =>
        description.toLowerCase().includes(searchText)
    );

    renderCheckboxList(filtered);
}

function selectAllFilters() {
    // Seleccionar solo los visibles actualmente
    const searchText = filterElements.filterSearchInput.value.toLowerCase();

    filterState.allDescriptions.forEach(({ description }) => {
        if (!searchText || description.toLowerCase().includes(searchText)) {
            filterState.selectedDescriptions.add(description);
        }
    });

    filterCheckboxList();
}

function deselectAllFilters() {
    // Deseleccionar solo los visibles actualmente
    const searchText = filterElements.filterSearchInput.value.toLowerCase();

    filterState.allDescriptions.forEach(({ description }) => {
        if (!searchText || description.toLowerCase().includes(searchText)) {
            filterState.selectedDescriptions.delete(description);
        }
    });

    filterCheckboxList();
}

function applyFilter() {
    filterState.isFilterActive = filterState.selectedDescriptions.size !== filterState.allDescriptions.length;

    // Actualizar badge
    if (filterState.isFilterActive) {
        const deselectedCount = filterState.allDescriptions.length - filterState.selectedDescriptions.size;
        filterElements.filterBadge.textContent = deselectedCount;
        filterElements.filterBadge.classList.remove('hidden');
    } else {
        filterElements.filterBadge.classList.add('hidden');
    }

    // Cerrar dropdown
    filterElements.filterDropdown.classList.add('hidden');

    // Re-renderizar la vista previa con filtro
    renderPreviewWithFilter();
}

function clearFilter() {
    filterState.selectedDescriptions = new Set(filterState.allDescriptions.map(d => d.description));
    filterState.isFilterActive = false;
    filterElements.filterBadge.classList.add('hidden');
    filterElements.filterSearchInput.value = '';

    // Cerrar dropdown
    filterElements.filterDropdown.classList.add('hidden');

    // Re-renderizar sin filtro
    renderPreviewWithFilter();
}

// ============================================
// FUNCIONES DE FILTRO DE IMPORTES
// ============================================

function toggleImportesFilterDropdown() {
    if (filterElements.filterImportesDropdown.classList.contains('hidden')) {
        // Restaurar la selección actual en los radio buttons
        const radioValue = filterState.importesFilterType || 'todos';
        const radio = document.querySelector(`input[name="filtroImportes"][value="${radioValue}"]`);
        if (radio) radio.checked = true;

        filterElements.filterImportesDropdown.classList.remove('hidden');
    } else {
        filterElements.filterImportesDropdown.classList.add('hidden');
    }
}

function applyImportesFilter() {
    const selectedRadio = document.querySelector('input[name="filtroImportes"]:checked');
    filterState.importesFilterType = selectedRadio ? selectedRadio.value : 'todos';
    filterState.isImportesFilterActive = filterState.importesFilterType !== 'todos';

    // Actualizar badge
    if (filterState.isImportesFilterActive) {
        filterElements.filterImportesBadge.textContent = '!';
        filterElements.filterImportesBadge.classList.remove('hidden');
    } else {
        filterElements.filterImportesBadge.classList.add('hidden');
    }

    // Cerrar dropdown
    filterElements.filterImportesDropdown.classList.add('hidden');

    // Re-renderizar la vista previa con filtro
    renderPreviewWithFilter();
}

function clearImportesFilter() {
    filterState.importesFilterType = 'todos';
    filterState.isImportesFilterActive = false;
    filterElements.filterImportesBadge.classList.add('hidden');

    // Resetear radio buttons
    const radioTodos = document.querySelector('input[name="filtroImportes"][value="todos"]');
    if (radioTodos) radioTodos.checked = true;

    // Cerrar dropdown
    filterElements.filterImportesDropdown.classList.add('hidden');

    // Re-renderizar sin filtro
    renderPreviewWithFilter();
}

// Función auxiliar para aplicar el filtro de importes
function applyImportesFilterToData(data) {
    if (!filterState.isImportesFilterActive || filterState.importesFilterType === 'todos') {
        return data;
    }

    return data.filter(row => {
        const debito = parseArgentineNumber(row.debito);
        const credito = parseArgentineNumber(row.credito);

        if (filterState.importesFilterType === 'ambos_cero') {
            // Mostrar solo movimientos donde débito = 0 Y crédito = 0
            return debito === 0 && credito === 0;
        } else if (filterState.importesFilterType === 'ambos_distintos_cero') {
            // Mostrar solo movimientos donde débito ≠ 0 Y crédito ≠ 0
            return debito !== 0 && credito !== 0;
        }

        return true;
    });
}

function renderPreviewWithFilter() {
    elements.previewSection.classList.remove('hidden');

    // Filtrar datos si hay filtro de descripción activo
    let dataToShow = state.extractedData;
    if (filterState.isFilterActive) {
        dataToShow = state.extractedData.filter(row =>
            filterState.selectedDescriptions.has(row.descripcion || '')
        );
    }

    // Aplicar filtro de importes si está activo
    dataToShow = applyImportesFilterToData(dataToShow);

    filterState.filteredData = dataToShow;

    // Renderizar encabezados según el tipo
    if (state.selectedType === 'inversiones') {
        elements.previewHeader.innerHTML = `
            <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Monto</th>
            </tr>
        `;
        // Ocultar panel de saldos para inversiones
        if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    } else {
        elements.previewHeader.innerHTML = `
            <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Origen</th>
                <th class="text-right">Crédito</th>
                <th class="text-right">Débito</th>
                <th class="text-right">Saldo</th>
            </tr>
        `;

        // Mostrar panel de saldos para extractos bancarios (siempre con datos completos)
        if (elements.resumenSaldos && state.extractedData.length > 0) {
            elements.resumenSaldos.classList.remove('hidden');

            // Calcular saldo inicial del período (saldo antes del primer movimiento)
            const primerMov = state.extractedData[0];
            const saldoPrimerMov = parseArgentineNumber(primerMov.saldo);
            const creditoPrimerMov = parseArgentineNumber(primerMov.credito);
            const debitoPrimerMov = parseArgentineNumber(primerMov.debito);
            const saldoInicialPeriodo = saldoPrimerMov - creditoPrimerMov + debitoPrimerMov;

            // Saldo al cierre del período (saldo del último movimiento)
            const ultimoMov = state.extractedData[state.extractedData.length - 1];
            const saldoCierrePeriodo = parseArgentineNumber(ultimoMov.saldo);

            // Actualizar los valores en el panel
            elements.saldoInicialPeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoInicialPeriodo);
            elements.saldoCierrePeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoCierrePeriodo);
        } else if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    }

    // Renderizar filas (mostrar más filas si hay filtro activo)
    const maxRows = filterState.isFilterActive ? 50 : 10;
    const rowsToShow = dataToShow.slice(0, maxRows);

    elements.previewBody.innerHTML = rowsToShow.map((row, index) => {
        if (state.selectedType === 'inversiones') {
            const monto = row.credito !== '0' ? row.credito : row.debito;
            return `
                <tr data-index="${index}">
                    <td>${row.fecha}</td>
                    <td class="descripcion-cell">${row.descripcion}</td>
                    <td class="text-right">${row.origen}</td>
                    <td class="text-right">${monto}</td>
                </tr>
            `;
        } else {
            return `
                <tr data-index="${index}">
                    <td>${row.fecha}</td>
                    <td class="descripcion-cell">${row.descripcion}</td>
                    <td>${row.origen}</td>
                    <td class="text-right text-green">${row.credito}</td>
                    <td class="text-right text-red">${row.debito}</td>
                    <td class="text-right">${row.saldo}</td>
                </tr>
            `;
        }
    }).join('');

    // Mostrar footer
    if (dataToShow.length > maxRows) {
        elements.previewFooter.textContent = `... y ${dataToShow.length - maxRows} movimientos más`;
    } else {
        elements.previewFooter.textContent = '';
    }

    // Actualizar contador
    const totalText = filterState.isFilterActive
        ? `${dataToShow.length} de ${state.extractedData.length}`
        : state.extractedData.length;
    elements.rowCount.textContent = totalText;
}

// ============================================
// FUNCIONES DE BUSCAR Y REEMPLAZAR
// ============================================

function openSearchReplaceModal() {
    filterElements.modalBuscarReemplazar.classList.remove('hidden');
    filterElements.inputBuscar.value = '';
    filterElements.inputReemplazar.value = '';
    filterElements.buscarResultado.classList.add('hidden');
    filterState.searchCurrentIndex = -1;
    filterState.searchMatches = [];

    // Cargar plantillas guardadas para el banco/cliente actual
    renderizarPlantillas();

    setTimeout(() => filterElements.inputBuscar.focus(), 100);
}

function closeSearchReplaceModal() {
    filterElements.modalBuscarReemplazar.classList.add('hidden');
    // Limpiar resaltados
    clearHighlights();
}

function updateSearchCount() {
    const searchText = filterElements.inputBuscar.value;

    if (!searchText) {
        filterElements.buscarResultado.classList.add('hidden');
        filterState.searchMatches = [];
        clearHighlights();
        return;
    }

    const caseSensitive = filterElements.chkCaseSensitive.checked;
    const wholeWord = filterElements.chkPalabraCompleta.checked;

    // Buscar en los datos
    filterState.searchMatches = [];
    const dataToSearch = filterState.isFilterActive ? filterState.filteredData : state.extractedData;

    dataToSearch.forEach((row, index) => {
        const desc = row.descripcion || '';
        if (textMatches(desc, searchText, caseSensitive, wholeWord)) {
            filterState.searchMatches.push({ index, row });
        }
    });

    // Mostrar resultado
    filterElements.buscarResultado.classList.remove('hidden');
    filterElements.coincidenciasCount.textContent =
        `${filterState.searchMatches.length} coincidencia${filterState.searchMatches.length !== 1 ? 's' : ''} encontrada${filterState.searchMatches.length !== 1 ? 's' : ''}`;

    // Resaltar coincidencias en la tabla
    highlightMatches(searchText, caseSensitive, wholeWord);
}

function textMatches(text, search, caseSensitive, wholeWord) {
    let textToSearch = caseSensitive ? text : text.toLowerCase();
    let searchTerm = caseSensitive ? search : search.toLowerCase();

    if (wholeWord) {
        const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, caseSensitive ? '' : 'i');
        return regex.test(text);
    }

    return textToSearch.includes(searchTerm);
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(searchText, caseSensitive, wholeWord) {
    clearHighlights();

    if (!searchText) return;

    const cells = document.querySelectorAll('.descripcion-cell');
    cells.forEach(cell => {
        const text = cell.textContent;
        if (textMatches(text, searchText, caseSensitive, wholeWord)) {
            const flags = caseSensitive ? 'g' : 'gi';
            let pattern;
            if (wholeWord) {
                pattern = new RegExp(`(\\b${escapeRegex(searchText)}\\b)`, flags);
            } else {
                pattern = new RegExp(`(${escapeRegex(searchText)})`, flags);
            }
            cell.innerHTML = text.replace(pattern, '<span class="highlight-match">$1</span>');
        }
    });
}

function clearHighlights() {
    const cells = document.querySelectorAll('.descripcion-cell');
    cells.forEach(cell => {
        cell.textContent = cell.textContent;
    });
}

function findNext() {
    if (filterState.searchMatches.length === 0) {
        updateSearchCount();
        if (filterState.searchMatches.length === 0) return;
    }

    // Incrementar índice
    filterState.searchCurrentIndex = (filterState.searchCurrentIndex + 1) % filterState.searchMatches.length;

    // Scroll a la fila correspondiente
    const match = filterState.searchMatches[filterState.searchCurrentIndex];
    const rows = elements.previewBody.querySelectorAll('tr');

    // Buscar la fila en la tabla visible
    rows.forEach((row, idx) => {
        const dataIndex = parseInt(row.getAttribute('data-index'));
        if (dataIndex === filterState.searchCurrentIndex) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = '#fef3c7';
            setTimeout(() => {
                row.style.backgroundColor = '';
            }, 2000);
        }
    });

    // Actualizar contador
    filterElements.coincidenciasCount.textContent =
        `${filterState.searchCurrentIndex + 1} de ${filterState.searchMatches.length} coincidencias`;
}

function replaceOne() {
    const searchText = filterElements.inputBuscar.value;
    const replaceText = filterElements.inputReemplazar.value;

    if (!searchText) return;

    if (filterState.searchMatches.length === 0) {
        updateSearchCount();
        if (filterState.searchMatches.length === 0) return;
    }

    // Si no hay índice actual, ir al primero
    if (filterState.searchCurrentIndex < 0) {
        filterState.searchCurrentIndex = 0;
    }

    const caseSensitive = filterElements.chkCaseSensitive.checked;
    const wholeWord = filterElements.chkPalabraCompleta.checked;

    // Obtener el movimiento actual
    const match = filterState.searchMatches[filterState.searchCurrentIndex];
    if (!match) return;

    // Reemplazar en la descripción
    const oldDesc = match.row.descripcion;
    match.row.descripcion = replaceInText(oldDesc, searchText, replaceText, caseSensitive, wholeWord);

    // Actualizar la búsqueda y la vista
    updateSearchCount();
    renderPreviewWithFilter();

    showSuccess(`Reemplazado: "${searchText}" por "${replaceText}"`);
}

function replaceAll() {
    const searchText = filterElements.inputBuscar.value;
    const replaceText = filterElements.inputReemplazar.value;

    if (!searchText) return;

    const caseSensitive = filterElements.chkCaseSensitive.checked;
    const wholeWord = filterElements.chkPalabraCompleta.checked;

    let replaceCount = 0;

    // Reemplazar en todos los datos
    state.extractedData.forEach(row => {
        const oldDesc = row.descripcion || '';
        if (textMatches(oldDesc, searchText, caseSensitive, wholeWord)) {
            row.descripcion = replaceInText(oldDesc, searchText, replaceText, caseSensitive, wholeWord);
            replaceCount++;
        }
    });

    if (replaceCount > 0) {
        // Regenerar filtros ya que las descripciones cambiaron
        if (filterState.isFilterActive) {
            // Actualizar las descripciones seleccionadas con el nuevo texto
            const newSelected = new Set();
            state.extractedData.forEach(row => {
                if (filterState.selectedDescriptions.has(row.descripcion)) {
                    newSelected.add(row.descripcion);
                }
            });
            // Agregar la nueva descripción si reemplazó alguna seleccionada
            state.extractedData.forEach(row => {
                const desc = row.descripcion || '';
                // Mantener selección para descripciones que fueron reemplazadas
                newSelected.add(desc);
            });
        }

        // Actualizar la búsqueda y la vista
        updateSearchCount();
        renderPreviewWithFilter();

        showSuccess(`${replaceCount} reemplazo${replaceCount !== 1 ? 's' : ''} realizado${replaceCount !== 1 ? 's' : ''}`);
    } else {
        showError('No se encontraron coincidencias para reemplazar');
    }
}

function replaceInText(text, search, replace, caseSensitive, wholeWord) {
    const flags = caseSensitive ? 'g' : 'gi';
    let pattern;

    if (wholeWord) {
        pattern = new RegExp(`\\b${escapeRegex(search)}\\b`, flags);
    } else {
        pattern = new RegExp(escapeRegex(search), flags);
    }

    return text.replace(pattern, replace);
}

// ============================================
// PLANTILLAS DE BUSCAR Y REEMPLAZAR
// ============================================

const PLANTILLAS_STORAGE_KEY = 'buscar_reemplazar_plantillas';

// Obtener todas las plantillas desde localStorage
function obtenerPlantillasGuardadas() {
    try {
        const stored = localStorage.getItem(PLANTILLAS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : { bancos: {} };
    } catch (e) {
        console.error('Error al cargar plantillas:', e);
        return { bancos: {} };
    }
}

// Guardar plantillas en localStorage
function guardarPlantillasEnStorage(data) {
    try {
        localStorage.setItem(PLANTILLAS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error al guardar plantillas:', e);
    }
}

// Obtener plantillas para el banco y cliente actual
function obtenerPlantillasActuales() {
    const data = obtenerPlantillasGuardadas();
    const bancoId = state.selectedBank || 'general';
    const clienteId = clienteSeleccionadoId || 'general';

    const plantillas = [];

    // Plantillas del banco para este cliente específico
    if (data.bancos[bancoId]?.clientes?.[clienteId]?.plantillas) {
        data.bancos[bancoId].clientes[clienteId].plantillas.forEach(p => {
            plantillas.push({ ...p, scope: 'cliente' });
        });
    }

    // Plantillas generales del banco (para todos los clientes)
    if (data.bancos[bancoId]?.plantillasGenerales) {
        data.bancos[bancoId].plantillasGenerales.forEach(p => {
            plantillas.push({ ...p, scope: 'banco' });
        });
    }

    return plantillas;
}

// Guardar una nueva plantilla
function guardarPlantillaBuscarReemplazar() {
    const buscar = filterElements.inputBuscar.value.trim();
    const reemplazar = filterElements.inputReemplazar.value;

    if (!buscar) {
        showError('Ingrese un texto a buscar para guardar la plantilla');
        return;
    }

    if (!state.selectedBank) {
        showError('Primero seleccione un banco');
        return;
    }

    // Preguntar si es para este cliente o para todo el banco
    const tieneCliente = clienteSeleccionadoId !== null;
    let scope = 'banco';

    if (tieneCliente) {
        const resultado = confirm(
            `¿Guardar plantilla para "${clienteSeleccionadoNombre}"?\n\n` +
            `Aceptar = Solo para este cliente\n` +
            `Cancelar = Para todos los clientes de este banco`
        );
        scope = resultado ? 'cliente' : 'banco';
    }

    // Solicitar nombre para la plantilla
    const nombreDefault = buscar.substring(0, 30) + (buscar.length > 30 ? '...' : '');
    const nombre = prompt('Nombre para la plantilla:', nombreDefault);

    if (!nombre) return;

    const data = obtenerPlantillasGuardadas();
    const bancoId = state.selectedBank;

    // Asegurar estructura
    if (!data.bancos[bancoId]) {
        data.bancos[bancoId] = { clientes: {}, plantillasGenerales: [] };
    }

    const nuevaPlantilla = {
        id: Date.now().toString(),
        nombre: nombre,
        buscar: buscar,
        reemplazar: reemplazar,
        caseSensitive: filterElements.chkCaseSensitive.checked,
        wholeWord: filterElements.chkPalabraCompleta.checked
    };

    if (scope === 'cliente' && clienteSeleccionadoId) {
        if (!data.bancos[bancoId].clientes[clienteSeleccionadoId]) {
            data.bancos[bancoId].clientes[clienteSeleccionadoId] = {
                nombre: clienteSeleccionadoNombre,
                plantillas: []
            };
        }
        data.bancos[bancoId].clientes[clienteSeleccionadoId].plantillas.push(nuevaPlantilla);
    } else {
        data.bancos[bancoId].plantillasGenerales.push(nuevaPlantilla);
    }

    guardarPlantillasEnStorage(data);
    renderizarPlantillas();
    showSuccess(`Plantilla "${nombre}" guardada correctamente`);
}

// Eliminar una plantilla
function eliminarPlantilla(plantillaId, scope) {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    const data = obtenerPlantillasGuardadas();
    const bancoId = state.selectedBank;

    if (scope === 'cliente' && clienteSeleccionadoId) {
        const plantillas = data.bancos[bancoId]?.clientes?.[clienteSeleccionadoId]?.plantillas;
        if (plantillas) {
            const idx = plantillas.findIndex(p => p.id === plantillaId);
            if (idx !== -1) {
                plantillas.splice(idx, 1);
            }
        }
    } else {
        const plantillas = data.bancos[bancoId]?.plantillasGenerales;
        if (plantillas) {
            const idx = plantillas.findIndex(p => p.id === plantillaId);
            if (idx !== -1) {
                plantillas.splice(idx, 1);
            }
        }
    }

    guardarPlantillasEnStorage(data);
    renderizarPlantillas();
    showSuccess('Plantilla eliminada');
}

// Aplicar una plantilla a los campos del modal
function aplicarPlantilla(plantilla) {
    filterElements.inputBuscar.value = plantilla.buscar;
    filterElements.inputReemplazar.value = plantilla.reemplazar;
    filterElements.chkCaseSensitive.checked = plantilla.caseSensitive || false;
    filterElements.chkPalabraCompleta.checked = plantilla.wholeWord || false;

    // Actualizar la búsqueda
    updateSearchCount();
}

// Renderizar las plantillas en el contenedor
function renderizarPlantillas() {
    const container = filterElements.plantillasContainer;
    if (!container) return;

    const plantillas = obtenerPlantillasActuales();

    if (plantillas.length === 0) {
        container.innerHTML = '<span class="plantillas-empty">No hay plantillas guardadas para este banco/cliente</span>';
        return;
    }

    container.innerHTML = '';

    plantillas.forEach(plantilla => {
        const item = document.createElement('div');
        item.className = 'plantilla-item';
        item.title = `Buscar: "${plantilla.buscar}"\nReemplazar: "${plantilla.reemplazar}"`;

        const scopeBadge = plantilla.scope === 'cliente'
            ? '<span class="plantilla-scope-badge cliente">Cliente</span>'
            : '<span class="plantilla-scope-badge banco">Banco</span>';

        const previewText = plantilla.reemplazar
            ? `"${plantilla.buscar.substring(0, 20)}..." → "${plantilla.reemplazar.substring(0, 20)}..."`
            : `Eliminar: "${plantilla.buscar.substring(0, 25)}..."`;

        item.innerHTML = `
            <div class="plantilla-info">
                <div class="plantilla-nombre">${escapeHtml(plantilla.nombre)}</div>
                <div class="plantilla-preview">${escapeHtml(previewText)}</div>
            </div>
            ${scopeBadge}
            <button class="plantilla-delete" title="Eliminar plantilla">&times;</button>
        `;

        // Click en el item para aplicar
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('plantilla-delete')) {
                aplicarPlantilla(plantilla);
            }
        });

        // Click en eliminar
        const deleteBtn = item.querySelector('.plantilla-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            eliminarPlantilla(plantilla.id, plantilla.scope);
        });

        container.appendChild(item);
    });
}

// Función helper para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Sobrescribir la función renderPreview original para usar la nueva
const originalRenderPreview = renderPreview;
renderPreview = function() {
    // Resetear estado de filtro cuando se cargan nuevos datos
    filterState.isFilterActive = false;
    filterState.selectedDescriptions = new Set();
    filterState.filteredData = [];

    if (filterElements.filterBadge) {
        filterElements.filterBadge.classList.add('hidden');
    }

    // Llamar a la versión con filtro
    renderPreviewWithFilter();
};

// Inicializar filtros cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initFilterElements, 100);
});

// ============================================
// FUNCIONALIDAD: SELECCIÓN Y ELIMINACIÓN DE MOVIMIENTOS
// ============================================

const selectionState = {
    selectedIndices: new Set(),  // Índices de movimientos seleccionados
    selectAllChecked: false
};

// Elementos DOM para selección
const selectionElements = {
    btnEliminarSeleccionados: null,
    contadorSeleccionados: null,
    btnLimpiarFiltrosGlobal: null
};

// Inicializar elementos de selección
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        selectionElements.btnEliminarSeleccionados = document.getElementById('btnEliminarSeleccionados');
        selectionElements.contadorSeleccionados = document.getElementById('contadorSeleccionados');
        selectionElements.btnLimpiarFiltrosGlobal = document.getElementById('btnLimpiarFiltrosGlobal');

        // Event listeners
        if (selectionElements.btnEliminarSeleccionados) {
            selectionElements.btnEliminarSeleccionados.addEventListener('click', eliminarMovimientosSeleccionados);
        }

        if (selectionElements.btnLimpiarFiltrosGlobal) {
            selectionElements.btnLimpiarFiltrosGlobal.addEventListener('click', limpiarTodosLosFiltros);
        }
    }, 100);
});

// Toggle selección de un movimiento
function toggleMovimientoSeleccionado(index, checkbox) {
    if (checkbox.checked) {
        selectionState.selectedIndices.add(index);
    } else {
        selectionState.selectedIndices.delete(index);
    }

    actualizarUISeleccion();
    actualizarEstiloFilaSeleccionada(index, checkbox.checked);
}

// Toggle seleccionar todos (solo los visibles/filtrados)
function toggleSeleccionarTodos(checkbox) {
    // Verificar si ALGÚN filtro está activo (descripción O importes)
    const anyFilterActive = filterState.isFilterActive || filterState.isImportesFilterActive;
    const dataToShow = anyFilterActive ? filterState.filteredData : state.extractedData;

    selectionState.selectAllChecked = checkbox.checked;

    if (checkbox.checked) {
        // Seleccionar todos los visibles
        dataToShow.forEach((_, idx) => {
            const originalIndex = anyFilterActive
                ? state.extractedData.indexOf(dataToShow[idx])
                : idx;
            selectionState.selectedIndices.add(originalIndex);
        });
    } else {
        // Deseleccionar todos
        selectionState.selectedIndices.clear();
    }

    actualizarUISeleccion();
    actualizarCheckboxesFilas();
}

// Actualizar UI de selección
function actualizarUISeleccion() {
    const count = selectionState.selectedIndices.size;

    if (selectionElements.contadorSeleccionados) {
        selectionElements.contadorSeleccionados.textContent = count;
    }

    if (selectionElements.btnEliminarSeleccionados) {
        if (count > 0) {
            selectionElements.btnEliminarSeleccionados.classList.remove('hidden');
        } else {
            selectionElements.btnEliminarSeleccionados.classList.add('hidden');
        }
    }
}

// Actualizar estilo de fila seleccionada
function actualizarEstiloFilaSeleccionada(index, selected) {
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        if (selected) {
            row.classList.add('row-selected');
        } else {
            row.classList.remove('row-selected');
        }
    }
}

// Actualizar todos los checkboxes de filas
function actualizarCheckboxesFilas() {
    document.querySelectorAll('.mov-checkbox').forEach(cb => {
        const index = parseInt(cb.dataset.index);
        cb.checked = selectionState.selectedIndices.has(index);
        actualizarEstiloFilaSeleccionada(index, cb.checked);
    });
}

// Eliminar movimientos seleccionados
function eliminarMovimientosSeleccionados() {
    const count = selectionState.selectedIndices.size;

    if (count === 0) return;

    if (!confirm(`¿Está seguro de eliminar ${count} movimiento${count !== 1 ? 's' : ''}?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    // Ordenar índices de mayor a menor para eliminar sin afectar índices anteriores
    const indicesToDelete = Array.from(selectionState.selectedIndices).sort((a, b) => b - a);

    // Eliminar de extractedData
    indicesToDelete.forEach(index => {
        state.extractedData.splice(index, 1);
    });

    // Limpiar selección
    selectionState.selectedIndices.clear();
    selectionState.selectAllChecked = false;

    // Recalcular saldos
    recalcularSaldosMovimientos();

    // Actualizar vista
    actualizarUISeleccion();
    renderPreviewWithFilter();

    // Actualizar contador en botón de descarga
    if (elements.rowCount) {
        elements.rowCount.textContent = state.extractedData.length;
    }

    showSuccess(`${count} movimiento${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`);
}

// Limpiar todos los filtros
function limpiarTodosLosFiltros() {
    // Resetear estado de filtro de descripción
    filterState.isFilterActive = false;
    filterState.selectedDescriptions = new Set(filterState.allDescriptions.map(d => d.description));

    // Resetear estado de filtro de importes
    filterState.isImportesFilterActive = false;
    filterState.importesFilterType = 'todos';

    // Ocultar badges y botón de limpiar
    if (filterElements.filterBadge) {
        filterElements.filterBadge.classList.add('hidden');
    }
    if (filterElements.filterImportesBadge) {
        filterElements.filterImportesBadge.classList.add('hidden');
    }
    if (selectionElements.btnLimpiarFiltrosGlobal) {
        selectionElements.btnLimpiarFiltrosGlobal.classList.add('hidden');
    }

    // Limpiar búsqueda en filtro
    if (filterElements.filterSearchInput) {
        filterElements.filterSearchInput.value = '';
    }

    // Resetear radio buttons de importes
    const radioTodos = document.querySelector('input[name="filtroImportes"][value="todos"]');
    if (radioTodos) radioTodos.checked = true;

    // Re-renderizar
    renderPreviewWithFilter();
}

// Mostrar/ocultar botón de limpiar filtros global
function actualizarBotonLimpiarFiltrosGlobal() {
    if (selectionElements.btnLimpiarFiltrosGlobal) {
        // Mostrar si hay algún filtro activo (descripción o importes)
        if (filterState.isFilterActive || filterState.isImportesFilterActive) {
            selectionElements.btnLimpiarFiltrosGlobal.classList.remove('hidden');
        } else {
            selectionElements.btnLimpiarFiltrosGlobal.classList.add('hidden');
        }
    }
}

// ============================================
// MODIFICAR renderPreviewWithFilter PARA INCLUIR CHECKBOXES
// ============================================

// Guardar referencia a la función original
const _originalRenderPreviewWithFilter = renderPreviewWithFilter;

// Sobrescribir la función para incluir checkboxes
renderPreviewWithFilter = function() {
    elements.previewSection.classList.remove('hidden');

    // Preparar datos filtrados por descripción
    let dataToShow = state.extractedData;
    if (filterState.isFilterActive) {
        dataToShow = state.extractedData.filter(row =>
            filterState.selectedDescriptions.has(row.descripcion || '')
        );
    }

    // Aplicar filtro de importes si está activo
    dataToShow = applyImportesFilterToData(dataToShow);

    filterState.filteredData = dataToShow;

    // Actualizar botón de limpiar filtros global
    actualizarBotonLimpiarFiltrosGlobal();

    // Renderizar encabezados según el tipo
    if (state.selectedType === 'inversiones') {
        elements.previewHeader.innerHTML = `
            <tr>
                <th class="checkbox-col">
                    <input type="checkbox" class="select-all-checkbox"
                           onclick="toggleSeleccionarTodos(this)"
                           ${selectionState.selectAllChecked ? 'checked' : ''}>
                </th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Monto</th>
            </tr>
        `;
        if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    } else {
        elements.previewHeader.innerHTML = `
            <tr>
                <th class="checkbox-col">
                    <input type="checkbox" class="select-all-checkbox"
                           onclick="toggleSeleccionarTodos(this)"
                           ${selectionState.selectAllChecked ? 'checked' : ''}>
                </th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Origen</th>
                <th class="text-right">Crédito</th>
                <th class="text-right">Débito</th>
                <th class="text-right">Saldo</th>
            </tr>
        `;

        // Mostrar panel de saldos
        if (elements.resumenSaldos && state.extractedData.length > 0) {
            elements.resumenSaldos.classList.remove('hidden');

            const primerMov = state.extractedData[0];
            const saldoPrimerMov = parseArgentineNumber(primerMov.saldo);
            const creditoPrimerMov = parseArgentineNumber(primerMov.credito);
            const debitoPrimerMov = parseArgentineNumber(primerMov.debito);
            const saldoInicialPeriodo = saldoPrimerMov - creditoPrimerMov + debitoPrimerMov;

            const ultimoMov = state.extractedData[state.extractedData.length - 1];
            const saldoCierrePeriodo = parseArgentineNumber(ultimoMov.saldo);

            elements.saldoInicialPeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoInicialPeriodo);
            elements.saldoCierrePeriodo.textContent = '$ ' + formatearNumeroArgentino(saldoCierrePeriodo);
        } else if (elements.resumenSaldos) {
            elements.resumenSaldos.classList.add('hidden');
        }
    }

    // Renderizar TODAS las filas con checkboxes (sin límite)
    // El scroll vertical permite ver todos los movimientos
    const rowsToShow = dataToShow;

    elements.previewBody.innerHTML = rowsToShow.map((row, displayIdx) => {
        // Encontrar el índice original en extractedData
        const originalIndex = state.extractedData.indexOf(row);
        const isSelected = selectionState.selectedIndices.has(originalIndex);
        const selectedClass = isSelected ? 'row-selected' : '';

        if (state.selectedType === 'inversiones') {
            const monto = row.credito !== '0' ? row.credito : row.debito;
            return `
                <tr data-index="${originalIndex}" class="${selectedClass}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="mov-checkbox"
                               data-index="${originalIndex}"
                               onclick="toggleMovimientoSeleccionado(${originalIndex}, this)"
                               ${isSelected ? 'checked' : ''}>
                    </td>
                    <td>${row.fecha}</td>
                    <td>${row.descripcion}</td>
                    <td class="text-right">${row.origen}</td>
                    <td class="text-right">${monto}</td>
                </tr>
            `;
        } else {
            return `
                <tr data-index="${originalIndex}" class="${selectedClass}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="mov-checkbox"
                               data-index="${originalIndex}"
                               onclick="toggleMovimientoSeleccionado(${originalIndex}, this)"
                               ${isSelected ? 'checked' : ''}>
                    </td>
                    <td>${row.fecha}</td>
                    <td>${row.descripcion}</td>
                    <td>${row.origen}</td>
                    <td class="text-right text-green">${row.credito}</td>
                    <td class="text-right text-red">${row.debito}</td>
                    <td class="text-right">${row.saldo}</td>
                </tr>
            `;
        }
    }).join('');

    // Footer con información
    const totalCount = dataToShow.length;
    const hayFiltroActivo = filterState.isFilterActive || filterState.isImportesFilterActive;

    if (hayFiltroActivo) {
        elements.previewFooter.textContent = `${totalCount} movimientos coinciden con el filtro (${state.extractedData.length} totales)`;
    } else {
        elements.previewFooter.textContent = `${totalCount} movimientos`;
    }

    elements.rowCount.textContent = state.extractedData.length;
};

// ============================================
// FUNCIONALIDAD: ENVIAR A AUDITORÍA
// ============================================

const auditoriaState = {
    currentStep: 1,
    clientes: [],
    cuentas: [],
    clienteSeleccionado: null,
    cuentaSeleccionada: null,
    existeExtracto: false,
    extractoExistente: null,
    creandoCuenta: false
};

// Elementos DOM para auditoría
const auditoriaElements = {
    modal: null,
    btnEnviar: null,
    step1: null,
    step2: null,
    step3: null,
    progress: null,
    result: null,
    selectCliente: null,
    selectCuenta: null,
    selectMes: null,
    selectAnio: null,
    btnNext: null,
    btnBack: null,
    btnEnviarFinal: null,
    btnCancelar: null,
    btnCerrar: null,
    btnNuevaCuenta: null,
    movCount: null,
    existingCount: null,
    periodoExistente: null
};

// Inicializar modal de auditoría
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        auditoriaElements.modal = document.getElementById('modalEnviarAuditoria');
        auditoriaElements.btnEnviar = document.getElementById('btnEnviarAuditoria');
        auditoriaElements.step1 = document.getElementById('auditoriaStep1');
        auditoriaElements.step2 = document.getElementById('auditoriaStep2');
        auditoriaElements.step3 = document.getElementById('auditoriaStep3');
        auditoriaElements.progress = document.getElementById('auditoriaProgress');
        auditoriaElements.result = document.getElementById('auditoriaResult');
        auditoriaElements.selectCliente = document.getElementById('auditoriaCliente');
        auditoriaElements.selectCuenta = document.getElementById('auditoriaCuenta');
        auditoriaElements.selectMes = document.getElementById('auditoriaMes');
        auditoriaElements.selectAnio = document.getElementById('auditoriaAnio');
        auditoriaElements.btnNext = document.getElementById('btnAuditoriaNext');
        auditoriaElements.btnBack = document.getElementById('btnAuditoriaBack');
        auditoriaElements.btnEnviarFinal = document.getElementById('btnAuditoriaEnviar');
        auditoriaElements.btnCancelar = document.getElementById('btnAuditoriaCancelar');
        auditoriaElements.btnCerrar = document.getElementById('btnAuditoriaCerrar');
        auditoriaElements.btnNuevaCuenta = document.getElementById('btnNuevaCuentaAuditoria');
        auditoriaElements.movCount = document.getElementById('auditoriaMovCount');
        auditoriaElements.existingCount = document.getElementById('auditoriaExistingCount');
        auditoriaElements.periodoExistente = document.getElementById('auditoriaPeriodoExistente');

        // Event listeners
        if (auditoriaElements.btnEnviar) {
            auditoriaElements.btnEnviar.addEventListener('click', abrirModalAuditoria);
        }

        if (document.getElementById('btnCerrarModalAuditoria')) {
            document.getElementById('btnCerrarModalAuditoria').addEventListener('click', cerrarModalAuditoria);
        }

        if (auditoriaElements.btnCancelar) {
            auditoriaElements.btnCancelar.addEventListener('click', cerrarModalAuditoria);
        }

        if (auditoriaElements.btnCerrar) {
            auditoriaElements.btnCerrar.addEventListener('click', cerrarModalAuditoria);
        }

        if (auditoriaElements.btnNext) {
            auditoriaElements.btnNext.addEventListener('click', verificarPeriodoAuditoria);
        }

        if (auditoriaElements.btnBack) {
            auditoriaElements.btnBack.addEventListener('click', volverPasoAnterior);
        }

        if (auditoriaElements.btnEnviarFinal) {
            auditoriaElements.btnEnviarFinal.addEventListener('click', enviarMovimientosAuditoria);
        }

        if (auditoriaElements.selectCliente) {
            auditoriaElements.selectCliente.addEventListener('change', cargarCuentasCliente);
        }

        if (auditoriaElements.btnNuevaCuenta) {
            auditoriaElements.btnNuevaCuenta.addEventListener('click', mostrarFormularioNuevaCuenta);
        }

        // Click fuera del modal para cerrar
        if (auditoriaElements.modal) {
            auditoriaElements.modal.addEventListener('click', (e) => {
                if (e.target === auditoriaElements.modal) {
                    cerrarModalAuditoria();
                }
            });
        }
    }, 100);
});

// Abrir modal de auditoría
async function abrirModalAuditoria() {
    if (state.extractedData.length === 0) {
        showError('No hay movimientos para enviar. Primero convierta un extracto.');
        return;
    }

    // Resetear estado
    auditoriaState.currentStep = 1;
    auditoriaState.existeExtracto = false;
    auditoriaState.extractoExistente = null;
    auditoriaState.creandoCuenta = false;

    // Mostrar modal
    auditoriaElements.modal.classList.remove('hidden');

    // Mostrar paso 1, ocultar otros
    auditoriaElements.step1.classList.remove('hidden');
    auditoriaElements.step2.classList.add('hidden');
    auditoriaElements.step3.classList.add('hidden');
    auditoriaElements.progress.classList.add('hidden');
    auditoriaElements.result.classList.add('hidden');

    // Mostrar botones correctos
    auditoriaElements.btnCancelar.classList.remove('hidden');
    auditoriaElements.btnNext.classList.remove('hidden');
    auditoriaElements.btnBack.classList.add('hidden');
    auditoriaElements.btnEnviarFinal.classList.add('hidden');
    auditoriaElements.btnCerrar.classList.add('hidden');
    auditoriaElements.btnNuevaCuenta.classList.add('hidden');

    // Cargar clientes
    await cargarClientesAuditoria();

    // Pre-seleccionar cliente si ya hay uno seleccionado en el conversor
    if (clienteSeleccionadoId) {
        auditoriaElements.selectCliente.value = clienteSeleccionadoId;
        await cargarCuentasCliente();
    }

    // Detectar período de los movimientos
    detectarPeriodoMovimientos();

    // Actualizar contador de movimientos
    auditoriaElements.movCount.textContent = state.extractedData.length;
}

// Cerrar modal de auditoría
function cerrarModalAuditoria() {
    auditoriaElements.modal.classList.add('hidden');
}

// Cargar clientes para el modal de auditoría
async function cargarClientesAuditoria() {
    const select = auditoriaElements.selectCliente;
    select.innerHTML = '<option value="">-- Cargando clientes... --</option>';

    try {
        let supabaseClient = null;

        if (typeof waitForSupabase === 'function') {
            supabaseClient = await waitForSupabase();
        } else if (typeof supabase !== 'undefined' && supabase) {
            supabaseClient = supabase;
        }

        if (!supabaseClient) {
            select.innerHTML = '<option value="">-- Error: Supabase no disponible --</option>';
            return;
        }

        const { data: clientes, error } = await supabaseClient
            .from('clientes')
            .select('id, razon_social')
            .order('razon_social');

        if (error) throw error;

        auditoriaState.clientes = clientes || [];

        select.innerHTML = '<option value="">-- Seleccione un cliente --</option>' +
            clientes.map(c => `<option value="${c.id}">${c.razon_social}</option>`).join('');

    } catch (error) {
        console.error('Error cargando clientes:', error);
        select.innerHTML = '<option value="">-- Error cargando clientes --</option>';
    }
}

// Cargar cuentas del cliente seleccionado
async function cargarCuentasCliente() {
    const clienteId = auditoriaElements.selectCliente.value;
    const selectCuenta = auditoriaElements.selectCuenta;

    if (!clienteId) {
        selectCuenta.innerHTML = '<option value="">-- Seleccione un cliente primero --</option>';
        selectCuenta.disabled = true;
        auditoriaElements.btnNuevaCuenta.classList.add('hidden');
        return;
    }

    selectCuenta.innerHTML = '<option value="">-- Cargando cuentas... --</option>';
    selectCuenta.disabled = true;

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;

        if (!supabaseClient) {
            selectCuenta.innerHTML = '<option value="">-- Error: Supabase no disponible --</option>';
            return;
        }

        const { data: cuentas, error } = await supabaseClient
            .from('cuentas_bancarias')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('banco');

        if (error) throw error;

        auditoriaState.cuentas = cuentas || [];

        if (cuentas.length === 0) {
            selectCuenta.innerHTML = '<option value="">-- No hay cuentas configuradas --</option>';
        } else {
            selectCuenta.innerHTML = '<option value="">-- Seleccione una cuenta --</option>' +
                cuentas.map(c => {
                    const label = `${c.banco} - ${c.tipo_cuenta}${c.numero_cuenta ? ` (${c.numero_cuenta})` : ''}`;
                    return `<option value="${c.id}">${label}</option>`;
                }).join('');
        }

        selectCuenta.disabled = false;
        auditoriaElements.btnNuevaCuenta.classList.remove('hidden');

    } catch (error) {
        console.error('Error cargando cuentas:', error);
        selectCuenta.innerHTML = '<option value="">-- Error cargando cuentas --</option>';
    }
}

// Detectar período de los movimientos
function detectarPeriodoMovimientos() {
    if (state.extractedData.length === 0) return;

    // Intentar extraer mes/año de las fechas
    const fechas = state.extractedData.map(m => {
        const fecha = m.fecha || '';
        const parts = fecha.split('/');
        if (parts.length >= 2) {
            return {
                dia: parseInt(parts[0]),
                mes: parseInt(parts[1]),
                anio: parts[2] ? parseInt(parts[2]) : new Date().getFullYear()
            };
        }
        return null;
    }).filter(f => f !== null);

    if (fechas.length > 0) {
        // Encontrar el mes más frecuente
        const mesesCount = {};
        fechas.forEach(f => {
            const key = `${f.mes}-${f.anio}`;
            mesesCount[key] = (mesesCount[key] || 0) + 1;
        });

        const mesMax = Object.entries(mesesCount)
            .sort((a, b) => b[1] - a[1])[0];

        if (mesMax) {
            const [mesPeriodo, anioPeriodo] = mesMax[0].split('-').map(Number);
            auditoriaElements.selectMes.value = mesPeriodo;

            // Llenar años
            const anioActual = new Date().getFullYear();
            let anioFinal = anioPeriodo;

            // Corregir año de 2 dígitos
            if (anioFinal < 100) {
                anioFinal = anioFinal < 50 ? 2000 + anioFinal : 1900 + anioFinal;
            }

            auditoriaElements.selectAnio.innerHTML = '';
            for (let a = anioActual + 1; a >= anioActual - 5; a--) {
                const selected = a === anioFinal ? 'selected' : '';
                auditoriaElements.selectAnio.innerHTML += `<option value="${a}" ${selected}>${a}</option>`;
            }
        }
    } else {
        // Por defecto usar mes/año actual
        const hoy = new Date();
        auditoriaElements.selectMes.value = hoy.getMonth() + 1;

        const anioActual = hoy.getFullYear();
        auditoriaElements.selectAnio.innerHTML = '';
        for (let a = anioActual + 1; a >= anioActual - 5; a--) {
            const selected = a === anioActual ? 'selected' : '';
            auditoriaElements.selectAnio.innerHTML += `<option value="${a}" ${selected}>${a}</option>`;
        }
    }
}

// Verificar si existe extracto para el período
async function verificarPeriodoAuditoria() {
    const clienteId = auditoriaElements.selectCliente.value;
    const cuentaId = auditoriaElements.selectCuenta.value;
    const mes = parseInt(auditoriaElements.selectMes.value);
    const anio = parseInt(auditoriaElements.selectAnio.value);

    // Validaciones
    if (!clienteId) {
        showError('Por favor seleccione un cliente');
        return;
    }

    if (!cuentaId) {
        showError('Por favor seleccione una cuenta bancaria');
        return;
    }

    // Mostrar progreso
    auditoriaElements.step1.classList.add('hidden');
    auditoriaElements.progress.classList.remove('hidden');
    document.getElementById('auditoriaProgressText').textContent = 'Verificando período...';

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;

        if (!supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        // Verificar si existe extracto para ese período
        const { data: existente, error } = await supabaseClient
            .from('extractos_mensuales')
            .select('id, data')
            .eq('cuenta_id', cuentaId)
            .eq('mes', mes)
            .eq('anio', anio)
            .single();

        auditoriaElements.progress.classList.add('hidden');

        if (existente && !error) {
            // Ya existe - mostrar paso 2 con advertencia
            auditoriaState.existeExtracto = true;
            auditoriaState.extractoExistente = existente;

            const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

            auditoriaElements.existingCount.textContent = existente.data?.length || 0;
            auditoriaElements.periodoExistente.textContent = `${meses[mes]} ${anio}`;

            auditoriaElements.step2.classList.remove('hidden');
            auditoriaElements.btnNext.classList.add('hidden');
            auditoriaElements.btnBack.classList.remove('hidden');
            auditoriaElements.btnEnviarFinal.classList.remove('hidden');

            auditoriaState.currentStep = 2;
        } else {
            // No existe - enviar directamente
            auditoriaState.existeExtracto = false;
            auditoriaState.extractoExistente = null;
            await enviarMovimientosAuditoria();
        }

    } catch (error) {
        console.error('Error verificando período:', error);
        auditoriaElements.progress.classList.add('hidden');
        auditoriaElements.step1.classList.remove('hidden');

        // Si es error de "no encontrado", significa que no existe el extracto
        if (error.code === 'PGRST116') {
            auditoriaState.existeExtracto = false;
            auditoriaState.extractoExistente = null;
            await enviarMovimientosAuditoria();
        } else {
            showError('Error al verificar el período: ' + error.message);
        }
    }
}

// Volver al paso anterior
function volverPasoAnterior() {
    if (auditoriaState.creandoCuenta) {
        // Volver de crear cuenta a paso 1
        auditoriaElements.step3.classList.add('hidden');
        auditoriaElements.step1.classList.remove('hidden');
        auditoriaState.creandoCuenta = false;
        auditoriaElements.btnNext.classList.remove('hidden');
        auditoriaElements.btnEnviarFinal.classList.add('hidden');
        auditoriaElements.btnBack.classList.add('hidden');
    } else if (auditoriaState.currentStep === 2) {
        // Volver de advertencia a paso 1
        auditoriaElements.step2.classList.add('hidden');
        auditoriaElements.step1.classList.remove('hidden');
        auditoriaElements.btnNext.classList.remove('hidden');
        auditoriaElements.btnBack.classList.add('hidden');
        auditoriaElements.btnEnviarFinal.classList.add('hidden');
        auditoriaState.currentStep = 1;
    }
}

// Mostrar formulario para nueva cuenta
function mostrarFormularioNuevaCuenta() {
    auditoriaState.creandoCuenta = true;

    auditoriaElements.step1.classList.add('hidden');
    auditoriaElements.step3.classList.remove('hidden');

    auditoriaElements.btnNext.classList.add('hidden');
    auditoriaElements.btnBack.classList.remove('hidden');
    auditoriaElements.btnEnviarFinal.textContent = 'Crear cuenta';
    auditoriaElements.btnEnviarFinal.classList.remove('hidden');

    // Limpiar formulario
    document.getElementById('nuevaCuentaBanco').value = '';
    document.getElementById('nuevaCuentaTipo').value = 'Cuenta Corriente';
    document.getElementById('nuevaCuentaNumero').value = '';
    document.getElementById('nuevaCuentaAlias').value = '';

    // Pre-llenar banco si conocemos el banco del extracto
    if (state.selectedBank) {
        const bancoNames = {
            'galicia': 'Banco Galicia',
            'bbva': 'Banco BBVA',
            'bpn': 'BPN (Banco Provincia Neuquén)',
            'santander': 'Banco Santander',
            'macro': 'Banco Macro',
            'nacion': 'Banco Nación',
            'lapampa': 'Banco de La Pampa'
        };
        document.getElementById('nuevaCuentaBanco').value = bancoNames[state.selectedBank] || '';
    }
}

// Enviar movimientos a auditoría
async function enviarMovimientosAuditoria() {
    // Si estamos creando cuenta, primero crear la cuenta
    if (auditoriaState.creandoCuenta) {
        await crearNuevaCuentaYEnviar();
        return;
    }

    const cuentaId = auditoriaElements.selectCuenta.value;
    const mes = parseInt(auditoriaElements.selectMes.value);
    const anio = parseInt(auditoriaElements.selectAnio.value);

    // Obtener acción seleccionada si existe extracto
    let accion = 'replace';
    if (auditoriaState.existeExtracto) {
        const accionRadio = document.querySelector('input[name="auditoriaAction"]:checked');
        accion = accionRadio ? accionRadio.value : 'replace';

        if (accion === 'cancel') {
            cerrarModalAuditoria();
            return;
        }
    }

    // Mostrar progreso
    auditoriaElements.step1.classList.add('hidden');
    auditoriaElements.step2.classList.add('hidden');
    auditoriaElements.progress.classList.remove('hidden');
    document.getElementById('auditoriaProgressText').textContent = 'Enviando movimientos...';

    auditoriaElements.btnCancelar.classList.add('hidden');
    auditoriaElements.btnBack.classList.add('hidden');
    auditoriaElements.btnNext.classList.add('hidden');
    auditoriaElements.btnEnviarFinal.classList.add('hidden');

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;

        if (!supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        // Preparar datos de movimientos
        const movimientosParaEnviar = state.extractedData.map((mov, idx) => ({
            id: idx + 1,
            fecha: mov.fecha,
            descripcion: mov.descripcion,
            origen: mov.origen || '',
            credito: parseArgentineNumber(mov.credito),
            debito: parseArgentineNumber(mov.debito),
            saldo: parseArgentineNumber(mov.saldo),
            categoria: '',
            notas: ''
        }));

        let datosFinales = movimientosParaEnviar;

        // Si hay que combinar con datos existentes
        if (auditoriaState.existeExtracto && accion === 'merge') {
            const existentes = auditoriaState.extractoExistente.data || [];
            // Asignar IDs únicos a los nuevos
            const maxId = existentes.length > 0 ? Math.max(...existentes.map(m => m.id || 0)) : 0;
            movimientosParaEnviar.forEach((m, idx) => {
                m.id = maxId + idx + 1;
            });
            datosFinales = [...existentes, ...movimientosParaEnviar];
        }

        // Eliminar extracto existente si existe
        if (auditoriaState.existeExtracto && accion === 'replace') {
            await supabaseClient
                .from('extractos_mensuales')
                .delete()
                .eq('id', auditoriaState.extractoExistente.id);
        }

        // Insertar o actualizar
        if (auditoriaState.existeExtracto && accion === 'merge') {
            const { error } = await supabaseClient
                .from('extractos_mensuales')
                .update({
                    data: datosFinales,
                    updated_at: new Date().toISOString()
                })
                .eq('id', auditoriaState.extractoExistente.id);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('extractos_mensuales')
                .insert([{
                    cuenta_id: cuentaId,
                    mes: mes,
                    anio: anio,
                    data: datosFinales
                }]);

            if (error) throw error;
        }

        // Mostrar resultado exitoso
        auditoriaElements.progress.classList.add('hidden');
        auditoriaElements.result.classList.remove('hidden');
        auditoriaElements.result.classList.remove('error');
        auditoriaElements.result.classList.add('success');

        document.getElementById('auditoriaResultTitle').textContent = '¡Movimientos enviados correctamente!';
        document.getElementById('auditoriaResultMessage').textContent =
            `Se enviaron ${movimientosParaEnviar.length} movimientos a la herramienta de Auditoría.`;

        auditoriaElements.btnCerrar.classList.remove('hidden');

    } catch (error) {
        console.error('Error enviando movimientos:', error);

        auditoriaElements.progress.classList.add('hidden');
        auditoriaElements.result.classList.remove('hidden');
        auditoriaElements.result.classList.remove('success');
        auditoriaElements.result.classList.add('error');

        document.getElementById('auditoriaResultTitle').textContent = 'Error al enviar movimientos';
        document.getElementById('auditoriaResultMessage').textContent = error.message;

        auditoriaElements.btnCerrar.classList.remove('hidden');
    }
}

// Crear nueva cuenta y enviar movimientos
async function crearNuevaCuentaYEnviar() {
    const clienteId = auditoriaElements.selectCliente.value;
    const banco = document.getElementById('nuevaCuentaBanco').value.trim();
    const tipo = document.getElementById('nuevaCuentaTipo').value;
    const numero = document.getElementById('nuevaCuentaNumero').value.trim();
    const alias = document.getElementById('nuevaCuentaAlias').value.trim();

    if (!banco) {
        showError('El nombre del banco es obligatorio');
        return;
    }

    // Mostrar progreso
    auditoriaElements.step3.classList.add('hidden');
    auditoriaElements.progress.classList.remove('hidden');
    document.getElementById('auditoriaProgressText').textContent = 'Creando cuenta bancaria...';

    auditoriaElements.btnCancelar.classList.add('hidden');
    auditoriaElements.btnBack.classList.add('hidden');
    auditoriaElements.btnEnviarFinal.classList.add('hidden');

    try {
        let supabaseClient = typeof supabase !== 'undefined' ? supabase : null;

        if (!supabaseClient) {
            throw new Error('Supabase no disponible');
        }

        // Crear cuenta
        const { data: nuevaCuenta, error: errorCuenta } = await supabaseClient
            .from('cuentas_bancarias')
            .insert([{
                cliente_id: clienteId,
                banco: banco,
                tipo_cuenta: tipo,
                numero_cuenta: numero,
                alias: alias
            }])
            .select()
            .single();

        if (errorCuenta) throw errorCuenta;

        // Actualizar selección de cuenta
        auditoriaElements.selectCuenta.value = nuevaCuenta.id;
        auditoriaState.creandoCuenta = false;

        document.getElementById('auditoriaProgressText').textContent = 'Enviando movimientos...';

        // Ahora enviar los movimientos
        const mes = parseInt(auditoriaElements.selectMes.value);
        const anio = parseInt(auditoriaElements.selectAnio.value);

        const movimientosParaEnviar = state.extractedData.map((mov, idx) => ({
            id: idx + 1,
            fecha: mov.fecha,
            descripcion: mov.descripcion,
            origen: mov.origen || '',
            credito: parseArgentineNumber(mov.credito),
            debito: parseArgentineNumber(mov.debito),
            saldo: parseArgentineNumber(mov.saldo),
            categoria: '',
            notas: ''
        }));

        const { error: errorExtracto } = await supabaseClient
            .from('extractos_mensuales')
            .insert([{
                cuenta_id: nuevaCuenta.id,
                mes: mes,
                anio: anio,
                data: movimientosParaEnviar
            }]);

        if (errorExtracto) throw errorExtracto;

        // Mostrar resultado exitoso
        auditoriaElements.progress.classList.add('hidden');
        auditoriaElements.result.classList.remove('hidden');
        auditoriaElements.result.classList.remove('error');
        auditoriaElements.result.classList.add('success');

        document.getElementById('auditoriaResultTitle').textContent = '¡Cuenta creada y movimientos enviados!';
        document.getElementById('auditoriaResultMessage').textContent =
            `Se creó la cuenta "${banco} - ${tipo}" y se enviaron ${movimientosParaEnviar.length} movimientos.`;

        auditoriaElements.btnCerrar.classList.remove('hidden');

    } catch (error) {
        console.error('Error creando cuenta:', error);

        auditoriaElements.progress.classList.add('hidden');
        auditoriaElements.result.classList.remove('hidden');
        auditoriaElements.result.classList.remove('success');
        auditoriaElements.result.classList.add('error');

        document.getElementById('auditoriaResultTitle').textContent = 'Error al crear cuenta';
        document.getElementById('auditoriaResultMessage').textContent = error.message;

        auditoriaElements.btnCerrar.classList.remove('hidden');
    }
}
