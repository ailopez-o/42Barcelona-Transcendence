# populate_data.py
from app.models import User, Game, GameResult, Tournament
import random

# Crear 50 usuarios regulares
for i in range(1, 51):
    username = f"user{i}"
    if not User.objects.filter(username=username).exists():
        User.objects.create_user(username=username, password="123456", email=f"{username}@example.com", display_name=f"User_{i}")

# Obtener todos los usuarios
users = list(User.objects.all())

# Crear al menos 10 partidas aleatorias
if Game.objects.count() < 10:
    for _ in range(10 - Game.objects.count()):
        player1, player2 = random.sample(users, 2)
        game = Game.objects.create(player1=player1, player2=player2, status="finalizado")

        winner, loser = (player1, player2) if random.choice([True, False]) else (player2, player1)
        score_winner = random.randint(5, 10)
        score_loser = random.randint(0, score_winner - 1)
        duration = random.randint(60, 600)

        GameResult.objects.create(
            game=game,
            winner=winner,
            loser=loser,
            score_winner=score_winner,
            score_loser=score_loser,
            duration=duration
        )

# Crear 3 torneos de prueba
if Tournament.objects.count() < 3:
    for i in range(1, 4):
        tournament_name = f"Torneo_Test_{i}"
        if not Tournament.objects.filter(name=tournament_name).exists():
            creator = random.choice(users)
            tournament = Tournament.objects.create(
                creator=creator,
                name=tournament_name,
                status="finalizado",
                max_participants=8
            )

            participants = random.sample(users, 8)
            for user in participants:
                tournament.participants.add(user)

            round_players = participants
            while len(round_players) > 1:
                next_round = []
                random.shuffle(round_players)

                for j in range(0, len(round_players), 2):
                    if j + 1 < len(round_players):
                        player1, player2 = round_players[j], round_players[j + 1]
                        game = Game.objects.create(player1=player1, player2=player2, status="finalizado", tournament=tournament)

                        winner, loser = (player1, player2) if random.choice([True, False]) else (player2, player1)
                        score_winner = random.randint(5, 10)
                        score_loser = random.randint(0, score_winner - 1)
                        duration = random.randint(60, 600)

                        GameResult.objects.create(
                            game=game,
                            winner=winner,
                            loser=loser,
                            score_winner=score_winner,
                            score_loser=score_loser,
                            duration=duration
                        )

                        next_round.append(winner)

                round_players = next_round

            if round_players:
                tournament.winner = round_players[0]
                tournament.save()

print("✔ Datos de prueba generados.")
