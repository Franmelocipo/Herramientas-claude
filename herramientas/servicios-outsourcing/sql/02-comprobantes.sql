-- =====================================================
-- SCRIPT 2: TABLA comprobantes
-- Ejecutar DESPUÉS del Script 1 en Supabase SQL Editor
-- REQUIERE: tabla usuarios_comprobantes ya creada
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA
-- =====================================================

CREATE TABLE IF NOT EXISTS comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL,
    usuario_subio_id UUID NOT NULL,
    archivo_url TEXT NOT NULL,
    archivo_nombre TEXT NOT NULL,
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tipo_comprobante TEXT DEFAULT 'factura',
    estado TEXT DEFAULT 'pendiente',
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign Keys (definidas después de las columnas)
    CONSTRAINT fk_comprobantes_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    CONSTRAINT fk_comprobantes_usuario
        FOREIGN KEY (usuario_subio_id) REFERENCES usuarios_comprobantes(id) ON DELETE CASCADE
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_comprobantes_cliente ON comprobantes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_usuario ON comprobantes(usuario_subio_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes(fecha_subida);

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON TABLE comprobantes IS 'Comprobantes/facturas subidos por clientes';
COMMENT ON COLUMN comprobantes.cliente_id IS 'Referencia al cliente (UUID) - dueño del comprobante';
COMMENT ON COLUMN comprobantes.usuario_subio_id IS 'Usuario que subió el comprobante (UUID)';
COMMENT ON COLUMN comprobantes.estado IS 'pendiente: sin revisar | procesado: revisado | rechazado: con problemas';

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;

-- Política: Lectura de comprobantes
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
-- 5. VERIFICACIÓN
-- =====================================================

SELECT 'SCRIPT 2 COMPLETADO: tabla comprobantes creada' AS status;
SELECT COUNT(*) AS total_comprobantes FROM comprobantes;

-- =====================================================
-- CONSULTAS ÚTILES
-- =====================================================

-- Ver comprobantes con info del cliente y usuario:
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
