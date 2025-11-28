# Sistema de Gestión de Usuarios Externos

Sistema completo para la administración de usuarios externos (clientes) en el módulo de Gestión de Comprobantes.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Instalación](#instalación)
- [Roles de Usuario](#roles-de-usuario)
- [Flujos de Trabajo](#flujos-de-trabajo)
- [Gestión de Usuarios](#gestión-de-usuarios)
- [Seguridad](#seguridad)
- [Archivos del Sistema](#archivos-del-sistema)

---

## ✨ Características

### Para Administradores
- ✅ Crear usuarios externos con credenciales temporales
- ✅ Asignar clientes específicos a cada usuario
- ✅ Resetear contraseñas cuando sea necesario
- ✅ Editar información de usuarios
- ✅ Eliminar usuarios
- ✅ Ver lista completa de usuarios externos

### Para Usuarios Externos (Clientes)
- ✅ Cambio obligatorio de contraseña en el primer inicio de sesión
- ✅ Acceso restringido solo a información de su cliente asignado
- ✅ No pueden acceder a otras herramientas del estudio
- ✅ Redirección automática a su panel

---

## 🚀 Instalación

### 1. Ejecutar Script SQL

Primero, ejecuta el script SQL en el editor de SQL de Supabase:

```bash
herramientas/gestion-comprobantes/sql/03-agregar-requiere-cambio-password.sql
```

Este script:
- Agrega la columna `requiere_cambio_password` a la tabla `usuarios_comprobantes`
- Agrega la columna `activo` si no existe
- Crea índices para mejorar el rendimiento
- Actualiza usuarios existentes

### 2. Verificar Estructura

Verifica que la tabla `usuarios_comprobantes` tenga las siguientes columnas:
- `id` (UUID, PK)
- `email` (TEXT)
- `password` (TEXT)
- `rol` (TEXT: 'admin' o 'cliente')
- `nombre` (TEXT)
- `cliente_id` (UUID, FK a tabla clientes)
- `activo` (BOOLEAN)
- `requiere_cambio_password` (BOOLEAN)
- `created_at` (TIMESTAMP)

### 3. Archivos Implementados

Todos los archivos ya están en su lugar:
- ✅ `panel-usuarios.html` - Panel de gestión de usuarios
- ✅ `cambiar-password.html` - Cambio obligatorio de contraseña
- ✅ `auth.js` - Sistema de autenticación actualizado
- ✅ `panel-admin.html` - Con link a gestión de usuarios
- ✅ `panel-cliente.html` - Con filtrado por cliente_id
- ✅ `login.html` - Con verificación de cambio de password
- ✅ `check-auth.js` - Redirección automática de usuarios externos

---

## 👥 Roles de Usuario

### Admin
- Acceso completo a todas las herramientas
- Puede gestionar usuarios externos
- Ve información de todos los clientes
- Accede desde: `herramientas/gestion-comprobantes/login.html`

### Cliente (Usuario Externo)
- Acceso restringido solo a su panel
- Ve únicamente información de su cliente asignado
- Debe cambiar contraseña en el primer inicio de sesión
- Redirigido automáticamente si intenta acceder al index principal

---

## 🔄 Flujos de Trabajo

### Flujo 1: Crear Usuario Externo (Admin)

1. **Login como Admin**
   - Ir a: `herramientas/gestion-comprobantes/login.html`
   - Ingresar credenciales de admin

2. **Navegar a Gestión de Usuarios**
   - Desde el panel admin, click en "Gestión de Usuarios"
   - O ir directamente a: `panel-usuarios.html`

3. **Crear Nuevo Usuario**
   - Click en "Crear Nuevo Usuario"
   - Completar formulario:
     - **Usuario (Email)**: ej. `cliente1@ejemplo.com`
     - **Contraseña Temporal**: ej. `temp123` (mínimo 6 caracteres)
     - **Nombre Completo**: ej. `Juan Pérez`
     - **Cliente Asignado**: Seleccionar de la lista
   - Click en "Crear Usuario"

4. **Usuario Creado**
   - El usuario se crea con `requiere_cambio_password = TRUE`
   - Aparece en la lista de usuarios externos
   - Enviar credenciales al cliente

### Flujo 2: Primera Vez - Usuario Externo

1. **Recibir Credenciales**
   - El admin envía al cliente:
     - Usuario: `cliente1@ejemplo.com`
     - Contraseña temporal: `temp123`
     - URL: `herramientas/gestion-comprobantes/login.html`

2. **Primer Login**
   - Ir a: `herramientas/gestion-comprobantes/login.html`
   - Ingresar usuario y contraseña temporal
   - Click en "Iniciar Sesión"

3. **Cambio Obligatorio de Contraseña**
   - El sistema detecta `requiere_cambio_password = TRUE`
   - Redirige automáticamente a: `cambiar-password.html`
   - Mostrar formulario de cambio:
     - Contraseña actual (la temporal)
     - Nueva contraseña (mínimo 8 caracteres)
     - Confirmar nueva contraseña

4. **Contraseña Cambiada**
   - El sistema actualiza la contraseña
   - Marca `requiere_cambio_password = FALSE`
   - Redirige a: `panel-cliente.html`

5. **Acceso al Panel**
   - Usuario ve solo información de su cliente asignado
   - Los comprobantes se filtran automáticamente por `cliente_id`

### Flujo 3: Siguientes Inicios de Sesión

1. **Login Normal**
   - Ir a: `herramientas/gestion-comprobantes/login.html`
   - Ingresar usuario y nueva contraseña
   - Click en "Iniciar Sesión"

2. **Acceso Directo**
   - Como `requiere_cambio_password = FALSE`
   - Va directo a: `panel-cliente.html`
   - Ve solo información de su cliente

### Flujo 4: Restricción de Acceso

1. **Intento de Acceso al Index**
   - Si un usuario externo intenta acceder a: `/index.html`
   - El script `check-auth.js` detecta `rol = 'cliente'`
   - Redirige automáticamente a: `panel-cliente.html`

2. **Protección**
   - Los usuarios externos NO pueden:
     - Ver otras herramientas del estudio
     - Acceder a información de otros clientes
     - Modificar sus permisos

### Flujo 5: Resetear Contraseña (Admin)

1. **Admin en Panel de Usuarios**
   - Navegar a: `panel-usuarios.html`
   - Buscar el usuario en la lista

2. **Resetear**
   - Click en el ícono de llave (🔑) del usuario
   - Ingresar nueva contraseña temporal
   - Click en "Resetear Contraseña"

3. **Resultado**
   - Se actualiza la contraseña
   - Se marca `requiere_cambio_password = TRUE`
   - El usuario deberá cambiarla en su próximo login

---

## 🛠️ Gestión de Usuarios

### Panel de Gestión (`panel-usuarios.html`)

#### Crear Usuario
```
Campos obligatorios:
- Usuario (Email): Debe ser único
- Contraseña: Mínimo 6 caracteres
- Nombre: Nombre completo del usuario
- Cliente: Seleccionar de la lista de clientes
```

#### Editar Usuario
```
Campos editables:
- Email
- Nombre
- Cliente asignado

NO editable:
- Contraseña (usar "Resetear Contraseña")
```

#### Eliminar Usuario
```
1. Click en ícono de papelera (🗑️)
2. Confirmar eliminación
3. El usuario se elimina permanentemente
```

#### Resetear Contraseña
```
1. Click en ícono de llave (🔑)
2. Ingresar nueva contraseña temporal
3. El usuario deberá cambiarla en su próximo login
```

---

## 🔒 Seguridad

### Contraseñas
- **Primera vez**: Mínimo 6 caracteres (temporal)
- **Cambio obligatorio**: Mínimo 8 caracteres
- **Recomendación**: Usar mayúsculas, minúsculas y números
- **Almacenamiento**: Texto plano (⚠️ Considera usar bcrypt en producción)

### Restricciones de Acceso

#### Usuarios Externos (Cliente)
✅ **Pueden**:
- Acceder a su panel de cliente
- Ver comprobantes de su cliente asignado
- Cambiar su contraseña
- Cerrar sesión

❌ **NO pueden**:
- Ver información de otros clientes
- Acceder a herramientas del estudio
- Acceder al panel de admin
- Ver otros usuarios
- Modificar sus permisos

#### Administradores
✅ **Pueden**:
- Gestionar todos los usuarios
- Ver toda la información
- Acceder a todas las herramientas
- Crear/editar/eliminar usuarios
- Resetear contraseñas

### Filtrado de Datos

En `panel-cliente.html`, TODOS los datos se filtran por `cliente_id`:

```javascript
// Ejemplo de query correcto
const { data, error } = await supabaseClient
    .from('comprobantes')
    .select('*')
    .eq('cliente_id', session.cliente_id)
    .order('fecha', { ascending: false });
```

**⚠️ IMPORTANTE**: Nunca olvidar el filtro `.eq('cliente_id', session.cliente_id)` en las queries de usuarios externos.

---

## 📁 Archivos del Sistema

### Nuevos Archivos

```
herramientas/gestion-comprobantes/
├── sql/
│   └── 03-agregar-requiere-cambio-password.sql  # Script SQL
├── panel-usuarios.html                           # Panel de gestión
└── cambiar-password.html                         # Cambio obligatorio
```

### Archivos Modificados

```
herramientas/gestion-comprobantes/
├── auth.js                    # Sistema de autenticación actualizado
├── login.html                 # Verificación de cambio de password
├── panel-admin.html           # Link a gestión de usuarios
└── panel-cliente.html         # Filtrado por cliente_id

check-auth.js                  # Redirección automática
```

---

## 🧪 Pruebas

### Checklist de Pruebas

#### 1. Crear Usuario
- [ ] Admin puede crear usuario externo
- [ ] Email debe ser único
- [ ] Contraseña mínimo 6 caracteres
- [ ] Cliente debe seleccionarse de la lista
- [ ] Usuario aparece en la tabla

#### 2. Primera Vez
- [ ] Login con credenciales temporales
- [ ] Redirige a `cambiar-password.html`
- [ ] Validación de contraseña (mínimo 8 caracteres)
- [ ] Contraseñas deben coincidir
- [ ] No puede usar la misma contraseña
- [ ] Después del cambio, redirige al panel

#### 3. Acceso Normal
- [ ] Login con nueva contraseña
- [ ] Va directo a `panel-cliente.html`
- [ ] No pasa por cambio de password
- [ ] Ve información de su cliente

#### 4. Restricción de Acceso
- [ ] Si intenta acceder a `/index.html`, redirige a panel
- [ ] No puede acceder a `panel-admin.html`
- [ ] No puede acceder a `panel-usuarios.html`
- [ ] Solo ve datos filtrados por su `cliente_id`

#### 5. Admin
- [ ] Puede editar usuarios
- [ ] Puede resetear contraseñas
- [ ] Puede eliminar usuarios
- [ ] Puede cambiar cliente asignado
- [ ] Accede a todas las herramientas

---

## 🐛 Solución de Problemas

### Usuario no puede cambiar contraseña
**Causa**: Contraseña actual incorrecta
**Solución**: Admin debe resetear la contraseña desde `panel-usuarios.html`

### Usuario ve información de otro cliente
**Causa**: Falta filtro por `cliente_id`
**Solución**: Verificar que todas las queries incluyan `.eq('cliente_id', session.cliente_id)`

### Usuario externo accede al index
**Causa**: Script `check-auth.js` no se está cargando
**Solución**: Verificar que `<script src="check-auth.js"></script>` esté en `index.html`

### Error al crear usuario
**Causa 1**: Email duplicado
**Solución**: Usar un email único

**Causa 2**: Cliente no seleccionado
**Solución**: Seleccionar un cliente de la lista

**Causa 3**: Tabla no actualizada
**Solución**: Ejecutar el script SQL de migración

---

## 📊 Esquema de Base de Datos

```sql
CREATE TABLE usuarios_comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'cliente')),
    nombre TEXT NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    requiere_cambio_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔮 Próximos Pasos

### Mejoras de Seguridad (Recomendadas para Producción)
- [ ] Implementar hashing de contraseñas (bcrypt)
- [ ] Agregar autenticación de dos factores (2FA)
- [ ] Implementar tokens JWT en lugar de localStorage
- [ ] Agregar logs de auditoría de accesos
- [ ] Implementar políticas de contraseñas más estrictas

### Funcionalidades Adicionales
- [ ] Permitir que usuarios cambien su propia contraseña
- [ ] Agregar recuperación de contraseña por email
- [ ] Implementar expiración de sesiones
- [ ] Agregar notificaciones de cambios de contraseña
- [ ] Dashboard de actividad de usuarios

---

## 📞 Soporte

Para problemas o preguntas sobre el sistema de usuarios externos:
1. Revisar esta documentación
2. Verificar que el script SQL se haya ejecutado correctamente
3. Consultar los logs del navegador (F12 → Console)

---

**Versión**: 1.0
**Fecha**: 2024
**Desarrollado con**: Claude Code
