# 🔐 Auth App - Node.js + JWT + MongoDB + Docker + Kubernetes

Projet dans le cadre du cours clusteurisation de conteneurs
Application d'authentification complète conteneurisée avec Docker Compose, déployée sur un cluster Kubernetes Infomaniak.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│    Frontend      │─────▶│     Backend      │─────▶│   MongoDB   │
│ (Nginx:80)       │      │ (Express:3000)   │      │  (:27017)   │
│ Three.js 3D UI   │      │ JWT Auth API     │      │             │
└─────────────────┘      └──────────────────┘      └─────────────┘
   LoadBalancer             ClusterIP                 ClusterIP
   IP publique              Interne                   Interne
```

## Stack technique

| Service  | Technologie                    | Rôle                              |
| -------- | ------------------------------ | --------------------------------- |
| Frontend | HTML/CSS/JS + Three.js + Nginx | SPA avec scène 3D et routing      |
| Backend  | Node.js + Express              | API REST + authentification JWT   |
| BDD      | MongoDB 7                      | Stockage des utilisateurs         |
| Infra    | Docker + Kubernetes            | Conteneurisation et orchestration |

## Frontend 3D

Le frontend intègre une scène **Three.js** interactive sur la page d'accueil :

- Torus knot métallique avec matériau PBR (metalness, roughness, emissive)
- Wireframe translucide superposé
- Deux anneaux orbitaux néon (cyan + magenta)
- 150 particules 3D flottantes
- Suivi de la souris pour rotation interactive
- Lumières dynamiques qui orbitent autour de la scène
- 25 particules CSS supplémentaires avec animations staggerées
- Esthétique cyberpunk : grille de fond, grain overlay, glow orbs

## Lancer en local (Docker Compose)

```bash
docker-compose up --build
```

L'app est accessible sur **http://localhost:8080**

## Déployer sur Kubernetes

### Prérequis

- `kubectl` installé
- Un cluster Kubernetes (ici Infomaniak)
- Le fichier kubeconfig configuré :

```powershell
$env:KUBECONFIG="chemin/vers/votre-kubeconfig"
```

### Déploiement rapide (images déjà sur Docker Hub)

Les images sont publiques sur Docker Hub. Il suffit d'appliquer les manifestes :

```bash
kubectl apply -f k8s/01-mongo.yaml --validate=false
kubectl apply -f k8s/02-backend.yaml --validate=false
kubectl apply -f k8s/03-frontend.yaml --validate=false
```

### Vérifier le déploiement

```bash
kubectl get pods
kubectl get services
```

Le service `authapp-frontend` de type `LoadBalancer` expose une IP publique (1-3 min de provisioning).

### Build et push des images (développeur uniquement)

Uniquement nécessaire si vous modifiez le code source et souhaitez mettre à jour les images :

```bash
docker build -t mart1nsmn/authapp-backend:latest ./backend
docker build -t mart1nsmn/authapp-frontend:latest ./frontend
docker push mart1nsmn/authapp-backend:latest
docker push mart1nsmn/authapp-frontend:latest
```

## Mettre à jour l'application (développeur)

```bash
# Rebuild et push l'image modifiée
docker build -t mart1nsmn/authapp-backend:latest ./backend
docker push mart1nsmn/authapp-backend:latest

# OU pour le frontend
docker build -t mart1nsmn/authapp-frontend:latest ./frontend
docker push mart1nsmn/authapp-frontend:latest

# Redémarrer le pod pour puller la nouvelle image
kubectl rollout restart deployment authapp-backend
kubectl rollout restart deployment authapp-frontend
```

## Supprimer le déploiement

```bash
kubectl delete -f k8s/03-frontend.yaml
kubectl delete -f k8s/02-backend.yaml
kubectl delete -f k8s/01-mongo.yaml
```

## API Endpoints

| Méthode | Route              | Auth ? | Description       |
| ------- | ------------------ | ------ | ----------------- |
| POST    | /api/auth/register | Non    | Inscription       |
| POST    | /api/auth/login    | Non    | Connexion         |
| GET     | /api/auth/me       | Oui 🔒  | Infos utilisateur |
| GET     | /api/health        | Non    | Health check      |

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
├── k8s/
│   ├── 01-mongo.yaml          # Deployment + Service MongoDB
│   ├── 02-backend.yaml        # Deployment + Service Backend
│   └── 03-frontend.yaml       # Deployment + Service LoadBalancer
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── models/
│   │   └── User.js            # Schéma Mongoose + hash bcrypt
│   ├── middleware/
│   │   └── auth.js            # Vérification JWT
│   └── routes/
│       └── auth.js            # Routes register / login / me
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # Proxy /api/ → backend K8s
    └── public/
        └── index.html          # SPA + Three.js 3D
```

## Commandes utiles

```bash
# === Docker Compose (local) ===
docker-compose up --build -d
docker-compose logs -f
docker-compose down
docker-compose down -v            # + supprime les données

# === Kubernetes ===
kubectl get pods                  # État des pods
kubectl get services              # IP externe
kubectl logs -f <nom-du-pod>      # Logs d'un pod
kubectl describe pod <nom-du-pod> # Debug un pod
kubectl rollout restart deployment authapp-frontend  # Redéployer

# === Tester l'API ===
curl -X POST http://<IP>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```