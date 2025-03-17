import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from ..models import ChatRoom, ChatMessage
from django.contrib.auth import get_user_model
import logging
logger = logging.getLogger(__name__)

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

        logger.info(f"Conexion a la sala {self.room_group_name}")

        # Recuperar y enviar historial de mensajes
        history = await self.get_chat_history(self.room_group_name)
        for msg in history:
            await self.send(text_data=json.dumps(msg))

    async def disconnect(self, close_code):
        logger.info(f"Desconexion a la sala {self.room_group_name}")
        # Abandonar el grupo
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get("message")
        username = data.get("username", "Anónimo")
        
        logger.info(f"Mensaje recibido de {username} en la sala {self.room_group_name}: {message}")

        # Guardar el mensaje en la base de datos
        await self.save_message(self.room_group_name, username, message)

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

    # Función para guardar mensajes en la base de datos
    @sync_to_async
    def save_message(self, room_name, username, message):
        room, _ = ChatRoom.objects.get_or_create(name=room_name)
        # Obtener el modelo de usuario configurado en AUTH_USER_MODEL
        User = get_user_model()
        user, _ = User.objects.get_or_create(username=username)  # Si el usuario no existe, se crea temporalmente

        ChatMessage.objects.create(room=room, user=user, message=message)

    # Función para recuperar historial de chat
    @sync_to_async
    def get_chat_history(self, room_name):
        room = ChatRoom.objects.filter(name=room_name).first()
        if not room:
            return []
        messages = ChatMessage.objects.filter(room=room).order_by("timestamp")[:50]
        return [
            {"type": "chat", "username": msg.user.username, "message": msg.message}
            for msg in messages
        ]