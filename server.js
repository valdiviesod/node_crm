const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

connection.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MariaDB');
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

app.post('/guardar-formulario', (req, res) => {
  const { nombreCompleto, email, telefono, zona } = req.body;

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

app.post('/enviar-sms', (req, res) => {
  const { to, body } = req.body;

  const recipients = Array.isArray(to) ? to : [to];

  const promises = recipients.map(number => {
    return client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: number
    });
  });

  Promise.all(promises)
    .then(messages => res.status(200).json({ message: 'SMS enviados correctamente', sids: messages.map(m => m.sid) }))
    .catch(err => res.status(500).json({ error: 'Error al enviar SMS', details: err }));
});

app.post('/enviar-mms', (req, res) => {
  const { to, body, mediaUrl } = req.body;

  const recipients = Array.isArray(to) ? to : [to];

  const promises = recipients.map(number => {
    return client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: number,
      mediaUrl: [mediaUrl] 
    });
  });

  Promise.all(promises)
    .then(messages => res.status(200).json({ message: 'MMS enviados correctamente', sids: messages.map(m => m.sid) }))
    .catch(err => res.status(500).json({ error: 'Error al enviar MMS', details: err }));
});

app.post('/enviar-whatsapp', (req, res) => {
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

app.post('/enviar-email', (req, res) => {
  const { to, subject, text } = req.body;

  const promises = to.map(email => {
    return client.messages.create({
      from: process.env.TWILIO_EMAIL_FROM, 
      to: email,
      subject: subject,
      text: text
    });
  });

  Promise.all(promises)
    .then(messages => res.status(200).json({ message: 'Correos enviados correctamente', sids: messages.map(m => m.sid) }))
    .catch(err => res.status(500).json({ error: 'Error al enviar correos', details: err }));
});

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});