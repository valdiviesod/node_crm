const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const twilio = require('twilio');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// Configuración de la base de datos
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

let sock;
let qrCode = null;

const initializeWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401; // No reconectar si el error es de autenticación
      console.log('Conexión cerrada, reconectando...', lastDisconnect.error);

      if (shouldReconnect) {
        setTimeout(() => {
          console.log('Reconectando...');
          initializeWhatsApp(); // Llama a la función de inicialización nuevamente
        }, 5000); // Espera 5 segundos antes de reconectar
      }
    } else if (connection === 'open') {
      console.log('Conexión exitosa con WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    console.log(`New message from ${msg.key.remoteJid}:`, msg.message);
  });
};

initializeWhatsApp(); // Inicializa la conexión por primera vez

// Ruta para obtener el QR
app.get('/qr', (req, res) => {
  if (qrCode) {
    qrcode.generate(qrCode, { small: true }, (qrcode) => {
      res.send(`<pre>${qrcode}</pre>`);
    });
  } else {
    res.send('No QR code available');
  }
});


// Ruta para enviar mensajes de WhatsApp
app.post('/enviar-whatsapp', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    await sock.sendMessage(to, { text: message });
    res.status(200).json({ message: 'Mensaje enviado correctamente' });
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ error: 'Error al enviar mensaje', details: err });
  }
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const codigosTemporales = new Map(); // Almacena los códigos temporales

// Función para generar un código de validación
const generarCodigoTemporal = () => {
  return Math.floor(100000 + Math.random() * 900000); // Código de 6 dígitos
};

// Función para eliminar códigos expirados
const limpiarCodigosExpirados = () => {
  const ahora = Date.now();
  for (const [email, { expiracion }] of codigosTemporales.entries()) {
    if (ahora > expiracion) {
      codigosTemporales.delete(email); // Eliminar el código expirado
    }
  }
};

app.post('/guardar-formulario', (req, res) => {
  const { nombreCompleto, email, telefono, zona } = req.body;

  if (!nombreCompleto || !email || !telefono || !zona) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'El email no es válido' });
  }

  // Verificar si el correo ya está registrado
  const checkEmailQuery = 'SELECT * FROM formulario WHERE email = ?';
  connection.query(checkEmailQuery, [email], (err, results) => {
    if (err) {
      console.error('Error al verificar el correo:', err);
      return res.status(500).json({ error: 'Error al verificar el correo' });
    }

    if (results.length > 0) {
      // El correo ya está registrado, generar un código de validación
      const codigoValidacion = generarCodigoTemporal();
      const expiracion = Date.now() + 5 * 60 * 1000; // 5 minutos de expiración

      // Almacenar el código en memoria
      codigosTemporales.set(email, { codigoValidacion, expiracion });

      // Enviar el código de validación por SMS
      client.messages.create({
        body: `Tu código de validación es: ${codigoValidacion}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: telefono
      })
      .then(() => {
        res.status(200).json({ message: 'Código de validación enviado por SMS', codigoValidacion });
      })
      .catch(err => {
        console.error('Error al enviar SMS:', err);
        res.status(500).json({ error: 'Error al enviar SMS', details: err });
      });
    } else {
      // El correo no está registrado, proceder a guardar los datos
      const insertQuery = 'INSERT INTO formulario (nombre_completo, email, telefono, zona) VALUES (?, ?, ?, ?)';
      connection.query(insertQuery, [nombreCompleto, email, telefono, zona], (err, results) => {
        if (err) {
          console.error('Error al guardar los datos:', err);
          return res.status(500).json({ error: 'Error al guardar los datos en la base de datos' });
        }
        res.status(200).json({ message: 'Datos guardados correctamente' });
      });
    }
  });
});


app.post('/validar-codigo', (req, res) => {
  const { email, codigoIngresado } = req.body;

  if (!email || !codigoIngresado) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // Limpiar códigos expirados antes de validar
  limpiarCodigosExpirados();

  // Obtener el código almacenado en memoria
  const codigoGuardado = codigosTemporales.get(email);

  if (!codigoGuardado) {
    return res.status(400).json({ error: 'Código no encontrado o expirado' });
  }

  // Comparar el código ingresado con el código guardado
  if (codigoIngresado == codigoGuardado.codigoValidacion) {
    // Código válido, eliminar el código de memoria
    codigosTemporales.delete(email);
    res.status(200).json({ message: 'Código validado correctamente' });
  } else {
    // Código inválido
    res.status(400).json({ error: 'Código de validación incorrecto' });
  }
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