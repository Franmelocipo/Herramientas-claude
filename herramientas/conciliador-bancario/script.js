/**
 * Conciliador Bancario
 * Compara movimientos del Mayor Contable con Extractos Bancarios
 *
 * Formatos de archivo Mayor soportados:
 * - Tango (exportación "Mayor por cuenta analítico") - Sin modificaciones necesarias
 * - Formato genérico con columnas: Fecha, Debe, Haber, Leyenda/Descripción
 *
 * Lógica de conciliación:
 * - Debe del Mayor (entrada de dinero) = Crédito del Extracto
 * - Haber del Mayor (salida de dinero) = Débito del Extracto
 */

// Estado de la aplicación
let state = {
    tipoConciliacion: null, // 'creditos' o 'debitos'
    datosMayor: [],
    datosExtracto: [],
    toleranciaFecha: 30,
    toleranciaImporte: 20000,
    resultados: null,
    eliminados: [] // Movimientos del Mayor eliminados del proceso de conciliación
};

// Estado de selección para conciliación manual
let seleccion = {
    mayor: [],      // IDs de movimientos del Mayor seleccionados
    extracto: []    // IDs de movimientos del Extracto seleccionados
};

// Contador para IDs únicos de conciliaciones
let conciliacionIdCounter = 0;

// Estado de filtros para Mayor Pendiente
let filtrosMayor = {
    fechaDesde: null,
    fechaHasta: null,
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    numeroAsiento: '',
    leyenda: '',
    ce: 'todos',
    tipo: 'todos'
};

// Estado de filtros para Extracto Pendiente
let filtrosExtracto = {
    fechaDesde: null,
    fechaHasta: null,
    importeTipo: '',
    importeValor: null,
    importeValor2: null,
    descripcion: '',
    origen: ''
};

// Datos filtrados (para mantener la lista original intacta)
let mayorPendienteFiltrado = [];
let extractoPendienteFiltrado = [];

// Estado de ordenamiento para Mayor Pendiente
let ordenMayor = {
    columna: 'fecha',  // columna activa por defecto
    direccion: 'desc'  // 'asc' o 'desc'
};

// Estado de ordenamiento para Extracto Pendiente
let ordenExtracto = {
    columna: 'fecha',
    direccion: 'desc'
};

// Estado del progreso
let progreso = {
    paso: 1,
    totalPasos: 4,
    porcentaje: 0,
    procesados: 0,
    total: 0,
    conciliados: 0
};

// Historial de procesamiento/reprocesos
let historialProcesamiento = [];

// Tolerancias originales de la primera conciliación
let toleranciasIniciales = {
    fecha: null,
    importe: null
};

// Elementos del DOM
const elements = {
    // Pasos
    stepTipo: document.getElementById('step-tipo'),
    stepArchivos: document.getElementById('step-archivos'),
    stepTolerancias: document.getElementById('step-tolerancias'),
    stepEjecutar: document.getElementById('step-ejecutar'),

    // Botones de tipo
    tipoButtons: document.querySelectorAll('.type-btn'),

    // Archivos Mayor
    dropZoneMayor: document.getElementById('dropZoneMayor'),
    fileMayor: document.getElementById('fileMayor'),
    previewMayor: document.getElementById('previewMayor'),
    fileNameMayor: document.getElementById('fileNameMayor'),
    recordCountMayor: document.getElementById('recordCountMayor'),
    btnRemoveMayor: document.getElementById('btnRemoveMayor'),
    btnPlantillaMayor: document.getElementById('btnPlantillaMayor'),

    // Archivos Extracto
    dropZoneExtracto: document.getElementById('dropZoneExtracto'),
    fileExtracto: document.getElementById('fileExtracto'),
    previewExtracto: document.getElementById('previewExtracto'),
    fileNameExtracto: document.getElementById('fileNameExtracto'),
    recordCountExtracto: document.getElementById('recordCountExtracto'),
    btnRemoveExtracto: document.getElementById('btnRemoveExtracto'),
    btnPlantillaExtracto: document.getElementById('btnPlantillaExtracto'),

    // Tolerancias
    toleranciaFecha: document.getElementById('toleranciaFecha'),
    toleranciaImporte: document.getElementById('toleranciaImporte'),

    // Conciliación
    btnConciliar: document.getElementById('btnConciliar'),

    // Mensajes
    errorBox: document.getElementById('errorBox'),
    successBox: document.getElementById('successBox'),

    // Resultados
    resultados: document.getElementById('resultados'),
    totalConciliados: document.getElementById('totalConciliados'),
    mayorNoConciliado: document.getElementById('mayorNoConciliado'),
    extractoNoConciliado: document.getElementById('extractoNoConciliado'),
    totalMayor: document.getElementById('totalMayor'),
    totalExtracto: document.getElementById('totalExtracto'),
    diferencia: document.getElementById('diferencia'),
    tablaConciliados: document.getElementById('tablaConciliados'),
    tablaMayorPendiente: document.getElementById('tablaMayorPendiente'),
    tablaExtractoPendiente: document.getElementById('tablaExtractoPendiente'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    btnDescargar: document.getElementById('btnDescargar'),

    // Nueva conciliación
    btnNuevaConciliacion: document.getElementById('btnNuevaConciliacion'),

    // Selección manual
    selectionBar: document.getElementById('selectionBar'),
    selMayorCount: document.getElementById('selMayorCount'),
    selMayorTotal: document.getElementById('selMayorTotal'),
    selExtractoCount: document.getElementById('selExtractoCount'),
    selExtractoTotal: document.getElementById('selExtractoTotal'),
    selDiferencia: document.getElementById('selDiferencia'),
    btnVincular: document.getElementById('btnVincular'),
    btnLimpiarSeleccion: document.getElementById('btnLimpiarSeleccion'),
    selectAllMayor: document.getElementById('selectAllMayor'),
    selectAllExtracto: document.getElementById('selectAllExtracto'),
    countMayorPendiente: document.getElementById('countMayorPendiente'),
    countExtractoPendiente: document.getElementById('countExtractoPendiente'),
    countEliminados: document.getElementById('countEliminados'),
    tablaEliminados: document.getElementById('tablaEliminados'),
    btnEliminarSeleccionados: document.getElementById('btnEliminarSeleccionados'),

    // Modal de progreso
    overlayProgreso: document.getElementById('overlay-progreso'),
    modalProgreso: document.getElementById('modal-progreso'),
    barraProgreso: document.getElementById('barra-progreso'),
    porcentajeProgreso: document.getElementById('porcentaje-progreso'),
    pasoProgreso: document.getElementById('paso-progreso'),
    mensajeProgreso: document.getElementById('mensaje-progreso'),
    contadorProgreso: document.getElementById('contador-progreso'),
    conciliadosProgreso: document.getElementById('conciliados-progreso'),

    // Panel de reprocesamiento
    panelReproceso: document.getElementById('panel-reproceso'),
    panelReprocesoBody: document.getElementById('panelReprocesoBody'),
    btnToggleReproceso: document.getElementById('btnToggleReproceso'),
    reprocesoPendientesMayor: document.getElementById('reprocesoPendientesMayor'),
    reprocesoPendientesExtracto: document.getElementById('reprocesoPendientesExtracto'),
    reprocesoToleranciaFecha: document.getElementById('reproceso-tolerancia-fecha'),
    reprocesoToleranciaImporte: document.getElementById('reproceso-tolerancia-importe'),
    btnReprocesar: document.getElementById('btnReprocesar'),

    // Historial de procesamiento
    historialProcesamiento: document.getElementById('historial-procesamiento'),
    historialBody: document.getElementById('historialBody'),
    historialLista: document.getElementById('historialLista'),
    historialTotalConciliados: document.getElementById('historialTotalConciliados'),
    btnToggleHistorial: document.getElementById('btnToggleHistorial')
};

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', init);

function init() {
    // Event listeners para tipo de conciliación
    elements.tipoButtons.forEach(btn => {
        btn.addEventListener('click', () => seleccionarTipo(btn.dataset.tipo));
    });

    // Event listeners para carga de archivos
    setupFileUpload(elements.dropZoneMayor, elements.fileMayor, 'mayor');
    setupFileUpload(elements.dropZoneExtracto, elements.fileExtracto, 'extracto');

    // Botones de eliminar archivo
    elements.btnRemoveMayor.addEventListener('click', () => eliminarArchivo('mayor'));
    elements.btnRemoveExtracto.addEventListener('click', () => eliminarArchivo('extracto'));

    // Botones de plantilla
    elements.btnPlantillaMayor.addEventListener('click', () => descargarPlantilla('mayor'));
    elements.btnPlantillaExtracto.addEventListener('click', () => descargarPlantilla('extracto'));

    // Tolerancias
    elements.toleranciaFecha.addEventListener('change', () => {
        const valor = parseInt(elements.toleranciaFecha.value);
        // IMPORTANTE: No usar || porque 0 es un valor válido (tolerancia exacta)
        state.toleranciaFecha = isNaN(valor) ? 30 : valor;
    });
    elements.toleranciaImporte.addEventListener('change', () => {
        const valor = parseFloat(elements.toleranciaImporte.value);
        // IMPORTANTE: No usar || porque 0 es un valor válido (importe exacto)
        state.toleranciaImporte = isNaN(valor) ? 20000 : valor;
    });

    // Conciliar
    elements.btnConciliar.addEventListener('click', ejecutarConciliacion);

    // Tabs
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
    });

    // Descargar
    elements.btnDescargar.addEventListener('click', descargarReporte);

    // Nueva conciliación
    elements.btnNuevaConciliacion.addEventListener('click', reiniciar);

    // Conciliación manual
    elements.btnVincular.addEventListener('click', vincularManualmente);
    elements.btnLimpiarSeleccion.addEventListener('click', limpiarSeleccion);
    elements.selectAllMayor.addEventListener('change', (e) => seleccionarTodosMayor(e.target.checked));
    elements.selectAllExtracto.addEventListener('change', (e) => seleccionarTodosExtracto(e.target.checked));
}

// ========== SELECCIÓN DE TIPO ==========

function seleccionarTipo(tipo) {
    state.tipoConciliacion = tipo;

    // Actualizar UI de botones
    elements.tipoButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tipo === tipo);
    });

    // Mostrar siguiente paso
    elements.stepArchivos.classList.remove('hidden');
    elements.stepTolerancias.classList.remove('hidden');

    actualizarBotonConciliar();
}

// ========== CARGA DE ARCHIVOS ==========

function setupFileUpload(dropZone, fileInput, tipo) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            procesarArchivo(e.target.files[0], tipo);
        }
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            procesarArchivo(e.dataTransfer.files[0], tipo);
        }
    });
}

async function procesarArchivo(file, tipo) {
    try {
        mostrarMensaje('', 'clear');

        const data = await leerExcel(file);

        if (tipo === 'mayor') {
            state.datosMayor = parsearMayor(data);
            elements.fileNameMayor.textContent = file.name;
            elements.recordCountMayor.textContent = `${state.datosMayor.length} registros`;
            elements.previewMayor.classList.remove('hidden');
            elements.dropZoneMayor.style.display = 'none';
        } else {
            state.datosExtracto = parsearExtracto(data);
            elements.fileNameExtracto.textContent = file.name;
            elements.recordCountExtracto.textContent = `${state.datosExtracto.length} registros`;
            elements.previewExtracto.classList.remove('hidden');
            elements.dropZoneExtracto.style.display = 'none';
        }

        actualizarBotonConciliar();

    } catch (error) {
        mostrarMensaje(`Error al procesar archivo: ${error.message}`, 'error');
    }
}

function leerExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // IMPORTANTE: No usar cellDates para evitar problemas de conversión
                // Las fechas se manejan manualmente en parsearFecha()
                const workbook = XLSX.read(e.target.result, { type: 'array' });

                // Buscar hoja preferida para archivos Tango: "Mayor por cuenta analítico"
                // Si no existe, usar la primera hoja disponible
                let sheetName = workbook.SheetNames[0];
                const hojasTango = ['Mayor por cuenta analítico', 'Mayor por cuenta analitico'];
                for (const hojaTango of hojasTango) {
                    if (workbook.SheetNames.includes(hojaTango)) {
                        sheetName = hojaTango;
                        console.log(`Detectada hoja Tango: "${sheetName}"`);
                        break;
                    }
                }

                const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
                    raw: true,  // Mantener valores crudos (números seriales para fechas)
                    defval: ''
                });
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parsea datos del Mayor Contable.
 * Soporta múltiples formatos incluyendo:
 * - Tango (exportación "Mayor por cuenta analítico")
 * - Formato genérico con columnas estándar
 *
 * Mapeo de columnas Tango → Sistema:
 * - "Fecha asiento" → fecha
 * - "Leyenda movimiento" → leyenda (descripción)
 * - "Debe" → debe (entrada de dinero en cuenta bancaria)
 * - "Haber" → haber (salida de dinero de cuenta bancaria)
 * - "Saldo" → saldo (saldo acumulado)
 * - "Número asiento" → numeroAsiento
 * - "C/E" → ce
 * - "Tipo de asiento" → tipoAsiento
 *
 * Nota: Filas sin fecha válida o sin importe son ignoradas automáticamente.
 */
function parsearMayor(data) {
    return data.map((row, index) => {
        // Buscar columnas por diferentes nombres posibles (Tango, genérico, etc.)
        const fecha = parsearFecha(
            row['Fecha asiento'] || row['Fecha'] || row['fecha_asiento'] || row['fecha'] || ''
        );
        const numeroAsiento = row['Número asiento'] || row['Nº Asiento'] || row['numero_asiento'] || row['Numero'] || '';
        const ce = row['C/E'] || row['CE'] || row['c_e'] || '';
        const tipoAsiento = row['Tipo de asiento'] || row['Tipo'] || row['tipo_asiento'] || row['tipo'] || '';
        const leyenda = row['Leyenda movimiento'] || row['Leyenda'] || row['leyenda_movimiento'] || row['leyenda'] || row['Descripción'] || '';
        const debe = parsearImporte(row['Debe'] || row['debe'] || '0');
        const haber = parsearImporte(row['Haber'] || row['haber'] || '0');
        const saldo = parsearImporte(row['Saldo'] || row['saldo'] || '0');

        return {
            id: `M${index}`,
            fecha,
            numeroAsiento,
            ce,
            tipoAsiento,
            leyenda,
            debe,
            haber,
            saldo,
            importe: debe > 0 ? debe : haber,
            esDebe: debe > 0,
            usado: false
        };
    }).filter(row => row.fecha && (row.debe > 0 || row.haber > 0));
}

function parsearExtracto(data) {
    return data.map((row, index) => {
        const fecha = parsearFecha(
            row['Fecha'] || row['fecha'] || ''
        );
        const descripcion = row['Descripción'] || row['Descripcion'] || row['descripcion'] || '';
        const origen = row['Origen'] || row['origen'] || row['Referencia'] || '';
        const debito = parsearImporte(row['Débito'] || row['Debito'] || row['debito'] || '0');
        const credito = parsearImporte(row['Crédito'] || row['Credito'] || row['credito'] || '0');

        return {
            id: `E${index}`,
            fecha,
            descripcion,
            origen,
            debito,
            credito,
            importe: debito > 0 ? debito : credito,
            esDebito: debito > 0,
            usado: false
        };
    }).filter(row => row.fecha && (row.debito > 0 || row.credito > 0));
}

