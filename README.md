# 🔐 Auth App - Déploiement Kubernetes & Haute Disponibilité

Projet réalisé dans le cadre du cours de **Clusterisation de conteneurs**.
Ce dépôt présente une application web (Node.js/Three.js) conteneurisée et déployée sur un cluster Kubernetes (Infomaniak) avec une architecture de base de données MongoDB hautement disponible.

## 🏗️ Architecture Kubernetes

L'infrastructure a été pensée pour la résilience et la sécurité, en utilisant les concepts avancés de Kubernetes :



* **Base de données (MongoDB - StatefulSet) :** Au lieu d'un simple Deployment, Mongo tourne sur un **StatefulSet** (3 réplicas). Cela garantit une identité réseau stable (`mongo-0`, `mongo-1`, `mongo-2`) et attache un volume persistant (PVC) unique à chaque pod. Un **Headless Service** (`ClusterIP: None`) gère le réseau interne. Les 3 instances forment un **ReplicaSet MongoDB** (1 Primary, 2 Secondary) pour la tolérance aux pannes.
* **Backend (Node.js/Express - Deployment) :** Déployé avec un Replica géré par un Deployment. Il est exposé uniquement à l'intérieur du cluster via un service **ClusterIP** pour des raisons de sécurité. Il se connecte au ReplicaSet Mongo via une URI multiple.
* **Frontend (Nginx/Three.js - Deployment) :** Déployé en tant que Deployment, exposé à l'intérieur du cluster via un service **ClusterIP**. Le trafic public passe par l'Ingress Controller qui route vers ce service.

* **Ingress Controller (ingress-nginx) :** Point d'entrée unique du cluster, installé via Helm. Route les requêtes `/api/*` vers le backend et `/` vers le frontend sur une seule IP publique.

---

## ☁️ Préparation de l'infrastructure (Infomaniak)

Pour héberger ce cluster, nous utilisons l'offre Cloud Computing d'Infomaniak. Voici les étapes détaillées pour recréer l'environnement de zéro :

