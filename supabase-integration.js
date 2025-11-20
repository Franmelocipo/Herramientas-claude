/**
 * INTEGRACIÓN CON SUPABASE
 * Funciones para sincronizar datos entre localStorage y Supabase
 */

// =====================================================
// FUNCIONES PARA CLIENTES
// =====================================================

/**
 * Obtener todos los clientes desde Supabase
 */
async function getSupabaseClients() {
    try {
        if (!supabase) {
            console.error('❌ [getSupabaseClients] Supabase no está inicializado');
            return [];
        }

        console.log('📡 [getSupabaseClients] Obteniendo clientes desde Supabase...');

        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) {
            console.error('❌ [getSupabaseClients] Error de Supabase:', error);
            console.error('Detalles:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        // Mapear campos de Supabase a formato local
        const mappedData = (data || []).map(client => ({
            id: client.id,
            name: client.nombre,
            cuit: client.cuit,
            direccion: client.direccion,
            email: client.email,
            telefono: client.telefono,
            tipo_societario: client.tipo_societario,
            account_plan: [],
            created_at: client.created_at,
            updated_at: client.updated_at
        }));

        console.log(`✅ [getSupabaseClients] Obtenidos ${mappedData.length} clientes`);
        return mappedData;
    } catch (error) {
        console.error('❌ [getSupabaseClients] Error general:', error);
        return [];
    }
}

/**
 * Crear un nuevo cliente en Supabase
 */
async function createSupabaseClient(clientData) {
    try {
        if (!supabase) {
            console.error('❌ [createSupabaseClient] Supabase no está inicializado');
            return null;
        }

        console.log('📝 [createSupabaseClient] Creando cliente:', clientData);

        const clientToInsert = {
            nombre: clientData.name,
            cuit: clientData.cuit || '',
            direccion: clientData.direccion || '',
            email: clientData.email || '',
            telefono: clientData.telefono || '',
            tipo_societario: clientData.tipo_societario || ''
        };

        console.log('📤 [createSupabaseClient] Datos a insertar:', clientToInsert);

        const { data, error } = await supabase
            .from('clientes')
            .insert([clientToInsert])
            .select()
            .single();

        if (error) {
            console.error('❌ [createSupabaseClient] Error de Supabase:', error);
            console.error('Detalles completos del error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                statusCode: error.statusCode
            });
            throw error;
        }

        console.log('✅ [createSupabaseClient] Cliente creado exitosamente:', data);

        // Mapear respuesta al formato local
        return {
            id: data.id,
            name: data.nombre,
            cuit: data.cuit,
            direccion: data.direccion,
            email: data.email,
            telefono: data.telefono,
            tipo_societario: data.tipo_societario,
            account_plan: [],
            created_at: data.created_at,
            updated_at: data.updated_at
        };
    } catch (error) {
        console.error('❌ [createSupabaseClient] Error general al crear cliente:', error);
        console.error('Stack trace:', error.stack);
        return null;
    }
}

/**
 * Actualizar un cliente en Supabase
 */
async function updateSupabaseClient(clientId, updates) {
    try {
        if (!supabase) {
            console.error('❌ [updateSupabaseClient] Supabase no está inicializado');
            return null;
        }

        console.log('✏️ [updateSupabaseClient] Actualizando cliente:', clientId, updates);

        // Mapear campos al formato de Supabase
        const mappedUpdates = {};
        if (updates.name !== undefined) mappedUpdates.nombre = updates.name;
        if (updates.cuit !== undefined) mappedUpdates.cuit = updates.cuit;
        if (updates.direccion !== undefined) mappedUpdates.direccion = updates.direccion;
        if (updates.email !== undefined) mappedUpdates.email = updates.email;
        if (updates.telefono !== undefined) mappedUpdates.telefono = updates.telefono;
        if (updates.tipo_societario !== undefined) mappedUpdates.tipo_societario = updates.tipo_societario;

        const { data, error } = await supabase
            .from('clientes')
            .update(mappedUpdates)
            .eq('id', clientId)
            .select()
            .single();

        if (error) {
            console.error('❌ [updateSupabaseClient] Error:', error);
            throw error;
        }

        console.log('✅ [updateSupabaseClient] Cliente actualizado:', data);
        return data;
    } catch (error) {
        console.error('❌ [updateSupabaseClient] Error general:', error);
        return null;
    }
}

