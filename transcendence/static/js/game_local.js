console.log("🎮 Juego local cargado (modo 2 jugadores, mismo teclado)");

// Clases Ball y Paddle
window.Ball = class {
    constructor(x, y, radius, speed) {
        this.radius = radius;
        this.position = { x, y };
        this.velocity = { x: speed.x, y: speed.y };
    }

    move() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    bounceVertical() {
        this.velocity.y *= -1;
    }

    bounceHorizontal() {
        this.velocity.x *= -1;
    }

    reset(centerX, centerY, speed) {
        this.position.x = centerX;
        this.position.y = centerY;
        this.velocity.x = (Math.random() > 0.5 ? 1 : -1) * speed;
        this.velocity.y = (Math.random() > 0.5 ? 1 : -1) * speed;
    }
};

window.Paddle = class {
    constructor(x, y, width, height, speed) {
        this.position = { x, y };
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.velocityY = 0;
    }

    move() {
        this.position.y += this.velocityY;
        this.position.y = Math.max(0, Math.min(400 - this.height, this.position.y));
    }

    setDirection(direction) {
        this.velocityY = direction * this.speed;
    }

    stop() {
        this.velocityY = 0;
    }
};

// Setup global
window.setupGame = function () {
    console.log("🎮 Setup Game Local ejecutado");
    window.gameEnded = false;
    window.gameStartTime = null; // No iniciar el tiempo hasta que empiece el juego
    window.gameStarted = false; // Nueva variable para controlar si el juego ha empezado

    const canvasElement = document.getElementById("pongCanvas");
    const gameDataElement = document.getElementById("game-data");
    const playerDataElement = document.getElementById("player-data");

    if (!canvasElement || !gameDataElement || !playerDataElement) {
        console.error("❌ Elementos del DOM no encontrados.");
        return;
    }

    // Variables globales
    window.canvas = canvasElement;
    window.ctx = canvas.getContext("2d");
    window.canvas.width = 800;
    window.canvas.height = 400;

    window.gameData = JSON.parse(gameDataElement.textContent);
    window.playerData = JSON.parse(playerDataElement.textContent);
    window.gameTargetScore = parseInt(window.gameData.points);
    window.score1 = 0;
    window.score2 = 0;

    // Crear objetos
    window.gameState = {
        ball: new window.Ball(400, 200, 10, { x: 5, y: 3 }),
        paddles: {
            left: new window.Paddle(20, 150, 10, 100, 5),
            right: new window.Paddle(770, 150, 10, 100, 5)
        }
    };

    document.addEventListener("keydown", handleLocalKeyDown);
    document.addEventListener("keyup", handleLocalKeyUp);

    // Dibujar el mensaje inicial
    drawInitialMessage();
};

function drawInitialMessage() {
    window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
    window.ctx.fillStyle = window.gameData.background_color || "black";
    window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);

    window.ctx.fillStyle = "white";
    window.ctx.font = "bold 30px Orbitron";
    window.ctx.textAlign = "center";
    window.ctx.fillText("Presiona ESPACIO para comenzar", 400, 200);
}

function handleLocalKeyDown(e) {
    const key = e.key.toLowerCase();
    if (["w", "s", "arrowup", "arrowdown", " "].includes(key)) e.preventDefault();

    if (!window.gameStarted && key === " ") {
        startGame();
        return;
    }

    if (window.gameStarted) {
        if (key === "w") window.gameState.paddles.left.setDirection(-1);
        if (key === "s") window.gameState.paddles.left.setDirection(1);
        if (key === "arrowup") window.gameState.paddles.right.setDirection(-1);
        if (key === "arrowdown") window.gameState.paddles.right.setDirection(1);
    }
}

function startGame() {
    window.gameStarted = true;
    window.gameStartTime = Date.now();
    window.gameLoopInterval = setInterval(gameLoop, 1000 / 60); // 60 FPS
}

function handleLocalKeyUp(e) {
    const key = e.key.toLowerCase();
    if (["w", "s"].includes(key)) window.gameState.paddles.left.stop();
    if (["arrowup", "arrowdown"].includes(key)) window.gameState.paddles.right.stop();
}

function gameLoop() {
    if (window.gameEnded) return;

    // Movimiento
    window.gameState.paddles.left.move();
    window.gameState.paddles.right.move();
    window.gameState.ball.move();

    // Rebote superior/inferior
    if (window.gameState.ball.position.y <= 0 || window.gameState.ball.position.y >= 400) {
        window.gameState.ball.bounceVertical();
    }

    // Colisiones con palas
    const ball = window.gameState.ball;
    const left = window.gameState.paddles.left;
    const right = window.gameState.paddles.right;

    if (
        ball.position.x - ball.radius <= left.position.x + left.width &&
        ball.position.y >= left.position.y &&
        ball.position.y <= left.position.y + left.height
    ) {
        ball.bounceHorizontal();
    }

    if (
        ball.position.x + ball.radius >= right.position.x &&
        ball.position.y >= right.position.y &&
        ball.position.y <= right.position.y + right.height
    ) {
        ball.bounceHorizontal();
    }

    // Puntos
    if (ball.position.x <= 0) {
        window.score2++;
        updateScore();
        if (window.score2 >= window.gameTargetScore) endGame("Player 2");
        else ball.reset(400, 200, 5);
    }

    if (ball.position.x >= 800) {
        window.score1++;
        updateScore();
        if (window.score1 >= window.gameTargetScore) endGame("Player 1");
        else ball.reset(400, 200, 5);
    }

    if (!window.gameEnded) {
        drawGame();
    }
}

