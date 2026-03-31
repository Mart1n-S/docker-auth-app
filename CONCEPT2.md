# 🧠 Fiche Concept : Stateless vs Stateful

Dans le monde de la conteneurisation, la gestion de "l'état" (le *State*) détermine comment une application est déployée, scalée et sauvegardée.



## 1. L'approche Stateless (Sans état)

Une application est dite **Stateless** lorsqu'elle ne stocke aucune donnée localement. Chaque requête est indépendante : le serveur traite la demande, envoie la réponse, puis "oublie" tout.

* **Analogie :** Un distributeur automatique de billets. Vous insérez votre carte, il traite l'opération, vous rend l'argent et vous oublie. Le prochain client est traité exactement de la même manière, peu importe ce que vous avez fait juste avant.
* **Dans Kubernetes :** On utilise le `Deployment`.
* **Avantages :**
    * **Scalabilité infinie :** On peut créer 100 réplicas du pod, le trafic peut être envoyé à n'importe lequel, le résultat sera le même.
    * **Haute Disponibilité :** Si un pod plante, Kubernetes en crée un nouveau instantanément. Comme il n'y a pas de données à récupérer, le nouveau pod est opérationnel en une seconde.
* **Dans ton projet :** * **Le Frontend (Nginx) :** Il ne fait que donner des fichiers HTML/JS.
    * **Le Backend (Node.js) :** Il vérifie les tokens JWT à chaque fois. Il ne "se souvient" pas que tu es connecté, c'est ton navigateur qui doit lui renvoyer le token à chaque clic.

---

## 2. L'approche Stateful (Avec état)

Une application est **Stateful** lorsqu'elle doit mémoriser des informations d'une session à l'autre. Elle possède une "mémoire" (souvent sous forme de fichiers sur un disque dur) qui doit survivre aux redémarrages.

* **Analogie :** Un compte bancaire avec un conseiller dédié. Votre conseiller connaît votre historique, vos projets et vos habitudes. Si vous changez de conseiller, il faut lui transférer tout votre dossier (vos données) pour qu'il puisse continuer à vous aider.
* **Dans Kubernetes :** On utilise le `StatefulSet`.
* **Contraintes :**
    * **Identité stable :** Chaque pod a un nom fixe (`mongo-0`, `mongo-1`) et ne peut pas être remplacé par un pod anonyme.
    * **Stockage persistant :** Le pod doit être relié à un disque dur spécifique (PVC). Si le pod se déplace sur un autre serveur du cluster, son disque doit le "suivre".
* **Dans ton projet :** * **MongoDB :** C'est le cœur de tes données. Si MongoDB "oublie" les utilisateurs inscrits à chaque redémarrage, l'application est inutile. Les données écrites par `mongo-0` doivent rester accessibles uniquement par `mongo-0`.



---

## 📊 Tableau Comparatif

| Caractéristique      | Stateless (Frontend/Backend)           | Stateful (MongoDB)                        |
| :------------------- | :------------------------------------- | :---------------------------------------- |
| **Mémoire locale**   | Aucune (Amnésique)                     | Persistante (Mémoire vive + Disque)       |
| **Objet Kubernetes** | `Deployment`                           | `StatefulSet`                             |
| **Stockage**         | Éphémère (tout est supprimé au reboot) | Persistant (via Persistent Volumes)       |
| **Nom des Pods**     | Aléatoire (`auth-bk-abc12`)            | Ordonné (`mongo-0`, `mongo-1`)            |
| **Scalabilité**      | Très facile et rapide                  | Complexe (nécessite une synchronisation)  |
| **Remplacement**     | Un nouveau pod vide suffit             | Le nouveau pod doit récupérer les données |
