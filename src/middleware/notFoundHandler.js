const notFoundHandler = (req, res, next) => {
    // Responde con 404 para cualquier ruta no definida previamente
    res.status(404).json({ error: 'Not Found', message: `Cannot ${req.method} ${req.originalUrl}` });
};

module.exports = notFoundHandler;