function drawGame() {
    const ctx = window.ctx;
    ctx.clearRect(0, 0, 800, 400);
    ctx.fillStyle = window.gameData.background_color || "black";
    ctx.fillRect(0, 0, 800, 400);

    // Línea central
    ctx.strokeStyle = "white";
    ctx.setLineDash([10, 15]);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 400);
    ctx.stroke();

    // Palas
    ctx.fillStyle = window.gameData.paddle_color || "white";
    const left = window.gameState.paddles.left;
    const right = window.gameState.paddles.right;
    ctx.fillRect(left.position.x, left.position.y, left.width, left.height);
    ctx.fillRect(right.position.x, right.position.y, right.width, right.height);

    // Pelota
    ctx.fillStyle = window.gameData.ball_color || "white";
    const ball = window.gameState.ball;
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
}

function updateScore() {
    document.getElementById("left-score").textContent = window.score1;
    document.getElementById("right-score").textContent = window.score2;
}

function endGame(winner) {
    window.gameEnded = true;
    clearInterval(window.gameLoopInterval);

    // Obtener los datos del juego y los jugadores
    const gameData = JSON.parse(document.getElementById("game-data").textContent);
    const playerData = JSON.parse(document.getElementById("player-data").textContent);

    // Determinar el ganador y perdedor basado en el parámetro winner
    const isPlayer1Winner = winner === "Player 1";
    const winnerId = isPlayer1Winner ? playerData.player1.id : playerData.player2.id;
    const loserId = isPlayer1Winner ? playerData.player2.id : playerData.player1.id;
    const winnerName = isPlayer1Winner ? playerData.player1.username : playerData.player2.username;

    // Preparar los datos para enviar al servidor
    const resultData = {
        game_id: gameData.id,
        winner_id: winnerId,
        loser_id: loserId,
        score_winner: isPlayer1Winner ? window.score1 : window.score2,
        score_loser: isPlayer1Winner ? window.score2 : window.score1,
        duration: Math.floor((Date.now() - window.gameStartTime) / 1000) // duración en segundos
    };

    // Enviar los resultados al servidor
    fetch('/game/save/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Resultado guardado:', data);
        
        // Limpiar completamente el canvas antes de mostrar el mensaje final
        window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
        window.ctx.fillStyle = window.gameData.background_color || "black";
        window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);

        // Mostrar el mensaje de victoria y la respuesta del servidor
        window.ctx.fillStyle = "white";
        window.ctx.font = "bold 30px Orbitron";
        window.ctx.textAlign = "center";
        window.ctx.fillText("🏆 PARTIDA FINALIZADA 🏆", 400, 150);
        window.ctx.fillText(`🎉 GANADOR: ${winnerName}`, 400, 220);

        // Mostrar la respuesta del servidor
        window.ctx.font = "16px Orbitron";
        window.ctx.fillText("Respuesta del servidor:", 400, 280);
        window.ctx.font = "14px Orbitron";
        const jsonStr = JSON.stringify(data, null, 2);
        const lines = jsonStr.split('\n');
        lines.forEach((line, index) => {
            window.ctx.fillText(line, 400, 310 + (index * 20));
        });
    })
    .catch(error => {
        console.error('Error al guardar el resultado:', error);
        
        // Limpiar completamente el canvas antes de mostrar el mensaje de error
        window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
        window.ctx.fillStyle = window.gameData.background_color || "black";
        window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);

        // Mostrar el mensaje de victoria y el error
        window.ctx.fillStyle = "white";
        window.ctx.font = "bold 30px Orbitron";
        window.ctx.textAlign = "center";
        window.ctx.fillText("🏆 PARTIDA FINALIZADA 🏆", 400, 150);
        window.ctx.fillText(`🎉 GANADOR: ${winnerName}`, 400, 220);
        
        // Mostrar el error
        window.ctx.font = "16px Orbitron";
        window.ctx.fillStyle = "#ff4444";
        window.ctx.fillText("Error al guardar:", 400, 280);
        window.ctx.fillText(error.message, 400, 310);
    });
}

// Se ejecuta cuando hay recarga HTMX
if (document.readyState === "complete") {
	console.log("🎮 El DOM ya está listo HTMX");
	setupGame(); // Si el DOM ya está listo, ejecuta directamente
}

// Se ejecuta cuando hay recarga completa
document.addEventListener("DOMContentLoaded", function () {
	console.log("🎮 DOM completamente cargado.");
	setupGame(); // Si el DOM ya está listo, ejecuta directamente
});