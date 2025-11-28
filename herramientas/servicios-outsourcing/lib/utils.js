/**
 * UTILIDADES GENERALES
 * Sistema de Servicios de Outsourcing
 */

// =====================================================
// FORMATEO DE DATOS
// =====================================================

/**
 * Formatea un número como moneda argentina
 * @param {number} amount - Monto a formatear
 * @returns {string} - Monto formateado (ej: $1.234,56)
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '$0,00';
    }

    const formatted = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

    return formatted;
}

/**
 * Formatea una fecha a formato DD/MM/YYYY
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha a formato YYYY-MM-DD (para inputs)
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDateInput(date) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Formatea un CUIT con guiones (XX-XXXXXXXX-X)
 * @param {string} cuit - CUIT sin formato
 * @returns {string} - CUIT formateado
 */
function formatCUIT(cuit) {
    if (!cuit) return '';

    // Remover caracteres no numéricos
    const clean = cuit.replace(/\D/g, '');

    if (clean.length !== 11) return cuit;

    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

/**
 * Formatea un CBU con espacios
 * @param {string} cbu - CBU sin formato
 * @returns {string} - CBU formateado
 */
function formatCBU(cbu) {
    if (!cbu) return '';

    const clean = cbu.replace(/\D/g, '');

    if (clean.length !== 22) return cbu;

    return clean.match(/.{1,4}/g).join(' ');
}

/**
 * Convierte una fecha DD/MM/YYYY a YYYY-MM-DD
 * @param {string} dateStr - Fecha en formato DD/MM/YYYY
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
function parseArgDate(dateStr) {
    if (!dateStr) return '';

    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// =====================================================
// VALIDACIONES
// =====================================================

/**
 * Valida un CUIT argentino
 * @param {string} cuit - CUIT a validar
 * @returns {boolean} - True si es válido
 */
function validarCUIT(cuit) {
    if (!cuit) return false;

    // Remover guiones y espacios
    const clean = cuit.replace(/[-\s]/g, '');

    // Debe tener 11 dígitos
    if (clean.length !== 11 || !/^\d+$/.test(clean)) {
        return false;
    }

    // Validar dígito verificador
    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 10; i++) {
        suma += parseInt(clean[i]) * mult[i];
    }

    const resto = suma % 11;
    const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;

    return parseInt(clean[10]) === verificador;
}

/**
 * Valida un CBU argentino
 * @param {string} cbu - CBU a validar
 * @returns {boolean} - True si es válido
 */
function validarCBU(cbu) {
    if (!cbu) return false;

    const clean = cbu.replace(/\s/g, '');

    // Debe tener 22 dígitos
    if (clean.length !== 22 || !/^\d+$/.test(clean)) {
        return false;
    }

    // Validar primer bloque (8 dígitos)
    const bloque1 = clean.substring(0, 8);
    const dv1 = parseInt(bloque1[7]);

    const suma1 = parseInt(bloque1[0]) * 7 +
                  parseInt(bloque1[1]) * 1 +
                  parseInt(bloque1[2]) * 3 +
                  parseInt(bloque1[3]) * 9 +
                  parseInt(bloque1[4]) * 7 +
                  parseInt(bloque1[5]) * 1 +
                  parseInt(bloque1[6]) * 3;

    const verificador1 = (10 - (suma1 % 10)) % 10;

    if (dv1 !== verificador1) return false;

    // Validar segundo bloque (14 dígitos)
    const bloque2 = clean.substring(8, 22);
    const dv2 = parseInt(bloque2[13]);

    const suma2 = parseInt(bloque2[0]) * 3 +
                  parseInt(bloque2[1]) * 9 +
                  parseInt(bloque2[2]) * 7 +
                  parseInt(bloque2[3]) * 1 +
                  parseInt(bloque2[4]) * 3 +
                  parseInt(bloque2[5]) * 9 +
                  parseInt(bloque2[6]) * 7 +
                  parseInt(bloque2[7]) * 1 +
                  parseInt(bloque2[8]) * 3 +
                  parseInt(bloque2[9]) * 9 +
                  parseInt(bloque2[10]) * 7 +
                  parseInt(bloque2[11]) * 1 +
                  parseInt(bloque2[12]) * 3;

    const verificador2 = (10 - (suma2 % 10)) % 10;

    return dv2 === verificador2;
}

