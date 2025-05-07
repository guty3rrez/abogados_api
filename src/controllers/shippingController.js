const db = require('../config/database'); // Importa la configuración de la base de datos


const createQuote = async (originCountyCode, destinationCountyCode) => {

    //Petición POST a la API de Chilexpress para obtener la cotización
    url = "https://testservices.wschilexpress.com/rating/api/v1.0/rates/courier";
    
    // Definir los parámetros mínimos para la cotización
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": "5ec28a9603274d8db7510049580feaa6"

    }
    body = {
        "originCountyCode": originCountyCode,
        "destinationCountyCode": destinationCountyCode,
        "package": {
            "weight": "1",
            "height": "1",
            "width": "1",
            "length": "1",
        },
        "productType": 1, //1 Documento, 3 Encomienda
        "contentType": 1, //Descripción del contenido declarado
        "declaredWorth": "1000", //Valor declarado del paquete.
    }

    ```
    Respuesta de la API de Chilexpress para la cotización
    {
        "data": {
            "courierServiceOptions": [{
                "serviceTypeCode": 41,
                "serviceDescription": "Enc. Grandes",
                "didUseVolumetricWeight": false,
                "finalWeight": "16.00",
                "serviceValue": "8715",
                "conditions": "",
                "deliveryType": 0,
                "additionalServices": []
            }, {
                "serviceTypeCode": 43,
                "serviceDescription": "Log Dev Enc. Grandes",
                "didUseVolumetricWeight": false,
                "finalWeight": "16.00",
                "serviceValue": "8715",
                "conditions": "",
                "deliveryType": 0,
                "additionalServices": []
            }, {
                "serviceTypeCode": 45,
                "serviceDescription": "Log Dev Especial Enc. Grandes",
                "didUseVolumetricWeight": false,
                "finalWeight": "16.00",
                "serviceValue": "8715",
                "conditions": "",
                "deliveryType": 0,
                "additionalServices": []
            }]
        },
        "statusCode": 0,
        "statusDescription": "OK",
        "errors": null
    }
    ```
    
};


const createShipping = async (countyOfOriginCoverageCode, streetName, streetNumber, fullName, phoneNumber, mail, serviceDeliveryCode, deliveryReference, groupReference ) => {

    //Petición POST para generar envío a la API de Chilexpress
    url = "https://testservices.wschilexpress.com/transport-orders/api/v{version}/transport-orders";

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": "629ab4a902d54239989cd1c2f3d20dfa"

    }
    // Definir los parámetros mínimos para el envío
    body = {
        "header": {
            "customerCardNumber": "18578680", //Número de Tarjeta Cliente de Chilexpress (TCC) - Este es el utilizado para pruebas
            "countyOfOriginCoverageCode": countyOfOriginCoverageCode, //Código de la comuna de origen
            "labelType": 2,
        },
        "details": [{
            "addresses": [{ //Dirección de DESTINO
                "countyCoverageCode": countyOfOriginCoverageCode,
                "streetName": streetName,
                "streetNumber": streetNumber,
                "supplement": "",
                "addressType": "DEST",
                "observation": "DEFAULT"
            }, { //Dirección de DEVOLUCIÓN
                "countyCoverageCode": "PLCA",
                "streetName": "SARMIENTO",
                "streetNumber": 120,
                "supplement": "DEFAULT",
                "addressType": "DEV",
                "deliveryOnCommercialOffice": false,
                "observation": "DEFAULT"
            }],
            "contacts": [{ //Datos de contacto de DESTINATARIO
                "name": fullName,
                "phoneNumber": phoneNumber,
                "mail": mail,
                "contactType": "D"
            }, { //Datos de contacto de REMITENTE
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
                "productCode": "1", //1 Documento, 3 Encomienda
                "deliveryReference": deliveryReference,
                "groupReference": groupReference,
                "declaredValue": "1000",
                "declaredContent": "1",
                "receivableAmountInDelivery": 1000
            }]
        }]
    }


}

// POST /api/shipping
const sendShipping = async (req, res, next) => {
    const { reservation_id } = req.body;
    //TODO: Obtener variables de la base de datos con reservation_id

    //Con los valores llamar a 
    //createQuote(originCountyCode, destinationCountyCode)
    //createShipping(countyOfOriginCoverageCode, streetName, streetNumber, fullName, phoneNumber, mail, serviceDeliveryCode, deliveryReference, groupReference)
    

}


module.exports = {
    sendShipping
};