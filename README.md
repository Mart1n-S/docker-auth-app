# 🔐 Auth App — Node.js + JWT + MongoDB + Docker

Application d'authentification complète conteneurisée avec Docker Compose.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend   │────▶│   MongoDB   │
│  (Nginx:80)  │     │(Express:3000)│    │   (:27017)  │
└─────────────┘     └─────────────┘     └─────────────┘
    Port 8080           Port 3000          Volume persisté
```

## Stack technique

| Service  | Technologie         | Rôle                        |
|----------|--------------------|-----------------------------|
| Frontend | HTML/CSS/JS + Nginx| SPA avec routing client     |
| Backend  | Node.js + Express  | API REST + JWT              |
| BDD      | MongoDB 7          | Stockage des utilisateurs   |

## Lancer le projet

```bash
# Cloner ou copier le dossier, puis :
docker-compose up --build
```

L'app est accessible sur **http://localhost:8080**

## API Endpoints

| Méthode | Route              | Auth ?  | Description           |
|---------|--------------------|---------|-----------------------|
| POST    | /api/auth/register | Non     | Inscription           |
| POST    | /api/auth/login    | Non     | Connexion             |
| GET     | /api/auth/me       | Oui 🔒 | Infos utilisateur     |
| GET     | /api/health        | Non     | Health check          |

## Fonctionnement JWT

1. L'utilisateur s'inscrit ou se connecte
2. Le serveur renvoie un **token JWT** signé (expire en 24h)
3. Le frontend stocke le token dans `localStorage`
4. Les requêtes protégées envoient le header : `Authorization: Bearer <token>`
5. Le middleware `auth.js` vérifie et décode le token

## Structure du projet

```
docker-auth-app/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── models/
│   │   └── User.js          # Schéma Mongoose + hash bcrypt
│   ├── middleware/
│   │   └── auth.js           # Vérification JWT
│   └── routes/
│       └── auth.js           # Routes register / login / me
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # Proxy /api/ → backend
    └── public/
        └── index.html        # SPA complète
```

## Commandes utiles

```bash
# Démarrer
docker-compose up --build -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Arrêter et supprimer les données
docker-compose down -v

# Tester l'API avec curl
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```
