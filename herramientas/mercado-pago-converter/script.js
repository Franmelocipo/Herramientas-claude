let selectedFiles = [];
let processedData = null;

// Cliente seleccionado en este módulo
let clienteSeleccionadoId = null;
let clienteSeleccionadoNombre = '';

// Formato seleccionado
let formatoSeleccionado = 'liquidaciones';

const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const errorBox = document.getElementById('errorBox');
const resultCard = document.getElementById('resultCard');
const tableBody = document.getElementById('tableBody');
const resultStats = document.getElementById('resultStats');
const tableFooter = document.getElementById('tableFooter');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');
const clientNameElement = document.getElementById('clientName');

// ============================================
// FUNCIONES PARA SELECTOR DE CLIENTE
// ============================================

async function cargarClientesEnSelector(intentos = 3) {
    const select = document.getElementById('selector-cliente-mp');
    if (!select) return;

    try {
        // Esperar a que Supabase esté disponible usando la función global
        let client = null;

        // Intentar obtener el cliente de Supabase con reintentos
        for (let i = 0; i < intentos; i++) {
            console.log(`🔄 Intento ${i + 1}/${intentos} de conectar con Supabase...`);

            if (typeof waitForSupabase === 'function') {
                client = await waitForSupabase();
            }

            // También verificar window.supabaseDB como fallback
            if (!client && window.supabaseDB) {
                client = window.supabaseDB;
                console.log('✅ Usando window.supabaseDB como fallback');
            }

            if (client) {
                console.log('✅ Cliente Supabase obtenido exitosamente');
                break;
            }

            // Esperar antes del siguiente intento (aumentar el tiempo progresivamente)
            if (i < intentos - 1) {
                const delay = (i + 1) * 500; // 500ms, 1000ms, 1500ms...
                console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (!client) {
            console.error('❌ No se pudo conectar con Supabase después de varios intentos');
            select.innerHTML = '<option value="">-- Error cargando clientes --</option>';
            return;
        }

        // Obtener clientes desde Supabase
        const { data: clientes, error } = await client
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
            if (clienteId) {
                const clienteNombre = select.options[select.selectedIndex].text;
                clienteSeleccionadoId = clienteId;
                clienteSeleccionadoNombre = clienteNombre;

                console.log('Cliente seleccionado:', clienteId, clienteNombre);

                // Actualizar nombre en el header
                if (clientNameElement) {
                    clientNameElement.textContent = `Cliente: ${clienteNombre}`;
                }

                // Habilitar área de carga
                habilitarCarga();
            } else {
                clienteSeleccionadoId = null;
                clienteSeleccionadoNombre = '';
                if (clientNameElement) {
                    clientNameElement.textContent = '';
                }
                deshabilitarCarga();
            }
        });

    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
    }
}

function deshabilitarCarga() {
    dropZone.style.opacity = '0.5';
    dropZone.style.pointerEvents = 'none';
    processBtn.disabled = true;
}

function habilitarCarga() {
    dropZone.style.opacity = '1';
    dropZone.style.pointerEvents = 'auto';
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarClientesEnSelector();
    deshabilitarCarga();

    // Configurar selector de formato
    const selectorFormato = document.getElementById('selector-formato');
    const formatoDescripcion = document.getElementById('formatoDescripcion');

    if (selectorFormato) {
        selectorFormato.addEventListener('change', (e) => {
            formatoSeleccionado = e.target.value;

            // Actualizar descripción y configuración según formato
            const fileTypeHint = document.getElementById('fileTypeHint');

            if (formatoDescripcion) {
                if (formatoSeleccionado === 'liquidaciones') {
                    formatoDescripcion.textContent = 'Formato estándar de liquidaciones de Mercado Pago (columnas: TIPO DE REGISTRO, DESCRIPCIÓN, MONTO BRUTO...)';
                    if (fileTypeHint) fileTypeHint.textContent = 'Puedes seleccionar múltiples archivos Excel (Ctrl+Click o Cmd+Click)';
                    fileInput.accept = '.xlsx,.xls';
                    fileInput.multiple = true;
                } else if (formatoSeleccionado === 'operaciones') {
                    formatoDescripcion.textContent = 'Formato de operaciones (columnas: TIPO DE OPERACIÓN, VALOR DE LA COMPRA, MONTO NETO DE LA OPERACIÓN...)';
                    if (fileTypeHint) fileTypeHint.textContent = 'Puedes seleccionar múltiples archivos Excel (Ctrl+Click o Cmd+Click)';
                    fileInput.accept = '.xlsx,.xls';
                    fileInput.multiple = true;
                } else if (formatoSeleccionado === 'pdf') {
                    formatoDescripcion.textContent = 'Resumen de Cuenta en PDF descargado desde Mercado Pago';
                    if (fileTypeHint) fileTypeHint.textContent = 'Selecciona un archivo PDF de Resumen de Cuenta';
                    fileInput.accept = '.pdf';
                    fileInput.multiple = false;
                }
            }

            // Limpiar archivos seleccionados al cambiar formato
            selectedFiles = [];
            fileList.style.display = 'none';
            fileListItems.innerHTML = '';
            processBtn.disabled = true;

            // Ocultar metadata de PDF si no es formato PDF
            const pdfMetadata = document.getElementById('pdfMetadata');
            if (pdfMetadata) pdfMetadata.classList.add('hidden');

            console.log('Formato seleccionado:', formatoSeleccionado);
        });
    }
});

// Click en la zona de arrastre abre el selector de archivos
dropZone.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

// Prevenir comportamiento por defecto en drag & drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Efectos visuales en drag & drop
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = '#667eea';
        dropZone.style.backgroundColor = '#edf2f7';
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = '#cbd5e0';
        dropZone.style.backgroundColor = '#f7fafc';
    });
});

