const db = require('../config/database');
const { WebpayPlus, TransbankError } = require('transbank-sdk');
const { generarStringAleatorio } = require("../utils/random");

/**
 * Crea una nueva transacción de pago
 * POST /api/createPayment
 */
const createPayment = async (req, res, next) => {
    try {
        const { reservation_id } = req.body;
        
        if (!reservation_id) {
            return res.status(400).json({ error: "El ID de reserva es requerido" });
        }
        
        // Generar orden de compra única
        const buyOrder = generarStringAleatorio(12);
        // Crear ID de sesión único
        const sessionId = "S-" + reservation_id;
        // Costo de la reserva
        const amount = 5000
        // URL de retorno donde el usuario será redirigido después del pago
        const returnUrl = `${req.protocol}://localhost:5173/confirmation`;
        // Crear transacción en Transbank
        const createResponse = await (new WebpayPlus.Transaction()).create(
            buyOrder,
            sessionId,
            amount,
            returnUrl
        );
        
        if (!createResponse.url || !createResponse.token) {
            console.error("Error al crear el pago:", createResponse);
            return res.status(500).json({ error: "Error al crear el pago" });
        }
        // Guardar información de la transacción en la base de datos
        try {
            await db.query(
                "INSERT INTO transactions (buy_order, transbank_token, reservation_id, session_id, amount, status) VALUES ($1, $2, $3, $4, $5, $6)",
                [buyOrder, createResponse.token, reservation_id, sessionId, amount, 'INITIALIZED']
            );
            console.log("Información de la transacción guardada en la base de datos.");
        } catch (dbError) {
            console.error("Error al guardar información de la transacción:", dbError);
        }

        console.log("Transacción creada con éxito:", createResponse);
        return res.status(200).json({ 
            url: `${createResponse.url}?token_ws=${createResponse.token}`,
            token: createResponse.token
        });
    } catch (error) {
        console.error("Error en createPayment:", error);
        return res.status(500).json({ error: "Error interno al procesar el pago" });
    }
};

/**
 * Valida y procesa el resultado de una transacción
 * POST/ /api/validatePayment
 */
