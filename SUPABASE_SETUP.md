# Configuración de Supabase para Herramientas Contables

## 📋 Resumen

Este documento explica cómo configurar las tablas de Supabase para que los botones del menú superior (Clientes, Impuestos, Almacenamiento) funcionen correctamente.

## 🚀 Pasos de Configuración

### 1. Acceder a Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión con tu cuenta
3. Accede a tu proyecto (el que tiene la URL `wnpjvnmyfkgtpwqnbmxa.supabase.co`)

### 2. Crear las Tablas

1. En el panel izquierdo, haz clic en **SQL Editor**
2. Haz clic en **+ New query**
3. Copia y pega el contenido completo del archivo `supabase-schema.sql`
4. Haz clic en **Run** (o presiona `Ctrl + Enter`)

El script creará automáticamente:
- ✅ Tabla `shared_clients` - Para almacenar clientes compartidos
- ✅ Tabla `tax_obligations` - Para obligaciones impositivas
- ✅ Tabla `tax_database` - Para la base de datos de impuestos
- ✅ Índices para búsqueda rápida
- ✅ Políticas de seguridad (RLS)
- ✅ Funciones auxiliares

### 3. Verificar la Configuración

Para verificar que todo se creó correctamente:

1. En el SQL Editor, ejecuta:
```sql
SELECT * FROM get_storage_stats();
```

2. Deberías ver las tres tablas con 0 registros inicialmente:
   - `shared_clients`
   - `tax_obligations`
   - `tax_database`

3. También puedes ir a **Table Editor** en el panel izquierdo y verificar que las tablas existen.

### 4. Verificar la Configuración en la Aplicación

1. Abre la aplicación web en tu navegador
2. Abre la consola del navegador (F12)
3. Deberías ver el mensaje: `✅ Supabase initialized successfully`
4. Si hay errores, verifica que las credenciales en `supabase-config.js` sean correctas

## 📊 Funcionalidades Implementadas

### Modal de Clientes (👥)
- ✅ Ver lista de clientes desde Supabase
- ✅ Crear nuevos clientes
- ✅ Eliminar clientes (soft delete)
- ✅ Importar clientes desde Excel
- ✅ Importar planes de cuentas por cliente
- ✅ Búsqueda de clientes por nombre o CUIT
- ✅ Contador actualizado dinámicamente

### Modal de Impuestos (📊)
- ✅ Ver base de datos de impuestos desde Supabase
- ✅ Importar base de datos desde Excel (Impuesto | Concepto | Subconcepto)
- ✅ Limpiar base de datos
- ✅ Vista previa de primeros 50 registros
- ✅ Contador actualizado dinámicamente

### Modal de Almacenamiento (💾)
- ✅ Ver estadísticas de localStorage
- ✅ Ver estadísticas de Supabase (tablas, registros, tamaño)
- ✅ Comparación lado a lado
- ✅ Actualización en tiempo real

## 🔄 Sincronización

La aplicación funciona de la siguiente manera:

1. **Con Supabase conectado**: Los datos se guardan y leen desde la nube
2. **Sin Supabase**: Funciona con localStorage como respaldo
3. **Sincronización automática**: Al cargar la página, se sincronizan los contadores

## 🎨 Mejoras de UI

### Tarjetas Reducidas
Las tarjetas de herramientas se redujeron aproximadamente un 35%:
- Padding: 24px → 16px
- Icono: 48px → 32px
- Título: 20px → 15px
- Texto: 14px → 12px
- Features: 13px → 11px

Esto permite ver más contenido en la pantalla sin necesidad de scroll.

## 🔧 Resolución de Problemas

### Error: "Table does not exist"
**Solución**: Ejecuta el archivo `supabase-schema.sql` en el SQL Editor de Supabase.

### Error: "Permission denied"
**Solución**: Verifica que las políticas RLS estén creadas correctamente. Ejecuta:
```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### Los contadores muestran 0
**Solución**:
1. Verifica que Supabase esté inicializado (consola del navegador)
2. Verifica que las tablas existan
3. Intenta crear un cliente de prueba

### No se conecta a Supabase
**Solución**:
1. Verifica las credenciales en `supabase-config.js`
2. Verifica que el CDN de Supabase esté cargado en `index.html`
3. Revisa la consola del navegador para errores

## 📝 Formato de Archivos Excel

### Para Importar Clientes
```
Columna A: Razón Social
Columna B: CUIT (opcional)
```

### Para Importar Planes de Cuentas
```
Columna A: Código de Cuenta
Columna B: Descripción de Cuenta
```

### Para Importar Base de Impuestos
```
Columna A: Impuesto
Columna B: Concepto
Columna C: Subconcepto
```

## 🎯 Próximos Pasos

Una vez configuradas las tablas:

1. ✅ Crear algunos clientes de prueba
2. ✅ Importar una base de impuestos (si tienes el Excel)
3. ✅ Verificar que los contadores se actualicen
4. ✅ Probar la funcionalidad de búsqueda
5. ✅ Importar planes de cuentas para tus clientes

## 🆘 Soporte

Si tienes problemas con la configuración:

1. Revisa la consola del navegador (F12)
2. Revisa los logs de Supabase (Table Editor → Logs)
3. Verifica que el script SQL se ejecutó sin errores

---

**¡Listo!** Ahora tus botones del menú superior funcionarán correctamente con persistencia en la nube.
