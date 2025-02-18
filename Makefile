# Definir directorio de archivos Docker
SRC_DIR := .

.PHONY: all up down clean fclean re purgedb purgeall debug

all: up

debug: crt.pem
	DEBUG=true docker-compose -f $(SRC_DIR)/docker-compose.yml --env-file .env up --build

up: crt.pem
	docker-compose -f $(SRC_DIR)/docker-compose.yml --env-file .env up --build -d

crt.pem: key.pem
	openssl req -x509 -key $< -out $@ -subj "/C=ES/ST=Catalunya/O=PINGpongMOJOdojoCASAhouse/"

key.pem:
	openssl genrsa -out $@
		
down:
	docker-compose -f $(SRC_DIR)/docker-compose.yml --env-file .env down

stop:
	docker-compose -f $(SRC_DIR)/docker-compose.yml --env-file .env stop

clean:
	docker-compose -f $(SRC_DIR)/docker-compose.yml --env-file .env down --remove-orphans

fclean: purgeall clean

re: fclean up

purgedb:
	docker-compose run --rm db sh -c "rm -vrf /var/lib/postgresql/data"

purgestatic:
	docker-compose run --rm web sh -c "rm -vrf /app/static"

purgenodemodules:
	docker-compose run --rm web sh -c "rm -vrf /app/node_modules"

purgeall: purgestatic purgenodemodules
	docker-compose run --rm web sh -c "rm -vrf /app/node_modules /app/static"
