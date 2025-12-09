// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
const state = {
    file: null,              // Archivo cargado
    rawData: [],             // Datos crudos del Excel
    asientos: [],            // Asientos agrupados por número
    groups: [],              // Grupos detectados por descripción
    selectedGroup: null,     // Grupo seleccionado
    filteredData: [],        // Datos filtrados
    availableYears: [],      // Años disponibles en los datos
    step: 1
};

// Nombres de meses para el nombre del archivo
const MONTH_NAMES = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const elements = {};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Capturar elementos del DOM
    elements.uploadZone = document.getElementById('uploadZone');
    elements.fileInput = document.getElementById('fileInput');
    elements.btnSelectFile = document.getElementById('btnSelectFile');
    elements.fileInfoContainer = document.getElementById('fileInfoContainer');
    elements.fileName = document.getElementById('fileName');
    elements.fileStats = document.getElementById('fileStats');
    elements.btnRemoveFile = document.getElementById('btnRemoveFile');
    elements.btnReset = document.getElementById('btnReset');

    elements.step1 = document.getElementById('step1');
    elements.step2 = document.getElementById('step2');
    elements.step3 = document.getElementById('step3');

    elements.totalAsientos = document.getElementById('totalAsientos');
    elements.totalLineas = document.getElementById('totalLineas');
    elements.totalGrupos = document.getElementById('totalGrupos');
    elements.groupsList = document.getElementById('groupsList');
    elements.filterMonth = document.getElementById('filterMonth');
    elements.filterYear = document.getElementById('filterYear');
    elements.filterResult = document.getElementById('filterResult');
    elements.filteredCount = document.getElementById('filteredCount');
    elements.filteredLines = document.getElementById('filteredLines');
    elements.btnBackToUpload = document.getElementById('btnBackToUpload');
    elements.btnPreview = document.getElementById('btnPreview');

    elements.finalStats = document.getElementById('finalStats');
    elements.outputFilename = document.getElementById('outputFilename');
    elements.previewTableBody = document.getElementById('previewTableBody');
    elements.btnBackToFilters = document.getElementById('btnBackToFilters');
    elements.btnDownloadExcel = document.getElementById('btnDownloadExcel');

    // Configurar eventos
    setupEventListeners();
});

// ============================================
// CONFIGURACIÓN DE EVENTOS
// ============================================
function setupEventListeners() {
    // Zona de drag & drop
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    // Selección de archivo
    elements.btnSelectFile.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Eliminar archivo
    elements.btnRemoveFile.addEventListener('click', removeFile);

    // Filtros
    elements.filterMonth.addEventListener('change', updateFilters);
    elements.filterYear.addEventListener('change', updateFilters);

    // Navegación
    elements.btnReset.addEventListener('click', resetApp);
    elements.btnBackToUpload.addEventListener('click', () => {
        removeFile();
        showStep(1);
    });
    elements.btnPreview.addEventListener('click', () => {
        applyFilters();
        showStep(3);
        renderPreview();
    });
    elements.btnBackToFilters.addEventListener('click', () => showStep(2));
    elements.btnDownloadExcel.addEventListener('click', downloadExcel);
}

// ============================================
// DRAG & DROP
// ============================================
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f =>
        f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    if (files.length > 0) {
        processFile(files[0]);
    }
}

// ============================================
// SELECCIÓN DE ARCHIVO
// ============================================
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        processFile(files[0]);
    }
    e.target.value = '';
}

