# Quick Start - Password Sync

## 🚀 First Time Setup (5 minutes)

```bash
# 1. Start database with fresh schema
make docker-restart-clean

# 2. Seed test data
make dev-setup

# 3. Start server
make run-multi
```

✅ **Done!** Server running on http://localhost:8080

## 🧪 Test It Works

```bash
# Register a user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Or use VS Code REST Client
# Open: test/api/auth.http
# Click "Send Request" above each endpoint
```

## 🔄 Schema Updates

**Did you update `postgres_schema.sql`?**

```bash
# Option 1: Fresh start (destroys data)
make docker-restart-clean

# Option 2: Apply to existing DB (destroys data)
make db-reset
```

**Why?** Docker postgres only runs init scripts on first startup.

## 📋 Common Commands

| Command | Description |
|---------|-------------|
| `make docker-up` | Start Postgres |
| `make docker-down` | Stop Postgres (keeps data) |
| `make docker-restart-clean` | Restart with fresh schema ⚠️ |
| `make db-reset` | Reset schema (existing DB) ⚠️ |
| `make run-multi` | Start server (multi-tenant) |
| `make docker-psql` | Connect to postgres CLI |
| `make desktop-dev` | Start desktop client |

⚠️ = Destroys all data

## 🐛 Troubleshooting

### "column does not exist" error
```bash
make docker-restart-clean
make dev-setup
```

### Can't connect to postgres
```bash
docker ps  # Check if running
make docker-up
```

### Port already in use
```bash
lsof -i :8080  # Find process
kill -9 <PID>
```

## 📚 Documentation

- **Architecture:** `docs/current/ARCHITECTURE.md`
- **API Testing:** `test/api/README.md`
- **Desktop Client:** `clients/desktop/README.md`
- **Docker Setup:** `docker/README.md`

## ✅ Success Checklist

Your setup is correct if:

- [x] `make docker-up` starts postgres
- [x] Server starts with `make run-multi`
- [x] Registration returns JWT token
- [x] `sync/pull` returns `{"gencount": 0, "updates": null}`
- [x] No "column does not exist" errors

---

**Need help?** Check `TROUBLESHOOTING.md` or review the MDs you asked me to read! 📖
