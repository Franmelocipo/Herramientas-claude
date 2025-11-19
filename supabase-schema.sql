-- =====================================================
-- ESQUEMA DE BASES DE DATOS COMPARTIDAS
-- Herramientas Contables - Menu Superior
-- =====================================================

-- Tabla: Clientes Compartidos
-- Almacena información de clientes para uso en todas las herramientas
CREATE TABLE IF NOT EXISTS shared_clients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cuit TEXT,
    account_plan JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    active BOOLEAN DEFAULT true
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_shared_clients_name ON shared_clients (name);
CREATE INDEX IF NOT EXISTS idx_shared_clients_cuit ON shared_clients (cuit);
CREATE INDEX IF NOT EXISTS idx_shared_clients_active ON shared_clients (active);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shared_clients_updated_at BEFORE UPDATE ON shared_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Tabla: Obligaciones Impositivas
-- Almacena impuestos y vencimientos
CREATE TABLE IF NOT EXISTS tax_obligations (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT REFERENCES shared_clients(id) ON DELETE CASCADE,
    tax_name TEXT NOT NULL,
    tax_type TEXT NOT NULL, -- IVA, Ganancias, IIBB, etc.
    period TEXT NOT NULL, -- 2024-01, 2024-02, etc.
    due_date DATE NOT NULL,
    amount DECIMAL(15,2),
    status TEXT DEFAULT 'pending', -- pending, paid, overdue
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para tax_obligations
CREATE INDEX IF NOT EXISTS idx_tax_obligations_client ON tax_obligations (client_id);
CREATE INDEX IF NOT EXISTS idx_tax_obligations_due_date ON tax_obligations (due_date);
CREATE INDEX IF NOT EXISTS idx_tax_obligations_status ON tax_obligations (status);
CREATE INDEX IF NOT EXISTS idx_tax_obligations_period ON tax_obligations (period);

-- Trigger para actualizar updated_at en tax_obligations
CREATE TRIGGER update_tax_obligations_updated_at BEFORE UPDATE ON tax_obligations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Tabla: Base de Datos de Impuestos (Catálogo)
-- Para importar desde Excel: Impuesto | Concepto | Subconcepto
CREATE TABLE IF NOT EXISTS tax_database (
    id BIGSERIAL PRIMARY KEY,
    impuesto TEXT NOT NULL,
    concepto TEXT NOT NULL,
    subconcepto TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_database_unique
    ON tax_database (impuesto, concepto, subconcepto);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_tax_database_impuesto ON tax_database (impuesto);
CREATE INDEX IF NOT EXISTS idx_tax_database_concepto ON tax_database (concepto);

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE shared_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_database ENABLE ROW LEVEL SECURITY;

-- Políticas para shared_clients (lectura pública)
CREATE POLICY "Permitir lectura pública de clientes" ON shared_clients
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública de clientes" ON shared_clients
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública de clientes" ON shared_clients
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación pública de clientes" ON shared_clients
    FOR DELETE USING (true);

-- Políticas para tax_obligations
CREATE POLICY "Permitir lectura pública de impuestos" ON tax_obligations
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública de impuestos" ON tax_obligations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública de impuestos" ON tax_obligations
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación pública de impuestos" ON tax_obligations
    FOR DELETE USING (true);

-- Políticas para tax_database
CREATE POLICY "Permitir lectura pública de base de impuestos" ON tax_database
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública de base de impuestos" ON tax_database
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir eliminación pública de base de impuestos" ON tax_database
    FOR DELETE USING (true);

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función para obtener estadísticas de almacenamiento
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'shared_clients'::TEXT as table_name,
        COUNT(*)::BIGINT as row_count,
        pg_size_pretty(pg_total_relation_size('shared_clients'::regclass))::TEXT as table_size
    FROM shared_clients
    UNION ALL
    SELECT
        'tax_obligations'::TEXT,
        COUNT(*)::BIGINT,
        pg_size_pretty(pg_total_relation_size('tax_obligations'::regclass))::TEXT
    FROM tax_obligations
    UNION ALL
    SELECT
        'tax_database'::TEXT,
        COUNT(*)::BIGINT,
        pg_size_pretty(pg_total_relation_size('tax_database'::regclass))::TEXT
    FROM tax_database;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATOS DE EJEMPLO (opcional - comentar si no se desea)
-- =====================================================

-- Insertar algunos datos de ejemplo
-- INSERT INTO shared_clients (name, cuit) VALUES
--     ('Cliente Ejemplo 1', '20-12345678-9'),
--     ('Cliente Ejemplo 2', '20-98765432-1');

-- =====================================================
-- FIN DEL ESQUEMA
-- =====================================================

-- Para verificar que todo se creó correctamente:
-- SELECT * FROM get_storage_stats();