// ============================================
// PROCESAMIENTO DEL ARCHIVO
// ============================================
async function processFile(file) {
    showProgress('Cargando archivo Excel', file.name);
    updateProgress(10, formatFileSize(file.size));

    // Pequeña pausa para que se muestre el modal
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        updateProgressText('Leyendo archivo', 'Analizando contenido...');
        updateProgress(20);

        const data = await readExcelFile(file);

        if (data && data.length > 0) {
            updateProgress(40, `${data.length} filas encontradas`);
            updateProgressText('Procesando datos', 'Validando estructura...');
            await new Promise(resolve => setTimeout(resolve, 100));

            state.file = {
                name: file.name,
                size: file.size,
                rowCount: data.length
            };
            state.rawData = data;

            // Procesar y agrupar datos
            updateProgress(60, 'Agrupando asientos...');
            updateProgressText('Analizando asientos', 'Detectando grupos...');
            await new Promise(resolve => setTimeout(resolve, 100));

            processData();

            updateProgress(80, `${state.groups.length} tipos detectados`);
            updateProgressText('Finalizando', 'Preparando vista...');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mostrar info del archivo y pasar al paso 2
            updateFileInfo();
            renderGroups();
            updateSummary();
            populateYears();

            updateProgress(100, '¡Archivo procesado!');
            updateProgressText('¡Listo!', 'Archivo cargado correctamente');

            await new Promise(resolve => setTimeout(resolve, 500));
            hideProgress();

            showStep(2);
        }
    } catch (error) {
        console.error('Error al procesar archivo:', error);
        hideProgress();
        alert(`Error al procesar el archivo: ${error.message}`);
    }
}

// ============================================
// LECTURA DE ARCHIVOS EXCEL
// ============================================
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (jsonData.length === 0) {
                    reject(new Error('El archivo está vacío o no tiene el formato esperado'));
                    return;
                }

                // Validar columnas esperadas
                const expectedColumns = ['Fecha', 'Numero', 'Cuenta', 'Debe', 'Haber', 'Leyenda'];
                const firstRow = jsonData[0];
                const hasExpectedColumns = expectedColumns.some(col => col in firstRow);

                if (!hasExpectedColumns) {
                    reject(new Error('El archivo no tiene el formato esperado de asientos contables'));
                    return;
                }

                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

// ============================================
// PROCESAMIENTO DE DATOS
// ============================================
function processData() {
    // Agrupar líneas por número de asiento
    const asientosMap = new Map();

    state.rawData.forEach(row => {
        const key = `${row.Fecha}_${row.Numero}`;
        if (!asientosMap.has(key)) {
            asientosMap.set(key, {
                fecha: row.Fecha,
                numero: row.Numero,
                lineas: [],
                leyendas: []
            });
        }
        const asiento = asientosMap.get(key);
        asiento.lineas.push(row);
        if (row.Leyenda && !asiento.leyendas.includes(row.Leyenda)) {
            asiento.leyendas.push(row.Leyenda);
        }
    });

    state.asientos = Array.from(asientosMap.values());

    // Detectar grupos por descripción
    detectGroups();
}

// ============================================
// DETECCIÓN DE GRUPOS POR DESCRIPCIÓN
// ============================================
function detectGroups() {
    const groupsMap = new Map();

    state.asientos.forEach(asiento => {
        // Obtener la leyenda principal del asiento
        const leyendaPrincipal = asiento.leyendas[0] || '';

        // Normalizar y extraer el patrón base
        const groupKey = extractGroupPattern(leyendaPrincipal);

        if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
                key: groupKey,
                name: getGroupDisplayName(groupKey, leyendaPrincipal),
                asientos: [],
                lineCount: 0
            });
        }

        const group = groupsMap.get(groupKey);
        group.asientos.push(asiento);
        group.lineCount += asiento.lineas.length;
    });

    // Convertir a array y ordenar por cantidad de asientos (mayor primero)
    state.groups = Array.from(groupsMap.values())
        .sort((a, b) => b.asientos.length - a.asientos.length);
}

