// Configuración PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let datosExtraidos = [];
let contadorVEPsSinNumero = 0; // Contador para generar IDs únicos cuando no se puede extraer el número de VEP

// Drag & Drop
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    procesarArchivos(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    procesarArchivos(files);
});

async function procesarArchivos(archivos) {
    if (archivos.length === 0) {
        alert('No se seleccionaron archivos PDF');
        return;
    }

    datosExtraidos = [];
    contadorVEPsSinNumero = 0; // Resetear contador de VEPs sin número

    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    for (let i = 0; i < archivos.length; i++) {
        const archivo = archivos[i];
        progressText.textContent = `${i + 1} de ${archivos.length} archivos procesados`;
        progressFill.style.width = `${((i + 1) / archivos.length) * 100}%`;

        try {
            const datos = await procesarVEP(archivo);
            datosExtraidos.push(...datos);
        } catch (error) {
            console.error(`Error procesando ${archivo.name}:`, error);
        }
    }

    mostrarResultados();
}

async function procesarVEP(archivo) {
    // Leer PDF
    const arrayBuffer = await archivo.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extraer texto de la primera página
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const texto = textContent.items.map(item => item.str).join(' ');

    // Extraer número de VEP: primero del nombre del archivo, luego del contenido del PDF
    let nroVEP = '';

    // Intentar desde el nombre del archivo
    const nombreArchivo = archivo.name;
    const matchVEPNombre = nombreArchivo.match(/nrovep_(\d+)/i);
    if (matchVEPNombre) {
        nroVEP = matchVEPNombre[1];
    } else {
        // Intentar extraer del contenido del PDF con varios patrones
        // Patrones comunes en VEPs de ARCA/AFIP:
        // - "VEP Nro. 12345678"
        // - "VEP N° 12345678"
        // - "Número de VEP: 12345678"
        // - "VEP: 12345678"
        // - "N° VEP 12345678"
        // - "VEP 12345678901234" (número de 8-14 dígitos después de VEP)
        const patronesVEP = [
            /VEP\s*(?:Nro\.?|N[°º]\.?|:)\s*(\d+)/i,
            /N[°º]\.?\s*(?:de\s+)?VEP[:\s]*(\d+)/i,
            /Número\s+de\s+VEP[:\s]*(\d+)/i,
            /Nro\.?\s*VEP[:\s]*(\d+)/i,
            /VEP\s+(\d{8,14})/i,  // VEP seguido de número largo (8-14 dígitos)
            /(\d{10,14})\s*VEP/i  // Número largo seguido de VEP
        ];

        for (const patron of patronesVEP) {
            const match = texto.match(patron);
            if (match) {
                nroVEP = match[1];
                console.log(`Número de VEP extraído del contenido: ${nroVEP}`);
                break;
            }
        }
    }

    // Si aún no se encontró el número de VEP, generar uno basado en el nombre del archivo
    if (!nroVEP) {
        contadorVEPsSinNumero++;
        // Usar nombre del archivo sin extensión como identificador
        const nombreSinExtension = archivo.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
        nroVEP = `AUTO_${contadorVEPsSinNumero}_${nombreSinExtension.substring(0, 20)}`;
        console.warn(`No se pudo extraer número de VEP, generando ID: ${nroVEP}`);
    }

    // Extraer datos del texto
    const datos = extraerDatosVEP(texto, nroVEP);

    return datos;
}

