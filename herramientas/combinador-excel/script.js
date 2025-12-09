// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
const state = {
    files: [],           // Array de archivos cargados con sus datos
    combinedData: [],    // Datos combinados
    step: 1
};

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
    elements.btnSelectFiles = document.getElementById('btnSelectFiles');
    elements.filesListContainer = document.getElementById('filesListContainer');
    elements.filesList = document.getElementById('filesList');
    elements.filesCount = document.getElementById('filesCount');
    elements.btnAddMore = document.getElementById('btnAddMore');
    elements.btnClearAll = document.getElementById('btnClearAll');
    elements.optionsContainer = document.getElementById('optionsContainer');
    elements.combineSection = document.getElementById('combineSection');
    elements.btnCombine = document.getElementById('btnCombine');
    elements.btnReset = document.getElementById('btnReset');
    elements.step1 = document.getElementById('step1');
    elements.step2 = document.getElementById('step2');
    elements.finalStats = document.getElementById('finalStats');
    elements.previewTableBody = document.getElementById('previewTableBody');
    elements.btnBackToFiles = document.getElementById('btnBackToFiles');
    elements.btnDownloadExcel = document.getElementById('btnDownloadExcel');
    elements.orderByDate = document.getElementById('orderByDate');

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

    // Selección de archivos
    elements.btnSelectFiles.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Gestión de archivos
    elements.btnAddMore.addEventListener('click', () => elements.fileInput.click());
    elements.btnClearAll.addEventListener('click', clearAllFiles);

    // Combinar
    elements.btnCombine.addEventListener('click', combineFiles);

    // Navegación
    elements.btnReset.addEventListener('click', resetApp);
    elements.btnBackToFiles.addEventListener('click', () => showStep(1));
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
        processFiles(files);
    }
}

// ============================================
// SELECCIÓN DE ARCHIVOS
// ============================================
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        processFiles(files);
    }
    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
}

// ============================================
// PROCESAMIENTO DE ARCHIVOS
// ============================================
async function processFiles(files) {
    for (const file of files) {
        // Verificar si el archivo ya está cargado
        if (state.files.some(f => f.name === file.name && f.size === file.size)) {
            console.log(`Archivo ${file.name} ya está cargado, omitiendo...`);
            continue;
        }

        try {
            const data = await readExcelFile(file);
            if (data && data.length > 0) {
                state.files.push({
                    name: file.name,
                    size: file.size,
                    data: data,
                    rowCount: data.length
                });
            }
        } catch (error) {
            console.error(`Error al procesar ${file.name}:`, error);
            alert(`Error al procesar ${file.name}: ${error.message}`);
        }
    }

    updateFilesUI();
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

                // Tomar la primera hoja
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convertir a JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (jsonData.length === 0) {
                    reject(new Error('El archivo está vacío o no tiene el formato esperado'));
                    return;
                }

                // Validar que tenga las columnas esperadas
                const expectedColumns = ['Fecha', 'Numero', 'Cuenta', 'Debe', 'Haber'];
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
// ACTUALIZACIÓN DE LA UI
// ============================================
function updateFilesUI() {
    const hasFiles = state.files.length > 0;

    // Mostrar/ocultar contenedores
    elements.filesListContainer.classList.toggle('hidden', !hasFiles);
    elements.optionsContainer.classList.toggle('hidden', state.files.length < 2);
    elements.combineSection.classList.toggle('hidden', state.files.length < 2);
    elements.btnReset.classList.toggle('hidden', !hasFiles);

    // Actualizar contador
    elements.filesCount.textContent = state.files.length;

    // Renderizar lista de archivos
    renderFilesList();
}

function renderFilesList() {
    elements.filesList.innerHTML = state.files.map((file, index) => `
        <div class="file-item" data-index="${index}">
            <div class="file-info">
                <div class="file-icon">📄</div>
                <div class="file-details">
                    <span class="file-name">${escapeHtml(file.name)}</span>
                    <span class="file-stats">${file.rowCount} filas • ${formatFileSize(file.size)}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn-icon btn-move-up" title="Mover arriba" ${index === 0 ? 'disabled' : ''} onclick="moveFile(${index}, -1)">↑</button>
                <button class="btn-icon btn-move-down" title="Mover abajo" ${index === state.files.length - 1 ? 'disabled' : ''} onclick="moveFile(${index}, 1)">↓</button>
                <button class="btn-icon btn-remove" title="Eliminar" onclick="removeFile(${index})">✕</button>
            </div>
        </div>
    `).join('');
}

// ============================================
// GESTIÓN DE ARCHIVOS
// ============================================
function moveFile(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.files.length) return;

    // Intercambiar posiciones
    const temp = state.files[index];
    state.files[index] = state.files[newIndex];
    state.files[newIndex] = temp;

    updateFilesUI();
}

function removeFile(index) {
    state.files.splice(index, 1);
    updateFilesUI();
}

function clearAllFiles() {
    if (state.files.length > 0 && !confirm('¿Eliminar todos los archivos cargados?')) {
        return;
    }
    state.files = [];
    updateFilesUI();
}

