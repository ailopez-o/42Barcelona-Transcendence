# Usa una imagen base de Python 
FROM python:3.11  

# Establece el directorio de trabajo dentro del contenedor 
WORKDIR /backend

# Copia los archivos de tu aplicación al contenedor 
RUN mkdir -p /backend
COPY . /backend
  
# Instala las dependencias desde requirements.txt 
RUN pip install --no-cache-dir -r requirements.txt  

EXPOSE 8080

# Define el comando predeterminado para ejecutar la aplicación 
#CMD ["python", "main.py"]

CMD ["tail", "-f", "/dev/null"]

