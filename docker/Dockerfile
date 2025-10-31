FROM nginx:latest

# Instala OpenSSH y sudo
RUN apt-get update && \
    apt-get install -y openssh-server sudo && \
    mkdir -p /var/run/sshd

# Crea usuario para SSH
RUN useradd -m devuser && echo "devuser:devpass" | chpasswd && \
    usermod -aG sudo devuser

# Otorga permisos de escritura al usuario sobre la carpeta web
RUN chown -R devuser:devuser /usr/share/nginx/html && \
    chmod -R 775 /usr/share/nginx/html

# Configura SSH para permitir acceso por contraseña
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Expone puertos web y SSH
EXPOSE 80 22

# Inicia SSH y Nginx
CMD ["/bin/bash", "-c", "service ssh start && nginx -g 'daemon off;'"]
