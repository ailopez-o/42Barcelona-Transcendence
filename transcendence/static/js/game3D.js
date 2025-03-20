import * as THREE from "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js";

(function () {
    console.log("🎮 Script cargado.");

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

    let gameState;
    let gameStarted = false;
    let gameStartTime = null;
    let gameEnded = false;
    let animationItems;

    function setupGame() {

        console.log("🎮 Setup Game 3D ejecutado.");

        if (window.listenerAdded === undefined) {
            window.listenerAdded = false; // Garantiza que exista
        }
    
        // Para añadir un solo listener
        if (!window.listenerAdded) {
            console.log("listener añadido")
            document.addEventListener("keydown", handleKeyDown);
            window.listenerAdded = true;
        }
    
        gameState = {};
        animationItems = {};
    
        // Verificar si existen los elementos en el DOM
        const gameContainer = document.getElementById("game-container");
        const gameDataElement = document.getElementById("game-data");
        const playerDataElement = document.getElementById("player-data");
        const canvasElement = document.getElementById("pongCanvas");
    
        
        if (!gameContainer || !gameDataElement || !playerDataElement || !canvasElement) {
            console.error("No se encontraron algunos elementos necesarios en el DOM. Abortando ejecución.");
            return;
        }
        
        console.log("🎮 Game canvas encontrado en el DOM.");
        let gameData;
        let gameId;
        let gameTargetScore;
        if (gameDataElement) {
            gameData = JSON.parse(gameDataElement.textContent);
            gameId = gameData.id;
            gameTargetScore = parseInt(gameData.points);
        }
        let playerData;
        if (playerDataElement) {
            playerData = JSON.parse(playerDataElement.textContent);
            // Obtener los datos del jugador del elemento JSON
            window.currentPlayer = playerData.current; // Será 'player1' o 'player2'
            console.log("🧑‍💻 Datos del jugador:", window.currentPlayer);
        }
        
        //console.log(playerData);
        //console.log("🎮 Datos del juego:", gameData);
        
        // Lógica del juego de Ping Pong
        const _canvas = document.getElementById("pongCanvas");
    
        _canvas.width = 800;
        _canvas.height = 400;
        
        if (gameData.status === "finalizado") {
            console.warn("⛔ La partida ya está finalizada. No se conectará al WebSocket.");
            drawGameResult(ctx, gameData, playerData);
            markPlayersAsFinished();
            return;
        }

        // Si ya hay un WebSocket abierto, lo cerramos antes de abrir uno nuevo
        if (window.socket) {
            console.log("🎮 Cerrando WebSocket del game anterior...");
            window.socket.close();
        }

    
        window.socket.onopen = function(event) {
            console.log("🎮 Conectado al WebSocket del juego", gameId);
            // Enviar la dificultad del juego al servidor inmediatamente después de conectar
            window.socket.send(JSON.stringify({
                player: window.currentPlayer,
                init_game: true,
                difficulty: gameData.difficulty
            }));
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
    
        window.socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (!data) return;
            console.log('INFO', data);

            // Si el juego ha terminado, mostrar resultados y no seguir actualizando
            if (data.game_over) {
                console.warn("🎮 Juego finalizado. Desconectando WebSocket.");
                window.socket.close();
                drawGameResult(ctx, gameData, playerData);
                markPlayersAsFinished();
                return;
            }
            
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
                if (data.game_started && !gameStarted) {
                    // El juego acaba de comenzar, registrar el tiempo de inicio
                    gameStartTime = new Date();
                }
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
                
                // Verificar si algún jugador ha alcanzado la puntuación objetivo
                if (!gameEnded && (data.scores.left >= gameTargetScore || data.scores.right >= gameTargetScore)) {
                    gameEnded = true;
                    
                    // Determinar ganador y perdedor
                    const isLeftWinner = data.scores.left >= gameTargetScore;
                    const winnerId = isLeftWinner ? playerData.player1.id : playerData.player2.id;
                    const loserId = isLeftWinner ? playerData.player2.id : playerData.player1.id;
                    
                    // Calcular duración del juego en segundos
                    const gameDuration = Math.floor((new Date() - gameStartTime) / 1000);
                    
                    // Informar al backend que el juego ha terminado
                    window.socket.send(JSON.stringify({
                        player: window.currentPlayer,
                        game_over: true
                    }));
                    
                    // Enviar resultados al endpoint
                    sendGameResults({
                        game_id: gameId,
                        winner_id: winnerId,
                        loser_id: loserId,
                        score_winner: isLeftWinner ? data.scores.left : data.scores.right,
                        score_loser: isLeftWinner ? data.scores.right : data.scores.left,
                        duration: gameDuration
                    });
                    
                    // Mostrar mensaje de fin de juego
                    const statusElement = document.getElementById("status-message");
                    if (statusElement) {
                        const winnerName = isLeftWinner ? playerData.player1.username : playerData.player2.username;
                        statusElement.innerText = `¡Juego terminado! ${winnerName} ha ganado la partida.`;
                        statusElement.className = "alert alert-success text-center";
                    }
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
                    animationItems.leftPaddle.material.color.set(gameData.paddle_color);
                    drawGame();
                } else {
                    player1StatusElement.textContent = "PENDING";
                    player1StatusElement.className = "badge bg-warning";
                }
            }
            
            if (player2StatusElement) {
                if (gameState.ready_status.player2) {
                    player2StatusElement.textContent = "READY";
                    player2StatusElement.className = "badge bg-success";
                    animationItems.rightPaddle.material.color.set(gameData.paddle_color);
                    drawGame();
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
            
            // Verificar primero si el juego ha terminado
            if (gameEnded) {
                statusElement.innerText = "¡Juego terminado!";
                statusElement.className = "alert alert-success text-center";
                return;
            }
            
            // Si el juego ha comenzado
            if (gameStarted) {
                statusElement.innerText = "¡El juego ha comenzado!";
                statusElement.className = "alert alert-success text-center";
                return;
            }
            
            // Si el jugador actual no está listo
            if (!gameState.ready_status[window.currentPlayer]) {
                statusElement.innerText = "Pulsa ESPACIO para indicar que estás listo";
                statusElement.className = "alert alert-info text-center";
                return;
            }
            
            // Si el jugador actual está listo pero el otro no
            const otherPlayer = window.currentPlayer === "player1" ? "player2" : "player1";
            if (gameState.ready_status[window.currentPlayer] && !gameState.ready_status[otherPlayer]) {
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
    
        window.socket.onclose = function(event) {
            console.warn("⚠️ Conexión WebSocket cerrada", event.code);
            gameStarted = false;
            gameEnded = true;  // Para evitar dibujar después de la desconexión
        };
          
        function drawGame() {
            if (gameEnded) return;
/*             console.log("🎨 Dibujando el juego...");
            console.log("Paddle 1: ", gameState.paddles.left.position);
            console.log("Paddle 2: ", gameState.paddles.right.position);
            console.log("Ball: ", gameState.ball.position); */
            animationItems.ball.position.set(gameState.ball.position.x, gameState.ball.position.y, 0);
            animationItems.leftPaddle.position.set(gameState.paddles.left.position.x, gameState.paddles.left.position.y + (gameState.paddles.left.height / 2), 0);
            animationItems.rightPaddle.position.set(gameState.paddles.right.position.x, gameState.paddles.right.position.y + (gameState.paddles.right.height / 2), 0);
            animationItems.renderer.render(animationItems.scene, animationItems.camera);
        }

        function startScene() {
            console.log("🎮 Iniciando escena 3D...");
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, _canvas.width / _canvas.height, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ canvas: _canvas });
            animationItems.scene = scene;
            animationItems.camera = camera;
            animationItems.renderer = renderer;
            renderer.setSize(_canvas.width, _canvas.height);
            renderer.shadowMap.enabled = true; // Enable shadow maps in the renderer
            
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Soft warm sunset light
            scene.add(ambientLight);
        
            var light = new THREE.PointLight(0xffffff, 10000, 1000);
            light.position.set(-20, 300, 40);
            light.shadow.radius = 1; // Soften the shadow
    
            light.castShadow = true; // Enable shadows for the light
            //console.log("🔦 Luz:", light);
            scene.add(light);

            var light2 = new THREE.PointLight(0xffffff, 10000, 1000);
            light2.position.set(820, 220, 40);
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
            animationItems.leftPaddle = leftPaddle;
        
            const rightPaddleGeometry = new THREE.BoxGeometry( gameState.paddles.right.width, gameState.paddles.right.height, 30 );
            const rightPaddleMaterial = new THREE.MeshStandardMaterial( { color: 0xffffff } );
            const rightPaddle = new THREE.Mesh( rightPaddleGeometry, rightPaddleMaterial );
            rightPaddle.position.set(gameState.paddles.right.position.x, gameState.paddles.right.position.y + (gameState.paddles.right.height / 2), 0);
            //console.log("Right paddle: ", rightPaddle.position);

            rightPaddle.castShadow = true; // Enable shadows for the paddle
            scene.add( rightPaddle );
            animationItems.rightPaddle = rightPaddle;
        
            const material = new THREE.LineBasicMaterial({ color: 0xffffff });
            const points = [];
        
            points.push( new THREE.Vector3( 400, 0, 0 ) );
            points.push( new THREE.Vector3( 400, 400, 0 ) );
        
            const geometry = new THREE.BufferGeometry().setFromPoints( points );
            const middleLine = new THREE.Line(geometry, material);
            scene.add( middleLine );
               
            // Create the ball
            const ballGeometry = new THREE.SphereGeometry( gameState.ball.radius, 32, 32 );
            const ballMaterial = new THREE.MeshStandardMaterial( { color: gameState.ball.color } );
            const ball = new THREE.Mesh( ballGeometry, ballMaterial );
            ball.position.set(gameState.ball.position.x, gameState.ball.position.y, 0);
            ball.castShadow = true; // Enable shadows for the ball
            scene.add( ball );
            animationItems.ball = ball;
            camera.position.set(400, 0, 300); // Adjust these values as needed
            camera.up.set(0, 0, 1);
            camera.lookAt(400, 200, 0);
            renderer.render(scene, camera);
        }
    
        // Inicializar el mensaje de estado y los indicadores READY/PENDING al cargar
        updateStatusMessage();
        updateReadyStatusDisplay();
        
        // Dibujar el juego por primera vez
        startScene();

        function drawGameResult(ctx, gameData, playerData) {

            const leftScoreElement = document.getElementById("left-score");
            const rightScoreElement = document.getElementById("right-score");
            
            if (leftScoreElement && rightScoreElement) {
                leftScoreElement.textContent = gameData.player1_score;
                rightScoreElement.textContent = gameData.player2_score;
            }

            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
            ctx.fillStyle = "white";
            ctx.font = "bold 30px Arial";
            ctx.textAlign = "center";
    
            ctx.fillText("🏆 PARTIDA FINALIZADA 🏆", ctx.canvas.width / 2, 100);
    
            // Ya tenemos el marcador arriba
            // ctx.font = "bold 24px Arial";
            // ctx.fillText(`🔹 ${playerData.player1.username} (${gameData.player1_score}) - ${playerData.player2.username} (${gameData.player2_score}) 🔹`, ctx.canvas.width / 2, 180);
    
            let winnerText = gameData.player1_score > gameData.player2_score
                ? `🎉 GANADOR: ${playerData.player1.username}`
                : `🎉 GANADOR: ${playerData.player2.username}`;
    
            ctx.fillText(winnerText, ctx.canvas.width / 2, 250);
            ctx.fillText(`Duración: ${gameData.duration} segundos`, ctx.canvas.width / 2, 300);
        }

    };
    

     // Envía los resultados del juego al endpoint
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

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;  // Si estamos escribiendo en un campo de texto, permitir el comportamiento normal
        }
        let key = e.key // variable para almacenar la tecla presionada y invertir el movimiento porque 3d es raro
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
            e.preventDefault();  // Prevenir el scroll con las flechas y el espacio
            if (e.key === 'ArrowUp') {
                key = 'ArrowDown'; 
            } else if (e.key === 'ArrowDown') {
                key = 'ArrowUp'; 
            }
        }
    
        if (!gameState || !socket || window.socket.readyState !== WebSocket.OPEN) return;
    
        console.log(`🔑 Tecla: ${e.key} | Player: ${window.currentPlayer} | Game: ${gameId}`);

        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r' && !gameEnded) {
            e.preventDefault();
            randomlyEndGame();
            return;
        }

        window.socket.send(JSON.stringify({
            player: window.currentPlayer,
            key: key
        }));
    }
        
    function randomlyEndGame() {
        
        // Generate random scores between 0 and gameTargetScore
        const player1Score = Math.floor(Math.random() * (gameTargetScore + 1));
        const player2Score = Math.floor(Math.random() * (gameTargetScore + 1));
        
        // Randomly determine winner
        const isLeftWinner = Math.random() < 0.5;
        const winnerId = isLeftWinner ? playerData.player1.id : playerData.player2.id;
        const loserId = isLeftWinner ? playerData.player2.id : playerData.player1.id;
        
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
        
        // Update UI
        gameEnded = true;
        const statusElement = document.getElementById("status-message");
        if (statusElement) {
            const winnerName = isLeftWinner ? playerData.player1.username : playerData.player2.username;
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
        if (socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.close();
        }
    }
    
    // 🚀 **Desactivar el WebSocket y limpiar eventos al salir de la página**
    window.addEventListener("beforeunload", function () {
        console.log("🎮 Cerrando WebSocket y limpiando intervalos...");
        
        if (socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.close();
        }
    
        // Opcional: Remover event listeners si has agregado más
        document.removeEventListener("keydown", handleKeyDown);
    });

})();



