#!/bin/sh

# Cambiar al directorio donde se encuentra manage.py
cd transcendence

# Create virtual environment and install dependencies
# python3 -m venv .venv
# source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r ../requirements.txt

# Collect static files and apply migrations
python3 ./manage.py collectstatic --noinput
python3 ./manage.py makemigrations app --noinput
python3 ./manage.py migrate

# Create 'alba' and 'aitor' superusers if they don't exist
python3 ./manage.py shell <<EOF
from app.models import User, Game, GameResult
import random

if not User.objects.filter(username="admin").exists():
    User.objects.create_superuser(username="admin", password="123456", email="admin@example.com", display_name="Admin")

if not User.objects.filter(username="alba").exists():
    User.objects.create_superuser(username="alba", password="123456", email="alba@example.com", display_name="Alba")

if not User.objects.filter(username="aitor").exists():
    User.objects.create_superuser(username="aitor", password="123456", email="aitor@example.com", display_name="Aitor")

# Crear 50 usuarios regulares: user1, user2, ..., user50
for i in range(1, 51):
    username = f"user{i}"
    if not User.objects.filter(username=username).exists():
        User.objects.create_user(username=username, password="password", email=f"{username}@example.com", display_name=f"User_{i}")

        # Crear al menos 10 partidas aleatorias si no existen

# Obtener lista de usuarios
users = list(User.objects.all())

if Game.objects.count() < 10:
    for _ in range(10 - Game.objects.count()):
        player1, player2 = random.sample(users, 2)  # Selecciona 2 usuarios aleatorios
        game = Game.objects.create(player1=player1, player2=player2, status="finalizado")

        #Generar resultado aleatorio
        winner, loser = (player1, player2) if random.choice([True, False]) else (player2, player1)
        score_winner = random.randint(5, 10)  # Puntuación aleatoria
        score_loser = random.randint(0, score_winner - 1)
        duration = random.randint(60, 600)  # Duración entre 1 y 10 minutos

        GameResult.objects.create(
            game=game,
            winner=winner,
            loser=loser,
            score_winner=score_winner,
            score_loser=score_loser,
            duration=duration
        )

EOF


#En fase de desarrollo para poder recargar en caliente
watchmedo auto-restart --recursive --pattern="*.py" -- daphne -b 0.0.0.0 -p 80 mysite.asgi:application

#daphne -b 0.0.0.0 -p 80 mysite.asgi:application


#python3 ./transcendence/manage.py runserver '0.0.0.0:80'

# Run server or Daphne depending on the DEBUG environment variable
# if test "$DEBUG" = "true"
# then
#     python3 manage.py runserver '0.0.0.0:80' &
#     python3 manage.py runsslserver '0.0.0.0:443'
# else
#     daphne -e ssl:443:privateKey=key.pem:certKey=crt.pem transcendence.asgi:application -b '0.0.0.0' -p 80
# fi