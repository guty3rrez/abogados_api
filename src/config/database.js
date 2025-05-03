// --- START OF FILE database.js ---

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
        // Consider exiting the process if DB connection is critical
        // process.exit(1);
        return;
    }
    console.log('Successfully connected to PostgreSQL database.');
    client.query('SELECT NOW()', (err, result) => {
        release(); // Libera el cliente de vuelta al pool
        if (err) {
            return console.error('Error executing initial test query', err.stack);
        }
        console.log('Test query successful.');
    });
});

// --- Función unificada para crear/actualizar la estructura de la base de datos ---
async function setupDatabase() {
    const setupQueries = [
        `-- Función para actualizar timestamp
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Check if the updated_at column exists before trying to set it
          IF TG_OP = 'UPDATE' THEN
             -- Use dynamic check as table name can vary if trigger is reused
             IF EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_schema = TG_TABLE_SCHEMA
                   AND table_name = TG_TABLE_NAME
                   AND column_name = 'updated_at'
             ) THEN
                 NEW.updated_at = NOW();
             END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;`,

        `-- Tabla reservations
        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            fecha DATE NOT NULL,
            hora VARCHAR(5) NOT NULL,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            telefono TEXT NOT NULL,
            motivo TEXT,
            monto DECIMAL(10, 2) NOT NULL DEFAULT 0,
            estado_pago VARCHAR(10) NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Rechazado', 'Pendiente', 'Aprobado', 'Anulado')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (fecha, hora)
        );`,

        `-- Tabla shipping
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
        );`,

        `-- Índice para shipping
        CREATE INDEX IF NOT EXISTS idx_shipping_reservation_id ON shipping(reservation_id);`,

        `-- Tabla transactions
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            reservation_id INTEGER NOT NULL,
            transbank_token TEXT NULL UNIQUE, -- Added UNIQUE constraint for easier lookup
            buy_order VARCHAR(255) NOT NULL UNIQUE, -- Added UNIQUE constraint
            session_id VARCHAR(255),
            amount DECIMAL(12, 2), -- Increased precision slightly
            status VARCHAR(30) NOT NULL DEFAULT 'INITIALIZED'
                CHECK (status IN ('INITIALIZED', 'AUTHORIZED', 'REVERSED', 'FAILED',
                                'NULLIFIED', 'PARTIALLY_NULLIFIED', 'CAPTURED',
                                'TIMEOUT', 'ABORTED', 'REFUNDED', 'COMMIT_ERROR')), -- Added COMMIT_ERROR
            payment_type_code VARCHAR(30),
            card_number VARCHAR(20), -- Typically only last 4 digits are stored
            transaction_date TIMESTAMP WITH TIME ZONE,
            authorization_code VARCHAR(30),
            response_code SMALLINT, -- Added: Usually an integer
            vci VARCHAR(10),       -- Added: Check Transbank docs for typical length
            installments_amount DECIMAL(12, 2), -- Added
            installments_number SMALLINT,       -- Added
            balance DECIMAL(12, 2) NULL,        -- Added: Can be null if not applicable
            refunded_amount DECIMAL(12, 2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_transaction_reservation
                FOREIGN KEY(reservation_id)
                REFERENCES reservations(id)
                ON DELETE CASCADE
        );`,

        `-- Índices para transactions
        CREATE INDEX IF NOT EXISTS idx_transactions_reservation_id ON transactions(reservation_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_transbank_token ON transactions(transbank_token);
        CREATE INDEX IF NOT EXISTS idx_transactions_buy_order ON transactions(buy_order);`,

        // --- Use ALTER TABLE to add columns if they don't exist ---
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'updated_at') THEN
                ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'response_code') THEN
                ALTER TABLE transactions ADD COLUMN response_code SMALLINT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'vci') THEN
                ALTER TABLE transactions ADD COLUMN vci VARCHAR(10);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'installments_amount') THEN
                ALTER TABLE transactions ADD COLUMN installments_amount DECIMAL(12, 2);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'installments_number') THEN
                ALTER TABLE transactions ADD COLUMN installments_number SMALLINT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'balance') THEN
                ALTER TABLE transactions ADD COLUMN balance DECIMAL(12, 2) NULL; -- Allow NULL
            END IF;
        END $$;`,

        `-- Trigger para actualizar automáticamente 'updated_at' en 'transactions'
        DROP TRIGGER IF EXISTS set_timestamp ON transactions;
        CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();`
    ];

    let client;
    try {
        client = await pool.connect();
        // Execute each query sequentially
        for (const query of setupQueries) {
            await client.query(query);
        }
        console.log("Database setup/update completed successfully.");
    } catch (err) {
        console.error("Error during database setup/update:", err.stack);
        // Optionally re-throw or handle more gracefully
        // throw err;
    } finally {
        if (client) {
            client.release();
        }
    }
}

// Inicializar la base de datos al cargar el módulo
setupDatabase().catch(err => {
    console.error("Failed to initialize database on startup:", err);
    // Consider exiting if DB setup fails critically
    // process.exit(1);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};
// --- END OF FILE database.js ---