const validatePayment = async (req, res, next) => {
    let token_ws = null;
    let tbkToken = null;
    let tbkOrdenCompra = null;
    let tbkIdSesion = null;

    try {
        // Obtener parámetros de la solicitud
        const params = req.body;
        token_ws = params.token_ws;
        tbkToken = params.TBK_TOKEN;
        tbkOrdenCompra = params.TBK_ORDEN_COMPRA;
        tbkIdSesion = params.TBK_ID_SESION;

        // --- Flujo 1: Retorno Normal (OK o Rechazado tras intentar pagar) ---
        // Solo llega token_ws. Puede ser éxito o rechazo, pero el usuario completó el flujo en Webpay.
        if (token_ws && !tbkToken) {
            console.log(`Intentando commit para token_ws: ${token_ws}`);
            try {
                const commitResponse = await (new WebpayPlus.Transaction()).commit(token_ws);
                console.log("Respuesta del commit:", commitResponse);

                // Verificar si la transacción fue aprobada
                if (commitResponse.response_code === 0 && commitResponse.status === 'AUTHORIZED') {
                    console.log("Transacción APROBADA por Transbank.");
                    // Actualizar estado en la base de datos a APROBADO
                    await db.query(
                        `UPDATE transactions
                         SET status = $1, amount = $2, payment_type_code = $3, card_number = $4,
                             transaction_date = $5, authorization_code = $6, response_code = $7,
                             vci = $8, installments_amount = $9, installments_number = $10, balance = $11
                         WHERE transbank_token = $12`,
                        [
                            commitResponse.status, // 'AUTHORIZED'
                            commitResponse.amount,
                            commitResponse.payment_type_code,
                            commitResponse.card_detail?.card_number, // Usar optional chaining
                            commitResponse.transaction_date,
                            commitResponse.authorization_code,
                            commitResponse.response_code,
                            commitResponse.vci,
                            commitResponse.installments_amount,
                            commitResponse.installments_number,
                            commitResponse.balance,
                            token_ws
                        ]
                    );

                    // Actualizar estado de la reserva
                    await db.query(
                        "UPDATE reservations SET estado_pago = 'Aprobado' WHERE id = (SELECT reservation_id FROM transactions WHERE transbank_token = $1 LIMIT 1)",
                        [token_ws]
                    );

                    console.log("BD actualizada: Transacción y Reserva APROBADAS.");
                    return res.status(200).json({
                        success: true,
                        message: 'Pago validado y aprobado con éxito.',
                        transaction: commitResponse 
                    });

                } else {
                    // Pago RECHAZADO por Transbank (response_code != 0 o status != AUTHORIZED)
                    let errorMessage = getErrorMessage(commitResponse.response_code);
                    console.error(`Transacción RECHAZADA por Transbank. Código: ${commitResponse.response_code}, Mensaje: ${errorMessage}, Status: ${commitResponse.status}`);

                    // Actualizar estados a RECHAZADO
                    await db.query(
                        "UPDATE transactions SET status = 'FAILED', response_code = $1 WHERE transbank_token = $2",
                        [commitResponse.response_code, token_ws]
                    );
                    await db.query(
                        "UPDATE reservations SET estado_pago = 'Rechazado' WHERE id = (SELECT reservation_id FROM transactions WHERE transbank_token = $1 LIMIT 1)",
                        [token_ws]
                    );

                    console.log("BD actualizada: Transacción y Reserva RECHAZADAS.");
                    return res.status(400).json({
                        success: false,
                        message: `Pago rechazado: ${errorMessage}`,
                        transaction: {
                            buy_order: commitResponse.buy_order,
                            session_id: commitResponse.session_id,
                            status: 'FAILED',
                            response_code: commitResponse.response_code
                        }
                    });
                }

            } catch (commitError) {
                // --- MANEJO DEL ERROR ESPECÍFICO AL HACER COMMIT ---
                console.error("Error durante el commit:", commitError);

                if (commitError instanceof TransbankError && commitError.message.includes('aborted')) {
                    // El commit falló porque la transacción ya estaba ABORTADA en Transbank
                    console.warn(`Commit fallido para token ${token_ws}: La transacción fue abortada previamente.`);

                    // Actualizar estados a ABORTADO usando el token_ws
                    await db.query("UPDATE transactions SET status = 'ABORTED' WHERE transbank_token = $1", [token_ws]);
                    await db.query("UPDATE reservations SET estado_pago = 'Anulado' WHERE id = (SELECT reservation_id FROM transactions WHERE transbank_token = $1 LIMIT 1)", [token_ws]);

                     console.log("BD actualizada: Transacción y Reserva ANULADAS (detectado en commit).");
                     return res.status(400).json({
                        success: false,
                        message: 'El pago fue anulado por el usuario (detectado durante la confirmación).',
                        transaction: { token: token_ws, status: 'ABORTED' }
                     });

                } else {
                    // Otro error durante el commit (problema de red, error interno de Transbank, etc.)
                    console.error("Error inesperado durante el commit:", commitError);
                     await db.query("UPDATE transactions SET status = 'COMMIT_ERROR' WHERE transbank_token = $1", [token_ws]);
                    return res.status(500).json({
                        success: false,
                        message: 'Error interno al confirmar la transacción con Transbank.',
                        error: commitError.message
                    });
                }
            }
        }
        // --- Flujo 2: Aborto Explícito (Usuario cancela en Webpay) ---
        // Llegan TBK_TOKEN, TBK_ORDEN_COMPRA, TBK_ID_SESION. NO llega token_ws.
        else if (!token_ws && tbkToken && tbkOrdenCompra && tbkIdSesion) {
            console.log(`Pago ANULADO explícitamente por el usuario. Orden: ${tbkOrdenCompra}, Token Aborto: ${tbkToken}`);

            // Actualizar estados a ABORTADO usando la orden de compra
            await db.query("UPDATE transactions SET status = 'ABORTED' WHERE buy_order = $1", [tbkOrdenCompra]);
            await db.query("UPDATE reservations SET estado_pago = 'Anulado' WHERE id = (SELECT reservation_id FROM transactions WHERE buy_order = $1 LIMIT 1)", [tbkOrdenCompra]);

            console.log("BD actualizada: Transacción y Reserva ANULADAS (flujo TBK_*).");
            return res.status(400).json({
                success: false,
                message: 'El pago fue anulado por el usuario.'
            });
        }
        // --- Flujo 3: Timeout (Usuario no hace nada en Webpay por ~10 min) ---
        // Llegan TBK_ORDEN_COMPRA, TBK_ID_SESION. NO llegan token_ws ni TBK_TOKEN.
        else if (!token_ws && !tbkToken && tbkOrdenCompra && tbkIdSesion) {
            console.log(`Pago ANULADO por tiempo de espera (Timeout). Orden: ${tbkOrdenCompra}`);

            // Actualizar estados a TIMEOUT usando la orden de compra
            await db.query("UPDATE transactions SET status = 'TIMEOUT' WHERE buy_order = $1", [tbkOrdenCompra]);
            await db.query("UPDATE reservations SET estado_pago = 'Anulado' WHERE id = (SELECT reservation_id FROM transactions WHERE buy_order = $1 LIMIT 1)", [tbkOrdenCompra]);

            console.log("BD actualizada: Transacción y Reserva ANULADAS (Timeout).");
            // Informar al usuario del timeout.
             return res.status(408).json({
                success: false,
                message: 'El pago fue anulado por tiempo de espera.'
            });
        }
        // --- Caso Inválido o Inesperado ---
        else {
            console.error("Parámetros de retorno de Transbank inválidos o desconocidos:", params);
            return res.status(400).json({
                success: false,
                message: 'Estado de pago inválido o parámetros desconocidos recibidos.',
                params: params
            });
        }
    } catch (error) {
        // Error general en el controlador validatePayment (fuera del commit)
        console.error("Error general en validatePayment:", error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor al validar el pago.",
            error: error.message
        });
    }
};