// Manejar archivos soltados
dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    // Filtrar según el formato seleccionado
    if (formatoSeleccionado === 'pdf') {
        selectedFiles = Array.from(files).filter(file =>
            file.name.toLowerCase().endsWith('.pdf')
        );

        if (selectedFiles.length > 1) {
            selectedFiles = [selectedFiles[0]]; // Solo permitir un PDF
        }

        if (selectedFiles.length > 0) {
            processBtn.disabled = false;
            processBtn.textContent = 'Procesar PDF';

            fileListItems.innerHTML = '';
            const li = document.createElement('li');
            li.textContent = `1. ${selectedFiles[0].name}`;
            li.style.padding = '5px 0';
            fileListItems.appendChild(li);
            fileList.style.display = 'block';

            errorBox.classList.add('hidden');
            resultCard.classList.add('hidden');

            // Ocultar metadata anterior
            const pdfMetadata = document.getElementById('pdfMetadata');
            if (pdfMetadata) pdfMetadata.classList.add('hidden');
        } else {
            alert('Por favor selecciona un archivo PDF válido');
        }
    } else {
        // Excel
        selectedFiles = Array.from(files).filter(file =>
            file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
        );

        if (selectedFiles.length > 0) {
            processBtn.disabled = false;
            processBtn.textContent = selectedFiles.length === 1
                ? 'Procesar archivo'
                : `Procesar ${selectedFiles.length} archivos`;

            // Mostrar lista de archivos
            fileListItems.innerHTML = '';
            selectedFiles.forEach((file, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${file.name}`;
                li.style.padding = '5px 0';
                fileListItems.appendChild(li);
            });
            fileList.style.display = 'block';

            errorBox.classList.add('hidden');
            resultCard.classList.add('hidden');
        } else {
            alert('Por favor selecciona archivos Excel válidos (.xlsx o .xls)');
        }
    }
}

processBtn.addEventListener('click', processFile);
downloadBtn.addEventListener('click', downloadExcel);

function parseImpuestosDesagregados(impuestosStr) {
    if (!impuestosStr || impuestosStr === 'nan' || impuestosStr === '') return [];

    try {
        // Convertir a string y limpiar comillas escapadas
        let jsonStr = String(impuestosStr);

        // Si el string empieza y termina con comillas dobles, quitarlas
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
        }

        // Reemplazar comillas escapadas
        jsonStr = jsonStr.replace(/\\"/g, '"');

        const impuestos = JSON.parse(jsonStr);
        return impuestos.map(imp => ({
            monto: Math.abs(imp.amount || 0),
            tipo: imp.detail || 'Impuesto',
            entidad: imp.financial_entity || ''
        }));
    } catch (e) {
        console.error('Error parseando impuestos:', impuestosStr, e);
        return [];
    }
}

function formatFecha(fechaStr) {
    if (!fechaStr) return '';
    try {
        const fecha = new Date(fechaStr);
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const anio = fecha.getFullYear();
        return `${dia}/${mes}/${anio}`;
    } catch (e) {
        return fechaStr;
    }
}

function getTipoImpuesto(detail, entidad) {
    // Si el detalle es genérico (tax_withholding, tax_withholding_payer o tax_withholding_payout), usar la entidad financiera para identificar
    if ((detail === 'tax_withholding' || detail === 'tax_withholding_payer' || detail === 'tax_withholding_payout') && entidad) {
        const tiposEntidad = {
            'retencion_ganancias': 'Retención de Ganancias',
            'retencion_iva': 'Retención de IVA',
            'retencion_iibb': 'Retención de IIBB',
            'debitos_creditos': 'Imp. Ley 25.413 - Débitos y Créditos Bancarios',
        };

        if (tiposEntidad[entidad]) {
            return tiposEntidad[entidad];
        }

        // Si no está en el diccionario, formatear la entidad
        return `Retención - ${entidad.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    }

    // Tipos específicos por detail
    const tipos = {
        'tax_withholding_collector': 'Imp. Ley 25.413 - Débitos y Créditos Bancarios',
        'tax_withholding_sirtac': 'Ret. IIBB SIRTAC',
        'tax_withholding_iibb': 'Retención de IIBB',
        'tax_withholding_income': 'Retención de Ganancias',
        'tax_withholding_vat': 'Retención de IVA',
        'tax_withholding_payer': 'Retención de Impuestos', // Este se resuelve por entidad
    };

    let descripcion = tipos[detail] || 'Retención de Impuestos';

    // Si es SIRTAC, agregar la jurisdicción
    if (detail === 'tax_withholding_sirtac' && entidad) {
        const jurisdiccion = entidad.charAt(0).toUpperCase() + entidad.slice(1);
        descripcion = `Ret. IIBB SIRTAC - ${jurisdiccion}`;
    }

    return descripcion;
}

function formatNumber(num) {
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

// ============================================
// FUNCIONES PARA PROCESAR PDF
// ============================================

// Configurar PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Parsear número en formato argentino (1.234,56 o -1.234,56)
function parsearNumeroArgentino(str) {
    if (!str) return 0;
    // Limpiar el string: quitar $ y espacios
    let limpio = str.replace(/\$/g, '').trim();
    // Detectar si es negativo
    const esNegativo = limpio.includes('-');
    limpio = limpio.replace(/-/g, '');
    // Quitar puntos de miles y reemplazar coma por punto
    limpio = limpio.replace(/\./g, '').replace(',', '.');
    const numero = parseFloat(limpio) || 0;
    return esNegativo ? -numero : numero;
}

// Extraer texto de todas las páginas del PDF
async function extraerTextoPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let textoCompleto = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Obtener items con sus posiciones
        const items = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width
        }));

        textoCompleto.push({
            pagina: i,
            items: items
        });
    }

    return textoCompleto;
}

// Procesar PDF de Resumen de Cuenta de Mercado Pago
async function procesarPDF(file) {
    console.log('=== PROCESANDO PDF ===');

    const paginasTexto = await extraerTextoPDF(file);
    console.log(`PDF tiene ${paginasTexto.length} páginas`);

    // Debug: mostrar todo el texto de la primera página
    if (paginasTexto.length > 0) {
        console.log('=== CONTENIDO PRIMERA PÁGINA ===');
        const textosPagina1 = paginasTexto[0].items.map(i => i.text).filter(t => t.trim());
        console.log('Textos encontrados:', textosPagina1.slice(0, 100));
    }

    // Extraer metadata de la primera página
    const metadata = extraerMetadataPDF(paginasTexto[0]);
    console.log('Metadata extraída:', metadata);

    // Extraer movimientos de todas las páginas
    const movimientos = [];

    for (const pagina of paginasTexto) {
        const movsPagina = extraerMovimientosPagina(pagina);
        console.log(`Página ${pagina.pagina}: ${movsPagina.length} movimientos`);
        movimientos.push(...movsPagina);
    }

    console.log(`Total movimientos extraídos: ${movimientos.length}`);

    return {
        metadata,
        movimientos
    };
}

