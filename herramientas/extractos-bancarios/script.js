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
    { id: 'santander', name: 'Banco Santander' },
    { id: 'nacion', name: 'Banco Nación', disabled: true }
];

const banksInversiones = [
    { id: 'galicia-inversiones', name: 'Galicia Inversiones' }
];

// Elementos DOM
const elements = {
    typeBtns: null,
    stepBank: null,
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
    state.file = null;
    state.extractedData = [];
    state.saldoInicial = null;

    // Actualizar UI
    elements.typeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Mostrar paso de banco
    elements.stepBank.classList.remove('hidden');
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
    state.file = null;
    state.extractedData = [];
    state.saldoInicial = null;

    // Actualizar UI
    document.querySelectorAll('.bank-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bank === bankId);
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
        } else if (state.selectedBank === 'santander') {
            await processSantanderPDF(state.file);
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

// Parsear extracto Santander usando posiciones de columnas
// Estructura: Fecha | Comprobante | Movimiento | DÉBITO | CRÉDITO | Saldo
// Determina débito/crédito por la posición X en el PDF, NO por cambio de saldo
function parseSantanderWithPositions(linesWithPositions) {
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
    // Basado en análisis de PDFs de Santander
    if (!debitoColumnX || !creditoColumnX) {
        // Valores típicos para PDF de Santander
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
            const amountsWithPositions = [];
            for (const item of lineData.items) {
                // Buscar items que sean importes (contienen $ o son números con formato argentino)
                const amountMatch = item.text.match(/^\$?\s*([\d.]+,\d{2})$/);
                if (amountMatch) {
                    amountsWithPositions.push({
                        value: amountMatch[1],
                        x: item.x
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
            descripcion = descripcion.replace(/\$\s*[\d.]+,\d{2}/g, '').trim();

            // Clasificar importes por posición de columna
            let debito = '0';
            let credito = '0';
            let saldo = '0';

            if (amountsWithPositions.length >= 1) {
                // El último siempre es saldo (columna más a la derecha)
                saldo = amountsWithPositions[amountsWithPositions.length - 1].value;
            }

            if (amountsWithPositions.length >= 2) {
                // El penúltimo es el movimiento (débito o crédito)
                const movAmount = amountsWithPositions[amountsWithPositions.length - 2];

                // Clasificar según posición X
                // Si está más cerca de la columna Débito → es débito
                // Si está más cerca de la columna Crédito → es crédito
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
    const filteredMovements = movements
        .filter(mov => !/Saldo Inicial/i.test(mov.descripcion))
        .map(mov => {
            mov.descripcion = mov.descripcion
                .replace(/\s+/g, ' ')
                .replace(/Fecha\s+Comprobante\s+Movimiento\s+D[eé]bito\s+Cr[eé]dito\s+Saldo/gi, '')
                .trim();
            return mov;
        });

    console.log('Movimientos encontrados:', filteredMovements.length);

    return filteredMovements;
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

        // Parsear movimientos usando POSICIONES DE COLUMNAS (no cambio de saldo)
        const movements = parseSantanderWithPositions(linesWithPositions);

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
        const cleaned = value.replace(/\./g, '').replace(',', '.').replace('-', '');
        return parseFloat(cleaned);
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