// ============================================
// EXTRACCIÓN DE PATRÓN DE GRUPO
// ============================================
function extractGroupPattern(leyenda) {
    if (!leyenda) return 'SIN_LEYENDA';

    let normalized = String(leyenda).trim().toLowerCase();

    // REGLA ESTRICTA: Si contiene "venta según" o "ventas según", agrupar todo junto
    if (normalized.includes('venta según') || normalized.includes('ventas según') ||
        normalized.includes('venta segun') || normalized.includes('ventas segun')) {
        return 'VENTAS_SEGUN_COMPROBANTE';
    }

    // REGLA ESTRICTA: Si contiene "compra según" o "compras según", agrupar todo junto
    if (normalized.includes('compra según') || normalized.includes('compras según') ||
        normalized.includes('compra segun') || normalized.includes('compras segun')) {
        return 'COMPRAS_SEGUN_COMPROBANTE';
    }

    // Para otros casos, usar normalización general
    normalized = String(leyenda).trim();

    // Remover datos variables comunes
    // - Números de comprobante (ej: 00001-00012345)
    normalized = normalized.replace(/\d{4,5}-\d{5,8}/g, '');
    // - Fechas en formato DD/MM/YYYY o DD-MM-YYYY
    normalized = normalized.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '');
    // - Números largos (más de 5 dígitos)
    normalized = normalized.replace(/\d{6,}/g, '');
    // - Montos con decimales
    normalized = normalized.replace(/\d+[.,]\d{2}/g, '');
    // - Números de referencia (REF: xxxx)
    normalized = normalized.replace(/REF:?\s*\d+/gi, '');
    // - Espacios múltiples
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Extraer las primeras 2 palabras significativas para agrupar
    // Lógica: si dos asientos tienen la misma combinación de 2 palabras, se agrupan
    const words = normalized.split(' ')
        .filter(w => w.length > 2)
        .filter(w => !['del', 'de', 'la', 'el', 'los', 'las', 'por', 'para', 'con', 'sin', 'que'].includes(w.toLowerCase()))
        .slice(0, 2);

    if (words.length === 0) {
        // Si no hay palabras significativas, usar las primeras 30 caracteres
        return leyenda.substring(0, 30).trim().toUpperCase() || 'SIN_LEYENDA';
    }

    return words.join(' ').toUpperCase();
}

