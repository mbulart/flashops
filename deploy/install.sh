#!/usr/bin/env bash
# Install / update Flash OPS on the existing VPS (same PostgreSQL flash_ops).
set -euo pipefail

APP_DIR=/var/www/flash-ops
ENV_FILE=/etc/flash-ops/api.env
REPO_URL="${FLASHOPS_REPO_URL:-https://github.com/mbulart/flashops.git}"
API_PORT=8082
DB_NAME=flash_ops
DB_USER=flash_ops
DB_PASS="${FLASHOPS_DB_PASSWORD:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y openjdk-21-jdk nginx git curl unzip
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$APP_DIR" /etc/flash-ops /var/www/flash-ops/backend/data/avatars
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout main
  git -C "$APP_DIR" pull --ff-only origin main
fi

if [[ -z "$DB_PASS" && -f "$ENV_FILE" ]]; then
  DB_PASS="$(grep -E '^SPRING_DATASOURCE_PASSWORD=' "$ENV_FILE" | cut -d= -f2- || true)"
fi
if [[ -z "$DB_PASS" ]]; then
  echo "Set FLASHOPS_DB_PASSWORD to the existing flash_ops Postgres password" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  JWT="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
SERVER_PORT=${API_PORT}
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/${DB_NAME}
SPRING_DATASOURCE_USERNAME=${DB_USER}
SPRING_DATASOURCE_PASSWORD=${DB_PASS}
FLASHOPS_JWT_SECRET=${JWT}
FLASHOPS_ADMIN_PASSWORD=Admin@2030
FLASHOPS_CORS_ORIGINS=https://flash-ops.cloud,https://www.flash-ops.cloud
FLASHOPS_AVATARS_DIR=/var/www/flash-ops/backend/data/avatars
EOF
  chmod 600 "$ENV_FILE"
fi

cd "$APP_DIR/backend"
chmod +x mvnw
./mvnw -DskipTests package
JAR="$(ls -1 target/flash-ops-api-*.jar | grep -v original | head -n1)"
sed -i "s|/var/www/flash-ops/backend/target/flash-ops-api-0.1.0-SNAPSHOT.jar|${JAR}|" \
  "$APP_DIR/deploy/flash-ops-api.service" || true
cp "$APP_DIR/deploy/flash-ops-api.service" /etc/systemd/system/flash-ops-api.service

cd "$APP_DIR/front"
npm ci
npm run build -- --configuration=production
DIST="$APP_DIR/front/dist/front/browser"
if [[ ! -f "$DIST/index.html" ]]; then
  DIST="$(dirname "$(find "$APP_DIR/front/dist" -name index.html | head -n1)")"
fi
sed "s|root /var/www/flash-ops/front/dist/front/browser;|root ${DIST};|" \
  "$APP_DIR/deploy/nginx-flash-ops.cloud.conf" \
  > /etc/nginx/sites-available/flash-ops.cloud
ln -sfn /etc/nginx/sites-available/flash-ops.cloud /etc/nginx/sites-enabled/flash-ops.cloud

chown -R www-data:www-data "$APP_DIR"
nginx -t
systemctl daemon-reload
systemctl enable --now flash-ops-api
systemctl restart flash-ops-api
systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d flash-ops.cloud -d www.flash-ops.cloud --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email || true
fi

echo "OK — API :$(ss -tlnp | grep -E ":${API_PORT}" || true)"
curl -sS -o /dev/null -w "local_health=%{http_code}\n" "http://127.0.0.1:${API_PORT}/api/v1/health" || true
