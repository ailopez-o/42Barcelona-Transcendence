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
        msgDiv.innerText = `${data.username}: ${data.message}`;
        chatContainer.appendChild(msgDiv);
        // Desplaza el scroll hacia abajo
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
