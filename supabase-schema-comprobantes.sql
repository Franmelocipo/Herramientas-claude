-- =====================================================
-- SCHEMA COMPLETO PARA SISTEMA DE GESTIÓN DE COMPROBANTES
-- Herramientas Contables - Claude Tools
-- =====================================================
-- Este script debe ejecutarse en el SQL Editor de Supabase
-- =====================================================

-- =====================================================
-- EXTENSIONES NECESARIAS
-- =====================================================
-- Verificar que uuid-ossp esté habilitado (normalmente viene por defecto)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: usuarios
-- Gestión de usuarios del sistema (clientes y personal del estudio)
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('cliente', 'personal_estudio', 'admin')),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- Solo para rol 'cliente'
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_cliente_requiere_client_id CHECK (
        (rol = 'cliente' AND client_id IS NOT NULL) OR
        (rol IN ('personal_estudio', 'admin'))
    )
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_client ON usuarios(client_id);

COMMENT ON TABLE usuarios IS 'Usuarios del sistema con diferentes roles de acceso';
COMMENT ON COLUMN usuarios.rol IS 'cliente: acceso limitado | personal_estudio: acceso completo | admin: gestión de usuarios';

-- =====================================================
-- TABLA: periods
-- Gestión de períodos contables por cliente
-- =====================================================
CREATE TABLE IF NOT EXISTS periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    cerrado_por UUID REFERENCES usuarios(id),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, year, month)
);

CREATE INDEX idx_periods_client ON periods(client_id);
CREATE INDEX idx_periods_estado ON periods(estado);
CREATE INDEX idx_periods_year_month ON periods(year, month);
CREATE INDEX idx_periods_client_estado ON periods(client_id, estado);

COMMENT ON TABLE periods IS 'Períodos contables mensuales por cliente';
COMMENT ON COLUMN periods.estado IS 'abierto: permite carga de comprobantes | cerrado: no permite carga';

-- =====================================================
-- TABLA: codigos_retencion
-- Códigos de retención según RG 830 de AFIP
-- =====================================================
CREATE TABLE IF NOT EXISTS codigos_retencion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    concepto TEXT NOT NULL,
    alicuota_inscripto DECIMAL(5,2),
    alicuota_no_inscripto DECIMAL(5,2),
    monto_minimo_inscripto DECIMAL(15,2) DEFAULT 0,
    monto_minimo_no_inscripto DECIMAL(15,2) DEFAULT 0,
    retencion_minima DECIMAL(15,2) DEFAULT 0,
    tiene_escala BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_codigos_retencion_codigo ON codigos_retencion(codigo);
CREATE INDEX idx_codigos_retencion_activo ON codigos_retencion(activo);

COMMENT ON TABLE codigos_retencion IS 'Códigos de retención de ganancias según RG 830';
COMMENT ON COLUMN codigos_retencion.tiene_escala IS 'true si el código tiene escala progresiva';

-- =====================================================
-- TABLA: escalas_retencion
-- Escalas progresivas para ciertos códigos (25, 110, 116, 119)
-- =====================================================
CREATE TABLE IF NOT EXISTS escalas_retencion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_retencion_id UUID NOT NULL REFERENCES codigos_retencion(id) ON DELETE CASCADE,
    desde DECIMAL(15,2) NOT NULL,
    hasta DECIMAL(15,2),
    alicuota DECIMAL(5,2) NOT NULL,
    fijo DECIMAL(15,2) DEFAULT 0,
    excedente_sobre DECIMAL(15,2),
    orden INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_rango_valido CHECK (hasta IS NULL OR hasta > desde)
);

CREATE INDEX idx_escalas_codigo ON escalas_retencion(codigo_retencion_id);
CREATE INDEX idx_escalas_orden ON escalas_retencion(codigo_retencion_id, orden);

COMMENT ON TABLE escalas_retencion IS 'Escalas progresivas para códigos de retención que lo requieren';