/**
 * Eliminar un cliente en Supabase (eliminación real, no soft delete)
 */
async function deleteSupabaseClient(clientId) {
    try {
        if (!supabase) {
            console.error('❌ [deleteSupabaseClient] Supabase no está inicializado');
            return false;
        }

        console.log('🗑️ [deleteSupabaseClient] Eliminando cliente:', clientId);

        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', clientId);

        if (error) {
            console.error('❌ [deleteSupabaseClient] Error:', error);
            throw error;
        }

        console.log('✅ [deleteSupabaseClient] Cliente eliminado exitosamente');
        return true;
    } catch (error) {
        console.error('❌ [deleteSupabaseClient] Error general:', error);
        return false;
    }
}

/**
 * Importar múltiples clientes a Supabase
 */
async function importSupabaseClients(clients) {
    try {
        if (!supabase) {
            console.error('❌ [importSupabaseClients] Supabase no está inicializado');
            return { imported: 0, errors: [] };
        }

        console.log(`📦 [importSupabaseClients] Importando ${clients.length} clientes...`);

        const clientsToInsert = clients.map(c => ({
            nombre: c.name,
            cuit: c.cuit || '',
            direccion: c.direccion || '',
            email: c.email || '',
            telefono: c.telefono || '',
            tipo_societario: c.tipo_societario || ''
        }));

        console.log('📤 [importSupabaseClients] Datos a insertar:', clientsToInsert);

        const { data, error } = await supabase
            .from('clientes')
            .insert(clientsToInsert)
            .select();

        if (error) {
            console.error('❌ [importSupabaseClients] Error:', error);
            throw error;
        }

        console.log(`✅ [importSupabaseClients] Importados ${data?.length || 0} clientes`);

        return {
            imported: data?.length || 0,
            errors: []
        };
    } catch (error) {
        console.error('❌ [importSupabaseClients] Error general:', error);
        return {
            imported: 0,
            errors: [error.message]
        };
    }
}

/**
 * Actualizar el plan de cuentas de un cliente
 */
async function updateClientAccountPlan(clientId, accountPlan) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('shared_clients')
            .update({ account_plan: accountPlan })
            .eq('id', clientId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error actualizando plan de cuentas:', error);
        return false;
    }
}

// =====================================================
// FUNCIONES PARA IMPUESTOS (TABLA LEGACY: tax_database)
// =====================================================

/**
 * Obtener base de datos de impuestos desde Supabase (tabla legacy)
 */
async function getSupabaseTaxDatabase() {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return [];
        }

        const { data, error } = await supabase
            .from('tax_database')
            .select('*')
            .order('impuesto');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo base de impuestos:', error);
        return [];
    }
}

/**
 * Importar base de datos de impuestos a Supabase (tabla legacy)
 */
async function importSupabaseTaxDatabase(taxes, clearFirst = false) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return { success: false, imported: 0 };
        }

        // Limpiar base de datos si se solicita
        if (clearFirst) {
            const { error: deleteError } = await supabase
                .from('tax_database')
                .delete()
                .neq('id', 0); // Eliminar todos los registros

            if (deleteError) throw deleteError;
        }

        // Insertar nuevos datos
        const { data, error } = await supabase
            .from('tax_database')
            .upsert(taxes, {
                onConflict: 'impuesto,concepto,subconcepto',
                ignoreDuplicates: false
            })
            .select();

        if (error) throw error;

        return {
            success: true,
            imported: data?.length || 0
        };
    } catch (error) {
        console.error('Error importando base de impuestos:', error);
        return {
            success: false,
            imported: 0,
            error: error.message
        };
    }
}

/**
 * Limpiar base de datos de impuestos (tabla legacy)
 */
async function clearSupabaseTaxDatabase() {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('tax_database')
            .delete()
            .neq('id', 0); // Eliminar todos los registros

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error limpiando base de impuestos:', error);
        return false;
    }
}