/**
 * Obtiene el monto de una reserva
 * @param {number} reservationId ID de la reserva
 * @returns {Promise<number>} Monto de la reserva
 */
const getReservationAmount = async (reservationId) => {
    try {
        const result = await db.query(
            "SELECT monto FROM reservations WHERE id = $1",
            [reservationId]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`No se encontró la reserva con ID ${reservationId}`);
        }
        
        return result.rows[0].monto;
    } catch (error) {
        console.error("Error al obtener el monto de la reserva:", error);
        throw error;
    }
};

/**
 * Obtiene el mensaje de error según el código de respuesta
 * @param {number} responseCode Código de respuesta de Transbank
 * @returns {string} Mensaje de error
 */
const getErrorMessage = (responseCode) => {
    switch (responseCode) {
        case -1:
            return "Transacción rechazada: Posible error en los datos de entrada de la transacción";
        case -2:
            return "Transacción rechazada: Error en el procesamiento relacionado con la tarjeta y/o cuenta asociada";
        case -3:
            return "Transacción rechazada: Error en la transacción";
        case -4:
            return "Transacción rechazada: Rechazada por el emisor";
        case -5:
            return "Transacción rechazada: Riesgo de posible fraude";
        default:
            return "Transacción rechazada: Error desconocido";
    }
};

// Función para consultar el estado de una transacción
const getTransactionStatus = async (req, res, next) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: "Token de transacción requerido" });
        }
        
        const statusResponse = await (new WebpayPlus.Transaction()).status(token);
        
        return res.status(200).json({
            success: true,
            transaction: statusResponse
        });
    } catch (error) {
        console.error("Error al obtener estado de transacción:", error);
        return res.status(500).json({ error: "Error al obtener estado de la transacción" });
    }
};

// Función para reembolsar una transacción
const refundTransaction = async (req, res, next) => {
    try {
        const { token, amount } = req.body;
        
        if (!token || !amount) {
            return res.status(400).json({ error: "Token y monto son requeridos" });
        }
        
        const refundResponse = await (new WebpayPlus.Transaction()).refund(token, amount);
        
        // Actualizar el estado de la transacción en la base de datos
        await db.query(
            "UPDATE transactions SET status = 'REFUNDED', refunded_amount = $1 WHERE transbank_token = $2",
            [amount, token]
        );
        
        return res.status(200).json({
            success: true,
            refund: refundResponse
        });
    } catch (error) {
        console.error("Error al reembolsar transacción:", error);
        return res.status(500).json({ error: "Error al procesar el reembolso" });
    }
};

module.exports = {
    createPayment,
    validatePayment,
    getTransactionStatus,
    refundTransaction
};