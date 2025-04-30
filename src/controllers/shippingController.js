const db = require('../config/database'); // Importa la configuración de la base de datos

// POST /shipping
const createShippingInfo = async (req, res, next) => {
    // 1. Extract data from request body
    const {
        reservation_id,
        email,
        calle,
        numero,
        depto, // Optional field
        region,
        provincia,
        codigo_postal // Optional field
    } = req.body;

    // 2. Basic Input Validation (Security & Integrity)
    // Check for required fields
    if (!reservation_id || !email || !calle || !numero || !region || !provincia) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields. Required: reservation_id, email, calle, numero, region, provincia."
        });
    }

    // Validate reservation_id format (should be a number)
    if (isNaN(parseInt(reservation_id))) {
         return res.status(400).json({ success: false, error: "Invalid reservation_id format. Must be a number." });
    }
    const reservationIdInt = parseInt(reservation_id);

    // Basic email format validation (can be enhanced)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email)) {
         return res.status(400).json({ success: false, error: "Invalid email format." });
    }

    // Basic type checks for other required string fields
    if (typeof calle !== 'string' || typeof numero !== 'string' || typeof region !== 'string' || typeof provincia !== 'string') {
        return res.status(400).json({ success: false, error: "Invalid data type for calle, numero, region, or provincia. Must be strings." });
    }

    // Optional fields validation (if provided, should be string)
    if (depto && typeof depto !== 'string') {
        return res.status(400).json({ success: false, error: "Invalid data type for depto. Must be a string if provided." });
    }
    if (codigo_postal && typeof codigo_postal !== 'string') {
        return res.status(400).json({ success: false, error: "Invalid data type for codigo_postal. Must be a string if provided." });
    }

    try {
        // 3. Verify Reservation Existence (Association)
        // Check if the reservation_id exists in the reservations table
        const reservationCheckQuery = 'SELECT id FROM reservations WHERE id = $1';
        const reservationResult = await db.query(reservationCheckQuery, [reservationIdInt]);

        if (reservationResult.rows.length === 0) {
            // If no reservation found with that ID, return 404
            return res.status(404).json({
                success: false,
                error: `Reservation with ID ${reservationIdInt} not found.`
            });
        }

        // --- Optional Check: Prevent duplicate shipping info ---
        // You might want to prevent adding shipping info if it already exists for this reservation
        const existingShippingQuery = 'SELECT id FROM shipping WHERE reservation_id = $1';
        const existingShippingResult = await db.query(existingShippingQuery, [reservationIdInt]);
        if (existingShippingResult.rows.length > 0) {
            return res.status(409).json({ // 409 Conflict is appropriate here
                success: false,
                error: `Shipping information already exists for reservation ID ${reservationIdInt}.`
             });
            // Alternatively, you could implement an UPDATE logic here if you want to allow changes.
        }
        // --- End Optional Check ---


        // 4. Insert Shipping Information into Database
        // Use parameterized queries ($1, $2, ...) to prevent SQL injection
        const insertQuery = `
            INSERT INTO shipping (
                reservation_id, email, calle, numero, depto, region, provincia, codigo_postal
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, reservation_id, status, created_at; -- Return the newly created shipping record details
        `;

        // Prepare values, using null for optional fields if they weren't provided
        const values = [
            reservationIdInt,
            email,
            calle,
            numero,
            depto || null, // Use null if depto is falsy (empty string, null, undefined)
            region,
            provincia,
            codigo_postal || null // Use null if codigo_postal is falsy
        ];

        const insertResult = await db.query(insertQuery, values);
        const newShippingInfo = insertResult.rows[0];

        // 5. Send Success Response
        res.status(201).json({ // 201 Created is standard for successful POST requests that create a resource
            success: true,
            message: "Shipping information successfully saved.",
            shipping: {
                id: newShippingInfo.id,
                reservation_id: newShippingInfo.reservation_id,
                status: newShippingInfo.status, // Will be 'Pendiente' by default from the table definition
                created_at: newShippingInfo.created_at
            }
        });

    } catch (error) {
        console.error("Error in POST /shipping:", error);
        // Pass the error to the Express error handling middleware
        next(error);
    }
};

module.exports = {
    createShippingInfo,
};