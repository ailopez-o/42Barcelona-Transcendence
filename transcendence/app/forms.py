from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User  # Importamos el modelo de usuario personalizado

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(
        label="Correo Electrónico",
        required=True,
        widget=forms.EmailInput(attrs={"class": "form-control", "placeholder": "Tu correo electrónico"})
    )

    display_name = forms.CharField(
        label="Nombre Visible",
        required=True,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre a mostrar"})
    )

    avatar = forms.ImageField(
        label="Foto de Perfil",
        required=False,
        widget=forms.FileInput(attrs={"class": "form-control"})
    )

    class Meta:
        model = User
        fields = ["username", "email", "display_name", "avatar", "password1", "password2"]
        widgets = {
            "username": forms.TextInput(attrs={"class": "form-control", "placeholder": "Nombre de usuario"}),
            "password1": forms.PasswordInput(attrs={"class": "form-control", "placeholder": "Contraseña"}),
            "password2": forms.PasswordInput(attrs={"class": "form-control", "placeholder": "Repite la contraseña"}),
        }
