# API REST - Reserva de Horas para Estudio de Abogados

Esta API REST permite gestionar la consulta de horarios disponibles y la creación de reservas para un estudio de abogados. Está desarrollada en Node.js con Express y utiliza un archivo `reservas.json` como almacenamiento simple de datos.

## Tabla de Contenidos

1.  [Introducción](#introducción)
2.  [Instalación y Ejecución](#instalación-y-ejecución)
3.  [Endpoints de la API](#endpoints-de-la-api)
    *   [GET /slots](#get-slots)
    *   [POST /book](#post-book)
4.  [Almacenamiento de Datos](#almacenamiento-de-datos)
5.  [Manejo de Errores](#manejo-de-errores)

## Introducción

El objetivo de esta API es proporcionar los servicios backend necesarios para:

*   Consultar qué horarios están disponibles para reservar en una fecha específica, considerando los días hábiles y los horarios ya ocupados.
*   Registrar una nueva reserva con los datos del cliente, validando la disponibilidad y la información proporcionada.

## Instalación y Ejecución

**Requisitos:**

*   Node.js (v14 o superior recomendado)
*   npm (generalmente viene con Node.js)

**Pasos:**

1.  Clona o descarga este repositorio/código.
2.  Navega a la carpeta del proyecto en tu terminal.
3.  Instala las dependencias:
    ```bash
    npm install
    ```
4.  Asegúrate de que exista un archivo `reservas.json` en la raíz del proyecto. Si no existe, créalo con el siguiente contenido inicial (un array vacío):
    ```json
    []
    ```
5.  Inicia el servidor:
    ```bash
    node server.js
    ```
6.  Por defecto, el servidor se ejecutará en `http://localhost:3000`.

## Endpoints de la API

### GET /slots

Obtiene la lista de horarios de atención disponibles para una fecha específica.

*   **Método:** `GET`
*   **URL:** `/slots`
*   **Parámetros de Query:**
    *   `date` (Obligatorio): La fecha para la cual se desea consultar la disponibilidad.
        *   **Formato:** `YYYY-MM-DD` (ej. `2023-12-15`)
*   **Respuesta Exitosa (Código `200 OK`):**
    Un objeto JSON que contiene un array `available_slots` con las horas disponibles (en formato `HH:MM`) para la fecha consultada.
    ```json
    {
      "available_slots": [
        "09:00",
        "11:00",
        "12:00",
        "14:00",
        "16:00",
        "17:00"
      ]
    }
    ```
    *Nota: Si la fecha es hoy, solo se mostrarán los horarios futuros. Si no hay horarios disponibles o la fecha es pasada, el array estará vacío (`[]`).*

*   **Respuestas de Error:**
    *   **`400 Bad Request`**:
        *   Si falta el parámetro `date`:
            ```json
            { "error": "Missing 'date' query parameter." }
            ```
        *   Si el formato de `date` es inválido:
            ```json
            { "error": "Invalid date format. Please use YYYY-MM-DD." }
            ```
        *   Si la `date` corresponde a un fin de semana (Sábado o Domingo):
            ```json
            { "error": "Bookings are only available on weekdays (Monday to Friday)." }
            ```
    *   **`500 Internal Server Error`**: Si ocurre un problema al leer el archivo `reservas.json`.
        ```json
        { "error": "Internal server error retrieving slots." }
        ```

### POST /book

Crea una nueva reserva para un cliente en una fecha y hora específicas. La información de la reserva se guarda en `reservas.json` y **se muestra por la consola del servidor** al recibirla.

*   **Método:** `POST`
*   **URL:** `/book`
*   **Cabeceras (Headers):**
    *   `Content-Type: application/json`
*   **Cuerpo de la Petición (Request Body - JSON):**
    ```json
    {
        "selected_date": "YYYY-MM-DD", // Fecha de la reserva (obligatorio, formato válido)
        "selected_time": "HH:MM",      // Hora de la reserva (obligatorio, debe ser uno de los horarios válidos)
        "nombre": "Nombre Completo del Cliente", // (obligatorio, string no vacío)
        "email": "correo@ejemplo.com", // (obligatorio, formato email válido)
        "telefono": "123456789",       // (obligatorio, string no vacío)
        "motivo": "Motivo de la consulta" // (opcional, string)
    }
    ```
*   **Respuesta Exitosa (Código `201 Created`):**
    Un objeto JSON indicando que la reserva fue creada exitosamente.
    ```json
    {
        "success": true,
        "message": "Your booking has been successfully confirmed!"
    }
    ```

*   **Respuestas de Error:**
    *   **`400 Bad Request`**: Si faltan campos obligatorios, los formatos son inválidos, se intenta reservar en fin de semana, o se intenta reservar una hora pasada en el día actual. La respuesta incluirá un objeto `errors` detallando los campos con problemas.
        ```json
        {
            "message": "Validation failed.",
            "errors": {
                "selected_date": "Valid booking date (YYYY-MM-DD) is required.",
                "email": "Valid email address is required.",
                "selected_time": "Cannot book a time slot that has already passed today."
                // ... otros posibles errores
            }
        }
        ```
    *   **`409 Conflict`**: Si el horario (`selected_date` y `selected_time`) solicitado ya se encuentra reservado.
        ```json
        {
            "message": "Sorry, this time slot was just booked. Please choose another one."
        }
        ```
    *   **`500 Internal Server Error`**: Si ocurre un problema al leer o escribir en el archivo `reservas.json`.
        ```json
        { "message": "Internal server error processing booking." }
        ```

## Almacenamiento de Datos

Las reservas confirmadas se almacenan en el archivo `reservas.json`, ubicado en la raíz del proyecto. Cada reserva se guarda como un objeto JSON dentro de un array principal.

**Formato de una reserva en `reservas.json`:**

```json
[
  {
    "fecha": "2023-12-15",
    "hora": "10:00",
    "nombre": "Juan Perez",
    "email": "juan.perez@example.com",
    "telefono": "+56912345678",
    "motivo": "Consulta sobre contrato laboral"
  },
  // ... más reservas
]
```

*Importante:* Este método de almacenamiento es simple y adecuado para desarrollo o prototipos. Para un entorno de producción, se recomienda utilizar una base de datos real (como PostgreSQL, MySQL, MongoDB, etc.) para mayor robustez, escalabilidad y manejo de concurrencia.

## Manejo de Errores

La API utiliza códigos de estado HTTP estándar para indicar el resultado de las peticiones:

*   `200 OK`: Petición GET exitosa.
*   `201 Created`: Petición POST exitosa (recurso creado).
*   `400 Bad Request`: Error en la petición del cliente (datos faltantes, formato inválido, lógica de negocio no cumplida como reservar en fin de semana).
*   `404 Not Found`: El endpoint solicitado no existe.
*   `409 Conflict`: Conflicto al intentar crear un recurso que ya existe (ej. reservar un horario ocupado).
*   `500 Internal Server Error`: Error inesperado en el servidor (ej. problemas al leer/escribir el archivo de datos).

Las respuestas de error (`40x`, `5xx`) generalmente incluyen un cuerpo JSON con un campo `error` o `message` descriptivo, y en caso de errores de validación (400), puede incluir un objeto `errors` detallando los campos específicos.