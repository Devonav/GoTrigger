# Documentation Index - Version 1

**Last Updated:** October 3, 2025  
**Version:** v1  
**Status:** Current

---

## 📁 File Cabinet Structure

```
docs/current/
├── INDEX.md                    # ← You are here
├── README.md                   # Documentation overview
├── CHANGELOG.md                # Version changelog
│
├── architecture/               # System design & architecture
├── bugs/                       # Bug reports & fixes
├── deployment/                 # Production deployment
├── desktop-client/             # Desktop app specifics
├── guides/                     # Getting started guides
├── history/                    # Project history & sprints
└── testing/                    # Test plans & scripts
```

---

## 🏗️ Architecture

**Location:** `architecture/`

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** | Core architecture (Apple Keychain-inspired) |
| **[ARCHITECTURE_STORAGE.md](architecture/ARCHITECTURE_STORAGE.md)** | Storage layer (Postgres + SQLite) |
| **[ARCHITECTURE_REFACTOR.md](architecture/ARCHITECTURE_REFACTOR.md)** | Refactoring roadmap |
| **[SERVER_TRIPLE_LAYER.md](architecture/SERVER_TRIPLE_LAYER.md)** | ✅ Server triple-layer implementation |
| **[CLIENT_TRIPLE_LAYER.md](architecture/CLIENT_TRIPLE_LAYER.md)** | ✅ Client triple-layer services |
| **[AUTH_VS_VAULT.md](architecture/AUTH_VS_VAULT.md)** | 🔐 Auth vs Vault password separation |

---

## 🐛 Bugs & Fixes

**Location:** `bugs/`

| Document | Description |
|----------|-------------|
| **[FIXES.md](bugs/FIXES.md)** | All bug fixes catalog |
| **[BUG_HUNT_REPORT.md](bugs/BUG_HUNT_REPORT.md)** | Comprehensive bug hunt results |
| **[CRITICAL_BUG_GENCOUNT.md](bugs/CRITICAL_BUG_GENCOUNT.md)** | GenCount persistence issue |
| **[DOCKER_SCHEMA_FIX.md](bugs/DOCKER_SCHEMA_FIX.md)** | Docker schema sync fix |
| **[BUGFIX_VAULT_LOCK.md](bugs/BUGFIX_VAULT_LOCK.md)** | Vault lock button fix |

---

## 🚢 Deployment

**Location:** `deployment/`

| Document | Description |
|----------|-------------|
| **[DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md)** | Pre-deployment verification |
| **[DEPLOYMENT.md](deployment/DEPLOYMENT.md)** | Production deployment guide |

---

## 🖥️ Desktop Client

**Location:** `desktop-client/`

| Document | Description |
|----------|-------------|
| **[TROUBLESHOOTING.md](desktop-client/TROUBLESHOOTING.md)** | Common issues & solutions |
| **[AUTH_FLOW.md](desktop-client/AUTH_FLOW.md)** | Authentication flow |
| **[BIOMETRIC_SETUP.md](desktop-client/BIOMETRIC_SETUP.md)** | Biometric auth setup |
| **[ELECTRON_BUILD_FIX.md](desktop-client/ELECTRON_BUILD_FIX.md)** | Electron build issues |
| **[HOT_RELOAD_FIX.md](desktop-client/HOT_RELOAD_FIX.md)** | Hot reload fixes |
| **[IPC_HANDLER_FIX.md](desktop-client/IPC_HANDLER_FIX.md)** | IPC handler fixes |
| **[BUGFIXES.md](desktop-client/BUGFIXES.md)** | Desktop-specific fixes |
| **[AUTH_README.md](desktop-client/AUTH_README.md)** | Auth service docs |
| **[CRYPTO_README.md](desktop-client/CRYPTO_README.md)** | Crypto service docs |
| **[SYNC_README.md](desktop-client/SYNC_README.md)** | Sync service docs |

---

## 📚 Guides

**Location:** `guides/`

