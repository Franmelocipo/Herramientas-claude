# 📋 Sistema de Gestión de Comprobantes

Sistema web para la carga y gestión de comprobantes de clientes remotos del estudio contable, con integración a Supabase.

## 📖 Descripción

Esta aplicación permite a los clientes del estudio subir comprobantes (facturas, recibos, etc.) de forma segura, y al personal del estudio vincular esos comprobantes con registros contables, gestionar órdenes de pago, y visualizar reportes.

## 🎯 Características Principales

### Para Clientes
- ✅ Subir comprobantes (PDF/imágenes)
- ✅ Ver historial de comprobantes subidos
- ✅ Consultar estado de órdenes de pago
- ✅ Acceso limitado solo a sus propios datos

### Para Personal del Estudio
- ✅ Gestión de períodos contables (apertura/cierre)
- 🚧 Vinculación de comprobantes con registros contables
- 🚧 Cálculo automático de retenciones RG 830
- 🚧 Creación y gestión de órdenes de pago
- 🚧 Dashboard con estadísticas y reportes
- ✅ Acceso completo a todos los clientes

## 🗄️ Base de Datos

### Tablas Principales

#### `usuarios`
Gestión de usuarios del sistema con diferentes roles.

#### `periods`
Períodos contables mensuales por cliente. Controla cuándo los clientes pueden subir comprobantes.

#### `comprobantes`
Comprobantes subidos por los clientes con toda su información fiscal.

#### `registros_contables`
Registros provenientes de SOS Contador u otros sistemas contables.

#### `ordenes_pago`
Órdenes de pago generadas desde comprobantes vinculados.

#### `codigos_retencion`
Códigos de retención según RG 830 de AFIP.

#### `escalas_retencion`
Escalas progresivas para códigos que lo requieren (110, 119, etc.)

## 🚀 Instalación

### 1. Configurar Supabase