// ============================================
// COMBINACIÓN DE ARCHIVOS
// ============================================
function combineFiles() {
    if (state.files.length < 2) {
        alert('Debes cargar al menos 2 archivos para combinar');
        return;
    }

    const numeracionContinua = document.querySelector('input[name="numeracion"]:checked').value === 'continua';
    const ordenarPorFecha = elements.orderByDate.checked;

    // Combinar todos los datos agregando el nombre del archivo origen
    let combined = [];

    state.files.forEach((file) => {
        file.data.forEach(row => {
            combined.push({
                ...row,
                _archivoOrigen: file.name
            });
        });
    });

    // Ordenar por fecha si está habilitado
    if (ordenarPorFecha) {
        combined.sort((a, b) => {
            const dateA = parseDate(a.Fecha);
            const dateB = parseDate(b.Fecha);
            if (dateA && dateB) {
                return dateA - dateB;
            }
            return 0;
        });
    }

    // Renumerar asientos si está habilitado
    if (numeracionContinua) {
        combined = renumerarAsientos(combined);
    }

    state.combinedData = combined;

    // Mostrar vista previa
    showStep(2);
    renderPreview();
}

// ============================================
// RENUMERACIÓN DE ASIENTOS
// ============================================
function renumerarAsientos(data) {
    // Agrupar por fecha y número original para detectar asientos
    const asientos = [];
    let currentAsiento = null;
    let currentKey = null;

    data.forEach((row, index) => {
        const key = `${row.Fecha}_${row.Numero}`;

        if (key !== currentKey) {
            // Nuevo asiento
            if (currentAsiento) {
                asientos.push(currentAsiento);
            }
            currentAsiento = {
                rows: [row],
                fecha: row.Fecha,
                numeroOriginal: row.Numero
            };
            currentKey = key;
        } else {
            // Misma asiento, agregar fila
            currentAsiento.rows.push(row);
        }
    });

    // Agregar el último asiento
    if (currentAsiento) {
        asientos.push(currentAsiento);
    }

    // Renumerar secuencialmente
    let nuevoNumero = 1;
    const result = [];

    asientos.forEach(asiento => {
        asiento.rows.forEach(row => {
            result.push({
                ...row,
                Numero: nuevoNumero
            });
        });
        nuevoNumero++;
    });

    return result;
}

// ============================================
// PARSEO DE FECHAS
// ============================================
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Formato DD/MM/YYYY
    const match = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
    }

    // Intentar parsear como fecha ISO o similar
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

// ============================================
// VISTA PREVIA
// ============================================
function renderPreview() {
    const data = state.combinedData;
    const previewData = data.slice(0, 50);

    // Calcular estadísticas
    const totalFilas = data.length;
    const totalAsientos = new Set(data.map(r => `${r.Fecha}_${r.Numero}`)).size;
    const totalDebe = data.reduce((sum, r) => sum + (parseFloat(r.Debe) || 0), 0);
    const totalHaber = data.reduce((sum, r) => sum + (parseFloat(r.Haber) || 0), 0);

    elements.finalStats.innerHTML = `
        <strong>${state.files.length} archivos combinados</strong> •
        ${totalFilas} líneas •
        ${totalAsientos} asientos •
        Debe: ${formatNumber(totalDebe)} •
        Haber: ${formatNumber(totalHaber)}
    `;

    // Renderizar tabla
    elements.previewTableBody.innerHTML = previewData.map(row => `
        <tr>
            <td>${escapeHtml(row.Fecha || '')}</td>
            <td class="numero-col">${row.Numero || ''}</td>
            <td class="cuenta-col">${escapeHtml(row.Cuenta || '')}</td>
            <td class="text-right debe-col">${row.Debe ? formatNumber(row.Debe) : ''}</td>
            <td class="text-right haber-col">${row.Haber ? formatNumber(row.Haber) : ''}</td>
            <td class="leyenda-col">${escapeHtml(truncateText(row.Leyenda || '', 40))}</td>
            <td class="archivo-col">${escapeHtml(truncateText(row._archivoOrigen || '', 25))}</td>
        </tr>
    `).join('');
}

// ============================================
// DESCARGA DE EXCEL
// ============================================
function downloadExcel() {
    if (state.combinedData.length === 0) {
        alert('No hay datos para descargar');
        return;
    }

    // Preparar datos para exportar (sin el campo interno _archivoOrigen)
    const dataParaExportar = state.combinedData.map(row => {
        const { _archivoOrigen, ...rowLimpia } = row;
        return rowLimpia;
    });

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(dataParaExportar);

    // Aplicar formato a columnas numéricas
    aplicarFormatoNumerico(ws);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asientos Combinados');

    // Generar nombre de archivo
    const fecha = new Date().toISOString().split('T')[0];
    const fileName = `asientos_combinados_${fecha}.xlsx`;

    XLSX.writeFile(wb, fileName);
    console.log('✅ Archivo Excel combinado exportado exitosamente');
}

// ============================================
// FORMATO NUMÉRICO PARA EXCEL
// ============================================
function aplicarFormatoNumerico(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Encontrar columnas numéricas (Debe, Haber, Importe)
    const numericColumns = ['Debe', 'Haber', 'Importe'];
    const headers = [];

    // Leer headers
    for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        const cell = ws[cellAddress];
        headers[C] = cell ? cell.v : '';
    }

    // Aplicar formato a celdas numéricas
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
}

function resetApp() {
    if (state.files.length > 0 && !confirm('¿Iniciar una nueva combinación? Se perderán los archivos cargados.')) {
        return;
    }

    state.files = [];
    state.combinedData = [];
    state.step = 1;

    updateFilesUI();
    showStep(1);
}

// ============================================
// UTILIDADES
// ============================================
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
