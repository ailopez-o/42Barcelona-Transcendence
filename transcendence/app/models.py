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
        return Tournament.objects.filter(winner=self).count() or 0
    
    @property
    def open_tournaments(self):
        return Tournament.objects.filter(status='inscripcion').exclude(participants=self)

DIFFICULTY_CHOICES = [
    ('facil', 'Fácil'),
    ('medio', 'Medio'),
    ('dificil', 'Difícil'),
]

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
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="won_tournaments")

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
        players = list(self.participants.all())
        shuffle(players)  # Mezclar los jugadores aleatoriamente

        print(f"Generando partidas para {len(players)} jugadores en el torneo {self.name}.")
        match_pairs = [(players[i], players[i + 1]) for i in range(0, len(players), 2)]
        for player1, player2 in match_pairs:
            Game.objects.create(player1=player1, player2=player2, status='pendiente', tournament=self)
            print(f"Partida creada en torneo {self.name}: {player1.display_name} vs {player2.display_name}")

    def check_next_round(self):
        """Verifica si deben generarse nuevas partidas en el torneo"""
        # Obtener todas las partidas activas de este torneo
        games_in_progress = self.games.filter(status__in=["pendiente", "en_curso"])
        if games_in_progress.exists():
            return  # Todavía hay partidas sin finalizar

        # Obtener los ganadores de las partidas anteriores
        results = GameResult.objects.filter(game__tournament=self)
        winners_ids = results.values_list('winner_id', flat=True)

        # Convertir a conjunto para evitar duplicados
        winners = list(set(winners_ids))

        if len(winners) == 1:
            # Solo queda un jugador, es el campeón
            self.winner = User.objects.get(id=winners[0])
            self.status = 'finalizado'
            self.save()
            return

        if len(winners) < 2:
            # Algo anda mal si no hay suficientes ganadores para una ronda
            return

        # Preparar siguiente ronda
        shuffle(winners)
        match_pairs = [(winners[i], winners[i + 1]) for i in range(0, len(winners), 2)]

        for pair in match_pairs:
            player1_id = pair[0]
            try:
                player2_id = pair[1]
            except IndexError:
                # Número impar: player1 pasa a la siguiente ronda automáticamente
                self.create_bye_win(player1_id)
                continue

            player1 = User.objects.get(id=player1_id)
            player2 = User.objects.get(id=player2_id)
            Game.objects.create(
                player1=player1,
                player2=player2,
                status='pendiente',
                tournament=self
            )

    def create_bye_win(self, player_id):
        """Registra una victoria automática para jugadores sin oponente (bye)"""
        player = User.objects.get(id=player_id)
        # Crear partida simulada y resultado
        bye_game = Game.objects.create(
            player1=player,
            player2=player,  # puede ser sí mismo o null
            status='finalizado',
            tournament=self
        )
        GameResult.objects.create(
            game=bye_game,
            winner=player,
            loser=player,
            score_winner=0,
            score_loser=0,
            duration=0
        )

class Game(models.Model):
    STATUS_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_curso', 'En curso'),
        ('finalizado', 'Finalizado'),
        ('cancelado', 'Cancelado'),
    ]

    player1 = models.ForeignKey(User, related_name='games_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='games_as_player2', on_delete=models.CASCADE)
    tournament = models.ForeignKey(Tournament, on_delete=models.SET_NULL, null=True, blank=True, related_name="games")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='medio')
    points = models.PositiveIntegerField(default=10)
    paddle_color = models.CharField(max_length=7, default="#0000ff")  # Formato hexadecimal, ejemplo: azul
    ball_color = models.CharField(max_length=7, default="#ff0000")    # Formato hexadecimal, ejemplo: rojo

    def __str__(self):
        return f"Game {self.id}: {self.player1} vs {self.player2} ({self.status})"

    def is_tournament_game(self):
        """Retorna True si la partida pertenece a un torneo"""
        return self.tournament is not None
    
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


class ChatRoom(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name

class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # Usa el modelo User de Django
    message = models.TextField()
    timestamp = models.DateTimeField(default=now)

    class Meta:
        ordering = ['timestamp']  # Los mensajes se ordenan por fecha

    def __str__(self):
        return f"{self.user.username} in {self.room.name}: {self.message[:50]}"