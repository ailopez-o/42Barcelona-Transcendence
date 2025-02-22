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

// Variables globales
let gameState;
let socket;
let currentPlayer;

// Event listener global para las teclas
document.addEventListener('keydown', (e) => {
    // Prevenir el scroll con las flechas
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }

    console.log("Tecla presionada:", e.key); // Debug
    if (!gameState || !socket) return; // Si el juego no está inicializado, salimos

    let movement = 0;

    switch(e.key) {
        case 'ArrowUp':
            console.log("Movimiento arriba");
            movement = -gameState.paddles.right.speed;
            break;
        case 'ArrowDown':
            console.log("Movimiento abajo");
            movement = gameState.paddles.right.speed;
            break;
    }

    // Enviar el movimiento al servidor si hay un movimiento válido
    if (movement !== 0 && socket.readyState === WebSocket.OPEN) {
        console.log("Enviando movimiento al servidor");
        socket.send(JSON.stringify({
            player: currentPlayer,  // Enviamos 'player1' o 'player2'
            movement: movement
        }));
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const gameId = document.getElementById("game-container").dataset.gameId;
    const username = document.getElementById("game-container").dataset.username;
    
    // Obtener los datos del jugador del elemento JSON
    const playerData = JSON.parse(document.getElementById("player-data").textContent);
    currentPlayer = playerData.current; // Será 'player1' o 'player2'
    
    // Conectar al servidor WebSocket
    socket = new WebSocket(`ws://${window.location.host}/ws/game/${gameId}/`);

    socket.onopen = function(event) {
        console.log("Conectado al WebSocket");
    };

    // Crear objeto para el estado del juego
    gameState = {
        ball: new Ball(400, 200, 10, { x: 0, y: 0 }),
        paddles: {
            left: new Paddle(20, 150, 10, 100, 5),
            right: new Paddle(770, 150, 10, 100, 5)
        }
    };

    socket.onmessage = function(event) {
        // console.log("Mensaje recibido:", event.data);
        const data = JSON.parse(event.data);
        
        // Verificar la estructura de los datos
        if (!data) {
            console.error("Datos no válidos recibidos");
            return;
        }

        if (data.message) {
            document.getElementById("status-message").innerText = data.message;
        }
        
        // Actualizar el estado del juego con los datos recibidos
        // Actualizar posición de la pelota y las palas
        if (data.ball) {
            gameState.ball.position.x = data.ball.x;
            gameState.ball.position.y = data.ball.y;
        }
        
        if (data.paddles) {
            gameState.paddles.left.position.y = data.paddles.left.y;
            gameState.paddles.right.position.y = data.paddles.right.y;
        }
        
        drawGame();
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dibujar las palas usando las clases
        ctx.fillStyle = "red";
        ctx.fillRect(
            gameState.paddles.left.position.x, 
            gameState.paddles.left.position.y, 
            gameState.paddles.left.width, 
            gameState.paddles.left.height
        );
        ctx.fillRect(
            gameState.paddles.right.position.x, 
            gameState.paddles.right.position.y, 
            gameState.paddles.right.width, 
            gameState.paddles.right.height
        );

        // Dibujar la línea central
        ctx.strokeStyle = 'white';
        ctx.setLineDash([10, 15]);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();

        // Dibujar la pelota usando la clase Ball
        ctx.beginPath();
        ctx.arc(
            gameState.ball.position.x, 
            gameState.ball.position.y, 
            gameState.ball.radius, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
    }

    drawGame();
});
