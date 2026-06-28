# Hetzner Deployment & CI/CD Guide

This guide walks you through everything needed to get BandMS running on a Hetzner
server with automatic deployments on every push to `main`. It is written for
someone who has a Hetzner account but has not configured a server before.

---

## How it all fits together

```
Your computer
  └─ git push → GitHub (main branch)
                  └─ GitHub Actions runs automatically:
                       1. Runs backend tests (Pest)
                       2. Builds Docker images → pushes to GitHub image registry (GHCR)
                       3. SSHs into Hetzner → pulls new images → rolling restart

Hetzner server (your VPS)
  ├─ Caddy          ← HTTPS termination, routes traffic (ports 80 / 443)
  ├─ Frontend       ← Vue SPA served by Nginx (static files)
  ├─ Backend        ← Laravel API (PHP-FPM + Nginx)
  └─ MySQL 8.4      ← Database (data persists in a Docker volume)
```

Every push to `main` triggers a full deploy automatically — no manual steps
required after the one-time setup below.

---

## Part 1 — Create the Hetzner server

### 1.0 Getting root access to a server you already created

If you created the server **without** adding an SSH key during setup, Hetzner
emails the initial root password automatically. Check your inbox (including spam)
for an email from Hetzner with subject "Your new server" or "Server credentials".

**If you cannot find the email**, reset access from the Hetzner console — no
existing login required:

1. **console.hetzner.cloud** → click your server
2. Left sidebar → **"Rescue"** tab → click **"Enable rescue system"**
   — a one-time root password is shown on screen immediately
3. Left sidebar → **"Power"** tab → **"Power cycle"** (reboot)
4. SSH in with the rescue password: `ssh root@YOUR_SERVER_IP`

**Recommended: rebuild with an SSH key instead** (cleaner, no passwords ever):

1. On your local machine, check if you already have a key:
   ```bash
   cat ~/.ssh/id_ed25519.pub   # or id_rsa.pub
   ```
   If the file does not exist, generate one:
   ```bash
   ssh-keygen -t ed25519
   ```
2. In the Hetzner console → left sidebar → **"SSH Keys"** → **"Add SSH key"**
   → paste the output of the command above → save
3. Left sidebar → **"Rebuild"** tab → choose **Ubuntu 24.04** → select your SSH
   key → confirm rebuild (this wipes the server — fine since nothing is set up yet)
4. After the rebuild (takes ~1 min): `ssh root@YOUR_SERVER_IP` — logs in with
   no password from this point on

Continue from step 1.1 once you can SSH in as root.

---

### 1.1 Create a new server

1. Log in at **https://console.hetzner.cloud**
2. Select your project (or create one — e.g. "BandMS")
3. Click **Add Server**
4. Choose these settings:
   - **Location**: any EU region (Nuremberg or Helsinki are fine)
   - **Image**: Ubuntu 24.04
   - **Type**: **CX22** (2 vCPU, 4 GB RAM, ~€4.15/month) — sufficient for a band site
   - **SSH keys**: skip for now (the setup script handles this)
   - **Firewalls, backups, volumes**: leave defaults
5. Click **Create & Buy Now**

Write down the **server IP address** shown in the dashboard — you will need it
in several places below.

### 1.2 Connect as root

Open a terminal on your local machine and run:

```bash
ssh root@YOUR_SERVER_IP
```

Accept the fingerprint prompt by typing `yes`. You are now on the server.

---

## Part 2 — Run the server setup script

The repository ships a script that installs Docker and creates a `deploy` user
that GitHub Actions will use to connect.

### 2.1 Run the script

On the server (as root), run:

```bash
curl -fsSL https://raw.githubusercontent.com/theredhotmoon/bandms/main/scripts/server-setup.sh -o server-setup.sh
bash server-setup.sh
```

The script will:
- Install Docker and Docker Compose
- Create a `deploy` user with Docker access
- Create the app directory at `/opt/bandms/`
- **Pause and ask you to paste an SSH public key** — keep the server terminal open and follow step 2.2

### 2.2 Generate the deploy SSH keypair

