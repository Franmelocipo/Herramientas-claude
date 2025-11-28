-- =====================================================
-- SCRIPT 3: AGREGAR CAMPO REQUIERE_CAMBIO_PASSWORD
-- Sistema de Gestión de Usuarios Externos
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNAS
-- =====================================================

-- Agregar columna requiere_cambio_password
ALTER TABLE usuarios_comprobantes
ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN DEFAULT FALSE;

-- Agregar columna activo si no existe (para control de usuarios)
ALTER TABLE usuarios_comprobantes
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

-- =====================================================
-- 2. ACTUALIZAR USUARIOS EXISTENTES
-- =====================================================

-- Los usuarios existentes no requieren cambio de password
UPDATE usuarios_comprobantes
SET requiere_cambio_password = FALSE
WHERE requiere_cambio_password IS NULL;

-- Los usuarios existentes están activos por defecto
UPDATE usuarios_comprobantes
SET activo = TRUE
WHERE activo IS NULL;

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN usuarios_comprobantes.requiere_cambio_password IS 'TRUE si el usuario debe cambiar su contraseña en el próximo login';
COMMENT ON COLUMN usuarios_comprobantes.activo IS 'TRUE si el usuario está activo y puede iniciar sesión';

-- =====================================================
-- 4. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_requiere_cambio ON usuarios_comprobantes(requiere_cambio_password);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios_comprobantes(activo);

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================

SELECT 'SCRIPT 3 COMPLETADO: Columnas agregadas exitosamente' AS status;

-- Ver estructura de la tabla
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'usuarios_comprobantes'
ORDER BY ordinal_position;

-- Contar usuarios
SELECT
    COUNT(*) AS total_usuarios,
    SUM(CASE WHEN requiere_cambio_password = TRUE THEN 1 ELSE 0 END) AS requieren_cambio,
    SUM(CASE WHEN activo = TRUE THEN 1 ELSE 0 END) AS activos
FROM usuarios_comprobantes;
