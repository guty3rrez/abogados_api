const express = require('express');
const fs = require('fs').promises; // Use the promise-based fs module
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Use environment port or default to 3000
const RESERVAS_FILE = path.join(__dirname, 'reservas.json');

// --- Middleware ---
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies (useful if testing with HTML forms, though API usually uses JSON)
app.use(express.urlencoded({ extended: true }));

// --- Constants & Helpers ---
const businessHours = [
    "09:00", "10:00", "11:00",
    "12:00", "14:00", "15:00",
    "16:00", "17:00"
];

// Helper to get current date as YYYY-MM-DD
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper to get current time as HH:MM
function getCurrentTimeString() {
    const today = new Date();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Helper to validate YYYY-MM-DD format
function isValidDate(dateString) {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dateString);
}

// Helper to check if a date is a weekday (Mon-Fri)
function isWeekday(dateString) {
    try {
        // Adding time prevents timezone issues where getDate() might return previous day
        const date = new Date(`${dateString}T12:00:00`);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        return dayOfWeek >= 1 && dayOfWeek <= 5; // True for Monday (1) to Friday (5)
    } catch (e) {
        return false; // Invalid date string format
    }
}

// Helper function to read reservations from the JSON file
async function readReservas() {
    try {
        const data = await fs.readFile(RESERVAS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is empty/invalid JSON, return an empty array
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.warn(`Warning: ${RESERVAS_FILE} not found or invalid. Starting with empty reservations.`);
            return [];
        }
        // For other errors (like permissions), re-throw
        console.error("Error reading reservations file:", error);
        throw new Error("Could not read reservations data.");
    }
}

// Helper function to write reservations to the JSON file
async function writeReservas(reservas) {
    try {
        // Pretty print JSON with 2 spaces indentation
        await fs.writeFile(RESERVAS_FILE, JSON.stringify(reservas, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing reservations file:", error);
        throw new Error("Could not save reservation data.");
    }
}

// --- API Endpoints ---

// GET /slots?date=YYYY-MM-DD - Get available time slots for a specific date
app.get('/slots', async (req, res) => {
    const selectedDate = req.query.date;

    // 1. Validate Input
    if (!selectedDate) {
        return res.status(400).json({ error: "Missing 'date' query parameter." });
    }
    if (!isValidDate(selectedDate)) {
        return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD." });
    }
     if (!isWeekday(selectedDate)) {
        return res.status(400).json({ error: "Bookings are only available on weekdays (Monday to Friday)." });
    }

    const todayDate = getCurrentDateString();
    const currentTime = getCurrentTimeString();

    try {
        // 2. Read existing bookings
        const allReservas = await readReservas();

        // 3. Filter bookings for the selected date
        const bookedTimes = allReservas
            .filter(reserva => reserva.fecha === selectedDate)
            .map(reserva => reserva.hora); // Get only the HH:MM time

        // 4. Determine potentially available slots
        let potentiallyAvailableSlots = businessHours.filter(
            slot => !bookedTimes.includes(slot)
        );

        // 5. Filter out past slots ONLY if the date is today
        let finalAvailableSlots = [];
        if (selectedDate === todayDate) {
            finalAvailableSlots = potentiallyAvailableSlots.filter(slot => slot > currentTime);
        } else if (selectedDate > todayDate) {
            // If date is in the future, all potentially available slots are final
             finalAvailableSlots = potentiallyAvailableSlots;
        } else {
            // Date is in the past - no slots available
            finalAvailableSlots = [];
        }


        // 6. Send Response
        res.status(200).json({ available_slots: finalAvailableSlots });

    } catch (error) {
        console.error("Error in GET /slots:", error);
        // Use the error message from read/write helpers if available
        res.status(500).json({ error: error.message || "Internal server error retrieving slots." });
    }
});

// POST /book - Create a new booking
app.post('/book', async (req, res) => {
    // 1. Extract data from request body
    const { selected_date, selected_time, nombre, email, telefono, motivo } = req.body;

    // 2. Basic Input Validation
    const errors = {};
    if (!selected_date || !isValidDate(selected_date)) {
        errors.selected_date = 'Valid booking date (YYYY-MM-DD) is required.';
    }
    if (!selected_time || !businessHours.includes(selected_time)) {
        errors.selected_time = 'Valid booking time from available slots is required.';
    }
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        errors.nombre = 'Name is required.';
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        errors.email = 'Valid email address is required.';
    }
    if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
        errors.telefono = 'Phone number is required.';
    }
    // Motivo is optional, no validation needed unless specified

    // Check weekday again server-side
     if (selected_date && isValidDate(selected_date) && !isWeekday(selected_date)) {
        errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Bookings only allowed on weekdays.';
    }

     // Check if time has passed for today's bookings
    const todayDate = getCurrentDateString();
    const currentTime = getCurrentTimeString();
    if (selected_date === todayDate && selected_time <= currentTime) {
        errors.selected_time = (errors.selected_time ? errors.selected_time + ' ' : '') + 'Cannot book a time slot that has already passed today.';
    }
     if (selected_date < todayDate) {
        errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Cannot book a time slot in the past.';
    }


    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: "Validation failed.", errors });
    }

    // 3. Check Availability (Concurrency Check) & Save
    try {
        const allReservas = await readReservas();

        // Check if the exact slot is already booked
        const isAlreadyBooked = allReservas.some(
            reserva => reserva.fecha === selected_date && reserva.hora === selected_time
        );

        if (isAlreadyBooked) {
            return res.status(409).json({ message: "Sorry, this time slot was just booked. Please choose another one." });
        }

        // 4. Prepare and Save the New Booking
        const newBooking = {
            fecha: selected_date,
            hora: selected_time,
            nombre: nombre.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
            motivo: motivo ? motivo.trim() : '', // Handle optional motivo
            // timestamp: new Date().toISOString() // Optional: add a timestamp
        };

        allReservas.push(newBooking);
        await writeReservas(allReservas);

        // --- Log to Console (as requested in instruction B) ---
        console.log("\n--- New Booking Received ---");
        console.log("Date:", newBooking.fecha);
        console.log("Time:", newBooking.hora);
        console.log("Name:", newBooking.nombre);
        console.log("Email:", newBooking.email);
        console.log("Phone:", newBooking.telefono);
        console.log("Reason:", newBooking.motivo || "(Not provided)");
        console.log("--------------------------\n");
        // --------------------------------------------------------

        // 5. Send Success Response
        res.status(201).json({ success: true, message: "Your booking has been successfully confirmed!" });

    } catch (error) {
        console.error("Error in POST /book:", error);
        res.status(500).json({ message: error.message || "Internal server error processing booking." });
    }
});

// --- Catch-all for undefined routes ---
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// --- Global Error Handler (Optional but good practice) ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Reservations file: ${RESERVAS_FILE}`);
    console.log(`Endpoints:`);
    console.log(`  GET  http://localhost:${PORT}/slots?date=YYYY-MM-DD`);
    console.log(`  POST http://localhost:${PORT}/book`);
});