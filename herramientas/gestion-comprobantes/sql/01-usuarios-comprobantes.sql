-- =====================================================
-- SCRIPT 1: TABLA usuarios_comprobantes
-- Ejecutar PRIMERO en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA
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

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_email ON usuarios_comprobantes(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_rol ON usuarios_comprobantes(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_comprobantes_cliente ON usuarios_comprobantes(cliente_id);

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON TABLE usuarios_comprobantes IS 'Usuarios del sistema de gestión de comprobantes';
COMMENT ON COLUMN usuarios_comprobantes.rol IS 'admin: ve todo | cliente: ve solo sus comprobantes';
COMMENT ON COLUMN usuarios_comprobantes.cliente_id IS 'Solo para rol cliente - referencia a tabla clientes (UUID)';

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE usuarios_comprobantes ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura para autenticación
DROP POLICY IF EXISTS "Lectura publica usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Lectura publica usuarios_comprobantes"
ON usuarios_comprobantes FOR SELECT
USING (true);

-- Política: Insertar usuarios
DROP POLICY IF EXISTS "Admin inserta usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin inserta usuarios_comprobantes"
ON usuarios_comprobantes FOR INSERT
WITH CHECK (true);

-- Política: Actualizar usuarios
DROP POLICY IF EXISTS "Admin actualiza usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin actualiza usuarios_comprobantes"
ON usuarios_comprobantes FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política: Eliminar usuarios
DROP POLICY IF EXISTS "Admin elimina usuarios_comprobantes" ON usuarios_comprobantes;
CREATE POLICY "Admin elimina usuarios_comprobantes"
ON usuarios_comprobantes FOR DELETE
USING (true);

-- =====================================================
-- 5. DATOS INICIALES
-- =====================================================

-- Usuario Admin (password: admin123)
-- NOTA: En producción usar hashing seguro (bcrypt, etc)
INSERT INTO usuarios_comprobantes (email, password, rol, nombre, cliente_id) VALUES
('admin@estudio.com', 'admin123', 'admin', 'Administrador', NULL)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 6. VERIFICACIÓN
-- =====================================================

SELECT 'SCRIPT 1 COMPLETADO: tabla usuarios_comprobantes creada' AS status;
SELECT COUNT(*) AS total_usuarios FROM usuarios_comprobantes;

-- =====================================================
-- PARA CREAR USUARIO CLIENTE:
-- =====================================================
-- 1. Primero obtén el UUID del cliente:
--    SELECT id, nombre FROM clientes LIMIT 5;
--
-- 2. Luego crea el usuario:
--    INSERT INTO usuarios_comprobantes (email, password, rol, nombre, cliente_id) VALUES
--    ('cliente@ejemplo.com', 'cliente123', 'cliente', 'Juan Cliente', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
