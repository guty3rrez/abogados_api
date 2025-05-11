const db = require('../config/database'); // Importa la configuración de la base de datos
const axios = require('axios'); // Para hacer peticiones HTTP

/**
 * Realiza una cotización de envío a través de la API de Chilexpress
 * @param {string} originCountyCode - Código de comuna de origen
 * @param {string} destinationCountyCode - Código de comuna de destino
 * @returns {Promise<Object>} - Datos de la cotización
 */
const createQuote = async (originCountyCode, destinationCountyCode) => {
    try {
        // URL de la API de Chilexpress para cotización
        const url = "https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier";
        
        // Definir los parámetros mínimos para la cotización
        const headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Ocp-Apim-Subscription-Key": "5ec28a9603274d8db7510049580feaa6"
        };
        
        const body = {
            "originCountyCode": originCountyCode,
            "destinationCountyCode": destinationCountyCode,
            "package": {
                "weight": "1",
                "height": "1",
                "width": "1",
                "length": "1",
            },
            "productType": 1, // 1 Documento, 3 Encomienda
            "contentType": 1, // Descripción del contenido declarado
            "declaredWorth": "1000", // Valor declarado del paquete
        };

        // Realizar la petición POST
        const response = await axios.post(url, body, { headers });
        
        // Retornar los datos de la respuesta
        return response.data;
    } catch (error) {
        console.error('Error al crear cotización:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Crea un envío a través de la API de Chilexpress
 * @param {string} countyOfOriginCoverageCode - Código de comuna de origen
 * @param {string} streetName - Nombre de la calle de destino
 * @param {string} streetNumber - Número de la dirección de destino
 * @param {string} fullName - Nombre completo del destinatario
 * @param {string} phoneNumber - Teléfono del destinatario
 * @param {string} mail - Email del destinatario
 * @param {string} serviceDeliveryCode - Código de servicio de entrega
 * @param {string} deliveryReference - Referencia de entrega
 * @param {string} groupReference - Referencia de grupo
 * @returns {Promise<Object>} - Datos del envío creado
 */
const createShipping = async (countyOfOriginCoverageCode, streetName, streetNumber, fullName, phoneNumber, mail, serviceDeliveryCode, deliveryReference, groupReference) => {
    try {
        // URL de la API de Chilexpress para creación de envíos
        const url = "https://testservices.wschilexpress.com/transport-orders/api/v1.0/transport-orders";

        const headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Ocp-Apim-Subscription-Key": "629ab4a902d54239989cd1c2f3d20dfa"
        };
        
        // Definir los parámetros mínimos para el envío
        const body = {
            "header": {
                "customerCardNumber": "18578680", // Número de Tarjeta Cliente de Chilexpress (TCC) - Este es el utilizado para pruebas
                "countyOfOriginCoverageCode": countyOfOriginCoverageCode, // Código de la comuna de origen
                "labelType": 2,
            },
            "details": [{
                "addresses": [{ // Dirección de DESTINO
                    "countyCoverageCode": countyOfOriginCoverageCode,
                    "streetName": streetName,
                    "streetNumber": streetNumber,
                    "supplement": "",
                    "addressType": "DEST",
                    "observation": "DEFAULT"
                }, { // Dirección de DEVOLUCIÓN
                    "countyCoverageCode": "PLCA",
                    "streetName": "SARMIENTO",
                    "streetNumber": 120,
                    "supplement": "DEFAULT",
                    "addressType": "DEV",
                    "deliveryOnCommercialOffice": false,
                    "observation": "DEFAULT"
                }],
                "contacts": [{ // Datos de contacto de DESTINATARIO
                    "name": fullName,
                    "phoneNumber": phoneNumber,
                    "mail": mail,
                    "contactType": "D"
                }, { // Datos de contacto de REMITENTE
                    "name": "Felipe Gutiérrez",
                    "phoneNumber": "940647280",
                    "mail": "felipe.gutierrezmu@correoaiep.cl",
                    "contactType": "R"
                }],
                "packages": [{
                    "weight": "1",
                    "height": "1",
                    "width": "1",
                    "length": "1",
                    "serviceDeliveryCode": serviceDeliveryCode,
                    "productCode": "1", // 1 Documento, 3 Encomienda
                    "deliveryReference": deliveryReference,
                    "groupReference": groupReference,
                    "declaredValue": "1000",
                    "declaredContent": "1",
                    "receivableAmountInDelivery": 1000
                }]
            }]
        };

        // Realizar la petición POST
        const response = await axios.post(url, body, { headers });
        
        // Retornar los datos de la respuesta
        return response.data;
    } catch (error) {
        console.error('Error al crear envío:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Función para obtener los datos necesarios de una reserva
 * @param {number} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Datos de la reserva y envío
 */
const getReservationData = async (reservationId) => {
    try {
        // Consulta SQL para obtener datos de reserva y shipping
        const query = `
            SELECT r.id, r.nombre, r.email, r.telefono, 
                   s.calle, s.numero, s.depto, s.region, s.provincia, s.codigo_postal
            FROM reservations r
            LEFT JOIN shipping s ON r.id = s.reservation_id
            WHERE r.id = $1
        `;
        
        const result = await db.query(query, [reservationId]);
        
        if (result.rows.length === 0) {
            throw new Error(`No se encontró reserva con ID: ${reservationId}`);
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Error al obtener datos de reserva:', error);
        throw error;
    }
};

/**
 * Actualiza el estado de envío en la base de datos
 * @param {number} reservationId - ID de la reserva
 * @param {string} status - Estado del envío
 * @param {Object} shippingData - Datos del envío a actualizar
 * @returns {Promise<Object>} - Resultado de la actualización
 */
const updateShippingStatus = async (reservationId, status, shippingData = {}) => {
    try {
        // Actualizar el estado de envío en la base de datos
        const query = `
            UPDATE shipping
            SET status = $1, 
                updated_at = CURRENT_TIMESTAMP
            WHERE reservation_id = $2
            RETURNING *
        `;
        
        const result = await db.query(query, [status, reservationId]);
        
        if (result.rows.length === 0) {
            throw new Error(`No se encontró registro de envío para reserva ID: ${reservationId}`);
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Error al actualizar estado de envío:', error);
        throw error;
    }
};

/**
 * Endpoint para procesar un envío
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const sendShipping = async (req, res, next) => {
    try {
        const { reservation_id } = req.body;
        
        if (!reservation_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Se requiere el ID de reserva' 
            });
        }
        
        // Obtener datos de la reserva y shipping desde la BD
        const reservationData = await getReservationData(reservation_id);
        
        // Validar que existan todos los datos necesarios
        if (!reservationData.calle || !reservationData.numero || !reservationData.region || !reservationData.provincia) {
            return res.status(400).json({ 
                success: false, 
                error: 'Faltan datos de envío para la reserva' 
            });
        }
        
        const originCountyCode = "PLCA"; // Santiago 
        const destinationCountyCode = reservationData.provincia.slice(0, 4).toUpperCase(); 
        
        // 1. Crear cotización para obtener opciones de envío
        const quoteResult = await createQuote(originCountyCode, destinationCountyCode);
        
        if (!quoteResult.data || !quoteResult.data.courierServiceOptions || quoteResult.data.courierServiceOptions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se pudieron obtener opciones de envío para la ubicación especificada'
            });
        }
        
        // 2. Seleccionar la primera opción de servicio 
        const selectedService = quoteResult.data.courierServiceOptions[0];
        const serviceDeliveryCode = selectedService.serviceTypeCode;
        
        // 3. Crear el envío en Chilexpress
        const shippingResult = await createShipping(
            destinationCountyCode,
            reservationData.calle,
            reservationData.numero,
            reservationData.nombre,
            reservationData.telefono,
            reservationData.email,
            serviceDeliveryCode,
            `Reserva #${reservation_id}`, // Referencia de entrega
            `REF-${Date.now()}` // Referencia de grupo
        );
        
        // 4. Actualizar el estado del envío en nuestra base de datos
        await updateShippingStatus(reservation_id, 'Procesado', {
            // Aquí podrías guardar más datos del resultado si fuera necesario
            serviceType: selectedService.serviceDescription,
            serviceValue: selectedService.serviceValue
        });
        
        // 5. Responder con éxito y los detalles
        return res.status(200).json({
            success: true,
            message: 'Envío procesado correctamente',
            data: {
                quoteDetails: selectedService,
                shippingDetails: shippingResult
            }
        });
        
    } catch (error) {
        console.error('Error en procesamiento de envío:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar el envío'
        });
    }
};

module.exports = {
    sendShipping,
    createQuote,
    createShipping
};