document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault();
  
    const formData = {
      nombreCompleto: document.getElementById('nombreCompleto').value,
      email: document.getElementById('email').value,
      telefono: document.getElementById('telefono').value,
      indicativoPais: document.getElementById('indicativoPais').value,
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