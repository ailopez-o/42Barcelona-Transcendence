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
let gameStarted = false;

// Event listener global para las teclas
document.addEventListener('keydown', (e) => {
    // Prevenir el scroll con las flechas y el espacio
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
    }

    if (!gameState || !socket || socket.readyState !== WebSocket.OPEN) return;

    // Enviar la tecla pulsada al servidor
    socket.send(JSON.stringify({
        player: currentPlayer,
        key: e.key
    }));
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
        },
        ready_status: {
            player1: false,
            player2: false
        }
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('INFO', data);
        // Verificar la estructura de los datos
        if (!data) {
            console.error("Datos no válidos recibidos");
            return;
        }

        // Actualizar el mensaje de estado
        if (data.message) {
            document.getElementById("status-message").innerText = data.message;
        }
        
        // Verificar si el juego ha comenzado
        if (data.game_started !== undefined) {
            gameStarted = data.game_started;
        }
        
        // Actualizar el estado de "ready" de los jugadores
        if (data.ready_status) {
            gameState.ready_status = data.ready_status;
        }
        
        // Actualizar el estado del juego con los datos recibidos
        if (data.ball) {
            gameState.ball.position.x = data.ball.x;
            gameState.ball.position.y = data.ball.y;
            gameState.ball.velocity.x = data.ball.dx;
            gameState.ball.velocity.y = data.ball.dy;
        }
        
        if (data.paddles) {
            gameState.paddles.left.position.y = data.paddles.left.y;
            gameState.paddles.right.position.y = data.paddles.right.y;
        }
        
        // Actualizar puntuaciones si existen
        if (data.scores) {
            const leftScoreElement = document.getElementById("left-score");
            const rightScoreElement = document.getElementById("right-score");
            
            if (leftScoreElement && rightScoreElement) {
                leftScoreElement.textContent = data.scores.left;
                rightScoreElement.textContent = data.scores.right;
            }
        }
        
        drawGame();
    };

    socket.onclose = function(event) {
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

        // Dibujar indicadores de "ready" para cada jugador
        drawReadyStatus();
        
        // Dibujar las palas
        // El color depende de si el jugador está listo
        ctx.fillStyle = gameState.ready_status.player1 ? "green" : "red";
        ctx.fillRect(
            gameState.paddles.left.position.x, 
            gameState.paddles.left.position.y, 
            gameState.paddles.left.width, 
            gameState.paddles.left.height
        );
        
        ctx.fillStyle = gameState.ready_status.player2 ? "green" : "red";
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

        // Dibujar la pelota
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(
            gameState.ball.position.x, 
            gameState.ball.position.y, 
            gameState.ball.radius, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
        
        // Mostrar mensaje para indicar que pulse espacio si no está listo
        if (!gameState.ready_status[currentPlayer]) {
            ctx.fillStyle = "white";
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Pulsa ESPACIO para indicar que estás listo", canvas.width / 2, 30);
        }
    }
    
    function drawReadyStatus() {
        // Dibujar indicadores de "ready" en la parte superior
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        
        // Jugador 1 (izquierda)
        ctx.fillStyle = gameState.ready_status.player1 ? "green" : "red";
        ctx.fillText(
            gameState.ready_status.player1 ? "Jugador 1: LISTO" : "Jugador 1: NO LISTO", 
            150, 
            20
        );
        
        // Jugador 2 (derecha)
        ctx.fillStyle = gameState.ready_status.player2 ? "green" : "red";
        ctx.fillText(
            gameState.ready_status.player2 ? "Jugador 2: LISTO" : "Jugador 2: NO LISTO", 
            650, 
            20
        );
    }

    drawGame();
});