function extraerDatosVEP(texto, nroVEP) {
    const registros = [];

    console.log('=== Procesando VEP:', nroVEP, '===');

    // Extraer fecha de pago
    const matchFecha = texto.match(/Fecha de Pago:\s*(\d{4})-(\d{2})-(\d{2})/);
    const fecha = matchFecha ? `${matchFecha[3]}/${matchFecha[2]}/${matchFecha[1]}` : '';

    // Extraer período
    const matchPeriodo = texto.match(/Período:\s*(\d{4})-(\d{2})/);
    const periodo = matchPeriodo ? `${matchPeriodo[2]}/${matchPeriodo[1]}` : '';

    // Extraer concepto (se repite para todas las líneas)
    const matchConcepto = texto.match(/Concepto:\s*(\d+)\s+([A-ZÁÉÍÓÚ\s\/]+)/);
    const codConcepto = matchConcepto ? matchConcepto[1].trim() : '19';
    const concepto = matchConcepto ? matchConcepto[2].trim() : 'OBLIGACION MENSUAL/ANUAL';

    // Extraer subconcepto (se repite para todas las líneas)
    const matchSubconcepto = texto.match(/Subconcepto:\s*(\d+)\s+([A-ZÁÉÍÓÚ\s\/]+)/);
    const codSubconcepto = matchSubconcepto ? matchSubconcepto[1].trim() : '19';
    const subconcepto = matchSubconcepto ? matchSubconcepto[2].trim() : 'OBLIGACION MENSUAL/ANUAL';

    // Extraer entidad de pago
    const matchEntidad = texto.match(/Debito en cuenta del Banco:\s*([A-ZÁÉÍÓÚ\s\.]+?)(?:\n|Nro\.)/);
    const entidadPago = matchEntidad ? matchEntidad[1].trim() : '';

    console.log('Datos base:', { fecha, periodo, codConcepto, concepto, codSubconcepto, subconcepto, entidadPago });

    // Extraer todos los impuestos con sus códigos e importes
    const impuestos = [];

    // Regex para capturar: DESCRIPCION (CODIGO) $IMPORTE
    const regexImpuesto = /([A-ZÁÉÍÓÚ\s\.\-\/]+?)\s*\((\d+)\)\s*\$?([\d\.,]+)/g;

    let match;
    while ((match = regexImpuesto.exec(texto)) !== null) {
        const descripcion = match[1].trim();
        const codigo = match[2];
        const importeStr = match[3];
        const importe = parseFloat(importeStr.replace(/\./g, '').replace(',', '.'));

        // Filtrar solo los impuestos válidos (excluir "IMPORTE PAGADO" y similares)
        if (!descripcion.includes('IMPORTE PAGADO') &&
            !descripcion.includes('Datos del') &&
            importe > 0) {

            impuestos.push({
                descripcion: descripcion,
                codigo: codigo,
                importe: importe
            });

            console.log('Impuesto encontrado:', { descripcion, codigo, importe });
        }
    }

    console.log('Total impuestos encontrados:', impuestos.length);

    // Si no se encontraron impuestos con el regex, buscar IVA específicamente
    if (impuestos.length === 0 && texto.includes('IVA')) {
        const matchIVA = texto.match(/IVA\s*\((\d+)\)\s*\$?([\d\.,]+)/);
        if (matchIVA) {
            impuestos.push({
                descripcion: 'IVA',
                codigo: matchIVA[1],
                importe: parseFloat(matchIVA[2].replace(/\./g, '').replace(',', '.'))
            });
        }
    }

    // Crear una línea por cada impuesto
    impuestos.forEach(impuesto => {
        registros.push({
            NRO_VEP: nroVEP,
            FECHA: fecha,
            PERIODO: periodo,
            COD_IMPUESTO: impuesto.codigo,          // Código del impuesto
            IMPUESTO: impuesto.descripcion,         // Nombre del impuesto
            COD_CONCEPTO: codConcepto,              // Se repite en todas
            CONCEPTO: concepto,                     // Se repite en todas
            COD_SUBCONCEPTO: codSubconcepto,        // Se repite en todas
            SUBCONCEPTO: subconcepto,               // Se repite en todas
            IMPORTE: impuesto.importe,
            ENTIDAD_PAGO: entidadPago
        });
    });

    console.log('Registros generados:', registros.length);

    return registros;
}

