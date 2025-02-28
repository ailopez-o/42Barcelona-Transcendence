import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
import random

# Variables globales para controlar el estado y el bucle de cada sala
global_room_states = {}
running_game_loops = {}
player_ready_status = {}  # Diccionario para el estado de "listo" de los jugadores

class PongGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = f"game_{self.scope['url_route']['kwargs']['game_id']}"
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

        # Si aún no existe estado para esta sala, créalo
        if self.room_name not in global_room_states:
            # Obtener la dificultad del juego (esto debería venir de la base de datos)
            # Por ahora usamos un valor por defecto
            difficulty_multiplier = 1.0  # Factor de velocidad según dificultad
            
            global_room_states[self.room_name] = {
                "ball": {"x": 400, "y": 200, "dx": random.choice([-5, 5]) * difficulty_multiplier, "dy": random.choice([-5, 5]) * difficulty_multiplier},
                "paddles": {
                    "left": {"y": 150, "speed": 10 * difficulty_multiplier},
                    "right": {"y": 150, "speed": 10 * difficulty_multiplier}
                },
                "scores": {"left": 0, "right": 0},
                "game_started": False  # Nuevo campo para saber si el juego ha comenzado
            }
            # Inicializamos el estado de "listo" de los jugadores
            player_ready_status[self.room_name] = {
                "player1": False,
                "player2": False
            }
            
        # Enviamos un mensaje inicial con el estado actual
        await self.send(text_data=json.dumps({
            **global_room_states[self.room_name],
            "message": "Pulsa ESPACIO para indicar que estás listo"
        }))

    async def receive(self, text_data):
        data = json.loads(text_data)
        state = global_room_states[self.room_name]
        
        # Ahora recibimos la tecla directamente en lugar del movimiento
        if "key" in data:
            # Mapear player1/player2 a left/right para las paletas
            paddle_side = "left" if data["player"] == "player1" else "right"
            key = data["key"]
            
            # Procesar tecla de espacio para marcar como listo
            if key == " " and not player_ready_status[self.room_name][data["player"]]:
                player_ready_status[self.room_name][data["player"]] = True
                
                # Notificar al cliente que está listo
                await self.send(text_data=json.dumps({
                    "player_ready": data["player"],
                    "message": f"Estás listo. Esperando al otro jugador..."
                }))
                
                # Comprobar si ambos jugadores están listos
                if player_ready_status[self.room_name]["player1"] and player_ready_status[self.room_name]["player2"]:
                    state["game_started"] = True
                    # Solo iniciamos el bucle del juego cuando ambos están listos
                    if self.room_name not in running_game_loops or running_game_loops[self.room_name].done():
                        running_game_loops[self.room_name] = asyncio.create_task(self.game_loop())
                    
                    # Notificar a todos que el juego ha comenzado
                    await self.channel_layer.group_send(
                        self.room_name,
                        {
                            "type": "game_update",
                            "state": state,
                            "message": "¡El juego ha comenzado!"
                        }
                    )
                else:
                    # Notificar que este jugador está listo pero falta el otro
                    await self.channel_layer.group_send(
                        self.room_name,
                        {
                            "type": "game_update",
                            "state": state,
                            "message": f"{data['player']} está listo. Esperando al otro jugador..."
                        }
                    )
                return
            
            # Procesar movimiento solo si el juego ha comenzado
            if state["game_started"]:
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
                    
                # También podríamos implementar otras teclas para pausar, reiniciar, etc.
                
                # Enviar inmediatamente el estado actualizado a todos los clientes
                await self.channel_layer.group_send(
                    self.room_name,
                    {
                        "type": "game_update",
                        "state": state
                    }
                )

    async def game_loop(self):
        """ Bucle principal del juego que actualiza el estado y lo difunde a todos los clientes. """
        while True:
            state = global_room_states[self.room_name]
            
            # Solo actualizamos la pelota si el juego ha comenzado
            if state["game_started"]:
                self.update_ball(state)
                
            # Enviar el estado actualizado a todos los clientes conectados a esta sala.
            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "game_update",
                    "state": state
                }
            )
            await asyncio.sleep(0.03)  # Aproximadamente 30 FPS

    def update_ball(self, state):
        """ Actualiza la posición de la bola y maneja colisiones y puntuaciones. """
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
        # Obtener la velocidad de la dificultad actual
        ball_speed = abs(state["ball"]["dx"])
        
        state["ball"]["x"] = 400
        state["ball"]["y"] = 200
        state["ball"]["dx"] = random.choice([-1, 1]) * ball_speed
        state["ball"]["dy"] = random.choice([-1, 1]) * ball_speed

    async def game_update(self, event):
        """ Envía el estado del juego actualizado al cliente. """
        # Incluimos cualquier mensaje si existe
        response = event["state"]
        if "message" in event:
            response["message"] = event["message"]
            
        await self.send(text_data=json.dumps(response))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)