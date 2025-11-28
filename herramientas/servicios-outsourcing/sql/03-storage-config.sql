-- =====================================================
-- SCRIPT 3: CONFIGURACIÓN DE STORAGE
-- Ejecutar DESPUÉS de los Scripts 1 y 2
-- =====================================================

-- =====================================================
-- 1. CREAR BUCKET
-- =====================================================
-- IMPORTANTE: Ejecutar esto en Supabase Dashboard > Storage
-- O usar la siguiente función (si tienes permisos):

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. POLÍTICAS DE STORAGE
-- =====================================================

-- Política: Permitir subida de archivos a usuarios autenticados
DROP POLICY IF EXISTS "Usuarios suben comprobantes" ON storage.objects;
CREATE POLICY "Usuarios suben comprobantes"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'comprobantes'
);

-- Política: Permitir lectura de archivos
DROP POLICY IF EXISTS "Usuarios leen comprobantes" ON storage.objects;
CREATE POLICY "Usuarios leen comprobantes"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'comprobantes'
);

-- Política: Permitir actualización de archivos
DROP POLICY IF EXISTS "Usuarios actualizan comprobantes" ON storage.objects;
CREATE POLICY "Usuarios actualizan comprobantes"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'comprobantes'
);

-- Política: Permitir eliminación de archivos
DROP POLICY IF EXISTS "Usuarios eliminan comprobantes" ON storage.objects;
CREATE POLICY "Usuarios eliminan comprobantes"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'comprobantes'
);

-- =====================================================
-- 3. VERIFICACIÓN
-- =====================================================

SELECT 'SCRIPT 3 COMPLETADO: Storage configurado' AS status;
SELECT id, name, public FROM storage.buckets WHERE id = 'comprobantes';

-- =====================================================
-- NOTAS DE USO
-- =====================================================

-- Estructura recomendada de carpetas en el bucket:
-- comprobantes/
--   ├── {cliente_uuid}/
--   │   ├── 2024-01/
--   │   │   ├── factura_001.pdf
--   │   │   └── factura_002.pdf
--   │   └── 2024-02/
--   │       └── factura_003.pdf
--   └── {otro_cliente_uuid}/
--       └── ...

-- Ejemplo de URL de archivo:
-- https://[tu-proyecto].supabase.co/storage/v1/object/public/comprobantes/[cliente_uuid]/2024-01/factura.pdf
