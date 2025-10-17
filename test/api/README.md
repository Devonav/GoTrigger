# API Testing with REST Client

Test files for Password Sync API using VS Code REST Client extension.

## Setup

### 1. Install Extension
VS Code → Extensions → Search "REST Client" → Install

### 2. Start Services
```bash
# Terminal 1: Start Postgres
cd docker && docker-compose up -d

# Terminal 2: Seed test data
make db-seed

# Terminal 3: Start server
make run-multi
```

## Test Files

### `health.http`
Basic health check (no auth required)

### `auth.http`
1. Register new user
2. Login (get JWT)
3. Refresh token
4. Error cases

**Start here!** This generates the JWT token you need for other tests.

### `devices.http`
1. Register device
2. List devices
3. Multiple device types

**Prerequisites:** Run `auth.http` first, copy `accessToken`

### `sync.http`
1. Push encrypted credentials
2. Pull encrypted credentials
3. Incremental sync
4. Delete (tombstone)

**Prerequisites:** Run `auth.http` first, copy `accessToken`

## Usage

### Quick Test Flow

1. Open `test/api/auth.http`
2. Click "Send Request" above line 14 (Register)
3. Click "Send Request" above line 28 (Login)
4. Copy `access_token` from response
5. Open `devices.http` or `sync.http`
6. Replace `YOUR_ACCESS_TOKEN_HERE` with copied token
7. Click "Send Request" on any endpoint

### Keyboard Shortcuts
- **Send Request:** `Cmd+Alt+R` (Mac) / `Ctrl+Alt+R` (Win)
- **Cancel Request:** `Cmd+Alt+K` (Mac) / `Ctrl+Alt+K` (Win)
- **View History:** `Cmd+Alt+H` (Mac) / `Ctrl+Alt+H` (Win)

### Variables
Defined at top of each file:
```http
@baseUrl = http://localhost:8080/api/v1
@email = test@example.com
@password = password123
```

Modify as needed!

### Response Capture
The `@name login` comment captures the response:
```http
# @name login
POST {{baseUrl}}/auth/login
...

# Later, use it:
@accessToken = {{login.response.body.access_token}}
```

## Expected Responses

### Successful Login
```json
{
  "user_id": "uuid-123",
  "email": "test@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "uuid-456"
}
```

### Successful Sync Push
```json
{
  "gencount": 2,
  "synced": 2
}
```

### Successful Sync Pull
```json
{
  "updates": [
    {
      "uuid": "550e8400-...",
      "gencount": 1,
      "wrappedkey": "base64...",
      "encitem": "base64...",
      "tombstone": false
    }
  ],
  "gencount": 2
}
```

## Troubleshooting

### Error: Connection Refused
- Make sure server is running: `make run-multi`
- Check port 8080 is free: `lsof -i :8080`

### Error: 401 Unauthorized
- JWT token expired (15min lifetime)
- Re-run `auth.http` to get new token

### Error: 404 Not Found
- Check baseUrl is correct
- Ensure server started in multi-tenant mode

### Error: relation "users" does not exist
- Database not initialized
- Run: `cd docker && docker-compose down -v && docker-compose up -d`
- Run: `make db-seed`