// ============================================
// NOMBRE PARA MOSTRAR DEL GRUPO
// ============================================
function getGroupDisplayName(key, originalLeyenda) {
    if (key === 'SIN_LEYENDA') return 'Sin leyenda';

    // Keys unificados específicos
    if (key === 'VENTAS_SEGUN_COMPROBANTE') {
        return 'Ventas (según comprobante)';
    }
    if (key === 'COMPRAS_SEGUN_COMPROBANTE') {
        return 'Compras (según comprobante)';
    }

    // Buscar patrones comunes y dar nombres amigables
    const keyLower = key.toLowerCase();

    if (keyLower.includes('venta') && keyLower.includes('comprobante')) {
        return 'Ventas (según comprobante)';
    }
    if (keyLower.includes('compra') && keyLower.includes('comprobante')) {
        return 'Compras (según comprobante)';
    }
    if (keyLower.includes('pago') && keyLower.includes('vep')) {
        return 'Pagos VEP ARCA';
    }
    if (keyLower.includes('cobro') || keyLower.includes('cobranza')) {
        return 'Cobranzas';
    }
    if (keyLower.includes('transferencia')) {
        return 'Transferencias bancarias';
    }
    if (keyLower.includes('cheque')) {
        return 'Cheques';
    }
    if (keyLower.includes('debito') && keyLower.includes('automatico')) {
        return 'Débitos automáticos';
    }
    if (keyLower.includes('deposito')) {
        return 'Depósitos';
    }
    if (keyLower.includes('extraccion') || keyLower.includes('retiro')) {
        return 'Extracciones/Retiros';
    }
    if (keyLower.includes('comision')) {
        return 'Comisiones bancarias';
    }
    if (keyLower.includes('impuesto') || keyLower.includes('iva') || keyLower.includes('iibb')) {
        return 'Impuestos';
    }
    if (keyLower.includes('sueldo') || keyLower.includes('salario') || keyLower.includes('jornales')) {
        return 'Sueldos y jornales';
    }
    if (keyLower.includes('honorario')) {
        return 'Honorarios';
    }
    if (keyLower.includes('alquiler')) {
        return 'Alquileres';
    }
    if (keyLower.includes('servicio')) {
        return 'Servicios';
    }

    // Si no hay patrón reconocido, usar el key formateado
    return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

// ============================================
// UI: ACTUALIZAR INFO DEL ARCHIVO
// ============================================
function updateFileInfo() {
    elements.fileName.textContent = state.file.name;
    elements.fileStats.textContent = `${state.file.rowCount} filas • ${formatFileSize(state.file.size)}`;
    elements.fileInfoContainer.classList.remove('hidden');
    elements.uploadZone.classList.add('hidden');
    elements.btnReset.classList.remove('hidden');
}

// ============================================
// UI: ACTUALIZAR RESUMEN
// ============================================
function updateSummary() {
    elements.totalAsientos.textContent = state.asientos.length;
    elements.totalLineas.textContent = state.rawData.length;
    elements.totalGrupos.textContent = state.groups.length;
}

// ============================================
// UI: RENDERIZAR GRUPOS
// ============================================
function renderGroups() {
    elements.groupsList.innerHTML = state.groups.map((group, index) => `
        <label class="group-item ${state.selectedGroup === group.key ? 'selected' : ''}" data-key="${escapeHtml(group.key)}">
            <input type="radio" name="group" value="${escapeHtml(group.key)}" ${state.selectedGroup === group.key ? 'checked' : ''}>
            <div class="group-radio"></div>
            <div class="group-info">
                <div class="group-name">${escapeHtml(group.name)}</div>
                <div class="group-count">${group.asientos.length} asientos • ${group.lineCount} líneas</div>
            </div>
            <span class="group-badge">${group.asientos.length}</span>
        </label>
    `).join('');

    // Agregar eventos a los grupos
    document.querySelectorAll('.group-item').forEach(item => {
        item.addEventListener('click', () => {
            selectGroup(item.dataset.key);
        });
    });
}

// ============================================
// SELECCIONAR GRUPO
// ============================================
function selectGroup(key) {
    state.selectedGroup = key;

    // Actualizar UI
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.key === key);
        item.querySelector('input').checked = item.dataset.key === key;
    });

    updateFilters();
}

// ============================================
// POBLAR AÑOS DISPONIBLES
// ============================================
function populateYears() {
    const years = new Set();

    state.asientos.forEach(asiento => {
        const date = parseDate(asiento.fecha);
        if (date) {
            years.add(date.getFullYear());
        }
    });

    state.availableYears = Array.from(years).sort((a, b) => b - a);

    elements.filterYear.innerHTML = '<option value="">Todos los años</option>' +
        state.availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
}

// ============================================
// ACTUALIZAR FILTROS
// ============================================
function updateFilters() {
    if (!state.selectedGroup) {
        elements.filterResult.classList.add('hidden');
        elements.btnPreview.disabled = true;
        return;
    }

    const month = elements.filterMonth.value;
    const year = elements.filterYear.value;

    // Filtrar asientos
    const group = state.groups.find(g => g.key === state.selectedGroup);
    if (!group) return;

    let filtered = group.asientos;

    // Filtrar por mes y año
    if (month || year) {
        filtered = filtered.filter(asiento => {
            const date = parseDate(asiento.fecha);
            if (!date) return false;

            if (month && date.getMonth() + 1 !== parseInt(month)) return false;
            if (year && date.getFullYear() !== parseInt(year)) return false;

            return true;
        });
    }

    // Actualizar UI
    const totalLines = filtered.reduce((sum, a) => sum + a.lineas.length, 0);
    elements.filteredCount.textContent = filtered.length;
    elements.filteredLines.textContent = totalLines;
    elements.filterResult.classList.remove('hidden');
    elements.btnPreview.disabled = filtered.length === 0;

    // Actualizar nombre sugerido del archivo
    updateSuggestedFilename(group.name, month, year);
}

