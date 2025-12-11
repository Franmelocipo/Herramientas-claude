-- =====================================================
-- TABLA: Categorías de Movimientos Bancarios
-- Para clasificar movimientos en la herramienta de auditoría
-- =====================================================

-- Tabla: categorias_movimientos
-- Almacena las categorías personalizables para clasificar movimientos bancarios
CREATE TABLE IF NOT EXISTS categorias_movimientos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_categorias_movimientos_activo ON categorias_movimientos (activo);
CREATE INDEX IF NOT EXISTS idx_categorias_movimientos_orden ON categorias_movimientos (orden);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_categorias_movimientos_updated_at
    BEFORE UPDATE ON categorias_movimientos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- =====================================================

ALTER TABLE categorias_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de categorías" ON categorias_movimientos
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública de categorías" ON categorias_movimientos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública de categorías" ON categorias_movimientos
    FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación pública de categorías" ON categorias_movimientos
    FOR DELETE USING (true);

-- =====================================================
-- DATOS INICIALES (Categorías predeterminadas)
-- =====================================================

INSERT INTO categorias_movimientos (id, nombre, color, orden) VALUES
    ('comisiones', 'Comisiones', '#f59e0b', 1),
    ('iva', 'IVA', '#8b5cf6', 2),
    ('gastos_bancarios', 'Gastos Bancarios', '#ef4444', 3),
    ('transferencias', 'Transferencias', '#3b82f6', 4),
    ('impuestos', 'Impuestos', '#ec4899', 5),
    ('servicios', 'Servicios', '#14b8a6', 6),
    ('proveedores', 'Proveedores', '#f97316', 7),
    ('sueldos', 'Sueldos', '#06b6d4', 8),
    ('ventas', 'Ventas', '#22c55e', 9),
    ('otros', 'Otros', '#64748b', 10)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- FIN DEL ESQUEMA
-- =====================================================
