# app/chat_routing.py
from django.urls import re_path
from .consumers import ChatConsumer

websocket_urlpatterns = [
    # Aquí definimos la URL para el chat.
    re_path(r'^ws/chat/$', ChatConsumer.as_asgi()),
]
