console.log("🎮 Script cargado.");

// Definir Ball y Paddle solo una vez
if (!window.Ball) {
    window.Ball = class {
        constructor(x, y, radius, speed) {
            this.radius = radius;
            this.position = { x: x, y: y };
            this.velocity = { x: speed.x, y: speed.y };
        }
    };
}

if (!window.Paddle) {
    window.Paddle = class {
        constructor(x, y, width, height, speed) {
            this.width = width;
            this.height = height;
            this.position = { x: x, y: y };
            this.velocity = { y: 0 };
            this.maxSpeed = speed;
        }
    };
}

// Inicializar estado global solo una vez
if (window.listenerAdded === undefined) window.listenerAdded = false;
if (window.gameState === undefined) window.gameState = {};
if (window.gameStarted === undefined) window.gameStarted = false;
if (window.gameStartTime === undefined) window.gameStartTime = null;
if (window.gameEnded === undefined) window.gameEnded = false;


if (!window.listenerAdded) {
    document.addEventListener("keydown", handleKeyDown);
    window.listenerAdded = true;
    console.log("🎮 Listener añadido");
}

function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
    }

    if (!window.gameState || !window.socket || window.socket.readyState !== WebSocket.OPEN) return;

    console.log(`🔑 Tecla: ${e.key} | Player: ${window.currentPlayer} | Game: ${window.gameId}`);

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r' && !window.gameEnded) {
        console.log("Fin forzado solicitado en:",  window.gameId)
        e.preventDefault();
        randomlyEndGame();
        return;
    }

    window.socket.send(JSON.stringify({
        player: window.currentPlayer,
        key: e.key
    }));
}

window.setupGame = function () {
    console.log("🎮 Setup Game ejecutado.");
  	
    // Se actulizara con lo que llegue del backend
	window.gameEnded = false; 
	window.gameStarted = false;

    const gameContainer = document.getElementById("game-container");
    const gameDataElement = document.getElementById("game-data");
    const playerDataElement = document.getElementById("player-data");
    const canvasElement = document.getElementById("pongCanvas");

    if (!gameContainer || !gameDataElement || !playerDataElement || !canvasElement) {
        console.error("No se encontraron algunos elementos necesarios en el DOM. Abortando ejecución.");
        return;
    }

    console.log("🎮 Game canvas encontrado en el DOM.");

    window.gameData = JSON.parse(gameDataElement.textContent);
    window.gameId = window.gameData.id;
    window.gameTargetScore = parseInt(window.gameData.points);
    window.playerData = JSON.parse(playerDataElement.textContent);
    window.currentPlayer = window.playerData.current;

    console.log("🧑‍💻 Datos del jugador:", window.currentPlayer);

    window.canvas = document.getElementById("pongCanvas");
    window.ctx = canvas.getContext("2d");

    window.canvas.width = 800;
    window.canvas.height = 400;

    if ( window.gameData.status === "finalizado") {
        console.warn("⛔ La partida ya está finalizada. No se conectará al WebSocket.");
        drawGameResult();
        markPlayersAsFinished();
        return;
    }

    if (window.socket) {
        console.log("🎮 Cerrando WebSocket anterior...");
        window.socket.close();
    }

    window.socket = new WebSocket(`wss://${window.location.host}/ws/game/${window.gameId}/`);

    window.socket.onopen = () => {
        console.log("🎮 Conectado al WebSocket del juego", window.gameId);
        window.socket.send(JSON.stringify({
            player: window.currentPlayer,
            init_game: true,
            difficulty:  window.gameData.difficulty
        }));
    };

    window.gameState = {
        ball: new window.Ball(400, 200, 10, { x: 0, y: 0 }),
        paddles: {
            left: new window.Paddle(20, 150, 10, 100, 5),
            right: new window.Paddle(770, 150, 10, 100, 5)
        },
        ready_status: { player1: false, player2: false }
    };

    window.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!data) return;
        console.log('INFO', data);
        
        if (data.scores) {
            const leftScore = document.getElementById("left-score");
            const rightScore = document.getElementById("right-score");

            // Actualizamos el JSON recibido del html para que se mentenga vivo
            window.gameData.player1_score = data.scores.left
            window.gameData.player2_score = data.scores.right

            if (leftScore && rightScore) {
                leftScore.textContent = data.scores.left;
                rightScore.textContent = data.scores.right;
            }
        }
        
        if (data.game_over) {
			window.gameEnded = true;
            console.warn("🎮 Juego finalizado. Desconectando WebSocket.");
            window.socket.close();
            drawGameResult();
            markPlayersAsFinished();
            return;
        }

        if (data.game_started !== undefined) {
            if (data.game_started && !window.gameStarted) {
                window.gameStartTime = new Date();
            }
            window.gameStarted = data.game_started;
        }

        if (data.ready_status) {
            window.gameState.ready_status = data.ready_status;
            updateReadyStatusDisplay();
            updateStatusMessage();
        }

        if (data.ball) {
            window.gameState.ball.position.x = data.ball.x;
            window.gameState.ball.position.y = data.ball.y;
            window.gameState.ball.velocity.x = data.ball.dx;
            window.gameState.ball.velocity.y = data.ball.dy;
        }

        if (data.paddles) {
            window.gameState.paddles.left.position.y = data.paddles.left.y;
            window.gameState.paddles.right.position.y = data.paddles.right.y;
        }

        if (data.duration){
            // Actualizamos el JSON recibido del html para que se mentenga vivo
            window.gameData.duration = data.duration
        }


        drawGame();
    };

    window.socket.onclose = (event) => {
        console.warn("⚠️ Conexión WebSocket cerrada", event.code);
        window.gameStarted = false;
        window.gameEnded = true;
    };

    updateStatusMessage();
    updateReadyStatusDisplay();
    drawGame();
};

