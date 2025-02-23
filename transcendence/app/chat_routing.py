# app/chat_routing.py
from django.urls import re_path
from .chat_consumer import ChatConsumer

websocket_urlpatterns = [
    # Ruta para chat global sin parámetro
    re_path(r'^ws/chat/$', ChatConsumer.as_asgi()),
    # Ruta para chat de una partida específica, que recibe un game_id
    re_path(r'^ws/chat/(?P<game_id>\d+)/$', ChatConsumer.as_asgi()),
]
