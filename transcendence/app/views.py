from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings
from django.http import HttpResponse
from django.contrib.auth import logout
from django.http import JsonResponse
from django.db.models import Q
from django.shortcuts import redirect
from .forms import CustomUserCreationForm 
from .models import Game, Tournament, GameResult, Notification
import json
import requests
import urllib.parse
from django.utils.timezone import now
from .models import ChatRoom, ChatMessage
from django.contrib import messages
from django.http import HttpResponseForbidden
import logging
logger = logging.getLogger(__name__)

# Obtener el modelo de usuario configurado en AUTH_USER_MODEL
User = get_user_model()

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            logger.info(f"Usuario {user.username} logeado con credenciales.")
            if request.headers.get("HX-Request"):  # Si es HTMX, enviamos una redirección HTMX
                response = HttpResponse()
                response["HX-Redirect"] = "/profile/"  # Redirige a la vista de perfil sin recargar
                return response
            return redirect("profile")  # Si es una petición normal, redirige normalmente
    else:
        form = AuthenticationForm()

    if request.headers.get("HX-Request"):
        return render(request, "login.html", {"form": form})  # Si es HTMX, devuelve solo login.html
    else:
        return render(request, "base.html", {"content_template": "login.html", "form": form})  # Carga todo el layout

def home_view(request):
    if request.user.is_authenticated:
        if request.headers.get("HX-Request"):
            # Si es HTMX, usamos `HX-Location` para redirigir sin recargar la página completa
            response = HttpResponse()
            response["HX-Location"] = "/profile/"
            return response
        return redirect("profile")  # Redirección normal si no es HTMX
    else:
        if request.headers.get("HX-Request"):
            # Si es HTMX, usamos `HX-Location` para redirigir sin recargar la página completa
            response = HttpResponse()
            response["HX-Location"] = "/login/"
            return response
        return redirect("login")  # Redirección normal si no es HTMX

def logout_view(request):
    current_user = request.user
    logout(request)

    logger.info(f"Usuario {current_user.username} logout.")

    if request.headers.get("HX-Request"):  # Si es una petición HTMX
        response = HttpResponse()
        response["HX-Redirect"] = "/"  # Redirigir a la página inicial sin recargar toda la SPA
        return response

    return redirect("/")  # Redirección normal si no es HTMX

