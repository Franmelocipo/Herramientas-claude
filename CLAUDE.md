# Instrucciones para Claude Code - Herramientas Claude

## Reglas de Desarrollo

### Almacenamiento de Datos

**IMPORTANTE: NUNCA usar localStorage para guardar datos.**

- Todos los datos deben guardarse en **Supabase**
- Esta aplicación está diseñada para usarse desde diferentes PCs
- localStorage es local al navegador y no se sincroniza entre dispositivos
- Si Supabase no tiene las columnas necesarias, mostrar un mensaje al usuario con el SQL para agregarlas

### Base de Datos

- La conexión a Supabase está en `script.js` como `window.supabaseDB`
- Antes de agregar nuevos campos, verificar si existen en la tabla de Supabase
- Si se necesitan nuevas columnas, documentar el SQL de migración en la consola y mostrar notificación al usuario

### Estructura del Proyecto

- `/herramientas/` - Contiene las diferentes herramientas de auditoría
- `/herramientas/auditoria/` - Herramienta de análisis de mayores contables
- Cada herramienta tiene su propio HTML, JS y CSS

### Convenciones de Código

- Usar español para nombres de variables y funciones relacionadas con el negocio
- Usar `mostrarNotificacion(mensaje, tipo)` para feedback al usuario
- Los tipos de notificación son: 'success', 'error', 'warning', 'info'
- Formatear moneda con `formatearMoneda(valor)`
- Formatear fecha con `formatearFecha(fecha)`

### Tablas de Supabase Relevantes

- `clientes` - Lista de clientes
- `conciliaciones_mayor` - Conciliaciones de mayores contables guardadas
- `categorias` - Categorías de clientes