function parsearFecha(valor) {
    if (!valor) return null;

    let fecha = null;

    // Si ya es un objeto Date (poco probable con raw: true, pero por seguridad)
    if (valor instanceof Date) {
        if (!isNaN(valor.getTime())) {
            fecha = new Date(valor.getTime());
        }
    }
    // Si es un número serial de Excel
    else if (typeof valor === 'number') {
        // Excel usa número de días desde 1/1/1900
        // 25569 = días entre 1/1/1900 y 1/1/1970 (época Unix)
        // Valores típicos para fechas 2020-2030: ~44000-55000
        if (valor > 1 && valor < 100000) {
            // Usar UTC para evitar problemas de zona horaria
            const diasDesdeEpoch = (valor - 25569);
            fecha = new Date(Date.UTC(1970, 0, 1 + diasDesdeEpoch));
            // Convertir a fecha local sin cambio de hora
            fecha = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
        }
    }
    // Si es string
    else if (typeof valor === 'string' || valor) {
        const str = String(valor).trim();

        // Formato DD/MM/YYYY o DD-MM-YYYY (formato argentino)
        const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (matchDMY) {
            let num1 = parseInt(matchDMY[1], 10);
            let num2 = parseInt(matchDMY[2], 10);
            let anio = parseInt(matchDMY[3], 10);

            // Si el año tiene 2 dígitos, asumir 2000+
            if (anio < 100) anio += 2000;

            // Determinar si es DD/MM o MM/DD
            // Si num1 > 12, definitivamente es el día (formato DD/MM/YYYY)
            // Si num2 > 12, definitivamente es el día (formato MM/DD/YYYY)
            // Si ambos <= 12, asumimos DD/MM/YYYY (formato argentino)
            let dia, mes;

            if (num1 > 12 && num2 <= 12) {
                // num1 es día (DD/MM/YYYY)
                dia = num1;
                mes = num2 - 1;
            } else if (num2 > 12 && num1 <= 12) {
                // num2 es día (MM/DD/YYYY) - formato americano
                dia = num2;
                mes = num1 - 1;
            } else {
                // Ambos <= 12, asumimos formato argentino DD/MM/YYYY
                dia = num1;
                mes = num2 - 1;
            }

            // Validar que la fecha sea válida
            if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
                fecha = new Date(anio, mes, dia);
                // Verificar que la fecha creada coincida (evitar rollover de meses)
                if (fecha.getDate() !== dia || fecha.getMonth() !== mes) {
                    fecha = null; // Fecha inválida
                }
            }
        }

        // Si no matcheó o falló, intentar formato YYYY-MM-DD (ISO)
        if (!fecha) {
            const matchISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
            if (matchISO) {
                const anio = parseInt(matchISO[1], 10);
                const mes = parseInt(matchISO[2], 10) - 1;
                const dia = parseInt(matchISO[3], 10);
                if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
                    fecha = new Date(anio, mes, dia);
                }
            }
        }

        // Último recurso: parseo nativo (NO recomendado, puede dar resultados inesperados)
        if (!fecha && str.length > 0) {
            const parsed = Date.parse(str);
            if (!isNaN(parsed)) {
                const tempDate = new Date(parsed);
                // Solo aceptar si el año es razonable (1990-2099)
                if (tempDate.getFullYear() >= 1990 && tempDate.getFullYear() <= 2099) {
                    fecha = tempDate;
                }
            }
        }
    }

    // Corrección de años para datos financieros (rango razonable: 2010-2030)
    if (fecha) {
        const anioActual = new Date().getFullYear();
        const anioFecha = fecha.getFullYear();

        // Corregir años muy antiguos (1920-1950) → probablemente son 2020-2050
        if (anioFecha >= 1920 && anioFecha <= 1950) {
            fecha.setFullYear(anioFecha + 100);
        }
        // Corregir años en rango 100-199 → probablemente falta el "20" adelante
        else if (anioFecha >= 100 && anioFecha <= 199) {
            fecha.setFullYear(anioFecha + 1900);
        }
        // NO corregir años futuros cercanos (hasta 2030) - son válidos para proyecciones
        // Solo corregir si es un año muy lejano (> 2050)
        else if (anioFecha > 2050 && anioFecha <= 2150) {
            fecha.setFullYear(anioFecha - 100);
        }
    }

    return fecha;
}

function parsearImporte(valor) {
    if (!valor && valor !== 0) return 0;

    let str = String(valor).trim();

    // Remover símbolos de moneda y espacios
    str = str.replace(/[$\s]/g, '');

    // Detectar formato argentino (1.234.567,89) vs internacional (1,234,567.89)
    const tieneComaDecimal = /\d+,\d{2}$/.test(str);
    const tienePuntoDecimal = /\d+\.\d{2}$/.test(str);

    if (tieneComaDecimal) {
        // Formato argentino: puntos son miles, coma es decimal
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (!tienePuntoDecimal && str.includes(',')) {
        // Si tiene coma pero no es decimal (ej: 1,234,567)
        str = str.replace(/,/g, '');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.abs(num);
}

function eliminarArchivo(tipo) {
    if (tipo === 'mayor') {
        state.datosMayor = [];
        elements.fileMayor.value = '';
        elements.previewMayor.classList.add('hidden');
        elements.dropZoneMayor.style.display = 'block';
    } else {
        state.datosExtracto = [];
        elements.fileExtracto.value = '';
        elements.previewExtracto.classList.add('hidden');
        elements.dropZoneExtracto.style.display = 'block';
    }

    actualizarBotonConciliar();
}

// ========== PLANTILLAS ==========

function descargarPlantilla(tipo) {
    let data, filename;

    if (tipo === 'mayor') {
        // Plantilla compatible con formato Tango "Mayor por cuenta analítico"
        data = [
            ['Fecha asiento', 'Número asiento', 'C/E', 'Tipo de asiento', 'Leyenda movimiento', 'Debe', 'Haber', 'Saldo'],
            ['01/08/2024', '29001', 'E', 'CN', 'Dinastibasa S.R.L () Recibo Nº0003-00009659', '519417.57', '', '68948032.73'],
            ['01/08/2024', '29002', 'E', 'CN', 'IMP.DEB/CRED P/CRED.', '', '27165.83', '68920866.90'],
            ['02/08/2024', '29003', 'S', 'PA', 'Pago a proveedor ABC S.A.', '', '200000', '68720866.90']
        ];
        filename = 'Plantilla_Mayor_Contable.xlsx';
    } else {
        data = [
            ['Fecha', 'Descripción', 'Origen', 'Débito', 'Crédito'],
            ['01/08/2024', 'LIQ COMER VISA', '80951234', '', '150000'],
            ['02/08/2024', 'LIQ COMER MASTERCARD', '80951235', '', '85500'],
            ['03/08/2024', 'TRANSF A TERCEROS', 'OP123456', '200000', '']
        ];
        filename = 'Plantilla_Extracto_Bancario.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // Ajustar anchos de columna
    ws['!cols'] = data[0].map((_, i) => ({ wch: Math.max(...data.map(row => String(row[i] || '').length)) + 2 }));

    XLSX.writeFile(wb, filename);
}

// ========== MODAL DE PROGRESO ==========

function mostrarModalProgreso() {
    // Resetear estado de progreso
    progreso = {
        paso: 1,
        totalPasos: 4,
        porcentaje: 0,
        procesados: 0,
        total: 0,
        conciliados: 0
    };

    // Resetear UI del modal
    actualizarProgreso(0, 'Iniciando...');
    actualizarPaso(1, 'Cargando y validando datos...');
    elements.contadorProgreso.textContent = '';
    elements.conciliadosProgreso.textContent = '';

    // Mostrar modal
    elements.overlayProgreso.classList.add('visible');
    elements.modalProgreso.classList.add('visible');
}

function cerrarModalProgreso() {
    elements.overlayProgreso.classList.remove('visible');
    elements.modalProgreso.classList.remove('visible');
}

function actualizarProgreso(porcentaje, mensaje) {
    progreso.porcentaje = porcentaje;
    elements.barraProgreso.style.width = porcentaje + '%';
    elements.porcentajeProgreso.textContent = Math.round(porcentaje) + '%';
    if (mensaje) {
        elements.mensajeProgreso.textContent = mensaje;
    }
}

function actualizarPaso(paso, mensaje) {
    progreso.paso = paso;
    elements.pasoProgreso.textContent = `Paso ${paso} de ${progreso.totalPasos}`;
    if (mensaje) {
        elements.mensajeProgreso.textContent = mensaje;
    }
}

function actualizarContador(procesados, total) {
    progreso.procesados = procesados;
    progreso.total = total;
    elements.contadorProgreso.textContent = `Procesados: ${procesados} de ${total} movimientos`;
}

function actualizarConciliados(cantidad) {
    progreso.conciliados = cantidad;
    elements.conciliadosProgreso.textContent = `Conciliados hasta ahora: ${cantidad}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== CONCILIACIÓN ==========

function actualizarBotonConciliar() {
    const habilitado = state.tipoConciliacion &&
                       state.datosMayor.length > 0 &&
                       state.datosExtracto.length > 0;

    elements.btnConciliar.disabled = !habilitado;

    if (habilitado) {
        elements.stepEjecutar.classList.remove('hidden');
    }
}

async function ejecutarConciliacion() {
    try {
        mostrarMensaje('', 'clear');
        mostrarModalProgreso();

        // Paso 1: Cargando y validando datos
        actualizarPaso(1, 'Cargando y validando datos...');
        actualizarProgreso(5);
        await sleep(100); // Permitir render

        // Reiniciar contador de conciliaciones y selección
        conciliacionIdCounter = 0;
        seleccion = { mayor: [], extracto: [] };

        // Actualizar tolerancias
        // IMPORTANTE: No usar || porque 0 es un valor válido (coincidencia exacta)
        const valorFecha = parseInt(elements.toleranciaFecha.value);
        const valorImporte = parseFloat(elements.toleranciaImporte.value);
        state.toleranciaFecha = isNaN(valorFecha) ? 30 : valorFecha;
        state.toleranciaImporte = isNaN(valorImporte) ? 20000 : valorImporte;

        // DEBUG: Mostrar tolerancias configuradas
        console.log('Tolerancias configuradas:', {
            fecha: state.toleranciaFecha,
            importe: state.toleranciaImporte,
            valorFechaInput: elements.toleranciaFecha.value,
            valorImporteInput: elements.toleranciaImporte.value
        });

        // Filtrar datos según el tipo de conciliación
        let mayorFiltrado, extractoFiltrado;

        if (state.tipoConciliacion === 'creditos') {
            // Créditos (entradas de dinero): Debe del Mayor = Crédito del Extracto
            // La cuenta Banco es un ACTIVO: cuando entra dinero, el activo AUMENTA → se registra en DEBE
            mayorFiltrado = state.datosMayor.filter(m => m.debe > 0).map(m => ({...m, importe: m.debe, usado: false}));
            extractoFiltrado = state.datosExtracto.filter(e => e.credito > 0).map(e => ({...e, importe: e.credito, usado: false}));
        } else {
            // Débitos (salidas de dinero): Haber del Mayor = Débito del Extracto
            // La cuenta Banco es un ACTIVO: cuando sale dinero, el activo DISMINUYE → se registra en HABER
            mayorFiltrado = state.datosMayor.filter(m => m.haber > 0).map(m => ({...m, importe: m.haber, usado: false}));
            extractoFiltrado = state.datosExtracto.filter(e => e.debito > 0).map(e => ({...e, importe: e.debito, usado: false}));
        }

        actualizarProgreso(15, 'Datos validados correctamente');
        await sleep(100);

        // Ejecutar algoritmo de conciliación con progreso
        state.resultados = await conciliar(mayorFiltrado, extractoFiltrado);

        // Paso 4: Generando resultados
        actualizarPaso(4, 'Generando resultados...');
        actualizarProgreso(95);
        await sleep(100);

        // Mostrar resultados
        mostrarResultados();

        // Guardar el procesamiento inicial en el historial
        guardarProcesamientoInicial(state.resultados.conciliados.length);

        // Mostrar panel de reprocesamiento
        actualizarPanelReproceso();

        // Completar progreso
        actualizarProgreso(100, '¡Conciliación completada!');
        await sleep(800);

        cerrarModalProgreso();

    } catch (error) {
        cerrarModalProgreso();
        mostrarMensaje(`Error en la conciliación: ${error.message}`, 'error');
    }
}

async function conciliar(mayor, extracto) {
    const conciliados = [];
    const mayorNoConciliado = [...mayor];
    const extractoNoConciliado = [...extracto];

    const totalMovimientos = mayor.length + extracto.length;
    let procesados = 0;

    // Paso 2: Buscar coincidencias exactas (1 a 1)
    actualizarPaso(2, 'Buscando coincidencias exactas (1 a 1)...');
    actualizarProgreso(20);
    actualizarContador(0, totalMovimientos);
    actualizarConciliados(0);
    await sleep(50);

    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const idxCoincidencia = buscarCoincidenciaExacta(movMayor, extractoNoConciliado);

        if (idxCoincidencia !== -1) {
            const movExtracto = extractoNoConciliado[idxCoincidencia];
            const diferencia = Math.abs(movMayor.importe - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:1',
                mayor: [movMayor],
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            extractoNoConciliado.splice(idxCoincidencia, 1);
        }

        procesados++;

        // Actualizar UI cada 10 movimientos para no bloquear
        if (procesados % 10 === 0 || i === 0) {
            const progresoActual = 20 + (procesados / totalMovimientos) * 25;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    // Paso 3: Buscar coincidencias 1 a muchos (Mayor vs suma de Extracto)
    actualizarPaso(3, 'Buscando coincidencias múltiples (1 a N)...');
    actualizarProgreso(50);
    await sleep(50);

    const mayorRestante = mayorNoConciliado.length;
    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movMayor.importe,
            movMayor.fecha,
            extractoNoConciliado,
            5 // máximo 5 movimientos
        );

        if (combinacion) {
            const sumaExtracto = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(movMayor.importe - sumaExtracto);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:N',
                mayor: [movMayor],
                extracto: combinacion,
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = extractoNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) extractoNoConciliado.splice(idx, 1);
            });
        }

        procesados++;

        // Actualizar UI cada 5 movimientos (es más lento por las combinaciones)
        if (procesados % 5 === 0 || i === 0) {
            const progresoActual = 50 + ((mayorRestante - i) / mayorRestante) * 20;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    // Paso 3b: Buscar coincidencias muchos a 1 (suma de Mayor vs Extracto)
    // IMPORTANTE: Para este tipo de conciliación, validamos que todos los movimientos
    // del mayor sean de la misma entidad/cliente para evitar agrupar movimientos
    // de diferentes clientes solo porque la suma coincide
    actualizarPaso(3, 'Buscando coincidencias múltiples (N a 1)...');
    actualizarProgreso(70);
    await sleep(50);

    const extractoRestante = extractoNoConciliado.length;
    for (let i = extractoNoConciliado.length - 1; i >= 0; i--) {
        const movExtracto = extractoNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movExtracto.importe,
            movExtracto.fecha,
            mayorNoConciliado,
            5,
            true // Validar que los movimientos sean de la misma entidad
        );

        if (combinacion) {
            const sumaMayor = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(sumaMayor - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: 'N:1',
                mayor: combinacion,
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            extractoNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = mayorNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) mayorNoConciliado.splice(idx, 1);
            });
        }

        procesados++;

        // Actualizar UI cada 5 movimientos
        if (procesados % 5 === 0 || i === 0) {
            const progresoActual = 70 + ((extractoRestante - i) / Math.max(extractoRestante, 1)) * 20;
            actualizarProgreso(progresoActual);
            actualizarContador(procesados, totalMovimientos);
            actualizarConciliados(conciliados.length);
            await sleep(0);
        }
    }

    return {
        conciliados,
        mayorNoConciliado,
        extractoNoConciliado
    };
}

function buscarCoincidenciaExacta(movMayor, listaExtracto) {
    for (let i = 0; i < listaExtracto.length; i++) {
        const movExtracto = listaExtracto[i];

        // Verificar tolerancia de importe
        const difImporte = Math.abs(movMayor.importe - movExtracto.importe);

        // DEBUG: Descomentar para ver comparaciones de importes
        // console.log('Comparando importes:', movMayor.importe, movExtracto.importe,
        //     'Diff:', difImporte, 'Tolerancia:', state.toleranciaImporte,
        //     'Acepta:', difImporte <= state.toleranciaImporte);

        if (difImporte > state.toleranciaImporte) continue;

        // Verificar tolerancia de fecha
        if (!fechaDentroTolerancia(movMayor.fecha, movExtracto.fecha)) continue;

        return i;
    }

    return -1;
}

/**
 * Busca una combinación de movimientos que sumen el importe objetivo.
 *
 * @param {number} importeObjetivo - Importe a alcanzar
 * @param {Date} fechaRef - Fecha de referencia para filtrar por tolerancia
 * @param {Array} lista - Lista de movimientos candidatos
 * @param {number} maxElementos - Máximo de elementos a combinar
 * @param {boolean} validarEntidades - Si es true, valida que todos los movimientos sean de la misma entidad
 * @returns {Array|null} Combinación encontrada o null
 */
function buscarCombinacionQueSume(importeObjetivo, fechaRef, lista, maxElementos, validarEntidades = false) {
    // Filtrar por fecha primero
    const candidatos = lista.filter(m => fechaDentroTolerancia(fechaRef, m.fecha));

    if (candidatos.length === 0) return null;

    // Buscar combinaciones de 2 a maxElementos elementos
    for (let n = 2; n <= Math.min(maxElementos, candidatos.length); n++) {
        const resultado = encontrarCombinacion(candidatos, importeObjetivo, n, validarEntidades);
        if (resultado) return resultado;
    }

    return null;
}

/**
 * Busca una combinación de n elementos que sume el importe objetivo.
 *
 * @param {Array} lista - Lista de movimientos candidatos
 * @param {number} objetivo - Importe objetivo a alcanzar
 * @param {number} n - Cantidad exacta de elementos a combinar
 * @param {boolean} validarEntidades - Si es true, valida que todos los movimientos sean de la misma entidad
 * @returns {Array|null} Combinación encontrada o null
 */
function encontrarCombinacion(lista, objetivo, n, validarEntidades = false) {
    const indices = [];

    function buscar(start, suma, count) {
        // Verificar si encontramos una combinación válida
        if (count === n) {
            const diferencia = Math.abs(suma - objetivo);
            if (diferencia <= state.toleranciaImporte) {
                const combinacion = indices.map(i => lista[i]);

                // Si se requiere validación de entidades, verificar que todos
                // los movimientos sean de la misma entidad/cliente
                if (validarEntidades && !validarMismaEntidad(combinacion)) {
                    return null; // Rechazar combinación de diferentes entidades
                }

                return combinacion;
            }
            return null;
        }

        // Buscar más elementos
        for (let i = start; i < lista.length; i++) {
            indices.push(i);
            const resultado = buscar(i + 1, suma + lista[i].importe, count + 1);
            if (resultado) return resultado;
            indices.pop();
        }

        return null;
    }

    return buscar(0, 0, 0);
}

function fechaDentroTolerancia(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return false;

    // Normalizar ambas fechas a medianoche para comparar solo días
    const f1 = new Date(fecha1);
    const f2 = new Date(fecha2);
    f1.setHours(0, 0, 0, 0);
    f2.setHours(0, 0, 0, 0);

    const diffMs = Math.abs(f1.getTime() - f2.getTime());
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // CRÍTICO: Si tolerancia es 0, las fechas deben ser exactamente iguales
    // Usar comparación estricta para evitar coerción de tipos
    if (state.toleranciaFecha === 0) {
        const resultado = diffDias === 0;
        // DEBUG: Descomentar para diagnosticar problemas de tolerancia 0
        // console.log('=== COMPARACIÓN DE FECHAS (tolerancia 0) ===');
        // console.log('Fecha 1:', f1.toLocaleDateString('es-AR'));
        // console.log('Fecha 2:', f2.toLocaleDateString('es-AR'));
        // console.log('Diferencia en días:', diffDias);
        // console.log('¿Dentro de tolerancia?:', resultado);
        return resultado;
    }

    return diffDias <= state.toleranciaFecha;
}

// ========== VALIDACIÓN DE ENTIDADES PARA CONCILIACIONES N:1 ==========

/**
 * Extrae el nombre de la entidad/cliente de una leyenda del mayor.
 * La función normaliza el texto y extrae las primeras palabras significativas
 * que generalmente corresponden al nombre del cliente/proveedor.
 *
 * @param {string} texto - Leyenda del movimiento
 * @returns {string} Nombre de entidad normalizado
 */
function extraerEntidad(texto) {
    if (!texto || typeof texto !== 'string') return '';

    // Normalizar: quitar acentos, convertir a minúsculas
    let normalizado = texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // Eliminar prefijos comunes que no identifican la entidad
    const prefijosIgnorar = [
        /^rec\.?\s*/i,           // Rec. o Rec
        /^recibo\s*/i,           // Recibo
        /^pago\s*/i,             // Pago
        /^cobro\s*/i,            // Cobro
        /^fact\.?\s*/i,          // Fact. o Factura
        /^factura\s*/i,
        /^nota\s+de\s+credito\s*/i,
        /^nc\s*/i,               // NC (Nota de Crédito)
        /^nd\s*/i,               // ND (Nota de Débito)
        /^op\s*/i,               // OP (Orden de Pago)
        /^transferencia\s*/i,
        /^trf\.?\s*/i,
        /^dep\.?\s*/i,           // Dep. o Depósito
        /^deposito\s*/i,
        /^cheque\s*/i,
        /^ch\.?\s*/i,
    ];

    for (const prefijo of prefijosIgnorar) {
        normalizado = normalizado.replace(prefijo, '');
    }

    // Eliminar números de documento/recibo al final o paréntesis con info adicional
    normalizado = normalizado
        .replace(/\s*\(.*\)\s*$/g, '')      // (info adicional)
        .replace(/\s*n[º°]?\s*\d+.*$/gi, '') // Nº 12345...
        .replace(/\s+\d{4,}.*$/g, '')        // números largos al final
        .replace(/\s+-\s+.*$/g, '')          // - info adicional
        .trim();

    // Extraer las primeras palabras significativas (máximo 4 palabras para el nombre)
    const palabras = normalizado.split(/\s+/).filter(p => p.length > 1);

    // Si quedan menos de 1 palabra significativa, retornar el texto original normalizado
    if (palabras.length === 0) {
        return texto.toLowerCase().trim().substring(0, 30);
    }

    // Retornar las primeras 4 palabras como identificador de entidad
    return palabras.slice(0, 4).join(' ');
}

/**
 * Calcula la similitud entre dos entidades usando el coeficiente de Jaccard
 * sobre los tokens (palabras) de cada nombre.
 *
 * @param {string} entidad1 - Primera entidad
 * @param {string} entidad2 - Segunda entidad
 * @returns {number} Coeficiente de similitud entre 0 y 1
 */
function calcularSimilitudEntidades(entidad1, entidad2) {
    if (!entidad1 || !entidad2) return 0;

    // Si son exactamente iguales
    if (entidad1 === entidad2) return 1;

    // Tokenizar ambas entidades
    const tokens1 = new Set(entidad1.split(/\s+/).filter(t => t.length > 1));
    const tokens2 = new Set(entidad2.split(/\s+/).filter(t => t.length > 1));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    // Calcular intersección
    const interseccion = new Set([...tokens1].filter(t => tokens2.has(t)));

    // Coeficiente de Jaccard: |A ∩ B| / |A ∪ B|
    const union = new Set([...tokens1, ...tokens2]);
    const jaccard = interseccion.size / union.size;

    // También verificar si una entidad contiene a la otra (para casos como "Juan" vs "Juan Perez")
    const contieneBonus = (entidad1.includes(entidad2) || entidad2.includes(entidad1)) ? 0.3 : 0;

    return Math.min(1, jaccard + contieneBonus);
}

/**
 * Valida que todos los movimientos de una combinación correspondan a la misma entidad.
 * Esta función es crítica para evitar conciliaciones incorrectas donde se agrupan
 * movimientos de diferentes clientes solo porque la suma de importes coincide.
 *
 * @param {Array} movimientos - Array de movimientos del mayor
 * @returns {boolean} true si todos los movimientos son de la misma entidad
 */
function validarMismaEntidad(movimientos) {
    if (!movimientos || movimientos.length < 2) return true;

    // Extraer entidades de cada movimiento
    const entidades = movimientos.map(m => extraerEntidad(m.leyenda || ''));

    // Verificar que todas las entidades sean similares a la primera
    const entidadBase = entidades[0];

    // Umbral de similitud requerido para considerar que son la misma entidad
    // Usamos un umbral relativamente bajo (0.3) porque los nombres pueden variar
    // pero debe haber al menos algo en común
    const UMBRAL_SIMILITUD = 0.3;

    for (let i = 1; i < entidades.length; i++) {
        const similitud = calcularSimilitudEntidades(entidadBase, entidades[i]);

        if (similitud < UMBRAL_SIMILITUD) {
            // Las entidades son muy diferentes - no permitir esta combinación
            // console.log(`Entidades diferentes detectadas: "${entidadBase}" vs "${entidades[i]}" (similitud: ${similitud.toFixed(2)})`);
            return false;
        }
    }

    return true;
}

// ========== MOSTRAR RESULTADOS ==========

function mostrarResultados() {
    const res = state.resultados;

    // Calcular totales
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);

    const totalMayor = totalConciliadoMayor + totalMayorPendiente;
    const totalExtracto = totalConciliadoExtracto + totalExtractoPendiente;

    // Actualizar resumen
    elements.totalConciliados.textContent = res.conciliados.length;
    elements.mayorNoConciliado.textContent = res.mayorNoConciliado.length;
    elements.extractoNoConciliado.textContent = res.extractoNoConciliado.length;

    elements.totalMayor.textContent = formatearMoneda(totalMayor);
    elements.totalExtracto.textContent = formatearMoneda(totalExtracto);
    elements.diferencia.textContent = formatearMoneda(Math.abs(totalMayor - totalExtracto));

    // Color de diferencia
    const difElement = document.querySelector('.total-row.diferencia .total-value');
    if (Math.abs(totalMayor - totalExtracto) > 0) {
        difElement.style.color = '#dc2626';
    } else {
        difElement.style.color = '#059669';
    }

    // Llenar tablas
    llenarTablaConciliados(res.conciliados);
    llenarTablaMayorPendiente(res.mayorNoConciliado);
    llenarTablaExtractoPendiente(res.extractoNoConciliado);
    llenarTablaEliminados();

    // Poblar selector de tipos para el filtro de Mayor
    poblarSelectorTiposMayor();

    // Mostrar sección de resultados
    elements.resultados.classList.remove('hidden');

    // Scroll a resultados
    elements.resultados.scrollIntoView({ behavior: 'smooth' });
}

function llenarTablaConciliados(conciliados) {
    let html = '';

    conciliados.forEach((match, idx) => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);

        for (let i = 0; i < maxRows; i++) {
            const m = match.mayor[i];
            const e = match.extracto[i];
            const isFirst = i === 0;
            const isSubRow = i > 0;
            const manualClass = match.manual ? ' row-manual' : '';

            html += `<tr class="${isFirst ? 'match-group' : 'sub-row'}${manualClass}">`;

            // Columnas Mayor
            if (m) {
                html += `
                    <td class="col-fecha">${formatearFecha(m.fecha)}</td>
                    <td class="col-numero">${m.numeroAsiento}</td>
                    <td class="col-leyenda" title="${m.leyenda}">${truncar(m.leyenda, 30)}</td>
                    <td class="col-importe">${formatearNumero(m.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-numero"></td><td class="col-leyenda"></td><td class="col-importe"></td>';
            }

            // Separador
            html += '<td class="separator"></td>';

            // Columnas Extracto
            if (e) {
                html += `
                    <td class="col-fecha">${formatearFecha(e.fecha)}</td>
                    <td class="col-descripcion" title="${e.descripcion}">${truncar(e.descripcion, 25)}</td>
                    <td class="col-origen">${e.origen}</td>
                    <td class="col-importe">${formatearNumero(e.importe)}</td>
                `;
            } else {
                html += '<td class="col-fecha"></td><td class="col-descripcion"></td><td class="col-origen"></td><td class="col-importe"></td>';
            }

            // Diferencia (solo en primera fila)
            if (isFirst) {
                const colorClass = match.diferencia > 0 ? 'text-red' : 'text-green';
                html += `<td class="col-diferencia ${colorClass}">${match.diferencia > 0 ? formatearNumero(match.diferencia) : '-'}</td>`;
            } else {
                html += '<td class="col-diferencia"></td>';
            }

            // Botón de acción (solo en primera fila)
            if (isFirst) {
                const manualBadge = match.manual ? '<span class="badge-manual">Manual</span>' : '';
                // Badge de reproceso con tooltip que muestra los parámetros utilizados
                let reprocesoBadge = '';
                if (match.reproceso && match.parametrosReproceso) {
                    const tooltipText = `Reproceso #${match.parametrosReproceso.numeroReproceso}: ${match.parametrosReproceso.toleranciaFecha} días, $${match.parametrosReproceso.toleranciaImporte.toLocaleString('es-AR')}`;
                    reprocesoBadge = `<span class="badge-reproceso" title="${tooltipText}">🔄 Rep</span>`;
                }
                html += `
                    <td class="col-action">
                        ${manualBadge}${reprocesoBadge}
                        <button class="btn-desconciliar" onclick="desconciliar('${match.id}')" title="Desconciliar">
                            ✕
                        </button>
                    </td>
                `;
            } else {
                html += '<td class="col-action"></td>';
            }

            html += '</tr>';
        }
    });

    elements.tablaConciliados.innerHTML = html || '<tr><td colspan="11" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos conciliados</td></tr>';
}

function llenarTablaMayorPendiente(pendientes) {
    let html = '';

    // Actualizar contador en header
    elements.countMayorPendiente.textContent = `(${pendientes.length})`;

    // Aplicar ordenamiento
    const pendientesOrdenados = aplicarOrdenamiento(pendientes, 'mayor');

    pendientesOrdenados.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Mayor fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllMayor) {
        elements.selectAllMayor.checked = false;
    }

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('mayor');
}

