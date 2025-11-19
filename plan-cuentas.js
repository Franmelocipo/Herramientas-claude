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
   * @returns {Promise<Array>} Lista de cuentas
   */
  window.obtenerPlanCuentas = async function(clienteId) {
    try {
      console.log('📊 Obteniendo plan de cuentas para cliente:', clienteId);

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('codigo', { ascending: true });

      if (error) {
        console.error('❌ Error:', error);
        return [];
      }

      console.log('✅ Plan de cuentas obtenido:', data);
      return data || [];
    } catch (err) {
      console.error('❌ Error general:', err);
      return [];
    }
  };

  /**
   * Crear una cuenta en el plan
   * @param {string} clienteId - ID del cliente
   * @param {string} codigo - Código de la cuenta
   * @param {string} cuenta - Descripción de la cuenta
   * @param {string} tipo - Tipo de cuenta
   * @returns {Promise<Object|null>} Cuenta creada o null
   */
  window.crearCuenta = async function(clienteId, codigo, cuenta, tipo) {
    try {
      console.log('📝 Creando cuenta:', codigo, cuenta, tipo);

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .insert([
          {
            cliente_id: clienteId,
            codigo: codigo,
            cuenta: cuenta,
            tipo: tipo
          }
        ])
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
   * @returns {Promise<Object|null>} Cuenta actualizada o null
   */
  window.actualizarCuenta = async function(cuentaId, codigo, cuenta, tipo) {
    try {
      console.log('✏️ Actualizando cuenta:', cuentaId);

      const { data, error } = await supabaseClient
        .from('plan_cuentas')
        .update({
          codigo: codigo,
          cuenta: cuenta,
          tipo: tipo
        })
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
   * Importar plan de cuentas desde archivo Excel
   * @param {File} file - Archivo Excel
   * @param {string} clienteId - ID del cliente
   * @returns {Promise<Object>} Resultado de la importación
   */
  window.importarPlanCuentas = async function(file, clienteId) {
    try {
      console.log('📤 Importando plan de cuentas...');

      // Validar que hay un cliente activo
      if (!clienteId) {
        alert('Debe seleccionar un cliente antes de importar el plan de cuentas');
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
        return { success: false, imported: 0 };
      }

      // Verificar si el cliente ya tiene plan de cuentas
      const planExistente = await obtenerPlanCuentas(clienteId);

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
          await eliminarPlanCuentas(clienteId);
        } else {
          console.log('➕ Agregando cuentas al plan existente...');
        }
      }

      // Importar cuentas
      let imported = 0;
      let errors = 0;

      for (let i = 0; i < cuentas.length; i++) {
        const cuenta = cuentas[i];

        // Mostrar progreso
        const progressMsg = `Importando cuenta ${i + 1} de ${cuentas.length}...`;
        console.log(progressMsg);

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

      // Mensaje final
      const mensaje = `Se importaron ${imported} cuenta(s) exitosamente${errors > 0 ? `\nErrores: ${errors}` : ''}`;
      alert(mensaje);
      console.log('✅ Importación completada:', { imported, errors });

      return { success: true, imported, errors };
    } catch (error) {
      console.error('❌ Error importando plan de cuentas:', error);
      alert('Error al importar plan de cuentas: ' + error.message);
      return { success: false, imported: 0 };
    }
  };

  console.log('✅ Funciones de plan de cuentas disponibles:');
  console.log('  - seleccionarCliente(clienteId, razonSocial)');
  console.log('  - obtenerClienteActivo()');
  console.log('  - limpiarClienteActivo()');
  console.log('  - obtenerPlanCuentas(clienteId)');
  console.log('  - crearCuenta(clienteId, codigo, cuenta, tipo)');
  console.log('  - actualizarCuenta(cuentaId, codigo, cuenta, tipo)');
  console.log('  - eliminarCuenta(cuentaId)');
  console.log('  - eliminarPlanCuentas(clienteId)');
  console.log('  - descargarPlantillaPlan()');
  console.log('  - importarPlanCuentas(file, clienteId)');
});
