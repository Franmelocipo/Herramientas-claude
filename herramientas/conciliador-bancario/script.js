/**
 * Conciliador Bancario
 * Compara movimientos del Mayor Contable con Extractos Bancarios
 */

// Estado de la aplicación
let state = {
    tipoConciliacion: null, // 'creditos' o 'debitos'
    datosMayor: [],
    datosExtracto: [],
    toleranciaFecha: 30,
    toleranciaImporte: 20000,
    resultados: null
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

// Estado del progreso
let progreso = {
    paso: 1,
    totalPasos: 4,
    porcentaje: 0,
    procesados: 0,
    total: 0,
    conciliados: 0
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
    btnNuevaContainer: document.getElementById('btnNuevaContainer'),
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

    // Modal de progreso
    overlayProgreso: document.getElementById('overlay-progreso'),
    modalProgreso: document.getElementById('modal-progreso'),
    barraProgreso: document.getElementById('barra-progreso'),
    porcentajeProgreso: document.getElementById('porcentaje-progreso'),
    pasoProgreso: document.getElementById('paso-progreso'),
    mensajeProgreso: document.getElementById('mensaje-progreso'),
    contadorProgreso: document.getElementById('contador-progreso'),
    conciliadosProgreso: document.getElementById('conciliados-progreso')
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
        state.toleranciaFecha = parseInt(elements.toleranciaFecha.value) || 30;
    });
    elements.toleranciaImporte.addEventListener('change', () => {
        state.toleranciaImporte = parseFloat(elements.toleranciaImporte.value) || 20000;
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
                const sheetName = workbook.SheetNames[0];
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

function parsearMayor(data) {
    return data.map((row, index) => {
        // Buscar las columnas por diferentes nombres posibles
        const fecha = parsearFecha(
            row['Fecha asiento'] || row['Fecha'] || row['fecha_asiento'] || row['fecha'] || ''
        );
        const numeroAsiento = row['Número asiento'] || row['Nº Asiento'] || row['numero_asiento'] || row['Numero'] || '';
        const ce = row['C/E'] || row['CE'] || row['c_e'] || '';
        const tipoAsiento = row['Tipo de asiento'] || row['Tipo'] || row['tipo_asiento'] || row['tipo'] || '';
        const leyenda = row['Leyenda movimiento'] || row['Leyenda'] || row['leyenda_movimiento'] || row['leyenda'] || row['Descripción'] || '';
        const debe = parsearImporte(row['Debe'] || row['debe'] || '0');
        const haber = parsearImporte(row['Haber'] || row['haber'] || '0');

        return {
            id: `M${index}`,
            fecha,
            numeroAsiento,
            ce,
            tipoAsiento,
            leyenda,
            debe,
            haber,
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
        data = [
            ['Fecha asiento', 'Número asiento', 'C/E', 'Tipo de asiento', 'Leyenda movimiento', 'Debe', 'Haber'],
            ['01/08/2024', '29001', 'E', 'CN', 'Liquidación Visa - Comercio', '', '150000'],
            ['02/08/2024', '29002', 'E', 'CN', 'Liquidación Mastercard - Comercio', '', '85500'],
            ['03/08/2024', '29003', 'S', 'PA', 'Pago a proveedor ABC', '200000', '']
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
        state.toleranciaFecha = parseInt(elements.toleranciaFecha.value) || 30;
        state.toleranciaImporte = parseFloat(elements.toleranciaImporte.value) || 20000;

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
        if (difImporte > state.toleranciaImporte) continue;

        // Verificar tolerancia de fecha
        if (!fechaDentroTolerancia(movMayor.fecha, movExtracto.fecha)) continue;

        return i;
    }

    return -1;
}

function buscarCombinacionQueSume(importeObjetivo, fechaRef, lista, maxElementos) {
    // Filtrar por fecha primero
    const candidatos = lista.filter(m => fechaDentroTolerancia(fechaRef, m.fecha));

    if (candidatos.length === 0) return null;

    // Buscar combinaciones de 2 a maxElementos elementos
    for (let n = 2; n <= Math.min(maxElementos, candidatos.length); n++) {
        const resultado = encontrarCombinacion(candidatos, importeObjetivo, n);
        if (resultado) return resultado;
    }

    return null;
}

function encontrarCombinacion(lista, objetivo, n) {
    const indices = [];

    function buscar(start, suma, count) {
        // Verificar si encontramos una combinación válida
        if (count === n) {
            const diferencia = Math.abs(suma - objetivo);
            if (diferencia <= state.toleranciaImporte) {
                return indices.map(i => lista[i]);
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

    const diff = Math.abs(fecha1.getTime() - fecha2.getTime());
    const dias = diff / (1000 * 60 * 60 * 24);

    return dias <= state.toleranciaFecha;
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

    // Poblar selector de tipos para el filtro de Mayor
    poblarSelectorTiposMayor();

    // Mostrar sección de resultados
    elements.resultados.classList.remove('hidden');
    elements.btnNuevaContainer.classList.remove('hidden');

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
                    <td>${formatearFecha(m.fecha)}</td>
                    <td>${m.numeroAsiento}</td>
                    <td title="${m.leyenda}">${truncar(m.leyenda, 30)}</td>
                    <td class="text-right">${formatearNumero(m.importe)}</td>
                `;
            } else {
                html += '<td></td><td></td><td></td><td></td>';
            }

            // Separador
            html += '<td class="separator"></td>';

            // Columnas Extracto
            if (e) {
                html += `
                    <td>${formatearFecha(e.fecha)}</td>
                    <td title="${e.descripcion}">${truncar(e.descripcion, 25)}</td>
                    <td>${e.origen}</td>
                    <td class="text-right">${formatearNumero(e.importe)}</td>
                `;
            } else {
                html += '<td></td><td></td><td></td><td></td>';
            }

            // Diferencia (solo en primera fila)
            if (isFirst) {
                const colorClass = match.diferencia > 0 ? 'text-red' : 'text-green';
                html += `<td class="text-right ${colorClass}">${match.diferencia > 0 ? formatearNumero(match.diferencia) : '-'}</td>`;
            } else {
                html += '<td></td>';
            }

            // Botón de acción (solo en primera fila)
            if (isFirst) {
                const manualBadge = match.manual ? '<span class="badge-manual">Manual</span>' : '';
                html += `
                    <td class="col-action">
                        ${manualBadge}
                        <button class="btn-desconciliar" onclick="desconciliar('${match.id}')" title="Desconciliar">
                            ✕
                        </button>
                    </td>
                `;
            } else {
                html += '<td></td>';
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
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Mayor fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllMayor) {
        elements.selectAllMayor.checked = false;
    }
}

function llenarTablaExtractoPendiente(pendientes) {
    let html = '';

    // Actualizar contador en header
    elements.countExtractoPendiente.textContent = `(${pendientes.length})`;

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

    elements.tablaExtractoPendiente.innerHTML = html || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">Todos los movimientos del Extracto fueron conciliados</td></tr>';

    // Reset checkbox "seleccionar todos"
    if (elements.selectAllExtracto) {
        elements.selectAllExtracto.checked = false;
    }
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
    const pendientes = mayorPendienteFiltrado;

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
            </tr>
        `;
    });

    elements.tablaMayorPendiente.innerHTML = html || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:20px;">No hay movimientos que coincidan con los filtros</td></tr>';
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
    const pendientes = extractoPendienteFiltrado;

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

    // Hoja 1: Conciliados
    const dataConciliados = [];
    dataConciliados.push([
        'Fecha Mayor', 'Nº Asiento', 'Leyenda Mayor', 'Importe Mayor', '',
        'Fecha Extracto', 'Descripción Extracto', 'Origen', 'Importe Extracto', 'Diferencia', 'Tipo'
    ]);

    res.conciliados.forEach(match => {
        const maxRows = Math.max(match.mayor.length, match.extracto.length);

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
                i === 0 ? (match.manual ? 'Manual' : 'Automático') : ''
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

    // Hoja 4: Resumen
    const totalConciliadoMayor = res.conciliados.reduce((sum, c) =>
        sum + c.mayor.reduce((s, m) => s + m.importe, 0), 0);
    const totalConciliadoExtracto = res.conciliados.reduce((sum, c) =>
        sum + c.extracto.reduce((s, e) => s + e.importe, 0), 0);
    const totalMayorPendiente = res.mayorNoConciliado.reduce((sum, m) => sum + m.importe, 0);
    const totalExtractoPendiente = res.extractoNoConciliado.reduce((sum, e) => sum + e.importe, 0);

    const dataResumen = [
        ['RESUMEN DE CONCILIACIÓN'],
        [''],
        ['Tipo de conciliación:', state.tipoConciliacion === 'creditos' ? 'Créditos' : 'Débitos'],
        ['Tolerancia de fechas:', `${state.toleranciaFecha} días`],
        ['Tolerancia de importes:', `$${state.toleranciaImporte.toLocaleString('es-AR')}`],
        [''],
        ['RESULTADOS'],
        ['Cantidad de grupos conciliados:', res.conciliados.length],
        ['Cantidad Mayor no conciliado:', res.mayorNoConciliado.length],
        ['Cantidad Extracto no conciliado:', res.extractoNoConciliado.length],
        [''],
        ['TOTALES'],
        ['Total Mayor conciliado:', totalConciliadoMayor],
        ['Total Extracto conciliado:', totalConciliadoExtracto],
        ['Total Mayor no conciliado:', totalMayorPendiente],
        ['Total Extracto no conciliado:', totalExtractoPendiente],
        [''],
        ['Diferencia en conciliados:', Math.abs(totalConciliadoMayor - totalConciliadoExtracto)]
    ];

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
        resultados: null
    };

    // Resetear selección y contador
    seleccion = { mayor: [], extracto: [] };
    conciliacionIdCounter = 0;

    // Resetear filtros
    resetearFiltros();

    // Resetear UI
    elements.tipoButtons.forEach(btn => btn.classList.remove('active'));
    elements.stepArchivos.classList.add('hidden');
    elements.stepTolerancias.classList.add('hidden');
    elements.stepEjecutar.classList.add('hidden');
    elements.resultados.classList.add('hidden');
    elements.btnNuevaContainer.classList.add('hidden');
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
}
