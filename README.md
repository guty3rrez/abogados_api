# API de Reservas y Pagos

Esta es una API backend construida con Node.js y Express para gestionar reservas, procesar pagos a través de Transbank Webpay Plus, y gestionar envíos a través de Chilexpress.

## Tabla de Contenidos

1.  [Características](#características)
2.  [Tecnologías Utilizadas](#tecnologías-utilizadas)
3.  [Requisitos Previos](#requisitos-previos)
4.  [Instalación](#instalación)
5.  [Configuración del Entorno](#configuración-del-entorno)
6.  [Ejecución del Servidor](#ejecución-del-servidor)
7.  [Estructura del Proyecto](#estructura-del-proyecto)
8.  [Endpoints de la API](#endpoints-de-la-api)
    *   [Slots (Horarios Disponibles)](#slots-horarios-disponibles)
    *   [Bookings (Reservas)](#bookings-reservas)
    *   [Shipping (Envíos)](#shipping-envíos)
    *   [Payments (Pagos)](#payments-pagos)
9.  [Base de Datos](#base-de-datos)
10. [Contribuciones](#contribuciones)

## Características

*   Consulta de horarios de reserva disponibles por fecha.
*   Creación de nuevas reservas.
*   Validación de horarios y fechas de reserva.
*   Integración con Transbank Webpay Plus para procesamiento de pagos.
*   Gestión de direcciones de envío.
*   Integración con API de Chilexpress para cotización y creación de envíos.
*   Inicio del servidor en modo HTTP o HTTPS.
*   Manejo centralizado de errores.
*   Configuración basada en variables de entorno.
*   Documentación de API servida en la ruta raíz (`/`).

## Tecnologías Utilizadas

*   **Node.js**: Entorno de ejecución para JavaScript.
*   **Express.js**: Framework web para Node.js.
*   **PostgreSQL**: Sistema de gestión de bases de datos relacional.
*   **node-postgres (pg)**: Cliente PostgreSQL para Node.js.
*   **dotenv**: Módulo para cargar variables de entorno desde un archivo `.env`.
*   **cors**: Middleware para habilitar Cross-Origin Resource Sharing.
*   **transbank-sdk**: SDK oficial de Transbank para Node.js.
*   **axios**: Cliente HTTP basado en promesas para realizar peticiones a APIs externas (Chilexpress).

## Requisitos Previos

*   Node.js (v16 o superior recomendado)
*   npm (o yarn)
*   PostgreSQL (instalado y corriendo)
*   Git

## Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_DIRECTORIO_DEL_PROYECTO>
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    # o
    yarn install
    ```

3.  **Configura las variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto (al mismo nivel que `package.json`). Ver la sección [Configuración del Entorno](#configuración-del-entorno) para más detalles.

4.  **Configura la base de datos:**
    Asegúrate de que tu instancia de PostgreSQL esté corriendo y que la URL de conexión en tu archivo `.env` sea correcta. La aplicación intentará crear las tablas necesarias automáticamente al iniciarse.

## Configuración del Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Entorno de la aplicación (development, production, test)
NODE_ENV=development

# Puerto para el servidor HTTP
PORT_HTTP=3000

# Puerto para el servidor HTTPS
PORT_HTTPS=443

# URL de conexión a la base de datos PostgreSQL
# Ejemplo: DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/nombre_base_datos"
DATABASE_URL=

# Rutas a los archivos SSL para HTTPS (relativas a la raíz del proyecto)
# Necesarios solo si se ejecuta en modo HTTPS
SSL_KEY_PATH=key.pem
SSL_CERT_PATH=cert.pem

# (Opcional) Credenciales de prueba para Chilexpress (ya están hardcodeadas en modo test, pero podrían ser variables de entorno)
# CHILEXPRESS_API_KEY_RATING=5ec28a9603274d8db7510049580feaa6
# CHILEXPRESS_API_KEY_TRANSPORT=629ab4a902d54239989cd1c2f3d20dfa
```

**Nota sobre SSL:** Para el modo HTTPS en desarrollo, puedes generar certificados autofirmados:
```bash
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem
```
Coloca `key.pem` y `cert.pem` en la raíz de tu proyecto.

## Ejecución del Servidor

*   **Para iniciar en modo HTTP (predeterminado):**
    ```bash
    node src/server.js
    ```
    El servidor se iniciará en `http://localhost:3000` (o el puerto definido en `PORT_HTTP`).

*   **Para iniciar en modo HTTPS:**
    ```bash
    node src/server.js https
    ```
    El servidor se iniciará en `https://localhost:443` (o el puerto definido en `PORT_HTTPS`). Asegúrate de tener los archivos `key.pem` y `cert.pem` configurados.

La documentación de la API estará disponible en la ruta raíz (ej. `http://localhost:3000/`).

## Estructura del Proyecto

```
.
├── .env                      # Variables de entorno (NO versionar si contiene secretos)
├── api-docs.html             # Documentación estática de la API
├── package.json
├── README.md
└── src/
    ├── app.js                # Configuración principal de la aplicación Express
    ├── server.js             # Lógica de arranque del servidor HTTP/HTTPS
    ├── config/
    │   ├── database.js       # Conexión y configuración de la BD, creación de tablas
    │   └── env.js            # Carga y exportación de variables de entorno
    ├── controllers/
    │   ├── bookingController.js
    │   ├── paymentController.js
    │   ├── shippingController.js
    │   └── slotsController.js
    ├── middleware/
    │   ├── errorHandler.js   # Manejador de errores global
    │   └── notFoundHandler.js# Manejador para rutas no encontradas (404)
    ├── routes/
    │   └── apiRoutes.js      # Definición de todas las rutas de la API
    └── utils/
        ├── constants.js      # Constantes (ej. horarios de atención)
        ├── dateTime.js       # Funciones de utilidad para fechas y horas
        └── random.js         # Funciones para generar strings aleatorios
```

## Endpoints de la API

Todas las rutas de la API están prefijadas con `/api`.

---

### Slots (Horarios Disponibles)

#### `GET /api/slots`

Obtiene los horarios disponibles para una fecha específica.

*   **Query Parameters:**
    *   `date` (string, YYYY-MM-DD, requerido): La fecha para la cual se desean consultar los horarios.

*   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "available_slots": ["14:00", "15:00", "16:00", "17:00"]
    }
    ```
    Si no hay horarios disponibles, `available_slots` será un array vacío `[]`.

*   **Respuestas de Error:**
    *   `400 Bad Request`: Si falta el parámetro `date`, el formato es inválido, la fecha es pasada o no es un día hábil.
      ```json
      { "error": "Missing 'date' query parameter." }
      // o
      { "error": "Invalid date format. Please use YYYY-MM-DD." }
      // o
      { "error": "Bookings are only available on weekdays (Monday to Friday)." }
      // o
      { "error": "Cannot retrieve slots for a past date." }
      ```
    *   `500 Internal Server Error`: Error interno del servidor.

---

### Bookings (Reservas)

#### `POST /api/book`

Crea una nueva reserva.

*   **Request Body (application/json):**
    | Campo           | Tipo   | Descripción                                      | Requerido |
    |-----------------|--------|--------------------------------------------------|-----------|
    | `selected_date` | string | Fecha de la reserva (YYYY-MM-DD)                 | Sí        |
    | `selected_time` | string | Hora de la reserva (HH:MM, de los slots disponibles) | Sí        |
    | `nombre`        | string | Nombre completo del cliente                      | Sí        |
    | `email`         | string | Email del cliente                                | Sí        |
    | `telefono`      | string | Teléfono del cliente                             | Sí        |
    | `motivo`        | string | Motivo de la reserva (opcional)                  | No        |

    Ejemplo:
    ```json
    {
        "selected_date": "2024-08-15",
        "selected_time": "10:00",
        "nombre": "Juan Pérez",
        "email": "juan.perez@example.com",
        "telefono": "912345678",
        "motivo": "Consulta general"
    }
    ```

*   **Respuesta Exitosa (201 Created):**
    ```json
    {
        "success": true,
        "message": "Your booking has been successfully confirmed!",
        "booking": {
            "id": 123,
            "date": "2024-08-15",
            "time": "10:00",
            "name": "Juan Pérez",
            "payment_status": "Pendiente" // Estado inicial del pago
        }
    }
    ```

*   **Respuestas de Error:**
    *   `400 Bad Request`: Si faltan campos requeridos o los datos son inválidos.
      ```json
      {
          "message": "Validation failed.",
          "errors": {
              "selected_date": "Valid booking date (YYYY-MM-DD) is required.",
              "selected_time": "Valid booking time from available slots is required. Cannot book a time slot that has already passed today."
              // ... otros errores
          }
      }
      ```
    *   `409 Conflict`: Si el horario ya está reservado.
      ```json
      {
          "message": "Sorry, this time slot was just booked or is already taken. Please choose another one."
      }
      ```
    *   `500 Internal Server Error`: Error interno del servidor.

---

### Shipping (Envíos)

#### `POST /api/saveShippingAddress`

Guarda o actualiza la dirección de envío para una reserva existente.

*   **Request Body (application/json):**
    | Campo                        | Tipo   | Descripción                                                                 | Requerido |
    |------------------------------|--------|-----------------------------------------------------------------------------|-----------|
    | `reservation_id`             | number | ID de la reserva asociada.                                                  | Sí        |
    | `calle`                      | string | Nombre de la calle.                                                         | Sí        |
    | `numero`                     | string | Número de la dirección.                                                     | Sí        |
    | `depto`                      | string | Número de departamento/oficina (opcional).                                  | No        |
    | `region`                     | string | Región.                                                                     | Sí        |
    | `provincia`                  | string | Provincia (usada como `destinationCountyCode` para cotización Chilexpress). | Sí        |
    | `codigo_postal`              | string | Código postal (opcional).                                                   | No        |
    | `comuna_destino_chilexpress` | string | Código de comuna Chilexpress para el destino (ej: "STGO", "VALP", "PLCA").    | Sí        |

    Ejemplo:
    ```json
    {
        "reservation_id": 123,
        "calle": "Avenida Siempre Viva",
        "numero": "742",
        "depto": "A",
        "region": "Metropolitana",
        "provincia": "Santiago",
        "codigo_postal": "1234567",
        "comuna_destino_chilexpress": "STGO"
    }
    ```

*   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "success": true,
        "message": "Dirección de envío guardada/actualizada correctamente.",
        "data": {
            "id": 1,
            "reservation_id": 123,
            "calle": "Avenida Siempre Viva",
            "numero": "742",
            "depto": "A",
            "region": "Metropolitana",
            "provincia": "Santiago",
            "codigo_postal": "1234567",
            "comuna_destino_chilexpress": "STGO",
            "status": "Pendiente",
            "created_at": "2024-07-29T10:00:00.000Z",
            "updated_at": "2024-07-29T10:00:00.000Z"
            // ... otros campos de la tabla shipping
        }
    }
    ```

*   **Respuestas de Error:**
    *   `400 Bad Request`: Si faltan campos requeridos o los datos son inválidos.
      ```json
      { "success": false, "error": "El ID de reserva (reservation_id) es requerido." }
      // o
      { "success": false, "error": "Los campos calle, numero, region, provincia y comuna_destino_chilexpress son requeridos." }
      ```
    *   `500 Internal Server Error`: Error interno del servidor.

#### `POST /api/shipping`

Procesa un envío a través de Chilexpress. Primero cotiza y luego crea la orden de transporte.

*   **Request Body (application/json):**
    | Campo           | Tipo   | Descripción                  | Requerido |
    |-----------------|--------|------------------------------|-----------|
    | `reservation_id`| number | ID de la reserva a enviar.   | Sí        |

    Ejemplo:
    ```json
    {
        "reservation_id": 123
    }
    ```

*   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "success": true,
        "message": "Envío procesado correctamente con Chilexpress",
        "data": {
            "quoteDetails": { /* Detalles de la cotización seleccionada de Chilexpress */ },
            "shippingDetails": { /* Detalles del envío creado en Chilexpress, incluye trackingNumber */ }
        }
    }
    ```

*   **Respuestas de Error:**
    *   `400 Bad Request`: Si falta `reservation_id`, faltan datos de envío en la reserva, o no se pueden obtener opciones de envío.
      ```json
      { "success": false, "error": "Se requiere el ID de reserva" }
      // o
      { "success": false, "error": "Faltan datos de envío o contacto para la reserva..." }
      // o
      { "success": false, "error": "No se pudieron obtener opciones de envío para la ubicación especificada..." }
      ```
    *   `500 Internal Server Error`: Error al crear el envío en Chilexpress o error interno general.
      ```json
      { "success": false, "error": "Error al crear el envío en Chilexpress. No se recibió número de seguimiento." }
      ```

---

### Payments (Pagos)

#### `POST /api/createPayment`

Inicia una transacción de pago con Transbank Webpay Plus.

*   **Request Body (application/json):**
    | Campo           | Tipo   | Descripción                              | Requerido |
    |-----------------|--------|------------------------------------------|-----------|
    | `reservation_id`| number | ID de la reserva para la cual se paga.   | Sí        |

    Ejemplo:
    ```json
    {
        "reservation_id": 123
    }
    ```

*   **Respuesta Exitosa (200 OK):**
    Retorna la URL de Transbank para redirigir al usuario y el token de la transacción.
    ```json
    {
        "url": "https://webpay3gint.transbank.cl/webpayserver/initTransaction?token_ws=xxxxxxxxxxxx",
        "token": "xxxxxxxxxxxx"
    }
    ```

*   **Respuestas de Error:**
    *   `400 Bad Request`: Si falta `reservation_id`.
      ```json
      { "error": "El ID de reserva es requerido" }
      ```
    *   `500 Internal Server Error`: Error al crear la transacción en Transbank o al guardar en la base de datos.
      ```json
      { "error": "Error al crear el pago" }
      ```

#### `POST /api/validatePayment`

Valida el resultado de una transacción de pago después de que el usuario regresa de Transbank.
Este endpoint es invocado por el frontend, que recibe los parámetros de Transbank.

*   **Request Body (application/json):**
    Los parámetros dependen del flujo de Transbank:
    1.  **Flujo Normal (éxito o rechazo tras intento de pago):**
        | Campo      | Tipo   | Descripción                        |
        |------------|--------|------------------------------------|
        | `token_ws` | string | Token devuelto por Transbank.      |

    2.  **Aborto Explícito (usuario cancela en Webpay):**
        | Campo             | Tipo   | Descripción                        |
        |-------------------|--------|------------------------------------|
        | `TBK_TOKEN`       | string | Token de la transacción abortada.  |
        | `TBK_ORDEN_COMPRA`| string | Orden de compra asociada.          |
        | `TBK_ID_SESION`   | string | ID de sesión asociado.             |

    3.  **Timeout (usuario no hace nada en Webpay):**
        | Campo             | Tipo   | Descripción                        |
        |-------------------|--------|------------------------------------|
        | `TBK_ORDEN_COMPRA`| string | Orden de compra asociada.          |
        | `TBK_ID_SESION`   | string | ID de sesión asociado.             |

    Ejemplo (Flujo Normal):
    ```json
    {
        "token_ws": "xxxxxxxxxxxx"
    }
    ```

*   **Respuesta Exitosa (200 OK - Pago Aprobado):**
    ```json
    {
        "success": true,
        "message": "Pago validado y aprobado con éxito.",
        "transaction": { /* Objeto con detalles de la transacción aprobada por Transbank */ }
    }
    ```

*   **Respuestas de Error (Pueden tener diferentes códigos HTTP):**
    *   `400 Bad Request (Pago Rechazado por Transbank)`:
      ```json
      {
          "success": false,
          "message": "Pago rechazado: Transacción rechazada: Posible error en los datos de entrada...",
          "transaction": { /* Detalles de la transacción rechazada */ }
      }
      ```
    *   `400 Bad Request (Pago Anulado por Usuario - detectado en commit)`:
      ```json
      {
          "success": false,
          "message": "El pago fue anulado por el usuario (detectado durante la confirmación).",
          "transaction": { "token": "xxxxxxxxxxxx", "status": "ABORTED" }
      }
      ```
    *   `400 Bad Request (Pago Anulado por Usuario - flujo TBK_*)`:
      ```json
      {
          "success": false,
          "message": "El pago fue anulado por el usuario."
      }
      ```
    *   `408 Request Timeout (Pago Anulado por Timeout)`:
      ```json
      {
          "success": false,
          "message": "El pago fue anulado por tiempo de espera."
      }
      ```
    *   `400 Bad Request (Parámetros Inválidos)`:
      ```json
      {
          "success": false,
          "message": "Estado de pago inválido o parámetros desconocidos recibidos.",
          "params": { /* Parámetros recibidos */ }
      }
      ```
    *   `500 Internal Server Error`: Error interno al confirmar con Transbank o al actualizar la base de datos.
      ```json
      {
          "success": false,
          "message": "Error interno al confirmar la transacción con Transbank.",
          "error": "Mensaje del error original"
      }
      ```

## Base de Datos

La aplicación utiliza PostgreSQL. El archivo `src/config/database.js` se encarga de:
1.  Establecer la conexión con la base de datos utilizando la variable de entorno `DATABASE_URL`.
2.  Probar la conexión al iniciar la aplicación.
3.  Ejecutar una función `setupDatabase` que crea/actualiza las tablas necesarias (`reservations`, `shipping`, `transactions`) y funciones/triggers de PostgreSQL si no existen. Esto asegura que la estructura de la base de datos esté lista para su uso.

Las tablas principales son:
*   `reservations`: Almacena información sobre las reservas (fecha, hora, cliente, estado de pago, etc.).
*   `shipping`: Almacena información de envío asociada a una reserva (dirección, estado del envío, etc.).
*   `transactions`: Almacena detalles de las transacciones de pago (token de Transbank, orden de compra, estado, monto, etc.).

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un *issue* para discutir cambios mayores o reportar bugs. Para cambios menores, puedes enviar un *Pull Request*.

**Notas importantes:**

1.  **Rutas Relativas:** En `server.js`, las rutas a `key.pem` y `cert.pem` se resuelven desde `__dirname` (directorio `src`) y luego subiendo un nivel (`..`) para llegar a la raíz del proyecto. Esto es correcto si `env.sslKeyPath` y `env.sslCertPath` son rutas relativas a la raíz del proyecto (como `key.pem` y `cert.pem`).
2.  **Chilexpress API Keys:** Las claves de API para Chilexpress están hardcodeadas en `shippingController.js`. En un entorno de producción, estas deberían ser variables de entorno. He añadido un comentario en la sección de `.env` del README para esto.
3.  **Documentación Raíz:** El archivo `app.js` ya sirve `api-docs.html` en la ruta raíz (`/`). Así que, si guardas el HTML anterior como `api-docs.html` en la raíz de tu proyecto (junto a `package.json`), debería funcionar.
4.  **Errores Específicos:** He tratado de capturar los principales flujos de error, especialmente para `validatePayment` que es complejo.
5.  **Adaptación:** Revisa los ejemplos de respuestas y los detalles para asegurarte de que coinciden exactamente con lo que tu API retorna en cada caso, ya que algunos campos (como IDs o timestamps) variarán.
