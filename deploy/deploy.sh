#!/bin/bash

# Password Sync - Production Deployment Script
# Deploys to Hetzner server: root@5.161.200.4

set -e

SERVER_IP="5.161.200.4"
SERVER_USER="root"
DEPLOY_DIR="/root/app/password-sync"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Password Sync Deployment"
echo "=========================="
echo "Server: $SERVER_USER@$SERVER_IP"
echo "Deploy Directory: $DEPLOY_DIR"
echo ""

# Check if we can connect to server
echo "📡 Testing SSH connection..."
ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo '✅ SSH connection successful'" || {
    echo "❌ Cannot connect to server"
    exit 1
}

# Create deployment directory on server
echo "📁 Creating deployment directory..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_DIR"

# Copy files to server
echo "📦 Copying files to server..."

# Copy entire project to server (excluding large dirs)
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'clients/desktop/node_modules' \
    --exclude 'clients/desktop/dist' \
    --exclude 'clients/mobile/ios' \
    --exclude 'clients/mobile/android' \
    --exclude 'clients/mobile/build' \
    --exclude 'bin' \
    --exclude 'test' \
    --exclude 'docs' \
    --exclude '.DS_Store' \
    "$LOCAL_DIR/" \
    "$SERVER_USER@$SERVER_IP:$DEPLOY_DIR/"

echo "🏗️  Building and starting containers on server..."
ssh $SERVER_USER@$SERVER_IP "cd $DEPLOY_DIR && \
    cp deploy/docker-compose.prod.yml docker-compose.yml && \
    cp deploy/.env.production .env && \
    docker-compose down 2>/dev/null || true && \
    docker-compose build && \
    docker-compose up -d"

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."
ssh $SERVER_USER@$SERVER_IP "cd $DEPLOY_DIR && docker-compose ps"

# Test API endpoint
echo "🧪 Testing API endpoint..."
sleep 5
curl -f http://$SERVER_IP:8081/api/v1/health && echo "" || {
    echo "❌ API health check failed"
    echo "📋 Checking logs..."
    ssh $SERVER_USER@$SERVER_IP "cd $DEPLOY_DIR && docker-compose logs --tail=50 api"
    exit 1
}

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📊 Service URLs:"
echo "   API Health: http://$SERVER_IP:8081/api/v1/health"
echo "   API Docs: http://$SERVER_IP:8081/api/v1"
echo ""
echo "🔐 To seed test data:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo "   cd $DEPLOY_DIR"
echo "   docker-compose exec api /app/password-sync-server --help"
echo ""
echo "📋 View logs:"
echo "   ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR && docker-compose logs -f'"
