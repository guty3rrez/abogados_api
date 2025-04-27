// Obtiene la fecha actual en formato YYYY-MM-DD
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Obtiene la hora actual en formato HH:MM
function getCurrentTimeString() {
    const today = new Date();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Valida si un string tiene el formato YYYY-MM-DD
function isValidDate(dateString) {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dateString);
}

// Verifica si una fecha (YYYY-MM-DD) cae en un día de la semana (lunes a viernes)
function isWeekday(dateString) {
    try {
        // Añadir hora para evitar problemas de zona horaria al crear el objeto Date
        const date = new Date(`${dateString}T12:00:00`);
        const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    } catch (e) {
        // Si la fecha es inválida por alguna razón
        console.error("Error parsing date for weekday check:", e);
        return false;
    }
}

module.exports = {
    getCurrentDateString,
    getCurrentTimeString,
    isValidDate,
    isWeekday,
};