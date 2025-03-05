document.addEventListener("DOMContentLoaded", function () {
    function connectWebSocket() {
        const gameContainer = document.getElementById("game-container");
        let wsUrl;

        if (gameContainer) {
            const gameId = gameContainer.dataset.gameId;
            wsUrl = `ws://${window.location.host}/ws/chat/${gameId}/`;
        } else {
            wsUrl = `ws://${window.location.host}/ws/chat/`;
        }

        const chatSocket = new WebSocket(wsUrl);

        // Obtener el bloque JSON y parsearlo
        const playerDataElement = document.getElementById("player-data");
        if (!playerDataElement) {
            console.error("❌ Error: No se encontró 'player-data'.");
            return;
        }

        const playerData = JSON.parse(playerDataElement.textContent);
        const currentPlayer = playerData[playerData.current];
        const currentUsername = currentPlayer.username;

        // Elementos del DOM
        const chatContainer = document.getElementById("chat-section");
        const chatForm = document.getElementById("chat-form");
        const chatInput = document.getElementById("chat-input");

        if (!chatContainer || !chatForm || !chatInput) {
            console.error("❌ Error: Elementos del chat no encontrados en el DOM.");
            return;
        }

        console.log("✅ Chat form encontrado en el DOM.");

        chatSocket.onopen = function () {
            console.log(`✅ Conectado al WebSocket del chat como ${currentUsername}`);
        };

        chatSocket.onmessage = function (event) {
            const data = JSON.parse(event.data);
            appendMessage(data.username, data.message);
        };

        chatSocket.onclose = function () {
            console.warn("⚠️ Desconectado del WebSocket del chat. Intentando reconectar en 3 segundos...");
            setTimeout(connectWebSocket, 3000); // Intentar reconectar automáticamente
        };

        // Capturar el evento submit para prevenir recarga
        chatForm.addEventListener("submit", function (event) {
            console.log("🚀 Intentando capturar el submit del formulario...");
            event.preventDefault(); // 🚀 Evita que el formulario haga un GET o POST normal

            console.log("📩 Evento submit capturado.");

            const message = chatInput.value.trim();
            if (message !== "") {
                const payload = {
                    type: "chat",
                    username: currentUsername,
                    message: message,
                };

                console.log(`🟢 Intentando enviar mensaje: ${message}`);
                console.log(`📩 Payload enviado:`, payload);

                chatSocket.send(JSON.stringify(payload)); // Enviar mensaje al WebSocket
                chatInput.value = "";
            } else {
                console.warn("⚠️ Mensaje vacío. No se envía.");
            }
        });

        function appendMessage(username, message) {
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("chat-message", "p-2", "border", "rounded", "mb-1", "bg-light");

            // Crear un span para el nombre de usuario con color dinámico
            const usernameSpan = document.createElement("span");
            usernameSpan.className = "username";
            usernameSpan.textContent = username + ": ";
            usernameSpan.style.color = getColorForUser(username);
            usernameSpan.style.fontWeight = "bold";

            // Crear un nodo de texto para el mensaje
            const messageText = document.createTextNode(message);

            // Ensamblar el mensaje y añadirlo al chat
            msgDiv.appendChild(usernameSpan);
            msgDiv.appendChild(messageText);
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    connectWebSocket();
});

// Función para generar colores dinámicos por usuario
function getColorForUser(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}
