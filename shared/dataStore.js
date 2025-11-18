/**
 * DataStore - Sistema centralizado de persistencia para todas las herramientas
 *
 * Este módulo proporciona una API unificada para almacenar y recuperar datos
 * compartidos entre todas las herramientas de la suite contable.
 *
 * Características:
 * - Namespace unificado para evitar conflictos
 * - Event system para notificar cambios
 * - Migración automática de datos legacy
 * - Validación de datos
 */

class DataStore {
    constructor() {
        this.namespace = 'contable_shared_';
        this.listeners = {};
    }

    /**
     * Guardar datos en localStorage
     * @param {string} key - Clave para identificar los datos
     * @param {any} data - Datos a guardar (serán convertidos a JSON)
     * @param {boolean} notify - Si debe notificar a los listeners (default: true)
     */
    save(key, data, notify = true) {
        try {
            const fullKey = this.namespace + key;
            const jsonData = JSON.stringify(data);
            localStorage.setItem(fullKey, jsonData);

            if (notify && this.listeners[key]) {
                this.listeners[key].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error en listener de ${key}:`, error);
                    }
                });
            }

            return true;
        } catch (error) {
            console.error(`Error guardando ${key}:`, error);
            return false;
        }
    }

    /**
     * Cargar datos desde localStorage
     * @param {string} key - Clave de los datos
     * @param {any} defaultValue - Valor por defecto si no existe (default: null)
     * @returns {any} Los datos cargados o el valor por defecto
     */
    load(key, defaultValue = null) {
        try {
            const fullKey = this.namespace + key;
            const jsonData = localStorage.getItem(fullKey);

            if (jsonData === null) {
                return defaultValue;
            }

            return JSON.parse(jsonData);
        } catch (error) {
            console.error(`Error cargando ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Eliminar datos de localStorage
     * @param {string} key - Clave de los datos a eliminar
     * @param {boolean} notify - Si debe notificar a los listeners (default: true)
     */
    remove(key, notify = true) {
        try {
            const fullKey = this.namespace + key;
            localStorage.removeItem(fullKey);

            if (notify && this.listeners[key]) {
                this.listeners[key].forEach(callback => {
                    try {
                        callback(null);
                    } catch (error) {
                        console.error(`Error en listener de ${key}:`, error);
                    }
                });
            }

            return true;
        } catch (error) {
            console.error(`Error eliminando ${key}:`, error);
            return false;
        }
    }

    /**
     * Verificar si existe una clave
     * @param {string} key - Clave a verificar
     * @returns {boolean}
     */
    exists(key) {
        const fullKey = this.namespace + key;
        return localStorage.getItem(fullKey) !== null;
    }

    /**
     * Registrar un listener para cambios en una clave
     * @param {string} key - Clave a observar
     * @param {Function} callback - Función a ejecutar cuando cambien los datos
     */
    onChange(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
    }

    /**
     * Remover un listener
     * @param {string} key - Clave del listener
     * @param {Function} callback - Función a remover
     */
    offChange(key, callback) {
        if (this.listeners[key]) {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        }
    }

    /**
     * Limpiar todos los listeners de una clave
     * @param {string} key - Clave a limpiar
     */
    clearListeners(key) {
        if (key) {
            delete this.listeners[key];
        } else {
            this.listeners = {};
        }
    }

    /**
     * Migrar datos desde el formato legacy (sin namespace compartido)
     * @param {string} oldKey - Clave antigua
     * @param {string} newKey - Clave nueva (sin namespace)
     * @param {Function} transform - Función opcional para transformar los datos
     */
    migrate(oldKey, newKey, transform = null) {
        try {
            const oldData = localStorage.getItem(oldKey);

            if (oldData === null) {
                console.log(`No hay datos legacy para migrar: ${oldKey}`);
                return false;
            }

            let data = JSON.parse(oldData);

            // Aplicar transformación si existe
            if (transform && typeof transform === 'function') {
                data = transform(data);
            }

            // Guardar en nuevo formato
            this.save(newKey, data, false);

            // NO eliminamos los datos viejos para mantener compatibilidad
            // localStorage.removeItem(oldKey);

            console.log(`Datos migrados: ${oldKey} → ${this.namespace}${newKey}`);
            return true;
        } catch (error) {
            console.error(`Error migrando ${oldKey}:`, error);
            return false;
        }
    }

    /**
     * Obtener todas las claves con el namespace
     * @returns {Array<string>} Lista de claves (sin el namespace)
     */
    getAllKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.namespace)) {
                keys.push(key.substring(this.namespace.length));
            }
        }
        return keys;
    }

    /**
     * Limpiar todos los datos del namespace
     * ⚠️ USAR CON PRECAUCIÓN
     */
    clearAll() {
        const keys = this.getAllKeys();
        keys.forEach(key => this.remove(key, false));
        console.warn('Todos los datos han sido eliminados');
    }

    /**
     * Obtener estadísticas de almacenamiento
     * @returns {Object} Estadísticas de uso
     */
    getStats() {
        const keys = this.getAllKeys();
        let totalSize = 0;
        const items = {};

        keys.forEach(key => {
            const data = localStorage.getItem(this.namespace + key);
            const size = new Blob([data]).size;
            totalSize += size;
            items[key] = {
                size: size,
                sizeKB: (size / 1024).toFixed(2)
            };
        });

        return {
            itemCount: keys.length,
            totalSize: totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            items: items
        };
    }
}

// Crear instancia global singleton
const dataStore = new DataStore();

// Exportar para uso en módulos ES6 y global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dataStore;
}

// También disponible globalmente
if (typeof window !== 'undefined') {
    window.DataStore = dataStore;
}
