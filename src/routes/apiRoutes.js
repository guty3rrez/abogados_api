const express = require('express');
const slotsController = require('../controllers/slotsController');
const bookingController = require('../controllers/bookingController');
const shippingController = require('../controllers/shippingController'); // Ajusta la ruta
const paymentController = require('../controllers/paymentController'); // Ajusta la ruta
const router = express.Router();

// Ruta para obtener los horarios disponibles para una fecha
// GET /api/slots?date=YYYY-MM-DD
router.get('/slots', slotsController.getAvailableSlots);

// Ruta para crear una nueva reserva
// POST /api/book
router.post('/book', bookingController.createBooking);

// Puedes añadir más rutas aquí

//POST /api/shipping
router.post('/shipping', shippingController.createShippingInfo);

//POST /api/createPayment
router.post('/createPayment', paymentController.createPayment);

//POST /api/validatePayment
router.post('/validatePayment', paymentController.validatePayment);

module.exports = router;