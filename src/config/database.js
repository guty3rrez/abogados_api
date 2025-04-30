const { Pool } = require('pg');
const env = require('./env'); // Importa las variables de entorno cargadas

// --- Database Connection Pool ---
const poolConfig = {
    connectionString: env.databaseUrl,
    // ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false, // Descomentar si es necesario
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
/**
 * Asegura que las tablas 'reservations', 'shipping' y 'transactions' existan en la base de datos.
 * Crea las tablas si no existen.
 */
async function ensureTableExists() {
    // Query para crear/verificar la tabla 'reservations'
    const createReservationsTableQuery = `
        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            fecha DATE NOT NULL,
            hora VARCHAR(5) NOT NULL,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            telefono TEXT NOT NULL,
            motivo TEXT,
            estado_pago VARCHAR(10) NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Rechazado', 'Pendiente', 'Aprobado')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (fecha, hora) -- Restricción para evitar duplicados en la misma fecha y hora
        );
    `;

    // Query para asegurar la columna 'estado_pago' en 'reservations' (por si la tabla ya existía sin ella)
    // Nota: Esta query ya está cubierta por la definición en createReservationsTableQuery si la tabla no existe.
    // Es útil si la tabla ya existía pero sin esta columna/constraint.
    const alterReservationsTableQuery = `
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='reservations' AND column_name='estado_pago'
            ) THEN
                ALTER TABLE reservations
                ADD COLUMN estado_pago VARCHAR(10) NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Rechazado', 'Pendiente', 'Aprobado'));
            ELSE
                -- Si la columna existe, aseguramos que la constraint CHECK esté presente (puede fallar si hay datos inválidos)
                -- O simplemente podemos asumir que si la columna existe, está bien definida por la CREATE TABLE inicial.
                -- Para simplificar, no añadiremos la constraint aquí si la columna ya existe,
                -- confiando en que fue creada correctamente o se manejará manualmente.
                RAISE NOTICE 'Column estado_pago already exists in reservations.';
            END IF;
        END $$;
    `;

    // Query para crear/verificar la tabla 'shipping'
    const createShippingTableQuery = `
        CREATE TABLE IF NOT EXISTS shipping (
            id SERIAL PRIMARY KEY,
            reservation_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            calle TEXT NOT NULL,
            numero TEXT NOT NULL,
            depto TEXT,
            region TEXT NOT NULL,
            provincia TEXT NOT NULL,
            codigo_postal TEXT,
            status TEXT NOT NULL DEFAULT 'Pendiente',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_shipping_reservation
                FOREIGN KEY(reservation_id)
                REFERENCES reservations(id)
                ON DELETE CASCADE
        );
    `;
    // Opcional: Crear un índice en shipping.reservation_id para búsquedas más rápidas
    const createShippingIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_shipping_reservation_id ON shipping(reservation_id);
    `;

    // --- NUEVA QUERY PARA CREAR LA TABLA 'transactions' ---
    const createTransactionsTableQuery = `
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            reservation_id INTEGER NOT NULL, -- Clave foránea que apunta a reservations.id
            transbank_token TEXT NULL, -- Token de Transbank (puede ser nulo inicialmente)
            status VARCHAR(30) NOT NULL DEFAULT 'INITIALIZED' CHECK (status IN ('INITIALIZED', 'AUTHORIZED', 'REVERSED', 'FAILED', 'NULLIFIED', 'PARTIALLY_NULLIFIED', 'CAPTURED')),
            buy_order VARCHAR(255) NOT NULL, -- Orden de compra (ajusta longitud si es necesario)
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Para rastrear cambios de estado

            -- Definir la clave foránea que relaciona transactions con reservations
            CONSTRAINT fk_transaction_reservation
                FOREIGN KEY(reservation_id)
                REFERENCES reservations(id)
                ON DELETE CASCADE -- Si se borra una reserva, se borran sus transacciones asociadas. Considera RESTRICT o SET NULL si prefieres otro comportamiento.
        );
    `;

    // --- ÍNDICES OPCIONALES PARA 'transactions' ---
    const createTransactionsReservationIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_transactions_reservation_id ON transactions(reservation_id);
    `;
    const createTransactionsTokenIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_transactions_transbank_token ON transactions(transbank_token); -- Útil si buscas por token
    `;
     const createTransactionsBuyOrderIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_transactions_buy_order ON transactions(buy_order); -- Útil si buscas por buy_order
    `;

    // Trigger para actualizar automáticamente 'updated_at' en 'transactions' (Opcional pero recomendado)
     const createUpdatedAtTriggerFunctionQuery = `
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `;
     const createUpdatedAtTriggerQuery = `
        DROP TRIGGER IF EXISTS set_timestamp ON transactions; -- Borra el trigger viejo si existe
        CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `;


    let client;
    try {
        client = await pool.connect(); // Obtiene un cliente del pool

        // 1. Asegurar que la tabla 'reservations' existe y tiene la columna 'estado_pago'
        await client.query(createReservationsTableQuery);
        console.log("Table 'reservations' checked/created successfully.");
        // Ejecutar ALTER sólo si es estrictamente necesario (la lógica DO $$ la maneja)
        // await client.query(alterReservationsTableQuery); // Comentado porque CREATE TABLE IF NOT EXISTS ya lo cubre si es nueva.
        // console.log("Column 'estado_pago' in 'reservations' checked/added successfully.");

        // 2. Asegurar que la tabla 'shipping' existe (depende de 'reservations' por la FK)
        await client.query(createShippingTableQuery);
        console.log("Table 'shipping' checked/created successfully.");
        await client.query(createShippingIndexQuery);
        console.log("Index 'idx_shipping_reservation_id' on 'shipping' checked/created successfully.");

        // --- 3. Asegurar que la tabla 'transactions' existe (depende de 'reservations' por la FK) ---
        await client.query(createTransactionsTableQuery);
        console.log("Table 'transactions' checked/created successfully.");

        // --- 4. Crear índices para 'transactions' ---
        await client.query(createTransactionsReservationIndexQuery);
        console.log("Index 'idx_transactions_reservation_id' on 'transactions' checked/created successfully.");
        await client.query(createTransactionsTokenIndexQuery);
        console.log("Index 'idx_transactions_transbank_token' on 'transactions' checked/created successfully.");
        await client.query(createTransactionsBuyOrderIndexQuery);
        console.log("Index 'idx_transactions_buy_order' on 'transactions' checked/created successfully.");

        // --- 5. (Opcional) Crear la función y el trigger para updated_at en transactions ---
        await client.query(createUpdatedAtTriggerFunctionQuery);
        console.log("Function 'trigger_set_timestamp' created/updated successfully.");
        await client.query(createUpdatedAtTriggerQuery);
        console.log("Trigger 'set_timestamp' on 'transactions' created successfully.");


    } catch (err) {
        console.error("Error during database table setup:", err.stack); // Mostrar el stack trace completo
        // Considera manejar este error de forma más robusta
        // throw err;
    } finally {
        if (client) {
            client.release(); // Siempre libera el cliente de vuelta al pool
            console.log("Database client released after table setup.");
        }
    }
}

// Llama a la función para asegurar que las tablas existan al iniciar el módulo
ensureTableExists();

module.exports = {
    pool, // Exporta el pool para usarlo en los controladores
    query: (text, params) => pool.query(text, params), // Método de conveniencia para ejecutar consultas
};