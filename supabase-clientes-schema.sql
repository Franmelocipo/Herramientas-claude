-- =====================================================
-- TABLA DE CLIENTES
-- Schema simplificado para gestión de clientes
-- =====================================================

-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    cuit TEXT,
    direccion TEXT,
    email TEXT,
    telefono TEXT,
    tipo_societario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_cuit ON clientes (cuit);

-- Comentarios
COMMENT ON TABLE clientes IS 'Tabla de clientes del estudio contable';
COMMENT ON COLUMN clientes.id IS 'ID único autogenerado';
COMMENT ON COLUMN clientes.nombre IS 'Razón social o nombre del cliente';
COMMENT ON COLUMN clientes.cuit IS 'CUIT del cliente';
COMMENT ON COLUMN clientes.direccion IS 'Dirección fiscal del cliente';
COMMENT ON COLUMN clientes.email IS 'Email de contacto';
COMMENT ON COLUMN clientes.telefono IS 'Teléfono de contacto';
COMMENT ON COLUMN clientes.tipo_societario IS 'Tipo societario (ej: SA, SRL, Monotributo, etc)';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

-- Habilitar Row Level Security
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política: Permitir todas las operaciones a usuarios autenticados y anónimos
-- IMPORTANTE: Estas políticas son muy permisivas para desarrollo
-- En producción, deberías restringirlas según tus necesidades

-- Permitir SELECT (lectura)
DROP POLICY IF EXISTS "Permitir lectura pública de clientes" ON clientes;
CREATE POLICY "Permitir lectura pública de clientes" ON clientes
    FOR SELECT
    USING (true);

-- Permitir INSERT (creación)
DROP POLICY IF EXISTS "Permitir inserción pública de clientes" ON clientes;
CREATE POLICY "Permitir inserción pública de clientes" ON clientes
    FOR INSERT
    WITH CHECK (true);

-- Permitir UPDATE (actualización)
DROP POLICY IF EXISTS "Permitir actualización pública de clientes" ON clientes;
CREATE POLICY "Permitir actualización pública de clientes" ON clientes
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Permitir DELETE (eliminación)
DROP POLICY IF EXISTS "Permitir eliminación pública de clientes" ON clientes;
CREATE POLICY "Permitir eliminación pública de clientes" ON clientes
    FOR DELETE
    USING (true);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Para verificar que todo se creó correctamente, ejecuta:
-- SELECT * FROM clientes;
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'clientes';

-- Insertar un cliente de prueba (opcional)
-- INSERT INTO clientes (nombre, cuit) VALUES ('Cliente de Prueba', '20-12345678-9');

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- 1. Este script crea la tabla "clientes" con todas las políticas RLS necesarias
-- 2. Las políticas son MUY PERMISIVAS (true) - ideal para desarrollo
-- 3. En producción, considera restringir el acceso según auth.uid() u otros criterios
-- 4. La tabla se actualiza automáticamente (updated_at) cada vez que se modifica un registro
-- 5. Si ya existe la tabla, este script no la sobrescribirá (IF NOT EXISTS)
