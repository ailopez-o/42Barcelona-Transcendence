# monumentpixel_consumer.py
import json
import asyncio
import random
from channels.generic.websocket import AsyncWebsocketConsumer

# Dimensiones de objetos (puedes ajustarlas según tu diseño)
PLAYER_SIZE = {"width": 30, "height": 50}
OBSTACLE_SIZE = {"width": 30, "height": 30}
BULLET_SIZE = {"width": 10, "height": 10}

# Diccionarios globales para guardar el estado y el bucle de cada sala.
global_game_states = {}
running_game_loops = {}

def is_collision(pos1, size1, pos2, size2):
    """Función de ayuda para detectar solapamiento entre dos rectángulos."""
    return (pos1["x"] < pos2["x"] + size2["width"] and
            pos1["x"] + size1["width"] > pos2["x"] and
            pos1["y"] < pos2["y"] + size2["height"] and
            pos1["y"] + size1["height"] > pos2["y"])

class MonumentPixelConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f"monumentpixel_{self.game_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Si es la primera conexión en la sala, se crea el estado inicial y se arranca el bucle de juego.
        if self.room_group_name not in global_game_states:
            global_game_states[self.room_group_name] = self.initial_game_state()
            running_game_loops[self.room_group_name] = asyncio.create_task(self.game_loop())

    def initial_game_state(self):
        # Estado inicial del juego.
        return {
            "players": {
                "player1": {
                    "position": {"x": 100, "y": 50},
                    "state": {"jumping": False, "crouching": False},
                    "starsCollected": 0,
                    "bullets": [],
                    "gameOver": False
                },
                "player2": {
                    "position": {"x": 100, "y": 50},
                    "state": {"jumping": False, "crouching": False},
                    "starsCollected": 0,
                    "bullets": [],
                    "gameOver": False
                }
            },
            "obstacles": [],
            "stars": [],
            "gameState": {
                "scorePlayer1": 0,
                "scorePlayer2": 0,
                "levelSpeed": 3,
                "timeElapsed": 0
            }
        }

    async def receive(self, text_data):
        data = json.loads(text_data)
        state = global_game_states[self.room_group_name]
        player = data.get("player")
        action = data.get("action")

        if player not in state["players"]:
            return

        if action == "jump":
            state["players"][player]["state"]["jumping"] = True
            # Se simula un salto aumentando la posición Y.
            state["players"][player]["position"]["y"] += 150
        elif action == "crouch":
            state["players"][player]["state"]["crouching"] = True
        elif action == "stand":
            state["players"][player]["state"]["jumping"] = False
            state["players"][player]["state"]["crouching"] = False
        elif action == "shoot":
            bullet = data.get("bullet")
            if bullet:
                state["players"][player]["bullets"].append(bullet)
        elif action == "move":
            delta = data.get("delta", {"x": 0, "y": 0})
            state["players"][player]["position"]["x"] += delta.get("x", 0)
            state["players"][player]["position"]["y"] += delta.get("y", 0)

        # Enviar el estado actualizado a todos los clientes.
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "game_update", "state": state}
        )

    def check_collisions(self, state):
        """Revisa las colisiones entre jugadores, obstáculos, estrellas y balas."""
        # Para cada jugador, comprobamos colisión con obstáculos.
        for player_id, player in state["players"].items():
            player_pos = player["position"]
            # Verificamos colisiones con obstáculos.
            for obs in state["obstacles"]:
                if is_collision(player_pos, PLAYER_SIZE, obs["position"], OBSTACLE_SIZE):
                    if obs["type"] == "reward":
                        # Si es recompensa, sumamos estrella y desactivamos la recompensa para ese jugador.
                        player["starsCollected"] += 1
                        obs["activeForPlayers"][player_id] = False
                    else:
                        # Si es obstáculo normal, marcamos game over para el jugador.
                        player["gameOver"] = True

            # Comprobar colisiones de balas con obstáculos (para cada bala del jugador).
            for bullet in player["bullets"]:
                if bullet.get("active", True):
                    for obs in state["obstacles"]:
                        if obs["type"] != "reward" and is_collision(bullet["position"], BULLET_SIZE, obs["position"], OBSTACLE_SIZE):
                            bullet["active"] = False
                            # Aquí podrías agregar lógica para eliminar o marcar el obstáculo como destruido.
                            obs["activeForPlayers"][player_id] = False

    async def game_loop(self):
        # Bucle principal que actualiza el estado del juego.
        while True:
            state = global_game_states[self.room_group_name]
            state["gameState"]["timeElapsed"] += 0.03

            # Crear nuevos obstáculos aleatoriamente.
            if len(state["obstacles"]) < 5 and random.random() < 0.02:
                obs_id = f"obs_{random.randint(1000, 9999)}"
                obs_type = random.choice(["low", "high", "reward"])
                new_obs = {
                    "id": obs_id,
                    "type": obs_type,
                    "position": {"x": 800, "y": 350 if obs_type in ["low"] else 200},
                    "activeForPlayers": {"player1": True, "player2": True}
                }
                state["obstacles"].append(new_obs)

            # Crear nuevas estrellas aleatoriamente (si no se usan el tipo reward en obstáculos).
            if len(state["stars"]) < 3 and random.random() < 0.01:
                star_id = f"star_{random.randint(1000, 9999)}"
                new_star = {
                    "id": star_id,
                    "position": {"x": 800, "y": random.randint(50, 300)},
                    "active": True
                }
                state["stars"].append(new_star)

            # Mover obstáculos y estrellas hacia la izquierda.
            for obs in state["obstacles"]:
                obs["position"]["x"] -= state["gameState"]["levelSpeed"]
            for star in state["stars"]:
                star["position"]["x"] -= state["gameState"]["levelSpeed"]

            # Actualizar posición de las balas de cada jugador.
            for p in state["players"]:
                for bullet in state["players"][p]["bullets"]:
                    if bullet.get("active", True):
                        bullet["position"]["x"] += bullet.get("speed", 10)
                        if bullet["position"]["x"] > 800:
                            bullet["active"] = False

            # Limpiar obstáculos y estrellas fuera de pantalla o inactivos.
            state["obstacles"] = [obs for obs in state["obstacles"] if obs["position"]["x"] > -50]
            state["stars"] = [star for star in state["stars"] if star["active"]]

            # Actualizar colisiones (jugador-obstáculo y bala-obstáculo).
            self.check_collisions(state)

            # Incrementar puntajes de manera arbitraria (o según lógica de juego).
            state["gameState"]["scorePlayer1"] += 1
            state["gameState"]["scorePlayer2"] += 1

            # Difundir el estado actualizado a todos los clientes.
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "game_update", "state": state}
            )
            await asyncio.sleep(0.03)

    async def game_update(self, event):
        # Envía el estado del juego en formato JSON al cliente.
        await self.send(text_data=json.dumps(event["state"]))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
