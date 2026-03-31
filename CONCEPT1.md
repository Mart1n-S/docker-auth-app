# 📖 Lexique et Concepts Avancés Kubernetes & MongoDB

Ce document détaille les concepts techniques clés utilisés dans l'architecture de la base de données hautement disponible du projet.

## 1. Les objets de base (`kind`)

Dans Kubernetes, chaque fichier YAML décrit une ressource que le cluster doit créer. Le champ `kind` définit la **nature** de cette ressource.

* **`kind`** : C'est le type d'objet Kubernetes.
* **Valeurs les plus courantes :**
    * `Pod` : La plus petite unité (un ou plusieurs conteneurs). On ne les crée presque jamais à la main.
    * `Deployment` : Gère un groupe de Pods identiques et "sans état" (stateless). Parfait pour le backend Node.js ou le frontend Nginx.
    * `Service` : Un point d'accès réseau (une adresse IP ou un nom DNS) qui redirige le trafic vers un ensemble de Pods.
    * `StatefulSet` : Le grand frère du Deployment, conçu spécifiquement pour les applications "avec état" (bases de données).
    * `Secret` / `ConfigMap` : Pour stocker des variables d'environnement et des mots de passe.

---

## 2. Le réseau : `clusterIP` et le "Headless Service"



* **Le `clusterIP` classique :** Par défaut, quand on crée un `Service` dans Kubernetes, il reçoit une adresse IP interne (le `ClusterIP`). Ce service agit comme un LoadBalancer interne : il reçoit une requête et l'envoie aléatoirement à l'un des pods rattachés.
* **Pourquoi `clusterIP: None` ?** Dans notre cas, nous ne voulons **pas** que Kubernetes répartisse la charge aléatoirement. Une base de données fonctionne avec un nœud Maître (Primary) pour l'écriture et des nœuds Esclaves (Secondary) pour la lecture. Le backend doit pouvoir parler à chaque pod individuellement (ex: `mongo-0`, `mongo-1`).
* Mettre `None` crée ce qu'on appelle un **Headless Service** (un service sans tête). Il ne crée pas d'IP globale, mais permet au DNS interne de Kubernetes de donner une adresse réseau unique et prévisible à chaque pod du StatefulSet.

---

## 3. L'orchestration des données : `StatefulSet`



Pourquoi ne pas avoir utilisé un simple `Deployment` pour MongoDB ? Parce qu'un Deployment traite les pods comme du bétail jetable. Un `StatefulSet` traite les pods comme des animaux de compagnie ("Pets"), avec des identités uniques.

* **Identité réseau stable :** Au lieu d'avoir un nom aléatoire (`mongo-7b5d...`), les pods s'appellent strictement `mongo-0`, `mongo-1` et `mongo-2`. S'ils redémarrent, ils gardent ce nom.
* **Démarrage ordonné :** Kubernetes démarre `mongo-0`, attend qu'il soit prêt, puis lance `mongo-1`, etc.
* **Persistance collante :** Si le pod `mongo-1` plante et est recréé sur un autre serveur physique du cluster, Kubernetes s'assure de lui rattacher exactement le même disque dur qu'avant.

---

## 4. Haute Disponibilité MongoDB : Les arguments `command`



Dans le fichier YAML, nous avons surchargé la commande de démarrage du conteneur pour obliger MongoDB à se comporter comme un cluster, ce qu'on appelle un **ReplicaSet MongoDB** (à ne pas confondre avec le ReplicaSet de Kubernetes).

* **`- mongod`** : C'est le processus démon de MongoDB. C'est le moteur de la base de données lui-même.
* **`- "--replSet"`** : Cet argument indique à l'instance MongoDB qu'elle ne va pas travailler toute seule. Elle doit s'attendre à faire partie d'un groupe de réplication (où les données sont copiées en temps réel d'un nœud primaire vers des nœuds secondaires).
* **`- "rs0"`** : C'est le nom de notre groupe de réplication (Replica Set 0). Les 3 pods (`mongo-0`, `mongo-1`, `mongo-2`) doivent avoir le même nom de groupe pour accepter de discuter ensemble.
* **`- "--bind_ip_all"`** : Par défaut, par sécurité, MongoDB n'écoute que sur `localhost` (127.0.0.1). Cet argument force MongoDB à écouter sur `0.0.0.0`, lui permettant d'accepter le réseau provenant des autres pods du cluster (notamment notre backend Node.js).

---

## 5. Le stockage persistant : `mountPath` et `volumeClaimTemplates`

Les conteneurs sont éphémères par nature. Si un conteneur est détruit, tout ce qu'il contient est perdu. Pour une base de données, c'est inacceptable.

* **`mountPath: /data/db`** : C'est le chemin absolu **à l'intérieur du conteneur Linux**. C'est le dossier exact où le processus `mongod` écrit ses fichiers de données par défaut. On dit à Kubernetes : "Prends ce dossier interne, et branche-le sur un vrai disque dur externe".
* **`volumeClaimTemplates` (Le modèle de demande de volume) :** * Si on utilisait un volume classique partagé, nos 3 pods Mongo écriraient sur le même disque en même temps, ce qui corromprait la base de données instantanément.
    * Le `volumeClaimTemplates` est la magie du `StatefulSet` : il demande à Kubernetes de provisionner (fabriquer) un vrai disque dur persistant (Persistent Volume Claim) de 1Go de manière **unique et distincte pour chaque réplica**.
    * Ainsi, `mongo-0` reçoit son disque A, `mongo-1` reçoit son disque B, etc.