# 🚀 Quick Start — Auth App Kubernetes

## 1. Prérequis
```bash
# PowerShell
$env:KUBECONFIG="chemin\vers\kubeconfig"

# Git Bash / Linux / macOS
export KUBECONFIG="chemin/vers/kubeconfig"
```

---

## 2. Vérifier que le cluster est sain
```bash
kubectl get nodes
kubectl get pods -n kube-system | grep coredns
```
> ⚠️ Si CoreDNS est bloqué en `ContainerCreating` :
> ```bash
> kubectl rollout restart deployment coredns -n kube-system
> ```

---

## 3. Namespace + contexte
```bash
kubectl create namespace authapp
kubectl config set-context --current --namespace=authapp
```

---

## 4. Ingress Controller
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.resources.requests.cpu=50m \
  --set controller.resources.requests.memory=64Mi

kubectl get service ingress-nginx-controller -n ingress-nginx -w
# Notez l'EXTERNAL-IP → c'est l'URL de votre app
```

---

## 5. Déploiement de la stack applicative
```bash
kubectl apply -f k8s/00-secrets.yaml
kubectl apply -f k8s/01-mongo.yaml
kubectl get pods -w
# Attendez que mongo-0, mongo-1, mongo-2 soient 1/1 Running
```

### Initialisation du ReplicaSet MongoDB
```bash
kubectl exec -it mongo-0 -n authapp -- mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo-0.mongo.authapp.svc.cluster.local:27017'}, {_id: 1, host: 'mongo-1.mongo.authapp.svc.cluster.local:27017'}, {_id: 2, host: 'mongo-2.mongo.authapp.svc.cluster.local:27017'}]})"

# Vérifier l'élection (relancer jusqu'à voir PRIMARY)
kubectl exec -it mongo-0 -n authapp -- mongosh --eval "rs.status().members.map(m => m.name + ' : ' + m.stateStr)"
```
```bash
kubectl apply -f k8s/02-backend.yaml
kubectl apply -f k8s/03-frontend.yaml
kubectl apply -f k8s/04-ingress.yaml
kubectl apply -f k8s/05-uptime-kuma.yaml
kubectl get pods -w
# Attendez que tous les pods soient 1/1 Running
```

---

## 6. GateKeeper OPA
```bash
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm install gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system \
  --create-namespace

kubectl get pods -n gatekeeper-system -w
# Attendez que tous les pods soient 1/1 Running

kubectl apply -f k8s/06-gatekeeper-policies.yaml
```

---

## 7. Grafana + Prometheus
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.resources.requests.memory=200Mi \
  --set prometheus.prometheusSpec.resources.requests.cpu=100m \
  --set grafana.resources.requests.memory=100Mi \
  --set grafana.resources.requests.cpu=50m \
  --set alertmanager.enabled=false \
  --set prometheus.prometheusSpec.retention=6h

kubectl get pods -n monitoring -w
# Attendez que tous les pods soient Running
```

### Accès Grafana
```bash
# Récupérer le mot de passe admin
kubectl --namespace monitoring get secrets monitoring-grafana \
  -o jsonpath="{.data.admin-password}" | base64 -d

# Port-forward
kubectl --namespace monitoring port-forward service/monitoring-grafana 3000:80
# → http://localhost:3000 (login: admin)
```

> Dashboards utiles :
> - **Kubernetes / Compute Resources / Namespace (Pods)** → namespace `authapp`
> - **Kubernetes / Compute Resources / Node (Pods)**
> - **Node Exporter / Nodes**

---

## 8. Headlamp
```bash
helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/
helm repo update
helm install headlamp headlamp/headlamp \
  --namespace headlamp \
  --create-namespace

# Port-forward
kubectl --namespace headlamp port-forward svc/headlamp 8080:80

# Générer un token d'accès (dans un autre terminal)
kubectl create token headlamp --namespace headlamp
# → http://localhost:8080 (collez le token)
```

---

