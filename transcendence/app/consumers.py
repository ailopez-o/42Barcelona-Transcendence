import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
import random

# Variables globales para controlar el estado y el bucle de cada sala
global_room_states = {}
running_game_loops = {}

class PongGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = f"game_{self.scope['url_route']['kwargs']['game_id']}"
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

        # Si aún no existe estado para esta sala, créalo y arranca el bucle.
        if self.room_name not in global_room_states:
            global_room_states[self.room_name] = {
                "ball": {"x": 400, "y": 200, "dx": random.choice([-5, 5]), "dy": random.choice([-5, 5])},
                "paddles": {
                    "left": {"y": 150, "speed": 10},
                    "right": {"y": 150, "speed": 10}
                },
                "scores": {"left": 0, "right": 0}
            }
            running_game_loops[self.room_name] = asyncio.create_task(self.game_loop())
        # Si ya existe, los nuevos clientes simplemente se unirán al grupo y usarán el estado compartido.

    async def receive(self, text_data):
        data = json.loads(text_data)
        # Actualiza el estado compartido según el movimiento enviado.
        state = global_room_states[self.room_name]
        if data["player"] == "left":
            state["paddles"]["left"]["y"] += data["movement"]
        elif data["player"] == "right":
            state["paddles"]["right"]["y"] += data["movement"]

    async def game_loop(self):
        """ Bucle principal del juego que actualiza el estado y lo difunde a todos los clientes. """
        while True:
            state = global_room_states[self.room_name]
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
        state["ball"]["x"] = 400
        state["ball"]["y"] = 200
        state["ball"]["dx"] = random.choice([-5, 5])
        state["ball"]["dy"] = random.choice([-5, 5])

    async def game_update(self, event):
        """ Envía el estado del juego actualizado al cliente. """
        await self.send(text_data=json.dumps(event["state"]))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)
