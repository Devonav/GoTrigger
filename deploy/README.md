# Production Deployment Guide

## Overview

This directory contains deployment files for running Password Sync on production servers.

**Current Production Server:**
- IP: `5.161.200.4` (Hetzner)
- Location: `/root/app/password-sync/`
- API Port: `8081`
- PostgreSQL Port: `5433` (internal: 5432)
- Redis Port: `6380` (internal: 6379)

## Quick Deploy

### 1. Deploy to Production

```bash
# From project root
make deploy-prod
```

This will:
- Build Docker image for Go server
- Copy files to Hetzner server
- Start PostgreSQL, Redis, and API containers
- Run health checks

### 2. Check Status

```bash
make deploy-check
```

### 3. View Logs

```bash
make deploy-logs
```

### 4. Restart Services

```bash
make deploy-restart
```

## Manual Deployment

If you prefer manual deployment:

```bash
# SSH into server
ssh root@5.161.200.4

# Navigate to deployment directory
cd /root/app/password-sync

# Pull latest changes (if using git)
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose down
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f api
```

## Architecture

```
┌─────────────────────────────────────┐
│  Hetzner Server (5.161.200.4)      │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Docker Network               │ │
│  │                               │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │  Password Sync API      │ │ │
│  │  │  Port: 8081            │ │ │
│  │  │  (Go + Gin)            │ │ │
│  │  └─────────────────────────┘ │ │
│  │            │                  │ │
│  │            ├─────────┬────────│ │
│  │            │         │        │ │
│  │  ┌─────────▼───┐  ┌─▼──────┐ │ │
│  │  │ PostgreSQL  │  │ Redis  │ │ │
│  │  │ Port: 5433  │  │ 6380   │ │ │
│  │  └─────────────┘  └────────┘ │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Services

### 1. API Server (password-sync-api)
- **Container**: `password-sync-api`
- **Port**: `8081`
- **Image**: Built from `/deploy/Dockerfile`
- **Health**: `http://5.161.200.4:8081/api/v1/health`

### 2. PostgreSQL (password-sync-postgres)
- **Container**: `password-sync-postgres`
- **External Port**: `5433`
- **Internal Port**: `5432`
- **Database**: `password_sync`
- **User**: `postgres`
- **Data**: Persistent volume `postgres_data`

### 3. Redis (password-sync-redis)
- **Container**: `password-sync-redis`
- **External Port**: `6380`
- **Internal Port**: `6379`
- **Purpose**: Breach report caching
- **Data**: Persistent volume `redis_data`

## Environment Variables

Configuration is stored in `.env.production`:

```env
# PostgreSQL
POSTGRES_DB=password_sync
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SecureP@ssw0rd2025!

# Redis
REDIS_PASSWORD=RedisSecure2025!

# JWT Secret
JWT_SECRET=YXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGY=

# External APIs
HIBP_API_KEY=8fc653bd98934b58beb09577d41a589c
NIST_API_KEY=db4b1c7e-5a24-4d08-9a95-97f177070b43
```

## API Endpoints

Once deployed, the API is available at:

### Public Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `GET /api/v1/health` - Health check

### Protected Endpoints (require JWT)
- `GET /api/v1/sync/manifest` - Get sync manifest
- `POST /api/v1/sync/pull` - Pull encrypted credentials
- `POST /api/v1/sync/push` - Push encrypted credentials
- `DELETE /api/v1/sync/credentials` - Delete all credentials
- `GET /api/v1/sync/live` - WebSocket real-time sync
- `POST /api/v1/breach/check` - Check email for breaches
- `POST /api/v1/breach/enrich-cve` - Enrich breach with CVE data
- `POST /api/v1/cve/search` - Search CVEs
- `GET /api/v1/cve/latest` - Get latest CVEs

## Testing After Deployment

```bash
# Health check
curl http://5.161.200.4:8081/api/v1/health

# Register test user
curl -X POST http://5.161.200.4:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://5.161.200.4:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Mobile/Desktop Client Configuration

Update client configuration to point to production server:

### Mobile (Flutter)
Edit `clients/mobile/lib/config/environment.dart`:
```dart
class Environment {
  static const String apiBaseUrl = 'http://5.161.200.4:8081';
  static const String wsBaseUrl = 'ws://5.161.200.4:8081';
  // ...
}
```

### Desktop (Electron/Angular)
Edit `clients/desktop/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://5.161.200.4:8081',
  wsUrl: 'ws://5.161.200.4:8081'
};
```

## Troubleshooting

### View Container Logs
```bash
ssh root@5.161.200.4
cd /root/app/password-sync
docker-compose logs -f api          # API server logs
docker-compose logs -f postgres     # Database logs
docker-compose logs -f redis        # Redis logs
```

### Restart Specific Service
```bash
docker-compose restart api
docker-compose restart postgres
docker-compose restart redis
```

### Check Database
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d password_sync

# List tables
\dt

# Check users
SELECT * FROM users;
```

### Check Redis
```bash
# Connect to Redis
docker-compose exec redis redis-cli -a RedisSecure2025!

# Check keys
KEYS *
```

## Firewall Rules

The server already has UFW configured. Port 8081 needs to be opened:

```bash
ssh root@5.161.200.4
ufw allow 8081/tcp
ufw status
```

## SSL/TLS Setup (Optional)

To add HTTPS support with Let's Encrypt:

1. Point a domain to `5.161.200.4`
2. Install Nginx reverse proxy
3. Use Certbot for SSL certificates

See `docs/v1/deployment/SSL_SETUP.md` for details.

## Monitoring

- **Portainer**: http://5.161.200.4:9000 (Docker management UI)
- **Grafana**: http://5.161.200.4:3000 (Metrics dashboard)

## Backup

### Database Backup
```bash
docker-compose exec postgres pg_dump -U postgres password_sync > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres password_sync
```

## Updates

To deploy updates:

```bash
# Local machine
make deploy-prod

# Or manually
./deploy/deploy.sh
```