-- =====================================================
-- TABLA: comprobantes
-- Comprobantes subidos por los clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS comprobantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,

    -- Información del archivo
    archivo_url TEXT NOT NULL,
    archivo_nombre TEXT NOT NULL,
    archivo_tipo TEXT,
    archivo_tamanio INTEGER,

    -- Datos del comprobante
    tipo_comprobante TEXT CHECK (tipo_comprobante IN (
        'factura_a', 'factura_b', 'factura_c', 'factura_e',
        'recibo', 'ticket', 'nota_credito', 'nota_debito', 'otro'
    )),
    numero_comprobante TEXT,
    fecha_comprobante DATE NOT NULL,
    proveedor TEXT NOT NULL,
    cuit_proveedor TEXT,
    monto_total DECIMAL(15,2) NOT NULL CHECK (monto_total >= 0),
    concepto TEXT,

    -- Estado y vinculación
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'vinculado', 'rechazado')),
    registro_contable_id UUID,
    vinculado_por UUID REFERENCES usuarios(id),
    fecha_vinculacion TIMESTAMP WITH TIME ZONE,
    motivo_rechazo TEXT,

    -- Retenciones
    tiene_retencion BOOLEAN DEFAULT false,
    codigo_retencion_id UUID REFERENCES codigos_retencion(id),
    condicion_proveedor TEXT CHECK (condicion_proveedor IN ('inscripto', 'no_inscripto', NULL)),
    monto_retencion DECIMAL(15,2) CHECK (monto_retencion >= 0),
    alicuota_retencion DECIMAL(5,2) CHECK (alicuota_retencion >= 0),
    base_calculo_retencion DECIMAL(15,2),

    -- Auditoría
    subido_por UUID NOT NULL REFERENCES usuarios(id),
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observaciones TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT check_retencion_completa CHECK (
        (tiene_retencion = false) OR
        (tiene_retencion = true AND codigo_retencion_id IS NOT NULL AND condicion_proveedor IS NOT NULL)
    )
);

CREATE INDEX idx_comprobantes_client ON comprobantes(client_id);
CREATE INDEX idx_comprobantes_period ON comprobantes(period_id);
CREATE INDEX idx_comprobantes_estado ON comprobantes(estado);
CREATE INDEX idx_comprobantes_fecha ON comprobantes(fecha_comprobante);
CREATE INDEX idx_comprobantes_registro ON comprobantes(registro_contable_id);
CREATE INDEX idx_comprobantes_proveedor ON comprobantes(proveedor);
CREATE INDEX idx_comprobantes_subido_por ON comprobantes(subido_por);

COMMENT ON TABLE comprobantes IS 'Comprobantes fiscales subidos por los clientes';
COMMENT ON COLUMN comprobantes.estado IS 'pendiente: sin vincular | vinculado: vinculado a registro contable | rechazado: rechazado por el estudio';

-- =====================================================
-- TABLA: registros_contables
-- Registros contables provenientes de SOS Contador u otros sistemas
-- =====================================================
CREATE TABLE IF NOT EXISTS registros_contables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,

    -- Identificación origen
    sistema_origen TEXT DEFAULT 'sos_contador' CHECK (sistema_origen IN ('sos_contador', 'manual', 'otro')),
    id_externo TEXT,

    -- Datos del registro
    fecha DATE NOT NULL,
    tipo_operacion TEXT,
    proveedor TEXT,
    cuit_proveedor TEXT,
    numero_comprobante TEXT,
    concepto TEXT,

    -- Importes
    importe_neto DECIMAL(15,2),
    iva DECIMAL(15,2),
    total DECIMAL(15,2) NOT NULL,

    -- Clasificación contable
    cuenta_contable TEXT,
    codigo_cuenta TEXT,
    centro_costo TEXT,

    -- Estado y vinculación
    tiene_comprobante BOOLEAN DEFAULT false,
    comprobante_id UUID REFERENCES comprobantes(id),
    vinculado_por UUID REFERENCES usuarios(id),
    fecha_vinculacion TIMESTAMP WITH TIME ZONE,

    -- Sincronización
    fecha_ultima_sync TIMESTAMP WITH TIME ZONE,

    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_registros_client ON registros_contables(client_id);
CREATE INDEX idx_registros_period ON registros_contables(period_id);
CREATE INDEX idx_registros_fecha ON registros_contables(fecha);
CREATE INDEX idx_registros_comprobante ON registros_contables(comprobante_id);
CREATE INDEX idx_registros_externo ON registros_contables(id_externo);
CREATE INDEX idx_registros_proveedor ON registros_contables(proveedor);
CREATE INDEX idx_registros_tiene_comprobante ON registros_contables(tiene_comprobante);

COMMENT ON TABLE registros_contables IS 'Registros contables del sistema (SOS Contador u otros)';