While the script is waiting, open a **second terminal on your local machine** and run:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/bandms_deploy
```

Press Enter twice for no passphrase.

This creates two files:
- `~/.ssh/bandms_deploy` — **private key** (goes into GitHub Secrets, never shared)
- `~/.ssh/bandms_deploy.pub` — **public key** (paste into the server now)

Print the public key:

```bash
cat ~/.ssh/bandms_deploy.pub
```

Copy the entire output line (starts with `ssh-ed25519 ...`), paste it into the
**server terminal**, then press **Ctrl-D**. The script finishes.

---

## Part 3 — Configure the server environment file

The application reads all its secrets from `/opt/bandms/.env` on the server. You
need to create this file from the template in the repo.

### 3.1 Copy the template to the server

On your **local machine**, from the repo root:

```bash
scp .env.prod.example deploy@YOUR_SERVER_IP:/opt/bandms/.env
```

### 3.2 Edit the file

```bash
ssh deploy@YOUR_SERVER_IP
nano /opt/bandms/.env
```

Fill in every value marked as `CHANGE_ME` or `GENERATE`:

| Variable | What to put |
|---|---|
| `APP_KEY` | Run `openssl rand -base64 32` locally, then prepend `base64:` — e.g. `base64:abc123...` |
| `APP_URL` | `http://YOUR_SERVER_IP` for now; update to your domain later |
| `APP_VERSION` | `latest` |
| `DB_PASSWORD` | A strong random password — e.g. output of `openssl rand -hex 20` |
| `DB_ROOT_PASSWORD` | A different strong random password |
| `DB_DATABASE` / `DB_USERNAME` | Keep as `bandms` |
| Optional API keys (`YOUTUBE_API_KEY`, etc.) | Leave blank to disable those integrations |

Save with **Ctrl-O → Enter → Ctrl-X**.

> **Never commit this file.** It is in `.gitignore`. The `.env.prod.example` in
> the repo is just a template with no real values.

---

## Part 4 — Add GitHub Actions secrets

GitHub Actions needs three secrets to deploy. Go to:

**Your GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Add each one:

| Secret name | Value |
|---|---|
| `SERVER_HOST` | Your Hetzner server IP (e.g. `65.21.123.45`) |
| `SERVER_SSH_KEY` | Full contents of `~/.ssh/bandms_deploy` (the **private** key — include the `-----BEGIN OPENSSH PRIVATE KEY-----` header and footer) |
| `GHCR_TOKEN` | A GitHub Personal Access Token — see step 4.1 |

### 4.1 Create a GHCR_TOKEN

This token lets the Hetzner server pull Docker images from GitHub:

1. Go to **GitHub → your profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Name it `bandms-deploy`, set expiration to 1 year
4. Under **Permissions → Repository permissions**, set **Packages** to **Read-only**
5. Click **Generate token** — copy the value immediately (shown only once)
6. Add it as the `GHCR_TOKEN` GitHub secret

---

## Part 5 — Trigger the first deploy

Push anything to `main`:

```bash
git commit --allow-empty -m "chore: trigger first deploy"
git push origin main
```

Watch the progress at: **GitHub → your repo → Actions → Deploy**

The workflow has three sequential jobs:

| Job | What it does | Typical duration |
|---|---|---|
| **Backend tests** | Runs the full Pest test suite in an isolated container | ~30 s |
| **Build & push images** | Builds backend + frontend Docker images, pushes to GHCR | 3–5 min (first run longer) |
| **Deploy to Hetzner** | SSH into server, pull images, rolling restart | ~1 min |

If any job fails, the next one does not run — nothing is deployed.

### Verify it worked

```bash
curl http://YOUR_SERVER_IP/api/health
```

Expected response: `{"status":"ok"}`

Open `http://YOUR_SERVER_IP` in a browser — you should see the band website.

---

## Part 6 — Add a domain and enable HTTPS

Once you have a domain name (e.g. `skankingstorks.com`):

### 6.1 Point DNS to your server

At your domain registrar or DNS provider, add two A records:

```
@    A    YOUR_SERVER_IP
www  A    YOUR_SERVER_IP
```

DNS propagation can take a few minutes to a few hours.

### 6.2 Update the Caddyfile in the repo

Edit `docker/caddy/Caddyfile`:

```
# Replace this (HTTP only):
:80 {
    reverse_proxy frontend:80
}

# With this (automatic HTTPS via Let's Encrypt):
skankingstorks.com, www.skankingstorks.com {
    reverse_proxy frontend:80
}
```

Commit and push to `main`. The deploy workflow will copy the new Caddyfile to
the server and restart Caddy. Caddy automatically obtains a free TLS certificate
from Let's Encrypt. Your site will be live at `https://skankingstorks.com`
within a minute or two.

### 6.3 Update APP_URL on the server

```bash
ssh deploy@YOUR_SERVER_IP
nano /opt/bandms/.env
# Change: APP_URL=https://skankingstorks.com
```

Then restart the backend to pick it up:

