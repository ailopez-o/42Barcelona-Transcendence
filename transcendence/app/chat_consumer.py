import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Intenta obtener el game_id de la URL; si no existe, se usa global_chat
        self.game_id = self.scope['url_route']['kwargs'].get('game_id', None)
        if self.game_id:
            self.room_group_name = f"chat_game_{self.game_id}"
        else:
            self.room_group_name = "global"

        # Unir la conexión al grupo correspondiente
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Abandonar el grupo
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get("message")
        username = data.get("username", "Anónimo")
        
        # Enviar el mensaje a todos los miembros del grupo
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message,
                "username": username,
            }
        )

    async def chat_message(self, event):
        # Enviar el mensaje de chat a la conexión WebSocket
        await self.send(text_data=json.dumps({
            "type": "chat",
            "username": event["username"],
            "message": event["message"],
        }))