// ============================================
// ACTUALIZAR NOMBRE SUGERIDO
// ============================================
function updateSuggestedFilename(groupName, month, year) {
    let parts = [];

    // Nombre del grupo simplificado
    const simpleName = groupName
        .toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remover paréntesis y su contenido
        .trim()
        .split(' ')
        .slice(0, 2)
        .join(' ');

    parts.push(simpleName);

    if (month) {
        parts.push(MONTH_NAMES[parseInt(month)]);
    }

    if (year) {
        parts.push(year);
    }

    elements.outputFilename.value = parts.join(' ');
}

// ============================================
// APLICAR FILTROS Y GENERAR DATOS FINALES
// ============================================
function applyFilters() {
    const month = elements.filterMonth.value;
    const year = elements.filterYear.value;

    const group = state.groups.find(g => g.key === state.selectedGroup);
    if (!group) return;

    let filtered = group.asientos;

    // Filtrar por mes y año
    if (month || year) {
        filtered = filtered.filter(asiento => {
            const date = parseDate(asiento.fecha);
            if (!date) return false;

            if (month && date.getMonth() + 1 !== parseInt(month)) return false;
            if (year && date.getFullYear() !== parseInt(year)) return false;

            return true;
        });
    }

    // Aplanar a líneas individuales y renumerar
    state.filteredData = [];
    let nuevoNumero = 1;

    filtered.forEach(asiento => {
        asiento.lineas.forEach(linea => {
            state.filteredData.push({
                ...linea,
                Numero: nuevoNumero
            });
        });
        nuevoNumero++;
    });
}

// ============================================
// RENDERIZAR VISTA PREVIA
// ============================================
function renderPreview() {
    const data = state.filteredData;
    const previewData = data.slice(0, 50);

    // Estadísticas
    const totalLineas = data.length;
    const totalAsientos = new Set(data.map(r => `${r.Fecha}_${r.Numero}`)).size;
    const totalDebe = data.reduce((sum, r) => sum + (parseFloat(r.Debe) || 0), 0);
    const totalHaber = data.reduce((sum, r) => sum + (parseFloat(r.Haber) || 0), 0);

    elements.finalStats.innerHTML = `
        <strong>${totalAsientos} asientos</strong> •
        ${totalLineas} líneas •
        Debe: ${formatNumber(totalDebe)} •
        Haber: ${formatNumber(totalHaber)}
    `;

    // Tabla
    elements.previewTableBody.innerHTML = previewData.map(row => `
        <tr>
            <td>${escapeHtml(row.Fecha || '')}</td>
            <td class="numero-col">${row.Numero || ''}</td>
            <td class="cuenta-col">${escapeHtml(row.Cuenta || '')}</td>
            <td class="text-right debe-col">${row.Debe ? formatNumber(row.Debe) : ''}</td>
            <td class="text-right haber-col">${row.Haber ? formatNumber(row.Haber) : ''}</td>
            <td class="leyenda-col">${escapeHtml(truncateText(row.Leyenda || '', 50))}</td>
        </tr>
    `).join('');
}

// ============================================
// DESCARGAR EXCEL
// ============================================
function downloadExcel() {
    if (state.filteredData.length === 0) {
        alert('No hay datos para descargar');
        return;
    }

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(state.filteredData);

    // Aplicar formato numérico
    aplicarFormatoNumerico(ws);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asientos');

    // Generar nombre del archivo
    const customName = elements.outputFilename.value.trim() || 'asientos';
    const fileName = `Template ${customName}.xlsx`;

    XLSX.writeFile(wb, fileName);
    console.log('Archivo exportado:', fileName);
}

// ============================================
// FORMATO NUMÉRICO PARA EXCEL
// ============================================
function aplicarFormatoNumerico(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const numericColumns = ['Debe', 'Haber', 'Importe'];
    const headers = [];

    for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        const cell = ws[cellAddress];
        headers[C] = cell ? cell.v : '';
    }

    for (let R = range.s.r + 1; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            if (numericColumns.includes(headers[C])) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress];
                if (cell && typeof cell.v === 'number') {
                    cell.z = '#,##0.00';
                }
            }
        }
    }
}

