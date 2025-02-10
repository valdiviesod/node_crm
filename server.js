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
  console.log('Conectado a la base de datos');
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

app.post('/enviar-whatsapp', async (req, res) => { // Solo sandbox a 3156130003
  try {
    const { to, body } = req.body;
    
    if (!Array.isArray(to) || to.length === 0 || !body) {
      return res.status(400).json({ 
        error: 'Se requieren destinatarios (array de números) y un mensaje' 
      });
    }

    const promises = to.map(async (number) => {
      // Asegurarse de que el número tenga el formato correcto
      const whatsappNumber = number.startsWith('whatsapp:') ? number : `whatsapp:${number.startsWith('+') ? number : `+${number}`}`;
      
      console.log('Enviando mensaje desde:', `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`);
      console.log('Enviando mensaje a:', whatsappNumber);

      return client.messages.create({
        body: body,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: whatsappNumber
      });
    });

    const messages = await Promise.all(promises);
    
    res.status(200).json({ 
      message: 'Mensajes de WhatsApp enviados correctamente', 
      sids: messages.map(m => m.sid)
    });
  } catch (err) {
    console.error('Error detallado:', {
      message: err.message,
      code: err.code,
      status: err.status,
      moreInfo: err.moreInfo
    });
    res.status(500).json({ 
      error: 'Error al enviar mensajes de WhatsApp', 
      details: err.message 
    });
  }
});

// Endpoint para recibir webhooks de WhatsApp
app.post('/webhook/whatsapp', (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  // Puedes personalizar la respuesta automática aquí
  twiml.message('Gracias por tu mensaje. Te responderemos pronto.');

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/enviar-email', async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !Array.isArray(to) || to.length === 0) {
    return res.status(400).json({ error: 'Destinatarios inválidos' });
  }

  const fromEmail = 'e.marketing@techcis.com.co';

  const messages = to.map(email => ({
    to: email,
    from: fromEmail,
    subject: subject,
    text: text
  }));

  try {
    const results = await sgMail.sendMultiple(messages);
    res.status(200).json({ 
      message: 'Correos enviados correctamente', 
      results: results 
    });
  } catch (error) {
    console.error('Error al enviar correos:', error);
    res.status(500).json({ 
      error: 'Error al enviar correos', 
      details: error.message 
    });
  }
});

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});