function llenarTablaExtractoPendiente(pendientes) {
    let html = '';

    // Actualizar contador en header
    elements.countExtractoPendiente.textContent = `(${pendientes.length})`;

    // Aplicar ordenamiento
    const pendientesOrdenados = aplicarOrdenamiento(pendientes, 'extracto');

    pendientesOrdenados.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Extracto fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllExtracto) {
        elements.selectAllExtracto.checked = false;
    }

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('extracto');
}

// ========== CONCILIACIÓN MANUAL ==========

/**
 * Desconciliar un grupo de movimientos conciliados
 */
function desconciliar(idConciliacion) {
    if (!state.resultados) return;

    const grupo = state.resultados.conciliados.find(c => c.id === idConciliacion);
    if (!grupo) {
        console.warn('No se encontró la conciliación:', idConciliacion);
        return;
    }

    // Mostrar confirmación
    const cantMayor = grupo.mayor.length;
    const cantExtracto = grupo.extracto.length;
    const mensaje = `¿Desea desconciliar estos movimientos?\n\n` +
                   `• ${cantMayor} movimiento(s) del Mayor\n` +
                   `• ${cantExtracto} movimiento(s) del Extracto`;

    if (!confirm(mensaje)) return;

    // Mover movimientos a las listas de pendientes
    state.resultados.mayorNoConciliado.push(...grupo.mayor);
    state.resultados.extractoNoConciliado.push(...grupo.extracto);

    // Eliminar de conciliados
    state.resultados.conciliados = state.resultados.conciliados.filter(c => c.id !== idConciliacion);

    // Actualizar vistas
    llenarTablaConciliados(state.resultados.conciliados);
    llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    actualizarTotalesYContadores();

    mostrarMensaje('Movimientos desconciliados correctamente', 'success');
}

/**
 * Vincular manualmente los movimientos seleccionados
 */
function vincularManualmente() {
    if (!state.resultados) return;

    // Obtener movimientos seleccionados
    const movsMayor = state.resultados.mayorNoConciliado.filter(m => seleccion.mayor.includes(m.id));
    const movsExtracto = state.resultados.extractoNoConciliado.filter(e => seleccion.extracto.includes(e.id));

    if (movsMayor.length === 0 || movsExtracto.length === 0) {
        alert('Debe seleccionar al menos un movimiento de cada lista (Mayor y Extracto)');
        return;
    }

    // Calcular diferencia
    const sumaMayor = movsMayor.reduce((sum, m) => sum + m.importe, 0);
    const sumaExtracto = movsExtracto.reduce((sum, e) => sum + e.importe, 0);
    const diferencia = Math.abs(sumaMayor - sumaExtracto);

    // Validar tolerancia
    if (diferencia > state.toleranciaImporte) {
        const mensaje = `La diferencia (${formatearMoneda(diferencia)}) excede la tolerancia configurada (${formatearMoneda(state.toleranciaImporte)}).\n\n¿Desea vincular de todos modos?`;
        if (!confirm(mensaje)) return;
    }

    // Crear nueva conciliación manual
    const nuevaConciliacion = {
        id: 'conc_' + (++conciliacionIdCounter),
        tipo: movsMayor.length > 1 && movsExtracto.length > 1 ? 'N:N' :
              movsMayor.length > 1 ? 'N:1' :
              movsExtracto.length > 1 ? '1:N' : '1:1',
        mayor: movsMayor,
        extracto: movsExtracto,
        diferencia: diferencia,
        manual: true
    };

    // Agregar a conciliados
    state.resultados.conciliados.push(nuevaConciliacion);

    // Remover de pendientes
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(
        m => !seleccion.mayor.includes(m.id)
    );
    state.resultados.extractoNoConciliado = state.resultados.extractoNoConciliado.filter(
        e => !seleccion.extracto.includes(e.id)
    );

    // Limpiar selección
    limpiarSeleccion();

    // Actualizar vistas
    llenarTablaConciliados(state.resultados.conciliados);
    llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    actualizarTotalesYContadores();

    // Cambiar a pestaña de conciliados para ver el resultado
    cambiarTab('conciliados');

    mostrarMensaje('Movimientos vinculados manualmente como conciliados', 'success');
}

/**
 * Toggle selección de un movimiento del Mayor
 */
function toggleSeleccionMayor(id, checked) {
    if (checked) {
        if (!seleccion.mayor.includes(id)) {
            seleccion.mayor.push(id);
        }
    } else {
        seleccion.mayor = seleccion.mayor.filter(i => i !== id);
    }

    // Actualizar clase visual en la fila
    const row = document.querySelector(`#tablaMayorPendiente tr[data-id="${id}"]`);
    if (row) {
        row.classList.toggle('row-selected', checked);
    }

    actualizarBarraSeleccion();
}

/**
 * Toggle selección de un movimiento del Extracto
 */
function toggleSeleccionExtracto(id, checked) {
    if (checked) {
        if (!seleccion.extracto.includes(id)) {
            seleccion.extracto.push(id);
        }
    } else {
        seleccion.extracto = seleccion.extracto.filter(i => i !== id);
    }

    // Actualizar clase visual en la fila
    const row = document.querySelector(`#tablaExtractoPendiente tr[data-id="${id}"]`);
    if (row) {
        row.classList.toggle('row-selected', checked);
    }

    actualizarBarraSeleccion();
}

/**
 * Seleccionar/deseleccionar todos los movimientos del Mayor pendiente
 */
function seleccionarTodosMayor(checked) {
    if (!state.resultados) return;

    if (checked) {
        seleccion.mayor = state.resultados.mayorNoConciliado.map(m => m.id);
    } else {
        seleccion.mayor = [];
    }

    // Actualizar checkboxes y clases visuales
    document.querySelectorAll('.checkbox-mayor').forEach(cb => {
        cb.checked = checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });

    actualizarBarraSeleccion();
}

