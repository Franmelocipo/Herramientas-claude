# 🔐 Variables de Entorno - Supabase

## 📋 Cómo Funciona

Este proyecto utiliza **variables de entorno** para las credenciales de Supabase, en lugar de credenciales hardcodeadas. Esto permite:

- ✅ Mantener las credenciales seguras
- ✅ Diferentes configuraciones para desarrollo y producción
- ✅ No commitear secretos al repositorio

## 🏗️ Arquitectura

### Desarrollo Local

1. Creas un archivo `.env.local` con tus credenciales
2. Ejecutas `bash setup-local.sh`
3. Se genera `supabase-config.js` automáticamente
4. Abres `index.html` en tu navegador

### Producción (Netlify)

1. Configuras las variables de entorno en Netlify Dashboard
2. Netlify ejecuta `bash build.sh` automáticamente
3. Se genera `supabase-config.js` con las credenciales de producción
4. El sitio se despliega con la configuración correcta

## 🚀 Setup para Desarrollo Local

### Paso 1: Crear `.env.local`

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
VITE_SUPABASE_URL=https://wnpjvnmyfkgtpwqnbmxa.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_aqui
```

**⚠️ IMPORTANTE**: Obtén la `VITE_SUPABASE_ANON_KEY` desde:
1. [Supabase Dashboard](https://supabase.com)
2. Tu proyecto → Settings → API
3. Copia "anon public" key

### Paso 2: Generar Configuración

```bash
bash setup-local.sh
```

Esto generará el archivo `supabase-config.js` con tus credenciales locales.

### Paso 3: Abrir en Navegador

Abre `index.html` en tu navegador y verifica en la consola:

```
🔑 Supabase Config Loaded:
  URL: https://wnpjvnmyfkgtpwqnbmxa.supabase.co
  Key exists: true
  Key length: 220
✅ Supabase initialized successfully
```

## ☁️ Setup para Netlify

### Paso 1: Configurar Variables de Entorno

1. Ve a [Netlify Dashboard](https://app.netlify.com)
2. Selecciona tu sitio
3. Ve a **Site settings** → **Environment variables**
4. Agrega las siguientes variables:

```
VITE_SUPABASE_URL=https://wnpjvnmyfkgtpwqnbmxa.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_aqui
```

### Paso 2: Re-deploy

Netlify automáticamente:
1. Ejecutará `bash build.sh`
2. Generará `supabase-config.js` con las variables de entorno
3. Desplegará el sitio

### Paso 3: Verificar

Abre tu sitio en Netlify y verifica en la consola del navegador:

```
🔑 Supabase Config Loaded:
  URL: https://wnpjvnmyfkgtpwqnbmxa.supabase.co
  Key exists: true
✅ Supabase initialized successfully
```

## 🔍 Troubleshooting

### Error: "Variables de entorno no configuradas"

**En desarrollo local**:
1. Verifica que `.env.local` existe
2. Verifica que tiene las variables correctas
3. Ejecuta `bash setup-local.sh`

**En Netlify**:
1. Ve a Site settings → Environment variables
2. Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configuradas
3. Re-deploy el sitio

### Error: "Supabase library not loaded"

Verifica que `index.html` incluya el CDN de Supabase:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### Error: "Invalid API key"

La `VITE_SUPABASE_ANON_KEY` está mal. Obtén la correcta desde Supabase Dashboard.

### El contador de clientes muestra "0" pero hay clientes

1. Abre la consola del navegador (F12)
2. Busca mensajes con ❌
3. Verifica que Supabase esté inicializado correctamente
4. Verifica que la tabla "clientes" exista en Supabase

## 📁 Archivos Importantes

- **`.env.local`** - Credenciales para desarrollo local (NO commitear)
- **`netlify.toml`** - Configuración de build para Netlify
- **`build.sh`** - Script que genera `supabase-config.js` en producción
- **`setup-local.sh`** - Script para setup en desarrollo local
- **`supabase-config.js`** - Generado automáticamente (NO commitear)

## 🔒 Seguridad

### ✅ Qué SÍ hacer:

- Usar variables de entorno para credenciales
- Commitear `netlify.toml` y `build.sh`
- Agregar `.env.local` al `.gitignore`
- Agregar `supabase-config.js` al `.gitignore`

### ❌ Qué NO hacer:

- Commitear `.env.local`
- Commitear `supabase-config.js`
- Hardcodear credenciales en el código
- Compartir tus credenciales en público

## 🎯 Resumen

```bash
# Desarrollo Local
1. Crear .env.local
2. bash setup-local.sh
3. Abrir index.html

# Producción (Netlify)
1. Configurar variables en Netlify
2. Push al repo
3. Netlify hace el build automáticamente
```

---

**¿Problemas?** Verifica siempre la consola del navegador para logs detallados.
