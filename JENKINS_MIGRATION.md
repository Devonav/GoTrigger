# 🔄 Migrating to Jenkins CI/CD Pipeline

## Current Setup vs Jenkins Pipeline

### **Current Manual Deployment** (What you have now)
Located in `/deploy` folder:
- ✅ `Dockerfile` - Builds Go server image
- ✅ `docker-compose.prod.yml` - Runs API + PostgreSQL + Redis
- ✅ `.env.production` - Environment variables
- ✅ `deploy.sh` - Manual deployment script
- ✅ `README.md` - Deployment instructions

**Current Process:**
```bash
make deploy-prod  # Manually run from your local machine
```

This:
1. Copies files to server via rsync
2. Builds Docker image on server
3. Starts containers

---

### **Jenkins CI/CD Pipeline** (Automated)

**New Process:**
```bash
git push origin main  # Automatically triggers Jenkins
```

Jenkins will:
1. ✅ Pull code from GitHub
2. ✅ Run tests
3. ✅ Build Docker image
4. ✅ Push image to Docker Hub
5. ✅ Deploy to production server
6. ✅ Run health checks
7. ✅ Send notifications (optional)

---

## Migration Steps

### **1. Prerequisites**

✅ Jenkins installed on server (port 8080 - available, not conflicting)
✅ GitHub repository with your code
✅ Docker Hub account (for image registry)
✅ Current deployment working (`http://5.161.200.4:8081`)

**Note:** Port 8080 is available for Jenkins. The Password Sync API runs on port 8081.

---

### **2. Setup Jenkins**

#### A. Access Jenkins
Open: `http://5.161.200.4:8080`

#### B. Install Required Plugins
Dashboard → Manage Jenkins → Plugins → Available
- [x] Docker Pipeline
- [x] Git
- [x] GitHub Integration
- [x] NodeJS Plugin
- [x] SSH Agent Plugin

#### C. Configure Credentials
Dashboard → Manage Jenkins → Credentials → System → Global credentials

**Add these credentials:**

1. **Docker Hub** (id: `docker-hub`)
   - Kind: Username with password
   - Username: Your Docker Hub username
   - Password: Your Docker Hub password

2. **Production Server SSH** (id: `prod-server-ssh`)
   - Kind: SSH Username with private key
   - Username: `root`
   - Private Key: Enter your SSH private key
   - (Or generate new key: `ssh-keygen -t ed25519`)

3. **GitHub Token** (optional, id: `github-token`)
   - Kind: Secret text
   - Secret: GitHub Personal Access Token

---

### **3. Create Docker Hub Repository**

Go to: `https://hub.docker.com`
1. Create new repository: `password-sync`
2. Make it public or private
3. Your image will be: `yourusername/password-sync:latest`

Update `Jenkinsfile`:
```groovy
environment {
    DOCKER_IMAGE = 'yourusername/password-sync'  // Change this
}
```

---

### **4. Update Deployment Files**

Your `/deploy` folder already has everything needed!

**Update `docker-compose.prod.yml` to use Docker Hub image:**

Change this line:
```yaml
api:
  build:
    context: .
    dockerfile: deploy/Dockerfile
```

To this:
```yaml
api:
  image: yourusername/password-sync:latest
```

This makes the deployment pull from Docker Hub instead of building locally.

---

### **5. Create Jenkins Pipeline Job**

**In Jenkins UI:**

1. **New Item** → Enter name: `password-sync-pipeline`
2. **Type:** Pipeline
3. **Configure:**

   **Build Triggers:**
   - ☑ GitHub hook trigger for GITScm polling

   **Pipeline:**
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `https://github.com/yourusername/password-sync.git`
   - Credentials: (select your GitHub credentials)
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

4. **Save**

---

### **6. Setup GitHub Webhook**

**In your GitHub repo:**

1. Go to: Settings → Webhooks → Add webhook
2. **Payload URL:** `http://5.161.200.4:8080/github-webhook/`
3. **Content type:** `application/json`
4. **Events:** Just the push event
5. **Active:** ☑ Yes
6. **Add webhook**

---

### **7. Push Code to GitHub**

```bash
cd /Users/devonvillalona/password-sync

# Add all changes
git add .

# Commit
git commit -m "Add Jenkins CI/CD pipeline

- Add Jenkinsfile for automated deployments
- Update docker-compose to use Docker Hub images
- Configure production deployment automation
"

# Push (this will trigger Jenkins!)
git push origin main
```

---

### **8. Test the Pipeline**

1. Watch Jenkins: `http://5.161.200.4:8080/job/password-sync-pipeline/`
2. You'll see the build start automatically
3. Click on the build number → Console Output
4. Watch it deploy!