```bash
cd /opt/bandms
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

---

## How each deploy works (technical detail)

Understanding this helps when things go wrong.

### What runs on every push to main

1. **Tests** run in an isolated Docker container using SQLite (no MySQL needed).
   A single failing test stops the entire workflow.

2. **Images are built** using the production multi-stage Dockerfiles:
   - **Backend image**: installs PHP dependencies with `composer install --no-dev`,
     copies the app, bakes in Nginx and Supervisor config.
   - **Frontend image**: runs `pnpm build` inside the container, outputs static
     files served by Nginx.
   - Both images are tagged `latest` and `<git-sha>` and pushed to GHCR.

3. **Rolling restart on the server**:
   - `docker-compose.prod.yml` and the Caddyfile are copied to `/opt/bandms/` first.
   - **Backend starts first** — its entrypoint script automatically waits for
     MySQL, runs `php artisan migrate --force`, sets up Passport keys, then
     starts PHP-FPM. Docker waits for the `/api/health` healthcheck to pass.
   - Frontend and Caddy restart after the backend is confirmed healthy.
   - Old images are pruned (`docker image prune -f`).

This means **database migrations run automatically on every deploy** — you never
need to SSH in and run `php artisan migrate` manually.

---

## Everyday server operations

### SSH in

```bash
ssh deploy@YOUR_SERVER_IP
cd /opt/bandms
```

### Check what is running

```bash
docker compose -f docker-compose.prod.yml ps
```

### View live logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just the backend (API errors, Laravel logs)
docker compose -f docker-compose.prod.yml logs -f backend

# Just Caddy (HTTP requests, TLS errors)
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Run an Artisan command

```bash
docker exec bandms-backend php artisan migrate:status
docker exec bandms-backend php artisan tinker
docker exec bandms-backend php artisan cache:clear
```

### Restart a single service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Rollback to a previous version

Every deploy tags images with the git commit SHA. To roll back to a previous
version, find the SHA from the GitHub Actions run history, then:

```bash
cd /opt/bandms
APP_VERSION=<git-sha> docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```

---

## Persistent data

Two named Docker volumes hold data that survives container updates and restarts:

| Volume | Contents |
|---|---|
| `bandms-mysql` | The MySQL 8.4 database |
| `bandms-storage` | Uploaded files (tech riders, stage plots, logos) |

These volumes are **never touched** by normal deploys. They are only destroyed
if you run `docker compose ... down -v` — never do this on production without a
backup.

### Back up the database

```bash
ssh deploy@YOUR_SERVER_IP
docker exec bandms-mysql mysqldump -u bandms -pYOUR_DB_PASSWORD bandms \
  > bandms-backup-$(date +%Y%m%d).sql

# Copy to local machine (run this on your local machine):
scp deploy@YOUR_SERVER_IP:~/bandms-backup-*.sql .
```

---

## Troubleshooting

### Workflow fails at "Deploy to Hetzner"

Check that:
- `SERVER_HOST` is the correct IP with no spaces or newlines
- `SERVER_SSH_KEY` contains the full **private** key including the
  `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines
- The key matches: test manually with `ssh -i ~/.ssh/bandms_deploy deploy@YOUR_SERVER_IP`

### Site is up but API returns errors or 500

```bash
ssh deploy@YOUR_SERVER_IP
docker compose -f docker-compose.prod.yml logs --tail=80 backend
```

Common causes: wrong `APP_KEY` format, `APP_URL` mismatch, or a migration error.

### Caddy shows an HTTPS error or fails to get a certificate

- DNS must resolve to the server IP **before** Caddy can complete the Let's Encrypt
  challenge. Verify with: `dig +short skankingstorks.com`
- Port 80 must be open — Hetzner allows it by default but check your firewall rules.
- Check Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`

### Out of disk space

```bash
docker system prune -f     # removes stopped containers and dangling images
df -h                      # check remaining space
```

If the `bandms-mysql` volume grows very large, consider enabling Hetzner's
automated volume backups or moving to a managed database.

---

## Setup checklist

- [ ] Hetzner CX22 server created, IP noted
- [ ] Connected as root: `ssh root@YOUR_SERVER_IP`
- [ ] `server-setup.sh` run successfully
- [ ] Deploy SSH keypair generated (`~/.ssh/bandms_deploy` + `.pub`)
- [ ] Public key pasted into server during setup
- [ ] `/opt/bandms/.env` created and all values filled in
- [ ] `SERVER_HOST` GitHub secret added
- [ ] `SERVER_SSH_KEY` GitHub secret added (private key, full file contents)
- [ ] `GHCR_TOKEN` GitHub secret added
- [ ] Pushed to `main` — all three workflow jobs went green ✅
- [ ] `curl http://YOUR_SERVER_IP/api/health` returns `{"status":"ok"}`
- [ ] Website visible in browser at `http://YOUR_SERVER_IP`
- [ ] *(when domain is ready)* DNS A records pointing at server
- [ ] *(when domain is ready)* `Caddyfile` updated, pushed → HTTPS live
