/**
 * ClientManager - Gestión centralizada de clientes
 *
 * Este módulo maneja todas las operaciones relacionadas con clientes:
 * - CRUD de clientes
 * - Planes de cuenta
 * - Importación/Exportación
 * - Validación de datos
 * - Cliente seleccionado actual
 *
 * Uso:
 *   ClientManager.getAllClients()
 *   ClientManager.createClient({ name: 'Cliente SA', cuit: '20-12345678-9' })
 *   ClientManager.selectClient(clientId)
 */

class ClientManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.CLIENTS_KEY = 'clients';
        this.SELECTED_CLIENT_KEY = 'selected_client';

        // Migrar datos legacy si existen
        this._migrateFromLegacy();
    }

    /**
     * Migrar datos desde el formato legacy de conversor-asientos
     */
    _migrateFromLegacy() {
        // Migrar lista de clientes
        if (!this.dataStore.exists(this.CLIENTS_KEY)) {
            this.dataStore.migrate('contable_clients', this.CLIENTS_KEY, (clients) => {
                // Validar y reparar IDs durante la migración
                return clients.map((client, idx) => ({
                    ...client,
                    id: Number.isInteger(client.id) ? client.id : Date.now() + idx,
                    accountPlan: client.accountPlan || []
                }));
            });
        }

        // Migrar cliente seleccionado
        if (!this.dataStore.exists(this.SELECTED_CLIENT_KEY)) {
            this.dataStore.migrate('contable_selected_client', this.SELECTED_CLIENT_KEY);
        }
    }

    /**
     * Obtener todos los clientes
     * @returns {Array} Lista de clientes
     */
    getAllClients() {
        return this.dataStore.load(this.CLIENTS_KEY, []);
    }

    /**
     * Obtener un cliente por ID
     * @param {number} clientId - ID del cliente
     * @returns {Object|null} Cliente o null si no existe
     */
    getClient(clientId) {
        const clients = this.getAllClients();
        return clients.find(c => c.id === clientId) || null;
    }

    /**
     * Crear un nuevo cliente
     * @param {Object} clientData - Datos del cliente { name, cuit }
     * @returns {Object} Cliente creado
     */
    createClient(clientData) {
        const { name, cuit = '' } = clientData;

        if (!name || name.trim() === '') {
            throw new Error('El nombre del cliente es requerido');
        }

        const clients = this.getAllClients();

        // Verificar duplicados por nombre
        const existingClient = clients.find(c =>
            c.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (existingClient) {
            throw new Error('Ya existe un cliente con ese nombre');
        }

        const newClient = {
            id: Date.now(),
            name: name.trim(),
            cuit: cuit.trim(),
            accountPlan: [],
            createdAt: new Date().toISOString()
        };

        clients.push(newClient);
        this.dataStore.save(this.CLIENTS_KEY, clients);

        console.log('Cliente creado:', newClient);
        return newClient;
    }

    /**
     * Actualizar un cliente
     * @param {number} clientId - ID del cliente
     * @param {Object} updates - Datos a actualizar
     * @returns {Object|null} Cliente actualizado o null si no existe
     */
    updateClient(clientId, updates) {
        const clients = this.getAllClients();
        const index = clients.findIndex(c => c.id === clientId);

        if (index === -1) {
            return null;
        }

        // Validar que no se cambie a un nombre duplicado
        if (updates.name) {
            const duplicateName = clients.find((c, idx) =>
                idx !== index &&
                c.name.toLowerCase() === updates.name.trim().toLowerCase()
            );

            if (duplicateName) {
                throw new Error('Ya existe otro cliente con ese nombre');
            }
        }

        clients[index] = {
            ...clients[index],
            ...updates,
            id: clientId, // Asegurar que el ID no cambie
            updatedAt: new Date().toISOString()
        };

        this.dataStore.save(this.CLIENTS_KEY, clients);

        console.log('Cliente actualizado:', clients[index]);
        return clients[index];
    }

    /**
     * Eliminar un cliente
     * @param {number} clientId - ID del cliente
     * @returns {boolean} true si se eliminó, false si no existe
     */
    deleteClient(clientId) {
        const clients = this.getAllClients();
        const filteredClients = clients.filter(c => c.id !== clientId);

        if (filteredClients.length === clients.length) {
            return false; // No se encontró el cliente
        }

        this.dataStore.save(this.CLIENTS_KEY, filteredClients);

        // Si el cliente eliminado era el seleccionado, limpiar selección
        if (this.getSelectedClientId() === clientId) {
            this.clearSelectedClient();
        }

        console.log('Cliente eliminado:', clientId);
        return true;
    }

    /**
     * Importar clientes desde un array
     * @param {Array} clientsData - Array de objetos { name, cuit }
     * @param {boolean} skipDuplicates - Si true, ignora duplicados; si false, lanza error
     * @returns {Object} { imported: number, skipped: number, errors: Array }
     */
    importClients(clientsData, skipDuplicates = true) {
        const clients = this.getAllClients();
        const existingNames = clients.map(c => c.name.toLowerCase());

        let imported = 0;
        let skipped = 0;
        const errors = [];

        clientsData.forEach((data, index) => {
            try {
                const name = String(data.name || '').trim();
                const cuit = String(data.cuit || '').trim();

                if (!name) {
                    errors.push({ index, error: 'Nombre vacío' });
                    return;
                }

                if (existingNames.includes(name.toLowerCase())) {
                    if (skipDuplicates) {
                        skipped++;
                        return;
                    } else {
                        throw new Error(`Cliente duplicado: ${name}`);
                    }
                }

                const newClient = {
                    id: Date.now() + imported,
                    name: name,
                    cuit: cuit,
                    accountPlan: [],
                    createdAt: new Date().toISOString()
                };

                clients.push(newClient);
                existingNames.push(name.toLowerCase());
                imported++;
            } catch (error) {
                errors.push({ index, error: error.message });
            }
        });

        if (imported > 0) {
            this.dataStore.save(this.CLIENTS_KEY, clients);
        }

        console.log(`Importación completada: ${imported} importados, ${skipped} omitidos, ${errors.length} errores`);

        return { imported, skipped, errors };
    }

    /**
     * Importar plan de cuentas para un cliente
     * @param {number} clientId - ID del cliente
     * @param {Array} accountPlan - Array de { code, description }
     * @returns {boolean} true si tuvo éxito
     */
    importAccountPlan(clientId, accountPlan) {
        const client = this.getClient(clientId);

        if (!client) {
            throw new Error('Cliente no encontrado');
        }

        // Validar y limpiar plan de cuentas
        const validatedPlan = accountPlan
            .filter(acc => acc.code && acc.description)
            .map(acc => ({
                code: String(acc.code).trim(),
                description: String(acc.description).trim()
            }));

        return this.updateClient(clientId, { accountPlan: validatedPlan }) !== null;
    }

    /**
     * Obtener plan de cuentas de un cliente
     * @param {number} clientId - ID del cliente
     * @returns {Array} Plan de cuentas o array vacío
     */
    getAccountPlan(clientId) {
        const client = this.getClient(clientId);
        return client?.accountPlan || [];
    }

    /**
     * Buscar cuentas en el plan de cuentas de un cliente
     * @param {number} clientId - ID del cliente
     * @param {string} query - Término de búsqueda
     * @returns {Array} Cuentas que coinciden con la búsqueda
     */
    searchAccounts(clientId, query) {
        const accountPlan = this.getAccountPlan(clientId);

        if (!query || query.trim() === '') {
            return accountPlan.slice(0, 20); // Primeras 20 si no hay búsqueda
        }

        const lowerQuery = query.toLowerCase();
        return accountPlan.filter(acc =>
            acc.code.toLowerCase().includes(lowerQuery) ||
            acc.description.toLowerCase().includes(lowerQuery)
        ).slice(0, 20);
    }

    /**
     * Seleccionar un cliente como activo
     * @param {number} clientId - ID del cliente a seleccionar
     * @returns {boolean} true si tuvo éxito, false si el cliente no existe
     */
    selectClient(clientId) {
        const client = this.getClient(clientId);

        if (!client) {
            console.error('Cliente no encontrado:', clientId);
            return false;
        }

        this.dataStore.save(this.SELECTED_CLIENT_KEY, clientId);
        console.log('Cliente seleccionado:', client.name);
        return true;
    }

    /**
     * Obtener el ID del cliente seleccionado actual
     * @returns {number|null} ID del cliente o null
     */
    getSelectedClientId() {
        return this.dataStore.load(this.SELECTED_CLIENT_KEY, null);
    }

    /**
     * Obtener el cliente seleccionado actual
     * @returns {Object|null} Cliente o null
     */
    getSelectedClient() {
        const clientId = this.getSelectedClientId();
        return clientId ? this.getClient(clientId) : null;
    }

    /**
     * Limpiar la selección de cliente
     */
    clearSelectedClient() {
        this.dataStore.remove(this.SELECTED_CLIENT_KEY);
        console.log('Selección de cliente limpiada');
    }

    /**
     * Buscar clientes por nombre o CUIT
     * @param {string} query - Término de búsqueda
     * @returns {Array} Clientes que coinciden
     */
    searchClients(query) {
        if (!query || query.trim() === '') {
            return this.getAllClients();
        }

        const lowerQuery = query.toLowerCase();
        return this.getAllClients().filter(client =>
            client.name.toLowerCase().includes(lowerQuery) ||
            (client.cuit && client.cuit.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Validar y reparar datos de clientes
     * @returns {Object} Resultado de la reparación
     */
    validateAndRepair() {
        const clients = this.getAllClients();
        let corruptedIds = 0;
        let missingAccountPlans = 0;
        let totalRepaired = 0;

        const repairedClients = clients.map((client, idx) => {
            let repaired = { ...client };
            let needsRepair = false;

            // Reparar IDs corruptos
            if (!Number.isInteger(client.id)) {
                repaired.id = Date.now() + idx;
                corruptedIds++;
                needsRepair = true;
            }

            // Asegurar que accountPlan existe
            if (!client.accountPlan) {
                repaired.accountPlan = [];
                missingAccountPlans++;
                needsRepair = true;
            }

            if (needsRepair) {
                totalRepaired++;
            }

            return repaired;
        });

        if (totalRepaired > 0) {
            this.dataStore.save(this.CLIENTS_KEY, repairedClients);
            // Limpiar selección por seguridad
            this.clearSelectedClient();
        }

        const result = {
            corruptedIds,
            missingAccountPlans,
            totalRepaired
        };

        console.log('Validación completada:', result);
        return result;
    }

    /**
     * Exportar todos los clientes a formato JSON
     * @returns {string} JSON string de los clientes
     */
    exportClients() {
        return JSON.stringify(this.getAllClients(), null, 2);
    }

    /**
     * Registrar listener para cambios en clientes
     * @param {Function} callback - Función a ejecutar cuando cambien los clientes
     */
    onClientsChange(callback) {
        this.dataStore.onChange(this.CLIENTS_KEY, callback);
    }

    /**
     * Registrar listener para cambios en cliente seleccionado
     * @param {Function} callback - Función a ejecutar cuando cambie la selección
     */
    onSelectedClientChange(callback) {
        this.dataStore.onChange(this.SELECTED_CLIENT_KEY, callback);
    }
}

// Crear instancia global singleton
const clientManager = new ClientManager(window.DataStore || DataStore);

// Exportar para uso en módulos ES6 y global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = clientManager;
}

// También disponible globalmente
if (typeof window !== 'undefined') {
    window.ClientManager = clientManager;
}
