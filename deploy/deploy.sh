#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-8.134.173.91}"
USER="${DEPLOY_USER:-root}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/aliyun_movieupdate}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/movie-awards-site}"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
STAMP="$(TZ=Asia/Shanghai date +%Y%m%d%H%M%S)"
STAGE="${REMOTE_DIR}.next-${STAMP}"
BAK="${REMOTE_DIR}.bak-${STAMP}"

cd "$ROOT"
npm run build

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "mkdir -p '${STAGE}'"
# Prefer rsync when available; otherwise tar-over-ssh (box often lacks rsync).
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete -e "ssh -i ${KEY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
    "$ROOT/out/" "${USER}@${HOST}:${STAGE}/"
else
  tar -C "$ROOT/out" -czf - . | ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "tar -xzf - -C '${STAGE}'"
fi

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
  "REMOTE_DIR='${REMOTE_DIR}' STAGE='${STAGE}' BAK='${BAK}' bash -s" << 'REMOTE'
set -euo pipefail
if [[ -d "$REMOTE_DIR" ]]; then
  cp -a "$REMOTE_DIR" "$BAK"
fi
rm -rf "$REMOTE_DIR"
mv "$STAGE" "$REMOTE_DIR"
# hatch 默认 umask 007 会让构建产物成 660/640，rsync -a 原样同步后 nginx 读不到、现网 403（2026-11-08 海报全空即因此）；每次部署后统一放开读权限。
chmod -R a+rX "$REMOTE_DIR"
ls -1dt ${REMOTE_DIR}.bak-* 2>/dev/null | tail -n +4 | xargs -r rm -rf || true
CONF=/etc/nginx/sites-available/news.readcine.com
if [[ ! -f "$CONF" ]]; then
  cat > "$CONF" << 'NGINX'
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
echo "Deployed; backup=$BAK"
REMOTE

echo "Deployed to ${USER}@${HOST}:${REMOTE_DIR}"
