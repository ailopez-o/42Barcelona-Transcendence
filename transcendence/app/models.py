from django.db import models
from django.db.models import Count, Q
from django.contrib.auth.models import AbstractUser, Group, Permission

class User(AbstractUser):
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    display_name = models.CharField(max_length=150, unique=True)
    intra_url = models.URLField(max_length=500, blank=True, null=True)

    groups = models.ManyToManyField(Group, related_name='custom_user_groups', blank=True)
    user_permissions = models.ManyToManyField(Permission, related_name='custom_user_permissions', blank=True)

    def __str__(self):
        return self.username

    @property
    def total_games(self):
        return GameResult.objects.filter(Q(winner=self) | Q(loser=self)).count()

    @property
    def total_wins(self):
        return GameResult.objects.filter(winner=self).count()

    @property
    def total_losses(self):
        return GameResult.objects.filter(loser=self).count()
    
    @property
    def tournaments_won(self):
        return 42


DIFFICULTY_CHOICES = [
    ('facil', 'Fácil'),
    ('medio', 'Medio'),
    ('dificil', 'Difícil'),
]

class Game(models.Model):
    STATUS_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_curso', 'En curso'),
        ('finalizado', 'Finalizado'),
        ('cancelado', 'Cancelado'),
    ]

    player1 = models.ForeignKey(User, related_name='games_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='games_as_player2', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='medio')
    points = models.PositiveIntegerField(default=10)
    paddle_color = models.CharField(max_length=7, default="#0000ff")  # Formato hexadecimal, ejemplo: azul
    ball_color = models.CharField(max_length=7, default="#ff0000")    # Formato hexadecimal, ejemplo: rojo

    def __str__(self):
        return f"Game {self.id}: {self.player1} vs {self.player2} ({self.status})"

class Tournament(models.Model):
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_tournaments')
    participants = models.ManyToManyField(User, related_name='tournaments')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed')], default='pending')

    def __str__(self):
        return self.name

class TournamentGame(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='games')
    game = models.OneToOneField(Game, on_delete=models.CASCADE, related_name='tournament_game')
    round_number = models.PositiveIntegerField()

    def __str__(self):
        return f"Juego de torneo {self.tournament.name}, Ronda {self.round_number}"


class GameResult(models.Model):
    game = models.OneToOneField(Game, on_delete=models.CASCADE, related_name="result")
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="winner")
    loser = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="loser")
    score_winner = models.PositiveIntegerField(help_text="Puntuación del ganador")
    score_loser = models.PositiveIntegerField(help_text="Puntuación del perdedor")
    duration = models.PositiveIntegerField(help_text="Duración de la partida en segundos", default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Partida {self.game.id}: Ganador {self.winner} ({self.score_winner}) vs Perdedor {self.loser} ({self.score_loser})"


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    seen = models.BooleanField(default=False)

    def __str__(self):
        return f"Notificación para {self.user.username}: {self.message}"
