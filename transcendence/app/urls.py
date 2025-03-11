from django.urls import path
from django.contrib.auth.views import LogoutView
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
    path('', views.home_view, name='home'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),
    path('profile/', views.profile_view, name='profile'),
    path('game/new/', views.new_game_view, name='new_game'),
    path('game/<int:game_id>/', views.game_detail_view, name='game_detail'),
    path('game/save/', views.game_save_view, name='game_save'),
    path('game/list', views.games_list_view, name='game_list'),
    path('game/results/', views.game_results_list_view, name='game_results'),
    path('game/<int:game_id>/accept/', views.accept_game_view, name='accept_game'),
    path('game/<int:game_id>/reject/', views.reject_game_view, name='reject_game'),
    path('global_chat/', views.global_chat_view, name='global_chat'),
    path('users/', views.users_list_view, name='users'),
	path('test/', views.test_game_result_view, name='test_game_result'),
    path("login_42/", views.login_with_42, name="login_42"),
    path("oauth/callback/", views.oauth_callback, name="oauth_callback"),
	path("notifications/", views.notifications_view, name="notifications"),
    path("notifications/read/<int:notification_id>/", views.mark_notification_read, name="mark_notification_read"),
    path("tournaments/create/", views.create_tournament, name="create_tournament"),
    path("tournaments/", views.tournament_list, name="tournament_list"),
	path("tournaments/<int:tournament_id>/join/", views.join_tournament, name="join_tournament"),
    path("tournaments/<int:tournament_id>/leave/", views.leave_tournament, name="leave_tournament"),
    path("tournaments/create/", views.create_tournament, name="create_tournament"),
    path("tournaments/<int:tournament_id>/", views.tournament_detail, name="tournament_detail"),
]
