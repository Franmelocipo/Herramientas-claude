-- =====================================================
-- MIGRACIÓN: Permitir múltiples conciliaciones por cliente/cuenta
-- =====================================================

-- 1. Eliminar el índice único que impide múltiples conciliaciones
DROP INDEX IF EXISTS idx_conciliaciones_guardadas_unique;

-- 2. Agregar campo nombre para identificar cada conciliación
ALTER TABLE conciliaciones_guardadas
ADD COLUMN IF NOT EXISTS nombre TEXT;

-- 3. Actualizar conciliaciones existentes sin nombre
UPDATE conciliaciones_guardadas
SET nombre = 'Conciliación ' || tipo || ' - ' || TO_CHAR(fecha_conciliacion, 'DD/MM/YYYY HH24:MI')
WHERE nombre IS NULL;

-- 4. Crear índice compuesto para búsquedas rápidas (sin restricción única)
CREATE INDEX IF NOT EXISTS idx_conciliaciones_guardadas_cliente_cuenta_tipo
    ON conciliaciones_guardadas (cliente_id, cuenta_bancaria_id, tipo);

-- 5. Comentario descriptivo
COMMENT ON COLUMN conciliaciones_guardadas.nombre IS 'Nombre descriptivo de la conciliación para identificarla';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT id, nombre, tipo, fecha_conciliacion FROM conciliaciones_guardadas;
