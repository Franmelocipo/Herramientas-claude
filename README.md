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

## Estructura del Proyecto

```
Herramientas-claude/
├── index.html                          # Página principal
├── README.md                           # Este archivo
├── herramientas/                       # Directorio de herramientas
│   ├── mercado-pago-converter/        # Convertidor Mercado Pago
│   │   ├── index.html                  # Aplicación
│   │   ├── styles.css                  # Estilos
│   │   ├── script.js                   # Lógica
│   │   └── README.md                   # Documentación
│   └── conversor-asientos/            # Conversor de Asientos Contables
│       ├── index.html                  # Aplicación
│       ├── styles.css                  # Estilos
│       ├── script.js                   # Lógica (con LocalStorage)
│       └── README.md                   # Documentación
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
