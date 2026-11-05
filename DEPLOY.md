# Déploiement — flash-ops.cloud

Serveur : `72.62.232.168`  
Domaine : `flash-ops.cloud`  
Repo : https://github.com/mbulalonganya-coder/flashops.git  
Dossier : `/var/www/flash-ops`

PostgreSQL `flash_ops` est **déjà sur ce VPS**. L’API doit parler à `127.0.0.1:5432`, pas à l’IP publique.

Le port **8080** est déjà pris → API Flash OPS sur **8082**.

## DNS

| Type | Nom | Valeur |
|------|-----|--------|
| A | `flash-ops.cloud` | `72.62.232.168` |
| A | `www.flash-ops.cloud` | `72.62.232.168` |

## Build & service

```bash
cd /var/www/flash-ops
git pull origin main

cd backend
chmod +x mvnw
./mvnw -DskipTests package
systemctl restart flash-ops-api

cd ../front
npm ci
npm run build -- --configuration=production
systemctl reload nginx
```

HTTPS :

```bash
certbot --nginx -d flash-ops.cloud -d www.flash-ops.cloud
```
