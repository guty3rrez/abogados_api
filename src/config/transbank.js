const WebpayPlus = require("transbank-sdk").WebpayPlus; 
const { Options, IntegrationApiKeys, Environment, IntegrationCommerceCodes } = require("transbank-sdk");
const { generarStringAleatorio } = require("../utils/random");

// Versión 3.x del SDK
const tx = new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration));

const createTransaction = async (reservation_id) => {

    const buyOrder = generarStringAleatorio(12); // Genera un número de orden de compra aleatorio
    const sessionId = reservation_id.toString(); // ID de sesión del usuario
    const amount = 5000; // Monto de la transacción
    const returnUrl = "https://localhost:443/validatePayment"; // URL de retorno después de la transacción
    let response;
    try {
        response = await tx.create(buyOrder, sessionId, amount, returnUrl);
    } catch (error) {
        console.error("Error creating transaction:", error);
        throw error; // Lanza el error para que pueda ser manejado por el llamador
        
    }
    return response;
}


const validateTransaction = async (token) => {
    const response = await tx.commit(token); 
    if (response.response_code == 0) {
        console.error("Error validating transaction:", response);
        throw new Error("Error validating transaction"); // Lanza un error si la validación falla
    }    
    return response;
}

module.exports = {
    createTransaction,
    validateTransaction
}