const errorHandler = (err, req, res, next) => {
    console.error("Unhandled Error:", err); // Loguea el error completo en el servidor

    // Evita enviar respuesta si ya se envió una (raro, pero posible)
    if (res.headersSent) {
        return next(err);
    }

    // Responde con un error genérico 500 al cliente
    // En producción, podrías querer ocultar detalles específicos del error
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected internal server error occurred.'
        // Podrías añadir más detalles en modo desarrollo: stack: env.nodeEnv === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;