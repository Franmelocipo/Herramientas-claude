// plan-cuentas.js
// Gestión de Plan de Cuentas por Cliente con Supabase

// Esperar a que Supabase esté inicializado
function waitForSupabasePlanCuentas(callback) {
  if (window.supabase) {
    callback();
  } else {
    setTimeout(() => waitForSupabasePlanCuentas(callback), 100);
  }
}

// Inicializar cuando Supabase esté listo
waitForSupabasePlanCuentas(() => {
  console.log('✅ Plan de Cuentas module loaded');

  const supabaseClient = window.supabase.createClient(
    'https://wnpjvnmyfkgtpwqnbmxa.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGp2bm15ZmtndHB3cW5ibXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzE5OTAsImV4cCI6MjA3ODcwNzk5MH0.XmYGTMuQBJBpUMAij90T6z4SlCMugVWuWdwJ84GiPn8'
  );

  // =====================================================
  // FUNCIONES DE GESTIÓN DE CLIENTE ACTIVO
  // =====================================================

  /**
   * Seleccionar un cliente como activo
   * @param {string} clienteId - ID del cliente (UUID)
   * @param {string} razonSocial - Razón social del cliente
   */
  window.seleccionarCliente = function(clienteId, razonSocial) {
    try {
      const clienteActivo = {
        id: clienteId,
        razon_social: razonSocial
      };

      localStorage.setItem('cliente_activo', JSON.stringify(clienteActivo));
      console.log('✅ Cliente activo seleccionado:', razonSocial);

      // Actualizar el indicador visual
      actualizarIndicadorClienteActivo();

      return true;
    } catch (error) {
      console.error('❌ Error seleccionando cliente:', error);
      return false;
    }
  };

  /**
   * Obtener el cliente activo
   * @returns {Object|null} Cliente activo o null
   */
  window.obtenerClienteActivo = function() {
    try {
      const clienteActivoStr = localStorage.getItem('cliente_activo');
      if (!clienteActivoStr) return null;

      return JSON.parse(clienteActivoStr);
    } catch (error) {
      console.error('❌ Error obteniendo cliente activo:', error);
      return null;
    }
  };

  /**
   * Limpiar el cliente activo
   */
  window.limpiarClienteActivo = function() {
    localStorage.removeItem('cliente_activo');
    console.log('✅ Cliente activo limpiado');
    actualizarIndicadorClienteActivo();
  };

  /**
   * Actualizar el indicador visual de cliente activo en el header
   */
  window.actualizarIndicadorClienteActivo = function() {
    const indicador = document.getElementById('clienteActivoIndicador');
    if (!indicador) return;

    const clienteActivo = obtenerClienteActivo();

    if (clienteActivo) {
      indicador.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge-cliente-activo">✓ ACTIVO</span>
            <strong>Cliente activo:</strong>
            <span style="font-weight: 600;">${clienteActivo.razon_social}</span>
          </div>
          <button onclick="limpiarClienteActivo()" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">✕ Desmarcar</button>
        </div>
      `;
      indicador.classList.add('visible');
    } else {
      indicador.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #64748b;">⚠️ <strong>Cliente activo: Ninguno</strong> - Seleccione un cliente desde el menú de Clientes</span>
        </div>
      `;
      indicador.classList.add('visible');
    }
  };

  // =====================================================
  // FUNCIONES CRUD PARA PLAN DE CUENTAS
  // =====================================================

  /**
   * Obtener plan de cuentas de un cliente
   * @param {string} clienteId - ID del cliente
   * @returns {Promise<Object>} Objeto con {data: Array, error: string|null, isEmpty: boolean}
   */
  window.obtenerPlanCuentas = async function(clienteId) {
    console.log('📊 [obtenerPlanCuentas] ========== INICIO CARGA ==========');
    console.log('   - clienteId recibido:', clienteId);
    console.log('   - tipo:', typeof clienteId);

    try {
      // Validar que se proporcionó un clienteId
      if (!clienteId) {
        console.error('❌ [obtenerPlanCuentas] Error: clienteId es null o undefined');
        return { data: [], error: 'ID de cliente no proporcionado', isEmpty: true };
      }

      // Asegurar que el clienteId sea un string limpio
      const clienteIdStr = String(clienteId).trim();
      console.log('   - clienteId (string):', clienteIdStr);

      // Crear promesa con timeout de 15 segundos
      const timeoutMs = 15000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: La consulta tardó más de 15 segundos')), timeoutMs)
      );

      const queryPromise = supabaseClient
        .from('plan_cuentas')
        .select('*')
        .eq('cliente_id', clienteIdStr)
        .order('codigo', { ascending: true });

      console.log('   - Ejecutando consulta a Supabase...');
      const startTime = Date.now();

      // Ejecutar con timeout
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      console.log(`   - Consulta completada en ${elapsed}ms`);

      if (error) {
        console.error('❌ [obtenerPlanCuentas] Error de Supabase:', error);
        console.error('   - Mensaje:', error.message);
        console.error('   - Código:', error.code);
        console.error('   - Detalles:', error.details);
        console.log('📊 [obtenerPlanCuentas] ========== FIN (CON ERROR) ==========');
        return { data: [], error: `Error de base de datos: ${error.message}`, isEmpty: true };
      }

      const cuentas = data || [];
      const isEmpty = cuentas.length === 0;

      console.log('✅ [obtenerPlanCuentas] Resultado:');
      console.log('   - Total cuentas:', cuentas.length);
      console.log('   - isEmpty:', isEmpty);
      if (cuentas.length > 0) {
        console.log('   - Primera cuenta:', cuentas[0].codigo, '-', cuentas[0].cuenta);
        console.log('   - cliente_id de la primera cuenta:', cuentas[0].cliente_id);
      } else {
        console.log('   - (El cliente no tiene cuentas cargadas)');
      }
      console.log('📊 [obtenerPlanCuentas] ========== FIN (EXITOSO) ==========');

      return { data: cuentas, error: null, isEmpty };
    } catch (err) {
      console.error('❌ [obtenerPlanCuentas] Error general:', err);
      console.error('   - Tipo:', err.name);
      console.error('   - Mensaje:', err.message);
      console.log('📊 [obtenerPlanCuentas] ========== FIN (EXCEPCIÓN) ==========');
      return { data: [], error: err.message, isEmpty: true };
    }
  };

  /**
   * Crear una cuenta en el plan
   * @param {string} clienteId - ID del cliente
   * @param {string} codigo - Código de la cuenta
   * @param {string} cuenta - Descripción de la cuenta
   * @param {string} tipo - Tipo de cuenta
   * @param {Array<string>} codigosImpuesto - Array de códigos de impuesto asociados (opcional)
   * @returns {Promise<Object|null>} Cuenta creada o null
   */
  window.crearCuenta = async function(clienteId, codigo, cuenta, tipo, codigosImpuesto = null) {
    try {
      console.log('📝 Creando cuenta:', codigo, cuenta, tipo, codigosImpuesto);

      const cuentaData = {
        cliente_id: clienteId,
        codigo: codigo,
        cuenta: cuenta,
        tipo: tipo
      };

      // Agregar códigos de impuesto si se proporcionan
      if (codigosImpuesto && codigosImpuesto.length > 0) {
        cuentaData.codigos_impuesto = codigosImpuesto;
      }

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .insert([cuentaData])
        .select();

      if (error) {
        console.error('❌ Error:', error);
        alert('Error al crear cuenta: ' + error.message);
        return null;
      }

      console.log('✅ Cuenta creada:', data);
      return data;
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('Error al crear cuenta');
      return null;
    }
  };

  /**
   * Actualizar una cuenta
   * @param {string} cuentaId - ID de la cuenta
   * @param {string} codigo - Código de la cuenta
   * @param {string} cuenta - Descripción de la cuenta
   * @param {string} tipo - Tipo de cuenta
   * @param {Array<string>} codigosImpuesto - Array de códigos de impuesto asociados (opcional)
   * @returns {Promise<Object|null>} Cuenta actualizada o null
   */
  window.actualizarCuenta = async function(cuentaId, codigo, cuenta, tipo, codigosImpuesto = null) {
    try {
      console.log('✏️ Actualizando cuenta:', cuentaId);

      const updateData = {
        codigo: codigo,
        cuenta: cuenta,
        tipo: tipo
      };

      // Actualizar códigos de impuesto si se proporcionan
      if (codigosImpuesto !== null) {
        updateData.codigos_impuesto = codigosImpuesto.length > 0 ? codigosImpuesto : null;
      }

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .update(updateData)
        .eq('id', cuentaId)
        .select();

      if (error) {
        console.error('❌ Error:', error);
        alert('Error al actualizar cuenta: ' + error.message);
        return null;
      }

      console.log('✅ Cuenta actualizada:', data);
      return data;
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('Error al actualizar cuenta');
      return null;
    }
  };

  /**
   * Eliminar una cuenta
   * @param {string} cuentaId - ID de la cuenta
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  window.eliminarCuenta = async function(cuentaId) {
    try {
      console.log('🗑️ Eliminando cuenta:', cuentaId);

      const { error } = await supabaseClient
        .from('plan_cuentas')
        .delete()
        .eq('id', cuentaId);

      if (error) {
        console.error('❌ Error:', error);
        alert('Error al eliminar cuenta: ' + error.message);
        return false;
      }

      console.log('✅ Cuenta eliminada');
      return true;
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('Error al eliminar cuenta');
      return false;
    }
  };

  /**
   * Eliminar todo el plan de cuentas de un cliente
   * @param {string} clienteId - ID del cliente
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  window.eliminarPlanCuentas = async function(clienteId) {
    try {
      console.log('🗑️ Eliminando plan de cuentas completo del cliente:', clienteId);

      const { error } = await supabaseClient
        .from('plan_cuentas')
        .delete()
        .eq('cliente_id', clienteId);

      if (error) {
        console.error('❌ Error:', error);
        alert('Error al eliminar plan de cuentas: ' + error.message);
        return false;
      }

      console.log('✅ Plan de cuentas eliminado');
      return true;
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('Error al eliminar plan de cuentas');
      return false;
    }
  };

  // =====================================================
  // FUNCIONES DE IMPORTACIÓN/EXPORTACIÓN
  // =====================================================

  /**
   * Descargar plantilla de plan de cuentas en Excel
   */
  window.descargarPlantillaPlan = function() {
    try {
      console.log('📥 Descargando plantilla de plan de cuentas...');

      // Datos de ejemplo
      const data = [
        ['codigo', 'cuenta', 'tipo'],
        ['1.1.1.01', 'Caja', 'Activo'],
        ['1.1.2.01', 'Banco Cuenta Corriente', 'Activo'],
        ['1.2.1.01', 'Créditos por Ventas', 'Activo'],
        ['2.1.1.01', 'Proveedores', 'Pasivo'],
        ['2.1.2.01', 'Sueldos a Pagar', 'Pasivo'],
        ['3.1.1.01', 'Capital Social', 'Patrimonio Neto'],
        ['3.2.1.01', 'Resultados Acumulados', 'Patrimonio Neto'],
        ['4.1.1.01', 'Ventas', 'Ingreso'],
        ['4.2.1.01', 'Intereses Ganados', 'Ingreso'],
        ['5.1.1.01', 'Gastos Administrativos', 'Egreso'],
        ['5.2.1.01', 'Gastos de Comercialización', 'Egreso']
      ];

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Plan de Cuentas');

      // Descargar archivo
      XLSX.writeFile(wb, 'plantilla_plan_cuentas.xlsx');

      console.log('✅ Plantilla descargada exitosamente');
    } catch (error) {
      console.error('❌ Error descargando plantilla:', error);
      alert('Error al descargar plantilla: ' + error.message);
    }
  };

  /**
   * Función auxiliar para esperar un tiempo
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Importar plan de cuentas desde archivo Excel
   * @param {File} file - Archivo Excel
   * @param {string} clienteId - ID del cliente
   * @returns {Promise<Object>} Resultado de la importación
   */
  window.importarPlanCuentas = async function(file, clienteId) {
    // Elementos del DOM para el indicador de progreso
    const progressDiv = document.getElementById('importProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressDetail = document.getElementById('progressDetail');

    try {
      console.log('📤 Importando plan de cuentas...');

      // Mostrar indicador
      if (progressDiv) {
        progressDiv.style.display = 'block';
        progressText.textContent = 'Leyendo archivo Excel...';
        progressBar.style.width = '10%';
        progressBar.style.background = '#2196f3';
      }

      // Validar que hay un cliente activo
      if (!clienteId) {
        alert('Debe seleccionar un cliente antes de importar el plan de cuentas');
        if (progressDiv) progressDiv.style.display = 'none';
        return { success: false, imported: 0 };
      }

      // Leer archivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { raw: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      // Parsear datos (saltar encabezado)
      const cuentas = jsonData.slice(1).map(row => ({
        codigo: String(row[0] || '').trim(),
        cuenta: String(row[1] || '').trim(),
        tipo: String(row[2] || '').trim()
      })).filter(c => c.codigo && c.cuenta);

      if (cuentas.length === 0) {
        alert('No se encontraron cuentas válidas en el archivo');
        if (progressDiv) progressDiv.style.display = 'none';
        return { success: false, imported: 0 };
      }

      if (progressText) progressText.textContent = 'Archivo leído correctamente';
      if (progressDetail) progressDetail.textContent = `Encontradas ${cuentas.length} cuentas`;
      if (progressBar) progressBar.style.width = '30%';

      await delay(500);

      // Verificar si el cliente ya tiene plan de cuentas
      if (progressText) progressText.textContent = 'Validando datos...';
      if (progressBar) progressBar.style.width = '40%';

      const resultadoPlan = await obtenerPlanCuentas(clienteId);
      // Manejar nuevo formato de respuesta {data, error, isEmpty}
      const planExistente = resultadoPlan && resultadoPlan.data ? resultadoPlan.data : (Array.isArray(resultadoPlan) ? resultadoPlan : []);

      if (planExistente.length > 0) {
        const accion = confirm(
          `El cliente ya tiene un plan de cuentas con ${planExistente.length} cuenta(s).\n\n` +
          `¿Desea REEMPLAZARLO completamente?\n\n` +
          `Aceptar = Reemplazar (eliminar todo y crear nuevo)\n` +
          `Cancelar = Agregar cuentas nuevas`
        );

        if (accion) {
          // Reemplazar: eliminar todo primero
          console.log('🔄 Reemplazando plan de cuentas...');
          if (progressText) progressText.textContent = 'Eliminando plan existente...';
          await eliminarPlanCuentas(clienteId);
        } else {
          console.log('➕ Agregando cuentas al plan existente...');
        }
      }

      // Preparar inserción
      if (progressText) progressText.textContent = 'Preparando cuentas...';
      if (progressBar) progressBar.style.width = '50%';

      // Importar cuentas en lotes
      let imported = 0;
      let errors = 0;
      const batchSize = 50;
      const totalBatches = Math.ceil(cuentas.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min((batchIndex + 1) * batchSize, cuentas.length);
        const batch = cuentas.slice(startIdx, endIdx);

        if (progressText) {
          progressText.textContent = `Guardando cuentas... (${batchIndex + 1}/${totalBatches})`;
        }
        if (progressDetail) {
          progressDetail.textContent = `Procesadas ${endIdx} de ${cuentas.length}`;
        }
        if (progressBar) {
          progressBar.style.width = `${50 + (batchIndex / totalBatches) * 45}%`;
        }

        // Procesar el lote
        for (const cuenta of batch) {
          try {
            const result = await crearCuenta(
              clienteId,
              cuenta.codigo,
              cuenta.cuenta,
              cuenta.tipo
            );

            if (result) {
              imported++;
            } else {
              errors++;
            }
          } catch (err) {
            console.error(`Error importando cuenta ${cuenta.codigo}:`, err);
            errors++;
          }
        }

        await delay(100); // Pequeña pausa entre lotes
      }

      // Completado
      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = '✓ Importación completada';
      if (progressDetail) {
        progressDetail.textContent = `${imported} cuentas importadas exitosamente${errors > 0 ? ` (${errors} errores)` : ''}`;
      }

      // Ocultar después de 3 segundos
      setTimeout(() => {
        if (progressDiv) progressDiv.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
      }, 3000);

      console.log('✅ Importación completada:', { imported, errors });

      return { success: true, imported, errors };
    } catch (error) {
      console.error('❌ Error importando plan de cuentas:', error);

      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.background = '#f44336';
      }
      if (progressText) progressText.textContent = '✗ Error en la importación';
      if (progressDetail) progressDetail.textContent = error.message;

      alert('Error al importar plan de cuentas: ' + error.message);
      return { success: false, imported: 0 };
    }
  };

  /**
   * Cargar mapeo de códigos de impuesto a cuentas contables
   * @param {string} clienteId - ID del cliente
   * @returns {Promise<Object>} Mapeo de código_impuesto → {codigo, nombre}
   */
  window.cargarMapeoImpuestos = async function(clienteId) {
    try {
      console.log('📊 Cargando mapeo de impuestos para cliente:', clienteId);

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .select('codigo, cuenta, codigos_impuesto')
        .eq('cliente_id', clienteId)
        .not('codigos_impuesto', 'is', null);

      if (error) {
        console.error('❌ Error:', error);
        return {};
      }

      // Crear mapa: código_impuesto → cuenta_contable
      const mapeo = {};
      if (data && data.length > 0) {
        data.forEach(cuenta => {
          if (cuenta.codigos_impuesto && cuenta.codigos_impuesto.length > 0) {
            cuenta.codigos_impuesto.forEach(codImpuesto => {
              mapeo[codImpuesto] = {
                codigo: cuenta.codigo,
                nombre: cuenta.cuenta
              };
            });
          }
        });
      }

      console.log('✅ Mapeo de impuestos cargado:', Object.keys(mapeo).length, 'códigos');
      return mapeo;
    } catch (err) {
      console.error('❌ Error cargando mapeo de impuestos:', err);
      return {};
    }
  };

  console.log('✅ Funciones de plan de cuentas disponibles:');
  console.log('  - seleccionarCliente(clienteId, razonSocial)');
  console.log('  - obtenerClienteActivo()');
  console.log('  - limpiarClienteActivo()');
  console.log('  - obtenerPlanCuentas(clienteId)');
  console.log('  - crearCuenta(clienteId, codigo, cuenta, tipo, codigosImpuesto)');
  console.log('  - actualizarCuenta(cuentaId, codigo, cuenta, tipo, codigosImpuesto)');
  console.log('  - eliminarCuenta(cuentaId)');
  console.log('  - eliminarPlanCuentas(clienteId)');
  console.log('  - descargarPlantillaPlan()');
  console.log('  - importarPlanCuentas(file, clienteId)');
  console.log('  - cargarMapeoImpuestos(clienteId)');
});
