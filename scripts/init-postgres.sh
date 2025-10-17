#!/bin/bash
# Initialize Postgres database for Password Sync

set -e

DB_NAME="${DB_NAME:-password_sync}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "🐘 Initializing Postgres database: $DB_NAME"

# Create database if it doesn't exist
echo "Creating database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# Run schema
echo "Running schema..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f internal/storage/postgres_schema.sql

echo "✅ Database initialized!"
echo ""
echo "Connection string:"
echo "  postgres://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable"
