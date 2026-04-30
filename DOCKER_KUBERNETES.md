# 🐳 Docker & Kubernetes

## Docker (Desenvolvimento)

### Iniciar ambiente completo
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Acessar:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Database: localhost:5432
- Redis: localhost:6379

### Comandos úteis
```bash
# Rebuild
docker-compose -f docker-compose.dev.yml up -d --build

# Logs
docker-compose -f docker-compose.dev.yml logs -f backend

# Parar
docker-compose -f docker-compose.dev.yml down
```

---

## Docker (Produção)

### Build e push
```bash
# Build
docker build -t afeto/backend:latest ./server
docker build -t afeto/frontend:latest ./client

# Push
docker push afeto/backend:latest
docker push afeto/frontend:latest
```

### Deploy
```bash
# Criar .env com variáveis
# Depois:
docker-compose up -d
```

---

## Kubernetes

### Pré-requisitos
- Cluster Kubernetes (EKS, GKE, AKS, ou local)
- kubectl configurado
- Ingress Controller (NGINX)
- Cert-Manager (para SSL)

### Deploy

```bash
# Criar namespace
kubectl apply -f k8s/namespace.yaml

# Criar secrets (editar primeiro!)
kubectl apply -f k8s/secrets.yaml

# Deploy Redis
kubectl apply -f k8s/redis-pvc.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml

# Deploy Backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Deploy Frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Deploy Worker
kubectl apply -f k8s/worker-deployment.yaml

# Deploy Ingress
kubectl apply -f k8s/ingress.yaml

# Deploy HPA (autoscaling)
kubectl apply -f k8s/hpa.yaml
```

### Verificar status
```bash
kubectl get pods -n afeto-sac
kubectl get svc -n afeto-sac
kubectl get ingress -n afeto-sac
kubectl get hpa -n afeto-sac
```

### Escalar manualmente
```bash
# Backend
kubectl scale deployment backend --replicas=5 -n afeto-sac

# Worker
kubectl scale deployment worker --replicas=3 -n afeto-sac
```

### Logs
```bash
# Todos os pods
kubectl logs -f deployment/backend -n afeto-sac

# Worker específico
kubectl logs -f deployment/worker -n afeto-sac
```

---

## GitHub Actions (CI/CD)

O arquivo `.github/workflows/ci-cd.yml` já configura:
- Build automático de imagens
- Push para registry
- Deploy automático (se configurado)

---

## Recursos

| Serviço | CPU Request | Mem Request | CPU Limit | Mem Limit | Réplicas |
|---------|-------------|-------------|-----------|-----------|----------|
| Backend | 250m | 256Mi | 500m | 512Mi | 3-10 |
| Frontend | 100m | 64Mi | 200m | 128Mi | 2 |
| Worker | 250m | 256Mi | 500m | 512Mi | 2 |
| Redis | 100m | 256Mi | 200m | 512Mi | 1 |
