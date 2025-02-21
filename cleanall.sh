sudo docker stop $(docker ps -aq) 2>/dev/null && \
sudo docker rm $(docker ps -aq) 2>/dev/null && \
sudo docker rmi $(docker images -q) -f 2>/dev/null && \
sudo docker volume rm $(docker volume ls -q) 2>/dev/null && \
sudo docker network prune -f && \
sudo docker system prune -af --volumes