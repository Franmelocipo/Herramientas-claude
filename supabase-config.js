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
let supabase = null

// Esperar a que se cargue la librería de Supabase desde el CDN
if (typeof window !== 'undefined') {
  if (window.supabase && window.supabase.createClient) {
    // La librería ya está cargada
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase client initialized')
  } else {
    // Esperar a que se cargue
    window.addEventListener('DOMContentLoaded', () => {
      if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey)
        console.log('✅ Supabase client initialized (after DOMContentLoaded)')
      } else {
        console.error('❌ Supabase library not loaded from CDN')
      }
    })
  }
}