// =====================================================
// FUNCIONES PARA IMPUESTOS_BASE (NUEVA TABLA - 6 CAMPOS)
// =====================================================

/**
 * Obtener base de datos de impuestos desde Supabase (nueva tabla con 6 campos)
 */
async function getSupabaseImpuestosBase() {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return [];
        }

        const { data, error } = await supabase
            .from('impuestos_base')
            .select('*')
            .order('codigo_impuesto')
            .order('codigo_concepto')
            .order('codigo_subconcepto');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo impuestos_base:', error);
        return [];
    }
}

/**
 * Obtener conteo de registros en impuestos_base
 */
async function getSupabaseImpuestosBaseCount() {
    try {
        if (!supabase) {
            return 0;
        }

        const { count, error } = await supabase
            .from('impuestos_base')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error obteniendo conteo de impuestos_base:', error);
        return 0;
    }
}

/**
 * Importar base de datos de impuestos a Supabase (nueva tabla con 6 campos)
 */
async function importSupabaseImpuestosBase(taxes, clearFirst = false) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return { success: false, imported: 0 };
        }

        // Limpiar base de datos si se solicita
        if (clearFirst) {
            const { error: deleteError } = await supabase
                .from('impuestos_base')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos los registros

            if (deleteError) {
                console.error('Error al limpiar impuestos_base:', deleteError);
                throw deleteError;
            }
        }

        // Insertar nuevos datos
        const { data, error } = await supabase
            .from('impuestos_base')
            .insert(taxes)
            .select();

        if (error) {
            console.error('Error al insertar en impuestos_base:', error);
            throw error;
        }

        return {
            success: true,
            imported: data?.length || 0
        };
    } catch (error) {
        console.error('Error importando impuestos_base:', error);
        return {
            success: false,
            imported: 0,
            error: error.message
        };
    }
}

/**
 * Limpiar base de datos de impuestos (nueva tabla)
 */
async function clearSupabaseImpuestosBase() {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('impuestos_base')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos los registros

        if (error) {
            console.error('Error al limpiar impuestos_base:', error);
            throw error;
        }
        return true;
    } catch (error) {
        console.error('Error limpiando impuestos_base:', error);
        return false;
    }
}

/**
 * Buscar en impuestos_base por cualquier campo
 */
async function searchSupabaseImpuestosBase(searchTerm) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return [];
        }

        const term = searchTerm.toLowerCase();

        const { data, error } = await supabase
            .from('impuestos_base')
            .select('*')
            .or(`codigo_impuesto.ilike.%${term}%,descripcion_impuesto.ilike.%${term}%,codigo_concepto.ilike.%${term}%,descripcion_concepto.ilike.%${term}%,codigo_subconcepto.ilike.%${term}%,descripcion_subconcepto.ilike.%${term}%`)
            .order('codigo_impuesto')
            .order('codigo_concepto')
            .order('codigo_subconcepto');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error buscando en impuestos_base:', error);
        return [];
    }
}

/**
 * Obtener impuestos únicos de la base
 */
async function getUniqueImpuestos() {
    try {
        if (!supabase) {
            return [];
        }

        const { data, error } = await supabase
            .from('impuestos_base')
            .select('codigo_impuesto, descripcion_impuesto')
            .order('codigo_impuesto');

        if (error) throw error;

        // Obtener valores únicos
        const unique = [];
        const seen = new Set();
        for (const item of data || []) {
            if (!seen.has(item.codigo_impuesto)) {
                seen.add(item.codigo_impuesto);
                unique.push(item);
            }
        }
        return unique;
    } catch (error) {
        console.error('Error obteniendo impuestos únicos:', error);
        return [];
    }
}

/**
 * Obtener conceptos por impuesto
 */
async function getConceptosByImpuesto(codigoImpuesto) {
    try {
        if (!supabase) {
            return [];
        }

        const { data, error } = await supabase
            .from('impuestos_base')
            .select('codigo_concepto, descripcion_concepto')
            .eq('codigo_impuesto', codigoImpuesto)
            .order('codigo_concepto');

        if (error) throw error;

        // Obtener valores únicos
        const unique = [];
        const seen = new Set();
        for (const item of data || []) {
            if (!seen.has(item.codigo_concepto)) {
                seen.add(item.codigo_concepto);
                unique.push(item);
            }
        }
        return unique;
    } catch (error) {
        console.error('Error obteniendo conceptos:', error);
        return [];
    }
}

