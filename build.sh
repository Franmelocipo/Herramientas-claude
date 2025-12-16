#!/bin/bash

echo "🔧 Generando configuración de Supabase desde variables de entorno..."

# Verificar que las variables de entorno existan
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ ERROR: Variables de entorno no configuradas"
    echo "VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-NOT SET}"
    echo "VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:+SET (oculto)}"
    exit 1
fi

echo "✅ Variables de entorno detectadas"
echo "URL: $VITE_SUPABASE_URL"
echo "Key: ${VITE_SUPABASE_ANON_KEY:0:20}..."

# Generar archivo supabase-config.js
# IMPORTANTE: Usamos 'supabaseClient' para evitar conflicto con window.supabase del CDN
cat > supabase-config.js << 'HEREDOC_START'
/**
 * CONFIGURACIÓN DE SUPABASE
 * Herramientas Contables - Claude Tools
 *
 * Este archivo es generado automáticamente durante el build (Vercel)
 * Las credenciales provienen de las variables de entorno configuradas
 *
 * IMPORTANTE: Usamos 'supabaseClient' para evitar conflicto con window.supabase del CDN
 */

// =====================================================
// CREDENCIALES DE SUPABASE (Generadas automáticamente)
// =====================================================
HEREDOC_START

# Añadir las credenciales con variables de entorno
cat >> supabase-config.js << EOF
const supabaseUrl = '$VITE_SUPABASE_URL';
const supabaseAnonKey = '$VITE_SUPABASE_ANON_KEY';
EOF

# Añadir el resto del código (sin variables de entorno)
cat >> supabase-config.js << 'HEREDOC_END'

// Log para verificar configuración
console.log('🔑 Supabase Config Loaded:');
console.log('  URL:', supabaseUrl);
console.log('  Key exists:', !!supabaseAnonKey);
console.log('  Key length:', supabaseAnonKey?.length || 0);

// =====================================================
// INICIALIZAR CLIENTE DE SUPABASE
// Usamos supabaseClient para evitar conflicto con window.supabase del CDN
// =====================================================

let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;

    console.log('🔄 Intentando inicializar Supabase...');
    console.log('   window.supabase existe:', !!window.supabase);
    console.log('   window.supabase.createClient existe:', !!(window.supabase && window.supabase.createClient));

    if (window.supabase && window.supabase.createClient) {
        try {
            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log('✅ Supabase client initialized successfully');
            window.supabaseDB = supabaseClient; // Exponer globalmente
            return supabaseClient;
        } catch (e) {
            console.error('❌ Error creando cliente Supabase:', e);
            return null;
        }
    }
    console.log('⏳ CDN de Supabase aún no disponible');
    return null;
}

// Función para esperar a que Supabase esté listo
async function waitForSupabase(maxAttempts = 50, delay = 100) {
    for (let i = 0; i < maxAttempts; i++) {
        if (supabaseClient) return supabaseClient;
        const client = initSupabase();
        if (client) return client;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.error('❌ Supabase library not loaded after waiting');
    return null;
}

// Intentar inicializar inmediatamente
if (typeof window !== 'undefined') {
    initSupabase();

    // Si no se pudo inicializar, intentar en DOMContentLoaded
    if (!supabaseClient) {
        window.addEventListener('DOMContentLoaded', () => {
            initSupabase();
            if (supabaseClient) {
                window.supabaseDB = supabaseClient;
            }
        });
    } else {
        window.supabaseDB = supabaseClient;
    }
}

// =====================================================
// FUNCIONES HELPER PARA CLIENTES (Legacy - mantener compatibilidad)
// =====================================================

/**
 * Obtener todos los clientes activos
 */
async function getClients() {
    if (!supabaseClient) {
        console.error('Supabase no inicializado');
        return [];
    }
    const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
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
    if (!supabaseClient) {
        console.error('Supabase no inicializado');
        return null;
    }
    const { data, error } = await supabaseClient
        .from('clientes')
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
    if (!supabaseClient) {
        console.error('Supabase no inicializado');
        return null;
    }
    const { data, error } = await supabaseClient
        .from('clientes')
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
    if (!supabaseClient) {
        console.error('Supabase no inicializado');
        return null;
    }
    const { data, error } = await supabaseClient
        .from('clientes')
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

/**
 * Verificar conexión con Supabase
 */
async function testConnection() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase no inicializado');
        }
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('count');

        if (error) throw error;

        console.log('✅ Conexión exitosa con Supabase');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}
HEREDOC_END

echo "✅ Archivo supabase-config.js generado exitosamente"
echo ""
echo "📋 Contenido generado (primeras líneas):"
head -n 30 supabase-config.js

exit 0
