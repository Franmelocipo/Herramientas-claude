// clientes-simple.js
// Gestión simple de clientes con Supabase

// Esperar a que Supabase esté inicializado
function waitForSupabase(callback) {
  if (window.supabase) {
    callback();
  } else {
    setTimeout(() => waitForSupabase(callback), 100);
  }
}

// Inicializar cuando Supabase esté listo
waitForSupabase(() => {
  console.log('✅ Clientes module loaded');

  const supabaseClient = window.supabase.createClient(
    'https://wnpjvnmyfkgtpwqnbmxa.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzE5OTAsImV4cCI6MjA3ODcwNzk5MH0.XmYGTMuQBJBpUMAij90T6z4SlCMugVWuWdwJ84GiPn8'
  );

  // Función: Crear cliente
  window.crearClienteSimple = async function(nombre, cuit) {
    try {
      console.log('📝 Creando cliente:', nombre, cuit);

      const { data, error } = await supabaseClient
        .from('clientes')
        .insert([
          { nombre: nombre, cuit: cuit }
        ])
        .select();

      if (error) {
        console.error('❌ Error:', error);
        alert('Error al crear cliente: ' + error.message);
        return null;
      }

      console.log('✅ Cliente creado:', data);
      alert('Cliente creado exitosamente!');
      return data;
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('Error al crear cliente');
      return null;
    }
  };

  // Función: Obtener todos los clientes
  window.obtenerClientes = async function() {
    try {
      const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error:', error);
        return [];
      }

      console.log('✅ Clientes obtenidos:', data);
      return data;
    } catch (err) {
      console.error('❌ Error:', err);
      return [];
    }
  };

  console.log('✅ Funciones de clientes disponibles: crearClienteSimple(), obtenerClientes()');
});
