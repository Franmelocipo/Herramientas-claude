// Configuración PDF.js
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Cliente seleccionado en este módulo
let clienteSeleccionadoId = null;
let clienteSeleccionadoNombre = '';

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
        // Obtener clientes desde Supabase
        const { data: clientes, error } = await supabase
            .from('clientes')
            .select('id, razon_social')
            .order('razon_social');

        if (error) {
            console.error('Error cargando clientes:', error);
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
    { id: 'nacion', name: 'Banco Nación', disabled: true }
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
