# Sistema Centralizado de Datos Compartidos

Este directorio contiene los módulos centralizados para gestionar datos compartidos entre todas las herramientas de la suite contable.

## Arquitectura

```
shared/
├── dataStore.js       # Sistema de persistencia centralizado (localStorage)
├── clientManager.js   # Gestión de clientes y planes de cuenta
└── taxManager.js      # Gestión de base de datos de impuestos
```

## Directivas de Desarrollo

**IMPORTANTE**: A partir de ahora, **TODAS** las herramientas deben utilizar estos módulos centralizados para:

1. **Clientes**: Usar `ClientManager` para cualquier operación con clientes
2. **Impuestos**: Usar `TaxManager` para la base de datos de impuestos
3. **Persistencia**: Usar `DataStore` para guardar cualquier dato en localStorage

**NO** crear sistemas de gestión de datos duplicados en herramientas individuales.

## Uso

### 1. Incluir los módulos en tu HTML

```html
<!-- Cargar en este orden -->
<script src="/shared/dataStore.js"></script>
<script src="/shared/clientManager.js"></script>
<script src="/shared/taxManager.js"></script>
```

### 2. ClientManager - Gestión de Clientes

```javascript
// Obtener todos los clientes
const clients = ClientManager.getAllClients();

// Crear un cliente
const newClient = ClientManager.createClient({
    name: 'Empresa SA',
    cuit: '20-12345678-9'
});

// Seleccionar un cliente como activo
ClientManager.selectClient(clientId);

// Obtener cliente seleccionado
const selectedClient = ClientManager.getSelectedClient();

// Importar plan de cuentas desde Excel (array de {code, description})
ClientManager.importAccountPlan(clientId, accountPlan);

// Obtener plan de cuentas de un cliente
const accounts = ClientManager.getAccountPlan(clientId);

// Buscar cuentas
const results = ClientManager.searchAccounts(clientId, 'caja');

// Buscar clientes
const results = ClientManager.searchClients('empresa');

// Importar clientes masivamente
const result = ClientManager.importClients([
    { name: 'Cliente 1', cuit: '...' },
    { name: 'Cliente 2', cuit: '...' }
]);

// Validar y reparar datos corruptos
const repairResult = ClientManager.validateAndRepair();

// Escuchar cambios
ClientManager.onClientsChange((clients) => {
    console.log('Clientes actualizados:', clients);
});

ClientManager.onSelectedClientChange((clientId) => {
    console.log('Cliente seleccionado cambió:', clientId);
});
```

### 3. TaxManager - Base de Datos de Impuestos

```javascript
// Obtener todos los impuestos
const taxes = TaxManager.getAllTaxes();

// Importar desde array (ej: desde Excel)
const result = TaxManager.importFromArray([
    { impuesto: 'IVA', concepto: 'Débito Fiscal', subconcepto: 'Ventas' },
    { impuesto: 'IVA', concepto: 'Crédito Fiscal', subconcepto: 'Compras' }
], true); // true = reemplazar, false = agregar

// Buscar impuestos
const results = TaxManager.searchTaxes('IVA');

// Obtener por impuesto específico
const ivaRecords = TaxManager.getByImpuesto('IVA');

// Obtener lista de impuestos únicos
const impuestos = TaxManager.getUniqueImpuestos();

// Obtener conceptos de un impuesto
const conceptos = TaxManager.getConceptosByImpuesto('IVA');

// Obtener subconceptos
const subconceptos = TaxManager.getSubconceptos('IVA', 'Débito Fiscal');

// Agregar un registro
TaxManager.addTax({
    impuesto: 'IIBB',
    concepto: 'Pago mensual',
    subconcepto: 'Adelanto'
});

// Limpiar base de datos
TaxManager.clear();

// Obtener estadísticas
const stats = TaxManager.getStats();
// { total, uniqueImpuestos, impuestos: [...], byImpuesto: {...} }

// Escuchar cambios
TaxManager.onTaxDatabaseChange((taxes) => {
    console.log('Base de impuestos actualizada:', taxes);
});
```

### 4. DataStore - Persistencia Centralizada

```javascript
// Guardar datos personalizados
DataStore.save('mi_configuracion', { theme: 'dark', lang: 'es' });

// Cargar datos
const config = DataStore.load('mi_configuracion', { theme: 'light', lang: 'es' });

// Verificar si existe
if (DataStore.exists('mi_configuracion')) {
    // ...
}

// Eliminar datos
DataStore.remove('mi_configuracion');

// Obtener todas las claves
const keys = DataStore.getAllKeys();

// Obtener estadísticas de uso
const stats = DataStore.getStats();
// { itemCount, totalSizeKB, items: {...} }

// Migrar datos legacy
DataStore.migrate('old_key', 'new_key', (oldData) => {
    // Transformar datos si es necesario
    return transformedData;
});

// Escuchar cambios en una clave
DataStore.onChange('mi_configuracion', (newData) => {
    console.log('Configuración actualizada:', newData);
});
```

## Migración desde Sistemas Legacy

Los módulos **automáticamente migran** datos existentes desde:
- `localStorage.getItem('contable_clients')` → ClientManager
- `localStorage.getItem('contable_selected_client')` → ClientManager
- `localStorage.getItem('contable_tax_database')` → TaxManager

