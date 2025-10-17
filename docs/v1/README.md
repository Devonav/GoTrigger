# Password Sync Documentation - Version 1

This directory contains all documentation for Password Sync Version 1.

## 📖 Start Here

**New to the project?** → [QUICK_START.md](QUICK_START.md)

**Need to find something?** → [INDEX.md](INDEX.md)

**What changed recently?** → [CHANGELOG.md](CHANGELOG.md)

## 📚 Documentation Categories

### Getting Started
- [QUICK_START.md](QUICK_START.md) - 5-minute setup guide
- [QUICKSTART.md](QUICKSTART.md) - Legacy quickstart (for reference)

### Architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Core design patterns
- [ARCHITECTURE_STORAGE.md](ARCHITECTURE_STORAGE.md) - Storage layer
- [ARCHITECTURE_REFACTOR.md](ARCHITECTURE_REFACTOR.md) - Refactoring plans

### Deployment
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Pre-deployment checks

### Troubleshooting
- [FIXES.md](FIXES.md) - All documented bug fixes
- [DOCKER_SCHEMA_FIX.md](DOCKER_SCHEMA_FIX.md) - Schema sync issue
- [CRITICAL_BUG_GENCOUNT.md](CRITICAL_BUG_GENCOUNT.md) - GenCount issue
- [BUG_HUNT_REPORT.md](BUG_HUNT_REPORT.md) - Bug hunt results

### Project History
- [SPRINT_SUMMARY.md](SPRINT_SUMMARY.md) - Sprint summaries
- [REORGANIZATION_SUMMARY.md](REORGANIZATION_SUMMARY.md) - Restructuring
- [CHANGELOG.md](CHANGELOG.md) - Version changelog

## 🔗 Navigation

This documentation is accessible via:
- Direct path: `docs/v1/`
- Symlink: `docs/current/` (points to active version)
- From root README: Links to `docs/current/`

## 📝 Contributing to Docs

When adding or updating documentation:

1. **Create/edit in this directory** (`docs/v1/`)
2. **Update [INDEX.md](INDEX.md)** if adding new files
3. **Update [CHANGELOG.md](CHANGELOG.md)** with your changes
4. **Cross-reference** related docs
5. **Use consistent naming**: SCREAMING_SNAKE_CASE.md

## 🔄 Version Management

**Current Version:** v1 (October 2025)

When breaking changes require v2:
```bash
cp -r docs/v1 docs/v2
rm docs/current
ln -s v2 docs/current
# Edit v2/ files
# Keep v1/ for reference
```

---

**Quick Links:**
- [📋 Full Index](INDEX.md)
- [🚀 Quick Start](QUICK_START.md)
- [📝 Changelog](CHANGELOG.md)
- [🏗️ Architecture](ARCHITECTURE.md)
