# Deploying to Hetzner

End-to-end runbook for a first production deployment. Follow it in order —
several steps only work if an earlier one has already happened (the workflow
fails if `/opt/bandms/.env` is missing, for example).

The target shape: one Hetzner Cloud VM running five containers behind Caddy.
Pushing to `main` runs the tests, builds three images, pushes them to GHCR, and
restarts the stack over SSH.

> Also available as a shareable page with a progress-saving verification
> checklist: **[BandMS Deploy Runbook](https://claude.ai/code/artifact/1573a8d4-01c1-4518-bf57-10e09edecf3b)** — handy on a second screen
> while you're SSH'd into the server.

```
                  ┌─────────── Hetzner VM ────────────┐
  :80 / :443 ───► │ caddy                             │
                  │   ├─ /api/*, /storage/*  → backend│
                  │   ├─ /admin*, /login,             │
                  │   │  /account*, /tickets/* → frontend (Vue SPA)
                  │   └─ everything else     → web (Astro SSG)
                  │ backend ──► mysql                 │
                  └───────────────────────────────────┘
```

---

## 1. Create the server

Hetzner Cloud console → **Add Server**.

| Setting | Value |
|---|---|
| Location | Nuremberg / Falkenstein / Helsinki (nearest your audience) |
| Image | **Ubuntu 24.04** |
| Type | **CX22** (2 vCPU / 4 GB) |
| Networking | IPv4 + IPv6 |
| SSH key | add your public key; do **not** use a root password |
| Firewall | create one now, see below |
| Name | `bandms-prod` |

CX22 is the realistic floor. The Astro site rebuilds itself on every deploy, and
during that build Node, MySQL and PHP-FPM are all resident — 2 GB gets tight.

**Firewall** (Hetzner Cloud Firewall, attached to the server):

| Direction | Port | Source | Why |
|---|---|---|---|
| Inbound | 22/tcp | your IP, ideally | SSH |
| Inbound | 80/tcp | any | HTTP + Let's Encrypt HTTP-01 challenge |
| Inbound | 443/tcp + 443/udp | any | HTTPS, HTTP/3 |

Nothing else. MySQL publishes no port and must never get one.

Note the server's IPv4 address — it is `YOUR_SERVER_IP` throughout.

---

## 2. Prepare the server

SSH in as root, then:

```bash
apt update && apt upgrade -y

# Docker, from Docker's own repository (Ubuntu's package is older)
curl -fsSL https://get.docker.com | sh

# Unattended security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# The deploy user the CI workflow logs in as
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# Application directory
mkdir -p /opt/bandms
chown deploy:deploy /opt/bandms
```

Then harden SSH — in `/etc/ssh/sshd_config` set:

```
PermitRootLogin prohibit-password
PasswordAuthentication no
```

and `systemctl restart ssh`.

---

## 3. Give CI an SSH key

Generate a **dedicated** keypair for the workflow on your own machine — not the
key you use interactively:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/bandms_deploy -C "github-actions@bandms" -N ""
```

Install the public half on the server. Easiest is to paste it in yourself:

```bash
cat ~/.ssh/bandms_deploy.pub        # copy this line

ssh root@YOUR_SERVER_IP
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys      # paste the line, save
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Verify before going further — a broken key here fails the deploy job with a
message that does not say "wrong key":

```bash
ssh -i ~/.ssh/bandms_deploy deploy@YOUR_SERVER_IP "docker ps"
```

---

## 4. A token for pulling images

The workflow pushes to GHCR using the automatic `GITHUB_TOKEN`, but the *server*
is not GitHub and needs its own credential.

GitHub → Settings → Developer settings → **Personal access tokens (classic)** →
Generate new token, scope **`read:packages`** only. Copy it.

---

## 5. Repository secrets

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `SERVER_HOST` | `YOUR_SERVER_IP` |
| `SERVER_SSH_KEY` | contents of `~/.ssh/bandms_deploy` — the **private** key, including the BEGIN/END lines |
| `GHCR_TOKEN` | the `read:packages` token from step 4 |

---

## 6. Write the production `.env`

**Do this before the first push.** `docker compose` reads `/opt/bandms/.env`, and
a missing file means every variable silently becomes an empty string — which
fails in confusing ways rather than loudly.

Generate the app key locally:

```bash
echo "base64:$(openssl rand -base64 32)"
```

Then on the server, as `deploy`, create `/opt/bandms/.env` from
[`.env.prod.example`](../.env.prod.example). Every value matters, but these are
the ones that break things quietly:

| Variable | Set it to | If you don't |
|---|---|---|
| `APP_KEY` | the generated `base64:…` | Laravel refuses to boot |
| `APP_URL`, `FRONTEND_URL`, `APP_FRONTEND_URL`, `SITE_URL` | `http://YOUR_SERVER_IP` — all four, identical | CORS rejects the browser; emailed links and Stripe redirects point at `localhost` |
| `SITE_ADDRESS` | `:80` for now | — |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | two different strong random strings | — |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | **leave blank** | a seeded admin whose password you did not choose |
| `MAIL_*` | your SMTP provider's credentials | newsletter and contact form silently discard every message |
| `STRIPE_SECRET_KEY` | `sk_test_…` to start | checkout returns 503 |

Lock it down — it holds every secret the stack has:

```bash
chmod 600 /opt/bandms/.env
```

> **On mail:** do not point `MAIL_HOST` at the server itself. Hetzner blocks
> outbound port 25 on new accounts, and their IP ranges carry enough spam history
> that direct-from-VM delivery lands in junk folders regardless. Use a provider
> (Mailgun, Postmark, Resend, Fastmail) over port 587.

---

## 7. First deploy

```bash
git push origin main
```

Watch the Actions tab. The run does: backend tests + frontend unit tests → build
and push three images → scp the compose file and Caddyfile → SSH in and start
everything.

The first run is the slow one — images build from scratch, and the backend's
`composer install` uses `--prefer-source`, which git-clones every dependency.
Expect 15–25 minutes. Later runs hit the layer cache.

If the deploy step hangs on `--wait backend`, the healthcheck is failing:

```bash
ssh deploy@YOUR_SERVER_IP
docker logs bandms-backend --tail 50
```

---

## 8. Create your admin account

Nothing can log in yet — that is deliberate. Create the first admin
interactively, so the password never touches a file or your shell history:

```bash
ssh deploy@YOUR_SERVER_IP
docker exec -it bandms-backend php artisan bandms:create-admin
```

It prompts for email and password, requires at least 12 characters with letters
and numbers, and assigns the `admin` role.

Then log in at `http://YOUR_SERVER_IP/login`.

---

## 9. Wire up Stripe

In the Stripe dashboard (**test mode** first):

1. Developers → Webhooks → **Add endpoint**
2. URL: `http://YOUR_SERVER_IP/api/webhooks/stripe`
3. Events: `checkout.session.completed`
4. Copy the **signing secret** (`whsec_…`)

Put it in `/opt/bandms/.env` as `STRIPE_WEBHOOK_SECRET`, alongside your
`sk_test_…` key, then recreate the backend — a plain restart is not enough,
because `php artisan optimize` in the entrypoint bakes env values into the
config cache:

```bash
cd /opt/bandms && docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

Confirm the values actually arrived:

```bash
docker exec bandms-backend printenv STRIPE_SECRET_KEY APP_FRONTEND_URL FRONTEND_URL
```

Empty output means the variable never reached the container, whatever `.env`
says. See CLAUDE.md, "Setting a backend env var in `.env` alone does nothing".

---

## 10. Verify

```bash
curl -i  http://YOUR_SERVER_IP/api/health       # 200
curl -sI http://YOUR_SERVER_IP/       | head -1 # 200 — Astro public site
curl -sI http://YOUR_SERVER_IP/login  | head -1 # 200 — Vue SPA
```

Then in a browser:

- [ ] Home page renders with real content, not empty sections
- [ ] `/concerts`, `/releases`, `/merch` all load
- [ ] `/login` shows the SPA and your admin account logs in
- [ ] Admin: create a concert → `docker compose restart web` → it appears publicly
- [ ] `/merch/<item>` → add to cart → checkout → pay with `4242 4242 4242 4242`
- [ ] Stripe returns you to `/merch/success` showing the order, cart now empty
- [ ] Stripe dashboard shows the webhook delivered `200`
- [ ] Newsletter signup arrives by email and the confirm link works

If the public site is empty right after first boot, the Astro build ran while
migrations were still finishing. Restart `web` and it will refetch.

---

## 11. Switch to a domain (whenever you're ready)

1. Point an `A` record at `YOUR_SERVER_IP` (and `AAAA` at the IPv6).
2. Wait for DNS to propagate — verify with `dig +short yourdomain.com`.
3. On the server, edit `/opt/bandms/.env`:

   ```diff
   -SITE_ADDRESS=:80
   +SITE_ADDRESS=yourdomain.com
   -APP_URL=http://YOUR_SERVER_IP
   +APP_URL=https://yourdomain.com
   ```

   …and the same `https://yourdomain.com` for `FRONTEND_URL`, `APP_FRONTEND_URL`
   and `SITE_URL`.

4. Recreate everything that reads those values:

   ```bash
   cd /opt/bandms
   docker compose -f docker-compose.prod.yml up -d --no-deps backend caddy
   docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate web
   ```

Caddy obtains and renews the certificate itself — no certbot, no cron job, no
renewal to remember. Then update the Stripe webhook URL to the `https://` address
and swap `sk_test_` for `sk_live_`.

---

## 12. Operating it

**Deploy** — push to `main`. That is the whole flow.

**Publish content changes** — the Astro site is static and built at container
start, so admin edits are invisible until:

```bash
docker compose -f docker-compose.prod.yml restart web
```

**Roll back** — every image is also tagged with its commit SHA:

```bash
# in /opt/bandms/.env
APP_VERSION=<the-good-commit-sha>

docker compose -f docker-compose.prod.yml up -d
```

**Logs**

```bash
docker logs -f bandms-backend      # Laravel → stderr
docker logs -f bandms-web          # Astro build output
docker logs -f bandms-caddy        # access log, TLS issuance
```

**Back up the database** — nothing does this for you yet:

```bash
docker exec bandms-mysql mysqldump -u root -p"$DB_ROOT_PASSWORD" \
  --single-transaction bandms | gzip > ~/bandms-$(date +%F).sql.gz
```

Put that in a cron job and copy the output off the machine. Also enable
Hetzner's automated backups (+20% of server cost) for whole-disk snapshots — the
two protect against different failures and neither replaces the other.

The `bandms-storage` volume holds every uploaded poster and photo *and*
Passport's signing keys. Back it up too:

```bash
docker run --rm -v bandms-storage:/data -v ~:/backup alpine \
  tar czf /backup/bandms-storage-$(date +%F).tar.gz -C /data .
```

---

## Watch out for

- **`docker compose build web` does not rebuild the site.** The Astro build runs
  in `start.sh` at container startup. Always `up -d` or `restart`.
- **`bandms-web` crash-loops silently if the Astro build fails.** One bad record
  takes down all 53 pages. Check
  `docker inspect bandms-web --format '{{.RestartCount}}'` if the site vanishes.
  This went undetected for two months once — see CLAUDE.md.
- **The rebuild webhook on port 3001 has no authentication.** It is not published
  to the host and not proxied by Caddy, so it is only reachable from inside the
  Docker network. Do not publish that port.
