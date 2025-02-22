class Ball {
    constructor(x, y, radius, speed) {
      this.radius = radius;
      this.position = {
        x: x,
        y: y
      };
      this.velocity = {
        x: speed.x,
        y: speed.y
      };
    }
  }

class Paddle {
    constructor(x, y, width, height, speed) {
      this.width = width;
      this.height = height;
      this.position = {
        x: x,
        y: y
      };
      this.velocity = {
        y: 0
      };
      this.maxSpeed = speed;
    }
  }

document.addEventListener("DOMContentLoaded", function() {
    const gameId = document.getElementById("game-container").dataset.gameId;
    const username = document.getElementById("game-container").dataset.username;
    
    // Conectar al servidor WebSocket
    const socket = new WebSocket(`ws://${window.location.host}/ws/game/${gameId}/`);

    socket.onopen = function(event) {
        console.log("Conectado al WebSocket");
    };

    // Crear objeto para el estado del juego
    const gameState = {
        ball: {
            x: 400,
            y: 200,
            radius: 10
        },
        paddles: {
            left: { y: 150 },
            right: { y: 150 }
        }
    };

    socket.onmessage = function(event) {
        console.log("Mensaje recibido:", event.data);
        const data = JSON.parse(event.data);
        document.getElementById("status-message").innerText = data.message;
        
        // Actualizar el estado del juego con los datos recibidos
        if (data.game_state) {
            gameState.ball = data.game_state.ball;
            gameState.paddles = data.game_state.paddles;
            // Dibujar el juego con los nuevos datos
            drawGame();
        }
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

        // Dibujar las palas usando el estado del juego
        ctx.fillStyle = "red";
        ctx.fillRect(20, gameState.paddles.left.y, 10, 100); // Pala izquierda
        ctx.fillRect(770, gameState.paddles.right.y, 10, 100); // Pala derecha

        // Dibujar la línea central
        ctx.strokeStyle = 'white';
        ctx.setLineDash([10, 15]);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();

        // Dibujar la pelota usando el estado del juego
        ctx.beginPath();
        ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGame();
});