// Extraer metadata del PDF (titular, CVU, CUIT, período, saldos)
function extraerMetadataPDF(primeraPagina) {
    const items = primeraPagina.items;
    const textos = items.map(i => i.text.trim()).filter(t => t);
    const textoCompleto = textos.join(' ');

    console.log('=== BUSCANDO METADATA ===');

    const metadata = {
        titular: '',
        cvu: '',
        cuit: '',
        periodo: '',
        saldoInicial: 0,
        entradas: 0,
        salidas: 0,
        saldoFinal: 0
    };

    // Buscar en el texto completo usando regex
    // CVU
    const cvuMatch = textoCompleto.match(/CVU[:\s]*(\d{22,24})/i);
    if (cvuMatch) {
        metadata.cvu = cvuMatch[1];
        console.log('CVU encontrado:', metadata.cvu);
    }

    // CUIT/CUIL
    const cuitMatch = textoCompleto.match(/CUIT[\/CUIL:\s]*(\d{2}-?\d{8}-?\d{1}|\d{11})/i);
    if (cuitMatch) {
        metadata.cuit = cuitMatch[1];
        console.log('CUIT encontrado:', metadata.cuit);
    }

    // Período
    const periodoMatch = textoCompleto.match(/(?:Período[:\s]*)?Del\s+\d+\s+al\s+\d+\s+de\s+\w+\s+de\s+\d{4}/i);
    if (periodoMatch) {
        metadata.periodo = periodoMatch[0].replace(/^Período[:\s]*/i, '');
        console.log('Período encontrado:', metadata.periodo);
    }

    // Buscar valores monetarios con etiquetas
    for (let i = 0; i < textos.length; i++) {
        const texto = textos[i].toLowerCase();

        // Buscar el valor en los siguientes items
        const buscarValor = (inicio) => {
            for (let j = inicio; j < Math.min(inicio + 3, textos.length); j++) {
                const valor = textos[j];
                if (valor.includes('$') || /^-?[\d.,]+$/.test(valor.replace(/\s/g, ''))) {
                    return parsearNumeroArgentino(valor);
                }
            }
            return 0;
        };

        if (texto.includes('saldo inicial')) {
            metadata.saldoInicial = buscarValor(i + 1);
            console.log('Saldo inicial:', metadata.saldoInicial);
        }
        if (texto === 'entradas:' || texto === 'entradas') {
            metadata.entradas = buscarValor(i + 1);
            console.log('Entradas:', metadata.entradas);
        }
        if (texto === 'salidas:' || texto === 'salidas') {
            metadata.salidas = buscarValor(i + 1);
            console.log('Salidas:', metadata.salidas);
        }
        if (texto.includes('saldo final')) {
            metadata.saldoFinal = buscarValor(i + 1);
            console.log('Saldo final:', metadata.saldoFinal);
        }
    }

    // Buscar titular (generalmente está después de "RESUMEN DE CUENTA")
    for (let i = 0; i < textos.length; i++) {
        if (textos[i].includes('RESUMEN DE CUENTA') || textos[i].includes('RESUMEN')) {
            // El siguiente texto que no sea vacío y parezca un nombre
            for (let j = i + 1; j < Math.min(i + 10, textos.length); j++) {
                const posibleTitular = textos[j];
                if (posibleTitular &&
                    !posibleTitular.includes('CVU') &&
                    !posibleTitular.includes('CUIT') &&
                    !posibleTitular.includes('$') &&
                    !posibleTitular.match(/^\d+$/) &&
                    posibleTitular.length > 3 &&
                    posibleTitular.match(/[A-Z]/i)) {
                    metadata.titular = posibleTitular;
                    console.log('Titular encontrado:', metadata.titular);
                    break;
                }
            }
            break;
        }
    }

    return metadata;
}

// Extraer movimientos de una página
function extraerMovimientosPagina(pagina) {
    const items = pagina.items;
    const movimientos = [];

    // Agrupar items por línea (mismo valor Y aproximado)
    const lineas = {};
    const toleranciaY = 5; // Aumentar tolerancia

    items.forEach(item => {
        if (!item.text.trim()) return; // Ignorar items vacíos

        // Redondear Y para agrupar
        const yKey = Math.round(item.y / toleranciaY) * toleranciaY;
        if (!lineas[yKey]) {
            lineas[yKey] = [];
        }
        lineas[yKey].push(item);
    });

    // Ordenar líneas de arriba a abajo (Y mayor = más arriba en PDF)
    const lineasOrdenadas = Object.keys(lineas)
        .map(Number)
        .sort((a, b) => b - a)
        .map(y => {
            // Ordenar items de izquierda a derecha
            return lineas[y].sort((a, b) => a.x - b.x);
        });

    // Debug primera página
    if (pagina.pagina === 1) {
        console.log(`Página 1: ${lineasOrdenadas.length} líneas detectadas`);
        lineasOrdenadas.slice(0, 20).forEach((linea, idx) => {
            const textos = linea.map(i => i.text).join(' | ');
            console.log(`Línea ${idx}: ${textos}`);
        });
    }

    // Regex más flexibles
    const regexFecha = /^\d{2}-\d{2}-\d{4}$/;
    const regexId = /^\d{9,12}$/;
    // Regex más flexible para valores monetarios - puede o no tener $
    const esValorMonetario = (texto) => {
        // Detectar patrones como: $ 110.233,24 o -5.000.000,00 o $ -1.234,56
        const limpio = texto.replace(/\s/g, '');
        return /^\$?-?[\d.]+,\d{2}$/.test(limpio) || /^-?\$[\d.]+,\d{2}$/.test(limpio);
    };

    let ultimoMovimiento = null;

    for (let i = 0; i < lineasOrdenadas.length; i++) {
        const linea = lineasOrdenadas[i];
        const textoLinea = linea.map(item => item.text.trim()).filter(t => t);
        const textoCompleto = textoLinea.join(' ');

        // Ignorar encabezados y pie de página
        if (textoCompleto.includes('Descripción') && textoCompleto.includes('Saldo')) {
            continue; // Es el header de columnas
        }
        if (textoCompleto.includes('Fecha de generación') || textoCompleto.includes('Mercado Libre S.R.L')) {
            continue; // Es pie de página
        }
        if (/^\d+\/\d+$/.test(textoCompleto.trim())) {
            continue; // Es número de página
        }
        if (textoCompleto.includes('RESUMEN DE CUENTA') || textoCompleto.includes('CVU:') || textoCompleto.includes('CUIT')) {
            continue; // Es header del documento
        }
        if (textoCompleto.includes('Saldo inicial') || textoCompleto.includes('Entradas:') || textoCompleto.includes('Salidas:') || textoCompleto.includes('Saldo final')) {
            continue; // Es resumen
        }

        // Buscar si la línea tiene una fecha al inicio
        let fecha = null;
        let descripcion = '';
        let idOperacion = '';
        let valores = [];

        for (const item of linea) {
            const texto = item.text.trim();
            if (!texto) continue;

            if (regexFecha.test(texto)) {
                fecha = texto;
            } else if (regexId.test(texto)) {
                idOperacion = texto;
            } else if (esValorMonetario(texto)) {
                valores.push(parsearNumeroArgentino(texto));
            } else if (texto.length > 1 && !texto.match(/^[\d\/]+$/) && texto !== 'mercado pago') {
                // Es parte de la descripción
                if (descripcion) {
                    descripcion += ' ' + texto;
                } else {
                    descripcion = texto;
                }
            }
        }

        // Si tenemos fecha y al menos un valor, es una línea de movimiento
        if (fecha && valores.length >= 1) {
            const valor = valores[0];
            const saldo = valores.length >= 2 ? valores[1] : 0;

            const mov = {
                fecha: fecha.replace(/-/g, '/'), // Convertir a DD/MM/YYYY
                descripcion: descripcion.trim(),
                idOperacion: idOperacion,
                valor: valor,
                saldo: saldo,
                credito: valor > 0 ? valor : 0,
                debito: valor < 0 ? Math.abs(valor) : 0,
                origen: 'Mercado Pago'
            };

            movimientos.push(mov);
            ultimoMovimiento = mov;
        } else if (!fecha && descripcion && ultimoMovimiento) {
            // Línea sin fecha = continuación de descripción del movimiento anterior
            ultimoMovimiento.descripcion += ' ' + descripcion.trim();
        }
    }

    return movimientos;
}

