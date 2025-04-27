const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/apiRoutes'); // Importa las rutas definidas
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const env = require('./config/env'); // Carga la configuración del entorno

// Crea la instancia de la aplicación Express
const app = express();

// --- Middleware Esenciales ---
app.use(cors()); // Habilita CORS para todas las rutas (ajusta según necesidad)
app.use(express.json()); // Parsea bodies de request JSON
app.use(express.urlencoded({ extended: true })); // Parsea bodies de request URL-encoded

// --- Rutas de la API ---
// Prefijo para todas las rutas de la API (buena práctica)
app.use('/api', apiRoutes);

// --- Ruta para Documentación Estática ---
// Sirve el archivo HTML de documentación en la ruta raíz '/'
app.get('/', (req, res) => {
    const docPath = path.join(__dirname, '../api-docs.html'); // Asegura la ruta correcta
    res.sendFile(docPath, (err) => {
      if (err) {
        console.error("Error sending documentation file:", err);
        // Si hay un error (ej. archivo no encontrado), envía un 404 o 500
        if (!res.headersSent) { // Verifica si no se envió ya una respuesta
          res.status(err.status === 404 ? 404 : 500).send("Error loading API documentation.");
        }
      }
    });
});

// --- Middleware para Manejo de Errores y Rutas No Encontradas ---
// Debe ir *después* de todas las rutas definidas
app.use(notFoundHandler); // Captura 404
app.use(errorHandler);    // Captura otros errores (pasados con next(err))

module.exports = app; // Exporta la app configurada para usarla en server.js