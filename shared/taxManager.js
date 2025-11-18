/**
 * TaxManager - Gestión centralizada de base de datos de impuestos
 *
 * Este módulo maneja la base de datos de impuestos que relaciona:
 * - Impuesto
 * - Concepto
 * - Subconcepto
 *
 * Útil para todas las herramientas que necesiten clasificar o buscar
 * información sobre impuestos.
 *
 * Uso:
 *   TaxManager.getAllTaxes()
 *   TaxManager.searchTaxes('IVA')
 *   TaxManager.importFromArray([{ impuesto: 'IVA', concepto: '...', subconcepto: '...' }])
 */

class TaxManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.TAX_DATABASE_KEY = 'tax_database';

        // Migrar datos legacy si existen
        this._migrateFromLegacy();
    }

    /**
     * Migrar datos desde el formato legacy de conversor-asientos
     */
    _migrateFromLegacy() {
        if (!this.dataStore.exists(this.TAX_DATABASE_KEY)) {
            this.dataStore.migrate('contable_tax_database', this.TAX_DATABASE_KEY);
        }
    }

    /**
     * Obtener toda la base de datos de impuestos
     * @returns {Array} Lista de impuestos
     */
    getAllTaxes() {
        return this.dataStore.load(this.TAX_DATABASE_KEY, []);
    }

    /**
     * Importar base de datos de impuestos desde un array
     * @param {Array} taxesData - Array de { impuesto, concepto, subconcepto }
     * @param {boolean} replace - Si true, reemplaza todos; si false, agrega
     * @returns {Object} Resultado de la importación
     */
    importFromArray(taxesData, replace = true) {
        const validTaxes = taxesData
            .filter(tax =>
                tax.impuesto &&
                tax.concepto &&
                tax.subconcepto
            )
            .map(tax => ({
                impuesto: String(tax.impuesto).trim(),
                concepto: String(tax.concepto).trim(),
                subconcepto: String(tax.subconcepto).trim()
            }));

        if (validTaxes.length === 0) {
            return {
                success: false,
                imported: 0,
                message: 'No se encontraron registros válidos'
            };
        }

        let finalTaxes;
        if (replace) {
            finalTaxes = validTaxes;
        } else {
            const existing = this.getAllTaxes();
            finalTaxes = [...existing, ...validTaxes];
        }

        this.dataStore.save(this.TAX_DATABASE_KEY, finalTaxes);

        console.log(`Base de impuestos actualizada: ${validTaxes.length} registros`);

        return {
            success: true,
            imported: validTaxes.length,
            total: finalTaxes.length,
            message: `${validTaxes.length} registros importados`
        };
    }

    /**
     * Buscar impuestos por cualquier campo
     * @param {string} query - Término de búsqueda
     * @returns {Array} Impuestos que coinciden
     */
    searchTaxes(query) {
        if (!query || query.trim() === '') {
            return this.getAllTaxes();
        }

        const lowerQuery = query.toLowerCase();
        return this.getAllTaxes().filter(tax =>
            tax.impuesto.toLowerCase().includes(lowerQuery) ||
            tax.concepto.toLowerCase().includes(lowerQuery) ||
            tax.subconcepto.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Buscar por impuesto específico
     * @param {string} impuesto - Nombre del impuesto
     * @returns {Array} Conceptos y subconceptos de ese impuesto
     */
    getByImpuesto(impuesto) {
        const lowerImpuesto = impuesto.toLowerCase();
        return this.getAllTaxes().filter(tax =>
            tax.impuesto.toLowerCase() === lowerImpuesto
        );
    }

    /**
     * Obtener lista única de impuestos
     * @returns {Array<string>} Nombres únicos de impuestos
     */
    getUniqueImpuestos() {
        const taxes = this.getAllTaxes();
        const unique = [...new Set(taxes.map(t => t.impuesto))];
        return unique.sort();
    }

    /**
     * Obtener conceptos únicos de un impuesto
     * @param {string} impuesto - Nombre del impuesto
     * @returns {Array<string>} Conceptos únicos
     */
    getConceptosByImpuesto(impuesto) {
        const taxes = this.getByImpuesto(impuesto);
        const unique = [...new Set(taxes.map(t => t.concepto))];
        return unique.sort();
    }

    /**
     * Obtener subconceptos únicos de un impuesto y concepto
     * @param {string} impuesto - Nombre del impuesto
     * @param {string} concepto - Nombre del concepto
     * @returns {Array<string>} Subconceptos únicos
     */
    getSubconceptos(impuesto, concepto) {
        const taxes = this.getAllTaxes().filter(tax =>
            tax.impuesto.toLowerCase() === impuesto.toLowerCase() &&
            tax.concepto.toLowerCase() === concepto.toLowerCase()
        );
        const unique = [...new Set(taxes.map(t => t.subconcepto))];
        return unique.sort();
    }

    /**
     * Agregar un registro individual
     * @param {Object} tax - { impuesto, concepto, subconcepto }
     * @returns {boolean} true si tuvo éxito
     */
    addTax(tax) {
        if (!tax.impuesto || !tax.concepto || !tax.subconcepto) {
            throw new Error('Datos incompletos: se requiere impuesto, concepto y subconcepto');
        }

        const taxes = this.getAllTaxes();

        // Verificar si ya existe
        const exists = taxes.some(t =>
            t.impuesto.toLowerCase() === tax.impuesto.toLowerCase() &&
            t.concepto.toLowerCase() === tax.concepto.toLowerCase() &&
            t.subconcepto.toLowerCase() === tax.subconcepto.toLowerCase()
        );

        if (exists) {
            return false; // Ya existe
        }

        taxes.push({
            impuesto: String(tax.impuesto).trim(),
            concepto: String(tax.concepto).trim(),
            subconcepto: String(tax.subconcepto).trim()
        });

        this.dataStore.save(this.TAX_DATABASE_KEY, taxes);
        return true;
    }

    /**
     * Eliminar un registro específico
     * @param {Object} tax - { impuesto, concepto, subconcepto }
     * @returns {boolean} true si se eliminó
     */
    removeTax(tax) {
        const taxes = this.getAllTaxes();
        const filtered = taxes.filter(t =>
            !(t.impuesto.toLowerCase() === tax.impuesto.toLowerCase() &&
              t.concepto.toLowerCase() === tax.concepto.toLowerCase() &&
              t.subconcepto.toLowerCase() === tax.subconcepto.toLowerCase())
        );

        if (filtered.length === taxes.length) {
            return false; // No se encontró
        }

        this.dataStore.save(this.TAX_DATABASE_KEY, filtered);
        return true;
    }

    /**
     * Limpiar toda la base de datos
     */
    clear() {
        this.dataStore.save(this.TAX_DATABASE_KEY, []);
        console.log('Base de datos de impuestos limpiada');
    }

    /**
     * Obtener estadísticas de la base de datos
     * @returns {Object} Estadísticas
     */
    getStats() {
        const taxes = this.getAllTaxes();
        const impuestos = this.getUniqueImpuestos();

        const byImpuesto = {};
        impuestos.forEach(imp => {
            byImpuesto[imp] = this.getByImpuesto(imp).length;
        });

        return {
            total: taxes.length,
            uniqueImpuestos: impuestos.length,
            impuestos: impuestos,
            byImpuesto: byImpuesto
        };
    }

    /**
     * Exportar base de datos a JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify(this.getAllTaxes(), null, 2);
    }

    /**
     * Validar integridad de los datos
     * @returns {Object} Resultado de la validación
     */
    validate() {
        const taxes = this.getAllTaxes();
        const issues = [];

        taxes.forEach((tax, index) => {
            if (!tax.impuesto || tax.impuesto.trim() === '') {
                issues.push({ index, field: 'impuesto', issue: 'vacío' });
            }
            if (!tax.concepto || tax.concepto.trim() === '') {
                issues.push({ index, field: 'concepto', issue: 'vacío' });
            }
            if (!tax.subconcepto || tax.subconcepto.trim() === '') {
                issues.push({ index, field: 'subconcepto', issue: 'vacío' });
            }
        });

        return {
            valid: issues.length === 0,
            totalRecords: taxes.length,
            issues: issues
        };
    }

    /**
     * Registrar listener para cambios en la base de impuestos
     * @param {Function} callback - Función a ejecutar cuando cambien los datos
     */
    onTaxDatabaseChange(callback) {
        this.dataStore.onChange(this.TAX_DATABASE_KEY, callback);
    }

    /**
     * Remover duplicados de la base de datos
     * @returns {number} Cantidad de duplicados eliminados
     */
    removeDuplicates() {
        const taxes = this.getAllTaxes();
        const unique = [];
        const seen = new Set();

        taxes.forEach(tax => {
            const key = `${tax.impuesto}|${tax.concepto}|${tax.subconcepto}`.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(tax);
            }
        });

        const duplicatesRemoved = taxes.length - unique.length;

        if (duplicatesRemoved > 0) {
            this.dataStore.save(this.TAX_DATABASE_KEY, unique);
            console.log(`${duplicatesRemoved} duplicados eliminados`);
        }

        return duplicatesRemoved;
    }
}

// Crear instancia global singleton
const taxManager = new TaxManager(window.DataStore || DataStore);

// Exportar para uso en módulos ES6 y global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = taxManager;
}

// También disponible globalmente
if (typeof window !== 'undefined') {
    window.TaxManager = taxManager;
}
