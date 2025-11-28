/**
 * SUPABASE HELPER - GESTIÓN DE COMPROBANTES
 * Funciones específicas para el sistema de gestión de comprobantes
 */

// =====================================================
// GESTIÓN DE PERÍODOS
// =====================================================

/**
 * Obtiene todos los períodos (con filtros opcionales)
 * @param {object} filtros - {clientId, year, month, estado}
 * @returns {array} - Array de períodos
 */
async function getPeriodos(filtros = {}) {
    try {
        let query = supabase
            .from('periods')
            .select(`
                *,
                clients (id, nombre, cuit)
            `)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (filtros.clientId) {
            query = query.eq('client_id', filtros.clientId);
        }

        if (filtros.year) {
            query = query.eq('year', filtros.year);
        }

        if (filtros.month) {
            query = query.eq('month', filtros.month);
        }

        if (filtros.estado) {
            query = query.eq('estado', filtros.estado);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error obteniendo períodos:', error);
        throw error;
    }
}

/**
 * Crea un nuevo período
 * @param {object} periodo - {client_id, year, month, observaciones}
 * @returns {object} - Período creado
 */
async function crearPeriodo(periodo) {
    try {
        const { data, error } = await supabase
            .from('periods')
            .insert([periodo])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Ya existe un período abierto para este cliente en este mes/año');
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error creando período:', error);
        throw error;
    }
}

/**
 * Cierra un período
 * @param {string} periodoId - ID del período
 * @param {string} usuarioId - ID del usuario que cierra
 * @param {string} observaciones - Observaciones opcionales
 * @returns {object} - Período actualizado
 */
async function cerrarPeriodo(periodoId, usuarioId, observaciones = null) {
    try {
        const updates = {
            estado: 'cerrado',
            fecha_cierre: new Date().toISOString(),
            cerrado_por: usuarioId
        };

        if (observaciones) {
            updates.observaciones = observaciones;
        }

        const { data, error } = await supabase
            .from('periods')
            .update(updates)
            .eq('id', periodoId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error cerrando período:', error);
        throw error;
    }
}

/**
 * Reabre un período
 * @param {string} periodoId - ID del período
 * @returns {object} - Período actualizado
 */
async function reabrirPeriodo(periodoId) {
    try {
        const { data, error } = await supabase
            .from('periods')
            .update({
                estado: 'abierto',
                fecha_cierre: null,
                cerrado_por: null
            })
            .eq('id', periodoId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error reabriendo período:', error);
        throw error;
    }
}

/**
 * Obtiene períodos abiertos de un cliente
 * @param {string} clientId - ID del cliente
 * @returns {array} - Array de períodos abiertos
 */
async function getPeriodosAbiertos(clientId) {
    try {
        const { data, error } = await supabase
            .from('periods')
            .select('*')
            .eq('client_id', clientId)
            .eq('estado', 'abierto')
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error obteniendo períodos abiertos:', error);
        throw error;
    }
}

// =====================================================
// GESTIÓN DE COMPROBANTES
// =====================================================

/**
 * Sube un archivo a Supabase Storage
 * @param {File} file - Archivo a subir
 * @param {string} clientId - ID del cliente
 * @param {number} year - Año
 * @param {number} month - Mes
 * @returns {object} - {url, path, nombre}
 */
async function subirArchivoComprobante(file, clientId, year, month) {
    try {
        const fileName = generarNombreArchivoUnico(file.name);
        const filePath = `${clientId}/${year}/${month}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('comprobantes')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('comprobantes')
            .getPublicUrl(filePath);

        return {
            url: urlData.publicUrl,
            path: filePath,
            nombre: fileName
        };
    } catch (error) {
        console.error('Error subiendo archivo:', error);
        throw error;
    }
}

/**
 * Crea un nuevo comprobante
 * @param {object} comprobante - Datos del comprobante
 * @returns {object} - Comprobante creado
 */
async function crearComprobante(comprobante) {
    try {
        const { data, error } = await supabase
            .from('comprobantes')
            .insert([comprobante])
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error creando comprobante:', error);
        throw error;
    }
}

/**
 * Obtiene comprobantes con filtros
 * @param {object} filtros - {clientId, periodId, estado, fechaDesde, fechaHasta}
 * @returns {array} - Array de comprobantes
 */
async function getComprobantes(filtros = {}) {
    try {
        let query = supabase
            .from('comprobantes')
            .select(`
                *,
                clients (id, nombre, cuit),
                periods (year, month, estado),
                codigos_retencion (codigo, concepto),
                usuarios:subido_por (nombre)
            `)
            .order('fecha_comprobante', { ascending: false });

        if (filtros.clientId) {
            query = query.eq('client_id', filtros.clientId);
        }

        if (filtros.periodId) {
            query = query.eq('period_id', filtros.periodId);
        }

        if (filtros.estado) {
            query = query.eq('estado', filtros.estado);
        }

        if (filtros.fechaDesde) {
            query = query.gte('fecha_comprobante', filtros.fechaDesde);
        }

        if (filtros.fechaHasta) {
            query = query.lte('fecha_comprobante', filtros.fechaHasta);
        }

        if (filtros.proveedor) {
            query = query.ilike('proveedor', `%${filtros.proveedor}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error obteniendo comprobantes:', error);
        throw error;
    }
}

/**
 * Actualiza un comprobante
 * @param {string} comprobanteId - ID del comprobante
 * @param {object} updates - Campos a actualizar
 * @returns {object} - Comprobante actualizado
 */
async function actualizarComprobante(comprobanteId, updates) {
    try {
        const { data, error } = await supabase
            .from('comprobantes')
            .update(updates)
            .eq('id', comprobanteId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error actualizando comprobante:', error);
        throw error;
    }
}

/**
 * Vincula un comprobante con un registro contable
 * @param {string} comprobanteId - ID del comprobante
 * @param {string} registroId - ID del registro contable
 * @param {string} usuarioId - ID del usuario que vincula
 * @returns {object} - {comprobante, registro}
 */
async function vincularComprobante(comprobanteId, registroId, usuarioId) {
    try {
        // Actualizar comprobante
        const { data: comprobante, error: errorComp } = await supabase
            .from('comprobantes')
            .update({
                estado: 'vinculado',
                registro_contable_id: registroId,
                vinculado_por: usuarioId,
                fecha_vinculacion: new Date().toISOString()
            })
            .eq('id', comprobanteId)
            .select()
            .single();

        if (errorComp) throw errorComp;

        // Actualizar registro contable
        const { data: registro, error: errorReg } = await supabase
            .from('registros_contables')
            .update({
                tiene_comprobante: true,
                comprobante_id: comprobanteId,
                vinculado_por: usuarioId,
                fecha_vinculacion: new Date().toISOString()
            })
            .eq('id', registroId)
            .select()
            .single();

        if (errorReg) throw errorReg;

        return { comprobante, registro };
    } catch (error) {
        console.error('Error vinculando comprobante:', error);
        throw error;
    }
}

/**
 * Desvincular un comprobante
 * @param {string} comprobanteId - ID del comprobante
 * @returns {object} - Comprobante actualizado
 */
async function desvincularComprobante(comprobanteId) {
    try {
        // Obtener el registro vinculado primero
        const { data: comprobante } = await supabase
            .from('comprobantes')
            .select('registro_contable_id')
            .eq('id', comprobanteId)
            .single();

        if (comprobante && comprobante.registro_contable_id) {
            // Actualizar registro contable
            await supabase
                .from('registros_contables')
                .update({
                    tiene_comprobante: false,
                    comprobante_id: null,
                    vinculado_por: null,
                    fecha_vinculacion: null
                })
                .eq('id', comprobante.registro_contable_id);
        }

        // Actualizar comprobante
        const { data, error } = await supabase
            .from('comprobantes')
            .update({
                estado: 'pendiente',
                registro_contable_id: null,
                vinculado_por: null,
                fecha_vinculacion: null
            })
            .eq('id', comprobanteId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error desvinculando comprobante:', error);
        throw error;
    }
}

// =====================================================
// GESTIÓN DE REGISTROS CONTABLES
// =====================================================

/**
 * Obtiene registros contables con filtros
 * @param {object} filtros - {clientId, periodId, tieneComprobante, fechaDesde, fechaHasta}
 * @returns {array} - Array de registros
 */
async function getRegistrosContables(filtros = {}) {
    try {
        let query = supabase
            .from('registros_contables')
            .select(`
                *,
                clients (id, nombre, cuit),
                periods (year, month),
                comprobantes (id, numero_comprobante)
            `)
            .order('fecha', { ascending: false });

        if (filtros.clientId) {
            query = query.eq('client_id', filtros.clientId);
        }

        if (filtros.periodId) {
            query = query.eq('period_id', filtros.periodId);
        }

        if (filtros.tieneComprobante !== undefined) {
            query = query.eq('tiene_comprobante', filtros.tieneComprobante);
        }

        if (filtros.fechaDesde) {
            query = query.gte('fecha', filtros.fechaDesde);
        }

        if (filtros.fechaHasta) {
            query = query.lte('fecha', filtros.fechaHasta);
        }

        if (filtros.proveedor) {
            query = query.ilike('proveedor', `%${filtros.proveedor}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error obteniendo registros contables:', error);
        throw error;
    }
}

/**
 * Crea un registro contable manual
 * @param {object} registro - Datos del registro
 * @returns {object} - Registro creado
 */
async function crearRegistroContable(registro) {
    try {
        const { data, error } = await supabase
            .from('registros_contables')
            .insert([{ ...registro, sistema_origen: 'manual' }])
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error creando registro contable:', error);
        throw error;
    }
}

// =====================================================
// GESTIÓN DE ÓRDENES DE PAGO
// =====================================================

/**
 * Crea una orden de pago
 * @param {object} orden - Datos de la orden
 * @returns {object} - Orden creada
 */
async function crearOrdenPago(orden) {
    try {
        // Generar número de orden si no se proporciona
        if (!orden.numero_orden) {
            const { data: numeroOrden } = await supabase
                .rpc('generar_numero_orden');
            orden.numero_orden = numeroOrden;
        }

        const { data, error } = await supabase
            .from('ordenes_pago')
            .insert([orden])
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error creando orden de pago:', error);
        throw error;
    }
}

/**
 * Obtiene órdenes de pago con filtros
 * @param {object} filtros - {clientId, estado, fechaDesde, fechaHasta}
 * @returns {array} - Array de órdenes
 */
async function getOrdenesPago(filtros = {}) {
    try {
        let query = supabase
            .from('ordenes_pago')
            .select(`
                *,
                clients (id, nombre, cuit),
                comprobantes (numero_comprobante, fecha_comprobante, monto_total)
            `)
            .order('fecha_solicitud', { ascending: false });

        if (filtros.clientId) {
            query = query.eq('client_id', filtros.clientId);
        }

        if (filtros.estado) {
            query = query.eq('estado', filtros.estado);
        }

        if (filtros.fechaDesde) {
            query = query.gte('fecha_solicitud', filtros.fechaDesde);
        }

        if (filtros.fechaHasta) {
            query = query.lte('fecha_solicitud', filtros.fechaHasta);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error obteniendo órdenes de pago:', error);
        throw error;
    }
}

/**
 * Aprueba una orden de pago
 * @param {string} ordenId - ID de la orden
 * @param {string} usuarioId - ID del usuario que aprueba
 * @returns {object} - Orden actualizada
 */
async function aprobarOrdenPago(ordenId, usuarioId) {
    try {
        const { data, error } = await supabase
            .from('ordenes_pago')
            .update({
                estado: 'aprobada',
                aprobada_por: usuarioId,
                fecha_aprobacion: new Date().toISOString()
            })
            .eq('id', ordenId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error aprobando orden:', error);
        throw error;
    }
}

/**
 * Rechaza una orden de pago
 * @param {string} ordenId - ID de la orden
 * @param {string} usuarioId - ID del usuario que rechaza
 * @param {string} motivo - Motivo del rechazo
 * @returns {object} - Orden actualizada
 */
async function rechazarOrdenPago(ordenId, usuarioId, motivo) {
    try {
        const { data, error } = await supabase
            .from('ordenes_pago')
            .update({
                estado: 'rechazada',
                rechazada_por: usuarioId,
                fecha_rechazo: new Date().toISOString(),
                motivo_rechazo: motivo
            })
            .eq('id', ordenId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error rechazando orden:', error);
        throw error;
    }
}

/**
 * Registra el pago de una orden
 * @param {string} ordenId - ID de la orden
 * @param {string} usuarioId - ID del usuario que ejecuta
 * @param {object} datosPago - {metodo_pago, referencia_pago, fecha_pago}
 * @returns {object} - Orden actualizada
 */
async function registrarPagoOrden(ordenId, usuarioId, datosPago) {
    try {
        const { data, error } = await supabase
            .from('ordenes_pago')
            .update({
                estado: 'pagada',
                ejecutada_por: usuarioId,
                fecha_pago: datosPago.fecha_pago || new Date().toISOString(),
                metodo_pago: datosPago.metodo_pago,
                referencia_pago: datosPago.referencia_pago
            })
            .eq('id', ordenId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error registrando pago:', error);
        throw error;
    }
}

// =====================================================
// ESTADÍSTICAS Y REPORTES
// =====================================================

/**
 * Obtiene estadísticas generales
 * @param {object} filtros - {clientId, periodId}
 * @returns {object} - Objeto con estadísticas
 */
async function getEstadisticas(filtros = {}) {
    try {
        let queryComprobantes = supabase
            .from('comprobantes')
            .select('estado, monto_total, tiene_retencion, monto_retencion');

        let queryOrdenes = supabase
            .from('ordenes_pago')
            .select('estado, monto');

        if (filtros.clientId) {
            queryComprobantes = queryComprobantes.eq('client_id', filtros.clientId);
            queryOrdenes = queryOrdenes.eq('client_id', filtros.clientId);
        }

        if (filtros.periodId) {
            queryComprobantes = queryComprobantes.eq('period_id', filtros.periodId);
        }

        const [{ data: comprobantes }, { data: ordenes }] = await Promise.all([
            queryComprobantes,
            queryOrdenes
        ]);

        return {
            comprobantes: {
                total: comprobantes?.length || 0,
                pendientes: comprobantes?.filter(c => c.estado === 'pendiente').length || 0,
                vinculados: comprobantes?.filter(c => c.estado === 'vinculado').length || 0,
                montoTotal: comprobantes?.reduce((sum, c) => sum + (c.monto_total || 0), 0) || 0,
                conRetencion: comprobantes?.filter(c => c.tiene_retencion).length || 0,
                totalRetenido: comprobantes?.reduce((sum, c) => sum + (c.monto_retencion || 0), 0) || 0
            },
            ordenes: {
                total: ordenes?.length || 0,
                pendientes: ordenes?.filter(o => o.estado === 'pendiente').length || 0,
                aprobadas: ordenes?.filter(o => o.estado === 'aprobada').length || 0,
                pagadas: ordenes?.filter(o => o.estado === 'pagada').length || 0,
                montoTotal: ordenes?.reduce((sum, o) => sum + (o.monto || 0), 0) || 0,
                montoPendiente: ordenes?.filter(o => o.estado === 'pendiente').reduce((sum, o) => sum + (o.monto || 0), 0) || 0
            }
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        throw error;
    }
}

/**
 * Obtiene gastos agrupados por concepto
 * @param {object} filtros - {clientId, periodId}
 * @returns {array} - Array de {concepto, monto, cantidad}
 */
async function getGastosPorConcepto(filtros = {}) {
    try {
        let query = supabase
            .from('comprobantes')
            .select('concepto, monto_total');

        if (filtros.clientId) {
            query = query.eq('client_id', filtros.clientId);
        }

        if (filtros.periodId) {
            query = query.eq('period_id', filtros.periodId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Agrupar por concepto
        const agrupado = {};
        data?.forEach(item => {
            const concepto = item.concepto || 'Sin concepto';
            if (!agrupado[concepto]) {
                agrupado[concepto] = { concepto, monto: 0, cantidad: 0 };
            }
            agrupado[concepto].monto += item.monto_total || 0;
            agrupado[concepto].cantidad += 1;
        });

        return Object.values(agrupado).sort((a, b) => b.monto - a.monto);
    } catch (error) {
        console.error('Error obteniendo gastos por concepto:', error);
        throw error;
    }
}