/**
 * Obtener subconceptos por impuesto y concepto
 */
async function getSubconceptosByConcepto(codigoImpuesto, codigoConcepto) {
    try {
        if (!supabase) {
            return [];
        }

        const { data, error } = await supabase
            .from('impuestos_base')
            .select('codigo_subconcepto, descripcion_subconcepto')
            .eq('codigo_impuesto', codigoImpuesto)
            .eq('codigo_concepto', codigoConcepto)
            .order('codigo_subconcepto');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo subconceptos:', error);
        return [];
    }
}

/**
 * Obtener obligaciones impositivas de un cliente
 */
async function getSupabaseTaxObligations(clientId = null, status = null) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return [];
        }

        let query = supabase
            .from('tax_obligations')
            .select('*')
            .order('due_date', { ascending: true });

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo obligaciones impositivas:', error);
        return [];
    }
}

/**
 * Crear una obligación impositiva
 */
async function createSupabaseTaxObligation(obligation) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return null;
        }

        const { data, error } = await supabase
            .from('tax_obligations')
            .insert([obligation])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creando obligación impositiva:', error);
        return null;
    }
}

/**
 * Actualizar el estado de una obligación impositiva
 */
async function updateSupabaseTaxObligation(obligationId, updates) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('tax_obligations')
            .update(updates)
            .eq('id', obligationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error actualizando obligación impositiva:', error);
        return false;
    }
}

/**
 * Eliminar una obligación impositiva
 */
async function deleteSupabaseTaxObligation(obligationId) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('tax_obligations')
            .delete()
            .eq('id', obligationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error eliminando obligación impositiva:', error);
        return false;
    }
}

// =====================================================
// FUNCIONES DE ESTADÍSTICAS Y ALMACENAMIENTO
// =====================================================

/**
 * Obtener estadísticas de almacenamiento en Supabase
 */
async function getSupabaseStorageStats() {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return null;
        }

        const { data, error } = await supabase.rpc('get_storage_stats');

        if (error) throw error;

        return {
            tables: data || [],
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);

        // Fallback: obtener conteos manualmente
        try {
            const [clients, taxDb, taxObl] = await Promise.all([
                supabase.from('shared_clients').select('id', { count: 'exact', head: true }),
                supabase.from('tax_database').select('id', { count: 'exact', head: true }),
                supabase.from('tax_obligations').select('id', { count: 'exact', head: true })
            ]);

            return {
                tables: [
                    { table_name: 'shared_clients', row_count: clients.count || 0, table_size: 'N/A' },
                    { table_name: 'tax_database', row_count: taxDb.count || 0, table_size: 'N/A' },
                    { table_name: 'tax_obligations', row_count: taxObl.count || 0, table_size: 'N/A' }
                ],
                timestamp: new Date().toISOString()
            };
        } catch (fallbackError) {
            console.error('Error en fallback de estadísticas:', fallbackError);
            return null;
        }
    }
}

// =====================================================
// FUNCIONES DE SINCRONIZACIÓN
// =====================================================

/**
 * Sincronizar clientes desde Supabase a localStorage
 */
async function syncClientsFromSupabase() {
    try {
        const clients = await getSupabaseClients();
        console.log(`✅ Sincronizados ${clients.length} clientes desde Supabase`);
        return clients;
    } catch (error) {
        console.error('Error sincronizando clientes:', error);
        return [];
    }
}

/**
 * Sincronizar base de impuestos desde Supabase a localStorage
 */
async function syncTaxDatabaseFromSupabase() {
    try {
        const taxes = await getSupabaseTaxDatabase();
        console.log(`✅ Sincronizados ${taxes.length} registros de impuestos desde Supabase`);
        return taxes;
    } catch (error) {
        console.error('Error sincronizando base de impuestos:', error);
        return [];
    }
}
