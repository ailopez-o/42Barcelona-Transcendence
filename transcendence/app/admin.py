from django.contrib import admin
from .models import User, Game, Tournament, GameResult, Notification, ChatMessage, ChatRoom

admin.site.register(User)
admin.site.register(Game)
admin.site.register(Tournament)
admin.site.register(GameResult)
admin.site.register(Notification)
admin.site.register(ChatRoom)
admin.site.register(ChatMessage)



