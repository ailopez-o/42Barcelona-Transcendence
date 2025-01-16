from django.contrib import admin
from .models import User, Game, GameEvent, Tournament, TournamentGame, RemoteGameSession

admin.site.register(User)
admin.site.register(Game)
admin.site.register(GameEvent)
admin.site.register(Tournament)
admin.site.register(TournamentGame)
admin.site.register(RemoteGameSession)
