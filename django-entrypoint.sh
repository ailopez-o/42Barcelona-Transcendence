#!/bin/sh

# Create virtual environment and install dependencies
# python3 -m venv .venv
# source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Collect static files and apply migrations
#python3 ./transcendance/manage.py collectstatic --noinput
python3 ./transcendance/manage.py makemigrations app --noinput
python3 ./transcendance/manage.py migrate

# Create 'alba' and 'aitor' superusers if they don't exist
python3 ./transcendance/manage.py shell <<EOF
from app.models import User

if not User.objects.filter(username="alba").exists():
    User.objects.create_superuser(username="alba", password="123456", email="alba@example.com")

if not User.objects.filter(username="aitor").exists():
    User.objects.create_superuser(username="aitor", password="123456", email="aitor@example.com")
EOF


python3 ./transcendance/manage.py runserver '0.0.0.0:80'

# Run server or Daphne depending on the DEBUG environment variable
# if test "$DEBUG" = "true"
# then
#     python3 manage.py runserver '0.0.0.0:80' &
#     python3 manage.py runsslserver '0.0.0.0:443'
# else
#     daphne -e ssl:443:privateKey=key.pem:certKey=crt.pem transcendence.asgi:application -b '0.0.0.0' -p 80
# fi