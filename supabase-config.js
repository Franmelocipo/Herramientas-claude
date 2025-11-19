/**
 * CONFIGURACIÓN DE SUPABASE
 * Herramientas Contables - Claude Tools
 * 
 * Este archivo contiene la configuración para conectar
 * las herramientas web con la base de datos Supabase
 */

// =====================================================
// CREDENCIALES DE SUPABASE
// =====================================================
const SUPABASE_CONFIG = {
    url: 'https://wnpjvnmyfkgtpwqnbmxa.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwNDYxNjksImV4cCI6MjA0NjYyMjE2OX0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwNDYxNjksImV4cCI6MjA0NjYyMjE2OX0'
};

// =====================================================
// INICIALIZAR CLIENTE DE SUPABASE
// =====================================================
// Agregar el CDN de Supabase en tu HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

let supabase;

function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }

    supabase = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
    );

    console.log('✅ Supabase initialized successfully');
    return supabase;
}

// Inicializar automáticamente al cargar
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initSupabase();
    });
}

// =====================================================
// FUNCIONES HELPER PARA CLIENTES
// =====================================================

/**
 * Obtener todos los clientes activos
 */
async function getClients() {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('activo', true)
        .order('nombre');
    
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    return data;
}

/**
 * Buscar cliente por CUIT
 */
async function getClientByCuit(cuit) {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('cuit', cuit)
        .single();
    
    if (error) {
        console.error('Error fetching client:', error);
        return null;
    }
    return data;
}

/**
 * Crear nuevo cliente
 */
async function createClient(clientData) {
    const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating client:', error);
        return null;
    }
    return data;
}

/**
 * Actualizar cliente existente
 */
async function updateClient(clientId, updates) {
    const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating client:', error);
        return null;
    }
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA PLANES DE CUENTAS
// =====================================================

/**
 * Obtener plan de cuentas de un cliente
 */
async function getAccountPlan(clientId) {
    const { data, error } = await supabase
        .from('account_plans')
        .select('*')
        .eq('client_id', clientId)
        .order('codigo_cuenta');
    
    if (error) {
        console.error('Error fetching account plan:', error);
        return [];
    }
    return data;
}

/**
 * Importar plan de cuentas completo
 */
async function importAccountPlan(clientId, accounts) {
    // Primero eliminar el plan existente
    await supabase
        .from('account_plans')
        .delete()
        .eq('client_id', clientId);
    
    // Agregar client_id a cada cuenta
    const accountsWithClient = accounts.map(account => ({
        ...account,
        client_id: clientId
    }));
    
    const { data, error } = await supabase
        .from('account_plans')
        .insert(accountsWithClient)
        .select();
    
    if (error) {
        console.error('Error importing account plan:', error);
        return null;
    }
    return data;
}

/**
 * Buscar cuentas por código o nombre
 */
