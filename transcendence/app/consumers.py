# game/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PongGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = 'game_room'
        self.room_group_name = f'game_{self.room_name}'

        # Unir el grupo de WebSocket
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Salir del grupo de WebSocket
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data['message']

        # Enviar el mensaje al grupo
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'message': message
            }
        )

    async def game_message(self, event):
        message = event['message']
        # Enviar el mensaje al WebSocket
        await self.send(text_data=json.dumps({'message': message}))
