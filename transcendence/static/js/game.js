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
let prevReadyStatus = { player1: false, player2: false };

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
        
        // Guardar el estado anterior de ready antes de actualizarlo
        if (gameState && gameState.ready_status) {
            prevReadyStatus = {...gameState.ready_status};
        }
        
        // Verificar si el juego ha comenzado
        if (data.game_started !== undefined) {
            gameStarted = data.game_started;
        }
        
        // Actualizar el estado de "ready" de los jugadores
        if (data.ready_status) {
            gameState.ready_status = data.ready_status;
            
            // Actualizar el HTML para mostrar el estado READY/PENDING
            updateReadyStatusDisplay();
            
            // Generar mensajes basados en el estado de "ready"
            updateStatusMessage();
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
    
    // Función para actualizar la visualización del estado READY/PENDING en el HTML
    function updateReadyStatusDisplay() {
        const player1StatusElement = document.getElementById("player1-ready-status");
        const player2StatusElement = document.getElementById("player2-ready-status");
        
        if (player1StatusElement) {
            if (gameState.ready_status.player1) {
                player1StatusElement.textContent = "READY";
                player1StatusElement.className = "badge bg-success";
            } else {
                player1StatusElement.textContent = "PENDING";
                player1StatusElement.className = "badge bg-warning";
            }
        }
        
        if (player2StatusElement) {
            if (gameState.ready_status.player2) {
                player2StatusElement.textContent = "READY";
                player2StatusElement.className = "badge bg-success";
            } else {
                player2StatusElement.textContent = "PENDING";
                player2StatusElement.className = "badge bg-warning";
            }
        }
    }
    
    // Función para generar y actualizar mensajes de estado basados en el estado del juego
    function updateStatusMessage() {
        const statusElement = document.getElementById("status-message");
        if (!statusElement) return;
        
        // Si el juego ha comenzado
        if (gameStarted) {
            statusElement.innerText = "¡El juego ha comenzado!";
            statusElement.className = "alert alert-success text-center";
            return;
        }
        
        // Si el jugador actual no está listo
        if (!gameState.ready_status[currentPlayer]) {
            statusElement.innerText = "Pulsa ESPACIO para indicar que estás listo";
            statusElement.className = "alert alert-info text-center";
            return;
        }
        
        // Si el jugador actual está listo pero el otro no
        const otherPlayer = currentPlayer === "player1" ? "player2" : "player1";
        if (gameState.ready_status[currentPlayer] && !gameState.ready_status[otherPlayer]) {
            statusElement.innerText = "Estás listo. Esperando al otro jugador...";
            statusElement.className = "alert alert-warning text-center";
            return;
        }
        
        // Si ambos están listos (no debería llegar aquí normalmente, pero por si acaso)
        if (gameState.ready_status.player1 && gameState.ready_status.player2) {
            statusElement.innerText = "¡El juego ha comenzado!";
            statusElement.className = "alert alert-success text-center";
        }
    }

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
    }

    // Inicializar el mensaje de estado y los indicadores READY/PENDING al cargar
    updateStatusMessage();
    updateReadyStatusDisplay();
    
    // Dibujar el juego por primera vez
    drawGame();
});