async function searchAccounts(clientId, searchTerm) {
    const { data, error } = await supabase
        .from('account_plans')
        .select('*')
        .eq('client_id', clientId)
        .or(`codigo_cuenta.ilike.%${searchTerm}%,nombre_cuenta.ilike.%${searchTerm}%`)
        .eq('imputable', true)
        .order('codigo_cuenta')
        .limit(20);
    
    if (error) {
        console.error('Error searching accounts:', error);
        return [];
    }
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA MOVIMIENTOS MERCADO PAGO
// =====================================================

/**
 * Guardar movimientos de Mercado Pago
 */
async function saveMercadoPagoMovements(clientId, movements, filename) {
    // Agregar client_id y archivo_origen a cada movimiento
    const movementsWithClient = movements.map(mov => ({
        ...mov,
        client_id: clientId,
        archivo_origen: filename
    }));
    
    const { data, error } = await supabase
        .from('mercadopago_movements')
        .insert(movementsWithClient)
        .select();
    
    if (error) {
        console.error('Error saving Mercado Pago movements:', error);
        return null;
    }
    
    // Registrar archivo procesado
    await registerProcessedFile(clientId, filename, 'mercadopago', data.length, 'mercadopago-converter');
    
    return data;
}

/**
 * Obtener movimientos de Mercado Pago de un cliente
 */
async function getMercadoPagoMovements(clientId, startDate = null, endDate = null) {
    let query = supabase
        .from('mercadopago_movements')
        .select('*')
        .eq('client_id', clientId)
        .order('fecha', { ascending: false });
    
    if (startDate) query = query.gte('fecha', startDate);
    if (endDate) query = query.lte('fecha', endDate);
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching Mercado Pago movements:', error);
        return [];
    }
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA ASIENTOS CONTABLES
// =====================================================

/**
 * Guardar asiento contable con sus líneas
 */
async function saveAccountingEntry(clientId, entryData, lines) {
    // Guardar el asiento principal
    const entryToInsert = {
        ...entryData,
        client_id: clientId,
        total_debe: lines.reduce((sum, line) => sum + (line.debe || 0), 0),
        total_haber: lines.reduce((sum, line) => sum + (line.haber || 0), 0)
    };
    
    const { data: entry, error: entryError } = await supabase
        .from('accounting_entries')
        .insert([entryToInsert])
        .select()
        .single();
    
    if (entryError) {
        console.error('Error saving accounting entry:', entryError);
        return null;
    }
    
    // Guardar las líneas del asiento
    const linesWithEntry = lines.map((line, index) => ({
        ...line,
        entry_id: entry.id,
        orden: index + 1
    }));
    
    const { data: savedLines, error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(linesWithEntry)
        .select();
    
    if (linesError) {
        console.error('Error saving entry lines:', linesError);
        return null;
    }
    
    return {
        entry,
        lines: savedLines
    };
}

/**
 * Obtener asientos contables de un cliente
 */
async function getAccountingEntries(clientId, startDate = null, endDate = null) {
    let query = supabase
        .from('accounting_entries')
        .select(`
            *,
            accounting_entry_lines (*)
        `)
        .eq('client_id', clientId)
        .order('fecha', { ascending: false });
    
    if (startDate) query = query.gte('fecha', startDate);
    if (endDate) query = query.lte('fecha', endDate);
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching accounting entries:', error);
        return [];
    }
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA VEPs
// =====================================================

/**
 * Guardar VEPs procesados
 */
async function saveVeps(clientId, veps, filename) {
    const vepsWithClient = veps.map(vep => ({
        ...vep,
        client_id: clientId,
        archivo_origen: filename
    }));
    
    const { data, error } = await supabase
        .from('veps_processed')
        .insert(vepsWithClient)
        .select();
    
    if (error) {
        console.error('Error saving VEPs:', error);
        return null;
    }
    
    await registerProcessedFile(clientId, filename, 'vep', data.length, 'conversor-asientos');
    
    return data;
}

/**
 * Obtener VEPs de un cliente
 */
async function getVeps(clientId, estado = null) {
    let query = supabase
        .from('veps_processed')
        .select('*')
        .eq('client_id', clientId)
        .order('vencimiento', { ascending: true });
    
    if (estado) query = query.eq('estado', estado);
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching VEPs:', error);
        return [];
    }
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA EXTRACTOS BANCARIOS
// =====================================================

/**
 * Guardar movimientos bancarios
 */
async function saveBankStatements(clientId, statements, filename) {
    const statementsWithClient = statements.map(stmt => ({
        ...stmt,
        client_id: clientId,
        archivo_origen: filename
    }));
    
    const { data, error } = await supabase
        .from('bank_statements')
        .insert(statementsWithClient)
        .select();
    
    if (error) {
        console.error('Error saving bank statements:', error);
        return null;
    }
    
    await registerProcessedFile(clientId, filename, 'banco', data.length, 'conversor-asientos');
    
    return data;
}

// =====================================================
// FUNCIONES HELPER PARA ARCHIVOS PROCESADOS
// =====================================================

/**
 * Registrar archivo procesado
 */
async function registerProcessedFile(clientId, filename, tipo, registros, herramienta) {
    const { data, error } = await supabase
        .from('processed_files')
        .insert([{
            client_id: clientId,
            nombre_archivo: filename,
            tipo_archivo: tipo,
            registros_procesados: registros,
            herramienta: herramienta
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error registering processed file:', error);
        return null;
    }
    return data;
}

/**
 * Verificar si un archivo ya fue procesado (por hash)
 */
async function isFileProcessed(hash) {
    const { data, error } = await supabase
        .from('processed_files')
        .select('*')
        .eq('hash_archivo', hash)
        .single();
    
    return data !== null;
}

// =====================================================
// FUNCIONES DE UTILIDAD
// =====================================================

/**
 * Verificar conexión con Supabase
 */
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('count');
        
        if (error) throw error;
        
        console.log('✅ Conexión exitosa con Supabase');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================
// Si usas módulos ES6, descomenta esto:
// export { ... todas las funciones ... }

// Para uso en navegador sin módulos, las funciones ya están disponibles globalmente
