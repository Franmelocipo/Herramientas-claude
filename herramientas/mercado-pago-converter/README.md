# Convertidor de Extractos Mercado Pago

Herramienta web para convertir resúmenes de Mercado Pago en formato de extracto bancario contable.

## Características

- **Procesamiento múltiple**: Permite seleccionar y procesar varios archivos Excel simultáneamente
- **Drag & Drop**: Interfaz intuitiva para arrastrar y soltar archivos
- **Desagregación detallada**: Separa cada movimiento en:
  - Movimiento principal (monto bruto)
  - Comisiones de Mercado Pago (incluye IVA)
  - Comisiones por cuotas sin interés
  - Costos de envío
  - Cupones de descuento
  - Retenciones impositivas (Ganancias, IVA, IIBB, SIRTAC)
  - Impuesto a débitos y créditos bancarios (Ley 25.413)
  - Reintegros por cupones/descuentos

- **Saldo verificado**: Usa el saldo exacto del archivo de Mercado Pago para garantizar precisión
- **Exportación a Excel**: Descarga los datos procesados en formato Excel

## Uso

1. Abre `index.html` en tu navegador web
2. Arrastra o selecciona uno o más archivos Excel de Mercado Pago
3. Haz clic en "Procesar archivo(s)"
4. Revisa los resultados en la tabla
5. Descarga el Excel procesado

## Formato de entrada

La herramienta espera archivos Excel exportados desde Mercado Pago con las siguientes columnas:

- `TIPO DE REGISTRO`
- `FECHA DE LIBERACIÓN`
- `DESCRIPCIÓN`
- `ID DE OPERACIÓN EN MERCADO PAGO`
- `PLATAFORMA DE COBRO`
- `PAGADOR`
- `MONTO BRUTO DE LA OPERACIÓN`
- `MONTO NETO ACREDITADO`
- `MONTO NETO DEBITADO`
- `SALDO`
- `COMISIÓN DE MERCADO PAGO O MERCADO LIBRE (INCLUYE IVA)`
- `COMISIÓN POR OFRECER CUOTAS SIN INTERÉS`
- `COSTO DE ENVÍO`
- `IMPUESTOS COBRADOS POR RETENCIONES IIBB`
- `CUPÓN DE DESCUENTO`
- `IMPUESTOS DESAGREGADOS`
- `OPERATION_TAGS`

## Criterios de filtrado

**Se incluyen** registros con:
- Tipo de registro: "Dinero liquidado"
- Descripción que contenga:
  - "Pago"
  - "Extracción de efectivo"
  - "Devolución de dinero"

**Se excluyen** registros con:
- "Reserva para pago"
- "Consumos pendientes de confirmación"

## Tipos de impuestos reconocidos

La herramienta identifica automáticamente:
- Retención de Ganancias
- Retención de IVA
- Retención de IIBB
- Retención de IIBB SIRTAC (por jurisdicción)
- Impuesto Ley 25.413 - Débitos y Créditos Bancarios

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript (Vanilla)
- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) para procesamiento de archivos Excel

## Notas técnicas

- La herramienta funciona completamente en el navegador, no se envían datos a ningún servidor
- El saldo mostrado coincide exactamente con el archivo original de Mercado Pago
- Las comisiones e impuestos se muestran como líneas separadas pero comparten el mismo saldo del movimiento principal
- Los reintegros por cupones se identifican desde el campo `OPERATION_TAGS`

## Licencia

Herramienta desarrollada para uso interno del estudio contable.
