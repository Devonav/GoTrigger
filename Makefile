.PHONY: build test run clean install-deps docker-up docker-down docker-logs db-seed run-multi desktop-install desktop-dev desktop-build

build:
	go build -o bin/password-sync server/cmd/main.go

test:
	go test -v ./test/unit/... -coverprofile=coverage.out
	go tool cover -func=coverage.out

test-integration:
	go test -v ./test/integration/...

# Single-user mode (no Postgres, uses SQLite only)
run:
	go run server/cmd/main.go -password=dev-password -port=8080

# Multi-tenant mode (with Postgres)
run-multi:
	@echo "Starting multi-tenant mode..."
	@echo "Make sure Postgres is running: make docker-up"
	go run server/cmd/main.go \
		-postgres="postgres://postgres:postgres@localhost:5432/password_sync?sslmode=disable" \
		-port=8080 \
		-jwt-secret="dev-secret-change-in-production"

# Docker commands
docker-up:
	@echo "Starting Postgres container..."
	cd docker && docker-compose up -d
	@echo "Waiting for Postgres to be ready..."
	@sleep 3
	@echo "✅ Postgres is ready at localhost:5432"

docker-down:
	@echo "Stopping Postgres container..."
	cd docker && docker-compose down

docker-down-clean:
	@echo "⚠️  Stopping Postgres and removing ALL data..."
	cd docker && docker-compose down -v
	@echo "✅ Clean slate - next 'docker-up' will reinitialize schema"

docker-restart-clean: docker-down-clean docker-up
	@echo "✅ Postgres restarted with fresh schema"

docker-logs:
	cd docker && docker-compose logs -f postgres

docker-psql:
	docker exec -it password-sync-postgres psql -U postgres -d password_sync

# Apply schema to existing database (DESTRUCTIVE - drops all data)
db-reset:
	@echo "⚠️  WARNING: This will DROP ALL TABLES and recreate them!"
	@read -p "Are you sure? Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || (echo "Aborted" && exit 1)
	@echo "Dropping and recreating schema..."
	@psql "postgres://postgres:postgres@localhost:5432/password_sync?sslmode=disable" < server/storage/drop_tables.sql 2>/dev/null || true
	@psql "postgres://postgres:postgres@localhost:5432/password_sync?sslmode=disable" < server/storage/postgres_schema.sql
	@echo "✅ Schema reset complete"

# Seed test data (requires Postgres running)
db-seed:
	@echo "Seeding test data..."
	go run scripts/seed.go \
		-postgres="postgres://postgres:postgres@localhost:5432/password_sync?sslmode=disable"

# Full local setup
dev-setup: docker-up
	@sleep 2
	@make db-seed
	@echo ""
	@echo "✅ Development environment ready!"
	@echo ""
	@echo "Test user created:"
	@echo "  Email: test@example.com"
	@echo "  Password: password123"
	@echo ""
	@echo "Start server: make run-multi"
	@echo "Test API: Open test/api/auth.http in VS Code"

install-deps:
	go mod download
	go mod tidy

clean:
	rm -rf bin/
	rm -f keychain.db
	rm -f coverage.out

fmt:
	go fmt ./...

vet:
	go vet ./...

lint: fmt vet
	@echo "Linting complete"

# Desktop client commands (Electron)
desktop-install:
	@echo "Installing desktop client dependencies..."
	cd clients/desktop && npm install

desktop-dev:
	@echo "Starting desktop client in development mode..."
	@echo "Make sure server is running: make run-multi"
	cd clients/desktop && npm run electron:dev

desktop-build:
	@echo "Building desktop client..."
	cd clients/desktop && npm run build && npm run electron:build

desktop-package-mac:
	@echo "Packaging desktop client for macOS..."
	cd clients/desktop && npm run package:mac

desktop-package-win:
	@echo "Packaging desktop client for Windows..."
	cd clients/desktop && npm run package:win

desktop-package-linux:
	@echo "Packaging desktop client for Linux..."
	cd clients/desktop && npm run package:linux

# Production Deployment
deploy-prod:
	@echo "🚀 Deploying to production server..."
	@./deploy/deploy.sh

deploy-check:
	@echo "🔍 Checking production server status..."
	@ssh root@5.161.200.4 "cd /root/app/password-sync && docker-compose ps && echo '' && docker-compose logs --tail=20 api"

deploy-logs:
	@echo "📋 Viewing production logs..."
	@ssh root@5.161.200.4 "cd /root/app/password-sync && docker-compose logs -f"

deploy-restart:
	@echo "🔄 Restarting production services..."
	@ssh root@5.161.200.4 "cd /root/app/password-sync && docker-compose restart"

deploy-down:
	@echo "⚠️  Stopping production services..."
	@ssh root@5.161.200.4 "cd /root/app/password-sync && docker-compose down"
