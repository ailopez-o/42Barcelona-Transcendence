from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth import get_user_model
from .models import Game, Tournament
from django.http import JsonResponse

# Obtener el modelo de usuario configurado en AUTH_USER_MODEL
User = get_user_model()

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ['username', 'password1', 'password2']

# Vista para login
def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('profile')
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})

# Vista para registro
def register_view(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('profile')
    else:
        form = CustomUserCreationForm()
    return render(request, 'register.html', {'form': form})

# Vista del perfil del usuario
@login_required
def profile_view(request):
    user = request.user
    games = Game.objects.filter(player1=user) | Game.objects.filter(player2=user)
    pending_games = Game.objects.filter(player2=user, status="pendiente")

    return render(request, 'profile.html', {
        'user': user,
        'games': games,
        'pending_games': pending_games
    })


# Vista para crear una nueva partida
@login_required
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
        return redirect('game_detail', game_id=game.id)
    
    users = User.objects.exclude(id=request.user.id)
    return render(request, 'game.html', {'users': users})

# Vista para el detalle de una partida
@login_required
def game_detail_view(request, game_id):
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        # Aquí renderizas una página personalizada, por ejemplo "game_not_found.html"
        return render(request, "game_not_found.html", {"game_id": game_id}, status=404)
    
    # Si el juego existe, continúas con la lógica normal
    return render(request, "game_detail.html", {"game": game})

# Vista para crear un nuevo torneo
@login_required
def new_tournament_view(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        participants_ids = request.POST.getlist('participants')
        participants = User.objects.filter(id__in=participants_ids)

        tournament = Tournament.objects.create(
            name=name,
            created_by=request.user
        )
        tournament.participants.set(participants)
        return redirect('tournament_detail', tournament_id=tournament.id)

    users = User.objects.exclude(id=request.user.id)
    return render(request, 'tournament.html', {'users': users})

# Vista para el detalle de un torneo
@login_required
def tournament_detail_view(request, tournament_id):
    tournament = get_object_or_404(Tournament, id=tournament_id)
    return render(request, 'tournament_detail.html', {'tournament': tournament})

@login_required
def accept_game_view(request, game_id):
    game = get_object_or_404(Game, id=game_id, player2=request.user, status="pendiente")
    game.status = "en_curso"
    game.save()
    return redirect('game_detail', game_id=game.id)

@login_required
def reject_game_view(request, game_id):
    game = get_object_or_404(Game, id=game_id, player2=request.user, status="pendiente")
    game.status = "cancelado"
    game.save()
    return redirect('profile')

@login_required
def global_chat_view(request):
    return render(request, "global_chat.html")

@login_required
def users_list_view(request):
    users = User.objects.all()  # O aplica filtros según necesites
    return render(request, "users.html", {"users": users})
