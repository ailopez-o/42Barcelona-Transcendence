import * as THREE from "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js";

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

    let key = e.key;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (e.key === 'ArrowUp') key = 'ArrowDown';
        if (e.key === 'ArrowDown') key = 'ArrowUp';
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
        key: key
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
    window.animationItems = {};

    console.log("🧑‍💻 Datos del jugador:", window.currentPlayer);

    window.canvas = document.getElementById("pongCanvas");

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
            if (window.gameState.ready_status.player1) {
                animationItems.leftPaddle.material.color.set(window.gameData.paddle_color);
            }
            if (window.gameState.ready_status.player2) {
                animationItems.rightPaddle.material.color.set(window.gameData.paddle_color);
            }
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

        drawGame();
    };

    window.socket.onclose = (event) => {
        console.warn("⚠️ Conexión WebSocket cerrada", event.code);
        window.gameStarted = false;
        window.gameEnded = true;
    };

    updateStatusMessage();
    updateReadyStatusDisplay();
    startScene();
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

function startScene() {
    console.log("🎮 Iniciando escena 3D...");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.canvas.width / window.canvas.height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: window.canvas });
    window.animationItems.scene = scene;
    window.animationItems.camera = camera;
    window.animationItems.renderer = renderer;
    renderer.setSize(window.canvas.width, window.canvas.height);
    renderer.shadowMap.enabled = true; // Enable shadow maps in the renderer
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Soft warm sunset light
    scene.add(ambientLight);

    var light = new THREE.PointLight(0xffffff, 20000, 1000);
    light.position.set(-40, 220, 30);
    light.shadow.radius = 1; // Soften the shadow

    light.castShadow = true; // Enable shadows for the light
    //console.log("🔦 Luz:", light);
    scene.add(light);

    var light2 = new THREE.PointLight(0xffffff, 20000, 1000);
    light2.position.set(840, 220, 30);
    light2.shadow.radius = 1; // Soften the shadow

    light2.castShadow = true; // Enable shadows for the light
    //console.log("🔦 Luz:", light2);
    scene.add(light2);

    // Create the field
    const fieldGeometry = new THREE.PlaneGeometry( 800, 400 );
    const fieldMaterial = new THREE.MeshStandardMaterial( { color: 0x00cd00, side: THREE.DoubleSide } );
    const field = new THREE.Mesh( fieldGeometry, fieldMaterial );
    field.position.set(400, 200, 0);
    field.receiveShadow = true; // Enable shadows for the field
    scene.add( field );

    // Create the walls
    const wallGeometry = new THREE.BoxGeometry( 800, 2, 50 );
    const wallMaterial = new THREE.MeshStandardMaterial( { color: 0xffffff } );

    const upperWall = new THREE.Mesh( wallGeometry, wallMaterial );
    upperWall.position.set(400, 400, 0);
    upperWall.castShadow = true; // Enable shadows for the wall
    upperWall.receiveShadow = true; // Enable shadows for the wall
    scene.add( upperWall );

    const lowerWall = new THREE.Mesh( wallGeometry, wallMaterial );
    lowerWall.position.set(400, 0, 0);
    lowerWall.castShadow = true; // Enable shadows for the wall
    lowerWall.receiveShadow = true; // Enable shadows for the wall	
    scene.add( lowerWall );

    // Create paddles
    const leftPaddleGeometry = new THREE.BoxGeometry( gameState.paddles.left.width, gameState.paddles.left.height, 30 );
    const leftPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xffffff } );

    const leftPaddle = new THREE.Mesh( leftPaddleGeometry, leftPaddleMaterial );
    leftPaddle.position.set(gameState.paddles.left.position.x, gameState.paddles.left.position.y + (gameState.paddles.left.height / 2), 0);
    //console.log("Left paddle: ", leftPaddle.position);
    leftPaddle.castShadow = true; // Enable shadows for the paddle
    scene.add( leftPaddle );
    window.animationItems.leftPaddle = leftPaddle;

    const rightPaddleGeometry = new THREE.BoxGeometry( gameState.paddles.right.width, gameState.paddles.right.height, 30 );
    const rightPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xffffff } );
    const rightPaddle = new THREE.Mesh( rightPaddleGeometry, rightPaddleMaterial );
    rightPaddle.position.set(gameState.paddles.right.position.x, gameState.paddles.right.position.y + (gameState.paddles.right.height / 2), 0);
    //console.log("Right paddle: ", rightPaddle.position);

    rightPaddle.castShadow = true; // Enable shadows for the paddle
    scene.add( rightPaddle );
    window.animationItems.rightPaddle = rightPaddle;

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const points = [];

    points.push( new THREE.Vector3( 400, 0, 0 ) );
    points.push( new THREE.Vector3( 400, 400, 0 ) );

    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    const middleLine = new THREE.Line(geometry, material);
    scene.add( middleLine );
        
    // Create the ball
    const ballGeometry = new THREE.SphereGeometry( gameState.ball.radius, 32, 32 );
    const ballMaterial = new THREE.MeshStandardMaterial( { color: window.gameData.ball_color } );
    const ball = new THREE.Mesh( ballGeometry, ballMaterial );
    ball.position.set(gameState.ball.position.x, gameState.ball.position.y, gameState.ball.radius);
    ball.castShadow = true; // Enable shadows for the ball
    scene.add( ball );
    window.animationItems.ball = ball;
    camera.position.set(400, 0, 300); // Adjust these values as needed
    camera.up.set(0, 0, 1);
    camera.lookAt(400, 200, 0);
    renderer.render(scene, camera);
}