/**
 * Seleccionar/deseleccionar todos los movimientos del Extracto pendiente
 */
function seleccionarTodosExtracto(checked) {
    if (!state.resultados) return;

    if (checked) {
        seleccion.extracto = state.resultados.extractoNoConciliado.map(e => e.id);
    } else {
        seleccion.extracto = [];
    }

    // Actualizar checkboxes y clases visuales
    document.querySelectorAll('.checkbox-extracto').forEach(cb => {
        cb.checked = checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });

    actualizarBarraSeleccion();
}

/**
 * Limpiar toda la selección
 */
function limpiarSeleccion() {
    seleccion.mayor = [];
    seleccion.extracto = [];

    // Desmarcar checkboxes
    document.querySelectorAll('.checkbox-mayor, .checkbox-extracto').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        if (row) row.classList.remove('row-selected');
    });

    // Reset checkboxes "seleccionar todos"
    if (elements.selectAllMayor) elements.selectAllMayor.checked = false;
    if (elements.selectAllExtracto) elements.selectAllExtracto.checked = false;

    actualizarBarraSeleccion();
}

/**
 * Actualizar la barra de selección flotante con los totales
 */
function actualizarBarraSeleccion() {
    if (!state.resultados) return;

    const cantMayor = seleccion.mayor.length;
    const cantExtracto = seleccion.extracto.length;

    // Calcular totales
    const totalMayor = state.resultados.mayorNoConciliado
        .filter(m => seleccion.mayor.includes(m.id))
        .reduce((sum, m) => sum + m.importe, 0);

    const totalExtracto = state.resultados.extractoNoConciliado
        .filter(e => seleccion.extracto.includes(e.id))
        .reduce((sum, e) => sum + e.importe, 0);

    const diferencia = Math.abs(totalMayor - totalExtracto);

    // Actualizar UI
    elements.selMayorCount.textContent = cantMayor;
    elements.selMayorTotal.textContent = formatearMoneda(totalMayor);
    elements.selExtractoCount.textContent = cantExtracto;
    elements.selExtractoTotal.textContent = formatearMoneda(totalExtracto);
    elements.selDiferencia.textContent = formatearMoneda(diferencia);

    // Color de diferencia
    if (diferencia > state.toleranciaImporte) {
        elements.selDiferencia.classList.add('diff-warning');
    } else {
        elements.selDiferencia.classList.remove('diff-warning');
    }

    // Habilitar/deshabilitar botón vincular
    elements.btnVincular.disabled = cantMayor === 0 || cantExtracto === 0;

    // Mostrar/ocultar barra
    if (cantMayor > 0 || cantExtracto > 0) {
        elements.selectionBar.classList.remove('hidden');
    } else {
        elements.selectionBar.classList.add('hidden');
    }

    // Actualizar botón de eliminar seleccionados
    actualizarBotonEliminarSeleccionados();
}

/**
 * Actualizar todos los totales y contadores después de cambios manuales
 */
function actualizarTotalesYContadores() {
    if (!state.resultados) return;

    const res = state.resultados;

    // Calcular totales
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);

    const totalMayor = totalConciliadoMayor + totalMayorPendiente;
    const totalExtracto = totalConciliadoExtracto + totalExtractoPendiente;

    // Actualizar contadores en resumen
    elements.totalConciliados.textContent = res.conciliados.length;
    elements.mayorNoConciliado.textContent = res.mayorNoConciliado.length;
    elements.extractoNoConciliado.textContent = res.extractoNoConciliado.length;

    // Actualizar totales
    elements.totalMayor.textContent = formatearMoneda(totalMayor);
    elements.totalExtracto.textContent = formatearMoneda(totalExtracto);
    elements.diferencia.textContent = formatearMoneda(Math.abs(totalMayor - totalExtracto));

    // Color de diferencia
    const difElement = document.querySelector('.total-row.diferencia .total-value');
    if (difElement) {
        if (Math.abs(totalMayor - totalExtracto) > 0) {
            difElement.style.color = '#dc2626';
        } else {
            difElement.style.color = '#059669';
        }
    }

    // Actualizar contadores en headers de pestañas pendientes
    elements.countMayorPendiente.textContent = `(${res.mayorNoConciliado.length})`;
    elements.countExtractoPendiente.textContent = `(${res.extractoNoConciliado.length})`;

    // Actualizar contador de eliminados
    if (elements.countEliminados) {
        elements.countEliminados.textContent = `(${state.eliminados.length})`;
    }

    // Actualizar resumen de eliminados
    actualizarResumenEliminados();
}

/**
 * Actualizar la información de eliminados en el resumen
 */
function actualizarResumenEliminados() {
    const eliminadosResumen = document.getElementById('eliminadosResumen');
    const totalEliminadosSpan = document.getElementById('totalEliminados');
    const diferenciaAjustadaRow = document.getElementById('diferenciaAjustadaRow');
    const diferenciaAjustadaSpan = document.getElementById('diferenciaAjustada');

    if (!eliminadosResumen || !totalEliminadosSpan) return;

    const cantidadEliminados = state.eliminados.length;
    const totalEliminados = state.eliminados.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

    if (cantidadEliminados > 0) {
        eliminadosResumen.classList.remove('hidden');
        totalEliminadosSpan.textContent = `${cantidadEliminados} movimiento${cantidadEliminados !== 1 ? 's' : ''} (${formatearMoneda(totalEliminados)})`;

        // Calcular y mostrar diferencia ajustada
        if (state.resultados && diferenciaAjustadaRow && diferenciaAjustadaSpan) {
            const totalMayorPendiente = state.resultados.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
            const totalExtractoPendiente = state.resultados.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);
            const diferenciaOriginal = Math.abs(totalMayorPendiente - totalExtractoPendiente);
            const diferenciaAjustada = Math.abs((totalMayorPendiente - totalEliminados) - totalExtractoPendiente);

            diferenciaAjustadaRow.classList.remove('hidden');
            diferenciaAjustadaSpan.textContent = formatearMoneda(diferenciaAjustada);

            // Color según si la diferencia ajustada es menor que la original
            if (diferenciaAjustada < diferenciaOriginal) {
                diferenciaAjustadaSpan.style.color = '#059669';
            } else {
                diferenciaAjustadaSpan.style.color = '#dc2626';
            }
        }
    } else {
        eliminadosResumen.classList.add('hidden');
        if (diferenciaAjustadaRow) {
            diferenciaAjustadaRow.classList.add('hidden');
        }
    }
}

// ========== ELIMINACIÓN DE MOVIMIENTOS DEL MAYOR ==========

/**
 * Mostrar modal de confirmación para eliminar un movimiento
 * @param {string} id - ID del movimiento a eliminar (puede ser un ID o 'seleccionados')
 */
function mostrarModalEliminar(id) {
    if (!state.resultados) return;

    const modal = document.getElementById('modal-eliminar');
    const overlay = document.getElementById('overlay-eliminar');
    const detalles = document.getElementById('eliminar-detalles');
    const inputMotivo = document.getElementById('eliminar-motivo');

    if (!modal || !overlay) return;

    // Limpiar motivo previo
    if (inputMotivo) inputMotivo.value = '';

    if (id === 'seleccionados') {
        // Eliminar múltiples seleccionados
        const movimientos = state.resultados.mayorNoConciliado.filter(m => seleccion.mayor.includes(m.id));
        if (movimientos.length === 0) {
            alert('No hay movimientos seleccionados para eliminar');
            return;
        }

        const totalImporte = movimientos.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

        detalles.innerHTML = `
            <p><strong>Se eliminarán ${movimientos.length} movimientos:</strong></p>
            <p>Importe total: <strong>${formatearMoneda(totalImporte)}</strong></p>
            <div class="eliminar-lista-preview">
                ${movimientos.slice(0, 5).map(m => `
                    <div class="eliminar-item-preview">
                        <span>Asiento ${m.numeroAsiento}</span>
                        <span>${formatearMoneda(m.importe || m.debe || m.haber)}</span>
                    </div>
                `).join('')}
                ${movimientos.length > 5 ? `<div class="eliminar-item-preview text-muted">...y ${movimientos.length - 5} más</div>` : ''}
            </div>
        `;

        modal.dataset.eliminarId = 'seleccionados';
    } else {
        // Eliminar un solo movimiento
        const movimiento = state.resultados.mayorNoConciliado.find(m => m.id === id);
        if (!movimiento) return;

        const importe = movimiento.importe || movimiento.debe || movimiento.haber || 0;

        detalles.innerHTML = `
            <div class="eliminar-item-info">
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Nº Asiento:</span>
                    <span class="eliminar-value">${movimiento.numeroAsiento}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Fecha:</span>
                    <span class="eliminar-value">${formatearFecha(movimiento.fecha)}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Leyenda:</span>
                    <span class="eliminar-value" title="${movimiento.leyenda}">${truncar(movimiento.leyenda, 40)}</span>
                </div>
                <div class="eliminar-info-row">
                    <span class="eliminar-label">Importe:</span>
                    <span class="eliminar-value importe-destacado">${formatearMoneda(importe)}</span>
                </div>
            </div>
        `;

        modal.dataset.eliminarId = id;
    }

    // Mostrar modal
    overlay.classList.add('visible');
    modal.classList.add('visible');
}

/**
 * Cerrar modal de eliminar
 */
function cerrarModalEliminar() {
    const modal = document.getElementById('modal-eliminar');
    const overlay = document.getElementById('overlay-eliminar');

    if (modal) modal.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
}

/**
 * Confirmar eliminación desde el modal
 */
function confirmarEliminar() {
    const modal = document.getElementById('modal-eliminar');
    const inputMotivo = document.getElementById('eliminar-motivo');

    if (!modal) return;

    const id = modal.dataset.eliminarId;
    const motivo = inputMotivo ? inputMotivo.value.trim() : '';

    if (id === 'seleccionados') {
        eliminarMovimientosSeleccionados(motivo);
    } else {
        eliminarMovimiento(id, motivo);
    }

    cerrarModalEliminar();
}

/**
 * Eliminar un movimiento del Mayor del proceso de conciliación
 * @param {string} id - ID del movimiento a eliminar
 * @param {string} motivo - Motivo de eliminación (opcional)
 */
function eliminarMovimiento(id, motivo = '') {
    if (!state.resultados) return;

    const movimiento = state.resultados.mayorNoConciliado.find(m => m.id === id);
    if (!movimiento) return;

    // Agregar a eliminados con metadata
    state.eliminados.push({
        ...movimiento,
        fechaEliminacion: new Date().toISOString(),
        motivo: motivo
    });

    // Quitar de mayorNoConciliado
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(m => m.id !== id);

    // Quitar de selección si estaba seleccionado
    seleccion.mayor = seleccion.mayor.filter(i => i !== id);

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje('Movimiento eliminado del proceso de conciliación', 'success');
}

/**
 * Eliminar múltiples movimientos seleccionados
 * @param {string} motivo - Motivo de eliminación (opcional)
 */
function eliminarMovimientosSeleccionados(motivo = '') {
    if (!state.resultados) return;

    const idsAEliminar = [...seleccion.mayor];
    if (idsAEliminar.length === 0) return;

    const movimientos = state.resultados.mayorNoConciliado.filter(m => idsAEliminar.includes(m.id));

    // Agregar a eliminados con metadata
    movimientos.forEach(movimiento => {
        state.eliminados.push({
            ...movimiento,
            fechaEliminacion: new Date().toISOString(),
            motivo: motivo
        });
    });

    // Quitar de mayorNoConciliado
    state.resultados.mayorNoConciliado = state.resultados.mayorNoConciliado.filter(
        m => !idsAEliminar.includes(m.id)
    );

    // Limpiar selección
    seleccion.mayor = [];

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje(`${movimientos.length} movimiento(s) eliminado(s) del proceso de conciliación`, 'success');
}

/**
 * Restaurar un movimiento eliminado
 * @param {string} id - ID del movimiento a restaurar
 */
function restaurarMovimiento(id) {
    const idx = state.eliminados.findIndex(m => m.id === id);
    if (idx === -1) return;

    const movimientoEliminado = state.eliminados[idx];

    // Quitar campos de eliminación y restaurar el movimiento original
    const { fechaEliminacion, motivo, ...movimientoOriginal } = movimientoEliminado;

    // Agregar a mayorNoConciliado
    if (state.resultados) {
        state.resultados.mayorNoConciliado.push(movimientoOriginal);
    }

    // Quitar de eliminados
    state.eliminados.splice(idx, 1);

    // Actualizar vistas
    actualizarVistasEliminacion();

    mostrarMensaje('Movimiento restaurado al proceso de conciliación', 'success');
}

/**
 * Actualizar todas las vistas después de eliminar/restaurar
 */
function actualizarVistasEliminacion() {
    if (!state.resultados) return;

    // Actualizar tabla Mayor Pendiente
    if (hayFiltrosActivosMayor()) {
        mayorPendienteFiltrado = filtrarMovimientosMayor(state.resultados.mayorNoConciliado);
        renderizarMayorPendienteFiltrado();
        mostrarResultadoFiltrosMayor(mayorPendienteFiltrado.length, state.resultados.mayorNoConciliado.length);
    } else {
        llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    }

    // Actualizar tabla Eliminados
    llenarTablaEliminados();

    // Actualizar contadores y totales
    actualizarTotalesYContadores();

    // Actualizar barra de selección
    actualizarBarraSeleccion();

    // Actualizar botón de eliminar seleccionados
    actualizarBotonEliminarSeleccionados();
}

/**
 * Llenar la tabla de movimientos eliminados
 */