// Función para procesar formato de operaciones (nueva estructura)
function procesarFormatoOperaciones(jsonData, fileIndex, saldoAcumuladoInicial) {
    const gruposMovimientos = []; // Array de grupos (cada grupo es un array de movimientos de la misma operación)
    let saldoAcumulado = saldoAcumuladoInicial;

    // Filtrar registros - Solo pagos aprobados
    const filteredData = jsonData.filter(row => {
        const tipoOperacion = row['TIPO DE OPERACIÓN'] || '';
        const tipoOp = String(tipoOperacion).toLowerCase();

        // Incluir pagos aprobados y otros tipos relevantes
        return tipoOp.includes('pago aprobado') ||
               tipoOp.includes('devolución') ||
               tipoOp.includes('cashback') ||
               tipoOp.includes('rendimiento') ||
               tipoOp.includes('payouts');
    });

    console.log(`  Registros filtrados (formato operaciones): ${filteredData.length}`);

    // Procesar cada registro
    filteredData.forEach((row, index) => {
        try {
            const movimientosOperacion = []; // Movimientos de esta operación

            // Usar FECHA DE LIBERACIÓN DEL DINERO o FECHA DE ORIGEN
            const fechaRaw = row['FECHA DE LIBERACIÓN DEL DINERO'] || row['FECHA DE ORIGEN'] || row['FECHA DE APROBACIÓN'];
            const fecha = formatFecha(fechaRaw);

            const tipoOperacion = row['TIPO DE OPERACIÓN'] || 'Movimiento';

            // ID de operación
            let idOperacion = '';
            if (row['ID DE OPERACIÓN EN MERCADO PAGO']) {
                const id = row['ID DE OPERACIÓN EN MERCADO PAGO'];
                idOperacion = Math.floor(id).toString();
            }

            const plataforma = row['PLATAFORMA DE COBRO'] || '';
            const pagador = row['PAGADOR'] || '';
            const medioPago = row['MEDIO DE PAGO'] || '';

            // Construir descripción completa
            let descripcionCompleta = tipoOperacion;
            const detalles = [];
            if (idOperacion) detalles.push(idOperacion);
            if (plataforma) detalles.push(plataforma);
            if (pagador) detalles.push(pagador);
            if (detalles.length > 0) {
                descripcionCompleta = `${tipoOperacion} - ${detalles.join(' - ')}`;
            }

            // Montos - usar nombres de columnas del nuevo formato
            const valorCompra = parseFloat(row['VALOR DE LA COMPRA']) || 0;
            const montoNeto = parseFloat(row['MONTO NETO DE LA OPERACIÓN QUE IMPACTÓ TU DINERO']) ||
                              parseFloat(row['MONTO NETO DE OPERACIÓN']) || 0;

            // Calcular saldo acumulado
            saldoAcumulado += montoNeto;

            // Comisiones y costos
            // COMISIÓN MÁS IVA y COMISIÓN DE MERCADO LIBRE MÁS IVA son el mismo dato en diferentes columnas, usar solo una
            const comisionMP = Math.abs(parseFloat(row['COMISIÓN MÁS IVA']) || 0);
            const comisionCuotas = Math.abs(parseFloat(row['COMISIÓN POR OFRECER CUOTAS SIN INTERÉS']) || 0);
            const costoEnvio = Math.abs(parseFloat(row['COSTO DE ENVÍO']) || 0);
            const impuestosIIBB = Math.abs(parseFloat(row['IMPUESTOS COBRADOS POR RETENCIONES IIBB']) || 0);
            const cuponDescuento = parseFloat(row['CUPÓN DE DESCUENTO']) || 0;

            // Determinar si es crédito o débito
            const esCredito = valorCompra > 0;

            // Detectar si es una devolución
            const esDevolucion = String(tipoOperacion).toLowerCase().includes('devolución');

            // Función auxiliar para agregar ID de operación a la descripción
            const agregarIdOperacion = (desc) => {
                return idOperacion ? `${desc} - ${idOperacion}` : desc;
            };

            // Solo agregar movimiento principal si tiene monto
            if (valorCompra !== 0) {
                movimientosOperacion.push({
                    fecha,
                    descripcion: descripcionCompleta,
                    origen: 'Mercado Pago',
                    credito: esCredito ? valorCompra : 0,
                    debito: !esCredito ? Math.abs(valorCompra) : 0,
                    saldo: saldoAcumulado
                });
            }

            // Comisión MP
            if (comisionMP > 0) {
                movimientosOperacion.push({
                    fecha,
                    descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Comisión Mercado Pago (incluye IVA)' : 'Comisión Mercado Pago (incluye IVA)'),
                    origen: 'Mercado Pago',
                    credito: esDevolucion ? comisionMP : 0,
                    debito: esDevolucion ? 0 : comisionMP,
                    saldo: saldoAcumulado
                });
            }

            if (comisionCuotas > 0) {
                movimientosOperacion.push({
                    fecha,
                    descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Comisión por ofrecer cuotas sin interés' : 'Comisión por ofrecer cuotas sin interés'),
                    origen: 'Mercado Pago',
                    credito: esDevolucion ? comisionCuotas : 0,
                    debito: esDevolucion ? 0 : comisionCuotas,
                    saldo: saldoAcumulado
                });
            }

            if (costoEnvio > 0) {
                movimientosOperacion.push({
                    fecha,
                    descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Costo de envío' : 'Costo de envío'),
                    origen: 'Mercado Pago',
                    credito: esDevolucion ? costoEnvio : 0,
                    debito: esDevolucion ? 0 : costoEnvio,
                    saldo: saldoAcumulado
                });
            }

            // Cupón de descuento (si es negativo es débito, si es positivo es crédito)
            if (cuponDescuento !== 0) {
                const esCuponDebito = cuponDescuento < 0;
                const montoAbsoluto = Math.abs(cuponDescuento);

                movimientosOperacion.push({
                    fecha,
                    descripcion: agregarIdOperacion('Cupón de descuento'),
                    origen: 'Mercado Pago',
                    credito: esCuponDebito ? 0 : montoAbsoluto,
                    debito: esCuponDebito ? montoAbsoluto : 0,
                    saldo: saldoAcumulado
                });
            }

            // Procesar OPERATION_TAGS para reintegros/cupones
            const operationTags = row['OPERATION_TAGS'];
            if (operationTags && String(operationTags) !== 'nan' && String(operationTags) !== '') {
                try {
                    let tagsStr = String(operationTags);
                    if (tagsStr.startsWith('"') && tagsStr.endsWith('"')) {
                        tagsStr = tagsStr.slice(1, -1);
                    }
                    tagsStr = tagsStr.replace(/\\"/g, '"');

                    const tags = JSON.parse(tagsStr);

                    if (Array.isArray(tags)) {
                        tags.forEach(tag => {
                            if (tag.amount && tag.amount > 0) {
                                const tipoReintegro = tag.coupon_type || 'reintegro';
                                const descripcionReintegro = tipoReintegro === 'coupon'
                                    ? 'Reintegro por cupón/descuento'
                                    : 'Reintegro';

                                movimientosOperacion.push({
                                    fecha,
                                    descripcion: agregarIdOperacion(descripcionReintegro),
                                    origen: 'Mercado Pago',
                                    credito: tag.amount,
                                    debito: 0,
                                    saldo: saldoAcumulado
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Error parseando OPERATION_TAGS:', operationTags, e);
                }
            }

            // Impuestos desagregados
            const impuestosDesagregados = parseImpuestosDesagregados(row['IMPUESTOS DESAGREGADOS']);

            if (impuestosDesagregados.length > 0) {
                impuestosDesagregados.forEach(impuesto => {
                    if (impuesto.monto > 0) {
                        const tipoImpuesto = getTipoImpuesto(impuesto.tipo, impuesto.entidad);
                        const descripcionImpuesto = esDevolucion ? `Devolución - ${tipoImpuesto}` : tipoImpuesto;

                        movimientosOperacion.push({
                            fecha,
                            descripcion: agregarIdOperacion(descripcionImpuesto),
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? impuesto.monto : 0,
                            debito: esDevolucion ? 0 : impuesto.monto,
                            saldo: saldoAcumulado
                        });
                    }
                });
            } else if (impuestosIIBB > 0) {
                // Si no hay detalle de impuestos, todo corresponde a Imp. Ley 25.413
                movimientosOperacion.push({
                    fecha,
                    descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Imp. Ley 25.413 - Débitos y Créditos Bancarios' : 'Imp. Ley 25.413 - Débitos y Créditos Bancarios'),
                    origen: 'Mercado Pago',
                    credito: esDevolucion ? impuestosIIBB : 0,
                    debito: esDevolucion ? 0 : impuestosIIBB,
                    saldo: saldoAcumulado
                });
            }

            // Agregar el grupo de movimientos de esta operación
            if (movimientosOperacion.length > 0) {
                gruposMovimientos.push(movimientosOperacion);
            }

        } catch (rowError) {
            console.error('Error procesando fila (formato operaciones):', rowError);
        }
    });

    return {
        gruposMovimientos,
        registrosProcesados: filteredData.length,
        saldoFinal: saldoAcumulado
    };
}

async function processFile() {
    console.log('=== INICIANDO PROCESAMIENTO ===');
    console.log('Archivos seleccionados:', selectedFiles.length);
    console.log('Formato seleccionado:', formatoSeleccionado);

    if (selectedFiles.length === 0) {
        alert('No hay archivos seleccionados');
        return;
    }

    processBtn.innerHTML = '<span class="spinner"></span> Procesando...';
    processBtn.disabled = true;
    errorBox.classList.add('hidden');
    resultCard.classList.add('hidden');

    // Ocultar metadata de PDF
    const pdfMetadata = document.getElementById('pdfMetadata');
    if (pdfMetadata) pdfMetadata.classList.add('hidden');

    try {
        let todosLosMovimientos = [];
        let totalRegistrosProcesados = 0;
        let saldoAcumulado = 0;

        // ===== FORMATO PDF =====
        if (formatoSeleccionado === 'pdf') {
            const file = selectedFiles[0];
            console.log(`Procesando PDF: ${file.name}`);

            const resultado = await procesarPDF(file);

            // Mostrar metadata
            if (pdfMetadata && resultado.metadata) {
                const meta = resultado.metadata;
                const pdfMetadataContent = document.getElementById('pdfMetadataContent');
                if (pdfMetadataContent) {
                    pdfMetadataContent.innerHTML = `
                        <p><strong>Titular:</strong> ${meta.titular || 'No detectado'}</p>
                        <p><strong>CVU:</strong> ${meta.cvu || 'No detectado'}</p>
                        <p><strong>CUIT/CUIL:</strong> ${meta.cuit || 'No detectado'}</p>
                        <p><strong>Período:</strong> ${meta.periodo || 'No detectado'}</p>
                        <p><strong>Saldo inicial:</strong> ${formatNumber(meta.saldoInicial)}</p>
                        <p><strong>Entradas:</strong> ${formatNumber(meta.entradas)}</p>
                        <p><strong>Salidas:</strong> ${formatNumber(meta.salidas)}</p>
                        <p><strong>Saldo final:</strong> ${formatNumber(meta.saldoFinal)}</p>
                    `;
                }
                pdfMetadata.classList.remove('hidden');
            }

            // Los movimientos del PDF ya vienen en orden cronológico (de más viejo a más nuevo)
            // No necesitamos invertirlos
            todosLosMovimientos = resultado.movimientos;
            totalRegistrosProcesados = resultado.movimientos.length;

            // Recalcular saldos basándonos en el saldo inicial del PDF
            let saldoRecalculado = resultado.metadata.saldoInicial || 0;
            todosLosMovimientos.forEach(mov => {
                saldoRecalculado += (mov.credito || 0) - (mov.debito || 0);
                mov.saldo = saldoRecalculado;
            });

            console.log('Total movimientos PDF:', todosLosMovimientos.length);

            // Saltar al final del procesamiento
            processedData = {
                movimientos: todosLosMovimientos,
                totalRegistros: totalRegistrosProcesados,
                totalMovimientos: todosLosMovimientos.length,
                totalArchivos: 1,
                esPDF: true,
                metadata: resultado.metadata
            };

            // Mostrar resultados
            resultStats.innerHTML = `
                PDF procesado - ${processedData.totalMovimientos} movimientos extraídos
                <br><small>Saldo inicial: ${formatNumber(resultado.metadata.saldoInicial)} → Saldo final: ${formatNumber(resultado.metadata.saldoFinal)}</small>
            `;

            // Limpiar tabla
            tableBody.innerHTML = '';

            // Mostrar primeros 100 movimientos
            const movimientosAMostrar = processedData.movimientos.slice(0, 100);
            movimientosAMostrar.forEach(mov => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${mov.fecha}</td>
                    <td>${mov.descripcion}${mov.idOperacion ? ` <small style="color:#888">(${mov.idOperacion})</small>` : ''}</td>
                    <td>${mov.origen}</td>
                    <td class="text-right text-green">${mov.credito !== 0 ? formatNumber(mov.credito) : ''}</td>
                    <td class="text-right text-red">${mov.debito !== 0 ? formatNumber(mov.debito) : ''}</td>
                    <td class="text-right"><strong>${formatNumber(mov.saldo)}</strong></td>
                `;
                tableBody.appendChild(row);
            });

            if (processedData.movimientos.length > 100) {
                tableFooter.textContent = `Mostrando los primeros 100 movimientos de ${processedData.movimientos.length} totales. Descarga el Excel para ver todos los movimientos.`;
            } else {
                tableFooter.textContent = '';
            }

            resultCard.classList.remove('hidden');

            processBtn.innerHTML = 'Procesar PDF';
            processBtn.disabled = false;
            return;
        }

        // ===== FORMATOS EXCEL (liquidaciones y operaciones) =====
        // Procesar cada archivo
        for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
            const file = selectedFiles[fileIndex];
            console.log(`\n--- Procesando archivo ${fileIndex + 1}/${selectedFiles.length}: ${file.name} ---`);

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            console.log(`  Total registros leídos: ${jsonData.length}`);

            // ===== FORMATO OPERACIONES =====
            if (formatoSeleccionado === 'operaciones') {
                const resultado = procesarFormatoOperaciones(jsonData, fileIndex, saldoAcumulado);

                // Invertir el orden de los grupos (operaciones) y luego aplanar
                // Esto mantiene los movimientos de cada operación juntos pero invierte el orden de las operaciones
                const gruposInvertidos = resultado.gruposMovimientos.reverse();
                const movimientosAplanados = gruposInvertidos.flat();

                todosLosMovimientos = todosLosMovimientos.concat(movimientosAplanados);
                totalRegistrosProcesados += resultado.registrosProcesados;
                saldoAcumulado = resultado.saldoFinal;

                console.log(`  Movimientos generados hasta ahora: ${todosLosMovimientos.length}`);
                continue; // Pasar al siguiente archivo
            }

            // ===== FORMATO LIQUIDACIONES (original) =====
            // Buscar el saldo inicial (Dinero disponible del período anterior)
            const periodoAnterior = jsonData.find(row =>
                row['TIPO DE REGISTRO'] === 'Dinero disponible del período anterior'
            );

            if (periodoAnterior && fileIndex === 0) {
                // Solo usar el saldo inicial del primer archivo
                // El saldo inicial puede estar en SALDO, MONTO NETO ACREDITADO o MONTO BRUTO
                const saldoInicial = parseFloat(periodoAnterior['SALDO']) ||
                                   parseFloat(periodoAnterior['MONTO NETO ACREDITADO']) ||
                                   parseFloat(periodoAnterior['MONTO BRUTO DE LA OPERACIÓN']) || 0;

                if (saldoInicial !== 0) {
                    saldoAcumulado = saldoInicial;
                    console.log(`  Saldo inicial (período anterior): $${saldoInicial.toFixed(2)}`);

                    // Agregar como primer movimiento
                    todosLosMovimientos.push({
                        fecha: formatFecha(periodoAnterior['FECHA DE LIBERACIÓN']),
                        descripcion: 'Saldo inicial del período',
                        origen: 'Mercado Pago',
                        credito: 0,
                        debito: 0,
                        saldo: saldoAcumulado
                    });
                }
            }

            // Filtrar registros
            const filteredData = jsonData.filter(row => {
                const tipoRegistro = row['TIPO DE REGISTRO'];
                const descripcion = row['DESCRIPCIÓN'];

                if (tipoRegistro !== 'Dinero liquidado') return false;
                if (!descripcion) return false;

                const desc = String(descripcion).toLowerCase();

                // Excluir explícitamente "Reserva para pago"
                if (desc.includes('reserva para pago')) return false;

                // Incluir: "Pago", "Extracción de efectivo", "Devolución de dinero", "Rendimientos", "Cashback", "Tarifa de envío", "Dinero retenido de envío", "Débito de dinero por mediación", "Dinero retenido para reembolso" y "reserve_for_dispute"
                return desc.includes('pago') ||
                       desc.includes('extracción de efectivo') ||
                       desc.includes('devolución de dinero') ||
                       desc.includes('rendimientos') ||
                       desc.includes('cashback') ||
                       desc.includes('tarifa de envío') ||
                       desc.includes('dinero retenido de envío') ||
                       desc.includes('débito de dinero por mediación') ||
                       desc.includes('dinero retenido para reembolso') ||
                       desc.includes('reserve_for_dispute');
            });

            console.log(`  Registros filtrados: ${filteredData.length}`);
            totalRegistrosProcesados += filteredData.length;

            // Procesar y desagregar movimientos de este archivo
            filteredData.forEach((row, index) => {
                try {
                    const fecha = formatFecha(row['FECHA DE LIBERACIÓN']);
                    const descripcionBase = row['DESCRIPCIÓN'] || 'Movimiento';

                    // Obtener el saldo directamente del archivo (no calcularlo)
                    const saldoDelArchivo = parseFloat(row['SALDO']) || 0;

                    // ID de operación (sin decimales)
                    let idOperacion = '';
                    if (row['ID DE OPERACIÓN EN MERCADO PAGO']) {
                        const id = row['ID DE OPERACIÓN EN MERCADO PAGO'];
                        idOperacion = Math.floor(id).toString();
                    }

                    const plataforma = row['PLATAFORMA DE COBRO'] || '';
                    const pagador = row['PAGADOR'] || '';

                    // Construir descripción completa
                    let descripcionCompleta = descripcionBase;
                    const detalles = [];
                    if (idOperacion) detalles.push(idOperacion);
                    if (plataforma) detalles.push(plataforma);
                    if (pagador) detalles.push(pagador);
                    if (detalles.length > 0) {
                        descripcionCompleta = `${descripcionBase} - ${detalles.join(' - ')}`;
                    }

                    const montoBruto = parseFloat(row['MONTO BRUTO DE LA OPERACIÓN']) || 0;
                    const montoNetoAcreditado = parseFloat(row['MONTO NETO ACREDITADO']) || 0;
                    const montoNetoDebitado = parseFloat(row['MONTO NETO DEBITADO']) || 0;

                    // El saldo se calcula con MONTO NETO para validación
                    const montoNeto = montoNetoAcreditado - montoNetoDebitado;
                    saldoAcumulado += montoNeto;

                    // Comisiones y costos
                    const comisionMP = Math.abs(parseFloat(row['COMISIÓN DE MERCADO PAGO O MERCADO LIBRE (INCLUYE IVA)']) || 0);
                    const comisionCuotas = Math.abs(parseFloat(row['COMISIÓN POR OFRECER CUOTAS SIN INTERÉS']) || 0);
                    const costoEnvio = Math.abs(parseFloat(row['COSTO DE ENVÍO']) || 0);
                    const impuestosIIBB = Math.abs(parseFloat(row['IMPUESTOS COBRADOS POR RETENCIONES IIBB']) || 0);
                    // Costo por ofrecer descuento (puede ser positivo o negativo)
                    const costoOfrecerDescuento = parseFloat(row['COSTO POR OFRECER DESCUENTO']) || 0;

                    // Movimiento principal - USAR SALDO DEL ARCHIVO
                    const esCredito = montoBruto > 0;

                    // Detectar si es una devolución
                    const esDevolucion = String(descripcionBase).toLowerCase().includes('devolución de dinero');

                    // Detectar si es una tarifa de envío (para evitar línea vacía duplicada)
                    const esTarifaEnvio = String(descripcionBase).toLowerCase().includes('tarifa de envío');

                    // Solo agregar movimiento principal si tiene monto
                    // (las tarifas de envío y devoluciones sin monto bruto se muestran solo como costos/comisiones)
                    if (montoBruto !== 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: descripcionCompleta,
                            origen: 'Mercado Pago',
                            credito: esCredito ? montoBruto : 0,
                            debito: !esCredito ? Math.abs(montoBruto) : 0,
                            saldo: saldoDelArchivo
                        });
                    }

                    // NOTA: Las comisiones e impuestos ya están incluidas en la diferencia entre
                    // MONTO BRUTO y MONTO NETO, por lo que NO debemos desagregarlas del saldo.
                    // Las mostramos solo como información y todas comparten el mismo saldo del archivo.

                    // Si es una devolución, comisiones e impuestos también son devoluciones (créditos)
                    // Si no es devolución, son débitos normales

                    // Función auxiliar para agregar ID de operación a la descripción
                    const agregarIdOperacion = (desc) => {
                        return idOperacion ? `${desc} - ${idOperacion}` : desc;
                    };

                    // Mostrar comisiones como información (mismo saldo)
                    if (comisionMP > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Comisión Mercado Pago (incluye IVA)' : 'Comisión Mercado Pago (incluye IVA)'),
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? comisionMP : 0,
                            debito: esDevolucion ? 0 : comisionMP,
                            saldo: saldoDelArchivo
                        });
                    }

                    if (comisionCuotas > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Comisión por ofrecer cuotas sin interés' : 'Comisión por ofrecer cuotas sin interés'),
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? comisionCuotas : 0,
                            debito: esDevolucion ? 0 : comisionCuotas,
                            saldo: saldoDelArchivo
                        });
                    }

                    if (costoEnvio > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Costo de envío' : 'Costo de envío'),
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? costoEnvio : 0,
                            debito: esDevolucion ? 0 : costoEnvio,
                            saldo: saldoDelArchivo
                        });
                    }


                    // Procesar OPERATION_TAGS para reintegros/cupones primero
                    let tieneOperationTags = false;
                    const operationTags = row['OPERATION_TAGS'];
                    if (operationTags && String(operationTags) !== 'nan' && String(operationTags) !== '') {
                        try {
                            let tagsStr = String(operationTags);
                            // Limpiar comillas escapadas
                            if (tagsStr.startsWith('"') && tagsStr.endsWith('"')) {
                                tagsStr = tagsStr.slice(1, -1);
                            }
                            tagsStr = tagsStr.replace(/\\"/g, '"');

                            const tags = JSON.parse(tagsStr);

                            // Buscar reintegros/cupones
                            if (Array.isArray(tags)) {
                                tags.forEach(tag => {
                                    if (tag.amount && tag.amount > 0) {
                                        tieneOperationTags = true;
                                        const tipoReintegro = tag.coupon_type || 'reintegro';
                                        const descripcionReintegro = tipoReintegro === 'coupon'
                                            ? 'Reintegro por cupón/descuento'
                                            : 'Reintegro';

                                        todosLosMovimientos.push({
                                            fecha,
                                            descripcion: agregarIdOperacion(descripcionReintegro),
                                            origen: 'Mercado Pago',
                                            credito: tag.amount,
                                            debito: 0,
                                            saldo: saldoDelArchivo
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn('Error parseando OPERATION_TAGS:', operationTags, e);
                        }
                    }

                    // Costo por ofrecer descuento (solo si NO hay OPERATION_TAGS)
                    // Esto evita duplicar la información del mismo concepto
                    if (costoOfrecerDescuento !== 0 && !tieneOperationTags) {
                        // Si es negativo → débito, si es positivo → crédito
                        const esDebitoDescuento = costoOfrecerDescuento < 0;
                        const montoAbsoluto = Math.abs(costoOfrecerDescuento);

                        todosLosMovimientos.push({
                            fecha,
                            descripcion: agregarIdOperacion('Costo por ofrecer descuento'),
                            origen: 'Mercado Pago',
                            credito: esDebitoDescuento ? 0 : montoAbsoluto,
                            debito: esDebitoDescuento ? montoAbsoluto : 0,
                            saldo: saldoDelArchivo
                        });
                    }

                    // Mostrar impuestos desagregados como información (mismo saldo)
                    const impuestosDesagregados = parseImpuestosDesagregados(row['IMPUESTOS DESAGREGADOS']);

                    if (impuestosDesagregados.length > 0) {
                        impuestosDesagregados.forEach(impuesto => {
                            if (impuesto.monto > 0) {
                                const tipoImpuesto = getTipoImpuesto(impuesto.tipo, impuesto.entidad);

                                // Si es devolución, agregar prefijo y mostrar como crédito
                                const descripcionImpuesto = esDevolucion ? `Devolución - ${tipoImpuesto}` : tipoImpuesto;

                                todosLosMovimientos.push({
                                    fecha,
                                    descripcion: agregarIdOperacion(descripcionImpuesto),
                                    origen: 'Mercado Pago',
                                    credito: esDevolucion ? impuesto.monto : 0,
                                    debito: esDevolucion ? 0 : impuesto.monto,
                                    saldo: saldoDelArchivo
                                });
                            }
                        });
                    } else if (impuestosIIBB > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: agregarIdOperacion(esDevolucion ? 'Devolución - Retenciones de Impuestos' : 'Retenciones de Impuestos'),
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? impuestosIIBB : 0,
                            debito: esDevolucion ? 0 : impuestosIIBB,
                            saldo: saldoDelArchivo
                        });
                    }

                    // Validación: Comparar saldo calculado con saldo del archivo
                    const diferenciaSaldo = Math.abs(saldoAcumulado - saldoDelArchivo);
                    if (diferenciaSaldo > 0.01) {
                        console.warn(`⚠️  DIFERENCIA EN SALDO - Movimiento ${index + 1}:`);
                        console.warn(`   Fecha: ${fecha}`);
                        console.warn(`   Descripción: ${descripcionBase}`);
                        console.warn(`   ID Operación: ${idOperacion || 'N/A'}`);
                        console.warn(`   Saldo calculado: $${saldoAcumulado.toFixed(2)}`);
                        console.warn(`   Saldo en archivo: $${saldoDelArchivo.toFixed(2)}`);
                        console.warn(`   Diferencia: $${diferenciaSaldo.toFixed(2)}`);
                    }

                } catch (rowError) {
                    console.error('Error procesando fila:', rowError);
                }
            });

            console.log(`  Movimientos generados hasta ahora: ${todosLosMovimientos.length}`);
        }

        console.log('Total movimientos generados:', todosLosMovimientos.length);

        // Solo invertir para formato liquidaciones (operaciones ya se invierte al procesar grupos)
        if (formatoSeleccionado === 'liquidaciones') {
            // Invertir el orden de los movimientos (el último del archivo será el primero)
            todosLosMovimientos.reverse();
            console.log('Movimientos invertidos (formato liquidaciones)');
        }

        // Recalcular saldos después de invertir/reordenar
        let saldoRecalculado = 0;
        todosLosMovimientos.forEach(mov => {
            saldoRecalculado += (mov.credito || 0) - (mov.debito || 0);
            mov.saldo = saldoRecalculado;
        });

        console.log('Saldos recalculados');

        processedData = {
            movimientos: todosLosMovimientos,
            totalRegistros: totalRegistrosProcesados,
            totalMovimientos: todosLosMovimientos.length,
            totalArchivos: selectedFiles.length
        };

        // Mostrar resultados
        const archivosText = processedData.totalArchivos === 1
            ? '1 archivo procesado'
            : `${processedData.totalArchivos} archivos procesados`;
        resultStats.textContent = `${archivosText} - ${processedData.totalRegistros} registros → ${processedData.totalMovimientos} movimientos desagregados`;

        // Limpiar tabla
        tableBody.innerHTML = '';

        // Mostrar primeros 100 movimientos
        const movimientosAMostrar = processedData.movimientos.slice(0, 100);
        movimientosAMostrar.forEach(mov => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${mov.fecha}</td>
                <td>${mov.descripcion}</td>
                <td>${mov.origen}</td>
                <td class="text-right text-green">${mov.credito !== 0 ? formatNumber(mov.credito) : ''}</td>
                <td class="text-right text-red">${mov.debito !== 0 ? formatNumber(mov.debito) : ''}</td>
                <td class="text-right"><strong>${formatNumber(mov.saldo)}</strong></td>
            `;
            tableBody.appendChild(row);
        });

        if (processedData.movimientos.length > 100) {
            tableFooter.textContent = `Mostrando los primeros 100 movimientos de ${processedData.movimientos.length} totales. Descarga el Excel para ver todos los movimientos.`;
        } else {
            tableFooter.textContent = '';
        }

        resultCard.classList.remove('hidden');

    } catch (error) {
        console.error('=== ERROR EN PROCESAMIENTO ===');
        console.error('Error completo:', error);
        console.error('Stack:', error.stack);
        errorBox.textContent = 'Error al procesar el archivo: ' + error.message + '. Revisa la consola (F12) para más detalles.';
        errorBox.classList.remove('hidden');
    } finally {
        processBtn.innerHTML = selectedFiles.length === 1
            ? 'Procesar archivo'
            : `Procesar ${selectedFiles.length} archivos`;
        processBtn.disabled = false;
    }
}

function downloadExcel() {
    if (!processedData || !processedData.movimientos.length) return;

    try {
        // Crear datos para el Excel
        const excelData = processedData.movimientos.map(mov => ({
            'Fecha': mov.fecha,
            'Descripción': mov.descripcion,
            'Origen': mov.origen,
            'Crédito': mov.credito !== 0 ? mov.credito : 0,
            'Débito': mov.debito !== 0 ? mov.debito : 0,
            'Saldo': mov.saldo
        }));

        // Crear libro de Excel
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Ajustar ancho de columnas
        ws['!cols'] = [
            { wch: 12 },  // Fecha
            { wch: 50 },  // Descripción
            { wch: 20 },  // Origen
            { wch: 15 },  // Crédito
            { wch: 15 },  // Débito
            { wch: 15 }   // Saldo
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Extracto');

        // Descargar
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `extracto-mercadopago-${fecha}.xlsx`);
    } catch (error) {
        alert('Error al generar el archivo: ' + error.message);
    }
}