function drawGame() {
    window.animationItems.ball.position.set(gameState.ball.position.x, gameState.ball.position.y, gameState.ball.radius);
    window.animationItems.leftPaddle.position.set(gameState.paddles.left.position.x, gameState.paddles.left.position.y + (gameState.paddles.left.height / 2), 0);
    window.animationItems.rightPaddle.position.set(gameState.paddles.right.position.x, gameState.paddles.right.position.y + (gameState.paddles.right.height / 2), 0);
    window.animationItems.renderer.render(window.animationItems.scene, window.animationItems.camera);
}

function drawGameResult() {

    // Esta funcion recoge todos los datos del JSON de entrada y los pinta en el canvas
	const leftScoreElement = document.getElementById("left-score");
	const rightScoreElement = document.getElementById("right-score");
	
	if (leftScoreElement && rightScoreElement) {
		leftScoreElement.textContent = window.gameData.player1_score;
		rightScoreElement.textContent = window.gameData.player2_score;
	}

    const container = document.getElementById('canvasContainer');
    const oldCanvas = document.getElementById('pongCanvas');

    if (!oldCanvas || !container) return;

    const width = oldCanvas.width;
    const height = oldCanvas.height;
    const className = oldCanvas.className;
    const style = oldCanvas.style.cssText;

    oldCanvas.remove();

    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'pongCanvas';
    newCanvas.width = width;
    newCanvas.height = height;
    newCanvas.className = className;
    newCanvas.style.cssText = style;

    container.appendChild(newCanvas);

    const ctx = newCanvas.getContext('2d');

	ctx.fillStyle = "black";
	ctx.fillRect(0, 0,  ctx.canvas.width, ctx.canvas.height);

	ctx.fillStyle = "white";
	ctx.font = "bold 30px Arial";
	ctx.textAlign = "center";

	ctx.fillText("🏆 PARTIDA FINALIZADA 🏆",  ctx.canvas.width / 2, 100);

	let winnerText =  window.gameData.player1_score > window.gameData.player2_score
		? `🎉 GANADOR: ${ window.playerData.player1.username}`
		: `🎉 GANADOR: ${ window.playerData.player2.username}`;

	ctx.fillText(winnerText, ctx.canvas.width / 2, 250);
	ctx.fillText(`Duración: ${window.gameData.duration} segundos`, ctx.canvas.width / 2, 300);
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
        action: "finish"
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



