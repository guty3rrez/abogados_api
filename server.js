const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg'); // Importar el Pool de pg
require('dotenv').config(); // Cargar variables de entorno desde .env

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database Connection Pool ---
// La biblioteca 'pg' buscará AUTOMÁTICAMENTE la variable de entorno DATABASE_URL
// si no se pasan credenciales explícitas aquí.
// Si DATABASE_URL no está definida, entonces buscará PGHOST, PGUSER, etc.
const pool = new Pool({
    // No necesitas pasar connectionString explícitamente si usas la variable de entorno DATABASE_URL.
    // connectionString: process.env.DATABASE_URL, // Podrías hacerlo explícito, pero no es necesario.

    // ¡IMPORTANTE para producción/hosting! A menudo necesitas configurar SSL.
    // Incluso si tu DATABASE_URL incluye '?ssl=true', a veces necesitas
    // especificar opciones adicionales aquí, especialmente si usas certificados
    // autofirmados o en plataformas como Heroku/Render que pueden requerirlo.
    // ssl: {
    //   rejectUnauthorized: false // ¡Usar con precaución! Deshabilita la verificación del certificado.
                                 // Necesario en algunas plataformas o con certificados autofirmados.
    // }
});

// Probar la conexión a la BD al iniciar (sin cambios)
pool.connect((err, client, release) => {
    if (err) {
        // Si hay un error aquí, verifica tu DATABASE_URL y la configuración SSL.
        console.error('Error acquiring client for initial connection test using DATABASE_URL.', err.stack);
        return;
    }
    console.log('Successfully connected to PostgreSQL database (using DATABASE_URL if provided).');
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing initial test query', err.stack);
        }
        console.log('Test query successful. Current DB time:', result.rows[0].now);
    });
});

// --- Middleware (sin cambios) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- Constants & Helpers (sin cambios) ---
const businessHours = [
    "09:00", "10:00", "11:00",
    "12:00", "14:00", "15:00",
    "16:00", "17:00"
];
// ... (resto de funciones helper: getCurrentDateString, getCurrentTimeString, isValidDate, isWeekday) ...
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getCurrentTimeString() {
    const today = new Date();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}
function isValidDate(dateString) {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dateString);
}
function isWeekday(dateString) {
    try {
        const date = new Date(`${dateString}T12:00:00`);
        const dayOfWeek = date.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    } catch (e) {
        return false;
    }
}


// --- Helper Function to Create Table (sin cambios) ---
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
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (fecha, hora)
        );
    `;
    try {
        await pool.query(createTableQuery);
        console.log("Table 'reservations' checked/created successfully.");
    } catch (err) {
        console.error("Error creating/checking reservations table:", err);
    }
}
ensureTableExists();

// --- API Endpoints (sin cambios en la lógica interna, ya usan 'pool') ---

// GET /slots?date=YYYY-MM-DD
app.get('/slots', async (req, res) => {
    const selectedDate = req.query.date;

    // 1. Validate Input
    if (!selectedDate) return res.status(400).json({ error: "Missing 'date' query parameter." });
    if (!isValidDate(selectedDate)) return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD." });
    if (!isWeekday(selectedDate)) return res.status(400).json({ error: "Bookings are only available on weekdays (Monday to Friday)." });

    const todayDate = getCurrentDateString();
    const currentTime = getCurrentTimeString();

    try {
        // 2. Query Database
        const query = 'SELECT hora FROM reservations WHERE fecha = $1';
        const result = await pool.query(query, [selectedDate]);
        const bookedTimes = result.rows.map(row => row.hora);

        // 3. Determine available slots
        let potentiallyAvailableSlots = businessHours.filter(slot => !bookedTimes.includes(slot));
        let finalAvailableSlots = [];
        if (selectedDate === todayDate) {
            finalAvailableSlots = potentiallyAvailableSlots.filter(slot => slot > currentTime);
        } else if (selectedDate > todayDate) {
            finalAvailableSlots = potentiallyAvailableSlots;
        } else {
            finalAvailableSlots = [];
        }

        // 4. Send Response
        res.status(200).json({ available_slots: finalAvailableSlots });

    } catch (error) {
        console.error("Error in GET /slots:", error);
        res.status(500).json({ error: "Internal server error retrieving slots." });
    }
});

// POST /book
app.post('/book', async (req, res) => {
    const { selected_date, selected_time, nombre, email, telefono, motivo } = req.body;

    // 1. Basic Input Validation
    const errors = {};
    if (!selected_date || !isValidDate(selected_date)) errors.selected_date = 'Valid booking date (YYYY-MM-DD) is required.';
    if (!selected_time || !businessHours.includes(selected_time)) errors.selected_time = 'Valid booking time from available slots is required.';
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') errors.nombre = 'Name is required.';
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Valid email address is required.';
    if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') errors.telefono = 'Phone number is required.';
    if (selected_date && isValidDate(selected_date) && !isWeekday(selected_date)) errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Bookings only allowed on weekdays.';
    const todayDate = getCurrentDateString();
    const currentTime = getCurrentTimeString();
    if (selected_date === todayDate && selected_time <= currentTime) errors.selected_time = (errors.selected_time ? errors.selected_time + ' ' : '') + 'Cannot book a time slot that has already passed today.';
    if (selected_date < todayDate) errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Cannot book a time slot in the past.';

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: "Validation failed.", errors });
    }

    // 2. Insert into Database
    const insertQuery = `
        INSERT INTO reservations (fecha, hora, nombre, email, telefono, motivo)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, fecha, hora, nombre, email, telefono, motivo;
    `;
    const values = [
        selected_date, selected_time, nombre.trim(), email.trim(), telefono.trim(),
        motivo ? motivo.trim() : null
    ];

    try {
        const result = await pool.query(insertQuery, values);
        const newBooking = result.rows[0];

        // Log to Console
        console.log("\n--- New Booking Saved to Database ---");
        console.log("ID:", newBooking.id);
        console.log("Date:", newBooking.fecha.toISOString().split('T')[0]);
        console.log("Time:", newBooking.hora);
        console.log("Name:", newBooking.nombre);
        // ... (resto del log) ...
        console.log("-----------------------------------\n");

        // Send Success Response
        res.status(201).json({
            success: true,
            message: "Your booking has been successfully confirmed!",
            booking: { id: newBooking.id, date: newBooking.fecha.toISOString().split('T')[0], time: newBooking.hora, name: newBooking.nombre }
         });

    } catch (error) {
        console.error("Error in POST /book:", error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: "Sorry, this time slot was just booked or is already taken. Please choose another one." });
        }
        res.status(500).json({ message: "Internal server error processing booking." });
    }
});

// --- Catch-all & Error Handler (sin cambios) ---
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// --- Start Server (sin cambios) ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log('Attempting to connect to PostgreSQL using DATABASE_URL (or PG* vars if not set)...');
    console.log('Endpoints:');
    console.log(`  GET  http://localhost:${PORT}/slots?date=YYYY-MM-DD`);
    console.log(`  POST http://localhost:${PORT}/book`);
});