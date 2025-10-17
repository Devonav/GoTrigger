# Docker Setup

Local development Postgres database.

## Quick Start

```bash
# Start Postgres (from project root)
make docker-up

# Check status
cd docker && docker-compose ps

# View logs
make docker-logs

# Stop
make docker-down

# Stop and remove ALL data (clean slate)
make docker-down-clean

# Restart with fresh schema
make docker-restart-clean
```

## Important Notes

**Schema Initialization:**
- The schema file (`server/storage/postgres_schema.sql`) is automatically loaded on **first run only**
- If you update the schema, you need to either:
  1. `make docker-restart-clean` (destroys all data)
  2. `make db-reset` (applies schema to existing database)

**Why schema doesn't reload:**
- Postgres only runs `/docker-entrypoint-initdb.d/` scripts when the data volume is **empty**
- Once data exists, scripts are skipped
- This is standard Docker postgres behavior

## Database Access

### Connection String
```
postgres://postgres:postgres@localhost:5432/password_sync?sslmode=disable
```

### psql CLI
```bash
docker-compose exec postgres psql -U postgres -d password_sync
```

### GUI (Adminer)
Uncomment adminer service in docker-compose.yml, then:
```bash
docker-compose up -d adminer
# Open http://localhost:8081
```

## Schema

Schema is automatically loaded from `internal/storage/postgres_schema.sql` on first start.

To reload schema:
```bash
docker-compose down -v
docker-compose up -d
```
