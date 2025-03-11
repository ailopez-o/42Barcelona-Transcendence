from django.db import models
from django.db.models import Count, Q
from django.contrib.auth.models import AbstractUser, Group, Permission
from random import shuffle
from django.utils.timezone import now 

class User(AbstractUser):
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    display_name = models.CharField(max_length=150, unique=True)
    groups = models.ManyToManyField(Group, related_name='custom_user_groups', blank=True)
    user_permissions = models.ManyToManyField(Permission, related_name='custom_user_permissions', blank=True)

    def __str__(self):
        return self.username
    
    @property
    def avatar_url(self):
        if self.avatar:  # Verifica si el usuario tiene un avatar
            avatar_path = str(self.avatar)  # Convierte a string por si acaso
            if avatar_path.startswith("http"):
                return avatar_path  # Es una URL externa
            return self.avatar.url  # Es una imagen almacenada localmente en media/
        return "/static/images/default_avatar.png"  # Imagen por defecto si no hay avatar

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
    
    @property
    def open_tournaments(self):
        return Tournament.objects.filter(status='inscripcion').exclude(participants=self)

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
    STATUS_CHOICES = [
        ('inscripcion', 'Inscripción'),
        ('en_curso', 'En curso'),
        ('finalizado', 'Finalizado'),
        ('cancelado', 'Cancelado'),
    ]

    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tournaments_created")
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='inscripcion')
    participants = models.ManyToManyField(User, related_name="tournaments", blank=True)
    max_participants = models.PositiveIntegerField(default=8)
    created_at = models.DateTimeField(auto_now_add=True)
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="tournaments_won")

    def __str__(self):
        return f"Torneo {self.name} - {self.status}"

    def is_full(self):
        return self.participants.count() >= self.max_participants

    def start_tournament(self):
        """ Cambia el estado a 'en_curso' y genera las partidas iniciales """
        if self.is_full():
            self.status = 'en_curso'
            self.save()
            self.create_initial_matches()

    def create_initial_matches(self):
        """ Crea las primeras partidas del torneo """
        from random import shuffle
        players = list(self.participants.all())
        shuffle(players)  # Mezclar los jugadores aleatoriamente

        match_pairs = [(players[i], players[i + 1]) for i in range(0, len(players), 2)]
        for player1, player2 in match_pairs:
            Game.objects.create(player1=player1, player2=player2, status='pendiente')

    def check_next_round(self):
        """ Verifica si se deben generar nuevas partidas """
        if Game.objects.filter(player1__in=self.participants.all(), status='en_curso').exists():
            return  # Aún hay partidas en curso

        winners = GameResult.objects.filter(game__player1__in=self.participants.all()).values_list('winner', flat=True)
        winners = list(set(winners))  # Evitar duplicados

        if len(winners) == 1:
            # Solo queda un jugador, es el ganador del torneo
            self.winner = User.objects.get(id=winners[0])
            self.status = 'finalizado'
            self.save()
        else:
            # Crear la siguiente ronda de partidas
            shuffle(winners)
            match_pairs = [(winners[i], winners[i + 1]) for i in range(0, len(winners), 2)]
            for player1, player2 in match_pairs:
                Game.objects.create(player1=player1, player2=player2, status='pendiente')

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
