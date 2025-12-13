/**
 * Módulo de Notas de Desarrollo
 * Gestión de bugs, mejoras y tareas pendientes durante el desarrollo
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'contable_shared_devNotes';
    let currentFilter = 'todos';

    // Nombres de herramientas para mostrar
    const herramientasNombres = {
        'mercado-pago': 'Mercado Pago',
        'conversor-asientos': 'Conversor Asientos',
        'extractos-bancarios': 'Extractos Bancarios',
        'servicios-outsourcing': 'Outsourcing',
        'conversor-veps': 'VEPs ARCA',
        'conciliador': 'Conciliador',
        'combinador': 'Combinador Excel',
        'segmentador': 'Segmentador',
        'auditoria': 'Auditoría',
        'general': 'General'
    };

    // Obtener todas las notas
    function getNotes() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            console.error('Error al cargar notas:', e);
            return [];
        }
    }

    // Guardar notas
    function saveNotes(notes) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
            // Actualizar badge en navbar
            if (window.GlobalNav && window.GlobalNav.updateDevNotesBadge) {
                window.GlobalNav.updateDevNotesBadge();
            }
        } catch (e) {
            console.error('Error al guardar notas:', e);
        }
    }

    // Agregar nueva nota
    function addNote(titulo, descripcion, herramienta, prioridad) {
        const notes = getNotes();
        const newNote = {
            id: Date.now().toString(),
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            herramienta: herramienta || 'general',
            prioridad: prioridad || 'media',
            status: 'pendiente',
            fechaCreacion: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        };
        notes.unshift(newNote);
        saveNotes(notes);
        return newNote;
    }

    // Actualizar estado de nota
    function updateNoteStatus(noteId, newStatus) {
        const notes = getNotes();
        const noteIndex = notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            notes[noteIndex].status = newStatus;
            notes[noteIndex].fechaActualizacion = new Date().toISOString();
            saveNotes(notes);
        }
    }

    // Eliminar nota
    function deleteNote(noteId) {
        const notes = getNotes();
        const filteredNotes = notes.filter(n => n.id !== noteId);
        saveNotes(filteredNotes);
    }

    // Obtener siguiente estado
    function getNextStatus(currentStatus) {
        const statusFlow = {
            'pendiente': 'en_progreso',
            'en_progreso': 'completado',
            'completado': 'pendiente'
        };
        return statusFlow[currentStatus] || 'pendiente';
    }

    // Formatear fecha
    function formatDate(isoDate) {
        const date = new Date(isoDate);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    // Obtener etiqueta de estado
    function getStatusLabel(status) {
        const labels = {
            'pendiente': 'Pendiente',
            'en_progreso': 'En Progreso',
            'completado': 'Completado'
        };
        return labels[status] || status;
    }

    // Renderizar estadísticas
    function renderStats() {
        const notes = getNotes();
        const stats = {
            pendiente: notes.filter(n => n.status === 'pendiente').length,
            en_progreso: notes.filter(n => n.status === 'en_progreso').length,
            completado: notes.filter(n => n.status === 'completado').length
        };

        const statsContainer = document.getElementById('devNotesStats');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
            <div class="dev-notes-stat pendiente">
                <span class="dev-notes-stat-value">${stats.pendiente}</span>
                <span>Pendientes</span>
            </div>
            <div class="dev-notes-stat en_progreso">
                <span class="dev-notes-stat-value">${stats.en_progreso}</span>
                <span>En Progreso</span>
            </div>
            <div class="dev-notes-stat completado">
                <span class="dev-notes-stat-value">${stats.completado}</span>
                <span>Completados</span>
            </div>
        `;
    }

    // Renderizar lista de notas
    function renderNotesList() {
        const notes = getNotes();
        const listContainer = document.getElementById('devNotesList');
        if (!listContainer) return;

        // Filtrar según estado actual
        let filteredNotes = notes;
        if (currentFilter !== 'todos') {
            filteredNotes = notes.filter(n => n.status === currentFilter);
        }

        if (filteredNotes.length === 0) {
            listContainer.innerHTML = `
                <div class="dev-notes-empty">
                    <div class="dev-notes-empty-icon">📋</div>
                    <p>${currentFilter === 'todos' ? 'No hay notas registradas' : 'No hay notas con este estado'}</p>
                    <p style="font-size: 12px; margin-top: 8px;">Agrega una nota usando el formulario de arriba</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filteredNotes.map(note => `
            <div class="dev-note-card status-${note.status}" data-id="${note.id}">
                <div class="dev-note-header">
                    <h4 class="dev-note-title">${escapeHtml(note.titulo)}</h4>
                    <div class="dev-note-meta">
                        ${note.herramienta ? `<span class="dev-note-herramienta">${herramientasNombres[note.herramienta] || note.herramienta}</span>` : ''}
                        <span class="dev-note-prioridad ${note.prioridad}">${note.prioridad.charAt(0).toUpperCase() + note.prioridad.slice(1)}</span>
                    </div>
                </div>
                ${note.descripcion ? `<p class="dev-note-description">${escapeHtml(note.descripcion)}</p>` : ''}
                <div class="dev-note-footer">
                    <span class="dev-note-date">Creado: ${formatDate(note.fechaCreacion)}</span>
                    <div class="dev-note-actions">
                        <button class="btn-status" onclick="DevNotes.cycleStatus('${note.id}')" title="Cambiar estado">
                            ${getStatusLabel(note.status)} → ${getStatusLabel(getNextStatus(note.status))}
                        </button>
                        <button class="btn-delete-note" onclick="DevNotes.confirmDelete('${note.id}')" title="Eliminar nota">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Escapar HTML para prevenir XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Ciclar estado de nota
    function cycleStatus(noteId) {
        const notes = getNotes();
        const note = notes.find(n => n.id === noteId);
        if (note) {
            const newStatus = getNextStatus(note.status);
            updateNoteStatus(noteId, newStatus);
            render();
        }
    }

    // Confirmar eliminación
    function confirmDelete(noteId) {
        if (confirm('¿Estás seguro de que deseas eliminar esta nota?')) {
            deleteNote(noteId);
            render();
        }
    }

    // Renderizar todo
    function render() {
        renderStats();
        renderNotesList();
    }

    // Configurar event listeners
    function setupEventListeners() {
        // Botón de cerrar modal
        const btnClose = document.getElementById('btnCloseDevNotes');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                const modal = document.getElementById('modalDevNotes');
                if (modal) modal.classList.add('hidden');
            });
        }

        // Cerrar modal al hacer clic fuera
        const modal = document.getElementById('modalDevNotes');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }

        // Botón de agregar nota
        const btnAgregar = document.getElementById('btnAgregarNota');
        if (btnAgregar) {
            btnAgregar.addEventListener('click', () => {
                const titulo = document.getElementById('devNoteTitulo').value;
                const descripcion = document.getElementById('devNoteDescripcion').value;
                const herramienta = document.getElementById('devNoteHerramienta').value;
                const prioridad = document.getElementById('devNotePrioridad').value;

                if (!titulo.trim()) {
                    alert('Por favor ingresa un título para la nota');
                    return;
                }

                addNote(titulo, descripcion, herramienta, prioridad);

                // Limpiar formulario
                document.getElementById('devNoteTitulo').value = '';
                document.getElementById('devNoteDescripcion').value = '';
                document.getElementById('devNoteHerramienta').value = '';
                document.getElementById('devNotePrioridad').value = 'media';

                render();
            });
        }

        // Filtros
        const filtersContainer = document.getElementById('devNotesFilters');
        if (filtersContainer) {
            filtersContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    // Actualizar botón activo
                    filtersContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');

                    // Actualizar filtro y re-renderizar
                    currentFilter = e.target.dataset.filter;
                    renderNotesList();
                }
            });
        }

        // Enter en campo de título para agregar rápidamente
        const tituloInput = document.getElementById('devNoteTitulo');
        if (tituloInput) {
            tituloInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    btnAgregar.click();
                }
            });
        }
    }

    // Inicializar
    function init() {
        setupEventListeners();
        // Actualizar badge inicial
        if (window.GlobalNav && window.GlobalNav.updateDevNotesBadge) {
            setTimeout(() => window.GlobalNav.updateDevNotesBadge(), 100);
        }
    }

    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exportar API global
    window.DevNotes = {
        getNotes,
        addNote,
        updateNoteStatus,
        deleteNote,
        cycleStatus,
        confirmDelete,
        render
    };

})();
