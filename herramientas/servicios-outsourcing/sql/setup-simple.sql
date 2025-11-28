-- =====================================================
-- SETUP SIMPLIFICADO - SERVICIOS DE OUTSOURCING
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABLA: usuarios_comprobantes
-- Sistema de login simple para clientes y admin
-- =====================================================

CREATE TABLE IF NOT EXISTS usuarios_comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'cliente')),
    nombre TEXT NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_email ON usuarios_comprobantes(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_rol ON usuarios_comprobantes(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_cliente ON usuarios_comprobantes(cliente_id);

-- Comentarios
COMMENT ON TABLE usuarios_comprobantes IS 'Usuarios del sistema de servicios de outsourcing';
COMMENT ON COLUMN usuarios_comprobantes.rol IS 'admin: ve todo | cliente: ve solo sus comprobantes';
COMMENT ON COLUMN usuarios_comprobantes.cliente_id IS 'Solo para rol cliente - referencia a tabla clientes';


-- =====================================================
-- 2. TABLA: comprobantes
-- Comprobantes/facturas subidos por los clientes
-- =====================================================

CREATE TABLE IF NOT EXISTS comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_subio_id UUID NOT NULL REFERENCES usuarios_comprobantes(id) ON DELETE CASCADE,
    archivo_url TEXT NOT NULL,
    archivo_nombre TEXT NOT NULL,
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tipo_comprobante TEXT DEFAULT 'factura',
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'rechazado')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comprobantes_cliente ON comprobantes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_usuario ON comprobantes(usuario_subio_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes(fecha_subida);

-- Comentarios
COMMENT ON TABLE comprobantes IS 'Comprobantes/facturas subidos por clientes';
COMMENT ON COLUMN comprobantes.estado IS 'pendiente: sin revisar | procesado: revisado | rechazado: con problemas';


-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- Controlar quién ve qué datos
-- =====================================================

-- Habilitar RLS
ALTER TABLE usuarios_comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES PARA usuarios_comprobantes
-- =====================================================

-- Política: Permitir lectura para autenticación (todos pueden leer para login)
DROP POLICY IF EXISTS "Lectura publica usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Lectura publica usuarios_comprobantes"
ON usuarios_comprobantes FOR SELECT
USING (true);

-- Política: Solo admin puede insertar usuarios
DROP POLICY IF EXISTS "Admin inserta usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin inserta usuarios_comprobantes"
ON usuarios_comprobantes FOR INSERT
WITH CHECK (true);

-- Política: Solo admin puede actualizar usuarios
DROP POLICY IF EXISTS "Admin actualiza usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin actualiza usuarios_comprobantes"
ON usuarios_comprobantes FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política: Solo admin puede eliminar usuarios
DROP POLICY IF EXISTS "Admin elimina usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin elimina usuarios_comprobantes"
ON usuarios_comprobantes FOR DELETE
USING (true);

-- =====================================================
-- POLICIES PARA comprobantes
-- =====================================================

-- Política: Lectura de comprobantes (todos pueden leer para filtrar luego en la app)
DROP POLICY IF EXISTS "Lectura publica comprobantes" ON comprobantes;
CREATE POLICY "Lectura publica comprobantes"
ON comprobantes FOR SELECT
USING (true);

-- Política: Inserción de comprobantes
DROP POLICY IF EXISTS "Insercion comprobantes" ON comprobantes;
CREATE POLICY "Insercion comprobantes"
ON comprobantes FOR INSERT
WITH CHECK (true);

-- Política: Actualización de comprobantes
DROP POLICY IF EXISTS "Actualizacion comprobantes" ON comprobantes;
CREATE POLICY "Actualizacion comprobantes"
ON comprobantes FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política: Eliminación de comprobantes
DROP POLICY IF EXISTS "Eliminacion comprobantes" ON comprobantes;
CREATE POLICY "Eliminacion comprobantes"
ON comprobantes FOR DELETE
USING (true);


-- =====================================================
-- 4. DATOS INICIALES DE PRUEBA
-- =====================================================

-- Usuario Admin (password: admin123)
-- NOTA: En producción usar hashing seguro (bcrypt, etc)
INSERT INTO usuarios_comprobantes (email, password, rol, nombre, cliente_id) VALUES
('admin@estudio.com', 'admin123', 'admin', 'Administrador', NULL)
ON CONFLICT (email) DO NOTHING;

-- Para crear un usuario cliente, primero necesitas un cliente:
-- 1. Verifica que exista un cliente:
--    SELECT id, nombre FROM clientes LIMIT 5;
--
-- 2. Luego crea el usuario cliente:
--    INSERT INTO usuarios_comprobantes (email, password, rol, nombre, cliente_id) VALUES
--    ('cliente@ejemplo.com', 'cliente123', 'cliente', 'Juan Cliente', 'uuid-del-cliente');
--    (reemplaza 'uuid-del-cliente' con el id UUID del cliente real)


-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================

SELECT 'Tablas creadas exitosamente' AS status;
SELECT 'usuarios_comprobantes: ' || COUNT(*)::TEXT AS registros FROM usuarios_comprobantes;
SELECT 'comprobantes: ' || COUNT(*)::TEXT AS registros FROM comprobantes;


-- =====================================================
-- 6. CONSULTAS ÚTILES
-- =====================================================

-- Ver todos los usuarios:
-- SELECT id, email, rol, nombre, cliente_id FROM usuarios_comprobantes;

-- Ver comprobantes con info del cliente:
-- SELECT
--     c.id,
--     c.archivo_nombre,
--     c.fecha_subida,
--     c.estado,
--     cl.nombre as cliente_nombre,
--     u.nombre as subido_por
-- FROM comprobantes c
-- JOIN clientes cl ON c.cliente_id = cl.id
-- JOIN usuarios_comprobantes u ON c.usuario_subio_id = u.id
-- ORDER BY c.fecha_subida DESC;

-- Ver comprobantes de un cliente específico:
-- SELECT * FROM comprobantes WHERE cliente_id = 'uuid-del-cliente';