## 9. Uptime Kuma
```bash
# Port-forward
kubectl port-forward service/uptime-kuma 3001:3001 -n authapp
# → http://localhost:3001
```

> Sondes à configurer :
> - **Frontend** : HTTP `http://<EXTERNAL-IP>`
> - **Backend** : HTTP `http://<EXTERNAL-IP>/api/health`
> - **MongoDB** : TCP `mongo-1.mongo.authapp.svc.cluster.local:27017`

---

## 10. Tests de résilience

### Simuler la perte du PRIMARY MongoDB
```bash
# Identifier le PRIMARY
kubectl exec -it mongo-0 -n authapp -- mongosh \
  --eval "rs.status().members.map(m => m.name + ' : ' + m.stateStr)"

# Supprimer le PRIMARY
kubectl delete pod mongo-0 -n authapp

# Observer l'auto-guérison
kubectl get pods -n authapp -w

# Vérifier la nouvelle élection
kubectl exec -it mongo-1 -n authapp -- mongosh \
  --eval "rs.status().members.map(m => m.name + ' : ' + m.stateStr)"
```

### Tester le rollback CI/CD
```bash
kubectl rollout history deployment/authapp-backend
kubectl rollout undo deployment/authapp-backend
kubectl rollout status deployment/authapp-backend
```

### Tester le scaling
```bash
kubectl scale deployment authapp-backend --replicas=3 -n authapp
kubectl logs -f -l app=authapp-backend --prefix -n authapp
# Générez du trafic et observez la répartition entre les pods
kubectl scale deployment authapp-backend --replicas=1 -n authapp
```

---

## 11. Vérification des contraintes GateKeeper

### Voir les violations actives
```bash
kubectl describe k8snolatestimage no-latest-image
kubectl describe k8srequiredlabels require-app-label
```

### Tester la contrainte no-latest-image en live
```bash
kubectl run test-latest --image=nginx:latest -n authapp
# → Warning: [no-latest-image] Le conteneur 'nginx:latest' utilise le tag :latest interdit.
kubectl delete pod test-latest -n authapp
```

### Vérifier les logs GateKeeper
```bash
kubectl logs -n gatekeeper-system -l control-plane=controller-manager --tail=20
```

---

## 12. État global du cluster
```bash
kubectl get pods -n authapp
kubectl get pods -n monitoring
kubectl get pods -n gatekeeper-system
kubectl get pods -n headlamp
kubectl get pods -n ingress-nginx
kubectl get pvc -n authapp
kubectl get ingress -n authapp
```

## 🧹 Nettoyage complet (Teardown)

### 1. Supprimer GateKeeper et ses politiques
```bash
kubectl delete -f k8s/06-gatekeeper-policies.yaml
helm uninstall gatekeeper -n gatekeeper-system
```

### 2. Supprimer les outils de monitoring et exploration
```bash
helm uninstall monitoring -n monitoring
helm uninstall headlamp -n headlamp
```

### 3. Supprimer l'Ingress et le controller
```bash
kubectl delete -f k8s/04-ingress.yaml
helm uninstall ingress-nginx -n ingress-nginx
```

### 4. Supprimer les applications
```bash
kubectl delete -f k8s/05-uptime-kuma.yaml
kubectl delete -f k8s/03-frontend.yaml
kubectl delete -f k8s/02-backend.yaml
kubectl delete -f k8s/01-mongo.yaml
```

### 5. Supprimer les volumes persistants
```bash
# Les PVC du StatefulSet ne sont pas supprimés automatiquement
kubectl delete pvc --all -n authapp
```

### 6. Supprimer le namespace
```bash
kubectl delete namespace authapp
```

### 7. Vérifier que tout est propre
```bash
kubectl get all -A
kubectl get pvc -A
kubectl get pv
```
> Seul le service `kubernetes` dans le namespace `default` doit subsister.

### 8. Supprimer les repos Helm (optionnel)
```bash
helm repo remove ingress-nginx
helm repo remove prometheus-community
helm repo remove gatekeeper
helm repo remove headlamp
```