# Vista para registro
def register_view(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            login(request, user)
            if request.headers.get("HX-Request"):  # Si es HTMX, redirigimos al perfil sin recargar la página
                response = HttpResponse()
                response["HX-Redirect"] = "/profile/"
                return response
            return redirect('profile')  # Redirección normal si no es HTMX
    else:
        form = CustomUserCreationForm()

    if request.headers.get("HX-Request"):  # Si es HTMX, devolvemos solo el formulario
        return render(request, "register.html", {"form": form})
    else:  # Si es una carga normal, devolvemos base.html con register.html dentro
        return render(request, "base.html", {"content_template": "register.html", "form": form})


# Vista para el perfil de usuario
@login_required
def profile_view(request):
    user = request.user
    
    # Obtener todas las partidas donde el usuario participa
    all_games = Game.objects.filter(player1=user) | Game.objects.filter(player2=user)

    # Separar las partidas en categorías
    individual_games = all_games.filter(tournament__isnull=True)
    tournament_games = all_games.filter(tournament__isnull=False)
    finished_games = all_games.filter(status="finalizado")

    context = {
        'user': user,
        'individual_games': individual_games,
        'tournament_games': tournament_games,
        'finished_games': finished_games,
    }

    if request.headers.get("HX-Request"):  # Si la petición es de HTMX, devolvemos solo el contenido del perfil
        return render(request, "profile.html", context)
    else:  # Si es una carga normal, devolvemos base.html con el perfil embebido en content_template
        return render(request, "base.html", {"content_template": "profile.html", **context})


# Vista para crear una nueva partida
@login_required
def new_game_view(request):
    if request.method == 'POST':
        opponent_id = request.POST.get('opponent')
        opponent = get_object_or_404(User, id=opponent_id)
        difficulty = request.POST.get('difficulty', 'medio')
        points = request.POST.get('points', 10)
        paddle_color = request.POST.get('paddle_color', "#0000ff")
        ball_color = request.POST.get('ball_color', "#ff0000")

        game = Game.objects.create(
            player1=request.user,
            player2=opponent,
            difficulty=difficulty,
            points=points,
            paddle_color=paddle_color,
            ball_color=ball_color
        )

        context = {
            "game": game,
            "game_result": "",
            "player1_score": 0,
            "player2_score": 0,
        }

        # Si la solicitud es de HTMX, usar el encabezado HX-Location en lugar de JsonResponse
        if request.headers.get("HX-Request"):
            response = render(request, "game_detail.html", context)  # 🔥 Solo devuelve el fragmento
            response["HX-Push-Url"] = f"/game/{game.id}/"  # 🔥 HTMX actualiza la URL sin recargar
            return response
        
        # Redirección normal si no es HTMX
        return redirect("game_detail", game_id=game.id)  # Redirección normal si no es HTMX

    users = User.objects.exclude(id=request.user.id)

    if request.headers.get("HX-Request"):  # Petición HTMX, devolvemos solo el formulario
        return render(request, "game.html", {"users": users})
    else:  # Carga normal, devuelve base.html con el contenido de game.html
        return render(request, "base.html", {"content_template": "game.html", "users": users})

# Vista para el detalle de una partida
@login_required
def game_detail_view(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    # Intentar obtener el resultado de la partida (si existe, por lo tanto terminada)
    game_result = GameResult.objects.filter(game=game).first()

    # Determinar los puntajes finales
    if game_result:
        player1_score = game_result.score_winner if game_result.winner == game.player1 else game_result.score_loser
        player2_score = game_result.score_winner if game_result.winner == game.player2 else game_result.score_loser
    else:
        player1_score = 0
        player2_score = 0

    context = {
        "game": game,
        "game_result": game_result,
        "player1_score": player1_score,
        "player2_score": player2_score,
    }

    if request.headers.get("HX-Request"):
        return render(request, "game_detail.html", context)
    else:
        return render(request, "base.html", {"content_template": "game_detail.html", **context})

@csrf_exempt 
@login_required
def create_tournament(request):
    """Maneja la creación de un torneo con HTMX"""
    if request.method == "POST":
        name = request.POST.get("name")
        max_participants = request.POST.get("max_participants", 8)

        if not name:
            return HttpResponse("El nombre es obligatorio", status=400)

        # Convertimos el valor de max_participants a entero
        try:
            max_participants = int(max_participants)
        except ValueError:
            return HttpResponse("Número de participantes inválido", status=400)

        # Creamos el torneo
        tournament = Tournament.objects.create(
            creator=request.user,
            name=name,
            max_participants=max_participants,
            created_at=now()
        )

        # Devolvemos solo la tarjeta del nuevo torneo para HTMX
        return render(request, "tournaments/tournament_card.html", {"tournament": tournament, "user": request.user})

    # Si no es un POST, devolvemos el formulario vacío para HTMX
    return render(request, "tournaments/tournament_create_form.html")

@csrf_exempt 
@login_required
def delete_tournament(request, tournament_id):
    """Permite al creador eliminar un torneo si NO está en curso"""
    tournament = get_object_or_404(Tournament, id=tournament_id, creator=request.user)

    if tournament.status != "en_curso":  # Se puede eliminar en cualquier estado excepto "en_curso"
        tournament.delete()

        # Retornamos un HTML vacío para que HTMX elimine la card correctamente
        return HttpResponse("<!-- Eliminado -->", status=200)

    return HttpResponse("No puedes eliminar un torneo en curso.", status=403)

@login_required
def tournament_list(request):
    """Lista de todos los torneos con su información"""
    tournaments = Tournament.objects.all().order_by("-created_at")  # Ordenados por fecha de creación (más recientes primero)
    
    context = {
        "tournaments": tournaments
    }
    
    if request.headers.get("HX-Request"):  # Si es HTMX, devolvemos solo el formulario
        return render(request, "tournaments/tournament_list.html", context)
    else:  # Si es una carga normal, devolvemos base.html con tournament.html dentro
        return render(request, "base.html", {"content_template": "tournaments/tournament_list.html", **context})


@csrf_exempt 
@login_required
def join_tournament(request, tournament_id):
    """Permite a un usuario unirse a un torneo"""
    tournament = get_object_or_404(Tournament, id=tournament_id)

    if tournament.status == "inscripcion" and request.user not in tournament.participants.all():
        tournament.participants.add(request.user)

        # Verificar si el torneo está lleno y debe comenzar
        if tournament.is_full():
            tournament.start_tournament()

    return render(request, "tournaments/tournament_card.html", {"tournament": tournament, "user": request.user})

@csrf_exempt 
@login_required
def leave_tournament(request, tournament_id):
    """Permite a un usuario salir de un torneo si está en fase de inscripción"""
    tournament = get_object_or_404(Tournament, id=tournament_id)

    if tournament.status == "inscripcion" and request.user in tournament.participants.all():
        tournament.participants.remove(request.user)

    return render(request, "tournaments/tournament_card.html", {"tournament": tournament, "user": request.user})

@login_required
def tournament_detail(request, tournament_id):
    """Ver detalles del torneo"""
    tournament = get_object_or_404(Tournament, id=tournament_id)
    if request.headers.get("HX-Request"):  # Si es HTMX, devolvemos solo el formulario
        return render(request, "tournaments/tournament_detail.html", {"tournament": tournament})
    else:  # Si es una carga normal, devolvemos base.html con tournament.html dentro
        return render(request, "base.html", {"content_template": "tournaments/tournament_detail.html", "tournament": tournament})

@csrf_exempt  # En producción, usa CSRF correctamente
@login_required
def accept_game_view(request, game_id):
    """El usuario acepta la partida y es redirigido a la partida en curso."""
    game = get_object_or_404(Game, id=game_id, player2=request.user, status="pendiente")
    game.status = "en_curso"
    game.save()

    if request.headers.get("HX-Request"):  # Si la solicitud es HTMX
        response = HttpResponse()
        response["HX-Redirect"] = f"/game/{game.id}/"  # Redirigir a la vista de la partida
        return response

    return redirect("game_detail", game_id=game.id)  # Redirección normal para peticiones tradicionales


@csrf_exempt  # En producción, es mejor gestionar el CSRF correctamente.
@login_required
def reject_game_view(request, game_id):
    game = get_object_or_404(Game, id=game_id, player2=request.user, status="pendiente")
    game.status = "cancelado"
    game.save()

    if request.headers.get("HX-Request"):  # Si la petición es de HTMX
        return HttpResponse("")  # HTMX eliminará la fila de la tabla en el front
    else:
        return redirect("profile")  # Redirección normal si la petición no es HTMX


@login_required
def global_chat_view(request):
    if request.headers.get("HX-Request"):
        return render(request, "global_chat.html")
    else:  # Si es una carga normal, devolvemos base.html con global_chat.html dentro
        return render(request, "base.html", {"content_template": "global_chat.html"})


@login_required
def users_list_view(request):
    users = User.objects.all()

    context = {"users": users}

    if request.headers.get("HX-Request"):  # Si la petición es HTMX, solo devolvemos el contenido
        return render(request, "users.html", context)
    else:  # Si es una carga normal, devolvemos base.html con users.html dentro
        return render(request, "base.html", {"content_template": "users.html", **context})


@login_required
def game_results_list_view(request):
    results = GameResult.objects.select_related("game", "winner", "loser").order_by('-recorded_at')

    context = {"results": results}

    if request.headers.get("HX-Request"):  # Si la petición es HTMX, solo devolvemos el contenido
        return render(request, "game_results.html", context)
    else:  # Si es una carga normal, devolvemos base.html con game_results.html dentro
        return render(request, "base.html", {"content_template": "game_results.html", **context})


@login_required
def games_list_view(request):
    games = Game.objects.select_related("player1", "player2").order_by('-created_at')

    context = {"games": games}

    if request.headers.get("HX-Request"):  # Si la petición es HTMX, solo devolvemos el contenido
        return render(request, "game_list.html", context)
    else:  # Si es una carga normal, devolvemos base.html con game_list.html dentro
        return render(request, "base.html", {"content_template": "game_list.html", **context})



# {
#     "game_id": 123,
#     "winner_id": 5,
#     "loser_id": 7,
#     "score_winner": 5,
#     "score_loser": 3,
#     "duration": 120
# }


@csrf_exempt  # En producción, es mejor gestionar el CSRF correctamente.
@require_POST
def game_save_view(request):
    try:

        logger.info("Recibida solicitud POST en game_result_view")
        logger.info("Headers: %s", request.headers)
        logger.info("Body: %s", request.body)
        data = json.loads(request.body)

        # Extraer datos
        game_id = data.get("game_id")
        winner_id = data.get("winner_id")
        loser_id = data.get("loser_id")
        score_winner = data.get("score_winner")
        score_loser = data.get("score_loser")
        duration = data.get("duration")

        # Validar que no falten datos
        if not all([game_id, winner_id, loser_id, score_winner, score_loser, duration]):
            return JsonResponse({"status": "error", "message": "Faltan datos en la solicitud"}, status=400)

        # Obtener el juego manualmente para evitar que `get_object_or_404` devuelva HTML
        try:
            game = Game.objects.get(id=game_id)
        except ObjectDoesNotExist:
            return JsonResponse({"status": "error", "message": f"No se encontró el juego con id {game_id}"}, status=404)

        # Obtener los usuarios manualmente
        try:
            winner = User.objects.get(id=winner_id)
        except ObjectDoesNotExist:
            return JsonResponse({"status": "error", "message": f"No se encontró el usuario ganador con id {winner_id}"}, status=404)

        try:
            loser = User.objects.get(id=loser_id)
        except ObjectDoesNotExist:
            return JsonResponse({"status": "error", "message": f"No se encontró el usuario perdedor con id {loser_id}"}, status=404)

        # Crear o actualizar el resultado de la partida
        result, created = GameResult.objects.update_or_create(
            game=game,
            defaults={
                "winner": winner,
                "loser": loser,
                "score_winner": score_winner,
                "score_loser": score_loser,
                "duration": duration,
            }
        )

        game.status = "finalizado"
        game.save()

        logger.info(f"¡Nueva partida guardada entre {game.player1} y {game.player2}! Ganador: {winner}")

        # Enviar notificación a todos los usuarios
        # Solo enviar notificación si fue la PRIMERA vez que se guardó el resultado
        if created:
            send_notification_to_all(f"¡Nueva partida terminada entre {game.player1} y {game.player2}! Ganador: {winner}")

        # Si el juego pertenece a un torneo, verificar si se debe avanzar a la siguiente ronda
        if game.tournament:
            logger.info(f"Llamando a check_next_round para el torneo: {game.tournament.name}")
            game.tournament.check_next_round()

        return JsonResponse({
            "status": "success",
            "message": "Resultado guardado correctamente",
            "created": created
        }, status=201 if created else 200)

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
    
def login_with_42(request):
    """Redirige al usuario a la plataforma de autenticación de 42."""
    
    # Definir los parámetros de la URL
    params = {
        "client_id": settings.OAUTH2_CLIENT_ID,
        "redirect_uri": settings.OAUTH2_REDIRECT_URI,
        "response_type": "code",
    }

    # Construir la URL correctamente codificada
    auth_url = f"{settings.OAUTH2_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    if request.headers.get("HX-Request"):  # Si la petición es HTMX
        response = HttpResponse()
        response["HX-Redirect"] = auth_url  # HTMX manejará la redirección sin recargar la página
        return response

    return redirect(auth_url)  # Redirección normal si no es HTMX


def oauth_callback(request):
    """Maneja la respuesta de 42 e intercambia el código por un token de acceso."""
    code = request.GET.get("code")
    if not code:
        return render(request, "error.html", {"message": "No se recibió el código de autorización"})

    # Petición para intercambiar el código por un token
    token_data = {
        "grant_type": "authorization_code",
        "client_id": settings.OAUTH2_CLIENT_ID,
        "client_secret": settings.OAUTH2_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.OAUTH2_REDIRECT_URI,
    }

    response = requests.post(settings.OAUTH2_TOKEN_URL, json=token_data)
    token_json = response.json()

    if "access_token" not in token_json:
        return render(request, "error.html", {"message": "Error obteniendo el token de acceso"})

    access_token = token_json["access_token"]

    # Obtener información del usuario autenticado
    headers = {"Authorization": f"Bearer {access_token}"}
    user_response = requests.get(settings.OAUTH2_USER_INFO_URL, headers=headers)
    user_data = user_response.json()

    if "id" not in user_data:
        return render(request, "error.html", {"message": "Error obteniendo la información del usuario"})

    # Crear o actualizar el usuario en la base de datos
    user, _ = User.objects.update_or_create(
        username=user_data["login"],  # Ajusta según la API
        defaults={
            "display_name": user_data.get("displayname"),
            # "intra_url": user_data.get("url"),
            "avatar": user_data.get("image", {}).get("versions", {}).get("medium"),
            "email": user_data.get("email"),
        }
    )

    # Autenticar al usuario en Django
    login(request, user)
    
    logger.info(f"Usuario {user.username} logeado con API 42.")

    # Manejar redirección según si la petición es HTMX o no
    if request.headers.get("HX-Request"):  # Si la petición es HTMX
        response = HttpResponse()
        response["HX-Redirect"] = "/profile/"
        return response

    return redirect("profile")  # Redirección normal si no es HTMX


@login_required
def notifications_view(request):
    notifications = Notification.objects.filter(user=request.user, seen=False).order_by('-created_at')

    if request.headers.get("HX-Request"):  # Si es HTMX, devuelve solo el HTML de las notificaciones
        return render(request, "notifications.html", {"notifications": notifications})

    return HttpResponse(status=204)  # No hay contenido si no es HTMX

@csrf_exempt  # En producción, es mejor gestionar el CSRF correctamente.
@login_required
def mark_notification_read(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, user=request.user)
    notification.seen = True
    notification.save()
    return HttpResponse("")  # HTMX eliminará la notificación sin recargar la página

def send_notification_to_all(message):
    """Crea una nueva notificación para todos los usuarios."""
    users = User.objects.all()  # Obtiene todos los usuarios registrados
    notifications = [Notification(user=user, message=message) for user in users]
    Notification.objects.bulk_create(notifications)  # Crea todas las notificaciones de una sola vez


def chat_history(request, room_name):
    room = get_object_or_404(ChatRoom, name=room_name)
    messages = ChatMessage.objects.filter(room=room).order_by("-timestamp")[:50]
    
    return JsonResponse({
        "messages": [
            {"user": msg.user.username, "message": msg.message, "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
            for msg in messages
        ]
    })

@csrf_exempt
@login_required
def delete_user(request, user_id):
    """Vista para eliminar usuarios con HTMX"""
    if not request.user.is_superuser:
        return HttpResponseForbidden("No tienes permisos para eliminar usuarios.")

    user = get_object_or_404(User, id=user_id)

    if user == request.user:
        messages.error(request, "No puedes eliminarte a ti mismo.")
    else:
        user.delete()
        messages.success(request, f"El usuario {user.username} ha sido eliminado con éxito.")

    # Obtener la lista de usuarios actualizada
    users = User.objects.all()

    # Si la solicitud viene de HTMX, recargar el contenedor principal
    if request.headers.get("HX-Request"):
        return render(request, "users.html", {"users": users})

    return redirect("users_list")



