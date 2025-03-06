from django.urls import re_path
from .monument_pixel_consumer import  MonumentPixelConsumer # Tu consumer para WebSockets

websocket_urlpatterns = [
    re_path(r'ws/monumentpixel/(?P<game_id>\d+)/$', MonumentPixelConsumer.as_asgi()),
]