**A. Crear el proyecto en Supabase**
1. Ve a [Supabase](https://supabase.com/)
2. Crea un nuevo proyecto
3. Espera a que se provisione

**B. Ejecutar el script SQL**
1. Ve a **SQL Editor** en el dashboard de Supabase
2. Abre el archivo `supabase-schema-comprobantes.sql` de la raíz del proyecto
3. Copia todo el contenido
4. Pégalo en el SQL Editor y ejecuta

**C. Configurar Storage**
1. Ve a **Storage** en el dashboard
2. Crea un nuevo bucket llamado `comprobantes`
3. Configura como **privado** (no público)
4. Ve a **Policies** del bucket y crea las políticas de acceso:

```sql
-- Política: Clientes suben a su carpeta
CREATE POLICY "Clientes suben a su carpeta"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprobantes' AND
  (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
);

-- Política: Personal sube a cualquier carpeta
CREATE POLICY "Personal sube a cualquier carpeta"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprobantes' AND
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);

-- Política: Clientes leen sus archivos
CREATE POLICY "Clientes leen sus archivos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes' AND
  (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM usuarios
    WHERE id = auth.uid() AND rol = 'cliente'
  )
);

-- Política: Personal lee todos los archivos
CREATE POLICY "Personal lee todos los archivos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes' AND
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('personal_estudio', 'admin')
  )
);
```

**D. Actualizar credenciales**

Edita el archivo `supabase-config.js` en la raíz del proyecto con tus credenciales:

```javascript
const SUPABASE_CONFIG = {
    url: 'TU_SUPABASE_URL',
    anonKey: 'TU_SUPABASE_ANON_KEY'
};
```

Puedes encontrar estas credenciales en **Project Settings > API** de tu proyecto Supabase.

### 2. Datos Iniciales

#### Crear un Cliente de Prueba

```sql
INSERT INTO clients (nombre, cuit, activo) VALUES
('Cliente de Prueba S.A.', '30-12345678-9', true);
```

#### Crear un Usuario Cliente

```sql
-- Primero obtén el ID del cliente creado
SELECT id FROM clients WHERE nombre = 'Cliente de Prueba S.A.';

-- Luego crea el usuario
INSERT INTO usuarios (email, nombre, rol, client_id, activo) VALUES
('cliente@ejemplo.com', 'Juan Pérez', 'cliente', 'ID_DEL_CLIENTE_AQUI', true);
```

#### Crear un Usuario del Estudio

```sql
INSERT INTO usuarios (email, nombre, rol, activo) VALUES
('estudio@ejemplo.com', 'María González', 'personal_estudio', true);
```

#### Abrir un Período para el Cliente

```sql
INSERT INTO periods (client_id, year, month, estado) VALUES
('ID_DEL_CLIENTE_AQUI', 2024, 11, 'abierto');
```

### 3. Acceder a la Aplicación

1. Abre el archivo `index.html` en tu navegador desde la raíz del proyecto
2. Inicia sesión con las credenciales configuradas en `login.html`
3. Navega a **Gestión de Comprobantes** en el menú
4. ¡Listo! Ya puedes usar la aplicación

## 📁 Estructura del Proyecto

```
gestion-comprobantes/
├── index.html                  # Página principal con navegación
├── styles.css                  # Estilos globales
├── script.js                   # Lógica principal y navegación
├── lib/
│   ├── utils.js               # Utilidades generales
│   ├── retenciones.js         # Cálculo de retenciones RG 830
│   └── supabase-helper.js     # Funciones helper para Supabase
├── cliente/                    # Vistas del cliente (futuro)
│   ├── subir-comprobantes.html
│   └── mis-comprobantes.html
├── estudio/                    # Vistas del estudio (futuro)
│   ├── periodos.html
│   ├── vinculacion.html
│   ├── ordenes-pago.html
│   └── reportes.html
└── README.md                   # Este archivo
```

## 🔐 Roles y Permisos

### Cliente
- ✅ Ver solo sus propios datos
- ✅ Subir comprobantes a períodos abiertos
- ✅ Ver sus comprobantes y órdenes de pago
- ❌ No puede modificar ni eliminar comprobantes
- ❌ No puede ver otros clientes

### Personal del Estudio
- ✅ Ver todos los clientes
- ✅ Gestionar períodos (abrir/cerrar)
- ✅ Vincular comprobantes con registros
- ✅ Crear y aprobar órdenes de pago
- ✅ Acceso a reportes y estadísticas

### Admin
- ✅ Todos los permisos de Personal del Estudio
- ✅ Gestión de usuarios
- ✅ Configuración del sistema

## 💡 Uso

### Como Cliente

#### 1. Subir un Comprobante

1. Ve a **Subir Comprobantes**
2. Selecciona el **Período** correspondiente
3. Arrastra o selecciona el archivo (PDF/JPG/PNG, máx 10MB)
4. Completa los datos:
   - Tipo de comprobante
   - Número de comprobante
   - Fecha
   - Proveedor y CUIT
   - Monto total
   - Concepto/Descripción
5. Click en **Subir Comprobante**
6. ¡Listo! El comprobante quedará como "Pendiente" hasta que el estudio lo vincule

#### 2. Ver Mis Comprobantes

1. Ve a **Mis Comprobantes**
2. Verás el listado completo con:
   - Fecha y proveedor
   - Monto
   - Estado (Pendiente/Vinculado)
   - Botón para ver el archivo

#### 3. Consultar Órdenes de Pago

1. Ve a **Órdenes de Pago**
2. Verás todas tus órdenes con su estado:
   - Pendiente: Esperando aprobación
   - Aprobada: Aprobada para pago
   - Pagada: Ya fue ejecutada
   - Rechazada: Rechazada por el estudio

### Como Personal del Estudio

#### 1. Gestionar Períodos

1. Ve a **Períodos**
2. **Abrir un período:**
   - Click en "Nuevo Período"
   - Selecciona cliente, año y mes
   - Click en "Abrir"
3. **Cerrar un período:**
   - Click en "Cerrar" junto al período
   - Confirma el cierre
   - Los clientes ya no podrán subir comprobantes a ese período

#### 2. Vincular Comprobantes (En desarrollo)

1. Ve a **Vinculación**
2. Panel izquierdo: Comprobantes sin vincular
3. Panel derecho: Registros contables sin comprobante
4. Selecciona uno de cada lado
5. Click en **Vincular**

#### 3. Gestionar Órdenes de Pago (En desarrollo)

1. Ve a **Órdenes de Pago**
2. **Crear orden:**
   - Desde un comprobante vinculado
   - Completa beneficiario, monto, vencimiento
3. **Aprobar/Rechazar:**
   - Click en acción correspondiente
   - Si rechazas, indica el motivo
4. **Registrar pago:**
   - Una vez aprobada, click en "Registrar Pago"
   - Completa método, referencia y fecha

## 🧮 Retenciones RG 830

El sistema incluye cálculo automático de retenciones de ganancias según RG 830.

### Códigos Precargados

El sistema viene con los siguientes códigos:

- **19**: Intereses por operaciones financieras (3%/10%)
- **21**: Intereses diversos (6%/28%)
- **30**: Alquiler de muebles (6%/28%)
- **31**: Alquiler inmuebles urbanos (6%/28%)
- **32**: Alquiler inmuebles rurales (6%/28%)
- **35**: Regalías (6%/28%)
- **78**: Venta de bienes (2%/10%)
- **94**: Servicios profesionales (2%/28%)
- **95**: Transporte de carga (0.25%/28%)
- **110**: Rentas de 3ra categoría (escala progresiva)
- **119**: Profesiones liberales (escala progresiva)

### Cómo Funciona

1. Al cargar un comprobante, el cliente indica si corresponde retención
2. Selecciona el código de régimen
3. Indica si el proveedor es inscripto o no inscripto
4. El sistema calcula automáticamente:
   - Si supera el mínimo no sujeto
   - El monto de retención
   - Aplica escalas progresivas si corresponde

## 🔧 Desarrollo

### Agregar Nuevos Códigos de Retención

```sql
INSERT INTO codigos_retencion
(codigo, concepto, alicuota_inscripto, alicuota_no_inscripto, monto_minimo_inscripto, tiene_escala)
VALUES
('CODIGO', 'Concepto', 6.00, 28.00, 11200, false);
```

### Agregar Escalas Progresivas

```sql
-- Para códigos con escala progresiva
INSERT INTO escalas_retencion
(codigo_retencion_id, desde, hasta, alicuota, fijo, excedente_sobre, orden)
SELECT id, 0, 20000, 2.00, 0, 0, 1 FROM codigos_retencion WHERE codigo = 'CODIGO'
UNION ALL
SELECT id, 20000, 100000, 6.00, 400, 20000, 2 FROM codigos_retencion WHERE codigo = 'CODIGO'
UNION ALL
SELECT id, 100000, NULL, 10.00, 5200, 100000, 3 FROM codigos_retencion WHERE codigo = 'CODIGO';
```

## 📊 Reportes y Estadísticas (En desarrollo)

El sistema incluirá:

- **Dashboard General:**
  - Total de comprobantes cargados
  - Comprobantes pendientes de vinculación
  - Monto total de gastos
  - Órdenes de pago pendientes

- **Gastos por Concepto:**
  - Gráfico de torta/barras
  - Agrupado por concepto

- **Retenciones:**
  - Total retenido
  - Desglose por tipo
  - Listado de comprobantes con retención

## ⚙️ Configuración Avanzada

### Modificar Límites de Archivos

En `lib/utils.js`:

```javascript
function validarArchivoComprobante(file) {
    const maxSize = 10 * 1024 * 1024; // Cambiar aquí (en bytes)
    // ...
}
```

### Personalizar Formatos Permitidos

En `cliente/subir-comprobantes.html`:

```html
<input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp" />
```

Y en `lib/utils.js`:

```javascript
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/webp'];
```

## 🐛 Solución de Problemas

### Error: "No se puede conectar a Supabase"

1. Verifica que las credenciales en `supabase-config.js` sean correctas
2. Revisa que el proyecto de Supabase esté activo
3. Abre la consola del navegador (F12) para ver errores detallados

### Error: "No hay períodos abiertos"

1. Verifica que exista al menos un período abierto para el cliente
2. Ejecuta:
   ```sql
   SELECT * FROM periods WHERE client_id = 'TU_CLIENT_ID' AND estado = 'abierto';
   ```
3. Si no existe, créalo desde la interfaz de Personal del Estudio o manualmente

### Error al subir archivo

1. Verifica que el bucket `comprobantes` exista en Supabase Storage
2. Revisa que las policies estén configuradas correctamente
3. Comprueba que el archivo no supere los 10MB
4. Verifica que el formato sea JPG, PNG o PDF

### Los comprobantes no se muestran

1. Verifica que el usuario tenga el `client_id` correcto
2. Revisa las policies RLS en la tabla `comprobantes`
3. Abre la consola y busca errores de permisos

## 🔒 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

- Los clientes solo ven sus propios datos
- El personal del estudio ve todos los datos
- Las policies se aplican automáticamente en cada query

### Almacenamiento de Archivos

- Los archivos se guardan en carpetas por cliente: `/{client_id}/{year}/{month}/`
- Solo el cliente propietario y el personal pueden acceder
- Los nombres de archivo se generan únicos para evitar colisiones

## 🚀 Próximas Funcionalidades

### FASE 2 (Implementación Pendiente)
- [ ] Vista completa de Vinculación de comprobantes
- [ ] Interfaz de Cálculo de retenciones RG 830
- [ ] Gestión completa de Órdenes de Pago
- [ ] Dashboard con estadísticas en tiempo real
- [ ] Gestión de Períodos (interfaz completa)

### FASE 3 (Futuro)
- [ ] Integración con API de SOS Contador
- [ ] Exportación a Excel de reportes
- [ ] Notificaciones por email
- [ ] Historial de cambios y auditoría
- [ ] Comentarios en comprobantes
- [ ] Búsqueda avanzada y filtros
- [ ] Vista mobile responsive mejorada
- [ ] Modo oscuro

## 📞 Soporte

Para reportar bugs o solicitar funcionalidades, contacta al equipo de desarrollo del estudio.

## 📄 Licencia

Uso interno del estudio contable.

---

**Desarrollado con Claude Code** 🤖
**Versión:** 1.0.0 (MVP)
**Última actualización:** Noviembre 2024
