document.addEventListener('DOMContentLoaded', () => {
    cargarUsuarios();
    document.getElementById('campaignForm').addEventListener('submit', enviarCampaña);
  });
  
  function cargarUsuarios() {
    fetch('http://localhost:5000/usuarios')
      .then(response => response.json())
      .then(data => {
        const tbody = document.querySelector('#usuariosTable tbody');
        tbody.innerHTML = '';
  
        data.forEach(usuario => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${usuario.tipo}</td>
            <td>${usuario.nombre_completo}</td>
            <td>${usuario.email}</td>
            <td>${usuario.telefono || 'N/A'}</td>
            <td>${usuario.zona || 'N/A'}</td>
            <td>
              <button onclick="seleccionarDestinatario('${usuario.email}', '${usuario.telefono}', '${usuario.facebook_id}')">Seleccionar</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      })
      .catch(error => console.error('Error al cargar usuarios:', error));
  }
  
  function seleccionarDestinatario(email, telefono, facebookId) {
    const tipoCampaña = document.getElementById('tipoCampaña').value;
    const destinatario = document.getElementById('destinatario');
  
    if (tipoCampaña === 'email') {
      destinatario.value = email;
    } else if (tipoCampaña === 'sms') {
      destinatario.value = telefono;
    } else if (tipoCampaña === 'facebook') {
      destinatario.value = facebookId;
    }
  }
  
  function enviarCampaña(event) {
    event.preventDefault();
  
    const tipoCampaña = document.getElementById('tipoCampaña').value;
    const destinatario = document.getElementById('destinatario').value;
    const mensaje = document.getElementById('mensaje').value;
  
    let url = '';
    let body = {};
  
    if (tipoCampaña === 'sms') {
      url = 'http://localhost:5000/enviar-sms';
      body = { telefono: destinatario, mensaje };
    } else if (tipoCampaña === 'email') {
      url = 'http://localhost:5000/enviar-email';
      body = { email: destinatario, asunto: 'Campaña de Marketing', mensaje };
    } else if (tipoCampaña === 'facebook') {
      url = 'http://localhost:5000/enviar-facebook';
      body = { facebookId: destinatario, mensaje };
    }
  
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then(response => response.json())
      .then(data => {
        alert(data.message);
        document.getElementById('campaignForm').reset();
      })
      .catch(error => {
        console.error('Error al enviar la campaña:', error);
        alert('Hubo un error al enviar la campaña');
      });
  }