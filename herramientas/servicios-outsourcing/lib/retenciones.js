/**
 * CÁLCULO DE RETENCIONES RG 830
 * Sistema de Servicios de Outsourcing
 */

// =====================================================
// FUNCIONES PRINCIPALES DE CÁLCULO
// =====================================================

/**
 * Calcula la retención de ganancias según RG 830
 * @param {number} montoTotal - Monto total del comprobante
 * @param {object} codigoRetencion - Objeto con datos del código de retención
 * @param {string} condicionProveedor - 'inscripto' o 'no_inscripto'
 * @param {array} escalas - Array de escalas (si tiene_escala = true)
 * @returns {object} - {montoRetencion, alicuota, baseCalculo, desglose, correspondeRetencion}
 */
function calcularRetencion(montoTotal, codigoRetencion, condicionProveedor, escalas = []) {
    if (!montoTotal || !codigoRetencion || !condicionProveedor) {
        return {
            correspondeRetencion: false,
            montoRetencion: 0,
            alicuota: 0,
            baseCalculo: montoTotal,
            desglose: null,
            mensaje: 'Datos incompletos para el cálculo'
        };
    }

    // Si tiene escala progresiva
    if (codigoRetencion.tiene_escala && escalas && escalas.length > 0) {
        return calcularRetencionEscala(montoTotal, escalas);
    }

    // Cálculo simple (sin escala)
    return calcularRetencionSimple(montoTotal, codigoRetencion, condicionProveedor);
}

/**
 * Calcula retención simple (sin escala progresiva)
 * @param {number} montoTotal - Monto total del comprobante
 * @param {object} codigo - Código de retención
 * @param {string} condicion - Condición del proveedor
 * @returns {object} - Resultado del cálculo
 */
function calcularRetencionSimple(montoTotal, codigo, condicion) {
    const alicuota = condicion === 'inscripto'
        ? codigo.alicuota_inscripto
        : codigo.alicuota_no_inscripto;

    const montoMinimo = condicion === 'inscripto'
        ? codigo.monto_minimo_inscripto || 0
        : codigo.monto_minimo_no_inscripto || 0;

    const retencionMinima = codigo.retencion_minima || 0;

    // Verificar si el monto supera el mínimo no sujeto a retención
    if (montoTotal <= montoMinimo) {
        return {
            correspondeRetencion: false,
            montoRetencion: 0,
            alicuota: alicuota,
            baseCalculo: montoTotal,
            desglose: null,
            mensaje: `No corresponde retención. El monto no supera el mínimo de ${formatCurrency(montoMinimo)}`
        };
    }

    // Calcular retención
    const baseCalculo = montoTotal - montoMinimo;
    let montoRetencion = baseCalculo * (alicuota / 100);

    // Verificar retención mínima
    if (montoRetencion < retencionMinima) {
        montoRetencion = retencionMinima;
    }

    return {
        correspondeRetencion: true,
        montoRetencion: Math.round(montoRetencion * 100) / 100, // Redondear a 2 decimales
        alicuota: alicuota,
        baseCalculo: baseCalculo,
        desglose: {
            montoTotal: montoTotal,
            montoMinimo: montoMinimo,
            baseCalculo: baseCalculo,
            alicuota: alicuota,
            retencionCalculada: montoRetencion,
            retencionMinima: retencionMinima
        },
        mensaje: `Corresponde retención de ${formatCurrency(montoRetencion)} (${alicuota}%)`
    };
}

/**
 * Calcula retención con escala progresiva
 * @param {number} montoTotal - Monto total del comprobante
 * @param {array} escalas - Array de escalas ordenadas por 'orden'
 * @returns {object} - Resultado del cálculo
 */
