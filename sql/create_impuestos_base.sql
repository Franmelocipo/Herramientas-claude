-- =====================================================
-- TABLA: IMPUESTOS_BASE
-- Base de datos completa de impuestos con 6 campos
-- =====================================================

-- Crear la nueva tabla con estructura completa
CREATE TABLE IF NOT EXISTS impuestos_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_impuesto VARCHAR(20) NOT NULL,
    descripcion_impuesto VARCHAR(255) NOT NULL,
    codigo_concepto VARCHAR(20),
    descripcion_concepto VARCHAR(255),
    codigo_subconcepto VARCHAR(20),
    descripcion_subconcepto VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por código de impuesto
CREATE INDEX IF NOT EXISTS idx_impuestos_codigo ON impuestos_base(codigo_impuesto);

-- Índice para búsquedas por descripción
CREATE INDEX IF NOT EXISTS idx_impuestos_descripcion ON impuestos_base(descripcion_impuesto);

-- Índice compuesto para búsquedas combinadas
CREATE INDEX IF NOT EXISTS idx_impuestos_codigo_concepto ON impuestos_base(codigo_impuesto, codigo_concepto);

-- Habilitar RLS
ALTER TABLE impuestos_base ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones
CREATE POLICY "Allow all operations on impuestos_base" ON impuestos_base
FOR ALL
USING (true)
WITH CHECK (true);

-- =====================================================
-- DATOS DE EJEMPLO (opcionales)
-- =====================================================

-- Ejemplos de IVA
INSERT INTO impuestos_base (codigo_impuesto, descripcion_impuesto, codigo_concepto, descripcion_concepto, codigo_subconcepto, descripcion_subconcepto)
VALUES
    ('IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '21%', 'IVA 21% - Tasa General'),
    ('IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '10.5%', 'IVA 10.5% - Tasa Reducida'),
    ('IVA', 'Impuesto al Valor Agregado', 'DEB', 'Débito Fiscal', '27%', 'IVA 27% - Tasa Diferencial'),
    ('IVA', 'Impuesto al Valor Agregado', 'CRE', 'Crédito Fiscal', '21%', 'IVA 21% - Tasa General'),
    ('IVA', 'Impuesto al Valor Agregado', 'CRE', 'Crédito Fiscal', '10.5%', 'IVA 10.5% - Tasa Reducida'),
    ('IVA', 'Impuesto al Valor Agregado', 'CRE', 'Crédito Fiscal', '27%', 'IVA 27% - Tasa Diferencial'),
    ('IVA', 'Impuesto al Valor Agregado', 'RET', 'Retenciones', 'SUF', 'Retención IVA Sufrida'),
    ('IVA', 'Impuesto al Valor Agregado', 'PER', 'Percepciones', 'SUF', 'Percepción IVA Sufrida'),
    ('GAN', 'Impuesto a las Ganancias', 'ANT', 'Anticipos', 'ANT', 'Anticipo de Ganancias'),
    ('GAN', 'Impuesto a las Ganancias', 'RET', 'Retenciones', 'SUF', 'Retención Ganancias Sufrida'),
    ('GAN', 'Impuesto a las Ganancias', 'SAL', 'Saldo', 'PAG', 'Saldo a Pagar'),
    ('IIBB', 'Ingresos Brutos', 'RET', 'Retenciones', 'SUF', 'Retención IIBB Sufrida'),
    ('IIBB', 'Ingresos Brutos', 'PER', 'Percepciones', 'SUF', 'Percepción IIBB Sufrida'),
    ('IIBB', 'Ingresos Brutos', 'ANT', 'Anticipos', 'ANT', 'Anticipo IIBB'),
    ('SEG', 'Seguridad Social', 'CON', 'Contribuciones', 'PAT', 'Contribución Patronal'),
    ('SEG', 'Seguridad Social', 'APO', 'Aportes', 'TRA', 'Aporte Trabajadores')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- Para verificar los datos insertados:
-- SELECT * FROM impuestos_base ORDER BY codigo_impuesto, codigo_concepto, codigo_subconcepto;
