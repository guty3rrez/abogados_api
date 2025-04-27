const dotenv = require('dotenv');
const path = require('path');

// Carga las variables desde el archivo .env en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
    nodeEnv: process.env.NODE_ENV || 'development',
    portHttp: parseInt(process.env.PORT_HTTP || '3000', 10),
    portHttps: parseInt(process.env.PORT_HTTPS || '443', 10),
    databaseUrl: process.env.DATABASE_URL, // pg usa esta variable automáticamente
    sslKeyPath: process.env.SSL_KEY_PATH || 'key.pem', // Ruta relativa a la raíz del proyecto
    sslCertPath: process.env.SSL_CERT_PATH || 'cert.pem', // Ruta relativa a la raíz del proyecto
    // Puedes añadir más variables de entorno aquí si las necesitas
};