| Document | Description |
|----------|-------------|
| **[QUICK_START.md](guides/QUICK_START.md)** | Fast setup (5 minutes) |
| **[QUICKSTART.md](guides/QUICKSTART.md)** | Original quickstart (legacy) |

---

## 📈 History

**Location:** `history/`

| Document | Description |
|----------|-------------|
| **[SPRINT_SUMMARY.md](history/SPRINT_SUMMARY.md)** | Triple-layer sprint |
| **[REORGANIZATION_SUMMARY.md](history/REORGANIZATION_SUMMARY.md)** | Project restructuring |
| **[DOCUMENTATION_COMPLETE.md](history/DOCUMENTATION_COMPLETE.md)** | Docs reorganization |

---

## 🧪 Testing

**Location:** `testing/`

| Document | Description |
|----------|-------------|
| **[TEST_E2E.md](testing/TEST_E2E.md)** | End-to-end test script |
| **[E2E_TEST_PLAN.md](testing/E2E_TEST_PLAN.md)** | Detailed test scenarios |

---

## 🔗 Quick Links by Task

| I want to... | Go here |
|--------------|---------|
| **Set up the project** | [guides/QUICK_START.md](guides/QUICK_START.md) |
| **Understand the architecture** | [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| **Learn about triple-layer sync** | [architecture/SERVER_TRIPLE_LAYER.md](architecture/SERVER_TRIPLE_LAYER.md) |
| **Understand auth vs vault** | [architecture/AUTH_VS_VAULT.md](architecture/AUTH_VS_VAULT.md) |
| **Fix schema issues** | [bugs/DOCKER_SCHEMA_FIX.md](bugs/DOCKER_SCHEMA_FIX.md) |
| **Test the app** | [testing/TEST_E2E.md](testing/TEST_E2E.md) |
| **Deploy to production** | [deployment/DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md) |
| **Troubleshoot desktop app** | [desktop-client/TROUBLESHOOTING.md](desktop-client/TROUBLESHOOTING.md) |
| **See what changed** | [CHANGELOG.md](CHANGELOG.md) |

---

## 📅 Recent Updates

**October 3, 2025:**
- ✅ Auth fix & vault password separation
- ✅ Client triple-layer services complete
- ✅ Server sync integration
- ✅ Add credential UI form
- ✅ Documentation reorganized

**October 2, 2025:**
- ✅ Server triple-layer architecture
- ✅ Vault lock button fix
- ✅ Docker schema fix
- ✅ Quick start guide

**October 1, 2025:**
- ✅ Project restructuring (internal → server)
- ✅ Master password vulnerability fix

---

## 📝 Documentation Standards

### Adding New Docs

1. **Choose the right folder:**
   - Architecture? → `architecture/`
   - Bug fix? → `bugs/`
   - Guide? → `guides/`
   - Test? → `testing/`

2. **Update this INDEX.md** - Add your doc to the table

3. **Update CHANGELOG.md** - Note what you added

4. **Cross-reference** - Link to related docs

5. **Use SCREAMING_SNAKE_CASE** for filenames

### File Naming

✅ `ARCHITECTURE.md`  
✅ `QUICK_START.md`  
✅ `BUG_FIX_AUTH.md`  
❌ `architecture.md`  
❌ `quick-start.md`  
❌ `bugFixAuth.md`

---

## 🔄 Version Control

This is **Version 1** documentation.

- Current: `docs/current/` → symlink to `v1/`
- All v1 docs: `docs/v1/`
- Future: `docs/v2/`, `docs/v3/`, etc.

### Upgrading to v2

```bash
# 1. Copy v1 to v2
cp -r docs/v1 docs/v2

# 2. Update symlink
rm docs/current
ln -s v2 docs/current

# 3. Update docs in v2/
# 4. Keep v1/ as historical reference
```

---

**Total Documents:** 33  
**Folders:** 8  
**Version:** v1  
**Maintained by:** Password Sync Team
