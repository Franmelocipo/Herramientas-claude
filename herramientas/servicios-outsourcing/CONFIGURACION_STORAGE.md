# Configuración de Supabase Storage para Comprobantes

Este documento explica cómo configurar el bucket de Supabase Storage necesario para la funcionalidad de carga de comprobantes en el panel de cliente.

## Paso 1: Crear el Bucket

1. Accede al Dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **Storage** en el menú lateral
4. Haz clic en **"Create a new bucket"** o **"New bucket"**
5. Configura el bucket con los siguientes datos:
   - **Nombre:** `comprobantes`
   - **Public bucket:** ✅ Sí (marcar como público)
   - Haz clic en **"Create bucket"**

## Paso 2: Configurar Políticas de Acceso (RLS Policies)

Para que los usuarios puedan subir y ver sus comprobantes, necesitas configurar las políticas de seguridad:

### Política 1: Permitir INSERTAR archivos (Upload)

```sql
-- Nombre: "Los clientes pueden subir sus comprobantes"
-- Operación: INSERT
-- Política:
CREATE POLICY "Los clientes pueden subir sus comprobantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprobantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política 2: Permitir LEER archivos (Download)

```sql
-- Nombre: "Los clientes pueden ver sus comprobantes"
-- Operación: SELECT
-- Política:
CREATE POLICY "Los clientes pueden ver sus comprobantes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprobantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política 3: Permitir acceso público a archivos (Opcional - para URLs públicas)

Si configuraste el bucket como público, los archivos serán accesibles mediante URL pública automáticamente.

## Paso 3: Estructura de Carpetas

Los archivos se organizan automáticamente de la siguiente manera:

```
comprobantes/
  ├── [cliente_id_1]/
  │   ├── 1234567890_factura.pdf
  │   ├── 1234567891_recibo.pdf
  │   └── ...
  ├── [cliente_id_2]/
  │   ├── 1234567892_factura.pdf
  │   └── ...
  └── ...
```

Cada cliente tiene su propia carpeta identificada por su `cliente_id`, lo que garantiza la separación de datos.

## Paso 4: Verificar la Configuración

Para verificar que todo funciona correctamente:

1. Inicia sesión en el panel de cliente
2. Ve a **"Subir Comprobantes"**
3. Haz clic en **"Nuevo Comprobante"**
4. Selecciona un archivo PDF de prueba
5. Completa el formulario y haz clic en **"Subir"**

Si ves el mensaje "✅ Comprobante subido exitosamente", la configuración está correcta.

## Solución de Problemas

### Error: "Error al subir el archivo. Por favor, verifique que el bucket 'comprobantes' existe"

**Causa:** El bucket no existe o tiene un nombre diferente.

**Solución:** Verifica que el bucket se llame exactamente `comprobantes` (en minúsculas).

### Error: "new row violates row-level security policy"

**Causa:** Las políticas de RLS no están configuradas correctamente.

**Solución:** Revisa las políticas en el Paso 2 y asegúrate de que estén aplicadas.

### Los archivos no se ven en "Mis Comprobantes"

**Causa:** Puede ser un problema con la tabla `comprobantes` en la base de datos.

**Solución:** Verifica que la tabla `comprobantes` tenga los campos necesarios:
- `id` (uuid, primary key)
- `cliente_id` (uuid, foreign key a tabla clientes)
- `usuario_subio_id` (uuid, foreign key a usuarios_comprobantes)
- `archivo_url` (text)
- `archivo_nombre` (text)
- `tipo_comprobante` (text)
- `notas` (text, nullable)
- `estado` (text, default: 'pendiente')
- `fecha_subida` (timestamp, default: now())

## Límites y Consideraciones

- **Tamaño máximo de archivo:** 10MB (configurado en el código)
- **Formato permitido:** Solo archivos PDF
- **Almacenamiento:** Depende de tu plan de Supabase
  - Free tier: 1GB
  - Pro: 100GB
  - Enterprise: Ilimitado

## Seguridad

El sistema implementa las siguientes medidas de seguridad:

1. **Autenticación:** Solo usuarios autenticados pueden subir archivos
2. **Aislamiento:** Cada cliente solo puede acceder a sus propios archivos
3. **Validación:** Se valida el tipo y tamaño de archivo en el cliente
4. **Organización:** Los archivos se organizan por carpetas de cliente_id
5. **Nombres únicos:** Se usa timestamp para evitar sobrescritura de archivos

## Próximos Pasos

Una vez configurado el bucket, puedes:

1. Probar la funcionalidad de carga
2. Verificar que los comprobantes aparecen en "Mis Comprobantes"
3. Configurar notificaciones para el equipo cuando se suban nuevos comprobantes
4. Implementar procesamiento automático de PDFs (OCR, extracción de datos, etc.)
