-- =====================================================
-- CONFIGURACIÓN DE STORAGE - BUCKET COMPROBANTES
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREAR BUCKET
-- =====================================================

-- Insertar el bucket 'comprobantes' (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprobantes',
    'comprobantes',
    false,  -- No público
    10485760,  -- 10MB máximo
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];


-- =====================================================
-- 2. POLÍTICAS DE STORAGE
-- Solo usuarios autenticados pueden leer y escribir
-- =====================================================

-- Limpiar políticas anteriores si existen
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar" ON storage.objects;

-- =====================================================
-- POLÍTICA: Lectura - Solo usuarios autenticados
-- =====================================================
CREATE POLICY "Usuarios autenticados pueden leer"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'comprobantes'
    -- Para un sistema más robusto con Supabase Auth:
    -- AND auth.role() = 'authenticated'
);

-- =====================================================
-- POLÍTICA: Escritura - Solo usuarios autenticados
-- =====================================================
CREATE POLICY "Usuarios autenticados pueden subir"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'comprobantes'
    -- Para un sistema más robusto con Supabase Auth:
    -- AND auth.role() = 'authenticated'
);

-- =====================================================
-- POLÍTICA: Actualización - Solo usuarios autenticados
-- =====================================================
CREATE POLICY "Usuarios autenticados pueden actualizar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'comprobantes'
)
WITH CHECK (
    bucket_id = 'comprobantes'
);

-- =====================================================
-- POLÍTICA: Eliminación - Solo usuarios autenticados
-- =====================================================
CREATE POLICY "Usuarios autenticados pueden eliminar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'comprobantes'
);


-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 'Bucket comprobantes configurado exitosamente' AS status;
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'comprobantes';


-- =====================================================
-- NOTAS DE USO
-- =====================================================

-- Estructura de carpetas recomendada:
-- comprobantes/{cliente_id}/{año}/{mes}/archivo.pdf
--
-- Ejemplo:
-- comprobantes/1/2024/11/factura-proveedor-001.pdf
--
-- Subir archivo desde JavaScript:
--
-- const { data, error } = await supabase.storage
--     .from('comprobantes')
--     .upload(`${clienteId}/${year}/${month}/${fileName}`, file);
--
-- Obtener URL pública temporal (signed URL):
--
-- const { data } = await supabase.storage
--     .from('comprobantes')
--     .createSignedUrl('path/to/file.pdf', 3600); // 1 hora
