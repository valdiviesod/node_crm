document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
  document.getElementById('campaignForm').addEventListener('submit', enviarCampaña);
  document.getElementById('seleccionarTodos').addEventListener('change', seleccionarTodosUsuarios);
});

function cargarUsuarios() {
  const zona = document.getElementById('filtroZona').value;
  let url = 'http://localhost:5000/usuarios';
  if (zona) {
    url += `?zona=${zona}`;
  }

  fetch(url)
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector('#usuariosTable tbody');
    tbody.innerHTML = '';

    // Asegúrate de que data sea un array
    if (Array.isArray(data)) {
      data.forEach(usuario => {
        const row = document.createElement('tr');
        row.innerHTML = `   
          <td><input type="checkbox" class="usuario-checkbox" data-email="${usuario.email}" data-telefono="${usuario.telefono}" data-facebook-id="${usuario.facebook_id}"></td>
          <td>${usuario.tipo}</td>
          <td>${usuario.nombre_completo}</td>
          <td>${usuario.email}</td>
          <td>${usuario.telefono || 'N/A'}</td>
          <td>${usuario.zona || 'N/A'}</td>
        `;
        tbody.appendChild(row);
      });
    } else {
      console.error('La respuesta no es un array:', data);
    }
  })
  .catch(error => console.error('Error al cargar usuarios:', error));
}

function seleccionarTodosUsuarios() {
  const checkboxes = document.querySelectorAll('.usuario-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = document.getElementById('seleccionarTodos').checked;
  });
}

function enviarCampaña(event) {
  event.preventDefault();

  const medios = Array.from(document.querySelectorAll('input[name="tipoCampaña"]:checked')).map(input => input.value);
  const mensaje = document.getElementById('mensaje').value;

  if (medios.length === 0) {
    alert('Selecciona al menos un medio de envío.');
    return;
  }

  const usuariosSeleccionados = Array.from(document.querySelectorAll('.usuario-checkbox:checked'));

  if (usuariosSeleccionados.length === 0) {
    alert('Selecciona al menos un usuario.');
    return;
  }

  usuariosSeleccionados.forEach(usuario => {
    const email = usuario.dataset.email;
    const telefono = usuario.dataset.telefono;
    const facebookId = usuario.dataset.facebookId;

    medios.forEach(medio => {
      let url = '';
      let body = {};

      if (medio === 'sms' && telefono) {
        url = 'http://localhost:5000/enviar-sms';
        body = { telefono, mensaje };
      } else if (medio === 'email' && email) {
        url = 'http://localhost:5000/enviar-email';
        body = { email, asunto: 'Campaña de Marketing', mensaje };
      } else if (medio === 'facebook' && facebookId) {
        url = 'http://localhost:5000/enviar-facebook';
        body = { facebookId, mensaje };
      }

      if (url && body) {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
          .then(response => response.json())
          .then(data => {
            console.log(`Mensaje enviado a ${email || telefono || facebookId}:`, data.message);
          })
          .catch(error => {
            console.error('Error al enviar la campaña:', error);
          });
      }
    });
  });

  alert('Campaña enviada a los usuarios seleccionados.');
  document.getElementById('campaignForm').reset();
}