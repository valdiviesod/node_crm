let paginaActual = 1;
const registrosPorPagina = 5;
let usuariosSeleccionadosGlobal = new Set();
let datosUsuariosGlobal = []; // Para mantener los datos entre páginas

document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios(paginaActual);

  const campaignForm = document.getElementById('campaignForm');
  if (campaignForm) {
    campaignForm.addEventListener('submit', enviarCampaña);
  }

  // Agregar evento para checkboxes individuales
  document.querySelector('#usuariosTable tbody').addEventListener('change', (e) => {
    if (e.target.classList.contains('usuario-checkbox')) {
      const email = e.target.dataset.email;
      if (e.target.checked) {
        usuariosSeleccionadosGlobal.add(email);
      } else {
        usuariosSeleccionadosGlobal.delete(email);
      }
      actualizarSeleccionarTodos();
    }
  });
});

function cargarUsuarios(pagina = 1) {
  const zona = document.getElementById('filtroZona').value;
  let url = 'http://localhost:5000/usuarios';
  if (zona) {
    url += `?zona=${zona}`;
  }

  fetch(url)
    .then(response => response.json())
    .then(data => {
      datosUsuariosGlobal = data; // Guardar los datos completos
      mostrarPagina(pagina);
    })
    .catch(error => console.error('Error al cargar usuarios:', error));
}

function mostrarPagina(pagina) {
  const tbody = document.querySelector('#usuariosTable tbody');
  if (tbody) {
    tbody.innerHTML = '';

    const inicio = (pagina - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const usuariosPagina = datosUsuariosGlobal.slice(inicio, fin);

    usuariosPagina.forEach(usuario => {
      const row = document.createElement('tr');
      row.innerHTML = `   
        <td><input type="checkbox" class="usuario-checkbox" data-email="${usuario.email}" data-telefono="${usuario.telefono}" ${usuariosSeleccionadosGlobal.has(usuario.email) ? 'checked' : ''}></td>
        <td>${usuario.nombre_completo}</td>
        <td>${usuario.email}</td>
        <td>${usuario.telefono || 'N/A'}</td>
        <td>${usuario.zona || 'N/A'}</td>
      `;
      tbody.appendChild(row);
    });

    actualizarPaginacion(datosUsuariosGlobal.length);
    actualizarSeleccionarTodos();
  }
}

function actualizarPaginacion(totalUsuarios) {
  const totalPaginas = Math.ceil(totalUsuarios / registrosPorPagina);
  const paginaActualElement = document.getElementById('paginaActual');
  if (paginaActualElement) {
    paginaActualElement.textContent = `Página ${paginaActual} de ${totalPaginas}`;
  }

  const botonAnterior = document.getElementById('anterior');
  const botonSiguiente = document.getElementById('siguiente');

  if (botonAnterior && botonSiguiente) {
    botonAnterior.disabled = paginaActual === 1;
    botonSiguiente.disabled = paginaActual === totalPaginas;
  }
}

function cambiarPagina(direccion) {
  const totalPaginas = Math.ceil(datosUsuariosGlobal.length / registrosPorPagina);
  const nuevaPagina = paginaActual + direccion;
  
  if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
    paginaActual = nuevaPagina;
    mostrarPagina(paginaActual);
  }
}

function actualizarSeleccionarTodos() {
  const checkboxes = document.querySelectorAll('.usuario-checkbox');
  const seleccionarTodosCheckbox = document.getElementById('seleccionarTodos');
  
  if (checkboxes.length > 0 && seleccionarTodosCheckbox) {
    const todosMarcados = Array.from(checkboxes).every(checkbox => checkbox.checked);
    seleccionarTodosCheckbox.checked = todosMarcados;
  }
}

function enviarCampaña(event) {
  event.preventDefault();

  const medios = Array.from(document.querySelectorAll('input[name="tipoCampaña"]:checked')).map(input => input.value);
  
  if (medios.length === 0) {
    alert('Selecciona al menos un medio de envío.');
    return;
  }

  if (usuariosSeleccionadosGlobal.size === 0) {
    alert('Selecciona al menos un usuario.');
    return;
  }

  const mensaje = document.getElementById('mensaje').value;
  if (!mensaje.trim()) {
    alert('El mensaje no puede estar vacío');
    return;
  }

  const mediaUrl = document.getElementById('mediaUrl').value;
  
  // Obtener los datos de los usuarios seleccionados
  const usuariosSeleccionados = datosUsuariosGlobal.filter(usuario => 
    usuariosSeleccionadosGlobal.has(usuario.email)
  );

  let errores = [];
  let exitosos = 0;
  let promesasEnvio = [];

  usuariosSeleccionados.forEach(usuario => {
    medios.forEach(medio => {
      let url = '';
      let body = {};

      if ((medio === 'sms' || medio === 'mms') && usuario.telefono) {
        url = 'http://localhost:5000/enviar-sms';
        body = {
          to: usuario.telefono, // Cambiado de [usuario.telefono] a usuario.telefono
          message: mensaje, // Cambiado de body a message
          mediaUrl: medio === 'mms' ? mediaUrl : undefined
        };
      } else if (medio === 'email') {
        url = 'http://localhost:5000/enviar-email';
        body = {
          to: [usuario.email],
          subject: document.getElementById('asunto').value || 'Campaña de Marketing',
          text: mensaje
        };
      }

      if (url && body) {
        const promesa = fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log(`Mensaje enviado a ${usuario.email || usuario.telefono}:`, data);
          exitosos++;
        })
        .catch(error => {
          console.error('Error al enviar mensaje:', error);
          errores.push(`Error al enviar ${medio} a ${usuario.email || usuario.telefono}: ${error.message}`);
        });

        promesasEnvio.push(promesa);
      }
    });
  });

  // Esperar a que todos los envíos terminen
  Promise.all(promesasEnvio).finally(() => {
    let mensaje = '';
    if (exitosos > 0) {
      mensaje += `Se enviaron ${exitosos} mensajes exitosamente.\n`;
    }
    if (errores.length > 0) {
      mensaje += `\nHubo ${errores.length} errores:\n${errores.join('\n')}`;
    }
    alert(mensaje);
    
    if (exitosos > 0) {
      document.getElementById('campaignForm').reset();
    }
  });
}

function seleccionarTodosUsuarios() {
  const checkboxes = document.querySelectorAll('.usuario-checkbox');
  const seleccionarTodos = document.getElementById('seleccionarTodos').checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = seleccionarTodos;
    const email = checkbox.dataset.email;
    if (seleccionarTodos) {
      usuariosSeleccionadosGlobal.add(email);
    } else {
      usuariosSeleccionadosGlobal.delete(email);
    }
  });
}