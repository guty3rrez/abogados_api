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
            "Ocp-Apim-Subscription-Key": "5ec28a9603274d8db7510049580feaa6" // Clave de prueba
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
            "productType": 3, // 1 Documento, 3 Encomienda (Más común para productos)
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
 * @param {string} countyOfOriginCoverageCode - Código de comuna de origen (para API Chilexpress, este es el destino)
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
            "Ocp-Apim-Subscription-Key": "629ab4a902d54239989cd1c2f3d20dfa" // Clave de prueba
        };

        // Definir los parámetros mínimos para el envío
        const body = {
            "header": {
                "customerCardNumber": "18578680", // Número de Tarjeta Cliente de Chilexpress (TCC) - Este es el utilizado para pruebas
                // "countyOfOriginCoverageCode": "PLCA", // Código de la comuna de origen del envío (fijo o configurable)
                "countyOfOriginCoverageCode": "STGO", // Comuna de origen del envío para Chilexpress, ej: Santiago
                "labelType": 2,
            },
            "details": [{
                "addresses": [{ // Dirección de DESTINO
                    "countyCoverageCode": countyOfOriginCoverageCode, // Código de comuna de DESTINO real
                    "streetName": streetName,
                    "streetNumber": streetNumber,
                    "supplement": "", // Complemento de dirección (opcional)
                    "addressType": "DEST",
                    "observation": "DEFAULT"
                }, { // Dirección de DEVOLUCIÓN (datos de ejemplo, ajusta según necesidad)
                    "countyCoverageCode": "PLCA", // Comuna de devolución
                    "streetName": "SARMIENTO",
                    "streetNumber": "120", // Debe ser string
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
                }, { // Datos de contacto de REMITENTE (datos de ejemplo, ajusta según necesidad)
                    "name": "Tu Nombre o Empresa",
                    "phoneNumber": "912345678",
                    "mail": "tuemail@example.com",
                    "contactType": "R"
                }],
                "packages": [{
                    "weight": "1",
                    "height": "1",
                    "width": "1",
                    "length": "1",
                    "serviceDeliveryCode": serviceDeliveryCode,
                    "productCode": "3", // 1 Documento, 3 Encomienda
                    "deliveryReference": deliveryReference,
                    "groupReference": groupReference,
                    "declaredValue": "1000",
                    "declaredContent": "PRODUCTOS VARIOS", // Descripción del contenido
                    "receivableAmountInDelivery": 0 // Monto a cobrar en la entrega (0 si no aplica)
                }]
            }]
        };

        // Realizar la petición POST
        const response = await axios.post(url, body, { headers });

        // Retornar los datos de la respuesta
        return response.data;
    } catch (error) {
        console.error('Error al crear envío en Chilexpress:', error.response?.data || error.message);
        // Loguear el body enviado puede ayudar a depurar
        if (error.response?.config?.data) {
            console.error('Body enviado a Chilexpress:', error.response.config.data);
        }
        throw error;
    }
};

/**
 * Función para obtener los datos necesarios de una reserva y su envío asociado.
 * @param {number} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Datos de la reserva y envío
 */
const getReservationData = async (reservationId) => {
    try {
        // Consulta SQL para obtener datos de reserva y shipping
        // Asegúrate que los nombres de columna coincidan con tu BD (ej. s.codigo_postal)
        const query = `
            SELECT r.id, r.nombre, r.email, r.telefono, 
                   s.calle, s.numero, s.depto, s.region, s.provincia, s.codigo_postal, s.comuna_destino_chilexpress
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
 * @param {Object} shippingData - Datos adicionales del envío a actualizar
 * @returns {Promise<Object>} - Resultado de la actualización
 */
const updateShippingStatus = async (reservationId, status, shippingData = {}) => {
    try {
        // Extraer datos específicos para la actualización, si existen
        const serviceType = shippingData.serviceType || null;
        const serviceValue = shippingData.serviceValue || null;
        const trackingNumber = shippingData.trackingNumber || null; // Para el número de OT de Chilexpress

        // Actualizar el estado de envío en la base de datos
        // Asegúrate que los nombres de columna coincidan con tu BD
        const query = `
            UPDATE shipping
            SET status = $1, 
                service_type = $3,
                service_value = $4,
                tracking_number = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE reservation_id = $2
            RETURNING *
        `;

        const result = await db.query(query, [status, reservationId, serviceType, serviceValue, trackingNumber]);

        if (result.rows.length === 0) {
            throw new Error(`No se encontró registro de envío para reserva ID: ${reservationId} para actualizar estado.`);
        }

        return result.rows[0];
    } catch (error)
 {
        console.error('Error al actualizar estado de envío:', error);
        throw error;
    }
};

/**
 * Guarda o actualiza la dirección de envío para una reserva.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const saveShippingAddress = async (req, res) => {
    const {
        reservation_id,
        calle,
        numero,
        depto, // Opcional
        region,
        provincia, // Esta se usará como 'destinationCountyCode' para Chilexpress si es un código válido
        codigo_postal, // Opcional
        comuna_destino_chilexpress // Código de comuna Chilexpress para el destino (ej: "STGO", "PLCA")
    } = req.body;

    // Validación básica de campos requeridos
    if (!reservation_id) {
        return res.status(400).json({ success: false, error: 'El ID de reserva (reservation_id) es requerido.' });
    }
    if (!calle || !numero || !region || !provincia || !comuna_destino_chilexpress) {
        return res.status(400).json({ success: false, error: 'Los campos calle, numero, region, provincia y comuna_destino_chilexpress son requeridos.' });
    }
    if (comuna_destino_chilexpress.length < 2 || comuna_destino_chilexpress.length > 4) { // Validar longitud del código de comuna
        return res.status(400).json({ success: false, error: 'El campo comuna_destino_chilexpress debe ser un código válido (ej: STGO, VALP, PLCA).' });
    }


    try {
        // UPSERT: Inserta si no existe, actualiza si existe basado en reservation_id
        // Asegúrate que los nombres de columna coincidan con tu BD
        const query = `
            INSERT INTO shipping (
                reservation_id, calle, numero, depto, region, provincia, codigo_postal, comuna_destino_chilexpress, status, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (reservation_id) DO UPDATE SET
                calle = EXCLUDED.calle,
                numero = EXCLUDED.numero,
                depto = EXCLUDED.depto,
                region = EXCLUDED.region,
                provincia = EXCLUDED.provincia,
                codigo_postal = EXCLUDED.codigo_postal,
                comuna_destino_chilexpress = EXCLUDED.comuna_destino_chilexpress,
                status = 'Pendiente', -- Opcional: resetear estado si se actualiza la dirección
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        // Nota: 'Pendiente' es un estado inicial sugerido para el envío.

        const values = [
            reservation_id,
            calle,
            numero,
            depto || null, // Permite nulo si 'depto' no se envía
            region,
            provincia,
            codigo_postal || null, // Permite nulo si 'codigo_postal' no se envía
            comuna_destino_chilexpress.toUpperCase() // Guardar en mayúsculas como los códigos de Chilexpress
        ];

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            // Esto no debería ocurrir con RETURNING * en un upsert exitoso, pero por si acaso.
            return res.status(500).json({ success: false, error: 'No se pudo guardar la dirección de envío.' });
        }

        res.status(200).json({
            success: true,
            message: 'Dirección de envío guardada/actualizada correctamente.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al guardar dirección de envío:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al guardar la dirección.'
        });
    }
};


