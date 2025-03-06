// monumentpixel.js

document.addEventListener("DOMContentLoaded", function() {
  const playerData = JSON.parse(document.getElementById("player-data").textContent);
  const gameData = JSON.parse(document.getElementById("game-data").textContent);
  const gameId = gameData.id;
  const currentPlayer = playerData.current; // "player1" o "player2"
  
  // Obtener los canvas para cada vista
  const canvasPlayer1 = document.getElementById("canvas-player1");
  const canvasPlayer2 = document.getElementById("canvas-player2");
  const ctx1 = canvasPlayer1.getContext("2d");
  const ctx2 = canvasPlayer2.getContext("2d");
  
  // Conectar al WebSocket
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${wsProtocol}://${window.location.host}/ws/monumentpixel/${gameId}/`);
  
  let gameState = null;
  
  socket.onopen = function() {
      console.log("Conectado al WebSocket de Monument Pixel");
  };
  
  socket.onmessage = function(event) {
      const data = JSON.parse(event.data);
      gameState = data;
      renderGame();
  };
  
  socket.onclose = function() {
      console.log("WebSocket cerrado");
  };
  
  function renderGame() {
      if (!gameState) return;
      // Renderizar ambas vistas (para player1 y player2)
      renderCanvas(ctx1, "player1");
      renderCanvas(ctx2, "player2");
  }
  
  function renderCanvas(ctx, viewPlayer) {
      // Limpiar el canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar fondo
      ctx.fillStyle = "#353434";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar obstáculos
      gameState.obstacles.forEach(obs => {
          ctx.fillStyle = obs.type === "low" ? "#FF5733" : (obs.type === "high" ? "#33C1FF" : "gold");
          ctx.fillRect(obs.position.x, ctx.canvas.height - obs.position.y, 30, 30);
      });
      
      // Dibujar estrellas
      gameState.stars.forEach(star => {
          ctx.fillStyle = "yellow";
          ctx.beginPath();
          ctx.arc(star.position.x, ctx.canvas.height - star.position.y, 10, 0, Math.PI * 2);
          ctx.fill();
      });
      
      // Dibujar jugadores
      Object.keys(gameState.players).forEach(playerId => {
          const player = gameState.players[playerId];
          // Resaltar la vista propia y la del contrincante
          ctx.fillStyle = (playerId === viewPlayer) ? "green" : "red";
          ctx.fillRect(player.position.x, ctx.canvas.height - player.position.y - 50, 30, 50);
          
          // Mostrar estrellas acumuladas
          ctx.fillStyle = "white";
          ctx.font = "14px Courier New";
          ctx.fillText(`Stars: ${player.starsCollected}`, player.position.x, ctx.canvas.height - player.position.y - 60);
          
          // Dibujar las balas activas
          player.bullets.forEach(bullet => {
              if (bullet.active) {
                  ctx.fillStyle = "white";
                  ctx.beginPath();
                  ctx.arc(bullet.position.x, ctx.canvas.height - bullet.position.y, 5, 0, Math.PI * 2);
                  ctx.fill();
              }
          });
      });
      
      // Mostrar información del juego (puntajes y tiempo)
      ctx.fillStyle = "white";
      ctx.font = "16px Courier New";
      ctx.fillText(`Score P1: ${gameState.gameState.scorePlayer1}`, 10, 20);
      ctx.fillText(`Score P2: ${gameState.gameState.scorePlayer2}`, 10, 40);
      ctx.fillText(`Time: ${Math.floor(gameState.gameState.timeElapsed)}s`, 10, 60);
  }
  
  // Enviar acciones del usuario al backend.
  document.addEventListener("keydown", function(e) {
      if (e.key === "ArrowUp") {
          socket.send(JSON.stringify({ player: currentPlayer, action: "jump" }));
      }
      if (e.key === "ArrowDown") {
          socket.send(JSON.stringify({ player: currentPlayer, action: "crouch" }));
      }
      if (e.key === " ") {
          // Acción de disparo: se crea una bala con posición inicial basada en el jugador.
          const bullet = {
              id: `bullet_${Date.now()}_${currentPlayer}`,
              position: { 
                  x: gameState.players[currentPlayer].position.x + 20, 
                  y: gameState.players[currentPlayer].position.y + 25 
              },
              speed: 10,
              active: true
          };
          socket.send(JSON.stringify({ player: currentPlayer, action: "shoot", bullet: bullet }));
      }
  });
  
  document.addEventListener("keyup", function(e) {
      if (e.key === "ArrowDown") {
          socket.send(JSON.stringify({ player: currentPlayer, action: "stand" }));
      }
  });
});
