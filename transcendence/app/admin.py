from django.contrib import admin
from .models import User, Game, Tournament, TournamentGame, GameResult, Notification

admin.site.register(User)
admin.site.register(Game)
admin.site.register(Tournament)
admin.site.register(TournamentGame)
admin.site.register(GameResult)
admin.site.register(Notification)