function llenarTablaEliminados() {
    if (!elements.tablaEliminados) return;

    let html = '';

    // Actualizar contadores (en pestaña y en header)
    if (elements.countEliminados) {
        elements.countEliminados.textContent = `(${state.eliminados.length})`;
    }
    const countEliminadosTab = document.getElementById('countEliminadosTab');
    if (countEliminadosTab) {
        countEliminadosTab.textContent = `(${state.eliminados.length})`;
    }

    if (state.eliminados.length === 0) {
        elements.tablaEliminados.innerHTML = '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos eliminados</td></tr>';
        return;
    }

    // Ordenar por fecha de eliminación (más reciente primero)
    const eliminadosOrdenados = [...state.eliminados].sort((a, b) => {
        return new Date(b.fechaEliminacion) - new Date(a.fechaEliminacion);
    });

    eliminadosOrdenados.forEach(m => {
        const importe = m.importe || m.debe || m.haber || 0;
        const fechaElim = new Date(m.fechaEliminacion);
        const fechaEliminacionFormateada = formatearFecha(fechaElim) + ' ' +
            fechaElim.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        html += `
            <tr data-id="${m.id}">
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 35)}</td>
                <td class="text-right">${formatearNumero(importe)}</td>
                <td class="text-muted fecha-eliminacion">${fechaEliminacionFormateada}</td>
                <td title="${m.motivo || ''}">${truncar(m.motivo || '-', 20)}</td>
                <td class="col-action-restaurar">
                    <button class="btn-restaurar" onclick="restaurarMovimiento('${m.id}')" title="Restaurar al proceso de conciliación">
                        ↩️ Restaurar
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaEliminados.innerHTML = html;
}

/**
 * Actualizar botón de eliminar seleccionados
 */
function actualizarBotonEliminarSeleccionados() {
    if (!elements.btnEliminarSeleccionados) return;

    const cantidad = seleccion.mayor.length;

    if (cantidad > 0) {
        elements.btnEliminarSeleccionados.classList.remove('hidden');
        elements.btnEliminarSeleccionados.innerHTML = `🗑️ Eliminar seleccionados (${cantidad})`;
    } else {
        elements.btnEliminarSeleccionados.classList.add('hidden');
    }
}

// ========== FILTROS DE BÚSQUEDA ==========

/**
 * Toggle para mostrar/ocultar panel de filtros
 */
function toggleFiltros(tipo) {
    const panel = document.getElementById(`filtros-${tipo}`);
    const btn = document.getElementById(`btnFiltros${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.innerHTML = '🔍 Filtros ▲';
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('active');
        btn.innerHTML = '🔍 Filtros ▼';
    }
}

/**
 * Toggle para mostrar segundo campo de importe (cuando se selecciona "Entre")
 */
function toggleSegundoImporte(tipo) {
    const selectTipo = document.getElementById(`filtro${tipo.charAt(0).toUpperCase() + tipo.slice(1)}ImporteTipo`);
    const input2 = document.getElementById(`filtro${tipo.charAt(0).toUpperCase() + tipo.slice(1)}ImporteValor2`);

    if (selectTipo.value === 'entre') {
        input2.classList.remove('hidden');
    } else {
        input2.classList.add('hidden');
        input2.value = '';
    }
}

/**
 * Aplicar filtros a Mayor Pendiente
 */
function aplicarFiltrosMayor() {
    if (!state.resultados) return;

    // Leer valores de los inputs
    filtrosMayor.fechaDesde = document.getElementById('filtroMayorFechaDesde').value || null;
    filtrosMayor.fechaHasta = document.getElementById('filtroMayorFechaHasta').value || null;
    filtrosMayor.importeTipo = document.getElementById('filtroMayorImporteTipo').value || '';
    filtrosMayor.importeValor = parseFloat(document.getElementById('filtroMayorImporteValor').value) || null;
    filtrosMayor.importeValor2 = parseFloat(document.getElementById('filtroMayorImporteValor2').value) || null;
    filtrosMayor.numeroAsiento = document.getElementById('filtroMayorNumeroAsiento').value.trim();
    filtrosMayor.leyenda = document.getElementById('filtroMayorLeyenda').value.trim();
    filtrosMayor.ce = document.getElementById('filtroMayorCE').value;
    filtrosMayor.tipo = document.getElementById('filtroMayorTipo').value;

    // Aplicar filtros
    const original = state.resultados.mayorNoConciliado;
    mayorPendienteFiltrado = filtrarMovimientosMayor(original);

    // Actualizar UI
    renderizarMayorPendienteFiltrado();
    mostrarResultadoFiltrosMayor(mayorPendienteFiltrado.length, original.length);
    mostrarBadgesFiltrosMayor();
}

/**
 * Filtrar movimientos del Mayor según los filtros activos
 */
function filtrarMovimientosMayor(movimientos) {
    return movimientos.filter(mov => {
        // Filtro fecha desde
        if (filtrosMayor.fechaDesde) {
            const fechaDesde = new Date(filtrosMayor.fechaDesde);
            if (mov.fecha < fechaDesde) return false;
        }

        // Filtro fecha hasta
        if (filtrosMayor.fechaHasta) {
            const fechaHasta = new Date(filtrosMayor.fechaHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            if (mov.fecha > fechaHasta) return false;
        }

        // Filtro importe
        const importe = mov.importe || mov.debe || mov.haber || 0;
        if (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) {
            switch (filtrosMayor.importeTipo) {
                case 'mayor':
                    if (importe <= filtrosMayor.importeValor) return false;
                    break;
                case 'menor':
                    if (importe >= filtrosMayor.importeValor) return false;
                    break;
                case 'igual':
                    if (Math.abs(importe - filtrosMayor.importeValor) > 0.01) return false;
                    break;
                case 'entre':
                    if (filtrosMayor.importeValor2 !== null) {
                        if (importe < filtrosMayor.importeValor || importe > filtrosMayor.importeValor2) return false;
                    }
                    break;
            }
        }

        // Filtro número de asiento (búsqueda parcial)
        if (filtrosMayor.numeroAsiento) {
            if (!String(mov.numeroAsiento).toLowerCase().includes(filtrosMayor.numeroAsiento.toLowerCase())) {
                return false;
            }
        }

        // Filtro leyenda (búsqueda parcial, case insensitive)
        if (filtrosMayor.leyenda) {
            if (!mov.leyenda.toLowerCase().includes(filtrosMayor.leyenda.toLowerCase())) {
                return false;
            }
        }

        // Filtro C/E
        if (filtrosMayor.ce !== 'todos') {
            if (mov.ce !== filtrosMayor.ce) return false;
        }

        // Filtro Tipo
        if (filtrosMayor.tipo !== 'todos') {
            if (mov.tipoAsiento !== filtrosMayor.tipo) return false;
        }

        return true;
    });
}

/**
 * Renderizar tabla de Mayor Pendiente con datos filtrados
 */
function renderizarMayorPendienteFiltrado() {
    let html = '';

    // Aplicar ordenamiento a los datos filtrados
    const pendientes = aplicarOrdenamiento(mayorPendienteFiltrado, 'mayor');

    pendientes.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos que coincidan con los filtros</td></tr>';

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('mayor');
}

/**
 * Mostrar contador de resultados filtrados Mayor
 */
function mostrarResultadoFiltrosMayor(mostrados, total) {
    const resultado = document.getElementById('filtrosMayorResultado');
    const spanMostrados = document.getElementById('filtrosMayorMostrados');
    const spanTotal = document.getElementById('filtrosMayorTotal');

    if (hayFiltrosActivosMayor()) {
        spanMostrados.textContent = mostrados;
        spanTotal.textContent = total;
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
    }
}

/**
 * Verificar si hay filtros activos en Mayor
 */
function hayFiltrosActivosMayor() {
    return filtrosMayor.fechaDesde ||
           filtrosMayor.fechaHasta ||
           (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) ||
           filtrosMayor.numeroAsiento ||
           filtrosMayor.leyenda ||
           filtrosMayor.ce !== 'todos' ||
           filtrosMayor.tipo !== 'todos';
}

/**
 * Mostrar badges de filtros activos Mayor
 */
function mostrarBadgesFiltrosMayor() {
    const container = document.getElementById('filtrosMayorActivos');
    let badges = '';

    if (filtrosMayor.fechaDesde) {
        badges += crearBadgeFiltro('Desde: ' + filtrosMayor.fechaDesde, 'mayor', 'fechaDesde');
    }
    if (filtrosMayor.fechaHasta) {
        badges += crearBadgeFiltro('Hasta: ' + filtrosMayor.fechaHasta, 'mayor', 'fechaHasta');
    }
    if (filtrosMayor.importeTipo && filtrosMayor.importeValor !== null) {
        let textoImporte = '';
        switch (filtrosMayor.importeTipo) {
            case 'mayor': textoImporte = `> $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'menor': textoImporte = `< $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'igual': textoImporte = `= $${formatearNumero(filtrosMayor.importeValor)}`; break;
            case 'entre': textoImporte = `$${formatearNumero(filtrosMayor.importeValor)} - $${formatearNumero(filtrosMayor.importeValor2 || 0)}`; break;
        }
        badges += crearBadgeFiltro('Importe: ' + textoImporte, 'mayor', 'importe');
    }
    if (filtrosMayor.numeroAsiento) {
        badges += crearBadgeFiltro('Asiento: ' + filtrosMayor.numeroAsiento, 'mayor', 'numeroAsiento');
    }
    if (filtrosMayor.leyenda) {
        badges += crearBadgeFiltro('Leyenda: ' + truncar(filtrosMayor.leyenda, 20), 'mayor', 'leyenda');
    }
    if (filtrosMayor.ce !== 'todos') {
        badges += crearBadgeFiltro('C/E: ' + filtrosMayor.ce, 'mayor', 'ce');
    }
    if (filtrosMayor.tipo !== 'todos') {
        badges += crearBadgeFiltro('Tipo: ' + filtrosMayor.tipo, 'mayor', 'tipo');
    }

    container.innerHTML = badges;
    if (badges) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Crear HTML de un badge de filtro
 */
function crearBadgeFiltro(texto, seccion, campo) {
    return `
        <span class="filtro-badge">
            ${texto}
            <button class="filtro-badge-remove" onclick="removerFiltro('${seccion}', '${campo}')" title="Quitar filtro">✕</button>
        </span>
    `;
}

/**
 * Remover un filtro específico
 */
function removerFiltro(seccion, campo) {
    if (seccion === 'mayor') {
        switch (campo) {
            case 'fechaDesde':
                filtrosMayor.fechaDesde = null;
                document.getElementById('filtroMayorFechaDesde').value = '';
                break;
            case 'fechaHasta':
                filtrosMayor.fechaHasta = null;
                document.getElementById('filtroMayorFechaHasta').value = '';
                break;
            case 'importe':
                filtrosMayor.importeTipo = '';
                filtrosMayor.importeValor = null;
                filtrosMayor.importeValor2 = null;
                document.getElementById('filtroMayorImporteTipo').value = '';
                document.getElementById('filtroMayorImporteValor').value = '';
                document.getElementById('filtroMayorImporteValor2').value = '';
                document.getElementById('filtroMayorImporteValor2').classList.add('hidden');
                break;
            case 'numeroAsiento':
                filtrosMayor.numeroAsiento = '';
                document.getElementById('filtroMayorNumeroAsiento').value = '';
                break;
            case 'leyenda':
                filtrosMayor.leyenda = '';
                document.getElementById('filtroMayorLeyenda').value = '';
                break;
            case 'ce':
                filtrosMayor.ce = 'todos';
                document.getElementById('filtroMayorCE').value = 'todos';
                break;
            case 'tipo':
                filtrosMayor.tipo = 'todos';
                document.getElementById('filtroMayorTipo').value = 'todos';
                break;
        }
        aplicarFiltrosMayor();
    } else if (seccion === 'extracto') {
        switch (campo) {
            case 'fechaDesde':
                filtrosExtracto.fechaDesde = null;
                document.getElementById('filtroExtractoFechaDesde').value = '';
                break;
            case 'fechaHasta':
                filtrosExtracto.fechaHasta = null;
                document.getElementById('filtroExtractoFechaHasta').value = '';
                break;
            case 'importe':
                filtrosExtracto.importeTipo = '';
                filtrosExtracto.importeValor = null;
                filtrosExtracto.importeValor2 = null;
                document.getElementById('filtroExtractoImporteTipo').value = '';
                document.getElementById('filtroExtractoImporteValor').value = '';
                document.getElementById('filtroExtractoImporteValor2').value = '';
                document.getElementById('filtroExtractoImporteValor2').classList.add('hidden');
                break;
            case 'descripcion':
                filtrosExtracto.descripcion = '';
                document.getElementById('filtroExtractoDescripcion').value = '';
                break;
            case 'origen':
                filtrosExtracto.origen = '';
                document.getElementById('filtroExtractoOrigen').value = '';
                break;
        }
        aplicarFiltrosExtracto();
    }
}

/**
 * Limpiar todos los filtros de Mayor
 */
function limpiarFiltrosMayor() {
    // Resetear estado
    filtrosMayor = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        numeroAsiento: '',
        leyenda: '',
        ce: 'todos',
        tipo: 'todos'
    };

    // Resetear inputs
    document.getElementById('filtroMayorFechaDesde').value = '';
    document.getElementById('filtroMayorFechaHasta').value = '';
    document.getElementById('filtroMayorImporteTipo').value = '';
    document.getElementById('filtroMayorImporteValor').value = '';
    document.getElementById('filtroMayorImporteValor2').value = '';
    document.getElementById('filtroMayorImporteValor2').classList.add('hidden');
    document.getElementById('filtroMayorNumeroAsiento').value = '';
    document.getElementById('filtroMayorLeyenda').value = '';
    document.getElementById('filtroMayorCE').value = 'todos';
    document.getElementById('filtroMayorTipo').value = 'todos';

    // Ocultar resultados y badges
    document.getElementById('filtrosMayorResultado').classList.add('hidden');
    document.getElementById('filtrosMayorActivos').classList.add('hidden');
    document.getElementById('filtrosMayorActivos').innerHTML = '';

    // Re-renderizar con todos los datos
    if (state.resultados) {
        llenarTablaMayorPendiente(state.resultados.mayorNoConciliado);
    }
}

/**
 * Aplicar filtros a Extracto Pendiente
 */
function aplicarFiltrosExtracto() {
    if (!state.resultados) return;

    // Leer valores de los inputs
    filtrosExtracto.fechaDesde = document.getElementById('filtroExtractoFechaDesde').value || null;
    filtrosExtracto.fechaHasta = document.getElementById('filtroExtractoFechaHasta').value || null;
    filtrosExtracto.importeTipo = document.getElementById('filtroExtractoImporteTipo').value || '';
    filtrosExtracto.importeValor = parseFloat(document.getElementById('filtroExtractoImporteValor').value) || null;
    filtrosExtracto.importeValor2 = parseFloat(document.getElementById('filtroExtractoImporteValor2').value) || null;
    filtrosExtracto.descripcion = document.getElementById('filtroExtractoDescripcion').value.trim();
    filtrosExtracto.origen = document.getElementById('filtroExtractoOrigen').value.trim();

    // Aplicar filtros
    const original = state.resultados.extractoNoConciliado;
    extractoPendienteFiltrado = filtrarMovimientosExtracto(original);

    // Actualizar UI
    renderizarExtractoPendienteFiltrado();
    mostrarResultadoFiltrosExtracto(extractoPendienteFiltrado.length, original.length);
    mostrarBadgesFiltrosExtracto();
}

/**
 * Filtrar movimientos del Extracto según los filtros activos
 */
function filtrarMovimientosExtracto(movimientos) {
    return movimientos.filter(mov => {
        // Filtro fecha desde
        if (filtrosExtracto.fechaDesde) {
            const fechaDesde = new Date(filtrosExtracto.fechaDesde);
            if (mov.fecha < fechaDesde) return false;
        }

        // Filtro fecha hasta
        if (filtrosExtracto.fechaHasta) {
            const fechaHasta = new Date(filtrosExtracto.fechaHasta);
            fechaHasta.setHours(23, 59, 59, 999);
            if (mov.fecha > fechaHasta) return false;
        }

        // Filtro importe
        const importe = mov.importe || mov.debito || mov.credito || 0;
        if (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) {
            switch (filtrosExtracto.importeTipo) {
                case 'mayor':
                    if (importe <= filtrosExtracto.importeValor) return false;
                    break;
                case 'menor':
                    if (importe >= filtrosExtracto.importeValor) return false;
                    break;
                case 'igual':
                    if (Math.abs(importe - filtrosExtracto.importeValor) > 0.01) return false;
                    break;
                case 'entre':
                    if (filtrosExtracto.importeValor2 !== null) {
                        if (importe < filtrosExtracto.importeValor || importe > filtrosExtracto.importeValor2) return false;
                    }
                    break;
            }
        }

        // Filtro descripción (búsqueda parcial, case insensitive)
        if (filtrosExtracto.descripcion) {
            if (!mov.descripcion.toLowerCase().includes(filtrosExtracto.descripcion.toLowerCase())) {
                return false;
            }
        }

        // Filtro origen (búsqueda parcial)
        if (filtrosExtracto.origen) {
            if (!String(mov.origen).toLowerCase().includes(filtrosExtracto.origen.toLowerCase())) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Renderizar tabla de Extracto Pendiente con datos filtrados
 */
function renderizarExtractoPendienteFiltrado() {
    let html = '';

    // Aplicar ordenamiento a los datos filtrados
    const pendientes = aplicarOrdenamiento(extractoPendienteFiltrado, 'extracto');

    pendientes.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos que coincidan con los filtros</td></tr>';

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrden('extracto');
}

/**
 * Mostrar contador de resultados filtrados Extracto
 */
function mostrarResultadoFiltrosExtracto(mostrados, total) {
    const resultado = document.getElementById('filtrosExtractoResultado');
    const spanMostrados = document.getElementById('filtrosExtractoMostrados');
    const spanTotal = document.getElementById('filtrosExtractoTotal');

    if (hayFiltrosActivosExtracto()) {
        spanMostrados.textContent = mostrados;
        spanTotal.textContent = total;
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
    }
}

/**
 * Verificar si hay filtros activos en Extracto
 */
function hayFiltrosActivosExtracto() {
    return filtrosExtracto.fechaDesde ||
           filtrosExtracto.fechaHasta ||
           (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) ||
           filtrosExtracto.descripcion ||
           filtrosExtracto.origen;
}

/**
 * Mostrar badges de filtros activos Extracto
 */
function mostrarBadgesFiltrosExtracto() {
    const container = document.getElementById('filtrosExtractoActivos');
    let badges = '';

    if (filtrosExtracto.fechaDesde) {
        badges += crearBadgeFiltro('Desde: ' + filtrosExtracto.fechaDesde, 'extracto', 'fechaDesde');
    }
    if (filtrosExtracto.fechaHasta) {
        badges += crearBadgeFiltro('Hasta: ' + filtrosExtracto.fechaHasta, 'extracto', 'fechaHasta');
    }
    if (filtrosExtracto.importeTipo && filtrosExtracto.importeValor !== null) {
        let textoImporte = '';
        switch (filtrosExtracto.importeTipo) {
            case 'mayor': textoImporte = `> $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'menor': textoImporte = `< $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'igual': textoImporte = `= $${formatearNumero(filtrosExtracto.importeValor)}`; break;
            case 'entre': textoImporte = `$${formatearNumero(filtrosExtracto.importeValor)} - $${formatearNumero(filtrosExtracto.importeValor2 || 0)}`; break;
        }
        badges += crearBadgeFiltro('Importe: ' + textoImporte, 'extracto', 'importe');
    }
    if (filtrosExtracto.descripcion) {
        badges += crearBadgeFiltro('Descripción: ' + truncar(filtrosExtracto.descripcion, 20), 'extracto', 'descripcion');
    }
    if (filtrosExtracto.origen) {
        badges += crearBadgeFiltro('Origen: ' + filtrosExtracto.origen, 'extracto', 'origen');
    }

    container.innerHTML = badges;
    if (badges) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

/**
 * Limpiar todos los filtros de Extracto
 */
function limpiarFiltrosExtracto() {
    // Resetear estado
    filtrosExtracto = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        descripcion: '',
        origen: ''
    };

    // Resetear inputs
    document.getElementById('filtroExtractoFechaDesde').value = '';
    document.getElementById('filtroExtractoFechaHasta').value = '';
    document.getElementById('filtroExtractoImporteTipo').value = '';
    document.getElementById('filtroExtractoImporteValor').value = '';
    document.getElementById('filtroExtractoImporteValor2').value = '';
    document.getElementById('filtroExtractoImporteValor2').classList.add('hidden');
    document.getElementById('filtroExtractoDescripcion').value = '';
    document.getElementById('filtroExtractoOrigen').value = '';

    // Ocultar resultados y badges
    document.getElementById('filtrosExtractoResultado').classList.add('hidden');
    document.getElementById('filtrosExtractoActivos').classList.add('hidden');
    document.getElementById('filtrosExtractoActivos').innerHTML = '';

    // Re-renderizar con todos los datos
    if (state.resultados) {
        llenarTablaExtractoPendiente(state.resultados.extractoNoConciliado);
    }
}

/**
 * Poblar selector de tipos únicos para Mayor
 */
function poblarSelectorTiposMayor() {
    if (!state.resultados) return;

    const tipos = new Set();
    state.resultados.mayorNoConciliado.forEach(m => {
        if (m.tipoAsiento) tipos.add(m.tipoAsiento);
    });

    const select = document.getElementById('filtroMayorTipo');
    // Mantener la opción "Todos"
    select.innerHTML = '<option value="todos">Todos</option>';

    // Agregar tipos únicos ordenados
    [...tipos].sort().forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        select.appendChild(option);
    });
}

/**
 * Resetear estado de filtros (llamado al reiniciar)
 */
function resetearFiltros() {
    // Resetear estados
    filtrosMayor = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        numeroAsiento: '',
        leyenda: '',
        ce: 'todos',
        tipo: 'todos'
    };

    filtrosExtracto = {
        fechaDesde: null,
        fechaHasta: null,
        importeTipo: '',
        importeValor: null,
        importeValor2: null,
        descripcion: '',
        origen: ''
    };

    mayorPendienteFiltrado = [];
    extractoPendienteFiltrado = [];

    // Ocultar paneles de filtros
    const panelMayor = document.getElementById('filtros-mayor');
    const panelExtracto = document.getElementById('filtros-extracto');
    const btnMayor = document.getElementById('btnFiltrosMayor');
    const btnExtracto = document.getElementById('btnFiltrosExtracto');

    if (panelMayor) {
        panelMayor.classList.add('hidden');
        if (btnMayor) {
            btnMayor.classList.remove('active');
            btnMayor.innerHTML = '🔍 Filtros ▼';
        }
    }

    if (panelExtracto) {
        panelExtracto.classList.add('hidden');
        if (btnExtracto) {
            btnExtracto.classList.remove('active');
            btnExtracto.innerHTML = '🔍 Filtros ▼';
        }
    }

    // Ocultar resultados y badges
    const elementos = [
        'filtrosMayorResultado', 'filtrosMayorActivos',
        'filtrosExtractoResultado', 'filtrosExtractoActivos'
    ];

    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            if (id.includes('Activos')) el.innerHTML = '';
        }
    });
}

// ========== ORDENAMIENTO DE TABLAS ==========

/**
 * Ordenar tabla por columna
 * @param {string} tipo - 'mayor' o 'extracto'
 * @param {string} columna - nombre de la columna
 */
function ordenarPorColumna(tipo, columna) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;

    // Si es la misma columna, invertir dirección
    if (estado.columna === columna) {
        estado.direccion = estado.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        // Nueva columna, empezar descendente
        estado.columna = columna;
        estado.direccion = 'desc';
    }

    // Renderizar tabla con ordenamiento
    if (tipo === 'mayor') {
        renderizarTablaMayorOrdenada();
    } else {
        renderizarTablaExtractoOrdenada();
    }
}