function calcularRetencionEscala(montoTotal, escalas) {
    if (!escalas || escalas.length === 0) {
        return {
            correspondeRetencion: false,
            montoRetencion: 0,
            alicuota: 0,
            baseCalculo: montoTotal,
            desglose: null,
            mensaje: 'No se encontraron escalas para este código'
        };
    }

    // Ordenar escalas por orden
    const escalasOrdenadas = [...escalas].sort((a, b) => a.orden - a.orden);

    // Buscar la escala correspondiente
    let escalaAplicable = null;

    for (const escala of escalasOrdenadas) {
        if (escala.hasta === null || escala.hasta === undefined) {
            // Última escala (sin límite superior)
            if (montoTotal > escala.desde) {
                escalaAplicable = escala;
                break;
            }
        } else {
            // Escalas con límite
            if (montoTotal > escala.desde && montoTotal <= escala.hasta) {
                escalaAplicable = escala;
                break;
            }
        }
    }

    // Si no se encuentra escala, no corresponde retención
    if (!escalaAplicable) {
        return {
            correspondeRetencion: false,
            montoRetencion: 0,
            alicuota: 0,
            baseCalculo: montoTotal,
            desglose: null,
            mensaje: `No corresponde retención. Monto por debajo del mínimo (${formatCurrency(escalasOrdenadas[0].desde)})`
        };
    }

    // Calcular retención según la escala
    const excedente = montoTotal - (escalaAplicable.excedente_sobre || 0);
    const montoRetencion = (escalaAplicable.fijo || 0) + (excedente * (escalaAplicable.alicuota / 100));

    return {
        correspondeRetencion: true,
        montoRetencion: Math.round(montoRetencion * 100) / 100,
        alicuota: escalaAplicable.alicuota,
        baseCalculo: montoTotal,
        desglose: {
            montoTotal: montoTotal,
            escalaDesde: escalaAplicable.desde,
            escalaHasta: escalaAplicable.hasta || 'Sin límite',
            excedente: excedente,
            fijo: escalaAplicable.fijo || 0,
            alicuota: escalaAplicable.alicuota,
            retencionCalculada: montoRetencion
        },
        mensaje: `Corresponde retención de ${formatCurrency(montoRetencion)} (Fijo: ${formatCurrency(escalaAplicable.fijo || 0)} + ${escalaAplicable.alicuota}% sobre ${formatCurrency(excedente)})`
    };
}

// =====================================================
// FUNCIONES HELPER PARA UI
// =====================================================

/**
 * Obtiene el mensaje de ayuda para un código de retención
 * @param {object} codigo - Código de retención
 * @returns {string} - Mensaje de ayuda
 */
function getMensajeAyudaRetencion(codigo) {
    if (!codigo) return '';

    let mensaje = `<strong>${codigo.codigo} - ${codigo.concepto}</strong><br>`;

    if (codigo.tiene_escala) {
        mensaje += `Este código tiene escala progresiva. La retención se calculará según el monto.`;
    } else {
        mensaje += `<br><strong>Alícuotas:</strong><br>`;
        mensaje += `- Inscripto: ${codigo.alicuota_inscripto}%<br>`;
        mensaje += `- No inscripto: ${codigo.alicuota_no_inscripto}%<br>`;

        if (codigo.monto_minimo_inscripto > 0 || codigo.monto_minimo_no_inscripto > 0) {
            mensaje += `<br><strong>Montos mínimos:</strong><br>`;
            if (codigo.monto_minimo_inscripto > 0) {
                mensaje += `- Inscripto: ${formatCurrency(codigo.monto_minimo_inscripto)}<br>`;
            }
            if (codigo.monto_minimo_no_inscripto > 0) {
                mensaje += `- No inscripto: ${formatCurrency(codigo.monto_minimo_no_inscripto)}<br>`;
            }
        }

        if (codigo.retencion_minima > 0) {
            mensaje += `<br><strong>Retención mínima:</strong> ${formatCurrency(codigo.retencion_minima)}`;
        }
    }

    return mensaje;
}

/**
 * Genera HTML de desglose de retención
 * @param {object} desglose - Objeto de desglose del cálculo
 * @param {boolean} tieneEscala - Si tiene escala progresiva
 * @returns {string} - HTML del desglose
 */
