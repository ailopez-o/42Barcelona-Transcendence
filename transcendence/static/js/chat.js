document.addEventListener("DOMContentLoaded", function() {
    // Definir la URL del WebSocket para el chat.
    // Puedes adaptar la URL según cómo hayas configurado el routing en tu proyecto.

    const gameContainer = document.getElementById("game-container");
    
    if (gameContainer) {
        // Si existe game-container, usamos el id de la partida
        const gameId = gameContainer.dataset.gameId;
        wsUrl = `ws://${window.location.host}/ws/chat/${gameId}/`;
    } else {
        // Si no existe, se asume que es el chat global
        wsUrl = `ws://${window.location.host}/ws/chat/`;
    }

    const chatSocket = new WebSocket(wsUrl);

    // Obtener el bloque JSON y parsearlo
    const playerDataElement = document.getElementById("player-data");
    const playerData = JSON.parse(playerDataElement.textContent);
    
    // Usar la propiedad "current" para obtener el objeto correspondiente
    const currentPlayer = playerData[playerData.current];
    const currentUsername = currentPlayer.username;
    
    // Elementos del DOM
    const chatContainer = document.getElementById("chat-section");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    
    chatSocket.onopen = function(event) {
        console.log(`Conectado al WebSocket del chat, ${currentUsername}`);
    };

    chatSocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const msgDiv = document.createElement("div");
        
        // Crear un span para el nombre del usuario y el separador ": "
        const usernameSpan = document.createElement("span");
        usernameSpan.className = "username";
        usernameSpan.textContent = data.username + ": ";
        usernameSpan.style.color = getColorForUser(data.username);
        usernameSpan.style.display = "inline";  // Asegura que sea inline
        
        // Crear un nodo de texto para el mensaje
        const messageText = document.createTextNode(data.message);
        
        // Agregar ambos al contenedor del mensaje
        msgDiv.appendChild(usernameSpan);
        msgDiv.appendChild(messageText);
        
        // Asegúrate de que el contenedor del mensaje (msgDiv) se muestre como bloque o inline-block según tus necesidades
        msgDiv.style.display = "block";
        
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };
    

    chatSocket.onclose = function(event) {
        console.log("Desconectado del WebSocket del chat");
    };

    chatForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const message = chatInput.value.trim();
        if (message !== "") {
            const payload = {
                type: "chat",
                username: currentUsername,
                message: message
            };
            chatSocket.send(JSON.stringify(payload));
            chatInput.value = "";
        }
    });
});


function getColorForUser(username) {
    // Genera un hash simple a partir del nombre de usuario
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Usamos el hash para generar un valor de tono (hue) entre 0 y 360
    const hue = Math.abs(hash) % 360;
    // Retornamos un color en HSL, ajusta la saturación y luminosidad según prefieras
    return `hsl(${hue}, 70%, 50%)`;
}
