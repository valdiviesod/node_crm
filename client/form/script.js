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

  fetch('http://172.23.166.191:5000/guardar-formulario', {
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

const validarCodigo = async (email, codigoIngresado) => {
  try {
    const response = await fetch('http://172.23.166.191:5000/validar-codigo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, codigoIngresado }),
    });

    const data = await response.json();
    if (response.ok) {
      alert(data.message); // "Código validado correctamente"
    } else {
      alert(data.error); // "Código de validación incorrecto"
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Hubo un error al validar el código');
  }
};