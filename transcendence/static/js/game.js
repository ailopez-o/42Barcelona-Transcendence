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

function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
    }

    if (!window.gameState || !window.socket || window.socket.readyState !== WebSocket.OPEN) return;

    console.log(`🔑 Tecla: ${e.key} | Player: ${window.currentPlayer} | Game: ${window.gameId}`);

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r' && !window.gameEnded) {
        e.preventDefault();
        randomlyEndGame();
        return;
    }

    window.socket.send(JSON.stringify({
        player: window.currentPlayer,
        key: e.key
    }));
}

if (!window.listenerAdded) {
    document.addEventListener("keydown", handleKeyDown);
    window.listenerAdded = true;
    console.log("🎮 Listener añadido");
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

        if (data.scores) {
            const leftScore = document.getElementById("left-score");
            const rightScore = document.getElementById("right-score");

            if (leftScore && rightScore) {
                leftScore.textContent = data.scores.left;
                rightScore.textContent = data.scores.right;
            }

			// console.log("TargetScore ", window.gameTargetScore)
			// console.log("window.gameEnded ", window.gameEnded)
			// console.log("data.scores.left ", data.scores.left)
			// console.log("data.scores.right", data.scores.right)

            if (!window.gameEnded && (data.scores.left >=  window.gameTargetScore || data.scores.right >= window.gameTargetScore)) {
                window.gameEnded = true;
                const isLeftWinner = data.scores.left >=  window.gameTargetScore;
                const winnerId = isLeftWinner ?  window.playerData.player1.id :  window.playerData.player2.id;
                const loserId = isLeftWinner ?  window.playerData.player2.id :  window.playerData.player1.id;
                const duration = Math.floor((new Date() - window.gameStartTime) / 1000);

                window.socket.send(JSON.stringify({ player: window.currentPlayer, game_over: true }));

                sendGameResults({
                    game_id: window.gameId,
                    winner_id: winnerId,
                    loser_id: loserId,
                    score_winner: isLeftWinner ? data.scores.left : data.scores.right,
                    score_loser: isLeftWinner ? data.scores.right : data.scores.left,
                    duration: duration
                });

                const statusElement = document.getElementById("status-message");
                if (statusElement) {
                    const winnerName = isLeftWinner ? window.playerData.player1.username : window.playerData.player2.username;
                    statusElement.innerText = `¡Juego terminado! ${winnerName} ha ganado la partida.`;
                    statusElement.className = "alert alert-success text-center";
                }
            }
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
	// console.log("draw called")
	// if (window.gameEnded) 
	// 	return;

	// console.log("draw drawing")

	window.ctx.clearRect(0, 0,  window.canvas.width,  window.canvas.height);
	window.ctx.fillStyle = "black";
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

	window. window.ctx.fillText("🏆 PARTIDA FINALIZADA 🏆",  window.ctx.canvas.width / 2, 100);

	// Ya tenemos el marcador arriba
	// ctx.font = "bold 24px Arial";
	// ctx.fillText(`🔹 ${playerData.player1.username} (${gameData.player1_score}) - ${playerData.player2.username} (${gameData.player2_score}) 🔹`, ctx.canvas.width / 2, 180);

	let winnerText =  window.gameData.player1_score > window.gameData.player2_score
		? `🎉 GANADOR: ${ window.playerData.player1.username}`
		: `🎉 GANADOR: ${ window.playerData.player2.username}`;

	window.ctx.fillText(winnerText, window.ctx.canvas.width / 2, 250);
	window.ctx.fillText(`Duración: ${window.gameData.duration} segundos`, window.ctx.canvas.width / 2, 300);
}

/**
    * Envía los resultados del juego al endpoint
    */
function sendGameResults(results) {
	console.log('🎮 Enviando resultados:', results);
	
	fetch('/game/save/', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			// No se necesita CSRF token porque el endpoint está marcado como @csrf_exempt
		},
		body: JSON.stringify(results)
	})
	.then(response => {
		if (!response.ok) {
			console.error('Error HTTP:', response.status, response.statusText);
			throw new Error(`Error al enviar resultados: ${response.status}`);
		}
		return response.json();
	})
	.then(data => {
		console.log('🎮 Resultados guardados correctamente:', data);
		// Puedes mostrar un mensaje de éxito aquí si lo deseas
		if (data.status === 'success') {
			// Opcional: Mostrar alguna notificación o actualizar la UI
			const statusElement = document.getElementById("status-message");
			if (statusElement) {
				const actionText = data.created ? "registrado" : "actualizado";
				statusElement.innerHTML += `<br>Resultado ${actionText} en la base de datos.`;
			}
		}
	})
	.catch(error => {
		console.error('🎮 Error al guardar resultados:', error);
		// Opcional: Mostrar un mensaje de error al usuario
		const statusElement = document.getElementById("status-message");
		if (statusElement) {
			statusElement.innerHTML += '<br><span class="text-danger">Error al guardar el resultado. Intenta de nuevo.</span>';
		}
	});
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
        
	// Generate random scores between 0 and gameTargetScore
	const player1Score = Math.floor(Math.random() * ( window.gameTargetScore + 1));
	const player2Score = Math.floor(Math.random() * ( window.gameTargetScore + 1));
	
	// Randomly determine winner
	const isLeftWinner = Math.random() < 0.5;
	const winnerId = isLeftWinner ?  window.playerData.player1.id :  window.playerData.player2.id;
	const loserId = isLeftWinner ?  window.playerData.player2.id :  window.playerData.player1.id;
	
	// Calculate game duration
	const gameDuration = 42;
	
	// Inform backend that game is over
	window.socket.send(JSON.stringify({
		player: window.currentPlayer,
		game_over: true
	}));
	
	// Send results to endpoint
	sendGameResults({
		game_id: gameId,
		winner_id: winnerId,
		loser_id: loserId,
		score_winner: isLeftWinner ? player1Score : player2Score,
		score_loser: isLeftWinner ? player2Score : player1Score,
		duration: gameDuration
	});
	
	window.gameEnded = true;
	const statusElement = document.getElementById("status-message");
	if (statusElement) {
		const winnerName = isLeftWinner ?  window.playerData.player1.username :  window.playerData.player2.username;
		statusElement.innerText = `¡Juego terminado! ${winnerName} ha ganado la partida.`;
		statusElement.className = "alert alert-success text-center";
	}
	
	// Update scores display
	const leftScoreElement = document.getElementById("left-score");
	const rightScoreElement = document.getElementById("right-score");
	if (leftScoreElement && rightScoreElement) {
		leftScoreElement.textContent = player1Score;
		rightScoreElement.textContent = player2Score;
	}
	
	// Mark players as finished
	markPlayersAsFinished();
	
	// Close WebSocket connection
	if (window.socket && window.socket.readyState === WebSocket.OPEN) {
		window.socket.close();
	}
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



