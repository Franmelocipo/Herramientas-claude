-- Crear tabla plan_cuentas para gestionar planes de cuenta por cliente
CREATE TABLE IF NOT EXISTS plan_cuentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  cuenta VARCHAR(255) NOT NULL,
  tipo VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para mejorar performance de búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_plan_cuentas_cliente ON plan_cuentas(cliente_id);

-- Comentarios para documentación
COMMENT ON TABLE plan_cuentas IS 'Plan de cuentas contables por cliente';
COMMENT ON COLUMN plan_cuentas.cliente_id IS 'ID del cliente al que pertenece esta cuenta';
COMMENT ON COLUMN plan_cuentas.codigo IS 'Código de la cuenta contable (ej: 1.1.1.01)';
COMMENT ON COLUMN plan_cuentas.cuenta IS 'Descripción de la cuenta contable';
COMMENT ON COLUMN plan_cuentas.tipo IS 'Tipo de cuenta: Activo, Pasivo, Patrimonio Neto, Ingreso, Egreso';
