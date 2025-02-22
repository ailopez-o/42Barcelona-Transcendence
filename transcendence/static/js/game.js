document.addEventListener("DOMContentLoaded", function() {
    const gameId = document.getElementById("game-container").dataset.gameId;
    const username = document.getElementById("game-container").dataset.username;
    
    // Conectar al servidor WebSocket
    const socket = new WebSocket(`ws://${window.location.host}/ws/game/${gameId}/`);

    socket.onopen = function(event) {
        console.log("Conectado al WebSocket");
    };

    socket.onmessage = function(event) {
        console.log("Mensaje recibido:", event.data);
        const data = JSON.parse(event.data);
        document.getElementById("status-message").innerText = data.message;
    };

    socket.onclose = function(event) {
        console.log("Mensaje recibido:", event.data);
        console.log("Conexión cerrada con el WebSocket");
    };

    // 🎾 Lógica del juego de Ping Pong
    const canvas = document.getElementById("pongCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 800;
    canvas.height = 400;

    function drawGame() {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "red";
        ctx.fillRect(20, 150, 10, 100); // Pala izquierda
        ctx.fillRect(770, 150, 10, 100); // Pala derecha

        ctx.beginPath();
        ctx.arc(400, 200, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGame();
});