-- =====================================================
-- TABLA: ordenes_pago
-- Órdenes de pago generadas desde comprobantes
-- =====================================================
CREATE TABLE IF NOT EXISTS ordenes_pago (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    comprobante_id UUID REFERENCES comprobantes(id),

    -- Datos de la orden
    numero_orden TEXT UNIQUE NOT NULL,
    fecha_solicitud DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    monto DECIMAL(15,2) NOT NULL CHECK (monto > 0),

    -- Beneficiario
    beneficiario TEXT NOT NULL,
    cuit_beneficiario TEXT,
    cbu_beneficiario TEXT,

    -- Estado del flujo
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'pagada', 'cancelada')),

    -- Aprobación
    aprobada_por UUID REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    rechazada_por UUID REFERENCES usuarios(id),
    fecha_rechazo TIMESTAMP WITH TIME ZONE,
    motivo_rechazo TEXT,

    -- Ejecución del pago
    ejecutada_por UUID REFERENCES usuarios(id),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    metodo_pago TEXT CHECK (metodo_pago IN ('transferencia', 'cheque', 'efectivo', 'otro', NULL)),
    referencia_pago TEXT,

    -- Registro en SOS Contador
    registrado_en_sos BOOLEAN DEFAULT false,
    fecha_registro_sos TIMESTAMP WITH TIME ZONE,

    observaciones TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ordenes_client ON ordenes_pago(client_id);
CREATE INDEX idx_ordenes_comprobante ON ordenes_pago(comprobante_id);
CREATE INDEX idx_ordenes_estado ON ordenes_pago(estado);
CREATE INDEX idx_ordenes_numero ON ordenes_pago(numero_orden);
CREATE INDEX idx_ordenes_fecha_vencimiento ON ordenes_pago(fecha_vencimiento);
CREATE INDEX idx_ordenes_beneficiario ON ordenes_pago(beneficiario);

COMMENT ON TABLE ordenes_pago IS 'Órdenes de pago generadas desde comprobantes';
COMMENT ON COLUMN ordenes_pago.estado IS 'pendiente → aprobada/rechazada → pagada';

-- =====================================================
-- TRIGGERS PARA updated_at AUTOMÁTICO
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_periods_updated_at BEFORE UPDATE ON periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comprobantes_updated_at BEFORE UPDATE ON comprobantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registros_updated_at BEFORE UPDATE ON registros_contables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ordenes_updated_at BEFORE UPDATE ON ordenes_pago
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_retencion ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES PARA usuarios
-- =====================================================
-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Usuarios ven su propio perfil"
ON usuarios FOR SELECT
USING (id = auth.uid());

-- Personal del estudio y admin ven todos los usuarios
CREATE POLICY "Personal ve todos los usuarios"
ON usuarios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- Solo admin puede insertar/actualizar usuarios
CREATE POLICY "Solo admin gestiona usuarios"
ON usuarios FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  )
);

-- =====================================================
-- POLICIES PARA periods
-- =====================================================
-- Clientes ven solo sus períodos
CREATE POLICY "Clientes ven sus períodos"
ON periods FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
);

-- Personal del estudio ve todos los períodos
CREATE POLICY "Personal ve todos los períodos"
ON periods FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- Solo personal del estudio puede gestionar períodos
CREATE POLICY "Personal gestiona períodos"
ON periods FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- =====================================================
-- POLICIES PARA comprobantes
-- =====================================================
-- Clientes ven solo sus comprobantes
CREATE POLICY "Clientes ven sus comprobantes"
ON comprobantes FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
);

-- Personal del estudio ve todos los comprobantes
CREATE POLICY "Personal ve todos los comprobantes"
ON comprobantes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- Clientes solo pueden insertar comprobantes a sus períodos abiertos
CREATE POLICY "Clientes insertan en períodos abiertos"
ON comprobantes FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT client_id FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
  AND period_id IN (
    SELECT id FROM periods
    WHERE client_id = comprobantes.client_id
    AND estado = 'abierto'
  )
  AND subido_por = auth.uid()
);

-- Personal del estudio puede actualizar y eliminar comprobantes
CREATE POLICY "Personal gestiona comprobantes"
ON comprobantes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- =====================================================
-- POLICIES PARA registros_contables
-- =====================================================
-- Clientes no ven registros contables
-- Personal del estudio ve todos
CREATE POLICY "Personal ve registros contables"
ON registros_contables FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- =====================================================
-- POLICIES PARA ordenes_pago
-- =====================================================
-- Clientes ven solo sus órdenes
CREATE POLICY "Clientes ven sus órdenes"
ON ordenes_pago FOR SELECT
USING (
  client_id IN (
    SELECT client_id FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
);

-- Personal del estudio ve todas las órdenes
CREATE POLICY "Personal ve todas las órdenes"
ON ordenes_pago FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- Solo personal del estudio puede gestionar órdenes
CREATE POLICY "Personal gestiona órdenes"
ON ordenes_pago FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- =====================================================
-- POLICIES PARA codigos_retencion (lectura pública)
-- =====================================================
CREATE POLICY "Todos leen códigos de retención"
ON codigos_retencion FOR SELECT
USING (true);

-- Solo admin puede modificar códigos
CREATE POLICY "Solo admin modifica códigos"
ON codigos_retencion FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  )
);

