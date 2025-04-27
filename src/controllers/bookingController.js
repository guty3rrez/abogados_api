const db = require('../config/database');
const { businessHours } = require('../utils/constants');
const {
    getCurrentDateString,
    getCurrentTimeString,
    isValidDate,
    isWeekday
} = require('../utils/dateTime');

// POST /api/book
const createBooking = async (req, res, next) => {
    const { selected_date, selected_time, nombre, email, telefono, motivo } = req.body;

    // 1. Basic Input Validation
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
    // Additional date/time logic validation
    if (selected_date && isValidDate(selected_date)) {
        if (!isWeekday(selected_date)) {
            errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Bookings only allowed on weekdays.';
        }
        const todayDate = getCurrentDateString();
        if (selected_date < todayDate) {
             errors.selected_date = (errors.selected_date ? errors.selected_date + ' ' : '') + 'Cannot book a time slot in the past.';
        } else if (selected_date === todayDate) {
            const currentTime = getCurrentTimeString();
            if (selected_time <= currentTime) {
                 errors.selected_time = (errors.selected_time ? errors.selected_time + ' ' : '') + 'Cannot book a time slot that has already passed today.';
            }
        }
    }


    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: "Validation failed.", errors });
    }

    // 2. Insert into Database
    // **ACTUALIZADO**: No es necesario añadir `estado_pago` aquí porque tiene un DEFAULT en la BD.
    // Si quisieras establecerlo explícitamente (ej: basado en otro campo), lo añadirías aquí.
    const insertQuery = `
        INSERT INTO reservations (fecha, hora, nombre, email, telefono, motivo)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, fecha, hora, nombre, email, telefono, motivo, estado_pago; -- Añadido estado_pago al RETURNING
    `;
    const values = [
        selected_date,
        selected_time,
        nombre.trim(),
        email.trim(),
        telefono.trim(),
        motivo ? motivo.trim() : null // Maneja el motivo opcional
    ];

    try {
        // 3. Check Availability Again (Race Condition Prevention)
        // Es buena práctica verificar justo antes de insertar si el slot sigue libre
        const checkQuery = 'SELECT id FROM reservations WHERE fecha = $1 AND hora = $2';
        const checkResult = await db.query(checkQuery, [selected_date, selected_time]);
        if (checkResult.rows.length > 0) {
             return res.status(409).json({ message: "Sorry, this time slot was just booked or is already taken. Please choose another one." });
        }

        // 4. Execute Insert Query
        const result = await db.query(insertQuery, values);
        const newBooking = result.rows[0];

        // 5. Log to Console
        console.log("\n--- New Booking Saved to Database ---");
        console.log("ID:", newBooking.id);
        // Formatea la fecha para mostrar solo YYYY-MM-DD
        console.log("Date:", new Date(newBooking.fecha).toISOString().split('T')[0]);
        console.log("Time:", newBooking.hora);
        console.log("Name:", newBooking.nombre);
        console.log("Email:", newBooking.email);
        console.log("Phone:", newBooking.telefono);
        console.log("Reason:", newBooking.motivo || 'N/A');
        console.log("Payment Status:", newBooking.estado_pago); // Log del nuevo estado
        console.log("-----------------------------------\n");

        // 6. Send Success Response
        res.status(201).json({
            success: true,
            message: "Your booking has been successfully confirmed!",
            booking: {
                id: newBooking.id,
                date: new Date(newBooking.fecha).toISOString().split('T')[0],
                time: newBooking.hora,
                name: newBooking.nombre,
                payment_status: newBooking.estado_pago // Incluye el estado en la respuesta
            }
        });

    } catch (error) {
        console.error("Error in POST /api/book:", error);
        // El chequeo de duplicado (UNIQUE constraint) sigue siendo útil como fallback
        if (error.code === '23505') { // Código de error de PostgreSQL para violación de unicidad
            return res.status(409).json({ message: "Sorry, this time slot seems to be already taken. Please choose another one." });
        }
        // Pasa otros errores al middleware general
        next(error);
    }
};

module.exports = {
    createBooking,
};