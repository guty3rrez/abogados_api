const db = require('../config/database'); // Importa el pool/query de la base de datos
const { businessHours } = require('../utils/constants');
const {
    getCurrentDateString,
    getCurrentTimeString,
    isValidDate,
    isWeekday
} = require('../utils/dateTime');

// GET /api/slots?date=YYYY-MM-DD
const getAvailableSlots = async (req, res, next) => {
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

    // Validar que la fecha seleccionada no sea pasada
    if (selectedDate < todayDate) {
        return res.status(400).json({ error: "Cannot retrieve slots for a past date." });
    }

    try {
        // 2. Query Database for booked slots on the selected date
        const query = 'SELECT hora FROM reservations WHERE fecha = $1';
        const result = await db.query(query, [selectedDate]);
        const bookedTimes = result.rows.map(row => row.hora);

        // 3. Determine available slots based on business hours and bookings
        let potentiallyAvailableSlots = businessHours.filter(slot => !bookedTimes.includes(slot));

        // 4. Filter out past slots if the selected date is today
        let finalAvailableSlots;
        if (selectedDate === todayDate) {
            finalAvailableSlots = potentiallyAvailableSlots.filter(slot => slot > currentTime);
        } else {
            // For future dates, all potentially available slots are final
            finalAvailableSlots = potentiallyAvailableSlots;
        }

        // 5. Send Response
        res.status(200).json({ available_slots: finalAvailableSlots });

    } catch (error) {
        console.error("Error in GET /api/slots:", error);
        // Pasa el error al middleware de manejo de errores
        next(error);
    }
};

module.exports = {
    getAvailableSlots,
};