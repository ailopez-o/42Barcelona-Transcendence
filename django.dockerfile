FROM python:3.12-alpine

ENV PYTHONUNBUFFERED 1
WORKDIR /usr/app/

RUN pip install --upgrade pip
RUN pip install --no-cache-dir django


COPY requirements.txt ./requirements.txt
COPY django-entrypoint.sh /usr/app/django-entrypoint.sh

# Asegurar permisos de ejecución
RUN chmod 777 /usr/app/django-entrypoint.sh

EXPOSE 80
EXPOSE 443

# Definir un entrypoint por defecto
ENTRYPOINT ["./django-entrypoint.sh"]

#ENTRYPOINT ["tail", "-f", "/dev/null"]



