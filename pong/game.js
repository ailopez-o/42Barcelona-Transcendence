console.log('game.js is working');

import { Ball } from './ball.js';
import { Paddle } from './paddle.js';

export class Game {
  constructor(player1Name, player2Name) {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.player1Name = player1Name;
    this.player2Name = player2Name;
    
    
    const paddleMargin = this.canvas.width / 20;
    const paddleWidth = 10;
    const paddleHeight = 100;
    const paddleSpeed = 5;
    const ballRadius = 8;
    const ballInitialVelocity = { x: 5, y: 5 };
    this.initialBallSpeed = 5;  // Añadir esta propiedad para mantener la velocidad inicial
    
    this.leftPaddle = new Paddle(paddleMargin, this.canvas.height / 2 - paddleHeight / 2, paddleWidth, paddleHeight, paddleSpeed);
    this.rightPaddle = new Paddle(this.canvas.width - paddleMargin - paddleWidth, this.canvas.height / 2 - paddleHeight / 2, paddleWidth, paddleHeight, paddleSpeed);
    this.ball = new Ball(this.canvas.width / 2, this.canvas.height / 2, ballRadius, ballInitialVelocity);
    
    this.score = {
      player1: 0,
      player2: 0
    };
    
    this.highlightedPlayer = null;
    this.highlightTimer = null;
    this.normalFontSize = 24;
    this.highlightFontSize = 32;  // Tamaño aumentado durante el highlight
    
    this.isGameOver = false;
    this.winner = null;
    
    this.animationId = null;  // Añadir esta propiedad
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.setupControls();
  }

