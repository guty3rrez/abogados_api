const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./app'); // Importa la aplicación Express configurada
const env = require('./config/env'); // Importa las variables de entorno

// --- Lógica para determinar el modo del servidor ---
const args = process.argv.slice(2); // Obtiene argumentos de la línea de comandos
// Si se pasa 'https' (ignorando mayúsculas/minúsculas), usa HTTPS, sino HTTP
const useHttps = args.some(arg => arg.toLowerCase() === 'https');

// --- Configuración y Arranque del Servidor ---
if (useHttps) {
    // Modo HTTPS
    const keyPath = path.resolve(__dirname, '..', env.sslKeyPath); // Resuelve la ruta absoluta
    const certPath = path.resolve(__dirname, '..', env.sslCertPath); // Resuelve la ruta absoluta

    // Verifica si los archivos SSL existen antes de intentar leerlos
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.error(`Error: SSL key or certificate file not found.`);
        console.error(` Key Path Checked: ${keyPath}`);
        console.error(` Cert Path Checked: ${certPath}`);
        console.error(`Please ensure '${env.sslKeyPath}' and '${env.sslCertPath}' exist in the project root or update paths in .env.`);
        process.exit(1); // Termina si los archivos no existen
    }

    try {
        const httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

        const httpsServer = https.createServer(httpsOptions, app);

        httpsServer.listen(env.portHttps, () => {
            console.log(`🚀 Servidor HTTPS iniciado en puerto ${env.portHttps}`);
            console.log(`   Modo de ejecución: HTTPS`);
            console.log(`   Entorno: ${env.nodeEnv}`);
            console.log(`   Documentación API disponible en: https://localhost:${env.portHttps}/`);
        });

        httpsServer.on('error', (error) => {
            console.error('Error al iniciar el servidor HTTPS:', error);
            process.exit(1);
        });

    } catch (readError) {
         console.error(`Error reading SSL key or certificate file:`, readError);
         process.exit(1);
    }

} else {
    // Modo HTTP (Predeterminado)
    const httpServer = http.createServer(app);

    httpServer.listen(env.portHttp, () => {
        console.log(`🚀 Servidor HTTP iniciado en puerto ${env.portHttp}`);
        console.log(`   Modo de ejecución: HTTP (predeterminado)`);
        console.log(`   Para iniciar en HTTPS, ejecuta: node src/server.js https`);
        console.log(`   Entorno: ${env.nodeEnv}`);
        console.log(`   Documentación API disponible en: http://localhost:${env.portHttp}/`);
    });

     httpServer.on('error', (error) => {
        console.error('Error al iniciar el servidor HTTP:', error);
        process.exit(1);
    });
}