console.log('index.js is working');
import { Game } from './game.js';

const startButton = document.querySelector('#startButton');
const menuPrincipal = document.querySelector('#menuPrincipal');
const gameCanvas = document.querySelector('#gameCanvas');

document.querySelector('#startButton').addEventListener('click', () => {
  const singleGame = document.createElement('button');
  const tournament = document.createElement('button');
  
  singleGame.textContent = 'Single Game';
  tournament.textContent = 'Tournament';
  
  document.body.appendChild(singleGame);
  document.body.appendChild(tournament);

  // Evento para iniciar "Single Game"
  singleGame.addEventListener('click', () => {
    menuPrincipal.style.display = 'none';
    singleGame.style.display = 'none';
    tournament.style.display = 'none';

    // Crear el formulario de alias
    const form = document.createElement('div');
    form.innerHTML = `
      <h3>Ingrese los alias de los jugadores</h3>
      <input type="text" id="player1" placeholder="Alias Jugador 1">
      <input type="text" id="player2" placeholder="Alias Jugador 2">
      <button id="confirmPlayers">Iniciar Juego</button>
    `;
    form.id = "playerForm";
    document.body.appendChild(form);

    document.querySelector('#confirmPlayers').addEventListener('click', () => {
      const player1 = document.querySelector('#player1').value || 'Jugador 1';
      const player2 = document.querySelector('#player2').value || 'Jugador 2';

      // Guardar en localStorage
      localStorage.setItem('player1', player1);
      localStorage.setItem('player2', player2);

      // Iniciar el juego
      form.style.display = 'none';
      gameCanvas.style.display = 'block';
      const game = new Game(player1, player2);
      game.start();
    });
  });

  tournament.addEventListener('click', () => {
    console.log('Tournament');
  });

  startButton.style.display = 'none';
  menuPrincipal.style.display = 'none';
});