/**
 * Aplicar ordenamiento a un array de movimientos
 * @param {Array} movimientos - array de movimientos
 * @param {string} tipo - 'mayor' o 'extracto'
 * @returns {Array} - array ordenado
 */
function aplicarOrdenamiento(movimientos, tipo) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;
    const { columna, direccion } = estado;

    return [...movimientos].sort((a, b) => {
        let valorA = obtenerValorColumna(a, columna, tipo);
        let valorB = obtenerValorColumna(b, columna, tipo);

        // Manejar valores nulos/vacíos (siempre al final)
        const esVacioA = valorA === null || valorA === '' || valorA === undefined;
        const esVacioB = valorB === null || valorB === '' || valorB === undefined;

        if (esVacioA && !esVacioB) return 1;
        if (!esVacioA && esVacioB) return -1;
        if (esVacioA && esVacioB) return 0;

        let comparacion = 0;

        // Comparar según tipo de dato
        if (columna === 'fecha') {
            // Ordenamiento por fecha
            const fechaA = valorA instanceof Date ? valorA.getTime() : new Date(valorA).getTime();
            const fechaB = valorB instanceof Date ? valorB.getTime() : new Date(valorB).getTime();
            comparacion = fechaA - fechaB;
        } else if (['debe', 'haber', 'debito', 'credito', 'numeroAsiento', 'importe', 'origen'].includes(columna)) {
            // Ordenamiento numérico
            const numA = parseFloat(valorA) || 0;
            const numB = parseFloat(valorB) || 0;
            // Para valores numéricos vacíos (0), mantenerlos al final si el original era vacío
            if (numA === 0 && numB !== 0) return 1;
            if (numA !== 0 && numB === 0) return -1;
            comparacion = numA - numB;
        } else {
            // Ordenamiento alfabético
            comparacion = String(valorA).localeCompare(String(valorB), 'es', { sensitivity: 'base' });
        }

        // Invertir si es descendente
        return direccion === 'asc' ? comparacion : -comparacion;
    });
}

/**
 * Obtener valor de una columna de un movimiento
 * @param {Object} movimiento - objeto de movimiento
 * @param {string} columna - nombre de la columna
 * @param {string} tipo - 'mayor' o 'extracto'
 * @returns {any} - valor de la columna
 */
function obtenerValorColumna(movimiento, columna, tipo) {
    const mapeoMayor = {
        'fecha': mov => mov.fecha,
        'numeroAsiento': mov => mov.numeroAsiento,
        'ce': mov => mov.ce,
        'tipo': mov => mov.tipoAsiento,
        'leyenda': mov => mov.leyenda,
        'debe': mov => mov.debe || 0,
        'haber': mov => mov.haber || 0
    };

    const mapeoExtracto = {
        'fecha': mov => mov.fecha,
        'descripcion': mov => mov.descripcion,
        'origen': mov => mov.origen,
        'debito': mov => mov.debito || 0,
        'credito': mov => mov.credito || 0
    };

    const mapeo = tipo === 'mayor' ? mapeoMayor : mapeoExtracto;
    return mapeo[columna] ? mapeo[columna](movimiento) : '';
}

/**
 * Renderizar tabla Mayor Pendiente con ordenamiento aplicado
 */
