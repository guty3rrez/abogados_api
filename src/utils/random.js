function generarStringAleatorio(longitud = 26) {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789|_=&%.,~:/?[+!@()>-";
    let resultado = "";
    
    for (let i = 0; i < longitud; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    return resultado;
}

module.exports = {
    generarStringAleatorio
};