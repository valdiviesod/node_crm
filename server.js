const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// Configuración de la conexión a la base de datos MariaDB
const connection = mysql.createConnection({
  host: '93.188.164.34',
  user: 'crm_user',
  password: 'Donecenter1701046_*',
  database: 'mycrm'
});

connection.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MariaDB');
});

// Configuración de Twilio para SMS y WhatsApp
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Configuración de Nodemailer para correos electrónicos
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Ruta para guardar los datos del formulario
app.post('/guardar-formulario', (req, res) => {
  const { nombreCompleto, email, telefono, zona } = req.body;

  // Validaciones básicas
  if (!nombreCompleto || !email || !telefono || !zona) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'El email no es válido' });
  }

  const query = 'INSERT INTO formulario (nombre_completo, email, telefono, zona) VALUES (?, ?, ?, ?)';
  connection.query(query, [nombreCompleto, email, telefono, zona], (err, results) => {
    if (err) {
      console.error('Error al guardar los datos:', err);
      return res.status(500).json({ error: 'Error al guardar los datos en la base de datos' });
    }
    res.status(200).json({ message: 'Datos guardados correctamente' });
  });
});

// Ruta para obtener usuarios filtrados por zona
app.get('/usuarios', (req, res) => {
  const { zona } = req.query;

  let query = `
    SELECT 'formulario' AS tipo, nombre_completo, email, telefono, zona FROM formulario
  `;

  if (zona) {
    query += ` WHERE zona = '${zona}'`;
  }

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los usuarios:', err);
      return res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
    res.status(200).json(results);
  });
});

app.post('/enviar-sms-multiples', (req, res) => {
  const { to, body } = req.body;

  const promises = to.map(number => {
    return client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER, // Asegúrate de que el número de Twilio esté correctamente configurado
      to: number
    });
  });

  Promise.all(promises)
    .then(messages => res.status(200).json({ message: 'SMS enviados correctamente', sids: messages.map(m => m.sid) }))
    .catch(err => res.status(500).json({ error: 'Error al enviar SMS', details: err }));
});

// Ruta para enviar WhatsApp a múltiples usuarios
app.post('/enviar-whatsapp-multiples', (req, res) => {
  const { to, body } = req.body;

  const promises = to.map(number => {
    return client.messages.create({
      body: body,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${number}`
    });
  });

  Promise.all(promises)
    .then(messages => res.status(200).json({ message: 'WhatsApps enviados correctamente', sids: messages.map(m => m.sid) }))
    .catch(err => res.status(500).json({ error: 'Error al enviar WhatsApp', details: err }));
});

// Ruta para enviar correo electrónico a múltiples usuarios
app.post('/enviar-email-multiples', (req, res) => {
  const { to, subject, text } = req.body;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to.join(','), // Enviar a múltiples destinatarios
    subject: subject,
    text: text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ error: 'Error al enviar el correo', details: error });
    }
    res.status(200).json({ message: 'Correos enviados correctamente', info: info });
  });
});

// Función para validar email
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});