### 1. Création du compte et du service
* Créez un compte sur le site d'Infomaniak.
* Souscrivez à l'offre **Cloud Computing** (qui propose une offre d'essai ou une facturation à l'usage très accessible pour les étudiants).
* Suivez les étapes, notamment la validation du numéro de téléphone et finalisez votre inscription en choisissant uniquement les options gratuites (à date du 31/03/2026 il y a une offre d'essai **300,00 € offerts pour découvrir notre Public Cloud !**).

<img src=".github/images/etape1.png" width="500"/>

### 2. Création du cluster Kubernetes
* Dans votre interface Cloud Computing, naviguez vers la section **Kubernetes** dans le menu.
* Cliquez sur **Créer un cluster**.
* Choisissez l'option pour créer un cluster **vide** (sans nœuds pré-alloués). Le plan de contrôle (Control Plane) de ce cluster est gratuit.

<img src=".github/images/etape2.png" width="500"/>
<img src=".github/images/etape3.png" width="500"/>

* Sélectionnez le produit et le projet auquel vous souhaitez ajouter un cluster, ou créez-en un nouveau.
  
<img src=".github/images/etape4.png" width="300"/>
<img src=".github/images/etape5.png" width="300"/>

<img src=".github/images/etape6.png" width="500"/>
<img src=".github/images/etape7.png" width="500"/>

* Après la validation, le projet sera créé en quelques minutes. Vous verrez son statut passer de *Provisioning* à *Running*.
* Ensuite cliquez sur votre projet pour accéder à son tableau de bord de gestion.


<img src=".github/images/etape8.png" width="500"/>

* Dans le tableau de bord crée un nouveau cluster Kubernetes.

<img src=".github/images/etape9.png" width="500"/>

* Choisissez un cluster mutualisé pour ce projet étudiant, qui est plus économique.

<img src=".github/images/etape10.png" width="500"/>
<img src=".github/images/etape11.png" width="500"/>

* Après validation, le cluster sera créé en quelques minutes. Vous verrez son statut passer de *Provisioning* à *Running*.

* Téléchargez le fichier de configuration **kubeconfig** fourni par Infomaniak. Ce fichier est votre clé d'accès pour interagir avec le cluster via `kubectl`.

<img src=".github/images/etape12.png" width="500"/>

* Une fois le cluster prêt, cliquez sur le cluster pour accéder à son tableau de bord de gestion. C'est ici que vous pourrez ajouter un groupe d'instances pour faire tourner vos applications.

<img src=".github/images/etape13.png" width="500"/>
<img src=".github/images/etape14.png" width="500"/>

* Sélectionnez le type d'instance le moins cher pour ce projet étudiant (ex: `a1-ram2-disk20-perf1`) et configurez le nombre d'instances à 1 et en manuelle.

<img src=".github/images/etape15.png" width="500"/>
<img src=".github/images/etape16.png" width="500"/>

### 3. Récupération des accès (Kubeconfig)
* Une fois le cluster créé, repérez l'option pour télécharger le fichier de configuration **kubeconfig** fourni par Infomaniak. Ce fichier est votre clé d'accès.
* Liez ce fichier à votre outil en ligne de commande local (`kubectl`) :
  ```powershell
  # Sur Windows (PowerShell)
  $env:KUBECONFIG="chemin/vers/votre/fichier-kubeconfig"
  ```

<img src=".github/images/etape12.png" width="500"/>

### 4. Création d'une instance (Nœud Worker)
Kubernetes a maintenant besoin d'une machine physique/virtuelle pour faire tourner les conteneurs.
* Allez dans les paramètres de votre cluster et créez un nouveau groupe d'instances.
* **Nom :** Donnez un nom explicite à votre nœud (ex: `instance-worker-1`).
* **Gabarit (Type) :** Choisissez l'instance la moins chère pour ce projet étudiant (ex: `a1-ram2-disk20-perf1`).
* **Gestion des instances :** Sélectionnez la configuration **Manuelle**.
* **Nombre d'instances :** Réglez le curseur sur **1**.
* Validez. Infomaniak va afficher le statut *Ajustement des instances* (voir capture). Une fois l'instance active, votre nœud apparaîtra dans `kubectl get nodes` au statut `Ready`.

<img src=".github/images/etape13.png" width="500"/>
<img src=".github/images/etape14.png" width="500"/>
<img src=".github/images/etape15.png" width="500"/>
<img src=".github/images/etape16.png" width="500"/>

---

## 🚀 Guide de déploiement (Kubernetes)

### 1. Prérequis
* `kubectl` installé sur votre machine.
* Un cluster Kubernetes opérationnel.
* Le fichier kubeconfig configuré :
    ```powershell
    $env:KUBECONFIG="chemin/vers/votre-kubeconfig"
    ```

### 2. Configuration des Secrets (Sécurité)
Pour ne pas exposer de données sensibles en clair dans nos fichiers de configuration, nous utilisons un objet Kubernetes `Secret`.
Créez un fichier `k8s/00-secrets.yaml` (⚠️ **à ajouter à votre `.gitignore`, ne jamais le commiter**) basé sur ce modèle :
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
type: Opaque
stringData: 
  # Renseignez ici votre clé secrète générée (ex: avec openssl rand -base64 62)
  JWT_SECRET: "colle_ta_chaine_openssl_ici"
  MONGO_URI: "mongodb://mongo-0.mongo:27017,mongo-1.mongo:27017,mongo-2.mongo:27017/authdb?replicaSet=rs0"
```
Appliquez-le sur le cluster :
```bash
kubectl apply -f k8s/00-secrets.yaml
```

### 3. Déploiement de la base de données (StatefulSet)
On déploie ensuite le StatefulSet et le Headless Service MongoDB :
```bash
kubectl apply -f k8s/01-mongo.yaml
```
Attendez que les 3 pods (`mongo-0`, `mongo-1`, `mongo-2`) soient au statut `Running` vérifiable avec :
```bash
kubectl get pods -w
```

### 4. Initialisation du ReplicaSet MongoDB (Étape cruciale)
Une fois les 3 pods lancés, il faut indiquer à MongoDB de former un cluster (élection du PRIMARY). Exécutez cette commande pour l'initialiser depuis `mongo-0` :
```bash
kubectl exec -it mongo-0 -- mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo-0.mongo:27017'}, {_id: 1, host: 'mongo-1.mongo:27017'}, {_id: 2, host: 'mongo-2.mongo:27017'}]})"
```
Vous pouvez vérifier l'état de l'élection avec la commande suivante, **n'hésitez pas à la relancer plusieurs fois pour voir les changements de rôle (PRIMARY/SECONDARY)** :
```bash
kubectl exec -it mongo-0 -- mongosh --eval "rs.status().members.map(m => m.name + ' : ' + m.stateStr)"
```

### 5. Déploiement des applications (Backend & Frontend)
Une fois la BDD prête à recevoir des connexions et les secrets configurés :
```bash
kubectl apply -f k8s/02-backend.yaml
kubectl apply -f k8s/03-frontend.yaml
```

### 6. Installation de l'Ingress Controller
Le cluster nécessite un Ingress Controller pour exposer les applications. Installez ingress-nginx via Helm :
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.resources.requests.cpu=50m \
  --set controller.resources.requests.memory=64Mi
```
Attendez l'IP externe :
```bash
kubectl get service ingress-nginx-controller -n ingress-nginx -w
```

### 7. Déploiement de l'Ingress
```bash
kubectl apply -f k8s/04-ingress.yaml
```

### 8. Accès à l'application
L'application est accessible via l'IP externe de l'Ingress Controller :
```bash
kubectl get service ingress-nginx-controller -n ingress-nginx
```
Ouvrez `http://<EXTERNAL-IP>` dans votre navigateur.

---

## 🧪 Tester la résilience (Haute Disponibilité)

Pour prouver l'efficacité du cluster, vous pouvez simuler la perte de l'instance MongoDB principale :
1. Identifiez le pod PRIMARY (souvent `mongo-0`).
2. Détruisez-le : `kubectl delete pod mongo-0`
3. Constatez l'auto-guérison : `kubectl get pods -w` (Kubernetes recrée le pod immédiatement).
4. Le trafic est redirigé vers le nouveau PRIMARY élu, sans interruption de l'application web.

---

## ⚖️ Mise à l'échelle (Scaling) & Load Balancing

Pour prouver que l'architecture est capable d'encaisser une forte montée en charge, nous pouvons multiplier le nombre de conteneurs (pods) à la volée et observer Kubernetes répartir le trafic équitablement entre eux.

### 1. Augmenter le nombre de réplicas
Nous allons passer le backend et le frontend à 3 réplicas chacun avec la commande impérative `scale` :
```bash
kubectl scale deployment authapp-backend --replicas=3
kubectl scale deployment authapp-frontend --replicas=3
```
*(Vous pouvez vérifier la création des nouveaux pods avec `kubectl get pods`)*

### 2. Observer la répartition de charge en direct
Pour voir le trafic arriver sur les différents pods en temps réel, nous utilisons la lecture des logs avec des filtres spécifiques. 

**Pour observer le Backend (Node.js) :**
```bash
kubectl logs -f -l app=authapp-backend --prefix
```
**Pour observer le Frontend (Nginx) :**
```bash
kubectl logs -f -l app=authapp-frontend --prefix
```

**Explication des paramètres magiques :**
* `-f` : (Follow) Permet de garder le flux de logs ouvert en direct.
* `-l app=authapp-backend` : (Label) Cible simultanément tous les pods qui partagent cette étiquette, peu importe leur nombre.
* `--prefix` : Ajoute le nom exact du pod au début de chaque ligne de log.

### 3. Résultat attendu
Générez du trafic en naviguant sur l'application web ou en rafraîchissant la page. Dans votre terminal, vous verrez les requêtes s'afficher avec des préfixes différents, prouvant que le Service Kubernetes agit comme un aiguilleur parfait :
```text
[pod/authapp-backend-8cfc...-7v6gr] Requête reçue : POST /api/auth/login
[pod/authapp-backend-8cfc...-x2qw4] Requête reçue : POST /api/auth/register
[pod/authapp-backend-8cfc...-j88dt] Requête reçue : GET /api/auth/me
```

### 4. Retour à la configuration initiale (Scale down)
Une fois le test terminé, pour économiser les ressources du cluster, ramenez les déploiements à 1 seul réplica :
```bash
kubectl scale deployment authapp-backend --replicas=1
kubectl scale deployment authapp-frontend --replicas=1
```

---

## 🧹 Nettoyage complet (Teardown)

Pour supprimer proprement toutes les ressources allouées par ce projet et éviter les frais d'infrastructure, exécutez les commandes suivantes dans l'ordre :

**0. Supprimer l'Ingress et le controller :**
```bash
kubectl delete -f k8s/04-ingress.yaml
helm uninstall ingress-nginx -n ingress-nginx
```

**1. Supprimer les pods, déploiements et services :**
```bash
kubectl delete -f k8s/03-frontend.yaml
kubectl delete -f k8s/02-backend.yaml
kubectl delete -f k8s/01-mongo.yaml
```

**2. Supprimer les volumes persistants (PVC) :**
*(Les volumes liés à un StatefulSet ne sont pas supprimés automatiquement par sécurité)*
```bash
kubectl delete pvc -l app=mongo
```

**3. Vérifier que tout est nettoyé :**
```bash
kubectl get all
kubectl get pvc
```
*(Seul le service `kubernetes` par défaut doit subsister).*

---

## 💻 Guide Développeur & Détails de l'application

### Lancer en local (Docker Compose)
Pour le développement local sans Kubernetes :
```bash
docker compose up -d
```
*L'app est accessible sur `http://localhost:8080`*

### Build et push des images
Si vous modifiez le code source, voici comment mettre à jour les images sur Docker Hub :
```bash
# Backend
docker build -t mart1nsmn/authapp-backend:latest ./backend
docker push mart1nsmn/authapp-backend:latest

# Frontend
docker build -t mart1nsmn/authapp-frontend:latest ./frontend
docker push mart1nsmn/authapp-frontend:latest

# Redémarrer les pods pour puller les nouvelles images
kubectl rollout restart deployment authapp-backend
kubectl rollout restart deployment authapp-frontend
```

### ⚙️ Pipeline CI/CD (GitHub Actions)

Chaque push sur `main` déclenche automatiquement le pipeline `.github/workflows/deploy.yml` :

| Stage      | Action                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **build**  | Build des images Docker backend et frontend, taguées avec le SHA du commit                                                                 |
| **deploy** | Apply des manifestes K8s dans l'ordre, mise à jour de l'image avec `kubectl set image`, attente de stabilité avec `kubectl rollout status` |

Les secrets nécessaires sont stockés dans GitHub Actions Secrets :
- `DOCKERHUB_USERNAME` — identifiant Docker Hub
- `DOCKERHUB_TOKEN` — token d'accès Docker Hub (jamais le mot de passe)
- `KUBECONFIG_B64` — contenu du kubeconfig encodé en base64


### 🔄 Rollback (Retour arrière)

En cas de bug introduit par une nouvelle version, Kubernetes conserve l'historique des déploiements et permet de revenir en arrière instantanément :
```bash
# Voir l'historique des déploiements
kubectl rollout history deployment/authapp-backend

# Revenir à la version précédente
kubectl rollout undo deployment/authapp-backend

# Vérifier que le rollback est stable
kubectl rollout status deployment/authapp-backend
```

*La stratégie `RollingUpdate` avec `maxSurge: 0` et `maxUnavailable: 1` a été choisie pour compatibilité avec un nœud unique (1 vCPU). Sur un cluster multi-nœuds de production, on utiliserait `maxSurge: 1` et `maxUnavailable: 0` pour un zéro downtime garanti.*

### 🔄 Mettre à jour les Secrets (Variables d'environnement)

Si vous modifiez les valeurs dans le fichier `k8s/00-secrets.yaml` (ex: rotation de la clé JWT ou changement d'URI de la base de données), les pods en cours d'exécution **ne mettront pas à jour** leurs variables d'environnement automatiquement. 

Il faut appliquer le nouveau secret puis forcer le redémarrage des pods du backend pour qu'ils lisent les nouvelles valeurs :

```bash
# 1. Mettre à jour le coffre-fort Kubernetes
kubectl apply -f k8s/00-secrets.yaml

# 2. Redémarrer le backend (Rolling Update sans coupure de service)
kubectl rollout restart deployment authapp-backend
```
*Kubernetes va créer de nouveaux pods avec les nouveaux secrets avant de détruire les anciens, garantissant ainsi une haute disponibilité.*

## 📈 Autoscaling

### Cluster Autoscaling (Infomaniak)

Le groupe d'instances est configuré en mode **Autoscaling** avec un minimum de 1 nœud et un maximum de 2.

<img src=".github/images/autoscaling-infomaniak.png" width="500"/>

Infomaniak surveille en permanence les pods en état `Pending` — c'est-à-dire des pods qui ne trouvent pas de nœud avec suffisamment de ressources pour démarrer. Quand cette situation se produit, un nouveau nœud est automatiquement provisionné pour les accueillir. À l'inverse, quand un nœud est sous-utilisé sur une période prolongée, il est supprimé pour réduire les coûts.

> **Note :** Le cluster autoscaling opère au niveau **infrastructure** (ajout/suppression de VMs). Il est complémentaire au HPA Kubernetes qui opère au niveau **applicatif** (ajout/suppression de pods). Les deux mécanismes fonctionnent en tandem : le HPA crée des pods supplémentaires sous charge, et si ces pods ne tiennent pas sur les nœuds existants, le cluster autoscaler provisionne de nouveaux nœuds pour les accueillir.
> 
### Stack technique
| Service  | Technologie                    | Rôle                                   |
| -------- | ------------------------------ | -------------------------------------- |
| Frontend | HTML/CSS/JS + Three.js + Nginx | SPA avec scène 3D et routing           |
| Backend  | Node.js + Express              | API REST + authentification JWT        |
| BDD      | MongoDB 7                      | Stockage des utilisateurs (ReplicaSet) |
| Infra    | Docker + Kubernetes            | Conteneurisation et orchestration      |

### Fonctionnement de l'authentification (JWT)
1. L'utilisateur s'inscrit ou se connecte.
2. Le serveur renvoie un **token JWT** signé (expire en 24h).
3. Le frontend stocke le token dans `localStorage`.
4. Les requêtes protégées envoient le header : `Authorization: Bearer <token>`.
5. Le middleware `auth.js` vérifie et décode le token.

> [!IMPORTANT]
> Pour les besoins de ce projet, nous avons choisi une approche simple de stockage du token en `localStorage`. En production, il est recommandé d'utiliser des **cookies HttpOnly** pour une meilleure sécurité contre les attaques XSS.


### API Endpoints
| Méthode | Route              | Auth ? | Description       |
| ------- | ------------------ | ------ | ----------------- |
| POST    | /api/auth/register | Non    | Inscription       |
| POST    | /api/auth/login    | Non    | Connexion         |
| GET     | /api/auth/me       | Oui 🔒  | Infos utilisateur |
| GET     | /api/health        | Non    | Health check      |

### Interface 3D (Frontend)
Le frontend intègre une scène **Three.js** interactive sur la page d'accueil pour un rendu cyberpunk : Torus knot métallique avec matériau PBR, wireframe translucide, anneaux orbitaux néon, particules flottantes, lumières dynamiques et suivi de la souris.