  setupControls() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'w':
          this.leftPaddle.velocity.y = -this.leftPaddle.maxSpeed;
          break;
        case 's':
          this.leftPaddle.velocity.y = this.leftPaddle.maxSpeed;
          break;
        case 'ArrowUp':
          this.rightPaddle.velocity.y = -this.rightPaddle.maxSpeed;
          break;
        case 'ArrowDown':
          this.rightPaddle.velocity.y = this.rightPaddle.maxSpeed;
          break;
        case 'Escape':
          this.finishGame();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch(e.key) {
        case 'w':
        case 's':
          this.leftPaddle.velocity.y = 0;
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          this.rightPaddle.velocity.y = 0;
          break;
      }
    });
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth * 0.8;
    this.canvas.height = window.innerHeight * 0.8;
    this.leftPaddle.position.x = this.canvas.width / 20;
    this.rightPaddle.position.x = this.canvas.width - this.leftPaddle.width - this.leftPaddle.position.x;
    this.leftPaddle.position.y = this.canvas.height / 2 - this.leftPaddle.height / 2;
    this.rightPaddle.position.y = this.canvas.height / 2 - this.rightPaddle.height / 2;
  }

  // update() {
  //   // Actualizar posición de las paletas
  //   this.leftPaddle.position.y += this.leftPaddle.velocity.y;
  //   this.rightPaddle.position.y += this.rightPaddle.velocity.y;

  //   // Mantener las paletas dentro del canvas
  //   this.leftPaddle.position.y = Math.max(0, Math.min(this.canvas.height - this.leftPaddle.height, this.leftPaddle.position.y));
  //   this.rightPaddle.position.y = Math.max(0, Math.min(this.canvas.height - this.rightPaddle.height, this.rightPaddle.position.y));

  //   // Actualizar posición de la pelota
  //   this.ball.position.x += this.ball.velocity.x;
  //   this.ball.position.y += this.ball.velocity.y;

  //   // Colisiones con las paredes superior e inferior
  //   if (this.ball.position.y <= this.ball.radius || this.ball.position.y >= this.canvas.height - this.ball.radius) {
  //     this.ball.velocity.y *= -1;
  //   }

  //   // Colisiones con las paletas
  //   if (this.checkPaddleCollision(this.leftPaddle) || this.checkPaddleCollision(this.rightPaddle)) {
  //     this.ball.velocity.x *= -1;
      
  //     // Incrementar velocidad solo si no excede el límite
  //     if (Math.abs(this.ball.velocity.x) < 10) {  // 10 es la velocidad máxima
  //         this.ball.velocity.x *= 1.1;
  //     }
  //   }

  //   // Puntuación
  //   if (this.ball.position.x <= 0) {
  //     this.score.player2++;
  //     this.handleScore('player2');
  //     this.resetBall();
  //   } else if (this.ball.position.x >= this.canvas.width) {
  //     this.score.player1++;
  //     this.handleScore('player1');
  //     this.resetBall();
  //   }
  // }

  // checkPaddleCollision(paddle) {
  //   return this.ball.position.x - this.ball.radius <= paddle.position.x + paddle.width &&
  //          this.ball.position.x + this.ball.radius >= paddle.position.x &&
  //          this.ball.position.y >= paddle.position.y &&
  //          this.ball.position.y <= paddle.position.y + paddle.height;
  // }

  // resetBall() {
  //   // Resetear la pelota
  //   this.ball.position.x = this.canvas.width / 2;
  //   this.ball.position.y = this.canvas.height / 2;
    
  //   // Resetear la velocidad de la pelota a su valor inicial
  //   this.ball.velocity.x = this.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1);
  //   this.ball.velocity.y = this.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1);
  //   // Resetear las paletas
  //   this.leftPaddle.position.y = this.canvas.height / 2 - this.leftPaddle.height / 2;
  //   this.rightPaddle.position.y = this.canvas.height / 2 - this.rightPaddle.height / 2;
  //   this.leftPaddle.velocity.y = 0;
  //   this.rightPaddle.velocity.y = 0;
  // }

  // handleScore(scoringPlayer) {
  //   // Configura el highlight
  //   this.highlightedPlayer = scoringPlayer;
    
  //   // Si ya había un timer activo, lo limpiamos
  //   if (this.highlightTimer) {
  //       clearTimeout(this.highlightTimer);
  //   }
    
  //   // Configura el timer para quitar el highlight después de 300ms
  //   this.highlightTimer = setTimeout(() => {
  //       this.highlightedPlayer = null;
  //   }, 300);
  // }

  draw() {
    // Limpiar canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Si el juego ha terminado, solo dibujamos la pantalla de fin
    if (this.isGameOver) {
        this.drawGameOver();
        return;
    }

    // Dibujar fondo
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Dibujar línea central
    this.ctx.strokeStyle = 'white';
    this.ctx.setLineDash([10, 15]);
    this.ctx.lineWidth = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.stroke();

    // Dibujar paletas y pelota
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(this.leftPaddle.position.x, this.leftPaddle.position.y, this.leftPaddle.width, this.leftPaddle.height);
    this.ctx.fillRect(this.rightPaddle.position.x, this.rightPaddle.position.y, this.rightPaddle.width, this.rightPaddle.height);
    
    this.ctx.beginPath();
    this.ctx.arc(this.ball.position.x, this.ball.position.y, this.ball.radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Dibujar puntuación
    this.ctx.font = '32px Share Tech Mono';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${this.score.player1} - ${this.score.player2}`, this.canvas.width / 2, 50);

    // Dibujar nombres de los jugadores
    this.ctx.textAlign = 'center';
    
    // Jugador 1
    this.ctx.fillStyle = this.highlightedPlayer === 'player1' ? 'yellow' : 'white';
    this.ctx.font = `${this.highlightedPlayer === 'player1' ? this.highlightFontSize : this.normalFontSize}px Share Tech Mono`;
    this.ctx.fillText(this.player1Name, 100, 30);
    
    // Jugador 2
    this.ctx.fillStyle = this.highlightedPlayer === 'player2' ? 'yellow' : 'white';
    this.ctx.font = `${this.highlightedPlayer === 'player2' ? this.highlightFontSize : this.normalFontSize}px Share Tech Mono`;
    this.ctx.fillText(this.player2Name, this.canvas.width - 100, 30);
  }

  start() {
    // Si hay una animación en curso, la cancelamos
    if (this.animationId) {
        cancelAnimationFrame(this.animationId);
    }

    const gameLoop = () => {
        if (!this.isGameOver) {
            this.update();
        }
        this.draw();
        this.animationId = requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  finishGame() {
    this.isGameOver = true;
    this.winner = this.score.player1 > this.score.player2 ? this.player1Name : this.player2Name;
    // Cancelar el loop de animación
    if (this.animationId) {
        cancelAnimationFrame(this.animationId);
    }
    this.drawGameOver();
    this.createEndGameButtons();
  }

  drawGameOver() {
    // Oscurecer el fondo
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Texto "Fin de la partida"
    this.ctx.font = '48px Share Tech Mono';
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Fin de la partida', this.canvas.width / 2, this.canvas.height / 3);

    // Mostrar ganador
    this.ctx.font = '36px Share Tech Mono';
    this.ctx.fillStyle = 'yellow';
    this.ctx.fillText(`¡${this.winner} ha ganado!`, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.fillText(`${this.score.player1} - ${this.score.player2}`, this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  createEndGameButtons() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '70%';
    buttonContainer.style.left = '50%';
    buttonContainer.style.transform = 'translate(-50%, -50%)';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '20px';
    buttonContainer.id = 'endGameButtons';

    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = 'Volver a jugar';
    playAgainBtn.addEventListener('click', () => this.resetGame());

    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Salir';
    exitBtn.addEventListener('click', () => {
        window.location.reload();
    });

    buttonContainer.appendChild(playAgainBtn);
    buttonContainer.appendChild(exitBtn);
    document.body.appendChild(buttonContainer);
  }

  resetGame() {
    // Eliminar botones
    const buttons = document.getElementById('endGameButtons');
    if (buttons) buttons.remove();

    // Resetear estado del juego
    this.score.player1 = 0;
    this.score.player2 = 0;
    this.isGameOver = false;
    this.winner = null;
    this.resetBall();
    
    // Reiniciar el loop del juego
    this.start();
  }
}

