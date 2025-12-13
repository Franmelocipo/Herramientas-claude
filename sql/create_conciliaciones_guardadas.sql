-- =====================================================
-- TABLA: conciliaciones_guardadas
-- Almacena el estado de las conciliaciones bancarias para continuar trabajo
-- =====================================================

-- Crear tabla de conciliaciones guardadas
CREATE TABLE IF NOT EXISTS conciliaciones_guardadas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    cuenta_bancaria_id BIGINT NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'avanzada', etc.
    rango_desde DATE,
    rango_hasta DATE,
    tolerancia_fecha INTEGER DEFAULT 0,
    tolerancia_importe DECIMAL(15,2) DEFAULT 0,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    historial_procesamiento JSONB DEFAULT '[]'::jsonb,
    fecha_conciliacion TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Comentarios descriptivos
COMMENT ON TABLE conciliaciones_guardadas IS 'Almacena el estado de conciliaciones bancarias para continuar trabajo';
COMMENT ON COLUMN conciliaciones_guardadas.cliente_id IS 'ID del cliente asociado';
COMMENT ON COLUMN conciliaciones_guardadas.cuenta_bancaria_id IS 'ID de la cuenta bancaria';
COMMENT ON COLUMN conciliaciones_guardadas.tipo IS 'Tipo de conciliación (normal, avanzada, etc.)';
COMMENT ON COLUMN conciliaciones_guardadas.rango_desde IS 'Fecha inicio del rango de conciliación';
COMMENT ON COLUMN conciliaciones_guardadas.rango_hasta IS 'Fecha fin del rango de conciliación';
COMMENT ON COLUMN conciliaciones_guardadas.tolerancia_fecha IS 'Tolerancia en días para conciliar';
COMMENT ON COLUMN conciliaciones_guardadas.tolerancia_importe IS 'Tolerancia de importe para conciliar';
COMMENT ON COLUMN conciliaciones_guardadas.datos IS 'Datos de la conciliación (conciliados, mayorNoConciliado, extractoNoConciliado, eliminados)';
COMMENT ON COLUMN conciliaciones_guardadas.historial_procesamiento IS 'Historial de procesamiento de la conciliación';
COMMENT ON COLUMN conciliaciones_guardadas.fecha_conciliacion IS 'Fecha/hora de la última actualización de la conciliación';

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_cliente
    ON conciliaciones_guardadas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_cuenta
    ON conciliaciones_guardadas (cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_cliente_cuenta
    ON conciliaciones_guardadas (cliente_id, cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_tipo
    ON conciliaciones_guardadas (tipo);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_fecha
    ON conciliaciones_guardadas (fecha_conciliacion);

-- Índice único para evitar duplicados por cliente/cuenta/tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_unique
    ON conciliaciones_guardadas (cliente_id, cuenta_bancaria_id, tipo);

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_conciliaciones_guardadas_updated_at ON conciliaciones_guardadas;
CREATE TRIGGER update_conciliaciones_guardadas_updated_at
    BEFORE UPDATE ON conciliaciones_guardadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

-- Habilitar Row Level Security
ALTER TABLE conciliaciones_guardadas ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo
-- NOTA: En producción, restringir según auth.uid() u otros criterios

-- Permitir SELECT (lectura)
DROP POLICY IF EXISTS "Permitir lectura pública de conciliaciones" ON conciliaciones_guardadas;
CREATE POLICY "Permitir lectura pública de conciliaciones" ON conciliaciones_guardadas
    FOR SELECT
    USING (true);

-- Permitir INSERT (creación)
DROP POLICY IF EXISTS "Permitir inserción pública de conciliaciones" ON conciliaciones_guardadas;
CREATE POLICY "Permitir inserción pública de conciliaciones" ON conciliaciones_guardadas
    FOR INSERT
    WITH CHECK (true);

-- Permitir UPDATE (actualización)
DROP POLICY IF EXISTS "Permitir actualización pública de conciliaciones" ON conciliaciones_guardadas;
CREATE POLICY "Permitir actualización pública de conciliaciones" ON conciliaciones_guardadas
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Permitir DELETE (eliminación)
DROP POLICY IF EXISTS "Permitir eliminación pública de conciliaciones" ON conciliaciones_guardadas;
CREATE POLICY "Permitir eliminación pública de conciliaciones" ON conciliaciones_guardadas
    FOR DELETE
    USING (true);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Para verificar que todo se creó correctamente, ejecuta:
-- SELECT * FROM conciliaciones_guardadas;
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'conciliaciones_guardadas';

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- 1. La columna 'datos' almacena en formato JSONB:
--    {
--      "conciliados": [...],
--      "mayorNoConciliado": [...],
--      "extractoNoConciliado": [...],
--      "eliminados": [...]
--    }
-- 2. La columna 'historial_procesamiento' almacena el historial de acciones
-- 3. El índice único previene tener múltiples conciliaciones del mismo tipo
--    para la misma combinación cliente/cuenta
-- 4. Las políticas RLS son permisivas para desarrollo - restringir en producción