// ============================================
// NAVEGACIÓN
// ============================================
function showStep(stepNumber) {
    state.step = stepNumber;

    elements.step1.classList.toggle('hidden', stepNumber !== 1);
    elements.step2.classList.toggle('hidden', stepNumber !== 2);
    elements.step3.classList.toggle('hidden', stepNumber !== 3);
}

function removeFile() {
    state.file = null;
    state.rawData = [];
    state.asientos = [];
    state.groups = [];
    state.selectedGroup = null;
    state.filteredData = [];

    elements.fileInfoContainer.classList.add('hidden');
    elements.uploadZone.classList.remove('hidden');
    elements.btnReset.classList.add('hidden');
    elements.filterMonth.value = '';
    elements.filterYear.value = '';
    elements.filterResult.classList.add('hidden');
    elements.btnPreview.disabled = true;
}

function resetApp() {
    if (state.file && !confirm('¿Iniciar una nueva segmentación? Se perderán los datos actuales.')) {
        return;
    }

    removeFile();
    showStep(1);
}

// ============================================
// UTILIDADES
// ============================================
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Si es un número (fecha serial de Excel)
    if (typeof dateStr === 'number') {
        // Excel usa días desde 1/1/1900, pero tiene un bug: considera 1900 como año bisiesto
        // Días desde 1/1/1900 en Excel = serial
        // Convertir a JavaScript: restar 25569 días (diferencia entre epoch de Excel y Unix) y multiplicar por 86400000 ms
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch con corrección del bug
        const date = new Date(excelEpoch.getTime() + dateStr * 86400000);
        return isNaN(date.getTime()) ? null : date;
    }

    // Formato DD/MM/YYYY
    const match = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
    }

    // Formato DD-MM-YYYY
    const matchDash = String(dateStr).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (matchDash) {
        const [, day, month, year] = matchDash;
        return new Date(year, month - 1, day);
    }

    // Intentar parseo directo como último recurso
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatNumber(num) {
    if (num === null || num === undefined || num === '') return '';
    const number = parseFloat(num);
    if (isNaN(number)) return num;
    return number.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// BARRA DE PROGRESO
// ============================================
const progressElements = {};

function initProgressElements() {
    progressElements.overlay = document.getElementById('progressOverlay');
    progressElements.title = document.getElementById('progressTitle');
    progressElements.subtitle = document.getElementById('progressSubtitle');
    progressElements.bar = document.getElementById('progressBar');
    progressElements.percentage = document.getElementById('progressPercentage');
    progressElements.fileInfo = document.getElementById('progressFileInfo');
}

function showProgress(title = 'Procesando...', subtitle = 'Por favor espera') {
    if (!progressElements.overlay) initProgressElements();

    progressElements.title.textContent = title;
    progressElements.subtitle.textContent = subtitle;
    progressElements.bar.style.width = '0%';
    progressElements.percentage.textContent = '0%';
    progressElements.fileInfo.textContent = '';
    progressElements.overlay.classList.remove('hidden');
}

function updateProgress(percent, fileInfo = '') {
    if (!progressElements.overlay) return;

    const clampedPercent = Math.min(100, Math.max(0, percent));
    progressElements.bar.style.width = `${clampedPercent}%`;
    progressElements.percentage.textContent = `${Math.round(clampedPercent)}%`;
    if (fileInfo) {
        progressElements.fileInfo.textContent = fileInfo;
    }
}

function updateProgressText(title, subtitle) {
    if (!progressElements.overlay) return;

    if (title) progressElements.title.textContent = title;
    if (subtitle) progressElements.subtitle.textContent = subtitle;
}

function hideProgress() {
    if (!progressElements.overlay) return;
    progressElements.overlay.classList.add('hidden');
}
