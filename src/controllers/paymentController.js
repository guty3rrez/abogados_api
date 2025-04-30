const db = require('../config/database'); // Importa la configuración de la base de datos
const { createTransaction, validateTransaction } = require("../config/transbank")


//POST /api/createPayment
const createPayment = async (req, res, next) => {
    const { reservation_id } = req.body; // ID de la reserva
    console.log("ID de la reserva:", reservation_id); // Imprime el ID de la reserva para depuración
    //Crea la transacción con el ID de la reserva y obtiene el token y la URL
    const response = await createTransaction(reservation_id);
    if (!response.url || !response.token) {
        console.error("Error creating payment:", response);
        res.status(500).json({ error: "Error creating payment" }); // Manejo de errores
    }
    else {
        //Transacción creada con éxito
        //Guardar información en la base de datos
        console.log("Transacción creada con éxito:", response);
        res.status(200).json({ url: `${response.url}/?token=${response.token}`}); // Respuesta exitosa con el token y la URL
    }
        
}


//GET /api/validatePayment
const validatePayment = async (req, res, next) => {
    try {
        const { token_ws } = req.query; // Obtiene el token de la consulta

        if (!token_ws) {
            return res.status(400).json({ message: 'Token no recibido' });
        }

        const response = validateTransaction(token_ws); // Valida la transacción con el token
        switch (response.response_code) {
            case 0:
                console.log("Transacción validada con éxito:", response);
                res.status(200).json({ message: 'Transacción validada con éxito', response }); // Respuesta exitosa con la transacción validada
                //Guardar información en la base de datos



                break;
            case -1:
                console.error("Transaction rejected: Possible error in transaction data entry");
                throw new Error("Transaction rejected: Possible error in transaction data entry");
            case -2:
                console.error("Transaction rejected: Failure processing the transaction, related to card parameters and/or associated account");
                throw new Error("Transaction rejected: Failure processing the transaction, related to card parameters and/or associated account");
            case -3:
                console.error("Transaction rejected: Transaction error");
                throw new Error("Transaction rejected: Transaction error");
            case -4:
                console.error("Transaction rejected: Rejected by the issuer");
                throw new Error("Transaction rejected: Rejected by the issuer");
            case -5:
                console.error("Transaction rejected: Transaction with risk of possible fraud");
                throw new Error("Transaction rejected: Transaction with risk of possible fraud");
        }

    } catch (error) {
        console.error("Error validating payment:", error);
        res.status(500).json({ error: "Error validating payment" }); // Manejo de errores
    }
}


module.exports = {
    createPayment,
    validatePayment
}