## 🌐 Exposition via Ingress Controller

### Pourquoi un Ingress plutôt qu'un LoadBalancer direct ?

Dans la version initiale, le frontend était exposé via un Service de type `LoadBalancer`, ce qui provisionne une IP publique dédiée directement sur le pod frontend. Cette approche fonctionne mais pose plusieurs problèmes :

- Chaque Service `LoadBalancer` consomme une IP publique — sur un vrai cluster de production avec 10 services, ça devient coûteux et ingérable.
- Le routage est basique : une IP = un service, impossible de router `/api` vers le backend et `/` vers le frontend sur la même IP.
- Pas de point d'entrée unifié pour gérer la sécurité, le TLS, ou les règles de routage.

Un **Ingress Controller** résout ces problèmes : c'est un reverse proxy (ici nginx) qui tourne dans le cluster, expose **une seule IP publique**, et route le trafic vers les bons services selon les règles définies dans les manifestes `Ingress`.

### Architecture après migration

```
Internet
    │
    ▼
http://37.156.41.80  (IP unique du LoadBalancer ingress-nginx)
    │
    ▼
┌─────────────────────────────┐
│   ingress-nginx-controller  │  ← installé via Helm
└─────────────┬───────────────┘
              │
      ┌───────┴────────┐
      │                │
   /api/*           /  (tout le reste)
      │                │
      ▼                ▼
 authapp-backend   authapp-frontend
 (ClusterIP:3000)  (ClusterIP:80)
```

### Ce qui a changé

| Avant                                | Après                                           |
| ------------------------------------ | ----------------------------------------------- |
| Service frontend : `LoadBalancer`    | Service frontend : `ClusterIP`                  |
| IP publique directe sur le frontend  | Plus d'IP publique sur les services applicatifs |
| Pas de routage par chemin            | `/api/*` → backend, `/` → frontend              |
| 2 IPs publiques (frontend + ingress) | 1 seule IP publique (ingress)                   |

### Fichiers concernés

- `k8s/03-frontend.yaml` — service passé de `LoadBalancer` à `ClusterIP`
- `k8s/04-ingress.yaml` — règles de routage Ingress

### Ce que tu dois savoir expliquer en soutenance

**Pourquoi `ingressClassName: nginx` ?** Parce que plusieurs Ingress Controllers peuvent coexister dans un cluster. Cette annotation dit explicitement à Kubernetes quel controller doit prendre en charge cette règle.

**Pourquoi le frontend est passé en `ClusterIP` ?** Parce qu'il n'a plus besoin d'être accessible directement depuis Internet — c'est l'Ingress qui reçoit le trafic et le transmet au frontend en interne. Laisser les deux aurait créé deux points d'entrée, ce qui est redondant et moins sécurisé.

**Pourquoi `/api` est routé vers le backend et pas le frontend ?** Le frontend Nginx fait déjà du proxy sur `/api` vers le backend dans sa config `nginx.conf`. Avec l'Ingress, on court-circuite ce proxy : les requêtes `/api` vont directement au backend sans passer par Nginx, ce qui est plus propre et plus efficace.