function updateReadyStatusDisplay() {
    const p1 = document.getElementById("player1-ready-status");
    const p2 = document.getElementById("player2-ready-status");
    if (p1) {
        p1.textContent = window.gameState.ready_status.player1 ? "READY" : "PENDING";
        p1.className = window.gameState.ready_status.player1 ? "badge bg-success" : "badge bg-warning";
    }
    if (p2) {
        p2.textContent = window.gameState.ready_status.player2 ? "READY" : "PENDING";
        p2.className = window.gameState.ready_status.player2 ? "badge bg-success" : "badge bg-warning";
    }
}

function updateStatusMessage() {
    const status = document.getElementById("status-message");
    if (!status) return;
    if (window.gameEnded) {
        status.innerText = "¡Juego terminado!";
        status.className = "alert alert-success text-center";
    } else if (window.gameStarted) {
        status.innerText = "¡El juego ha comenzado!";
        status.className = "alert alert-success text-center";
    } else if (!window.gameState.ready_status[window.currentPlayer]) {
        status.innerText = "Pulsa ESPACIO para indicar que estás listo";
        status.className = "alert alert-info text-center";
    } else {
        const other = window.currentPlayer === "player1" ? "player2" : "player1";
        if (!window.gameState.ready_status[other]) {
            status.innerText = "Estás listo. Esperando al otro jugador...";
            status.className = "alert alert-warning text-center";
        } else {
            status.innerText = "¡El juego ha comenzado!";
            status.className = "alert alert-success text-center";
        }
    }
}

function drawGame() {
	window.ctx.clearRect(0, 0,  window.canvas.width,  window.canvas.height);
	window.ctx.fillStyle = window.gameData.background_color || "black";
	window.ctx.fillRect(0, 0,  window.canvas.width,  window.canvas.height);
	
	// Dibujar las palas
	// El color depende de si el jugador está listo
	window.ctx.fillStyle =  window.gameState.ready_status.player1 ?  window.gameData.paddle_color : "white";
	window.ctx.fillRect(
		window.gameState.paddles.left.position.x, 
		window.gameState.paddles.left.position.y, 
		window.gameState.paddles.left.width, 
		window.gameState.paddles.left.height
	);
	
	window.ctx.fillStyle =  window.gameState.ready_status.player2 ?  window.gameData.paddle_color  : "white";
	window.ctx.fillRect(
		window.gameState.paddles.right.position.x, 
		window.gameState.paddles.right.position.y, 
		window.gameState.paddles.right.width, 
		window.gameState.paddles.right.height
	);

	// Dibujar la línea central
	window.ctx.strokeStyle = 'white';
	window.ctx.setLineDash([10, 15]);
	window.ctx.lineWidth = 8;
	window.ctx.beginPath();
	window.ctx.moveTo( window.canvas.width / 2, 0);
	window.ctx.lineTo( window.canvas.width / 2,  window.canvas.height);
	window.ctx.stroke();

	// Dibujar la pelota
	window.ctx.fillStyle =  window.gameData.ball_color;
	window.ctx.beginPath();
	window.ctx.arc(
		 window.gameState.ball.position.x, 
		 window.gameState.ball.position.y, 
		 window.gameState.ball.radius, 
		0, 
		Math.PI * 2
	);
	window.ctx.fill();
}

function drawGameResult() {

    // Esta funcion recoge todos los datos del JSON de entrada y los pinta en el canvas
	const leftScoreElement = document.getElementById("left-score");
	const rightScoreElement = document.getElementById("right-score");
	
	if (leftScoreElement && rightScoreElement) {
		leftScoreElement.textContent = window.gameData.player1_score;
		rightScoreElement.textContent = window.gameData.player2_score;
	}

	window.ctx.clearRect(0, 0, window.ctx.canvas.width, window.ctx.canvas.height);
	window.ctx.fillStyle = "black";
	window.ctx.fillRect(0, 0,  window.ctx.canvas.width, window.ctx.canvas.height);

	window.ctx.fillStyle = "white";
	window.ctx.font = "bold 30px Arial";
	window.ctx.textAlign = "center";

	window.ctx.fillText("🏆 PARTIDA FINALIZADA 🏆",  window.ctx.canvas.width / 2, 100);

	let winnerText =  window.gameData.player1_score > window.gameData.player2_score
		? `🎉 GANADOR: ${ window.playerData.player1.username}`
		: `🎉 GANADOR: ${ window.playerData.player2.username}`;

	window.ctx.fillText(winnerText, window.ctx.canvas.width / 2, 250);
	window.ctx.fillText(`Duración: ${window.gameData.duration} segundos`, window.ctx.canvas.width / 2, 300);
}

function markPlayersAsFinished() {
	const player1Status = document.getElementById("player1-ready-status");
	const player2Status = document.getElementById("player2-ready-status");

	if (player1Status) {
		player1Status.textContent = "FINISH";
		player1Status.className = "badge bg-danger"; // Cambia a rojo
	}

	if (player2Status) {
		player2Status.textContent = "FINISH";
		player2Status.className = "badge bg-danger"; // Cambia a rojo
	}
}


function randomlyEndGame() {
        
    // Mandamos al backend la info de que ya se ha terminado
    window.socket.send(JSON.stringify({
        player: window.currentPlayer,
        action: "finish",
        game: window.gameId
    }));
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



