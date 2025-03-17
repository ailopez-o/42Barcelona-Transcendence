from django.urls import re_path
from .game_consumer import PongGameConsumer  # Tu consumer para WebSockets

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<game_id>\d+)/$', PongGameConsumer.as_asgi()),
]
