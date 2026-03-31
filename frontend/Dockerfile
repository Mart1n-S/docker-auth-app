# Utilisation de l'image officielle sécurisée (non-root)
FROM nginxinc/nginx-unprivileged:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

# On expose le port 8080 au lieu du 80
EXPOSE 8080