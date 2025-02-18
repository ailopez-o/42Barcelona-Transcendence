FROM python:3.12-alpine3.20

ENV PYTHONUNBUFFERED 1
WORKDIR /usr/app/

COPY requirements.txt ./requirements.txt
COPY django-entrypoint.sh /usr/app/django-entrypoint.sh

# Asegurar permisos de ejecución
RUN chmod +x /usr/app/django-entrypoint.sh

EXPOSE 80
EXPOSE 443

# Definir un entrypoint por defecto
ENTRYPOINT ["./django-entrypoint.sh"]

#ENTRYPOINT ["tail", "-f", "/dev/null"]

