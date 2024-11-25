#!/bin/bash

echo "Deteniendo todos los contenedores en ejecución..."
docker stop $(docker ps -q)

echo "Eliminando todos los contenedores..."
docker rm -f $(docker ps -aq)

echo "Eliminando todas las imágenes..."
docker rmi -f $(docker images -q)

echo "Eliminando todos los volúmenes..."
docker volume rm -f $(docker volume ls -q)

echo "Eliminando todas las redes no utilizadas..."
docker network prune -f

echo "Limpiando el sistema de datos huérfanos..."
docker system prune -af

echo "Docker limpio. Todo ha sido eliminado."
