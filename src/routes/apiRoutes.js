const express = require('express');
const slotsController = require('../controllers/slotsController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Ruta para obtener los horarios disponibles para una fecha
// GET /api/slots?date=YYYY-MM-DD
router.get('/slots', slotsController.getAvailableSlots);

// Ruta para crear una nueva reserva
// POST /api/book
router.post('/book', bookingController.createBooking);

// Puedes añadir más rutas aquí

module.exports = router;