# Conversor de Asientos Contables

Herramienta web para convertir datos de diferentes orígenes (extractos bancarios, VEPs ARCA, compensaciones ARCA, registros del cliente) a formato de asientos contables listos para importar en sistemas contables.

## Características

- **Múltiples orígenes soportados**:
  - Extractos bancarios
  - VEPs ARCA (Volantes Electrónicos de Pago)
  - Compensaciones ARCA
  - Registros del cliente

- **Gestión de clientes**: Sistema completo de administración de clientes con persistencia local
- **Planes de cuentas**: Importa y gestiona el plan de cuentas de cada cliente desde Excel
- **Asignación inteligente**: Buscador de cuentas con autocompletado para asignar rápidamente
- **Agrupación automática**: Agrupa movimientos similares para facilitar la asignación
- **Exportación optimizada**: Genera archivos Excel listos para importar en el sistema contable
- **100% local**: Todos los datos se procesan en el navegador, sin enviar información a servidores

## Uso

### 1. Gestionar Clientes (Opcional pero Recomendado)

1. Haz clic en "Gestionar Clientes"
2. Crea un nuevo cliente con el botón "+ Nuevo Cliente"
3. Importa el plan de cuentas del cliente (archivo Excel con formato: Código | Descripción)
4. Selecciona el cliente con el que trabajarás

### 2. Seleccionar Tipo de Origen

Elige el tipo de archivo que vas a procesar:

- **Extracto Bancario**: Movimientos de cuentas bancarias
- **Registros del Cliente**: Registros contables del cliente
- **VEPs ARCA**: Volantes electrónicos de pago de AFIP
- **Compensaciones ARCA**: Compensaciones de saldos a favor en AFIP

### 3. Cargar Archivo

- Sube el archivo Excel correspondiente al tipo seleccionado
- La herramienta detectará automáticamente las columnas necesarias
- Los datos se agruparán automáticamente por conceptos similares

### 4. Asignar Cuentas Contables

Para cada grupo de movimientos:

1. Revisa el concepto y los totales
2. Asigna el código de cuenta contable:
   - Si tienes un cliente seleccionado: usa el buscador para encontrar la cuenta
   - Sin cliente: ingresa manualmente el código

**Especial para cada tipo**:

- **Extractos**: Debes asignar también la cuenta del banco (contrapartida)
- **VEPs**: Debes asignar la cuenta de contrapartida para los totales
- **Compensaciones**:
  - 🔵 Origen = HABER (lo que compensás, sale de tu saldo)
  - 🟢 Destino = DEBE (donde aplicás la compensación, entra)

### 5. Generar y Descargar

- Haz clic en "Generar archivo final"
- Revisa la vista previa de los asientos
- Descarga el archivo Excel con los asientos listos para importar

## Formatos de Entrada Esperados

### Extracto Bancario

Columnas esperadas:
- `Fecha`
- `Descripción` o `Leyenda`
- `Débito`
- `Crédito`

### VEPs ARCA

Columnas esperadas:
- `NRO_VEP` (o variantes)
- `FECHA`
- `PERIODO`
- `IMPUESTO`
- `CONCEPTO`
- `SUBCONCEPTO`
- `COD_SUBCONCEPTO`
- `IMPORTE`

### Compensaciones ARCA

Columnas esperadas:
- `Transacción`
- `Fecha Operación`
- `Impuesto Orig` / `Impuesto Dest`
- `Concepto Orig` / `Concepto Dest`
- `Subconcepto Orig` / `Subconcepto Dest`
- `Período Orig` / `Período Dest`
- `Importe`

### Registros del Cliente

Columnas esperadas:
- `FECHA`
- `N_INTER`
- `N_COMP`
- `DESC_CTA`
- `PROVEEDOR` o `RAZON SOCIAL`
- `CONCEPTO`
- `DEBE`
- `HABER`

## Formato de Salida

El archivo Excel generado contiene las siguientes columnas:

- `Fecha`: Fecha del asiento
- `Numero`: Número de asiento
- `Cuenta`: Código de cuenta contable
- `Debe`: Importe en el debe
- `Haber`: Importe en el haber
- `Tipo de auxiliar`: Siempre "1"
- `Auxiliar`: Siempre "1"
- `Importe`: Importe del movimiento
- `Leyenda`: Descripción del asiento
- `ExtraContable`: Siempre "s"

## Gestión de Datos

### Persistencia Local

La herramienta utiliza **LocalStorage** del navegador para guardar:

- Lista de clientes creados
- Planes de cuentas de cada cliente
- Última configuración utilizada

**Importante**: Los datos se guardan solo en tu navegador. Si cambias de navegador o limpias los datos del navegador, perderás esta información.

### Plan de Cuentas

El formato del Excel para importar el plan de cuentas debe ser:

| Código | Descripción |
|--------|-------------|
| 11010101 | Caja |
| 11020101 | Banco Nación Cta Cte |
| ... | ... |

- Primera fila: Encabezados (se ignorarán)
- Columna A: Código de cuenta
- Columna B: Descripción de la cuenta

## Características Técnicas

- **Procesamiento local**: Todo se ejecuta en tu navegador
- **Sin backend**: No requiere servidor ni base de datos
- **Rápido**: Procesa miles de movimientos en segundos
- **Seguro**: Tus datos nunca salen de tu computadora
- **Compatible**: Funciona en navegadores modernos (Chrome, Firefox, Edge, Safari)

## Lógica de Agrupación

### Extractos Bancarios

Los movimientos se agrupan automáticamente por patrones detectados en la descripción:
- Transferencias recibidas
- Cheques depositados
- Débitos automáticos
- Impuestos
- Comisiones
- Retenciones
- Otros (agrupados por palabras clave similares)

### VEPs

Se agrupan por impuesto, separando:
- Intereses resarcitorios (cod. subconcepto 51)
- Cada tipo de impuesto

Dentro de cada grupo, se generan asientos separados por cada VEP.

### Compensaciones

Se generan dos grupos por cada par origen-destino:
- **Origen**: Lo que sale de tu saldo a favor (HABER)
- **Destino**: Donde se aplica la compensación (DEBE)

### Registros

Se respeta el concepto de cuenta (DESC_CTA) del archivo original.

## Solución de Problemas

### El archivo no se carga

- Verifica que sea un archivo Excel válido (.xlsx o .xls)
- Asegúrate de que contenga las columnas esperadas
- Revisa que no esté vacío

### No encuentro mi cuenta en el buscador

- Verifica que hayas importado el plan de cuentas del cliente
- Revisa que el formato del plan de cuentas sea correcto
- Puedes ingresar el código manualmente si es necesario

### Los saldos no coinciden

- Para compensaciones: Verifica que hayas asignado correctamente origen (HABER) y destino (DEBE)
- Para VEPs y extractos: Verifica la cuenta de contrapartida
- Revisa que todos los grupos tengan código asignado

## Licencia

Herramienta desarrollada para uso interno del estudio contable.
