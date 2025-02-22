from django.urls import re_path
from . import consumers  # Tu consumer para WebSockets

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<game_id>\d+)/$', consumers.PongGameConsumer.as_asgi()),
]
