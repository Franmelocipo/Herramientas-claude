// Configuración PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let datosExtraidos = [];

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
    // Extraer número de VEP del nombre del archivo
    const nombreArchivo = archivo.name;
    const matchVEP = nombreArchivo.match(/nrovep_(\d+)/);
    const nroVEP = matchVEP ? matchVEP[1] : '';

    // Leer PDF
    const arrayBuffer = await archivo.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extraer texto de la primera página
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const texto = textContent.items.map(item => item.str).join(' ');

    // Extraer datos del texto
    const datos = extraerDatosVEP(texto, nroVEP);

    return datos;
}

function extraerDatosVEP(texto, nroVEP) {
    const registros = [];

    // Extraer fecha de pago
    const matchFecha = texto.match(/Fecha de Pago:\s*(\d{4})-(\d{2})-(\d{2})/);
    const fecha = matchFecha ? `${matchFecha[3]}/${matchFecha[2]}/${matchFecha[1]}` : '';

    // Extraer período
    const matchPeriodo = texto.match(/Período:\s*(\d{4})-(\d{2})/);
    const periodo = matchPeriodo ? matchPeriodo[0].replace('Período: ', '').replace('-', '/') : '';

    // Extraer tipo de pago para determinar impuesto
    const esIVA = texto.includes('IVA - Saldo DJ') || texto.includes('IVA DJ');
    const esSICOSS = texto.includes('Empleadores SICOSS');
    const esGanancias = texto.includes('GANANCIAS SOCIEDADES');

    let codImpuesto, impuesto;
    if (esIVA) {
        codImpuesto = '30';
        impuesto = 'IVA';
    } else if (esSICOSS) {
        codImpuesto = '30';
        impuesto = 'GANANCIAS SOCIEDADES';
    } else if (esGanancias) {
        codImpuesto = '30';
        impuesto = 'GANANCIAS SOCIEDADES';
    }

    // Extraer concepto
    const matchConcepto = texto.match(/Concepto:\s*(\d+)\s+([A-ZÁÉÍÓÚ\s\/]+)/);
    const codConcepto = matchConcepto ? matchConcepto[1] : '19';
    const concepto = matchConcepto ? matchConcepto[2].trim() : 'DECLARACIÓN JURADA';

    // Extraer subconcepto
    const matchSubconcepto = texto.match(/Subconcepto:\s*(\d+)\s+([A-ZÁÉÍÓÚ\s\/]+)/);
    const codSubconcepto = matchSubconcepto ? matchSubconcepto[1] : '19';
    const subconcepto = matchSubconcepto ? matchSubconcepto[2].trim() : 'DECLARACIÓN JURADA';

    // Extraer entidad de pago
    const matchEntidad = texto.match(/Debito en cuenta del Banco:\s*([A-Z\s\.]+)/);
    const entidadPago = matchEntidad ? matchEntidad[1].trim() : '';

    // Extraer líneas de detalle con importes
    const lineasDetalle = [];

    // Para IVA (simple, un solo importe)
    if (esIVA) {
        const matchImporte = texto.match(/IVA\s*\(\d+\)\s*\$?([\d\.,]+)/);
        if (matchImporte) {
            const importe = parseFloat(matchImporte[1].replace(/\./g, '').replace(',', '.'));
            lineasDetalle.push({
                descripcion: 'IVA',
                importe: importe
            });
        }
    }

    // Para SICOSS (múltiples líneas)
    if (esSICOSS) {
        const regexLineas = /([A-ZÁÉÍÓÚ\s\.]+)\s*\((\d+)\)\s*\$?([\d\.,]+)/g;
        let match;
        while ((match = regexLineas.exec(texto)) !== null) {
            const descripcion = match[1].trim();
            const codigo = match[2];
            const importe = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));

            if (importe > 0 && !descripcion.includes('IMPORTE PAGADO')) {
                lineasDetalle.push({
                    descripcion: descripcion,
                    codigo: codigo,
                    importe: importe
                });
            }
        }
    }

    // Crear un registro por cada línea de detalle
    lineasDetalle.forEach(linea => {
        registros.push({
            NRO_VEP: nroVEP,
            FECHA: fecha,
            PERIODO: periodo,
            COD_IMPUESTO: codImpuesto,
            IMPUESTO: impuesto,
            COD_CONCEPTO: codConcepto,
            CONCEPTO: concepto,
            COD_SUBCONCEPTO: codSubconcepto,
            SUBCONCEPTO: subconcepto,
            IMPORTE: linea.importe,
            ENTIDAD_PAGO: entidadPago
        });
    });

    return registros;
}

function mostrarResultados() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');

    resultsSection.style.display = 'block';

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

    // Mostrar área de carga
    document.getElementById('uploadArea').style.display = 'block';

    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
