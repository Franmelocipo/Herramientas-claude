#!/bin/bash

echo "🔧 Configurando Supabase para desarrollo local..."

# Verificar que exista .env.local
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local no encontrado"
    echo "Por favor crea el archivo .env.local con tus credenciales:"
    echo ""
    echo "VITE_SUPABASE_URL=https://wnpjvnmyfkgtpwqnbmxa.supabase.co"
    echo "VITE_SUPABASE_ANON_KEY=tu_clave_aqui"
    exit 1
fi

# Cargar variables de .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Verificar que las variables existan
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ ERROR: Variables no configuradas en .env.local"
    exit 1
fi

echo "✅ Variables cargadas desde .env.local"

# Ejecutar el script de build para generar el archivo
bash build.sh

echo "✅ Configuración local completada"
echo "Ahora puedes abrir index.html en tu navegador"
