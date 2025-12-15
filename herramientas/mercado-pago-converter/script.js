let selectedFiles = [];
let processedData = null;

// Cliente seleccionado en este módulo
let clienteSeleccionadoId = null;
let clienteSeleccionadoNombre = '';

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

async function cargarClientesEnSelector() {
    const select = document.getElementById('selector-cliente-mp');
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

async function processFile() {
    console.log('=== INICIANDO PROCESAMIENTO ===');
    console.log('Archivos seleccionados:', selectedFiles.length);

    if (selectedFiles.length === 0) {
        alert('No hay archivos seleccionados');
        return;
    }

    processBtn.innerHTML = '<span class="spinner"></span> Procesando...';
    processBtn.disabled = true;
    errorBox.classList.add('hidden');
    resultCard.classList.add('hidden');

    try {
        let todosLosMovimientos = [];
        let totalRegistrosProcesados = 0;
        let saldoAcumulado = 0;

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

                // Incluir: "Pago", "Extracción de efectivo", "Devolución de dinero", "Rendimientos" y "Cashback"
                return desc.includes('pago') ||
                       desc.includes('extracción de efectivo') ||
                       desc.includes('devolución de dinero') ||
                       desc.includes('rendimientos') ||
                       desc.includes('cashback');
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
                    const cuponDescuento = Math.abs(parseFloat(row['CUPÓN DE DESCUENTO']) || 0);

                    // Costo por ofrecer descuento (puede ser positivo o negativo)
                    const costoOfrecerDescuento = parseFloat(row['COSTO POR OFRECER DESCUENTO']) || 0;

                    // Movimiento principal - USAR SALDO DEL ARCHIVO
                    const esCredito = montoBruto > 0;

                    // Detectar si es una devolución
                    const esDevolucion = String(descripcionBase).toLowerCase().includes('devolución de dinero');

                    todosLosMovimientos.push({
                        fecha,
                        descripcion: descripcionCompleta,
                        origen: 'Mercado Pago',
                        credito: esCredito ? montoBruto : 0,
                        debito: !esCredito ? Math.abs(montoBruto) : 0,
                        saldo: saldoDelArchivo
                    });

                    // NOTA: Las comisiones e impuestos ya están incluidas en la diferencia entre
                    // MONTO BRUTO y MONTO NETO, por lo que NO debemos desagregarlas del saldo.
                    // Las mostramos solo como información y todas comparten el mismo saldo del archivo.

                    // Si es una devolución, comisiones e impuestos también son devoluciones (créditos)
                    // Si no es devolución, son débitos normales

                    // Mostrar comisiones como información (mismo saldo)
                    if (comisionMP > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: esDevolucion ? 'Devolución - Comisión Mercado Pago (incluye IVA)' : 'Comisión Mercado Pago (incluye IVA)',
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? comisionMP : 0,
                            debito: esDevolucion ? 0 : comisionMP,
                            saldo: saldoDelArchivo
                        });
                    }

                    if (comisionCuotas > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: esDevolucion ? 'Devolución - Comisión por ofrecer cuotas sin interés' : 'Comisión por ofrecer cuotas sin interés',
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? comisionCuotas : 0,
                            debito: esDevolucion ? 0 : comisionCuotas,
                            saldo: saldoDelArchivo
                        });
                    }

                    if (costoEnvio > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: esDevolucion ? 'Devolución - Costo de envío' : 'Costo de envío',
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? costoEnvio : 0,
                            debito: esDevolucion ? 0 : costoEnvio,
                            saldo: saldoDelArchivo
                        });
                    }

                    if (cuponDescuento > 0) {
                        todosLosMovimientos.push({
                            fecha,
                            descripcion: esDevolucion ? 'Devolución - Cupón de descuento' : 'Cupón de descuento',
                            origen: 'Mercado Pago',
                            credito: esDevolucion ? cuponDescuento : 0,
                            debito: esDevolucion ? 0 : cuponDescuento,
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
                                            descripcion: descripcionReintegro,
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
                            descripcion: 'Costo por ofrecer descuento',
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
                                    descripcion: descripcionImpuesto,
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
                            descripcion: esDevolucion ? 'Devolución - Retenciones de Impuestos' : 'Retenciones de Impuestos',
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
