const { Pool } = require('pg');
const env = require('./env'); // Importa las variables de entorno cargadas

// --- Database Connection Pool ---
// La biblioteca 'pg' buscará AUTOMÁTICAMENTE la variable de entorno DATABASE_URL si existe
// Si necesitas configuraciones específicas (ej. SSL para producción), puedes hacerlo aquí.
const poolConfig = {
    connectionString: env.databaseUrl,
    // Ejemplo de configuración SSL si DATABASE_URL no la incluye y la necesitas:
    // ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(poolConfig);

// Probar la conexión a la BD al iniciar
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client for initial connection test.', err.stack);
        // Considera terminar la aplicación si la conexión falla al inicio
        // process.exit(1);
        return;
    }
    console.log('Successfully connected to PostgreSQL database.');
    client.query('SELECT NOW()', (err, result) => {
        release(); // Libera el cliente de vuelta al pool
        if (err) {
            return console.error('Error executing initial test query', err.stack);
        }
        console.log('Test query successful. Current DB time:', result.rows[0].now);
    });
});

// --- Helper Function to Create/Ensure Table Structure ---
// **ACTUALIZADO**: Añadida la columna estado_pago
async function ensureTableExists() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            fecha DATE NOT NULL,
            hora VARCHAR(5) NOT NULL,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            telefono TEXT NOT NULL,
            motivo TEXT,
            estado_pago VARCHAR(10) NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Rechazado', 'Pendiente', 'Aprobado')), -- Nueva columna con valores permitidos y default
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (fecha, hora) -- Restricción para evitar duplicados en la misma fecha y hora
        );
    `;
    // Opcional: Añadir la columna si la tabla ya existe y no la tiene
    const alterTableQuery = `
        ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(10) NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Rechazado', 'Pendiente', 'Aprobado'));
    `;

    let client;
    try {
        client = await pool.connect(); // Obtiene un cliente del pool
        await client.query(createTableQuery);
        console.log("Table 'reservations' checked/created successfully.");
        // Ejecuta el ALTER para asegurar que la columna existe incluso si la tabla ya existía
        await client.query(alterTableQuery);
        console.log("Column 'estado_pago' checked/added successfully.");
    } catch (err) {
        console.error("Error creating/checking/altering reservations table:", err);
        // Considera manejar este error de forma más robusta
    } finally {
       if (client) client.release(); // Siempre libera el cliente
    }
}

// Llama a la función para asegurar que la tabla exista al iniciar el módulo
ensureTableExists();

module.exports = {
    pool, // Exporta el pool para usarlo en los controladores
    query: (text, params) => pool.query(text, params), // Método de conveniencia para ejecutar consultas
};