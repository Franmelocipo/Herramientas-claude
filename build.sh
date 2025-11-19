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
cat > supabase-config.js << EOF
/**
 * CONFIGURACIÓN DE SUPABASE
 * Herramientas Contables - Claude Tools
 *
 * Este archivo es generado automáticamente durante el build de Netlify
 * Las credenciales provienen de las variables de entorno configuradas en Netlify
 */

// =====================================================
// CREDENCIALES DE SUPABASE (Generadas automáticamente)
// =====================================================
const SUPABASE_CONFIG = {
    url: '$VITE_SUPABASE_URL',
    anonKey: '$VITE_SUPABASE_ANON_KEY'
};

// Log para verificar configuración (solo en desarrollo)
console.log('🔑 Supabase Config Loaded:');
console.log('  URL:', SUPABASE_CONFIG.url);
console.log('  Key exists:', !!SUPABASE_CONFIG.anonKey);
console.log('  Key length:', SUPABASE_CONFIG.anonKey?.length || 0);

// =====================================================
// INICIALIZAR CLIENTE DE SUPABASE
// =====================================================

let supabase;

function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }

    try {
        supabase = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );

        console.log('✅ Supabase initialized successfully');
        console.log('   URL:', SUPABASE_CONFIG.url);

        return supabase;
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        return null;
    }
}

// Inicializar automáticamente al cargar
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initSupabase();
    });
}

// =====================================================
// FUNCIONES HELPER PARA CLIENTES (Legacy - mantener compatibilidad)
// =====================================================

/**
 * Obtener todos los clientes activos
 */
async function getClients() {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
        const { data, error } = await supabase
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
EOF

echo "✅ Archivo supabase-config.js generado exitosamente"
echo ""
echo "📋 Contenido generado (primeras líneas):"
head -n 20 supabase-config.js

exit 0