/**
 * Valida un email
 * @param {string} email - Email a validar
 * @returns {boolean} - True si es válido
 */
function validarEmail(email) {
    if (!email) return false;

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// =====================================================
// MANEJO DE ARCHIVOS
// =====================================================

/**
 * Obtiene el tamaño de un archivo en formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado (ej: 1.5 MB)
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Valida que un archivo sea imagen o PDF
 * @param {File} file - Archivo a validar
 * @returns {object} - {valid: boolean, error: string}
 */
function validarArchivoComprobante(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (!file) {
        return { valid: false, error: 'No se ha seleccionado ningún archivo' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'El archivo es demasiado grande (máximo 10MB)' };
    }

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Formato no permitido. Solo JPG, PNG o PDF' };
    }

    return { valid: true, error: null };
}

/**
 * Genera un nombre de archivo único
 * @param {string} originalName - Nombre original del archivo
 * @returns {string} - Nombre único
 */
function generarNombreArchivoUnico(originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

    return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
}

// =====================================================
// UI HELPERS
// =====================================================

/**
 * Muestra un mensaje de notificación
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: success, error, warning, info
 * @param {number} duration - Duración en ms (default: 3000)
 */
function showNotification(message, type = 'info', duration = 3000) {
    // Remover notificación anterior si existe
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remover después de la duración
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

/**
 * Muestra un modal de confirmación
 * @param {string} message - Mensaje de confirmación
 * @param {function} onConfirm - Callback al confirmar
 * @param {function} onCancel - Callback al cancelar
 */
function showConfirm(message, onConfirm, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Confirmación</h3>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-action="cancel">Cancelar</button>
                <button class="btn btn-primary" data-action="confirm">Confirmar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Animar entrada
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);

    // Manejar clicks
    modal.querySelector('[data-action="confirm"]').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    modal.querySelector('[data-action="cancel"]').onclick = () => {
        modal.remove();
        if (onCancel) onCancel();
    };

    // Cerrar al hacer click fuera
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    };
}

/**
 * Muestra un loader
 * @param {string} message - Mensaje a mostrar
 * @returns {object} - Objeto con método hide()
 */
function showLoader(message = 'Cargando...') {
    const loader = document.createElement('div');
    loader.className = 'loader-overlay';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;

    document.body.appendChild(loader);

    return {
        hide: () => loader.remove(),
        updateMessage: (newMessage) => {
            loader.querySelector('p').textContent = newMessage;
        }
    };
}

/**
 * Debounce function para optimizar búsquedas
 * @param {function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {function} - Función debounced
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =====================================================
// MANEJO DE ERRORES
// =====================================================

/**
 * Maneja errores de forma consistente
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto del error
 */
function handleError(error, context = '') {
    console.error(`Error en ${context}:`, error);

    let message = 'Ha ocurrido un error inesperado';

    if (error.message) {
        message = error.message;
    }

    if (error.code === 'PGRST116') {
        message = 'No se encontraron registros';
    } else if (error.code === '23505') {
        message = 'Este registro ya existe';
    } else if (error.code === '23503') {
        message = 'No se puede eliminar porque tiene registros relacionados';
    }

    showNotification(message, 'error', 5000);
}

// =====================================================
// UTILIDADES DE FECHA
// =====================================================

/**
 * Obtiene el nombre del mes en español
 * @param {number} month - Número del mes (1-12)
 * @returns {string} - Nombre del mes
 */
function getNombreMes(month) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return meses[month - 1] || '';
}

/**
 * Obtiene el período actual (año-mes)
 * @returns {object} - {year, month}
 */
function getPeriodoActual() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth() + 1
    };
}

/**
 * Formatea un período como string
 * @param {number} year - Año
 * @param {number} month - Mes
 * @returns {string} - Período formateado (ej: "Enero 2024")
 */
function formatPeriodo(year, month) {
    return `${getNombreMes(month)} ${year}`;
}
