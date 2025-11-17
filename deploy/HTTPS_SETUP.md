# HTTPS Deployment Setup for gotrigger.org

## Summary

Your domain **gotrigger.org** is now configured with Cloudflare and pointed to your server at `5.161.200.4`. This guide will help you set up Nginx as a reverse proxy to handle HTTPS traffic.

## What's Already Updated

✅ Desktop client environment files (`environment.ts`, `environment.prod.ts`)
✅ Mobile client environment files (`environment.dart`)
✅ Deployment scripts (`deploy.sh`)
✅ Jenkins pipeline (`Jenkinsfile`)

All client files now use:
- API: `https://gotrigger.org`
- WebSocket: `wss://gotrigger.org`

## Server-Side Setup Required

You need to configure your Hetzner server to handle HTTPS traffic.

### Option 1: Cloudflare Flexible SSL (Easiest - Recommended)

This is the simplest setup. Cloudflare handles SSL, and your server only needs HTTP.

**Cloudflare Settings:**
1. Go to Cloudflare Dashboard → SSL/TLS
2. Set SSL/TLS encryption mode to **Flexible**
3. DNS Settings:
   - Type: `A`
   - Name: `@` (or `gotrigger.org`)
   - Content: `5.161.200.4`
   - Proxy status: **Proxied** (orange cloud)

**Server Setup (SSH into root@5.161.200.4):**

```bash
# 1. Install Nginx
apt update
apt install -y nginx

# 2. Create Nginx configuration
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
ln -sf /etc/nginx/sites-available/password-sync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 4. Test Nginx configuration
nginx -t

# 5. Restart Nginx
systemctl restart nginx
systemctl enable nginx

# 6. Open firewall for HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw status
```

### Option 2: Cloudflare Full SSL (More Secure)

This requires SSL certificates on your server.

**Cloudflare Settings:**
1. SSL/TLS encryption mode: **Full (strict)**
2. Generate Origin Certificate:
   - Go to SSL/TLS → Origin Server
   - Click "Create Certificate"
   - Save the certificate and private key

**Server Setup:**

```bash
# 1. Save Cloudflare Origin Certificates
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/cloudflare/gotrigger.org.pem
# Paste the origin certificate

nano /etc/ssl/cloudflare/gotrigger.org.key
# Paste the private key

chmod 600 /etc/ssl/cloudflare/gotrigger.org.key

# 2. Install Nginx (if not already installed)
apt update
apt install -y nginx

# 3. Create Nginx configuration with SSL
cat > /etc/nginx/sites-available/password-sync <<'EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gotrigger.org www.gotrigger.org;

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Main Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gotrigger.org www.gotrigger.org;

    # SSL Configuration (Cloudflare Origin Certificate)
    ssl_certificate /etc/ssl/cloudflare/gotrigger.org.pem;
    ssl_certificate_key /etc/ssl/cloudflare/gotrigger.org.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/gotrigger-access.log;
    error_log /var/log/nginx/gotrigger-error.log;

    # Client body size
    client_max_body_size 10M;

    # Cloudflare Real IP
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
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API Routes
    location /api/ {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket endpoint
    location /api/v1/sync/live {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    location / {
        return 200 '{"service":"Password Sync API","status":"running","domain":"gotrigger.org"}';
        add_header Content-Type application/json;
    }
}
EOF

# 4. Enable and restart
ln -sf /etc/nginx/sites-available/password-sync /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

# 5. Firewall
ufw allow 80/tcp
ufw allow 443/tcp
```

## Verification

After setting up Nginx, test your deployment:

```bash
# Test from your local machine
curl https://gotrigger.org/api/v1/health

# Should return:
# {"status":"healthy","timestamp":"..."}
```

## Troubleshooting

### Check Nginx Status
```bash
systemctl status nginx
nginx -t
```

### View Logs
```bash
tail -f /var/log/nginx/gotrigger-access.log
tail -f /var/log/nginx/gotrigger-error.log
```

### Test API Locally on Server
```bash
curl http://localhost:8081/api/v1/health
```

### Check Firewall
```bash
ufw status
```

### Verify DNS
```bash
dig gotrigger.org
# Should show: 5.161.200.4
```

## Next Steps

1. SSH into your server: `ssh root@5.161.200.4`
2. Run the setup commands from **Option 1** (recommended) or **Option 2**
3. Test the API: `curl https://gotrigger.org/api/v1/health`
4. Deploy your desktop/mobile apps with the updated configuration
5. Your Jenkins pipeline will automatically use HTTPS for health checks

## Security Recommendations

1. **Close Port 8081**: After Nginx is working, your API should only be accessible via Nginx
   ```bash
   ufw delete allow 8081/tcp
   ```

2. **Enable Cloudflare Features**:
   - Under Attack Mode (if needed)
   - WAF Rules
   - Rate Limiting
   - DDoS Protection (automatic)

3. **Monitor Logs**: Set up log rotation
   ```bash
   nano /etc/logrotate.d/nginx
   ```

## Summary of Changes

### Client-Side (Already Done ✅)
- Desktop: `environment.ts`, `environment.prod.ts` → `https://gotrigger.org`
- Mobile: `environment.dart` → `https://gotrigger.org`
- Deploy script: `deploy.sh` → HTTPS health checks
- Jenkins: `Jenkinsfile` → HTTPS health checks

### Server-Side (To Do on 5.161.200.4)
- [ ] Install Nginx
- [ ] Configure Nginx reverse proxy
- [ ] Open firewall ports 80/443
- [ ] Test HTTPS endpoint
- [ ] Close port 8081 (optional, for security)