-- =====================================================
-- DATOS INICIALES: Códigos de Retención RG 830
-- =====================================================
INSERT INTO codigos_retencion (codigo, concepto, alicuota_inscripto, alicuota_no_inscripto, monto_minimo_inscripto, monto_minimo_no_inscripto, retencion_minima, tiene_escala, observaciones) VALUES
('19', 'Intereses por operaciones realizadas en entidades financieras', 3.00, 10.00, 0, 0, 0, false, 'Código 19 - Operaciones financieras'),
('21', 'Intereses originados en operaciones no comprendidas en código 19', 6.00, 28.00, 7870, 7870, 0, false, 'Código 21 - Intereses diversos'),
('30', 'Alquileres o arrendamientos de bienes muebles', 6.00, 28.00, 11200, 11200, 0, false, 'Código 30 - Alquiler de muebles'),
('31', 'Bienes Inmuebles Urbanos (incluye suburbanos)', 6.00, 28.00, 11200, 11200, 0, false, 'Código 31 - Alquileres urbanos'),
('32', 'Bienes Inmuebles Rurales (incluye subrurales)', 6.00, 28.00, 11200, 11200, 0, false, 'Código 32 - Alquileres rurales'),
('35', 'Regalías', 6.00, 28.00, 7870, 7870, 0, false, 'Código 35 - Regalías'),
('78', 'Enajenación de bienes muebles y bienes de cambio', 2.00, 10.00, 224000, 224000, 0, false, 'Código 78 - Venta de bienes'),
('94', 'Locaciones de obra y/o servicios no ejecutados en relación de dependencia', 2.00, 28.00, 67170, 67170, 0, false, 'Código 94 - Servicios profesionales'),
('95', 'Operaciones de transporte de carga nacional e internacional', 0.25, 28.00, 67170, 67170, 0, false, 'Código 95 - Transporte de carga'),
('110', 'Rentas de tercera categoría - Régimen General', NULL, NULL, 160000, 160000, 0, true, 'Código 110 - Tiene escala progresiva'),
('119', 'Profesiones liberales, oficios y otras actividades independientes', NULL, NULL, 160000, 160000, 0, true, 'Código 119 - Tiene escala progresiva'),
('25', 'Actividades de bancos de inversión', NULL, NULL, 0, 0, 0, true, 'Código 25 - Tiene escala progresiva'),
('116', 'Rentas por exportaciones', NULL, NULL, 0, 0, 0, true, 'Código 116 - Tiene escala progresiva');

-- =====================================================
-- DATOS INICIALES: Escalas Progresivas
-- =====================================================
-- Escala para código 110 (Rentas de tercera categoría)
INSERT INTO escalas_retencion (codigo_retencion_id, desde, hasta, alicuota, fijo, excedente_sobre, orden)
SELECT id, 0, 20000, 2.00, 0, 0, 1 FROM codigos_retencion WHERE codigo = '110'
UNION ALL
SELECT id, 20000, 100000, 6.00, 400, 20000, 2 FROM codigos_retencion WHERE codigo = '110'
UNION ALL
SELECT id, 100000, NULL, 10.00, 5200, 100000, 3 FROM codigos_retencion WHERE codigo = '110';

-- Escala para código 119 (Profesiones liberales)
INSERT INTO escalas_retencion (codigo_retencion_id, desde, hasta, alicuota, fijo, excedente_sobre, orden)
SELECT id, 0, 30000, 2.00, 0, 0, 1 FROM codigos_retencion WHERE codigo = '119'
UNION ALL
SELECT id, 30000, 150000, 6.00, 600, 30000, 2 FROM codigos_retencion WHERE codigo = '119'
UNION ALL
SELECT id, 150000, NULL, 10.00, 7800, 150000, 3 FROM codigos_retencion WHERE codigo = '119';

-- =====================================================
-- CONFIGURACIÓN DE STORAGE
-- =====================================================
-- Ejecutar en el Dashboard de Supabase > Storage:
-- 1. Crear bucket 'comprobantes' (público: false)
-- 2. Agregar las siguientes policies:

-- POLICY: Clientes solo suben a su carpeta
-- CREATE POLICY "Clientes suben a su carpeta"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'comprobantes' AND
--   (storage.foldername(name))[1] IN (
--     SELECT client_id::text FROM usuarios
--     WHERE id = auth.uid() AND rol = 'cliente'
--   )
-- );

