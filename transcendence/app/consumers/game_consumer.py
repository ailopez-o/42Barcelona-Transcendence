import os
import django
import time
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mysite.settings")
django.setup()
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import random
from ..models import Game
import logging
from ..models import GameResult  # Import aquí si no lo tienes arriba
logger = logging.getLogger(__name__)

# Variables globales para controlar el estado y el bucle de cada sala
global_room_states = {}
running_game_loops = {}
game_difficulty = {}  # Almacenar la dificultad de cada juego

class PongGameConsumer(AsyncWebsocketConsumer):
    
    @database_sync_to_async
    def update_game_status(self, status, game_id):
        """Actualiza la base de datos de forma segura en un hilo separado"""
        game = Game.objects.get(id=game_id)
        game.status = status
        game.save(update_fields=['status'])
        
    @database_sync_to_async
    def game_exists(self, game_id):
        return Game.objects.filter(id=game_id).exists()
    
    @database_sync_to_async
    def save_game_result(self, game_id, winner_side, score_winner, score_loser, duration):
        game = Game.objects.get(id=game_id)

        if winner_side == "left":
            winner = game.player1
            loser = game.player2
        else:
            winner = game.player2
            loser = game.player1

        # Crear el resultado si no existe
        result, created = GameResult.objects.get_or_create(
            game=game,
            defaults={
                'winner': winner,
                'loser': loser,
                'score_winner': score_winner,
                'score_loser': score_loser,
                'duration': duration
            }
        )
        # Si ya existía, actualízalo
        if not created:
            result.winner = winner
            result.loser = loser
            result.score_winner = score_winner
            result.score_loser = score_loser
            result.duration = duration
            result.save()

        logger.info(
            "\n"
            f"========== GAME RESULT ==========\n"
            f"Game ID       : {game_id}\n"
            f"Winner        : {winner.username} (Score: {score_winner})\n"
            f"Loser         : {loser.username} (Score: {score_loser})\n"
            f"Duration (s)  : {duration}\n"
            f"Final Result  : {winner.username} defeated {loser.username} ({score_winner}-{score_loser})\n"
            f"================================="
        )

    @database_sync_to_async
    def finalize_game(self, game_id):
        game = Game.objects.get(id=game_id)
        game.status = "finalizado"
        game.save(update_fields=["status"])

    async def end_game(self, winner_side, state):
        state["game_over"] = True
        state["ball"]["dx"] = 0
        state["ball"]["dy"] = 0
        state["ball"]["x"] = 400
        state["ball"]["y"] = 200

        game_id = self.scope['url_route']['kwargs']['game_id']
        
        # Calcular puntuaciones y duración
        score_winner = state["scores"]["left"] if winner_side == "left" else state["scores"]["right"]
        score_loser = state["scores"]["right"] if winner_side == "left" else state["scores"]["left"]
        
        duration = 0
        if "start_time" in state:
            duration = int(time.time() - state["start_time"])  # 🔹 Duración en segundos, redondeada
        else:
            duracion = 42

        # Guardar estado de la partida
        await self.finalize_game(game_id)
        
        # Guardar resultado
        await self.save_game_result(game_id, winner_side, score_winner, score_loser, duration)

        # Si el juego pertenece a un torneo, verificar si se debe avanzar a la siguiente ronda
        game = Game.objects.get(id=game_id)
        if game.tournament:
            game.tournament.check_next_round()

        # Enviar estado final
        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "game_update",
                "state": state
            }
        )

        # Cancelar bucle
        loop_task = running_game_loops.pop(self.room_name, None)
        if loop_task and not loop_task.done():
            loop_task.cancel()


    
    async def connect(self):
        game_id = self.scope['url_route']['kwargs']['game_id']
        if not await self.game_exists(game_id):
            await self.close()
            return
        self.user = self.scope["user"]  # Obtener usuario conectado
        self.room_name = f"game_{self.scope['url_route']['kwargs']['game_id']}"
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

        username = self.user.username if self.user.is_authenticated else "Anónimo"
        logger.info(f"Conexion a al juego {self.room_name} de {username}")

        # Sacamos la info de la partida de la BBDD
        game_id = self.scope['url_route']['kwargs']['game_id']
        game = await Game.objects.aget(id=game_id)
        
        # Si aún no existe estado para esta sala, créalo
        if self.room_name not in global_room_states:
            logger.info(f"Nuevo state para {self.room_name}")

            # Convertir la dificultad textual a un factor numérico
            difficulty_factor = {
                'facil': 1,
                'medio': 1.5,
                'dificil': 2
            }.get(game.difficulty, 1.5)  # Valor predeterminado 1.5 si hay algún problema

            game_difficulty[self.room_name] = difficulty_factor
            
            global_room_states[self.room_name] = {
                "id": self.room_name,
                "ball": {"x": 400, "y": 200, "dx": 0, "dy": 0},  # La bola inmóvil inicialmente
                "paddles": {
                    "left": {"y": 150, "speed": 10 * game_difficulty[self.room_name]},
                    "right": {"y": 150, "speed": 10 * game_difficulty[self.room_name]}
                },
                "scores": {"left": 0, "right": 0},
                "game_started": False,  # Controla si el juego ha comenzado
                "game_over": False,     # Controla si el juego ha terminado
                "ready_status": {        # Estado de "listo" de ambos jugadores
                    "player1": False,
                    "player2": False
                },
                "max_points": game.points,
                "difficulty": game.difficulty
            }
            
        # Enviamos un mensaje inicial SOLO con el estado actual, sin mensaje adicional
        # await self.send(text_data=json.dumps(global_room_states[self.room_name]))

        # recuperamos el state
        state = global_room_states[self.room_name]
        state["ready_status"]["player1"] = game.player1_ready
        state["ready_status"]["player2"] = game.player2_ready
        # Sincronizamos el estado del juego con la base de datos
        state["game_started"] = game.status == "en_curso"
        state["game_over"] = game.status == "finalizado"
        # Si el estado del juego es en_curso, ambos jugadores están listos
        if (game.status == "en_curso"):
            state["ready_status"]["player1"] = True
            state["ready_status"]["player2"] = True

        # TODO: Si el juego ya ha terminado, limpiar el estado y detener el bucle del juego

        # Enviar inmediatamente el estado actualizado a todos los clientes
        logger.info(f"Estado actual en {self.room_name}: {state} ")
        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "game_update",
                "state": state
            }
        )

    async def receive(self, text_data):
        self.user = self.scope["user"]  # Obtener usuario conectado
        username = self.user.username if self.user.is_authenticated else "Anónimo"
        data = json.loads(text_data)
        logger.info(f"Mensaje recibido en {self.room_name} de {username}: {data}")
        state = global_room_states[self.room_name]
        
        # Comprobar si el evento viene de uno de los jugadores válidos
        if "player" not in data or data["player"] not in ["player1", "player2"]:
            # Si no es un jugador válido, ignoramos el evento
            logger.info(f"Evento ignorado: no proviene de un jugador válido: {data}")
            return
        
        # Si se fuerza una finalización de la partida
        if "action" in data and data["action"] == "finish":
            # creamos un resultado aleatorio
            winner_side, score_winner, score_loser = generate_random_result(state["max_points"])
            if (winner_side == "left"):
                state["scores"]["left"] = score_winner
                state["scores"]["right"] = score_loser
            else:
                state["scores"]["right"] = score_winner
                state["scores"]["left"] = score_loser

            # fornzamos el final de la partida
            await self.end_game(winner_side, state)


        # Manejar mensaje de inicialización con dificultad
        if "init_game" in data and "difficulty" in data:
            # Convertir la dificultad textual a un factor numérico
            difficulty_factor = {
                'facil': 1,
                'medio': 1.5,
                'dificil': 2
            }.get(data["difficulty"], 1.5)  # Valor predeterminado 1.0 si hay algún problema
            
            game_difficulty[self.room_name] = difficulty_factor
            
            # Actualizar las velocidades de las paletas con la nueva dificultad
            state["paddles"]["left"]["speed"] = 10 * difficulty_factor
            state["paddles"]["right"]["speed"] = 10 * difficulty_factor
            
            logger.info(f"Dificultad del juego establecida: {data['difficulty']} (factor: {difficulty_factor})")
            return
        
        # Procesar mensaje de fin de juego
        if "game_over" in data and data["game_over"]:
            # Marcar el juego como terminado
            state["game_over"] = True
            # Detener el movimiento de la pelota estableciendo las velocidades a 0
            state["ball"]["dx"] = 0
            state["ball"]["dy"] = 0
            # Colocar la bola en el centro de la pantalla
            state["ball"]["x"] = 400
            state["ball"]["y"] = 200
            
            # Informar a todos los clientes que el juego ha terminado
            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "game_update",
                    "state": state
                }
            )
            return
            
        # Ahora recibimos la tecla directamente en lugar del movimiento
        if "key" in data:
            # Mapear player1/player2 a left/right para las paletas
            paddle_side = "left" if data["player"] == "player1" else "right"
            key = data["key"]

            logger.info(f"Tecla presionada: [{key}] por {data['player']} en {self.room_name}.")
                
            # Procesar tecla de espacio para marcar como listo
            if key == " " and not state["game_started"]:
                # Marcar al jugador como listo
                if not state["ready_status"][data["player"]]:  
                    #actualizamos el state
                    state["ready_status"][data["player"]] = True
                    # persistencia en la base de datos
                    game_id = self.scope['url_route']['kwargs']['game_id']
                    if data["player"] == "player1":
                        await Game.objects.filter(id=game_id).aupdate(player1_ready=True)
                    if data["player"] == "player2":
                        await Game.objects.filter(id=game_id).aupdate(player2_ready=True)
                    # Loggear el estado actual
                    logger.info(f"{data['player']} está listo en {self.room_name}.")
                
                logger.info(f"Estado actual ready_status en {self.room_name}: {state['ready_status']}")

                # Comprobar si ambos jugadores están listos
                if state["ready_status"]["player1"] and state["ready_status"]["player2"]:
                    state["game_started"] = True
                    state["start_time"] = time.time()

                    # Actualizar el estado de la partida en la base de datos
                    game_id = self.scope['url_route']['kwargs']['game_id']
                    await Game.objects.filter(id=game_id).aupdate(status="en_curso")

                    # Iniciar la bola con velocidad según la dificultad
                    state["ball"]["dx"] = random.choice([-5, 5]) * game_difficulty[self.room_name]
                    state["ball"]["dy"] = random.choice([-5, 5]) * game_difficulty[self.room_name]
                    
                    # Solo iniciamos el bucle del juego cuando ambos están listos
                    if self.room_name not in running_game_loops or running_game_loops[self.room_name].done():
                        running_game_loops[self.room_name] = asyncio.create_task(self.game_loop())
                
                # Enviar inmediatamente el estado actualizado a todos los clientes
                # Sin mensajes de texto adicionales
                await self.channel_layer.group_send(
                    self.room_name,
                    {
                        "type": "game_update",
                        "state": state
                    }
                )
                return
            
            # Procesar movimiento solo si el juego ha comenzado y no ha terminado
            if state["game_started"] and not state["game_over"]:
                # Obtener la posición actual de la pala
                current_y = state["paddles"][paddle_side]["y"]
                paddle_speed = state["paddles"][paddle_side]["speed"]
                
                # Procesar teclas de flechas para mover las palas
                if key == "ArrowUp":
                    new_y = current_y - paddle_speed
                    # Limitar el movimiento dentro del canvas
                    state["paddles"][paddle_side]["y"] = max(0, new_y)
                elif key == "ArrowDown":
                    new_y = current_y + paddle_speed
                    # Limitar el movimiento dentro del canvas (0 a 300 para una altura de 400 - altura_pala)
                    state["paddles"][paddle_side]["y"] = max(0, min(300, new_y))
                
                # Enviar inmediatamente el estado actualizado a todos los clientes
                await self.channel_layer.group_send(
                    self.room_name,
                    {
                        "type": "game_update",
                        "state": state
                    }
                )

        def generate_random_result(max_points):
            # score_loser debe ser < max_points // 2 para que el winner tenga más puntos
            max_loser_score = max_points - 1
            score_loser = random.randint(1, max_loser_score - 1)
            score_winner = max_points - score_loser

            # Asegurar que winner tiene más puntos
            if score_loser >= score_winner:
                score_loser, score_winner = score_winner, score_loser
            if score_loser == score_winner:
                score_winner += 1
                score_loser -= 1

            winner_side = random.choice(["left", "right"])
            return winner_side, score_winner, score_loser

    async def game_loop(self):
        """ Bucle principal del juego que actualiza el estado y lo difunde a todos los clientes. """
        state = global_room_states[self.room_name]
        while state["game_started"] and not state["game_over"]:
            state = global_room_states[self.room_name]

            await self.update_ball(state)

            if "start_time" in state:
                current_time = int(time.time())
                state["duration"] = current_time - int(state["start_time"])

            # Enviar el estado actualizado a todos los clientes conectados a esta sala
            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "game_update",
                    "state": state
                }
            )
            await asyncio.sleep(0.03)  # Aproximadamente 30 FPS

    async def update_ball(self, state):
        """ Actualiza la posición de la bola y maneja colisiones y puntuaciones. """
        # Si el juego no ha comenzado o ya terminó, la bola no se mueve
        if not state["game_started"] or state["game_over"]:
            return
            
        state["ball"]["x"] += state["ball"]["dx"]
        state["ball"]["y"] += state["ball"]["dy"]

        # Rebote en la parte superior e inferior
        if state["ball"]["y"] <= 0 or state["ball"]["y"] >= 400:
            state["ball"]["dy"] *= -1

        # Colisión con las palas
        if self.ball_hits_paddle("left", state):
            state["ball"]["dx"] *= -1
        elif self.ball_hits_paddle("right", state):
            state["ball"]["dx"] *= -1

        # Si la bola sale por la izquierda o derecha, se anota un punto y se reinicia la bola
        if state["ball"]["x"] <= 0:
            state["scores"]["right"] += 1
            self.reset_ball(state)
        elif state["ball"]["x"] >= 800:
            state["scores"]["left"] += 1
            self.reset_ball(state)

        # logica del fin de la patida
        if state["scores"]["left"] >= state["max_points"]:
            await self.end_game("left", state)
        elif state["scores"]["right"] >= state["max_points"]:
            await self.end_game("right", state)


    def ball_hits_paddle(self, side, state):
        """ Comprueba si la bola colisiona con la pala indicada. """
        paddle_y = state["paddles"][side]["y"]
        ball_x = state["ball"]["x"]
        ball_y = state["ball"]["y"]
        if side == "left" and ball_x <= 30 and paddle_y <= ball_y <= paddle_y + 100:
            return True
        if side == "right" and ball_x >= 770 and paddle_y <= ball_y <= paddle_y + 100:
            return True
        return False

    def reset_ball(self, state):
        """ Reinicia la bola en el centro y asigna nuevas direcciones aleatorias. """
        state["ball"]["x"] = 400
        state["ball"]["y"] = 200
        
        # Si el juego está en curso y no ha terminado, damos velocidad según la dificultad
        if state["game_started"] and not state["game_over"]:
            speed = 5 * game_difficulty[self.room_name]
            state["ball"]["dx"] = random.choice([-1, 1]) * speed
            state["ball"]["dy"] = random.choice([-1, 1]) * speed
        else:
            # Si el juego no ha comenzado o ya terminó, la bola queda inmóvil
            state["ball"]["dx"] = 0
            state["ball"]["dy"] = 0

    async def game_update(self, event):
        """ Envía el estado del juego actualizado al cliente. Sin mensajes adicionales. """
        await self.send(text_data=json.dumps(event["state"]))

    async def disconnect(self, close_code):
        self.user = self.scope["user"]  # Obtener usuario conectado
        username = self.user.username if self.user.is_authenticated else "Anónimo"
        logger.info(f"Desconexion del juego {self.room_name} de {username}")
        await self.channel_layer.group_discard(self.room_name, self.channel_name)