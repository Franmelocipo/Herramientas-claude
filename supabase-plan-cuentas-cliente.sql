-- =====================================================
-- TABLA DE PLAN DE CUENTAS POR CLIENTE
-- Schema para gestionar los planes de cuentas de cada cliente
-- =====================================================

-- Crear tabla de plan de cuentas del cliente
CREATE TABLE IF NOT EXISTS plan_cuentas_cliente (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(cliente_id, codigo)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_plan_cuentas_cliente_cliente ON plan_cuentas_cliente (cliente_id);
CREATE INDEX IF NOT EXISTS idx_plan_cuentas_cliente_codigo ON plan_cuentas_cliente (codigo);

-- Comentarios
COMMENT ON TABLE plan_cuentas_cliente IS 'Plan de cuentas de cada cliente para mapeo de conversiones';
COMMENT ON COLUMN plan_cuentas_cliente.cliente_id IS 'ID del cliente al que pertenece esta cuenta';
COMMENT ON COLUMN plan_cuentas_cliente.codigo IS 'Código de la cuenta en el sistema del cliente';
COMMENT ON COLUMN plan_cuentas_cliente.nombre IS 'Nombre o descripción de la cuenta';

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_plan_cuentas_cliente_updated_at ON plan_cuentas_cliente;
CREATE TRIGGER update_plan_cuentas_cliente_updated_at
    BEFORE UPDATE ON plan_cuentas_cliente
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

-- Habilitar Row Level Security
ALTER TABLE plan_cuentas_cliente ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT (lectura)
DROP POLICY IF EXISTS "Permitir lectura pública de plan_cuentas_cliente" ON plan_cuentas_cliente;
CREATE POLICY "Permitir lectura pública de plan_cuentas_cliente" ON plan_cuentas_cliente
    FOR SELECT
    USING (true);

-- Permitir INSERT (creación)
DROP POLICY IF EXISTS "Permitir inserción pública de plan_cuentas_cliente" ON plan_cuentas_cliente;
CREATE POLICY "Permitir inserción pública de plan_cuentas_cliente" ON plan_cuentas_cliente
    FOR INSERT
    WITH CHECK (true);

-- Permitir UPDATE (actualización)
DROP POLICY IF EXISTS "Permitir actualización pública de plan_cuentas_cliente" ON plan_cuentas_cliente;
CREATE POLICY "Permitir actualización pública de plan_cuentas_cliente" ON plan_cuentas_cliente
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Permitir DELETE (eliminación)
DROP POLICY IF EXISTS "Permitir eliminación pública de plan_cuentas_cliente" ON plan_cuentas_cliente;
CREATE POLICY "Permitir eliminación pública de plan_cuentas_cliente" ON plan_cuentas_cliente
    FOR DELETE
    USING (true);

-- =====================================================
-- TABLA DE MAPEO DE CUENTAS
-- Vincula cuentas del cliente con cuentas del sistema
-- =====================================================

CREATE TABLE IF NOT EXISTS mapeo_cuentas_cliente (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    codigo_cliente TEXT NOT NULL,
    codigo_sistema TEXT NOT NULL,
    nombre_sistema TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(cliente_id, codigo_cliente)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_mapeo_cuentas_cliente ON mapeo_cuentas_cliente (cliente_id);
CREATE INDEX IF NOT EXISTS idx_mapeo_cuentas_codigo ON mapeo_cuentas_cliente (cliente_id, codigo_cliente);

-- Comentarios
COMMENT ON TABLE mapeo_cuentas_cliente IS 'Mapeo entre cuentas del cliente y cuentas del sistema contable';
COMMENT ON COLUMN mapeo_cuentas_cliente.codigo_cliente IS 'Código de cuenta en el sistema del cliente';
COMMENT ON COLUMN mapeo_cuentas_cliente.codigo_sistema IS 'Código de cuenta en nuestro sistema';
COMMENT ON COLUMN mapeo_cuentas_cliente.nombre_sistema IS 'Nombre de la cuenta en nuestro sistema';

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_mapeo_cuentas_cliente_updated_at ON mapeo_cuentas_cliente;
CREATE TRIGGER update_mapeo_cuentas_cliente_updated_at
    BEFORE UPDATE ON mapeo_cuentas_cliente
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS) para mapeo_cuentas_cliente
-- =====================================================

ALTER TABLE mapeo_cuentas_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente;
CREATE POLICY "Permitir lectura pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente;
CREATE POLICY "Permitir inserción pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente;
CREATE POLICY "Permitir actualización pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminación pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente;
CREATE POLICY "Permitir eliminación pública de mapeo_cuentas_cliente" ON mapeo_cuentas_cliente
    FOR DELETE USING (true);
