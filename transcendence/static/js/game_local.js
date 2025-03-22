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
setupGame = function () {
    console.log("🎮 Setup Game Local ejecutado");
    window.gameEnded = false;

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

    window.gameLoopInterval = setInterval(gameLoop, 1000 / 60); // 60 FPS
};

function handleLocalKeyDown(e) {
    const key = e.key.toLowerCase();
    if (["w", "s", "arrowup", "arrowdown"].includes(key)) e.preventDefault();

    if (key === "w") window.gameState.paddles.left.setDirection(-1);
    if (key === "s") window.gameState.paddles.left.setDirection(1);
    if (key === "arrowup") window.gameState.paddles.right.setDirection(-1);
    if (key === "arrowdown") window.gameState.paddles.right.setDirection(1);
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

    drawGame();
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

    // Marcador
    ctx.fillStyle = "white";
    ctx.font = "30px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText(`${window.score1} - ${window.score2}`, 400, 40);
}

function updateScore() {
    document.getElementById("left-score").textContent = window.score1;
    document.getElementById("right-score").textContent = window.score2;
}

function endGame(winner) {
    window.gameEnded = true;
    clearInterval(window.gameLoopInterval);
    drawGame();

    window.ctx.fillStyle = "white";
    window.ctx.font = "bold 30px Orbitron";
    window.ctx.textAlign = "center";
    window.ctx.fillText("🏆 PARTIDA FINALIZADA 🏆", 400, 150);
    window.ctx.fillText(`🎉 GANADOR: ${winner}`, 400, 220);
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