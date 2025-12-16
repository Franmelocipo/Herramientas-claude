/**
 * CONFIGURACIÓN DE SUPABASE
 * Este archivo inicializa el cliente de Supabase con variables de entorno
 */

// Valores de configuración con fallback para desarrollo local
const supabaseUrl = 'https://wnpjvnmyfkgtpwqnbmxa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzE5OTAsImV4cCI6MjA3ODcwNzk5MH0.XmYGTMuQBJBpUMAij90T6z4SlCMugVWuWdwJ84GiPn8'

// Debug: verificar que las variables se carguen
console.log('🔍 Supabase Config Check:')
console.log('URL:', supabaseUrl)
console.log('Key exists:', !!supabaseAnonKey)
console.log('Key length:', supabaseAnonKey?.length)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Supabase credentials missing!')
} else {
  console.log('✅ Supabase credentials loaded successfully')
}

// Inicializar el cliente de Supabase
// Usamos supabaseClient para evitar conflicto con window.supabase del CDN
let supabaseClient = null

// Función para inicializar Supabase
function initSupabase() {
  if (supabaseClient) return supabaseClient

  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase client initialized')
    return supabaseClient
  }
  return null
}

// Función para esperar a que Supabase esté listo (útil para otros scripts)
async function waitForSupabase(maxAttempts = 50, delay = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    if (supabaseClient) return supabaseClient
    const client = initSupabase()
    if (client) return client
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  console.error('❌ Supabase library not loaded after waiting')
  return null
}

// Intentar inicializar inmediatamente
if (typeof window !== 'undefined') {
  initSupabase()

  // Si no se pudo inicializar, intentar en DOMContentLoaded
  if (!supabaseClient) {
    window.addEventListener('DOMContentLoaded', () => {
      initSupabase()
      // Exponer el cliente globalmente después de inicializar
      if (supabaseClient) {
        window.supabaseDB = supabaseClient
      }
    })
  } else {
    // Exponer el cliente globalmente
    window.supabaseDB = supabaseClient
  }
}
