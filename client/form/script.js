document.getElementById('contactForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const indicativoPais = document.getElementById('indicativoPais').value;
  const telefono = document.getElementById('telefono').value;
  const telefonoCompleto = indicativoPais + telefono; // Concatenar indicativo y número

  const formData = {
    nombreCompleto: document.getElementById('nombreCompleto').value,
    email: document.getElementById('email').value,
    telefono: telefonoCompleto, // Enviar el número completo
    zona: document.getElementById('zona').value
  };

  fetch('http://localhost:5000/guardar-formulario', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert(`Error: ${data.error}`);
    } else {
      alert(data.message);
      document.getElementById('contactForm').reset(); // Limpiar el formulario
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Hubo un error al enviar el formulario');
  });
});

document.getElementById('facebookLogin').addEventListener('click', function() {
  // Aquí puedes integrar el SDK de Facebook para manejar el inicio de sesión
  // y obtener los datos del usuario.
  // Ejemplo básico:
  FB.login(function(response) {
      if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          fetch('http://localhost:5000/guardar-facebook', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ accessToken: accessToken })
          })
          .then(response => response.json())
          .then(data => {
              if (data.error) {
                  alert(`Error: ${data.error}`);
              } else {
                  alert(data.message);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              alert('Hubo un error al iniciar sesión con Facebook');
          });
      } else {
          alert('Inicio de sesión con Facebook cancelado');
      }
  }, { scope: 'public_profile,email' });
});