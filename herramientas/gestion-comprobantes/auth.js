/**
 * AUTH.JS - Sistema de Autenticación
 * Gestión de Comprobantes - Estudio Contable
 */

// Configuración de Supabase
const supabaseUrl = 'https://wnpjvnmyfkgtpwqnbmxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzE5OTAsImV4cCI6MjA3ODcwNzk5MH0.XmYGTMuQBJBpUMAij90T6z4SlCMugVWuWdwJ84GiPn8';

// Cliente de Supabase (se inicializa cuando la librería está disponible)
let supabaseClient = null;

/**
 * Inicializar el cliente de Supabase
 */
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('Supabase client initialized for auth');
        return true;
    }
    return false;
}

/**
 * Función de login
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Object} - Resultado del login con datos del usuario o error
 */
async function login(email, password) {
    try {
        // Asegurar que Supabase está inicializado
        if (!supabaseClient) {
            if (!initSupabase()) {
                throw new Error('No se pudo inicializar Supabase');
            }
        }

        // Consultar la tabla usuarios_comprobantes
        const { data, error } = await supabaseClient
            .from('usuarios_comprobantes')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error) {
            console.error('Error en login:', error);

            // Si no encontró el usuario
            if (error.code === 'PGRST116') {
                return {
                    success: false,
                    error: 'Credenciales incorrectas. Verifica tu email y contraseña.'
                };
            }

            return {
                success: false,
                error: 'Error al iniciar sesión. Por favor, intenta de nuevo.'
            };
        }

        if (!data) {
            return {
                success: false,
                error: 'Credenciales incorrectas. Verifica tu email y contraseña.'
            };
        }

        // Verificar si el usuario está activo
        if (data.activo === false) {
            return {
                success: false,
                error: 'Tu cuenta está desactivada. Contacta al administrador.'
            };
        }

        // Guardar datos en localStorage
        localStorage.setItem('user_id', data.id);
        localStorage.setItem('email', data.email);
        localStorage.setItem('rol', data.rol);
        localStorage.setItem('nombre', data.nombre);
        localStorage.setItem('isLoggedIn', 'true');

        // Guardar cliente_id si existe (para usuarios tipo cliente)
        if (data.cliente_id) {
            localStorage.setItem('cliente_id', data.cliente_id);
        }

        console.log('Login exitoso:', data.email, '- Rol:', data.rol);

        return {
            success: true,
            user: {
                id: data.id,
                email: data.email,
                nombre: data.nombre,
                rol: data.rol,
                cliente_id: data.cliente_id
            },
            requiere_cambio_password: data.requiere_cambio_password === true
        };

    } catch (error) {
        console.error('Error en login:', error);
        return {
            success: false,
            error: error.message || 'Error inesperado al iniciar sesión'
        };
    }
}

/**
 * Función de logout
 * Limpia los datos de sesión y redirige al login
 */
function logout() {
    // Limpiar localStorage
    localStorage.removeItem('user_id');
    localStorage.removeItem('email');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
    localStorage.removeItem('cliente_id');
    localStorage.removeItem('isLoggedIn');

    console.log('Sesión cerrada');

    // Redirigir al login
    window.location.href = 'login.html';
}

/**
 * Verificar si hay una sesión activa
 * @returns {Object|null} - Datos del usuario o null si no hay sesión
 */
function checkSession() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (isLoggedIn !== 'true') {
        return null;
    }

    const userId = localStorage.getItem('user_id');
    const email = localStorage.getItem('email');
    const rol = localStorage.getItem('rol');
    const nombre = localStorage.getItem('nombre');
    const clienteId = localStorage.getItem('cliente_id');

    // Verificar que todos los datos necesarios existan
    if (!userId || !email || !rol || !nombre) {
        // Datos incompletos, limpiar sesión
        logout();
        return null;
    }

    return {
        id: userId,
        email: email,
        rol: rol,
        nombre: nombre,
        cliente_id: clienteId
    };
}

/**
 * Redirigir según el rol del usuario
 * @param {string} rol - Rol del usuario
 */
function redirectByRole(rol) {
    switch (rol) {
        case 'admin':
            window.location.href = 'panel-admin.html';
            break;
        case 'cliente':
            window.location.href = 'panel-cliente.html';
            break;
        default:
            // Por defecto, ir al index
            window.location.href = 'index.html';
    }
}

/**
 * Proteger página - redirige al login si no hay sesión
 * Usar en páginas que requieren autenticación
 */
function requireAuth() {
    const session = checkSession();

    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    return session;
}

/**
 * Proteger página por rol específico
 * @param {string|Array} allowedRoles - Rol o roles permitidos
 */
function requireRole(allowedRoles) {
    const session = requireAuth();

    if (!session) return null;

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(session.rol)) {
        // Redirigir al panel correspondiente
        redirectByRole(session.rol);
        return null;
    }

    return session;
}

// Exponer funciones globalmente
window.auth = {
    login,
    logout,
    checkSession,
    redirectByRole,
    requireAuth,
    requireRole,
    initSupabase
};
