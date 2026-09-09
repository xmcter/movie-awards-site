#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-8.134.173.91}"
USER="${DEPLOY_USER:-root}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/aliyun_movieupdate}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/movie-awards-site}"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes)

cd "$ROOT"
npm run build

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "mkdir -p ${REMOTE_DIR}"
rsync -az --delete -e "ssh -i ${KEY} -o BatchMode=yes" \
  "$ROOT/out/" "${USER}@${HOST}:${REMOTE_DIR}/"

# Install nginx site if missing
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
CONF=/etc/nginx/sites-available/news.readcine.com
if [[ ! -f "$CONF" ]]; then
  cat > "$CONF" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name news.readcine.com;

    root /var/www/movie-awards-site;
    index index.html;

    location / {
        try_files $uri $uri.html $uri/ /index.html;
        add_header Cache-Control "public, max-age=300";
    }

    location /_next/static/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
}
NGINX
  ln -sfn "$CONF" /etc/nginx/sites-enabled/news.readcine.com
fi
nginx -t && systemctl reload nginx
REMOTE

echo "Deployed to ${USER}@${HOST}:${REMOTE_DIR}"
