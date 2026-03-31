FROM node:20-alpine

# Définir l'environnement en production
ENV NODE_ENV=production

WORKDIR /app

# Copier les fichiers avec les droits pour l'utilisateur "node"
COPY --chown=node:node package*.json ./

# On utilise install au lieu de ci, avec la syntaxe moderne
RUN npm install --omit=dev

# Copier le reste du code avec les bons droits
COPY --chown=node:node . .

# Basculer sur l'utilisateur non-root avant de démarrer l'application
USER node

EXPOSE 3000

CMD ["node", "server.js"]