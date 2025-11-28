# Herramientas Contables - Estudio

Suite de herramientas web desarrolladas para optimizar y automatizar procesos del estudio contable.

## Herramientas Disponibles

### 1. Convertidor de Extractos Mercado Pago
**📊 Estado:** ✅ Disponible

Convierte resúmenes de Mercado Pago en formato de extracto bancario contable con desagregación completa de movimientos.

**Características:**
- Procesamiento múltiple de archivos Excel
- Desagregación automática de comisiones, impuestos y reintegros
- Identificación de retenciones (Ganancias, IVA, IIBB, SIRTAC)
- Exportación a formato Excel
- Validación automática de saldos
- 100% local (no envía datos a servidores externos)

[📖 Ver documentación completa](./herramientas/mercado-pago-converter/README.md)

### 2. Conversor de Asientos Contables
**📝 Estado:** ✅ Disponible

Convierte datos de diferentes orígenes a formato de asientos contables listos para importar en sistemas contables.

**Características:**
- Soporte para múltiples orígenes: Extractos bancarios, VEPs ARCA, Compensaciones ARCA, Registros del cliente
- Gestión de clientes con persistencia local (LocalStorage)
- Importación y gestión de planes de cuentas por cliente
- Buscador inteligente de cuentas con autocompletado
- Agrupación automática de movimientos similares
- Exportación lista para importar
- 100% local (no envía datos a servidores externos)

[📖 Ver documentación completa](./herramientas/conversor-asientos/README.md)

### 3. Conversor de Extractos Bancarios
**🏦 Estado:** ✅ Disponible

Convierte extractos bancarios y de inversiones de PDF a Excel para facilitar el análisis y la contabilización.

**Características:**
- Soporte para Banco Galicia y BBVA
- Extractos bancarios e inversiones
- Extracción automática de movimientos
- Exportación a Excel con formato
- 100% local (no envía datos a servidores externos)

[📖 Ver documentación completa](./herramientas/extractos-bancarios/README.md)

### 4. Servicios de Outsourcing
**📋 Estado:** ✅ Disponible (MVP)

Sistema web completo para la carga y gestión de comprobantes de clientes remotos del estudio contable, con integración a Supabase.

**Características:**
- **Para Clientes:**
  - Subir comprobantes (PDF/imágenes) a períodos abiertos
  - Ver historial de comprobantes subidos
  - Consultar estado de órdenes de pago
  - Acceso limitado solo a sus propios datos

- **Para Personal del Estudio:**
  - Gestión de períodos contables (apertura/cierre)
  - Vinculación de comprobantes con registros contables
  - Cálculo automático de retenciones RG 830
  - Creación y gestión de órdenes de pago
  - Dashboard con estadísticas y reportes
  - Acceso completo a todos los clientes

- **Base de Datos:**
  - Integración completa con Supabase (PostgreSQL)
  - Row Level Security (RLS) para control de acceso
  - Storage para archivos de comprobantes
  - Códigos de retención RG 830 precargados

[📖 Ver documentación completa](./herramientas/servicios-outsourcing/README.md)

## Estructura del Proyecto

```
Herramientas-claude/
├── index.html                          # Página principal
├── login.html                          # Página de login
├── README.md                           # Este archivo
├── supabase-config.js                  # Configuración de Supabase
├── supabase-schema-comprobantes.sql    # Schema SQL para gestión de comprobantes
├── check-auth.js                       # Verificación de autenticación
├── herramientas/                       # Directorio de herramientas
│   ├── mercado-pago-converter/        # Convertidor Mercado Pago
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── README.md
│   ├── conversor-asientos/            # Conversor de Asientos Contables
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── README.md
│   ├── extractos-bancarios/           # Conversor de Extractos Bancarios
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── README.md
│   └── servicios-outsourcing/         # Servicios de Outsourcing
│       ├── index.html                  # Aplicación principal
│       ├── styles.css                  # Estilos
│       ├── script.js                   # Lógica principal
│       ├── README.md                   # Documentación
│       ├── lib/                        # Librerías
│       │   ├── utils.js                # Utilidades generales
│       │   ├── retenciones.js          # Cálculo de retenciones
│       │   └── supabase-helper.js      # Helper de Supabase
│       ├── cliente/                    # Vistas de cliente (futuro)
│       └── estudio/                    # Vistas del estudio (futuro)
└── assets/                             # Recursos compartidos (opcional)
    ├── css/
    └── js/
```

## Uso

### Opción 1: Acceso Web Local
1. Clona este repositorio
2. Abre `index.html` en tu navegador
3. Selecciona la herramienta que deseas usar

### Opción 2: Acceso Directo
Navega directamente a la carpeta de la herramienta que necesites y abre su `index.html`

## Características Generales

- ✅ **100% Local**: Todas las herramientas funcionan en el navegador, sin enviar datos a servidores
- ✅ **Sin Instalación**: Solo necesitas un navegador web moderno
- ✅ **Multiplataforma**: Funciona en Windows, Mac y Linux
- ✅ **Código Abierto**: Todo el código es visible y auditable
- ✅ **Diseño Responsive**: Funciona en desktop y dispositivos móviles

## Tecnologías Utilizadas

- HTML5
- CSS3
- JavaScript (Vanilla)
- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) - Procesamiento de archivos Excel

## Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- JavaScript habilitado

## Próximas Herramientas

El proyecto está diseñado para crecer con nuevas herramientas según las necesidades del estudio:
- 📝 Herramientas de facturación
- 📈 Generadores de reportes
- 🧾 Procesadores de comprobantes
- Y más...

## Contribuciones

Este es un proyecto interno del estudio. Para sugerencias de nuevas herramientas o mejoras, contacta al equipo de desarrollo.

## Licencia

Uso interno del estudio contable.

---

**Desarrollado con Claude Code** 🤖
