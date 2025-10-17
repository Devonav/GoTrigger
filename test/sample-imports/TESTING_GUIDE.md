# Import Testing Guide

Quick reference for testing all import formats.

## 🚀 Quick Test Methods

### Method 1: Automated Unit Tests (Fastest)
```bash
cd clients/desktop
npm test -- import.service.spec.ts
```

**Coverage:**
- ✅ All 6 formats (Generic, Bitwarden, Chrome, LastPass, Firefox, Safari)
- ✅ CSV injection prevention
- ✅ HTML entity decoding
- ✅ Error handling
- ✅ Field validation

**Time:** ~5 seconds

---

### Method 2: Quick File Validation (Fast)
```bash
cd test/sample-imports
./test-all-imports.sh
```

**What it does:**
- Validates all CSV files exist
- Checks file structure
- Shows sample data preview
- Reports any issues

**Time:** ~1 second

---

### Method 3: Manual UI Testing (Thorough)
```bash
cd clients/desktop
npm run electron:dev
```

Then follow the test matrix below.

**Time:** ~5 minutes for all formats

---

## 📋 Test Matrix

| Format | File | Expected Result |
|--------|------|-----------------|
| **LastPass** | `lastpass-format.csv` | 6 credentials, folders in notes, TOTP codes, favorites marked |
| **Firefox** | `firefox-format.csv` | 6 credentials, metadata ignored, clean import |
| **Safari** | `safari-format.csv` | 6 credentials, OTP in notes, case-sensitive headers work |
| **Bitwarden** | `bitwarden-format.csv` | 5 credentials, folders noted |
| **Chrome** | `chrome-format.csv` | 5 credentials, standard import |
| **Generic** | `generic-format.csv` | 5 credentials, basic fields only |

---

## 🧪 Test Scenarios

### Scenario 1: Happy Path (All Formats)
```
For each format:
1. Select format from dropdown
2. Choose corresponding CSV file
3. Click Import
4. Verify: "Imported: X credentials"
5. Check vault shows new credentials
```

### Scenario 2: LastPass Special Features
```
1. Import lastpass-format.csv
2. Open credential "GitHub"
3. Verify notes contain:
   - "TOTP: JBSWY3DPEHPK3PXP"
   - "Folder: Development"
   - "Favorite: Yes"
4. Open credential "StackOverflow"
5. Verify HTML decoded: "Q&A account" (not "Q&amp;A")
```

### Scenario 3: Safari Case Sensitivity
```
1. Import safari-format.csv
2. Verify all 6 credentials imported
3. Check credential "Dropbox"
4. Verify notes contain OTP code
```

### Scenario 4: Error Handling
```
1. Create empty.csv with only headers
2. Try to import
3. Verify: "No credentials found" error
```

### Scenario 5: Large Import
```
1. Duplicate lastpass-format.csv 100 times
2. Import file with 600 credentials
3. Verify: All imported successfully
4. Check performance (should be < 30 seconds)
```

---

## ✅ Success Checklist

After testing, verify:

- [ ] All 6 formats show in dropdown
- [ ] Generic CSV imports successfully
- [ ] Bitwarden CSV imports successfully
- [ ] Chrome CSV imports successfully
- [ ] LastPass CSV imports with folders/TOTP in notes
- [ ] Firefox CSV imports and ignores metadata
- [ ] Safari CSV imports with capitalized headers
- [ ] HTML entities are decoded (LastPass)
- [ ] CSV injection prevented (no formulas execute)
- [ ] Duplicate credentials can be imported
- [ ] Empty/invalid files show proper errors
- [ ] Large files (100+ credentials) import smoothly
- [ ] Imported credentials sync to server
- [ ] Vault refreshes after import

---

## 🐛 Known Issues / Expected Behavior

### LastPass
- **Folders not UI-visible:** Currently stored in notes (folder UI coming later)
- **TOTP not functional:** Stored in notes, TOTP feature not yet implemented
- **Favorites:** Marked in notes, no favorite UI yet

### Safari
- **Case-sensitive:** Must use exact header names (Title, Url, Username, Password, OTPAuth)
- **OTP codes:** Stored in notes, not yet functional

### All Formats
- **No duplicate detection:** Will import duplicates (feature coming in Sprint 2)
- **No preview:** Import happens immediately (preview coming in Sprint 2)

---

## 📊 Performance Benchmarks

| Credentials | Expected Time | Memory Usage |
|-------------|---------------|--------------|
| 10 | < 1s | ~5MB |
| 100 | < 5s | ~10MB |
| 1000 | < 30s | ~50MB |
| 5000 | < 2min | ~200MB |

If imports are slower, check:
- Vault is unlocked
- Network connection (for server sync)
- No other heavy processes running

---

## 🔍 Debugging Import Issues

### "No credentials found"
**Cause:** File has no data rows, only headers
**Fix:** Verify file has at least 1 data row

### "Missing required fields"
**Cause:** Row missing url, username, or password
**Fix:** Check CSV has all three columns populated

### "Parse error"
**Cause:** Invalid CSV format (unmatched quotes, wrong encoding)
**Fix:**
- Re-save as UTF-8
- Check for unescaped quotes
- Use sample files as template

### "File too large"
**Cause:** File > 10MB
**Fix:** Split into multiple files

### Safari import fails
**Cause:** Lowercase headers
**Fix:** Ensure headers are: `Title,Url,Username,Password,OTPAuth`

### LastPass HTML entities not decoded
**Cause:** Bug in importer
**Fix:** Should auto-decode, report if not working

---

## 📝 Creating Custom Test Files

### Minimal Valid CSV (Generic)
```csv
url,username,password,notes
https://example.com,user,pass,My note
```

### Minimal Valid CSV (LastPass)
```csv
url,username,password,totp,extra,name,grouping,fav
https://example.com,user,pass,,,Example,Work,0
```

### Minimal Valid CSV (Firefox)
```csv
url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
https://example.com,user,pass,,,{guid},0,0,0
```

### Minimal Valid CSV (Safari)
```csv
Title,Url,Username,Password,OTPAuth
Example,https://example.com,user,pass,
```

---

## 🎯 Next Testing (Sprint 2)

When these features are added:
- [ ] Import preview (test preview table shows correctly)
- [ ] Duplicate detection (test skips existing credentials)
- [ ] Export functionality (test export → import roundtrip)
- [ ] Progress indicator (test shows progress for large files)
- [ ] Format auto-detection (test suggests correct format)

---

**Last Updated:** Sprint 1 Complete
**Total Test Coverage:** 6 formats, 31 sample credentials