function mostrarResultados() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const actionBar = document.getElementById('actionBar');

    resultsSection.style.display = 'block';

    // Mostrar barra de acciones superior
    if (actionBar) {
        actionBar.style.display = 'block';
        document.getElementById('recordCount').textContent = `${datosExtraidos.length} registros`;
    }

    let html = `
        <div class="summary">
            <p><strong>${datosExtraidos.length} registros</strong> extraídos de los VEPs</p>
        </div>

        <table class="results-table">
            <thead>
                <tr>
                    <th>NRO_VEP</th>
                    <th>FECHA</th>
                    <th>PERIODO</th>
                    <th>IMPUESTO</th>
                    <th>CONCEPTO</th>
                    <th>IMPORTE</th>
                    <th>ENTIDAD_PAGO</th>
                </tr>
            </thead>
            <tbody>
    `;

    datosExtraidos.forEach(reg => {
        html += `
            <tr>
                <td>${reg.NRO_VEP}</td>
                <td>${reg.FECHA}</td>
                <td>${reg.PERIODO}</td>
                <td>${reg.IMPUESTO}</td>
                <td>${reg.CONCEPTO}</td>
                <td>$${reg.IMPORTE.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                <td>${reg.ENTIDAD_PAGO}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    resultsList.innerHTML = html;
}

function exportarExcel() {
    if (datosExtraidos.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Convertir datos a formato para Excel
    const ws = XLSX.utils.json_to_sheet(datosExtraidos, {
        header: ['NRO_VEP', 'FECHA', 'PERIODO', 'COD_IMPUESTO', 'IMPUESTO',
                 'COD_CONCEPTO', 'CONCEPTO', 'COD_SUBCONCEPTO', 'SUBCONCEPTO',
                 'IMPORTE', 'ENTIDAD_PAGO']
    });

    // Ajustar anchos de columna
    ws['!cols'] = [
        { wch: 15 }, // NRO_VEP
        { wch: 12 }, // FECHA
        { wch: 10 }, // PERIODO
        { wch: 12 }, // COD_IMPUESTO
        { wch: 25 }, // IMPUESTO
        { wch: 12 }, // COD_CONCEPTO
        { wch: 30 }, // CONCEPTO
        { wch: 15 }, // COD_SUBCONCEPTO
        { wch: 30 }, // SUBCONCEPTO
        { wch: 15 }, // IMPORTE
        { wch: 30 }  // ENTIDAD_PAGO
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'VEPs');

    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `veps_arca_${fecha}.xlsx`);
}

function nuevaConversion() {
    // Limpiar datos
    datosExtraidos = [];

    // Resetear input de archivos
    document.getElementById('fileInput').value = '';

    // Ocultar secciones
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';

    // Ocultar barra de acciones
    const actionBar = document.getElementById('actionBar');
    if (actionBar) {
        actionBar.style.display = 'none';
    }

    // Mostrar área de carga
    document.getElementById('uploadArea').style.display = 'block';

    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// INTEGRACIÓN CON CONVERSOR DE ASIENTOS
// ============================================

/**
 * Envía los datos procesados directamente al Conversor de Asientos
 * sin necesidad de descargar/importar Excel manualmente
 */
function enviarAConversorAsientos() {
    if (datosExtraidos.length === 0) {
        alert('No hay datos para enviar. Primero procesa algunos VEPs.');
        return;
    }

    // Preparar datos para el conversor de asientos
    const datosVEP = {
        veps: datosExtraidos,  // Los mismos datos que irían al Excel
        timestamp: Date.now(),
        origen: 'conversor-veps',
        cantidadRegistros: datosExtraidos.length,
        cantidadVEPs: new Set(datosExtraidos.map(d => d.NRO_VEP)).size
    };

    // Guardar en localStorage
    localStorage.setItem('veps_para_asientos', JSON.stringify(datosVEP));

    // Mostrar feedback al usuario
    const cantidadVEPs = datosVEP.cantidadVEPs;
    const cantidadRegistros = datosVEP.cantidadRegistros;

    // Crear notificación temporal
    mostrarNotificacion(`Abriendo conversor de asientos con ${cantidadVEPs} VEP(s) y ${cantidadRegistros} registro(s)...`, 'info');

    // Abrir el Conversor de Asientos en nueva pestaña con parámetro de origen
    const urlConversor = '../conversor-asientos/?origen=veps';
    window.open(urlConversor, '_blank');
}

/**
 * Muestra una notificación temporal en pantalla
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Remover notificación existente si hay
    const existente = document.querySelector('.notificacion-vep');
    if (existente) {
        existente.remove();
    }

    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion-vep';
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: ${tipo === 'info' ? '#667eea' : tipo === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    notificacion.textContent = mensaje;

    // Agregar estilos de animación si no existen
    if (!document.getElementById('notificacion-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notificacion-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notificacion);

    // Auto-remover después de 3 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}
