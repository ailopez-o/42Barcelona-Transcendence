document.addEventListener("DOMContentLoaded", function() {
    // Definir la URL del WebSocket para el chat.
    // Puedes adaptar la URL según cómo hayas configurado el routing en tu proyecto.
    const chatSocket = new WebSocket(`ws://${window.location.host}/ws/chat/`);

    // Elementos del DOM
    const chatContainer = document.getElementById("chat-container");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");

    chatSocket.onopen = function(event) {
        console.log("Conectado al WebSocket del chat");
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
                username: "{{ request.user.username }}",  // Considera pasar este dato desde el template o usando un data-attribute
                message: message
            };
            chatSocket.send(JSON.stringify(payload));
            chatInput.value = "";
        }
    });
});