function renderizarTablaMayorOrdenada() {
    if (!state.resultados) return;

    // Obtener datos: filtrados si hay filtros activos, o todos
    let movimientos = hayFiltrosActivosMayor()
        ? mayorPendienteFiltrado
        : state.resultados.mayorNoConciliado;

    // Aplicar ordenamiento
    movimientos = aplicarOrdenamiento(movimientos, 'mayor');

    // Renderizar filas
    let html = '';
    movimientos.forEach(m => {
        const checked = seleccion.mayor.includes(m.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${m.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-mayor" data-id="${m.id}" ${checked} onchange="toggleSeleccionMayor('${m.id}', this.checked)">
                </td>
                <td>${formatearFecha(m.fecha)}</td>
                <td>${m.numeroAsiento}</td>
                <td>${m.ce}</td>
                <td>${m.tipoAsiento}</td>
                <td title="${m.leyenda}">${truncar(m.leyenda, 40)}</td>
                <td class="text-right">${m.debe > 0 ? formatearNumero(m.debe) : ''}</td>
                <td class="text-right">${m.haber > 0 ? formatearNumero(m.haber) : ''}</td>
                <td class="col-action-eliminar">
                    <button class="btn-eliminar-mov" onclick="mostrarModalEliminar('${m.id}')" title="Eliminar del proceso de conciliación">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos pendientes</td></tr>';

    // Actualizar indicadores visuales
    actualizarIndicadoresOrden('mayor');
}

/**
 * Renderizar tabla Extracto Pendiente con ordenamiento aplicado
 */
function renderizarTablaExtractoOrdenada() {
    if (!state.resultados) return;

    // Obtener datos: filtrados si hay filtros activos, o todos
    let movimientos = hayFiltrosActivosExtracto()
        ? extractoPendienteFiltrado
        : state.resultados.extractoNoConciliado;

    // Aplicar ordenamiento
    movimientos = aplicarOrdenamiento(movimientos, 'extracto');

    // Renderizar filas
    let html = '';
    movimientos.forEach(e => {
        const checked = seleccion.extracto.includes(e.id) ? 'checked' : '';
        html += `
            <tr class="${checked ? 'row-selected' : ''}" data-id="${e.id}">
                <td class="col-checkbox">
                    <input type="checkbox" class="checkbox-extracto" data-id="${e.id}" ${checked} onchange="toggleSeleccionExtracto('${e.id}', this.checked)">
                </td>
                <td>${formatearFecha(e.fecha)}</td>
                <td title="${e.descripcion}">${truncar(e.descripcion, 50)}</td>
                <td>${e.origen}</td>
                <td class="text-right">${e.debito > 0 ? formatearNumero(e.debito) : ''}</td>
                <td class="text-right">${e.credito > 0 ? formatearNumero(e.credito) : ''}</td>
            </tr>
        `;
    });

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos pendientes</td></tr>';

    // Actualizar indicadores visuales
    actualizarIndicadoresOrden('extracto');
}

/**
 * Actualizar indicadores visuales de orden en los encabezados
 * @param {string} tipo - 'mayor' o 'extracto'
 */
function actualizarIndicadoresOrden(tipo) {
    const estado = tipo === 'mayor' ? ordenMayor : ordenExtracto;
    const contenedor = tipo === 'mayor' ? '#tab-mayor-pendiente' : '#tab-extracto-pendiente';

    // Quitar clase activa de todas las columnas
    document.querySelectorAll(`${contenedor} .columna-ordenable`).forEach(th => {
        th.classList.remove('activa', 'asc', 'desc');
        const icono = th.querySelector('.icono-orden');
        if (icono) icono.textContent = '↕';
    });

    // Agregar clase activa a la columna actual
    const columnaActiva = document.querySelector(`${contenedor} .columna-ordenable[data-columna="${estado.columna}"]`);
    if (columnaActiva) {
        columnaActiva.classList.add('activa', estado.direccion);
        const icono = columnaActiva.querySelector('.icono-orden');
        if (icono) icono.textContent = estado.direccion === 'asc' ? '▲' : '▼';
    }
}

/**
 * Resetear estado de ordenamiento
 */
function resetearOrdenamiento() {
    ordenMayor = {
        columna: 'fecha',
        direccion: 'desc'
    };
    ordenExtracto = {
        columna: 'fecha',
        direccion: 'desc'
    };
}

// ========== TABS ==========

function cambiarTab(tabId) {
    elements.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}

// ========== DESCARGA DE REPORTE ==========

function descargarReporte() {
    const res = state.resultados;
    const wb = XLSX.utils.book_new();

    // Hoja 1: Conciliados (con información de pasada y tolerancias)
    const dataConciliados = [];
    dataConciliados.push([
        'Fecha Mayor', 'Nº Asiento', 'Leyenda Mayor', 'Importe Mayor', '',
        'Fecha Extracto', 'Descripción Extracto', 'Origen', 'Importe Extracto', 'Diferencia', 'Tipo', 'Pasada', 'Tolerancias'
    ]);

    res.conciliados.forEach(match => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);

        // Determinar información de pasada
        let pasada = 'Inicial';
        let tolerancias = '';
        if (match.reproceso && match.parametrosReproceso) {
            pasada = `Reproceso ${match.parametrosReproceso.numeroReproceso}`;
            tolerancias = `${match.parametrosReproceso.toleranciaFecha} días, $${match.parametrosReproceso.toleranciaImporte.toLocaleString('es-AR')}`;
        } else if (toleranciasIniciales.fecha !== null) {
            tolerancias = `${toleranciasIniciales.fecha} días, $${toleranciasIniciales.importe.toLocaleString('es-AR')}`;
        }

        for (let i = 0; i < maxRows; i++) {
            const m = match.mayor[i];
            const e = match.extracto[i];

            dataConciliados.push([
                m ? formatearFecha(m.fecha) : '',
                m ? m.numeroAsiento : '',
                m ? m.leyenda : '',
                m ? m.importe : '',
                '',
                e ? formatearFecha(e.fecha) : '',
                e ? e.descripcion : '',
                e ? e.origen : '',
                e ? e.importe : '',
                i === 0 ? match.diferencia : '',
                i === 0 ? (match.manual ? 'Manual' : 'Automático') : '',
                i === 0 ? pasada : '',
                i === 0 ? tolerancias : ''
            ]);
        }
    });

    const wsConciliados = XLSX.utils.aoa_to_sheet(dataConciliados);
    XLSX.utils.book_append_sheet(wb, wsConciliados, 'Conciliados');

    // Hoja 2: Mayor No Conciliado
    const dataMayor = [];
    dataMayor.push(['Fecha', 'Nº Asiento', 'C/E', 'Tipo', 'Leyenda', 'Debe', 'Haber']);

    res.mayorNoConciliado.forEach(m => {
        dataMayor.push([
            formatearFecha(m.fecha),
            m.numeroAsiento,
            m.ce,
            m.tipoAsiento,
            m.leyenda,
            m.debe || '',
            m.haber || ''
        ]);
    });

    const wsMayor = XLSX.utils.aoa_to_sheet(dataMayor);
    XLSX.utils.book_append_sheet(wb, wsMayor, 'Mayor No Conciliado');

    // Hoja 3: Extracto No Conciliado
    const dataExtracto = [];
    dataExtracto.push(['Fecha', 'Descripción', 'Origen', 'Débito', 'Crédito']);

    res.extractoNoConciliado.forEach(e => {
        dataExtracto.push([
            formatearFecha(e.fecha),
            e.descripcion,
            e.origen,
            e.debito || '',
            e.credito || ''
        ]);
    });

    const wsExtracto = XLSX.utils.aoa_to_sheet(dataExtracto);
    XLSX.utils.book_append_sheet(wb, wsExtracto, 'Extracto No Conciliado');

    // Hoja 4: Eliminados
    const dataEliminados = [];
    dataEliminados.push(['Fecha Asiento', 'Nº Asiento', 'C/E', 'Tipo', 'Leyenda', 'Debe', 'Haber', 'Fecha Eliminación', 'Motivo']);

    state.eliminados.forEach(m => {
        const fechaElim = new Date(m.fechaEliminacion);
        dataEliminados.push([
            formatearFecha(m.fecha),
            m.numeroAsiento,
            m.ce,
            m.tipoAsiento,
            m.leyenda,
            m.debe || '',
            m.haber || '',
            formatearFecha(fechaElim) + ' ' + fechaElim.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            m.motivo || ''
        ]);
    });

    const wsEliminados = XLSX.utils.aoa_to_sheet(dataEliminados);
    XLSX.utils.book_append_sheet(wb, wsEliminados, 'Eliminados');

    // Hoja 5: Resumen
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);
    const totalEliminados = state.eliminados.reduce((sum, m) => sum + (m.importe || m.debe || m.haber || 0), 0);

    const dataResumen = [
        ['RESUMEN DE CONCILIACIÓN'],
        [''],
        ['Tipo de conciliación:', state.tipoConciliacion === 'creditos' ? 'Créditos' : 'Débitos'],
        ['Tolerancia inicial de fechas:', toleranciasIniciales.fecha !== null ? `${toleranciasIniciales.fecha} días` : `${state.toleranciaFecha} días`],
        ['Tolerancia inicial de importes:', toleranciasIniciales.importe !== null ? `$${toleranciasIniciales.importe.toLocaleString('es-AR')}` : `$${state.toleranciaImporte.toLocaleString('es-AR')}`],
        [''],
        ['RESULTADOS'],
        ['Cantidad de grupos conciliados:', res.conciliados.length],
        ['Cantidad Mayor no conciliado:', res.mayorNoConciliado.length],
        ['Cantidad Extracto no conciliado:', res.extractoNoConciliado.length],
        ['Cantidad eliminados del Mayor:', state.eliminados.length],
        [''],
        ['TOTALES'],
        ['Total Mayor conciliado:', totalConciliadoMayor],
        ['Total Extracto conciliado:', totalConciliadoExtracto],
        ['Total Mayor no conciliado:', totalMayorPendiente],
        ['Total Extracto no conciliado:', totalExtractoPendiente],
        ['Total eliminados del Mayor:', totalEliminados],
        [''],
        ['Diferencia en conciliados:', Math.abs(totalConciliadoMayor - totalConciliadoExtracto)],
        [''],
        ['DIFERENCIA AJUSTADA (excluyendo eliminados)'],
        ['Diferencia original:', Math.abs(totalMayorPendiente - totalExtractoPendiente)],
        ['Diferencia ajustada:', Math.abs((totalMayorPendiente - totalEliminados) - totalExtractoPendiente)]
    ];

    // Agregar historial de procesamiento si hay reprocesos
    if (historialProcesamiento.length > 0) {
        dataResumen.push(['']);
        dataResumen.push(['HISTORIAL DE PROCESAMIENTO']);

        let totalHistorialConciliados = 0;
        historialProcesamiento.forEach((item, idx) => {
            const prefijo = idx === 0 ? 'Procesamiento inicial' : `Reproceso ${idx}`;
            const signo = idx === 0 ? '' : '+';
            const toleranciasStr = `${item.toleranciaFecha} días, $${item.toleranciaImporte.toLocaleString('es-AR')}`;
            dataResumen.push([`${idx + 1}. ${prefijo} (${toleranciasStr})`, `→ ${signo}${item.conciliados} conciliados`]);
            totalHistorialConciliados += item.conciliados;
        });

        dataResumen.push(['']);
        dataResumen.push(['Total conciliados (historial):', totalHistorialConciliados]);
    }

    const wsResumen = XLSX.utils.aoa_to_sheet(dataResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    const tipo = state.tipoConciliacion === 'creditos' ? 'Creditos' : 'Debitos';
    XLSX.writeFile(wb, `Conciliacion_${tipo}_${fecha}.xlsx`);
}

// ========== UTILIDADES ==========

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return '';

    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();

    return `${dia}/${mes}/${anio}`;
}

function formatearNumero(num) {
    if (num === null || num === undefined || num === '') return '';
    return Number(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearMoneda(num) {
    return '$' + formatearNumero(num);
}

function truncar(texto, maxLen) {
    if (!texto) return '';
    return texto.length > maxLen ? texto.substring(0, maxLen) + '...' : texto;
}

function mostrarMensaje(mensaje, tipo) {
    if (tipo === 'clear') {
        elements.errorBox.classList.add('hidden');
        elements.successBox.classList.add('hidden');
        return;
    }

    if (tipo === 'error') {
        elements.errorBox.textContent = mensaje;
        elements.errorBox.classList.remove('hidden');
        elements.successBox.classList.add('hidden');
    } else {
        elements.successBox.textContent = mensaje;
        elements.successBox.classList.remove('hidden');
        elements.errorBox.classList.add('hidden');
    }
}

function reiniciar() {
    // Resetear estado
    state = {
        tipoConciliacion: null,
        datosMayor: [],
        datosExtracto: [],
        toleranciaFecha: 30,
        toleranciaImporte: 20000,
        resultados: null,
        eliminados: []
    };

    // Resetear selección y contador
    seleccion = { mayor: [], extracto: [] };
    conciliacionIdCounter = 0;

    // Resetear filtros
    resetearFiltros();

    // Resetear ordenamiento
    resetearOrdenamiento();

    // Resetear UI
    elements.tipoButtons.forEach(btn => btn.classList.remove('active'));
    elements.stepArchivos.classList.add('hidden');
    elements.stepTolerancias.classList.add('hidden');
    elements.stepEjecutar.classList.add('hidden');
    elements.resultados.classList.add('hidden');
    elements.selectionBar.classList.add('hidden');

    // Resetear archivos
    eliminarArchivo('mayor');
    eliminarArchivo('extracto');

    // Resetear tolerancias
    elements.toleranciaFecha.value = 30;
    elements.toleranciaImporte.value = 20000;

    // Resetear tabs
    cambiarTab('conciliados');

    // Limpiar mensajes
    mostrarMensaje('', 'clear');

    // Scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Resetear historial y tolerancias iniciales
    historialProcesamiento = [];
    toleranciasIniciales = { fecha: null, importe: null };

    // Ocultar panel de reproceso e historial
    if (elements.panelReproceso) {
        elements.panelReproceso.classList.add('hidden');
    }
    if (elements.historialProcesamiento) {
        elements.historialProcesamiento.classList.add('hidden');
    }
}

// ========== REPROCESAMIENTO DE PENDIENTES ==========

/**
 * Alterna la visibilidad del cuerpo del panel de reprocesamiento
 */
function togglePanelReproceso() {
    const body = elements.panelReprocesoBody;
    const btn = elements.btnToggleReproceso;

    if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        btn.textContent = '▼';
    } else {
        body.classList.add('collapsed');
        btn.textContent = '▶';
    }
}

/**
 * Alterna la visibilidad del historial de procesamiento
 */
function toggleHistorial() {
    const body = elements.historialBody;
    const btn = elements.btnToggleHistorial;

    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        btn.textContent = 'Ocultar';
    } else {
        body.classList.add('hidden');
        btn.textContent = 'Mostrar';
    }
}

/**
 * Actualiza el panel de reprocesamiento con los datos actuales
 */
function actualizarPanelReproceso() {
    if (!state.resultados) return;

    const mayorPendiente = state.resultados.mayorNoConciliado.length;
    const extractoPendiente = state.resultados.extractoNoConciliado.length;

    // Actualizar contadores
    elements.reprocesoPendientesMayor.textContent = mayorPendiente;
    elements.reprocesoPendientesExtracto.textContent = extractoPendiente;

    // Habilitar/deshabilitar botón según si hay pendientes
    const hayPendientes = mayorPendiente > 0 && extractoPendiente > 0;
    elements.btnReprocesar.disabled = !hayPendientes;

    if (!hayPendientes) {
        elements.btnReprocesar.title = 'No hay movimientos pendientes para reprocesar';
    } else {
        elements.btnReprocesar.title = '';
    }

    // Mostrar panel si hay resultados
    elements.panelReproceso.classList.remove('hidden');
}

/**
 * Actualiza el historial de procesamiento en la UI
 */
function actualizarHistorial() {
    if (historialProcesamiento.length === 0) {
        elements.historialProcesamiento.classList.add('hidden');
        return;
    }

    elements.historialProcesamiento.classList.remove('hidden');

    let html = '';
    let totalConciliados = 0;

    historialProcesamiento.forEach((item, idx) => {
        totalConciliados += item.conciliados;
        const prefijo = idx === 0 ? 'Procesamiento inicial' : `Reproceso ${idx}`;
        const signo = idx === 0 ? '' : '+';

        html += `
            <div class="historial-item">
                <span class="historial-numero">${idx + 1}.</span>
                <span class="historial-descripcion">${prefijo} (${item.toleranciaFecha} días, $${item.toleranciaImporte.toLocaleString('es-AR')})</span>
                <span class="historial-resultado">→ ${signo}${item.conciliados} conciliados</span>
            </div>
        `;
    });

    elements.historialLista.innerHTML = html;
    elements.historialTotalConciliados.textContent = totalConciliados;
}

/**
 * Guarda el procesamiento inicial en el historial
 */
function guardarProcesamientoInicial(cantidadConciliados) {
    toleranciasIniciales = {
        fecha: state.toleranciaFecha,
        importe: state.toleranciaImporte
    };

    historialProcesamiento = [{
        fecha: new Date().toISOString(),
        toleranciaFecha: state.toleranciaFecha,
        toleranciaImporte: state.toleranciaImporte,
        conciliados: cantidadConciliados,
        esInicial: true
    }];

    actualizarHistorial();
}

/**
 * Reprocesa los movimientos pendientes con nuevos parámetros de tolerancia
 */
async function reprocesarPendientes() {
    try {
        // Obtener nuevos parámetros
        // IMPORTANTE: No usar || porque 0 es un valor válido (coincidencia exacta)
        const valorFecha = parseInt(elements.reprocesoToleranciaFecha.value);
        const valorImporte = parseFloat(elements.reprocesoToleranciaImporte.value);
        const nuevaToleranciaFecha = isNaN(valorFecha) ? 10 : valorFecha;
        const nuevaToleranciaImporte = isNaN(valorImporte) ? 1000 : valorImporte;

        // Validar que hay movimientos pendientes
        if (state.resultados.mayorNoConciliado.length === 0 || state.resultados.extractoNoConciliado.length === 0) {
            mostrarMensaje('No hay movimientos pendientes para reprocesar', 'error');
            return;
        }

        // Verificar si los parámetros son iguales a la última ejecución
        const ultimoProceso = historialProcesamiento[historialProcesamiento.length - 1];
        if (ultimoProceso &&
            ultimoProceso.toleranciaFecha === nuevaToleranciaFecha &&
            ultimoProceso.toleranciaImporte === nuevaToleranciaImporte) {
            if (!confirm('Los parámetros son iguales al último procesamiento. ¿Desea continuar de todos modos?')) {
                return;
            }
        }

        // Mostrar progreso
        mostrarModalProgreso();
        actualizarPaso(1, 'Iniciando reprocesamiento...');
        actualizarProgreso(5);
        await sleep(100);

        // Guardar referencia a conciliados actuales (no se tocan)
        const conciliadosPrevios = [...state.resultados.conciliados];
        const eliminadosPrevios = [...state.eliminados];

        // Crear copias de los pendientes para procesar
        const mayorPendiente = state.resultados.mayorNoConciliado.map(m => ({...m, usado: false}));
        const extractoPendiente = state.resultados.extractoNoConciliado.map(e => ({...e, usado: false}));

        // Actualizar tolerancias temporalmente para el algoritmo
        const toleranciaFechaOriginal = state.toleranciaFecha;
        const toleranciaImporteOriginal = state.toleranciaImporte;
        state.toleranciaFecha = nuevaToleranciaFecha;
        state.toleranciaImporte = nuevaToleranciaImporte;

        // Ejecutar conciliación SOLO con pendientes
        actualizarPaso(2, 'Buscando nuevas coincidencias...');
        actualizarProgreso(25);
        await sleep(100);

        const resultadosReproceso = await conciliarReproceso(mayorPendiente, extractoPendiente);

        // Restaurar tolerancias originales
        state.toleranciaFecha = toleranciaFechaOriginal;
        state.toleranciaImporte = toleranciaImporteOriginal;

        actualizarPaso(3, 'Actualizando resultados...');
        actualizarProgreso(75);
        await sleep(100);

        // Marcar nuevas conciliaciones como resultado de reproceso
        const nuevosConciliados = resultadosReproceso.conciliados.map(c => ({
            ...c,
            reproceso: true,
            parametrosReproceso: {
                toleranciaFecha: nuevaToleranciaFecha,
                toleranciaImporte: nuevaToleranciaImporte,
                numeroReproceso: historialProcesamiento.length
            }
        }));

        // Agregar nuevas conciliaciones a las existentes
        state.resultados.conciliados = [
            ...conciliadosPrevios,
            ...nuevosConciliados
        ];

        // Actualizar pendientes (quitar los que conciliaron)
        state.resultados.mayorNoConciliado = resultadosReproceso.mayorNoConciliado;
        state.resultados.extractoNoConciliado = resultadosReproceso.extractoNoConciliado;

        // Mantener eliminados
        state.eliminados = eliminadosPrevios;

        // Guardar en historial
        historialProcesamiento.push({
            fecha: new Date().toISOString(),
            toleranciaFecha: nuevaToleranciaFecha,
            toleranciaImporte: nuevaToleranciaImporte,
            conciliados: nuevosConciliados.length,
            esInicial: false
        });

        actualizarPaso(4, 'Finalizando...');
        actualizarProgreso(95);
        await sleep(100);

        // Actualizar vistas
        mostrarResultados();
        actualizarHistorial();
        actualizarPanelReproceso();

        // Completar progreso
        actualizarProgreso(100, '¡Reprocesamiento completado!');
        await sleep(500);

        cerrarModalProgreso();

        // Mostrar resumen
        mostrarResumenReproceso(nuevosConciliados.length);

    } catch (error) {
        cerrarModalProgreso();
        mostrarMensaje(`Error en el reprocesamiento: ${error.message}`, 'error');
    }
}

/**
 * Versión simplificada de conciliar para reprocesamiento
 * No actualiza la UI con tanta frecuencia ya que los conjuntos son más pequeños
 */
async function conciliarReproceso(mayor, extracto) {
    const conciliados = [];
    const mayorNoConciliado = [...mayor];
    const extractoNoConciliado = [...extracto];

    // Paso 1: Buscar coincidencias exactas (1 a 1)
    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];
        const idxCoincidencia = buscarCoincidenciaExacta(movMayor, extractoNoConciliado);

        if (idxCoincidencia !== -1) {
            const movExtracto = extractoNoConciliado[idxCoincidencia];
            const diferencia = Math.abs(movMayor.importe - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:1',
                mayor: [movMayor],
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            extractoNoConciliado.splice(idxCoincidencia, 1);
        }

        // Yield para no bloquear UI
        if (i % 20 === 0) await sleep(0);
    }

    // Paso 2: Buscar coincidencias 1 a muchos
    for (let i = mayorNoConciliado.length - 1; i >= 0; i--) {
        const movMayor = mayorNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movMayor.importe,
            movMayor.fecha,
            extractoNoConciliado,
            5
        );

        if (combinacion) {
            const sumaExtracto = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(movMayor.importe - sumaExtracto);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: '1:N',
                mayor: [movMayor],
                extracto: combinacion,
                diferencia,
                manual: false
            });

            mayorNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = extractoNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) extractoNoConciliado.splice(idx, 1);
            });
        }

        if (i % 10 === 0) await sleep(0);
    }

    // Paso 3: Buscar coincidencias muchos a 1
    for (let i = extractoNoConciliado.length - 1; i >= 0; i--) {
        const movExtracto = extractoNoConciliado[i];

        const combinacion = buscarCombinacionQueSume(
            movExtracto.importe,
            movExtracto.fecha,
            mayorNoConciliado,
            5
        );

        if (combinacion) {
            const sumaMayor = combinacion.reduce((sum, m) => sum + m.importe, 0);
            const diferencia = Math.abs(sumaMayor - movExtracto.importe);

            conciliados.push({
                id: 'conc_' + (++conciliacionIdCounter),
                tipo: 'N:1',
                mayor: combinacion,
                extracto: [movExtracto],
                diferencia,
                manual: false
            });

            extractoNoConciliado.splice(i, 1);
            combinacion.forEach(m => {
                const idx = mayorNoConciliado.findIndex(e => e.id === m.id);
                if (idx !== -1) mayorNoConciliado.splice(idx, 1);
            });
        }

        if (i % 10 === 0) await sleep(0);
    }

    return {
        conciliados,
        mayorNoConciliado,
        extractoNoConciliado
    };
}

/**
 * Muestra un mensaje de resumen después del reprocesamiento
 */
function mostrarResumenReproceso(nuevosConciliados) {
    if (nuevosConciliados > 0) {
        mostrarMensaje(`Se encontraron ${nuevosConciliados} nuevas conciliaciones`, 'success');
    } else {
        mostrarMensaje('No se encontraron nuevas conciliaciones con estos parámetros', 'error');
    }

    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
        mostrarMensaje('', 'clear');
    }, 5000);
}

// ========== SELECTOR DE EXTRACTOS DE AUDITORÍA ==========

// Estado para extractos de auditoría
let extractosAuditoria = {
    origenActual: 'archivo', // 'archivo' o 'auditoria'
    clienteId: null,
    cuentaId: null,
    extractosDisponibles: [], // Lista de extractos disponibles (ordenados cronológicamente)
    extractosSeleccionados: [], // IDs de extractos seleccionados
    extractoDesde: null,
    extractoHasta: null
};

// Nombres de los meses en español
const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Cambiar entre cargar archivo Excel o usar extractos de Auditoría
 */
function cambiarOrigenExtracto(origen) {
    extractosAuditoria.origenActual = origen;

    const opcionArchivo = document.getElementById('opcionArchivoExtracto');
    const opcionAuditoria = document.getElementById('opcionAuditoriaExtracto');

    if (origen === 'archivo') {
        opcionArchivo.classList.remove('hidden');
        opcionAuditoria.classList.add('hidden');
        // Limpiar selección de auditoría
        limpiarSeleccionAuditoria();
    } else {
        opcionArchivo.classList.add('hidden');
        opcionAuditoria.classList.remove('hidden');
        // Limpiar archivo cargado
        limpiarExtractoArchivo();
        // Cargar clientes si es necesario
        cargarClientesParaAuditoria();
    }

    actualizarBotonConciliar();
}

/**
 * Limpiar el archivo de extracto cargado
 */
function limpiarExtractoArchivo() {
    state.datosExtracto = [];
    const fileInput = document.getElementById('fileExtracto');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('previewExtracto');
    if (preview) preview.classList.add('hidden');
}

/**
 * Limpiar la selección de extractos de auditoría
 */
function limpiarSeleccionAuditoria() {
    extractosAuditoria.extractosSeleccionados = [];
    extractosAuditoria.extractoDesde = null;
    extractosAuditoria.extractoHasta = null;
    state.datosExtracto = [];

    // Reset selectores
    const selectDesde = document.getElementById('selectExtractoDesde');
    const selectHasta = document.getElementById('selectExtractoHasta');
    if (selectDesde) selectDesde.value = '';
    if (selectHasta) selectHasta.value = '';

    // Ocultar preview
    const preview = document.getElementById('previewExtractoAuditoria');
    if (preview) preview.classList.add('hidden');

    // Actualizar lista visual si existe
    actualizarListaVisualExtractos();

    actualizarBotonConciliar();
}

/**
 * Cargar clientes desde Supabase para el selector de auditoría
 */
