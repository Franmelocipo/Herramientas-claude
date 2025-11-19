# 🚀 INSTRUCCIONES DE CONFIGURACIÓN - Supabase

## ⚠️ IMPORTANTE: Sigue estos pasos en orden

### PASO 1: Verificar Credenciales de Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión y accede a tu proyecto
3. En el menú izquierdo, ve a **Settings** → **API**
4. Copia las siguientes credenciales:
   - **Project URL**: `https://wnpjvnmyfkgtpwqnbmxa.supabase.co`
   - **anon public key**: La clave que comienza con `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

5. **⚠️ VERIFICA**: La `anon public key` debe tener exactamente 3 partes separadas por puntos:
   ```
   parte1.parte2.parte3
   ```
   Si la clave que te di está mal, cópiala directamente desde Supabase.

6. Actualiza el archivo `.env.local` con la clave correcta si es necesario.

---

### PASO 2: Crear la Tabla "clientes" en Supabase

1. En Supabase, ve a **SQL Editor** (menú izquierdo)
2. Haz clic en **+ New query**
3. Abre el archivo `supabase-clientes-schema.sql` de este proyecto
4. Copia **TODO** el contenido del archivo
5. Pégalo en el SQL Editor de Supabase
6. Haz clic en **Run** (o presiona `Ctrl + Enter`)

**✅ Deberías ver**: "Success. No rows returned"

**❌ Si ves errores**:
- Lee el mensaje de error
- Verifica que no tengas una tabla "clientes" ya creada
- Si existe, puedes eliminarla con: `DROP TABLE IF EXISTS clientes CASCADE;` y volver a ejecutar el script

---

### PASO 3: Verificar que la Tabla se Creó Correctamente

En el SQL Editor, ejecuta:

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clientes';

-- Ver políticas RLS
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'clientes';
```

**✅ Deberías ver**:
- 9 columnas: id, nombre, cuit, direccion, email, telefono, tipo_societario, created_at, updated_at
- 4 políticas RLS (lectura, inserción, actualización, eliminación)

---

### PASO 4: Probar la Conexión desde la Aplicación

1. Abre tu aplicación web en el navegador
2. Abre la **Consola del Navegador** (F12)
3. Busca en la consola estos mensajes:
   ```
   ✅ Supabase initialized successfully
   🔄 Sincronizando con Supabase...
   ```

**✅ Si ves esos mensajes**: ¡Perfecto! Supabase está conectado.

**❌ Si ves errores**:
- Copia el mensaje de error completo
- Verifica las credenciales en `supabase-config.js`
- Verifica que la tabla "clientes" exista en Supabase

---

### PASO 5: Crear un Cliente de Prueba

1. En la aplicación web, haz clic en el botón **👥 Clientes** (arriba a la derecha)
2. Haz clic en **+ Nuevo Cliente**
3. Escribe:
   - **Razón Social**: "Cliente de Prueba"
   - **CUIT**: "20-12345678-9" (opcional)
4. Haz clic en **Crear**

**✅ Si funciona**:
- Verás un mensaje: "Cliente creado exitosamente en Supabase"
- El cliente aparecerá en la lista
- El contador mostrará "1"

**❌ Si falla**:
- Abre la consola del navegador (F12)
- Busca mensajes con ❌ que muestren detalles del error
- Copia TODO el error y envíamelo

**Los logs mostrarán algo como**:
```
📝 [createSupabaseClient] Creando cliente: {name: "Cliente de Prueba", cuit: "20-12345678-9"}
📤 [createSupabaseClient] Datos a insertar: {nombre: "Cliente de Prueba", cuit: "20-12345678-9", ...}
✅ [createSupabaseClient] Cliente creado exitosamente: {id: 1, nombre: "Cliente de Prueba", ...}
```

---

### PASO 6: Verificar en Supabase

1. Ve a **Table Editor** en Supabase (menú izquierdo)
2. Selecciona la tabla **clientes**
3. Deberías ver tu cliente de prueba en la tabla

---

## 🔍 DEBUGGING - Si algo falla

### Error: "relation 'clientes' does not exist"
**Solución**: La tabla no existe. Vuelve al PASO 2 y ejecuta el script SQL.

### Error: "JWT expired" o "Invalid API key"
**Solución**: La `anon public key` está mal o expirada. Vuelve al PASO 1 y copia la clave correcta desde Supabase.

### Error: "permission denied for table clientes"
**Solución**: Las políticas RLS no están configuradas. Ejecuta nuevamente el script SQL completo.

### Error: "No se pudo crear el cliente en Supabase"
**Solución**:
1. Abre la consola del navegador (F12)
2. Busca mensajes con ❌
3. Copia el error completo y envíamelo

---

## 📋 CHECKLIST DE VERIFICACIÓN

Marca cada paso cuando esté completo:

- [ ] Credenciales de Supabase verificadas y correctas
- [ ] Archivo `.env.local` actualizado (opcional, solo si usas variables de entorno)
- [ ] Script SQL `supabase-clientes-schema.sql` ejecutado exitosamente
- [ ] Tabla "clientes" creada en Supabase
- [ ] Políticas RLS configuradas (4 políticas)
- [ ] Aplicación muestra mensaje "✅ Supabase initialized successfully"
- [ ] Contador de clientes muestra "0" inicialmente
- [ ] Cliente de prueba creado exitosamente
- [ ] Contador de clientes actualizado a "1"
- [ ] Cliente visible en Table Editor de Supabase

---

## 🎯 PRÓXIMOS PASOS

Una vez que todo funcione:

1. ✅ Prueba crear varios clientes
2. ✅ Prueba editar un cliente
3. ✅ Prueba eliminar un cliente
4. ✅ Prueba la búsqueda de clientes
5. ✅ Importa clientes desde Excel
6. ✅ Verifica que el modal de Almacenamiento muestre las estadísticas de Supabase

---

## 🆘 ¿NECESITAS AYUDA?

Si algo no funciona:

1. Copia los mensajes de error de la consola del navegador
2. Toma una captura de pantalla si es necesario
3. Envíame la información y te ayudaré a solucionarlo

**Logs importantes a buscar en la consola**:
- Todos los mensajes que empiezan con ❌
- Mensajes de Supabase con errores
- El objeto de error completo con `message`, `details`, `hint`, y `code`
