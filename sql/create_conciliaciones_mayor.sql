-- =====================================================
-- TABLA: conciliaciones_mayor
-- Almacena las conciliaciones de mayores contables (cheques, cupones, etc.)
-- =====================================================

-- Crear tabla de conciliaciones de mayor
CREATE TABLE IF NOT EXISTS conciliaciones_mayor (
    id TEXT PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo_mayor_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    registros JSONB NOT NULL DEFAULT '[]'::jsonb,
    vinculaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    movimientos_eliminados JSONB DEFAULT '[]'::jsonb,
    listado_cheques_guardado_id TEXT,
    listado_cheques_incorporado BOOLEAN DEFAULT FALSE,
    listado_cheques_cargados JSONB DEFAULT '[]'::jsonb,
    meses_disponibles JSONB DEFAULT '[]'::jsonb,
    meses_procesados JSONB DEFAULT '{}'::jsonb,
    meses_procesados_resumen JSONB DEFAULT '{}'::jsonb,
    -- Columnas para Deudores/Proveedores
    agrupaciones_razon_social JSONB,
    registros_sin_asignar JSONB,
    saldos_inicio JSONB,
    saldos_cierre JSONB,
    archivo_saldos_inicio TEXT,
    archivo_saldos_cierre TEXT,
    ajustes_auditoria JSONB,
    notas_ajustes_auditoria JSONB,
    mayor_incluye_apertura BOOLEAN DEFAULT FALSE,
    fecha_guardado TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    fecha_modificado TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- MIGRACIÓN: Agregar columnas nuevas si no existen
-- Ejecutar este bloque si la tabla ya existe
-- =====================================================
DO $$
BEGIN
    -- Agregar columna listado_cheques_cargados si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'listado_cheques_cargados') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN listado_cheques_cargados JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Columna listado_cheques_cargados agregada';
    END IF;

    -- Agregar columna meses_procesados si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'meses_procesados') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN meses_procesados JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Columna meses_procesados agregada';
    END IF;

    -- Agregar columna movimientos_eliminados si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'movimientos_eliminados') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN movimientos_eliminados JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Columna movimientos_eliminados agregada';
    END IF;

    -- Agregar columnas de Deudores/Proveedores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'agrupaciones_razon_social') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN agrupaciones_razon_social JSONB;
        RAISE NOTICE 'Columna agrupaciones_razon_social agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'registros_sin_asignar') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN registros_sin_asignar JSONB;
        RAISE NOTICE 'Columna registros_sin_asignar agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'saldos_inicio') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN saldos_inicio JSONB;
        RAISE NOTICE 'Columna saldos_inicio agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'saldos_cierre') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN saldos_cierre JSONB;
        RAISE NOTICE 'Columna saldos_cierre agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'archivo_saldos_inicio') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN archivo_saldos_inicio TEXT;
        RAISE NOTICE 'Columna archivo_saldos_inicio agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'archivo_saldos_cierre') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN archivo_saldos_cierre TEXT;
        RAISE NOTICE 'Columna archivo_saldos_cierre agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'ajustes_auditoria') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN ajustes_auditoria JSONB;
        RAISE NOTICE 'Columna ajustes_auditoria agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'notas_ajustes_auditoria') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN notas_ajustes_auditoria JSONB;
        RAISE NOTICE 'Columna notas_ajustes_auditoria agregada';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conciliaciones_mayor'
                   AND column_name = 'mayor_incluye_apertura') THEN
        ALTER TABLE conciliaciones_mayor
        ADD COLUMN mayor_incluye_apertura BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Columna mayor_incluye_apertura agregada';
    END IF;
END $$;

