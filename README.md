# Flash OPS

Refonte **Spring Boot** + **Angular** (stack actuelle : Angular **22.x** — la v24 n’est pas encore publiée sur npm).

## Structure

- `backend/` — API authentification (JWT, PostgreSQL)
- `front/` — interface Angular (module auth pour l’instant)

## Base de données

Configurer via variables d’environnement (voir `backend/.env.example`).

## Démarrage local

### API

```powershell
cd c:\projets\flash_ops\backend
copy .env.example .env
# éditer .env (URL JDBC, mot de passe BDD, secret JWT)
.\mvnw.cmd spring-boot:run
```

API : http://localhost:8080/api/v1

Comptes seed :

- Admin : `admin@flashops.local` / `Admin@2030`
- Directeur : `coo@flash.one` / `FlashOps@2026`
- RZ : `prenom.nom@flash-ops.cloud` / `FlashOps@2026`

### Front

```powershell
cd c:\projets\flash_ops\front
npm install
npm start
```

Front : http://localhost:4201 (ou 4200) — `public/runtime-config.json` → `http://localhost:8080/api/v1`

> **Angular** : npm publie actuellement la **v22** (pas encore de v24). Le front est généré avec `@angular/cli@22`.

### JAVA_HOME (Windows)

```powershell
$env:JAVA_HOME = 'C:\Users\<vous>\AppData\Local\Programs\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
```
