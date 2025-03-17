"""
ASGI config for mysite project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter 
from app.consumers.game_routing import websocket_urlpatterns as game_ws_urlpatterns
from app.consumers.chat_routing import websocket_urlpatterns as chat_ws_urlpatterns

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')

combined_websocket_urlpatterns = game_ws_urlpatterns + chat_ws_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # Maneja las peticiones HTTP
    "websocket": URLRouter(combined_websocket_urlpatterns),  # Maneja las conexiones WebSocket
})