-- Comentarios descriptivos
COMMENT ON TABLE conciliaciones_mayor IS 'Almacena conciliaciones de mayores contables (cheques, cupones, etc.)';
COMMENT ON COLUMN conciliaciones_mayor.id IS 'ID único de la conciliación (ej: conc_1734567890123_abc123)';
COMMENT ON COLUMN conciliaciones_mayor.cliente_id IS 'ID del cliente asociado';
COMMENT ON COLUMN conciliaciones_mayor.tipo_mayor_id IS 'Tipo de mayor (cheques_terceros_recibidos, cupones_tarjetas, etc.)';
COMMENT ON COLUMN conciliaciones_mayor.nombre IS 'Nombre descriptivo de la conciliación';
COMMENT ON COLUMN conciliaciones_mayor.registros IS 'Registros del mayor contable';
COMMENT ON COLUMN conciliaciones_mayor.vinculaciones IS 'Vinculaciones entre registros (cupón-liquidación, cheque-depósito, etc.)';
COMMENT ON COLUMN conciliaciones_mayor.listado_cheques_guardado_id IS 'ID del listado de cheques asociado (si aplica)';
COMMENT ON COLUMN conciliaciones_mayor.listado_cheques_incorporado IS 'Si se incorporó el listado de cheques';
COMMENT ON COLUMN conciliaciones_mayor.meses_disponibles IS 'Meses disponibles para conciliar';
COMMENT ON COLUMN conciliaciones_mayor.meses_procesados_resumen IS 'Resumen de meses procesados';

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_conciliaciones_mayor_cliente
    ON conciliaciones_mayor (cliente_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_mayor_tipo
    ON conciliaciones_mayor (tipo_mayor_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_mayor_cliente_tipo
    ON conciliaciones_mayor (cliente_id, tipo_mayor_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_mayor_fecha
    ON conciliaciones_mayor (fecha_modificado DESC);

-- Trigger para actualizar fecha_modificado automáticamente
CREATE OR REPLACE FUNCTION update_conciliaciones_mayor_fecha_modificado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificado = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conciliaciones_mayor_fecha ON conciliaciones_mayor;
CREATE TRIGGER update_conciliaciones_mayor_fecha
    BEFORE UPDATE ON conciliaciones_mayor
    FOR EACH ROW
    EXECUTE FUNCTION update_conciliaciones_mayor_fecha_modificado();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

-- Habilitar Row Level Security
ALTER TABLE conciliaciones_mayor ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo
DROP POLICY IF EXISTS "Permitir lectura de conciliaciones_mayor" ON conciliaciones_mayor;
CREATE POLICY "Permitir lectura de conciliaciones_mayor" ON conciliaciones_mayor
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción de conciliaciones_mayor" ON conciliaciones_mayor;
CREATE POLICY "Permitir inserción de conciliaciones_mayor" ON conciliaciones_mayor
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de conciliaciones_mayor" ON conciliaciones_mayor;
CREATE POLICY "Permitir actualización de conciliaciones_mayor" ON conciliaciones_mayor
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminación de conciliaciones_mayor" ON conciliaciones_mayor;
CREATE POLICY "Permitir eliminación de conciliaciones_mayor" ON conciliaciones_mayor
    FOR DELETE USING (true);

-- =====================================================
-- TABLA ADICIONAL: listado_cheques
-- Almacena los listados de cheques cargados por cliente
-- =====================================================

CREATE TABLE IF NOT EXISTS listado_cheques (
    id TEXT PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    cheques JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_cheques INTEGER DEFAULT 0,
    total_importe DECIMAL(15,2) DEFAULT 0,
    meses JSONB DEFAULT '[]'::jsonb,
    fecha_guardado TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE listado_cheques IS 'Almacena listados de cheques cargados por cliente';

CREATE INDEX IF NOT EXISTS idx_listado_cheques_cliente
    ON listado_cheques (cliente_id);

-- RLS para listado_cheques
ALTER TABLE listado_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de listado_cheques" ON listado_cheques;
CREATE POLICY "Permitir lectura de listado_cheques" ON listado_cheques
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción de listado_cheques" ON listado_cheques;
CREATE POLICY "Permitir inserción de listado_cheques" ON listado_cheques
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de listado_cheques" ON listado_cheques;
CREATE POLICY "Permitir actualización de listado_cheques" ON listado_cheques
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminación de listado_cheques" ON listado_cheques;
CREATE POLICY "Permitir eliminación de listado_cheques" ON listado_cheques
    FOR DELETE USING (true);

-- =====================================================
-- TABLA ADICIONAL: meses_procesados
-- Almacena el estado de procesamiento de meses por cliente
-- =====================================================

CREATE TABLE IF NOT EXISTS meses_procesados (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(cliente_id)
);

COMMENT ON TABLE meses_procesados IS 'Estado de procesamiento de meses por cliente';

CREATE INDEX IF NOT EXISTS idx_meses_procesados_cliente
    ON meses_procesados (cliente_id);

-- RLS para meses_procesados
ALTER TABLE meses_procesados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de meses_procesados" ON meses_procesados;
CREATE POLICY "Permitir lectura de meses_procesados" ON meses_procesados
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción de meses_procesados" ON meses_procesados;
CREATE POLICY "Permitir inserción de meses_procesados" ON meses_procesados
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de meses_procesados" ON meses_procesados;
CREATE POLICY "Permitir actualización de meses_procesados" ON meses_procesados
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminación de meses_procesados" ON meses_procesados;
CREATE POLICY "Permitir eliminación de meses_procesados" ON meses_procesados
    FOR DELETE USING (true);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que todo se creó correctamente:
-- SELECT * FROM conciliaciones_mayor;
-- SELECT * FROM listado_cheques;
-- SELECT * FROM meses_procesados;
