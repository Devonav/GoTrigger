#!/bin/bash

# Nginx Setup Script for Password Sync API
# Domain: gotrigger.org
# Server: 5.161.200.4

set -e

echo "🚀 Setting up Nginx for gotrigger.org"
echo "========================================"

# 1. Install Nginx
echo "📦 Installing Nginx..."
apt update
apt install -y nginx

# 2. Create Nginx configuration
echo "⚙️  Creating Nginx configuration..."
cat > /etc/nginx/sites-available/password-sync <<'EOF'
# Password Sync API - Cloudflare Flexible SSL
server {
    listen 80;
    listen [::]:80;
    server_name gotrigger.org www.gotrigger.org;

    # Logging
    access_log /var/log/nginx/gotrigger-access.log;
    error_log /var/log/nginx/gotrigger-error.log;

    # Client body size (for credential imports)
    client_max_body_size 10M;

    # Get real IP from Cloudflare
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Routes
    location /api/ {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection "";

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket endpoint for real-time sync
    location /api/v1/sync/live {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Long timeout for WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Root path
    location / {
        return 200 '{"service":"Password Sync API","status":"running","domain":"gotrigger.org"}';
        add_header Content-Type application/json;
    }
}
EOF

# 3. Enable the site
echo "🔗 Enabling site..."
ln -sf /etc/nginx/sites-available/password-sync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 4. Test Nginx configuration
echo "✅ Testing Nginx configuration..."
nginx -t

# 5. Restart Nginx
echo "🔄 Restarting Nginx..."
systemctl restart nginx
systemctl enable nginx

# 6. Open firewall for HTTP/HTTPS
echo "🔥 Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp

echo ""
echo "✅ Nginx setup complete!"
echo ""
echo "📊 Status:"
systemctl status nginx --no-pager | head -10
echo ""
echo "🧪 Testing endpoints:"
echo "   Local API: curl http://localhost:8081/api/v1/health"
echo "   Via Nginx: curl http://localhost/api/v1/health"
echo ""
echo "🌐 Your API should now be accessible at:"
echo "   https://gotrigger.org/api/v1/health"
echo ""
echo "🔒 Optional: Close port 8081 to external access (Nginx will proxy internally)"
echo "   ufw delete allow 8081/tcp"
