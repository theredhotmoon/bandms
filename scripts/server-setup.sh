#!/usr/bin/env bash
# Run once on a fresh Hetzner Ubuntu 24.04 server as root.
# Sets up Docker, a 'deploy' user, and the app directory.

set -euo pipefail

DEPLOY_USER=deploy
APP_DIR=/opt/bandms

echo "=== Installing Docker ==="
apt-get update -q
apt-get install -y -q ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker

echo "=== Creating deploy user ==="
id -u "$DEPLOY_USER" &>/dev/null || useradd -m -s /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"

echo "=== Setting up SSH for deploy user ==="
mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
touch /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

echo ""
echo ">>> Paste your GitHub Actions SSH public key, then press Ctrl-D:"
cat >> /home/$DEPLOY_USER/.ssh/authorized_keys

echo "=== Setting up app directory ==="
mkdir -p "$APP_DIR/docker/caddy"
chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"

echo ""
echo "=================================================="
echo " Server setup complete. Next steps:"
echo "=================================================="
echo ""
echo "1. Copy .env.prod.example to the server:"
echo "   scp .env.prod.example deploy@SERVER_IP:/opt/bandms/.env"
echo ""
echo "2. SSH in and edit the .env file:"
echo "   ssh deploy@SERVER_IP"
echo "   nano /opt/bandms/.env"
echo "   # Fill in APP_KEY, DB passwords, APP_URL=http://SERVER_IP"
echo ""
echo "3. Add GitHub Actions secrets (Settings → Secrets → Actions):"
echo "   SERVER_HOST     = <your Hetzner IP>"
echo "   SERVER_SSH_KEY  = <private key matching the public key added above>"
echo "   GHCR_TOKEN      = <GitHub PAT with read:packages scope>"
echo "   APP_TEST_KEY    = base64:PnSxkDEYVMOVnnSJBRREeALiSlO1DJBZ3Zo3rGm1BG8="
echo ""
echo "4. Push to main — the deploy workflow will run automatically."
echo ""
echo "5. When you get a domain, update docker/caddy/Caddyfile:"
echo "   Replace ':80 { ... }' with 'yourdomain.com { ... }'"
echo "   Push to main — Caddy will auto-obtain the TLS certificate."
echo "=================================================="