async function cargarClientesParaAuditoria() {
    const select = document.getElementById('selectClienteAuditoria');
    if (!select) return;

    try {
        select.innerHTML = '<option value="">Cargando clientes...</option>';

        if (typeof supabase !== 'undefined' && supabase) {
            const { data: clientes, error } = await supabase
                .from('clientes')
                .select('id, razon_social, cuit')
                .order('razon_social');

            if (error) throw error;

            select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = `${cliente.razon_social}${cliente.cuit ? ` (${cliente.cuit})` : ''}`;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">No hay conexión a base de datos</option>';
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
        select.innerHTML = '<option value="">Error al cargar clientes</option>';
    }
}

/**
 * Cargar cuentas bancarias del cliente seleccionado
 */
async function cargarCuentasCliente() {
    const clienteId = document.getElementById('selectClienteAuditoria')?.value;
    const selectCuenta = document.getElementById('selectCuentaBancaria');
    const rowCuenta = document.getElementById('rowCuentaBancaria');
    const rowExtractos = document.getElementById('rowExtractosSelector');

    if (!clienteId) {
        if (rowCuenta) rowCuenta.classList.add('hidden');
        if (rowExtractos) rowExtractos.classList.add('hidden');
        limpiarSeleccionAuditoria();
        return;
    }

    extractosAuditoria.clienteId = clienteId;

    try {
        if (selectCuenta) {
            selectCuenta.innerHTML = '<option value="">Cargando cuentas...</option>';
        }
        if (rowCuenta) rowCuenta.classList.remove('hidden');
        if (rowExtractos) rowExtractos.classList.add('hidden');

        if (typeof supabase !== 'undefined' && supabase) {
            const { data: cuentas, error } = await supabase
                .from('cuentas_bancarias')
                .select('id, banco, tipo, numero')
                .eq('cliente_id', clienteId)
                .order('banco');

            if (error) throw error;

            if (selectCuenta) {
                selectCuenta.innerHTML = '<option value="">-- Seleccione una cuenta --</option>';

                if (cuentas.length === 0) {
                    selectCuenta.innerHTML = '<option value="">No hay cuentas bancarias</option>';
                } else {
                    cuentas.forEach(cuenta => {
                        const option = document.createElement('option');
                        option.value = cuenta.id;
                        option.textContent = `${cuenta.banco} - ${cuenta.tipo}${cuenta.numero ? ` (${cuenta.numero.slice(-4)})` : ''}`;
                        selectCuenta.appendChild(option);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
        if (selectCuenta) {
            selectCuenta.innerHTML = '<option value="">Error al cargar cuentas</option>';
        }
    }
}

/**
 * Cargar extractos disponibles de la cuenta seleccionada
 * Ordenados cronológicamente (más antiguo primero)
 */
async function cargarExtractosDisponibles() {
    const cuentaId = document.getElementById('selectCuentaBancaria')?.value;
    const rowExtractos = document.getElementById('rowExtractosSelector');
    const selectDesde = document.getElementById('selectExtractoDesde');
    const selectHasta = document.getElementById('selectExtractoHasta');

    if (!cuentaId) {
        if (rowExtractos) rowExtractos.classList.add('hidden');
        extractosAuditoria.extractosDisponibles = [];
        limpiarSeleccionAuditoria();
        return;
    }

    extractosAuditoria.cuentaId = cuentaId;

    try {
        if (rowExtractos) rowExtractos.classList.remove('hidden');
        if (selectDesde) selectDesde.innerHTML = '<option value="">Cargando...</option>';
        if (selectHasta) selectHasta.innerHTML = '<option value="">Cargando...</option>';

        if (typeof supabase !== 'undefined' && supabase) {
            const { data: extractos, error } = await supabase
                .from('extractos_mensuales')
                .select('id, mes, anio, data, created_at')
                .eq('cuenta_id', cuentaId)
                // ORDEN CRONOLÓGICO: más antiguo primero
                .order('anio', { ascending: true })
                .order('mes', { ascending: true });

            if (error) throw error;

            // Guardar extractos disponibles
            extractosAuditoria.extractosDisponibles = extractos.map(ext => ({
                id: ext.id,
                mes: ext.mes,
                anio: ext.anio,
                movimientos: ext.data?.length || 0,
                created_at: ext.created_at,
                // Valor para ordenar: AAAAMM
                valor: ext.anio * 100 + ext.mes
            }));

            // Renderizar selectores y lista visual
            renderizarSelectoresExtractos();
            renderizarListaVisualExtractos();
        }
    } catch (error) {
        console.error('Error cargando extractos:', error);
        if (selectDesde) selectDesde.innerHTML = '<option value="">Error al cargar</option>';
        if (selectHasta) selectHasta.innerHTML = '<option value="">Error al cargar</option>';
    }
}

/**
 * Renderizar los selectores de extractos (Desde/Hasta)
 */
function renderizarSelectoresExtractos() {
    const selectDesde = document.getElementById('selectExtractoDesde');
    const selectHasta = document.getElementById('selectExtractoHasta');

    if (!selectDesde || !selectHasta) return;

    const extractos = extractosAuditoria.extractosDisponibles;

    if (extractos.length === 0) {
        selectDesde.innerHTML = '<option value="">No hay extractos</option>';
        selectHasta.innerHTML = '<option value="">No hay extractos</option>';
        return;
    }

    // Generar opciones (orden cronológico - más antiguo primero)
    const opciones = extractos.map(ext => {
        const mesNombre = MESES_NOMBRES[ext.mes - 1];
        return `<option value="${ext.id}" data-valor="${ext.valor}">${mesNombre} ${ext.anio} (${ext.movimientos} mov.)</option>`;
    }).join('');

    selectDesde.innerHTML = '<option value="">-- Mes/Año --</option>' + opciones;
    selectHasta.innerHTML = '<option value="">-- Mes/Año --</option>' + opciones;
}

/**
 * Renderizar lista visual de extractos agrupados por año
 */
function renderizarListaVisualExtractos() {
    const container = document.getElementById('extractosListaVisual');
    if (!container) return;

    const extractos = extractosAuditoria.extractosDisponibles;

    if (extractos.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // Agrupar por año (orden cronológico - años más antiguos primero)
    const porAnio = {};
    extractos.forEach(ext => {
        if (!porAnio[ext.anio]) {
            porAnio[ext.anio] = [];
        }
        porAnio[ext.anio].push(ext);
    });

    // Ordenar años cronológicamente (más antiguo primero)
    const anios = Object.keys(porAnio).sort((a, b) => parseInt(a) - parseInt(b));

    let html = '';
    anios.forEach((anio, idx) => {
        const extractosAnio = porAnio[anio];
        const totalMov = extractosAnio.reduce((sum, e) => sum + e.movimientos, 0);
        // Solo colapsar si hay más de 2 años y no es el año actual o el anterior
        const anioActual = new Date().getFullYear();
        const collapsed = anios.length > 2 && parseInt(anio) < anioActual - 1;

        html += `
            <div class="extractos-anio-group${collapsed ? ' collapsed' : ''}" data-anio="${anio}">
                <div class="extractos-anio-header" onclick="toggleAnioGroup('${anio}')">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="extractos-anio-toggle">▼</span>
                        <h4>${anio}</h4>
                    </div>
                    <span class="extractos-anio-count">${extractosAnio.length} extractos · ${totalMov.toLocaleString('es-AR')} mov.</span>
                </div>
                <div class="extractos-anio-content">
                    ${extractosAnio.map(ext => {
                        const mesNombre = MESES_NOMBRES[ext.mes - 1];
                        const selected = extractosAuditoria.extractosSeleccionados.includes(ext.id);
                        return `
                            <div class="extracto-item${selected ? ' selected' : ''}"
                                 data-id="${ext.id}"
                                 data-valor="${ext.valor}"
                                 onclick="toggleExtractoSeleccion('${ext.id}')">
                                <span class="extracto-mes-nombre">${mesNombre}</span>
                                <span class="extracto-mov">${ext.movimientos} mov.</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    container.classList.remove('hidden');
}

/**
 * Toggle para expandir/colapsar grupo de año
 */
function toggleAnioGroup(anio) {
    const group = document.querySelector(`.extractos-anio-group[data-anio="${anio}"]`);
    if (group) {
        group.classList.toggle('collapsed');
    }
}

/**
 * Toggle selección de un extracto individual
 */
function toggleExtractoSeleccion(extractoId) {
    const idx = extractosAuditoria.extractosSeleccionados.indexOf(extractoId);
    if (idx > -1) {
        extractosAuditoria.extractosSeleccionados.splice(idx, 1);
    } else {
        extractosAuditoria.extractosSeleccionados.push(extractoId);
    }

    // Actualizar selectores Desde/Hasta basado en selección
    actualizarSelectoresDesdeSeleccion();

    // Actualizar visualización
    actualizarListaVisualExtractos();

    // Cargar datos de extractos seleccionados
    cargarDatosExtractosSeleccionados();
}

/**
 * Actualizar los selectores Desde/Hasta basado en la selección de extractos
 */
function actualizarSelectoresDesdeSeleccion() {
    if (extractosAuditoria.extractosSeleccionados.length === 0) {
        document.getElementById('selectExtractoDesde').value = '';
        document.getElementById('selectExtractoHasta').value = '';
        return;
    }

    // Encontrar el rango de extractos seleccionados
    const seleccionados = extractosAuditoria.extractosDisponibles.filter(
        ext => extractosAuditoria.extractosSeleccionados.includes(ext.id)
    );

    if (seleccionados.length > 0) {
        seleccionados.sort((a, b) => a.valor - b.valor);
        const primero = seleccionados[0];
        const ultimo = seleccionados[seleccionados.length - 1];

        document.getElementById('selectExtractoDesde').value = primero.id;
        document.getElementById('selectExtractoHasta').value = ultimo.id;
    }
}

/**
 * Actualizar la visualización de la lista de extractos (marcar seleccionados)
 */
function actualizarListaVisualExtractos() {
    const items = document.querySelectorAll('.extracto-item');
    items.forEach(item => {
        const id = item.dataset.id;
        if (extractosAuditoria.extractosSeleccionados.includes(id)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * Validar el rango de extractos seleccionados en los selectores
 */
function validarRangoExtractos() {
    const selectDesde = document.getElementById('selectExtractoDesde');
    const selectHasta = document.getElementById('selectExtractoHasta');

    const desdeId = selectDesde?.value;
    const hastaId = selectHasta?.value;

    if (!desdeId || !hastaId) {
        // Solo un selector tiene valor - seleccionar solo ese extracto
        if (desdeId) {
            extractosAuditoria.extractosSeleccionados = [desdeId];
        } else if (hastaId) {
            extractosAuditoria.extractosSeleccionados = [hastaId];
        } else {
            extractosAuditoria.extractosSeleccionados = [];
        }
    } else {
        // Ambos selectores tienen valor - seleccionar rango
        const desde = extractosAuditoria.extractosDisponibles.find(e => e.id === desdeId);
        const hasta = extractosAuditoria.extractosDisponibles.find(e => e.id === hastaId);

        if (desde && hasta) {
            // Asegurar que "desde" sea menor que "hasta"
            const valorDesde = Math.min(desde.valor, hasta.valor);
            const valorHasta = Math.max(desde.valor, hasta.valor);

            // Seleccionar todos los extractos en el rango
            extractosAuditoria.extractosSeleccionados = extractosAuditoria.extractosDisponibles
                .filter(ext => ext.valor >= valorDesde && ext.valor <= valorHasta)
                .map(ext => ext.id);
        }
    }

    // Actualizar visualización
    actualizarListaVisualExtractos();

    // Cargar datos de extractos seleccionados
    cargarDatosExtractosSeleccionados();
}

/**
 * Filtrar extractos en la lista visual por búsqueda
 */
function filtrarExtractos() {
    const busqueda = document.getElementById('searchExtractos')?.value?.toLowerCase() || '';
    const items = document.querySelectorAll('.extracto-item');

    items.forEach(item => {
        const mesNombre = item.querySelector('.extracto-mes-nombre')?.textContent?.toLowerCase() || '';
        const anio = item.closest('.extractos-anio-group')?.dataset.anio || '';

        if (busqueda === '' || mesNombre.includes(busqueda) || anio.includes(busqueda)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // Mostrar/ocultar grupos de año según si tienen items visibles
    document.querySelectorAll('.extractos-anio-group').forEach(group => {
        const visibles = group.querySelectorAll('.extracto-item[style=""]').length +
            group.querySelectorAll('.extracto-item:not([style])').length;
        if (visibles === 0 && busqueda !== '') {
            group.style.display = 'none';
        } else {
            group.style.display = '';
            // Si hay búsqueda, expandir grupos que tengan resultados
            if (busqueda !== '') {
                group.classList.remove('collapsed');
            }
        }
    });
}

/**
 * Cargar los datos de los extractos seleccionados
 */
async function cargarDatosExtractosSeleccionados() {
    const seleccionados = extractosAuditoria.extractosSeleccionados;

    if (seleccionados.length === 0) {
        state.datosExtracto = [];
        document.getElementById('previewExtractoAuditoria')?.classList.add('hidden');
        actualizarBotonConciliar();
        return;
    }

    try {
        // Cargar datos de cada extracto seleccionado
        let todosMovimientos = [];

        if (typeof supabase !== 'undefined' && supabase) {
            const { data: extractos, error } = await supabase
                .from('extractos_mensuales')
                .select('id, mes, anio, data')
                .in('id', seleccionados);

            if (error) throw error;

            // Combinar todos los movimientos
            extractos.forEach(ext => {
                if (ext.data && Array.isArray(ext.data)) {
                    ext.data.forEach(mov => {
                        todosMovimientos.push({
                            ...mov,
                            extractoId: ext.id,
                            extractoMes: ext.mes,
                            extractoAnio: ext.anio
                        });
                    });
                }
            });
        }

        // Ordenar movimientos por fecha (cronológico)
        todosMovimientos.sort((a, b) => {
            const fechaA = parsearFecha(a.fecha);
            const fechaB = parsearFecha(b.fecha);
            return fechaA - fechaB;
        });

        // Formatear para el conciliador
        state.datosExtracto = todosMovimientos.map((mov, idx) => ({
            id: `ext_${idx}`,
            fecha: mov.fecha,
            descripcion: mov.descripcion || '',
            origen: mov.origen || '',
            debito: parseFloat(mov.debito) || 0,
            credito: parseFloat(mov.credito) || 0,
            saldo: parseFloat(mov.saldo) || 0,
            extractoOrigen: `${MESES_NOMBRES[mov.extractoMes - 1]} ${mov.extractoAnio}`
        }));

        // Mostrar preview
        mostrarPreviewExtractoAuditoria();

        actualizarBotonConciliar();

    } catch (error) {
        console.error('Error cargando datos de extractos:', error);
        mostrarMensaje('Error al cargar los extractos seleccionados', 'error');
    }
}

/**
 * Mostrar preview de extractos de auditoría seleccionados
 */
function mostrarPreviewExtractoAuditoria() {
    const preview = document.getElementById('previewExtractoAuditoria');
    const info = document.getElementById('extractoAuditoriaInfo');
    const count = document.getElementById('recordCountExtractoAuditoria');

    if (!preview) return;

    const seleccionados = extractosAuditoria.extractosSeleccionados;
    const movimientos = state.datosExtracto.length;

    if (seleccionados.length === 0) {
        preview.classList.add('hidden');
        return;
    }

    // Obtener rango de períodos
    const extractosInfo = extractosAuditoria.extractosDisponibles.filter(
        ext => seleccionados.includes(ext.id)
    );
    extractosInfo.sort((a, b) => a.valor - b.valor);

    let periodoText = '';
    if (extractosInfo.length === 1) {
        const ext = extractosInfo[0];
        periodoText = `${MESES_NOMBRES[ext.mes - 1]} ${ext.anio}`;
    } else if (extractosInfo.length > 1) {
        const primero = extractosInfo[0];
        const ultimo = extractosInfo[extractosInfo.length - 1];
        periodoText = `${MESES_NOMBRES[primero.mes - 1]} ${primero.anio} - ${MESES_NOMBRES[ultimo.mes - 1]} ${ultimo.anio}`;
    }

    if (info) info.textContent = periodoText;
    if (count) count.textContent = `${movimientos.toLocaleString('es-AR')} movimientos`;

    preview.classList.remove('hidden');
}

/**
 * Parsear fecha en varios formatos
 */
function parsearFecha(fechaStr) {
    if (!fechaStr) return new Date(0);

    // Si ya es una fecha
    if (fechaStr instanceof Date) return fechaStr;

    // Formato DD/MM/YYYY
    if (typeof fechaStr === 'string' && fechaStr.includes('/')) {
        const [dia, mes, anio] = fechaStr.split('/');
        return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
    }

    // Formato YYYY-MM-DD
    if (typeof fechaStr === 'string' && fechaStr.includes('-')) {
        return new Date(fechaStr);
    }

    return new Date(fechaStr);
}

// Extender la función init para cargar clientes si es necesario
const originalInit = init;
init = function () {
    originalInit();
    // Si se selecciona auditoría por defecto, cargar clientes
    if (extractosAuditoria.origenActual === 'auditoria') {
        cargarClientesParaAuditoria();
    }
};