function generarHTMLDesglose(desglose, tieneEscala = false) {
    if (!desglose) return '';

    let html = '<div class="desglose-retencion">';
    html += '<h4>Desglose del Cálculo</h4>';
    html += '<table class="desglose-table">';

    if (tieneEscala) {
        html += `
            <tr>
                <td>Monto Total:</td>
                <td class="monto">${formatCurrency(desglose.montoTotal)}</td>
            </tr>
            <tr>
                <td>Escala Aplicable:</td>
                <td>${formatCurrency(desglose.escalaDesde)} - ${desglose.escalaHasta === 'Sin límite' ? 'Sin límite' : formatCurrency(desglose.escalaHasta)}</td>
            </tr>
            <tr>
                <td>Monto Fijo:</td>
                <td class="monto">${formatCurrency(desglose.fijo)}</td>
            </tr>
            <tr>
                <td>Excedente sobre ${formatCurrency(desglose.escalaDesde)}:</td>
                <td class="monto">${formatCurrency(desglose.excedente)}</td>
            </tr>
            <tr>
                <td>Alícuota:</td>
                <td>${desglose.alicuota}%</td>
            </tr>
            <tr class="total-row">
                <td><strong>Retención Total:</strong></td>
                <td class="monto"><strong>${formatCurrency(desglose.retencionCalculada)}</strong></td>
            </tr>
        `;
    } else {
        html += `
            <tr>
                <td>Monto Total:</td>
                <td class="monto">${formatCurrency(desglose.montoTotal)}</td>
            </tr>
            <tr>
                <td>Monto Mínimo No Sujeto:</td>
                <td class="monto">${formatCurrency(desglose.montoMinimo)}</td>
            </tr>
            <tr>
                <td>Base de Cálculo:</td>
                <td class="monto">${formatCurrency(desglose.baseCalculo)}</td>
            </tr>
            <tr>
                <td>Alícuota:</td>
                <td>${desglose.alicuota}%</td>
            </tr>
        `;

        if (desglose.retencionMinima > 0) {
            html += `
                <tr>
                    <td>Retención Mínima:</td>
                    <td class="monto">${formatCurrency(desglose.retencionMinima)}</td>
                </tr>
            `;
        }

        html += `
            <tr class="total-row">
                <td><strong>Retención Total:</strong></td>
                <td class="monto"><strong>${formatCurrency(desglose.retencionCalculada)}</strong></td>
            </tr>
        `;
    }

    html += '</table>';
    html += '</div>';

    return html;
}

// =====================================================
// FUNCIONES PARA INTERACCIÓN CON SUPABASE
// =====================================================

/**
 * Carga códigos de retención desde Supabase
 * @param {boolean} soloActivos - Solo códigos activos
 * @returns {array} - Array de códigos de retención
 */
async function cargarCodigosRetencion(soloActivos = true) {
    try {
        let query = supabase
            .from('codigos_retencion')
            .select('*')
            .order('codigo');

        if (soloActivos) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error cargando códigos de retención:', error);
        throw error;
    }
}

/**
 * Carga escalas de un código de retención
 * @param {string} codigoRetencionId - ID del código de retención
 * @returns {array} - Array de escalas
 */
async function cargarEscalasRetencion(codigoRetencionId) {
    try {
        const { data, error } = await supabase
            .from('escalas_retencion')
            .select('*')
            .eq('codigo_retencion_id', codigoRetencionId)
            .order('orden');

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error cargando escalas de retención:', error);
        throw error;
    }
}

/**
 * Obtiene un código de retención por su código
 * @param {string} codigo - Código (ej: '19', '110')
 * @returns {object} - Código de retención
 */
async function getCodigoRetencionByCodigo(codigo) {
    try {
        const { data, error } = await supabase
            .from('codigos_retencion')
            .select('*')
            .eq('codigo', codigo)
            .eq('activo', true)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error obteniendo código de retención:', error);
        return null;
    }
}

// =====================================================
// UTILIDADES DE EXPORTACIÓN
// =====================================================

/**
 * Exporta cálculo de retención a objeto para guardar en BD
 * @param {object} calculo - Resultado del cálculo
 * @param {string} codigoRetencionId - ID del código de retención
 * @param {string} condicionProveedor - Condición del proveedor
 * @returns {object} - Objeto para insertar en comprobantes
 */
function exportarCalculoRetencion(calculo, codigoRetencionId, condicionProveedor) {
    return {
        tiene_retencion: calculo.correspondeRetencion,
        codigo_retencion_id: calculo.correspondeRetencion ? codigoRetencionId : null,
        condicion_proveedor: calculo.correspondeRetencion ? condicionProveedor : null,
        monto_retencion: calculo.montoRetencion,
        alicuota_retencion: calculo.alicuota,
        base_calculo_retencion: calculo.baseCalculo
    };
}
