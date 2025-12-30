-- =====================================================
-- MIGRACIÓN URGENTE: Agregar columnas faltantes
-- Ejecutar este SQL en Supabase SQL Editor para solucionar
-- el error "TypeError: Failed to fetch" al guardar conciliaciones
-- =====================================================

-- Agregar columna movimientos_eliminados (requerida siempre)
ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS movimientos_eliminados JSONB DEFAULT '[]'::jsonb;

-- Agregar columnas para Deudores/Proveedores
ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS agrupaciones_razon_social JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS registros_sin_asignar JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS saldos_inicio JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS saldos_cierre JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS archivo_saldos_inicio TEXT;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS archivo_saldos_cierre TEXT;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS ajustes_auditoria JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS notas_ajustes_auditoria JSONB;

ALTER TABLE conciliaciones_mayor
ADD COLUMN IF NOT EXISTS mayor_incluye_apertura BOOLEAN DEFAULT FALSE;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conciliaciones_mayor'
ORDER BY ordinal_position;
