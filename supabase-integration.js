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
            console.error('Supabase no está inicializado');
            return [];
        }

        const { data, error } = await supabase
            .from('shared_clients')
            .select('*')
            .eq('active', true)
            .order('name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        return [];
    }
}

/**
 * Crear un nuevo cliente en Supabase
 */
async function createSupabaseClient(clientData) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return null;
        }

        const { data, error } = await supabase
            .from('shared_clients')
            .insert([{
                name: clientData.name,
                cuit: clientData.cuit || '',
                account_plan: clientData.accountPlan || []
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creando cliente:', error);
        return null;
    }
}

/**
 * Actualizar un cliente en Supabase
 */
async function updateSupabaseClient(clientId, updates) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return null;
        }

        const { data, error } = await supabase
            .from('shared_clients')
            .update(updates)
            .eq('id', clientId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error actualizando cliente:', error);
        return null;
    }
}

/**
 * Eliminar un cliente en Supabase (soft delete)
 */
async function deleteSupabaseClient(clientId) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return false;
        }

        const { error } = await supabase
            .from('shared_clients')
            .update({ active: false })
            .eq('id', clientId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error eliminando cliente:', error);
        return false;
    }
}

/**
 * Importar múltiples clientes a Supabase
 */
async function importSupabaseClients(clients) {
    try {
        if (!supabase) {
            console.error('Supabase no está inicializado');
            return { imported: 0, errors: [] };
        }

        const clientsToInsert = clients.map(c => ({
            name: c.name,
            cuit: c.cuit || '',
            account_plan: c.accountPlan || []
        }));

        const { data, error } = await supabase
            .from('shared_clients')
            .insert(clientsToInsert)
            .select();

        if (error) throw error;

        return {
            imported: data?.length || 0,
            errors: []
        };
    } catch (error) {
        console.error('Error importando clientes:', error);
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
// FUNCIONES PARA IMPUESTOS
// =====================================================

/**
 * Obtener base de datos de impuestos desde Supabase
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
 * Importar base de datos de impuestos a Supabase
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
 * Limpiar base de datos de impuestos
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