La migración se ejecuta automáticamente al cargar los módulos y **no elimina** los datos originales para mantener compatibilidad.

## Namespace y Claves

Todos los datos se guardan con el prefijo `contable_shared_`:
- Clientes: `contable_shared_clients`
- Cliente seleccionado: `contable_shared_selected_client`
- Impuestos: `contable_shared_tax_database`
- Datos custom: `contable_shared_{tu_clave}`

## Sistema de Eventos

Todos los managers soportan listeners para reaccionar a cambios en los datos:

```javascript
// Ejemplo: Actualizar UI cuando cambie el cliente seleccionado
ClientManager.onSelectedClientChange((clientId) => {
    const client = ClientManager.getClient(clientId);
    if (client) {
        document.getElementById('clientName').textContent = client.name;
    }
});
```

## Validación y Reparación

### Clientes

```javascript
// Detectar y reparar problemas (IDs corruptos, accountPlan faltante)
const result = ClientManager.validateAndRepair();
console.log(result);
// { corruptedIds: 2, missingAccountPlans: 1, totalRepaired: 3 }
```

### Impuestos

```javascript
// Validar integridad
const validation = TaxManager.validate();
if (!validation.valid) {
    console.log('Problemas encontrados:', validation.issues);
}

// Eliminar duplicados
const removed = TaxManager.removeDuplicates();
console.log(`${removed} duplicados eliminados`);
```

## Ejemplos de Integración

### Ejemplo 1: Selector de Cliente

```javascript
// HTML
<select id="clientSelector">
    <option value="">Seleccionar cliente...</option>
</select>

// JavaScript
function renderClientSelector() {
    const selector = document.getElementById('clientSelector');
    const clients = ClientManager.getAllClients();

    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        selector.appendChild(option);
    });
}

// Cargar al iniciar
renderClientSelector();

// Actualizar cuando cambien los clientes
ClientManager.onClientsChange(() => {
    renderClientSelector();
});
```

### Ejemplo 2: Importar desde Excel

```javascript
async function importClientsFromExcel(file) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const clientsData = jsonData.slice(1).map(row => ({
        name: String(row[0] || '').trim(),
        cuit: String(row[1] || '').trim()
    }));

    const result = ClientManager.importClients(clientsData);

    alert(`Importados: ${result.imported}, Omitidos: ${result.skipped}`);
}
```

### Ejemplo 3: Buscar Cuentas con Dropdown

```javascript
function showAccountDropdown(clientId, inputElement, onSelect) {
    const dropdown = document.createElement('div');
    dropdown.className = 'account-dropdown';

    const searchInput = document.createElement('input');
    searchInput.placeholder = 'Buscar cuenta...';

    const resultsList = document.createElement('div');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const accounts = ClientManager.searchAccounts(clientId, query);

        resultsList.innerHTML = accounts.map(acc => `
            <div class="account-item" data-code="${acc.code}">
                <strong>${acc.code}</strong> - ${acc.description}
            </div>
        `).join('');

        // Click handlers
        resultsList.querySelectorAll('.account-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                const account = accounts.find(a => a.code === code);
                onSelect(account);
                dropdown.remove();
            });
        });
    });

    dropdown.appendChild(searchInput);
    dropdown.appendChild(resultsList);
    inputElement.parentElement.appendChild(dropdown);
    searchInput.focus();
}
```

## Mejores Prácticas

1. **Siempre cargar DataStore primero**, luego los otros managers
2. **No modificar directamente localStorage** - usar siempre los managers
3. **Usar listeners** para mantener la UI sincronizada con los datos
4. **Validar datos** antes de mostrarlos (usar `validateAndRepair()`)
5. **Manejar errores** con try-catch cuando uses métodos que pueden lanzar excepciones
6. **No duplicar datos** - si necesitas datos adicionales, crea un nuevo manager siguiendo el mismo patrón

## Extensibilidad

Para agregar nuevos tipos de datos compartidos, crear un nuevo manager siguiendo este patrón:

```javascript
class MyDataManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.MY_DATA_KEY = 'my_data';
    }

    getAll() {
        return this.dataStore.load(this.MY_DATA_KEY, []);
    }

    save(data) {
        this.dataStore.save(this.MY_DATA_KEY, data);
    }

    // ... otros métodos
}

const myDataManager = new MyDataManager(window.DataStore);
window.MyDataManager = myDataManager;
```

## Soporte y Debugging

### Ver datos en consola

```javascript
// Ver todos los clientes
console.table(ClientManager.getAllClients());

// Ver impuestos
console.table(TaxManager.getAllTaxes());

// Ver estadísticas de localStorage
console.log(DataStore.getStats());
```

### Limpiar datos (⚠️ PRECAUCIÓN)

```javascript
// Limpiar solo clientes
ClientManager.dataStore.remove('clients');

// Limpiar solo impuestos
TaxManager.clear();

// Limpiar TODOS los datos compartidos (usar solo en desarrollo)
DataStore.clearAll();
```

## Changelog

### v1.0.0 (2024-11-18)
- Sistema inicial de datos compartidos
- Migración automática desde conversor-asientos
- ClientManager, TaxManager y DataStore implementados
- Sistema de eventos para sincronización
- Documentación completa
