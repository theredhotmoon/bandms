# BandMS API

Laravel 11 REST API backend for the BandMS platform. Runs fully inside Docker — no local PHP or MySQL required after the initial Composer bootstrap.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with the Docker Engine running)
- [Composer](https://getcomposer.org/) — needed once to install PHP dependencies before the first build
- `make` — available on macOS/Linux; on Windows use [Git Bash](https://git-scm.com/) or WSL

---

## First-time setup

### 1. Install PHP dependencies

The Docker image is built from the `vendor/laravel/sail` runtime, so `vendor/` must exist before the first build.

```bash
composer install
```

If you don't have PHP installed locally, use a temporary Docker container:

```bash
docker run --rm -v "$(pwd):/app" -w /app composer install --ignore-platform-reqs
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set the database connection to MySQL (the Docker service):

```dotenv
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=bandms
DB_USERNAME=sail
DB_PASSWORD=password
```

Then generate the application key:

```bash
# Either locally if PHP is available:
php artisan key:generate

# Or after the containers are up (step 3):
docker exec bandms-app php artisan key:generate
```

### 3. Build and start containers

```bash
make build   # Builds the Docker image and starts all containers
```

On subsequent starts you only need `make up`.

### 4. Run migrations and seed the database

```bash
make fresh   # Drops all tables, re-runs all migrations, and seeds
```

### 5. Install Passport OAuth keys (run once)

```bash
make passport
```

This generates the encryption keys and creates the default OAuth clients required for API authentication.

---

## Daily development

```bash
make up      # Start all containers in the background
make down    # Stop all containers
make restart # Restart all containers
make logs    # Tail container logs (Ctrl+C to exit)
make ps      # Show running container status
```

The API is available at **http://localhost:8080/api**.

---

## Database management

| Command | Effect |
|---|---|
| `make migrate` | Run pending migrations |
| `make fresh` | Drop all tables, re-run all migrations, seed |
| `make seed` | Run seeders without wiping data |
| `make reset` | Stop containers and delete all volumes (blank slate) |

After `make reset` you need to go through steps 4 and 5 again.

---

## Running tests

```bash
make test                        # Full test suite
```

To run a single test class or method, open a shell inside the container first:

```bash
make shell

# Then inside the container:
php artisan test --filter TestClassName
php artisan test --filter TestClassName::test_method_name
```

---

## Container reference

| Container | Image | Port |
|---|---|---|
| `bandms-app` | `bandms-service/app` (custom build) | `8080` → app HTTP |
| `bandms-mysql` | `mysql:8.4` | `3306` → MySQL |

Open a shell in the app container at any time:

```bash
make shell
# or directly:
docker exec -it bandms-app bash
```

---

## Health check

```bash
make health
# or:
curl http://localhost:8080/api/health
```