---

## Comparison: Manual vs Jenkins

### **Manual Deployment** (Current)
```bash
# On your local machine
make deploy-prod
```
**Time:** ~2 minutes
**Triggers:** Manual only
**Testing:** Manual
**Notifications:** None

### **Jenkins Pipeline** (Automated)
```bash
# On your local machine
git push origin main
```
**Time:** ~3 minutes (includes tests)
**Triggers:** Automatic on git push
**Testing:** Automatic (Go tests, health checks)
**Notifications:** Slack/Email/Discord (optional)

---

## What Gets Deployed

### **Files Copied to Server**
❌ None! Jenkins doesn't copy source code to production.

### **Docker Image Created**
✅ Built once by Jenkins
✅ Pushed to Docker Hub
✅ Server pulls from Docker Hub

### **Services Running**
✅ PostgreSQL (port 5433)
✅ Redis (port 6380)
✅ API Server (port 8081)

---

## Rollback Strategy

### **Manual Deployment**
```bash
# SSH to server
ssh root@5.161.200.4
cd /root/app/password-sync
docker-compose down
git checkout <previous-commit>
docker-compose up -d
```

### **Jenkins Pipeline**
```bash
# In Jenkins UI
# Go to previous build → Replay
# Or redeploy specific Docker image version
ssh root@5.161.200.4
cd /root/app/password-sync
docker pull yourusername/password-sync:123  # Specific build number
docker-compose up -d
```

---

## Monitoring After Migration

### **Check Jenkins Build Status**
`http://5.161.200.4:8080/job/password-sync-pipeline/`

### **Check Production API**
`http://5.161.200.4:8081/api/v1/health`

### **View Deployment Logs**
```bash
ssh root@5.161.200.4
cd /root/app/password-sync
docker-compose logs -f api
```

---

## Troubleshooting

### **Jenkins can't connect to GitHub**
- Check GitHub webhook is active
- Check firewall allows port 8080
- Verify GitHub credentials in Jenkins

### **Docker build fails**
- Check Docker Hub credentials
- Verify Dockerfile path
- Check server has enough disk space

### **Deployment fails**
- Check SSH credentials
- Verify `.env.production` exists on server
- Check PostgreSQL and Redis are running

### **Health check fails**
- Check API logs: `docker-compose logs api`
- Verify database schema initialized
- Check port 8081 is open

---

## Key Files

### **For Jenkins (in repo)**
- `Jenkinsfile` - Pipeline definition
- `deploy/Dockerfile` - Docker build
- `deploy/docker-compose.prod.yml` - Production services

### **On Production Server**
- `/root/app/password-sync/docker-compose.yml` - Service config
- `/root/app/password-sync/.env` - Environment variables
- `/var/lib/jenkins/` - Jenkins data

---

## Benefits of Jenkins Pipeline

✅ **Automated Testing** - Catches bugs before deployment
✅ **Consistent Deploys** - Same process every time
✅ **Audit Trail** - Track who deployed what and when
✅ **Rollback Easy** - Redeploy previous builds quickly
✅ **Notifications** - Know when deployments succeed/fail
✅ **No Local Dependencies** - Deploy from anywhere via git push

---

## Next Steps After Migration

1. **Add Slack notifications** - Get alerted on deploy success/failure
2. **Add staging environment** - Test before production
3. **Add automated tests** - Unit tests, integration tests
4. **Add code quality checks** - Linting, security scans
5. **Add database backups** - Automated daily backups
6. **Add monitoring** - Grafana dashboards

---

## Current vs Future State

### **Current (Manual)**
```
Developer → git push → GitHub
Developer → make deploy-prod → Server
```

### **Future (Jenkins)**
```
Developer → git push → GitHub
GitHub → webhook → Jenkins
Jenkins → test → build → deploy → Server
Jenkins → notify → Developer (Slack/Email)
```

---

## Cost Comparison

### **Manual Deployment**
- Time per deploy: ~5 minutes
- Deploys per week: ~10
- **Total time:** ~50 minutes/week

### **Jenkins Pipeline**
- Time per deploy: ~30 seconds (just git push)
- Deploys per week: ~20 (more frequent)
- **Total time:** ~10 minutes/week
- **Time saved:** ~40 minutes/week 🎉

---

## Questions?

**Can I still use manual deployment?**
Yes! Keep `make deploy-prod` as a backup.

**Do I need to change my code?**
No! Just the deployment process changes.

**What if Jenkins is down?**
Use manual deployment: `make deploy-prod`

**Can I deploy specific branches?**
Yes! Configure Jenkins to watch multiple branches.

---

**Ready to migrate? Follow the steps above and let me know if you hit any issues!** 🚀