/**
 * Endpoint para procesar un envío
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const sendShipping = async (req, res) => {
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

        // Validar que existan todos los datos necesarios para Chilexpress
        if (!reservationData.calle || !reservationData.numero || !reservationData.comuna_destino_chilexpress ||
            !reservationData.nombre || !reservationData.telefono || !reservationData.email) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos de envío o contacto para la reserva. Asegúrate de haber guardado la dirección y que la reserva tenga nombre, email y teléfono.'
            });
        }

        const originCountyCode = "STGO"; // Código de comuna de origen del envío (Ej: Santiago Centro) - AJUSTA SI ES NECESARIO
        const destinationCountyCodeForQuote = reservationData.comuna_destino_chilexpress; // Usar el código de comuna Chilexpress guardado

        // 1. Crear cotización para obtener opciones de envío
        const quoteResult = await createQuote(originCountyCode, destinationCountyCodeForQuote);

        if (!quoteResult || !quoteResult.data || !quoteResult.data.courierServiceOptions || quoteResult.data.courierServiceOptions.length === 0) {
            console.error("Respuesta de cotización inesperada:", quoteResult);
            return res.status(400).json({
                success: false,
                error: 'No se pudieron obtener opciones de envío para la ubicación especificada. Revise los códigos de comuna.',
                details: quoteResult // Incluir detalles de la respuesta de Chilexpress si es útil
            });
        }

        // 2. Seleccionar la primera opción de servicio (o la más barata/rápida según tu lógica)
        const selectedService = quoteResult.data.courierServiceOptions[0];
        const serviceDeliveryCode = selectedService.serviceTypeCode;

        // 3. Crear el envío en Chilexpress
        // Para createShipping, el "countyOfOriginCoverageCode" en el body.details[0].addresses[0] (DEST)
        // es el código de la comuna de destino del paquete.
        // El "countyOfOriginCoverageCode" en body.header es la comuna desde donde se origina el envío.
        const shippingResult = await createShipping(
            destinationCountyCodeForQuote, // Este es el código de comuna de DESTINO para la API de Chilexpress
            reservationData.calle,
            reservationData.numero.toString(), // Asegurar que el número sea string
            reservationData.nombre,
            reservationData.telefono,
            reservationData.email,
            serviceDeliveryCode,
            `Reserva #${reservation_id}`, // Referencia de entrega
            `REF-${Date.now()}` // Referencia de grupo
        );

        if (!shippingResult || !shippingResult.data || !shippingResult.data.trackingNumber) {
             console.error("Respuesta de creación de envío inesperada:", shippingResult);
            return res.status(500).json({
                success: false,
                error: 'Error al crear el envío en Chilexpress. No se recibió número de seguimiento.',
                details: shippingResult
            });
        }

        // 4. Actualizar el estado del envío en nuestra base de datos
        await updateShippingStatus(reservation_id, 'Procesado en Chilexpress', {
            serviceType: selectedService.serviceDescription,
            serviceValue: selectedService.serviceValue,
            trackingNumber: shippingResult.data.trackingNumber // Guardar el número de OT
        });

        // 5. Responder con éxito y los detalles
        return res.status(200).json({
            success: true,
            message: 'Envío procesado correctamente con Chilexpress',
            data: {
                quoteDetails: selectedService,
                shippingDetails: shippingResult.data // Acceder a .data para el contenido útil
            }
        });

    } catch (error) {
        console.error('Error en procesamiento de envío:', error.response?.data || error.message || error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error al procesar el envío',
            details: error.response?.data // Incluir detalles del error de Chilexpress si están disponibles
        });
    }
};

module.exports = {
    sendShipping,
    createQuote,
    createShipping,
    saveShippingAddress, // <-- Endpoint añadido aquí
    getReservationData, // Es bueno exportarlo si se usa en rutas directamente
    updateShippingStatus // También puede ser útil exportarlo
};