-- POLICY: Personal del estudio sube a cualquier carpeta
-- CREATE POLICY "Personal sube a cualquier carpeta"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'comprobantes' AND
--   EXISTS (
--     SELECT 1 FROM usuarios
--     WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
--   )
-- );

-- POLICY: Clientes solo leen sus archivos
-- CREATE POLICY "Clientes leen sus archivos"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'comprobantes' AND
--   (storage.foldername(name))[1] IN (
--     SELECT client_id::text FROM usuarios
--     WHERE id = auth.uid() AND rol = 'cliente'
--   )
-- );

-- POLICY: Personal lee todos los archivos
-- CREATE POLICY "Personal lee todos los archivos"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'comprobantes' AND
--   EXISTS (
--     SELECT 1 FROM usuarios
--     WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
--   )
-- );

-- =====================================================
-- FUNCIONES HELPER
-- =====================================================

-- Función para generar número de orden de pago correlativo
CREATE OR REPLACE FUNCTION generar_numero_orden()
RETURNS TEXT AS $$
DECLARE
    anio TEXT;
    correlativo INTEGER;
    numero_orden TEXT;
BEGIN
    anio := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero_orden FROM LENGTH(anio) + 2) AS INTEGER)
    ), 0) + 1
    INTO correlativo
    FROM ordenes_pago
    WHERE numero_orden LIKE anio || '-%';

    numero_orden := anio || '-' || LPAD(correlativo::TEXT, 6, '0');

    RETURN numero_orden;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_numero_orden IS 'Genera número correlativo de orden de pago formato YYYY-NNNNNN';

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Comprobantes con información relacionada
CREATE OR REPLACE VIEW v_comprobantes_completos AS
SELECT
    c.*,
    cl.nombre as nombre_cliente,
    cl.cuit as cuit_cliente,
    p.year || '-' || LPAD(p.month::TEXT, 2, '0') as periodo,
    p.estado as estado_periodo,
    cr.codigo as codigo_retencion,
    cr.concepto as concepto_retencion,
    u.nombre as nombre_subido_por,
    uv.nombre as nombre_vinculado_por
FROM comprobantes c
LEFT JOIN clients cl ON c.client_id = cl.id
LEFT JOIN periods p ON c.period_id = p.id
LEFT JOIN codigos_retencion cr ON c.codigo_retencion_id = cr.id
LEFT JOIN usuarios u ON c.subido_por = u.id
LEFT JOIN usuarios uv ON c.vinculado_por = uv.id;

COMMENT ON VIEW v_comprobantes_completos IS 'Vista completa de comprobantes con información relacionada';

-- Vista: Órdenes de pago con información relacionada
CREATE OR REPLACE VIEW v_ordenes_pago_completas AS
SELECT
    op.*,
    cl.nombre as nombre_cliente,
    cl.cuit as cuit_cliente,
    c.numero_comprobante,
    c.fecha_comprobante,
    ua.nombre as nombre_aprobada_por,
    ur.nombre as nombre_rechazada_por,
    ue.nombre as nombre_ejecutada_por
FROM ordenes_pago op
LEFT JOIN clients cl ON op.client_id = cl.id
LEFT JOIN comprobantes c ON op.comprobante_id = c.id
LEFT JOIN usuarios ua ON op.aprobada_por = ua.id
LEFT JOIN usuarios ur ON op.rechazada_por = ur.id
LEFT JOIN usuarios ue ON op.ejecutada_por = ue.id;

COMMENT ON VIEW v_ordenes_pago_completas IS 'Vista completa de órdenes de pago con información relacionada';

-- =====================================================
-- ÍNDICES DE TEXTO COMPLETO
-- =====================================================

-- Para búsquedas rápidas de proveedores
CREATE INDEX idx_comprobantes_proveedor_trgm ON comprobantes USING gin (proveedor gin_trgm_ops);
CREATE INDEX idx_registros_proveedor_trgm ON registros_contables USING gin (proveedor gin_trgm_ops);

-- Para búsquedas de conceptos
CREATE INDEX idx_comprobantes_concepto_trgm ON comprobantes USING gin (concepto gin_trgm_ops);

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- Verificar instalación
SELECT 'Schema de Gestión de Comprobantes creado exitosamente' AS status;
SELECT 'Total de códigos de retención: ' || COUNT(*)::TEXT FROM codigos_retencion;
SELECT 'Total de escalas de retención: ' || COUNT(*)::TEXT FROM escalas_retencion;
